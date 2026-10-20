"use client";
import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { ImageUpload } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ActionState, submitPaymentAction } from "@/app/bookings-actions";

export function PaymentForm({ bookingId, defaultRef }: { bookingId: string; defaultRef: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitPaymentAction, null);
  return (
    <form action={action} className="space-y-4 border-t pt-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="space-y-1.5">
        <Label htmlFor="paymentRef">Reference number</Label>
        <Input id="paymentRef" name="paymentRef" required defaultValue={defaultRef} placeholder="e.g. 1234 567 890123" />
        <p className="text-xs text-muted-foreground">Found on your GCash/Maya receipt after sending.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Receipt screenshot</Label>
        <ImageUpload name="paymentProofUrl" folder="payments" label="Upload receipt screenshot" aspect="aspect-[4/3] max-w-xs" />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Submit for review</Button>
    </form>
  );
}
