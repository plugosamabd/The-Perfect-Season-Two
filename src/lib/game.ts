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
  team: string;
  teamIndex: number;
  teamRotation: number;
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

// ── Finals: player-specific shot types ──────────────────────────────────────

export const PLAYER_SHOTS: Record<string, string[]> = {
  "Michael Jordan":          ["Fadeaway", "Drive", "Pull-Up"],
  "Stephen Curry":           ["Deep Three", "Relocation Three", "Drive"],
  "Shaquille O'Neal":        ["Drop Step", "Power Drive", "Hook Shot"],
  "Kyrie Irving":            ["Jelly Layup", "Stepback", "Drive"],
  "LeBron James":            ["Drive", "Fade", "Three"],
  "Kobe Bryant":             ["Fadeaway", "Mid-Range", "Drive"],
  "Kevin Durant":            ["Fade", "Three", "Drive"],
  "Dirk Nowitzki":           ["Fadeaway", "Three", "Pull-Up"],
  "Hakeem Olajuwon":         ["Drop Step", "Fade", "Hook Shot"],
  "Tim Duncan":              ["Post Move", "Mid-Range", "Hook Shot"],
  "Allen Iverson":           ["Drive", "Pull-Up", "Stepback"],
  "James Harden":            ["Stepback Three", "Drive", "Pull-Up"],
  "Nikola Jokic":            ["Post Move", "Drive", "Fade"],
  "Giannis Antetokounmpo":   ["Drive", "Power Drive", "Mid-Range"],
  "Luka Doncic":             ["Stepback Three", "Drive", "Fade"],
  "Ja Morant":               ["Drive", "Jelly Layup", "Pull-Up"],
  "Anthony Edwards":         ["Drive", "Three", "Pull-Up"],
  "Damian Lillard":          ["Deep Three", "Pull-Up", "Drive"],
  "Shai Gilgeous-Alexander": ["Drive", "Mid-Range", "Stepback"],
  "Kareem Abdul-Jabbar":     ["Skyhook", "Hook Shot", "Post Move"],
  "Wilt Chamberlain":        ["Drop Step", "Power Drive", "Fade"],
  "Bill Russell":            ["Drop Step", "Post Move", "Hook Shot"],
  "Magic Johnson":           ["Drive", "Pull-Up", "Post Move"],
  "Larry Bird":              ["Three", "Mid-Range", "Fade"],
  "Julius Erving":           ["Drive", "Fade", "Jelly Layup"],
  "Oscar Robertson":         ["Pull-Up", "Mid-Range", "Drive"],
  "Charles Barkley":         ["Post Move", "Drive", "Mid-Range"],
  "Patrick Ewing":           ["Post Move", "Mid-Range", "Drop Step"],
  "Karl Malone":             ["Post Move", "Mid-Range", "Drive"],
  "Jerry West":              ["Pull-Up", "Mid-Range", "Drive"],
  "Dwyane Wade":             ["Drive", "Jelly Layup", "Mid-Range"],
  "Chris Paul":              ["Pull-Up", "Mid-Range", "Drive"],
  "Tracy McGrady":           ["Mid-Range", "Drive", "Three"],
  "Vince Carter":            ["Dunk", "Three", "Drive"],
  "Paul Pierce":             ["Mid-Range", "Fade", "Three"],
  "Kawhi Leonard":           ["Mid-Range", "Drive", "Three"],
  "Russell Westbrook":       ["Drive", "Pull-Up", "Dunk"],
  "Kevin Garnett":           ["Mid-Range", "Post Move", "Fade"],
  "Elgin Baylor":            ["Drive", "Mid-Range", "Fade"],
  "Rick Barry":              ["Mid-Range", "Three", "Drive"],
  "Walt Frazier":            ["Pull-Up", "Drive", "Mid-Range"],
  "Pete Maravich":           ["Pull-Up", "Mid-Range", "Drive"],
  "Isiah Thomas":            ["Drive", "Pull-Up", "Mid-Range"],
  "Clyde Drexler":           ["Drive", "Dunk", "Mid-Range"],
  "Zion Williamson":         ["Power Drive", "Dunk", "Mid-Range"],
  "Devin Booker":            ["Mid-Range", "Three", "Drive"],
  "Jayson Tatum":            ["Fade", "Three", "Drive"],
};

export const POSITION_SHOTS: Record<string, string[]> = {
  "PG": ["Drive", "Pull-Up", "Three"],
  "SG": ["Three", "Mid-Range", "Drive"],
  "SF": ["Fade", "Drive", "Mid-Range"],
  "PF": ["Post Move", "Mid-Range", "Drive"],
  "C":  ["Drop Step", "Hook Shot", "Post Move"],
};

export const SHOT_ZONES: Record<string, "three" | "mid" | "drive" | "post"> = {
  "Deep Three":        "three",
  "Relocation Three":  "three",
  "Three":             "three",
  "Stepback Three":    "three",
  "Mid-Range":         "mid",
  "Pull-Up":           "mid",
  "Fadeaway":          "mid",
  "Fade":              "mid",
  "Stepback":          "mid",
  "Skyhook":           "mid",
  "Drive":             "drive",
  "Jelly Layup":       "drive",
  "Power Drive":       "drive",
  "Dunk":              "drive",
  "Drop Step":         "post",
  "Hook Shot":         "post",
  "Post Move":         "post",
};

export const DEFENSE_TYPES = ["Defend Drive", "Defend Mid", "Defend Three", "Defend Post"] as const;
export type DefenseType = (typeof DEFENSE_TYPES)[number];

export const DEFENSE_ZONES: Record<string, "three" | "mid" | "drive" | "post"> = {
  "Defend Drive": "drive",
  "Defend Mid":   "mid",
  "Defend Three": "three",
  "Defend Post":  "post",
};

export function getShotsForPlayer(playerName: string, position: string): string[] {
  return PLAYER_SHOTS[playerName] ?? POSITION_SHOTS[position] ?? ["Drive", "Mid-Range", "Three"];
}

export interface FinalsRoundResult {
  result: "made" | "missed";
  outcome: "open" | "contested" | "blocked";
  makeChance: number;
}

export function resolveFinalsRound(
  shotType: string,
  playerRating: number,
  guardedPlayer: string,
  shootingPlayer: string,
  defenseType: string,
): FinalsRoundResult {
  const shotZone  = SHOT_ZONES[shotType]   ?? "mid";
  const defZone   = DEFENSE_ZONES[defenseType] ?? "mid";
  const rightPlayer = guardedPlayer === shootingPlayer;
  const exactRead   = rightPlayer && shotZone === defZone;
  const nearRead    = rightPlayer && !exactRead;
  const zoneOnly    = !rightPlayer && shotZone === defZone;

  const baseMake: Record<string, number> = {
    three: 0.35,
    mid:   0.45,
    drive: 0.55,
    post:  0.50,
  };

  const ratingBonus = (playerRating - 87.5) / 150;
  let makeChance = (baseMake[shotZone] ?? 0.45) + ratingBonus;
  let outcome: "open" | "contested" | "blocked";

  if (exactRead) {
    makeChance = 0.08;
    outcome = "blocked";
  } else if (nearRead) {
    makeChance = Math.max(0.20, makeChance - 0.20);
    outcome = "contested";
  } else if (zoneOnly) {
    makeChance = Math.max(0.30, makeChance - 0.10);
    outcome = "contested";
  } else {
    outcome = "open";
  }

  makeChance = Math.min(0.85, Math.max(0.05, makeChance));
  const made = Math.random() < makeChance;
  return { result: made ? "made" : "missed", outcome, makeChance };
}

// ── Sim engine ───────────────────────────────────────────────────────────────

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

function defensiveMultiplier(offense: Player[], defense: Player[]): number {
  if (defense.length === 0) return 1;
  const avgDef = defense.reduce((s, p) => s + playerDefense(p), 0) / defense.length;
  const normalized = (avgDef - 46) / 12;
  return Math.max(0.65, Math.min(1.20, 1 - normalized * 0.20));
}

export function simMatchup(teamA: Player[], teamB: Player[]): "A" | "B" {
  if (teamA.length === 0) return "B";
  if (teamB.length === 0) return "A";
  const offA = teamA.reduce((s, p) => s + playerOffense(p), 0) / teamA.length;
  const offB = teamB.reduce((s, p) => s + playerOffense(p), 0) / teamB.length;
  const netA = offA * defensiveMultiplier(teamA, teamB);
  const netB = offB * defensiveMultiplier(teamB, teamA);
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
