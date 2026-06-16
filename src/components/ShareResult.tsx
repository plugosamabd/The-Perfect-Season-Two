import { useMemo, useState } from "react";
import type { GameRoom } from "@/lib/p2p";
import type { Seat } from "@/lib/game";
import { LOGO_URL } from "@/components/Logo";

interface Props {
  room: GameRoom;
  winnerSeat: Seat | 0;
  youWin: boolean;
}

function buildShareText(room: GameRoom, winnerSeat: Seat | 0): string {
  const winnerName =
    winnerSeat > 0 ? room.players.find((p) => p.seat === winnerSeat)?.name ?? "Winner" : "Tie";
  const seats = room.players.map((p) => p.seat).sort((a, b) => a - b);
  const lines = seats.map((s) => {
    const name = room.players.find((p) => p.seat === s)?.name ?? `P${s}`;
    const rec = room.records[s] ?? { wins: 0, losses: 82 };
    const star = s === winnerSeat ? " 🏆" : "";
    const top = (room.teams[s] ?? [])
      .slice(0, 3)
      .map((p) => p.name)
      .join(", ");
    return `${name}${star} — ${rec.wins}-${rec.losses}\n  ${top}`;
  });
  return [
    `82·0 — ${winnerSeat > 0 ? `${winnerName} wins` : "Tie game"}`,
    "",
    ...lines,
    "",
    "Spin. Draft. Sim. Build the better team.",
  ].join("\n");
}

export function ShareResult({ room, winnerSeat, youWin }: Props) {
  const text = useMemo(() => buildShareText(room, winnerSeat), [room, winnerSeat]);
  const url = typeof window !== "undefined" ? window.location.origin : "";
  const [copied, setCopied] = useState<"none" | "text" | "link">("none");

  async function copy(value: string, which: "text" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied("none"), 1500);
    } catch {
      /* noop */
    }
  }

  async function nativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) {
      copy(`${text}\n${url}`, "text");
      return;
    }
    try {
      await navigator.share({ title: "82·0", text, url });
    } catch {
      /* user cancelled */
    }
  }

  function downloadCard() {
    const canvas = document.createElement("canvas");
    const W = 1200;
    const H = 630;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1a1d24");
    grad.addColorStop(1, "#0f1116");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Headline
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 72px Sora, system-ui, sans-serif";
    ctx.textAlign = "center";
    const winnerName =
      winnerSeat > 0
        ? room.players.find((p) => p.seat === winnerSeat)?.name ?? "Winner"
        : "Tie game";
    ctx.fillText(winnerSeat > 0 ? `${winnerName} wins` : "Tie game", W / 2, 140);
    ctx.font = "500 26px Manrope, system-ui, sans-serif";
    ctx.fillStyle = "#9aa3b2";
    ctx.fillText("82·0 — Build the Better Team", W / 2, 184);
    // Player rows
    const seats = room.players.map((p) => p.seat).sort((a, b) => a - b);
    const rowH = 70;
    const startY = 250;
    seats.forEach((s, i) => {
      const name = room.players.find((p) => p.seat === s)?.name ?? `P${s}`;
      const rec = room.records[s] ?? { wins: 0, losses: 82 };
      const y = startY + i * rowH;
      ctx.textAlign = "left";
      ctx.font = "600 32px Manrope, system-ui, sans-serif";
      ctx.fillStyle = s === winnerSeat ? "#86efac" : "#e5e7eb";
      ctx.fillText(`${s === winnerSeat ? "★ " : "  "}${name}`, 160, y);
      ctx.textAlign = "right";
      ctx.font = "700 40px JetBrains Mono, ui-monospace, monospace";
      ctx.fillStyle = s === winnerSeat ? "#86efac" : "#e5e7eb";
      ctx.fillText(`${rec.wins}-${rec.losses}`, W - 160, y + 4);
    });
    // Footer
    ctx.textAlign = "center";
    ctx.font = "500 22px Manrope, system-ui, sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("Spin · Draft · Sim · 82-0", W / 2, H - 50);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `82-0-${room.code}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  }

  const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text}\n${url}`)}`;

  return (
    <div className="mt-8 max-w-xl mx-auto">
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <img src={LOGO_URL} alt="82-0" className="h-8 w-auto" />
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Share your result
            </div>
            <div className="text-sm text-foreground">
              {youWin ? "Bragging rights unlocked." : "Tell the group chat."}
            </div>
          </div>
        </div>
        <pre className="text-left text-xs text-muted-foreground bg-background rounded-lg p-3 border border-border overflow-x-auto whitespace-pre-wrap font-mono">
{text}
        </pre>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <button
            onClick={nativeShare}
            className="py-2.5 rounded-md bg-foreground text-background text-xs font-medium uppercase tracking-wide hover:opacity-90"
          >
            Share
          </button>
          <button
            onClick={() => copy(`${text}\n${url}`, "text")}
            className="py-2.5 rounded-md border border-border text-xs uppercase tracking-wide text-foreground/80 hover:text-foreground hover:border-foreground/30"
          >
            {copied === "text" ? "Copied ✓" : "Copy"}
          </button>
          <a
            href={tweet}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 rounded-md border border-border text-xs uppercase tracking-wide text-foreground/80 hover:text-foreground hover:border-foreground/30 text-center"
          >
            Tweet
          </a>
          <button
            onClick={downloadCard}
            className="py-2.5 rounded-md border border-border text-xs uppercase tracking-wide text-foreground/80 hover:text-foreground hover:border-foreground/30"
          >
            Image
          </button>
        </div>
      </div>
    </div>
  );
}
