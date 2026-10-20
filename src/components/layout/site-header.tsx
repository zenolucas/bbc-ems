import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BottomNav } from "@/components/ui/bottom-nav";
import { getCurrentUser } from "@/lib/session";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const links = [
  { href: "/", label: "Events" },
  { href: "/me", label: "My tickets" },
  { href: "/about", label: "About" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 text-sm font-semibold text-muted-foreground sm:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-full px-3 py-2 transition-colors hover:bg-surface-2 hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu user={user ? { name: user.name, email: user.email, role: user.role } : null} />
          </div>
        </div>
      </header>
      {/* Phones: a tab bar at the bottom on the top-level pages, so My tickets is one thumb away */}
      <BottomNav signedIn={!!user} />
    </>
  );
}
