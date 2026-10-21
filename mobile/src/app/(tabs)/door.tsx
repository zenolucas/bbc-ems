import type { DoorEventDTO } from "@bbc/shared/api-types";
import { fmtDateTime, relative } from "@bbc/shared/format";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Check, ChevronRight, CloudOff, CloudUpload, Download, Info, ScanLine } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import { EmptyState, Loading, Screen, SignInPrompt, Text } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { syncAllQueues, updateBackgroundSync } from "@/scanner/background-sync";
import { store } from "@/scanner/store";
import { PulseDot } from "@/scanner/ui";
import { brand, fonts, nightTheme, radius, space } from "@/theme";

const c = nightTheme.c;

type Local = ReturnType<typeof store.summary>;

/**
 * "Which door are you on?" Door crew pick an event while they still have
 * signal; its guest list downloads to the phone so scanning survives the Wi-Fi
 * dying. The list itself is cached too, so this tab opens offline.
 */
export default function DoorTab() {
  const { status, isStaff, isAdmin } = useSession();
  const [local, setLocal] = useState<Record<string, Local>>({});
  const [onPhone, setOnPhone] = useState<ReturnType<typeof store.events>>([]);
  const [backgroundOn, setBackgroundOn] = useState(false);

  const q = useQuery({
    queryKey: ["door-events"],
    enabled: isStaff,
    queryFn: async () => {
      const events = await api<DoorEventDTO[]>("/api/v1/scan/events");
      store.doorEvents.set(events);
      return events;
    },
  });

  const cached = useMemo(() => (q.data ? null : store.doorEvents.get()), [q.data]);
  const rows = q.data ?? cached?.events ?? [];
  const offline = !q.data && q.error instanceof ApiError && q.error.offline;

  const readPhone = useCallback(() => {
    const all = store.events();
    setOnPhone(all);
    setLocal(Object.fromEntries(all.map((e) => [e.eventId, { listAt: e.listAt, queued: e.queued }])));
    return all;
  }, []);

  /** Sends scans left waiting by an earlier door session, then re-reads. The background task covers the rest. */
  const flushQueues = useCallback(async () => {
    if (store.queuedTotal() > 0) {
      await syncAllQueues();
      readPhone();
    }
    setBackgroundOn(await updateBackgroundSync());
  }, [readPhone]);

  // Re-read what this phone holds whenever the tab comes back (after a door session), and on return to the app
  useFocusEffect(
    useCallback(() => {
      if (!isStaff) return;
      readPhone();
      void flushQueues();
      void q.refetch();
      const sub = AppState.addEventListener("change", (s) => {
        if (s === "active") void flushQueues();
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isStaff, readPhone, flushQueues]),
  );
  const waiting = onPhone.reduce((n, e) => n + e.queued, 0);

  if (status === "signedOut") {
    return (
      <Screen theme={nightTheme} scroll={false}>
        <StatusBar style="light" />
        <SignInPrompt title="Door crew sign in here">Organisers add door volunteers by email on the Team page. Sign in with that email to scan tickets.</SignInPrompt>
      </Screen>
    );
  }
  if (!isStaff) {
    return (
      <Screen theme={nightTheme} scroll={false}>
        <StatusBar style="light" />
        <EmptyState title="Door crew only">If you&apos;re helping at the door, ask an organiser to add you on the Team page, then come back here.</EmptyState>
      </Screen>
    );
  }

  // Doors that are open get the big card; with none open, the next event does.
  const open = rows.filter((e) => e.live && !e.ended);
  const featured = open.length ? open : rows.filter((e) => !e.live).slice(0, 1);
  const rest = rows.filter((e) => !featured.includes(e));
  const listed = new Set(rows.map((e) => e.id));
  const orphans = onPhone.filter((e) => !listed.has(e.eventId));
  const go = (id: string, title: string) => router.push({ pathname: "/door/[eventId]", params: { eventId: id, title } });

  return (
    <Screen theme={nightTheme} refreshing={q.isRefetching} onRefresh={() => void q.refetch()} contentStyle={{ gap: 14 }}>
      <StatusBar style="light" />
      <View style={{ gap: space.sm }}>
        <Text theme={nightTheme} style={styles.h1}>Which door are you on?</Text>
        <Text theme={nightTheme} variant="caption" muted style={{ fontSize: 13, lineHeight: 19 }}>
          Open the event while you still have signal. The guest list downloads to this phone, so scanning keeps working when the Wi-Fi dies.
        </Text>
      </View>

      {offline && (
        <View style={[styles.banner, { borderLeftColor: c.warning }]}>
          <CloudOff size={16} color={c.warningForeground} />
          <Text theme={nightTheme} variant="caption" muted style={{ flex: 1 }}>
            No signal.{cached ? ` Showing the list from ${relative(new Date(cached.at))}.` : ""} Events with a guest list on this phone still scan offline.
          </Text>
        </View>
      )}

      {waiting > 0 && (
        <View style={[styles.banner, { borderLeftColor: c.warning }]}>
          <CloudUpload size={16} color={c.warningForeground} />
          <Text theme={nightTheme} variant="caption" muted style={{ flex: 1 }}>
            <Text theme={nightTheme} variant="caption" style={{ fontFamily: fonts.bodySemi }}>{waiting} scan{waiting === 1 ? "" : "s"} waiting to sync.</Text>{" "}
            {backgroundOn
              ? "Waiting scans send in the background once you have signal (Android checks about every 15 minutes), or straight away when you open the event."
              : "Open the event with signal to send them."}
          </Text>
        </View>
      )}

      {q.isPending && !cached ? (
        <View style={{ height: 200 }}><Loading /></View>
      ) : rows.length === 0 && orphans.length === 0 ? (
        q.error && !offline ? (
          <EmptyState title="Couldn't load events">{q.error instanceof Error ? q.error.message : "Try again."}</EmptyState>
        ) : (
          <EmptyState title="No events to scan right now">Events show up here once they&apos;re published.</EmptyState>
        )
      ) : (
        <>
          {featured.map((e) => <FeaturedEvent key={e.id} e={e} local={local[e.id]} onPress={() => go(e.id, e.title)} />)}
          {rest.map((e) => <EventRow key={e.id} e={e} local={local[e.id]} onPress={() => go(e.id, e.title)} />)}
        </>
      )}

      {orphans.length > 0 && (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Text theme={nightTheme} variant="label" muted style={{ fontSize: 12 }}>On this phone</Text>
          {orphans.map((e) => (
            <Pressable key={e.eventId} accessibilityRole="button" onPress={() => go(e.eventId, e.title)} style={styles.row}>
              <View style={styles.rowIcon}><Download size={20} color={c.mutedForeground} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text theme={nightTheme} style={styles.rowTitle} numberOfLines={2}>{e.title}</Text>
                <DeviceStatus local={e} variant="card" />
              </View>
              <ChevronRight size={18} color={c.mutedForeground} />
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.info}>
        <Info size={18} color={c.info} style={{ marginTop: 1 }} />
        <Text theme={nightTheme} variant="caption" muted style={{ flex: 1, lineHeight: 18 }}>
          <Text theme={nightTheme} variant="caption" style={{ fontFamily: fonts.bodySemi }}>Events show up here once they&apos;re published</Text> and stay for a day after they end so late scans can sync.
          {isAdmin ? " Need the attendee list instead? It's under Organiser tools." : ""}
        </Text>
      </View>
    </Screen>
  );
}

/** What this phone holds for an event: the guest list, and scans waiting to sync. */
function DeviceStatus({ local, ended, variant }: { local?: Local; ended?: boolean; variant: "card" | "inline" }) {
  if (local && local.queued > 0) {
    return <Text theme={nightTheme} variant="caption" color={c.warningForeground} style={{ fontFamily: fonts.bodySemi }}>{local.queued} scan{local.queued === 1 ? "" : "s"} waiting to sync</Text>;
  }
  const at = local?.listAt ?? null;
  if (variant === "inline") return <Text theme={nightTheme} variant="caption" muted>{!at ? "list not downloaded yet" : ended ? "all scans synced" : "list on this phone"}</Text>;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
      <Download size={14} color={c.mutedForeground} />
      <Text theme={nightTheme} variant="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>{at ? `List on this phone · updated ${relative(at)}` : "List not downloaded yet"}</Text>
    </View>
  );
}

function FeaturedEvent({ e, local, onPress }: { e: DoorEventDTO; local?: Local; onPress: () => void }) {
  const pct = e.total ? Math.round((e.used / e.total) * 100) : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Scan ${e.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.featured, { borderColor: e.live ? c.primary : c.border, opacity: pressed ? 0.9 : 1 }, e.live && styles.liveGlow]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {e.live ? <PulseDot /> : <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: brand.star }} />}
        <Text theme={nightTheme} variant="label" color={e.live ? c.successForeground : c.warningForeground} style={{ fontSize: 12, fontFamily: fonts.bodyBold }}>
          {e.live ? `Doors open · started ${relative(e.startsAt)}` : `Next up · doors ${relative(e.startsAt)}`}
        </Text>
      </View>
      <View>
        <Text theme={nightTheme} style={styles.featuredTitle}>{e.title}</Text>
        <Text theme={nightTheme} variant="caption" muted style={{ fontSize: 13, marginTop: 4 }}>{e.live ? e.venue : `${fmtDateTime(e.startsAt)} · ${e.venue}`}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={styles.meter} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} accessibilityLabel="Checked in">
          <View style={{ width: `${pct}%`, height: "100%", borderRadius: 999, backgroundColor: c.primary }} />
        </View>
        <Text theme={nightTheme} style={{ fontFamily: fonts.displayHeavy, fontSize: 16, fontVariant: ["tabular-nums"] }}>
          {e.used}
          <Text theme={nightTheme} variant="caption" muted style={{ fontFamily: fonts.bodySemi }}> / {e.total} in</Text>
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}><DeviceStatus local={local} variant="card" /></View>
        <View style={styles.scanBtn}>
          <ScanLine size={16} color={c.primaryForeground} />
          <Text theme={nightTheme} variant="label" color={c.primaryForeground}>Scan</Text>
        </View>
      </View>
    </Pressable>
  );
}

function EventRow({ e, local, onPress }: { e: DoorEventDTO; local?: Local; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Scan ${e.title}`} onPress={onPress} style={({ pressed }) => [styles.row, e.ended && { opacity: 0.7 }, pressed && { backgroundColor: c.surface2 }]}>
      <View style={styles.rowIcon}>{e.ended ? <Check size={20} color={c.successForeground} strokeWidth={2.4} /> : <ScanLine size={22} color={c.mutedForeground} />}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text theme={nightTheme} style={styles.rowTitle} numberOfLines={2}>{e.title}</Text>
        {e.ended ? (
          <Text theme={nightTheme} variant="caption" muted>
            Ended {relative(e.endsAt)} · {e.used} / {e.total} in · <DeviceStatus local={local} ended variant="inline" />
          </Text>
        ) : (
          <>
            <Text theme={nightTheme} variant="caption" muted>
              {e.live ? <Text theme={nightTheme} variant="caption" color={c.successForeground} style={{ fontFamily: fonts.bodySemi }}>Doors open · started {relative(e.startsAt)}</Text> : fmtDateTime(e.startsAt)} · {e.venue}
            </Text>
            <Text theme={nightTheme} variant="caption" muted>
              {e.total} ticket{e.total === 1 ? "" : "s"} · <DeviceStatus local={local} variant="inline" />
            </Text>
          </>
        )}
      </View>
      <ChevronRight size={18} color={c.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.displayHeavy, fontSize: 28, lineHeight: 30, letterSpacing: -0.5 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderLeftWidth: 4, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 10 },
  featured: { gap: space.md, borderRadius: 22, borderWidth: 1, backgroundColor: c.card, padding: space.lg },
  liveGlow: { boxShadow: "0 0 0 4px rgba(140, 198, 62, 0.12)" },
  featuredTitle: { fontFamily: fonts.displayHeavy, fontSize: 22, lineHeight: 24, letterSpacing: -0.4 },
  meter: { flex: 1, height: 6, borderRadius: 999, backgroundColor: c.surface2, overflow: "hidden" },
  scanBtn: { height: 44, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.pill, backgroundColor: c.primary, paddingHorizontal: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: space.lg, paddingVertical: 14 },
  rowIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.display, fontSize: 16, lineHeight: 20, letterSpacing: -0.2 },
  info: { flexDirection: "row", alignItems: "flex-start", gap: space.md, borderRadius: 16, backgroundColor: c.surface2, padding: 14, marginTop: space.sm },
});
