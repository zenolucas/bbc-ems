import Image from "next/image";
import { EventCard, Ridge } from "@/components/event/event-card";
import { EmptyState } from "@/components/ui/empty-state";
import { listPublishedEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { upcoming, past } = await listPublishedEvents();
  return (
    <div className="space-y-12">
      <section className="bbc-skyline relative overflow-hidden rounded-3xl px-6 py-14 text-white sm:px-10 sm:py-20">
        <Ridge className="opacity-90" />
        <div className="relative z-10 max-w-xl">
          <div className="mb-4 flex items-center gap-3">
            <Image src="/brand/bbc-logo.png" alt="" width={56} height={56} className="drop-shadow" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Baguio Base Camp</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Gigs, meetups &amp; nights out, up in the pines.</h1>
          <p className="mt-4 max-w-md text-white/85">Browse what&apos;s coming up, grab a ticket, and show the QR at the door. No paper, no printing.</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Upcoming</h2>
        {upcoming.length === 0 ? (
          <EmptyState>Nothing on the calendar yet. Check back soon.</EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
        )}
      </section>

      {past.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight text-muted-foreground">Past events</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{past.map((e) => <EventCard key={e.id} event={e} past />)}</div>
        </section>
      )}
    </div>
  );
}
