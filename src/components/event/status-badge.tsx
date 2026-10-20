import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-grass/15 text-forest dark:text-lime border-grass/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  ended: "bg-slate/10 text-muted-foreground",
  pending_payment: "bg-sun/20 text-yellow-800 dark:text-star border-sun/40",
  under_review: "bg-sky/15 text-sky-deep dark:text-sky border-sky/30",
  approved: "bg-grass/15 text-forest dark:text-lime border-grass/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground",
  valid: "bg-grass/15 text-forest dark:text-lime border-grass/30",
  used: "bg-muted text-muted-foreground",
  void: "bg-destructive/10 text-destructive border-destructive/30",
};

/** Member-facing labels. Admin surfaces pass `admin` to keep the terse internal names. */
const labels: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  cancelled: "Cancelled",
  ended: "Ended",
  pending_payment: "Awaiting payment",
  under_review: "Being reviewed",
  approved: "Confirmed",
  rejected: "Payment not accepted",
  expired: "Expired",
  valid: "Valid",
  used: "Checked in",
  void: "Voided",
};

const adminLabels: Record<string, string> = {
  ...labels,
  pending_payment: "Unpaid hold",
  under_review: "Needs review",
  approved: "Approved",
  rejected: "Rejected",
  used: "Checked in",
};

export function statusLabel(status: string, admin = false) {
  return (admin ? adminLabels : labels)[status] ?? status.replace(/_/g, " ");
}

export function StatusBadge({ status, admin, className }: { status: string; admin?: boolean; className?: string }) {
  return (
    <Badge variant="outline" className={cn(styles[status], className)}>
      {statusLabel(status, admin)}
    </Badge>
  );
}

/** One line telling a member what a booking status means and what to do next. */
export function bookingStatusCopy(status: string): string {
  switch (status) {
    case "pending_payment":
      return "Pay and upload your receipt before the hold runs out.";
    case "under_review":
      return "Receipt received. An organiser checks it by hand, then your tickets are emailed.";
    case "approved":
      return "You're in. Show the QR code at the door.";
    case "rejected":
      return "The organiser couldn't match your payment. Open the booking to see why and resubmit.";
    case "expired":
      return "The hold ran out before payment arrived. Book again if tickets remain.";
    case "cancelled":
      return "This booking was cancelled.";
    default:
      return "";
  }
}
