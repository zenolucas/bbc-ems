import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditEventButton } from "@/components/admin/edit-event-button";
import { EventThumb } from "@/components/admin/event-thumb";
import { NavLink } from "@/components/admin/nav-link";
import { StatusBadge } from "@/components/event/status-badge";
import { eventEndsAt, eventStats, getEventById } from "@/lib/events";
import { fmtRange, relative } from "@/lib/format";
import { requireStaff } from "@/lib/session";

const tab = "inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-1 py-2.5 text-sm font-semibold whitespace-nowrap text-muted-foreground hover:text-foreground";
const tabActive = "border-primary text-foreground";

export default async function EventAdminLayout({ children, params }: LayoutProps<"/admin/events/[id]">) {
  const { id } = await params;
  const user = await requireStaff();
  const event = await getEventById(id);
  if (!event) notFound();
  const isAdmin = user.role === "admin";
  const stats = isAdmin ? await eventStats(id) : null;
  const base = `/admin/events/${id}`;
  const now = new Date();
  const happening = event.startsAt <= now && eventEndsAt(event) >= now;
  const past = eventEndsAt(event) < now;
  const status = past && event.status === "published" ? "ended" : event.status;
  return (
    <div className="space-y-[18px]">
      <header className="space-y-3">
        <Link href={isAdmin ? "/admin/events" : "/admin/scan"} className="-ml-1 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground lg:hidden">
          <ChevronLeft className="size-4" aria-hidden /> {isAdmin ? "Events" : "Door scanner"}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <EventThumb cover={event.coverImageUrl} slug={event.slug} status={event.status} className="size-14 rounded-2xl lg:size-[72px]" />
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <h1 className="font-display text-[22px] leading-none font-extrabold tracking-tight lg:text-[28px]">{event.title}</h1>
                <StatusBadge status={status} admin />
              </div>
              <p className="text-[13px] text-muted-foreground lg:text-sm">
                {fmtRange(event.startsAt, event.endsAt)} · {event.venueName}
                {!past && <> · <span className="font-semibold text-foreground">{happening ? "happening now" : relative(event.startsAt)}</span></>}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" className="h-[38px] rounded-full px-3.5 text-[13px]"><Link href={`/events/${event.slug}`} target="_blank"><ExternalLink /> Public page</Link></Button>
            {isAdmin && <EditEventButton href={`${base}/edit`} />}
          </div>
        </div>
      </header>
      <nav aria-label="Event sections" className="-mx-4 flex gap-[22px] overflow-x-auto border-b px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
        {isAdmin && <NavLink href={base} exact className={tab} activeClassName={tabActive}>Overview</NavLink>}
        {isAdmin && (
          <NavLink href={`${base}/bookings`} className={tab} activeClassName={tabActive}>
            Bookings
            {stats && stats.pendingReview > 0 && <span className="rounded-full bg-sun px-[7px] py-px text-[11px] font-bold text-deep-forest tabular-nums dark:bg-star">{stats.pendingReview}<span className="sr-only"> to review</span></span>}
          </NavLink>
        )}
        <NavLink href={`${base}/attendees`} className={tab} activeClassName={tabActive}>
          Attendees
          {stats && stats.issued > 0 && <span className="rounded-full bg-surface-2 px-[7px] py-px text-[11px] font-bold text-muted-foreground tabular-nums">{stats.issued}<span className="sr-only"> tickets</span></span>}
        </NavLink>
        {isAdmin && <NavLink href={`${base}/edit`} className={tab} activeClassName={tabActive}>Edit</NavLink>}
        <NavLink href={`/admin/scan/${id}`} className={tab} activeClassName={tabActive}>Door scanner</NavLink>
      </nav>
      {children}
    </div>
  );
}
