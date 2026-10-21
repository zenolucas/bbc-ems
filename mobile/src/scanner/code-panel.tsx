import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Keyboard, StyleSheet, TextInput, View, type TextInputInstance } from "react-native";
import { Button, Text } from "@/components/ui";
import { fonts, nightTheme, radius, space } from "@/theme";
import { CODE_LEN, formatCode, typedChars } from "./logic";

const c = nightTheme.c;

/** The code printed under the QR, in big mono, with a progress row and a button that counts down. */
export const CodePanel = forwardRef<TextInputInstance, { onSubmit: (code: string) => void }>(function CodePanel({ onSubmit }, ref) {
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  // Blur through our own ref: Keyboard.dismiss() alone misses an input focused by a tap on Android
  const inner = useRef<TextInputInstance>(null);
  useImperativeHandle(ref, () => inner.current as TextInputInstance, []);
  const n = typedChars(code);
  const left = CODE_LEN - n;
  const submit = () => {
    if (left > 0) return;
    // Android keeps the keyboard up when a focused input unmounts (the result covers this panel), so drop it first
    inner.current?.blur();
    Keyboard.dismiss();
    onSubmit(code);
    setCode("");
  };
  return (
    <View style={styles.card}>
      <Text theme={nightTheme} variant="label">Code printed under the QR</Text>
      <TextInput
        ref={inner}
        value={code}
        onChangeText={(v) => setCode(formatCode(v))}
        placeholder="BBC-7K3M-PX2Q"
        placeholderTextColor="rgba(169, 191, 174, 0.5)"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="visible-password"
        returnKeyType="go"
        onSubmitEditing={submit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel="Ticket code"
        // 13 mono characters must fit one line; capped so large system text can't push the code off the box
        maxFontSizeMultiplier={1.3}
        style={[styles.input, { borderColor: focused ? c.primary : c.border }]}
      />
      <View style={styles.progress} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: CODE_LEN }, (_, i) => (
          <View key={i} style={[styles.dash, { backgroundColor: i < n ? c.primary : c.surface2 }]} />
        ))}
      </View>
      <Button theme={nightTheme} size="lg" title={left > 0 ? `Check in · ${left} more character${left === 1 ? "" : "s"}` : "Check in"} disabled={left > 0} onPress={submit} />
      <Text theme={nightTheme} variant="caption" muted style={{ textAlign: "center" }}>O and 0, I and 1 are treated the same. Dashes are optional.</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { gap: space.md, borderRadius: 22, backgroundColor: c.card, paddingHorizontal: space.lg, paddingVertical: 18 },
  input: {
    minHeight: 60,
    borderWidth: 2,
    borderRadius: radius.md,
    backgroundColor: c.background,
    color: c.foreground,
    textAlign: "center",
    fontFamily: fonts.mono,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 3,
  },
  progress: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dash: { width: 10, height: 4, borderRadius: 2 },
});
