"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ticket, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Phone tab bar for the member site. Shows on the top-level pages only: deeper
 * pages (event, booking, ticket) own the bottom edge with their sticky CTA.
 * The root <body> pads itself while this is mounted (`data-bottom-nav`).
 */
const ROUTES = new Set(["/", "/me", "/about", "/me/profile"]);

export function BottomNav({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  if (!ROUTES.has(path)) return null;
  const items = [
    { href: "/", label: "Events", active: path === "/", Icon: MountainIcon },
    { href: "/me", label: "My tickets", active: path === "/me", Icon: Ticket },
    { href: signedIn ? "/me/profile" : "/login", label: signedIn ? "Account" : "Sign in", active: path === "/me/profile", Icon: UserRound },
  ];
  return (
    <nav
      aria-label="Main"
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 px-1.5 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden"
    >
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.active ? "page" : undefined}
          className={cn("flex flex-1 flex-col items-center gap-1 text-[11px]", it.active ? "font-bold text-primary" : "font-semibold text-muted-foreground")}
        >
          <span className={cn("grid h-[30px] w-[52px] place-items-center rounded-full", it.active && "bg-success-soft")}>
            <it.Icon className="size-5" aria-hidden />
          </span>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

function MountainIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 20 12 5l8 15H4Z" />
      <path d="M12 20v-6" />
    </svg>
  );
}
