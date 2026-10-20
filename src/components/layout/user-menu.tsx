"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ScanLine, Shield, Ticket, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const item = "gap-2.5 rounded-[10px] px-3 py-2.5 text-sm focus:bg-surface-2 focus:text-foreground focus:**:text-foreground";

/** Shown next to the one menu entry the person's role unlocks; members get none. */
function RoleBadge({ children }: { children: React.ReactNode }) {
  return <span className="ml-auto rounded-full bg-success-soft px-[7px] py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">{children}</span>;
}

export function UserMenu({ user }: { user: { name: string; email: string; role: string } | null }) {
  const router = useRouter();
  if (!user) {
    return (
      <Button asChild size="sm" className="h-9 rounded-full px-4 text-[13px] font-semibold md:h-9">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${user.name || user.email}`}
          className={cn(
            "flex h-10 shrink-0 items-center gap-2 rounded-full text-[13px] font-semibold text-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
            "sm:h-[38px] sm:border sm:bg-card sm:pr-3 sm:pl-1 sm:hover:bg-surface-2 sm:aria-expanded:bg-surface-2",
          )}
        >
          <span className="grid size-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground sm:size-[30px] sm:text-[11px]">{initials}</span>
          <span className="hidden max-w-32 truncate sm:inline">{user.name || user.email}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60 rounded-2xl p-1.5 shadow-[0_16px_40px_rgb(11_61_46/0.16)] dark:shadow-[0_16px_40px_rgb(0_0_0/0.45)]">
        <DropdownMenuLabel className="truncate px-3 pt-2 pb-2.5 text-xs font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-0" />
        <DropdownMenuItem asChild className={item}>
          <Link href="/me"><Ticket aria-hidden /> My tickets</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={item}>
          <Link href="/me/profile"><UserRound aria-hidden /> Name on tickets</Link>
        </DropdownMenuItem>
        {(user.role === "admin" || user.role === "staff") && (
          <>
            <DropdownMenuSeparator />
            {user.role === "admin" && (
              <DropdownMenuItem asChild className={item}>
                <Link href="/admin"><Shield aria-hidden /> Organiser area <RoleBadge>Admin</RoleBadge></Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild className={item}>
              <Link href="/admin/scan">
                <ScanLine aria-hidden /> Door scanner {user.role === "staff" && <RoleBadge>Door crew</RoleBadge>}
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={cn(item, "text-muted-foreground")}
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
