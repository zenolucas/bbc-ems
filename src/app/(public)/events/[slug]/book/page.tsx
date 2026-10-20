import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getEventBySlug, tierAvailability, tierIsOnSale } from "@/lib/events";
import { fmtRange } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { BookForm } from "./book-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book tickets" };

/** `?q=tierId:2,tierId:1`, written by "Book again" on an expired booking. */
function parseInitial(q: unknown) {
  const out: Record<string, number> = {};
  if (typeof q !== "string") return out;
  for (const part of q.split(",")) {
    const [id, n] = part.split(":");
    const v = Number(n);
    if (id && Number.isInteger(v) && v > 0) out[id] = v;
  }
  return out;
}

export default async function BookPage({ params, searchParams }: PageProps<"/events/[slug]/book">) {
  const { slug } = await params;
  const { q } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/events/${slug}/book${typeof q === "string" ? `?q=${encodeURIComponent(q)}` : ""}`)}`);
  const event = await getEventBySlug(slug);
  if (!event || event.status !== "published") notFound();
  const avail = await tierAvailability(event.id);
  const now = new Date();
  const tiers = event.tiers.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    priceCents: t.priceCents,
    perOrderLimit: t.perOrderLimit,
    remaining: avail(t).remaining,
    onSale: tierIsOnSale(t, now),
  }));
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href={`/events/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to event</Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
        <p className="text-sm text-muted-foreground">{fmtRange(event.startsAt, event.endsAt)} · {event.venueName}</p>
      </div>
      <BookForm eventId={event.id} slug={slug} tiers={tiers} holdHours={event.bookingHoldHours} hasPayment={Boolean(event.gcashNumber || event.gcashQrUrl)} initial={parseInitial(q)} />
    </div>
  );
}
