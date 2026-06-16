import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { teamColor } from "@/data/roster";

type Phase = "idle" | "spinning" | "done";

export interface WheelSlice {
  label: string;
  primary: string;
  accent: string;
}

interface Props {
  slices: WheelSlice[];
  rotation: number | null;     // target rotation in deg
  resultIndex: number | null;  // index of winning slice (for highlight + center label)
  spinKey: number;             // increments every new spin to retrigger animation
  spinning: boolean;
  title?: string;              // e.g. "Team" or "Era"
  onComplete?: () => void;
}

function shorten(label: string): string {
  if (label === "Trail Blazers") return "Blazers";
  if (label === "Timberwolves") return "Wolves";
  if (label === "Mavericks") return "Mavs";
  if (label === "Cavaliers") return "Cavs";
  if (label === "Grizzlies") return "Grizz";
  if (label === "SuperSonics") return "Sonics";
  return label;
}

export function SpinWheel({ slices, rotation, resultIndex, spinKey, spinning, title, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const step = 360 / Math.max(1, slices.length);

  useEffect(() => {
    if (resultIndex == null) { setPhase("idle"); return; }
    if (spinning) { setPhase("spinning"); return; }
    setPhase("done");
    onComplete?.();
    return undefined;
  }, [spinKey, spinning, resultIndex, onComplete]);

  const wheelGradient = useMemo(() => {
    if (slices.length === 0) return "";
    const stops = slices.map((s, i) => `${s.primary} ${i * step}deg ${(i + 1) * step}deg`).join(", ");
    return `conic-gradient(from 0deg, ${stops})`;
  }, [slices, step]);

  const targetRotation = rotation ?? 0;
  const winning = resultIndex != null ? slices[resultIndex] : null;
  const centerText = phase === "done" && winning ? shorten(winning.label) : (title ?? "Spin");

  return (
    <div className="relative mx-auto w-[min(86vw,380px)] aspect-square">
      <div className={`wheel-glow ${phase !== "idle" ? "wheel-glow-strong" : ""}`} />

      <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-30 pointer-pulse">
        <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-white" />
      </div>

      <div className="wheel-3d w-full h-full flex items-center justify-center relative z-10">
        <div
          key={spinKey}
          className={`absolute inset-0 rounded-full ${phase === "spinning" ? "animate-spin-wheel-once" : "wheel-resting"}`}
          style={{
            background: wheelGradient,
            ["--spin-target" as string]: `${phase === "spinning" || phase === "done" ? targetRotation : 0}deg`,
            boxShadow: "inset 0 0 60px rgba(0,0,0,0.55), 0 12px 50px rgba(0,0,0,0.5), 0 0 60px rgba(120,170,255,0.18)",
          } as CSSProperties}
        >
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)" }}
          />

          {/* Radial labels */}
          {slices.map((s, i) => {
            const angle = i * step + step / 2;
            const isResult = phase === "done" && resultIndex === i;
            return (
              <div
                key={`${s.label}-${i}`}
                className="absolute left-1/2 top-1/2 font-semibold leading-none flex items-center justify-end"
                style={{
                  transformOrigin: "0 50%",
                  transform: `rotate(${angle - 90}deg)`,
                  width: "min(38vw, 168px)",
                  height: "min(3.6vw, 16px)",
                  paddingRight: "min(2.6vw, 12px)",
                  paddingLeft: "min(8.5vw, 78px)",
                  color: s.accent,
                  fontSize: slices.length <= 8
                    ? "clamp(11px, 1.6vw, 16px)"
                    : "clamp(9px, 1.25vw, 13px)",
                  textShadow: "0 1px 2px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.55)",
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                  filter: isResult ? "drop-shadow(0 0 8px rgba(255,255,255,0.95))" : undefined,
                }}
              >
                <span className="truncate">{shorten(s.label)}</span>
              </div>
            );
          })}
        </div>

        {/* Center hub */}
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="w-[34%] h-[34%] rounded-full bg-card border border-border flex items-center justify-center text-center px-3 hub-pulse">
            <div className={phase === "done" ? "animate-winner-pop" : ""}>
              <div
                className="font-display text-2xl"
                style={{
                  color: phase === "done" && winning ? winning.accent : "var(--foreground)",
                  textShadow: phase === "done" && winning
                    ? `0 0 18px ${winning.primary}`
                    : undefined,
                }}
              >
                {centerText}
              </div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground leading-tight mt-1">
                {title ?? "Spin"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper for team wheel
export function teamSlices(teams: string[]): WheelSlice[] {
  return teams.map((t) => {
    const c = teamColor(t);
    return { label: t, primary: c.primary, accent: c.accent };
  });
}

// Helper for era wheel — color each era using the chosen team's palette, alternating tint
export function eraSlices(eras: string[], primary: string, accent: string): WheelSlice[] {
  return eras.map((e, i) => ({
    label: e,
    primary: i % 2 === 0 ? primary : mix(primary, "#000000", 0.25),
    accent,
  }));
}

function mix(hex: string, with2: string, t: number): string {
  const a = parseHex(hex), b = parseHex(with2);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function parseHex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
