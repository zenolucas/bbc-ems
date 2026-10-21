import QRCode from "qrcode";
import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { Text } from "@/components/ui";
import { fonts, radius } from "@/theme";

/**
 * A plain, big QR for landscape ticket styles (Trail Pass), whose own QR stub is
 * about 80px wide on a phone. Same payload as the ticket; works offline (drawn here).
 */
export function LargeQr({ data, code, size = 260 }: { data: string; code: string; size?: number }) {
  const { n, d } = useMemo(() => {
    const qr = QRCode.create(data, { errorCorrectionLevel: "M" });
    const m = qr.modules.size;
    const quiet = 4;
    let path = "";
    for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) if (qr.modules.get(y, x)) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    return { n: m + quiet * 2, d: path };
  }, [data]);
  return (
    <View style={{ alignItems: "center", gap: 8 }} accessible accessibilityLabel={`QR code for ticket ${code}`}>
      <View style={{ backgroundColor: "#fff", padding: 8, borderRadius: radius.lg }}>
        <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>
          <Rect width={n} height={n} fill="#fff" />
          <Path d={d} fill="#000" />
        </Svg>
      </View>
      <Text style={{ fontFamily: fonts.mono, fontSize: 15, letterSpacing: 2 }} maxFontSizeMultiplier={1.4}>{code}</Text>
    </View>
  );
}
