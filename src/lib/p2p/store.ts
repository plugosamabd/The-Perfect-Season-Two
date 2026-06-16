import { create } from "zustand";
import type { Seat, SpinResult, DraftedPlayer } from "@/lib/game";
import type { Player } from "@/data/roster";

export interface RoomPlayer {
  id: string;
  name: string;
  seat: Seat;
}

export interface TiebreakerState {
  players: Seat[];
  avatars: Record<string, Player | null>;
  moves: Record<string, string | null>;
  scores: Record<string, number>;
  round: number;
  offense: Seat;
  history: Array<{ round: number; offense: Seat; moves: Record<string, string>; roundWinner: Seat }>;
}

export type GameMode = "classic" | "tvt";

export interface TvtMatchup {
  seatA: Seat;
  seatB: Seat;
  winner: Seat;
}

export interface GameRoom {
  code: string;
  hostId: string;
  phase: "lobby" | "draft" | "sim" | "tiebreaker_pick" | "tiebreaker" | "result";
  gameMode: GameMode;
  maxPlayers: number;
  players: RoomPlayer[];
  currentTurn: Seat;
  spinResult: SpinResult | null;
  teams: Record<number, DraftedPlayer[]>;
  records: Record<number, { wins: number; losses: number } | null>;
  tiebreaker: TiebreakerState | null;
  tiebreakerPlayers: Seat[] | null;
  tvtMatchups: TvtMatchup[] | null;
  winner: Seat | null;
  turnStartedAt: string;
  updatedAt: string;
  respinsTotal: number;
  respinsUsed: Record<number, number>;
  respinUsedThisTurn: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerSeat: Seat | null;
  message: string;
  timestamp: number;
}

interface P2PStore {
  room: GameRoom | null;
  setRoom: (room: GameRoom | null) => void;
  updateRoom: (update: Partial<GameRoom>) => void;

  messages: ChatMessage[];
  addMessage: (m: ChatMessage) => void;
  clearMessages: () => void;

  connected: boolean;
  setConnected: (c: boolean) => void;
}

export const useP2PStore = create<P2PStore>((set) => ({
  room: null,
  setRoom: (room) => set({ room }),
  updateRoom: (update) =>
    set((s) => ({ room: s.room ? { ...s.room, ...update, updatedAt: new Date().toISOString() } : null })),

  messages: [],
  addMessage: (m) => set((s) => (s.messages.some(x => x.id === m.id) ? {} : { messages: [...s.messages, m] })),
  clearMessages: () => set({ messages: [] }),

  connected: false,
  setConnected: (connected) => set({ connected }),
}));
