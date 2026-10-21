import { Hourglass } from "lucide-react-native";
import { Alert, View } from "react-native";
import { Button, Card, Text } from "@/components/ui";
import { useExpireHold } from "@/lib/demo";
import { useDemo } from "@/lib/server-config";
import { space, useTheme } from "@/theme";

/** Demo: let this unpaid hold lapse now, to show expiry and the waitlist email without waiting hours. */
export function ExpireHold({ bookingId }: { bookingId: string }) {
  const demo = useDemo();
  const expire = useExpireHold(bookingId);
  const { c } = useTheme();
  if (!demo) return null;
  return (
    <Card style={{ gap: space.sm, borderStyle: "dashed" }}>
      <View style={{ gap: 2 }}>
        <Text variant="label" style={{ fontSize: 13 }}>Demo: skip the wait</Text>
        <Text variant="caption" muted>Let this hold lapse now. Anyone on the waitlist hears about the free seats.</Text>
      </View>
      <Button
        title="Expire hold now"
        variant="secondary"
        icon={<Hourglass size={18} color={c.foreground} />}
        loading={expire.isPending}
        onPress={() => expire.mutate(undefined, { onError: (e) => Alert.alert("Couldn't expire it", e instanceof Error ? e.message : "Try again.") })}
      />
    </Card>
  );
}
