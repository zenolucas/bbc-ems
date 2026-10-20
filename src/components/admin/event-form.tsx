"use client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Event, TicketTier } from "@/db/schema";
import { TICKET_STYLES } from "@/db/schema";
import { toLocalInput } from "@/lib/format";
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

export function EventForm({ event, tiers }: { event?: Event; tiers?: TicketTier[] }) {
  const [state, action, pending] = useActionState<EventFormState, FormData>(saveEvent, null);
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

  function update(key: string, patch: Partial<TierDraft>) {
    setTierRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  const err = (k: string) => state?.fieldErrors?.[k];

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {event && <input type="hidden" name="id" value={event.id} />}
      <input type="hidden" name="tiers" value={JSON.stringify(tierRows.map((t) => ({ ...t, key: undefined })))} />

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Title" error={err("title")}>
              <Input name="title" required defaultValue={event?.title} placeholder="Base Camp Sessions Vol. 3" />
            </Field>
            <Field label="Tagline" hint="One line shown on cards and link previews.">
              <Input name="tagline" defaultValue={event?.tagline ?? ""} placeholder="Live sets, cold nights, warm people." />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts" error={err("startsAt")}>
                <Input type="datetime-local" name="startsAt" required defaultValue={toLocalInput(event?.startsAt)} />
              </Field>
              <Field label="Ends" hint="Optional">
                <Input type="datetime-local" name="endsAt" defaultValue={toLocalInput(event?.endsAt)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Venue" error={err("venueName")}>
                <Input name="venueName" required defaultValue={event?.venueName} placeholder="Canto, Ketchup Food Community" />
              </Field>
              <Field label="Address">
                <Input name="venueAddress" defaultValue={event?.venueAddress ?? ""} placeholder="Romulo Dr, Baguio City" />
              </Field>
            </div>
            <Field label="Map link" hint="Google Maps share link">
              <Input name="mapUrl" type="url" defaultValue={event?.mapUrl ?? ""} placeholder="https://maps.app.goo.gl/…" />
            </Field>
            <Field label="Description" hint="Markdown supported.">
              <Textarea name="descriptionMd" rows={10} defaultValue={event?.descriptionMd} placeholder={"## Lineup\n- ...\n\n## House rules\n- ..."} />
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
            {err("tiers") && <p className="text-sm text-destructive">{err("tiers")}</p>}
            {tierRows.map((t, i) => (
              <div key={t.key} className="rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Tier {i + 1}</span>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove tier" disabled={tierRows.length === 1} onClick={() => setTierRows((r) => r.filter((x) => x.key !== t.key))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-6">
                  <Field label="Name" className="sm:col-span-3" error={err(`tiers.${i}.name`)}>
                    <Input value={t.name} onChange={(e) => update(t.key, { name: e.target.value })} placeholder="Early Bird" />
                  </Field>
                  <Field label="Price (₱)" className="sm:col-span-1">
                    <Input type="number" min={0} step="1" value={t.price} onChange={(e) => update(t.key, { price: e.target.value })} />
                  </Field>
                  <Field label="Quantity" className="sm:col-span-1">
                    <Input type="number" min={1} value={t.quantity} onChange={(e) => update(t.key, { quantity: e.target.value })} />
                  </Field>
                  <Field label="Per order" className="sm:col-span-1">
                    <Input type="number" min={1} max={20} value={t.perOrderLimit} onChange={(e) => update(t.key, { perOrderLimit: e.target.value })} />
                  </Field>
                  <Field label="Description" className="sm:col-span-6">
                    <Input value={t.description} onChange={(e) => update(t.key, { description: e.target.value })} placeholder="Includes one drink" />
                  </Field>
                  <Field label="Sales start" className="sm:col-span-3" hint="Optional">
                    <Input type="datetime-local" value={t.salesStart} onChange={(e) => update(t.key, { salesStart: e.target.value })} />
                  </Field>
                  <Field label="Sales end" className="sm:col-span-3" hint="Optional">
                    <Input type="datetime-local" value={t.salesEnd} onChange={(e) => update(t.key, { salesEnd: e.target.value })} />
                  </Field>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment (GCash / Maya)</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">Shown to attendees after they reserve paid tickets. Leave blank for free events.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Account name"><Input name="gcashName" defaultValue={event?.gcashName ?? ""} placeholder="Juan D." /></Field>
              <Field label="Number"><Input name="gcashNumber" defaultValue={event?.gcashNumber ?? ""} placeholder="09xx xxx xxxx" /></Field>
            </div>
            <Field label="Payment QR image" hint="Screenshot of your GCash or Maya QR">
              <ImageUpload name="gcashQrUrl" folder="gcash" defaultValue={event?.gcashQrUrl} label="Upload payment QR" aspect="aspect-square max-w-60" />
            </Field>
            <Field label="Extra instructions">
              <Textarea name="paymentInstructions" rows={3} defaultValue={event?.paymentInstructions ?? ""} placeholder="Put your name in the GCash note. Send the exact amount." />
            </Field>
            <Field label="Hold time (hours)" hint="How long a reservation waits for payment before expiring.">
              <Input type="number" name="bookingHoldHours" min={1} max={168} defaultValue={event?.bookingHoldHours ?? 24} className="max-w-32" />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Publish</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Status">
              <Select name="status" defaultValue={event?.status ?? "draft"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft (hidden)</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="URL slug" hint="Leave blank to generate from the title.">
              <Input name="slug" defaultValue={event?.slug ?? ""} placeholder="base-camp-sessions-3" />
            </Field>
            <Field label="Ticket style">
              <Select name="ticketStyle" defaultValue={event?.ticketStyle ?? "summit"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TICKET_STYLES.map((s) => <SelectItem key={s} value={s}>{STYLE_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {event ? "Save changes" : "Create event"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Poster</CardTitle></CardHeader>
          <CardContent>
            <ImageUpload name="coverImageUrl" folder="posters" defaultValue={event?.coverImageUrl} label="Upload poster (16:9 or 4:5)" aspect="aspect-[4/5]" />
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Field({ label, hint, error, className, children }: { label: string; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
