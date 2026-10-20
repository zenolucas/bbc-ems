import Link from "next/link";
import { Suspense } from "react";
import { desc } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashToast } from "@/components/ui/flash-toast";
import { StatusBadge } from "@/components/event/status-badge";
import { eventEndsAt, heldByTier, pendingReviewByEvent } from "@/lib/events";
import { requireAdmin } from "@/lib/session";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Events" };

export default async function AdminEventsPage() {
  await requireAdmin();
  const rows = await db.query.events.findMany({ orderBy: desc(events.startsAt), with: { tiers: true } });
  const [held, pending] = await Promise.all([heldByTier(rows.map((e) => e.id)), pendingReviewByEvent()]);
  const now = new Date();
  return (
    <div className="space-y-6">
      <Suspense><FlashToast messages={{ deleted: "Event deleted" }} /></Suspense>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <Button asChild><Link href="/admin/events/new"><Plus className="size-4" /> New event</Link></Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState action={<Button asChild><Link href="/admin/events/new">Create the first event</Link></Button>}>No events yet.</EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((e) => {
            const cap = e.tiers.reduce((n, t) => n + t.quantity, 0);
            const sold = e.tiers.reduce((n, t) => n + (held.get(t.id) ?? 0), 0);
            const past = eventEndsAt(e) < now;
            const p = pending.get(e.id) ?? 0;
            return (
              <li key={e.id}>
                <Link href={`/admin/events/${e.id}`} className={`flex flex-wrap items-center gap-x-4 gap-y-2 p-4 hover:bg-muted/40 ${past ? "opacity-70" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{e.title}</div>
                    <div className="text-sm text-muted-foreground">{fmtDateTime(e.startsAt)} · {e.venueName}</div>
                  </div>
                  <div className="text-sm tabular-nums text-muted-foreground">{sold} / {cap} reserved</div>
                  {p > 0 && <span className="rounded-full bg-sun px-2 py-0.5 text-xs font-semibold text-deep-forest">{p} to review</span>}
                  <StatusBadge status={past && e.status === "published" ? "ended" : e.status} admin />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
