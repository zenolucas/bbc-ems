/* End-to-end booking flow against the local DB (no HTTP). */
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { events, users, tickets as ticketsT } from "../src/db/schema";
import { approveBooking, createBooking, expireOverdueBookings, getBookingForUser, rejectBooking, submitPayment } from "../src/lib/bookings";

async function main() {
  const admin = (await db.select().from(users).where(eq(users.email, "zenolucas@gmail.com")))[0];
  const ev = await db.query.events.findFirst({ where: eq(events.slug, "base-camp-sessions-vol-3"), with: { tiers: true } });
  if (!admin || !ev) throw new Error("seed first");
  const early = ev.tiers.find((t) => t.name === "Early Bird")!;
  const guest = ev.tiers.find((t) => t.name === "Crew / Guest list")!;

  // 1. free booking auto-approves and issues tickets
  const free = await createBooking(admin.id, { eventId: ev.id, items: [{ tierId: guest.id, quantity: 2 }] });
  const fb = await getBookingForUser(free.id, admin.id);
  console.log("free:", free, fb?.status, "tickets", fb?.tickets.length);

  // 2. paid booking -> pending, submit -> under_review, approve -> tickets
  const paid = await createBooking(admin.id, { eventId: ev.id, items: [{ tierId: early.id, quantity: 2 }] });
  console.log("paid created:", paid);
  await submitPayment(admin.id, paid.id, { paymentRef: "1234567890", paymentProofUrl: "/uploads/test.png" });
  console.log("after submit:", (await getBookingForUser(paid.id, admin.id))?.status);
  await approveBooking(admin.id, paid.id);
  const pb = await getBookingForUser(paid.id, admin.id);
  console.log("after approve:", pb?.status, "tickets", pb?.tickets.map((t) => t.shortCode));

  // 3. over-limit and over-stock guards
  for (const bad of [[{ tierId: early.id, quantity: 5 }], [{ tierId: early.id, quantity: 4 }, { tierId: early.id, quantity: 4 }]]) {
    try { await createBooking(admin.id, { eventId: ev.id, items: bad }); console.log("UNEXPECTED success"); }
    catch (e) { console.log("guard ok:", (e as Error).message); }
  }

  // 4. reject path
  const rej = await createBooking(admin.id, { eventId: ev.id, items: [{ tierId: early.id, quantity: 1 }] });
  await submitPayment(admin.id, rej.id, { paymentRef: "999", paymentProofUrl: "/uploads/x.png" });
  await rejectBooking(admin.id, rej.id, "Amount short by 100");
  console.log("rejected:", (await getBookingForUser(rej.id, admin.id))?.status);

  // 5. expiry
  const exp = await createBooking(admin.id, { eventId: ev.id, items: [{ tierId: early.id, quantity: 1 }] });
  await db.execute(`update bookings set expires_at = now() - interval '1 minute' where id = '${exp.id}'`);
  console.log("expired count:", await expireOverdueBookings(), (await getBookingForUser(exp.id, admin.id))?.status);

  const first = pb!.tickets[0];
  const all = await db.select({ n: ticketsT.id }).from(ticketsT);
  console.log("TICKET_ID=" + first.id, "total tickets", all.length);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
