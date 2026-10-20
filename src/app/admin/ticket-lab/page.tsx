import Link from "next/link";
import { sql } from "drizzle-orm";
import { Download } from "lucide-react";
import { db } from "@/db/client";
import { TICKET_STYLES, events } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { FilterPills } from "@/components/admin/filter-pills";
import { PageHeader } from "@/components/admin/panel";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import { STYLE_META } from "@/lib/tickets/render";
import { renderTicket } from "@/lib/tickets/render/server";
import { sampleTicket } from "@/lib/tickets/sample";
import { cn } from "@/lib/utils";
import { TicketSvg } from "@/components/ticket/ticket-svg";

export const metadata = { title: "Ticket lab" };

type Style = (typeof TICKET_STYLES)[number];

/**
 * The five ticket styles from one signed sample token. A switcher picks the one
 * on the stage (light and dark side by side, PNG downloads for a scan test);
 * the gallery underneath shows them all at a glance.
 */
export default async function TicketLabPage({ searchParams }: PageProps<"/admin/ticket-lab">) {
  await requireAdmin();
  const { style: q } = await searchParams;
  const style: Style = TICKET_STYLES.includes(q as Style) ? (q as Style) : "summit";
  const usage = new Map(
    (await db.select({ style: events.ticketStyle, n: sql<number>`count(*)::int` }).from(events).groupBy(events.ticketStyle)).map((r) => [r.style, r.n]),
  );
  const light = renderTicket(style, sampleTicket("light", env.appUrl));
  const dark = renderTicket(style, sampleTicket("dark", env.appUrl));
  const meta = STYLE_META[style];
  const wide = light.width > light.height;
  const used = usage.get(style) ?? 0;

  return (
    <div className="space-y-[18px]">
      <PageHeader title="Ticket lab" sub="Five ticket styles rendered from the same signed sample token. Download the PNGs and scan each with a phone camera. Choose a style per event under Settings in the event form." />

      <FilterPills label="Ticket style" value={style} options={TICKET_STYLES.map((s) => ({ value: s, label: STYLE_META[s].name, href: `/admin/ticket-lab?style=${s}` }))} />

      <section aria-labelledby="stage-h" className="rounded-[18px] border bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="stage-h" className="flex flex-wrap items-center gap-2 font-display text-xl font-extrabold">
              {meta.name}
              <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground">{style}</span>
              {style === "summit" && <span className="rounded-full bg-success-soft px-2 py-0.5 font-sans text-[11px] font-semibold text-success-foreground">Default for new events</span>}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{meta.blurb}</p>
            <p className="mt-1 text-xs text-muted-foreground">{used ? `Used by ${used} event${used === 1 ? "" : "s"}` : "No events use it yet"}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="h-9 rounded-full px-3.5 text-[13px]"><a href={`/api/ticket-lab/png?style=${style}&theme=light`} download={`bbc-${style}-light.png`}><Download /> PNG light</a></Button>
            <Button asChild variant="outline" className="h-9 rounded-full px-3.5 text-[13px]"><a href={`/api/ticket-lab/png?style=${style}&theme=dark`} download={`bbc-${style}-dark.png`}><Download /> PNG dark</a></Button>
          </div>
        </div>
        <div className={cn("grid gap-4", wide ? "grid-cols-1" : "sm:grid-cols-2")}>
          <figure className="rounded-2xl bg-cream p-4 sm:p-6">
            <TicketSvg svg={light.svg} />
            <figcaption className="bbc-eyebrow mt-3 text-center text-[#5b7060]">Alpine Day</figcaption>
          </figure>
          {/* Always on the night stage: it's what a member sees in dark mode */}
          <figure className="rounded-2xl bg-midnight p-4 sm:p-6">
            <TicketSvg svg={dark.svg} />
            <figcaption className="bbc-eyebrow mt-3 text-center text-[#a9bfae]">Starlit Night</figcaption>
          </figure>
        </div>
      </section>

      <section aria-labelledby="gallery-h" className="space-y-3">
        <h2 id="gallery-h" className="font-display text-lg font-extrabold">All styles</h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {TICKET_STYLES.map((s) => {
            const t = renderTicket(s, sampleTicket("light", env.appUrl));
            const on = s === style;
            return (
              <li key={s}>
                <Link
                  href={`/admin/ticket-lab?style=${s}`}
                  scroll={false}
                  aria-current={on ? "true" : undefined}
                  className={cn("flex h-full flex-col gap-2 rounded-2xl border bg-card p-2.5 transition-colors hover:border-foreground/25", on && "border-primary ring-2 ring-primary/30")}
                >
                  <span className="grid flex-1 place-items-center rounded-xl bg-cream p-2"><TicketSvg svg={t.svg} /></span>
                  <span className="flex items-center justify-between gap-2 px-1">
                    <span className="truncate text-[13px] font-semibold">{STYLE_META[s].name}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{usage.get(s) ?? 0} event{(usage.get(s) ?? 0) === 1 ? "" : "s"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
