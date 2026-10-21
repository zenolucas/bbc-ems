import type { TicketDTO } from "@bbc/shared/api-types";
import { fmtDate, fmtDateTime, fmtTime } from "@bbc/shared/format";
import * as Brightness from "expo-brightness";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";
import { CopyRow } from "@/components/ticket/copy-row";
import { TicketImage } from "@/components/ticket/ticket-image";
import { Button, Card, EmptyState, Field, Loading, Notice, Row, Screen, Text } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useRenameTicket } from "@/lib/attendee";
import { ensurePng, upsertTicket, useCachedTicket, useTickets } from "@/lib/tickets-cache";
import { radius, space, useTheme } from "@/theme";

/** Full brightness while the QR is on screen, so door scanners read it first time. */
function useBrightScreen() {
  useFocusEffect(
    useCallback(() => {
      let previous: number | null = null;
      let cancelled = false;
      (async () => {
        try {
          if (!(await Brightness.isAvailableAsync())) return;
          previous = await Brightness.getBrightnessAsync();
          if (!cancelled) await Brightness.setBrightnessAsync(1);
        } catch {}
      })();
      return () => {
        cancelled = true;
        (async () => {
          try {
            if (Platform.OS === "android") await Brightness.restoreSystemBrightnessAsync();
            else if (previous != null) await Brightness.setBrightnessAsync(previous);
          } catch {}
        })();
      };
    }, []),
  );
}

export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cached = useCachedTicket(id);
  const [missing, setMissing] = useState<string | null>(null);
  useBrightScreen();

  // Opened from a push or the booking page before the wallet synced: fetch it once and save it
  useEffect(() => {
    if (cached) return;
    let live = true;
    api<TicketDTO>(`/api/v1/tickets/${encodeURIComponent(id)}`)
      .then((t) => upsertTicket(t))
      .catch((e) => live && setMissing(e instanceof ApiError && e.offline ? "This ticket isn't saved on this phone yet, and there's no signal to fetch it." : e instanceof Error ? e.message : "Ticket not found"));
    return () => {
      live = false;
    };
  }, [cached, id]);

  if (!cached) {
    return (
      <>
        <Stack.Screen options={{ title: "Ticket" }} />
        {missing ? <EmptyState title="Couldn't open this ticket">{missing}</EmptyState> : <Loading />}
      </>
    );
  }
  return <TicketView t={cached} />;
}

function TicketView({ t }: { t: TicketDTO }) {
  const { c } = useTheme();
  const { tickets, offline } = useTickets();
  const rename = useRenameTicket(t.id);
  const [name, setName] = useState(t.holderName);
  const [editing, setEditing] = useState(false);
  const [nameFrom, setNameFrom] = useState(t.holderName);
  if (nameFrom !== t.holderName) {
    setNameFrom(t.holderName);
    setName(t.holderName);
  }

  // "2 of 3" across the booking, same order as the site
  const siblings = tickets.filter((x) => x.bookingId === t.bookingId && x.status !== "void");
  const index = siblings.findIndex((x) => x.id === t.id);
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  async function share() {
    try {
      const uri = await ensurePng(t, false);
      if (!uri) return Alert.alert("Not saved yet", "Connect once so the ticket image can be saved, then share it.");
      if (!(await Sharing.isAvailableAsync())) return Alert.alert("Sharing isn't available on this phone");
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: `${t.holderName}'s ticket · ${t.event.title}` });
    } catch {}
  }

  async function saveName() {
    const clean = name.replace(/\s+/g, " ").trim();
    if (clean.length < 1 || clean.length > 60) return Alert.alert("Names must be 1 to 60 characters");
    try {
      await rename.mutateAsync(clean);
      setEditing(false);
    } catch (e) {
      Alert.alert("Couldn't save the name", e instanceof Error ? e.message : undefined);
    }
  }

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: siblings.length > 1 ? `Ticket ${index + 1} of ${siblings.length}` : "Your ticket" }} />

      <View style={{ gap: 2 }}>
        <Text variant="title">{t.event.title}</Text>
        <Text variant="caption" muted>{fmtDate(t.event.startsAt, "EEE, MMM d")} · {fmtTime(t.event.startsAt)} · {t.event.venueName}</Text>
      </View>

      {t.status === "void" && <Notice tone="danger" title="This ticket was voided">It won&apos;t scan at the door. Check your booking or message the organisers.</Notice>}
      {t.status === "used" && <Notice tone="success" title="Checked in">{t.checkedInAt ? `Scanned at the door ${fmtDateTime(t.checkedInAt)}.` : "Scanned at the door."}</Notice>}

      <TicketImage ticket={t} stamp />

      <Row gap={6} style={{ justifyContent: "center" }}>
        <ShieldCheck size={14} color={c.successForeground} />
        <Text variant="caption" muted>{offline ? "Saved on this phone · works without signal" : "Saved on this phone, so it opens offline too"}</Text>
      </Row>

      {siblings.length > 1 && (
        <Row style={{ justifyContent: "space-between" }}>
          <Pressable disabled={!prev} onPress={() => prev && router.replace(`/tickets/${prev.id}`)} accessibilityRole="button" accessibilityLabel="Previous ticket" hitSlop={10} style={[styles.nav, { borderColor: c.border, opacity: prev ? 1 : 0.3 }]}>
            <ChevronLeft size={20} color={c.foreground} />
          </Pressable>
          <Text variant="caption" muted>{next ? `Next: ${next.holderName}` : prev ? `Back: ${prev.holderName}` : ""}</Text>
          <Pressable disabled={!next} onPress={() => next && router.replace(`/tickets/${next.id}`)} accessibilityRole="button" accessibilityLabel="Next ticket" hitSlop={10} style={[styles.nav, { borderColor: c.border, opacity: next ? 1 : 0.3 }]}>
            <ChevronRight size={20} color={c.foreground} />
          </Pressable>
        </Row>
      )}

      <Card style={{ gap: space.md }}>
        <CopyRow label="Ticket code" value={t.shortCode} mono hint="The door can type this in if the QR won't scan." />
        <View style={{ gap: 2 }}>
          <Text variant="caption" muted>Tier</Text>
          <Text variant="label" style={{ fontSize: 15 }}>{t.tierName}</Text>
        </View>
        {editing ? (
          <View style={{ gap: space.sm }}>
            <Field label="Name on ticket" value={name} onChangeText={setName} maxLength={60} autoFocus autoCapitalize="words" returnKeyType="done" onSubmitEditing={saveName} />
            <Row>
              <Button title="Save" loading={rename.isPending} onPress={saveName} style={{ flex: 1 }} />
              <Button title="Cancel" variant="ghost" onPress={() => { setEditing(false); setName(t.holderName); }} style={{ flex: 1 }} />
            </Row>
          </View>
        ) : (
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ gap: 2, flex: 1 }}>
              <Text variant="caption" muted>Name on ticket</Text>
              <Text variant="label" style={{ fontSize: 15 }}>{t.holderName}</Text>
            </View>
            {t.status === "valid" && (
              <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Change the name on this ticket" hitSlop={10}>
                <Text variant="label" color={c.accentForeground}>Change</Text>
              </Pressable>
            )}
          </Row>
        )}
      </Card>

      {t.status !== "void" && (
        <Button title={siblings.length > 1 && index > 0 ? `Send ${t.holderName.split(" ")[0]} their ticket` : "Share ticket image"} variant="secondary" onPress={share} />
      )}
      <Button title="View booking" variant="ghost" onPress={() => router.push(`/bookings/${t.bookingId}`)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
