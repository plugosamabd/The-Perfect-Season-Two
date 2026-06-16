import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { roomManager } from "@/lib/p2p";
import { type GameMode } from "@/lib/p2p";
import { findResumableSnapshot } from "@/lib/p2p/room-manager";
import { getPlayerId, getPlayerName, setPlayerName } from "@/lib/identity";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "82-0 — Build the Better Team" },
      { name: "description", content: "Peer-to-peer NBA team builder. Spin, draft, sim. First to a perfect season wins." },
      { property: "og:title", content: "82-0 — Build the Better Team" },
      { property: "og:description", content: "P2P spin, draft, sim. No accounts. Just a code." },
    ],
  }),
  component: Landing,
});

type Mode = "solo" | "create" | "join";

function Landing() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<Mode>("solo");
  const [bots, setBots] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [respins, setRespins] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("classic");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resumeCode, setResumeCode] = useState<string | null>(null);

  useEffect(() => {
    setName(getPlayerName());
    const snap = findResumableSnapshot(getPlayerId());
    if (snap) setResumeCode(snap.code);
  }, []);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) { setErr("Enter your name"); return; }
    setPlayerName(name.trim());
    setBusy(true);
    try {
      const pid = getPlayerId();
      if (mode === "solo") {
        const r = await roomManager.hostSoloRoom(pid, name.trim(), bots, respins, gameMode);
        navigate({ to: "/room/$code", params: { code: r.code } });
      } else if (mode === "create") {
        const r = await roomManager.hostNewRoom(pid, name.trim(), maxPlayers, respins, gameMode);
        navigate({ to: "/room/$code", params: { code: r.code } });
      } else {
        const c = code.trim().toUpperCase();
        if (!c) { setErr("Enter room code"); setBusy(false); return; }
        await roomManager.joinExistingRoom(c, pid, name.trim());
        navigate({ to: "/room/$code", params: { code: c } });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  async function resume() {
    if (!resumeCode) return;
    setBusy(true);
    try {
      await roomManager.resumeRoom(resumeCode);
      navigate({ to: "/room/$code", params: { code: resumeCode } });
    } catch {
      setBusy(false);
    }
  }

  const modes: { id: Mode; label: string; sub: string }[] = [
    { id: "solo", label: "Solo", sub: "vs CPU" },
    { id: "create", label: "Host", sub: "with friends" },
    { id: "join", label: "Join", sub: "with a code" },
  ];

  const showOptions = mode === "solo" || mode === "create";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-muted-foreground mb-6">
            <span className="w-1 h-1 rounded-full bg-foreground/60" />
            Peer-to-peer · no accounts
          </div>
          <h1 className="flex justify-center">
            <Logo className="h-28 sm:h-36 w-auto" />
            <span className="sr-only">82-0</span>
          </h1>
          <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
            Spin for an era and team. Draft five. Sim a season. First to a perfect record wins.
          </p>
        </div>

        {resumeCode && (
          <div className="mb-4 bg-card border border-foreground/30 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Game paused</div>
              <div className="text-sm font-medium mt-0.5">Resume room <span className="font-mono tracking-[0.2em]">{resumeCode}</span></div>
            </div>
            <button
              type="button"
              onClick={resume}
              disabled={busy}
              className="px-3 py-2 rounded-md bg-foreground text-background text-xs font-medium uppercase tracking-wide hover:opacity-90 disabled:opacity-40"
            >
              Resume
            </button>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
          <div className="grid grid-cols-3 gap-1 mb-6 p-1 bg-background rounded-lg border border-border">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`py-2 rounded-md text-sm font-medium transition ${
                  mode === m.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="leading-tight">{m.label}</div>
                <div className={`text-[10px] leading-tight mt-0.5 ${mode === m.id ? "opacity-70" : "opacity-50"}`}>{m.sub}</div>
              </button>
            ))}
          </div>

          <form onSubmit={go} className="space-y-4">
            <Field label="Your name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className="w-full bg-background border border-border rounded-md px-3.5 py-2.5 text-sm focus:border-foreground/40 outline-none"
                placeholder="alex"
              />
            </Field>

            {mode === "solo" && (
              <Field label="CPU opponents">
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setBots(n)}
                      className={`py-2.5 rounded-md border text-sm transition ${
                        bots === n
                          ? "border-foreground/60 bg-foreground/5 text-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      {n} CPU
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {mode === "create" && (
              <>
                <Field label="Room size">
                  <div className="grid grid-cols-3 gap-2">
                    {[2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMaxPlayers(n)}
                        className={`py-2.5 rounded-md border text-sm transition ${
                          maxPlayers === n
                            ? "border-foreground/60 bg-foreground/5 text-foreground"
                            : "border-border text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {n} players
                      </button>
                    ))}
                  </div>
                </Field>
                <p className="text-xs text-muted-foreground">Share the code or link to invite friends. Empty seats can be filled with CPUs.</p>
              </>
            )}

            {showOptions && (
              <Field label="Sim mode">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGameMode("classic")}
                    className={`py-2.5 px-3 rounded-md border text-sm text-left transition ${
                      gameMode === "classic"
                        ? "border-foreground/60 bg-foreground/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <div className="font-medium">82-0</div>
                    <div className="text-[10px] mt-0.5 opacity-70">Classic record sim</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameMode("tvt")}
                    className={`py-2.5 px-3 rounded-md border text-sm text-left transition ${
                      gameMode === "tvt"
                        ? "border-foreground/60 bg-foreground/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <div className="font-medium">Team vs Team</div>
                    <div className="text-[10px] mt-0.5 opacity-70">Round-robin + 1v1 final</div>
                  </button>
                </div>
              </Field>
            )}

            {showOptions && (
              <Field label="Respins per player">
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRespins(n)}
                      className={`py-2.5 rounded-md border text-sm transition ${
                        respins === n
                          ? "border-foreground/60 bg-foreground/5 text-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {mode === "join" && (
              <Field label="Room code">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  className="w-full bg-background border border-border rounded-md px-3.5 py-2.5 text-base font-mono tracking-[0.4em] uppercase focus:border-foreground/40 outline-none"
                  placeholder="ABCD"
                />
              </Field>
            )}

            {err && <div className="text-destructive text-xs">{err}</div>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-md bg-foreground text-background text-sm font-medium tracking-wide uppercase hover:opacity-90 disabled:opacity-40 transition"
            >
              {busy ? "Connecting…" : mode === "solo" ? "Start solo" : mode === "create" ? "Host room" : "Join room"}
            </button>
          </form>
        </div>

        <p className="mt-8 text-[11px] text-muted-foreground text-center tracking-wide">
          Direct peer connection. No server stores your game.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
