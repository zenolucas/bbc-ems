/* End-to-end booking flow against the local DB (no HTTP). */
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { events, users, tickets as ticketsT } from "../src/db/schema";
import { approveBooking, cancelBooking, createBooking, effectiveStatus, expireOverdueBookings, getBookingForUser, rejectBooking, renameTicket, submitPayment } from "../src/lib/bookings";
import { tierAvailability } from "../src/lib/events";

function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) process.exitCode = 1;
}
async function throws(fn: () => Promise<unknown>) {
  try { await fn(); return null; } catch (e) { return (e as Error).message; }
}

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

  // 4b. rejected bookings keep their seats for a fresh hold window, and can be resubmitted
  const rb = await getBookingForUser(rej.id, admin.id);
  check("rejected gets a future hold", !!rb?.expiresAt && rb.expiresAt > new Date() && effectiveStatus(rb!) === "rejected");
  const heldBefore = (await tierAvailability(ev.id))(early).held;
  const rej2 = await createBooking(admin.id, { eventId: ev.id, items: [{ tierId: early.id, quantity: 1 }] });
  await submitPayment(admin.id, rej2.id, { paymentRef: "888", paymentProofUrl: "/uploads/x.png" });
  await rejectBooking(admin.id, rej2.id, "Unreadable");
  check("rejected hold still counts toward capacity", (await tierAvailability(ev.id))(early).held === heldBefore + 1);
  check("reject requires a note", (await throws(() => rejectBooking(admin.id, rej.id, "  "))) !== null);
  await submitPayment(admin.id, rej2.id, { paymentRef: "8889", paymentProofUrl: "/uploads/y.png" });
  check("resubmit after rejection -> under review", (await getBookingForUser(rej2.id, admin.id))?.status === "under_review");
  await cancelBooking(admin.id, rej2.id); // don't leave it in the admin review queue

  // 4c. a mistaken rejection can be approved
  await approveBooking(admin.id, rej.id);
  const ra = await getBookingForUser(rej.id, admin.id);
  check("approve from rejected issues tickets", ra?.status === "approved" && ra.tickets.length === 1);

  // 4d. member can cancel a rejected booking
  const rej3 = await createBooking(admin.id, { eventId: ev.id, items: [{ tierId: early.id, quantity: 1 }] });
  await submitPayment(admin.id, rej3.id, { paymentRef: "777", paymentProofUrl: "/uploads/x.png" });
  await rejectBooking(admin.id, rej3.id, "Duplicate");
  await cancelBooking(admin.id, rej3.id);
  check("cancel rejected booking", (await getBookingForUser(rej3.id, admin.id))?.status === "cancelled");
  check("cannot cancel an approved booking", (await throws(() => cancelBooking(admin.id, paid.id))) !== null);

  // 4e. guest names
  const t0 = pb!.tickets[0];
  await renameTicket(admin.id, t0.id, "  Maria   Santos ");
  const renamed = await db.query.tickets.findFirst({ where: eq(ticketsT.id, t0.id) });
  check("rename ticket trims and collapses spaces", renamed?.holderName === "Maria Santos");
  check("rename rejects someone else's ticket", (await throws(() => renameTicket("someone-else", t0.id, "X"))) !== null);
  check("rename rejects empty names", (await throws(() => renameTicket(admin.id, t0.id, "   "))) !== null);

  // 4f. rejected holds expire with the cron, and lapsed holds read as expired before it runs
  const rej4 = await createBooking(admin.id, { eventId: ev.id, items: [{ tierId: early.id, quantity: 1 }] });
  await submitPayment(admin.id, rej4.id, { paymentRef: "666", paymentProofUrl: "/uploads/x.png" });
  await rejectBooking(admin.id, rej4.id, "Wrong amount");
  await db.execute(`update bookings set expires_at = now() - interval '1 minute' where id = '${rej4.id}'`);
  const lapsed = await getBookingForUser(rej4.id, admin.id);
  check("lapsed rejected hold reads as expired", effectiveStatus(lapsed!) === "expired");
  check("submitting on a lapsed hold is refused", (await throws(() => submitPayment(admin.id, rej4.id, { paymentRef: "6667", paymentProofUrl: "/uploads/x.png" }))) !== null);
  // approving a lapsed hold re-checks capacity; there is room here, so it succeeds
  await approveBooking(admin.id, rej4.id);
  check("approve lapsed hold when seats remain", (await getBookingForUser(rej4.id, admin.id))?.status === "approved");

  // 4g. ...but a lapsed hold is refused when the tier has filled up since
  const rej6 = await createBooking(admin.id, { eventId: ev.id, items: [{ tierId: early.id, quantity: 1 }] });
  await db.execute(`update bookings set expires_at = now() - interval '1 minute' where id = '${rej6.id}'`);
  const heldNow = (await tierAvailability(ev.id))(early).held;
  const originalQty = early.quantity;
  await db.execute(`update ticket_tiers set quantity = ${heldNow} where id = '${early.id}'`);
  const overMsg = await throws(() => approveBooking(admin.id, rej6.id));
  await db.execute(`update ticket_tiers set quantity = ${originalQty} where id = '${early.id}'`);
  check("approve lapsed hold refused when tier is full", overMsg !== null && /left/.test(overMsg));
  console.log("  ->", overMsg);

  // 5. expiry
  const exp = await createBooking(admin.id, { eventId: ev.id, items: [{ tierId: early.id, quantity: 1 }] });
  await db.execute(`update bookings set expires_at = now() - interval '1 minute' where id = '${exp.id}'`);
  console.log("expired count:", await expireOverdueBookings(), (await getBookingForUser(exp.id, admin.id))?.status);
  const rej5 = await createBooking(admin.id, { eventId: ev.id, items: [{ tierId: early.id, quantity: 1 }] });
  await submitPayment(admin.id, rej5.id, { paymentRef: "555", paymentProofUrl: "/uploads/x.png" });
  await rejectBooking(admin.id, rej5.id, "Wrong amount");
  await db.execute(`update bookings set expires_at = now() - interval '1 minute' where id = '${rej5.id}'`);
  await expireOverdueBookings();
  check("cron expires lapsed rejected holds", (await getBookingForUser(rej5.id, admin.id))?.status === "expired");

  const first = pb!.tickets[0];
  const all = await db.select({ n: ticketsT.id }).from(ticketsT);
  console.log("TICKET_ID=" + first.id, "total tickets", all.length);
  process.exit(process.exitCode ?? 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
