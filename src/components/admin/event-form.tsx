"use client";
import Link from "next/link";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Event, TicketTier } from "@/db/schema";
import { TICKET_STYLES } from "@/db/schema";
import { toLocalInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type EventFormState, saveEvent } from "@/app/admin/actions";
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

function newTier(): TierDraft {
  return { key: crypto.randomUUID(), name: "", description: "", price: "0", quantity: "50", perOrderLimit: "4", salesStart: "", salesEnd: "" };
}

export function EventForm({ event, tiers, appUrl }: { event?: Event; tiers?: TicketTier[]; appUrl: string }) {
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
      : [{ ...newTier(), name: "General Admission" }],
  );
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [title, setTitle] = useState(event?.title ?? "");

  // After a failed save, jump to the first problem
  useEffect(() => {
    if (!state?.fieldErrors) return;
    const el = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true'], [data-field-error]");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  }, [state]);

  function update(key: string, patch: Partial<TierDraft>) {
    setTierRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  const err = (k: string) => state?.fieldErrors?.[k];
  /** Last submitted value wins, so a failed save doesn't wipe what was typed. */
  const v = (k: string, fallback: string | null | undefined) => state?.values?.[k] ?? fallback ?? "";
  const anyPaid = tierRows.some((t) => Number(t.price) > 0);
  const published = event?.status === "published";
  const slugPreview = (slug || title).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  const slugChanged = published && slug !== event?.slug;
  const busyUploading = uploads > 0;
  const trackUpload = (b: boolean) => setUploads((n) => Math.max(0, n + (b ? 1 : -1)));

  return (
    <form ref={formRef} action={action} className="grid gap-6 lg:grid-cols-[1fr_340px]" noValidate>
      {event && <input type="hidden" name="id" value={event.id} />}
      <input type="hidden" name="tiers" value={JSON.stringify(tierRows.map((t) => ({ ...t, key: undefined })))} />

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Field id="title" label="Title" error={err("title")}>
              <Input id="title" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Base Camp Sessions Vol. 3" {...invalid(err("title"), "title")} />
            </Field>
            <Field id="tagline" label="Tagline" hint="One line shown on cards and link previews.">
              <Input id="tagline" name="tagline" defaultValue={v("tagline", event?.tagline)} placeholder="Live sets, cold nights, warm people." />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="startsAt" label="Starts (Manila time)" error={err("startsAt")}>
                <Input id="startsAt" type="datetime-local" name="startsAt" required defaultValue={v("startsAt", toLocalInput(event?.startsAt))} {...invalid(err("startsAt"), "startsAt")} />
              </Field>
              <Field id="endsAt" label="Ends (Manila time)" hint="Optional. Used to decide when the event is over." error={err("endsAt")}>
                <Input id="endsAt" type="datetime-local" name="endsAt" defaultValue={v("endsAt", toLocalInput(event?.endsAt))} {...invalid(err("endsAt"), "endsAt")} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="venueName" label="Venue" error={err("venueName")}>
                <Input id="venueName" name="venueName" required defaultValue={v("venueName", event?.venueName)} placeholder="Canto, Ketchup Food Community" {...invalid(err("venueName"), "venueName")} />
              </Field>
              <Field id="venueAddress" label="Address">
                <Input id="venueAddress" name="venueAddress" defaultValue={v("venueAddress", event?.venueAddress)} placeholder="Romulo Dr, Baguio City" />
              </Field>
            </div>
            <Field id="mapUrl" label="Map link" hint="Google Maps share link">
              <Input id="mapUrl" name="mapUrl" type="url" defaultValue={v("mapUrl", event?.mapUrl)} placeholder="https://maps.app.goo.gl/…" />
            </Field>
            <Field id="descriptionMd" label="Description" hint="Markdown supported: ## headings, - lists, **bold**.">
              <Textarea id="descriptionMd" name="descriptionMd" rows={10} defaultValue={v("descriptionMd", event?.descriptionMd)} placeholder={"## Lineup\n- ...\n\n## House rules\n- ..."} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Ticket tiers</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={() => setTierRows((r) => [...r, newTier()])}>
              <Plus className="size-4" /> Add tier
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {err("tiers") && <p role="alert" data-field-error className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" tabIndex={-1}>{err("tiers")}</p>}
            {tierRows.map((t, i) => {
              const e = (f: string) => err(`tiers.${i}.${f}`);
              const fid = (f: string) => `tier-${t.key}-${f}`;
              return (
                <div key={t.key} className="rounded-xl border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Tier {i + 1}{t.id ? "" : " · new"}</span>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove tier ${t.name || i + 1}`} disabled={tierRows.length === 1} onClick={() => setTierRows((r) => r.filter((x) => x.key !== t.key))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                    <Field id={fid("name")} label="Name" className="col-span-3" error={e("name")}>
                      <Input id={fid("name")} value={t.name} onChange={(ev) => update(t.key, { name: ev.target.value })} placeholder="Early Bird" {...invalid(e("name"), fid("name"))} />
                    </Field>
                    <Field id={fid("price")} label="Price (₱)" hint="0 = free" error={e("price")}>
                      <Input id={fid("price")} type="number" inputMode="decimal" min={0} step="1" value={t.price} onChange={(ev) => update(t.key, { price: ev.target.value })} {...invalid(e("price"), fid("price"))} />
                    </Field>
                    <Field id={fid("quantity")} label="Quantity" error={e("quantity")}>
                      <Input id={fid("quantity")} type="number" inputMode="numeric" min={1} value={t.quantity} onChange={(ev) => update(t.key, { quantity: ev.target.value })} {...invalid(e("quantity"), fid("quantity"))} />
                    </Field>
                    <Field id={fid("perOrderLimit")} label="Per order" error={e("perOrderLimit")}>
                      <Input id={fid("perOrderLimit")} type="number" inputMode="numeric" min={1} max={20} value={t.perOrderLimit} onChange={(ev) => update(t.key, { perOrderLimit: ev.target.value })} {...invalid(e("perOrderLimit"), fid("perOrderLimit"))} />
                    </Field>
                    <Field id={fid("description")} label="Description" className="col-span-3 sm:col-span-6">
                      <Input id={fid("description")} value={t.description} onChange={(ev) => update(t.key, { description: ev.target.value })} placeholder="Includes one drink" />
                    </Field>
                    <Field id={fid("salesStart")} label="Sales start" className="col-span-3" hint="Optional, Manila time" error={e("salesStart")}>
                      <Input id={fid("salesStart")} type="datetime-local" value={t.salesStart} onChange={(ev) => update(t.key, { salesStart: ev.target.value })} {...invalid(e("salesStart"), fid("salesStart"))} />
                    </Field>
                    <Field id={fid("salesEnd")} label="Sales end" className="col-span-3" hint="Optional, Manila time" error={e("salesEnd")}>
                      <Input id={fid("salesEnd")} type="datetime-local" value={t.salesEnd} onChange={(ev) => update(t.key, { salesEnd: ev.target.value })} {...invalid(e("salesEnd"), fid("salesEnd"))} />
                    </Field>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card id="payment" className="scroll-mt-24">
          <CardHeader><CardTitle>Payment (GCash / Maya)</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            {!anyPaid && <p className="text-sm text-muted-foreground">All tiers are free, so no payment details are needed. Set a price on a tier to fill these in.</p>}
            {/* Kept in the DOM when hidden so saved values survive toggling prices */}
            <div className={cn("grid gap-4", !anyPaid && "hidden")}>
              <p className="text-sm text-muted-foreground">Shown to attendees right after they reserve paid tickets.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="gcashName" label="Account name"><Input id="gcashName" name="gcashName" defaultValue={v("gcashName", event?.gcashName)} placeholder="Juan D." /></Field>
                <Field id="gcashNumber" label="Number" error={err("gcashNumber")}>
                  <Input id="gcashNumber" name="gcashNumber" inputMode="tel" defaultValue={v("gcashNumber", event?.gcashNumber)} placeholder="09xx xxx xxxx" {...invalid(err("gcashNumber"), "gcashNumber")} />
                </Field>
              </div>
              <Field id="gcash-qr" label="Payment QR image" hint="Screenshot of your GCash or Maya QR. Members can save it and upload it in their app.">
                <ImageUpload id="gcash-qr" name="gcashQrUrl" folder="gcash" defaultValue={event?.gcashQrUrl} label="Upload payment QR" aspect="aspect-square max-w-60" fit="contain" onBusyChange={trackUpload} />
              </Field>
              <Field id="paymentInstructions" label="Extra instructions" hint="Line breaks are kept.">
                <Textarea id="paymentInstructions" name="paymentInstructions" rows={3} defaultValue={v("paymentInstructions", event?.paymentInstructions)} placeholder="Send the exact amount. The booking reference goes in the message." />
              </Field>
              <Field id="bookingHoldHours" label="Hold time (hours)" hint="How long a reservation waits for payment before it's released." error={err("bookingHoldHours")}>
                <Input id="bookingHoldHours" type="number" inputMode="numeric" name="bookingHoldHours" min={1} max={168} defaultValue={v("bookingHoldHours", String(event?.bookingHoldHours ?? 24))} className="max-w-32" {...invalid(err("bookingHoldHours"), "bookingHoldHours")} />
              </Field>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Field id="slug" label="Link" error={err("slug")}>
              <Input id="slug" name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="generated from the title" {...invalid(err("slug"), "slug")} />
              <p className="mt-1 break-all text-xs text-muted-foreground">{appUrl.replace(/^https?:\/\//, "")}/events/<span className="text-foreground">{slugPreview || "…"}</span></p>
              {slugChanged && <p className="mt-1 text-xs text-yellow-800 dark:text-star">This event is live. Changing the link breaks links already shared.</p>}
            </Field>
            <Field id="ticketStyle" label="Ticket style">
              <Select name="ticketStyle" defaultValue={v("ticketStyle", event?.ticketStyle ?? "summit")}>
                <SelectTrigger id="ticketStyle"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TICKET_STYLES.map((s) => <SelectItem key={s} value={s}>{STYLE_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground"><Link href="/admin/ticket-lab" target="_blank" className="underline">Compare styles in the ticket lab</Link></p>
            </Field>
            {!event && <p className="text-xs text-muted-foreground">New events are saved as drafts. You&apos;ll publish from the event page once the checklist is green.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Poster</CardTitle></CardHeader>
          <CardContent>
            <ImageUpload id="poster" name="coverImageUrl" folder="posters" defaultValue={event?.coverImageUrl} label="Upload poster (16:9 or 4:5)" aspect="aspect-[4/5]" onBusyChange={trackUpload} />
          </CardContent>
        </Card>
      </div>

      {/* One save bar, always in reach, with the error summary next to the button */}
      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:col-span-2">
        {state?.error && <p role="alert" className="mr-auto text-sm text-destructive">{state.error}</p>}
        <Button asChild variant="ghost"><Link href={event ? `/admin/events/${event.id}` : "/admin/events"}>Cancel</Link></Button>
        <Button type="submit" disabled={pending || busyUploading}>
          {(pending || busyUploading) && <Loader2 className="size-4 animate-spin" />}
          {busyUploading ? "Waiting for upload…" : event ? "Save changes" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}

function invalid(error: string | undefined, id: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${id}-msg` } : {};
}

function Field({ id, label, hint, error, className, children }: { id: string; label: string; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 block">{label}</Label>
      {children}
      {error ? <p id={`${id}-msg`} className="mt-1 text-xs text-destructive">{error}</p> : hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
