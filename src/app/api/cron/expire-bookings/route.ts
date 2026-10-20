import { NextResponse } from "next/server";
import { expireOverdueBookings } from "@/lib/bookings";
import { env } from "@/lib/env";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (env.cronSecret && auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expired = await expireOverdueBookings();
  return NextResponse.json({ ok: true, expired });
}
