import { PERSONA_LABELS, type DemoPersonaKey } from "@bbc/shared/demo";
import { FlaskConical, ScanLine, Shield, UserRound, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { Card, Text } from "@/components/ui";
import { useDemo } from "@/lib/server-config";
import { useSession } from "@/lib/session";
import { radius, space, useTheme } from "@/theme";

const ICONS: Record<DemoPersonaKey, LucideIcon> = { member: UserRound, door: ScanLine, organiser: Shield };

/**
 * Demo site: one tap to be Mara, Jun or Bea. Renders nothing unless the server's
 * demo switch is on. `onDone` runs after a successful sign-in (e.g. close the modal).
 */
export function PersonaButtons({ title = "Demo: skip the email, sign in as", onDone }: { title?: string; onDone?: (persona: DemoPersonaKey) => void }) {
  const demo = useDemo();
  const { signInAsPersona } = useSession();
  const { c } = useTheme();
  const [busy, setBusy] = useState<DemoPersonaKey | null>(null);
  if (!demo) return null;

  async function become(key: DemoPersonaKey) {
    setBusy(key);
    try {
      await signInAsPersona(key);
      onDone?.(key);
    } catch (e) {
      Alert.alert("Couldn't sign in", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card style={{ gap: space.sm, borderStyle: "dashed" }}>
      <View style={styles.title}>
        <FlaskConical size={16} color={c.mutedForeground} />
        <Text variant="label" style={{ fontSize: 13 }}>{title}</Text>
      </View>
      {demo.personas.map((p) => {
        const Icon = ICONS[p.key];
        const current = demo.current === p.key;
        return (
          <Pressable
            key={p.key}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!busy, selected: current }}
            disabled={!!busy}
            onPress={() => become(p.key)}
            style={({ pressed }) => [styles.row, { borderColor: current ? c.primary : c.border, backgroundColor: c.background, opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.icon, { backgroundColor: c.surface2 }]}>
              {busy === p.key ? <ActivityIndicator size="small" color={c.foreground} /> : <Icon size={18} color={c.foreground} />}
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="label">{p.name} · {PERSONA_LABELS[p.key].label}{current ? " (you)" : ""}</Text>
              <Text variant="caption" muted>{p.blurb}</Text>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: "row", alignItems: "center", gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: 1, borderRadius: radius.md, padding: space.md },
  icon: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});
