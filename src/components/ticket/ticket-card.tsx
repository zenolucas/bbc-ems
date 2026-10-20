import Link from "next/link";
import { QrCode } from "lucide-react";
import { StatusBadge } from "@/components/event/status-badge";

export function TicketCard({ ticket }: { ticket: { id: string; shortCode: string; holderName: string; status: string; tierName: string } }) {
  return (
    <Link href={`/tickets/${ticket.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/40">
      <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><QrCode className="size-6" /></div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-sm font-semibold tracking-wide">{ticket.shortCode}</div>
        <div className="truncate text-sm text-muted-foreground">{ticket.tierName} · {ticket.holderName}</div>
      </div>
      <StatusBadge status={ticket.status} />
    </Link>
  );
}
