## What we're building

A real-time 2-player web game inspired by 82-0.com. Players join via room code, take turns spinning for an era + team and drafting players from that team's roster in that era, then watch an animated 82-game season ticker. Best record wins; an 82-0 record auto-wins; if both go 82-0, a rock-paper-scissors style 1v1 basketball mini-game decides it.

## Core flow

1. **Lobby** — Player 1 creates room (gets 4-letter code), Player 2 joins.
2. **Draft phase (alternating, 5 picks each)**:
   - On your turn, hit SPIN → wheel lands on an Era (e.g. 80s, 90s, 2000s, 2010s, 2020s) and an NBA Team.
   - You must pick one player from a curated roster of that team in that era.
   - Each player has hidden rating + 82-0 chance.
3. **Reveal & Sim** — Both teams revealed, then animated W-L ticker counts up 82 games for both teams side-by-side.
4. **Result**:
   - Higher record wins.
   - If either player hits 82-0, they auto-win (regardless of opponent).
   - If BOTH hit 82-0 → enter **1v1 Tiebreaker**.
5. **1v1 Tiebreaker** — Each player picks one of their 5 drafted players as their avatar. Best of 5 (first to 3). Each round: offense chooses Drive / Shoot / Fade, defense chooses Defend Paint / Defend Perimeter / Contest. Resolved RPS-style with reveal animation. Roles swap each round.

## Technical approach

- **Stack**: TanStack Start + Lovable Cloud (Supabase) for realtime room state via Postgres realtime subscriptions.
- **Data**: Curated JSON of ~10 teams × 5 eras × ~6 players each, baked into `src/data/roster.ts`. Each player: name, team, era, rating (60-99), winChance bonus.
- **Tables**:
  - `rooms` (code, status, current_phase, current_turn, p1_id, p2_id, p1_team jsonb, p2_team jsonb, p1_record, p2_record, spin_result jsonb, tiebreaker_state jsonb)
  - `room_moves` (room_id, player, round, choice) for RPS rounds
- **Realtime**: both clients subscribe to their room row; all state lives server-side via `createServerFn`.
- **Anonymous identity**: simple client-generated UUID stored in localStorage as "playerId" (no auth needed — keeps friction zero for a party game).

## Screens

- `/` — Landing with "Create Room" + "Join Room" + rules blurb.
- `/room/$code` — Single page that swaps between Lobby → Spin/Draft → Sim → Result → Tiebreaker views based on room.current_phase.

## Design direction

Bold sports-broadcast vibe: dark court-floor background, neon scoreboard typography, red/blue team colors for P1/P2, big animated number tickers, satisfying spin wheel, dramatic "82-0!" celebration.

## Out of scope (v1)

- Real NBA stats/photos (curated text-only roster; can add photos later)
- Accounts, persistent stats across games
- More than 2 players
- Mobile-optimized landscape

Ready to build?