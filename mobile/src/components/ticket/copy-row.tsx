import * as Clipboard from "expo-clipboard";
import { Check, Copy } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Row, Text } from "@/components/ui";
import { fonts, radius, useTheme } from "@/theme";

/** A labelled value with a copy button ("Number 0917…  ⧉"). */
export function CopyRow({ label, value, copyValue, mono, big, highlight, hint }: { label: string; value: string; copyValue?: string; mono?: boolean; big?: boolean; highlight?: boolean; hint?: string }) {
  const { c } = useTheme();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" muted>{label}</Text>
      <Row gap={8}>
        <View style={highlight ? { backgroundColor: c.warningSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 1 } : { flexShrink: 1 }}>
          <Text
            selectable
            numberOfLines={1}
            style={big ? { fontFamily: fonts.displayHeavy, fontSize: 26, lineHeight: 32 } : mono ? { fontFamily: fonts.mono, fontSize: 15, fontWeight: "600" } : { fontFamily: fonts.bodySemi, fontSize: 15 }}
          >
            {value}
          </Text>
        </View>
        <Pressable
          onPress={async () => {
            await Clipboard.setStringAsync(copyValue ?? value);
            setCopied(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
          hitSlop={10}
          style={{ width: 34, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }}
        >
          {copied ? <Check size={16} color={c.successForeground} /> : <Copy size={16} color={c.mutedForeground} />}
        </Pressable>
      </Row>
      {hint && <Text variant="caption" muted style={{ fontSize: 11 }}>{hint}</Text>}
    </View>
  );
}
