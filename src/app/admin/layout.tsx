import Link from "next/link";
import { CalendarDays, LayoutDashboard, Palette, ScanLine } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { requireAdmin } from "@/lib/session";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/scan", label: "Scanner", icon: ScanLine },
  { href: "/admin/ticket-lab", label: "Ticket lab", icon: Palette },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
            <Logo size={30} withText={false} />
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">Admin</span>
            <nav className="hidden items-center gap-1 md:flex">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  <n.icon className="size-4" /> {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline mr-2">View site</Link>
            <ThemeToggle />
            <UserMenu user={{ name: user.name, email: user.email, role: user.role }} />
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t px-2 py-1 md:hidden">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              <n.icon className="size-4" /> {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
