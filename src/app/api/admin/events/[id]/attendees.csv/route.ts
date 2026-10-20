import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { events, tickets } from "@/db/schema";
import { fmtDate } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

function csv(v: unknown) {
  const s = v == null ? "" : String(v);
  // Quote anything with separators, and neutralise spreadsheet formulas
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const manila = (d: Date | null) => (d ? fmtDate(d, "yyyy-MM-dd HH:mm") : "");

export async function GET(_req: Request, { params }: RouteContext<"/api/admin/events/[id]/attendees.csv">) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new NextResponse("Admins only", { status: 403 });
  const { id } = await params;
  const ev = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!ev) return new NextResponse("Not found", { status: 404 });
  const rows = await db.query.tickets.findMany({ where: eq(tickets.eventId, id), orderBy: asc(tickets.holderName), with: { tier: true, user: true, booking: true } });
  const header = ["holder", "booked_by", "email", "tier", "price_php", "short_code", "ticket_status", "checked_in_at_manila", "booking_id", "booking_status", "payment_ref", "approved_at_manila"];
  const lines = rows.map((t) =>
    [
      t.holderName,
      t.user.name,
      t.user.email,
      t.tier.name,
      (t.tier.priceCents / 100).toFixed(2),
      t.shortCode,
      t.status,
      manila(t.checkedInAt),
      t.bookingId,
      t.booking.status,
      t.booking.paymentRef ?? "",
      manila(t.booking.reviewedAt),
    ]
      .map(csv)
      .join(","),
  );
  // BOM so Excel opens UTF-8 names (ñ, é) correctly
  return new NextResponse("\uFEFF" + [header.join(","), ...lines].join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="attendees-${ev.slug}.csv"` },
  });
}
