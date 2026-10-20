import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { Scanner } from "@/components/scanner/scanner";
import { getEventById } from "@/lib/events";
import { requireStaff } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scan" };
// Door mode is always dark, so the phone's browser bar should be too
export const viewport: Viewport = { themeColor: "#0e1c20" };

export default async function ScanEventPage({ params }: PageProps<"/admin/scan/[eventId]">) {
  const { eventId } = await params;
  const user = await requireStaff();
  const event = await getEventById(eventId);
  if (!event) notFound();
  return <Scanner eventId={event.id} title={event.title} backHref={user.role === "admin" ? `/admin/events/${event.id}` : "/admin/scan"} />;
}
