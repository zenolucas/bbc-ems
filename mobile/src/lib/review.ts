import type { ApproveResultDTO, ReviewItemDTO, ReviewQueueDTO } from "@bbc/shared/admin-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { queryClient } from "./query";
import { onAfterSignOut, useSession } from "./session";

/** The organiser review queue (receipts waiting, oldest first). Admins only; the server says 403 otherwise. */

export const reviewKey = (eventId?: string) => ["review", eventId ?? "all"] as const;

export function useReviewQueue(eventId?: string) {
  const { status, isAdmin } = useSession();
  return useQuery({
    queryKey: reviewKey(eventId),
    queryFn: () => api<ReviewQueueDTO>(`/api/v1/admin/review${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""}`),
    enabled: status === "signedIn" && isAdmin,
    select: (d) => d.items,
  });
}

/** Finds an item in whichever cached queue holds it, so the item screen opens instantly. */
export function findReviewItem(id: string): ReviewItemDTO | undefined {
  for (const [, data] of queryClient.getQueriesData<ReviewQueueDTO>({ queryKey: ["review"] })) {
    const hit = data?.items.find((i) => i.id === id);
    if (hit) return hit;
  }
  return undefined;
}

function useAfterDecision() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["review"] });
    qc.invalidateQueries({ queryKey: ["event"] });
  };
}

export function useApprove(id: string) {
  const after = useAfterDecision();
  return useMutation({
    mutationFn: () => api<ApproveResultDTO>(`/api/v1/admin/bookings/${encodeURIComponent(id)}/approve`, { method: "POST", body: {} }),
    onSuccess: after,
  });
}

export function useReject(id: string) {
  const after = useAfterDecision();
  return useMutation({
    mutationFn: (note: string) => api<{ ok: true }>(`/api/v1/admin/bookings/${encodeURIComponent(id)}/reject`, { body: { note } }),
    onSuccess: after,
  });
}

// Members' receipts and emails must not outlive the organiser's session on a shared phone
onAfterSignOut(() => queryClient.removeQueries({ queryKey: ["review"] }));
