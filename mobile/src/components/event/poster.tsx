import { fmtDate } from "@bbc/shared/format";
import { Image } from "expo-image";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Text } from "@/components/ui";
import { assetUrl } from "@/lib/attendee";
import { brand, fonts, radius } from "@/theme";

/** Night skyline for events without a poster, like the site's fallback art. */
function Skyline() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: brand.night }]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 225" preserveAspectRatio="xMidYMax slice">
        <Circle cx="70" cy="40" r="1.6" fill={brand.star} />
        <Circle cx="140" cy="22" r="1.2" fill={brand.star} />
        <Circle cx="250" cy="48" r="1.4" fill={brand.star} />
        <Circle cx="330" cy="30" r="1.8" fill={brand.star} />
        <Circle cx="320" cy="62" r="14" fill={brand.star} opacity={0.9} />
        <Path d="M0 170 L70 110 L120 150 L190 85 L260 145 L310 115 L400 165 L400 225 L0 225 Z" fill={brand.slate} />
        <Path d="M0 195 L60 160 L130 190 L210 140 L290 185 L350 160 L400 180 L400 225 L0 225 Z" fill={brand.pine} />
      </Svg>
    </View>
  );
}

export function Poster({ url, dim, style, children }: { url: string | null; dim?: boolean; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const src = assetUrl(url);
  return (
    <View style={[{ overflow: "hidden", backgroundColor: brand.night }, style]}>
      {src ? <Image source={src} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessibilityIgnoresInvertColors /> : <Skyline />}
      {dim && <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(14, 28, 32, 0.5)" }]} />}
      {children}
    </View>
  );
}

/** The calendar tab on a poster: "OCT / 24". */
export function DateTab({ date, large }: { date: string; large?: boolean }) {
  return (
    <View style={[styles.dateTab, large && { paddingHorizontal: 12, paddingVertical: 8 }]} accessible accessibilityLabel={fmtDate(date, "EEEE, MMMM d")}>
      <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.bodyBold, fontSize: large ? 12 : 10.5, letterSpacing: 1, color: brand.pine }}>{fmtDate(date, "MMM").toUpperCase()}</Text>
      <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.displayHeavy, fontSize: large ? 28 : 22, lineHeight: large ? 30 : 24, color: brand.deepForest }}>{fmtDate(date, "d")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dateTab: { backgroundColor: brand.cream, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 5, alignItems: "center", minWidth: 46 },
});
