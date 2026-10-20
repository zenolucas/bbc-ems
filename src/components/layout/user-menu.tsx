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

export function UserMenu({ user }: { user: { name: string; email: string; role: string } | null }) {
  const router = useRouter();
  if (!user) {
    return (
      <Button asChild size="sm">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full pl-1.5">
          <span className="size-6 rounded-full bg-primary text-primary-foreground grid place-items-center text-[11px] font-semibold">
            {initials}
          </span>
          <span className="max-w-28 truncate hidden sm:inline">{user.name || user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/me"><Ticket className="size-4" /> My tickets</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/me/profile"><UserRound className="size-4" /> Profile</Link>
        </DropdownMenuItem>
        {user.role === "admin" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin"><Shield className="size-4" /> Admin</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/scan"><ScanLine className="size-4" /> Scanner</Link>
            </DropdownMenuItem>
          </>
        )}
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
