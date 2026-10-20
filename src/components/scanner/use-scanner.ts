"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { LocalResult, Manifest, ManifestTicket } from "@/lib/checkins";
import { normalizeShortCode } from "@/lib/tickets/shortcode";
import { importPublicKey, parseToken, verifyTicketSignature } from "@/lib/tickets/token";
import { type FeedbackKind, feedback, setMuted as setFeedbackMuted } from "./feedback";
import { type QueuedCheckin, type RecentScan, store } from "./store";

export type ScanKind = "ok" | "duplicate" | "invalid" | "void" | "wrong-event" | "stale";

export type ScanResult = {
  kind: ScanKind;
  ticket?: ManifestTicket;
  detail?: string;
  at: number;
  /** The scanned payload, kept so a "stale" result can be retried after a refresh. */
  raw?: string;
};

/** online: last request reached the server. offline: it didn't. auth: signed out or no door access. */
export type Connection = "online" | "offline" | "auth";

const TIMEOUT_MS = 8000;
const SAME_TEXT_MS = 3000; // ignore identical frames from the camera
const AFTER_OK_MS = 10_000; // a guest often keeps their phone up after the green screen

const toLocal = (k: ScanKind): LocalResult => (k === "ok" ? "ok" : k === "duplicate" ? "duplicate" : k === "void" ? "void" : "invalid");
const toFeedback = (k: ScanKind): FeedbackKind => (k === "ok" ? "ok" : k === "duplicate" ? "duplicate" : k === "stale" ? "warn" : "invalid");
const time = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "?");

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

export function useScanner(eventId: string) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestAt, setManifestAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [conn, setConn] = useState<Connection>("online");
  const [queueLen, setQueueLen] = useState(0);
  const [localUsed, setLocalUsed] = useState<Record<string, string>>({});
  const [last, setLast] = useState<ScanResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);

  const keyRef = useRef<CryptoKey | null>(null);
  const manifestRef = useRef<Manifest | null>(null);
  const seenTextRef = useRef<Map<string, number>>(new Map());
  const okTicketRef = useRef<Map<string, number>>(new Map());
  const deviceRef = useRef<string>("");
  const syncLock = useRef(false);
  const syncAgain = useRef(false);

  const applyManifest = useCallback(async (m: Manifest, fetchedAt: number) => {
    manifestRef.current = m;
    setManifest(m);
    setManifestAt(fetchedAt);
    keyRef.current = await importPublicKey(m.publicKey);
  }, []);

  /** Drops local check-ins the server now knows about, so an admin's "undo" isn't masked forever. */
  const pruneLocalUsed = useCallback(async () => {
    const q = await store.queue.get(eventId);
    const pending = new Set(q.filter((x) => x.localResult === "ok" && x.ticketId).map((x) => x.ticketId as string));
    const kept = await store.used.update(eventId, (u) => Object.fromEntries(Object.entries(u).filter(([id]) => pending.has(id))));
    setLocalUsed(kept);
  }, [eventId]);

  const refreshManifest = useCallback(async (): Promise<boolean> => {
    setRefreshing(true);
    try {
      const res = await fetchWithTimeout(`/api/scan/manifest/${eventId}`);
      if (res.status === 401 || res.status === 403) { setConn("auth"); return false; }
      if (!res.ok) return false;
      const m = (await res.json()) as Manifest;
      await store.manifest.set(eventId, m);
      await applyManifest(m, Date.now());
      setConn("online");
      await pruneLocalUsed();
      return true;
    } catch {
      setConn("offline");
      return false;
    } finally {
      setRefreshing(false);
    }
  }, [eventId, applyManifest, pruneLocalUsed]);

  /** One round trip. `stop` ends the loop (empty queue, offline, signed out). */
  const syncOnce = useCallback(async (): Promise<{ refetch: boolean; stop: boolean }> => {
    const q = await store.queue.get(eventId);
    setQueueLen(q.length);
    if (q.length === 0) return { refetch: false, stop: true };
    try {
      const res = await fetchWithTimeout("/api/scan/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId,
          deviceId: deviceRef.current,
          checkins: q.map(({ clientId, ticketId, rawPayload, scannedAt, localResult }) => ({ clientId, ticketId, rawPayload, scannedAt, localResult })),
        }),
      });
      if (res.status === 401 || res.status === 403) { setConn("auth"); return { refetch: false, stop: true }; }
      if (!res.ok) return { refetch: false, stop: true };
      setConn("online");
      const { outcomes } = (await res.json()) as { outcomes: { clientId: string; result: string; checkedInAt: string | null; holder?: string }[] };
      let refetch = false;
      const fresh: string[] = [];
      for (const o of outcomes) {
        const local = q.find((x) => x.clientId === o.clientId);
        if (local?.localResult !== "ok") continue;
        const who = o.holder || "A guest";
        if (o.result === "duplicate") fresh.push(`${who} was already let in on another device at ${time(o.checkedInAt)}.`);
        else if (o.result === "void") fresh.push(`${who} was let in, but an organiser had voided that ticket. Check with them.`);
        else if (o.result === "invalid") fresh.push(`A ticket let in at ${time(local.scannedAt)} isn't valid on the server.`);
        if (o.result === "ok") refetch = true;
      }
      // Re-read: scans made while the request was in flight must stay queued
      const done = new Set(outcomes.map((o) => o.clientId));
      const remaining = await store.queue.update(eventId, (cur) => cur.filter((x) => !done.has(x.clientId)));
      setQueueLen(remaining.length);
      if (fresh.length) {
        refetch = true;
        setNotes((n) => [...fresh, ...n].slice(0, 20));
        for (const n of fresh) toast.warning(n, { duration: 12_000 });
        feedback("warn");
      }
      return { refetch, stop: remaining.length === 0 };
    } catch {
      setConn("offline");
      return { refetch: false, stop: true };
    }
  }, [eventId]);

  /** Single-flight: a call made while syncing sets a flag and the running sync loops once more. */
  const sync = useCallback(async (): Promise<void> => {
    if (syncLock.current) { syncAgain.current = true; return; }
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
    if (refetch) await refreshManifest();
  }, [syncOnce, refreshManifest]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      deviceRef.current = await store.deviceId();
      const [m, q, u, r, mu] = await Promise.all([store.manifest.get(eventId), store.queue.get(eventId), store.used.get(eventId), store.recent.get(eventId), store.muted.get()]);
      if (cancelled) return;
      if (m) await applyManifest(m, new Date(m.version).getTime());
      setQueueLen(q.length);
      setLocalUsed(u);
      setRecent(r);
      setMuted(mu);
      setFeedbackMuted(mu);
      setConn(navigator.onLine ? "online" : "offline");
      setReady(true);
      if (navigator.onLine) {
        await refreshManifest();
        await sync();
      }
    })();
    const on = () => { void refreshManifest().then(() => sync()); };
    const off = () => setConn("offline");
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const iv = setInterval(() => { if (navigator.onLine) void sync().then(() => refreshManifest()); }, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => { cancelled = true; window.removeEventListener("online", on); window.removeEventListener("offline", off); clearInterval(iv); clearInterval(tick); };
  }, [eventId, applyManifest, refreshManifest, sync]);

  // ---- core: evaluate locally, queue for the server, give feedback
  const record = useCallback(
    async (ticketId: string | null, raw: string, result: ScanResult) => {
      const item: QueuedCheckin = {
        clientId: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        ticketId,
        rawPayload: raw,
        scannedAt: new Date().toISOString(),
        localResult: toLocal(result.kind),
      };
      const q = await store.queue.update(eventId, (cur) => [...cur, item]);
      setQueueLen(q.length);
      if (result.kind === "ok" && ticketId) {
        okTicketRef.current.set(ticketId, Date.now());
        const u = await store.used.update(eventId, (cur) => ({ ...cur, [ticketId]: item.scannedAt }));
        setLocalUsed(u);
      }
      const entry: RecentScan = { at: result.at, kind: result.kind, holder: result.ticket?.holder, code: result.ticket?.code, tier: result.ticket?.tier };
      const r = await store.recent.update(eventId, (cur) => [entry, ...cur]);
      setRecent(r);
      setLast(result);
      feedback(toFeedback(result.kind));
      void sync();
    },
    [eventId, sync],
  );

  const evaluateTicket = useCallback((t: ManifestTicket, usedMap: Record<string, string>): ScanResult => {
    const at = Date.now();
    if (t.status === "void") return { kind: "void", ticket: t, detail: "An organiser cancelled this ticket. Don't let them in; send them to an organiser.", at };
    if (t.status === "used") return { kind: "duplicate", ticket: t, detail: `First scanned at ${time(t.checkedInAt)}`, at };
    if (usedMap[t.id]) return { kind: "duplicate", ticket: t, detail: `Scanned on this phone at ${time(usedMap[t.id])}`, at };
    return { kind: "ok", ticket: t, at };
  }, []);

  /** Shows a result without queueing it, for problems with this phone rather than the ticket. */
  const showOnly = useCallback((result: ScanResult) => {
    setLast(result);
    feedback(toFeedback(result.kind));
  }, []);

  const handleText = useCallback(
    async (text: string, opts: { force?: boolean } = {}) => {
      const at = Date.now();
      if (!opts.force) {
        const seen = seenTextRef.current.get(text);
        if (seen && at - seen < SAME_TEXT_MS) return;
      }
      seenTextRef.current.set(text, at);

      const parts = parseToken(text);
      if (!parts) return record(null, text, { kind: "invalid", detail: "This isn't a Baguio Base Camp ticket QR.", at });
      const okAt = okTicketRef.current.get(parts.ticketId);
      if (!opts.force && okAt && at - okAt < AFTER_OK_MS) return; // same guest still holding the phone up
      if (!keyRef.current) return showOnly({ kind: "invalid", detail: "The ticket list hasn't downloaded to this phone yet. Get signal once, then try again.", at });
      const sigOk = await verifyTicketSignature(keyRef.current, parts);
      if (!sigOk) return record(null, text, { kind: "invalid", detail: "The signature check failed. This QR may be fake or edited.", at });
      if (parts.eventId !== eventId) return record(null, text, { kind: "wrong-event", detail: "This is a real ticket, but for a different event.", at });
      const t = manifestRef.current?.tickets.find((x) => x.id === parts.ticketId);
      if (!t) return record(parts.ticketId, text, { kind: "stale", raw: text, detail: "Genuine ticket, but it's not in this phone's list yet. It was probably just bought.", at });
      return record(t.id, text, evaluateTicket(t, await store.used.get(eventId)));
    },
    [eventId, evaluateTicket, record, showOnly],
  );

  const handleCode = useCallback(
    async (input: string) => {
      const at = Date.now();
      const code = normalizeShortCode(input);
      if (!code) return showOnly({ kind: "invalid", detail: "Codes look like BBC-XXXX-XXXX (8 letters and numbers).", at });
      if (!manifestRef.current) return showOnly({ kind: "invalid", detail: "The ticket list hasn't downloaded to this phone yet. Get signal once, then try again.", at });
      const t = manifestRef.current.tickets.find((x) => x.code === code);
      if (!t) return record(null, code, { kind: "invalid", detail: `No ticket ${code} for this event. Check for typos, or refresh the list if it was just bought.`, at });
      return record(t.id, code, evaluateTicket(t, await store.used.get(eventId)));
    },
    [eventId, evaluateTicket, record, showOnly],
  );

  const retryStale = useCallback(async (raw: string) => {
    setLast(null);
    const ok = await refreshManifest();
    if (!ok) toast.error("Couldn't refresh the list. No signal?");
    await handleText(raw, { force: true });
  }, [refreshManifest, handleText]);

  const refreshAll = useCallback(async () => {
    await sync();
    const ok = await refreshManifest();
    if (ok) toast.success("Ticket list updated");
    else toast.error(navigator.onLine ? "Couldn't reach the server. Scans keep working offline." : "No signal. Scans keep working offline.");
  }, [sync, refreshManifest]);

  const dismiss = useCallback(() => setLast(null), []);
  const clearNotes = useCallback(() => setNotes([]), []);

  const toggleMute = useCallback(async () => {
    const v = !muted;
    setMuted(v);
    setFeedbackMuted(v);
    await store.muted.set(v);
  }, [muted]);

  const clearDevice = useCallback(async () => {
    if ((await store.queue.get(eventId)).length > 0) {
      toast.error("Some scans haven't synced yet. Get signal first.");
      return false;
    }
    await store.clear(eventId);
    manifestRef.current = null;
    keyRef.current = null;
    setManifest(null);
    setManifestAt(null);
    setLocalUsed({});
    setRecent([]);
    setQueueLen(0);
    toast.success("Ticket list removed from this phone");
    return true;
  }, [eventId]);

  const tickets = manifest?.tickets ?? [];
  const live = tickets.filter((t) => t.status !== "void");
  const stats = {
    total: live.length,
    checkedIn: live.filter((t) => t.status === "used" || (t.status === "valid" && localUsed[t.id])).length,
  };
  const manifestAgeMinutes = manifestAt ? Math.max(0, Math.round((now - manifestAt) / 60000)) : null;
  const ended = manifest ? new Date(manifest.endsAt ?? new Date(manifest.startsAt).getTime() + 6 * 3600e3).getTime() < now : false;

  return {
    ready, manifest, manifestAgeMinutes, ended, conn, online: conn === "online", queueLen, syncing, refreshing, last, notes, recent, stats, localUsed, muted,
    handleText, handleCode, retryStale, refreshAll, dismiss, clearNotes, toggleMute, clearDevice,
  };
}
