import { desc } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { AdminShell } from "@/components/admin/shell";
import { pendingReviewByEvent } from "@/lib/events";
import { requireStaff } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const isAdmin = user.role === "admin";
  // Titles feed the top-bar breadcrumb and the ⌘K palette; the count feeds the Review badge
  const [list, pending] = await Promise.all([
    db.select({ id: events.id, title: events.title, status: events.status, startsAt: events.startsAt }).from(events).orderBy(desc(events.startsAt)),
    isAdmin ? pendingReviewByEvent() : Promise.resolve(new Map<string, number>()),
  ]);
  const reviewCount = [...pending.values()].reduce((n, v) => n + v, 0);
  // The mobile app's WebView adds "BBCApp/<version>" to its user agent
  const embed = /\bBBCApp\//.test((await headers()).get("user-agent") ?? "");
  return (
    <AdminShell
      embed={embed}
      user={{ name: user.name, email: user.email, role: user.role === "admin" ? "admin" : "staff" }}
      reviewCount={reviewCount}
      events={list.map((e) => ({ id: e.id, title: e.title, status: e.status, startsAt: e.startsAt.toISOString() }))}
    >
      {children}
    </AdminShell>
  );
}
