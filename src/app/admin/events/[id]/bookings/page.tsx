import { notFound } from "next/navigation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings } from "@/db/schema";
import { FilterPills } from "@/components/admin/filter-pills";
import { getEventById } from "@/lib/events";
import { fmtDate, fmtDateTime, relative } from "@/lib/format";
import { usersByIds } from "@/lib/bookings";
import { reviewHints } from "@/lib/review";
import { requireAdmin } from "@/lib/session";
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
  const [reviewerList, hints] = await Promise.all([
    usersByIds([...new Set(rows.map((r) => r.reviewedBy).filter((x): x is string => !!x))]),
    reviewHints(rows),
  ]);
  const reviewers = new Map(reviewerList.map((u) => [u.id, u.name || u.email]));

  const now = new Date();
  const data = rows.map((b) => {
    const hint = hints.get(b.id)!;
    const holdOpen = (b.status === "pending_payment" || b.status === "rejected" || b.status === "under_review") && b.expiresAt;
    return {
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
      itemNotes: b.items.map((i) => i.tier.description).filter(Boolean).join(" · "),
      ticketCount: b.tickets.filter((t) => t.status !== "void").length,
      // Relative times are rendered here, not in the client list, so hydration text matches
      timing: [
        b.submittedAt ? `Receipt sent ${relative(b.submittedAt)}` : `Reserved ${relative(b.createdAt)}, no receipt yet`,
        (b.status === "pending_payment" || b.status === "rejected") && b.expiresAt ? `hold ${b.expiresAt < now ? "lapsed" : `ends ${relative(b.expiresAt)}`}` : null,
      ].filter(Boolean).join(" · "),
      age: b.submittedAt ? `Sent ${relative(b.submittedAt)}` : `Reserved ${relative(b.createdAt)}`,
      stale: !!b.submittedAt && now.getTime() - b.submittedAt.getTime() > 2 * 3600e3,
      timeline: [
        `Reserved ${fmtDate(b.createdAt, "MMM d")}`,
        b.submittedAt ? `receipt sent ${relative(b.submittedAt)}` : "no receipt yet",
        holdOpen && b.expiresAt ? (b.expiresAt < now ? "hold lapsed" : `hold would end ${relative(b.expiresAt)}`) : null,
      ].filter(Boolean).join(" · "),
      history: hint.history,
      refCheck: hint.refCheck,
      reviewed: b.reviewedBy && b.reviewedAt ? `Reviewed by ${reviewers.get(b.reviewedBy) ?? "an admin"}, ${relative(b.reviewedAt)}` : null,
      booked: fmtDateTime(b.createdAt),
    };
  });

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          label="Filter bookings"
          value={key}
          options={(Object.keys(FILTERS) as FilterKey[]).map((k) => ({ value: k, label: FILTERS[k].label, count: countFor(k), href: `/admin/events/${id}/bookings?show=${k}`, tone: k === "review" ? "warn" : undefined }))}
        />
        <p className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex" aria-hidden>
          <Kbd>J</Kbd><Kbd>K</Kbd> move · <Kbd>A</Kbd> approve · <Kbd>R</Kbd> reject · <Kbd>Z</Kbd> zoom receipt
        </p>
      </div>
      <ReviewList eventId={id} bookings={data} filter={key} />
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-[5px] border bg-card px-[5px] py-px font-mono text-[10px] text-muted-foreground">{children}</kbd>;
}
