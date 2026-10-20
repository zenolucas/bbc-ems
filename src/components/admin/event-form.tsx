"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, CircleCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Event, TicketTier } from "@/db/schema";
import { TICKET_STYLES } from "@/db/schema";
import { toLocalInput } from "@/lib/format";
import { runAction } from "@/lib/run-action";
import { cn } from "@/lib/utils";
import { type EventFormState, saveEvent, setEventStatus } from "@/app/admin/actions";
import { type Check as PublishCheck, ChecklistCard, EventPreview, fmtWall, wallTime } from "./event-preview";
import { ImageUpload } from "./image-upload";

type TierDraft = {
  key: string;
  id?: string;
  name: string;
  description: string;
  price: string;
  quantity: string;
  perOrderLimit: string;
  salesStart: string;
  salesEnd: string;
};

const STYLE_LABELS: Record<(typeof TICKET_STYLES)[number], string> = {
  summit: "Summit",
  "night-sky": "Night Sky",
  "trail-pass": "Trail Pass",
  "ridge-line": "Ridge Line",
  "campfire-stamp": "Campfire Stamp",
};

const SECTIONS = [
  { id: "basics", label: "Basics" },
  { id: "tiers", label: "Tiers" },
  { id: "payment", label: "Payment" },
  { id: "settings", label: "Settings" },
  { id: "poster", label: "Poster" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

/** Which section a server-side field error belongs to, so that section opens. */
function sectionOf(field: string): SectionId {
  if (field.startsWith("tiers")) return "tiers";
  if (["gcashNumber", "gcashName", "gcashQrUrl", "bookingHoldHours", "paymentInstructions"].includes(field)) return "payment";
  if (["slug", "ticketStyle"].includes(field)) return "settings";
  if (field === "coverImageUrl") return "poster";
  return "basics";
}

/** The fields the preview, ticks and summaries read. Kept in sync from the form's input events. */
type Snap = { tagline: string; startsAt: string; endsAt: string; venueName: string; venueAddress: string; descriptionMd: string; gcashName: string; gcashNumber: string; bookingHoldHours: string; coverImageUrl: string; gcashQrUrl: string };
const SNAP_KEYS: (keyof Snap)[] = ["tagline", "startsAt", "endsAt", "venueName", "venueAddress", "descriptionMd", "gcashName", "gcashNumber", "bookingHoldHours", "coverImageUrl", "gcashQrUrl"];

function newTier(): TierDraft {
  return { key: crypto.randomUUID(), name: "", description: "", price: "0", quantity: "50", perOrderLimit: "4", salesStart: "", salesEnd: "" };
}

/**
 * Create/edit an event. An outline on the left ticks off sections as they're
 * complete; each section collapses to a one-line summary; the aside redraws
 * the public card and the publish checklist as you type; the save bar says
 * when there's something to save. Everything still posts to `saveEvent` as
 * one form: collapsed sections are hidden, not unmounted, so their fields submit.
 */
export function EventForm({ event, tiers, appUrl, now, savedLabel }: { event?: Event; tiers?: TicketTier[]; appUrl: string; now: number; savedLabel?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<EventFormState, FormData>(saveEvent, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [uploads, setUploads] = useState(0);
  const [tierRows, setTierRows] = useState<TierDraft[]>(
    tiers?.length
      ? tiers.map((t) => ({
          key: t.id,
          id: t.id,
          name: t.name,
          description: t.description ?? "",
          price: (t.priceCents / 100).toString(),
          quantity: String(t.quantity),
          perOrderLimit: String(t.perOrderLimit),
          salesStart: toLocalInput(t.salesStart),
          salesEnd: toLocalInput(t.salesEnd),
        }))
      // A fixed key for the first row so the server and client render the same field ids
      : [{ ...newTier(), key: "tier-first", name: "General Admission" }],
  );
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [title, setTitle] = useState(event?.title ?? "");
  const [ticketStyle, setTicketStyle] = useState<string>(event?.ticketStyle ?? "summit");
  const [snap, setSnap] = useState<Snap>(() => ({
    tagline: event?.tagline ?? "",
    startsAt: toLocalInput(event?.startsAt),
    endsAt: toLocalInput(event?.endsAt),
    venueName: event?.venueName ?? "",
    venueAddress: event?.venueAddress ?? "",
    descriptionMd: event?.descriptionMd ?? "",
    gcashName: event?.gcashName ?? "",
    gcashNumber: event?.gcashNumber ?? "",
    bookingHoldHours: String(event?.bookingHoldHours ?? 24),
    coverImageUrl: event?.coverImageUrl ?? "",
    gcashQrUrl: event?.gcashQrUrl ?? "",
  }));
  const fingerprint = (s: Snap, t: TierDraft[], extra: string[]) => JSON.stringify([s, t.map((r) => ({ ...r, key: undefined })), extra]);
  const [baseline] = useState(() => fingerprint(snap, tierRows, [slug, title, ticketStyle]));
  const dirty = fingerprint(snap, tierRows, [slug, title, ticketStyle]) !== baseline;

  // React resets uncontrolled fields to the echoed values after a failed save; follow along
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    const vals = state?.values;
    if (vals) setSnap((s) => ({ ...s, ...Object.fromEntries(SNAP_KEYS.filter((k) => k in vals).map((k) => [k, vals[k]])) }));
  }

  const anyPaid = tierRows.some((t) => Number(t.price) > 0);
  const paymentOk = !anyPaid || Boolean(snap.gcashNumber.trim() || snap.gcashQrUrl);
  const errored = new Set(Object.keys(state?.fieldErrors ?? {}).map(sectionOf));
  const ticks: Record<SectionId, boolean> = {
    basics: Boolean(title.trim().length >= 3 && snap.startsAt && snap.venueName.trim().length >= 2),
    tiers: tierRows.length > 0 && tierRows.every((t) => t.name.trim() && Number(t.quantity) > 0),
    payment: paymentOk,
    settings: true,
    poster: Boolean(snap.coverImageUrl),
  };
  const [open, setOpen] = useState<Record<SectionId, boolean>>(() =>
    event
      ? { basics: true, tiers: true, payment: !paymentOk, settings: false, poster: !event.coverImageUrl }
      : { basics: true, tiers: true, payment: true, settings: true, poster: true },
  );
  const isOpen = (id: SectionId) => open[id] || errored.has(id);
  const toggle = (id: SectionId, to?: boolean) => setOpen((o) => ({ ...o, [id]: to ?? !o[id] }));

  // Outline highlights the section you're reading
  const [current, setCurrent] = useState<SectionId>("basics");
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    // Entries only report changes, so remember what's in the reading band and take the first in form order
    const inView = new Set<string>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) inView.add(e.target.id);
        else inView.delete(e.target.id);
      }
      const first = SECTIONS.find((s) => inView.has(s.id));
      if (first) setCurrent(first.id);
    }, { rootMargin: "-100px 0px -55% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  // After a failed save, jump to the first problem
  useEffect(() => {
    if (!state?.fieldErrors) return;
    const el = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true'], [data-field-error]");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  }, [state]);

  // Don't lose an afternoon of typing to a stray back-swipe
  const submitting = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { if (!submitting.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function readForm() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    setSnap((s) => {
      const next = { ...s };
      for (const k of SNAP_KEYS) { const v = fd.get(k); if (typeof v === "string") next[k] = v; }
      return next;
    });
  }

  function update(key: string, patch: Partial<TierDraft>) {
    setTierRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  const err = (k: string) => state?.fieldErrors?.[k];
  /** Last submitted value wins, so a failed save doesn't wipe what was typed. */
  const v = (k: string, fallback: string | null | undefined) => state?.values?.[k] ?? fallback ?? "";
  const published = event?.status === "published";
  const slugPreview = (slug || title).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  const slugChanged = published && slug !== event?.slug;
  const busyUploading = uploads > 0;
  const trackUpload = (b: boolean) => setUploads((n) => Math.max(0, n + (b ? 1 : -1)));
  const host = appUrl.replace(/^https?:\/\//, "");

  // Mirrors publishChecklist() in lib/events.ts, read from the form instead of the database
  const starts = wallTime(snap.startsAt);
  const checks: PublishCheck[] = [
    { label: "At least one ticket tier", ok: tierRows.some((t) => Number(t.quantity) > 0), required: true },
    // Manila is UTC+8 with no DST; wallTime() is the wall clock as if it were UTC
    { label: "Starts in the future", ok: !!starts && starts.getTime() - 8 * 3600e3 > now, required: true },
    ...(anyPaid ? [{ label: "GCash details for paid tiers", ok: paymentOk, required: true }] : []),
    { label: "Poster image", ok: Boolean(snap.coverImageUrl), required: false },
    { label: "Description over 20 characters", ok: snap.descriptionMd.trim().length > 20, required: false },
  ];
  const blockers = checks.filter((c) => c.required && !c.ok).length;
  const [publishing, startPublish] = useTransition();

  const summaries: Record<SectionId, React.ReactNode> = {
    basics: [title || "Untitled", fmtWall(snap.startsAt), snap.venueName].filter(Boolean).join(" · "),
    tiers: tierRows.map((t) => `${t.name || "Unnamed"} ${Number(t.price) > 0 ? `₱${Number(t.price).toLocaleString("en-PH")}` : "free"} × ${t.quantity}`).join(" · "),
    payment: !anyPaid
      ? "All tiers are free, so no payment details are needed."
      : paymentOk
        ? <><Done>Complete</Done>{[snap.gcashName, snap.gcashNumber, snap.gcashQrUrl ? "QR uploaded" : null, `${snap.bookingHoldHours}-hour holds`].filter(Boolean).join(" · ")}</>
        : <span className="font-semibold text-destructive">Paid tiers need a GCash number or QR</span>,
    settings: <><span className="font-mono text-foreground">{host}/events/{slugPreview || "…"}</span> · Ticket style <span className="font-semibold text-foreground">{STYLE_LABELS[ticketStyle as keyof typeof STYLE_LABELS]}</span></>,
    poster: snap.coverImageUrl ? <Done>Uploaded</Done> : "No poster yet. The skyline shows until you add one.",
  };

  function section(id: SectionId, heading: React.ReactNode, body: React.ReactNode, extra?: React.ReactNode) {
    const o = isOpen(id);
    const label = SECTIONS.find((s) => s.id === id)?.label;
    return (
      <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-24 flex-col gap-3.5 rounded-[18px] border bg-card px-4 py-4 sm:px-5 sm:py-[18px]">
        <div className="flex items-center justify-between gap-2">
          <h2 id={`${id}-h`} className="font-display text-lg font-extrabold">{heading}</h2>
          <div className="flex items-center gap-1">
            {o && extra}
            <button type="button" aria-expanded={o} aria-controls={`${id}-body`} aria-label={`${o ? "Collapse" : "Expand"} ${label}`} onClick={() => toggle(id)} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <ChevronDown className={cn("size-5 transition-transform", o && "rotate-180")} aria-hidden />
            </button>
          </div>
        </div>
        {!o && <button type="button" onClick={() => toggle(id, true)} className="-mt-1.5 text-left text-[13px] leading-relaxed text-muted-foreground">{summaries[id]}</button>}
        <div id={`${id}-body`} hidden={!o} className="flex flex-col gap-3.5">{body}</div>
      </section>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      onInput={readForm}
      onChange={readForm}
      onSubmit={() => { submitting.current = true; }}
      className="flex flex-col"
      noValidate
    >
      {event && <input type="hidden" name="id" value={event.id} />}
      <input type="hidden" name="tiers" value={JSON.stringify(tierRows.map((t) => ({ ...t, key: undefined })))} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[150px_minmax(0,1fr)_300px]">
        <nav aria-label="Form sections" className="sticky top-24 hidden flex-col gap-0.5 xl:flex">
          <div className="bbc-eyebrow px-2.5 pb-2 text-muted-foreground">Sections</div>
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={() => toggle(s.id, true)}
              aria-current={current === s.id ? "true" : undefined}
              className={cn("flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] font-semibold", current === s.id ? "bg-card text-foreground shadow-[0_1px_2px_rgb(11_61_46/0.08)] dark:bg-surface-2" : "text-muted-foreground hover:text-foreground")}
            >
              {ticks[s.id] ? <CircleCheck className="size-4 shrink-0 text-success" aria-hidden /> : <span className="size-4 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/50" aria-hidden />}
              {s.label}
              <span className="sr-only">{ticks[s.id] ? ", complete" : ", incomplete"}</span>
              {!ticks[s.id] && s.id === "poster" && <span className="ml-auto text-[10px] font-bold text-warning-foreground">missing</span>}
              {!ticks[s.id] && s.id !== "poster" && <span className="ml-auto text-[10px] font-bold text-destructive">to do</span>}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          {section("basics", "Basics", (
            <>
              <Field id="title" label="Title" error={err("title")}>
                <Input id="title" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Base Camp Sessions Vol. 3" className={inputCls} {...invalid(err("title"), "title")} />
              </Field>
              <Field id="tagline" label="Tagline" hint="One line on cards and link previews.">
                <Input id="tagline" name="tagline" defaultValue={v("tagline", event?.tagline)} placeholder="Live sets, cold nights, warm people." className={inputCls} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="startsAt" label="Starts" note="Manila time" error={err("startsAt")}>
                  <Input id="startsAt" type="datetime-local" name="startsAt" required defaultValue={v("startsAt", toLocalInput(event?.startsAt))} className={inputCls} {...invalid(err("startsAt"), "startsAt")} />
                </Field>
                <Field id="endsAt" label="Ends" note="optional" hint="Used to decide when the event is over." error={err("endsAt")}>
                  <Input id="endsAt" type="datetime-local" name="endsAt" defaultValue={v("endsAt", toLocalInput(event?.endsAt))} className={inputCls} {...invalid(err("endsAt"), "endsAt")} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="venueName" label="Venue" error={err("venueName")}>
                  <Input id="venueName" name="venueName" required defaultValue={v("venueName", event?.venueName)} placeholder="Canto, Ketchup Food Community" className={inputCls} {...invalid(err("venueName"), "venueName")} />
                </Field>
                <Field id="venueAddress" label="Address">
                  <Input id="venueAddress" name="venueAddress" defaultValue={v("venueAddress", event?.venueAddress)} placeholder="Romulo Dr, Baguio City" className={inputCls} />
                </Field>
              </div>
              <Field id="mapUrl" label="Map link" hint="Google Maps share link">
                <Input id="mapUrl" name="mapUrl" type="url" defaultValue={v("mapUrl", event?.mapUrl)} placeholder="https://maps.app.goo.gl/…" className={inputCls} />
              </Field>
              <Field id="descriptionMd" label="Description" note="Markdown" hint="## headings, - lists, **bold**.">
                <Textarea id="descriptionMd" name="descriptionMd" rows={8} defaultValue={v("descriptionMd", event?.descriptionMd)} placeholder={"## Lineup\n- ...\n\n## House rules\n- ..."} className="rounded-xl" />
              </Field>
            </>
          ))}

          {section("tiers", "Ticket tiers", (
            <>
              {err("tiers") && <p role="alert" data-field-error className="rounded-lg bg-destructive-soft p-3 text-sm text-destructive" tabIndex={-1}>{err("tiers")}</p>}
              {tierRows.map((t, i) => {
                const e = (f: string) => err(`tiers.${i}.${f}`);
                const fid = (f: string) => `tier-${t.key}-${f}`;
                return (
                  // Stub notches punched at the perforation between the money row and the details
                  <div key={t.key} className="bbc-stub" style={{ "--stub-bg": "var(--card)", "--stub-notch": "50%" } as React.CSSProperties}>
                    <div className="flex flex-col gap-2.5 rounded-[14px] border bg-background px-4 py-3.5">
                      <div className="flex items-center justify-between">
                        <span className="bbc-eyebrow text-muted-foreground">Tier {i + 1}{t.id ? "" : " · new"}</span>
                        <Button type="button" size="icon-sm" variant="ghost" className="rounded-full text-muted-foreground" aria-label={`Remove tier ${t.name || i + 1}`} disabled={tierRows.length === 1} onClick={() => setTierRows((r) => r.filter((x) => x.key !== t.key))}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-[2fr_1fr_1fr_1fr]">
                        <Field id={fid("name")} label="Name" className="col-span-3 sm:col-span-1" error={e("name")}>
                          <Input id={fid("name")} value={t.name} onChange={(ev) => update(t.key, { name: ev.target.value })} placeholder="Early Bird" className={inputCls} {...invalid(e("name"), fid("name"))} />
                        </Field>
                        <Field id={fid("price")} label="Price ₱" hint="0 = free" error={e("price")}>
                          <Input id={fid("price")} type="number" inputMode="decimal" min={0} step="1" value={t.price} onChange={(ev) => update(t.key, { price: ev.target.value })} className={inputCls} {...invalid(e("price"), fid("price"))} />
                        </Field>
                        <Field id={fid("quantity")} label="Quantity" error={e("quantity")}>
                          <Input id={fid("quantity")} type="number" inputMode="numeric" min={1} value={t.quantity} onChange={(ev) => update(t.key, { quantity: ev.target.value })} className={inputCls} {...invalid(e("quantity"), fid("quantity"))} />
                        </Field>
                        <Field id={fid("perOrderLimit")} label="Per order" error={e("perOrderLimit")}>
                          <Input id={fid("perOrderLimit")} type="number" inputMode="numeric" min={1} max={20} value={t.perOrderLimit} onChange={(ev) => update(t.key, { perOrderLimit: ev.target.value })} className={inputCls} {...invalid(e("perOrderLimit"), fid("perOrderLimit"))} />
                        </Field>
                      </div>
                      <div className="bbc-perforation -mx-4 mt-1" aria-hidden />
                      <Field id={fid("description")} label="Description">
                        <Input id={fid("description")} value={t.description} onChange={(ev) => update(t.key, { description: ev.target.value })} placeholder="Includes one drink" className={inputCls} />
                      </Field>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <Field id={fid("salesStart")} label="Sales start" note="optional, Manila time" error={e("salesStart")}>
                          <Input id={fid("salesStart")} type="datetime-local" value={t.salesStart} onChange={(ev) => update(t.key, { salesStart: ev.target.value })} className={inputCls} {...invalid(e("salesStart"), fid("salesStart"))} />
                        </Field>
                        <Field id={fid("salesEnd")} label="Sales end" note="optional" error={e("salesEnd")}>
                          <Input id={fid("salesEnd")} type="datetime-local" value={t.salesEnd} onChange={(ev) => update(t.key, { salesEnd: ev.target.value })} className={inputCls} {...invalid(e("salesEnd"), fid("salesEnd"))} />
                        </Field>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          ), (
            <Button type="button" variant="outline" className="h-[34px] rounded-full px-3 text-[13px]" onClick={() => setTierRows((r) => [...r, newTier()])}>
              <Plus className="size-4" /> Add tier
            </Button>
          ))}

          {section("payment", <>Payment <span className="font-sans text-[13px] font-semibold text-muted-foreground">· GCash / Maya</span></>, (
            <>
              {!anyPaid && <p className="text-sm text-muted-foreground">All tiers are free, so no payment details are needed. Set a price on a tier to fill these in.</p>}
              {/* Kept in the DOM when hidden so saved values survive toggling prices */}
              <div className={cn("grid gap-3.5", !anyPaid && "hidden")}>
                <p className="text-sm text-muted-foreground">Shown to attendees right after they reserve paid tickets.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="gcashName" label="Account name"><Input id="gcashName" name="gcashName" defaultValue={v("gcashName", event?.gcashName)} placeholder="Juan D." className={inputCls} /></Field>
                  <Field id="gcashNumber" label="Number" error={err("gcashNumber")}>
                    <Input id="gcashNumber" name="gcashNumber" inputMode="tel" defaultValue={v("gcashNumber", event?.gcashNumber)} placeholder="09xx xxx xxxx" className={inputCls} {...invalid(err("gcashNumber"), "gcashNumber")} />
                  </Field>
                </div>
                <Field id="gcash-qr" label="Payment QR image" hint="Screenshot of your GCash or Maya QR. Members can save it and upload it in their app.">
                  <ImageUpload id="gcash-qr" name="gcashQrUrl" folder="gcash" defaultValue={event?.gcashQrUrl} label="Upload payment QR" aspect="aspect-square max-w-60" fit="contain" onBusyChange={trackUpload} onChange={(u) => setSnap((s) => ({ ...s, gcashQrUrl: u }))} />
                </Field>
                <Field id="paymentInstructions" label="Extra instructions" hint="Line breaks are kept.">
                  <Textarea id="paymentInstructions" name="paymentInstructions" rows={3} defaultValue={v("paymentInstructions", event?.paymentInstructions)} placeholder="Send the exact amount. The booking reference goes in the message." className="rounded-xl" />
                </Field>
                <Field id="bookingHoldHours" label="Hold time (hours)" hint="How long a reservation waits for payment before it's released." error={err("bookingHoldHours")}>
                  <Input id="bookingHoldHours" type="number" inputMode="numeric" name="bookingHoldHours" min={1} max={168} defaultValue={v("bookingHoldHours", String(event?.bookingHoldHours ?? 24))} className={cn(inputCls, "max-w-32")} {...invalid(err("bookingHoldHours"), "bookingHoldHours")} />
                </Field>
              </div>
            </>
          ))}

          {section("settings", "Settings", (
            <>
              <Field id="slug" label="Link" error={err("slug")}>
                <Input id="slug" name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="generated from the title" className={inputCls} {...invalid(err("slug"), "slug")} />
                <p className="mt-1.5 text-xs break-all text-muted-foreground">{host}/events/<span className="text-foreground">{slugPreview || "…"}</span></p>
                {slugChanged && <p className="mt-1 text-xs font-semibold text-warning-foreground">This event is live. Changing the link breaks links already shared.</p>}
              </Field>
              <Field id="ticketStyle" label="Ticket style">
                <Select name="ticketStyle" value={ticketStyle} onValueChange={setTicketStyle}>
                  <SelectTrigger id="ticketStyle" className="h-11 w-full rounded-xl md:h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_STYLES.map((s) => <SelectItem key={s} value={s}>{STYLE_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground"><Link href={`/admin/ticket-lab?style=${ticketStyle}`} target="_blank" className="text-accent-foreground underline">Compare styles in the ticket lab</Link></p>
              </Field>
              {!event && <p className="text-xs text-muted-foreground">New events are saved as drafts. You&apos;ll publish from the event page once the checklist is green.</p>}
            </>
          ))}

          {section("poster", "Poster", (
            <ImageUpload id="poster-upload" name="coverImageUrl" folder="posters" defaultValue={event?.coverImageUrl} label="Upload poster (16:9 or 4:5)" aspect="aspect-[4/5] max-w-80" onBusyChange={trackUpload} onChange={(u) => setSnap((s) => ({ ...s, coverImageUrl: u }))} />
          ))}
        </div>

        <aside className="flex flex-col gap-3.5 lg:sticky lg:top-24" aria-label="Preview">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <span className="bbc-eyebrow whitespace-nowrap text-muted-foreground">Live preview</span>
            <span className="truncate text-[11px] text-muted-foreground">public card, updates as you type</span>
          </div>
          <div className="px-2.5 sm:px-0">
            <EventPreview title={title} tagline={snap.tagline} startsAt={snap.startsAt} venue={snap.venueName} cover={snap.coverImageUrl} slug={slugPreview} tiers={tierRows} />
          </div>
          <ChecklistCard checks={checks}>
            {event?.status === "draft" ? (
              <>
                <Button
                  type="button"
                  className="mt-1.5 h-10 rounded-full"
                  disabled={dirty || blockers > 0 || publishing || pending}
                  onClick={() => startPublish(async () => {
                    const ok = await runAction(() => setEventStatus(event.id, "published"), { success: "Published. It's live on the events page." });
                    if (ok) router.push(`/admin/events/${event.id}`);
                  })}
                >
                  {publishing && <Loader2 className="animate-spin" />} Publish event
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  {dirty ? "Save your changes first, then publish." : blockers ? "Fix the red items to turn publishing on." : "Required items are green. The yellow ones just make it look better."}
                </p>
              </>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {!event ? "New events are saved as drafts. Publish once the required items are green." : published ? "It's live. Changes go out when you save." : "Publishing is handled from the event's Status card."}
              </p>
            )}
          </ChecklistCard>
        </aside>
      </div>

      {/* One save bar, always in reach, with the error summary next to the button */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:-mx-7 lg:px-7">
        {state?.error ? (
          <p role="alert" className="text-sm font-semibold text-destructive">{state.error}</p>
        ) : dirty ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-warning-foreground"><span className="size-[7px] rounded-full bg-warning" aria-hidden />Unsaved changes</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground"><Check className="size-4 text-success" aria-hidden />{event ? "All changes saved" : "New draft, not saved yet"}</span>
        )}
        {savedLabel && <span className="hidden text-xs text-muted-foreground sm:inline">{savedLabel}</span>}
        <div className="flex-1" />
        <Button asChild variant="ghost" className="hidden h-10 rounded-full px-4 text-muted-foreground sm:inline-flex"><Link href={event ? `/admin/events/${event.id}` : "/admin/events"}>Cancel</Link></Button>
        <Button type="submit" className="h-10 rounded-full px-5" disabled={pending || busyUploading}>
          {(pending || busyUploading) && <Loader2 className="size-4 animate-spin" />}
          {busyUploading ? "Waiting for upload…" : event ? "Save changes" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}

const inputCls = "rounded-xl md:h-10";

function Done({ children }: { children: React.ReactNode }) {
  return <span className="mr-2 inline-flex items-center gap-1.5 font-semibold text-success-foreground"><CircleCheck className="size-4" aria-hidden />{children}</span>;
}

function invalid(error: string | undefined, id: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${id}-msg` } : {};
}

function Field({ id, label, note, hint, error, className, children }: { id: string; label: string; note?: string; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold">{label}{note && <span className="font-medium text-muted-foreground"> · {note}</span>}</Label>
      {children}
      {error ? <p id={`${id}-msg`} className="mt-1 text-xs text-destructive">{error}</p> : hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
