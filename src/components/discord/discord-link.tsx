"use client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { unlinkDiscordAction } from "@/app/discord-actions";
import { DiscordIcon } from "@/components/brand/discord-icon";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { runAction } from "@/lib/run-action";
import { cn } from "@/lib/utils";

/** Starts Discord's OAuth flow to link the signed-in member's account, then comes back to `back`. */
export function LinkDiscordButton({ back, className, children = "Link Discord" }: { back: string; className?: string; children?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      className={cn("bg-[#5865F2] text-white hover:bg-[#4752c4]", className)}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const sep = back.includes("?") ? "&" : "?";
        const { error } = await authClient.linkSocial({ provider: "discord", callbackURL: `${back}${sep}discord=linked`, errorCallbackURL: back });
        if (error) {
          setBusy(false);
          toast.error(error.message ?? "Couldn't reach Discord. Try again.");
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <DiscordIcon className="size-[18px]" />} {children}
    </Button>
  );
}

/** "Continue with Discord" on the sign-in page. New members pick their ticket name next, like with email. */
export function DiscordSignInButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const enc = encodeURIComponent(next);
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="h-[50px] w-full text-[15px] font-semibold md:h-[50px]"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const { error } = await authClient.signIn.social({
          provider: "discord",
          callbackURL: next,
          newUserCallbackURL: `/me/profile?welcome=1&next=${enc}`,
          errorCallbackURL: `/login?next=${enc}`,
        });
        if (error) {
          setBusy(false);
          toast.error(error.message ?? "Couldn't reach Discord. Try again.");
        }
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <DiscordIcon className="size-[18px] text-[#5865F2]" />}
      Continue with Discord
    </Button>
  );
}

export function UnlinkDiscordButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="rounded-full text-muted-foreground"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const ok = await runAction(() => unlinkDiscordAction(), { success: "Discord unlinked" });
        setBusy(false);
        if (ok) router.refresh();
      }}
    >
      {busy && <Loader2 className="animate-spin" />} Unlink
    </Button>
  );
}
