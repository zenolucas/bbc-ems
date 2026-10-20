"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { type AdminEventRef, type AdminUser, activeKey, isDoorMode } from "./nav";
import { AccountMenu, Avatar, Brand, Sidebar } from "./sidebar";
import { AdminTabBar } from "./tab-bar";

type Crumb = { label: string; href?: string };

const SECTIONS: Record<string, string> = {
  bookings: "Bookings",
  attendees: "Attendees",
  edit: "Edit",
};
const PAGES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/events": "Events",
  "/admin/review": "Review queue",
  "/admin/attendees": "Attendees",
  "/admin/scan": "Door scanner",
  "/admin/team": "Team",
  "/admin/ticket-lab": "Ticket lab",
};

/** Breadcrumb from the path alone; event titles come from the layout's list. */
function crumbsFor(path: string, events: AdminEventRef[], user: AdminUser): Crumb[] {
  const root = user.role === "admin" ? "Organiser" : "Door crew";
  if (PAGES[path]) return [{ label: root }, { label: PAGES[path] }];
  if (path === "/admin/events/new") return [{ label: "Events", href: "/admin/events" }, { label: "New event" }];
  const m = path.match(/^\/admin\/events\/([^/]+)(?:\/([^/]+))?/);
  if (m) {
    const title = events.find((e) => e.id === m[1])?.title ?? "Event";
    const up = user.role === "admin" ? { label: "Events", href: "/admin/events" } : { label: "Door scanner", href: "/admin/scan" };
    return m[2] && SECTIONS[m[2]]
      ? [up, { label: title, href: user.role === "admin" ? `/admin/events/${m[1]}` : undefined }, { label: SECTIONS[m[2]] }]
      : [up, { label: title }];
  }
  return [{ label: root }];
}

/**
 * The organiser frame. From lg up: the rail on the left and a top bar with the
 * breadcrumb, ⌘K search and New event. Below lg: a slim header and the tab bar.
 * Door mode (/admin/scan/[eventId]) gets none of it, so the scanner can own the
 * whole screen with its own always-dark chrome.
 */
export function AdminShell({ user, reviewCount, events, children }: { user: AdminUser; reviewCount: number; events: AdminEventRef[]; children: React.ReactNode }) {
  const path = usePathname();
  const [palette, setPalette] = useState(false);
  const isAdmin = user.role === "admin";
  const door = isDoorMode(path);

  useEffect(() => {
    if (!isAdmin || door) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin, door]);

  if (door) return <>{children}</>;

  const active = activeKey(path);
  const crumbs = crumbsFor(path, events, user);
  // The event form owns the bottom edge with its save bar, like member deep pages do
  const tabs = isAdmin && !/^\/admin\/events\/(new|[^/]+\/edit)$/.test(path);
  return (
    <div className="flex min-h-dvh flex-1 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar user={user} active={active} reviewCount={reviewCount} className="sticky top-0 hidden h-dvh overflow-y-auto lg:flex" />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop top bar */}
        <div className="sticky top-0 z-30 hidden items-center gap-3 border-b bg-background/85 px-7 py-3.5 backdrop-blur lg:flex">
          <nav aria-label="Breadcrumb" className="flex min-w-0 shrink items-center gap-1.5 text-[13px] text-muted-foreground">
            {crumbs.map((c, i) => (
              <Fragment key={i}>
                {i > 0 && (crumbs[0].href ? <ChevronRight className="size-3.5 shrink-0" aria-hidden /> : <span aria-hidden>·</span>)}
                {c.href ? (
                  <Link href={c.href} className="truncate hover:text-foreground">{c.label}</Link>
                ) : (
                  <span className={i === crumbs.length - 1 ? "truncate font-semibold text-foreground" : "truncate"} aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
                )}
              </Fragment>
            ))}
          </nav>
          <div className="flex flex-1 justify-center">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setPalette(true)}
                className="relative flex h-[38px] w-full max-w-[420px] items-center gap-2.5 rounded-full border bg-card pr-2.5 pl-3 text-left text-sm text-muted-foreground transition-colors hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Search className="size-4 shrink-0" aria-hidden />
                <span className="flex-1 truncate">Jump to an event, booking or person…</span>
                <kbd className="rounded-md border px-1.5 py-0.5 font-mono text-[11px]" aria-label="Command K">⌘K</kbd>
              </button>
            )}
          </div>
          {isAdmin && (
            <Button asChild className="h-[38px] rounded-full px-4">
              <Link href="/admin/events/new"><Plus className="size-4 stroke-[2.4]" aria-hidden /> New event</Link>
            </Button>
          )}
        </div>

        {/* Phone header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 bg-background/90 pr-3 pl-4 backdrop-blur lg:hidden">
          <Brand role={user.role} compact className="min-w-0" />
          <div className="flex items-center gap-1">
            {isAdmin ? (
              <Button variant="ghost" size="icon" className="size-10 rounded-full text-muted-foreground" aria-label="Search" onClick={() => setPalette(true)}>
                <Search className="size-5" />
              </Button>
            ) : (
              <ThemeToggle className="mr-1" />
            )}
            <AccountMenu user={user}>
              <button type="button" className="grid size-10 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Account menu for ${user.name || user.email}`}>
                <Avatar user={user} className="size-9 text-xs" />
              </button>
            </AccountMenu>
          </div>
        </header>

        <main className={cn("w-full max-w-[1100px] flex-1 px-4 pt-1.5 pb-10 lg:px-7 lg:pt-6", tabs && "pb-28 lg:pb-10")}>
          {children}
        </main>
      </div>

      {tabs && <AdminTabBar user={user} active={active} reviewCount={reviewCount} />}
      {isAdmin && <CommandPalette open={palette} onOpenChange={setPalette} events={events} />}
    </div>
  );
}
