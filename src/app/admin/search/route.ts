import { NextResponse, type NextRequest } from "next/server";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { bookings, events, users } from "@/db/schema";
import { peso } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

/**
 * Lookup behind the ⌘K palette: bookings by member name, email, booking ID or
 * GCash reference, and people by name or email. Admins only; reads, no writes.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ bookings: [], people: [] });
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  // References are typed with or without spaces, so compare them squashed
  const squashed = `%${q.replace(/\s+/g, "").replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const [found, people] = await Promise.all([
    db
      .select({ id: bookings.id, eventId: bookings.eventId, eventTitle: events.title, name: users.name, email: users.email, status: bookings.status, totalCents: bookings.totalCents })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .innerJoin(events, eq(events.id, bookings.eventId))
      .where(or(ilike(users.name, like), ilike(users.email, like), ilike(bookings.id, like), sql`replace(coalesce(${bookings.paymentRef}, ''), ' ', '') ilike ${squashed}`))
      .orderBy(desc(bookings.createdAt))
      .limit(6),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        // Spelled out: drizzle drops table prefixes in single-table selects, which would bind these to bookings
        n: sql<number>`(select count(*) from bookings b where b.user_id = "users"."id")::int`,
        // Their latest booking is the most useful place to land
        last: sql<string | null>`(select b.event_id || '/' || b.id from bookings b where b.user_id = "users"."id" order by b.created_at desc limit 1)`,
      })
      .from(users)
      .where(or(ilike(users.name, like), ilike(users.email, like)))
      .orderBy(users.name)
      .limit(5),
  ]);

  return NextResponse.json({
    bookings: found.map((b) => ({ ...b, amount: peso(b.totalCents) })),
    people: people
      .filter((p) => p.last || p.role !== "member")
      .map((p) => {
        const [eventId, bookingId] = p.last?.split("/") ?? [];
        const role = p.role === "admin" ? "Admin" : p.role === "staff" ? "Door crew" : "Member";
        return {
          id: p.id,
          name: p.name,
          email: p.email,
          detail: `${role} · ${p.email} · ${p.n} booking${p.n === 1 ? "" : "s"}`,
          href: bookingId ? `/admin/events/${eventId}/bookings?show=all#${bookingId}` : "/admin/team",
        };
      }),
  });
}
