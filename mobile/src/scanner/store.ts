import type { DoorEventDTO } from "@bbc/shared/api-types";
import type { Manifest } from "@bbc/shared/scan-types";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { newDeviceId, NOTES_LIMIT, RECENT_LIMIT, type LocalUsed, type QueuedCheckin, type RecentScan } from "./logic";

/**
 * What the door keeps on this phone, under the web scanner's keys
 * (bbc:manifest|queue|used|recent:<eventId>, bbc:device, bbc:muted), plus
 * bbc:notes:<eventId> for conflicts the background sync found.
 *
 * Every read-modify-write runs synchronously inside one SQLite transaction. With
 * no await between the read and the write, a scan made during a sync (or two
 * quick scans) can't overwrite each other: the web lost check-ins exactly that
 * way before 3c8a988.
 */

let db: SQLiteDatabase | null = null;

function conn() {
  if (!db) {
    db = openDatabaseSync("bbc-door.db");
    db.execSync("PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);");
  }
  return db;
}

const k = (eventId: string, name: string) => `bbc:${name}:${eventId}`;

function read<T>(key: string): T | undefined {
  const row = conn().getFirstSync<{ value: string }>("SELECT value FROM kv WHERE key = ?", [key]);
  return row ? (JSON.parse(row.value) as T) : undefined;
}

function write(key: string, value: unknown) {
  conn().runSync("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, JSON.stringify(value)]);
}

/** Read-modify-write in one transaction. Returns what it stored. */
function change<T>(key: string, fallback: T, fn: (current: T) => T): T {
  let next = fallback;
  conn().withTransactionSync(() => {
    next = fn(read<T>(key) ?? fallback);
    write(key, next);
  });
  return next;
}

export const store = {
  manifest: {
    get: (eventId: string) => read<Manifest>(k(eventId, "manifest")) ?? null,
    set: (eventId: string, m: Manifest) => write(k(eventId, "manifest"), m),
  },
  queue: {
    get: (eventId: string) => read<QueuedCheckin[]>(k(eventId, "queue")) ?? [],
    update: (eventId: string, fn: (q: QueuedCheckin[]) => QueuedCheckin[]) => change<QueuedCheckin[]>(k(eventId, "queue"), [], fn),
  },
  used: {
    get: (eventId: string) => read<LocalUsed>(k(eventId, "used")) ?? {},
    update: (eventId: string, fn: (u: LocalUsed) => LocalUsed) => change<LocalUsed>(k(eventId, "used"), {}, fn),
  },
  recent: {
    get: (eventId: string) => read<RecentScan[]>(k(eventId, "recent")) ?? [],
    update: (eventId: string, fn: (r: RecentScan[]) => RecentScan[]) => change<RecentScan[]>(k(eventId, "recent"), [], (r) => fn(r).slice(0, RECENT_LIMIT)),
  },
  /** Conflict notes from syncs that ran while door mode was closed (background), shown when it opens. */
  notes: {
    get: (eventId: string) => read<string[]>(k(eventId, "notes")) ?? [],
    update: (eventId: string, fn: (n: string[]) => string[]) => change<string[]>(k(eventId, "notes"), [], (n) => fn(n).slice(0, NOTES_LIMIT)),
  },
  muted: {
    get: () => read<boolean>("bbc:muted") ?? false,
    set: (v: boolean) => write("bbc:muted", v),
  },
  /** The Door tab's last event list, so it opens with no signal (the web gets this from its service worker). */
  doorEvents: {
    get: () => read<{ at: number; events: DoorEventDTO[] }>("bbc:door-events") ?? null,
    set: (events: DoorEventDTO[]) => write("bbc:door-events", { at: Date.now(), events }),
  },
  /** Removes this event's ticket list and history from the phone (end of night). */
  clear(eventId: string) {
    conn().withTransactionSync(() => {
      for (const n of ["manifest", "queue", "used", "recent", "notes"]) conn().runSync("DELETE FROM kv WHERE key = ?", [k(eventId, n)]);
    });
  },
  deviceId() {
    return change<string>("bbc:device", "", (id) => id || newDeviceId());
  },
  /** For the Door tab: whether a list is on the phone and how many scans wait, per event. */
  summary(eventId: string) {
    const m = read<Manifest>(k(eventId, "manifest"));
    return { listAt: m?.version ?? null, queued: (read<QueuedCheckin[]>(k(eventId, "queue")) ?? []).length };
  },
  /** Total check-ins waiting to sync, across events. */
  queuedTotal() {
    return store.events().reduce((n, e) => n + e.queued, 0);
  },
  /** Every event this phone holds anything for, with its title, for the "on this phone" summary. */
  events(): { eventId: string; title: string; listAt: string | null; queued: number }[] {
    const rows = conn().getAllSync<{ key: string }>("SELECT key FROM kv WHERE key LIKE 'bbc:manifest:%' OR key LIKE 'bbc:queue:%'");
    const ids = new Set(rows.map((r) => r.key.split(":").slice(2).join(":")));
    return [...ids].map((eventId) => {
      const m = read<Manifest>(k(eventId, "manifest"));
      return { eventId, title: m?.title ?? "An event", ...store.summary(eventId) };
    });
  },
};
