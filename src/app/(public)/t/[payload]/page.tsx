import Link from "next/link";
import { eq } from "drizzle-orm";
import { Check, CircleSlash, ShieldAlert, Ticket } from "lucide-react";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtDateTime, fmtRange, fmtTime } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { verifyToken } from "@/lib/tickets/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify ticket", robots: { index: false } };

/*
 * What a phone camera opens when someone scans a ticket QR outside the door
 * scanner. Read-only and server-rendered: no client JS beyond the shell.
 */
export default async function VerifyPage({ params }: PageProps<"/t/[payload]">) {
  const { payload } = await params;
  const v = await verifyToken(decodeURIComponent(payload));
  if (!v.ok) {
    return (
      <Result
        tone="bad"
        icon={<ShieldAlert />}
        title="Not a Baguio Base Camp ticket"
        body={v.reason === "malformed" ? "This code isn't in our ticket format, so it isn't one of ours." : "The signature doesn't match. This code may have been altered, or it isn't one of ours."}
        footer="Nothing was recorded. This page never checks anyone in."
      >
        <SecondHand />
      </Result>
    );
  }
  const t = await db.query.tickets.findFirst({ where: eq(tickets.id, v.parts.ticketId), with: { event: true, tier: true } });
  if (!t || t.eventId !== v.parts.eventId) {
    return (
      <Result tone="bad" icon={<ShieldAlert />} title="Ticket not found" body="The signature is valid but this ticket no longer exists." footer="Nothing was recorded. This page never checks anyone in.">
        <SecondHand />
      </Result>
    );
  }
  const first = t.holderName.split(" ")[0] || "Guest";
  const meta = (
    <div className="w-full space-y-1.5 rounded-[18px] border bg-card px-4 py-3.5 text-left">
      <p className="font-display text-[17px] font-bold tracking-tight">{t.event.title}</p>
      <p className="text-[13px] text-muted-foreground">{fmtRange(t.event.startsAt, t.event.endsAt)}</p>
      <p className="text-[13px] text-muted-foreground">{t.event.venueName}</p>
      <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-dashed pt-2.5 text-[13px]">
        <span className="min-w-0 truncate">{t.tier.name} · <span className="font-semibold">{first}</span></span>
        <span className="shrink-0 font-mono font-bold tracking-[0.06em]">{t.shortCode}</span>
      </div>
    </div>
  );
  const viewer = await getCurrentUser();
  const ownerLink = viewer?.id === t.userId ? (
    <Link href={`/tickets/${t.id}`} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-accent-foreground hover:underline">This is mine — open it in My tickets</Link>
  ) : null;

  if (t.event.status === "cancelled") {
    return <Result tone="bad" icon={<CircleSlash />} title="Event cancelled" body="This event was cancelled, so its tickets are no longer valid." footer="Nothing was recorded. This page never checks anyone in.">{meta}{ownerLink}</Result>;
  }
  if (t.status === "void") {
    return <Result tone="bad" icon={<CircleSlash />} title="Voided ticket" body="This ticket was cancelled by the organisers, so it won't scan at the door." footer="Think this is a mistake? Message the organisers.">{meta}{ownerLink}</Result>;
  }
  if (t.status === "used") {
    return (
      <Result
        tone="warn"
        icon={<Ticket />}
        title="Already checked in"
        body={`Scanned ${t.checkedInAt ? `${fmtDate(t.checkedInAt, "EEE, MMM d")} · ${fmtTime(t.checkedInAt)}` : "at the door"}. A second scan at the door will be turned away.`}
        footer="Think this is a mistake? Find the door crew; they can undo a check-in."
      >
        {meta}
        {ownerLink}
        {t.checkedInAt && <p className="sr-only">Checked in {fmtDateTime(t.checkedInAt)}</p>}
      </Result>
    );
  }
  return (
    <Result
      tone="good"
      icon={<Check strokeWidth={2.6} />}
      title="Valid ticket"
      body="Not checked in yet. Only the door scanner can mark it used, so this page never changes anything."
      footer="Signed with the organiser's key. Forged codes fail this check, even offline."
    >
      {meta}
      {ownerLink}
    </Result>
  );
}

/** For the code that fails: what a real ticket looks like, and where to go instead. */
function SecondHand() {
  return (
    <>
      <div className="w-full rounded-[18px] border border-dashed border-destructive bg-card px-4 py-3.5 text-left text-[13px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Bought this from someone?</span> Real tickets come from this site, under My tickets, with a code like{" "}
        <span className="font-mono text-foreground">BBC-XXXX-XXXX</span>. Ask the seller to transfer it by naming you on the ticket.
      </div>
      <Button asChild size="lg" className="h-11 px-5 text-sm md:h-11">
        <Link href="/">See what&apos;s on</Link>
      </Button>
    </>
  );
}

const tones = {
  good: { seal: "bg-success-soft text-success-foreground", eyebrow: "text-success-foreground" },
  warn: { seal: "bg-warning-soft text-warning-foreground", eyebrow: "text-warning-foreground" },
  bad: { seal: "bg-destructive-soft text-destructive", eyebrow: "text-destructive" },
} as const;

/** Full-height verdict: a double-ring seal in the tone's soft colour, the title, the ticket, one calm line at the foot. */
function Result({ tone, icon, title, body, footer, children }: { tone: keyof typeof tones; icon: React.ReactNode; title: string; body: string; footer: string; children?: React.ReactNode }) {
  const t = tones[tone];
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-14rem)] max-w-md flex-col">
      <div role={tone === "bad" ? "alert" : "status"} className="flex flex-1 flex-col items-center gap-[18px] px-2 pt-4 text-center sm:pt-8">
        <div className={cn("relative grid size-[148px] place-items-center rounded-full [&_svg]:size-16", t.seal)}>
          <span aria-hidden className="absolute inset-2 rounded-full border-[3px] border-double border-current opacity-70" />
          {icon}
        </div>
        <div className="space-y-2">
          <p className={cn("bbc-eyebrow", t.eyebrow)}>Ticket check</p>
          <h1 className="text-[32px] leading-none font-extrabold tracking-tight text-balance">{title}</h1>
          <p className="text-[15px] leading-normal text-pretty text-muted-foreground">{body}</p>
        </div>
        {children}
      </div>
      <p className="px-4 pt-10 text-center text-xs leading-normal text-muted-foreground">{footer}</p>
    </div>
  );
}
