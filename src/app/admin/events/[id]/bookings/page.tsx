import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings } from "@/db/schema";
import { getEventById } from "@/lib/events";
import { fmtDateTime, relative } from "@/lib/format";
import { usersByIds } from "@/lib/bookings";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ReviewList } from "./review-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookings" };

const FILTERS = {
  review: { label: "To review", statuses: ["under_review"] },
  unpaid: { label: "Unpaid & rejected", statuses: ["pending_payment", "rejected"] },
  confirmed: { label: "Confirmed", statuses: ["approved"] },
  all: { label: "All", statuses: ["pending_payment", "under_review", "approved", "rejected", "expired", "cancelled"] },
} as const;
type FilterKey = keyof typeof FILTERS;

export default async function BookingsReviewPage({ params, searchParams }: PageProps<"/admin/events/[id]/bookings">) {
  const { id } = await params;
  const { show } = await searchParams;
  await requireAdmin();
  const event = await getEventById(id);
  if (!event) notFound();

  const countRows = await db
    .select({ status: bookings.status, n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(eq(bookings.eventId, id))
    .groupBy(bookings.status);
  const byStatus = new Map(countRows.map((r) => [r.status, r.n]));
  const countFor = (k: FilterKey) => FILTERS[k].statuses.reduce((n, s) => n + (byStatus.get(s) ?? 0), 0);
  // Land on the review queue when there's work, otherwise on everything
  const key: FilterKey = typeof show === "string" && show in FILTERS ? (show as FilterKey) : countFor("review") > 0 ? "review" : "all";

  const rows = await db.query.bookings.findMany({
    where: and(eq(bookings.eventId, id), inArray(bookings.status, [...FILTERS[key].statuses])),
    // Oldest receipt first (first come, first served); holds without a receipt go last
    orderBy: [sql`${bookings.submittedAt} asc nulls last`, asc(bookings.createdAt)],
    with: { user: true, items: { with: { tier: true } }, tickets: { columns: { id: true, status: true } } },
  });
  if (key === "all" || key === "confirmed") rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const reviewers = new Map((await usersByIds([...new Set(rows.map((r) => r.reviewedBy).filter((x): x is string => !!x))])).map((u) => [u.id, u.name || u.email]));

  const now = new Date();
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
    reviewedBy: b.reviewedBy ? reviewers.get(b.reviewedBy) ?? "an admin" : null,
    reviewedAt: b.reviewedAt?.toISOString() ?? null,
    items: b.items.map((i) => `${i.quantity} × ${i.tier.name}`).join(", "),
    ticketCount: b.tickets.filter((t) => t.status !== "void").length,
    // Relative times are rendered here, not in the client list, so hydration text matches
    timing: [
      b.submittedAt ? `Receipt sent ${relative(b.submittedAt)}` : `Reserved ${relative(b.createdAt)}, no receipt yet`,
      (b.status === "pending_payment" || b.status === "rejected") && b.expiresAt ? `hold ${b.expiresAt < now ? "lapsed" : `ends ${relative(b.expiresAt)}`}` : null,
    ].filter(Boolean).join(" · "),
    reviewed: b.reviewedBy && b.reviewedAt ? `Reviewed by ${reviewers.get(b.reviewedBy) ?? "an admin"}, ${relative(b.reviewedAt)}` : null,
    booked: fmtDateTime(b.createdAt),
  }));

  return (
    <div className="space-y-4">
      <nav aria-label="Filter bookings" className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
          <Link
            key={k}
            href={`/admin/events/${id}/bookings?show=${k}`}
            aria-current={k === key ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1.5", k === key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {FILTERS[k].label} <span className={cn("ml-1 tabular-nums", k === key ? "opacity-80" : "text-muted-foreground")}>{countFor(k)}</span>
          </Link>
        ))}
      </nav>
      <ReviewList eventId={id} bookings={data} filter={key} />
    </div>
  );
}
