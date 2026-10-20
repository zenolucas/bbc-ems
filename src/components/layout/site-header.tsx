import Link from "next/link";
import { Logo } from "@/components/brand/logo";
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
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
          {links.map((l) => <Link key={l.href} href={l.href} className="hover:text-foreground">{l.label}</Link>)}
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu user={user ? { name: user.name, email: user.email, role: user.role } : null} />
        </div>
      </div>
      {/* Phones: the same links as a compact second row, so My tickets is one tap away */}
      <nav aria-label="Main" className="flex items-center justify-around border-t text-sm font-medium text-muted-foreground sm:hidden">
        {links.map((l) => <Link key={l.href} href={l.href} className="flex-1 py-2.5 text-center hover:text-foreground">{l.label}</Link>)}
      </nav>
    </header>
  );
}
