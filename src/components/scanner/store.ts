"use client";
import { get, set } from "idb-keyval";
import type { Manifest } from "@/lib/checkins";

export type QueuedCheckin = {
  clientId: string;
  ticketId: string | null;
  rawPayload: string | null;
  scannedAt: string;
  localResult: "ok" | "duplicate" | "invalid" | "void";
};

export type LocalUsed = Record<string, string>; // ticketId -> ISO time of local check-in

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
  async deviceId() {
    let id = await get<string>("bbc:device");
    if (!id) {
      id = `dev-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      await set("bbc:device", id);
    }
    return id;
  },
};
