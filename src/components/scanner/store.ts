"use client";
import { del, get, set } from "idb-keyval";
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

export const store = {
  manifest: {
    get: (eventId: string) => get<Manifest>(k(eventId, "manifest")),
    set: (eventId: string, m: Manifest) => set(k(eventId, "manifest"), m),
  },
  queue: {
    get: async (eventId: string) => (await get<QueuedCheckin[]>(k(eventId, "queue"))) ?? [],
    set: (eventId: string, q: QueuedCheckin[]) => set(k(eventId, "queue"), q),
  },
  used: {
    get: async (eventId: string) => (await get<LocalUsed>(k(eventId, "used"))) ?? {},
    set: (eventId: string, u: LocalUsed) => set(k(eventId, "used"), u),
  },
  recent: {
    get: async (eventId: string) => (await get<RecentScan[]>(k(eventId, "recent"))) ?? [],
    set: (eventId: string, r: RecentScan[]) => set(k(eventId, "recent"), r.slice(0, 10)),
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
