import type { TicketDTO } from "@bbc/shared/api-types";
import { Directory, File, Paths } from "expo-file-system";
import { openDatabaseSync } from "expo-sqlite";
import { useEffect, useSyncExternalStore } from "react";
import { api, ApiError, baseHeaders, getApiToken } from "./api";
import { API_URL } from "./config";
import { onAfterSignOut } from "./session";

/**
 * Tickets saved on the phone, so the wallet opens at a venue with no signal.
 * Ticket JSON (QR URL, code, holder) lives in SQLite; the rendered PNGs, one per
 * theme, live in Documents/tickets. Everything is wiped on sign-out.
 */

const db = openDatabaseSync("tickets.db");
db.execSync(`
  create table if not exists tickets (id text primary key not null, sort integer not null, version text not null, json text not null);
  create table if not exists meta (key text primary key not null, value text not null);
`);

const dir = new Directory(Paths.document, "tickets");

type Snapshot = {
  tickets: TicketDTO[];
  /** When the list last came from the server (ms), null if never. */
  syncedAt: number | null;
  /** The last refresh failed for lack of signal. */
  offline: boolean;
  syncing: boolean;
  error: string | null;
  /** Bumps when a PNG lands, so images re-check their file. */
  pngRev: number;
};

function readAll(): Snapshot {
  try {
    const rows = db.getAllSync<{ json: string }>("select json from tickets order by sort");
    const meta = db.getFirstSync<{ value: string }>("select value from meta where key = 'syncedAt'");
    return { tickets: rows.map((r) => JSON.parse(r.json)), syncedAt: meta ? Number(meta.value) : null, offline: false, syncing: false, error: null, pngRev: 0 };
  } catch {
    return { tickets: [], syncedAt: null, offline: false, syncing: false, error: null, pngRev: 0 };
  }
}

let snapshot: Snapshot = readAll();
const listeners = new Set<() => void>();
function set(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

/** What the PNG shows; a change means re-download. Status isn't drawn on the PNG. */
function versionOf(t: TicketDTO) {
  return JSON.stringify([t.holderName, t.tierName, t.shortCode, t.qrUrl, t.event.title, t.event.startsAt, t.event.endsAt, t.event.venueName]);
}

export function pngFile(id: string, dark: boolean) {
  return new File(dir, `${id}-${dark ? "dark" : "light"}.png`);
}

function deletePngs(id: string) {
  for (const dark of [false, true]) {
    try {
      const f = pngFile(id, dark);
      if (f.exists) f.delete();
    } catch {}
  }
}

const inflight = new Map<string, Promise<string | null>>();

/** Downloads one render if it isn't on the phone yet. Resolves to its file URI, or null offline. */
export function ensurePng(t: TicketDTO, dark: boolean): Promise<string | null> {
  const file = pngFile(t.id, dark);
  if (file.exists) return Promise.resolve(file.uri);
  const key = `${t.id}-${dark}`;
  const running = inflight.get(key);
  if (running) return running;
  const p = (async () => {
    try {
      dir.create({ intermediates: true, idempotent: true });
      const url = API_URL + t.pngPath + (dark ? "?theme=dark" : "");
      const saved = await File.downloadFileAsync(url, file, { headers: baseHeaders(), idempotent: true });
      set({ pngRev: snapshot.pngRev + 1 });
      return saved.uri;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

function writeAll(list: TicketDTO[]) {
  const before = new Map(db.getAllSync<{ id: string; version: string }>("select id, version from tickets").map((r) => [r.id, r.version]));
  const keep = new Set(list.map((t) => t.id));
  db.withTransactionSync(() => {
    for (const id of before.keys()) if (!keep.has(id)) db.runSync("delete from tickets where id = ?", id);
    list.forEach((t, i) => {
      db.runSync("insert or replace into tickets (id, sort, version, json) values (?, ?, ?, ?)", t.id, i, versionOf(t), JSON.stringify(t));
    });
  });
  for (const [id, v] of before) {
    if (!keep.has(id)) deletePngs(id);
    else if (v !== versionOf(list.find((t) => t.id === id)!)) deletePngs(id);
  }
}

let refreshing: Promise<void> | null = null;

/** Pulls the list from the server, saves it, and fetches any missing renders in the background. */
export function refreshTickets(): Promise<void> {
  if (!getApiToken()) return Promise.resolve();
  if (refreshing) return refreshing;
  refreshing = (async () => {
    set({ syncing: true, error: null });
    try {
      const list = await api<TicketDTO[]>("/api/v1/tickets");
      writeAll(list);
      const now = Date.now();
      db.runSync("insert or replace into meta (key, value) values ('syncedAt', ?)", String(now));
      set({ tickets: list, syncedAt: now, offline: false, syncing: false });
      // Both themes, so switching dark mode at the venue still shows a ticket
      for (const t of list.filter((x) => x.status !== "void")) {
        await ensurePng(t, false);
        await ensurePng(t, true);
      }
    } catch (e) {
      set({ syncing: false, offline: e instanceof ApiError && e.offline, error: e instanceof ApiError && e.offline ? null : e instanceof Error ? e.message : "Couldn't refresh tickets" });
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** After a rename: swap the one ticket in, re-render its PNGs. */
export async function upsertTicket(t: TicketDTO) {
  const list = snapshot.tickets.some((x) => x.id === t.id) ? snapshot.tickets.map((x) => (x.id === t.id ? t : x)) : [...snapshot.tickets, t];
  writeAll(list);
  set({ tickets: list });
  await ensurePng(t, false);
  await ensurePng(t, true);
}

export function clearTicketCache() {
  try {
    db.withTransactionSync(() => {
      db.runSync("delete from tickets");
      db.runSync("delete from meta");
    });
  } catch {}
  try {
    if (dir.exists) dir.delete();
  } catch {}
  set({ tickets: [], syncedAt: null, offline: false, syncing: false, error: null, pngRev: snapshot.pngRev + 1 });
}

onAfterSignOut(clearTicketCache);

export function useTickets() {
  const s = useSyncExternalStore(subscribe, () => snapshot);
  return { ...s, refresh: refreshTickets };
}

export function useCachedTicket(id: string) {
  const s = useSyncExternalStore(subscribe, () => snapshot);
  return s.tickets.find((t) => t.id === id) ?? null;
}

/** File URI of a ticket's render for the current theme; downloads it when missing and online. */
export function useTicketImage(t: TicketDTO | null, dark: boolean) {
  const rev = useSyncExternalStore(subscribe, () => snapshot.pngRev);
  const file = t ? pngFile(t.id, dark) : null;
  const exists = !!file?.exists;
  useEffect(() => {
    if (t && !exists) ensurePng(t, dark);
  }, [t, dark, exists]);
  // The cache key busts expo-image's memory cache when a rename re-renders the file
  return file && exists && t ? { uri: file.uri, cacheKey: `${t.id}-${dark ? "d" : "l"}-${rev}` } : null;
}
