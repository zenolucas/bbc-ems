import { EventForm } from "@/components/admin/event-form";
import { PageHeader } from "@/components/admin/panel";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "New event" };

export default async function NewEventPage() {
  await requireAdmin();
  return (
    <div className="space-y-5">
      <PageHeader title="New event" sub="It's saved as a hidden draft. You can preview it, then publish from the event page." />
      <EventForm appUrl={env.appUrl} now={new Date().getTime()} />
    </div>
  );
}
