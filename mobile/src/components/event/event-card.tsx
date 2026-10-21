import type { EventSummaryDTO } from "@bbc/shared/api-types";
import { fmtDate, fmtTime, peso } from "@bbc/shared/format";
import { router } from "expo-router";
import { MapPin } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Pill, Row, Text } from "@/components/ui";
import { brand, fonts, radius, space, useTheme } from "@/theme";
import { DateTab, Poster } from "./poster";

export function priceLabel(e: Pick<EventSummaryDTO, "priceFromCents">) {
  if (e.priceFromCents == null) return "";
  return e.priceFromCents === 0 ? "Free" : `from ${peso(e.priceFromCents)}`;
}

/** Same wording as the site's cards. */
function availabilityNote(e: EventSummaryDTO) {
  if (e.status === "cancelled") return "Tickets voided";
  if (e.availability === "sold-out") return "No tickets left";
  if (e.availability === "not-on-sale") return "Sales closed";
  if (e.availability === "few-left" && e.remaining != null && e.capacity) return `${e.remaining} of ${e.capacity} spots left`;
  return null;
}

export function AvailabilityPill({ e }: { e: Pick<EventSummaryDTO, "status" | "availability"> }) {
  if (e.status === "cancelled") return <Pill label="Cancelled" tone="danger" />;
  if (e.availability === "few-left") return <Pill label="Few left" tone="warning" />;
  if (e.availability === "sold-out") return <Pill label="Sold out" tone="neutral" />;
  if (e.availability === "not-on-sale") return <Pill label="Sales closed" tone="neutral" />;
  return null;
}

export function EventCard({ e }: { e: EventSummaryDTO }) {
  const { c } = useTheme();
  const gone = e.availability === "sold-out" || e.status === "cancelled";
  const note = availabilityNote(e);
  return (
    <Pressable
      onPress={() => router.push(`/events/${e.slug}`)}
      accessibilityRole="button"
      accessibilityLabel={`${e.title}, ${fmtDate(e.startsAt, "EEEE, MMMM d")}, ${e.venueName}`}
      style={({ pressed }) => [styles.card, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.9 : 1 }]}
    >
      <Poster url={e.coverImageUrl} dim={gone} style={styles.poster}>
        <View style={styles.posterTop}>
          <DateTab date={e.startsAt} />
          <AvailabilityPill e={e} />
        </View>
        {e.availability === "sold-out" && e.status !== "cancelled" && (
          <View style={styles.stamp}>
            <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.displayHeavy, color: brand.cream, fontSize: 15, letterSpacing: 2 }}>SOLD OUT</Text>
          </View>
        )}
      </Poster>
      <View style={{ padding: space.lg, gap: 6 }}>
        <Text variant="title" numberOfLines={2} style={e.status === "cancelled" && { textDecorationLine: "line-through" }}>{e.title}</Text>
        {e.tagline ? <Text muted numberOfLines={2}>{e.tagline}</Text> : null}
        <Row gap={6}>
          <MapPin size={14} color={c.mutedForeground} />
          <Text variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
            {fmtDate(e.startsAt, "EEE, MMM d")} · {fmtTime(e.startsAt)} · {e.venueName}
          </Text>
        </Row>
      </View>
      <View style={[styles.footer, { borderColor: c.border }]}>
        <Text variant="heading">{priceLabel(e)}</Text>
        {note && <Text variant="caption" color={e.availability === "few-left" ? c.warningForeground : c.mutedForeground}>{note}</Text>}
      </View>
    </Pressable>
  );
}

/** Past events: compact and dimmed, like the site's rail. */
export function PastEventRow({ e }: { e: EventSummaryDTO }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/events/${e.slug}`)}
      accessibilityRole="button"
      accessibilityLabel={`${e.title}, ${fmtDate(e.startsAt, "MMMM d, yyyy")}`}
      style={({ pressed }) => [styles.row, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.6 : 0.75 }]}
    >
      <Poster url={e.coverImageUrl} style={styles.thumb} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="heading" numberOfLines={1}>{e.title}</Text>
        <Text variant="caption" muted numberOfLines={1}>{fmtDate(e.startsAt, "MMM d, yyyy")} · {e.venueName}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  poster: { aspectRatio: 16 / 9, width: "100%" },
  posterTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: space.md },
  stamp: { position: "absolute", alignSelf: "center", top: "42%", borderWidth: 2, borderColor: brand.cream, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6, transform: [{ rotate: "-6deg" }] },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderStyle: "dashed" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  thumb: { width: 64, height: 64, borderRadius: radius.sm },
});
