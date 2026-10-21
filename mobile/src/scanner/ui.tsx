import { Check, CircleSlash, Cloud, CloudOff, LogIn, RefreshCw, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui";
import { brand, fonts, nightTheme, radius, space } from "@/theme";
import type { Connection, ScanKind } from "./logic";
import { TITLES } from "./logic";
import type { Flash } from "./use-scanner";

const c = nightTheme.c;

/** The web's danger red (#b4321f): the night token is a pale coral that can't hold white text. */
export const DANGER = "#b4321f";

export type Flood = { bg: string; ink: string; tint: string; dot: string; Icon: LucideIcon; title: string };

const inkDark = { ink: brand.deepForest, tint: "rgba(11, 61, 46, 0.12)" };
const inkLight = { ink: "#ffffff", tint: "rgba(255, 255, 255, 0.15)" };

/** Full-screen floods, read from across a dark doorway. */
export const KIND: Record<ScanKind, Flood> = {
  ok: { bg: brand.lime, ...inkDark, dot: brand.lime, Icon: Check, title: TITLES.ok },
  duplicate: { bg: brand.sun, ...inkDark, dot: brand.star, Icon: TriangleAlert, title: TITLES.duplicate },
  stale: { bg: brand.skyDeep, ...inkLight, dot: brand.sky, Icon: RefreshCw, title: TITLES.stale },
  invalid: { bg: DANGER, ...inkLight, dot: c.destructive, Icon: ShieldAlert, title: TITLES.invalid },
  void: { bg: DANGER, ...inkLight, dot: c.destructive, Icon: CircleSlash, title: TITLES.void },
  "wrong-event": { bg: DANGER, ...inkLight, dot: c.destructive, Icon: ShieldAlert, title: TITLES["wrong-event"] },
};

const CONN: Record<Connection, { bg: string; fg: string; Icon: LucideIcon; label: string }> = {
  online: { bg: c.successSoft, fg: c.successForeground, Icon: Cloud, label: "Online" },
  offline: { bg: c.warningSoft, fg: c.warningForeground, Icon: CloudOff, label: "Offline · saving here" },
  auth: { bg: c.destructiveSoft, fg: c.destructive, Icon: LogIn, label: "Signed out" },
};

/** Connection state in a pill. On a result flood, pass `tint`/`ink` so it takes the flood's colours. */
export function ConnPill({ conn, tint, ink }: { conn: Connection; tint?: string; ink?: string }) {
  const cfg = CONN[conn];
  const fg = ink ?? cfg.fg;
  return (
    <View accessibilityRole="text" accessibilityLabel={cfg.label} style={[styles.pill, { backgroundColor: tint ?? cfg.bg }]}>
      <cfg.Icon size={14} color={fg} />
      <Text variant="label" color={fg} style={{ fontSize: 12 }}>{cfg.label}</Text>
    </View>
  );
}

/** The number, then its label. Three share a row, so large system text is capped here (the numbers stay glanceable). */
export function StatTile({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <View style={[styles.tile, { backgroundColor: warn ? c.warningSoft : c.card }]}>
      <Text theme={nightTheme} color={warn ? c.warningForeground : c.foreground} style={styles.tileValue} maxFontSizeMultiplier={1.4}>{value}</Text>
      <Text theme={nightTheme} color={warn ? c.warningForeground : c.mutedForeground} style={styles.tileLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.4}>{label.toUpperCase()}</Text>
    </View>
  );
}

/** Live-event dot with a ring that pulses outward. */
export function PulseDot({ color = brand.lime }: { color?: string }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ width: 10, height: 10 }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: 999, borderWidth: 2, borderColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }] },
        ]}
      />
      <View style={[StyleSheet.absoluteFill, { borderRadius: 999, backgroundColor: color }]} />
    </View>
  );
}

/** The scanner's short-lived messages (what sonner toasts do on the web). */
export function FlashBanners({ flashes }: { flashes: Flash[] }) {
  if (flashes.length === 0) return null;
  return (
    <View pointerEvents="none" style={styles.flashes}>
      {flashes.map((f) => {
        const bg = f.tone === "success" ? c.successSoft : f.tone === "warning" ? c.warningSoft : c.destructiveSoft;
        const fg = f.tone === "success" ? c.successForeground : f.tone === "warning" ? c.warningForeground : c.destructive;
        return (
          <View key={f.id} accessibilityLiveRegion="polite" style={[styles.flash, { backgroundColor: c.surface1, borderLeftColor: fg }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: bg, borderRadius: radius.md }]} />
            <Text theme={nightTheme} variant="label" color={c.foreground}>{f.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  tile: { flex: 1, minWidth: 0, borderRadius: 14, paddingHorizontal: space.md, paddingVertical: 10, gap: 2 },
  tileValue: { fontFamily: fonts.displayHeavy, fontSize: 26, lineHeight: 28, fontVariant: ["tabular-nums"] },
  tileLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.2 },
  flashes: { position: "absolute", left: space.lg, right: space.lg, bottom: space.xl, gap: space.sm, zIndex: 50 },
  flash: { borderRadius: radius.md, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12, overflow: "hidden" },
});
