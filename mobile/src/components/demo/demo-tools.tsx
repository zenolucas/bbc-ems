import { router, type Href } from "expo-router";
import { ChevronRight, Inbox, RotateCcw, Timer } from "lucide-react-native";
import { Alert, Pressable, Switch, View } from "react-native";
import { Button, Card, Row, Text } from "@/components/ui";
import { useDemoSettings, useResetDemo, useRunCron } from "@/lib/demo";
import { useDemo } from "@/lib/server-config";
import { useSession } from "@/lib/session";
import { space, useTheme } from "@/theme";
import { PersonaButtons } from "./persona-buttons";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Profile's demo section: switch persona, and for the organiser persona the demo switches. */
export function DemoTools() {
  const demo = useDemo();
  const { isAdmin } = useSession();
  const settings = useDemoSettings();
  const cron = useRunCron();
  const reset = useResetDemo();
  const { c } = useTheme();
  if (!demo) return null;

  const fail = (title: string) => (e: unknown) => Alert.alert(title, e instanceof Error ? e.message : "Try again.");

  return (
    <View style={{ gap: space.md }}>
      <PersonaButtons title="Demo: switch persona" />
      {isAdmin && (
        <Card style={{ gap: space.md }}>
          <Text variant="label">Demo switches</Text>
          <Row gap={space.md}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" style={{ fontSize: 14 }}>Auto-approve payments</Text>
              <Text variant="caption" muted>Confirm bookings the moment a receipt is sent. Off to walk through the review queue.</Text>
            </View>
            <Switch
              value={demo.autoApprove}
              disabled={settings.isPending}
              onValueChange={(v) => settings.mutate({ autoApprove: v }, { onError: fail("Couldn't change it") })}
              accessibilityLabel="Auto-approve payments"
            />
          </Row>
          <Button
            title="Run the cron now"
            variant="secondary"
            icon={<Timer size={18} color={c.foreground} />}
            loading={cron.isPending}
            onPress={() =>
              cron.mutate(undefined, {
                onSuccess: (r) => Alert.alert("Cron ran", `Expired ${plural(r.expired, "hold")}, sent ${plural(r.reminded, "reminder")}, told ${plural(r.waitlisted, "person", "people")} on waitlists.`),
                onError: fail("Cron failed"),
              })
            }
          />
          <Button
            title="Reset demo data"
            variant="destructive"
            icon={<RotateCcw size={18} color={c.destructive} />}
            loading={reset.isPending}
            onPress={() =>
              Alert.alert("Reset the demo data?", "Every booking, check-in and new event made on the demo site is wiped. Mara, Jun and Bea stay signed in.", [
                { text: "Cancel", style: "cancel" },
                { text: "Reset", style: "destructive", onPress: () => reset.mutate(undefined, { onError: fail("Reset failed") }) },
              ])
            }
          />
          <Pressable accessibilityRole="button" onPress={() => router.push(`/organiser?next=${encodeURIComponent("/admin/demo")}` as Href)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Row gap={space.md}>
              <Inbox color={c.primary} size={20} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label" style={{ fontSize: 14 }}>Outbox and more</Text>
                <Text variant="caption" muted>The emails and pushes the demo sent, and the demo mode switch</Text>
              </View>
              <ChevronRight color={c.mutedForeground} size={20} />
            </Row>
          </Pressable>
        </Card>
      )}
    </View>
  );
}
