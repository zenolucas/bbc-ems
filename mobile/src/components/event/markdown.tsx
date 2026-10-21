import { Image } from "expo-image";
import { Linking } from "react-native";
import Markdown from "react-native-markdown-display";
import { assetUrl } from "@/lib/attendee";
import { fonts, radius, useTheme } from "@/theme";

/** Event descriptions, in the app's fonts and colours. */
export function EventMarkdown({ children }: { children: string }) {
  const { c } = useTheme();
  const body = { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: c.foreground };
  return (
    <Markdown
      style={{
        body,
        paragraph: { marginTop: 0, marginBottom: 12 },
        heading1: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: c.foreground, marginTop: 8, marginBottom: 8 },
        heading2: { fontFamily: fonts.display, fontSize: 19, lineHeight: 25, color: c.foreground, marginTop: 8, marginBottom: 6 },
        heading3: { fontFamily: fonts.displaySemi, fontSize: 17, lineHeight: 23, color: c.foreground, marginTop: 6, marginBottom: 4 },
        strong: { fontFamily: fonts.bodyBold, fontWeight: "normal" },
        em: { fontStyle: "italic" },
        link: { color: c.accentForeground, textDecorationLine: "underline" },
        bullet_list: { marginBottom: 12 },
        ordered_list: { marginBottom: 12 },
        list_item: { marginBottom: 4 },
        blockquote: { backgroundColor: c.surface2, borderLeftColor: c.primary, borderLeftWidth: 3, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
        code_inline: { fontFamily: fonts.mono, backgroundColor: c.surface2, color: c.foreground, borderRadius: 4 },
        fence: { fontFamily: fonts.mono, backgroundColor: c.surface2, color: c.foreground, borderColor: c.border, borderRadius: radius.sm },
        hr: { backgroundColor: c.border, marginVertical: 12 },
        table: { borderColor: c.border },
        tr: { borderColor: c.border },
      }}
      onLinkPress={(url) => {
        Linking.openURL(url).catch(() => {});
        return false;
      }}
      rules={{
        // The library's default image component is unmaintained; use expo-image
        image: (node) => {
          const src = assetUrl(String(node.attributes?.src ?? ""));
          if (!src) return null;
          return <Image key={node.key} source={src} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, marginBottom: 12 }} contentFit="cover" />;
        },
      }}
    >
      {children}
    </Markdown>
  );
}
