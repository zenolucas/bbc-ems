"use client";
import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ActionState, submitPaymentAction } from "@/app/bookings-actions";

export function PaymentForm({ bookingId, defaultRef, defaultProof, resubmit }: { bookingId: string; defaultRef: string; defaultProof?: string | null; resubmit?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitPaymentAction, null);
  const [uploading, setUploading] = useState(false);
  const [proof, setProof] = useState(defaultProof ?? "");

  useEffect(() => {
    if (state?.ok) toast.success("Receipt sent. We'll email you once it's confirmed.");
  }, [state]);

  return (
    <form action={action} className="space-y-4 border-t pt-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-sm font-medium">{resubmit ? "Then send the new details:" : "After paying, send us the receipt:"}</p>
      <div className="space-y-1.5">
        <Label htmlFor="paymentRef">Reference number</Label>
        <Input
          id="paymentRef"
          name="paymentRef"
          required
          minLength={4}
          defaultValue={defaultRef}
          placeholder="e.g. 1234 567 890123"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="paymentRef-help"
        />
        <p id="paymentRef-help" className="text-xs text-muted-foreground">Shown on the GCash/Maya confirmation screen after you send.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="receipt-upload">Receipt screenshot</Label>
        <ImageUpload
          id="receipt-upload"
          name="paymentProofUrl"
          folder="payments"
          label="Upload receipt screenshot"
          aspect="aspect-[3/4] max-w-[220px]"
          fit="contain"
          defaultValue={defaultProof}
          onBusyChange={setUploading}
          onChange={setProof}
        />
      </div>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending || uploading || !proof}>
        {(pending || uploading) && <Loader2 className="size-4 animate-spin" />}
        {uploading ? "Waiting for upload…" : resubmit ? "Resubmit for review" : "Submit for review"}
      </Button>
      {!proof && !uploading && <p className="text-xs text-muted-foreground">Add the receipt screenshot to continue.</p>}
    </form>
  );
}
