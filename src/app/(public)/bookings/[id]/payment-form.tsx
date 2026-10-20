"use client";
import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ActionState, submitPaymentAction } from "@/app/bookings-actions";

/** Step 2 of paying: the reference number and the receipt screenshot. A resubmit after a rejection is the page's one sun action. */
export function PaymentForm({ bookingId, defaultRef, defaultProof, resubmit }: { bookingId: string; defaultRef: string; defaultProof?: string | null; resubmit?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitPaymentAction, null);
  const [uploading, setUploading] = useState(false);
  const [proof, setProof] = useState(defaultProof ?? "");

  useEffect(() => {
    if (state?.ok) toast.success("Receipt sent. We'll email you once it's confirmed.");
  }, [state]);

  return (
    <section className="rounded-[20px] border bg-card p-4" aria-labelledby="receipt-heading">
      <form action={action} className="space-y-3.5">
        <input type="hidden" name="bookingId" value={bookingId} />
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-full border-2 font-display text-sm font-extrabold text-muted-foreground" aria-hidden>2</span>
          <h2 id="receipt-heading" className="text-[19px] font-extrabold">{resubmit ? "Send the new receipt" : "Send us the receipt"}</h2>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paymentRef" className="text-[13px] font-semibold">{resubmit ? "New reference number" : "Reference number"}</Label>
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
            className="h-12 px-3.5 md:h-12"
          />
          <p id="paymentRef-help" className="text-xs text-muted-foreground">Shown on the GCash/Maya confirmation screen after you send.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="receipt-upload" className="text-[13px] font-semibold">{resubmit ? "New receipt screenshot" : "Receipt screenshot"}</Label>
          <ImageUpload
            id="receipt-upload"
            name="paymentProofUrl"
            folder="payments"
            label={resubmit ? "Upload the new screenshot" : "Upload receipt screenshot"}
            // Empty: a wide dashed dropzone. Filled: a tall preview of the screenshot.
            aspect={proof ? "aspect-[3/4] max-w-[220px] rounded-[14px] border-2" : "h-[118px] rounded-[14px] border-2 bg-surface-2 [&_svg]:size-[26px] [&_svg]:text-primary"}
            fit="contain"
            defaultValue={defaultProof}
            onBusyChange={setUploading}
            onChange={setProof}
          />
        </div>
        {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" size="lg" variant={resubmit ? "sun" : "default"} className="h-[50px] w-full text-[15px] md:h-[50px]" disabled={pending || uploading || !proof}>
          {(pending || uploading) && <Loader2 className="size-4 animate-spin" />}
          {uploading ? "Waiting for upload…" : resubmit ? "Resubmit for review" : "Submit for review"}
        </Button>
        {!proof && !uploading && <p className="-mt-1.5 text-center text-xs text-muted-foreground">Add the receipt screenshot to continue.</p>}
      </form>
    </section>
  );
}
