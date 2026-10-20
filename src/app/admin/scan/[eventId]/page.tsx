import { notFound } from "next/navigation";
import { Scanner } from "@/components/scanner/scanner";
import { getEventById } from "@/lib/events";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scan" };

export default async function ScanEventPage({ params }: PageProps<"/admin/scan/[eventId]">) {
  const { eventId } = await params;
  const event = await getEventById(eventId);
  if (!event) notFound();
  return <Scanner eventId={event.id} title={event.title} />;
}
