import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/admin/nav-link";
import { StatusBadge } from "@/components/event/status-badge";
import { eventStats, getEventById } from "@/lib/events";
import { fmtRange } from "@/lib/format";
import { requireStaff } from "@/lib/session";

const tab = "shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground";
const tabActive = "border-primary font-medium text-foreground";

export default async function EventAdminLayout({ children, params }: LayoutProps<"/admin/events/[id]">) {
  const { id } = await params;
  const user = await requireStaff();
  const event = await getEventById(id);
  if (!event) notFound();
  const isAdmin = user.role === "admin";
  const stats = isAdmin ? await eventStats(id) : null;
  const base = `/admin/events/${id}`;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href={isAdmin ? "/admin/events" : "/admin/scan"} className="hover:text-foreground">{isAdmin ? "Events" : "Scanner"}</Link>
          <ChevronRight className="size-4" aria-hidden />
          <span className="truncate text-foreground">{event.title}</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
              <StatusBadge status={event.status} admin />
            </div>
            <p className="text-sm text-muted-foreground">{fmtRange(event.startsAt, event.endsAt)} · {event.venueName}</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link href={`/events/${event.slug}`} target="_blank"><ExternalLink /> Public page</Link></Button>
        </div>
        <nav aria-label="Event sections" className="-mx-4 flex overflow-x-auto border-b px-4">
          {isAdmin && <NavLink href={base} exact className={tab} activeClassName={tabActive}>Overview</NavLink>}
          {isAdmin && (
            <NavLink href={`${base}/bookings`} className={tab} activeClassName={tabActive}>
              Bookings{stats && stats.pendingReview > 0 && <span className="ml-1.5 rounded-full bg-sun px-1.5 text-xs font-semibold text-deep-forest">{stats.pendingReview}</span>}
            </NavLink>
          )}
          <NavLink href={`${base}/attendees`} className={tab} activeClassName={tabActive}>Attendees</NavLink>
          {isAdmin && <NavLink href={`${base}/edit`} className={tab} activeClassName={tabActive}>Edit</NavLink>}
          <NavLink href={`/admin/scan/${id}`} className={tab} activeClassName={tabActive}>Door scanner</NavLink>
        </nav>
      </div>
      {children}
    </div>
  );
}
