"use client";
import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DiscordSignInButton } from "@/components/discord/discord-link";
import { authClient } from "@/lib/auth-client";

const RESEND_COOLDOWN = 30;

/** Webmail inboxes we can open straight from the "sent" card. Anything else gets no button. */
const INBOXES: [RegExp, string][] = [
  [/^(gmail|googlemail)\.com$/, "https://mail.google.com/mail/u/0/#inbox"],
  [/^(outlook|hotmail|live|msn)\.[a-z.]+$/, "https://outlook.live.com/mail/0/"],
  [/^(yahoo|ymail)\.[a-z.]+$/, "https://mail.yahoo.com/"],
  [/^(icloud|me|mac)\.com$/, "https://www.icloud.com/mail"],
  [/^proton(mail)?\.(me|com)$/, "https://mail.proton.me/u/0/inbox"],
];

function inboxUrl(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return INBOXES.find(([re]) => re.test(domain))?.[1] ?? null;
}

/**
 * The sign-in card. `intro` (the intent-aware heading and any link error) and
 * `footnote` come from the server; `after` sits below the card until the link is
 * sent. Once sent, the card turns into the envelope and the resend controls.
 */
export function LoginForm({ next, intro, footnote, after, discord }: { next: string; intro: React.ReactNode; footnote?: React.ReactNode; after?: React.ReactNode; discord?: boolean }) {
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

  const sent = state === "sent";
  const inbox = sent ? inboxUrl(email.trim()) : null;

  return (
    <>
      <div className="relative mx-4 -mt-9 rounded-3xl border bg-card px-5 pt-[22px] pb-5 shadow-[0_14px_36px_rgb(11_61_46/0.12)] sm:mx-auto sm:w-full sm:max-w-md lg:m-0 lg:max-w-none lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-[0_14px_36px_rgb(0_0_0/0.35)] lg:dark:shadow-none">
        {sent ? (
          <div role="status" className="flex flex-col items-center gap-3.5 pt-0.5 text-center lg:items-start lg:text-left">
            <EnvelopeIllustration />
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl leading-[1.08] font-extrabold lg:text-[30px] lg:leading-[1.05]">Check your inbox</h1>
              <p className="text-sm leading-normal text-muted-foreground lg:text-[15px]">
                We sent a sign-in link to <span className="font-semibold break-all text-foreground">{email}</span>. It works once and expires in 15 minutes.
              </p>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {inbox && (
              <Button asChild variant="sun" size="lg" className="h-12 w-full text-[15px] font-semibold md:h-12">
                <a href={inbox} target="_blank" rel="noreferrer">Open mail app</a>
              </Button>
            )}
            <div className="flex w-full gap-2">
              <Button type="button" variant="outline" className="h-[42px] flex-1 rounded-full text-[13px] font-semibold md:h-[42px]" disabled={cooldown > 0} onClick={() => void send()}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-[42px] flex-1 rounded-full text-[13px] font-semibold text-muted-foreground md:h-[42px]"
                onClick={() => {
                  setState("idle");
                  setError(null);
                }}
              >
                Use a different email
              </Button>
            </div>
            <p className="text-xs leading-normal text-muted-foreground">Nothing after a minute? Check Spam or Promotions.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 lg:gap-[18px]">
            {intro}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex flex-col gap-3 lg:gap-3.5"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-[13px] font-semibold">Email</Label>
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
                  className="h-[50px] rounded-[14px] bg-card px-3.5 text-base md:h-[50px] md:text-base"
                />
              </div>
              {error && <p id="email-error" role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="h-[50px] w-full text-[15px] font-semibold md:h-[50px]" disabled={state === "sending"}>
                {state === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mail className="size-[18px]" aria-hidden />}
                Email me a sign-in link
              </Button>
            </form>
            {discord && (
              <>
                <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
                  <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
                </div>
                <DiscordSignInButton next={next} />
              </>
            )}
            {/* desktop has no card, so the door-crew note moves up between the form and the footnote */}
            {after && <div className="hidden lg:block">{after}</div>}
            {footnote && <div className="text-center text-xs leading-normal text-muted-foreground lg:text-left">{footnote}</div>}
          </div>
        )}
      </div>
      {!sent && after && <div className="mx-4 mt-4 sm:mx-auto sm:w-full sm:max-w-md lg:hidden">{after}</div>}
      <p className="mt-auto px-5 pt-8 pb-7 text-center text-xs text-muted-foreground lg:mt-6 lg:p-0 lg:text-left">
        {sent ? "You can close this tab. The link opens the site on its own." : "Links work once and last 15 minutes."}
      </p>
    </>
  );
}

/** An envelope with a check, in the primary colour; the check badge is the sun (star at night). */
function EnvelopeIllustration() {
  return (
    <svg viewBox="0 0 96 64" className="h-16 w-24 text-primary" aria-hidden>
      <rect x="6" y="12" width="80" height="48" rx="7" className="fill-success-soft" stroke="currentColor" strokeWidth="3" />
      <path d="M8 16 46 42l38-26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="82" cy="12" r="10" className="fill-sun stroke-card dark:fill-star" strokeWidth="3" />
      <path d="m77.5 12 3 3 6-6" fill="none" stroke="#0b3d2e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
