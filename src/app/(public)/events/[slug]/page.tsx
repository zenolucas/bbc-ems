import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CalendarDays, ExternalLink, MapPin, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Ridge, priceSummary } from "@/components/event/event-card";
import { statusLabel } from "@/components/event/status-badge";
import { activeBookingFor, getEventBySlug, tierAvailability, tierIsOnSale } from "@/lib/events";
import { fmtDateTime, fmtRange, peso } from "@/lib/format";
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
  const existing = user ? await activeBookingFor(user.id, event.id) : null;
  const existingCount = existing?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const nextSale = event.tiers.map((t) => t.salesStart).filter((d): d is Date => !!d && d > now).sort((a, b) => a.getTime() - b.getTime())[0];
  const closedLabel =
    event.status === "cancelled" ? "Event cancelled" : isOver ? "Event has ended" : event.status !== "published" ? "Not open yet" : nextSale && !anyOnSale ? "Sales open soon" : "Sold out";
  const priceFrom = priceSummary(event.tiers);

  return (
    <article className="space-y-8">
      {event.status === "draft" && <Notice tone="warn" title="Draft preview">Only admins can see this page until it&apos;s published.</Notice>}
      {event.status === "cancelled" && (
        <Notice tone="destructive" title="This event has been cancelled">
          Tickets for it are no longer valid. If you paid, the organisers will contact you about a refund.
        </Notice>
      )}

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
              <span className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />{fmtRange(event.startsAt, event.endsAt)}</span>
              <span className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  {event.venueName}{event.venueAddress && <span className="text-muted-foreground"> · {event.venueAddress}</span>}
                  {event.mapUrl && <> <a href={event.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-primary underline-offset-2 hover:underline">Map <ExternalLink className="size-3" /></a></>}
                </span>
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
            {existing && (
              <Notice
                tone={existing.status === "approved" ? "success" : existing.status === "rejected" ? "warn" : "info"}
                className="mt-4"
                title={existing.status === "approved" ? `You have ${existingCount} ticket${existingCount === 1 ? "" : "s"}` : `You have a booking: ${statusLabel(existing.status).toLowerCase()}`}
                actions={<Button asChild size="sm" variant="outline"><Link href={`/bookings/${existing.id}`}>{existing.status === "approved" ? "View tickets" : "Open booking"}</Link></Button>}
              >
                {existing.status === "pending_payment" ? "Finish paying to keep your hold." : existing.status === "rejected" ? "Your payment needs another look." : null}
              </Notice>
            )}
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
              <Button asChild size="lg" className="mt-4 w-full" variant={existing ? "outline" : "default"}>
                <Link href={`/events/${event.slug}/book`}>{existing ? "Book more tickets" : "Book tickets"}</Link>
              </Button>
            ) : (
              <Button size="lg" className="mt-4 w-full" disabled>{closedLabel}</Button>
            )}
            {!canBook && nextSale && !isOver && event.status === "published" && (
              <p className="mt-2 text-center text-xs text-muted-foreground">Next tickets go on sale {fmtDateTime(nextSale)}.</p>
            )}
            <p className="mt-3 text-center text-xs text-muted-foreground">Paperless tickets. You&apos;ll get a QR code to show at the door.</p>
          </div>
        </aside>
      </div>

      {/* Phones: the ticket box sits under the full description, so keep the main action reachable */}
      <div data-sticky-cta className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            <div className="truncate font-semibold">{existing ? (existing.status === "approved" ? "You're going" : "Booking in progress") : priceFrom}</div>
            <div className="truncate text-xs text-muted-foreground">{fmtRange(event.startsAt, event.endsAt)}</div>
          </div>
          {existing ? (
            <Button asChild size="lg"><Link href={`/bookings/${existing.id}`}>{existing.status === "approved" ? "View tickets" : "Open booking"}</Link></Button>
          ) : canBook ? (
            <Button asChild size="lg"><Link href={`/events/${event.slug}/book`}>Book tickets</Link></Button>
          ) : (
            <Button size="lg" disabled>{closedLabel}</Button>
          )}
        </div>
      </div>
    </article>
  );
}
