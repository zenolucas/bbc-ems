import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db/client";
import { bookings, events } from "@/db/schema";
import { EmptyState } from "@/components/ui/empty-state";
import { fmtDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue" };

/**
 * There is one review queue per event. When receipts are waiting this sends
 * you to the event with the oldest one (first come, first served); when the
 * queue is clear it says so and lists where bookings live.
 */
export default async function ReviewQueuePage() {
  await requireAdmin();
  const [oldest] = await db
    .select({ eventId: bookings.eventId })
    .from(bookings)
    .where(eq(bookings.status, "under_review"))
    .orderBy(sql`${bookings.submittedAt} asc nulls last`)
    .limit(1);
  if (oldest) redirect(`/admin/events/${oldest.eventId}/bookings`);

  const upcoming = await db.query.events.findMany({
    where: and(eq(events.status, "published"), gte(sql`coalesce(${events.endsAt}, ${events.startsAt} + interval '6 hours')`, new Date())),
    orderBy: asc(events.startsAt),
  });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] leading-none font-extrabold tracking-tight lg:text-[32px]">Review queue</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Receipts land here when members upload them. Oldest first.</p>
      </div>
      <EmptyState title="Queue is clear">Nothing waiting for review. New receipts show up with a count in the sidebar.</EmptyState>
      {upcoming.length > 0 && (
        <section aria-labelledby="bk" className="overflow-hidden rounded-[18px] border bg-card">
          <h2 id="bk" className="px-4 pt-3.5 pb-2 font-display text-lg font-extrabold">All bookings</h2>
          {upcoming.map((e) => (
            <Link key={e.id} href={`/admin/events/${e.id}/bookings?show=all`} className="flex items-center gap-3.5 border-t px-4 py-3 hover:bg-surface-2/60">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{e.title}</span>
                <span className="block text-xs text-muted-foreground">{fmtDate(e.startsAt, "EEE, MMM d · h:mm a")}</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
