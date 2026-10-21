import { router } from "expo-router";
import { forwardRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { fonts, radius, space, useTheme, type Theme } from "@/theme";

type Variant = "display" | "title" | "heading" | "body" | "label" | "caption" | "mono";

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.displayHeavy, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.displaySemi, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17 },
  mono: { fontFamily: fonts.mono, fontSize: 15, letterSpacing: 1 },
};

export function Text({ variant = "body", muted, color, style, theme, ...rest }: TextProps & { variant?: Variant; muted?: boolean; color?: string; theme?: Theme }) {
  const fallback = useTheme();
  const { c } = theme ?? fallback;
  return <RNText {...rest} style={[variants[variant], { color: color ?? (muted ? c.mutedForeground : c.foreground) }, style]} />;
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export function Button({
  title,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  size = "md",
  theme,
  ...rest
}: PressableProps & { title: string; variant?: ButtonVariant; loading?: boolean; icon?: React.ReactNode; size?: "md" | "lg"; style?: StyleProp<ViewStyle>; theme?: Theme }) {
  const fallback = useTheme();
  const { c } = theme ?? fallback;
  const bg = { primary: c.primary, secondary: c.secondary, ghost: "transparent", destructive: c.destructiveSoft }[variant];
  const fg = { primary: c.primaryForeground, secondary: c.secondaryForeground, ghost: c.foreground, destructive: c.destructive }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      {...rest}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, minHeight: size === "lg" ? 54 : 46, opacity: off ? 0.55 : pressed ? 0.85 : 1 },
        variant === "ghost" && { borderWidth: 1, borderColor: c.border },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <RNText style={[variants.label, { color: fg, fontSize: size === "lg" ? 16 : 15 }]}>{title}</RNText>
    </Pressable>
  );
}

export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { c } = useTheme();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, padded && { padding: space.lg }, style]}>{children}</View>;
}

/** Safe-area page with optional pull-to-refresh. */
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  edges = ["top"],
  contentStyle,
  theme,
  ...rest
}: ScrollViewProps & { scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; edges?: Edge[]; contentStyle?: StyleProp<ViewStyle>; theme?: Theme }) {
  const fallback = useTheme();
  const { c } = theme ?? fallback;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.background }}>
      {scroll ? (
        <ScrollView
          {...rest}
          contentContainerStyle={[{ padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 }, contentStyle]}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export const Field = forwardRef<TextInputInstance, TextInputProps & { label?: string; hint?: string; error?: string | null }>(function Field({ label, hint, error, style, ...rest }, ref) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label && <Text variant="label">{label}</Text>}
      <TextInput
        ref={ref}
        placeholderTextColor={c.mutedForeground}
        {...rest}
        style={[
          styles.input,
          { color: c.foreground, backgroundColor: c.surface1, borderColor: error ? c.destructive : c.border, fontFamily: fonts.body },
          style,
        ]}
      />
      {error ? <Text variant="caption" color={c.destructive}>{error}</Text> : hint ? <Text variant="caption" muted>{hint}</Text> : null}
    </View>
  );
});

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export function Pill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const { c } = useTheme();
  const bg = { neutral: c.surface2, success: c.successSoft, warning: c.warningSoft, danger: c.destructiveSoft, info: c.infoSoft }[tone];
  const fg = { neutral: c.mutedForeground, success: c.successForeground, warning: c.warningForeground, danger: c.destructive, info: c.infoForeground }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {/* Chrome, not reading text: grows with the phone's text size up to 1.4x so rows don't burst */}
      <RNText maxFontSizeMultiplier={1.4} numberOfLines={1} style={[variants.label, { color: fg, fontSize: 12 }]}>{label}</RNText>
    </View>
  );
}

export function Notice({ title, children, tone = "info" }: { title: string; children?: React.ReactNode; tone?: Tone }) {
  const { c } = useTheme();
  const bg = { neutral: c.surface2, success: c.successSoft, warning: c.warningSoft, danger: c.destructiveSoft, info: c.infoSoft }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Text variant="label">{title}</Text>
      {typeof children === "string" ? <Text variant="caption" muted>{children}</Text> : children}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={c.primary} size="large" />
      {label && <Text muted>{label}</Text>}
    </View>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={[styles.center, { paddingVertical: space.xxl * 1.5 }]}>
      <Text variant="title" style={{ textAlign: "center" }}>{title}</Text>
      {children && <Text muted style={{ textAlign: "center", maxWidth: 300 }}>{children}</Text>}
      {action}
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <EmptyState title="Couldn't load this" action={onRetry && <Button title="Try again" variant="secondary" onPress={onRetry} />}>
      {message}
    </EmptyState>
  );
}

/** For screens that need an account. Events stay browsable signed out. */
export function SignInPrompt({ title, children }: { title: string; children: string }) {
  return (
    <EmptyState title={title} action={<Button title="Sign in with email" onPress={() => router.push("/sign-in")} style={{ alignSelf: "stretch", minWidth: 240 }} />}>
      {children}
    </EmptyState>
  );
}

export function Row({ children, style, gap = space.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
}

export function Divider({ dashed }: { dashed?: boolean }) {
  const { c } = useTheme();
  return <View style={{ borderTopWidth: 1, borderColor: c.border, borderStyle: dashed ? "dashed" : "solid", marginVertical: space.xs }} />;
}

const styles = StyleSheet.create({
  button: { borderRadius: radius.pill, paddingHorizontal: space.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 48 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  notice: { borderRadius: radius.md, padding: space.md, gap: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl },
});
