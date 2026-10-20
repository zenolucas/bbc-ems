import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "info" | "danger" | "muted";

/** A dot carries the colour so the label still reads when colour is lost. "used" gets a check instead. */
const tones: Record<string, Tone> = {
  draft: "muted",
  published: "success",
  cancelled: "danger",
  ended: "muted",
  pending_payment: "warning",
  under_review: "info",
  approved: "success",
  rejected: "danger",
  expired: "muted",
  valid: "success",
  used: "muted",
  void: "danger",
};

const dots: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  danger: "bg-destructive",
  muted: "bg-muted-foreground",
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
  const tone = tones[status] ?? "muted";
  return (
    <Badge variant={tone} className={cn("h-auto gap-1.5 px-2.5 py-1 font-semibold", className)}>
      {status === "used" ? (
        <Check className="size-3 stroke-[2.5]" aria-hidden />
      ) : (
        <span className={cn("size-1.5 shrink-0 rounded-full", dots[tone])} aria-hidden />
      )}
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
