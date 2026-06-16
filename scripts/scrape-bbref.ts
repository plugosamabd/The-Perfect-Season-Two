/**
 * Basketball-Reference scraper via Firecrawl.
 * Resumable: writes one JSON per (season, team) and skips existing files.
 *
 * Usage:
 *   bun scripts/scrape-bbref.ts --start 1985 --end 1985
 *   bun scripts/scrape-bbref.ts --start 1960 --end 2025
 *   bun scripts/scrape-bbref.ts --season 1996         # single season
 *   bun scripts/scrape-bbref.ts --season 2024 --team BOS  # single team
 *
 * Output:
 *   src/data/bbref/{year}/_index.json    → list of teams that season
 *   src/data/bbref/{year}/{TEAM}.json    → roster + per-game stats
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
if (!FIRECRAWL_API_KEY) {
  console.error("Missing FIRECRAWL_API_KEY");
  process.exit(1);
}

const OUT_ROOT = "src/data/bbref";
const FC_URL = "https://api.firecrawl.dev/v2/scrape";

// ---------- args ----------
const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1] ?? ""]);
    return acc;
  }, []),
);
const SEASON = args.season ? Number(args.season) : undefined;
const START = SEASON ?? (args.start ? Number(args.start) : 1985);
const END = SEASON ?? (args.end ? Number(args.end) : START);
const ONLY_TEAM = args.team?.toUpperCase();

// ---------- helpers ----------
async function exists(p: string) {
  try { await access(p); return true; } catch { return false; }
}

async function writeJson(p: string, data: unknown) {
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(data, null, 2));
}

async function firecrawlExtract<T>(url: string, schema: object, prompt: string): Promise<T> {
  const res = await fetch(FC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url,
      onlyMainContent: true,
      formats: [{ type: "json", schema, prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${await res.text()}`);
  const body = await res.json() as { success?: boolean; data?: { json?: T }; json?: T; error?: string };
  const json = body.data?.json ?? body.json;
  if (!json) throw new Error(`No JSON in response: ${JSON.stringify(body).slice(0, 300)}`);
  return json;
}

// ---------- schemas ----------
const seasonSchema = {
  type: "object",
  properties: {
    teams: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          abbrev: { type: "string", description: "3-letter team code from team URL, e.g. BOS, LAL, GSW" },
          wins: { type: "number" },
          losses: { type: "number" },
          conference: { type: "string" },
        },
        required: ["name", "abbrev"],
      },
    },
  },
  required: ["teams"],
} as const;

const teamSchema = {
  type: "object",
  properties: {
    team_name: { type: "string" },
    season: { type: "string" },
    roster: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          position: { type: "string", description: "One of PG,SG,SF,PF,C (or combos like G,F,C)" },
          height: { type: "string" },
          weight: { type: "string" },
          birthdate: { type: "string" },
          college: { type: "string" },
          experience: { type: "string" },
        },
        required: ["name"],
      },
    },
    per_game: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          games: { type: "number" },
          mpg: { type: "number" },
          ppg: { type: "number" },
          rpg: { type: "number" },
          apg: { type: "number" },
          spg: { type: "number" },
          bpg: { type: "number" },
          fg_pct: { type: "number" },
          fg3_pct: { type: "number" },
          ft_pct: { type: "number" },
        },
        required: ["name"],
      },
    },
  },
  required: ["roster"],
} as const;

// ---------- scrape ----------
async function scrapeSeasonIndex(year: number) {
  const p = join(OUT_ROOT, String(year), "_index.json");
  if (await exists(p)) {
    const data = JSON.parse(await Bun.file(p).text());
    return data as { teams: Array<{ name: string; abbrev: string }> };
  }
  const url = `https://www.basketball-reference.com/leagues/NBA_${year}.html`;
  console.log(`  [index] ${url}`);
  const data = await firecrawlExtract<{ teams: Array<{ name: string; abbrev: string }> }>(
    url,
    seasonSchema,
    "Extract every team from the standings tables. abbrev MUST be the 3-letter code from the team's URL slug (e.g. /teams/BOS/, /teams/LAL/). Include both conferences.",
  );
  await writeJson(p, data);
  return data;
}

async function scrapeTeam(year: number, abbrev: string) {
  const p = join(OUT_ROOT, String(year), `${abbrev}.json`);
  if (await exists(p)) {
    console.log(`  [skip] ${year}/${abbrev}`);
    return;
  }
  const url = `https://www.basketball-reference.com/teams/${abbrev}/${year}.html`;
  console.log(`  [team] ${url}`);
  try {
    const data = await firecrawlExtract(url, teamSchema, "Extract the full roster table and the per-game stats table.");
    await writeJson(p, { season: year, abbrev, url, ...(data as object) });
  } catch (e) {
    console.error(`  [fail] ${year}/${abbrev}:`, (e as Error).message);
  }
}

// ---------- main ----------
console.log(`Scraping seasons ${START}..${END}${ONLY_TEAM ? ` (team=${ONLY_TEAM})` : ""}`);
for (let year = START; year <= END; year++) {
  console.log(`\n=== Season ${year} ===`);
  const idx = await scrapeSeasonIndex(year);
  const teams = ONLY_TEAM
    ? idx.teams.filter((t) => t.abbrev.toUpperCase() === ONLY_TEAM)
    : idx.teams;
  for (const t of teams) {
    await scrapeTeam(year, t.abbrev.toUpperCase());
  }
}
console.log("\nDone.");
