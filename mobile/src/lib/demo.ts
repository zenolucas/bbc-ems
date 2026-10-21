import type { DemoStateDTO, ScanSample } from "@bbc/shared/demo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { keys } from "./attendee";
import { configKey, useDemo } from "./server-config";
import { refreshTickets } from "./tickets-cache";

/** Demo site helpers. Every route answers 404 unless the server's demo switch is on. */

/** Lapse an unpaid hold now (owner or organiser), freeing its seats for the waitlist. */
export function useExpireHold(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: boolean; status: string }>(`/api/v1/demo/bookings/${encodeURIComponent(bookingId)}/expire`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.booking(bookingId) });
      qc.invalidateQueries({ queryKey: keys.bookings });
      qc.invalidateQueries({ queryKey: ["event"] });
    },
  });
}

/** Organiser: the demo switches. Turning demo mode off hides every shortcut, this one included. */
export function useDemoSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<DemoStateDTO>) => api<DemoStateDTO>("/api/v1/demo/settings", { body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: configKey }),
  });
}

/** Organiser: the 15-minute cron, now. */
export function useRunCron() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ expired: number; reminded: number; waitlisted: number }>("/api/v1/demo/cron", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

/** Organiser: everything back to the starting story. */
export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: boolean; counts: { bookings: number; tickets: number } }>("/api/v1/demo/reset", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries();
      refreshTickets().catch(() => {});
    },
  });
}

/** Door crew: sample tickets to feed the scanner (good, used, other event, edited, unknown). */
export function useScanSamples(eventId: string) {
  const demo = useDemo();
  return useQuery({
    queryKey: ["scan-samples", eventId],
    queryFn: async () => (await api<{ samples: ScanSample[] }>(`/api/v1/demo/scan-samples?eventId=${encodeURIComponent(eventId)}`)).samples,
    enabled: !!demo,
  });
}
