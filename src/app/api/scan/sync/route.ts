import { NextResponse } from "next/server";
import { syncSchema } from "@bbc/shared/schemas";
import { applyCheckins } from "@/lib/checkins";
import { getCurrentUser, isStaffRole } from "@/lib/session";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  if (!isStaffRole(user.role)) return NextResponse.json({ error: "Door access only" }, { status: 403 });
  const parsed = syncSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { eventId, deviceId, checkins } = parsed.data;
  const outcomes = await applyCheckins(eventId, user.id, deviceId, checkins);
  return NextResponse.json({ outcomes });
}
