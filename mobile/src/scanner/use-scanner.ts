import NetInfo from "@react-native-community/netinfo";
import type { Manifest } from "@bbc/shared/scan-types";
import type { Verifier } from "@bbc/shared/token";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { api, ApiError, isSimulatedOffline, subscribeSimulatedOffline } from "@/lib/api";
import { nobleVerifier } from "@/lib/verify";
import { feedback, primeAudio, releaseAudio, setMuted as setFeedbackMuted } from "./feedback";
import {
  decideCode,
  decideText,
  eventEnded,
  NOTES_LIMIT,
  pendingTicketIds,
  queuedFor,
  recentFor,
  stats as countStats,
  TIMEOUT_MS,
  toFeedback,
  type Connection,
  type Decision,
  type LocalUsed,
  type RecentScan,
  type ScanResult,
} from "./logic";
import { store } from "./store";
import { syncDeps, updateBackgroundSync } from "./background-sync";
import { syncQueue } from "./sync";

export type Flash = { id: number; text: string; tone: "success" | "warning" | "danger" };

const isAuthError = (e: unknown) => e instanceof ApiError && (e.status === 401 || e.status === 403);

/**
 * Door mode for one event: the downloaded guest list, local checks, the queue of
 * check-ins and its sync. A port of the web scanner's useScanner with the same
 * rules (see ./logic) and storage keys (see ./store).
 */
export function useScanner(eventId: string) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestAt, setManifestAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [conn, setConn] = useState<Connection>("online");
  const [queueLen, setQueueLen] = useState(0);
  const [localUsed, setLocalUsed] = useState<LocalUsed>({});
  const [last, setLast] = useState<ScanResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [flashes, setFlashes] = useState<Flash[]>([]);

  const verifierRef = useRef<Verifier | null>(null);
  const manifestRef = useRef<Manifest | null>(null);
  const seenTextRef = useRef<Map<string, number>>(new Map());
  const okTicketRef = useRef<Map<string, number>>(new Map());
  const deviceRef = useRef<string>("");
  const syncLock = useRef(false);
  const syncAgain = useRef(false);
  const onlineRef = useRef(true);
  const flashId = useRef(0);

  const flash = useCallback((text: string, tone: Flash["tone"] = "success", ms = 4000) => {
    const id = ++flashId.current;
    setFlashes((f) => [...f, { id, text, tone }].slice(-3));
    setTimeout(() => setFlashes((f) => f.filter((x) => x.id !== id)), ms);
  }, []);

  const applyManifest = useCallback((m: Manifest, fetchedAt: number) => {
    manifestRef.current = m;
    setManifest(m);
    setManifestAt(fetchedAt);
    try {
      verifierRef.current = nobleVerifier(m.publicKey);
    } catch {
      verifierRef.current = null;
    }
  }, []);

  /** Drops local check-ins the server now knows about, so an admin's "undo" isn't masked forever. */
  const pruneLocalUsed = useCallback(() => {
    const pending = pendingTicketIds(store.queue.get(eventId));
    const kept = store.used.update(eventId, (u) => Object.fromEntries(Object.entries(u).filter(([id]) => pending.has(id))));
    setLocalUsed(kept);
  }, [eventId]);

  const refreshManifest = useCallback(async (): Promise<boolean> => {
    setRefreshing(true);
    try {
      const m = await api<Manifest>(`/api/scan/manifest/${eventId}`, { timeoutMs: TIMEOUT_MS });
      store.manifest.set(eventId, m);
      applyManifest(m, Date.now());
      setConn("online");
      pruneLocalUsed();
      return true;
    } catch (e) {
      if (isAuthError(e)) setConn("auth");
      else if (e instanceof ApiError && e.offline) setConn("offline");
      return false;
    } finally {
      setRefreshing(false);
    }
  }, [eventId, applyManifest, pruneLocalUsed]);

  /** One round trip. `stop` ends the loop (empty queue, offline, signed out). */
  const syncOnce = useCallback(async (): Promise<{ refetch: boolean; stop: boolean }> => {
    // Same round trip as the background task (./sync), so the two can't drift
    const r = await syncQueue(eventId, syncDeps);
    setQueueLen(r.remaining);
    if (r.status === "empty") return { refetch: false, stop: true };
    if (r.status === "auth" || r.status === "offline") {
      setConn(r.status);
      return { refetch: false, stop: true };
    }
    setConn("online");
    if (r.notes.length) {
      setNotes((n) => [...r.notes, ...n].slice(0, NOTES_LIMIT));
      for (const n of r.notes) flash(n, "warning", 12_000);
      feedback("warn");
    }
    return { refetch: r.refetch, stop: r.remaining === 0 };
  }, [eventId, flash]);

  /** Single-flight: a call made while syncing sets a flag and the running sync loops once more. */
  const sync = useCallback(async (): Promise<void> => {
    if (syncLock.current) {
      syncAgain.current = true;
      return;
    }
    syncLock.current = true;
    setSyncing(true);
    let refetch = false;
    try {
      do {
        syncAgain.current = false;
        const r = await syncOnce();
        refetch ||= r.refetch;
        if (r.stop && !syncAgain.current) break;
      } while (syncAgain.current);
    } finally {
      syncLock.current = false;
      setSyncing(false);
    }
    // Leaving with scans still queued hands them to the background task; an empty queue turns it off
    void updateBackgroundSync();
    if (refetch) await refreshManifest();
  }, [syncOnce, refreshManifest]);

  useEffect(() => {
    let cancelled = false;
    primeAudio();
    deviceRef.current = store.deviceId();
    const m = store.manifest.get(eventId);
    // Hydrating from this phone's SQLite store when door mode opens is syncing with an external system
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (m) applyManifest(m, new Date(m.version).getTime());
    setQueueLen(store.queue.get(eventId).length);
    setLocalUsed(store.used.get(eventId));
    setRecent(store.recent.get(eventId));
    // Conflicts a background sync found while door mode was closed
    const stored = store.notes.get(eventId);
    if (stored.length) setNotes(stored);
    const mu = store.muted.get();
    setMuted(mu);
    setFeedbackMuted(mu);
    setReady(true);

    // The demo's "force offline" switch counts as no signal, on top of the real one
    let netOnline = true;
    const onConnectivity = () => {
      const online = netOnline && !isSimulatedOffline();
      const was = onlineRef.current;
      onlineRef.current = online;
      if (!online) setConn("offline");
      else if (!was) void refreshManifest().then(() => sync());
    };
    NetInfo.fetch().then((s) => {
      if (cancelled) return;
      netOnline = s.isConnected !== false;
      onlineRef.current = netOnline && !isSimulatedOffline();
      if (!onlineRef.current) return setConn("offline");
      void refreshManifest().then(() => sync());
    });
    const unsubNet = NetInfo.addEventListener((s) => {
      netOnline = s.isConnected !== false;
      onConnectivity();
    });
    const unsubSim = subscribeSimulatedOffline(onConnectivity);
    // Back from the lock screen or another app: catch up
    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active" && onlineRef.current) void sync().then(() => refreshManifest());
    });
    const iv = setInterval(() => {
      if (onlineRef.current) void sync().then(() => refreshManifest());
    }, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      cancelled = true;
      unsubNet();
      unsubSim();
      appSub.remove();
      clearInterval(iv);
      clearInterval(tick);
      releaseAudio();
    };
  }, [eventId, applyManifest, refreshManifest, sync]);

  // ---- core: evaluate locally, queue for the server, give feedback
  const record = useCallback(
    (ticketId: string | null, raw: string, result: ScanResult) => {
      const item = queuedFor(ticketId, raw, result);
      const q = store.queue.update(eventId, (cur) => [...cur, item]);
      setQueueLen(q.length);
      if (result.kind === "ok" && ticketId) {
        okTicketRef.current.set(ticketId, Date.now());
        setLocalUsed(store.used.update(eventId, (cur) => ({ ...cur, [ticketId]: item.scannedAt })));
      }
      setRecent(store.recent.update(eventId, (cur) => [recentFor(result), ...cur]));
      setLast(result);
      feedback(toFeedback(result.kind));
      // Register the background task right away, in case this phone never syncs before leaving
      void updateBackgroundSync();
      void sync();
    },
    [eventId, sync],
  );

  /** Shows a result without queueing it, for problems with this phone rather than the ticket. */
  const showOnly = useCallback((result: ScanResult) => {
    setLast(result);
    feedback(toFeedback(result.kind));
  }, []);

  const apply = useCallback(
    (d: Decision) => {
      if (d.action === "record") record(d.ticketId, d.raw, d.result);
      else if (d.action === "show") showOnly(d.result);
    },
    [record, showOnly],
  );

  const handleText = useCallback(
    async (text: string, opts: { force?: boolean } = {}) => {
      const d = await decideText(
        text,
        {
          eventId,
          manifest: manifestRef.current,
          verifier: verifierRef.current,
          // Read at decision time, not from state: a scan a moment ago must count
          used: store.used.get(eventId),
          seenText: seenTextRef.current,
          okTicket: okTicketRef.current,
        },
        opts,
      );
      apply(d);
    },
    [eventId, apply],
  );

  const handleCode = useCallback(
    (input: string) => {
      apply(decideCode(input, manifestRef.current, store.used.get(eventId)));
    },
    [eventId, apply],
  );

  const retryStale = useCallback(
    async (raw: string) => {
      setLast(null);
      const ok = await refreshManifest();
      if (!ok) flash("Couldn't refresh the list. No signal?", "danger");
      await handleText(raw, { force: true });
    },
    [refreshManifest, handleText, flash],
  );

  const refreshAll = useCallback(async () => {
    await sync();
    const ok = await refreshManifest();
    if (ok) flash("Ticket list updated");
    else flash(onlineRef.current ? "Couldn't reach the server. Scans keep working offline." : "No signal. Scans keep working offline.", "danger");
  }, [sync, refreshManifest, flash]);

  /** Reverses a check-in the server already holds. Two taps are handled by the screen. */
  const undo = useCallback(
    async (ticketId: string, holder: string) => {
      try {
        await api("/api/v1/scan/undo", { body: { eventId, ticketId }, timeoutMs: TIMEOUT_MS });
        flash(`Check-in undone. Scan ${holder}'s ticket again to let them in.`);
        setLast(null);
        void refreshAll();
        return true;
      } catch (e) {
        if (isAuthError(e)) setConn("auth");
        flash("Couldn't undo that check-in. No signal?", "danger");
        return false;
      }
    },
    [eventId, flash, refreshAll],
  );

  const dismiss = useCallback(() => setLast(null), []);
  const clearNotes = useCallback(() => {
    setNotes([]);
    store.notes.update(eventId, () => []);
  }, [eventId]);

  const toggleMute = useCallback(() => {
    const v = !muted;
    setMuted(v);
    setFeedbackMuted(v);
    store.muted.set(v);
  }, [muted]);

  const clearDevice = useCallback(() => {
    if (store.queue.get(eventId).length > 0) {
      flash("Some scans haven't synced yet. Get signal first.", "danger");
      return false;
    }
    store.clear(eventId);
    manifestRef.current = null;
    verifierRef.current = null;
    setManifest(null);
    setManifestAt(null);
    setLocalUsed({});
    setRecent([]);
    setQueueLen(0);
    flash("Ticket list removed from this phone");
    return true;
  }, [eventId, flash]);

  const manifestAgeMinutes = manifestAt ? Math.max(0, Math.round((now - manifestAt) / 60000)) : null;

  return {
    ready,
    manifest,
    manifestAgeMinutes,
    ended: eventEnded(manifest, now),
    conn,
    online: conn === "online",
    queueLen,
    syncing,
    refreshing,
    last,
    notes,
    recent,
    stats: countStats(manifest, localUsed),
    localUsed,
    muted,
    flashes,
    handleText,
    handleCode,
    retryStale,
    refreshAll,
    undo,
    dismiss,
    clearNotes,
    toggleMute,
    clearDevice,
  };
}

export type Scanner = ReturnType<typeof useScanner>;
