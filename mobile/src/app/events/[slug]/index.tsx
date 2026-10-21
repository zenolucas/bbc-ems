import { useNow } from "@/components/countdown";
import type { EventDetailDTO } from "@bbc/shared/api-types";
import { fmtDate, fmtTime, peso } from "@bbc/shared/format";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Bell, CalendarDays, MapPin, Share2 } from "lucide-react-native";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AvailabilityPill, priceLabel } from "@/components/event/event-card";
import { EventMarkdown } from "@/components/event/markdown";
import { DateTab, Poster } from "@/components/event/poster";
import { Button, Card, ErrorView, Loading, Notice, Pill, Row, Text } from "@/components/ui";
import { statusLabel, useEvent, useWaitlist } from "@/lib/attendee";
import { API_URL } from "@/lib/config";
import { offerPush } from "@/lib/push";
import { useSession } from "@/lib/session";
import { brand, fonts, radius, space, useTheme } from "@/theme";

function timeRange(start: string, end: string | null) {
  if (!end) return fmtTime(start);
  if (fmtDate(start, "yyyy-MM-dd") === fmtDate(end, "yyyy-MM-dd")) return `${fmtTime(start)} – ${fmtTime(end)}`;
  return `${fmtTime(start)} – ${fmtDate(end, "EEE, MMM d")}, ${fmtTime(end)}`;
}

/** Booking state, using the site's rules and wording. */
export function bookability(e: EventDetailDTO, now: number) {
  const endsAt = e.endsAt ? new Date(e.endsAt).getTime() : new Date(e.startsAt).getTime() + 6 * 3600e3;
  const isOver = endsAt < now;
  const anyOnSale = e.tiers.some((t) => t.onSale && t.remaining > 0);
  const canBook = e.status === "published" && !isOver && anyOnSale;
  const nextSale = e.tiers
    .map((t) => t.salesStart)
    .filter((d): d is string => !!d && new Date(d).getTime() > now)
    .sort()[0];
  const closedLabel =
    e.status === "cancelled" ? "Event cancelled" : isOver ? "Event has ended" : e.status !== "published" ? "Not open yet" : nextSale && !anyOnSale ? "Sales open soon" : "Sold out";
  return { isOver, canBook, closedLabel, nextSale };
}

export default function EventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useEvent(slug);
  const waitlist = useWaitlist(slug);
  const { status } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();

  if (q.isPending) return <><Stack.Screen options={{ title: "" }} /><Loading /></>;
  if (q.isError) return <><Stack.Screen options={{ title: "Event" }} /><ErrorView error={q.error} onRetry={() => q.refetch()} /></>;
  const e = q.data;
  const { canBook, closedLabel, isOver } = bookability(e, now);
  const existing = e.myBooking;
  // Sold out (not closed or over): offer the waitlist instead of a dead button
  const waitlistable = !existing && !canBook && e.status === "published" && !isOver && e.availability === "sold-out";
  async function toggleWaitlist() {
    if (status !== "signedIn") return router.push("/sign-in");
    const joining = !e.onWaitlist;
    try {
      await waitlist.mutateAsync(joining);
      // Pushes reach people faster than email, and the first to book gets the seats
      if (joining) void offerPush("waitlist");
    } catch (err) {
      Alert.alert("Couldn't update the waitlist", err instanceof Error ? err.message : "Try again in a moment.");
    }
  }
  const share = () => Share.share({ message: `${e.title} · ${API_URL}/events/${e.slug}` }).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen
        options={{
          title: "",
          headerTransparent: true,
          headerTintColor: brand.cream,
          headerRight: () => (
            <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Share event" hitSlop={10} style={styles.glass}>
              <Share2 size={18} color={brand.cream} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={brand.cream} progressViewOffset={insets.top + 48} />}>
        <Poster url={e.coverImageUrl} dim={e.status === "cancelled"} style={{ height: 340 + insets.top }}>
          <View style={styles.scrim} />
          <View style={[styles.posterTop, { top: insets.top + 56 }]}>
            <DateTab date={e.startsAt} large />
            <AvailabilityPill e={e} />
          </View>
          <View style={styles.posterBottom}>
            <Text style={{ fontFamily: fonts.bodyBold, color: brand.star, fontSize: 12, letterSpacing: 1.2 }}>
              {fmtDate(e.startsAt, "EEE, MMM d").toUpperCase()} · {fmtTime(e.startsAt)}
            </Text>
            <Text variant="display" color="#fff" style={{ fontSize: 32, lineHeight: 34 }}>{e.title}</Text>
            {e.tagline ? <Text color="rgba(255,255,255,0.85)">{e.tagline}</Text> : null}
          </View>
        </Poster>

        <View style={{ padding: space.lg, gap: space.lg }}>
          {e.status === "cancelled" && (
            <Notice tone="danger" title="This event has been cancelled">
              Tickets for it are no longer valid. If you paid, the organisers will contact you about a refund.
            </Notice>
          )}
          {e.status === "draft" && <Notice tone="warning" title="Draft preview">Only admins can see this page until it&apos;s published.</Notice>}

          <View style={{ gap: space.md }}>
            <Row gap={10} style={{ alignItems: "flex-start" }}>
              <CalendarDays size={18} color={c.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text variant="label" style={{ fontSize: 14 }}>{fmtDate(e.startsAt, "EEEE, MMM d, yyyy")}</Text>
                <Text variant="caption" muted>{timeRange(e.startsAt, e.endsAt)}</Text>
              </View>
            </Row>
            <Row gap={10} style={{ alignItems: "flex-start" }}>
              <MapPin size={18} color={c.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text variant="label" style={{ fontSize: 14 }}>{e.venueName}</Text>
                {e.venueAddress ? <Text variant="caption" muted>{e.venueAddress}</Text> : null}
                {e.mapUrl ? (
                  <Pressable onPress={() => Linking.openURL(e.mapUrl!).catch(() => {})} accessibilityRole="link" hitSlop={8}>
                    <Text variant="label" color={c.accentForeground} style={{ marginTop: 4 }}>Open map ↗</Text>
                  </Pressable>
                ) : null}
              </View>
            </Row>
          </View>

          {existing && (
            <Pressable onPress={() => router.push(`/bookings/${existing.id}`)} accessibilityRole="button">
              <Notice tone={existing.status === "approved" ? "success" : existing.status === "under_review" ? "info" : "warning"} title={existing.status === "approved" ? "You're going" : `You have a booking: ${statusLabel[existing.status].toLowerCase()}`}>
                {existing.status === "approved"
                  ? "Your tickets are saved in the Tickets tab."
                  : existing.status === "pending_payment"
                    ? "Finish paying to keep your hold."
                    : existing.status === "rejected"
                      ? "Your payment needs another look."
                      : "Receipt received, an organiser is checking it."}
              </Notice>
            </Pressable>
          )}

          {e.descriptionMd.trim() ? (
            <View>
              <Text variant="title" style={{ marginBottom: space.sm }}>About</Text>
              <EventMarkdown>{e.descriptionMd}</EventMarkdown>
            </View>
          ) : null}

          {e.tiers.length > 0 && (
            <Card style={{ gap: space.md }}>
              <Text variant="title">Tickets</Text>
              {e.tiers.map((t, i) => (
                <View key={t.id} style={[{ gap: 4, paddingTop: i ? space.md : 0 }, i > 0 && { borderTopWidth: 1, borderColor: c.border }, !t.onSale && { opacity: 0.6 }]}>
                  <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Text variant="heading" style={{ flex: 1 }}>{t.name}</Text>
                    <Text variant="heading">{peso(t.priceCents)}</Text>
                  </Row>
                  {t.description ? <Text variant="caption" muted>{t.description}</Text> : null}
                  <Row>
                    {!t.onSale ? (
                      <Pill label={t.salesStart && new Date(t.salesStart).getTime() > now ? `Opens ${fmtDate(t.salesStart, "MMM d")}` : "Not on sale"} />
                    ) : t.remaining === 0 ? (
                      <Pill label="Sold out" />
                    ) : t.remaining <= 10 ? (
                      <Pill label={`${t.remaining} left`} tone="warning" />
                    ) : null}
                  </Row>
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      {/* The main action stays in reach under a long description */}
      <View style={[styles.cta, { backgroundColor: c.background, borderColor: c.border, paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="heading" numberOfLines={1}>{existing ? (existing.status === "approved" ? "You're going" : "Booking in progress") : waitlistable ? "Sold out" : priceLabel(e)}</Text>
          {waitlistable ? (
            <Text variant="caption" muted numberOfLines={2}>
              {e.onWaitlist ? "You're on the list. We'll tell you the moment seats free up." : "Seats come back when holds lapse. Get told first."}
            </Text>
          ) : (
            <Text variant="caption" muted numberOfLines={1}>{fmtDate(e.startsAt, "EEE, MMM d")} · {fmtTime(e.startsAt)}</Text>
          )}
        </View>
        {existing ? (
          <Button title={existing.status === "approved" ? "View tickets" : "Open booking"} onPress={() => router.push(`/bookings/${existing.id}`)} />
        ) : waitlistable ? (
          e.onWaitlist ? (
            <Button title="Leave the list" variant="ghost" loading={waitlist.isPending} onPress={toggleWaitlist} />
          ) : (
            <Button title="Notify me" icon={<Bell size={16} color={c.primaryForeground} />} loading={waitlist.isPending} onPress={toggleWaitlist} />
          )
        ) : canBook ? (
          <Button title="Book tickets" onPress={() => (status === "signedIn" ? router.push(`/events/${e.slug}/book`) : router.push("/sign-in"))} />
        ) : (
          <Button title={isOver ? "Event has ended" : closedLabel} disabled />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(11, 22, 26, 0.35)" },
  posterTop: { position: "absolute", left: space.md, right: space.md, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  posterBottom: { position: "absolute", left: 20, right: 20, bottom: 18, gap: 6 },
  glass: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: "rgba(14, 28, 32, 0.55)", alignItems: "center", justifyContent: "center" },
  cta: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
