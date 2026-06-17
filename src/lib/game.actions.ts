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
  resolveFinalsRound,
  simSeason,
  simMatchup,
  getShotsForPlayer,
  DEFENSE_TYPES,
  type DraftedPlayer,
  type Seat,
  type SpinResult,
} from "@/lib/game";
import { useP2PStore, gameSync, type GameRoom, type TiebreakerState, type FinalsOffenseMove, type FinalsDefenseMove } from "@/lib/p2p";

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

// First spin — picks the team. Timer does NOT reset here (only resets on turn advance).
export function spin(playerId: string): SpinResult | null {
  const room = useP2PStore.getState().room;
  if (!room || room.phase !== "draft" || room.spinResult) return room?.spinResult ?? null;
  if (!canDrive(room, playerId)) return null;
  const result = pickTeamSpin();
  commit({ ...room, spinResult: result });
  return result;
}

// Second spin — picks the era. Timer does NOT reset here.
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
  });
  return true;
}

export function autoPlay(step: "spin" | "pick", force = false): boolean {
  const room = useP2PStore.getState().room;
  if (!room || room.phase !== "draft") return false;
  const seat = room.currentTurn;
  const bot = isBotSeat(room, seat);
  if (!bot && !force && !turnIsStale(room)) return false;

  if (step === "spin") {
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

  if ((room.gameMode ?? "classic") === "tvt") {
    for (const s of seats) records[s] = { wins: 0, losses: 0 };
    const tvtMatchups: import("@/lib/p2p/store").TvtMatchup[] = [];
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        const sA = seats[i], sB = seats[j];
        const result = simMatchup(teamOf(room, sA), teamOf(room, sB));
        const winner = result === "A" ? sA : sB;
        if (result === "A") { records[sA].wins++; records[sB].losses++; }
        else { records[sB].wins++; records[sA].losses++; }
        tvtMatchups.push({ seatA: sA, seatB: sB, winner });
      }
    }
    const sorted = [...seats].sort((a, b) => records[b].wins - records[a].wins);
    const tiebreakerPlayers = sorted.slice(0, 2) as [Seat, Seat];
    commit({
      ...room,
      records: { ...room.records, ...records },
      tvtMatchups,
      phase: "tiebreaker_pick",
      winner: null,
      tiebreaker: makeFreshTiebreaker(tiebreakerPlayers),
      tiebreakerPlayers,
    });
    return;
  }

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
    finalistRosters: { [String(players[0])]: [], [String(players[1])]: [] },
    ballHolder: { [String(players[0])]: null, [String(players[1])]: null },
    offenseMove: null,
    defenseMove: null,
    scores: { [String(players[0])]: 0, [String(players[1])]: 0 },
    round: 1,
    offense: players[0],
    history: [],
  };
}

// ── Finals: pick 3 players per finalist ──────────────────────────────────────

export function pickFinalistPlayer(playerId: string, playerName: string): boolean {
  const room = useP2PStore.getState().room;
  if (!room || room.phase !== "tiebreaker_pick" || !room.tiebreaker) return false;
  const tb = room.tiebreaker;
  let seat = seatOf(room, playerId);
  if (!seat || !tb.players.includes(seat)) {
    const bot = tb.players.find((s) => isBotSeat(room, s) && (tb.finalistRosters[String(s)]?.length ?? 0) < 3);
    if (bot) seat = bot; else return false;
  }
  const currentRoster = tb.finalistRosters[String(seat)] ?? [];
  if (currentRoster.length >= 3) return false;
  const pick = teamOf(room, seat).find((p) => p.name === playerName);
  if (!pick) return false;
  if (currentRoster.some((p) => p.name === playerName)) return false;

  const newRoster = [...currentRoster, pick];
  const newFR = { ...tb.finalistRosters, [String(seat)]: newRoster };
  const allReady = tb.players.every((s) => (newFR[String(s)]?.length ?? 0) >= 3);

  const newBallHolder = { ...tb.ballHolder };
  if (allReady) {
    for (const s of tb.players) {
      if (!newBallHolder[String(s)]) {
        newBallHolder[String(s)] = newFR[String(s)]?.[0]?.name ?? null;
      }
    }
  }

  const newTb: TiebreakerState = {
    ...tb,
    finalistRosters: newFR,
    ballHolder: newBallHolder,
  };
  const phase: GameRoom["phase"] = allReady ? "tiebreaker" : "tiebreaker_pick";
  commit({ ...room, tiebreaker: newTb, phase });
  return true;
}

// ── Finals: submit offense move ───────────────────────────────────────────────

export function submitOffenseMove(playerId: string, playerName: string, shotType: string): boolean {
  const room = useP2PStore.getState().room;
  if (!room || room.phase !== "tiebreaker" || !room.tiebreaker) return false;
  const tb = room.tiebreaker;
  let seat = seatOf(room, playerId);
  if (!seat || !tb.players.includes(seat)) {
    const bot = tb.players.find((s) => isBotSeat(room, s) && s === tb.offense && !tb.offenseMove);
    if (bot) seat = bot; else return false;
  }
  if (seat !== tb.offense) return false;
  if (tb.offenseMove) return false;
  const roster = tb.finalistRosters[String(seat)] ?? [];
  if (!roster.some((p) => p.name === playerName)) return false;

  const offenseMove: FinalsOffenseMove = { playerName, shotType };
  const newTb: TiebreakerState = { ...tb, offenseMove };
  return resolveIfBothMoved(room, newTb);
}

// ── Finals: submit defense move ───────────────────────────────────────────────

export function submitDefenseMove(playerId: string, guardedPlayer: string, defenseType: string): boolean {
  const room = useP2PStore.getState().room;
  if (!room || room.phase !== "tiebreaker" || !room.tiebreaker) return false;
  const tb = room.tiebreaker;
  const defenseSeat = tb.players.find((s) => s !== tb.offense)!;
  let seat = seatOf(room, playerId);
  if (!seat || !tb.players.includes(seat)) {
    const bot = tb.players.find((s) => isBotSeat(room, s) && s === defenseSeat && !tb.defenseMove);
    if (bot) seat = bot; else return false;
  }
  if (seat !== defenseSeat) return false;
  if (tb.defenseMove) return false;

  const defenseMove: FinalsDefenseMove = { guardedPlayer, defenseType };
  const newTb: TiebreakerState = { ...tb, defenseMove };
  return resolveIfBothMoved(room, newTb);
}

function resolveIfBothMoved(room: GameRoom, tb: TiebreakerState): boolean {
  if (!tb.offenseMove || !tb.defenseMove) {
    commit({ ...room, tiebreaker: tb });
    return true;
  }

  const offSeat = tb.offense;
  const defSeat = tb.players.find((s) => s !== offSeat)!;
  const offRoster = tb.finalistRosters[String(offSeat)] ?? [];
  const shooter = offRoster.find((p) => p.name === tb.offenseMove!.playerName);

  const result = resolveFinalsRound(
    tb.offenseMove.shotType,
    shooter?.rating ?? 80,
    tb.defenseMove.guardedPlayer,
    tb.offenseMove.playerName,
    tb.defenseMove.defenseType,
  );

  const roundWinner = result.result === "made" ? offSeat : defSeat;
  const newScores = {
    ...tb.scores,
    [String(roundWinner)]: (tb.scores[String(roundWinner)] ?? 0) + 1,
  };

  const historyEntry = {
    round: tb.round,
    offense: offSeat,
    offensePlayer: tb.offenseMove.playerName,
    shotType: tb.offenseMove.shotType,
    guardedPlayer: tb.defenseMove.guardedPlayer,
    defenseType: tb.defenseMove.defenseType,
    outcome: result.outcome,
    result: result.result,
    roundWinner,
  };

  const FIRST_TO = 5;
  let winner: Seat | null = null;
  let phase: GameRoom["phase"] = "tiebreaker";
  if ((newScores[String(roundWinner)] ?? 0) >= FIRST_TO) {
    winner = roundWinner;
    phase = "result";
  }

  const newBallHolder = {
    ...tb.ballHolder,
    [String(offSeat)]: tb.offenseMove.playerName,
  };

  const newTb: TiebreakerState = {
    ...tb,
    offenseMove: null,
    defenseMove: null,
    scores: newScores,
    round: tb.round + 1,
    offense: defSeat,
    ballHolder: newBallHolder,
    history: [...tb.history, historyEntry],
  };

  commit({ ...room, tiebreaker: newTb, phase, winner });
  return true;
}



export { ALL_SEATS };
