"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelBookingAction } from "@/app/bookings-actions";

export function CancelButton({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      disabled={pending}
      onClick={() => {
        if (!confirm("Cancel this reservation and release the tickets?")) return;
        start(async () => {
          const r = await cancelBookingAction(bookingId);
          if (r?.error) toast.error(r.error);
          else toast.success("Reservation cancelled");
        });
      }}
    >
      Cancel reservation
    </Button>
  );
}
