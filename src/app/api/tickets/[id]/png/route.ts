import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { renderTicketPng } from "@/lib/tickets/render/server";
import { urlFor } from "@/lib/tickets/server";

export async function GET(req: Request, { params }: RouteContext<"/api/tickets/[id]/png">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const t = await db.query.tickets.findFirst({
    where: user.role === "admin" ? eq(tickets.id, id) : and(eq(tickets.id, id), eq(tickets.userId, user.id)),
    with: { event: true, tier: true },
  });
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const theme = new URL(req.url).searchParams.get("theme") === "dark" ? "dark" : "light";
  const png = await renderTicketPng(t.event.ticketStyle, {
    url: urlFor(t),
    shortCode: t.shortCode,
    holderName: t.holderName,
    tierName: t.tier.name,
    event: { title: t.event.title, startsAt: t.event.startsAt, endsAt: t.event.endsAt, venueName: t.event.venueName },
    theme,
  });
  return new NextResponse(new Uint8Array(png), {
    headers: { "content-type": "image/png", "content-disposition": `inline; filename="${t.shortCode}.png"`, "cache-control": "private, no-store" },
  });
}
