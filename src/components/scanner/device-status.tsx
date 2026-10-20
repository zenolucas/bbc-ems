"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { relative } from "@/lib/format";
import { store } from "./store";

type State = { listAt: string | null; queued: number };

/**
 * What this phone holds for an event: whether the guest list is downloaded and
 * how many scans still wait to sync. Read from IndexedDB after mount, so the
 * server render is a same-height placeholder.
 */
export function DeviceStatus({ eventId, ended, variant }: { eventId: string; ended?: boolean; variant: "card" | "inline" }) {
  const [s, setS] = useState<State | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([store.manifest.get(eventId), store.queue.get(eventId)])
      .then(([m, q]) => { if (!cancelled) setS({ listAt: m?.version ?? null, queued: q.length }); })
      .catch(() => { if (!cancelled) setS({ listAt: null, queued: 0 }); });
    return () => { cancelled = true; };
  }, [eventId]);

  if (!s) return <span className="invisible">List not downloaded yet</span>;

  if (s.queued > 0) {
    return <span className="font-semibold text-warning-foreground">{s.queued} scan{s.queued === 1 ? "" : "s"} waiting to sync</span>;
  }
  if (variant === "inline") {
    if (!s.listAt) return <span>list not downloaded yet</span>;
    return <span>{ended ? "all scans synced" : "list on this phone"}</span>;
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Download className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{s.listAt ? `List on this phone · updated ${relative(s.listAt)}` : "List not downloaded yet"}</span>
    </span>
  );
}
