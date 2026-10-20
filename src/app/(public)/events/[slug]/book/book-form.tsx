"use client";
import { Info, Loader2, Minus, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type ActionState, bookAction } from "@/app/bookings-actions";

type Tier = { id: string; name: string; description: string | null; priceCents: number; perOrderLimit: number; remaining: number; onSale: boolean };

export function BookForm({
  eventId,
  slug,
  tiers,
  holdHours,
  hasPayment,
  initial = {},
}: {
  eventId: string;
  slug: string;
  tiers: Tier[];
  holdHours: number;
  hasPayment: boolean;
  initial?: Record<string, number>;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(bookAction, null);
  const [qty, setQty] = useState<Record<string, number>>(() => {
    // "Book again" prefills the previous order, clamped to what's still available
    const q: Record<string, number> = {};
    for (const t of tiers) {
      const want = initial[t.id] ?? 0;
      const max = t.onSale ? Math.min(t.perOrderLimit, t.remaining) : 0;
      if (want > 0 && max > 0) q[t.id] = Math.min(want, max);
    }
    return q;
  });
  const total = tiers.reduce((n, t) => n + (qty[t.id] ?? 0) * t.priceCents, 0);
  const count = Object.values(qty).reduce((a, b) => a + b, 0);
  const paidSelected = tiers.some((t) => (qty[t.id] ?? 0) > 0 && t.priceCents > 0);
  const lines = tiers.filter((t) => (qty[t.id] ?? 0) > 0);
  const anyPaid = tiers.some((t) => t.priceCents > 0);
  const anyFree = tiers.some((t) => t.priceCents === 0);

  return (
    <form action={action} className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <div className="space-y-4">
        <fieldset className="overflow-hidden rounded-[22px] border bg-card">
          <legend className="sr-only">Choose tickets</legend>
          <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
            <h2 className="text-lg font-extrabold">Tickets</h2>
            <span className="text-xs text-muted-foreground">per person, scanned once</span>
          </div>
          {tiers.map((t) => {
            const max = Math.min(t.perOrderLimit, t.remaining);
            const v = qty[t.id] ?? 0;
            const soldOut = t.onSale && t.remaining === 0;
            const disabled = !t.onSale || max === 0;
            const few = t.onSale && t.remaining > 0 && t.remaining <= 10;
            return (
              <div key={t.id} className={cn("flex items-center justify-between gap-3 border-t px-4 py-3.5", disabled && "opacity-55")}>
                <input type="hidden" name={`qty:${t.id}`} value={v} />
                <div className="min-w-0 flex-1">
                  <div className={cn("font-semibold", soldOut && "line-through")}>
                    {t.name}{" "}
                    <span className={t.priceCents === 0 ? "font-bold text-primary" : "font-medium text-muted-foreground"}>{peso(t.priceCents)}</span>
                  </div>
                  {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  <div className={cn("text-xs", few ? "mt-0.5 font-semibold text-warning-foreground" : "text-muted-foreground")}>
                    {!t.onSale ? "Not on sale right now" : soldOut ? "Sold out" : few ? `Only ${t.remaining} left · max ${max} per order` : `Max ${t.perOrderLimit} per order`}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5" role="group" aria-label={`${t.name} quantity`}>
                  <Button type="button" variant="outline" className="size-11 rounded-full p-0" aria-label={`Fewer ${t.name}`} disabled={disabled || v === 0} onClick={() => setQty({ ...qty, [t.id]: v - 1 })}>
                    <Minus className="size-[18px]" />
                  </Button>
                  <span className="w-6 text-center font-display text-[22px] font-extrabold tabular-nums" aria-live="polite" aria-label={`${v} ${t.name}`}>{v}</span>
                  <Button type="button" className="size-11 rounded-full p-0" aria-label={`More ${t.name}`} disabled={disabled || v >= max} onClick={() => setQty({ ...qty, [t.id]: v + 1 })}>
                    <Plus className="size-[18px]" />
                  </Button>
                </div>
              </div>
            );
          })}
        </fieldset>

        <p className="flex items-start gap-2.5 px-1 text-[13px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {anyPaid ? (
              <>
                Paid tickets are held for <span className="font-semibold text-foreground">{holdHours} hours</span> while you pay via GCash or Maya and upload the receipt.{anyFree && " Free tickets are confirmed the moment you tap."}
              </>
            ) : (
              "Free tickets are confirmed the moment you tap, and emailed to you."
            )}
          </span>
        </p>
      </div>

      {/* Sticky on phones so the total and the button stay in reach while picking */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-col gap-2.5 border-t bg-card/95 px-4 pt-3.5 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:top-24 lg:mx-0 lg:mt-0 lg:rounded-[22px] lg:border lg:p-5">
        {lines.length > 0 && (
          <ul className="space-y-1.5 text-[13px] text-muted-foreground">
            {lines.map((t) => (
              <li key={t.id} className="flex justify-between gap-3"><span>{qty[t.id]} × {t.name}</span><span>{peso(t.priceCents * (qty[t.id] ?? 0))}</span></li>
            ))}
          </ul>
        )}
        <div className="flex items-baseline justify-between">
          <span className="font-display text-lg font-bold">Total</span>
          <span className="font-display text-[26px] font-extrabold tabular-nums" aria-live="polite">{count === 0 ? "—" : peso(total)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {paidSelected
            ? hasPayment
              ? `Next: GCash or Maya details. Your hold runs ${holdHours} hours from now.`
              : "The organiser hasn't added payment details yet. You can reserve now and pay once they do."
            : count > 0
              ? "Free tickets are confirmed instantly and emailed to you."
              : "Pick at least one ticket to continue."}
        </p>
        {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" size="lg" className="h-[50px] w-full text-[15px] md:h-[50px]" disabled={pending || count === 0}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {paidSelected ? `Reserve ${count} and continue to payment` : count > 0 ? `Get ${count} ticket${count === 1 ? "" : "s"}` : "Get tickets"}
        </Button>
      </div>
    </form>
  );
}
