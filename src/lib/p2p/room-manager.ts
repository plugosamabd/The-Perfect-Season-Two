import type { GameRoom, GameMode } from "./store";
import { useP2PStore } from "./store";
import { peerManager } from "./peer-manager";
import { gameSync } from "./game-sync";
import { ALL_SEATS, type Seat, genRoomCode } from "@/lib/game";

const SNAP_PREFIX = "lovable-room-snap-";
const SNAP_TTL_MS = 3 * 60 * 1000;

export function saveRoomSnapshot(room: GameRoom) {
  if (typeof localStorage === "undefined") return;
  try {
    if (room.phase === "result") {
      localStorage.removeItem(SNAP_PREFIX + room.code);
    } else {
      localStorage.setItem(SNAP_PREFIX + room.code, JSON.stringify({ room, ts: Date.now() }));
    }
  } catch { /* */ }
}

export function loadRoomSnapshot(code: string): GameRoom | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SNAP_PREFIX + code);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { room: GameRoom; ts: number };
    if (Date.now() - parsed.ts > SNAP_TTL_MS) {
      localStorage.removeItem(SNAP_PREFIX + code);
      return null;
    }
    return parsed.room ?? null;
  } catch { return null; }
}

export function findResumableSnapshot(hostId: string): GameRoom | null {
  if (typeof localStorage === "undefined") return null;
  let best: { room: GameRoom; ts: number } | null = null;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(SNAP_PREFIX)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(k) ?? "");
      if (!parsed?.room || parsed.room.hostId !== hostId) continue;
      if (parsed.room.phase === "result" || parsed.room.phase === "lobby") continue;
      if (Date.now() - parsed.ts > SNAP_TTL_MS) {
        localStorage.removeItem(k);
        continue;
      }
      if (!best || parsed.ts > best.ts) best = parsed;
    } catch { /* */ }
  }
  return best?.room ?? null;
}

function emptyRoom(code: string, hostId: string, hostName: string, maxPlayers: number, respinsTotal = 0, gameMode: GameMode = "classic"): GameRoom {
  const teams: Record<number, never[]> = {};
  const records: Record<number, null> = {};
  const respinsUsed: Record<number, number> = {};
  for (const s of ALL_SEATS) { teams[s] = []; records[s] = null; respinsUsed[s] = 0; }
  return {
    code,
    hostId,
    phase: "lobby",
    gameMode,
    maxPlayers,
    players: [{ id: hostId, name: hostName, seat: 1 }],
    currentTurn: 1,
    spinResult: null,
    teams,
    records,
    tiebreaker: null,
    tiebreakerPlayers: null,
    tvtMatchups: null,
    winner: null,
    turnStartedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    respinsTotal,
    respinsUsed,
    respinUsedThisTurn: false,
  };
}

export const roomManager = {
  async hostNewRoom(hostId: string, hostName: string, maxPlayers: number, respinsTotal = 0, gameMode: GameMode = "classic"): Promise<GameRoom> {
    const code = genRoomCode();
    await peerManager.initHost(code);
    gameSync.init();
    const room = emptyRoom(code, hostId, hostName, maxPlayers, respinsTotal, gameMode);
    useP2PStore.setState({ room, messages: [] });
    saveRoomSnapshot(room);
    return room;
  },

  async joinExistingRoom(code: string, playerId: string, playerName: string): Promise<void> {
    await peerManager.initJoiner();
    gameSync.init();
    await peerManager.connectToHost(code);

    // Brief pause so the DataChannel fully stabilizes before sending anything.
    await new Promise((r) => setTimeout(r, 300));
    gameSync.requestSync();

    let room: GameRoom | null = null;
    // Poll for up to 20 seconds (40 × 500ms). On relay (TURN) connections or
    // slow networks the host's sync-room message can take several seconds.
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500));
      room = useP2PStore.getState().room;
      if (room) break;
      // Re-request sync every 2.5 seconds in case a message was dropped.
      if (i > 0 && i % 5 === 0) gameSync.requestSync();
    }

    if (!room) throw new Error("Host did not respond — room may not exist");

    const alreadyInRoom = room.players.some((p) => p.id === playerId);

    if (alreadyInRoom) {
      // Player refreshed mid-game — just restore local state from what the host sent.
      // No need to broadcast; the host already has them in the roster.
      useP2PStore.setState({ room });
      return;
    }

    // Brand-new joiner: block entry if game is already in progress.
    if (room.phase !== "lobby") {
      throw new Error("Game already started — you can't join a game in progress");
    }

    const used = new Set(room.players.map((p) => p.seat));
    let seat: Seat | null = null;
    for (const s of ALL_SEATS) {
      if (!used.has(s) && s <= room.maxPlayers) { seat = s; break; }
    }
    if (!seat) throw new Error("Room is full");
    const updated: GameRoom = {
      ...room,
      players: [...room.players, { id: playerId, name: playerName, seat }],
      updatedAt: new Date().toISOString(),
    };
    gameSync.syncRoom(updated);
  },

  async hostSoloRoom(hostId: string, hostName: string, bots: number, respinsTotal = 0, gameMode: GameMode = "classic"): Promise<GameRoom> {
    const code = genRoomCode();
    await peerManager.initHost(code).catch(() => { /* peer optional for solo */ });
    gameSync.init();
    const maxPlayers = bots + 1;
    const room = emptyRoom(code, hostId, hostName, maxPlayers, respinsTotal, gameMode);
    room.phase = "draft";
    const botNames = ["CPU Alpha", "CPU Bravo", "CPU Charlie"];
    for (let i = 0; i < bots; i++) {
      const seat = (i + 2) as Seat;
      room.players.push({
        id: `bot_${seat}_${Math.random().toString(36).slice(2, 8)}`,
        name: botNames[i],
        seat,
      });
    }
    useP2PStore.setState({ room, messages: [] });
    saveRoomSnapshot(room);
    return room;
  },

  async resumeRoom(code: string): Promise<GameRoom | null> {
    const snap = loadRoomSnapshot(code);
    if (!snap) return null;
    await peerManager.initHost(code).catch(() => { /* */ });
    gameSync.init();
    const resumed: GameRoom = {
      ...snap,
      turnStartedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useP2PStore.setState({ room: resumed, messages: [] });
    return resumed;
  },

  resetRoom() {
    const room = useP2PStore.getState().room;
    if (!room) return;
    const teams: Record<number, never[]> = {};
    const records: Record<number, null> = {};
    const respinsUsed: Record<number, number> = {};
    for (const s of ALL_SEATS) { teams[s] = []; records[s] = null; respinsUsed[s] = 0; }
    const updated: GameRoom = {
      ...room,
      phase: "draft",
      currentTurn: room.players[0]?.seat ?? 1,
      spinResult: null,
      teams,
      records,
      tiebreaker: null,
      tiebreakerPlayers: null,
      winner: null,
      turnStartedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      respinsUsed,
      respinUsedThisTurn: false,
    };
    gameSync.syncRoom(updated);
  },

  startGame(hostId: string) {
    const room = useP2PStore.getState().room;
    if (!room || room.hostId !== hostId || room.phase !== "lobby") return;
    if (room.players.length < 2) return;
    const updated: GameRoom = {
      ...room,
      phase: "draft",
      turnStartedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    gameSync.syncRoom(updated);
    // Re-broadcast at 1s and 3s so joiners whose connection wobbled right as
    // the draft started still receive the phase change.
    setTimeout(() => {
      const cur = useP2PStore.getState().room;
      if (cur && cur.phase === "draft") gameSync.syncRoom(cur);
    }, 1_000);
    setTimeout(() => {
      const cur = useP2PStore.getState().room;
      if (cur && cur.phase === "draft") gameSync.syncRoom(cur);
    }, 3_000);
  },

  addBot(hostId: string) {
    const room = useP2PStore.getState().room;
    if (!room || room.hostId !== hostId || room.phase !== "lobby") return;
    const used = new Set(room.players.map((p) => p.seat));
    let seat: Seat | null = null;
    for (const s of ALL_SEATS) {
      if (!used.has(s) && s <= room.maxPlayers) { seat = s; break; }
    }
    if (!seat) return;
    const updated: GameRoom = {
      ...room,
      players: [...room.players, {
        id: `bot_${seat}_${Math.random().toString(36).slice(2, 8)}`,
        name: `CPU ${seat - 1}`,
        seat,
      }],
      updatedAt: new Date().toISOString(),
    };
    gameSync.syncRoom(updated);
  },

  async leaveRoom() {
    const room = useP2PStore.getState().room;
    if (room && typeof localStorage !== "undefined") {
      try { localStorage.removeItem(SNAP_PREFIX + room.code); } catch { /* */ }
    }
    await peerManager.destroy();
    useP2PStore.setState({ room: null, messages: [], connected: false });
  },
};
