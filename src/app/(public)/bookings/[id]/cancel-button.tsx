"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cancelBookingAction } from "@/app/bookings-actions";
import { runAction } from "@/lib/run-action";

export function CancelButton({ bookingId, paid }: { bookingId: string; paid?: boolean }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      title="Cancel this booking?"
      description={
        paid
          ? "Your tickets are released for others. If you already sent money, message the organisers about a refund; cancelling here doesn't send one."
          : "Your tickets are released for others to book. You can book again later if any remain."
      }
      confirmLabel="Cancel booking"
      cancelLabel="Keep booking"
      destructive
      onConfirm={async () => {
        const ok = await runAction(() => cancelBookingAction(bookingId), { success: "Booking cancelled" });
        if (ok) router.refresh();
      }}
      trigger={(open) => (
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={open}>
          Cancel booking
        </Button>
      )}
    />
  );
}
