"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleSlash, Cloud, CloudOff, Keyboard, ListChecks, RefreshCw, ScanLine, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera } from "./camera";
import { primeAudio } from "./feedback";
import { useScanner, type ScanResult } from "./use-scanner";

export function Scanner({ eventId, title }: { eventId: string; title: string }) {
  const s = useScanner(eventId);
  const [tab, setTab] = useState<"scan" | "code" | "list">("scan");
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [camOn, setCamOn] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(() => precacheShell())
      .catch(() => {});
  }, []);

  // auto-dismiss result after a few seconds
  useEffect(() => {
    if (!s.last) return;
    const t = setTimeout(s.dismiss, s.last.kind === "ok" ? 2500 : 5000);
    return () => clearTimeout(t);
  }, [s.last, s.dismiss]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = s.manifest?.tickets ?? [];
    const filtered = q ? all.filter((t) => t.holder.toLowerCase().includes(q) || t.code.toLowerCase().includes(q.replace(/\s/g, "")) || t.tier.toLowerCase().includes(q)) : all;
    return filtered.slice(0, 200);
  }, [query, s.manifest]);

  const age = s.manifestAgeMinutes;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/admin/scan" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Events</Link>
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.online ? "bg-grass/15 text-forest dark:text-lime" : "bg-sun/20 text-yellow-800 dark:text-star"}`}>
          {s.online ? <Cloud className="size-3.5" /> : <CloudOff className="size-3.5" />}
          {s.online ? "Online" : "Offline, scans are queued"}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h1 className="truncate text-lg font-semibold">{title}</h1>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Stat label="Checked in" value={s.stats.checkedIn} />
          <Stat label="Issued" value={s.stats.issued} />
          <Stat label="Pending sync" value={s.queueLen} warn={s.queueLen > 0} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{s.manifest ? `Ticket list ${age === 0 ? "just updated" : `${age} min old`}` : "Loading ticket list…"}</span>
          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => { void s.refreshManifest(); void s.sync(); }}>
            <RefreshCw className={`size-3.5 ${s.syncing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {s.serverNotes.length > 0 && (
        <div className="rounded-xl border border-sun/60 bg-sun/15 p-3 text-sm">
          <div className="mb-1 flex items-center gap-1.5 font-medium"><TriangleAlert className="size-4" /> Heads up</div>
          <ul className="list-disc space-y-0.5 pl-5">{s.serverNotes.slice(0, 3).map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-sm">
        {([["scan", "Camera", ScanLine], ["code", "Type code", Keyboard], ["list", "Attendees", ListChecks]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 ${tab === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <div className="relative">
        {tab === "scan" && (
          camOn ? (
            <Camera onText={(t) => void s.handleText(t)} paused={!!s.last} />
          ) : (
            <button type="button" onClick={() => { primeAudio(); setCamOn(true); }} className="grid aspect-[3/4] w-full place-items-center rounded-2xl border-2 border-dashed bg-card sm:aspect-video">
              <span className="flex flex-col items-center gap-2 text-muted-foreground"><ScanLine className="size-10" /><span className="font-medium text-foreground">Tap to start camera</span><span className="text-xs">Works offline once the ticket list is loaded</span></span>
            </button>
          )
        )}
        {tab === "code" && (
          <form
            className="space-y-3 rounded-2xl border bg-card p-4"
            onSubmit={(e) => { e.preventDefault(); primeAudio(); void s.handleCode(code); setCode(""); }}
          >
            <label className="text-sm font-medium" htmlFor="code">Short code from the ticket</label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BBC-7K3M-PX2Q" autoCapitalize="characters" autoComplete="off" className="font-mono text-lg tracking-wider" />
            <Button type="submit" className="w-full" disabled={!code}>Check in</Button>
          </form>
        )}
        {tab === "list" && (
          <div className="space-y-2 rounded-2xl border bg-card p-3">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, code or tier" />
            <ul className="max-h-[60vh] divide-y overflow-y-auto text-sm">
              {list.map((t) => {
                const used = t.status === "used" || !!s.localUsed[t.id];
                return (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.holder}</div>
                      <div className="truncate text-xs text-muted-foreground">{t.tier} · <span className="font-mono">{t.code}</span></div>
                    </div>
                    {t.status === "void" ? <span className="text-xs text-destructive">void</span> : used ? <span className="text-xs text-muted-foreground">in</span> : (
                      <Button size="sm" variant="outline" onClick={() => { primeAudio(); void s.handleCode(t.code); }}>Check in</Button>
                    )}
                  </li>
                );
              })}
              {list.length === 0 && <li className="py-6 text-center text-muted-foreground">No matches</li>}
            </ul>
          </div>
        )}
        {s.last && <ResultOverlay r={s.last} onClose={s.dismiss} />}
      </div>
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

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 ${warn ? "bg-sun/20" : "bg-muted/60"}`}>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function ResultOverlay({ r, onClose }: { r: ScanResult; onClose: () => void }) {
  const cfg = {
    ok: { bg: "bg-grass text-white", Icon: CheckCircle2, title: "Welcome in" },
    duplicate: { bg: "bg-sun text-deep-forest", Icon: TriangleAlert, title: "Already scanned" },
    invalid: { bg: "bg-destructive text-white", Icon: ShieldAlert, title: "Invalid ticket" },
    void: { bg: "bg-destructive text-white", Icon: CircleSlash, title: "Voided ticket" },
    "wrong-event": { bg: "bg-destructive text-white", Icon: ShieldAlert, title: "Wrong event" },
  }[r.kind];
  return (
    <button type="button" onClick={onClose} className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl p-6 text-center ${cfg.bg}`}>
      <cfg.Icon className="size-20" />
      <div className="text-3xl font-bold">{cfg.title}</div>
      {r.ticket && <div className="text-xl font-semibold">{r.ticket.holder}</div>}
      {r.ticket && <div className="text-sm opacity-90">{r.ticket.tier} · {r.ticket.code}</div>}
      {r.detail && <div className="max-w-xs text-sm opacity-90">{r.detail}</div>}
      <div className="mt-2 flex items-center gap-1 text-xs opacity-75"><X className="size-3" /> tap to continue</div>
    </button>
  );
}
