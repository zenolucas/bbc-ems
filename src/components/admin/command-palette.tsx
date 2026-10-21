"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, CornerDownLeft, Loader2, Plus, Receipt, Search, UserRound, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/event/status-badge";
import { cn } from "@/lib/utils";
import { type AdminEventRef, navFor } from "./nav";

type Hit = { id: string; group: string; label: string; detail?: string; href: string; icon: LucideIcon; status?: string };
type Remote = { bookings: { id: string; eventId: string; eventTitle: string; name: string; email: string; status: string; amount: string }[]; people: { id: string; name: string; email: string; detail: string; href: string }[] };

const EMPTY: Remote = { bookings: [], people: [] };

/**
 * ⌘K: jump to an event, a booking or a person, or start a new event. Events are
 * filtered locally (the layout already has them); bookings and people come from
 * /admin/search once there are two characters to go on. Arrow keys move, Enter
 * opens, Escape closes.
 */
export function CommandPalette({ open, onOpenChange, events, demoSite = false }: { open: boolean; onOpenChange: (open: boolean) => void; events: AdminEventRef[]; demoSite?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<{ q: string; data: Remote } | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const term = q.trim().toLowerCase();
  const wantsRemote = term.length >= 2;
  const loading = wantsRemote && remote?.q !== term;

  useEffect(() => {
    if (!open || !wantsRemote) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/admin/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : EMPTY))
        .then((data: Remote) => setRemote({ q: term, data }))
        .catch(() => {});
    }, 150);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [open, term, wantsRemote]);

  const hits = useMemo<Hit[]>(() => {
    const match = (s: string) => !term || s.toLowerCase().includes(term);
    const actions: Hit[] = [
      { id: "new", group: "Actions", label: "New event", detail: "Saved as a hidden draft", href: "/admin/events/new", icon: Plus },
      ...navFor({ role: "admin", demoSite }).map((n) => ({ id: `go-${n.key}`, group: "Actions", label: `Go to ${n.label.toLowerCase()}`, href: n.href, icon: n.icon })),
    ].filter((h) => match(h.label));
    const ev: Hit[] = events
      .filter((e) => match(e.title))
      .slice(0, term ? 6 : 4)
      .map((e) => ({ id: `ev-${e.id}`, group: "Events", label: e.title, href: `/admin/events/${e.id}`, icon: CalendarDays, status: e.status }));
    const data = remote?.q === term ? remote.data : EMPTY;
    const bk: Hit[] = wantsRemote
      ? data.bookings.map((b) => ({ id: `bk-${b.id}`, group: "Bookings", label: `${b.name || b.email} · ${b.amount}`, detail: `${b.eventTitle} · ${b.id}`, href: `/admin/events/${b.eventId}/bookings?show=all#${b.id}`, icon: Receipt, status: b.status }))
      : [];
    const ppl: Hit[] = wantsRemote ? data.people.map((p) => ({ id: `pp-${p.id}`, group: "People", label: p.name || p.email, detail: p.detail, href: p.href, icon: UserRound })) : [];
    // Actions lead when the box is empty; once you type, the things you're looking for do
    return term ? [...ev, ...bk, ...ppl, ...actions] : [...actions.slice(0, 1), ...ev, ...actions.slice(1)];
  }, [demoSite, events, remote, term, wantsRemote]);

  const current = Math.min(active, Math.max(0, hits.length - 1));

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  function go(h: Hit | undefined) {
    if (!h) return;
    onOpenChange(false);
    router.push(h.href);
  }

  function reset(o: boolean) {
    if (!o) { setQ(""); setActive(0); }
    onOpenChange(o);
  }

  let lastGroup = "";
  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent showCloseButton={false} className="top-[12vh] translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search or jump to</DialogTitle>
        <DialogDescription className="sr-only">Events, bookings and people. Use the arrow keys to move and Enter to open.</DialogDescription>
        <div className="flex items-center gap-2.5 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={hits[current] ? `${listId}-${current}` : undefined}
            aria-label="Search or jump to"
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (Math.min(i, hits.length - 1) + 1) % Math.max(1, hits.length)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (Math.min(i, hits.length - 1) - 1 + hits.length) % Math.max(1, hits.length)); }
              else if (e.key === "Enter") { e.preventDefault(); go(hits[current]); }
            }}
            placeholder="Jump to an event, booking or person…"
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Searching" /> : <kbd className="rounded-md border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">Esc</kbd>}
        </div>
        <ul id={listId} ref={listRef} role="listbox" aria-label="Results" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {hits.length === 0 && !loading && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing matches “{q.trim()}”. Try a name, email, booking ID or GCash reference.</li>}
          {hits.map((h, i) => {
            const header = h.group !== lastGroup ? h.group : null;
            lastGroup = h.group;
            return (
              <li key={h.id} role="presentation">
                {header && <div className="bbc-eyebrow px-3 pt-3 pb-1.5 text-muted-foreground" aria-hidden>{header}</div>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === current}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(h)}
                  className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2", i === current && "bg-surface-2")}
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground", i === current && "bg-card text-foreground")}>
                    <h.icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{h.label}</span>
                    {h.detail && <span className="block truncate text-xs text-muted-foreground">{h.detail}</span>}
                  </span>
                  {h.status && <StatusBadge status={h.status} admin className="hidden sm:inline-flex" />}
                  {i === current && <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
