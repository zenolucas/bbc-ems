"use server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import slugify from "slugify";
import { z } from "zod";
import { db } from "@/db/client";
import { TICKET_STYLES, events, ticketTiers } from "@/db/schema";
import { fromLocalInput } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

const tierSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Tier name is required"),
  description: z.string().trim().optional().default(""),
  price: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1),
  perOrderLimit: z.coerce.number().int().min(1).max(20).default(4),
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
  status: z.enum(["draft", "published", "cancelled", "ended"]),
  ticketStyle: z.enum(TICKET_STYLES),
  paymentInstructions: z.string().optional().default(""),
  gcashName: z.string().trim().optional().default(""),
  gcashNumber: z.string().trim().optional().default(""),
  gcashQrUrl: z.string().optional().default(""),
  bookingHoldHours: z.coerce.number().int().min(1).max(168).default(24),
  tiers: z.array(tierSchema).min(1, "Add at least one ticket tier"),
});

export type EventFormState = { error?: string; fieldErrors?: Record<string, string> } | null;

function nullable(s: string) {
  return s.trim() === "" ? null : s;
}

export async function saveEvent(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const admin = await requireAdmin();
  let tiersRaw: unknown = [];
  try {
    tiersRaw = JSON.parse(String(formData.get("tiers") ?? "[]"));
  } catch {
    return { error: "Ticket tiers could not be read" };
  }
  const parsed = eventSchema.safeParse({ ...Object.fromEntries(formData), tiers: tiersRaw });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
    return { error: parsed.error.issues[0]?.message ?? "Please check the form", fieldErrors };
  }
  const d = parsed.data;
  const startsAt = fromLocalInput(d.startsAt)!;
  const endsAt = fromLocalInput(d.endsAt);
  if (endsAt && endsAt <= startsAt) return { error: "End time must be after the start time" };

  const id = d.id || nanoid(12);
  let slug = slugify(d.slug || d.title, { lower: true, strict: true }).slice(0, 80) || id;
  const clash = await db.query.events.findFirst({ where: and(eq(events.slug, slug), ne(events.id, id)) });
  if (clash) slug = `${slug}-${nanoid(4).toLowerCase()}`;

  const values = {
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
    status: d.status,
    ticketStyle: d.ticketStyle,
    paymentInstructions: nullable(d.paymentInstructions),
    gcashName: nullable(d.gcashName),
    gcashNumber: nullable(d.gcashNumber),
    gcashQrUrl: nullable(d.gcashQrUrl),
    bookingHoldHours: d.bookingHoldHours,
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    if (d.id) {
      await tx.update(events).set(values).where(eq(events.id, id));
    } else {
      await tx.insert(events).values({ id, ...values, createdBy: admin.id });
    }
    const existing = d.id ? await tx.query.ticketTiers.findMany({ where: eq(ticketTiers.eventId, id) }) : [];
    const keep = new Set<string>();
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
      if (t.id && existing.some((e) => e.id === t.id)) {
        keep.add(t.id);
        await tx.update(ticketTiers).set(tierValues).where(eq(ticketTiers.id, t.id));
      } else {
        const tid = nanoid(12);
        keep.add(tid);
        await tx.insert(ticketTiers).values({ id: tid, ...tierValues });
      }
    }
    for (const e of existing) {
      if (!keep.has(e.id)) {
        // Tiers with sold tickets are protected by the FK; surface a clear message.
        try {
          await tx.delete(ticketTiers).where(eq(ticketTiers.id, e.id));
        } catch {
          throw new Error(`Tier "${e.name}" already has bookings and cannot be removed. Set its quantity to the sold amount instead.`);
        }
      }
    }
  }).catch((e: unknown) => {
    throw e;
  });

  revalidatePath("/");
  revalidatePath(`/events/${slug}`);
  revalidatePath("/admin/events");
  redirect(`/admin/events/${id}`);
}

export async function setEventStatus(id: string, status: "draft" | "published" | "cancelled" | "ended") {
  await requireAdmin();
  const [ev] = await db.update(events).set({ status, updatedAt: new Date() }).where(eq(events.id, id)).returning({ slug: events.slug });
  revalidatePath("/");
  if (ev) revalidatePath(`/events/${ev.slug}`);
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${id}`);
}

export async function deleteEvent(id: string) {
  await requireAdmin();
  await db.delete(events).where(eq(events.id, id));
  revalidatePath("/");
  revalidatePath("/admin/events");
  redirect("/admin/events");
}
