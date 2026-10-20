import { NextResponse } from "next/server";
import { buildManifest } from "@/lib/checkins";
import { getCurrentUser, isStaffRole } from "@/lib/session";

export async function GET(_req: Request, { params }: RouteContext<"/api/scan/manifest/[eventId]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  if (!isStaffRole(user.role)) return NextResponse.json({ error: "Door access only" }, { status: 403 });
  const { eventId } = await params;
  const manifest = await buildManifest(eventId);
  if (!manifest) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(manifest, { headers: { "cache-control": "private, no-store" } });
}
