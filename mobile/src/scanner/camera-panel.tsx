import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Camera as CameraIcon, CameraOff, Flashlight, FlashlightOff } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Linking, Pressable, StyleSheet, View } from "react-native";
import { Button, Text } from "@/components/ui";
import { brand, nightTheme, radius, space } from "@/theme";
import { AFTER_HIT_MS } from "./logic";
import { primeAudio } from "./feedback";

const c = nightTheme.c;

/**
 * The camera, behind a "Tap to start camera" button like the web (saves battery,
 * and asks for permission only when the door crew means it). While a result is
 * up, scanning pauses; after each hit it waits AFTER_HIT_MS before reading again.
 */
export function CameraPanel({ onText, paused }: { onText: (text: string) => void; paused: boolean }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [on, setOn] = useState(false);
  const [torch, setTorch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastHit = useRef(0);

  async function start() {
    primeAudio();
    setError(null);
    const p = permission?.granted ? permission : await requestPermission();
    if (p.granted) setOn(true);
  }

  const onScanned = (r: BarcodeScanningResult) => {
    const now = Date.now();
    if (now - lastHit.current < AFTER_HIT_MS) return;
    lastHit.current = now;
    if (r.data) onText(r.data);
  };

  const denied = permission && !permission.granted && !permission.canAskAgain;

  if (!on || !permission?.granted) {
    return (
      <View style={styles.stage}>
        <Frame scanning={false} />
        <View style={styles.overlay}>
          {denied ? (
            <>
              <View style={[styles.round, { backgroundColor: c.destructiveSoft }]}>
                <CameraOff size={28} color={c.destructive} />
              </View>
              <Text theme={nightTheme} variant="heading" style={{ textAlign: "center" }}>Camera is blocked for this app</Text>
              <Text theme={nightTheme} variant="caption" muted style={{ textAlign: "center", maxWidth: 260 }}>
                Allow camera access in Settings to scan, or use Type code and the Guest list meanwhile.
              </Text>
              <Button theme={nightTheme} title="Open settings" onPress={() => Linking.openSettings()} style={{ marginTop: space.sm }} />
            </>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Tap to start camera" onPress={start} style={styles.startHit}>
              <View style={[styles.round, styles.startRound]}>
                <CameraIcon size={28} color={c.primaryForeground} />
              </View>
              <Text theme={nightTheme} style={{ fontSize: 18, fontWeight: "600", color: brand.fog }}>Tap to start camera</Text>
              <Text theme={nightTheme} variant="caption" color="rgba(232, 240, 230, 0.8)">Works offline once the ticket list is loaded</Text>
              {error && <Text theme={nightTheme} variant="caption" color={c.destructive}>{error}</Text>}
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stage}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        // undefined stops scanning while a result is on screen
        onBarcodeScanned={paused ? undefined : onScanned}
        onMountError={(e) => {
          setOn(false);
          setError(e.message || "The camera didn't start. Try again.");
        }}
      />
      <Frame scanning={!paused} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={torch ? "Turn flashlight off" : "Turn flashlight on"}
        accessibilityState={{ selected: torch }}
        onPress={() => setTorch((t) => !t)}
        style={styles.torch}
      >
        {torch ? <FlashlightOff size={20} color={brand.fog} /> : <Flashlight size={20} color={brand.fog} />}
      </Pressable>
    </View>
  );
}

/** Dimmed surround, lime corner brackets and a sweeping scan line. Decorative. */
function Frame({ scanning }: { scanning: boolean }) {
  const [y] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!scanning) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanning, y]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frameWrap]}>
      <View style={styles.window}>
        <View style={[styles.corner, { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 10 }]} />
        <View style={[styles.corner, { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 10 }]} />
        <View style={[styles.corner, { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 10 }]} />
        <View style={[styles.corner, { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 10 }]} />
        {scanning && (
          <Animated.View
            style={[styles.line, { transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [12, WINDOW - 14] }) }] }]}
          />
        )}
      </View>
    </View>
  );
}

const WINDOW = 230;

const styles = StyleSheet.create({
  stage: { width: "100%", aspectRatio: 9 / 10, borderRadius: 22, overflow: "hidden", backgroundColor: "#0b161a" },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.xl },
  startHit: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: space.sm, paddingHorizontal: space.xl },
  round: { width: 64, height: 64, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  startRound: { backgroundColor: c.primary, borderWidth: 8, borderColor: "rgba(140, 198, 62, 0.18)", width: 80, height: 80 },
  frameWrap: { alignItems: "center", justifyContent: "center" },
  window: { width: WINDOW, height: WINDOW, borderRadius: 18, boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.35)" },
  corner: { position: "absolute", width: 34, height: 34, borderColor: brand.lime },
  line: { position: "absolute", left: 10, right: 10, top: 0, height: 2, backgroundColor: brand.lime, opacity: 0.9, borderRadius: 1 },
  torch: { position: "absolute", right: space.md, bottom: space.md, width: 48, height: 48, borderRadius: radius.pill, backgroundColor: "rgba(14, 28, 32, 0.7)", alignItems: "center", justifyContent: "center" },
});
