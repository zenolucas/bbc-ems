"use client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/event/status-badge";
import { fmtTime } from "@/lib/format";
import { manualCheckinAction, undoCheckinAction } from "@/app/admin/attendee-actions";
import { voidTicketAction } from "@/app/admin/booking-actions";

type Row = { id: string; code: string; holder: string; email: string; tier: string; status: string; checkedInAt: string | null; bookingId: string };

export function AttendeeTable({ eventId, rows }: { eventId: string; rows: Row[] }) {
  const [q, setQ] = useState("");
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => [r.holder, r.email, r.code, r.tier].some((v) => v.toLowerCase().includes(s))) : rows;
  }, [q, rows]);

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2 rounded-2xl border bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await manualCheckinAction(eventId, code);
            if (r.error) toast.error(r.error);
            else toast.success(r.ok);
            setCode("");
          });
        }}
      >
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Manual check-in: BBC-XXXX-XXXX" className="font-mono" />
        <Button type="submit" disabled={pending || !code}>Check in</Button>
      </form>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search attendees" />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b"><th className="p-3">Holder</th><th className="p-3">Code</th><th className="p-3">Tier</th><th className="p-3">Status</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y">
            {list.map((r) => (
              <tr key={r.id}>
                <td className="p-3"><div className="font-medium">{r.holder}</div><div className="text-xs text-muted-foreground">{r.email}</div></td>
                <td className="p-3 font-mono">{r.code}</td>
                <td className="p-3">{r.tier}</td>
                <td className="p-3"><StatusBadge status={r.status} />{r.checkedInAt && <div className="mt-1 text-xs text-muted-foreground">{fmtTime(r.checkedInAt)}</div>}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1">
                    {r.status === "valid" && <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const x = await manualCheckinAction(eventId, r.code); if (x.error) toast.error(x.error); else toast.success(x.ok); })}>Check in</Button>}
                    {r.status === "used" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await undoCheckinAction(eventId, r.id); toast.success("Check-in undone"); })}>Undo</Button>}
                    {r.status !== "void" && <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => { if (confirm(`Void ${r.code} for ${r.holder}?`)) start(async () => { await voidTicketAction(r.id, eventId); toast.success("Voided"); }); }}>Void</Button>}
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No tickets yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
