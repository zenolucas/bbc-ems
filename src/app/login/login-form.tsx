"use client";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const { error } = await authClient.signIn.magicLink({
      email: email.trim().toLowerCase(),
      callbackURL: next,
      newUserCallbackURL: "/me/profile?welcome=1",
      errorCallbackURL: "/login?error=expired",
    });
    if (error) {
      setError(error.message ?? "Could not send the link. Try again.");
      setState("error");
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="mt-6 rounded-xl border border-grass/40 bg-fog/60 p-4 dark:bg-slate">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 size-5 text-grass" />
          <div>
            <p className="font-medium">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>. It expires in 15 minutes.
            </p>
            <button type="button" className="mt-2 text-sm underline" onClick={() => setState("idle")}>
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={state === "sending"}>
        {state === "sending" && <Loader2 className="size-4 animate-spin" />}
        Email me a sign-in link
      </Button>
    </form>
  );
}
