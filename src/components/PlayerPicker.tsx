import { useMemo, useState } from "react";
import { teamColor, getPositions, type Player, type Position } from "@/data/roster";

interface Props {
  players: Player[];
  takenKeys: Set<string>;
  canPick: boolean;
  team: string;
  openSlots: Position[];
  onPick: (name: string, position: Position) => void;
}

function playerKey(p: Player) { return `${p.name}|${p.team}|${p.era}`; }

export function PlayerPicker({ players, takenKeys, canPick, team, openSlots, onPick }: Props) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Player | null>(null);
  const colors = teamColor(team);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return ql ? players.filter((p) => p.name.toLowerCase().includes(ql)) : players;
  }, [players, q]);

  const slotsForSelected = selected
    ? getPositions(selected.name).filter((pos) => openSlots.includes(pos))
    : [];

  return (
    <div>
      <div className="relative max-w-sm mx-auto mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players…"
          className="w-full bg-card border border-border rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-foreground/40 placeholder:text-muted-foreground"
        />
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
          {filtered.length}/{players.length}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {filtered.map((p) => {
          const taken = takenKeys.has(playerKey(p));
          const positions = getPositions(p.name);
          const playable = positions.some((pos) => openSlots.includes(pos));
          const disabled = !canPick || taken || !playable;
          return (
            <button
              key={playerKey(p)}
              disabled={disabled}
              onClick={() => setSelected(p)}
              className="group relative overflow-hidden rounded-lg border border-border bg-card text-left transition-all hover:border-foreground/40 hover:-translate-y-0.5 disabled:opacity-30 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
            >
              <div className="h-[2px] w-full" style={{ background: colors.primary }} />
              <div className="p-2.5">
                <div className="text-sm font-medium text-foreground leading-tight">{p.name}</div>
                <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{p.team}</span>
                  <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">· {p.era}</span>
                </div>
                <div className="mt-1.5 flex gap-1 flex-wrap">
                  {positions.map((pos) => (
                    <span
                      key={pos}
                      className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${
                        openSlots.includes(pos)
                          ? "border-foreground/40 text-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {pos}
                    </span>
                  ))}
                </div>
                {taken && <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Drafted</div>}
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">No players match "{q}"</div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-5 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Place at position</div>
            <div className="font-display text-2xl mt-1 mb-4">{selected.name}</div>
            {slotsForSelected.length === 0 ? (
              <div className="text-destructive text-sm mb-4">No open slot for this player's positions.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {slotsForSelected.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => { onPick(selected.name, pos); setSelected(null); }}
                    className="py-3 rounded-md border border-border bg-background hover:border-foreground/40 transition font-medium"
                  >
                    {pos}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setSelected(null)}
              className="w-full py-2 rounded-md bg-background text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
