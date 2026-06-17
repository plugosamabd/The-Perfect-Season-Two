import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPlayerId, getPlayerName, setPlayerName } from "@/lib/identity";
import { ERA_BOOST, erasForTeam, getPlayersFor, teamColor, TEAMS_WITH_ROSTER, type Era, type Player, type Position } from "@/data/roster";
import { POSITIONS, TURN_SECONDS, getShotsForPlayer, DEFENSE_TYPES, type DraftedPlayer, type Seat } from "@/lib/game";
import { useP2PStore, roomManager, type GameRoom, type TvtMatchup } from "@/lib/p2p";
import { loadRoomSnapshot } from "@/lib/p2p/room-manager";
import { spin, spinEra, pickPlayer, runSim, pickFinalistPlayer, submitOffenseMove, submitDefenseMove, autoPlay, respin } from "@/lib/game.actions";
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
    return <JoinFromLink code={code} />;
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
        {room.phase === "tiebreaker_pick" && <FinalsPick room={room} me={realSeat} />}
        {room.phase === "tiebreaker" && <Finals room={room} me={realSeat} />}
        {realSeat === 0 && (
          <div className="text-center text-xs text-muted-foreground mt-4">Spectating</div>
        )}
      </main>

      <ChatBox myId={pid} myName={myName} mySeat={realSeat} />
    </div>
  );
}

/* ---------------- JOIN FROM LINK ---------------- */

function JoinFromLink({ code }: { code: string }) {
  const [name, setName] = useState(() => getPlayerName());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Enter your name"); return; }
    setPlayerName(name.trim());
    setBusy(true);
    setErr(null);
    try {
      const pid = getPlayerId();
      await roomManager.joinExistingRoom(code, pid, name.trim());
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not connect to room");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="font-mono text-4xl tracking-[0.3em] text-foreground">{code}</div>
          <h1 className="mt-2 font-display text-2xl">Join this room</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your name to join.</p>
        </div>
        <form onSubmit={join} className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus
              className="w-full bg-background border border-border rounded-md px-3.5 py-2.5 text-sm focus:border-foreground/40 outline-none"
              placeholder="alex"
            />
          </div>
          {err && (
            <div className={`text-xs px-3 py-2 rounded-md ${err.includes("already started") ? "bg-destructive/10 border border-destructive/30 text-destructive" : "text-destructive"}`}>
              {err.includes("already started") ? (
                <span>⚠️ {err}</span>
              ) : err}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-md bg-foreground text-background text-sm font-medium tracking-wide uppercase hover:opacity-90 disabled:opacity-40 transition"
          >
            {busy ? "Connecting…" : "Join room"}
          </button>
        </form>
        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition">← Back home</Link>
        </div>
      </div>
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
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[seat]}`} />
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">P{seat}</div>
      </div>
      <div className="font-medium text-sm mt-1 truncate min-w-0">{name ?? "Waiting…"}</div>
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

  useEffect(() => {
    if (spinning || room.phase !== "draft" || !iAmHost || turnIsBot) return;
    const key = `${room.currentTurn}-${totalPicks}-${room.spinResult?.ts ?? 0}`;
    if (lastActedKey.current === key) return;
    const step: "spin" | "pick" = (!room.spinResult || room.spinResult.era == null) ? "spin" : "pick";
    const start = new Date(room.turnStartedAt).getTime();
    const remainMs = TURN_SECONDS * 1000 - (Date.now() - start);
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
        <div className="text-base sm:text-lg mt-1 flex items-center justify-center gap-1.5 flex-wrap">
          <span className={`font-medium ${SEAT_TEXT[turnSeat]}`}>{turnName}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground/80">on the clock</span>
          {turnIsBot && <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground ml-1">CPU</span>}
        </div>
        <TurnTimer remaining={remaining} />
      </div>

      <div className="py-4 sm:py-6">
        {(() => {
          const sr = room.spinResult;
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
                  players={getPlayersFor(room.spinResult!.era as Era, room.spinResult!.team)}
                  takenKeys={takenKeys}
                  canPick={true}
                  team={room.spinResult!.team}
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
      <div className="flex items-center justify-between mb-2 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[seat]}`} />
          <div className="text-sm font-medium truncate min-w-0 break-words">{name ?? `Player ${seat}`}</div>
        </div>
        <div className="text-[10px] text-muted-foreground flex-shrink-0">{roster.length}/5</div>
      </div>
      <div className="space-y-1">
        {POSITIONS.map((pos) => {
          const p = roster.find((r) => r.slot === pos);
          return (
            <div key={pos} className={`px-2 py-1.5 rounded text-xs flex items-center gap-2 ${p ? "bg-background" : "bg-background/40 border border-dashed border-border"}`}>
              <span className="font-mono font-medium text-[10px] w-6 flex-shrink-0 text-muted-foreground">{pos}</span>
              {p ? <span className="truncate flex-1 min-w-0">{p.name}</span> : <span className="text-muted-foreground flex-1">empty</span>}
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

function TvtBracket({ room, me }: { room: GameRoom; me: SeatN | 0 }) {
  const matchups = room.tvtMatchups ?? [];
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
        <h2 className="font-display text-3xl sm:text-4xl mt-2">Results</h2>
      </div>

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
            >
              <div className={`flex-1 flex items-center gap-2 min-w-0 ${winnerIsA ? "" : "opacity-40"}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[m.seatA]}`} />
                <span className={`text-sm font-medium truncate min-w-0 ${winnerIsA ? SEAT_TEXT[m.seatA] : ""}`}>{nameA}</span>
                {winnerIsA && visible && <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground flex-shrink-0">W</span>}
              </div>
              <div className="text-xs text-muted-foreground font-mono px-2 flex-shrink-0">vs</div>
              <div className={`flex-1 flex items-center gap-2 flex-row-reverse min-w-0 ${!winnerIsA ? "" : "opacity-40"}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[m.seatB]}`} />
                <span className={`text-sm font-medium truncate min-w-0 ${!winnerIsA ? SEAT_TEXT[m.seatB] : ""}`}>{nameB}</span>
                {!winnerIsA && visible && <span className="mr-auto text-[10px] uppercase tracking-widest text-muted-foreground flex-shrink-0">W</span>}
              </div>
            </div>
          );
        })}
      </div>

      {revealed >= matchups.length && (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground text-center mb-2">Standings</div>
          {sorted.map((s, rank) => {
            const r = seatRecord(room, s as SeatN) ?? { wins: 0, losses: 0 };
            const isFinalist = finalists.includes(s as SeatN);
            return (
              <div key={s} className={`flex items-center gap-3 bg-card border rounded-xl px-4 py-3 ${isFinalist ? "border-foreground/40 ring-1 " + SEAT_RING[s] : "border-border opacity-70"}`}>
                <span className="text-xs text-muted-foreground w-4 text-right flex-shrink-0">{rank + 1}</span>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[s]}`} />
                <span className="flex-1 text-sm font-medium truncate min-w-0">{seatName(room, s as SeatN)}</span>
                <span className="font-mono text-sm flex-shrink-0">{r.wins}-{r.losses}</span>
                {isFinalist && <span className="text-[10px] uppercase tracking-widest text-muted-foreground ml-1 flex-shrink-0">Finals</span>}
              </div>
            );
          })}
          <div className="text-center mt-6 text-sm text-muted-foreground animate-pulse">Preparing 3v3 Finals…</div>
        </div>
      )}
    </div>
  );
}

function MiniScoreCard({ seat, name, record, focused, isTvt }: { seat: SeatN; name: string | null; record: { wins: number; losses: number } | null; focused: boolean; isTvt?: boolean }) {
  return (
    <div className={`bg-card border rounded-xl p-4 ${focused ? "border-foreground/40 ring-1 " + SEAT_RING[seat] : "border-border opacity-90"}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[seat]}`} />
        <div className="text-sm font-medium truncate min-w-0">{name}</div>
      </div>
      <div className="font-mono text-3xl sm:text-4xl text-foreground text-center mt-3">
        {record
          ? `${String(record.wins).padStart(2, "0")}-${String(record.losses).padStart(2, "0")}`
          : <span className="text-base text-muted-foreground animate-pulse">Simulating…</span>
        }
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
        <div className="flex items-center justify-between gap-4 mb-4 min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[seat]}`} />
            <div className="text-sm font-medium truncate min-w-0">{name}</div>
          </div>
          <div className="font-mono text-3xl sm:text-4xl text-foreground flex-shrink-0">
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
            <div key={i} className="flex items-center justify-between text-xs text-muted-foreground min-w-0">
              <span className="truncate min-w-0"><span className="font-mono mr-1">{p.slot}</span>{p.name}</span>
              <span className="ml-2 flex-shrink-0">{p.era} · {p.rating}</span>
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
      <div className="relative inline-block">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Final</div>
        <h2 className={`font-display text-4xl sm:text-5xl mt-2 ${youWin ? "text-emerald-300" : "text-foreground"}`}>
          {tie ? "Tie" : `${winnerName} wins`}
        </h2>
        <SimInfoButton />
      </div>
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

function SimInfoButton() {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <>
      <button
        onClick={() => setShowInfo(true)}
        title="How the sim works"
        className="absolute -top-1 -right-9 w-7 h-7 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/40 transition flex items-center justify-center text-xs font-bold"
      >
        i
      </button>
      {showInfo && <SimInfoModal onClose={() => setShowInfo(false)} />}
    </>
  );
}

function SimInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 max-w-md w-full text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-display text-xl">How the sim decides</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none ml-4">✕</button>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <div className="text-foreground font-medium mb-0.5">Player rating (65–99)</div>
            The foundation of every calculation. Higher rated players contribute more to both offense and defense.
          </div>
          <div>
            <div className="text-foreground font-medium mb-0.5">Defense (weighted 55%)</div>
            Defense is the dominant factor. Teams with elite defenders suppress the opposing offense. A lockdown defense can neutralise higher-rated opponents.
          </div>
          <div>
            <div className="text-foreground font-medium mb-0.5">Offense (weighted 45%)</div>
            Superstars like LeBron, Jordan, Steph, Shaq, and KD carry an extra offensive bonus on top of their rating.
          </div>
          <div>
            <div className="text-foreground font-medium mb-0.5">Era boost</div>
            Older eras receive a small bonus so legends from the 60s–80s remain competitive.
          </div>
          <div>
            <div className="text-foreground font-medium mb-0.5">Legendary tier (WOW)</div>
            All-time greats carry an additional bonus. Stacking multiple legends compounds the advantage.
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90"
        >
          Got it
        </button>
      </div>
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
      <div className="text-center mb-10 relative">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Team vs Team · Finals</div>
        <h2 className={`font-display text-4xl sm:text-5xl mt-2 ${youWin ? "text-emerald-300" : "text-foreground"}`}>
          {tie ? "Tie" : `${winnerName} wins`}
        </h2>
        {tb && winner > 0 && finalists.length === 2 && (
          <div className="text-sm text-muted-foreground mt-2">
            3v3 Finals: {tbScores[String(finalists[0])] ?? 0}–{tbScores[String(finalists[1])] ?? 0}
          </div>
        )}
        <button
          onClick={() => setShowInfo(true)}
          title="How the sim works"
          className="absolute top-0 right-0 w-7 h-7 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/40 transition flex items-center justify-center text-xs font-bold"
        >
          i
        </button>
      </div>

      {showInfo && <SimInfoModal onClose={() => setShowInfo(false)} />}

      {matchups.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-3">Results</div>
          <div className="space-y-2">
            {matchups.map((m, i) => {
              const winnerIsA = m.winner === m.seatA;
              const nameA = seatName(room, m.seatA as SeatN) ?? `P${m.seatA}`;
              const nameB = seatName(room, m.seatB as SeatN) ?? `P${m.seatB}`;
              return (
                <div key={i} className="flex items-center gap-3 text-sm min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[m.seatA]}`} />
                  <span className={`flex-1 truncate min-w-0 font-medium ${winnerIsA ? SEAT_TEXT[m.seatA as SeatN] : "text-muted-foreground"}`}>{nameA}</span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">{winnerIsA ? "beat" : "lost to"}</span>
                  <span className={`flex-1 truncate min-w-0 text-right font-medium ${!winnerIsA ? SEAT_TEXT[m.seatB as SeatN] : "text-muted-foreground"}`}>{nameB}</span>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[m.seatB]}`} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {seats.map((s) => {
          const roster = seatTeam(room, s);
          const mvp = mvpOf(roster);
          const isWinner = s === winner;
          const isFinalist = finalists.includes(s);
          return (
            <div key={s} className={`bg-card border rounded-2xl p-4 ${isWinner ? "border-foreground/40 ring-1 " + SEAT_RING[s] : isFinalist ? "border-border" : "border-border opacity-70"}`}>
              <div className="flex items-center gap-2 mb-3 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[s]}`} />
                <div className={`text-sm font-semibold truncate min-w-0 ${isWinner ? SEAT_TEXT[s] : ""}`}>{seatName(room, s)}</div>
                {isWinner && <span className="ml-auto flex-shrink-0 text-xs">🏆</span>}
                {!isWinner && isFinalist && <span className="ml-auto flex-shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">Finalist</span>}
              </div>
              {mvp && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-background/60 border border-border">
                  <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">MVP</div>
                  <div className="text-sm font-medium truncate mt-0.5">{mvp.name}</div>
                  <div className="text-[10px] text-muted-foreground">{mvp.slot} · {mvp.era} · {mvp.rating}</div>
                </div>
              )}
              <div className="space-y-1">
                {roster.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] text-muted-foreground min-w-0">
                    <span className="truncate min-w-0"><span className="font-mono mr-1.5">{p.slot}</span>{p.name}</span>
                    <span className="ml-2 flex-shrink-0 font-mono">{p.rating}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {tb && finalists.length === 2 && (() => {
        const [sA, sB] = finalists;
        const nameA = seatName(room, sA) ?? `P${sA}`;
        const nameB = seatName(room, sB) ?? `P${sB}`;
        return (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6">
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-3">3v3 Finals</div>
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
                const defSeat = finalists.find((s) => s !== h.offense) as SeatN;
                const offName = seatName(room, h.offense as SeatN) ?? `P${h.offense}`;
                const resultIcon = h.result === "made" ? "✓" : "✗";
                const outcomeLabel = h.outcome === "blocked" ? "perfect read" : h.outcome === "contested" ? "contested" : "open";
                return (
                  <div key={i} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 bg-background/40 flex-wrap">
                    <span className="text-muted-foreground font-mono w-4 flex-shrink-0">R{h.round}</span>
                    <span className={`font-medium ${SEAT_TEXT[h.offense as SeatN]}`}>{h.offensePlayer}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{h.shotType}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">{outcomeLabel}</span>
                    <span className={`ml-auto font-bold flex-shrink-0 ${h.result === "made" ? "text-emerald-300" : "text-rose-300"}`}>{resultIcon}</span>
                  </div>
                );
              })}
            </div>
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
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[seat]}`} />
        <div className="text-sm font-medium truncate min-w-0">{name}</div>
      </div>
      <div className="font-mono text-3xl sm:text-4xl text-foreground my-2">{record?.wins ?? 0}-{record?.losses ?? 0}</div>
      {isTvt && <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">vs teams</div>}
      <div className="space-y-0.5">
        {roster.map((p, i) => (
          <div key={i} className="text-[11px] flex justify-between text-muted-foreground min-w-0">
            <span className="truncate min-w-0"><span className="font-mono mr-1">{p.slot}</span>{p.name}</span>
            <span className="ml-2 flex-shrink-0">{p.era} · {p.rating}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- FINALS PICK (3 players each) ---------------- */

function FinalsPick({ room, me }: { room: GameRoom; me: SeatN | 0 }) {
  const tb = room.tiebreaker!;
  const finalists = tb.players;
  const isFinalist = finalists.includes(me as SeatN);
  const myRoster = tb.finalistRosters[String(me)] ?? [];
  const iAmHost = me === 1;
  const isTvt = (room.gameMode ?? "classic") === "tvt";
  const [bracketDone, setBracketDone] = useState(!isTvt);
  const matchupCount = room.tvtMatchups?.length ?? 0;

  useEffect(() => {
    if (!isTvt) return;
    const delay = matchupCount * 800 + 2200;
    const t = setTimeout(() => setBracketDone(true), delay);
    return () => clearTimeout(t);
  }, [isTvt, matchupCount]);

  // Bot: pick 3 highest-rated players
  useEffect(() => {
    if (!iAmHost) return;
    for (const s of finalists) {
      if (!isBot(room, s)) continue;
      const current = tb.finalistRosters[String(s)] ?? [];
      if (current.length >= 3) continue;
      const team = seatTeam(room, s);
      const picked = new Set(current.map((p) => p.name));
      const next = team
        .filter((p) => !picked.has(p.name))
        .sort((a, b) => b.rating - a.rating)[0];
      if (!next) continue;
      const t = setTimeout(() => pickFinalistPlayer(getPlayerId(), next.name), 700);
      return () => clearTimeout(t);
    }
  }, [room, tb, finalists, iAmHost]);

  return (
    <div>
      {isTvt && <TvtBracket room={room} me={me} />}
      {(!isTvt || bracketDone) && (
        <div className="py-8 text-center max-w-3xl mx-auto">
          <div className={`text-[10px] uppercase tracking-[0.28em] ${isTvt ? "text-muted-foreground" : "text-emerald-300"}`}>
            {isTvt ? "Team vs Team · Finals" : "Both perfect"}
          </div>
          <h2 className="font-display text-3xl sm:text-4xl mt-2 mb-2">3v3 Finals</h2>
          <p className="text-sm text-muted-foreground mb-8">
            {isTvt
              ? "Top 2 teams clash. Each team picks 3 players. First to 5 wins."
              : "Both teams went perfect. Pick your 3. First to 5 takes it."}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-8">
            {finalists.map((s) => {
              const roster = tb.finalistRosters[String(s)] ?? [];
              return (
                <FinalistRosterSlot
                  key={s}
                  seat={s}
                  name={seatName(room, s)}
                  picks={roster}
                />
              );
            })}
          </div>

          {isFinalist && myRoster.length < 3 && (
            <>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
                Pick your 3 players ({myRoster.length}/3 chosen)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {seatTeam(room, me as SeatN).map((p, i) => {
                  const alreadyPicked = myRoster.some((r) => r.name === p.name);
                  return (
                    <button
                      key={i}
                      onClick={() => !alreadyPicked && pickFinalistPlayer(getPlayerId(), p.name)}
                      disabled={alreadyPicked}
                      className={`p-3 rounded-lg border transition text-left ${
                        alreadyPicked
                          ? "border-foreground/40 bg-foreground/5 opacity-60 cursor-default"
                          : "border-border bg-card hover:border-foreground/40"
                      }`}
                    >
                      <div className="text-sm font-medium leading-tight">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{p.slot} · {p.era}</div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.rating}</div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {isFinalist && myRoster.length >= 3 && finalists.some((s) => (tb.finalistRosters[String(s)]?.length ?? 0) < 3) && (
            <div className="text-sm text-muted-foreground animate-pulse">Waiting for opponent…</div>
          )}

          {!isFinalist && (
            <div className="text-sm text-muted-foreground">Watching the Finals… (view only)</div>
          )}
        </div>
      )}
    </div>
  );
}

function FinalistRosterSlot({ seat, name, picks }: { seat: SeatN; name: string | null; picks: Player[] }) {
  return (
    <div className={`p-4 border rounded-xl ${picks.length >= 3 ? "border-foreground/40 ring-1 " + SEAT_RING[seat] : "border-dashed border-border"}`}>
      <div className="flex items-center gap-2 justify-center mb-3">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[seat]}`} />
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground truncate min-w-0">{name}</div>
      </div>
      <div className="space-y-1.5">
        {[0, 1, 2].map((i) => {
          const p = picks[i];
          return (
            <div key={i} className={`rounded px-2 py-1.5 text-xs text-left ${p ? "bg-background/60" : "border border-dashed border-border opacity-40"}`}>
              {p ? (
                <>
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">{(p as DraftedPlayer).slot ?? ""} · {p.era}</div>
                </>
              ) : (
                <div className="text-muted-foreground">slot {i + 1}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- FINALS (3v3 gameplay) ---------------- */

function Finals({ room, me }: { room: GameRoom; me: SeatN | 0 }) {
  const tb = room.tiebreaker!;
  const finalists = tb.players;
  const isFinalist = finalists.includes(me as SeatN);
  const iAmOffense = tb.offense === me;
  const defenseSeat = finalists.find((s) => s !== tb.offense) as SeatN;
  const iAmDefense = defenseSeat === me;
  const offenseRoster = tb.finalistRosters[String(tb.offense)] ?? [];
  const defenseRoster = tb.finalistRosters[String(defenseSeat)] ?? [];
  const myMoveDone = iAmOffense ? !!tb.offenseMove : iAmDefense ? !!tb.defenseMove : false;
  const iAmHost = me === 1;

  // Bot offense
  useEffect(() => {
    if (!iAmHost) return;
    if (tb.offense === me) return;
    const botOffSeat = finalists.find((s) => isBot(room, s) && s === tb.offense);
    if (!botOffSeat || tb.offenseMove) return;
    const roster = tb.finalistRosters[String(botOffSeat)] ?? [];
    if (!roster.length) return;
    const player = roster[Math.floor(Math.random() * roster.length)];
    const shots = getShotsForPlayer(player.name, (player as DraftedPlayer).slot ?? "SG");
    const shot = shots[Math.floor(Math.random() * shots.length)];
    const t = setTimeout(() => submitOffenseMove(getPlayerId(), player.name, shot), 900 + Math.random() * 600);
    return () => clearTimeout(t);
  }, [room, tb, finalists, iAmHost, me]);

  // Bot defense
  useEffect(() => {
    if (!iAmHost) return;
    const botDefSeat = finalists.find((s) => isBot(room, s) && s === defenseSeat);
    if (!botDefSeat || tb.defenseMove) return;
    const oppRoster = tb.finalistRosters[String(tb.offense)] ?? [];
    if (!oppRoster.length) return;
    const guarded = oppRoster[Math.floor(Math.random() * oppRoster.length)];
    const defType = DEFENSE_TYPES[Math.floor(Math.random() * DEFENSE_TYPES.length)];
    const t = setTimeout(() => submitDefenseMove(getPlayerId(), guarded.name, defType), 900 + Math.random() * 600);
    return () => clearTimeout(t);
  }, [room, tb, finalists, defenseSeat, iAmHost]);

  const lastHistoryLen = useRef(tb.history.length);
  const [lastResult, setLastResult] = useState<(typeof tb.history)[0] | null>(null);
  useEffect(() => {
    if (tb.history.length > lastHistoryLen.current) {
      setLastResult(tb.history[tb.history.length - 1]);
      lastHistoryLen.current = tb.history.length;
    }
  }, [tb.history.length]);

  return (
    <div className="py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-2">
        <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Finals · Round {tb.round}</div>
      </div>

      {/* Scoreboard */}
      <div className="flex items-center justify-center gap-10 mb-8">
        <FinalsScoreCol seat={finalists[0]} name={seatName(room, finalists[0])} score={tb.scores[String(finalists[0])] ?? 0} />
        <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">First to 5</div>
        <FinalsScoreCol seat={finalists[1]} name={seatName(room, finalists[1])} score={tb.scores[String(finalists[1])] ?? 0} />
      </div>

      {/* Last result flash */}
      {lastResult && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-center border animate-flash-in ${
          lastResult.result === "made"
            ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-300"
            : "bg-rose-500/10 border-rose-400/30 text-rose-300"
        }`}>
          <div className="text-sm font-medium">
            {lastResult.offensePlayer} → {lastResult.shotType}
            <span className="ml-2 text-muted-foreground text-xs">({lastResult.outcome})</span>
          </div>
          <div className="text-xs mt-0.5 opacity-80">
            {lastResult.result === "made" ? "MADE 🏀" : "MISSED ✗"}
            {" · "}
            Defense guarded {lastResult.guardedPlayer} · {lastResult.defenseType}
          </div>
        </div>
      )}

      {/* Offense/Defense UI */}
      {isFinalist && !myMoveDone && (
        <div className="mb-6">
          {iAmOffense ? (
            <>
              <div className="text-center mb-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">You're on OFFENSE</div>
                <div className="text-sm text-muted-foreground">Pass to a teammate and pick your shot — defense can't see your choice</div>
              </div>
              <div className="space-y-3">
                {offenseRoster.map((player) => {
                  const shots = getShotsForPlayer(player.name, (player as DraftedPlayer).slot ?? "SG");
                  return (
                    <div key={player.name} className="bg-card border border-border rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-medium ${SEAT_TEXT[tb.offense]}`}>{player.name}</span>
                        <span className="text-[10px] text-muted-foreground">{(player as DraftedPlayer).slot} · {player.era} · {player.rating}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {shots.map((shot) => (
                          <button
                            key={shot}
                            onClick={() => submitOffenseMove(getPlayerId(), player.name, shot)}
                            className="px-2 py-2 rounded-lg border border-border bg-background hover:border-foreground/40 hover:bg-foreground/5 transition text-xs font-medium text-left"
                          >
                            {shot}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : iAmDefense ? (
            <>
              <div className="text-center mb-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">You're on DEFENSE</div>
                <div className="text-sm text-muted-foreground">Guard a player and pick your defensive coverage</div>
              </div>
              <div className="space-y-3">
                {offenseRoster.map((player) => {
                  return (
                    <div key={player.name} className="bg-card border border-border rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-medium ${SEAT_TEXT[tb.offense]}`}>{player.name}</span>
                        <span className="text-[10px] text-muted-foreground">{(player as DraftedPlayer).slot} · {player.era} · {player.rating}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DEFENSE_TYPES.map((defType) => (
                          <button
                            key={defType}
                            onClick={() => submitDefenseMove(getPlayerId(), player.name, defType)}
                            className="px-2 py-2 rounded-lg border border-border bg-background hover:border-foreground/40 hover:bg-foreground/5 transition text-xs font-medium text-left"
                          >
                            <div>{defType}</div>
                            <div className="text-[10px] text-muted-foreground opacity-70">vs {player.name.split(" ")[0]}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      )}

      {isFinalist && myMoveDone && (
        <div className="text-center text-sm text-muted-foreground animate-pulse mb-6">
          {iAmOffense ? "Offense locked in — waiting for defense…" : "Defense locked in — waiting for offense…"}
        </div>
      )}

      {!isFinalist && (
        <div className="text-center text-sm text-muted-foreground mb-6">
          Watching the Finals — view only
        </div>
      )}

      {/* Rosters on each side */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {finalists.map((s) => {
          const roster = tb.finalistRosters[String(s)] ?? [];
          return (
            <div key={s} className={`bg-card border rounded-xl p-3 ${s === tb.offense ? "border-foreground/30" : "border-border"}`}>
              <div className="flex items-center gap-2 mb-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[s]}`} />
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground truncate min-w-0">{seatName(room, s)}</div>
                {s === tb.offense && <span className="ml-auto flex-shrink-0 text-[9px] uppercase tracking-widest text-foreground/60">OFF</span>}
                {s !== tb.offense && <span className="ml-auto flex-shrink-0 text-[9px] uppercase tracking-widest text-muted-foreground">DEF</span>}
              </div>
              <div className="space-y-1">
                {roster.map((p) => (
                  <div key={p.name} className="text-[10px] text-muted-foreground flex items-center gap-1.5 min-w-0">
                    <span className={`w-1 h-1 rounded-full flex-shrink-0 ${SEAT_DOT[s]}`} />
                    <span className="truncate min-w-0">{p.name}</span>
                    <span className="flex-shrink-0 font-mono ml-auto">{p.rating}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Play history */}
      {tb.history.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Play History</div>
          <div className="space-y-1">
            {tb.history.map((h, i) => {
              const offName = seatName(room, h.offense as SeatN) ?? `P${h.offense}`;
              const defSeat = finalists.find((s) => s !== h.offense) as SeatN;
              const defName = seatName(room, defSeat) ?? `P${defSeat}`;
              const madeIt = h.result === "made";
              return (
                <div key={i} className="flex items-center gap-2 bg-card border border-border rounded px-3 py-2 text-xs flex-wrap">
                  <span className="text-muted-foreground font-mono flex-shrink-0">R{h.round}</span>
                  <span className={`font-medium flex-shrink-0 ${SEAT_TEXT[h.offense as SeatN]}`}>{h.offensePlayer}</span>
                  <span className="text-muted-foreground flex-shrink-0">→</span>
                  <span className="flex-shrink-0">{h.shotType}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">({h.outcome})</span>
                  <span className={`ml-auto font-bold flex-shrink-0 ${madeIt ? "text-emerald-300" : "text-rose-300"}`}>
                    {madeIt ? "IN +" : "OUT +"}{seatName(room, h.roundWinner as SeatN)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FinalsScoreCol({ seat, name, score }: { seat: SeatN; name: string | null; score: number }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEAT_DOT[seat]}`} />
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground truncate max-w-[100px]">{name}</div>
      </div>
      <div className="font-mono text-5xl text-foreground">{score}</div>
    </div>
  );
}
