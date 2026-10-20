import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { events, users } from "../src/db/schema";
import { createBooking } from "../src/lib/bookings";
(async () => {
  const admin = (await db.select().from(users).where(eq(users.email, "zenolucas@gmail.com")))[0];
  const ev = await db.query.events.findFirst({ where: eq(events.slug, "base-camp-sessions-vol-3"), with: { tiers: true } });
  const early = ev!.tiers.find((t) => t.name === "Early Bird")!;
  try { await createBooking(admin.id, { eventId: ev!.id, items: [{ tierId: early.id, quantity: 3 }, { tierId: early.id, quantity: 3 }] }); console.log("UNEXPECTED"); }
  catch (e) { console.log("guard ok:", (e as Error).message); }
  process.exit(0);
})();
