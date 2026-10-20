import { NextResponse } from "next/server";
import { TICKET_STYLES, type TicketStyle } from "@/db/schema";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { renderTicketPng } from "@/lib/tickets/render/server";
import { sampleTicket } from "@/lib/tickets/sample";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const style = searchParams.get("style") as TicketStyle;
  const theme = searchParams.get("theme") === "dark" ? "dark" : "light";
  if (!TICKET_STYLES.includes(style)) return NextResponse.json({ error: "Unknown style" }, { status: 400 });
  const png = await renderTicketPng(style, sampleTicket(theme, env.appUrl));
  return new NextResponse(new Uint8Array(png), {
    headers: { "content-type": "image/png", "content-disposition": `inline; filename="bbc-${style}-${theme}.png"` },
  });
}
