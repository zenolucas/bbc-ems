"use client";
import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import type { Manifest } from "@/lib/checkins";
import { cn } from "@/lib/utils";

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Wraps case-insensitive matches of `q` in <mark>. */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return text;
  const lower = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, i)) {
    if (at > i) out.push(text.slice(i, at));
    out.push(<mark key={at} className="rounded-[3px] bg-warning-soft text-inherit">{text.slice(at, at + q.length)}</mark>);
    i = at + q.length;
  }
  out.push(text.slice(i));
  return out;
}

const btn = "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-4 text-[13px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Search the downloaded list and check someone in by hand. Every check-in asks
 * for a second tap on the same row, so a slip of the thumb doesn't burn a ticket.
 */
export function GuestList({
  manifest,
  localUsed,
  onCheckin,
}: {
  manifest: Manifest | null;
  localUsed: Record<string, string>;
  onCheckin: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const all = useMemo(() => manifest?.tickets ?? [], [manifest]);
  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return all;
    const codeQ = q.replace(/[\s-]/g, "").replace(/^bbc/, "");
    return all.filter((t) => t.holder.toLowerCase().includes(q) || t.code.toLowerCase().includes(codeQ) || t.tier.toLowerCase().includes(q));
  }, [q, all]);
  const shown = matches.slice(0, 200);
  const live = all.filter((t) => t.status !== "void");
  const notIn = live.filter((t) => t.status === "valid" && !localUsed[t.id]).length;

  return (
    <div className="flex flex-col gap-1.5 rounded-[22px] bg-card px-3.5 py-3">
      <label htmlFor="guest-search" className="sr-only">Search guests</label>
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3.5 size-[18px] text-muted-foreground" aria-hidden />
        <input
          id="guest-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, code or tier"
          autoComplete="off"
          className="h-12 w-full min-w-0 rounded-full border bg-background pl-[42px] pr-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-ring/30"
        />
      </div>
      {manifest && (
        <div className="flex justify-between px-0.5 pt-1 text-xs text-muted-foreground" aria-live="polite">
          <span>{q ? `${matches.length} of ${live.length} match` : `${live.length} guest${live.length === 1 ? "" : "s"}`}</span>
          <span>{notIn} not in yet</span>
        </div>
      )}
      <ul className="mt-1 max-h-[60dvh] overflow-y-auto">
        {shown.map((t, i) => {
          const usedAt = t.status === "used" ? t.checkedInAt : localUsed[t.id] ?? null;
          const used = t.status === "used" || !!localUsed[t.id];
          const isConfirming = confirming === t.id && t.status === "valid" && !used;
          return (
            <li
              key={t.id}
              className={cn(
                "flex min-h-[52px] items-center gap-2.5 py-2.5",
                i > 0 && !isConfirming && "border-t",
                isConfirming && "-mx-3.5 rounded-xl bg-surface-2 px-3.5",
                t.status === "void" && "opacity-60",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className={cn("truncate text-[15px] font-semibold", t.status === "void" && "line-through")}><Highlight text={t.holder} q={q} /></div>
                <div className="truncate text-xs text-muted-foreground"><Highlight text={t.tier} q={q} /> · <span className="font-mono">{t.code}</span></div>
              </div>
              {t.status === "void" ? (
                <span className="text-xs font-semibold text-destructive">Voided</span>
              ) : used ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Check className="size-3" strokeWidth={2.4} aria-hidden /> In{usedAt ? ` · ${time(usedAt)}` : ""}
                </span>
              ) : isConfirming ? (
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" className={cn(btn, "px-3 text-muted-foreground hover:text-foreground")} onClick={() => setConfirming(null)}>Cancel</button>
                  <button
                    type="button"
                    autoFocus
                    aria-label={`Confirm check-in for ${t.holder}`}
                    className={cn(btn, "bg-primary text-primary-foreground hover:bg-primary/85")}
                    onClick={() => { setConfirming(null); onCheckin(t.code); }}
                  >
                    Confirm
                  </button>
                </div>
              ) : (
                <button type="button" className={cn(btn, "border text-foreground hover:bg-surface-2")} onClick={() => setConfirming(t.id)}>Check in</button>
              )}
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{manifest ? "No matches" : "Ticket list not loaded"}</li>}
      </ul>
      {matches.length > shown.length && <p className="text-center text-xs text-muted-foreground">Showing the first {shown.length}. Search to narrow it down.</p>}
      <p className="mt-auto pt-2.5 text-center text-xs text-muted-foreground">
        Checking in from the list asks you to confirm, so a slip of the thumb doesn&apos;t burn a ticket.
      </p>
    </div>
  );
}
