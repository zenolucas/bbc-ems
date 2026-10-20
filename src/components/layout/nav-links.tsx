"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Desktop pill nav. A section stays lit on its deeper pages (an event, a booking, a ticket). */
const links = [
  { href: "/", label: "Events", match: (p: string) => p === "/" || p.startsWith("/events") },
  { href: "/me", label: "My tickets", match: (p: string) => p === "/me" || p.startsWith("/bookings") || p.startsWith("/tickets") },
  { href: "/about", label: "About", match: (p: string) => p.startsWith("/about") },
];

export function NavLinks({ className }: { className?: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className={cn("items-center gap-1", className)}>
      {links.map((l) => {
        const active = l.match(path);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
