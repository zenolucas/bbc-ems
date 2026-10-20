"use client";
import { Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Opens the phone's share sheet; where there isn't one, copies the link instead. */
export function ShareButton({ url, title, className, variant = "outline" }: { url: string; title: string; className?: string; variant?: "outline" | "glass" }) {
  return (
    <Button
      type="button"
      variant={variant === "glass" ? "ghost" : "outline"}
      size="icon"
      aria-label="Share event"
      className={cn("rounded-full", className)}
      onClick={async () => {
        if (navigator.share) {
          // dismissing the sheet rejects with AbortError; nothing to tell the visitor
          await navigator.share({ title, url }).catch(() => {});
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Link copied");
        } catch {
          toast.error("Couldn't copy. Long-press to copy instead.");
        }
      }}
    >
      <Share className="size-[18px]" aria-hidden />
    </Button>
  );
}
