"use client";
import { Loader2, Minus, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { peso } from "@/lib/format";
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

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <fieldset className="divide-y rounded-2xl border bg-card">
        <legend className="sr-only">Choose tickets</legend>
        {tiers.map((t) => {
          const max = Math.min(t.perOrderLimit, t.remaining);
          const v = qty[t.id] ?? 0;
          const disabled = !t.onSale || max === 0;
          return (
            <div key={t.id} className={`flex items-center justify-between gap-4 p-4 ${disabled ? "opacity-60" : ""}`}>
              <input type="hidden" name={`qty:${t.id}`} value={v} />
              <div className="min-w-0">
                <div className="font-medium">{t.name} <span className="ml-1 text-muted-foreground">{peso(t.priceCents)}</span></div>
                {t.description && <div className="text-sm text-muted-foreground">{t.description}</div>}
                <div className="text-xs text-muted-foreground">
                  {!t.onSale ? "Not on sale right now" : t.remaining === 0 ? "Sold out" : t.remaining <= 10 ? `Only ${t.remaining} left · max ${max} per order` : `Max ${t.perOrderLimit} per order`}
                </div>
              </div>
              <div className="flex items-center gap-2" role="group" aria-label={`${t.name} quantity`}>
                <Button type="button" size="icon" variant="outline" aria-label={`Fewer ${t.name}`} disabled={disabled || v === 0} onClick={() => setQty({ ...qty, [t.id]: v - 1 })}><Minus className="size-4" /></Button>
                <span className="w-6 text-center tabular-nums" aria-live="polite" aria-label={`${v} ${t.name}`}>{v}</span>
                <Button type="button" size="icon" variant="outline" aria-label={`More ${t.name}`} disabled={disabled || v >= max} onClick={() => setQty({ ...qty, [t.id]: v + 1 })}><Plus className="size-4" /></Button>
              </div>
            </div>
          );
        })}
      </fieldset>

      {/* Sticky on phones so the total and the button stay in reach while picking */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-card sm:p-4">
        {lines.length > 0 && (
          <ul className="mb-2 space-y-1 text-sm text-muted-foreground">
            {lines.map((t) => (
              <li key={t.id} className="flex justify-between"><span>{qty[t.id]} × {t.name}</span><span>{peso(t.priceCents * (qty[t.id] ?? 0))}</span></li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Total</span>
          <span aria-live="polite">{count === 0 ? "—" : peso(total)}</span>
        </div>
        {paidSelected ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {hasPayment
              ? `Next you'll see GCash/Maya details. We hold these tickets for ${holdHours} hours while you pay and upload the receipt.`
              : "The organiser hasn't added payment details yet. You can reserve now and pay once they do."}
          </p>
        ) : count > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Free tickets are confirmed instantly and emailed to you.</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Pick at least one ticket to continue.</p>
        )}
        {state?.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}
        <Button type="submit" size="lg" className="mt-4 w-full" disabled={pending || count === 0}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {paidSelected ? `Reserve ${count} and continue to payment` : count > 0 ? `Get ${count} ticket${count === 1 ? "" : "s"}` : "Get tickets"}
        </Button>
      </div>
    </form>
  );
}
