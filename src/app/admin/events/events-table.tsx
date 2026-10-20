"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CalendarDays, ClipboardCheck, Copy, ExternalLink, MoreHorizontal, Pencil, ScanLine, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/event/status-badge";
import { EventThumb } from "@/components/admin/event-thumb";
import { FilterPills } from "@/components/admin/filter-pills";
import { Meter, SunPill } from "@/components/admin/panel";
import { runAction } from "@/lib/run-action";
import { cn } from "@/lib/utils";
import { duplicateEvent } from "@/app/admin/actions";

export type EventRow = {
  id: string; slug: string; title: string; cover: string | null; status: string; group: "upcoming" | "drafts" | "past";
  venue: string; warning: string | null; draftNote: string | null; day: string; time: string; soon: boolean;
  cap: number; sold: number; pending: number; confirmed: string; past: boolean;
};
type Filter = "upcoming" | "drafts" | "past" | "all";

/** Filter + search in place, then a table from md up and stacked rows on a phone. */
export function EventsTable({ rows }: { rows: EventRow[] }) {
  const counts = { upcoming: 0, drafts: 0, past: 0, all: rows.length };
  for (const r of rows) counts[r.group]++;
  const [filter, setFilter] = useState<Filter>(counts.upcoming ? "upcoming" : "all");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const shown = rows.filter((r) => (filter === "all" || r.group === filter) && (!s || `${r.title} ${r.venue}`.toLowerCase().includes(s)));
    // Upcoming reads soonest first; everything else newest first, as loaded
    return filter === "upcoming" ? [...shown].reverse() : shown;
  }, [rows, filter, q]);

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end">
        <FilterPills
          label="Filter events"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "upcoming", label: "Upcoming", count: counts.upcoming },
            { value: "drafts", label: "Drafts", count: counts.drafts },
            { value: "past", label: "Past", count: counts.past },
            { value: "all", label: "All" },
          ]}
        />
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" aria-hidden />
          <label htmlFor="event-search" className="sr-only">Search events</label>
          <input id="event-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-10 w-full rounded-full border bg-card pr-3.5 pl-9 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-[200px] md:text-[13px]" />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState>{q ? `No events match “${q.trim()}”.` : filter === "drafts" ? "No drafts. New events start here." : "Nothing here yet."}</EmptyState>
      ) : (
        <>
          {/* md and up: the table */}
          <div className="hidden overflow-x-auto rounded-[18px] border bg-card md:block">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                  <th className="border-b px-3 py-3 font-bold">Event</th>
                  <th className="border-b px-3 py-3 font-bold">When</th>
                  <th className="border-b px-3 py-3 font-bold">Status</th>
                  <th className="border-b px-3 py-3 font-bold">Reserved</th>
                  <th className="border-b px-3 py-3 font-bold">To review</th>
                  <th className="border-b px-3 py-3 font-bold">Confirmed</th>
                  <th className="border-b px-3 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className={cn("border-b last:border-b-0", r.status === "draft" && "opacity-85", r.past && "opacity-70")}>
                    <td className="px-3 py-3.5">
                      <Link href={`/admin/events/${r.id}`} className="flex items-center gap-3 rounded-lg outline-none hover:[&_.t]:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                        <EventThumb cover={r.cover} slug={r.slug} status={r.status} />
                        <span className="min-w-0">
                          <span className={cn("t block font-semibold", r.status === "cancelled" && "line-through")}>{r.title}</span>
                          <Sub r={r} />
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <div className="font-semibold">{r.day}</div>
                      <div className={cn("text-xs", r.soon ? "font-semibold text-success-foreground" : "text-muted-foreground")}>{r.time}</div>
                    </td>
                    <td className="px-3 py-3.5"><StatusBadge status={r.status} admin /></td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Meter value={r.cap ? (r.sold / r.cap) * 100 : 0} tone={r.past ? "muted" : "primary"} className="w-20 xl:w-[110px]" />
                        <span className="font-mono text-xs whitespace-nowrap">{r.status === "cancelled" ? "voided" : `${r.sold}/${r.cap}`}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">{r.pending ? <Link href={`/admin/events/${r.id}/bookings`}><SunPill>{r.pending} to review</SunPill></Link> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className={cn("px-3 py-3.5 font-mono text-[13px] whitespace-nowrap", (r.confirmed === "—" || r.confirmed === "Free") && "text-muted-foreground")}>{r.confirmed}</td>
                    <td className="px-3 py-3.5 text-right">
                      {r.status === "draft" ? (
                        <Button asChild size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs"><Link href={`/admin/events/${r.id}`}>Publish checklist</Link></Button>
                      ) : (
                        <RowMenu r={r} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* phones: stacked rows */}
          <ul className="overflow-hidden rounded-[18px] border bg-card md:hidden">
            {list.map((r) => (
              <li key={r.id} className={cn("flex items-start gap-3 border-t px-3.5 py-3 first:border-t-0", r.past && "opacity-75")}>
                <Link href={`/admin/events/${r.id}`} className="flex min-w-0 flex-1 gap-3">
                  <EventThumb cover={r.cover} slug={r.slug} status={r.status} />
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <span className={cn("block truncate text-sm font-semibold", r.status === "cancelled" && "line-through")}>{r.title}</span>
                    <span className={cn("block truncate text-xs", r.soon ? "font-semibold text-success-foreground" : "text-muted-foreground")}>{r.day} · {r.time}</span>
                    <Sub r={r} />
                    <span className="flex items-center gap-2.5">
                      <Meter value={r.cap ? (r.sold / r.cap) * 100 : 0} tone={r.past ? "muted" : "primary"} className="flex-1" />
                      <span className="font-mono text-xs">{r.status === "cancelled" ? "voided" : `${r.sold}/${r.cap}`}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={r.status} admin />
                      {r.pending > 0 && <SunPill>{r.pending} to review</SunPill>}
                      {r.confirmed !== "—" && r.confirmed !== "Free" && <span className="font-mono text-xs text-muted-foreground">{r.confirmed}</span>}
                    </span>
                  </span>
                </Link>
                <RowMenu r={r} />
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-xs text-muted-foreground">Rows open the event overview. Reserved counts holds that haven&apos;t expired. Confirmed is money from approved bookings only.</p>
    </div>
  );
}

function Sub({ r }: { r: EventRow }) {
  if (r.warning) return <span className="block truncate text-xs font-semibold text-destructive">{r.warning}</span>;
  return <span className="block truncate text-xs text-muted-foreground">{r.venue}{r.draftNote ? ` · ${r.draftNote}` : ""}</span>;
}

function RowMenu({ r }: { r: EventRow }) {
  const [pending, start] = useTransition();
  const item = "gap-2";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" className="size-[34px] shrink-0 rounded-full text-muted-foreground" aria-label={`More actions for ${r.title}`} disabled={pending}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild className={item}><Link href={`/admin/events/${r.id}`}><CalendarDays /> Overview</Link></DropdownMenuItem>
        <DropdownMenuItem asChild className={item}><Link href={`/admin/events/${r.id}/bookings`}><ClipboardCheck /> Bookings</Link></DropdownMenuItem>
        <DropdownMenuItem asChild className={item}><Link href={`/admin/events/${r.id}/attendees`}><UsersRound /> Attendees</Link></DropdownMenuItem>
        <DropdownMenuItem asChild className={item}><Link href={`/admin/events/${r.id}/edit`}><Pencil /> Edit</Link></DropdownMenuItem>
        {!r.past && r.status === "published" && <DropdownMenuItem asChild className={item}><Link href={`/admin/scan/${r.id}`}><ScanLine /> Door scanner</Link></DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className={item}><Link href={`/events/${r.slug}`} target="_blank"><ExternalLink /> Public page</Link></DropdownMenuItem>
        <DropdownMenuItem className={item} onSelect={() => start(async () => { await runAction(() => duplicateEvent(r.id)); })}><Copy /> Duplicate</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
