"use server";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import slugify from "slugify";
import { z } from "zod";
import { db } from "@/db/client";
import { EVENT_CATEGORIES, TICKET_STYLES, bookingItems, bookings, events, ticketTiers, tickets } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { syncDiscordEventLater } from "@/lib/discord/sync";
import { getEventById, holdingCondition, publishChecklist } from "@/lib/events";
import { fromLocalInput } from "@/lib/format";
import { notifyEventCancelled, notifyLater } from "@/lib/notifications";
import { requireAdmin } from "@/lib/session";

const num = (what: string) => ({ error: `Enter a number for ${what}` });

const tierSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Tier name is required"),
  description: z.string().trim().optional().default(""),
  price: z.coerce.number(num("price")).min(0, "Price can't be negative"),
  quantity: z.coerce.number(num("quantity")).int("Quantity must be a whole number").min(1, "At least 1 ticket"),
  perOrderLimit: z.coerce.number(num("per order")).int("Whole number").min(1, "At least 1").max(20, "20 at most").default(4),
  salesStart: z.string().optional().default(""),
  salesEnd: z.string().optional().default(""),
});

const eventSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, "Title is too short"),
  slug: z.string().trim().optional().default(""),
  tagline: z.string().trim().optional().default(""),
  descriptionMd: z.string().optional().default(""),
  venueName: z.string().trim().min(2, "Venue is required"),
  venueAddress: z.string().trim().optional().default(""),
  mapUrl: z.string().trim().optional().default(""),
  startsAt: z.string().min(1, "Start date is required"),
  endsAt: z.string().optional().default(""),
  coverImageUrl: z.string().optional().default(""),
  ticketStyle: z.enum(TICKET_STYLES),
  category: z.enum(EVENT_CATEGORIES).optional().default("other"),
  paymentInstructions: z.string().optional().default(""),
  gcashName: z.string().trim().optional().default(""),
  gcashNumber: z.string().trim().optional().default(""),
  gcashQrUrl: z.string().optional().default(""),
  bookingHoldHours: z.coerce.number(num("hold time")).int("Whole hours").min(1, "At least 1 hour").max(168, "A week at most").default(24),
  tiers: z.array(tierSchema).min(1, "Add at least one ticket tier"),
});

export type EventFormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | null;

function nullable(s: string) {
  return s.trim() === "" ? null : s;
}

export async function saveEvent(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const admin = await requireAdmin();
  // Echoed back on error so the form keeps what the admin typed (React resets forms after actions).
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && k !== "tiers") values[k] = v;
  const fail = (fieldErrors: Record<string, string>, error?: string): EventFormState => ({
    error: error ?? `Please fix ${Object.keys(fieldErrors).length === 1 ? "the highlighted field" : "the highlighted fields"}`,
    fieldErrors,
    values,
  });

  let tiersRaw: unknown = [];
  try {
    tiersRaw = JSON.parse(String(formData.get("tiers") ?? "[]"));
  } catch {
    return { error: "Ticket tiers could not be read", values };
  }
  const parsed = eventSchema.safeParse({ ...values, tiers: tiersRaw });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return fail(fieldErrors);
  }
  const d = parsed.data;
  const startsAt = fromLocalInput(d.startsAt)!;
  const endsAt = fromLocalInput(d.endsAt);
  const fe: Record<string, string> = {};
  if (endsAt && endsAt <= startsAt) fe.endsAt = "End must be after the start";

  const existingEvent = d.id ? await db.query.events.findFirst({ where: eq(events.id, d.id) }) : null;
  if (d.id && !existingEvent) return { error: "This event no longer exists", values };
  const existingTiers = d.id ? await db.query.ticketTiers.findMany({ where: eq(ticketTiers.eventId, d.id) }) : [];

  // Seats already spoken for per tier, so quantity can't drop below them
  const heldRows = d.id
    ? await db
        .select({ tierId: bookingItems.tierId, held: sql<number>`coalesce(sum(${bookingItems.quantity}), 0)::int` })
        .from(bookingItems)
        .innerJoin(bookings, eq(bookings.id, bookingItems.bookingId))
        .where(and(eq(bookings.eventId, d.id), holdingCondition()))
        .groupBy(bookingItems.tierId)
    : [];
  const held = new Map(heldRows.map((r) => [r.tierId, r.held]));

  for (const [i, t] of d.tiers.entries()) {
    if (t.perOrderLimit > t.quantity) fe[`tiers.${i}.perOrderLimit`] = `Can't exceed the quantity (${t.quantity})`;
    const ss = fromLocalInput(t.salesStart);
    const se = fromLocalInput(t.salesEnd);
    if (ss && se && se <= ss) fe[`tiers.${i}.salesEnd`] = "Must be after sales start";
    const h = t.id ? held.get(t.id) ?? 0 : 0;
    if (t.id && t.quantity < h) fe[`tiers.${i}.quantity`] = `${h} already booked; can't go lower`;
  }
  const paid = d.tiers.some((t) => t.price > 0);
  if (paid && existingEvent?.status === "published" && !d.gcashNumber && !d.gcashQrUrl) {
    fe.gcashNumber = "A published event with paid tiers needs a GCash number or QR";
  }
  // Tiers removed from the form: refuse if anyone booked them (FK would fail mid-transaction)
  const keptIds = new Set(d.tiers.map((t) => t.id).filter(Boolean));
  const removed = existingTiers.filter((t) => !keptIds.has(t.id));
  if (removed.length) {
    const used = await db
      .selectDistinct({ tierId: bookingItems.tierId })
      .from(bookingItems)
      .where(inArray(bookingItems.tierId, removed.map((t) => t.id)));
    if (used.length) {
      const names = removed.filter((t) => used.some((u) => u.tierId === t.id)).map((t) => `"${t.name}"`).join(", ");
      fe.tiers = `${names} already ${used.length === 1 ? "has" : "have"} bookings and can't be removed. Set the quantity to what's sold, or add a sales end date, instead.`;
    }
  }
  if (Object.keys(fe).length) return fail(fe);

  const id = d.id || nanoid(12);
  let slug = slugify(d.slug || d.title, { lower: true, strict: true }).slice(0, 80) || id;
  const clash = await db.query.events.findFirst({ where: and(eq(events.slug, slug), ne(events.id, id)) });
  if (clash) {
    if (d.slug) return fail({ slug: `/events/${slug} is used by "${clash.title}". Pick another.` });
    slug = `${slug}-${nanoid(4).toLowerCase()}`;
  }

  const row = {
    slug,
    title: d.title,
    tagline: nullable(d.tagline),
    descriptionMd: d.descriptionMd,
    venueName: d.venueName,
    venueAddress: nullable(d.venueAddress),
    mapUrl: nullable(d.mapUrl),
    startsAt,
    endsAt,
    coverImageUrl: nullable(d.coverImageUrl),
    ticketStyle: d.ticketStyle,
    category: d.category,
    paymentInstructions: nullable(d.paymentInstructions),
    gcashName: nullable(d.gcashName),
    gcashNumber: nullable(d.gcashNumber),
    gcashQrUrl: nullable(d.gcashQrUrl),
    bookingHoldHours: d.bookingHoldHours,
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    // Status is changed only from the Status card on the event page; new events start as drafts.
    if (d.id) await tx.update(events).set(row).where(eq(events.id, id));
    else await tx.insert(events).values({ id, ...row, status: "draft", createdBy: admin.id });
    for (const [i, t] of d.tiers.entries()) {
      const tierValues = {
        eventId: id,
        name: t.name,
        description: nullable(t.description),
        priceCents: Math.round(t.price * 100),
        quantity: t.quantity,
        perOrderLimit: t.perOrderLimit,
        salesStart: fromLocalInput(t.salesStart),
        salesEnd: fromLocalInput(t.salesEnd),
        sortOrder: i,
      };
      if (t.id && existingTiers.some((e) => e.id === t.id)) await tx.update(ticketTiers).set(tierValues).where(eq(ticketTiers.id, t.id));
      else await tx.insert(ticketTiers).values({ id: nanoid(12), ...tierValues });
    }
    if (removed.length) await tx.delete(ticketTiers).where(inArray(ticketTiers.id, removed.map((t) => t.id)));
  });

  // Title, date, venue or tier edits show up in the Discord post and event straight away
  if (existingEvent?.status === "published") syncDiscordEventLater(id);
  revalidateEvent(id, slug, existingEvent?.slug);
  redirect(`/admin/events/${id}?${d.id ? "saved" : "created"}=1`);
}

function revalidateEvent(id: string, slug?: string | null, oldSlug?: string | null) {
  revalidatePath("/");
  if (slug) revalidatePath(`/events/${slug}`);
  if (oldSlug && oldSlug !== slug) revalidatePath(`/events/${oldSlug}`);
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/events/${id}`, "layout");
}

type Status = "draft" | "published" | "ended";

/** Publish / unpublish / mark ended. Cancelling has its own action because it touches bookings. */
export async function setEventStatus(id: string, status: Status): Promise<ActionResult> {
  await requireAdmin();
  const ev = await getEventById(id);
  if (!ev) return { error: "Event not found" };
  if (ev.status === "cancelled") return { error: "Cancelled events can't be reopened. Duplicate it to start again." };
  if (status === "published") {
    const missing = publishChecklist(ev, ev.tiers).filter((c) => c.required && !c.ok);
    if (missing.length) return { error: `Before publishing: ${missing.map((m) => m.label.toLowerCase()).join("; ")}` };
  }
  await db.update(events).set({ status, updatedAt: new Date() }).where(eq(events.id, id));
  // Publishing announces it on Discord; unpublishing takes the post down; ending marks it over
  syncDiscordEventLater(id);
  revalidateEvent(id, ev.slug);
  return { ok: true };
}

/**
 * Cancels the event and everything hanging off it: valid tickets are voided,
 * open bookings are cancelled, and every affected member is emailed.
 */
export async function cancelEvent(id: string, message: string): Promise<ActionResult<{ notified: number }>> {
  await requireAdmin();
  const ev = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!ev) return { error: "Event not found" };
  if (ev.status === "cancelled") return { error: "Already cancelled" };
  const affected = await db.transaction(async (tx) => {
    await tx.update(events).set({ status: "cancelled", updatedAt: new Date() }).where(eq(events.id, id));
    await tx.update(tickets).set({ status: "void" }).where(and(eq(tickets.eventId, id), eq(tickets.status, "valid")));
    const open = await tx
      .update(bookings)
      .set({ status: "cancelled", reviewNote: "Event cancelled", updatedAt: new Date() })
      .where(and(eq(bookings.eventId, id), inArray(bookings.status, ["pending_payment", "under_review", "rejected"])))
      .returning({ id: bookings.id });
    const approved = await tx.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.eventId, id), eq(bookings.status, "approved")));
    return [...open, ...approved].map((b) => b.id);
  });
  const note = message.trim() || null;
  for (const bookingId of affected) notifyLater("event cancelled", () => notifyEventCancelled(bookingId, note));
  syncDiscordEventLater(id);
  revalidateEvent(id, ev.slug);
  return { ok: true, notified: affected.length };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  await requireAdmin();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.eventId, id), inArray(bookings.status, ["approved", "under_review"])));
  if (n > 0) return { error: `${n} booking${n === 1 ? " has" : "s have"} paid or submitted payment. Cancel the event instead so they're notified.` };
  await db.delete(events).where(eq(events.id, id));
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  redirect("/admin/events?deleted=1");
}

/** Copies an event and its tiers into a new draft and opens it for editing. */
export async function duplicateEvent(id: string) {
  const admin = await requireAdmin();
  const ev = await getEventById(id);
  if (!ev) return { error: "Event not found" };
  const newId = nanoid(12);
  const { id: _id, tiers, slug: _slug, createdAt: _c, updatedAt: _u, status: _s, createdBy: _cb, ...rest } = ev;
  void _id; void _slug; void _c; void _u; void _s; void _cb;
  await db.transaction(async (tx) => {
    await tx.insert(events).values({ ...rest, id: newId, title: `${ev.title} (copy)`, slug: `${ev.slug}-copy-${nanoid(4).toLowerCase()}`, status: "draft", createdBy: admin.id });
    if (tiers.length) {
      await tx.insert(ticketTiers).values(
        tiers.map((t) => ({ id: nanoid(12), eventId: newId, name: t.name, description: t.description, priceCents: t.priceCents, quantity: t.quantity, perOrderLimit: t.perOrderLimit, salesStart: null, salesEnd: null, sortOrder: t.sortOrder })),
      );
    }
  });
  revalidatePath("/admin", "layout");
  redirect(`/admin/events/${newId}/edit?duplicated=1`);
}
