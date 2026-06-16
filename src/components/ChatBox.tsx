import { useEffect, useRef, useState } from "react";
import { useP2PStore, gameSync, type ChatMessage } from "@/lib/p2p";
import type { Seat } from "@/lib/game";

const SEAT_DOT: Record<number, string> = {
  1: "bg-team-one",
  2: "bg-team-two",
  3: "bg-accent-1",
  4: "bg-accent-2",
};

interface Props {
  myId: string;
  myName: string;
  mySeat: Seat | 0;
}

export function ChatBox({ myId, myName, mySeat }: Props) {
  const messages = useP2PStore((s) => s.messages);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const m = text.trim();
    if (!m || !myName) return;
    setText("");
    const msg: ChatMessage = {
      id: `${myId}-${Date.now()}`,
      playerId: myId,
      playerName: myName,
      playerSeat: (mySeat || null) as Seat | null,
      message: m.slice(0, 280),
      timestamp: Date.now(),
    };
    gameSync.sendChat(msg);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-30 px-3.5 py-2 rounded-full bg-card border border-border text-sm text-foreground/80 hover:text-foreground hover:border-foreground/30 transition"
      >
        Chat{messages.length > 0 && <span className="ml-2 text-xs text-muted-foreground">{messages.length}</span>}
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-30 md:w-80 bg-card/95 backdrop-blur border border-border rounded-xl shadow-xl flex flex-col"
      style={{ height: "min(380px, 50vh)", maxWidth: "calc(100vw - 2rem)" }}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Chat</div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-2 space-y-2 text-sm">
        {messages.length === 0 && (
          <div className="text-muted-foreground text-xs text-center py-8">No messages yet.</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="leading-snug">
            <span className="inline-flex items-center gap-1.5">
              {m.playerSeat && <span className={`inline-block w-1.5 h-1.5 rounded-full ${SEAT_DOT[m.playerSeat]}`} />}
              <span className="font-medium text-foreground">{m.playerName}</span>
            </span>
            <span className="text-foreground/80"> {m.message}</span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="border-t border-border p-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={280}
          placeholder={myName ? "Message…" : "Set your name first"}
          disabled={!myName}
          className="flex-1 bg-background border border-border rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-foreground/30"
        />
        <button
          type="submit"
          disabled={!text.trim() || !myName}
          className="px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-medium tracking-wide uppercase disabled:opacity-30 hover:opacity-90"
        >
          Send
        </button>
      </form>
    </div>
  );
}
