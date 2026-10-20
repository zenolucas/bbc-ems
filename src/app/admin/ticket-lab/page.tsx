import { TICKET_STYLES } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import { STYLE_META } from "@/lib/tickets/render";
import { renderTicket } from "@/lib/tickets/render/server";
import { sampleTicket } from "@/lib/tickets/sample";
import { TicketSvg } from "@/components/ticket/ticket-svg";

export const metadata = { title: "Ticket lab" };

export default async function TicketLabPage() {
  await requireAdmin();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ticket lab</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Five candidate ticket styles rendered from the same signed sample token. Download the PNGs and scan each with a phone camera.
          The default for new events is Summit; choose a style per event under Settings in the event form.
        </p>
      </div>
      {TICKET_STYLES.map((style) => {
        const light = renderTicket(style, sampleTicket("light", env.appUrl));
        const dark = renderTicket(style, sampleTicket("dark", env.appUrl));
        const meta = STYLE_META[style];
        return (
          <section key={style} className="rounded-2xl border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{meta.name} <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{style}</span></h2>
                <p className="text-sm text-muted-foreground">{meta.blurb}</p>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline"><a href={`/api/ticket-lab/png?style=${style}&theme=light`} download={`bbc-${style}-light.png`}>PNG light</a></Button>
                <Button asChild size="sm" variant="outline"><a href={`/api/ticket-lab/png?style=${style}&theme=dark`} download={`bbc-${style}-dark.png`}>PNG dark</a></Button>
              </div>
            </div>
            <div className={`grid gap-6 ${light.width > light.height ? "grid-cols-1" : "sm:grid-cols-2"}`}>
              <div className="rounded-xl bg-[#f6f4ec] p-4"><TicketSvg svg={light.svg} /></div>
              <div className="rounded-xl bg-[#1c2f34] p-4"><TicketSvg svg={dark.svg} /></div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
