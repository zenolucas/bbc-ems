import { EventForm } from "@/components/admin/event-form";

export const metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New event</h1>
        <p className="text-sm text-muted-foreground">Save as a draft first, publish when the tiers look right.</p>
      </div>
      <EventForm />
    </div>
  );
}
