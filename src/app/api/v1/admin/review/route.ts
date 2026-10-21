import type { ReviewItemDTO, ReviewQueueDTO } from "@bbc/shared/admin-types";
import { requireApiAdmin } from "@/lib/api/auth";
import { eventRefDTO } from "@/lib/api/dto";
import { handle, iso } from "@/lib/api/respond";
import { listReviewQueue } from "@/lib/review";

/** Receipts waiting for an organiser, oldest first. ?eventId= narrows it to one event. */
export const GET = handle(async (req: Request): Promise<ReviewQueueDTO> => {
  await requireApiAdmin(req);
  const eventId = new URL(req.url).searchParams.get("eventId") || undefined;
  const rows = await listReviewQueue(eventId);
  return {
    items: rows.map(
      (b): ReviewItemDTO => ({
        id: b.id,
        event: eventRefDTO(b.event),
        userName: b.user.name,
        userEmail: b.user.email,
        items: b.items.map((i) => ({ tierName: i.tier.name, quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
        totalCents: b.totalCents,
        paymentRef: b.paymentRef,
        paymentProofUrl: b.paymentProofUrl,
        submittedAt: iso(b.submittedAt),
        createdAt: b.createdAt.toISOString(),
        expiresAt: iso(b.expiresAt),
        hints: { history: b.hints.history, refCheck: b.hints.refCheck },
        otherBookings: b.hints.otherBookings,
      }),
    ),
  };
});
