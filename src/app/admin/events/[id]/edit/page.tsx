import { notFound } from "next/navigation";
import { EventForm } from "@/components/admin/event-form";
import { getEventById } from "@/lib/events";

export const metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: PageProps<"/admin/events/[id]/edit">) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();
  const { tiers, ...ev } = event;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit · {event.title}</h1>
      <EventForm event={ev} tiers={tiers} />
    </div>
  );
}
