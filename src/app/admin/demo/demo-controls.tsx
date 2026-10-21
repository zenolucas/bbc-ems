"use client";
import { Loader2, RotateCcw, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { runAction } from "@/lib/run-action";
import { clearOutboxAction, resetDemoAction, runCronAction, setDemoSettingAction } from "./actions";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function DemoControls({ enabled, autoApprove }: { enabled: boolean; autoApprove: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"cron" | null>(null);

  const toggle = (key: "enabled" | "autoApprove", value: boolean, success: string) =>
    start(async () => {
      if (await runAction(() => setDemoSettingAction(key, value), { success })) router.refresh();
    });

  return (
    <section aria-labelledby="switches-h" className="overflow-hidden rounded-[18px] border bg-card">
      <h2 id="switches-h" className="sr-only">Switches</h2>
      <Row
        title="Demo mode"
        detail="One-tap sign-in as Mara (member), Jun (door crew) or Bea (organiser), sample receipts, and the time and scanner shortcuts. Off, the site behaves like the real one, with email still going to the outbox."
      >
        <Switch checked={enabled} disabled={pending} onCheckedChange={(v) => toggle("enabled", v, v ? "Demo mode on" : "Demo mode off")} aria-label="Demo mode" />
      </Row>
      <Row
        title="Auto-approve payments"
        detail="Confirms a booking the moment the receipt is submitted, so tickets show straight away. Leave off to walk through the review queue as Bea."
      >
        <Switch checked={autoApprove} disabled={pending || !enabled} onCheckedChange={(v) => toggle("autoApprove", v, v ? "Payments now auto-approve" : "Payments wait for review")} aria-label="Auto-approve payments" />
      </Row>
      <Row title="Run the cron now" detail="Expires lapsed holds, sends reminders and tells waitlists about free seats. The real one runs every 15 minutes.">
        <Button
          variant="outline"
          className="rounded-full"
          disabled={!enabled || busy === "cron"}
          onClick={async () => {
            setBusy("cron");
            const ok = await runAction(() => runCronAction(), {
              success: (r) => `Expired ${plural(r.expired, "hold")}, sent ${plural(r.reminded, "reminder")}, told ${plural(r.waitlisted, "person", "people")} on waitlists`,
            });
            setBusy(null);
            if (ok) router.refresh();
          }}
        >
          {busy === "cron" ? <Loader2 className="animate-spin" /> : <Timer />} Run cron
        </Button>
      </Row>
      <Row title="Reset demo data" detail="Puts every event, booking, ticket and waitlist back to the starting story and empties the outbox. Mara, Jun and Bea stay signed in.">
        <ConfirmDialog
          trigger={(open) => (
            <Button variant="destructive" className="rounded-full" onClick={open}>
              <RotateCcw /> Reset
            </Button>
          )}
          title="Reset the demo data?"
          description="Everything anyone did on the demo site is wiped: bookings, check-ins, uploads in the review queue, new events and new accounts."
          confirmLabel="Reset"
          cancelLabel="Cancel"
          destructive
          onConfirm={async () => {
            const ok = await runAction(() => resetDemoAction(), { success: (r) => `Demo reset: ${plural(r.bookings, "booking")}, ${plural(r.tickets, "ticket")}` });
            if (ok) router.refresh();
          }}
        />
      </Row>
    </section>
  );
}

function Row({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-t px-4 py-3.5 first:border-t-0 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-0.5 text-xs leading-normal text-muted-foreground">{detail}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function OutboxClear({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (count === 0) return <>empty</>;
  return (
    <Button
      variant="ghost"
      size="xs"
      disabled={pending}
      onClick={() => start(async () => { if (await runAction(() => clearOutboxAction(), { success: "Outbox cleared" })) router.refresh(); })}
    >
      Clear {count}
    </Button>
  );
}
