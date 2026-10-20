import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EventForm } from "@/components/admin/event-form";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "New event" };

export default async function NewEventPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/admin/events" className="hover:text-foreground">Events</Link>
          <ChevronRight className="size-4" aria-hidden />
          <span className="text-foreground">New</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">New event</h1>
        <p className="text-sm text-muted-foreground">It&apos;s saved as a hidden draft. You can preview it, then publish from the event page.</p>
      </div>
      <EventForm appUrl={env.appUrl} />
    </div>
  );
}
