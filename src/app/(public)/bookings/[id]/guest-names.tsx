"use client";
import Link from "next/link";
import { Check, Loader2, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/event/status-badge";
import { renameTicketAction } from "@/app/bookings-actions";
import { runAction } from "@/lib/run-action";

type T = { id: string; shortCode: string; holderName: string; status: string; tierName: string };

/** One row per ticket: open the QR, or rename the guest while the ticket is unused. */
export function GuestNames({ tickets, canEdit }: { tickets: T[]; canEdit: boolean }) {
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {tickets.map((t, i) => <Row key={t.id} t={t} index={i + 1} total={tickets.length} canEdit={canEdit} />)}
    </ul>
  );
}

function Row({ t, index, total, canEdit }: { t: T; index: number; total: number; canEdit: boolean }) {
  const [name, setName] = useState(t.holderName);
  const [pending, start] = useTransition();
  const router = useRouter();
  const dirty = name.trim() !== t.holderName && name.trim().length > 0;
  const editable = canEdit && t.status === "valid";
  return (
    <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
      <Link href={`/tickets/${t.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:bg-muted/40">
        <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><QrCode className="size-6" aria-hidden /></div>
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold tracking-wide">{t.shortCode}</div>
          <div className="truncate text-sm text-muted-foreground">{total > 1 ? `Ticket ${index} of ${total} · ` : ""}{t.tierName}{editable ? "" : ` · ${t.holderName}`}</div>
        </div>
        <StatusBadge status={t.status} className="ml-auto" />
      </Link>
      {editable && (
        <form
          className="flex gap-2 sm:w-64"
          onSubmit={(e) => {
            e.preventDefault();
            if (!dirty) return;
            start(async () => {
              const ok = await runAction(() => renameTicketAction(t.id, name), { success: `Ticket ${t.shortCode} is now for ${name.trim()}` });
              if (ok) router.refresh();
            });
          }}
        >
          <label htmlFor={`guest-${t.id}`} className="sr-only">Guest name for ticket {t.shortCode}</label>
          <Input id={`guest-${t.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" placeholder="Guest name" />
          <Button type="submit" variant="outline" size="icon" disabled={!dirty || pending} aria-label="Save guest name">
            {pending ? <Loader2 className="animate-spin" /> : <Check />}
          </Button>
        </form>
      )}
    </li>
  );
}
