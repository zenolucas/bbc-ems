import Link from "next/link";
import { Skyline } from "@/components/brand/skyline";
import { EventCard, EventRow, PastEventCard, UpNextCard } from "@/components/event/event-card";
import { Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listPublishedEvents } from "@/lib/events";
import { relative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const wrap = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/*
 * Category filter pills (All / Gigs / Outdoors / Free) from the mockup are left
 * out on purpose: events have no category yet, so they would filter nothing.
 */
export default async function Home() {
  const { upcoming, past } = await listPublishedEvents();
  const [upNext, ...rest] = upcoming;
  const when = upNext ? relative(upNext.startsAt) : "";
  return (
    <div data-bleed>
      {/* Day copy is deep forest on the light sky; at night it turns white under the stars */}
      <section className="relative overflow-hidden">
        {/* the box runs past the hero's bottom on wide screens so the crop takes ridge, not sky: the sun and moon stay in view */}
        <Skyline variant="auto" size="hero" seed="home" className="absolute inset-x-0 top-0 h-full lg:h-[calc(100%+7rem)]" />
        <div className={cn(wrap, "relative grid min-h-[330px] items-end gap-8 pt-7 pb-9 sm:min-h-[460px] sm:pt-16 sm:pb-12 lg:grid-cols-[minmax(0,1fr)_380px]")}>
          <div className="flex max-w-[560px] flex-col gap-2.5 self-start sm:gap-4 lg:self-end">
            <p className="bbc-eyebrow text-deep-forest dark:text-star">
              Baguio Base Camp<span className="hidden sm:inline"> · community events</span>
            </p>
            <h1 className="max-w-[300px] text-[38px] leading-[0.98] font-extrabold text-deep-forest sm:max-w-none sm:text-[clamp(40px,5vw,64px)] sm:leading-[0.96] dark:text-white">
              Gigs, meetups &amp; nights out, up in the pines.
            </h1>
            <p className="max-w-[260px] text-sm leading-[1.45] text-[#1b3d33] sm:max-w-[440px] sm:text-[17px] sm:leading-normal dark:text-[#cfe0d6]">
              <span className="sm:hidden">Grab a ticket, show the QR at the door. No paper, no printing.</span>
              <span className="hidden sm:inline">Browse what&apos;s coming up, grab a ticket, and show the QR at the door. No paper, no printing, no queue for the will-call list.</span>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2 sm:gap-2.5">
              <Button asChild size="lg" className="h-[42px] bg-deep-forest px-[18px] text-sm font-semibold text-white hover:bg-deep-forest/85 sm:h-12 sm:px-6 sm:text-[15px] md:h-12 dark:bg-lime dark:text-deep-forest dark:hover:bg-lime/85">
                <Link href="#events">See what&apos;s on</Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="h-[42px] border-deep-forest/20 bg-white/50 px-4 text-sm font-semibold text-deep-forest backdrop-blur-md hover:bg-white/70 sm:hidden dark:border-white/30 dark:bg-white/12 dark:text-white dark:hover:bg-white/20"
              >
                <Link href="/me">My tickets</Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="hidden h-12 border-deep-forest/20 bg-white/50 px-5 text-[15px] font-semibold text-deep-forest backdrop-blur-md hover:bg-white/70 sm:inline-flex dark:border-white/30 dark:bg-white/12 dark:text-white dark:hover:bg-white/20"
              >
                <Link href="/about">How tickets work</Link>
              </Button>
            </div>
          </div>
          {/* Desktop: the next event rides the ridge on the hero's right */}
          {upNext && (
            <div className="hidden justify-self-end lg:block lg:w-full">
              <UpNextCard event={upNext} when={when} variant="hero" />
            </div>
          )}
        </div>
      </section>

      <div id="events" className="scroll-mt-20">
        {upNext ? (
          <>
            <section aria-labelledby="up-next" className={cn(wrap, "flex flex-col gap-3 pt-[22px] lg:hidden")}>
              <div className="flex items-baseline justify-between">
                <h2 id="up-next" className="text-[22px] font-extrabold">Up next</h2>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <span className="size-[7px] rounded-full bg-primary" aria-hidden />
                  {when}
                </span>
              </div>
              <div className="sm:max-w-md">
                <UpNextCard event={upNext} when={when} />
              </div>
            </section>

            {rest.length > 0 && (
              <section aria-labelledby="coming-up" className={cn(wrap, "flex flex-col gap-2.5 pt-[22px] sm:gap-[18px] lg:pt-12")}>
                <h2 id="coming-up" className="text-[22px] font-extrabold sm:text-[30px]">Coming up</h2>
                {/* Phones: compact rows. Wider: the full stub cards. */}
                <Stagger className="flex flex-col gap-2.5 sm:hidden">
                  {rest.map((e) => (
                    <StaggerItem key={e.id}>
                      <EventRow event={e} />
                    </StaggerItem>
                  ))}
                </Stagger>
                <Stagger className="hidden grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6 sm:grid">
                  {rest.map((e) => (
                    <StaggerItem key={e.id}>
                      <EventCard event={e} />
                    </StaggerItem>
                  ))}
                </Stagger>
              </section>
            )}
          </>
        ) : (
          <section aria-label="Upcoming events" className={cn(wrap, "pt-8 sm:pt-12")}>
            <EmptyState
              title="Nothing on the calendar yet"
              className="mx-auto max-w-md"
              action={past.length > 0 ? <Button asChild variant="outline" className="h-10 rounded-full px-[18px]"><Link href="#past">Past events</Link></Button> : undefined}
            >
              The campfire&apos;s still lit, though. Check back soon{past.length > 0 ? ", or see what we did last time." : "."}
            </EmptyState>
          </section>
        )}
      </div>

      {past.length > 0 && (
        <section id="past" aria-labelledby="past-events" className="flex scroll-mt-20 flex-col gap-2.5 pt-[22px] sm:gap-3.5 sm:pt-11">
          <h2 id="past-events" className={cn(wrap, "text-lg font-bold text-muted-foreground sm:text-[22px]")}>Past events</h2>
          {/* Phones: a rail that scrolls sideways. Wider: a grid. */}
          <div className="mx-auto flex w-full max-w-6xl snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-4 sm:overflow-visible sm:px-6">
            {past.map((e) => (
              <div key={e.id} className="w-[170px] shrink-0 snap-start opacity-75 transition-opacity hover:opacity-100 sm:w-auto">
                <PastEventCard event={e} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
