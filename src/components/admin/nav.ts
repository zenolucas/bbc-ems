import { CalendarDays, ClipboardCheck, LayoutDashboard, Palette, ScanLine, Shield, UsersRound, type LucideIcon } from "lucide-react";

export type AdminRole = "admin" | "staff";
export type AdminUser = { name: string; email: string; role: AdminRole };
export type AdminEventRef = { id: string; title: string; status: string; startsAt: string };

export type NavItem = {
  key: "dashboard" | "events" | "review" | "attendees" | "scan" | "team" | "lab";
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Second group in the rail, below the divider. */
  secondary?: boolean;
  /** Door crew see this one too. */
  staff?: boolean;
};

export const NAV: NavItem[] = [
  { key: "dashboard", href: "/admin", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { key: "events", href: "/admin/events", label: "Events", short: "Events", icon: CalendarDays },
  { key: "review", href: "/admin/review", label: "Review queue", short: "Review", icon: ClipboardCheck },
  { key: "attendees", href: "/admin/attendees", label: "Attendees", short: "Attendees", icon: UsersRound },
  { key: "scan", href: "/admin/scan", label: "Door scanner", short: "Scanner", icon: ScanLine, staff: true },
  { key: "team", href: "/admin/team", label: "Team", short: "Team", icon: Shield, secondary: true },
  { key: "lab", href: "/admin/ticket-lab", label: "Ticket lab", short: "Ticket lab", icon: Palette, secondary: true },
];

export function navFor(role: AdminRole) {
  return NAV.filter((n) => role === "admin" || n.staff);
}

/**
 * Which rail item a path belongs to. Bookings live under an event but are the
 * review queue's work, so they light up "Review queue", not "Events".
 */
export function activeKey(path: string): NavItem["key"] | null {
  if (path === "/admin") return "dashboard";
  if (path.startsWith("/admin/review") || /^\/admin\/events\/[^/]+\/bookings/.test(path)) return "review";
  if (path.startsWith("/admin/events")) return "events";
  if (path.startsWith("/admin/attendees")) return "attendees";
  if (path.startsWith("/admin/scan")) return "scan";
  if (path.startsWith("/admin/team")) return "team";
  if (path.startsWith("/admin/ticket-lab")) return "lab";
  return null;
}

/** Door mode draws its own always-dark, full-screen chrome: no rail, bars or padding. */
export function isDoorMode(path: string) {
  return /^\/admin\/scan\/[^/]+/.test(path);
}

export function initials(user: { name: string; email: string }) {
  const parts = (user.name || user.email.split("@")[0]).trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}
