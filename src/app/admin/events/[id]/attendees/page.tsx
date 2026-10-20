import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { getEventById } from "@/lib/events";
import { requireStaff } from "@/lib/session";
import { AttendeeTable } from "./attendee-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Attendees" };

export default async function AttendeesPage({ params }: PageProps<"/admin/events/[id]/attendees">) {
  const { id } = await params;
  const user = await requireStaff();
  const isAdmin = user.role === "admin";
  const event = await getEventById(id);
  if (!event) notFound();
  const rows = await db.query.tickets.findMany({
    where: eq(tickets.eventId, id),
    orderBy: asc(tickets.holderName),
    with: { tier: true, user: true },
  });
  const data = rows.map((t) => ({
    id: t.id,
    code: t.shortCode,
    holder: t.holderName,
    // Door staff see names and codes, not contact details
    email: isAdmin ? t.user.email : "",
    tier: t.tier.name,
    status: t.status,
    checkedInAt: t.checkedInAt?.toISOString() ?? null,
    bookingId: t.bookingId,
  }));
  const live = data.filter((d) => d.status !== "void");
  const used = data.filter((d) => d.status === "used").length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground"><span className="text-lg font-semibold tabular-nums text-foreground">{used}</span> of {live.length} checked in</p>
        {isAdmin && <Button asChild variant="outline" size="sm"><a href={`/api/admin/events/${id}/attendees.csv`}><Download /> Export CSV</a></Button>}
      </div>
      <AttendeeTable eventId={id} rows={data} isAdmin={isAdmin} tiers={event.tiers.map((t) => t.name)} />
    </div>
  );
}
