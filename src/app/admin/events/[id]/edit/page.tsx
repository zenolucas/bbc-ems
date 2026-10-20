import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventForm } from "@/components/admin/event-form";
import { FlashToast } from "@/components/ui/flash-toast";
import { env } from "@/lib/env";
import { getEventById } from "@/lib/events";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: PageProps<"/admin/events/[id]/edit">) {
  const { id } = await params;
  await requireAdmin();
  const event = await getEventById(id);
  if (!event) notFound();
  const { tiers, ...ev } = event;
  return (
    <>
      <Suspense><FlashToast messages={{ duplicated: "Copy created as a draft. Update the dates, then save." }} /></Suspense>
      <EventForm event={ev} tiers={tiers} appUrl={env.appUrl} />
    </>
  );
}
