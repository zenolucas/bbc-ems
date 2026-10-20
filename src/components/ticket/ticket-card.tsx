import Link from "next/link";
import { ChevronRight, QrCode } from "lucide-react";
import { StatusBadge } from "@/components/event/status-badge";

/** One ticket as a tappable row: QR tile, code, tier and name. Only a ticket that won't scan shows its status. */
export function TicketCard({ ticket }: { ticket: { id: string; shortCode: string; holderName: string; status: string; tierName: string } }) {
  return (
    <Link href={`/tickets/${ticket.id}`} className="flex min-w-0 items-center gap-2.5 rounded-[14px] border bg-background p-2.5 transition-colors hover:bg-muted/50">
      <div className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-success-soft text-primary"><QrCode className="size-[22px]" aria-hidden /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-sm font-bold tracking-[0.06em]">{ticket.shortCode}</div>
        <div className="truncate text-xs text-muted-foreground">{ticket.tierName} · {ticket.holderName}</div>
      </div>
      {ticket.status !== "valid" && <StatusBadge status={ticket.status} />}
      <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
