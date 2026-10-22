import type { ScanSample } from "@bbc/shared/demo";
import { FlaskConical, QrCode, Type, WifiOff } from "lucide-react-native";
import { useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { Text } from "@/components/ui";
import { isSimulatedOffline, setSimulatedOffline, subscribeSimulatedOffline } from "@/lib/api";
import { useScanSamples } from "@/lib/demo";
import { useDemo } from "@/lib/server-config";
import { nightTheme, radius, space } from "@/theme";

const c = nightTheme.c;
const TONE: Record<ScanSample["kind"], string> = {
  valid: c.success,
  used: c.warning,
  "wrong-event": c.warning,
  forged: c.destructive,
  unknown: c.destructive,
};

/**
 * Demo door tools: feed the scanner a sample ticket (no second phone needed) and
 * pretend there's no signal, to show check-ins queueing and syncing.
 */
export function DoorDemoTools({ eventId, onText, onCode }: { eventId: string; onText: (text: string) => void; onCode: (code: string) => void }) {
  const demo = useDemo();
  const samples = useScanSamples(eventId);
  const offline = useSyncExternalStore(subscribeSimulatedOffline, isSimulatedOffline);
  if (!demo) return null;
  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <FlaskConical size={14} color={c.mutedForeground} />
        <Text theme={nightTheme} variant="label" muted style={{ fontSize: 12 }}>Demo: scan a sample</Text>
      </View>
      {(samples.data ?? []).map((s, i) => (
        <Pressable
          key={i}
          accessibilityRole="button"
          accessibilityLabel={`${s.label}, ${s.via === "qr" ? "as a QR scan" : "as a typed code"}`}
          onPress={() => (s.via === "qr" ? onText(s.text) : onCode(s.text))}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surface2 }]}
        >
          <View style={[styles.dot, { backgroundColor: TONE[s.kind] }]} />
          <Text theme={nightTheme} numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>{s.label}</Text>
          {s.via === "qr" ? <QrCode size={14} color={c.mutedForeground} /> : <Type size={14} color={c.mutedForeground} />}
        </Pressable>
      ))}
      <View style={[styles.row, { marginTop: 4 }]}>
        <WifiOff size={14} color={offline ? c.warning : c.mutedForeground} />
        <Text theme={nightTheme} style={{ flex: 1, fontSize: 13 }}>Pretend there&apos;s no signal</Text>
        <Switch value={offline} onValueChange={setSimulatedOffline} accessibilityLabel="Pretend there's no signal" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  row: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.sm, paddingHorizontal: space.xs },
  dot: { width: 8, height: 8, borderRadius: 999 },
});
