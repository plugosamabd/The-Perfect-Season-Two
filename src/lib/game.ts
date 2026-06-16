import { ERA_BOOST, type Era, type Player } from "@/data/roster";

export interface Record82 { wins: number; losses: number; }
export type Seat = 1 | 2 | 3 | 4;
export const ALL_SEATS: Seat[] = [1, 2, 3, 4];
export const PICKS_PER_PLAYER = 5;
export const TURN_SECONDS = 60;

export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];
export type DraftedPlayer = Player & { slot: Position };

export interface SpinResult {
  ts: number;
  // Team phase
  team: string;
  teamIndex: number;
  teamRotation: number;
  // Era phase — null until era wheel has been spun
  era: Era | null;
  eraIndex: number | null;
  eraRotation: number | null;
}

export function simSeason(team: Player[]): Record82 {
  if (team.length === 0) return { wins: 0, losses: 82 };
  const avg = team.reduce((s, p) => s + p.rating, 0) / team.length;
  const wowCount = team.filter(p => p.wow).length;
  const eraBoost = team.reduce((s, p) => s + ERA_BOOST[p.era], 0) / team.length;
  const base = Math.max(0.05, Math.min(0.95, (avg - 70) / 30));
  const wowBoost = wowCount * 0.015;
  const prob = Math.min(0.97, base + wowBoost + eraBoost);
  if (avg >= 95 && wowCount >= 4 && Math.random() < 0.18) {
    return { wins: 82, losses: 0 };
  }
  let wins = 0;
  for (let i = 0; i < 82; i++) {
    if (Math.random() < prob + (Math.random() - 0.5) * 0.1) wins++;
  }
  return { wins, losses: 82 - wins };
}

export type OffenseMove = "drive" | "shoot" | "fade";
export type DefenseMove = "paint" | "perimeter";

export function resolveRound(off: OffenseMove, def: DefenseMove): "offense" | "defense" {
  if (off === "drive") return def === "paint" ? "defense" : "offense";
  if (off === "shoot") return def === "perimeter" ? "defense" : "offense";
  if (def === "paint") return "offense";
  return Math.random() < 0.5 ? "offense" : "defense";
}

// Head-to-head matchup between two teams. Returns "A" or "B".
export function simMatchup(teamA: Player[], teamB: Player[]): "A" | "B" {
  function strength(team: Player[]): number {
    if (team.length === 0) return 70;
    const avg = team.reduce((s, p) => s + p.rating, 0) / team.length;
    const wow = team.filter((p) => p.wow).length * 0.5;
    const era = team.reduce((s, p) => s + ERA_BOOST[p.era], 0) / team.length * 10;
    return avg + wow + era;
  }
  const sA = strength(teamA);
  const sB = strength(teamB);
  return Math.random() < sA / (sA + sB) ? "A" : "B";
}

export function genRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
