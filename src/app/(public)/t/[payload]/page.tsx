import { eq } from "drizzle-orm";
import { CheckCircle2, CircleSlash, ShieldAlert, Ticket } from "lucide-react";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { fmtDateTime, fmtRange } from "@/lib/format";
import { verifyToken } from "@/lib/tickets/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify ticket", robots: { index: false } };

export default async function VerifyPage({ params }: PageProps<"/t/[payload]">) {
  const { payload } = await params;
  const v = await verifyToken(decodeURIComponent(payload));
  if (!v.ok) {
    return <Panel tone="bad" icon={<ShieldAlert className="size-8" />} title="Not a valid Baguio Base Camp ticket" body={v.reason === "malformed" ? "This code isn't in our ticket format." : "The signature doesn't match. This ticket may have been altered."} />;
  }
  const t = await db.query.tickets.findFirst({ where: eq(tickets.id, v.parts.ticketId), with: { event: true, tier: true } });
  if (!t || t.eventId !== v.parts.eventId) {
    return <Panel tone="bad" icon={<ShieldAlert className="size-8" />} title="Ticket not found" body="The signature is valid but this ticket no longer exists." />;
  }
  const first = t.holderName.split(" ")[0] || "Guest";
  const meta = (
    <div className="mt-4 space-y-1 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{t.event.title}</p>
      <p>{fmtRange(t.event.startsAt, t.event.endsAt)} · {t.event.venueName}</p>
      <p>{t.tier.name} · {first} · <span className="font-mono">{t.shortCode}</span></p>
    </div>
  );
  if (t.status === "void") return <Panel tone="bad" icon={<CircleSlash className="size-8" />} title="Voided ticket" body="This ticket was cancelled by the organisers.">{meta}</Panel>;
  if (t.status === "used") return <Panel tone="warn" icon={<Ticket className="size-8" />} title="Already checked in" body={`Scanned ${t.checkedInAt ? fmtDateTime(t.checkedInAt) : ""}.`}>{meta}</Panel>;
  return <Panel tone="good" icon={<CheckCircle2 className="size-8" />} title="Valid ticket" body="Not yet checked in. Only the door scanner can mark it used.">{meta}</Panel>;
}

function Panel({ tone, icon, title, body, children }: { tone: "good" | "warn" | "bad"; icon: React.ReactNode; title: string; body: string; children?: React.ReactNode }) {
  const cls = { good: "border-grass/50 bg-fog/60 text-forest dark:text-lime", warn: "border-sun/60 bg-sun/15 text-yellow-800 dark:text-star", bad: "border-destructive/50 bg-destructive/10 text-destructive" }[tone];
  return (
    <div className="mx-auto max-w-md">
      <div className={`rounded-2xl border p-6 ${cls}`}>
        <div className="flex items-center gap-3">{icon}<h1 className="text-xl font-semibold">{title}</h1></div>
        <p className="mt-2 text-sm text-foreground/80">{body}</p>
        {children}
      </div>
    </div>
  );
}
