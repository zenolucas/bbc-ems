/**
 * Alpine Day (light) and Starlit Night (dark), copied from src/app/globals.css
 * for the mobile app, which has no CSS. Keep the two in step when the palette changes.
 */

export const brand = {
  sky: "#3cc5e8",
  skyDeep: "#1e6fa3",
  lime: "#8cc63e",
  grass: "#39b54a",
  forest: "#1f9a3e",
  pine: "#1b5e3b",
  deepForest: "#0b3d2e",
  night: "#1c2f34",
  midnight: "#0e1c20",
  slate: "#27404a",
  sun: "#f7e017",
  star: "#f5f0a0",
  cream: "#f6f4ec",
  fog: "#e8f0e6",
  sage: "#9db58a",
  moss: "#4f7942",
} as const;

export type Palette = {
  background: string;
  foreground: string;
  surface1: string;
  surface2: string;
  surface3: string;
  card: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveSoft: string;
  success: string;
  successForeground: string;
  successSoft: string;
  warning: string;
  warningForeground: string;
  warningSoft: string;
  info: string;
  infoForeground: string;
  infoSoft: string;
  border: string;
  ring: string;
};

export const alpineDay: Palette = {
  background: brand.cream,
  foreground: brand.deepForest,
  surface1: "#ffffff",
  surface2: "#eef2e8",
  surface3: "#e3e9dc",
  card: "#ffffff",
  primary: brand.pine,
  primaryForeground: "#ffffff",
  secondary: brand.fog,
  secondaryForeground: brand.pine,
  muted: "#eef2e8",
  mutedForeground: "#5b7060",
  accent: "#dff5fb",
  accentForeground: brand.skyDeep,
  destructive: "#b4321f",
  destructiveSoft: "rgba(180, 50, 31, 0.1)",
  success: brand.grass,
  successForeground: brand.pine,
  successSoft: "rgba(57, 181, 74, 0.14)",
  warning: "#d4b800",
  warningForeground: "#6b4f00",
  warningSoft: "rgba(247, 224, 23, 0.26)",
  info: brand.skyDeep,
  infoForeground: brand.skyDeep,
  infoSoft: "rgba(60, 197, 232, 0.18)",
  border: "#d9e0d2",
  ring: brand.grass,
};

export const starlitNight: Palette = {
  background: brand.midnight,
  foreground: brand.fog,
  surface1: brand.night,
  surface2: brand.slate,
  surface3: "#324f57",
  card: brand.night,
  primary: brand.lime,
  primaryForeground: brand.deepForest,
  secondary: brand.slate,
  secondaryForeground: brand.fog,
  muted: brand.slate,
  mutedForeground: "#a9bfae",
  accent: "#1f4a5c",
  accentForeground: "#7fd8f0",
  destructive: "#ff8a76",
  destructiveSoft: "rgba(255, 138, 118, 0.14)",
  success: brand.lime,
  successForeground: "#a6d85a",
  successSoft: "rgba(140, 198, 62, 0.16)",
  warning: brand.star,
  warningForeground: brand.star,
  warningSoft: "rgba(245, 240, 160, 0.14)",
  info: "#7fd8f0",
  infoForeground: "#7fd8f0",
  infoSoft: "rgba(127, 216, 240, 0.14)",
  border: "rgba(232, 240, 230, 0.14)",
  ring: brand.lime,
};
