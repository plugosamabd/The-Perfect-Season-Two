import type { GameRoom } from "./store";
import { useP2PStore } from "./store";
import { peerManager } from "./peer-manager";
import { gameSync } from "./game-sync";
import { ALL_SEATS, type Seat, genRoomCode } from "@/lib/game";

function emptyRoom(code: string, hostId: string, hostName: string, maxPlayers: number): GameRoom {
  const teams: Record<number, never[]> = {};
  const records: Record<number, null> = {};
  for (const s of ALL_SEATS) { teams[s] = []; records[s] = null; }
  return {
    code,
    hostId,
    phase: "lobby",
    maxPlayers,
    players: [{ id: hostId, name: hostName, seat: 1 }],
    currentTurn: 1,
    spinResult: null,
    teams,
    records,
    tiebreaker: null,
    tiebreakerPlayers: null,
    winner: null,
    turnStartedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const roomManager = {
  async hostNewRoom(hostId: string, hostName: string, maxPlayers: number): Promise<GameRoom> {
    const code = genRoomCode();
    await peerManager.initHost(code);
    gameSync.init();
    const room = emptyRoom(code, hostId, hostName, maxPlayers);
    useP2PStore.setState({ room, messages: [] });
    return room;
  },

  async joinExistingRoom(code: string, playerId: string, playerName: string): Promise<void> {
    await peerManager.initJoiner();
    gameSync.init();
    await peerManager.connectToHost(code);
    // ask host for current state, then announce ourselves
    gameSync.requestSync();
    // wait briefly for sync
    await new Promise((r) => setTimeout(r, 400));
    // host adds joiner via sync; but joiner can also propose itself:
    const room = useP2PStore.getState().room;
    if (room && !room.players.some((p) => p.id === playerId)) {
      // joiner finds open seat client-side and asks host to broadcast
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
      // Host will rebroadcast on receive — but simpler: send sync back, host will accept via relay.
      gameSync.syncRoom(updated);
    }
  },

  async hostSoloRoom(hostId: string, hostName: string, bots: number): Promise<GameRoom> {
    const code = genRoomCode();
    // No peer connection needed for solo — but init host so chat/sync code paths are consistent
    await peerManager.initHost(code).catch(() => { /* peer optional for solo */ });
    gameSync.init();
    const maxPlayers = bots + 1;
    const room = emptyRoom(code, hostId, hostName, maxPlayers);
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
    return room;
  },

  resetRoom() {
    const room = useP2PStore.getState().room;
    if (!room) return;
    const teams: Record<number, never[]> = {};
    const records: Record<number, null> = {};
    for (const s of ALL_SEATS) { teams[s] = []; records[s] = null; }
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
    await peerManager.destroy();
    useP2PStore.setState({ room: null, messages: [], connected: false });
  },
};
