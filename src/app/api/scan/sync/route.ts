import { NextResponse } from "next/server";
import { z } from "zod";
import { applyCheckins } from "@/lib/checkins";
import { getCurrentUser, isStaffRole } from "@/lib/session";

const schema = z.object({
  eventId: z.string().min(1),
  deviceId: z.string().min(1).max(64),
  checkins: z
    .array(
      z.object({
        clientId: z.string().min(8).max(64),
        ticketId: z.string().nullable(),
        rawPayload: z.string().nullable(),
        scannedAt: z.string(),
        localResult: z.enum(["ok", "duplicate", "invalid", "void"]).optional(),
      }),
    )
    .max(500),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  if (!isStaffRole(user.role)) return NextResponse.json({ error: "Door access only" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { eventId, deviceId, checkins } = parsed.data;
  const outcomes = await applyCheckins(eventId, user.id, deviceId, checkins);
  return NextResponse.json({ outcomes });
}
