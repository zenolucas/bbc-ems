import type { ReviewItemDTO } from "@bbc/shared/admin-types";
import { AlertTriangle, CheckCircle2, History } from "lucide-react-native";
import { View } from "react-native";
import { Row, Text } from "@/components/ui";
import { useTheme } from "@/theme";

/** The web review list's hints: repeat customer, and whether the reference is on another booking. */
export function ReviewHints({ item }: { item: ReviewItemDTO }) {
  const { c } = useTheme();
  const ref = item.hints.refCheck;
  return (
    <View style={{ gap: 6 }}>
      <Row gap={6}>
        <History size={15} color={c.mutedForeground} />
        <Text variant="caption" muted>{item.hints.history}</Text>
      </Row>
      {ref && (
        <Row gap={6} style={{ alignItems: "flex-start" }}>
          {ref.ok ? <CheckCircle2 size={15} color={c.successForeground} /> : <AlertTriangle size={15} color={c.destructive} />}
          <Text variant="caption" color={ref.ok ? c.mutedForeground : c.destructive} style={{ flex: 1 }}>
            Reference {ref.text}
          </Text>
        </Row>
      )}
    </View>
  );
}
