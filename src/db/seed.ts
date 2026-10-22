import { nanoid } from "nanoid";
import { db } from "./client";
import { sampleEvents } from "./sample-events";
import { events, ticketTiers } from "./schema";

async function main() {
  for (const { tiers, ...e } of sampleEvents()) {
    const id = nanoid(12);
    await db
      .insert(events)
      .values({ id, ...e })
      .onConflictDoNothing({ target: events.slug });
    const row = await db.query.events.findFirst({ where: (ev, { eq }) => eq(ev.slug, e.slug) });
    if (!row || row.id !== id) continue; // already seeded
    await db.insert(ticketTiers).values(tiers.map((t, i) => ({ id: nanoid(12), eventId: id, sortOrder: i, ...t })));
    console.log("seeded", e.slug);
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
