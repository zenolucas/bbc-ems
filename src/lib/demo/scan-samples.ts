import "server-only";
import type { ScanSample } from "@bbc/shared/demo";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { tickets } from "@/db/schema";
import { SHORT_CODE_ALPHABET } from "@bbc/shared/shortcode";
import { urlFor } from "@/lib/tickets/server";

/**
 * One of each thing a door can meet, for scanning without a second phone: a good
 * ticket, one already in, a real ticket for another night, a tampered QR and a code
 * that doesn't exist. QR samples go through the scanner's signature check.
 */
export async function scanSamples(eventId: string): Promise<ScanSample[]> {
  const out: ScanSample[] = [];
  const valid = await db.query.tickets.findMany({ where: and(eq(tickets.eventId, eventId), eq(tickets.status, "valid")), limit: 2, orderBy: (t, { asc }) => asc(t.createdAt) });
  const used = await db.query.tickets.findFirst({ where: and(eq(tickets.eventId, eventId), eq(tickets.status, "used")) });
  const other = await db.query.tickets.findFirst({ where: and(ne(tickets.eventId, eventId), eq(tickets.status, "valid")) });

  if (valid[0]) out.push({ kind: "valid", label: `Valid · ${valid[0].holderName}`, text: urlFor(valid[0]), via: "qr" });
  if (valid[1]) out.push({ kind: "valid", label: `Valid code · ${valid[1].holderName}`, text: valid[1].shortCode, via: "code" });
  if (used) out.push({ kind: "used", label: `Already in · ${used.holderName}`, text: urlFor(used), via: "qr" });
  if (other) out.push({ kind: "wrong-event", label: "Ticket for another event", text: urlFor(other), via: "qr" });
  if (valid[0]) {
    // Flip one signature character: a well-formed QR that fails the check
    const sig = valid[0].signature;
    const flipped = sig.slice(0, 10) + (sig[10] === "A" ? "B" : "A") + sig.slice(11);
    out.push({ kind: "forged", label: "Edited QR (bad signature)", text: urlFor({ ...valid[0], signature: flipped }), via: "qr" });
  }
  let code = "";
  for (let i = 0; i < 8; i++) code += SHORT_CODE_ALPHABET[Math.floor(Math.random() * SHORT_CODE_ALPHABET.length)];
  out.push({ kind: "unknown", label: "Code that doesn't exist", text: `BBC-${code.slice(0, 4)}-${code.slice(4)}`, via: "code" });
  return out;
}
