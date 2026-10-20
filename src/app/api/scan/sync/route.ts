import { NextResponse } from "next/server";
import { z } from "zod";
import { applyCheckins } from "@/lib/checkins";
import { getCurrentUser } from "@/lib/session";

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
      }),
    )
    .max(500),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { eventId, deviceId, checkins } = parsed.data;
  const outcomes = await applyCheckins(eventId, user.id, deviceId, checkins);
  return NextResponse.json({ outcomes });
}
