import { REJECT_REASONS, type ReviewItemDTO } from "@bbc/shared/admin-types";
import { fmtDateTime, fmtRange, peso, relative } from "@bbc/shared/format";
// Href casts: the generated route types only learn about /review on the next `expo start`
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReviewHints } from "@/components/review/hints";
import { ReceiptViewer } from "@/components/review/receipt-viewer";
import { CopyRow } from "@/components/ticket/copy-row";
import { Button, Card, Divider, EmptyState, Field, Loading, Row, Text } from "@/components/ui";
import { assetUrl } from "@/lib/attendee";
import { findReviewItem, useApprove, useReject, useReviewQueue } from "@/lib/review";
import { useSession } from "@/lib/session";
import { radius, space, useTheme } from "@/theme";

/** One receipt: check it against the amount and reference, then approve or reject and move on. */
export default function ReviewItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAdmin } = useSession();
  const q = useReviewQueue();
  const list = q.data;
  const item = list?.find((i) => i.id === id) ?? findReviewItem(id);

  if (!isAdmin) {
    return <EmptyState title="Organisers only">Receipts are checked by the event organisers.</EmptyState>;
  }
  if (!item && q.isPending) return <Loading />;
  if (!item) {
    return (
      <>
        <Stack.Screen options={{ title: "Receipt" }} />
        <EmptyState title="Already handled" action={<Button title="Back to the queue" variant="secondary" onPress={() => router.replace("/review" as Href)} />}>
          Someone approved or rejected this receipt, or the member cancelled.
        </EmptyState>
      </>
    );
  }
  const index = list ? list.findIndex((i) => i.id === item.id) : -1;
  // The next receipt after this one, or the one before when this was the last
  const next = list && index >= 0 ? (list[index + 1] ?? list[index - 1] ?? null) : null;
  return <Review key={item.id} item={item} position={index >= 0 && list ? `${index + 1} of ${list.length}` : null} nextId={next?.id ?? null} />;
}

function Review({ item, position, nextId }: { item: ReviewItemDTO; position: string | null; nextId: string | null }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const approve = useApprove(item.id);
  const reject = useReject(item.id);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const who = item.userName || item.userEmail;
  const busy = approve.isPending || reject.isPending;

  const moveOn = () => (nextId ? router.replace(`/review/${nextId}` as Href) : router.replace("/review" as Href));

  function confirmApprove() {
    const lines = item.items.map((i) => `${i.quantity} × ${i.tierName}`).join(", ");
    Alert.alert(`Approve ${who}?`, `${lines} · ${peso(item.totalCents)}${item.paymentRef ? ` · ref ${item.paymentRef}` : ""}. Tickets are issued and emailed right away.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          setError(null);
          try {
            const r = await approve.mutateAsync();
            if (!r.emailSent) Alert.alert("Approved, but the email didn't send", `${who} can still see their tickets in the app and on the site. Resend from the web admin's bookings page.`);
            moveOn();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't approve");
          }
        },
      },
    ]);
  }

  async function sendReject() {
    setError(null);
    try {
      await reject.mutateAsync(note.trim());
      moveOn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reject");
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: position ? `Receipt ${position}` : "Receipt" }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 140 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <ReceiptViewer uri={assetUrl(item.paymentProofUrl)} height={Math.round(height * 0.5)} />

        <Card style={{ gap: space.md }}>
          <View style={{ gap: 2 }}>
            <Text variant="caption" muted>Expected</Text>
            <Text variant="display">{peso(item.totalCents)}</Text>
            <Text variant="caption" muted>check the receipt shows this</Text>
          </View>
          {item.paymentRef ? <CopyRow label="Reference number" value={item.paymentRef} mono /> : <Text muted>No reference number given</Text>}
          <CopyRow label="Booking ID" value={item.id} mono highlight hint="should be in the GCash note" />
          <ReviewHints item={item} />
        </Card>

        <Card style={{ gap: 6 }}>
          <Text variant="heading">{who}</Text>
          {item.userName ? <Text variant="caption" muted selectable>{item.userEmail}</Text> : null}
          <Divider />
          <Text variant="label">{item.event.title}</Text>
          <Text variant="caption" muted>{fmtRange(item.event.startsAt, item.event.endsAt)}</Text>
          {item.items.map((i) => (
            <Row key={i.tierName} style={{ justifyContent: "space-between" }}>
              <Text variant="caption">{i.quantity} × {i.tierName}</Text>
              <Text variant="caption">{peso(i.unitPriceCents * i.quantity)}</Text>
            </Row>
          ))}
          <Text variant="caption" muted>
            {item.submittedAt ? `Receipt sent ${relative(item.submittedAt)} · ${fmtDateTime(item.submittedAt)}` : `Booked ${fmtDateTime(item.createdAt)}`}
          </Text>
        </Card>

        {rejecting && (
          <Card style={{ gap: space.md }}>
            <Text variant="heading">Reject payment from {who}</Text>
            <Text variant="caption" muted>They get an email with your note, and their seats stay held so they can resubmit.</Text>
            <View style={styles.reasons}>
              {REJECT_REASONS.map((r) => (
                <Pressable
                  key={r.label}
                  onPress={() => setNote(r.text(item.totalCents))}
                  accessibilityRole="button"
                  style={[styles.reason, { borderColor: c.border, backgroundColor: c.surface1 }]}
                >
                  <Text variant="label" style={{ fontSize: 13 }}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="Note to the member" value={note} onChangeText={setNote} placeholder="What should they fix?" multiline numberOfLines={4} style={{ minHeight: 96, textAlignVertical: "top" }} />
          </Card>
        )}
        {error && <Text color={c.destructive} accessibilityLiveRegion="assertive">{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: c.background, borderColor: c.border, paddingBottom: Math.max(insets.bottom, space.md) }]}>
        {rejecting ? (
          <Row gap={space.sm}>
            <Button title="Back" variant="ghost" onPress={() => { setRejecting(false); setNote(""); }} disabled={busy} style={{ flex: 1 }} />
            <Button title="Send rejection" variant="destructive" onPress={sendReject} loading={reject.isPending} disabled={busy || !note.trim()} style={{ flex: 2 }} />
          </Row>
        ) : (
          <Row gap={space.sm}>
            <Button title="Reject" variant="destructive" onPress={() => setRejecting(true)} disabled={busy} style={{ flex: 1 }} />
            <Button title="Approve" onPress={confirmApprove} loading={approve.isPending} disabled={busy} style={{ flex: 2 }} />
          </Row>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reason: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
});
