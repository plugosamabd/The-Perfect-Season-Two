// Pure client-side P2P game actions. Mutates the shared room and broadcasts.
import {
  TEAMS_WITH_ROSTER,
  erasForTeam,
  getPlayersFor,
  getPositions,
  type Era,
  type Player,
  type Position,
} from "@/data/roster";
import {
  ALL_SEATS,
  PICKS_PER_PLAYER,
  POSITIONS,
  TURN_SECONDS,
  resolveRound,
  simSeason,
  type DefenseMove,
  type DraftedPlayer,
  type OffenseMove,
  type Seat,
  type SpinResult,
} from "@/lib/game";
import { useP2PStore, gameSync, type GameRoom, type TiebreakerState } from "@/lib/p2p";

function nowIso() { return new Date().toISOString(); }
function seatOf(room: GameRoom, playerId: string): Seat | null {
  return room.players.find((p) => p.id === playerId)?.seat ?? null;
}
function activeSeats(room: GameRoom): Seat[] {
  return room.players.map((p) => p.seat).sort((a, b) => a - b);
}
function nextSeat(room: GameRoom, from: Seat): Seat {
  const seats = activeSeats(room);
  const i = seats.indexOf(from);
  return seats[(i + 1) % seats.length];
}
function teamOf(room: GameRoom, seat: Seat): DraftedPlayer[] {
  return room.teams[seat] ?? [];
}
function isBotSeat(room: GameRoom, seat: Seat): boolean {
  const id = room.players.find((p) => p.seat === seat)?.id;
  return !!id && id.startsWith("bot_");
}
function turnIsStale(room: GameRoom): boolean {
  return Date.now() - new Date(room.turnStartedAt).getTime() > (TURN_SECONDS + 2) * 1000;
}

function rotationFor(totalSegments: number, segIndex: number, minSpins = 3, addSpins = 2): number {
  const step = 360 / totalSegments;
  const centerDeg = segIndex * step + step / 2;
  const spins = minSpins + Math.floor(Math.random() * addSpins);
  return spins * 360 + (360 - centerDeg);
}

function pickTeamSpin(): SpinResult {
  const teams = TEAMS_WITH_ROSTER;
  const teamIndex = Math.floor(Math.random() * teams.length);
  const team = teams[teamIndex];
  const teamRotation = rotationFor(teams.length, teamIndex, 4, 3);
  return {
    ts: Date.now(),
    team,
    teamIndex,
    teamRotation,
    era: null,
    eraIndex: null,
    eraRotation: null,
  };
}

function pickEraSpin(prev: SpinResult): SpinResult {
  const eras = erasForTeam(prev.team);
  if (eras.length === 0) return prev;
  const eraIndex = Math.floor(Math.random() * eras.length);
  const era = eras[eraIndex];
  const eraRotation = rotationFor(eras.length, eraIndex, 4, 3);
  return { ...prev, ts: Date.now(), era, eraIndex, eraRotation };
}

function commit(updated: GameRoom) {
  gameSync.syncRoom({ ...updated, updatedAt: nowIso() });
}
function canDrive(room: GameRoom, playerId: string): boolean {
  const seat = room.currentTurn;
  if (isBotSeat(room, seat)) return true;
  if (turnIsStale(room)) return true;
  return seatOf(room, playerId) === seat;
}

// First spin — picks the team.
export function spin(playerId: string): SpinResult | null {
  const room = useP2PStore.getState().room;
  if (!room || room.phase !== "draft" || room.spinResult) return room?.spinResult ?? null;
  if (!canDrive(room, playerId)) return null;
  const result = pickTeamSpin();
  commit({ ...room, spinResult: result });
  return result;
}

// Second spin — picks the era for the already-chosen team.
export function spinEra(playerId: string): SpinResult | null {
  const room = useP2PStore.getState().room;
  if (!room || room.phase !== "draft" || !room.spinResult || room.spinResult.era) {
    return room?.spinResult ?? null;
  }
  if (!canDrive(room, playerId)) return null;
  const result = pickEraSpin(room.spinResult);
  commit({ ...room, spinResult: result });
  return result;
}

function validatePick(room: GameRoom, seat: Seat, playerName: string, position: Position): DraftedPlayer | null {
  const spinR = room.spinResult;
  if (!spinR || !spinR.era) return null;
  const available = getPlayersFor(spinR.era, spinR.team);
  const taken = activeSeats(room).flatMap((s) => teamOf(room, s));
  const player = available.find((p) =>
    p.name === playerName &&
    !taken.some((t) => t.name === p.name && t.team === p.team && t.era === p.era));
  if (!player) return null;
  if (!getPositions(player.name).includes(position)) return null;
  if (teamOf(room, seat).some((p) => p.slot === position)) return null;
  return { ...player, slot: position };
}

export function pickPlayer(playerId: string, playerName: string, position: Position): boolean {
  const room = useP2PStore.getState().room;
  if (!room || room.phase !== "draft") return false;
  if (!canDrive(room, playerId)) return false;
  const seat = room.currentTurn;
  const drafted = validatePick(room, seat, playerName, position);
  if (!drafted) return false;
  const newTeam = [...teamOf(room, seat), drafted];
  const teams = { ...room.teams, [seat]: newTeam };
  const total = activeSeats(room).reduce((s, sn) => s + (sn === seat ? newTeam.length : teamOf(room, sn).length), 0);
  const target = activeSeats(room).length * PICKS_PER_PLAYER;
  commit({
    ...room,
    teams,
    spinResult: null,
    currentTurn: nextSeat(room, seat),
    turnStartedAt: nowIso(),
    phase: total >= target ? "sim" : "draft",
    respinUsedThisTurn: false,
  });
  return true;
}

// Respin within a turn: choose to re-spin TEAM (keep era) or ERA (keep team).
// One respin per turn, drawn from the seat's respinsTotal budget.
export function respin(playerId: string, which: "team" | "era"): boolean {
  const room = useP2PStore.getState().room;
  if (!room || room.phase !== "draft" || !room.spinResult || !room.spinResult.era) return false;
  if (!canDrive(room, playerId)) return false;
  const seat = room.currentTurn;
  if (room.respinUsedThisTurn) return false;
  const used = room.respinsUsed[seat] ?? 0;
  if (used >= (room.respinsTotal ?? 0)) return false;

  const sr = room.spinResult;
  let next: SpinResult;
  if (which === "era") {
    const eras = erasForTeam(sr.team).filter((e) => e !== sr.era);
    const pool = eras.length > 0 ? eras : erasForTeam(sr.team);
    if (pool.length === 0) return false;
    const idx = Math.floor(Math.random() * pool.length);
    const era = pool[idx];
    const eraAll = erasForTeam(sr.team);
    const eraIndex = eraAll.indexOf(era);
    next = {
      ...sr,
      ts: Date.now(),
      era,
      eraIndex,
      eraRotation: rotationFor(eraAll.length, eraIndex, 4, 3),
    };
  } else {
    // Respin team — keep era. Pick a team that has the current era; fallback to any.
    const currentEra = sr.era as Era;
    const teams = TEAMS_WITH_ROSTER.filter((t) => t !== sr.team && erasForTeam(t).includes(currentEra));
    const pool = teams.length > 0 ? teams : TEAMS_WITH_ROSTER.filter((t) => t !== sr.team);
    if (pool.length === 0) return false;
    const team = pool[Math.floor(Math.random() * pool.length)];
    const teamIndex = TEAMS_WITH_ROSTER.indexOf(team);
    const eraList = erasForTeam(team);
    const eraIndex = eraList.indexOf(currentEra);
    const finalEra = eraIndex >= 0 ? currentEra : eraList[0];
    const finalIdx = eraIndex >= 0 ? eraIndex : 0;
    next = {
      ts: Date.now(),
      team,
      teamIndex,
      teamRotation: rotationFor(TEAMS_WITH_ROSTER.length, teamIndex, 4, 3),
      era: finalEra,
      eraIndex: finalIdx,
      eraRotation: rotationFor(eraList.length, finalIdx, 4, 3),
    };
  }
  commit({
    ...room,
    spinResult: next,
    respinsUsed: { ...room.respinsUsed, [seat]: used + 1 },
    respinUsedThisTurn: true,
    turnStartedAt: nowIso(),
  });
  return true;
}

export function autoPlay(step: "spin" | "pick"): boolean {
  const room = useP2PStore.getState().room;
  if (!room || room.phase !== "draft") return false;
  const seat = room.currentTurn;
  const bot = isBotSeat(room, seat);
  if (!bot && !turnIsStale(room)) return false;

  if (step === "spin") {
    // Handle both phases: team spin first, then era spin.
    if (!room.spinResult) {
      commit({ ...room, spinResult: pickTeamSpin() });
      return true;
    }
    if (!room.spinResult.era) {
      commit({ ...room, spinResult: pickEraSpin(room.spinResult) });
      return true;
    }
    return false;
  }
  if (!room.spinResult || !room.spinResult.era) return false;
  const spinR = room.spinResult;
  const era = spinR.era as Era;
  const taken = activeSeats(room).flatMap((s) => teamOf(room, s));
  const my = teamOf(room, seat);
  const used = new Set(my.map((p) => p.slot));
  const open = POSITIONS.filter((p) => !used.has(p));
  const pool = getPlayersFor(era, spinR.team)
    .filter((p) => !taken.some((t) => t.name === p.name && t.team === p.team && t.era === p.era))
    .filter((p) => getPositions(p.name).some((pos) => open.includes(pos)))
    .sort((a, b) => b.rating - a.rating);
  if (!pool.length) return false;
  const topN = Math.min(3, pool.length);
  const r = Math.random();
  const idx = r < 0.6 ? 0 : r < 0.9 ? Math.min(1, topN - 1) : Math.min(2, topN - 1);
  const p = pool[idx];
  const allowed = getPositions(p.name).filter((pos) => open.includes(pos));
  const slot = allowed[Math.floor(Math.random() * allowed.length)];
  const drafted: DraftedPlayer = { ...p, slot };
  const newTeam = [...my, drafted];
  const teams = { ...room.teams, [seat]: newTeam };
  const total = activeSeats(room).reduce((s, sn) => s + (sn === seat ? newTeam.length : teamOf(room, sn).length), 0);
  const target = activeSeats(room).length * PICKS_PER_PLAYER;
  commit({
    ...room,
    teams,
    spinResult: null,
    currentTurn: nextSeat(room, seat),
    turnStartedAt: nowIso(),
    phase: total >= target ? "sim" : "draft",
    respinUsedThisTurn: false,
  });
  return true;
}


export function runSim() {
  const room = useP2PStore.getState().room;
  if (!room || room.phase !== "sim") return;
  if (room.records[room.players[0].seat]) return;
  const seats = activeSeats(room);
  const records: Record<number, { wins: number; losses: number }> = {};
  for (const s of seats) records[s] = simSeason(teamOf(room, s));
  const perfect = seats.filter((s) => records[s].wins === 82);
  let winner: Seat | null = null;
  let phase: GameRoom["phase"] = "result";
  let tiebreaker: TiebreakerState | null = null;
  let tiebreakerPlayers: Seat[] | null = null;
  if (perfect.length >= 2) {
    tiebreakerPlayers = perfect.slice(0, 2);
    phase = "tiebreaker_pick";
    tiebreaker = makeFreshTiebreaker(tiebreakerPlayers);
  } else if (perfect.length === 1) {
    winner = perfect[0];
  } else {
    const sorted = [...seats].sort((a, b) => records[b].wins - records[a].wins);
    const top = sorted[0];
    const tied = sorted.filter((s) => records[s].wins === records[top].wins);
    winner = tied.length === 1 ? top : 0 as unknown as Seat;
  }
  commit({
    ...room,
    records: { ...room.records, ...records },
    phase,
    winner,
    tiebreaker,
    tiebreakerPlayers,
  });
}

function makeFreshTiebreaker(players: Seat[]): TiebreakerState {
  return {
    players,
    avatars: { [players[0]]: null, [players[1]]: null } as Record<string, Player | null>,
    moves: { [players[0]]: null, [players[1]]: null },
    scores: { [players[0]]: 0, [players[1]]: 0 },
    round: 1,
    offense: players[0],
    history: [],
  };
}

export function pickAvatar(playerId: string, playerName: string): boolean {
  const room = useP2PStore.getState().room;
  if (!room || room.phase !== "tiebreaker_pick" || !room.tiebreaker) return false;
  const tb = room.tiebreaker;
  let seat = seatOf(room, playerId);
  if (!seat || !tb.players.includes(seat)) {
    const bot = tb.players.find((s) => isBotSeat(room, s));
    if (bot) seat = bot; else return false;
  }
  const pick = teamOf(room, seat).find((p) => p.name === playerName);
  if (!pick) return false;
  const newTb: TiebreakerState = { ...tb, avatars: { ...tb.avatars, [seat]: pick } };
  const phase: GameRoom["phase"] = newTb.players.every((s) => newTb.avatars[s]) ? "tiebreaker" : "tiebreaker_pick";
  commit({ ...room, tiebreaker: newTb, phase });
  return true;
}

export function submitMove(playerId: string, move: string): boolean {
  const room = useP2PStore.getState().room;
  if (!room || room.phase !== "tiebreaker" || !room.tiebreaker) return false;
  const tb = room.tiebreaker;
  let seat = seatOf(room, playerId);
  if (!seat || !tb.players.includes(seat)) {
    const bot = tb.players.find((s) => isBotSeat(room, s) && !tb.moves[String(s)]);
    if (bot) seat = bot; else return false;
  }
  const off = ["drive", "shoot", "fade"];
  const def = ["paint", "perimeter"];
  const iAmOff = tb.offense === seat;
  if (iAmOff && !off.includes(move)) return false;
  if (!iAmOff && !def.includes(move)) return false;
  const newTb: TiebreakerState = { ...tb, moves: { ...tb.moves, [seat]: move } };
  let phase: GameRoom["phase"] = "tiebreaker";
  let winner: Seat | null = null;
  if (newTb.players.every((s) => newTb.moves[s])) {
    const offMove = newTb.moves[tb.offense] as OffenseMove;
    const defSeat = newTb.players.find((s) => s !== tb.offense)!;
    const defMove = newTb.moves[defSeat] as DefenseMove;
    const side = resolveRound(offMove, defMove) === "offense" ? tb.offense : defSeat;
    newTb.scores = { ...newTb.scores, [side]: newTb.scores[side] + 1 };
    newTb.history = [...newTb.history, {
      round: newTb.round, offense: tb.offense,
      moves: { ...newTb.moves } as Record<string, string>,
      roundWinner: side,
    }];
    if (newTb.scores[side] >= 3) { winner = side; phase = "result"; }
    else {
      newTb.round += 1;
      newTb.offense = defSeat;
      newTb.moves = { [newTb.players[0]]: null, [newTb.players[1]]: null };
    }
  }
  commit({ ...room, tiebreaker: newTb, phase, winner });
  return true;
}

// Re-exports for callers
export { ALL_SEATS };
