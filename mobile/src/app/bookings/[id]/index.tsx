import type { BookingDTO } from "@bbc/shared/api-types";
import { fmtDate, fmtTime, peso, relative } from "@bbc/shared/format";
import { Image } from "expo-image";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ChevronRight, Clock, Ticket as TicketIcon } from "lucide-react-native";
import { useCallback } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { CountdownRing, CountdownText } from "@/components/countdown";
import { ExpireHold } from "@/components/demo/expire-hold";
import { AddToCalendarButton } from "@/components/event/add-to-calendar";
import { CopyRow } from "@/components/ticket/copy-row";
import { Button, Card, Divider, ErrorView, Loading, Notice, Pill, Row, Screen, SignInPrompt, Text } from "@/components/ui";
import { assetUrl, statusLabel, statusTone, useBooking, useCancelBooking } from "@/lib/attendee";
import { API_URL } from "@/lib/config";
import { useSession } from "@/lib/session";
import { fonts, radius, space, useTheme } from "@/theme";

export default function BookingScreen() {
  const { id, reserved, confirmed } = useLocalSearchParams<{ id: string; reserved?: string; confirmed?: string }>();
  const { status: session } = useSession();
  const q = useBooking(id);
  const { refetch } = q;
  // Back from the pay screen, or from the review queue pinging: show the latest
  useFocusEffect(useCallback(() => void refetch(), [refetch]));

  if (session !== "signedIn") return <><Stack.Screen options={{ title: "Booking" }} /><SignInPrompt title="Sign in to see this booking">Use the email you booked with.</SignInPrompt></>;
  if (q.isPending) return <><Stack.Screen options={{ title: "Booking" }} /><Loading /></>;
  if (q.isError) return <><Stack.Screen options={{ title: "Booking" }} /><ErrorView error={q.error} onRetry={() => q.refetch()} /></>;
  return <BookingView b={q.data} refreshing={q.isRefetching} onRefresh={() => q.refetch()} reserved={!!reserved} confirmed={!!confirmed} />;
}

function BookingView({ b, refreshing, onRefresh, reserved, confirmed }: { b: BookingDTO; refreshing: boolean; onRefresh: () => void; reserved: boolean; confirmed: boolean }) {
  const { c } = useTheme();
  const cancel = useCancelBooking(b.id);
  const ev = b.event;
  const status = b.status;
  const eventCancelled = ev.status === "cancelled";
  const dead = status === "expired" || status === "cancelled" || eventCancelled;
  const awaitingPayment = !eventCancelled && (status === "pending_payment" || status === "rejected");
  const hasPaymentDetails = !!(b.payment.gcashNumber || b.payment.gcashQrUrl);
  const ticketCount = b.tickets.filter((t) => t.status !== "void").length;
  const canCancel = !eventCancelled && (status === "pending_payment" || status === "under_review" || status === "rejected");
  const proof = assetUrl(b.paymentProofUrl);

  function confirmCancel() {
    const paid = status === "under_review";
    Alert.alert(
      "Cancel this booking?",
      paid
        ? "Your tickets are released for others. If you already sent money, message the organisers about a refund; cancelling here doesn't send one."
        : "Your tickets are released for others to book. You can book again later if any remain.",
      [
        { text: "Keep booking", style: "cancel" },
        {
          text: "Cancel booking",
          style: "destructive",
          onPress: () => cancel.mutate(undefined, { onError: (e) => Alert.alert("Couldn't cancel", e.message) }),
        },
      ],
    );
  }

  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={onRefresh}>
      <Stack.Screen options={{ title: "Booking" }} />

      <View style={[{ gap: 6 }, dead && { opacity: 0.7 }]}>
        <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Pressable onPress={() => router.push(`/events/${ev.slug}`)} accessibilityRole="link" style={{ flex: 1 }}>
            <Text variant="title">{ev.title}</Text>
          </Pressable>
          <Pill label={eventCancelled && status === "approved" ? "Cancelled" : statusLabel[status]} tone={eventCancelled ? "danger" : statusTone[status]} />
        </Row>
        <Text variant="caption" muted>
          {fmtDate(ev.startsAt, "EEE, MMM d")} · {fmtTime(ev.startsAt)} · {ev.venueName}
        </Text>
        <Text variant="caption" muted>Booking ref <Text variant="caption" style={{ fontFamily: fonts.mono }}>{b.id}</Text></Text>
      </View>

      {/* What's happening and what to do next */}
      {eventCancelled ? (
        <Notice tone="danger" title="This event has been cancelled">
          {status === "approved" || status === "under_review" ? "Your tickets no longer scan. If you paid, the organisers will contact you about a refund." : "Nothing more to do here."}
        </Notice>
      ) : status === "approved" ? (
        <Notice tone="success" title={confirmed ? "You're in!" : "Confirmed"}>
          {`${ticketCount === 1 ? "Your ticket is below" : `Your ${ticketCount} tickets are below`} and in your email. Show the QR at the door; each one scans once.`}
        </Notice>
      ) : status === "pending_payment" ? (
        <Card style={[styles.hold, { borderLeftColor: c.info }]}>
          {b.expiresAt && <CountdownRing to={b.expiresAt} from={b.createdAt} onDone={onRefresh} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" style={{ fontSize: 15 }}>{reserved ? "Tickets reserved. Now pay to keep them." : "Waiting for your payment"}</Text>
            <Text variant="caption" muted>
              Send <Text variant="caption" style={{ fontFamily: fonts.bodyBold }}>{peso(b.totalCents)}</Text> and upload the receipt
              {b.expiresAt ? ` before ${fmtDate(b.expiresAt, "EEE, MMM d")} · ${fmtTime(b.expiresAt)}` : ""}. We&apos;ve emailed you the details too.
            </Text>
          </View>
        </Card>
      ) : status === "rejected" ? (
        <Notice tone="warning" title="We couldn't confirm your payment">
          <Text variant="caption" muted>{b.reviewNote ? `Organiser note: “${b.reviewNote}”` : "The organiser couldn't match your receipt to a payment."}</Text>
          <Text variant="caption" muted>Your tickets are still on hold; fix it below.</Text>
        </Notice>
      ) : status === "under_review" ? (
        <Notice tone="info" title="Receipt received, waiting for an organiser">
          Organisers check receipts by hand, usually within a day. We&apos;ll notify you the moment it&apos;s confirmed. Your seats are held until then.
        </Notice>
      ) : status === "expired" ? (
        <Notice tone="danger" title="This reservation expired">
          <Text variant="caption" muted>{`The ${b.payment.holdHours}-hour hold ran out before a receipt was uploaded, so the seats were released. Nothing was charged.`}</Text>
          <Row style={{ marginTop: space.sm }}>
            <Button title="Book again" onPress={() => router.push(`/events/${ev.slug}/book`)} />
            <Button title="Browse events" variant="ghost" onPress={() => router.navigate("/")} />
          </Row>
        </Notice>
      ) : status === "cancelled" ? (
        <Notice tone="danger" title="This booking was cancelled">
          {`Its tickets were released${b.reviewNote ? `. Note: ${b.reviewNote}` : "."}`}
        </Notice>
      ) : null}

      {/* Order */}
      <Card style={[{ gap: 4 }, dead && { opacity: 0.6 }]}>
        {b.items.map((it) => (
          <Row key={it.tierId} style={{ justifyContent: "space-between" }}>
            <Text>{it.quantity} × {it.tierName}</Text>
            <Text>{peso(it.unitPriceCents * it.quantity)}</Text>
          </Row>
        ))}
        <Divider dashed />
        <Row style={{ justifyContent: "space-between" }}>
          <Text variant="heading">Total</Text>
          <Text variant="title" style={dead && { textDecorationLine: "line-through" }}>{peso(b.totalCents)}</Text>
        </Row>
      </Card>

      {awaitingPayment && (
        <Card style={{ gap: space.md }}>
          <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <Row gap={10}>
              <View style={[styles.stepNum, { backgroundColor: c.primary }]}>
                <Text style={{ fontFamily: fonts.displayHeavy, color: c.primaryForeground, fontSize: 14 }}>1</Text>
              </View>
              <Text variant="title" style={{ fontSize: 19 }}>{status === "rejected" ? "Fix the payment" : "Pay via GCash or Maya"}</Text>
            </Row>
            {status === "rejected" && b.expiresAt && (
              <Row gap={6}>
                <Clock size={14} color={c.warningForeground} />
                <CountdownText to={b.expiresAt} prefix="Resubmit within " done="Hold expired" onDone={onRefresh} color={c.warningForeground} />
              </Row>
            )}
          </Row>
          {hasPaymentDetails ? (
            <View style={{ gap: space.md }}>
              {b.payment.gcashQrUrl && (
                <Pressable onPress={() => Linking.openURL(assetUrl(b.payment.gcashQrUrl)!).catch(() => {})} accessibilityRole="imagebutton" accessibilityLabel={`GCash QR code for ${b.payment.gcashName ?? "the organiser"}. Opens full size.`}>
                  <View style={[styles.qr, { borderColor: c.border }]}>
                    <Image source={assetUrl(b.payment.gcashQrUrl)} style={StyleSheet.absoluteFill} contentFit="contain" />
                  </View>
                </Pressable>
              )}
              <CopyRow label="Amount" value={peso(b.totalCents)} copyValue={(b.totalCents / 100).toFixed(b.totalCents % 100 ? 2 : 0)} big />
              {b.payment.gcashName && (
                <View style={{ gap: 2 }}>
                  <Text variant="caption" muted>Account name</Text>
                  <Text variant="label" style={{ fontSize: 15 }}>{b.payment.gcashName}</Text>
                </View>
              )}
              {b.payment.gcashNumber && <CopyRow label="Number" value={b.payment.gcashNumber} copyValue={b.payment.gcashNumber.replace(/\s/g, "")} mono />}
              <CopyRow label="Message / note" value={b.id} mono highlight hint="Paste this in the payment message so we can match it fast." />
            </View>
          ) : (
            <Notice tone="warning" title="Payment details aren't up yet">
              The organiser hasn&apos;t added GCash/Maya details. Your hold is safe; check back soon.
            </Notice>
          )}
          {b.payment.instructions ? (
            <View style={{ backgroundColor: c.surface2, borderRadius: radius.sm, padding: space.md }}>
              <Text variant="caption" muted>{b.payment.instructions}</Text>
            </View>
          ) : null}
          <Button
            size="lg"
            title={status === "rejected" ? "Upload a new receipt" : "I've paid — upload receipt"}
            onPress={() => router.push(`/bookings/${b.id}/pay`)}
          />
        </Card>
      )}
      {awaitingPayment && <ExpireHold bookingId={b.id} />}

      {status === "under_review" && !eventCancelled && (
        <>
          <Card style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
            {proof && (
              <Pressable onPress={() => Linking.openURL(proof).catch(() => {})} accessibilityRole="imagebutton" accessibilityLabel="Your receipt screenshot. Opens full size.">
                <Image source={proof} style={[styles.receipt, { borderColor: c.border }]} contentFit="cover" contentPosition="top" />
              </Pressable>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">Your receipt</Text>
              {b.paymentRef && <Text variant="caption" muted>Ref <Text variant="caption" style={{ fontFamily: fonts.mono }}>{b.paymentRef}</Text></Text>}
              {b.submittedAt && <Text variant="caption" muted>Sent {relative(b.submittedAt)}</Text>}
            </View>
          </Card>
          <View style={{ backgroundColor: c.surface2, borderRadius: radius.lg, padding: space.lg }}>
            <Text variant="caption" muted>
              Please don&apos;t head to the door with this screen. Tickets aren&apos;t confirmed until an organiser approves the receipt.
            </Text>
          </View>
        </>
      )}

      {status === "approved" && b.tickets.length > 0 && (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <Text variant="title">{b.tickets.length > 1 ? "Who's coming?" : "Your ticket"}</Text>
            <Text variant="caption" muted>{b.tickets.length > 1 ? "Tap a ticket for its QR" : "Tap it for the QR"}</Text>
          </Row>
          {b.tickets.length > 1 && !eventCancelled && new Set(b.tickets.filter((t) => t.status !== "void").map((t) => t.holderName)).size === 1 && (
            <View style={{ backgroundColor: c.infoSoft, borderRadius: radius.md, padding: space.md }}>
              <Text variant="caption">
                <Text variant="caption" style={{ fontFamily: fonts.bodySemi }}>Put a name on each ticket. </Text>
                {b.tickets.length === 2 ? "Both say" : "Every ticket says"} “{b.tickets[0].holderName}”. Open each one to add your guests&apos; names, then send each friend their QR.
              </Text>
            </View>
          )}
          {b.tickets.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => router.push(`/tickets/${t.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${t.holderName}, ${t.tierName}, ${statusLabel[t.status]}`}
              style={({ pressed }) => [styles.ticketRow, { backgroundColor: c.card, borderColor: c.border, opacity: t.status === "void" ? 0.5 : pressed ? 0.85 : 1 }]}
            >
              <View style={[styles.ticketIcon, { backgroundColor: c.successSoft }]}>
                <TicketIcon size={22} color={c.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontFamily: fonts.mono, fontSize: 15, fontWeight: "700", letterSpacing: 1 }}>{t.shortCode}</Text>
                <Text variant="caption" muted numberOfLines={1}>{t.holderName} · {t.tierName}</Text>
              </View>
              {t.status !== "valid" && <Pill label={statusLabel[t.status]} tone={t.status === "used" ? "success" : "neutral"} />}
              <ChevronRight size={18} color={c.mutedForeground} />
            </Pressable>
          ))}
          {!eventCancelled && <AddToCalendarButton event={b.event} link={`${API_URL}/bookings/${b.id}`} />}
        </View>
      )}

      {canCancel && (
        <Button title="Cancel booking" variant="destructive" loading={cancel.isPending} onPress={confirmCancel} style={{ marginTop: space.lg, alignSelf: "center" }} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hold: { flexDirection: "row", alignItems: "center", gap: 14, borderLeftWidth: 4 },
  stepNum: { width: 28, height: 28, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  qr: { width: "100%", maxWidth: 260, aspectRatio: 1, alignSelf: "center", backgroundColor: "#fff", borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  receipt: { width: 64, height: 84, borderRadius: radius.sm, borderWidth: 1 },
  ticketRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  ticketIcon: { width: 48, height: 48, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
});
