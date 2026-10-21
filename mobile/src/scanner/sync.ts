import type { CheckinOutcome } from "@bbc/shared/scan-types";
import { readOutcomes, type QueuedCheckin } from "./logic";

/**
 * One sync round trip for one event's queue, shared by door mode (use-scanner) and the
 * background task (background-sync) so the two can't drift. No React Native imports:
 * the store and the HTTP call are passed in, which also lets Node test it.
 */

export type SyncDeps = {
  queue: {
    get: (eventId: string) => QueuedCheckin[];
    /** Read-modify-write in one transaction; returns what it stored. */
    update: (eventId: string, fn: (q: QueuedCheckin[]) => QueuedCheckin[]) => QueuedCheckin[];
  };
  deviceId: () => string;
  /** POST /api/scan/sync. Throws on failure; an error with status 401/403 means signed out or no door access. */
  post: (body: { eventId: string; deviceId: string; checkins: QueuedCheckin[] }) => Promise<{ outcomes: Pick<CheckinOutcome, "clientId" | "result" | "checkedInAt" | "holder">[] }>;
};

export type SyncResult =
  | { status: "empty"; remaining: 0; refetch: false; notes: [] }
  | { status: "synced"; remaining: number; refetch: boolean; notes: string[] }
  | { status: "offline" | "auth"; remaining: number; refetch: false; notes: [] };

const statusOf = (e: unknown) => (typeof e === "object" && e && "status" in e ? Number((e as { status: unknown }).status) : 0);

export async function syncQueue(eventId: string, deps: SyncDeps): Promise<SyncResult> {
  const q = deps.queue.get(eventId);
  if (q.length === 0) return { status: "empty", remaining: 0, refetch: false, notes: [] };
  try {
    const { outcomes } = await deps.post({
      eventId,
      deviceId: deps.deviceId(),
      checkins: q.map(({ clientId, ticketId, rawPayload, scannedAt, localResult }) => ({ clientId, ticketId, rawPayload, scannedAt, localResult })),
    });
    const { refetch, notes, done } = readOutcomes(outcomes, q);
    // Re-read inside the transaction: scans made while the request was in flight stay queued
    const remaining = deps.queue.update(eventId, (cur) => cur.filter((x) => !done.has(x.clientId)));
    return { status: "synced", remaining: remaining.length, refetch, notes };
  } catch (e) {
    const s = statusOf(e);
    return { status: s === 401 || s === 403 ? "auth" : "offline", remaining: q.length, refetch: false, notes: [] };
  }
}
