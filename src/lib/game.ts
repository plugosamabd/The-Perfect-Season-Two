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

// ── Sim engine: weighted offense / defense ──────────────────────────────────

// Players known for elite defensive impact (bonus on top of their base rating).
const DEFENSIVE_ELITE = new Set([
  "Bill Russell", "Wilt Chamberlain", "Nate Thurmond", "Willis Reed",
  "Dennis Rodman", "Scottie Pippen", "Gary Payton", "Ben Wallace",
  "Kawhi Leonard", "Draymond Green", "Tony Allen", "Jrue Holiday",
  "Patrick Ewing", "Hakeem Olajuwon", "Tim Duncan", "Kevin Garnett",
  "Marcus Camby", "Rudy Gobert", "Jaren Jackson Jr.", "Bam Adebayo",
  "OG Anunoby", "Derrick White", "Evan Turner", "Kendall Gill",
  "Sidney Moncrief", "Michael Cooper", "Bobby Jones", "Bob Cousy",
  "Walt Frazier", "Dave DeBusschere", "Gus Johnson",
]);

// Players known for elite offensive production beyond their base rating.
const OFFENSIVE_ELITE = new Set([
  "Michael Jordan", "LeBron James", "Kobe Bryant", "Stephen Curry",
  "Kevin Durant", "Shaquille O'Neal", "Magic Johnson", "Larry Bird",
  "Wilt Chamberlain", "Kareem Abdul-Jabbar", "Oscar Robertson", "Jerry West",
  "Elgin Baylor", "Rick Barry", "Julius Erving", "Moses Malone",
  "Dominique Wilkins", "Isiah Thomas", "Karl Malone", "Patrick Ewing",
  "Hakeem Olajuwon", "Charles Barkley", "Allen Iverson", "Dirk Nowitzki",
  "Tim Duncan", "Kobe Bryant", "Dwyane Wade", "Chris Paul",
  "James Harden", "Nikola Jokic", "Giannis Antetokounmpo",
  "Luka Doncic", "Anthony Davis", "Damian Lillard", "Jayson Tatum",
  "Kevin Garnett", "Tracy McGrady", "Vince Carter", "Paul Pierce",
  "Shai Gilgeous-Alexander", "Anthony Edwards", "Ja Morant",
  "Devin Booker", "Zion Williamson", "Paul George", "Kawhi Leonard",
]);

function playerOffense(p: Player): number {
  const base = p.rating * 0.6;
  const eraB = ERA_BOOST[p.era] * 8;
  const wowB = p.wow ? 4 : 0;
  const eliteB = OFFENSIVE_ELITE.has(p.name) ? 7 : 0;
  return base + eraB + wowB + eliteB;
}

function playerDefense(p: Player): number {
  const base = p.rating * 0.45;
  const eraB = ERA_BOOST[p.era] * 6;
  const wowB = p.wow ? 2 : 0;
  const eliteB = DEFENSIVE_ELITE.has(p.name) ? 10 : 0;
  return base + eraB + wowB + eliteB;
}

// How well a set of defenders contests against a set of offensive players.
// Each offensive player faces the best matchup the defense can throw at them.
// Returns a multiplier: 1.0 = defense is average, < 1 = strong D, > 1 = weak D.
function defensiveMultiplier(offense: Player[], defense: Player[]): number {
  if (defense.length === 0) return 1;
  const avgDef = defense.reduce((s, p) => s + playerDefense(p), 0) / defense.length;
  // Normalised around a league-average defense score of ~46
  const normalized = (avgDef - 46) / 12; // roughly -1 to +1
  // Defense is weighted at 55% — great defense meaningfully suppresses offense
  return Math.max(0.65, Math.min(1.20, 1 - normalized * 0.20));
}

// Head-to-head matchup between two teams. Returns "A" or "B".
export function simMatchup(teamA: Player[], teamB: Player[]): "A" | "B" {
  if (teamA.length === 0) return "B";
  if (teamB.length === 0) return "A";

  // Raw offensive power of each team
  const offA = teamA.reduce((s, p) => s + playerOffense(p), 0) / teamA.length;
  const offB = teamB.reduce((s, p) => s + playerOffense(p), 0) / teamB.length;

  // Team B's defense suppresses Team A's offense, and vice versa
  const netA = offA * defensiveMultiplier(teamA, teamB);
  const netB = offB * defensiveMultiplier(teamB, teamA);

  // Add a small random noise so upsets are possible
  const noise = (Math.random() - 0.5) * 6;
  const sA = netA + noise;
  const sB = netB;

  return Math.random() < sA / (sA + sB) ? "A" : "B";
}

export function genRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
