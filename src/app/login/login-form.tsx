"use client";
import { useEffect, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const RESEND_COOLDOWN = 30;

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send() {
    setState((s) => (s === "sent" ? "sent" : "sending"));
    setError(null);
    const enc = encodeURIComponent(next);
    const { error } = await authClient.signIn.magicLink({
      email: email.trim().toLowerCase(),
      callbackURL: next,
      // New members set their display name first, then continue to where they were going.
      newUserCallbackURL: `/me/profile?welcome=1&next=${enc}`,
      errorCallbackURL: `/login?next=${enc}`,
    });
    if (error) {
      setError(error.message ?? "Could not send the link. Try again.");
      setState("error");
      return false;
    }
    setState("sent");
    setCooldown(RESEND_COOLDOWN);
    return true;
  }

  if (state === "sent") {
    return (
      <div role="status" className="mt-6 rounded-xl border border-grass/40 bg-fog/60 p-4 dark:bg-slate">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-grass" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              We sent a sign-in link to <span className="break-all font-medium text-foreground">{email}</span>. It works once and expires in 15 minutes.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Nothing after a minute? Check Spam or Promotions.</p>
            {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={cooldown > 0} onClick={() => void send()}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setState("idle"); setError(null); }}>
                Use a different email
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "email-error" : undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error && <p id="email-error" role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={state === "sending"}>
        {state === "sending" && <Loader2 className="size-4 animate-spin" />}
        Email me a sign-in link
      </Button>
    </form>
  );
}
