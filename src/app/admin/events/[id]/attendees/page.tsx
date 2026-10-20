import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { checkins, tickets } from "@/db/schema";
import { getEventById } from "@/lib/events";
import { relative } from "@/lib/format";
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
  const [rows, [door]] = await Promise.all([
    db.query.tickets.findMany({
      where: eq(tickets.eventId, id),
      orderBy: asc(tickets.holderName),
      with: { tier: true, user: true },
    }),
    // How the door is going: when the last good scan landed and how many phones are scanning
    db
      .select({ last: sql<Date | null>`max(${checkins.scannedAt})`, phones: sql<number>`count(distinct ${checkins.deviceId})::int` })
      .from(checkins)
      .where(and(eq(checkins.eventId, id), eq(checkins.result, "ok"))),
  ]);
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
  const live = data.filter((d) => d.status !== "void").length;
  const used = data.filter((d) => d.status === "used").length;
  const doorLine = door?.last ? `last scan ${relative(door.last)}${door.phones > 1 ? ` · ${door.phones} phones` : ""}` : "no scans yet";
  return (
    <AttendeeTable
      eventId={id}
      rows={data}
      isAdmin={isAdmin}
      tiers={event.tiers.map((t) => t.name)}
      progress={{ used, live, doorLine, csv: isAdmin ? `/api/admin/events/${id}/attendees.csv` : null }}
    />
  );
}
