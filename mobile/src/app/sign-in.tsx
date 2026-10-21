import { router } from "expo-router";
import { Mail } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, TextInput, View, type TextInputInstance } from "react-native";
import { Button, Field, Row, Screen, Text } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { fonts, radius, space, useTheme } from "@/theme";

const CODE_LENGTH = 6;

/**
 * Inboxes we can open from the code step: the same webmail list as the site's sign-in
 * (src/app/login/login-form.tsx). On Android, Gmail and Outlook links open their apps
 * when installed. Anything else gets no button: React Native can't target "the mail app"
 * on Android without a native module, and a mailto: link would open a new draft instead.
 */
const INBOXES: [RegExp, string][] = [
  [/^(gmail|googlemail)\.com$/, "https://mail.google.com/mail/u/0/#inbox"],
  [/^(outlook|hotmail|live|msn)\.[a-z.]+$/, "https://outlook.live.com/mail/0/"],
  [/^(yahoo|ymail)\.[a-z.]+$/, "https://mail.yahoo.com/"],
  [/^(icloud|me|mac)\.com$/, "https://www.icloud.com/mail"],
  [/^proton(mail)?\.(me|com)$/, "https://mail.proton.me/u/0/inbox"],
];

function inboxUrl(email: string) {
  const domain = email.trim().split("@")[1]?.toLowerCase() ?? "";
  return INBOXES.find(([re]) => re.test(domain))?.[1] ?? null;
}
const RESEND_AFTER_S = 60; // better-auth allows 3 sends a minute per address

export default function SignIn() {
  const { sendCode, verifyCode } = useSession();
  const { c } = useTheme();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const inbox = inboxUrl(email);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function send() {
    if (!validEmail) return setError("Enter the email you book with");
    setBusy(true);
    setError(null);
    try {
      await sendCode(email);
      setStep("code");
      setCode("");
      setCooldown(RESEND_AFTER_S);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the code");
    } finally {
      setBusy(false);
    }
  }

  async function verify(value = code) {
    if (value.length !== CODE_LENGTH) return;
    setBusy(true);
    setError(null);
    try {
      const me = await verifyCode(email, value);
      if (router.canGoBack()) router.back();
      else router.replace("/");
      // New accounts get a name from their email; nudge them to fix it for their tickets
      if (me.name === email.split("@")[0]) router.push("/profile?welcome=1");
    } catch (e) {
      setCode("");
      setError(e instanceof ApiError && e.status < 500 ? "That code didn't work. Check the latest email, or send a new one." : e instanceof Error ? e.message : "Couldn't sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen edges={["bottom"]} keyboardShouldPersistTaps="handled" contentStyle={{ paddingTop: space.xl, gap: space.lg }}>
        {step === "email" ? (
          <>
            <View style={{ gap: space.sm }}>
              <Text variant="display">Welcome to Base Camp</Text>
              <Text muted>We&apos;ll email you a 6-digit code. No password to remember.</Text>
            </View>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={send}
              autoFocus
              error={error}
            />
            <Button title="Email me a code" size="lg" loading={busy} disabled={!validEmail} onPress={send} />
          </>
        ) : (
          <>
            <View style={{ gap: space.sm }}>
              <Text variant="display">Check your email</Text>
              <Text muted>
                We sent a code to <Text variant="label">{email.trim()}</Text>. It expires in 10 minutes.
              </Text>
            </View>
            <CodeInput
              value={code}
              onChange={(v) => {
                setCode(v);
                setError(null);
                if (v.length === CODE_LENGTH) verify(v);
              }}
              error={!!error}
            />
            {error && <Text variant="caption" color={c.destructive}>{error}</Text>}
            <Button title="Sign in" size="lg" loading={busy} disabled={code.length !== CODE_LENGTH} onPress={() => verify()} />
            {inbox && (
              <Button
                title="Open mail app"
                variant="ghost"
                icon={<Mail size={18} color={c.foreground} />}
                onPress={() => Linking.openURL(inbox).catch(() => {})}
                accessibilityHint="Opens your inbox to find the code; come back here to type it"
              />
            )}
            <Row style={{ justifyContent: "space-between" }}>
              <Pressable onPress={() => { setStep("email"); setError(null); }} hitSlop={12}>
                <Text variant="label" muted>Use a different email</Text>
              </Pressable>
              <Pressable onPress={send} disabled={cooldown > 0 || busy} hitSlop={12}>
                <Text variant="label" muted={cooldown > 0}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</Text>
              </Pressable>
            </Row>
            {/* The server answers "sent" even when the mail provider fails (better-auth sends in the background) */}
            <Text variant="caption" muted>No email after a minute? Check spam or junk, then tap Resend.</Text>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** One hidden input behind six boxes, so paste and SMS/email autofill work. */
function CodeInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error: boolean }) {
  const { c } = useTheme();
  const ref = useRef<TextInputInstance>(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="Sign-in code">
      <Row gap={space.sm} style={{ justifyContent: "center" }}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const active = i === value.length;
          return (
            <View
              key={i}
              style={[
                styles.box,
                { backgroundColor: c.surface1, borderColor: error ? c.destructive : active ? c.ring : c.border, borderWidth: active ? 2 : 1 },
              ]}
            >
              {/* A fixed box: the digit may grow with the phone's text size, up to 1.4x, then shrinks to fit */}
              <Text maxFontSizeMultiplier={1.4} numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.bodyBold, fontSize: 24 }}>{value[i] ?? ""}</Text>
            </View>
          );
        })}
      </Row>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={CODE_LENGTH}
        autoFocus
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { width: 48, minHeight: 58, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  hidden: { position: "absolute", opacity: 0, width: 1, height: 1 },
});
