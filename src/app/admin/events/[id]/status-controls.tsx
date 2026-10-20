"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteEvent, setEventStatus } from "@/app/admin/actions";

export function EventStatusControls({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const set = (s: "draft" | "published" | "cancelled" | "ended") =>
    start(async () => {
      await setEventStatus(id, s);
      toast.success(`Event marked ${s}`);
    });
  return (
    <Card>
      <CardHeader><CardTitle>Status</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {status !== "published" && <Button size="sm" disabled={pending} onClick={() => set("published")}>Publish</Button>}
        {status === "published" && <Button size="sm" variant="outline" disabled={pending} onClick={() => set("draft")}>Unpublish</Button>}
        {status !== "ended" && <Button size="sm" variant="outline" disabled={pending} onClick={() => set("ended")}>Mark ended</Button>}
        {status !== "cancelled" && <Button size="sm" variant="outline" disabled={pending} onClick={() => set("cancelled")}>Cancel event</Button>}
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this event and all its bookings and tickets? This cannot be undone.")) start(() => deleteEvent(id));
          }}
        >
          Delete
        </Button>
      </CardContent>
    </Card>
  );
}
