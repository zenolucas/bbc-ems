import { NextResponse } from "next/server";
import { runCronJobs } from "@/lib/cron";
import { env } from "@/lib/env";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (env.cronSecret && auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await runCronJobs()) });
}
