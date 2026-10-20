import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CalendarDays, ExternalLink, MapPin, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Ridge } from "@/components/event/event-card";
import { getEventBySlug, tierAvailability, tierIsOnSale } from "@/lib/events";
import { fmtRange, peso } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return {};
  const description = event.tagline ?? `${fmtRange(event.startsAt, event.endsAt)} · ${event.venueName}`;
  return {
    title: event.title,
    description,
    openGraph: { title: event.title, description, type: "website", url: `/events/${event.slug}` },
    twitter: { card: "summary_large_image", title: event.title, description },
  };
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const [event, user] = await Promise.all([getEventBySlug(slug), getCurrentUser()]);
  if (!event || (event.status === "draft" && user?.role !== "admin")) notFound();
  const avail = await tierAvailability(event.id);
  const now = new Date();
  const isOver = (event.endsAt ?? new Date(event.startsAt.getTime() + 6 * 3600e3)) < now;
  const anyOnSale = event.tiers.some((t) => tierIsOnSale(t, now) && avail(t).remaining > 0);
  const canBook = event.status === "published" && !isOver && anyOnSale;

  return (
    <article className="space-y-8">
      {event.status === "draft" && <div className="rounded-lg border border-sun bg-sun/15 px-4 py-2 text-sm">Draft preview, only admins can see this page.</div>}
      {event.status === "cancelled" && <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive">This event has been cancelled.</div>}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border">
            {event.coverImageUrl ? (
              <Image src={event.coverImageUrl} alt="" fill unoptimized priority className="object-cover" />
            ) : (
              <div className="bbc-skyline absolute inset-0"><Ridge /></div>
            )}
          </div>
          <header className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{event.title}</h1>
            {event.tagline && <p className="text-lg text-muted-foreground">{event.tagline}</p>}
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-6">
              <span className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" />{fmtRange(event.startsAt, event.endsAt)}</span>
              <span className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                {event.venueName}{event.venueAddress && <span className="text-muted-foreground">· {event.venueAddress}</span>}
                {event.mapUrl && <a href={event.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">Map <ExternalLink className="size-3" /></a>}
              </span>
            </div>
          </header>
          {event.descriptionMd && (
            <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:tracking-tight prose-a:text-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{event.descriptionMd}</ReactMarkdown>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Ticket className="size-5 text-primary" /> Tickets</h2>
            <ul className="mt-4 divide-y">
              {event.tiers.map((t) => {
                const a = avail(t);
                const onSale = tierIsOnSale(t, now);
                const soldOut = a.remaining === 0;
                return (
                  <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                    <div>
                      <div className="font-medium">{t.name}</div>
                      {t.description && <div className="text-sm text-muted-foreground">{t.description}</div>}
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {soldOut ? "Sold out" : !onSale ? (t.salesStart && t.salesStart > now ? "Not on sale yet" : "Sales closed") : a.remaining <= 10 ? `${a.remaining} left` : "Available"}
                      </div>
                    </div>
                    <div className="shrink-0 font-semibold">{peso(t.priceCents)}</div>
                  </li>
                );
              })}
            </ul>
            {canBook ? (
              <Button asChild size="lg" className="mt-4 w-full">
                <Link href={`/events/${event.slug}/book`}>Book tickets</Link>
              </Button>
            ) : (
              <Button size="lg" className="mt-4 w-full" disabled>
                {isOver ? "Event has ended" : event.status !== "published" ? "Not open" : "Sold out"}
              </Button>
            )}
            <p className="mt-3 text-center text-xs text-muted-foreground">Paperless tickets. You&apos;ll get a QR code to show at the door.</p>
          </div>
        </aside>
      </div>
    </article>
  );
}
