import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Info } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Skyline } from "@/components/brand/skyline";
import { DEMO_PERSONAS, PERSONA_LABELS } from "@bbc/shared/demo";
import { PersonaPicker } from "@/components/demo/persona-picker";
import { Notice } from "@/components/ui/notice";
import { getDemoState } from "@/lib/demo/flag";
import { getEventBySlug } from "@/lib/events";
import { getCurrentUser, safeNext } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

type Intent = { heading: string; sub: string; back: string; organiser?: boolean };

const LINK = "We'll email you a one-time link.";

/** Explains why we're asking the visitor to sign in, based on where they were headed. */
async function intentFor(next: string): Promise<Intent> {
  const book = next.match(/^\/events\/([^/?#]+)\/book/);
  if (book) {
    const ev = await getEventBySlug(decodeURIComponent(book[1]));
    if (ev) return { heading: `Sign in to book ${ev.title}`, sub: `${LINK} No password to remember, and you'll come straight back to pick your tickets.`, back: `/events/${ev.slug}` };
  }
  if (next.startsWith("/admin/scan")) return { heading: "Sign in to open the scanner", sub: `${LINK} It works once and lasts 15 minutes.`, back: "/" };
  if (next.startsWith("/admin")) return { heading: "Sign in to the organiser area", sub: `${LINK} It works once and lasts 15 minutes.`, back: "/", organiser: true };
  if (next.startsWith("/bookings")) return { heading: "Sign in to see your booking", sub: `${LINK} No password to remember, and you'll land right back on your booking.`, back: "/" };
  if (next.startsWith("/tickets") || next.startsWith("/me")) return { heading: "Sign in to see your tickets", sub: `${LINK} No password to remember, and you'll land right back on your tickets.`, back: "/" };
  return { heading: "Sign in", sub: `${LINK} No password to remember.`, back: "/" };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = safeNext(next);
  const user = await getCurrentUser();
  if (user) redirect(nextPath);
  const [intent, demo] = await Promise.all([intentFor(nextPath), getDemoState()]);
  const errorCode = typeof error === "string" ? error : undefined;
  return (
    <main className="flex flex-1 flex-col lg:grid lg:min-h-dvh lg:grid-cols-2">
      {/* Phones: a skyline panel the card overlaps. Desktop: the left half of a split. */}
      <section className="relative h-[250px] shrink-0 overflow-hidden lg:h-auto lg:min-h-dvh">
        <Skyline variant="auto" size="hero" seed="login" className="absolute inset-0 lg:hidden" />
        {/* a 2:1 box as tall as the panel, nudged left so the sun stays in the crop. Its own seed:
            the gradient ids come from it, and the phone copy above is display:none here */}
        <div className="absolute inset-y-0 left-0 hidden aspect-[2/1] -translate-x-[12%] lg:block">
          <Skyline variant="auto" size="hero" seed="login-wide" className="absolute inset-0" />
        </div>
        {/* keeps the copy readable where it crosses the ridges */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 hidden h-2/5 bg-gradient-to-t from-cream/45 to-transparent lg:block dark:from-midnight/70" />

        <Link
          href={intent.back}
          aria-label="Back"
          className="absolute top-3 left-3 grid size-10 place-items-center rounded-full bg-cream/85 text-deep-forest backdrop-blur-md outline-none hover:bg-cream focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden dark:bg-midnight/70 dark:text-white dark:hover:bg-midnight"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <Link href="/" className="absolute inset-x-0 top-10 mx-auto flex w-fit flex-col items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden">
          <Image src="/brand/bbc-logo.png" alt="" width={72} height={72} priority className="drop-shadow-[0_4px_12px_rgb(11_61_46/0.25)] dark:drop-shadow-[0_4px_12px_rgb(0_0_0/0.4)]" />
          <span className="bbc-eyebrow text-deep-forest dark:text-star">Baguio Base Camp</span>
        </Link>

        <div className="relative hidden h-full flex-col justify-between px-11 py-9 lg:flex">
          <Logo size={48} className="[&_span]:text-deep-forest dark:[&_span]:text-white" />
          <div className="flex max-w-[420px] flex-col gap-3 text-deep-forest dark:text-white">
            <p className="font-display text-[clamp(28px,3.4vw,40px)] leading-none font-extrabold tracking-[-0.02em]">One link in your inbox, then you&apos;re in.</p>
            <p className="text-[15px] leading-normal text-[#1b3d33] dark:text-[#cfe0d6]">
              No passwords, no accounts to set up. The name you choose goes on your tickets; the door crew will look for it.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-1 flex-col lg:items-center lg:justify-center lg:px-8 lg:py-12">
        <div className="flex flex-1 flex-col lg:w-full lg:max-w-[440px] lg:flex-none">
          <LoginForm
            next={nextPath}
            intro={
              <div className="flex flex-col gap-1.5 lg:gap-2">
                <h1 className="text-2xl leading-[1.08] font-extrabold lg:text-[30px] lg:leading-[1.05]">{intent.heading}</h1>
                <p className="text-sm leading-[1.45] text-muted-foreground lg:text-[15px] lg:leading-normal">{intent.sub}</p>
                {demo.enabled && <PersonaPicker next={nextPath} personas={DEMO_PERSONAS.map((key) => ({ key, ...PERSONA_LABELS[key] }))} />}
                {errorCode && (
                  <Notice tone="destructive" className="mt-2" title={errorCode === "INVALID_TOKEN" ? "That link has expired or was already used" : "We couldn't sign you in"}>
                    Request a fresh link below. Links work once and last 15 minutes.
                  </Notice>
                )}
              </div>
            }
            footnote={
              intent.organiser
                ? "Only emails an organiser added on the Team page get into the organiser area. Everyone else lands on their tickets."
                : "New here? Same button. You'll pick the name that goes on your tickets right after."
            }
            after={
              <div className="flex gap-2.5 rounded-[14px] bg-info-soft px-3.5 py-3 text-xs leading-[1.45] lg:text-[13px]">
                <Info className="mt-px size-4 shrink-0 text-info-foreground" aria-hidden />
                <span>
                  <span className="font-semibold">
                    <span className="lg:hidden">Door crew:</span>
                    <span className="hidden lg:inline">Door crew on a phone?</span>
                  </span>{" "}
                  Open the link in Safari or Chrome, not inside your mail app, so the scanner stays signed in.
                </span>
              </div>
            }
          />
        </div>
      </section>
    </main>
  );
}
