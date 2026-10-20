import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TrailSteps } from "@/components/ui/trail-steps";
import { getEventBySlug, tierAvailability, tierIsOnSale } from "@/lib/events";
import { fmtDate, fmtTime } from "@/lib/format";
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
    <div className="mx-auto max-w-xl lg:max-w-4xl">
      <div className="-mt-4 flex items-center gap-2 lg:mt-0">
        <Link href={`/events/${slug}`} aria-label="Back to event" className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-muted"><ChevronLeft className="size-[22px]" /></Link>
        <span className="text-[15px] font-semibold">Book tickets</span>
      </div>
      <div className="mt-1 space-y-1">
        <h1 className="text-2xl leading-[1.05] font-extrabold tracking-tight lg:text-3xl">{event.title}</h1>
        <p className="text-[13px] text-muted-foreground">{fmtDate(event.startsAt, "EEE, MMM d")} · {fmtTime(event.startsAt)} · {event.venueName}</p>
      </div>
      <TrailSteps
        className="mt-5 lg:max-w-md"
        steps={[
          { label: "Pick", status: "current" },
          { label: "Pay", status: "pending" },
          { label: "Ticket", status: "pending" },
        ]}
      />
      <BookForm eventId={event.id} slug={slug} tiers={tiers} holdHours={event.bookingHoldHours} hasPayment={Boolean(event.gcashNumber || event.gcashQrUrl)} initial={parseInitial(q)} />
    </div>
  );
}
