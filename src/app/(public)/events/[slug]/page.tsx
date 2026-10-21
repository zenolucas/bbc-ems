import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { eq } from "drizzle-orm";
import { ArrowUpRight, CalendarDays, ChevronLeft, MapPin, QrCode, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";
import { AvailabilityChip, DateTab, EventPoster, priceSummary, type CardState } from "@/components/event/event-card";
import { ShareButton } from "@/components/event/share-button";
import { WaitlistButton } from "@/components/event/waitlist-button";
import { statusLabel } from "@/components/event/status-badge";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { env } from "@/lib/env";
import { activeBookingFor, getEventBySlug, tierAvailability, tierIsOnSale } from "@/lib/events";
import { fmtDate, fmtDateTime, fmtRange, fmtTime, peso } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { isOnWaitlist } from "@/lib/waitlist";
import { cn } from "@/lib/utils";

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

/** "7:00 PM – 11:00 PM", or the end date too when the event runs past midnight. */
function timeRange(start: Date, end: Date | null) {
  if (!end) return fmtTime(start);
  if (fmtDate(start, "yyyy-MM-dd") === fmtDate(end, "yyyy-MM-dd")) return `${fmtTime(start)} – ${fmtTime(end)}`;
  return `${fmtTime(start)} – ${fmtDate(end, "EEE, MMM d")}, ${fmtTime(end)}`;
}

/** A tier is running low when ten or fewer remain, or under a fifth of its run. */
function isLow(remaining: number, quantity: number) {
  return remaining > 0 && (remaining <= 10 || remaining / quantity <= 0.2);
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
  // Sold out (not "not on sale yet", ended or cancelled): offer the waitlist instead of a dead button
  const soldOut = event.status === "published" && !isOver && !canBook && !nextSale && event.tiers.length > 0;
  const onWaitlist = soldOut && user ? await isOnWaitlist(user.id, event.id) : false;

  // Names on a confirmed booking's tickets, for "Confirmed · Zen, Mika"
  const holders =
    existing?.status === "approved"
      ? [...new Set((await db.query.tickets.findMany({ where: eq(tickets.bookingId, existing.id), columns: { holderName: true } })).map((t) => t.holderName.trim()).filter(Boolean))]
      : [];

  const leftOnSale = event.tiers.filter((t) => tierIsOnSale(t, now)).reduce((n, t) => n + avail(t).remaining, 0);
  const chip: CardState | null =
    event.status === "cancelled" ? "cancelled" : isOver || event.status !== "published" ? null : canBook ? (leftOnSale <= 10 ? "few-left" : null) : nextSale ? "not-on-sale" : "sold-out";
  const maxPerOrder = event.tiers.length ? Math.max(...event.tiers.map((t) => t.perOrderLimit)) : null;
  const shareUrl = `${env.appUrl}/events/${event.slug}`;
  const when = `${fmtDate(event.startsAt, "EEE, MMM d")} · ${fmtTime(event.startsAt)}`;

  const chipEl =
    chip === "sold-out" ? (
      <Badge variant="inverse" className="h-auto px-2.5 py-[5px] text-xs font-bold lg:px-[13px] lg:py-[7px] lg:text-[13px]">Sold out</Badge>
    ) : chip ? (
      <AvailabilityChip state={chip} opens={nextSale} className="lg:px-[13px] lg:py-[7px] lg:text-[13px]" />
    ) : null;

  return (
    <article data-bleed className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 lg:pt-6">
      <Link
        href="/"
        className="mb-5 hidden items-center gap-1.5 self-start rounded text-[13px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 lg:inline-flex"
      >
        <ChevronLeft className="size-4" aria-hidden /> All events
      </Link>

      {(event.status === "draft" || event.status === "cancelled") && (
        <div className="mt-4 mb-4 lg:mt-0 lg:mb-6">
          {event.status === "draft" && <Notice tone="warn" title="Draft preview">Only admins can see this page until it&apos;s published.</Notice>}
          {event.status === "cancelled" && (
            <Notice tone="destructive" title="This event has been cancelled">
              Tickets for it are no longer valid. If you paid, the organisers will contact you about a refund.
            </Notice>
          )}
        </div>
      )}

      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Poster: full-bleed with the title on it on phones, a framed 16:9 on desktop */}
        <div className="lg:col-start-1 lg:row-start-1">
          <div className="relative -mx-4 h-80 overflow-hidden bg-night sm:-mx-6 sm:h-[380px] lg:mx-0 lg:aspect-video lg:h-auto lg:rounded-3xl lg:border">
            <EventPoster event={event} priority />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(11_22_26/0)_40%,rgb(11_22_26/0.85)_100%)] lg:hidden" />
            <div className="absolute inset-x-3 top-2 flex items-center justify-between lg:hidden">
              <Button asChild variant="ghost" size="icon" className="size-10 rounded-full bg-background/85 text-foreground backdrop-blur-md hover:bg-background md:size-10">
                <Link href="/" aria-label="Back to events"><ChevronLeft className="size-5" aria-hidden /></Link>
              </Button>
              <ShareButton url={shareUrl} title={event.title} variant="glass" className="size-10 bg-background/85 text-foreground backdrop-blur-md hover:bg-background md:size-10" />
            </div>
            <DateTab date={event.startsAt} size="lg" className="absolute top-16 left-3 lg:hidden" />
            <DateTab date={event.startsAt} size="xl" className="absolute top-4 left-4 hidden lg:block" />
            {chipEl && <div className="absolute top-[68px] right-3 lg:top-4 lg:right-4">{chipEl}</div>}
            <div className="absolute inset-x-5 bottom-[18px] flex flex-col gap-1.5 text-white lg:hidden">
              <p className="bbc-eyebrow text-star">{when}</p>
              <h1 className="text-[32px] leading-none font-extrabold">{event.title}</h1>
              {event.tagline && <p className="text-sm text-white/85">{event.tagline}</p>}
            </div>
          </div>

          {/* Phones: when and where under the poster */}
          <div className="flex flex-col gap-2.5 pt-4 text-sm sm:px-1 lg:hidden">
            <div className="flex items-start gap-2.5">
              <CalendarDays className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden />
              <div>
                <div className="font-semibold">{fmtDate(event.startsAt, "EEEE, MMM d, yyyy")}</div>
                <div className="text-[13px] text-muted-foreground">{timeRange(event.startsAt, event.endsAt)}</div>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <div className="font-semibold">{event.venueName}</div>
                {(event.venueAddress || event.mapUrl) && (
                  <div className="text-[13px] text-muted-foreground">
                    {event.venueAddress}
                    {event.venueAddress && event.mapUrl && " · "}
                    {event.mapUrl && <MapLink href={event.mapUrl}>Open map</MapLink>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Desktop: the headline block under the poster */}
          <header className="mt-6 hidden flex-col gap-3 lg:flex">
            <p className="bbc-eyebrow text-primary">{fmtDate(event.startsAt, "EEE, MMM d")}</p>
            <h1 className="text-[clamp(32px,4vw,48px)] leading-none font-extrabold">{event.title}</h1>
            {event.tagline && <p className="text-lg text-muted-foreground">{event.tagline}</p>}
            <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
              <span className="flex items-center gap-2.5">
                <CalendarDays className="size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-semibold">{fmtDate(event.startsAt, "EEE, MMM d, yyyy")}</span>{" "}
                  <span className="text-muted-foreground">· {timeRange(event.startsAt, event.endsAt)}</span>
                </span>
              </span>
              <span className="flex items-center gap-2.5">
                <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-semibold">{event.venueName}</span>
                  {event.venueAddress && <span className="text-muted-foreground"> · {event.venueAddress}</span>}
                  {event.mapUrl && <> · <MapLink href={event.mapUrl}>Map</MapLink></>}
                </span>
              </span>
            </div>
          </header>
        </div>

        <aside className="mt-[18px] flex flex-col gap-3 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:self-start">
          <section aria-labelledby="tickets-heading" className="flex flex-col rounded-[22px] border bg-card p-4 pb-3.5 lg:rounded-3xl lg:p-5">
            <div className="flex items-center justify-between gap-3 pb-2 lg:pb-2.5">
              <h2 id="tickets-heading" className="flex items-center gap-2 text-xl font-extrabold lg:text-[22px]">
                <Ticket className="size-5 text-primary" aria-hidden /> Tickets
              </h2>
              {maxPerOrder && canBook && <span className="text-xs text-muted-foreground">max {maxPerOrder} per order</span>}
            </div>

            {existing && (
              <div
                role="status"
                className={cn(
                  "mb-1 flex items-center justify-between gap-2.5 rounded-[14px] px-3.5 py-3",
                  existing.status === "approved" ? "bg-success-soft" : existing.status === "under_review" ? "bg-info-soft" : "bg-warning-soft",
                )}
              >
                <div className="min-w-0 text-[13px] leading-[1.4]">
                  <p
                    className={cn(
                      "font-bold",
                      existing.status === "approved" ? "text-success-foreground" : existing.status === "under_review" ? "text-info-foreground" : "text-warning-foreground",
                    )}
                  >
                    {existing.status === "approved" ? `You have ${existingCount} ticket${existingCount === 1 ? "" : "s"}` : `You have a booking: ${statusLabel(existing.status).toLowerCase()}`}
                  </p>
                  <p className="text-muted-foreground">
                    {existing.status === "approved"
                      ? ["Confirmed", holders.length > 3 ? `${holders.slice(0, 3).join(", ")} +${holders.length - 3}` : holders.join(", ")].filter(Boolean).join(" · ")
                      : existing.status === "pending_payment"
                        ? "Finish paying to keep your hold."
                        : existing.status === "rejected"
                          ? "Your payment needs another look."
                          : "Receipt received, an organiser is checking it."}
                  </p>
                </div>
                <Button asChild size="sm" className="h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold md:h-9">
                  <Link href={`/bookings/${existing.id}`}>{existing.status === "approved" ? "View tickets" : "Open booking"}</Link>
                </Button>
              </div>
            )}

            <ul>
              {event.tiers.map((t) => {
                const a = avail(t);
                const onSale = tierIsOnSale(t, now);
                const soldOut = a.remaining === 0;
                const note = soldOut ? "sold out" : !onSale ? (t.salesStart && t.salesStart > now ? `on sale ${fmtDate(t.salesStart, "MMM d, h:mm a")}` : "sales closed") : null;
                const low = onSale && isLow(a.remaining, t.quantity);
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 border-t py-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div>
                        <div className={cn("font-semibold", (soldOut || !onSale) && "text-muted-foreground", soldOut && "line-through")}>{t.name}</div>
                        {(t.description || note) && <div className="text-xs text-muted-foreground">{[t.description, note].filter(Boolean).join(" · ")}</div>}
                      </div>
                      {low && (
                        <div className="flex items-center gap-2">
                          <div aria-hidden className="h-[5px] max-w-[140px] flex-1 overflow-hidden rounded-full bg-surface-3 lg:max-w-40">
                            <div className="h-full rounded-full bg-warning" style={{ width: `${Math.round((a.held / t.quantity) * 100)}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-warning-foreground">{a.remaining} left</span>
                        </div>
                      )}
                    </div>
                    <div className={cn("shrink-0 font-display text-[17px] font-extrabold lg:text-lg", soldOut ? "text-muted-foreground line-through" : t.priceCents === 0 && "text-primary")}>
                      {peso(t.priceCents)}
                    </div>
                  </li>
                );
              })}
            </ul>

            {canBook ? (
              <Button asChild size="lg" className="mt-3 h-12 w-full text-[15px] font-semibold md:h-12 lg:h-[50px]" variant={existing ? "outline" : "default"}>
                <Link href={`/events/${event.slug}/book`}>{existing ? "Book more tickets" : "Book tickets"}</Link>
              </Button>
            ) : soldOut && !existing ? (
              <>
                <Button size="lg" className="mt-3 h-12 w-full text-[15px] md:h-12 lg:h-[50px]" disabled>{closedLabel}</Button>
                <WaitlistButton eventId={event.id} slug={event.slug} onList={onWaitlist} signedIn={!!user} className="mt-2 h-12 w-full text-[15px] font-semibold md:h-12" />
                <p className="mt-2 text-center text-xs text-muted-foreground">Holds lapse and plans change. Everyone on the list hears at once when seats free up.</p>
              </>
            ) : (
              <Button size="lg" className="mt-3 h-12 w-full text-[15px] md:h-12 lg:h-[50px]" disabled>{closedLabel}</Button>
            )}
            {!canBook && nextSale && !isOver && event.status === "published" && (
              <p className="mt-2 text-center text-xs text-muted-foreground">Next tickets go on sale {fmtDateTime(nextSale)}.</p>
            )}
            <p className="mt-2.5 text-center text-xs text-muted-foreground">Paperless. You&apos;ll get a QR to show at the door.</p>
          </section>

          <div className="hidden items-center justify-between gap-3 rounded-[18px] border bg-card px-4 py-3.5 text-[13px] lg:flex">
            <div className="min-w-0">
              <div className="font-semibold">Share this event</div>
              <div className="break-all text-muted-foreground">{shareUrl.replace(/^https?:\/\//, "")}</div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <CopyButton value={shareUrl} label="link" className="size-[38px] rounded-full md:size-[38px]" />
              <ShareButton url={shareUrl} title={event.title} className="size-[38px] md:size-[38px]" />
            </div>
          </div>
        </aside>

        <div className="lg:col-start-1 lg:row-start-2">
          {event.descriptionMd && (
            <div className="prose prose-neutral mt-5 max-w-none text-[15px] sm:px-1 lg:mt-6 lg:px-0 dark:prose-invert prose-headings:font-display prose-headings:tracking-tight prose-headings:text-foreground prose-h2:mt-6 prose-h2:mb-2 prose-h2:text-xl prose-h3:mt-[18px] prose-h3:mb-1.5 prose-h3:text-[17px] prose-p:my-2 prose-p:text-muted-foreground prose-a:text-accent-foreground prose-strong:text-foreground prose-ul:my-0 prose-ul:pl-[18px] prose-ol:my-0 prose-li:my-0 prose-li:leading-[1.6] prose-li:text-muted-foreground prose-li:marker:text-muted-foreground [&>:first-child]:mt-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{event.descriptionMd}</ReactMarkdown>
            </div>
          )}
          <div className="mt-5 grid gap-4 lg:mt-6 lg:grid-cols-2">
            <InfoCard icon={<Users className="size-[22px]" aria-hidden />}>
              <span className="font-semibold">Bringing friends?</span>{" "}
              <span className="text-muted-foreground">Book up to {maxPerOrder ?? 4}, then put each name on its ticket and send them their QR.</span>
            </InfoCard>
            <InfoCard icon={<QrCode className="size-[22px]" aria-hidden />} className="hidden lg:flex">
              <span className="font-semibold">Paperless.</span>{" "}
              <span className="text-muted-foreground">Your QR lives under My tickets and in your inbox. Works without signal.</span>
            </InfoCard>
          </div>
        </div>
      </div>

      {/* Phones: the ticket box sits above a long description, so keep the main action reachable */}
      <div data-sticky-cta className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/92 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-extrabold">{existing ? (existing.status === "approved" ? "You're going" : "Booking in progress") : priceFrom}</div>
            <div className="truncate text-xs text-muted-foreground">
              {when}
              {canBook && chip === "few-left" && ` · ${leftOnSale} left`}
            </div>
          </div>
          {existing ? (
            <Button asChild size="lg" className="h-12 shrink-0 px-[22px] text-[15px] font-semibold md:h-12">
              <Link href={`/bookings/${existing.id}`}>{existing.status === "approved" ? "View tickets" : "Open booking"}</Link>
            </Button>
          ) : canBook ? (
            <Button asChild size="lg" className="h-12 shrink-0 px-[22px] text-[15px] font-semibold md:h-12">
              <Link href={`/events/${event.slug}/book`}>Book tickets</Link>
            </Button>
          ) : soldOut ? (
            <WaitlistButton compact eventId={event.id} slug={event.slug} onList={onWaitlist} signedIn={!!user} className="h-12 shrink-0 px-4 text-sm font-semibold md:h-12" />
          ) : (
            <Button size="lg" className="h-12 shrink-0 md:h-12" disabled>{closedLabel}</Button>
          )}
        </div>
      </div>
    </article>
  );
}

function MapLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent-foreground underline-offset-2 hover:underline">
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden />
    </a>
  );
}

function InfoCard({ icon, children, className }: { icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-[18px] border bg-card px-4 py-3.5 lg:gap-3.5 lg:p-4", className)}>
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-success-soft text-primary lg:size-12">{icon}</div>
      <p className="text-[13px] leading-[1.45] lg:text-sm">{children}</p>
    </div>
  );
}
