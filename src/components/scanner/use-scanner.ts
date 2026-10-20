"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Manifest, ManifestTicket } from "@/lib/checkins";
import { normalizeShortCode } from "@/lib/tickets/shortcode";
import { importPublicKey, parseToken, verifyTicketSignature } from "@/lib/tickets/token";
import { feedback } from "./feedback";
import { type QueuedCheckin, store } from "./store";

export type ScanResult = {
  kind: "ok" | "duplicate" | "invalid" | "void" | "wrong-event";
  ticket?: ManifestTicket;
  detail?: string;
  at: number;
};

export function useScanner(eventId: string) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestAge, setManifestAge] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(true);
  const [queueLen, setQueueLen] = useState(0);
  const [localUsed, setLocalUsed] = useState<Record<string, string>>({});
  const [last, setLast] = useState<ScanResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [serverNotes, setServerNotes] = useState<string[]>([]);
  const keyRef = useRef<CryptoKey | null>(null);
  const recentRef = useRef<Map<string, number>>(new Map());
  const deviceRef = useRef<string>("");

  // ---- load cached state, then refresh from network
  const refreshManifest = useCallback(async () => {
    try {
      const res = await fetch(`/api/scan/manifest/${eventId}`, { cache: "no-store" });
      if (!res.ok) return false;
      const m = (await res.json()) as Manifest;
      await store.manifest.set(eventId, m);
      setManifest(m);
      setManifestAge(Date.now());
      keyRef.current = await importPublicKey(m.publicKey);
      return true;
    } catch {
      return false;
    }
  }, [eventId]);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const q = await store.queue.get(eventId);
    if (q.length === 0) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/scan/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId,
          deviceId: deviceRef.current,
          checkins: q.map(({ clientId, ticketId, rawPayload, scannedAt }) => ({ clientId, ticketId, rawPayload, scannedAt })),
        }),
      });
      if (!res.ok) return;
      const { outcomes } = (await res.json()) as { outcomes: { clientId: string; result: string; checkedInAt: string | null; holder?: string }[] };
      const notes: string[] = [];
      for (const o of outcomes) {
        const local = q.find((x) => x.clientId === o.clientId);
        if (local?.localResult === "ok" && o.result === "duplicate") {
          notes.push(`${o.holder ?? "A ticket"} was already scanned on another device at ${o.checkedInAt ? new Date(o.checkedInAt).toLocaleTimeString() : "?"}.`);
        }
      }
      const done = new Set(outcomes.map((o) => o.clientId));
      await store.queue.set(eventId, q.filter((x) => !done.has(x.clientId)));
      setQueueLen(q.length - done.size);
      if (notes.length) setServerNotes((n) => [...notes, ...n].slice(0, 20));
      await refreshManifest();
    } catch {
      /* stay queued */
    } finally {
      setSyncing(false);
    }
  }, [eventId, refreshManifest]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      deviceRef.current = await store.deviceId();
      const [m, q, u] = await Promise.all([store.manifest.get(eventId), store.queue.get(eventId), store.used.get(eventId)]);
      if (cancelled) return;
      if (m) {
        setManifest(m);
        setManifestAge(new Date(m.version).getTime());
        keyRef.current = await importPublicKey(m.publicKey);
      }
      setQueueLen(q.length);
      setLocalUsed(u);
      setOnline(navigator.onLine);
      await refreshManifest();
      await sync();
    })();
    const on = () => { setOnline(true); void sync(); void refreshManifest(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const iv = setInterval(() => { if (navigator.onLine) { void sync(); void refreshManifest(); } }, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => { cancelled = true; window.removeEventListener("online", on); window.removeEventListener("offline", off); clearInterval(iv); clearInterval(tick); };
  }, [eventId, refreshManifest, sync]);

  // ---- core: evaluate a scan locally and queue it
  const record = useCallback(
    async (ticketId: string | null, raw: string, result: ScanResult) => {
      const q = await store.queue.get(eventId);
      const item: QueuedCheckin = {
        clientId: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        ticketId,
        rawPayload: raw,
        scannedAt: new Date().toISOString(),
        localResult: result.kind === "wrong-event" ? "invalid" : result.kind,
      };
      await store.queue.set(eventId, [...q, item]);
      setQueueLen(q.length + 1);
      if (result.kind === "ok" && ticketId) {
        const u = { ...(await store.used.get(eventId)), [ticketId]: item.scannedAt };
        await store.used.set(eventId, u);
        setLocalUsed(u);
      }
      setLast(result);
      feedback(result.kind === "wrong-event" ? "invalid" : result.kind);
      void sync();
    },
    [eventId, sync],
  );

  const evaluateTicket = useCallback(
    (t: ManifestTicket | undefined, usedMap: Record<string, string>): ScanResult => {
      const at = Date.now();
      if (!t) return { kind: "invalid", detail: "Ticket is not in this event's list. Pull to refresh if it was just issued.", at };
      if (t.status === "void") return { kind: "void", ticket: t, at };
      if (t.status === "used") return { kind: "duplicate", ticket: t, detail: t.checkedInAt ? `First scanned ${new Date(t.checkedInAt).toLocaleTimeString()}` : undefined, at };
      if (usedMap[t.id]) return { kind: "duplicate", ticket: t, detail: `Scanned on this device ${new Date(usedMap[t.id]).toLocaleTimeString()}`, at };
      return { kind: "ok", ticket: t, at };
    },
    [],
  );

  const handleText = useCallback(
    async (text: string) => {
      const now = Date.now();
      const seen = recentRef.current.get(text);
      if (seen && now - seen < 3000) return; // debounce continuous frames
      recentRef.current.set(text, now);

      const parts = parseToken(text);
      if (!parts) return record(null, text, { kind: "invalid", detail: "Not a Baguio Base Camp ticket code", at: now });
      if (parts.eventId !== eventId) return record(null, text, { kind: "wrong-event", detail: "This ticket is for a different event", at: now });
      if (!keyRef.current) return record(null, text, { kind: "invalid", detail: "Ticket list not loaded yet", at: now });
      const sigOk = await verifyTicketSignature(keyRef.current, parts);
      if (!sigOk) return record(null, text, { kind: "invalid", detail: "Signature check failed, possible fake", at: now });
      const t = manifest?.tickets.find((x) => x.id === parts.ticketId);
      const result = evaluateTicket(t, await store.used.get(eventId));
      return record(t?.id ?? parts.ticketId, text, result);
    },
    [eventId, manifest, evaluateTicket, record],
  );

  const handleCode = useCallback(
    async (input: string) => {
      const code = normalizeShortCode(input);
      if (!code) { setLast({ kind: "invalid", detail: "Codes look like BBC-XXXX-XXXX", at: Date.now() }); feedback("invalid"); return; }
      const t = manifest?.tickets.find((x) => x.code === code);
      const result = evaluateTicket(t, await store.used.get(eventId));
      return record(t?.id ?? null, code, result);
    },
    [eventId, manifest, evaluateTicket, record],
  );

  const stats = (() => {
    const tickets = manifest?.tickets ?? [];
    const usedServer = tickets.filter((t) => t.status === "used").length;
    const usedLocalOnly = tickets.filter((t) => t.status === "valid" && localUsed[t.id]).length;
    return { issued: tickets.length, checkedIn: usedServer + usedLocalOnly };
  })();

  const manifestAgeMinutes = manifestAge ? Math.max(0, Math.round((now - manifestAge) / 60000)) : null;

  return { manifest, manifestAge, manifestAgeMinutes, online, queueLen, syncing, last, serverNotes, stats, localUsed, handleText, handleCode, refreshManifest, sync, dismiss: () => setLast(null) };
}
