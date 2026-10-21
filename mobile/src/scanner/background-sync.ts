import * as BackgroundTask from "expo-background-task";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import { api, getApiToken, setApiToken } from "@/lib/api";
import { TIMEOUT_MS } from "./logic";
import { store } from "./store";
import { syncQueue, type SyncDeps, type SyncResult } from "./sync";

/**
 * Sends waiting door check-ins after the volunteer has left door mode (or the app was
 * swiped away). Door mode itself syncs on every scan; this covers "left the scanner
 * before getting signal back".
 *
 * Android runs it through WorkManager: at most every 15 minutes, only with a network
 * connection and enough battery, and the system may delay it further. iOS (BGTaskScheduler)
 * decides on its own schedule. So it's a safety net, not instant: opening the Door tab
 * or door mode with signal still syncs straight away.
 *
 * Imported for its side effect from src/app/_layout.tsx: tasks must be defined at module
 * scope, before React renders, including when the OS starts the app headless for the task.
 */

export const DOOR_SYNC_TASK = "bbc-door-sync";

/** Session key from src/lib/session.tsx. Headless runs start without the session restored. */
const TOKEN_KEY = "bbc.session";

export const syncDeps: SyncDeps = {
  queue: store.queue,
  deviceId: () => store.deviceId(),
  post: (body) => api("/api/scan/sync", { body, timeoutMs: TIMEOUT_MS }),
};

/** Syncs every event with waiting check-ins. Conflict notes are kept for door mode to show. */
export async function syncAllQueues(): Promise<{ results: SyncResult[]; remaining: number }> {
  if (!getApiToken()) {
    const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
    if (token) setApiToken(token);
  }
  const results: SyncResult[] = [];
  for (const e of store.events()) {
    if (e.queued === 0) continue;
    const r = await syncQueue(e.eventId, syncDeps);
    if (r.status === "synced" && r.notes.length) store.notes.update(e.eventId, (n) => [...r.notes, ...n]);
    results.push(r);
    // Signed out or no signal: the other events would fail the same way
    if (r.status === "auth" || r.status === "offline") break;
  }
  return { results, remaining: store.queuedTotal() };
}

TaskManager.defineTask(DOOR_SYNC_TASK, async () => {
  try {
    const { results, remaining } = await syncAllQueues();
    if (remaining === 0) await BackgroundTask.unregisterTaskAsync(DOOR_SYNC_TASK).catch(() => {});
    return results.some((r) => r.status === "offline" || r.status === "auth")
      ? BackgroundTask.BackgroundTaskResult.Failed
      : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Registered while anything waits to sync, unregistered once every queue is empty. Returns whether it's on. */
export async function updateBackgroundSync(): Promise<boolean> {
  try {
    const waiting = store.queuedTotal() > 0;
    const registered = await TaskManager.isTaskRegisteredAsync(DOOR_SYNC_TASK);
    if (waiting && !registered) {
      if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return false;
      await BackgroundTask.registerTaskAsync(DOOR_SYNC_TASK, { minimumInterval: 15 });
      return true;
    }
    if (!waiting && registered) await BackgroundTask.unregisterTaskAsync(DOOR_SYNC_TASK);
    return waiting;
  } catch {
    return false;
  }
}

export async function isBackgroundSyncOn() {
  return TaskManager.isTaskRegisteredAsync(DOOR_SYNC_TASK).catch(() => false);
}
