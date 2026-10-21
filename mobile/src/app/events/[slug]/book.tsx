import { fmtDate, fmtTime, peso } from "@bbc/shared/format";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Minus, Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, ErrorView, Loading, Notice, Row, SignInPrompt, Text } from "@/components/ui";
import { useCreateBooking, useEvent } from "@/lib/attendee";
import { useSession } from "@/lib/session";
import { fonts, radius, space, useTheme } from "@/theme";

function Stepper({ value, max, disabled, name, onChange }: { value: number; max: number; disabled: boolean; name: string; onChange: (v: number) => void }) {
  const { c } = useTheme();
  const btn = (enabled: boolean, filled: boolean) => [
    styles.step,
    filled ? { backgroundColor: c.primary } : { borderWidth: 1, borderColor: c.border, backgroundColor: c.surface1 },
    !enabled && { opacity: 0.4 },
  ];
  const canDown = !disabled && value > 0;
  const canUp = !disabled && value < max;
  return (
    <Row gap={space.md}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Fewer ${name}`} disabled={!canDown} onPress={() => onChange(value - 1)} style={btn(canDown, false)} hitSlop={4}>
        <Minus size={18} color={c.foreground} />
      </Pressable>
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: 18, minWidth: 22, textAlign: "center" }} accessibilityLiveRegion="polite">{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`More ${name}`} disabled={!canUp} onPress={() => onChange(value + 1)} style={btn(canUp, true)} hitSlop={4}>
        <Plus size={18} color={c.primaryForeground} />
      </Pressable>
    </Row>
  );
}

export default function BookScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { status } = useSession();
  const q = useEvent(slug);
  const book = useCreateBooking();
  const [qty, setQty] = useState<Record<string, number>>({});
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  if (status !== "signedIn") return <><Stack.Screen options={{ title: "Book tickets" }} /><SignInPrompt title="Sign in to book">We&apos;ll email you a code. Your tickets are saved to this phone after that.</SignInPrompt></>;
  if (q.isPending) return <><Stack.Screen options={{ title: "Book tickets" }} /><Loading /></>;
  if (q.isError) return <><Stack.Screen options={{ title: "Book tickets" }} /><ErrorView error={q.error} onRetry={() => q.refetch()} /></>;

  const e = q.data;
  const lines = e.tiers.map((t) => ({ t, v: qty[t.id] ?? 0 }));
  const count = lines.reduce((n, l) => n + l.v, 0);
  const total = lines.reduce((n, l) => n + l.v * l.t.priceCents, 0);
  const paidSelected = lines.some((l) => l.v > 0 && l.t.priceCents > 0);
  const anyFree = e.tiers.some((t) => t.priceCents === 0);
  const anyPaid = e.tiers.some((t) => t.priceCents > 0);

  async function submit() {
    try {
      const r = await book.mutateAsync({ eventId: e.id, items: lines.filter((l) => l.v > 0).map((l) => ({ tierId: l.t.id, quantity: l.v })) });
      router.replace(`/bookings/${r.id}${r.free ? "?confirmed=1" : "?reserved=1"}`);
    } catch {
      // Shown below from book.error
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: "Book tickets" }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 160 + insets.bottom }}>
        <View style={{ gap: 4 }}>
          <Text variant="title">{e.title}</Text>
          <Text variant="caption" muted>{fmtDate(e.startsAt, "EEE, MMM d")} · {fmtTime(e.startsAt)} · {e.venueName}</Text>
        </View>

        {e.myBooking && (
          <Notice tone="info" title="You already have a booking for this event">
            Booking again makes a separate order with its own payment.
          </Notice>
        )}

        <Card padded={false}>
          <View style={{ padding: space.lg, paddingBottom: space.sm }}>
            <Text variant="heading">Choose tickets</Text>
            <Text variant="caption" muted>per person, scanned once</Text>
          </View>
          {lines.map(({ t, v }) => {
            const max = Math.min(t.perOrderLimit, t.remaining);
            const disabled = !t.onSale || max === 0;
            return (
              <View key={t.id} style={[styles.tier, { borderColor: c.border }, disabled && { opacity: 0.55 }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label" style={{ fontSize: 15 }}>{t.name}</Text>
                  <Text variant="heading">{peso(t.priceCents)}</Text>
                  <Text variant="caption" muted>
                    {!t.onSale ? "Not on sale right now" : max === 0 ? "Sold out" : t.remaining <= 10 ? `Only ${t.remaining} left · max ${max} per order` : `Max ${t.perOrderLimit} per order`}
                  </Text>
                </View>
                <Stepper value={v} max={max} disabled={disabled} name={t.name} onChange={(n) => setQty({ ...qty, [t.id]: n })} />
              </View>
            );
          })}
        </Card>

        <Text variant="caption" muted>
          {anyPaid
            ? `Paid tickets are held for ${e.holdHours} hours while you pay via GCash or Maya and upload the receipt.${anyFree ? " Free tickets are confirmed the moment you tap." : ""}`
            : "Free tickets are confirmed the moment you tap, and emailed to you."}
        </Text>
      </ScrollView>

      {/* Sticky so the total and the button stay in reach while picking */}
      <View style={[styles.footer, { backgroundColor: c.background, borderColor: c.border, paddingBottom: Math.max(insets.bottom, space.md) }]}>
        {book.error && <Text variant="caption" color={c.destructive} accessibilityLiveRegion="assertive">{book.error.message}</Text>}
        <Row style={{ justifyContent: "space-between" }}>
          <Text variant="heading">Total</Text>
          <Text variant="title">{count === 0 ? "—" : peso(total)}</Text>
        </Row>
        <Text variant="caption" muted>
          {count === 0
            ? "Pick at least one ticket to continue."
            : paidSelected
              ? e.hasPaymentDetails
                ? `Next: GCash or Maya details. Your hold runs ${e.holdHours} hours from now.`
                : "The organiser hasn't added payment details yet. You can reserve now and pay once they do."
              : "Free tickets are confirmed instantly and emailed to you."}
        </Text>
        <Button
          size="lg"
          title={paidSelected ? `Reserve ${count} and continue to payment` : count > 0 ? `Get ${count} ticket${count === 1 ? "" : "s"}` : "Get tickets"}
          loading={book.isPending}
          disabled={count === 0}
          onPress={submit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  tier: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14, borderTopWidth: 1 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, gap: 6, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
