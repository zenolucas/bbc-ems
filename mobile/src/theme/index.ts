import { alpineDay, brand, starlitNight, type Palette } from "@bbc/shared/theme";
import { useColorScheme } from "react-native";

export { brand };
export type { Palette };

/** Font family names, registered by useFonts in src/app/_layout.tsx. */
export const fonts = {
  body: "Geist",
  bodySemi: "Geist-SemiBold",
  bodyBold: "Geist-Bold",
  display: "Bricolage-Bold",
  displaySemi: "Bricolage-SemiBold",
  displayHeavy: "Bricolage-ExtraBold",
  mono: "monospace",
} as const;

export const fontFiles = {
  [fonts.body]: require("../../assets/fonts/Geist-Regular.ttf"),
  [fonts.bodySemi]: require("../../assets/fonts/Geist-SemiBold.ttf"),
  [fonts.bodyBold]: require("../../assets/fonts/Geist-Bold.ttf"),
  [fonts.display]: require("../../assets/fonts/BricolageGrotesque-Bold.ttf"),
  [fonts.displaySemi]: require("../../assets/fonts/BricolageGrotesque-SemiBold.ttf"),
  [fonts.displayHeavy]: require("../../assets/fonts/BricolageGrotesque-ExtraBold.ttf"),
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export type Theme = { dark: boolean; c: Palette };

/** Alpine Day by day, Starlit Night when the phone is in dark mode. */
export function useTheme(): Theme {
  const dark = useColorScheme() === "dark";
  return { dark, c: dark ? starlitNight : alpineDay };
}

/** Door crew work in the dark: the scanner is always Starlit Night. */
export const nightTheme: Theme = { dark: true, c: starlitNight };
