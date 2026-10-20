import Link from "next/link";
import { desc } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/event/status-badge";

export const metadata = { title: "Events" };

export default async function AdminEventsPage() {
  const rows = await db.query.events.findMany({ orderBy: desc(events.startsAt), with: { tiers: true } });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <Button asChild><Link href="/admin/events/new"><Plus className="size-4" /> New event</Link></Button>
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Tiers</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No events yet. Create the first one.</TableCell></TableRow>
            )}
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Link href={`/admin/events/${e.id}`} className="font-medium hover:underline">{e.title}</Link>
                  <div className="text-xs text-muted-foreground">{e.venueName}</div>
                </TableCell>
                <TableCell className="text-sm">{fmtDateTime(e.startsAt)}</TableCell>
                <TableCell className="text-sm">
                  <div className="flex flex-wrap gap-1">{e.tiers.map((t) => <Badge key={t.id} variant="secondary">{t.name} · {t.quantity}</Badge>)}</div>
                </TableCell>
                <TableCell><StatusBadge status={e.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
