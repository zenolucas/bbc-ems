import { nanoid } from "nanoid";
import { db } from "./client";
import { events, ticketTiers } from "./schema";

const day = 86400e3;
const at = (daysFromNow: number, hour: number) => {
  const d = new Date(Date.now() + daysFromNow * day);
  // 18:00 Manila = 10:00 UTC
  d.setUTCHours(hour - 8, 0, 0, 0);
  return d;
};

const sample = [
  {
    slug: "base-camp-sessions-vol-3",
    title: "Base Camp Sessions Vol. 3",
    tagline: "Live sets, cold nights, warm people.",
    venueName: "Canto, Ketchup Food Community",
    venueAddress: "Romulo Dr, Baguio City",
    startsAt: at(12, 19),
    endsAt: at(12, 23),
    status: "published" as const,
    ticketStyle: "summit" as const,
    descriptionMd: "## Lineup\n- Last Set Syndrome\n- The Pine Needles\n- DJ Fogline\n\n## House rules\n- Doors 7 PM, first act 8 PM\n- Bring a jacket, it's Baguio\n- Tickets are per person and scanned once at the door",
    gcashName: "Baguio Base Camp",
    gcashNumber: "0917 000 0000",
    paymentInstructions: "Put your name in the GCash note and send the exact amount.",
    tiers: [
      { name: "Early Bird", description: "First 30 only", priceCents: 25000, quantity: 30, perOrderLimit: 4 },
      { name: "Regular", description: "Includes one drink", priceCents: 35000, quantity: 120, perOrderLimit: 4 },
      { name: "Crew / Guest list", description: "Invite only", priceCents: 0, quantity: 20, perOrderLimit: 2 },
    ],
  },
  {
    slug: "sunrise-hike-mt-yangbew",
    title: "Sunrise Hike: Mt. Yangbew",
    tagline: "Easy 40-minute hike, big views, bring coffee.",
    venueName: "Mt. Yangbew jump-off",
    venueAddress: "Tawang, La Trinidad, Benguet",
    startsAt: at(20, 5),
    endsAt: at(20, 9),
    status: "published" as const,
    ticketStyle: "trail-pass" as const,
    descriptionMd: "Meetup at the jump-off at 5:00 AM sharp. Headlamps recommended. We carpool back to town for breakfast.",
    tiers: [{ name: "Hiker", description: "Free, just so we know headcount", priceCents: 0, quantity: 40, perOrderLimit: 3 }],
  },
  {
    slug: "anime-night-akatsuki-edition",
    title: "Anime Night: Akatsuki Edition",
    tagline: "Cloaks encouraged. Rain expected.",
    venueName: "Baden Powell Hall",
    venueAddress: "Gov. Pack Rd, Baguio City",
    startsAt: at(35, 18),
    endsAt: at(35, 22),
    status: "draft" as const,
    ticketStyle: "night-sky" as const,
    descriptionMd: "Screening, cosplay walk, and a very serious trivia round.",
    gcashName: "Baguio Base Camp",
    gcashNumber: "0917 000 0000",
    tiers: [{ name: "Entry", priceCents: 15000, quantity: 80, perOrderLimit: 4 }],
  },
];

async function main() {
  for (const { tiers, ...e } of sample) {
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
