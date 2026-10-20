import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import { bookings } from "@/db/schema";
import { getEventById } from "@/lib/events";
import { ReviewList } from "./review-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review bookings" };

export default async function BookingsReviewPage({ params, searchParams }: PageProps<"/admin/events/[id]/bookings">) {
  const { id } = await params;
  const { show } = await searchParams;
  const event = await getEventById(id);
  if (!event) notFound();
  const statuses = show === "all" ? (["pending_payment", "under_review", "approved", "rejected", "expired", "cancelled"] as const) : (["under_review", "pending_payment", "rejected"] as const);
  const rows = await db.query.bookings.findMany({
    where: and(eq(bookings.eventId, id), inArray(bookings.status, [...statuses])),
    orderBy: [desc(bookings.submittedAt), desc(bookings.createdAt)],
    with: { user: true, items: { with: { tier: true } } },
  });
  const data = rows.map((b) => ({
    id: b.id,
    status: b.status,
    userName: b.user.name,
    userEmail: b.user.email,
    totalCents: b.totalCents,
    paymentRef: b.paymentRef,
    paymentProofUrl: b.paymentProofUrl,
    submittedAt: b.submittedAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    expiresAt: b.expiresAt?.toISOString() ?? null,
    reviewNote: b.reviewNote,
    items: b.items.map((i) => `${i.quantity} × ${i.tier.name}`).join(", "),
  }));
  return (
    <div className="space-y-6">
      <Link href={`/admin/events/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> {event.title}</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <div className="flex gap-2 text-sm">
          <Link href={`/admin/events/${id}/bookings`} className={`rounded-md px-3 py-1.5 ${show !== "all" ? "bg-primary text-primary-foreground" : "border"}`}>Needs attention</Link>
          <Link href={`/admin/events/${id}/bookings?show=all`} className={`rounded-md px-3 py-1.5 ${show === "all" ? "bg-primary text-primary-foreground" : "border"}`}>All</Link>
        </div>
      </div>
      <ReviewList eventId={id} bookings={data} />
    </div>
  );
}
