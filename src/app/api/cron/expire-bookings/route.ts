import { NextResponse } from "next/server";
import { expireOverdueBookings } from "@/lib/bookings";
import { env } from "@/lib/env";
import { sendReminders } from "@/lib/reminders";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (env.cronSecret && auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expired = await expireOverdueBookings();
  // Rides this cron rather than its own: Vercel limits how many crons a project gets.
  const reminded = await sendReminders().catch((e) => {
    console.error("[cron] reminders", e);
    return 0;
  });
  return NextResponse.json({ ok: true, expired, reminded });
}
