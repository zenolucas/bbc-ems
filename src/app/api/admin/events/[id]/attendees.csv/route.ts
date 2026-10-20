import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

function csv(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_req: Request, { params }: RouteContext<"/api/admin/events/[id]/attendees.csv">) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new NextResponse("Admins only", { status: 403 });
  const { id } = await params;
  const rows = await db.query.tickets.findMany({ where: eq(tickets.eventId, id), orderBy: asc(tickets.holderName), with: { tier: true, user: true, booking: true } });
  const header = ["holder", "email", "tier", "short_code", "status", "checked_in_at", "booking_id", "payment_ref"];
  const lines = rows.map((t) => [t.holderName, t.user.email, t.tier.name, t.shortCode, t.status, t.checkedInAt?.toISOString() ?? "", t.bookingId, t.booking.paymentRef ?? ""].map(csv).join(","));
  return new NextResponse([header.join(","), ...lines].join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="attendees-${id}.csv"` },
  });
}
