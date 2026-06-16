import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPlayerId, getPlayerName } from "@/lib/identity";
import { ERA_BOOST, erasForTeam, getPlayersFor, teamColor, TEAMS_WITH_ROSTER, type Era, type Player, type Position } from "@/data/roster";
import { POSITIONS, TURN_SECONDS, type DraftedPlayer, type Seat } from "@/lib/game";
import { useP2PStore, roomManager, type GameRoom, type TvtMatchup } from "@/lib/p2p";
import { loadRoomSnapshot } from "@/lib/p2p/room-manager";
import { spin, spinEra, pickPlayer, runSim, pickAvatar, submitMove, autoPlay, respin } from "@/lib/game.actions";
import { ChatBox } from "@/components/ChatBox";
import { SpinWheel, teamSlices, eraSlices } from "@/components/SpinWheel";
import { PlayerPicker } from "@/components/PlayerPicker";
import { Logo } from "@/components/Logo";
import { ShareResult } from "@/components/ShareResult";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — 82-0` },
      { name: "description", content: "Peer-to-peer 82-0 room." },
    ],
  }),
  component: RoomPage,
});

type SeatN = Seat;
const ALL_SEATS: SeatN[] = [1, 2, 3, 4];

const SEAT_RING: Record<number, string> = {
  1: "ring-team-one",
  2: "ring-team-two",
  3: "ring-accent-1",
  4: "ring-accent-2",
};
const SEAT_TEXT: Record<number, string> = {
  1: "text-team-one",
  2: "text-team-two",
  3: "text-accent-1",
  4: "text-accent-2",
};
const SEAT_DOT: Record<number, string> = {
  1: "bg-team-one",
  2: "bg-team-two",
  3: "bg-accent-1",
  4: "bg-accent-2",
};

function seatPlayer(room: GameRoom, seat: SeatN) {
  return room.players.find((p) => p.seat === seat) ?? null;
}
function seatName(room: GameRoom, seat: SeatN) { return seatPlayer(room, seat)?.name ?? null; }
function seatId(room: GameRoom, seat: SeatN) { return seatPlayer(room, seat)?.id ?? null; }
function seatTeam(room: GameRoom, seat: SeatN): DraftedPlayer[] { return room.teams[seat] ?? []; }
function seatRecord(room: GameRoom, seat: SeatN) { return room.records[seat] ?? null; }
function activeSeats(room: GameRoom): SeatN[] {
  return room.players.map((p) => p.seat).sort((a, b) => a - b);
}
function isBot(room: GameRoom, seat: SeatN): boolean {
  const id = seatId(room, seat);
  return !!id && id.startsWith("bot_");
}

function RoomPage() {
  const { code } = Route.useParams();
  const room = useP2PStore((s) => s.room);
  const connected = useP2PStore((s) => s.connected);
  const [pid, setPid] = useState("");
  const [myName, setMyName] = useState("");
  const [resumeTried, setResumeTried] = useState(false);

  useEffect(() => { setPid(getPlayerId()); setMyName(getPlayerName()); }, []);

  // Host-only resume: if landing here cold (refresh/relaunch), try to hydrate
  // from the local snapshot when we were the host.
  useEffect(() => {
    if (resumeTried || !pid) return;
    if (room && room.code === code) return;
    const snap = loadRoomSnapshot(code);
    if (snap && snap.hostId === pid) {
      setResumeTried(true);
      roomManager.resumeRoom(code).catch(() => { /* */ });
    } else {
      setResumeTried(true);
    }
  }, [pid, code, room, resumeTried]);

  const realSeat = useMemo<SeatN | 0>(() => {
    if (!room) return 0;
    for (const s of ALL_SEATS) if (seatId(room, s) === pid) return s;
    return 0;
  }, [room, pid]);

  // While we're still trying to resume/hydrate, show a neutral loading state
  // instead of the 404 screen so the game doesn't get destroyed mid-reconnect.
  if (!room || room.code !== code) {
    if (!resumeTried) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-sm text-center">
            <div className="text-sm text-muted-foreground animate-pulse">Reconnecting…</div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <div className="font-display text-5xl text-foreground">404</div>
          <h1 className="mt-3 font-display text-2xl">Room not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            P2P rooms live only in the host's browser. Ask the host for a fresh code.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }

  const myRespinsLeft = realSeat > 0
    ? Math.max(0, (room.respinsTotal ?? 0) - (room.respinsUsed?.[realSeat] ?? 0))
    : 0;
  const canRespinNow =
    realSeat > 0 &&
    room.phase === "draft" &&
    room.currentTurn === realSeat &&
    !!room.spinResult?.era &&
    !room.respinUsedThisTurn &&
    myRespinsLeft > 0;

  return (
    <div className="min-h-screen p-3 sm:p-6">
      <header className="max-w-6xl mx-auto mb-6 flex items-center justify-between gap-3">
        <Link to="/" aria-label="82-0 home" className="inline-flex items-center">
          <Logo className="h-9 w-auto" />
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {(() => {
              const isMultiplayer = room.players.length > 1;
              const isSolo = !isMultiplayer;
              const inGame = room.phase !== "lobby";
              const isGreen = isSolo || connected || inGame;
              return (
                <>
                  <span className={`w-1.5 h-1.5 rounded-full ${isGreen ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
                  {isSolo ? "Solo" : connected ? "Connected" : inGame ? "Connected" : "Connecting…"}
                </>
              );
            })()}
          </div>
          {(room.respinsTotal ?? 0) > 0 && realSeat > 0 && (
            <RespinControl canRespin={canRespinNow} respinsLeft={myRespinsLeft} />
          )}
          <MuteToggle />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Room</div>
            <div className="font-mono text-lg tracking-[0.3em] text-foreground">{room.code}</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto pb-40 sm:pb-32">
        {room.phase === "lobby" && <Lobby room={room} me={realSeat} />}
        {room.phase === "draft" && <Draft room={room} me={realSeat} />}
        {room.phase === "sim" && <Sim room={room} me={realSeat} />}
        {room.phase === "result" && <ResultReveal room={room} me={realSeat} />}
        {room.phase === "tiebreaker_pick" && <TiebreakerPick room={room} me={realSeat} />}
        {room.phase === "tiebreaker" && <Tiebreaker room={room} me={realSeat} />}
        {realSeat === 0 && (
          <div className="text-center text-xs text-muted-foreground mt-4">Spectating</div>
        )}
      </main>

      <ChatBox myId={pid} myName={myName} mySeat={realSeat} />
    </div>
  );
}

function MuteToggle() {
  const [muted, setMuted] = useState(false);
  useEffect(() => { setMuted(sfx.isMuted()); }, []);
  return (
    <button
      onClick={() => { const v = !muted; sfx.setMuted(v); setMuted(v); if (!v) sfx.click(); }}
      aria-label={muted ? "Unmute" : "Mute"}
      title={muted ? "Unmute" : "Mute"}
      className="text-xs text-muted-foreground hover:text-foreground transition w-7 h-7 flex items-center justify-center rounded-md border border-border"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}

function RespinControl({ canRespin, respinsLeft }: { canRespin: boolean; respinsLeft: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={!canRespin}
        onClick={() => setOpen((v) => !v)}
        title={canRespin ? "Use a respin" : respinsLeft === 0 ? "No respins left" : "Respin only on your turn after a spin"}
        className="px-2.5 h-7 inline-flex items-center gap-1.5 rounded-md border border-border text-[11px] uppercase tracking-[0.16em] text-foreground/80 hover:text-foreground hover:border-foreground/30 transition disabled:opacity-40 disabled:hover:text-foreground/80 disabled:hover:border-border"
      >
        <span>↻ Respin</span>
        <span className="font-mono text-[10px] text-muted-foreground">{respinsLeft}</span>
      </button>
      {open && canRespin && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-44 bg-card border border-border rounded-lg shadow-lg z-40 overflow-hidden">
            <button
              type="button"
              onClick={() => { setOpen(false); respin(getPlayerId(), "team"); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-foreground/5 transition"
            >
              <div className="font-medium">Respin team</div>
              <div className="text-[10px] text-muted-foreground">Keep era · new team</div>
            </button>
            <div className="h-px bg-border" />
            <button
              type="button"
              onClick={() => { setOpen(false); respin(getPlayerId(), "era"); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-foreground/5 transition"
            >
              <div className="font-medium">Respin era</div>
              <div className="text-[10px] text-muted-foreground">Keep team · new era</div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}



/* ---------------- LOBBY ---------------- */

function Lobby({ room, me }: { room: GameRoom; me: SeatN | 0 }) {
  const isHost = me === 1;
  const count = activeSeats(room).length;
  const slots = Array.from({ length: room.maxPlayers }, (_, i) => (i + 1) as SeatN);
  const emptyCount = room.maxPlayers - count;
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${room.code}` : "";

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ }
  }

  return (
    <div className="max-w-2xl mx-auto text-center py-8 sm:py-12">
      <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Lobby</div>
      <h2 className="font-display text-3xl sm:text-4xl mt-2 mb-1">Waiting for players</h2>
      <p className="text-sm text-muted-foreground mb-8">{count}/{room.maxPlayers} joined</p>

      <div className="inline-flex flex-col items-center gap-3 bg-card border border-border rounded-2xl px-8 sm:px-12 py-6 mb-4">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Room code</div>
        <div className="font-mono text-5xl sm:text-6xl tracking-[0.32em] text-foreground">{room.code}</div>
        <button
          onClick={() => copy(shareUrl)}
          className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition"
        >
          {copied ? "Copied ✓" : "Copy invite link"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-8 mt-4">
        {slots.map((s) => (
          <PlayerCard key={s} seat={s} name={seatName(room, s)} ready={!!seatId(room, s)} />
        ))}
      </div>

      {isHost ? (
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {emptyCount > 0 && (
            <button
              onClick={() => roomManager.addBot(getPlayerId())}
              className="px-5 py-2.5 rounded-md border border-border text-sm text-foreground/80 hover:text-foreground hover:border-foreground/30 transition"
            >
              + Add CPU
            </button>
          )}
          {count >= 2 && (
            <button
              onClick={() => roomManager.startGame(getPlayerId())}
              className="px-6 py-2.5 rounded-md bg-foreground text-background text-sm font-medium tracking-wide uppercase hover:opacity-90"
            >
              Start draft
            </button>
          )}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Waiting for the host to start…</div>
      )}
    </div>
  );
}

function PlayerCard({ seat, name, ready }: { seat: SeatN; name: string | null; ready: boolean }) {
  return (
    <div className={`px-3.5 py-3 rounded-lg border bg-card text-left ${ready ? "border-border" : "border-dashed border-border opacity-50"}`}>
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${SEAT_DOT[seat]}`} />
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">P{seat}</div>
      </div>
      <div className="font-medium text-sm mt-1 truncate">{name ?? "Waiting…"}</div>
    </div>
  );
}

/* ---------------- DRAFT ---------------- */

function Draft({ room, me }: { room: GameRoom; me: SeatN | 0 }) {
  const [spinning, setSpinning] = useState(false);
  const seats = activeSeats(room);
  const totalPicks = seats.reduce((s, sn) => s + seatTeam(room, sn).length, 0);
  const round = Math.floor(totalPicks / seats.length) + 1;
  const myTurn = room.currentTurn === me;
  const turnSeat = room.currentTurn;
  const turnName = seatName(room, turnSeat);
  const turnIsBot = isBot(room, turnSeat);

  const lastTsRef = useRef<number>(0);
  useEffect(() => {
    const ts = room.spinResult?.ts ?? 0;
    if (ts && ts !== lastTsRef.current) {
      lastTsRef.current = ts;
      setSpinning(true);
      sfx.spin();
      const t = setTimeout(() => { setSpinning(false); sfx.land(); }, 3600);
      return () => clearTimeout(t);
    }
    if (!room.spinResult) { lastTsRef.current = 0; setSpinning(false); }
  }, [room.spinResult?.ts]);

  const lastPicksRef = useRef<number>(totalPicks);
  useEffect(() => {
    if (totalPicks > lastPicksRef.current) sfx.click();
    lastPicksRef.current = totalPicks;
  }, [totalPicks]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const turnStartMs = new Date(room.turnStartedAt).getTime();
  const elapsed = Math.max(0, Math.floor((now - turnStartMs) / 1000));
  const remaining = Math.max(0, TURN_SECONDS - elapsed);

  const lastActedKey = useRef<string>("");
  const iAmHost = me === 1;

  // Bot autoPlay — no `spinning` dep (spin animations play in background);
  // lastActedKey prevents double-firing; fires in ~1-4 seconds total per pick.
  useEffect(() => {
    if (room.phase !== "draft" || !iAmHost || !turnIsBot) return;
    const key = `${room.currentTurn}-${totalPicks}-${room.spinResult?.ts ?? 0}`;
    if (lastActedKey.current === key) return;
    const step: "spin" | "pick" = (!room.spinResult || room.spinResult.era == null) ? "spin" : "pick";
    const delay = step === "spin" ? 300 + Math.random() * 400 : 1000 + Math.random() * 1500;
    const t = setTimeout(() => {
      lastActedKey.current = key;
      autoPlay(step);
    }, delay);
    return () => clearTimeout(t);
  }, [turnIsBot, room.phase, room.currentTurn, room.spinResult?.ts, totalPicks, iAmHost]);

  // Human timeout — re-checks on every `remaining` tick so 0-second turns fire immediately.
  useEffect(() => {
    if (spinning || room.phase !== "draft" || !iAmHost || turnIsBot) return;
    const key = `${room.currentTurn}-${totalPicks}-${room.spinResult?.ts ?? 0}`;
    if (lastActedKey.current === key) return;
    const step: "spin" | "pick" = (!room.spinResult || room.spinResult.era == null) ? "spin" : "pick";
    const start = new Date(room.turnStartedAt).getTime();
    const remainMs = TURN_SECONDS * 1000 - (Date.now() - start);
    // If time is already up (remainMs <= 0), fire immediately (250ms buffer).
    const delay = Math.max(0, remainMs) + 250;
    const t = setTimeout(() => {
      lastActedKey.current = key;
      autoPlay(step, true);
    }, delay);
    return () => clearTimeout(t);
  }, [turnIsBot, spinning, room.phase, room.currentTurn, room.spinResult?.ts, totalPicks, iAmHost, remaining]);

  const gridCols = seats.length === 2 ? "grid-cols-1 sm:grid-cols-2"
    : seats.length === 3 ? "grid-cols-1 sm:grid-cols-3"
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  const myTeam = me > 0 ? seatTeam(room, me as SeatN) : [];
  const myOpenSlots = POSITIONS.filter((p) => !myTeam.some((t) => t.slot === p));

  return (
    <div>
      <div className={`grid ${gridCols} gap-2.5 mb-6`}>
        {seats.map((s) => (
          <TeamPanel key={s} seat={s} name={seatName(room, s)} roster={seatTeam(room, s)} active={room.currentTurn === s} />
        ))}
      </div>

      <div className="text-center mb-5">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Round {round} of 5</div>
        <div className="text-base sm:text-lg mt-1">
          <span className={`font-medium ${SEAT_TEXT[turnSeat]}`}>{turnName}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-foreground/80">on the clock</span>
          {turnIsBot && <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground ml-2">CPU</span>}
        </div>
        <TurnTimer remaining={remaining} />
      </div>

      <div className="py-4 sm:py-6">
        {(() => {
          const sr = room.spinResult;
          // PHASE 1 — team wheel (also the resting state when nothing has been spun)
          if (!sr || sr.era == null) {
            const teams = TEAMS_WITH_ROSTER;
            const slices = teamSlices(teams);
            return (
              <SpinWheel
                slices={slices}
                rotation={sr ? sr.teamRotation : null}
                resultIndex={sr ? sr.teamIndex : null}
                spinKey={sr ? sr.ts : 0}
                spinning={spinning && (!sr || sr.era == null)}
                title="Team"
              />
            );
          }
          // PHASE 2 — era wheel for the locked-in team
          const eras = erasForTeam(sr.team);
          const c = teamColor(sr.team);
          const slices = eraSlices(eras, c.primary, c.accent);
          return (
            <SpinWheel
              slices={slices}
              rotation={sr.eraRotation}
              resultIndex={sr.eraIndex}
              spinKey={sr.ts}
              spinning={spinning}
              title={sr.team}
            />
          );
        })()}

        {/* Action buttons */}
        {!spinning && (() => {
          const sr = room.spinResult;
          const urgent = myTurn && !turnIsBot && remaining <= 10;
          const critical = myTurn && !turnIsBot && remaining <= 5;
          if (!sr) {
            return (
              <div className="text-center mt-8">
                <button
                  onClick={() => spin(getPlayerId())}
                  disabled={!myTurn || turnIsBot}
                  className={`px-7 py-3 rounded-md bg-foreground text-background text-sm font-medium tracking-wide uppercase disabled:opacity-30 hover:opacity-90 transition ${critical ? "animate-btn-urgent" : ""}`}
                >
                  {myTurn ? "Spin for team" : turnIsBot ? "CPU spinning…" : "Waiting…"}
                </button>
              </div>
            );
          }
          if (sr.era == null) {
            return (
              <div className="text-center mt-8">
                <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-3">
                  Team locked in: <span className="text-foreground">{sr.team}</span>
                </div>
                <button
                  onClick={() => spinEra(getPlayerId())}
                  disabled={!myTurn || turnIsBot}
                  className={`px-7 py-3 rounded-md bg-foreground text-background text-sm font-medium tracking-wide uppercase disabled:opacity-30 hover:opacity-90 transition ${critical ? "animate-btn-urgent" : ""}`}
                >
                  {myTurn ? "Spin for era" : turnIsBot ? "CPU spinning…" : "Waiting…"}
                </button>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {room.spinResult && room.spinResult.era && !spinning && (
        <div className="animate-flash-in mt-2">
          <div className="text-center mb-6">
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Spin result</div>
            <div className="font-display text-3xl sm:text-4xl mt-2 text-foreground">
              {room.spinResult.era} · {room.spinResult.team}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {myTurn ? "Pick a player and position" : turnIsBot ? "CPU picking…" : `Waiting for ${turnName}…`}
            </div>
          </div>
          {myTurn && !turnIsBot ? (() => {
            const takenKeys = new Set(seats.flatMap((s) => seatTeam(room, s)).map((p) => `${p.name}|${p.team}|${p.era}`));
            const urgent = remaining <= 10;
            const critical = remaining <= 5;
            return (
              <div className={`rounded-xl border border-transparent transition-all ${critical ? "timer-critical" : urgent ? "timer-urgent" : ""}`}>
                {critical && (
                  <div className="text-center pb-3 pt-1">
                    <span className="text-xs font-medium text-destructive tracking-wide animate-pulse">
                      Auto-picking in {remaining}s…
                    </span>
                  </div>
                )}
                <PlayerPicker
                  players={getPlayersFor(room.spinResult.era as Era, room.spinResult.team)}
                  takenKeys={takenKeys}
                  canPick={true}
                  team={room.spinResult.team}
                  openSlots={myOpenSlots}
                  onPick={(name, position) => pickPlayer(getPlayerId(), name, position as Position)}
                />
              </div>
            );
          })() : (
            <div className="text-center py-6">
              <div className="inline-block px-6 py-4 rounded-xl border border-dashed border-border bg-card/40">
                <div className="text-sm text-muted-foreground">
                  {turnIsBot ? "CPU is thinking…" : `${turnName} is choosing`}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function TurnTimer({ remaining }: { remaining: number }) {
  const danger = remaining <= 10;
  const pct = Math.min(100, (remaining / TURN_SECONDS) * 100);
  return (
    <div className="mt-2 max-w-[10rem] mx-auto">
      <div className={`font-mono text-sm ${danger ? "text-destructive" : "text-muted-foreground"}`}>
        {String(remaining).padStart(2, "0")}s
      </div>
      <div className="h-[2px] bg-border rounded-full overflow-hidden mt-1">
        <div className={`h-full transition-all ${danger ? "bg-destructive" : "bg-foreground/60"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TeamPanel({ seat, name, roster, active }: { seat: SeatN; name: string | null; roster: DraftedPlayer[]; active?: boolean }) {
  return (
    <div className={`bg-card border rounded-xl p-3 ${active ? "border-foreground/40 ring-1 " + SEAT_RING[seat] : "border-border opacity-90"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${SEAT_DOT[seat]}`} />
          <div className="text-sm font-medium truncate">{name ?? `Player ${seat}`}</div>
        </div>
        <div className="text-[10px] text-muted-foreground">{roster.length}/5</div>
      </div>
      <div className="space-y-1">
        {POSITIONS.map((pos) => {
          const p = roster.find((r) => r.slot === pos);
          return (
            <div key={pos} className={`px-2 py-1.5 rounded text-xs flex items-center gap-2 ${p ? "bg-background" : "bg-background/40 border border-dashed border-border"}`}>
              <span className="font-mono font-medium text-[10px] w-6 text-muted-foreground">{pos}</span>
              {p ? <span className="truncate flex-1">{p.name}</span> : <span className="text-muted-foreground flex-1">empty</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- SIM ---------------- */

function Sim({ room, me }: { room: GameRoom; me: SeatN | 0 }) {
  const [started, setStarted] = useState(false);
  const iAmHost = me === 1;
  useEffect(() => {
    if (started || !iAmHost) return;
    setStarted(true);
    runSim();
  }, [iAmHost, started]);

  const seats = activeSeats(room);
  const cols = seats.length === 2 ? "grid-cols-2" : seats.length === 3 ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-2";
  const isTvt = (room.gameMode ?? "classic") === "tvt";

  return (
    <div className="py-10">
      <div className="text-center mb-8">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          {isTvt ? "Team vs Team" : "Regular season"}
        </div>
        <h2 className="font-display text-3xl sm:text-4xl mt-2">
          {isTvt ? "Running tournament" : "Simulating 82 games"}
        </h2>
      </div>
      <div className={`grid ${cols} gap-3 max-w-3xl mx-auto`}>
        {seats.map((s) => (
          <MiniScoreCard key={s} seat={s} name={seatName(room, s)} record={seatRecord(room, s)} focused={me === s} isTvt={isTvt} />
        ))}
      </div>
      <div className="text-center mt-8 text-sm text-muted-foreground animate-pulse">
        {isTvt ? "Simulating matchups…" : "Crunching the numbers…"}
      </div>
    </div>
  );
}

// Live bracket reveal shown after TVT sim completes (during tiebreaker_pick phase).
function TvtBracket({ room, me }: { room: GameRoom; me: SeatN | 0 }) {
  const matchups = room.tvtMatchups ?? [];
  // Reveal matchups one at a time, 800ms apart.
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (revealed >= matchups.length) return;
    const t = setTimeout(() => setRevealed((r) => r + 1), 800);
    return () => clearTimeout(t);
  }, [revealed, matchups.length]);

  const seats = activeSeats(room);
  const sorted = [...seats].sort((a, b) => (seatRecord(room, b)?.wins ?? 0) - (seatRecord(room, a)?.wins ?? 0));
  const finalists = (room.tiebreakerPlayers ?? sorted.slice(0, 2)) as SeatN[];

  return (
    <div className="py-10 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Team vs Team</div>
        <h2 className="font-display text-3xl sm:text-4xl mt-2">Round-robin results</h2>
      </div>

      {/* Matchup cards */}
      <div className="space-y-3 mb-8">
        {matchups.map((m, i) => {
          const visible = i < revealed;
          const nameA = seatName(room, m.seatA as SeatN) ?? `P${m.seatA}`;
          const nameB = seatName(room, m.seatB as SeatN) ?? `P${m.seatB}`;
          const winnerIsA = m.winner === m.seatA;
          return (
            <div
              key={i}
              className={`bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
              style={{ transitionDelay: "0ms" }}
            >
              <div className={`flex-1 flex items-center gap-2 ${winnerIsA ? "" : "opacity-40"}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[m.seatA]}`} />
                <span className={`text-sm font-medium truncate ${winnerIsA ? SEAT_TEXT[m.seatA] : ""}`}>{nameA}</span>
                {winnerIsA && visible && <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">W</span>}
              </div>
              <div className="text-xs text-muted-foreground font-mono px-2 flex-shrink-0">vs</div>
              <div className={`flex-1 flex items-center gap-2 flex-row-reverse ${!winnerIsA ? "" : "opacity-40"}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[m.seatB]}`} />
                <span className={`text-sm font-medium truncate ${!winnerIsA ? SEAT_TEXT[m.seatB] : ""}`}>{nameB}</span>
                {!winnerIsA && visible && <span className="mr-auto text-[10px] uppercase tracking-widest text-muted-foreground">W</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Standings + finalists banner — only show after all matchups revealed */}
      {revealed >= matchups.length && (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground text-center mb-2">Standings</div>
          {sorted.map((s, rank) => {
            const r = seatRecord(room, s as SeatN) ?? { wins: 0, losses: 0 };
            const isFinalist = finalists.includes(s as SeatN);
            return (
              <div key={s} className={`flex items-center gap-3 bg-card border rounded-xl px-4 py-3 ${isFinalist ? "border-foreground/40 ring-1 " + SEAT_RING[s] : "border-border opacity-70"}`}>
                <span className="text-xs text-muted-foreground w-4 text-right">{rank + 1}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${SEAT_DOT[s]}`} />
                <span className="flex-1 text-sm font-medium truncate">{seatName(room, s as SeatN)}</span>
                <span className="font-mono text-sm">{r.wins}-{r.losses}</span>
                {isFinalist && <span className="text-[10px] uppercase tracking-widest text-muted-foreground ml-1">Final</span>}
              </div>
            );
          })}
          <div className="text-center mt-6 text-sm text-muted-foreground animate-pulse">Preparing 1-on-1 final…</div>
        </div>
      )}
    </div>
  );
}

function MiniScoreCard({ seat, name, record, focused, isTvt }: { seat: SeatN; name: string | null; record: { wins: number; losses: number } | null; focused: boolean; isTvt?: boolean }) {
  const r = record ?? (isTvt ? { wins: 0, losses: 0 } : { wins: 0, losses: 82 });
  return (
    <div className={`bg-card border rounded-xl p-4 ${focused ? "border-foreground/40 ring-1 " + SEAT_RING[seat] : "border-border opacity-90"}`}>
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${SEAT_DOT[seat]}`} />
        <div className="text-sm font-medium truncate">{name}</div>
      </div>
      <div className="font-mono text-3xl sm:text-4xl text-foreground text-center mt-3">
        {String(r.wins).padStart(2, "0")}-{String(r.losses).padStart(2, "0")}
      </div>
      {isTvt && <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground text-center mt-1">vs teams</div>}
    </div>
  );
}

function ResultReveal({ room, me }: { room: GameRoom; me: SeatN | 0 }) {
  const isTvt = (room.gameMode ?? "classic") === "tvt";
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(false);
    // In TVT mode, the result comes after the 1v1 tiebreaker, so skip the
    // 82-game ticker animation and go straight to the result screen.
    const delay = isTvt ? 0 : 9000;
    const t = setTimeout(() => setDone(true), delay);
    return () => clearTimeout(t);
  }, [room.code, room.updatedAt, isTvt]);
  if (done || isTvt) return <Result room={room} me={me} />;
  return <FinalSim room={room} me={me} />;
}

function FinalSim({ room, me }: { room: GameRoom; me: SeatN | 0 }) {
  const seat = (me > 0 ? me : activeSeats(room)[0] ?? 1) as SeatN;
  const record = seatRecord(room, seat);
  const roster = seatTeam(room, seat);
  const name = seatName(room, seat) ?? "Final results";
  const total = 82;
  const finalRecord = record ?? { wins: 0, losses: 82 };
  const seq = useMemo(() => {
    const items: ("W" | "L")[] = [
      ...Array(finalRecord.wins).fill("W"),
      ...Array(finalRecord.losses).fill("L"),
    ];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }, [finalRecord.wins, finalRecord.losses]);
  const [shown, setShown] = useState(0);
  const winsShown = seq.slice(0, shown).filter((r) => r === "W").length;
  const lossesShown = seq.slice(0, shown).filter((r) => r === "L").length;

  useEffect(() => {
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1; setShown(i);
      if (i >= total) clearInterval(id);
    }, 110);
    return () => clearInterval(id);
  }, [room.code, room.updatedAt, total]);

  return (
    <div className="py-8 sm:py-12 max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Season sim</div>
        <h2 className="font-display text-3xl sm:text-4xl mt-2 truncate">{name}</h2>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${SEAT_DOT[seat]}`} />
            <div className="text-sm font-medium">{name}</div>
          </div>
          <div className="font-mono text-3xl sm:text-4xl text-foreground">
            {shown >= total
              ? `${String(finalRecord.wins).padStart(2, "0")}-${String(finalRecord.losses).padStart(2, "0")}`
              : <span className="text-lg text-muted-foreground animate-pulse">Simulating…</span>}
          </div>
        </div>

        <div className="grid grid-cols-10 sm:grid-cols-14 gap-1">
          {seq.map((result, index) => {
            const visible = index < shown;
            return (
              <div
                key={`${index}-${result}`}
                className={`aspect-square rounded flex items-center justify-center text-[10px] font-medium transition-all duration-200 ${
                  visible
                    ? result === "W"
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40"
                      : "bg-rose-500/10 text-rose-300/80 border border-rose-400/30"
                    : "bg-background/40 text-transparent border border-border/40"
                }`}
              >
                {visible ? result : "·"}
              </div>
            );
          })}
        </div>

        {shown >= total && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat label="Wins" value={finalRecord.wins} tone="emerald" />
            <Stat label="Losses" value={finalRecord.losses} tone="rose" />
          </div>
        )}

        <div className="mt-4 grid gap-1">
          {roster.slice(0, 5).map((p, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate"><span className="font-mono mr-1">{p.slot}</span>{p.name}</span>
              <span className="ml-2 shrink-0">{p.era} · {p.rating}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "rose" }) {
  const c = tone === "emerald" ? "border-emerald-400/30 bg-emerald-500/5 text-emerald-300" : "border-rose-400/30 bg-rose-500/5 text-rose-300";
  return (
    <div className={`rounded-xl border p-3 text-center ${c}`}>
      <div className="text-[10px] uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="font-display text-3xl mt-0.5">{value}</div>
    </div>
  );
}

/* ---------------- RESULT ---------------- */

function Result({ room, me }: { room: GameRoom; me: SeatN | 0 }) {
  const isTvt = (room.gameMode ?? "classic") === "tvt";
  const winner = room.winner ?? 0;
  const tie = winner === 0;
  const youWin = winner === me && me !== 0;

  useEffect(() => {
    if (youWin) sfx.fanfare();
    else if (!tie) sfx.buzzer();
  }, [youWin, tie]);

  if (isTvt) return <TvtRecap room={room} me={me} winner={winner as SeatN | 0} youWin={youWin} />;

  const winnerName = winner > 0 ? seatName(room, winner as SeatN) : null;
  const seats = activeSeats(room);
  const cols = seats.length === 2 ? "grid-cols-1 sm:grid-cols-2"
    : seats.length === 3 ? "grid-cols-1 sm:grid-cols-3"
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className="py-10 text-center max-w-5xl mx-auto">
      <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Final</div>
      <h2 className={`font-display text-4xl sm:text-5xl mt-2 ${youWin ? "text-emerald-300" : "text-foreground"}`}>
        {tie ? "Tie" : `${winnerName} wins`}
      </h2>
      <div className={`mt-8 grid ${cols} gap-3`}>
        {seats.map((s) => (
          <FinalCard key={s} seat={s} name={seatName(room, s)} record={seatRecord(room, s)} roster={seatTeam(room, s)} winner={s === winner} />
        ))}
      </div>
      <ShareResult room={room} winnerSeat={winner as SeatN | 0} youWin={youWin} />
      <button
        onClick={() => roomManager.resetRoom()}
        className="mt-6 px-6 py-2.5 rounded-md bg-foreground text-background text-sm font-medium tracking-wide uppercase hover:opacity-90"
      >
        Rematch
      </button>
    </div>
  );
}

/* ---------------- TVT RECAP ---------------- */

function mvpOf(roster: DraftedPlayer[]): DraftedPlayer | null {
  if (!roster.length) return null;
  return roster.reduce((best, p) => {
    const score = (p: DraftedPlayer) => p.rating + (p.wow ? 2 : 0) + (ERA_BOOST[p.era as Era] ?? 0) * 10;
    return score(p) > score(best) ? p : best;
  });
}

function TvtRecap({ room, me, winner, youWin }: { room: GameRoom; me: SeatN | 0; winner: SeatN | 0; youWin: boolean }) {
  const [showInfo, setShowInfo] = useState(false);
  const tb = room.tiebreaker;
  const matchups = room.tvtMatchups ?? [];
  const seats = activeSeats(room);
  const winnerName = winner > 0 ? seatName(room, winner as SeatN) : null;
  const tie = winner === 0;
  const finalists = (room.tiebreakerPlayers ?? []) as SeatN[];
  const tbScores = tb ? { ...tb.scores } : {} as Record<string, number>;

  return (
    <div className="py-10 max-w-4xl mx-auto">

      {/* ── Winner banner ── */}
      <div className="text-center mb-10 relative">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Team vs Team · Final</div>
        <h2 className={`font-display text-4xl sm:text-5xl mt-2 ${youWin ? "text-emerald-300" : "text-foreground"}`}>
          {tie ? "Tie" : `${winnerName} wins`}
        </h2>
        {tb && winner > 0 && finalists.length === 2 && (
          <div className="text-sm text-muted-foreground mt-2">
            1-on-1 final: {tbScores[String(finalists[0])] ?? 0}–{tbScores[String(finalists[1])] ?? 0}
          </div>
        )}
        {/* ℹ info button */}
        <button
          onClick={() => setShowInfo(true)}
          title="How the sim works"
          className="absolute top-0 right-0 w-7 h-7 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/40 transition flex items-center justify-center text-xs font-bold"
        >
          i
        </button>
      </div>

      {/* ── Info modal ── */}
      {showInfo && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 max-w-md w-full text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-display text-xl">How the sim decides</h3>
              <button onClick={() => setShowInfo(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none ml-4">✕</button>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <div className="text-foreground font-medium mb-0.5">Player rating (65–99)</div>
                The biggest factor. Each team's average rating forms the base of their strength score. Higher rated players win more often.
              </div>
              <div>
                <div className="text-foreground font-medium mb-0.5">Era boost</div>
                Older eras get a modest bonus to balance against modern players who carry inflated ratings. A 60s legend at 85 competes closer to a 2020s player at 90.
              </div>
              <div>
                <div className="text-foreground font-medium mb-0.5">Legendary tier (WOW)</div>
                All-time greats carry a bonus on top of their rating — having multiple legends stacks the advantage.
              </div>
              <div>
                <div className="text-foreground font-medium mb-0.5">Head-to-head matchup</div>
                Each match is probabilistic: the stronger team wins more often, but an upset is always possible. Team strength = avg rating + era bonuses + legend bonuses.
              </div>
              <div>
                <div className="text-foreground font-medium mb-0.5">1-on-1 tiebreaker</div>
                The top two teams face off in a best-of-5 isolation round. Offense chooses drive / shoot / fade; defense chooses paint or perimeter. Outcomes are a mix of matchup logic and chance.
              </div>
            </div>
            <button
              onClick={() => setShowInfo(false)}
              className="mt-5 w-full py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── Match results ── */}
      {matchups.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-3">Results</div>
          <div className="space-y-2">
            {matchups.map((m, i) => {
              const winnerIsA = m.winner === m.seatA;
              const nameA = seatName(room, m.seatA as SeatN) ?? `P${m.seatA}`;
              const nameB = seatName(room, m.seatB as SeatN) ?? `P${m.seatB}`;
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[m.seatA]}`} />
                  <span className={`flex-1 truncate font-medium ${winnerIsA ? SEAT_TEXT[m.seatA as SeatN] : "text-muted-foreground"}`}>{nameA}</span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">{winnerIsA ? "beat" : "lost to"}</span>
                  <span className={`flex-1 truncate text-right font-medium ${!winnerIsA ? SEAT_TEXT[m.seatB as SeatN] : "text-muted-foreground"}`}>{nameB}</span>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[m.seatB]}`} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Both teams' rosters + MVP ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {finalists.map((s) => {
          const roster = seatTeam(room, s);
          const mvp = mvpOf(roster);
          const isWinner = s === winner;
          return (
            <div key={s} className={`bg-card border rounded-2xl p-4 ${isWinner ? "border-foreground/40 ring-1 " + SEAT_RING[s] : "border-border"}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-1.5 h-1.5 rounded-full ${SEAT_DOT[s]}`} />
                <div className={`text-sm font-semibold truncate ${isWinner ? SEAT_TEXT[s] : ""}`}>{seatName(room, s)}</div>
                {isWinner && <span className="ml-auto text-xs">🏆</span>}
              </div>
              {/* MVP */}
              {mvp && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-background/60 border border-border">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">MVP</div>
                  <div className="text-sm font-medium truncate mt-0.5">{mvp.name}</div>
                  <div className="text-[10px] text-muted-foreground">{mvp.slot} · {mvp.era} · {mvp.rating}</div>
                </div>
              )}
              {/* Full roster */}
              <div className="space-y-1">
                {roster.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate"><span className="font-mono mr-1.5">{p.slot}</span>{p.name}</span>
                    <span className="ml-2 shrink-0 font-mono">{p.rating}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 1-on-1 final ── */}
      {tb && finalists.length === 2 && (() => {
        const [sA, sB] = finalists;
        const nameA = seatName(room, sA) ?? `P${sA}`;
        const nameB = seatName(room, sB) ?? `P${sB}`;
        return (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6">
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-3">1-on-1 final</div>
            <div className="flex items-center gap-3 mb-4">
              <div className={`flex-1 text-center rounded-lg py-2 bg-background/40 ${tbScores[String(sA)] > tbScores[String(sB)] ? "ring-1 " + SEAT_RING[sA] : ""}`}>
                <div className={`text-xs truncate px-1 ${SEAT_TEXT[sA]}`}>{nameA}</div>
                <div className="font-display text-3xl">{tbScores[String(sA)] ?? 0}</div>
              </div>
              <div className="text-muted-foreground text-sm shrink-0">–</div>
              <div className={`flex-1 text-center rounded-lg py-2 bg-background/40 ${tbScores[String(sB)] > tbScores[String(sA)] ? "ring-1 " + SEAT_RING[sB] : ""}`}>
                <div className={`text-xs truncate px-1 ${SEAT_TEXT[sB]}`}>{nameB}</div>
                <div className="font-display text-3xl">{tbScores[String(sB)] ?? 0}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {tb.history.map((h, i) => {
                const offName = seatName(room, h.offense as SeatN) ?? `P${h.offense}`;
                const defSeat = finalists.find((s) => s !== h.offense) as SeatN;
                const defName = seatName(room, defSeat) ?? `P${defSeat}`;
                const offMove = h.moves[String(h.offense)] ?? "?";
                const defMove = h.moves[String(defSeat)] ?? "?";
                return (
                  <div key={i} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 bg-background/40">
                    <span className="text-muted-foreground font-mono w-4 flex-shrink-0">R{h.round}</span>
                    <span className={`flex-1 truncate ${SEAT_TEXT[h.offense as SeatN]}`}>
                      {offName} <span className="text-muted-foreground">→</span> <span className="font-medium">{offMove}</span>
                    </span>
                    <span className="text-muted-foreground shrink-0">vs</span>
                    <span className={`flex-1 truncate text-right ${SEAT_TEXT[defSeat]}`}>
                      <span className="font-medium">{defMove}</span> <span className="text-muted-foreground">←</span> {defName}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[h.roundWinner as SeatN]}`} />
                  </div>
                );
              })}
            </div>
            {tb.avatars && (
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-2">
                {finalists.map((s) => {
                  const av = tb.avatars[String(s)];
                  return (
                    <div key={s} className={`rounded-lg px-3 py-2 bg-background/40 ${s === winner ? "ring-1 " + SEAT_RING[s] : ""}`}>
                      <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Isolation</div>
                      <div className={`text-[10px] truncate mt-0.5 ${SEAT_TEXT[s]}`}>{seatName(room, s)}</div>
                      <div className="font-display text-sm mt-0.5 truncate">{av?.name ?? "—"}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <ShareResult room={room} winnerSeat={winner as SeatN | 0} youWin={youWin} />
      <div className="text-center mt-6">
        <button
          onClick={() => roomManager.resetRoom()}
          className="px-6 py-2.5 rounded-md bg-foreground text-background text-sm font-medium tracking-wide uppercase hover:opacity-90"
        >
          Rematch
        </button>
      </div>
    </div>
  );
}

function FinalCard({ seat, name, record, roster, winner, isTvt }: { seat: SeatN; name: string | null; record: { wins: number; losses: number } | null; roster: DraftedPlayer[]; winner: boolean; isTvt?: boolean }) {
  return (
    <div className={`bg-card border rounded-xl p-3 text-left ${winner ? "border-foreground/40 ring-1 " + SEAT_RING[seat] : "border-border opacity-80"}`}>
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${SEAT_DOT[seat]}`} />
        <div className="text-sm font-medium truncate">{name}</div>
      </div>
      <div className="font-mono text-3xl sm:text-4xl text-foreground my-2">{record?.wins ?? 0}-{record?.losses ?? 0}</div>
      {isTvt && <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">vs teams</div>}
      <div className="space-y-0.5">
        {roster.map((p, i) => (
          <div key={i} className="text-[11px] flex justify-between text-muted-foreground">
            <span className="truncate"><span className="font-mono mr-1">{p.slot}</span>{p.name}</span>
            <span className="ml-2 shrink-0">{p.era} · {p.rating}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- TIEBREAKER PICK ---------------- */

function TiebreakerPick({ room, me }: { room: GameRoom; me: SeatN | 0 }) {
  const tb = room.tiebreaker!;
  const finalists = tb.players;
  const isFinalist = finalists.includes(me as SeatN);
  const myAvatar = isFinalist ? tb.avatars[String(me)] : null;
  const myRoster: DraftedPlayer[] = isFinalist ? seatTeam(room, me as SeatN) : [];
  const iAmHost = me === 1;

  useEffect(() => {
    if (!iAmHost) return;
    for (const s of finalists) {
      if (isBot(room, s) && !tb.avatars[String(s)]) {
        const team = seatTeam(room, s);
        if (team.length === 0) continue;
        const pick = team.reduce((a, b) => (a.rating >= b.rating ? a : b));
        const t = setTimeout(() => pickAvatar(getPlayerId(), pick.name), 700);
        return () => clearTimeout(t);
      }
    }
  }, [room, tb, finalists, iAmHost]);

  const isTvt = (room.gameMode ?? "classic") === "tvt";
  const [bracketDone, setBracketDone] = useState(!isTvt);
  const matchupCount = room.tvtMatchups?.length ?? 0;
  // After all matchups + standings have been revealed (matchupCount * 0.8s + 1.5s grace), show the pick UI.
  useEffect(() => {
    if (!isTvt) return;
    const delay = matchupCount * 800 + 2200;
    const t = setTimeout(() => setBracketDone(true), delay);
    return () => clearTimeout(t);
  }, [isTvt, matchupCount]);

  return (
    <div>
      {isTvt && <TvtBracket room={room} me={me} />}
      {(!isTvt || bracketDone) && (
      <div className="py-8 text-center max-w-3xl mx-auto">
      <div className={`text-[10px] uppercase tracking-[0.28em] ${isTvt ? "text-muted-foreground" : "text-emerald-300"}`}>
        {isTvt ? "Team vs Team · Final" : "Both perfect"}
      </div>
      <h2 className="font-display text-3xl sm:text-4xl mt-2 mb-2">1-on-1 tiebreaker</h2>
      <p className="text-sm text-muted-foreground mb-8">
        {isTvt ? "Top 2 teams clash. Pick your isolation player. First to 3 wins." : "Finalists pick their isolation player. First to 3 takes it."}
      </p>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {finalists.map((s) => (
          <AvatarSlot key={s} seat={s} name={seatName(room, s)} avatar={tb.avatars[String(s)]} />
        ))}
      </div>
      {isFinalist && !myAvatar && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {myRoster.map((p, i) => (
            <button
              key={i}
              onClick={() => pickAvatar(getPlayerId(), p.name)}
              className="p-3 rounded-lg border border-border bg-card hover:border-foreground/40 transition text-left"
            >
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{p.slot} · {p.era}</div>
            </button>
          ))}
        </div>
      )}
      {isFinalist && myAvatar && finalists.some((s) => !tb.avatars[String(s)]) && (
        <div className="text-sm text-muted-foreground animate-pulse">Waiting for opponent…</div>
      )}
      {!isFinalist && <div className="text-sm text-muted-foreground">Watching the finals…</div>}
    </div>
      )}
    </div>
  );
}

function AvatarSlot({ seat, name, avatar }: { seat: SeatN; name: string | null; avatar: Player | null }) {
  return (
    <div className={`p-5 border rounded-xl ${avatar ? "border-foreground/40 ring-1 " + SEAT_RING[seat] : "border-dashed border-border opacity-60"}`}>
      <div className="flex items-center gap-2 justify-center">
        <span className={`w-1.5 h-1.5 rounded-full ${SEAT_DOT[seat]}`} />
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{name}</div>
      </div>
      <div className="font-display text-2xl mt-2">{avatar?.name ?? "…"}</div>
      {avatar && <div className="text-[10px] text-muted-foreground mt-1">{avatar.era}</div>}
    </div>
  );
}

/* ---------------- TIEBREAKER ---------------- */

function Tiebreaker({ room, me }: { room: GameRoom; me: SeatN | 0 }) {
  const tb = room.tiebreaker!;
  const finalists = tb.players;
  const isFinalist = finalists.includes(me as SeatN);
  const myMove = isFinalist ? tb.moves[String(me)] : null;
  const oppSeat = finalists.find((s) => s !== me) as SeatN | undefined;
  const oppMoveSubmitted = oppSeat ? !!tb.moves[String(oppSeat)] : false;
  const iAmOffense = tb.offense === me;
  const offenseSeat = tb.offense;
  const defenseSeat = finalists.find((s) => s !== offenseSeat) as SeatN;
  const offenseName = tb.avatars[String(offenseSeat)]?.name;
  const defenseName = tb.avatars[String(defenseSeat)]?.name;
  const iAmHost = me === 1;

  useEffect(() => {
    if (!iAmHost) return;
    for (const s of finalists) {
      if (isBot(room, s) && !tb.moves[String(s)]) {
        const onOffense = tb.offense === s;
        const moves = onOffense ? ["drive", "shoot", "fade"] : ["paint", "perimeter"];
        const m = moves[Math.floor(Math.random() * moves.length)];
        const t = setTimeout(() => submitMove(getPlayerId(), m), 900);
        return () => clearTimeout(t);
      }
    }
  }, [room, tb, finalists, iAmHost]);

  return (
    <div className="py-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-center gap-10 mb-6">
        <ScoreCol seat={finalists[0]} name={seatName(room, finalists[0])} score={tb.scores[String(finalists[0])] ?? 0} />
        <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Rd {tb.round}</div>
        <ScoreCol seat={finalists[1]} name={seatName(room, finalists[1])} score={tb.scores[String(finalists[1])] ?? 0} />
      </div>

      <div className="text-center mb-6">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Matchup</div>
        <div className="text-lg sm:text-xl mt-1">
          <span className={`font-medium ${SEAT_TEXT[offenseSeat]}`}>{offenseName}</span>
          <span className="text-muted-foreground"> on </span>
          <span className={`font-medium ${SEAT_TEXT[defenseSeat]}`}>{defenseName}</span>
        </div>
        {isFinalist && (
          <div className="text-xs mt-2 text-muted-foreground">
            You are on <span className="text-foreground">{iAmOffense ? "OFFENSE" : "DEFENSE"}</span>
          </div>
        )}
      </div>

      {isFinalist && !myMove && (
        <div className="max-w-xl mx-auto">
          {iAmOffense ? (
            <div className="grid grid-cols-3 gap-2">
              <MoveBtn label="Drive" desc="Attack rim" onClick={() => submitMove(getPlayerId(), "drive")} />
              <MoveBtn label="Shoot" desc="Catch & shoot" onClick={() => submitMove(getPlayerId(), "shoot")} />
              <MoveBtn label="Fade" desc="Step-back" onClick={() => submitMove(getPlayerId(), "fade")} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <MoveBtn label="Paint" desc="Protect rim" onClick={() => submitMove(getPlayerId(), "paint")} />
              <MoveBtn label="Perimeter" desc="Close out" onClick={() => submitMove(getPlayerId(), "perimeter")} />
            </div>
          )}
        </div>
      )}

      {isFinalist && myMove && !oppMoveSubmitted && (
        <div className="text-center text-sm text-muted-foreground animate-pulse">Waiting for opponent…</div>
      )}
      {!isFinalist && <div className="text-center text-sm text-muted-foreground">Watching the 1v1…</div>}

      {tb.history.length > 0 && (
        <div className="mt-10">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Plays</div>
          <div className="space-y-1">
            {tb.history.map((h, i) => (
              <div key={i} className="flex items-center justify-between bg-card border border-border rounded px-3 py-2 text-xs">
                <span className="text-muted-foreground">R{h.round}</span>
                {finalists.map((s) => (
                  <span key={s} className={SEAT_TEXT[s]}>P{s}: {h.moves[String(s)]}</span>
                ))}
                <span className={`${SEAT_TEXT[h.roundWinner]} font-medium`}>
                  +1 {seatName(room, h.roundWinner)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCol({ seat, name, score }: { seat: SeatN; name: string | null; score: number }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${SEAT_DOT[seat]}`} />
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{name}</div>
      </div>
      <div className="font-mono text-5xl text-foreground mt-1">{score}</div>
    </div>
  );
}

function MoveBtn({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-lg border border-border bg-card hover:border-foreground/40 transition text-left"
    >
      <div className="text-base font-medium">{label}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
    </button>
  );
}
