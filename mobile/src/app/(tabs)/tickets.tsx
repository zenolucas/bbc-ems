import { useNow } from "@/components/countdown";
import type { BookingDTO, TicketDTO } from "@bbc/shared/api-types";
import { fmtDate, fmtTime, peso, relative } from "@bbc/shared/format";
import { router, useFocusEffect } from "expo-router";
import { ChevronDown, ChevronRight, CloudOff, Ticket as TicketIcon } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, EmptyState, Notice, Pill, Row, Screen, SignInPrompt, Text } from "@/components/ui";
import { statusLabel, useBookings } from "@/lib/attendee";
import { useSession } from "@/lib/session";
import { useTickets } from "@/lib/tickets-cache";
import { fonts, radius, space, useTheme } from "@/theme";

type Group = { eventId: string; event: TicketDTO["event"]; tickets: TicketDTO[]; past: boolean };

function endOf(e: TicketDTO["event"]) {
  return e.endsAt ? new Date(e.endsAt).getTime() : new Date(e.startsAt).getTime() + 6 * 3600e3;
}

/** "Today" / "Tonight" / "Tomorrow" / "Sat, Oct 24", in Manila time like the site. */
function dayLabel(iso: string) {
  const day = (d: Date | string) => fmtDate(d, "yyyy-MM-dd");
  // A sunrise hike isn't "tonight": only evening starts (5 PM on) get that word
  if (day(iso) === day(new Date())) return Number(fmtDate(iso, "H")) >= 17 ? "Tonight" : "Today";
  if (day(iso) === day(new Date(Date.now() + 24 * 3600e3))) return "Tomorrow";
  return fmtDate(iso, "EEE, MMM d");
}

export default function TicketsTab() {
  const { status } = useSession();
  if (status !== "signedIn") {
    return (
      <Screen scroll={false}>
        <SignInPrompt title="Your passes live here">Sign in and your tickets are saved to this phone, so they open at the door even without signal.</SignInPrompt>
      </Screen>
    );
  }
  return <Wallet />;
}

function Wallet() {
  const { c } = useTheme();
  const { tickets, syncedAt, offline, syncing, error, refresh } = useTickets();
  const bookings = useBookings();
  const [showPast, setShowPast] = useState(false);

  const { refetch } = bookings;
  useFocusEffect(
    useCallback(() => {
      refresh();
      refetch();
    }, [refresh, refetch]),
  );

  const now = useNow();
  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const t of tickets) {
      if (t.status === "void") continue;
      const g = map.get(t.event.id) ?? { eventId: t.event.id, event: t.event, tickets: [], past: endOf(t.event) < now };
      g.tickets.push(t);
      map.set(t.event.id, g);
    }
    const all = [...map.values()].sort((a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime());
    return { upcoming: all.filter((g) => !g.past), past: all.filter((g) => g.past).reverse() };
  }, [tickets, now]);

  // Bookings that still need the member: unpaid holds, rejected receipts, receipts in review
  const attention = (bookings.data ?? []).filter((b) => b.event.status !== "cancelled" && (b.status === "pending_payment" || b.status === "rejected" || b.status === "under_review"));

  return (
    <Screen refreshing={syncing && tickets.length > 0} onRefresh={() => { refresh(); refetch(); }}>
      <View style={{ gap: 4, marginBottom: space.sm }}>
        <Text variant="caption" muted style={{ letterSpacing: 1.2 }}>MY TICKETS</Text>
        <Text variant="display">Your passes</Text>
      </View>

      {offline && (
        <Row style={[styles.banner, { backgroundColor: c.warningSoft }]}>
          <CloudOff size={16} color={c.warningForeground} />
          <Text variant="caption" color={c.warningForeground} style={{ flex: 1 }}>
            Offline · showing saved tickets{syncedAt ? ` from ${relative(new Date(syncedAt))}` : ""}
          </Text>
        </Row>
      )}
      {error && !offline && <Notice tone="danger" title="Couldn't refresh your tickets">{error}</Notice>}

      {attention.map((b) => <AttentionRow key={b.id} b={b} />)}

      {groups.upcoming.length === 0 && attention.length === 0 ? (
        syncing && syncedAt == null ? (
          <EmptyState title="Fetching your tickets…" />
        ) : (
          <EmptyState title="No passes yet" action={<Button title="Browse events" variant="secondary" onPress={() => router.navigate("/")} />}>
            No upcoming tickets yet. When a booking is confirmed, its tickets show up here and stay on this phone.
          </EmptyState>
        )
      ) : (
        groups.upcoming.map((g) => <EventGroup key={g.eventId} g={g} />)
      )}

      {groups.past.length > 0 && (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <Pressable onPress={() => setShowPast((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showPast }} hitSlop={8}>
            <Row>
              <Text variant="heading" muted>Past ({groups.past.length})</Text>
              {showPast ? <ChevronDown size={18} color={c.mutedForeground} /> : <ChevronRight size={18} color={c.mutedForeground} />}
            </Row>
          </Pressable>
          {showPast && groups.past.map((g) => <EventGroup key={g.eventId} g={g} />)}
        </View>
      )}
    </Screen>
  );
}

function AttentionRow({ b }: { b: BookingDTO }) {
  const label = b.status === "pending_payment" ? "Pay now" : b.status === "rejected" ? "Fix payment" : "Details";
  const tone = b.status === "under_review" ? "info" : b.status === "rejected" ? "danger" : "warning";
  return (
    <Pressable onPress={() => router.push(`/bookings/${b.id}`)} accessibilityRole="button" accessibilityLabel={`${b.event.title}: ${statusLabel[b.status]}. ${label}`}>
      <Notice tone={tone} title={b.event.title}>
        <Row style={{ justifyContent: "space-between" }}>
          <Text variant="caption" muted style={{ flex: 1 }}>
            {statusLabel[b.status]} · {peso(b.totalCents)}
            {b.expiresAt && b.status !== "under_review" ? ` · hold ends ${fmtDate(b.expiresAt, "MMM d")}, ${fmtTime(b.expiresAt)}` : ""}
          </Text>
          <Text variant="label">{label} ›</Text>
        </Row>
      </Notice>
    </Pressable>
  );
}

function EventGroup({ g }: { g: Group }) {
  const { c } = useTheme();
  return (
    <View style={[styles.group, { backgroundColor: c.card, borderColor: c.border }, g.past && { opacity: 0.7 }]}>
      <View style={{ padding: space.lg, paddingBottom: space.sm, gap: 2 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Text variant="caption" color={g.past ? c.mutedForeground : c.primary} style={{ fontFamily: fonts.bodyBold, letterSpacing: 1 }}>
            {(g.past ? fmtDate(g.event.startsAt, "MMM d, yyyy") : dayLabel(g.event.startsAt)).toUpperCase()} · {fmtTime(g.event.startsAt)}
          </Text>
          <Text variant="caption" muted>{g.tickets.length} ticket{g.tickets.length === 1 ? "" : "s"}</Text>
        </Row>
        <Text variant="title" numberOfLines={2}>{g.event.title}</Text>
        <Text variant="caption" muted numberOfLines={1}>{g.event.venueName}</Text>
      </View>
      {g.tickets.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => router.push(`/tickets/${t.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Ticket for ${t.holderName}, ${t.tierName}. ${t.status === "used" ? "Checked in." : "Show QR."}`}
          style={({ pressed }) => [styles.ticket, { borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={[styles.icon, { backgroundColor: t.status === "used" ? c.surface2 : c.successSoft }]}>
            <TicketIcon size={20} color={t.status === "used" ? c.mutedForeground : c.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="label" numberOfLines={1} style={{ fontSize: 15 }}>{t.holderName}</Text>
            <Text variant="caption" muted numberOfLines={1}>{t.tierName} · <Text variant="caption" style={{ fontFamily: fonts.mono }}>{t.shortCode}</Text></Text>
          </View>
          {t.status === "used" ? <Pill label="Checked in" tone="success" /> : <Text variant="label" color={c.primary}>Show QR</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10 },
  group: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  ticket: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderStyle: "dashed" },
  icon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
});
