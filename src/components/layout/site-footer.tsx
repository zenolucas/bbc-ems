import Image from "next/image";
import Link from "next/link";
import { Skyline } from "@/components/brand/skyline";

const links = [
  { href: "/", label: "Events" },
  { href: "/me", label: "My tickets" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
];

/** Lockup and the footer links on one line, over a ridge strip that closes the page. */
export function SiteFooter() {
  return (
    // Pages whose dark stage runs to the bottom on phones (the ticket wallet) mark themselves data-flush-footer
    <footer className="relative mt-14 overflow-hidden border-t bg-surface-2 max-sm:[main:has([data-flush-footer])+&]:mt-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 pt-6 sm:px-6 sm:pt-9">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-3.5">
          <Image src="/brand/bbc-logo.png" alt="" width={44} height={44} className="size-7 sm:size-11" />
          <span className="leading-[1.3]">
            <span className="block text-xs font-semibold sm:font-display sm:text-lg sm:font-bold sm:tracking-[-0.02em]">Baguio Base Camp</span>
            <span className="block text-xs text-muted-foreground sm:text-[13px]">events, gigs and paperless tickets · Baguio City</span>
          </span>
        </Link>
        <nav aria-label="Footer" className="hidden gap-5 text-[13px] font-semibold text-muted-foreground sm:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="relative mt-2 h-20 sm:mt-0 sm:h-24">
        <Skyline variant="auto" size="strip" className="absolute inset-0" />
        <p className="absolute bottom-3 left-0 right-0 mx-auto max-w-6xl px-4 text-xs text-foreground sm:px-6">
          Baguio City · 1,500 m above sea level · bring a jacket
          {/* The nav above is hidden on phones; the app stores link here, so keep it reachable */}
          <span className="sm:hidden">
            {" · "}
            <Link href="/privacy" className="font-semibold underline-offset-2 hover:underline">Privacy</Link>
          </span>
        </p>
      </div>
    </footer>
  );
}
