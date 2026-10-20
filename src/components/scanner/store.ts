"use client";
import { del, get, set, update } from "idb-keyval";
import type { LocalResult, Manifest } from "@/lib/checkins";

export type QueuedCheckin = {
  clientId: string;
  ticketId: string | null;
  rawPayload: string | null;
  scannedAt: string;
  localResult: LocalResult;
};

export type LocalUsed = Record<string, string>; // ticketId -> ISO time of local check-in, until the server confirms

export type RecentScan = { at: number; kind: string; holder?: string; code?: string; tier?: string };

const k = (eventId: string, name: string) => `bbc:${name}:${eventId}`;

/**
 * Read-modify-write in one IndexedDB transaction. A scan recorded while another
 * scan or a sync is mid-write would otherwise be overwritten and never sent.
 * Resolves to the value it stored.
 */
async function change<T>(key: string, fallback: T, fn: (current: T) => T) {
  let next = fallback;
  await update<T>(key, (current) => (next = fn(current ?? fallback)));
  return next;
}

export const store = {
  manifest: {
    get: (eventId: string) => get<Manifest>(k(eventId, "manifest")),
    set: (eventId: string, m: Manifest) => set(k(eventId, "manifest"), m),
  },
  queue: {
    get: async (eventId: string) => (await get<QueuedCheckin[]>(k(eventId, "queue"))) ?? [],
    update: (eventId: string, fn: (q: QueuedCheckin[]) => QueuedCheckin[]) => change<QueuedCheckin[]>(k(eventId, "queue"), [], fn),
  },
  used: {
    get: async (eventId: string) => (await get<LocalUsed>(k(eventId, "used"))) ?? {},
    update: (eventId: string, fn: (u: LocalUsed) => LocalUsed) => change<LocalUsed>(k(eventId, "used"), {}, fn),
  },
  recent: {
    get: async (eventId: string) => (await get<RecentScan[]>(k(eventId, "recent"))) ?? [],
    update: (eventId: string, fn: (r: RecentScan[]) => RecentScan[]) => change<RecentScan[]>(k(eventId, "recent"), [], (r) => fn(r).slice(0, 10)),
  },
  muted: {
    get: async () => (await get<boolean>("bbc:muted")) ?? false,
    set: (v: boolean) => set("bbc:muted", v),
  },
  /** Removes this event's ticket list and history from the device (end of night). */
  async clear(eventId: string) {
    await Promise.all(["manifest", "queue", "used", "recent"].map((n) => del(k(eventId, n))));
  },
  async deviceId() {
    let id = await get<string>("bbc:device");
    if (!id) {
      id = `dev-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      await set("bbc:device", id);
    }
    return id;
  },
};
