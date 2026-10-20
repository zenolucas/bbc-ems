"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, LogOut, Ticket, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { type AdminUser, type NavItem, initials, navFor } from "./nav";

/** The organiser rail: logo + role chip, the work, then the tools, then you. */
export function Sidebar({ user, active, reviewCount, className }: { user: AdminUser; active: NavItem["key"] | null; reviewCount: number; className?: string }) {
  const items = navFor(user.role);
  const main = items.filter((n) => !n.secondary);
  const tools = items.filter((n) => n.secondary);
  return (
    <nav aria-label="Organiser" className={cn("flex flex-col gap-1.5 border-r px-4 py-5", className)}>
      <Brand role={user.role} className="px-2 pt-1 pb-4" />
      {main.map((n) => <RailLink key={n.key} item={n} active={active === n.key} count={n.key === "review" ? reviewCount : 0} />)}
      {tools.length > 0 && <div className="mx-1 my-2 h-px bg-border" />}
      {tools.map((n) => <RailLink key={n.key} item={n} active={active === n.key} />)}
      <div className="mt-auto flex flex-col gap-2 pt-4">
        <div className="flex items-center justify-between gap-2 pl-3">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg py-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
            <ExternalLink className="size-4" aria-hidden /> View site
          </Link>
          <ThemeToggle />
        </div>
        <AccountMenu user={user} align="start" side="top">
          <button type="button" className="flex w-full items-center gap-2.5 rounded-xl border bg-card px-2.5 py-2 text-left outline-none hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Account menu for ${user.name || user.email}`}>
            <Avatar user={user} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-semibold">{user.name || user.email.split("@")[0]}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{user.email}</span>
            </span>
          </button>
        </AccountMenu>
      </div>
    </nav>
  );
}

function RailLink({ item, active, count = 0 }: { item: NavItem; active: boolean; count?: number }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-[9px] text-sm font-semibold transition-colors",
        active ? "bg-card text-foreground shadow-[0_1px_2px_rgb(11_61_46/0.08)] dark:bg-surface-2" : "text-muted-foreground hover:bg-card/60 hover:text-foreground dark:hover:bg-surface-2/50",
      )}
    >
      <item.icon className="size-[18px]" aria-hidden />
      {item.label}
      {count > 0 && (
        <span className="ml-auto rounded-full bg-sun px-2 py-0.5 text-[11px] font-bold tabular-nums text-deep-forest dark:bg-star">
          {count}
          <span className="sr-only"> waiting</span>
        </span>
      )}
    </Link>
  );
}

/** Logo, "Base Camp" and the role chip. Links home to the dashboard (door crew: the scanner). */
export function Brand({ role, className, compact }: { role: AdminUser["role"]; className?: string; compact?: boolean }) {
  return (
    <Link href={role === "admin" ? "/admin" : "/admin/scan"} className={cn("flex items-center gap-2.5", className)}>
      <Image src="/brand/bbc-logo.png" alt="" width={compact ? 32 : 34} height={compact ? 32 : 34} priority />
      <span className={cn("leading-[1.1]", compact && "flex items-center gap-2")}>
        <span className="block font-display text-base font-bold tracking-tight">Base Camp</span>
        <span className={cn("inline-block rounded-full bg-success-soft px-[7px] py-0.5 text-[10px] font-bold tracking-[0.12em] text-primary uppercase dark:text-success-foreground", !compact && "mt-[3px]")}>
          {role === "admin" ? "Admin" : "Door crew"}
        </span>
      </span>
    </Link>
  );
}

export function Avatar({ user, className }: { user: AdminUser; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-[30px] shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground", className)}>
      {initials(user)}
    </span>
  );
}

/** Same destinations as the member account menu, minus the admin links you're already in. */
export function AccountMenu({ user, children, align = "end", side = "bottom" }: { user: AdminUser; children: React.ReactNode; align?: "start" | "end"; side?: "top" | "bottom" }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/me"><Ticket className="size-4" /> My tickets</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/me/profile"><UserRound className="size-4" /> Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
