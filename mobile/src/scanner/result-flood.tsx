import { RefreshCw, Undo2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, BackHandler, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import { brand, fonts, radius, space } from "@/theme";
import type { Connection, ScanResult } from "./logic";
import { ConnPill, KIND } from "./ui";

export type UndoState = "idle" | "armed" | "busy";

/**
 * A result, full screen in its colour, so the door can read it at arm's length.
 * Tapping anywhere moves on; it also auto-dismisses (the screen owns the timer).
 */
export function ResultFlood({
  r,
  title,
  conn,
  stats,
  hint,
  onClose,
  onRetry,
  refreshing,
  onUndo,
  undo,
}: {
  r: ScanResult;
  title: string;
  conn: Connection;
  stats: { checkedIn: number; total: number };
  hint?: string;
  onClose: () => void;
  onRetry?: () => void;
  refreshing: boolean;
  /** Present only when the earlier check-in can be reversed from here (online, already on the server). */
  onUndo?: () => void;
  undo: UndoState;
}) {
  const cfg = KIND[r.kind];
  const insets = useSafeAreaInsets();
  const [pop] = useState(() => new Animated.Value(0.6));

  useEffect(() => {
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start();
  }, [r.at, pop]);

  // Android back closes the result, not the scanner
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const long = r.kind !== "ok" && r.kind !== "invalid";
  const ink = cfg.ink;

  return (
    <Pressable
      onPress={onClose}
      accessibilityRole="alert"
      accessibilityLabel={`${cfg.title}${r.ticket ? `, ${r.ticket.holder}` : ""}`}
      accessibilityLiveRegion="assertive"
      style={[StyleSheet.absoluteFill, { backgroundColor: cfg.bg, paddingTop: insets.top, paddingBottom: insets.bottom, zIndex: 40 }]}
    >
      <View style={styles.top}>
        <Text color={ink} variant="label" numberOfLines={1} style={{ flex: 1, opacity: 0.9, fontSize: 12 }}>{title}</Text>
        <ConnPill conn={conn} tint={cfg.tint} ink={ink} />
      </View>

      <View style={styles.middle}>
        <Animated.View style={[styles.badge, { backgroundColor: cfg.tint, transform: [{ scale: pop }] }]}>
          <cfg.Icon size={92} color={ink} strokeWidth={r.kind === "ok" ? 2.6 : 2.2} />
        </Animated.View>
        <Text color={ink} style={[styles.title, { fontSize: long ? 40 : 44, lineHeight: long ? 44 : 48 }]} maxFontSizeMultiplier={1.3}>{cfg.title}</Text>
        {r.ticket && <Text color={ink} style={styles.holder}>{r.ticket.holder}</Text>}
        {r.ticket && (
          <Text color={ink} style={{ fontSize: 16, opacity: 0.9, textAlign: "center" }}>
            {r.ticket.tier} · <Text color={ink} style={{ fontFamily: fonts.mono, letterSpacing: 1 }}>{r.ticket.code}</Text>
          </Text>
        )}
        {r.detail &&
          (r.kind === "duplicate" ? (
            <View style={[styles.note, { backgroundColor: cfg.tint }]}>
              <Text color={ink} style={styles.noteText}>{r.detail}. Ask to see the ticket holder&apos;s name.</Text>
            </View>
          ) : (
            <Text color={ink} style={{ fontSize: 16, lineHeight: 23, maxWidth: 300, textAlign: "center", opacity: 0.95 }}>{r.detail}</Text>
          ))}
        {hint && (
          <View style={[styles.note, { backgroundColor: cfg.tint }]}>
            <Text color={ink} style={styles.noteText}>{hint}</Text>
          </View>
        )}
        {r.kind === "ok" && <Text color={ink} variant="label" style={{ marginTop: 10, opacity: 0.9 }}>{stats.checkedIn} of {stats.total} in</Text>}
      </View>

      <View style={styles.bottom}>
        {r.kind === "stale" ? (
          <View style={{ gap: space.sm }}>
            {onRetry && (
              <Pressable accessibilityRole="button" disabled={refreshing} onPress={onRetry} style={[styles.action, { backgroundColor: "#ffffff", opacity: refreshing ? 0.7 : 1 }]}>
                {refreshing ? <ActivityIndicator color={brand.skyDeep} /> : <RefreshCw size={18} color={brand.skyDeep} strokeWidth={2.4} />}
                <Text color={brand.skyDeep} variant="label" style={{ fontSize: 15 }}>Refresh list and retry</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" onPress={onClose} style={[styles.action, { backgroundColor: cfg.tint, minHeight: 44 }]}>
              <Text color={ink} variant="label">Continue without checking in</Text>
            </Pressable>
          </View>
        ) : r.kind === "duplicate" ? (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Pressable accessibilityRole="button" onPress={onClose} style={[styles.action, { flex: 1, backgroundColor: cfg.tint }]}>
              <Text color={ink} variant="label">Continue</Text>
            </Pressable>
            {onUndo && (
              <Pressable accessibilityRole="button" disabled={undo === "busy"} onPress={onUndo} style={[styles.action, { backgroundColor: brand.deepForest, opacity: undo === "busy" ? 0.8 : 1 }]}>
                {undo === "busy" ? <ActivityIndicator color={brand.sun} /> : <Undo2 size={16} color={brand.sun} />}
                <Text color={brand.sun} variant="label">{undo === "armed" ? "Tap again to undo" : undo === "busy" ? "Undoing…" : "Undo that check-in"}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={onClose} style={[styles.action, { backgroundColor: cfg.tint }]}>
            <Text color={ink} variant="label">Tap anywhere to continue</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: 20, paddingVertical: space.lg },
  middle: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 28, paddingVertical: space.lg },
  badge: { width: 150, height: 150, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displayHeavy, letterSpacing: -0.8, textAlign: "center" },
  holder: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.4, textAlign: "center" },
  note: { marginTop: 6, maxWidth: 300, borderRadius: 14, paddingHorizontal: space.lg, paddingVertical: space.md },
  noteText: { fontSize: 14, lineHeight: 19, textAlign: "center" },
  bottom: { paddingHorizontal: 20, paddingBottom: 28 },
  action: { minHeight: 52, borderRadius: radius.pill, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
});
