"use client";
import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";
import { type AdminUser, type NavItem, navFor } from "./nav";

const TABS: NavItem["key"][] = ["dashboard", "events", "review", "scan"];

/**
 * Phone tab bar for organisers: Home, Events, Review, Scanner, and More for the
 * rest. Hidden from lg up, where the rail takes over. The shell pads the page
 * so the last row clears it.
 */
export function AdminTabBar({ user, active, reviewCount }: { user: AdminUser; active: NavItem["key"] | null; reviewCount: number }) {
  const [more, setMore] = useState(false);
  const items = navFor(user);
  const tabs = items.filter((n) => TABS.includes(n.key));
  const rest = items.filter((n) => !TABS.includes(n.key));
  const moreActive = rest.some((n) => n.key === active);
  return (
    <>
      <nav aria-label="Organiser" className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/95 px-1.5 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        {tabs.map((n) => (
          <Tab key={n.key} href={n.href} label={n.short} active={active === n.key} icon={<n.icon className="size-5" aria-hidden />} count={n.key === "review" ? reviewCount : 0} />
        ))}
        <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" aria-expanded={more} className={cn("relative flex flex-1 flex-col items-center gap-1 text-[11px]", moreActive ? "font-bold text-primary" : "font-semibold text-muted-foreground")}>
          <span className={cn("grid h-[30px] w-[52px] place-items-center rounded-full", moreActive && "bg-success-soft")}><Menu className="size-5" aria-hidden /></span>
          More
        </button>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="pb-0">
            <SheetTitle className="font-display text-lg font-bold">More</SheetTitle>
            <SheetDescription className="truncate">Signed in as {user.email}</SheetDescription>
          </SheetHeader>
          <div className="grid gap-1 px-3">
            {rest.map((n) => (
              <Link key={n.key} href={n.href} onClick={() => setMore(false)} aria-current={active === n.key ? "page" : undefined} className={cn("flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold", active === n.key ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground")}>
                <n.icon className="size-5" aria-hidden /> {n.label}
              </Link>
            ))}
            <Link href="/" onClick={() => setMore(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-muted-foreground hover:bg-surface-2 hover:text-foreground">
              <ExternalLink className="size-5" aria-hidden /> View site
            </Link>
            <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 text-[15px] font-semibold text-muted-foreground">
              <span>Night mode</span>
              <ThemeToggle />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Tab({ href, label, active, icon, count }: { href: string; label: string; active: boolean; icon: React.ReactNode; count: number }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("relative flex flex-1 flex-col items-center gap-1 text-[11px]", active ? "font-bold text-primary" : "font-semibold text-muted-foreground")}>
      <span className={cn("grid h-[30px] w-[52px] place-items-center rounded-full", active && "bg-success-soft")}>{icon}</span>
      {label}
      {count > 0 && (
        <span className="absolute top-0.5 left-1/2 ml-2 rounded-full bg-sun px-1.5 py-px text-[10px] font-bold tabular-nums text-deep-forest dark:bg-star">
          {count}<span className="sr-only"> waiting</span>
        </span>
      )}
    </Link>
  );
}
