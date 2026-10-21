import type { TicketDTO } from "@bbc/shared/api-types";
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "@/components/ui";
import { useTicketImage } from "@/lib/tickets-cache";
import { brand, fonts, radius, useTheme } from "@/theme";

/**
 * The rendered ticket (QR included) from the phone's cache. Styles differ in
 * shape (Trail Pass is landscape), so the frame takes the PNG's own ratio.
 */
export function TicketImage({ ticket, style, stamp }: { ticket: TicketDTO; style?: StyleProp<ViewStyle>; stamp?: boolean }) {
  const { dark, c } = useTheme();
  const src = useTicketImage(ticket, dark);
  const [ratio, setRatio] = useState(0.6);
  return (
    <View style={[{ width: "100%", aspectRatio: ratio, borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.surface2 }, style]}>
      {src ? (
        <Image
          source={src}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          onLoad={(e) => e.source.width && e.source.height && setRatio(e.source.width / e.source.height)}
          accessibilityLabel={`Ticket ${ticket.shortCode} for ${ticket.holderName}. Show this QR code at the door.`}
        />
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
          <Text variant="caption" muted>Loading your ticket…</Text>
        </View>
      )}
      {stamp && ticket.status === "used" && (
        <View style={styles.stampWrap} pointerEvents="none">
          <View style={styles.stamp}>
            <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.displayHeavy, color: brand.lime, fontSize: 22, letterSpacing: 2 }}>CHECKED IN</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 8 },
  stampWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14, 28, 32, 0.45)" },
  stamp: { borderWidth: 3, borderColor: brand.lime, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8, transform: [{ rotate: "-8deg" }], backgroundColor: "rgba(14, 28, 32, 0.6)" },
});
