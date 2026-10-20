"use client";
import { Loader2, Share } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Shares one ticket's PNG through the phone's share sheet (WhatsApp, Messenger…),
 * so a guest gets their own QR. Browsers that can't share files save the image instead.
 */
export function ShareTicketButton({
  ticketId,
  code,
  title,
  children,
  className,
  variant = "outline",
  size,
}: {
  ticketId: string;
  code: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
  variant?: "outline" | "ghost";
  size?: "default" | "icon-lg";
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (children ? "default" : "icon-lg")}
      className={className}
      aria-label={children ? undefined : "Share ticket"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/tickets/${ticketId}/png`);
          if (!res.ok) throw new Error("png");
          const file = new File([await res.blob()], `${code}.png`, { type: "image/png" });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title, text: `${title} · ticket ${code}` });
          } else {
            const url = URL.createObjectURL(file);
            const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast.success("Ticket image saved. Send it from your downloads.");
          }
        } catch (e) {
          if ((e as Error).name !== "AbortError") toast.error("Couldn't share the ticket. Try Save image instead.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Share />}
      {children}
    </Button>
  );
}
