import Link from "next/link";
import { CalendarDays, LayoutDashboard, Palette, ScanLine, UsersRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { NavLink } from "@/components/admin/nav-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { requireStaff } from "@/lib/session";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, staff: false },
  { href: "/admin/events", label: "Events", icon: CalendarDays, exact: false, staff: false },
  { href: "/admin/scan", label: "Scanner", icon: ScanLine, exact: false, staff: true },
  { href: "/admin/team", label: "Team", icon: UsersRound, exact: false, staff: false },
  { href: "/admin/ticket-lab", label: "Ticket lab", icon: Palette, exact: false, staff: false },
] as const;

const link = "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground";
const linkActive = "bg-muted font-medium text-foreground";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const items = nav.filter((n) => user.role === "admin" || n.staff);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
            <Logo size={30} withText={false} />
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">{user.role === "admin" ? "Admin" : "Door crew"}</span>
            <nav aria-label="Admin" className="hidden items-center gap-1 md:flex">
              {items.map((n) => (
                <NavLink key={n.href} href={n.href} exact={n.exact} className={link} activeClassName={linkActive}>
                  <n.icon className="size-4" aria-hidden /> {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/" className="mr-2 hidden text-sm text-muted-foreground hover:text-foreground sm:inline">View site</Link>
            <ThemeToggle />
            <UserMenu user={{ name: user.name, email: user.email, role: user.role }} />
          </div>
        </div>
        {items.length > 1 && (
          <nav aria-label="Admin" className="flex items-center gap-1 overflow-x-auto border-t px-2 py-1 md:hidden">
            {items.map((n) => (
              <NavLink key={n.href} href={n.href} exact={n.exact} className={link} activeClassName={linkActive}>
                <n.icon className="size-4" aria-hidden /> {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
