import { PERSONA_LABELS } from "@bbc/shared/demo";
import { router, type Href } from "expo-router";
import { FlaskConical } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import { useServerConfig } from "@/lib/server-config";
import { brand, fonts } from "@/theme";

/**
 * The demo site's strip under the status bar, so a screenshot or a passer-by can tell
 * it isn't the real app. Tapping it opens the Demo tools on the Profile tab. Wrap the
 * navigator in it: the screens below get a zero top inset, the strip already took it.
 */
export function DemoBanner({ children }: { children: React.ReactNode }) {
  const config = useServerConfig();
  const insets = useSafeAreaInsets();
  if (!config.demoSite) return <>{children}</>;
  const current = config.demo?.current;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Demo site. Open demo tools"
        onPress={() => router.navigate("/profile" as Href)}
        style={[styles.strip, { paddingTop: insets.top + 4 }]}
      >
        <FlaskConical size={14} color={brand.deepForest} />
        <Text style={styles.text} numberOfLines={1}>
          Demo site{current ? ` · You're ${PERSONA_LABELS[current].name.split(" ")[0]} (${PERSONA_LABELS[current].label})` : " · Nothing here is real"}
        </Text>
      </Pressable>
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>{children}</SafeAreaInsetsContext.Provider>
    </>
  );
}

const styles = StyleSheet.create({
  strip: { backgroundColor: brand.sun, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingBottom: 5, paddingHorizontal: 16 },
  text: { color: brand.deepForest, fontFamily: fonts.bodySemi, fontSize: 12 },
});
