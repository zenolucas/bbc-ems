import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/session";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Events</Link>
          <Link href="/me" className="hover:text-foreground">My tickets</Link>
          <Link href="/about" className="hover:text-foreground">About</Link>
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu user={user ? { name: user.name, email: user.email, role: user.role } : null} />
        </div>
      </div>
    </header>
  );
}
