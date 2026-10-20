"use client";
import { Loader2, Minus, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { peso } from "@/lib/format";
import { type ActionState, bookAction } from "@/app/bookings-actions";

type Tier = { id: string; name: string; description: string | null; priceCents: number; perOrderLimit: number; remaining: number; onSale: boolean };

export function BookForm({ eventId, slug, tiers, holdHours, hasPayment }: { eventId: string; slug: string; tiers: Tier[]; holdHours: number; hasPayment: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(bookAction, null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const total = tiers.reduce((n, t) => n + (qty[t.id] ?? 0) * t.priceCents, 0);
  const count = Object.values(qty).reduce((a, b) => a + b, 0);
  const paidSelected = tiers.some((t) => (qty[t.id] ?? 0) > 0 && t.priceCents > 0);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <div className="divide-y rounded-2xl border bg-card">
        {tiers.map((t) => {
          const max = Math.min(t.perOrderLimit, t.remaining);
          const v = qty[t.id] ?? 0;
          const disabled = !t.onSale || max === 0;
          return (
            <div key={t.id} className="flex items-center justify-between gap-4 p-4">
              <input type="hidden" name={`qty:${t.id}`} value={v} />
              <div className="min-w-0">
                <div className="font-medium">{t.name} <span className="ml-1 text-muted-foreground">{peso(t.priceCents)}</span></div>
                {t.description && <div className="text-sm text-muted-foreground">{t.description}</div>}
                <div className="text-xs text-muted-foreground">
                  {!t.onSale ? "Not on sale" : t.remaining === 0 ? "Sold out" : t.remaining <= 10 ? `${t.remaining} left` : `Max ${t.perOrderLimit} per order`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="icon" variant="outline" aria-label={`Fewer ${t.name}`} disabled={disabled || v === 0} onClick={() => setQty({ ...qty, [t.id]: v - 1 })}><Minus className="size-4" /></Button>
                <span className="w-6 text-center tabular-nums">{v}</span>
                <Button type="button" size="icon" variant="outline" aria-label={`More ${t.name}`} disabled={disabled || v >= max} onClick={() => setQty({ ...qty, [t.id]: v + 1 })}><Plus className="size-4" /></Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{count === 0 ? "—" : peso(total)}</span>
        </div>
        {paidSelected ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {hasPayment
              ? `We'll hold your tickets for ${holdHours} hours while you pay via GCash or Maya and upload the receipt.`
              : "The organiser has not added payment details yet. You can reserve now and pay once they do."}
          </p>
        ) : count > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Free tickets are confirmed instantly.</p>
        ) : null}
        {state?.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
        <Button type="submit" size="lg" className="mt-4 w-full" disabled={pending || count === 0}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {paidSelected ? "Reserve and continue to payment" : "Get tickets"}
        </Button>
      </div>
    </form>
  );
}
