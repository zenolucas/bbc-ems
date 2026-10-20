import Link from "next/link";
import { TrailSteps } from "@/components/ui/trail-steps";

export const metadata = { title: "About" };

const steps = [
  { label: "Sign in", title: "Sign in with your email", body: <>We send you a one-time link, no password.</> },
  { label: "Pick", title: "Pick your tickets", body: <>Free tiers are confirmed instantly.</> },
  { label: "Pay", title: "Pay for paid tiers", body: <>Send payment via GCash or Maya and upload your receipt. An organiser confirms it.</> },
  {
    label: "Show QR",
    title: "Show your QR at the door",
    body: (
      <>
        Your ticket QR appears under{" "}
        <Link href="/me" className="font-semibold text-accent-foreground underline-offset-2 hover:underline">My tickets</Link> and is emailed to you.
      </>
    ),
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-3">
        <p className="bbc-eyebrow text-primary">About</p>
        <h1 className="text-[32px] leading-none font-extrabold sm:text-[40px]">About Baguio Base Camp</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          Baguio Base Camp is a community of friends in Baguio City that started as a Discord server. This site is where we post our events and gigs and where you can book paperless tickets.
        </p>
      </header>

      <section aria-labelledby="how-tickets-work" className="rounded-3xl border bg-card p-5 sm:p-7">
        <h2 id="how-tickets-work" className="text-xl font-extrabold sm:text-2xl">How tickets work</h2>
        {/* the trail is a picture of the list below, which carries the words */}
        <div aria-hidden className="mt-5">
          <TrailSteps steps={steps.map((s) => ({ label: s.label, status: "done" as const }))} />
        </div>
        <ol className="mt-6 space-y-4">
          {steps.map((s, i) => (
            <li key={s.label} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success-soft font-display text-sm font-extrabold text-primary" aria-hidden>
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
