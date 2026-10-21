import { Image } from "expo-image";
import { Maximize2, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Row, Text } from "@/components/ui";
import { radius, space, useTheme } from "@/theme";

const STEPS = [1, 2, 3] as const;

/**
 * The receipt, big, with a full-screen view for checking the amount and reference.
 * iOS pinch-zooms (ScrollView zoom is iOS-only); Android gets Fit / 2× / 3× steps and
 * pans in both directions, since pinch would need a gesture library.
 */
export function ReceiptViewer({ uri, height }: { uri: string | null; height: number }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  if (!uri) {
    return (
      <View style={[styles.frame, { height: 120, backgroundColor: c.surface2, borderColor: c.border }]}>
        <Text muted>No receipt image</Text>
      </View>
    );
  }
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="imagebutton" accessibilityLabel="Receipt. Open full screen to zoom" style={[styles.frame, { height, backgroundColor: c.surface2, borderColor: c.border }]}>
        <Image
          source={{ uri }}
          contentFit="contain"
          style={StyleSheet.absoluteFill}
          onLoad={(e) => e.source.width && setRatio(e.source.height / e.source.width)}
          transition={150}
        />
        <View style={[styles.badge, { backgroundColor: c.card }]}>
          <Maximize2 size={14} color={c.foreground} />
          <Text variant="label" style={{ fontSize: 12 }}>Zoom</Text>
        </View>
      </Pressable>
      {open && <FullScreen uri={uri} ratio={ratio ?? 2} onClose={() => setOpen(false)} />}
    </>
  );
}

function FullScreen({ uri, ratio, onClose }: { uri: string; ratio: number; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const [scale, setScale] = useState<(typeof STEPS)[number]>(1);
  const w = width * scale;
  const h = w * ratio;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
        <Row style={{ justifyContent: "space-between", padding: space.md }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close receipt" style={styles.close}>
            <X size={22} color="#fff" />
          </Pressable>
          {Platform.OS !== "ios" && (
            <Row gap={6}>
              {STEPS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setScale(s)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: scale === s }}
                  style={[styles.step, { backgroundColor: scale === s ? "#fff" : "rgba(255,255,255,0.16)" }]}
                >
                  <Text variant="label" color={scale === s ? "#000" : "#fff"}>{s === 1 ? "Fit" : `${s}×`}</Text>
                </Pressable>
              ))}
            </Row>
          )}
        </Row>
        <ScrollView maximumZoomScale={4} minimumZoomScale={1} centerContent contentContainerStyle={{ alignItems: "center" }}>
          <ScrollView horizontal contentContainerStyle={{ alignItems: "flex-start" }} showsHorizontalScrollIndicator={false}>
            <Image source={{ uri }} contentFit="contain" style={{ width: w, height: h }} accessibilityLabel="Receipt" />
          </ScrollView>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", right: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  step: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
});
