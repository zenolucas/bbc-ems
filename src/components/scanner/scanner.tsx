"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, CheckCircle2, CircleSlash, Cloud, CloudOff, Keyboard, ListChecks, Loader2, LogIn, RefreshCw, ScanLine,
  ShieldAlert, TriangleAlert, Volume2, VolumeX, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/utils";
import { Camera } from "./camera";
import { primeAudio } from "./feedback";
import { type ScanKind, type ScanResult, useScanner } from "./use-scanner";

type Tab = "scan" | "code" | "list";

/** Formats as the user types: BBC-XXXX-XXXX. */
function formatCode(v: string) {
  const raw = v.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^BBC/, "").slice(0, 8);
  if (!raw) return v.toUpperCase().startsWith("B") ? v.toUpperCase().slice(0, 3) : "";
  return `BBC-${raw.slice(0, 4)}${raw.length > 4 ? `-${raw.slice(4)}` : ""}`;
}

export function Scanner({ eventId, title, backHref }: { eventId: string; title: string; backHref: string }) {
  const s = useScanner(eventId);
  const [tab, setTab] = useState<Tab>("scan");
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [camOn, setCamOn] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(() => precacheShell())
      .catch(() => {});
  }, []);

  // Auto-dismiss: quick for green, longer for anything the door needs to read
  useEffect(() => {
    if (!s.last) return;
    const ms = s.last.kind === "ok" ? 2500 : s.last.kind === "stale" ? 12_000 : 5000;
    const t = setTimeout(s.dismiss, ms);
    return () => clearTimeout(t);
  }, [s.last, s.dismiss]);

  // Back to the code box after a typed check-in
  useEffect(() => {
    if (!s.last && tab === "code") codeRef.current?.focus();
  }, [s.last, tab]);

  // Don't let the phone close the page with check-ins only stored here
  useEffect(() => {
    if (s.queueLen === 0) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [s.queueLen]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = s.manifest?.tickets ?? [];
    const filtered = q ? all.filter((t) => t.holder.toLowerCase().includes(q) || t.code.toLowerCase().includes(q.replace(/[\s-]/g, "").replace(/^bbc/, "")) || t.tier.toLowerCase().includes(q)) : all;
    return filtered.slice(0, 200);
  }, [query, s.manifest]);

  const age = s.manifestAgeMinutes;
  const stale = age !== null && age >= 5;
  const ended = s.ended;

  return (
    // Door mode: covers the admin chrome so the camera and results get the whole screen
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-xl space-y-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Leave scanner"><Link href={backHref}><ArrowLeft /></Link></Button>
          <h1 className="min-w-0 flex-1 truncate font-semibold">{title}</h1>
          <ConnPill conn={s.conn} />
          <Button variant="ghost" size="icon" aria-label={s.muted ? "Turn sound on" : "Mute sounds"} aria-pressed={s.muted} onClick={() => void s.toggleMute()}>
            {s.muted ? <VolumeX /> : <Volume2 />}
          </Button>
        </header>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Checked in" value={s.stats.checkedIn} />
          <Stat label="Tickets" value={s.stats.total} />
          <Stat label="To sync" value={s.queueLen} warn={s.queueLen > 0} />
        </div>
        <div className={cn("flex items-center justify-between text-xs", stale ? "font-medium text-yellow-800 dark:text-star" : "text-muted-foreground")}>
          <span>{s.manifest ? `Ticket list ${age === 0 ? "just updated" : `updated ${age} min ago`}` : s.ready ? "Ticket list not downloaded yet" : "Loading ticket list…"}</span>
          <button type="button" className="inline-flex min-h-9 items-center gap-1 px-1 hover:text-foreground" onClick={() => void s.refreshAll()} disabled={s.refreshing || s.syncing}>
            <RefreshCw className={cn("size-3.5", (s.refreshing || s.syncing) && "animate-spin")} aria-hidden /> Refresh
          </button>
        </div>

        {s.conn === "auth" && (
          <Notice tone="destructive" title="You're signed out on this phone" actions={<Button asChild size="sm"><Link href={`/login?next=${encodeURIComponent(`/admin/scan/${eventId}`)}`}><LogIn /> Sign in again</Link></Button>}>
            Keep scanning; check-ins are saved here and sync after you sign in. If you were just removed from the team, ask an organiser.
          </Notice>
        )}
        {s.ready && !s.manifest && s.conn === "offline" && (
          <Notice tone="destructive" title="No ticket list on this phone">Get signal once (Wi-Fi or data) so the list can download. After that, scanning works offline.</Notice>
        )}
        {s.manifest?.status === "cancelled" && <Notice tone="destructive" title="This event was cancelled">All its tickets are voided.</Notice>}
        {s.notes.length > 0 && (
          <Notice tone="warn" title="Heads up from other devices" actions={<Button size="sm" variant="outline" onClick={s.clearNotes}>Dismiss</Button>}>
            <ul className="list-disc space-y-0.5 pl-4">{s.notes.slice(0, 3).map((n, i) => <li key={i}>{n}</li>)}</ul>
          </Notice>
        )}
        {ended && s.queueLen === 0 && s.manifest && (
          <Notice tone="success" title="All scans synced">
            The event is over and every check-in reached the server. You can close this page, or clear the guest list from this phone below.
          </Notice>
        )}

        <div role="tablist" aria-label="Check-in method" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-sm">
          {([["scan", "Camera", ScanLine], ["code", "Type code", Keyboard], ["list", "Guest list", ListChecks]] as const).map(([k, label, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={cn("flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2", tab === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {tab === "scan" && (
            camOn ? (
              <Camera onText={(t) => void s.handleText(t)} paused={!!s.last} />
            ) : (
              <button type="button" onClick={() => { primeAudio(); setCamOn(true); }} className="grid aspect-[4/5] w-full place-items-center rounded-2xl border-2 border-dashed bg-card sm:aspect-video">
                <span className="flex flex-col items-center gap-2 text-muted-foreground"><ScanLine className="size-10" aria-hidden /><span className="text-lg font-medium text-foreground">Tap to start camera</span><span className="text-xs">Works offline once the ticket list is loaded</span></span>
              </button>
            )
          )}
          {tab === "code" && (
            <form
              className="space-y-3 rounded-2xl border bg-card p-4"
              onSubmit={(e) => { e.preventDefault(); primeAudio(); void s.handleCode(code).then(() => setCode("")); }}
            >
              <label className="text-sm font-medium" htmlFor="code">Code printed under the QR</label>
              <Input
                id="code"
                ref={codeRef}
                value={code}
                onChange={(e) => setCode(formatCode(e.target.value))}
                placeholder="BBC-7K3M-PX2Q"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                inputMode="text"
                className="h-12 font-mono text-xl tracking-wider"
              />
              <Button type="submit" size="lg" className="w-full" disabled={code.replace(/[^0-9A-Z]/g, "").length < 11}>Check in</Button>
              <p className="text-xs text-muted-foreground">O and 0, I and 1 are treated the same.</p>
            </form>
          )}
          {tab === "list" && (
            <div className="space-y-2 rounded-2xl border bg-card p-3">
              <label htmlFor="guest-search" className="sr-only">Search guests</label>
              <Input id="guest-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, code or tier" autoComplete="off" />
              <ul className="max-h-[60vh] divide-y overflow-y-auto text-sm">
                {list.map((t) => {
                  const used = t.status === "used" || !!s.localUsed[t.id];
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{t.holder}</div>
                        <div className="truncate text-xs text-muted-foreground">{t.tier} · <span className="font-mono">{t.code}</span></div>
                      </div>
                      {t.status === "void" ? <span className="text-xs font-medium text-destructive">Voided</span> : used ? <span className="text-xs text-muted-foreground">Checked in</span> : confirming === t.id ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button>
                          <Button size="sm" onClick={() => { primeAudio(); setConfirming(null); void s.handleCode(t.code); }}>Confirm</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setConfirming(t.id)}>Check in</Button>
                      )}
                    </li>
                  );
                })}
                {list.length === 0 && <li className="py-6 text-center text-muted-foreground">{s.manifest ? "No matches" : "Ticket list not loaded"}</li>}
              </ul>
            </div>
          )}
        </div>

        {s.recent.length > 0 && (
          <section aria-labelledby="recent-heading" className="rounded-2xl border bg-card p-3">
            <h2 id="recent-heading" className="mb-1 text-sm font-medium">Recent scans on this phone</h2>
            <ul className="divide-y text-sm">
              {s.recent.map((r, i) => (
                <li key={`${r.at}-${i}`} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <KindDot kind={r.kind as ScanKind} />
                    <span className="truncate">{r.holder ?? KIND[r.kind as ScanKind]?.title ?? r.kind}{r.code && <span className="text-muted-foreground"> · {r.code}</span>}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(r.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span>Guest names and codes are stored on this phone for offline use.</span>
          <ConfirmDialog
            title="Clear the guest list from this phone?"
            description={s.queueLen > 0 ? "Some check-ins haven't synced yet. Get signal first, otherwise they'll be lost." : "The list downloads again next time you open the scanner."}
            confirmLabel="Clear"
            destructive
            onConfirm={async () => { await s.clearDevice(); }}
            trigger={(open) => <Button size="sm" variant="ghost" onClick={open} disabled={s.queueLen > 0}>Clear</Button>}
          />
        </section>
      </div>

      {s.last && <ResultOverlay r={s.last} onClose={s.dismiss} onRetry={s.last.raw ? () => void s.retryStale(s.last!.raw!) : undefined} refreshing={s.refreshing} />}
    </div>
  );
}

/** The first visit happens before the service worker controls the page, so cache
 * this page and the assets it already loaded by hand. Later visits go through the SW. */
async function precacheShell() {
  try {
    const shell = await caches.open("bbc-sw-v1-shell");
    await shell.add(new Request(location.pathname, { credentials: "same-origin" }));
    const statics = await caches.open("bbc-sw-v1-static");
    const urls = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((u) => u.startsWith(location.origin + "/_next/static/") || u.startsWith(location.origin + "/brand/"));
    await Promise.all(urls.map((u) => statics.add(u).catch(() => {})));
  } catch {
    /* cache unavailable (private mode etc.) */
  }
}

function ConnPill({ conn }: { conn: "online" | "offline" | "auth" }) {
  const cfg = {
    online: { cls: "bg-grass/15 text-forest dark:text-lime", Icon: Cloud, label: "Online" },
    offline: { cls: "bg-sun/25 text-yellow-800 dark:text-star", Icon: CloudOff, label: "Offline · saving here" },
    auth: { cls: "bg-destructive/15 text-destructive", Icon: LogIn, label: "Signed out" },
  }[conn];
  return (
    <span role="status" className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", cfg.cls)}>
      <cfg.Icon className="size-3.5" aria-hidden /> {cfg.label}
    </span>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={cn("rounded-lg px-2 py-1.5", warn ? "bg-sun/25" : "bg-muted/60")}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

const KIND: Record<ScanKind, { bg: string; dot: string; Icon: typeof CheckCircle2; title: string }> = {
  ok: { bg: "bg-grass text-white", dot: "bg-grass", Icon: CheckCircle2, title: "Welcome in" },
  duplicate: { bg: "bg-sun text-deep-forest", dot: "bg-sun", Icon: TriangleAlert, title: "Already scanned" },
  stale: { bg: "bg-sun text-deep-forest", dot: "bg-sun", Icon: RefreshCw, title: "Not in list yet" },
  invalid: { bg: "bg-destructive text-white", dot: "bg-destructive", Icon: ShieldAlert, title: "Invalid ticket" },
  void: { bg: "bg-destructive text-white", dot: "bg-destructive", Icon: CircleSlash, title: "Voided ticket" },
  "wrong-event": { bg: "bg-destructive text-white", dot: "bg-destructive", Icon: ShieldAlert, title: "Wrong event" },
};

function KindDot({ kind }: { kind: ScanKind }) {
  return <span className={cn("size-2.5 shrink-0 rounded-full", KIND[kind]?.dot ?? "bg-muted")} aria-hidden />;
}

function ResultOverlay({ r, onClose, onRetry, refreshing }: { r: ScanResult; onClose: () => void; onRetry?: () => void; refreshing: boolean }) {
  const cfg = KIND[r.kind];
  return (
    <div role="alertdialog" aria-live="assertive" aria-label={cfg.title} className={cn("fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 p-6 text-center", cfg.bg)} onClick={onClose}>
      <cfg.Icon className="size-24" aria-hidden />
      <div className="text-4xl font-bold">{cfg.title}</div>
      {r.ticket && <div className="text-2xl font-semibold">{r.ticket.holder}</div>}
      {r.ticket && <div className="text-base opacity-90">{r.ticket.tier} · <span className="font-mono">{r.ticket.code}</span></div>}
      {r.detail && <div className="max-w-sm text-base opacity-90">{r.detail}</div>}
      {onRetry && (
        <Button size="lg" variant="secondary" className="mt-2" disabled={refreshing} onClick={(e) => { e.stopPropagation(); onRetry(); }}>
          {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh list and retry
        </Button>
      )}
      <button type="button" onClick={onClose} className="mt-4 flex min-h-11 items-center gap-1 rounded-full px-4 text-sm opacity-80"><X className="size-4" aria-hidden /> Tap anywhere to continue</button>
    </div>
  );
}
