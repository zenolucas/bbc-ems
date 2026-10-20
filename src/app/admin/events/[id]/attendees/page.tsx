import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, Download } from "lucide-react";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { getEventById } from "@/lib/events";
import { AttendeeTable } from "./attendee-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Attendees" };

export default async function AttendeesPage({ params }: PageProps<"/admin/events/[id]/attendees">) {
  const { id } = await params;
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
    email: t.user.email,
    tier: t.tier.name,
    status: t.status,
    checkedInAt: t.checkedInAt?.toISOString() ?? null,
    bookingId: t.bookingId,
  }));
  const used = data.filter((d) => d.status === "used").length;
  return (
    <div className="space-y-6">
      <Link href={`/admin/events/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> {event.title}</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendees</h1>
          <p className="text-sm text-muted-foreground">{used} of {data.length} checked in</p>
        </div>
        <Button asChild variant="outline"><a href={`/api/admin/events/${id}/attendees.csv`}><Download className="size-4" /> CSV</a></Button>
      </div>
      <AttendeeTable eventId={id} rows={data} />
    </div>
  );
}
