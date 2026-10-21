"use client";
import { BellRing, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { joinWaitlistAction, leaveWaitlistAction } from "@/app/waitlist-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Replaces the disabled "Sold out" button: join or leave the event's waitlist. */
export function WaitlistButton({ eventId, slug, onList, signedIn, compact, className }: { eventId: string; slug: string; onList: boolean; signedIn: boolean; compact?: boolean; className?: string }) {
  const [pending, start] = useTransition();
  if (!signedIn) {
    return (
      <Button asChild size="lg" variant="outline" className={className}>
        <Link href={`/login?next=${encodeURIComponent(`/events/${slug}`)}`}>
          <BellRing aria-hidden /> {compact ? "Notify me" : "Notify me if tickets free up"}
        </Link>
      </Button>
    );
  }
  return (
    <Button
      size="lg"
      variant="outline"
      className={cn(onList && "border-success/40 text-success-foreground", className)}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = onList ? await leaveWaitlistAction(eventId) : await joinWaitlistAction(eventId);
          if (r.error) toast.error(r.error);
          else toast.success(onList ? "Taken off the list" : "We'll email you if tickets free up");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : onList ? <Check aria-hidden /> : <BellRing aria-hidden />}
      {onList ? (compact ? "On the list" : "On the list · tap to leave") : compact ? "Notify me" : "Notify me if tickets free up"}
    </Button>
  );
}
