"use client";
import { Hourglass, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { expireHoldAction } from "@/app/demo-actions";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/run-action";

/** Demo: lapse this hold now instead of waiting hours, to show expiry and the waitlist email. */
export function ExpireHoldButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-dashed px-4 py-3">
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Demo:</span> skip the wait and let this hold lapse. Anyone on the waitlist hears about the free seats.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        disabled={pending}
        onClick={() => start(async () => { if (await runAction(() => expireHoldAction(bookingId), { success: "Hold expired" })) router.refresh(); })}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Hourglass />} Expire hold now
      </Button>
    </div>
  );
}
