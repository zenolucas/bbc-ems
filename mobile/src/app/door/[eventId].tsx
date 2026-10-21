import { Stack, router, useLocalSearchParams, useNavigation, usePreventRemove } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft, Keyboard, ListChecks, LogIn, RefreshCw, ScanLine, Volume2, VolumeX, type LucideIcon } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type TextInputInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmtTime } from "@bbc/shared/format";
import { Button, EmptyState, Loading, Screen, Text } from "@/components/ui";
import { useSession } from "@/lib/session";
import { CameraPanel } from "@/scanner/camera-panel";
import { CodePanel } from "@/scanner/code-panel";
import { GuestList } from "@/scanner/guest-list";
import { dismissAfterMs, type ScanKind, type ScanResult } from "@/scanner/logic";
import { ResultFlood, type UndoState } from "@/scanner/result-flood";
import { store } from "@/scanner/store";
import { ConnPill, FlashBanners, KIND, StatTile } from "@/scanner/ui";
import { useScanner } from "@/scanner/use-scanner";
import { fonts, nightTheme, radius, space } from "@/theme";

const c = nightTheme.c;

type Tab = "scan" | "code" | "list";
const TABS: { value: Tab; label: string; Icon: LucideIcon }[] = [
  { value: "scan", label: "Camera", Icon: ScanLine },
  { value: "code", label: "Type code", Icon: Keyboard },
  { value: "list", label: "Guest list", Icon: ListChecks },
];

/**
 * Door mode. Always Starlit Night, full screen, screen kept awake. Members who
 * aren't door crew never get here; a volunteer whose session lapses mid-shift
 * keeps scanning (check-ins wait on the phone), like the web scanner.
 */
export default function DoorScreen() {
  const { eventId, title: titleParam } = useLocalSearchParams<{ eventId: string; title?: string }>();
  const { status, me, isStaff } = useSession();
  const hasLocalList = useMemo(() => !!store.manifest.get(eventId), [eventId]);

  if (status === "signedIn" && !me) return <Screen theme={nightTheme} scroll={false}><Loading /></Screen>;
  const allowed = isStaff || (status === "signedOut" && hasLocalList);
  if (!allowed) {
    return (
      <Screen theme={nightTheme} scroll={false} edges={["top", "bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        <EmptyState
          title="Door crew only"
          action={
            status === "signedOut" ? (
              <Button theme={nightTheme} title="Sign in" onPress={() => router.push("/sign-in")} />
            ) : (
              <Button theme={nightTheme} title="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
            )
          }
        >
          {status === "signedOut"
            ? "Sign in with the email an organiser invited to scan tickets."
            : "The scanner is for door volunteers and organisers. If you're helping at the door tonight, ask an organiser to add you on the Team page."}
        </EmptyState>
      </Screen>
    );
  }
  return <Door eventId={eventId} titleParam={titleParam} />;
}

function Door({ eventId, titleParam }: { eventId: string; titleParam?: string }) {
  useKeepAwake();
  const s = useScanner(eventId);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [tab, setTab] = useState<Tab>("scan");
  const [clearing, setClearing] = useState(false);
  // Undo belongs to one result; keyed by its timestamp so a new scan starts clean
  const [undo, setUndo] = useState<{ at: number; state: UndoState } | null>(null);
  const codeRef = useRef<TextInputInstance>(null);
  const title = s.manifest?.title ?? titleParam ?? "Scanner";
  const last = s.last;
  const undoState: UndoState = last && undo?.at === last.at ? undo.state : "idle";

  // Auto-dismiss: quick for green, longer for anything the door needs to read. The undo round trip holds it.
  useEffect(() => {
    if (!last || undoState === "busy") return;
    const t = setTimeout(s.dismiss, dismissAfterMs(last.kind));
    return () => clearTimeout(t);
  }, [last, s.dismiss, undoState]);

  // Back to the code box after a typed check-in (CodePanel drops the keyboard on submit so it can't hide the result)
  useEffect(() => {
    if (!last && tab === "code") codeRef.current?.focus();
  }, [last, tab]);

  // Scans waiting to sync stay on the phone, but they only sync from here: say so before leaving.
  usePreventRemove(s.queueLen > 0, ({ data }) => {
    Alert.alert(
      `${s.queueLen} check-in${s.queueLen === 1 ? "" : "s"} not synced yet`,
      "They're saved on this phone and sync the next time you open this door with signal.",
      [
        { text: "Stay", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => navigation.dispatch(data.action) },
      ],
    );
  });

  const { undo: undoCheckin } = s;
  /** Two taps: the first arms it, the second reverses the earlier check-in on the server. */
  const undoLast = useCallback(
    async (r: ScanResult) => {
      if (!r.ticket) return;
      if (undoState === "idle") return setUndo({ at: r.at, state: "armed" });
      if (undoState !== "armed") return;
      setUndo({ at: r.at, state: "busy" });
      const ok = await undoCheckin(r.ticket.id, r.ticket.holder);
      if (!ok) setUndo({ at: r.at, state: "idle" });
    },
    [undoState, undoCheckin],
  );

  const age = s.manifestAgeMinutes;
  const stale = age !== null && age >= 5;
  // Undo only reverses a check-in the server already holds; one still queued here would just re-apply on sync
  const canUndo = !!last?.ticket && last.kind === "duplicate" && s.conn === "online" && !s.localUsed[last.ticket.id];
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/door"));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: !last }} />
      <StatusBar style={last && (last.kind === "ok" || last.kind === "duplicate") ? "dark" : "light"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.lg, gap: 10 }}
        >
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Leave scanner" onPress={leave} style={styles.iconBtn} hitSlop={6}>
              <ChevronLeft size={22} color={c.foreground} strokeWidth={2.2} />
            </Pressable>
            <Text theme={nightTheme} numberOfLines={1} style={{ flex: 1, fontFamily: fonts.display, fontSize: 16 }}>{title}</Text>
            <ConnPill conn={s.conn} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={s.muted ? "Turn sound on" : "Mute sounds"}
              accessibilityState={{ selected: s.muted }}
              onPress={s.toggleMute}
              style={styles.iconBtn}
            >
              {s.muted ? <VolumeX size={20} color={c.mutedForeground} /> : <Volume2 size={20} color={c.mutedForeground} />}
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: space.sm }}>
            <StatTile label="Checked in" value={s.stats.checkedIn} />
            <StatTile label="Tickets" value={s.stats.total} />
            <StatTile label="To sync" value={s.queueLen} warn={s.queueLen > 0} />
          </View>
          <View style={styles.ageRow}>
            <Text theme={nightTheme} variant="caption" color={stale ? c.warningForeground : c.mutedForeground} style={stale && { fontFamily: fonts.bodySemi }}>
              {s.manifest ? `Ticket list ${age === 0 ? "just updated" : `updated ${age} min ago`}` : s.ready ? "Ticket list not downloaded yet" : "Loading ticket list…"}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => void s.refreshAll()} disabled={s.refreshing || s.syncing} style={styles.refresh} hitSlop={6}>
              {s.refreshing || s.syncing ? <ActivityIndicator size="small" color={c.mutedForeground} /> : <RefreshCw size={14} color={c.mutedForeground} />}
              <Text theme={nightTheme} variant="label" muted style={{ fontSize: 12 }}>Refresh</Text>
            </Pressable>
          </View>

          {s.conn === "offline" && s.manifest && (
            <View style={[styles.banner, { borderLeftColor: c.warning }]}>
              <Text theme={nightTheme} variant="caption" muted>
                <Text theme={nightTheme} variant="caption" style={{ fontFamily: fonts.bodySemi }}>No signal.</Text> Keep scanning;{" "}
                {s.queueLen > 0 ? `${s.queueLen} check-in${s.queueLen === 1 ? " is" : "s are"} saved on this phone and will sync` : "check-ins are saved on this phone and sync"} when you&apos;re back online.
              </Text>
            </View>
          )}
          {s.conn === "auth" && (
            <DoorNotice tone="danger" title="You're signed out on this phone" action={<Button theme={nightTheme} title="Sign in again" icon={<LogIn size={16} color={c.primaryForeground} />} onPress={() => router.push("/sign-in")} />}>
              Keep scanning; check-ins are saved here and sync after you sign in. If you were just removed from the team, ask an organiser.
            </DoorNotice>
          )}
          {s.ready && !s.manifest && s.conn === "offline" && (
            <DoorNotice tone="danger" title="No ticket list on this phone">Get signal once (Wi-Fi or data) so the list can download. After that, scanning works offline.</DoorNotice>
          )}
          {s.manifest?.status === "cancelled" && <DoorNotice tone="danger" title="This event was cancelled">All its tickets are voided.</DoorNotice>}
          {s.notes.length > 0 && (
            <DoorNotice tone="warning" title="Heads up from other devices" action={<Button theme={nightTheme} title="Dismiss" variant="ghost" onPress={s.clearNotes} />}>
              {s.notes.slice(0, 3).map((n) => `• ${n}`).join("\n")}
            </DoorNotice>
          )}
          {s.ended && s.queueLen === 0 && s.manifest && (
            <DoorNotice tone="success" title="All scans synced">
              The event is over and every check-in reached the server. You can leave, or clear the guest list from this phone below.
            </DoorNotice>
          )}

          <View style={styles.segmented} accessibilityRole="tablist">
            {TABS.map((t) => {
              const on = tab === t.value;
              return (
                <Pressable
                  key={t.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => setTab(t.value)}
                  style={[styles.segment, on && { backgroundColor: c.surface2 }]}
                >
                  <t.Icon size={16} color={on ? c.foreground : c.mutedForeground} />
                  {/* Three segments share a row: shrink the label to fit rather than wrap or clip at large text sizes */}
                  <Text theme={nightTheme} variant="label" color={on ? c.foreground : c.mutedForeground} style={{ fontSize: 13, flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.5}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {tab === "scan" && <CameraPanel onText={(t) => void s.handleText(t)} paused={!!last} />}
          {tab === "code" && <CodePanel ref={codeRef} onSubmit={s.handleCode} />}
          {tab === "list" && <GuestList manifest={s.manifest} localUsed={s.localUsed} onCheckin={s.handleCode} />}

          {s.recent.length > 0 && (
            <View style={styles.recent}>
              <Text theme={nightTheme} variant="label" muted style={{ fontSize: 12, marginBottom: 4 }}>Recent on this phone</Text>
              {s.recent.map((r, i) => {
                const kind = KIND[r.kind as ScanKind];
                const code = r.code?.replace(/^BBC-/, "");
                const lead = r.kind === "ok" ? r.holder : kind?.title ?? r.kind;
                const rest = (r.kind === "ok" ? [r.tier, code] : [r.holder, code]).filter(Boolean).join(" · ");
                return (
                  <View key={`${r.at}-${i}`} style={styles.recentRow}>
                    <View style={[styles.dot, { backgroundColor: kind?.dot ?? c.mutedForeground }]} />
                    <Text theme={nightTheme} numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>
                      {lead ?? kind?.title}
                      {rest ? <Text theme={nightTheme} muted style={{ fontSize: 13 }}> · {rest}</Text> : null}
                    </Text>
                    <Text theme={nightTheme} variant="caption" muted style={{ fontVariant: ["tabular-nums"] }}>{fmtTime(new Date(r.at))}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.footer}>
            {clearing ? (
              <>
                <Text theme={nightTheme} variant="caption" style={{ flex: 1 }}>Clear the guest list from this phone? It downloads again next time you open the scanner.</Text>
                <Pressable accessibilityRole="button" onPress={() => setClearing(false)} style={styles.footBtn}>
                  <Text theme={nightTheme} variant="label" muted style={{ fontSize: 12 }}>Keep it</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => { s.clearDevice(); setClearing(false); }} style={[styles.footBtn, { backgroundColor: c.destructiveSoft }]}>
                  <Text theme={nightTheme} variant="label" color={c.destructive} style={{ fontSize: 12 }}>Clear</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text theme={nightTheme} variant="caption" muted style={{ flex: 1, fontSize: 11 }}>Guest names and codes stay on this phone for offline use.</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint={s.queueLen > 0 ? "Sync the waiting check-ins first" : undefined}
                  disabled={s.queueLen > 0}
                  onPress={() => setClearing(true)}
                  style={[styles.footBtn, s.queueLen > 0 && { opacity: 0.5 }]}
                >
                  <Text theme={nightTheme} variant="label" muted style={{ fontSize: 12 }}>Clear</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {last && (
        <ResultFlood
          r={last}
          title={title}
          conn={s.conn}
          stats={s.stats}
          hint={last.kind === "invalid" && tab === "scan" && s.manifest ? "Ask them to open My tickets in the app or on the site. A real one has a BBC-XXXX-XXXX code you can type in." : undefined}
          onClose={s.dismiss}
          onRetry={last.raw ? () => void s.retryStale(last.raw!) : undefined}
          refreshing={s.refreshing}
          onUndo={canUndo ? () => void undoLast(last) : undefined}
          undo={undoState}
        />
      )}
      <FlashBanners flashes={s.flashes} />
    </View>
  );
}

function DoorNotice({ title, children, tone, action }: { title: string; children: React.ReactNode; tone: "danger" | "warning" | "success"; action?: React.ReactNode }) {
  const bg = tone === "danger" ? c.destructiveSoft : tone === "warning" ? c.warningSoft : c.successSoft;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityLiveRegion="polite">
      <Text theme={nightTheme} variant="label">{title}</Text>
      {typeof children === "string" ? <Text theme={nightTheme} variant="caption" muted>{children}</Text> : children}
      {action && <View style={{ alignSelf: "flex-start", marginTop: 6 }}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: -8 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  ageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  refresh: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6 },
  banner: { borderRadius: 14, borderLeftWidth: 4, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 10 },
  notice: { borderRadius: radius.md, padding: space.md, gap: 4 },
  segmented: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 14, backgroundColor: c.card },
  segment: { flex: 1, minHeight: 44, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  recent: { borderRadius: 16, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 10 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 999 },
  footer: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: space.sm, paddingLeft: 4 },
  footBtn: { minHeight: 44, borderRadius: radius.pill, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
});
