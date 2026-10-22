"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera as CameraIcon, ChevronLeft, Keyboard, ListChecks, LogIn, RefreshCw, ScanLine, Volume2, VolumeX } from "lucide-react";
import { undoCheckinAction } from "@/app/admin/attendee-actions";
import { ScanSamples } from "@/components/demo/scan-samples";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { Camera } from "./camera";
import { CodeForm } from "./code-form";
import { ConnPill } from "./conn-pill";
import { primeAudio } from "./feedback";
import { GuestList } from "./guest-list";
import { KIND, ResultOverlay, type UndoState } from "./result-overlay";
import { type ScanKind, type ScanResult, useScanner } from "./use-scanner";
import { stageClass, ViewfinderFrame } from "./viewfinder";

type Tab = "scan" | "code" | "list";

const TABS = [
  { value: "scan", label: "Camera", icon: ScanLine },
  { value: "code", label: "Type code", icon: Keyboard },
  { value: "list", label: "Guest list", icon: ListChecks },
] satisfies { value: Tab; label: string; icon: typeof ScanLine }[];

const iconBtn = "grid size-11 shrink-0 place-items-center rounded-full outline-none hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Door mode. Always Starlit Night whatever the site theme, and it owns the
 * whole viewport (the admin shell renders nothing around this route), so it
 * brings its own back link and safe-area insets.
 */
/** `demo`: adds the sample-ticket panel (demo site only). */
export function Scanner({ eventId, title, backHref, demo = false }: { eventId: string; title: string; backHref: string; demo?: boolean }) {
  const s = useScanner(eventId);
  const [tab, setTab] = useState<Tab>("scan");
  const [camOn, setCamOn] = useState(false);
  const [clearing, setClearing] = useState(false);
  // Undo belongs to one result; keyed by its timestamp so a new scan starts clean
  const [undo, setUndo] = useState<{ at: number; state: UndoState } | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const undoState: UndoState = s.last && undo?.at === s.last.at ? undo.state : "idle";

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(() => precacheShell())
      .catch(() => {});
  }, []);

  // Auto-dismiss: quick for green, longer for anything the door needs to read.
  // Arming undo restarts the clock; the server round trip holds it.
  useEffect(() => {
    if (!s.last || undoState === "busy") return;
    const ms = s.last.kind === "ok" ? 2500 : s.last.kind === "stale" ? 12_000 : 5000;
    const t = setTimeout(s.dismiss, ms);
    return () => clearTimeout(t);
  }, [s.last, s.dismiss, undoState]);

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

  const { dismiss, refreshAll } = s;
  /** Two taps: the first arms it, the second reverses the earlier check-in on the server. */
  const undoLast = useCallback(async (r: ScanResult) => {
    if (!r.ticket) return;
    if (undoState === "idle") { setUndo({ at: r.at, state: "armed" }); return; }
    if (undoState !== "armed") return;
    setUndo({ at: r.at, state: "busy" });
    try {
      const res = await undoCheckinAction(eventId, r.ticket.id);
      if (res.error) throw new Error(res.error);
      toast.success(`Check-in undone. Scan ${r.ticket.holder}'s ticket again to let them in.`);
      dismiss();
      void refreshAll();
    } catch {
      toast.error("Couldn't undo that check-in. No signal?");
      setUndo({ at: r.at, state: "idle" });
    }
  }, [eventId, undoState, dismiss, refreshAll]);

  const age = s.manifestAgeMinutes;
  const stale = age !== null && age >= 5;
  const last = s.last;
  // Undo only reverses a check-in the server already holds; one still queued here would just re-apply on sync
  const canUndo = !!last?.ticket && last.kind === "duplicate" && s.conn === "online" && !s.localUsed[last.ticket.id];

  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-xl flex-col gap-2.5 pt-[env(safe-area-inset-top)] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] lg:max-w-5xl">
        <header className="-mx-2 flex h-14 items-center gap-1.5">
          <Link href={backHref} aria-label="Leave scanner" className={iconBtn}><ChevronLeft className="size-[22px]" strokeWidth={2.2} aria-hidden /></Link>
          <h1 className="min-w-0 flex-1 truncate font-display text-base font-bold">{title}</h1>
          <ConnPill conn={s.conn} />
          <button
            type="button"
            className={cn(iconBtn, "text-muted-foreground hover:text-foreground")}
            aria-label={s.muted ? "Turn sound on" : "Mute sounds"}
            aria-pressed={s.muted}
            onClick={() => void s.toggleMute()}
          >
            {s.muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
          </button>
        </header>

        {/* Phone: status, method, history in one column. Desktop: the method on the left, the rest beside it. */}
        <div className="grid gap-2.5 [grid-template-areas:'status'_'main'_'side'] lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr] lg:gap-x-6 lg:[grid-template-areas:'main_status'_'main_side']">
          <div className="flex min-w-0 flex-col gap-2.5 [grid-area:status]">
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Checked in" value={s.stats.checkedIn} />
              <StatTile label="Tickets" value={s.stats.total} />
              <StatTile label="To sync" value={s.queueLen} warn={s.queueLen > 0} />
            </div>
            <div className={cn("flex items-center justify-between gap-2 text-xs", stale ? "font-medium text-warning-foreground" : "text-muted-foreground")}>
              <span>{s.manifest ? `Ticket list ${age === 0 ? "just updated" : `updated ${age} min ago`}` : s.ready ? "Ticket list not downloaded yet" : "Loading ticket list…"}</span>
              <button
                type="button"
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-1.5 font-semibold outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                onClick={() => void s.refreshAll()}
                disabled={s.refreshing || s.syncing}
              >
                <RefreshCw className={cn("size-3.5", (s.refreshing || s.syncing) && "animate-spin")} aria-hidden /> Refresh
              </button>
            </div>

            {s.conn === "offline" && s.manifest && (
              <div className="rounded-[14px] border-l-4 border-l-warning bg-card px-3.5 py-2.5 text-xs leading-normal text-muted-foreground">
                <span className="font-semibold text-foreground">No signal.</span> Keep scanning;{" "}
                {s.queueLen > 0
                  ? `${s.queueLen} check-in${s.queueLen === 1 ? " is" : "s are"} saved on this phone and will sync`
                  : "check-ins are saved on this phone and sync"}{" "}
                when you&apos;re back online. Don&apos;t close the page.
              </div>
            )}
            {s.conn === "auth" && (
              <Notice
                tone="destructive"
                title="You're signed out on this phone"
                actions={<Button asChild className="h-11 rounded-full px-4"><Link href={`/login?next=${encodeURIComponent(`/admin/scan/${eventId}`)}`}><LogIn /> Sign in again</Link></Button>}
              >
                Keep scanning; check-ins are saved here and sync after you sign in. If you were just removed from the team, ask an organiser.
              </Notice>
            )}
            {s.ready && !s.manifest && s.conn === "offline" && (
              <Notice tone="destructive" title="No ticket list on this phone">Get signal once (Wi-Fi or data) so the list can download. After that, scanning works offline.</Notice>
            )}
            {s.manifest?.status === "cancelled" && <Notice tone="destructive" title="This event was cancelled">All its tickets are voided.</Notice>}
            {s.notes.length > 0 && (
              <Notice tone="warn" title="Heads up from other devices" actions={<Button variant="outline" className="h-11 rounded-full px-4" onClick={s.clearNotes}>Dismiss</Button>}>
                <ul className="list-disc space-y-0.5 pl-4">{s.notes.slice(0, 3).map((n, i) => <li key={i}>{n}</li>)}</ul>
              </Notice>
            )}
            {s.ended && s.queueLen === 0 && s.manifest && (
              <Notice tone="success" title="All scans synced">
                The event is over and every check-in reached the server. You can close this page, or clear the guest list from this phone below.
              </Notice>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2.5 [grid-area:main]">
            <Segmented label="Check-in method" value={tab} onChange={setTab} options={TABS} className="rounded-[14px] [&>button]:rounded-[10px] [&>button]:text-[13px]" />
            <div role="tabpanel" aria-label={TABS.find((t) => t.value === tab)?.label}>
              {tab === "scan" && (
                camOn ? (
                  <Camera onText={(t) => void s.handleText(t)} paused={!!last} />
                ) : (
                  <button
                    type="button"
                    onClick={() => { primeAudio(); setCamOn(true); }}
                    className={cn(stageClass, "block text-fog outline-none focus-visible:ring-3 focus-visible:ring-ring/50")}
                  >
                    <ViewfinderFrame scanning={false} />
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                      <span className="mb-1 grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_8px_rgb(140_198_62/0.18)]">
                        <CameraIcon className="size-7" aria-hidden />
                      </span>
                      <span className="text-lg font-semibold">Tap to start camera</span>
                      <span className="text-xs text-fog/80">Works offline once the ticket list is loaded</span>
                    </span>
                  </button>
                )
              )}
              {tab === "code" && <CodeForm inputRef={codeRef} onSubmit={(code) => { primeAudio(); return s.handleCode(code); }} />}
              {tab === "list" && <GuestList manifest={s.manifest} localUsed={s.localUsed} onCheckin={(code) => { primeAudio(); void s.handleCode(code); }} />}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2.5 [grid-area:side] lg:self-start">
            {demo && <ScanSamples eventId={eventId} onText={(t) => { primeAudio(); void s.handleText(t, { force: true }); }} onCode={(c) => { primeAudio(); void s.handleCode(c); }} />}
            {s.recent.length > 0 && (
              <section aria-labelledby="recent-heading" className="rounded-2xl bg-card px-3.5 py-2.5">
                <h2 id="recent-heading" className="mb-1 font-sans text-xs font-bold tracking-normal text-muted-foreground">Recent on this phone</h2>
                <ul>
                  {s.recent.map((r, i) => {
                    const kind = KIND[r.kind as ScanKind];
                    const code = r.code?.replace(/^BBC-/, "");
                    const lead = r.kind === "ok" ? r.holder : kind?.title ?? r.kind;
                    const rest = (r.kind === "ok" ? [r.tier, code] : [r.holder, code]).filter(Boolean).join(" · ");
                    return (
                      <li key={`${r.at}-${i}`} className="flex items-center gap-2.5 py-1.5 text-[13px]">
                        <span className={cn("size-2 shrink-0 rounded-full", kind?.dot ?? "bg-muted-foreground")} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{lead ?? kind?.title}{rest && <span className="text-muted-foreground"> · {rest}</span>}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{new Date(r.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <footer className="flex min-h-11 items-center justify-between gap-3 pl-1 text-[11px] text-muted-foreground">
              {clearing ? (
                <>
                  <span className="text-xs text-foreground">Clear the guest list from this phone? It downloads again next time you open the scanner.</span>
                  <span className="flex shrink-0 gap-1">
                    <button type="button" className="min-h-11 rounded-full px-3 text-xs font-semibold outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50" onClick={() => setClearing(false)}>Keep it</button>
                    <button
                      type="button"
                      className="min-h-11 rounded-full bg-destructive-soft px-4 text-xs font-semibold text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      onClick={async () => { await s.clearDevice(); setClearing(false); }}
                    >
                      Clear
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <span>Guest names and codes stay on this phone for offline use.</span>
                  <button
                    type="button"
                    disabled={s.queueLen > 0}
                    title={s.queueLen > 0 ? "Sync the waiting check-ins first" : undefined}
                    className="min-h-11 shrink-0 rounded-full px-2 text-xs font-semibold outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                    onClick={() => setClearing(true)}
                  >
                    Clear
                  </button>
                </>
              )}
            </footer>
          </div>
        </div>
      </div>

      {last && (
        <ResultOverlay
          r={last}
          title={title}
          conn={s.conn}
          stats={s.stats}
          hint={last.kind === "invalid" && tab === "scan" && s.manifest ? <>Ask them to open <b>My tickets</b> on the site. A real one has a <span className="font-mono">BBC-XXXX-XXXX</span> code you can type in.</> : undefined}
          onClose={s.dismiss}
          onRetry={last.raw ? () => void s.retryStale(last.raw!) : undefined}
          refreshing={s.refreshing}
          onUndo={canUndo ? () => void undoLast(last) : undefined}
          undo={undoState}
        />
      )}
    </div>
  );
}

/** Same shape the e2e script reads: the number, then its label, as sibling divs. */
function StatTile({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 rounded-[14px] px-3 py-2.5", warn ? "bg-warning-soft text-warning-foreground" : "bg-card")}>
      <div className="font-display text-[26px] font-extrabold leading-none tabular-nums">{value}</div>
      <div className={cn("truncate text-[10px] font-bold uppercase tracking-[0.12em]", !warn && "text-muted-foreground")}>{label}</div>
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
