import type { MeDTO } from "@bbc/shared/api-types";
import { profileSchema } from "@bbc/shared/schemas";
import * as Linking from "expo-linking";
import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Bell, ChevronRight, LayoutDashboard, ReceiptText, ScanLine, Shield } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { DemoTools } from "@/components/demo/demo-tools";
import { PersonaButtons } from "@/components/demo/persona-buttons";
import { Button, Card, Divider, Field, Notice, Pill, Row, Screen, SignInPrompt, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { API_URL, APP_VERSION } from "@/lib/config";
import { enablePush, pushPermission, type PushState } from "@/lib/push";
import { useReviewQueue } from "@/lib/review";
import { useSession } from "@/lib/session";
import { space, useTheme } from "@/theme";

const ROLE_LABEL = { member: "Member", staff: "Door crew", admin: "Organiser" } as const;

export default function Profile() {
  const { status, me } = useSession();
  if (status !== "signedIn" || !me) {
    return (
      <Screen>
        <SignInPrompt title="Your Base Camp account">Sign in to book events, keep your tickets on this phone and get booking updates.</SignInPrompt>
        <PersonaButtons />
      </Screen>
    );
  }
  return <SignedIn me={me} />;
}

function SignedIn({ me }: { me: MeDTO }) {
  const { setMe, signOut, isAdmin, isStaff } = useSession();
  // Admins only (the hook is disabled otherwise); shown on the Review receipts row
  const waiting = useReviewQueue().data?.length;
  const { c } = useTheme();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const [name, setName] = useState(me.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [push, setPush] = useState<PushState | null>(null);

  const [nameFrom, setNameFrom] = useState(me.name);
  if (nameFrom !== me.name) {
    setNameFrom(me.name);
    setName(me.name);
  }

  // Re-read when coming back from the system settings
  useFocusEffect(
    useCallback(() => {
      pushPermission().then(setPush).catch(() => setPush("undetermined"));
    }, []),
  );

  const dirty = name.trim() !== me.name;

  async function save() {
    const parsed = profileSchema.safeParse({ name });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setSaving(true);
    setError(null);
    try {
      setMe(await api<MeDTO>("/api/v1/me", { method: "PATCH", body: parsed.data }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  async function turnOnNotifications() {
    if (push === "denied") return Linking.openSettings();
    setPush(await enablePush({ ask: true }));
  }

  function confirmSignOut() {
    Alert.alert("Sign out?", "Your tickets are removed from this phone until you sign in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <View style={{ gap: space.xs, marginBottom: space.sm }}>
        <Text variant="display">Profile</Text>
        <Row>
          <Text muted style={{ flexShrink: 1 }} numberOfLines={1}>{me.email}</Text>
          {me.role !== "member" && <Pill label={ROLE_LABEL[me.role]} tone={me.role === "admin" ? "success" : "info"} />}
        </Row>
      </View>

      {welcome === "1" && (
        <Notice title="Welcome to Base Camp" tone="success">
          Check the name below: it&apos;s what the door crew see when they scan your ticket.
        </Notice>
      )}

      <Card style={{ gap: space.md }}>
        <Field
          label="Name on tickets"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(null);
          }}
          autoComplete="name"
          textContentType="name"
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={() => dirty && save()}
          error={error}
          hint="Guests' names can be changed on each ticket."
        />
        <Button title={saved ? "Saved" : "Save name"} variant={dirty ? "primary" : "secondary"} disabled={!dirty} loading={saving} onPress={save} />
      </Card>

      <DemoTools />

      {isAdmin && (
        <LinkRow
          icon={<ReceiptText color={c.primary} size={22} />}
          title="Review receipts"
          subtitle={waiting === undefined ? "Approve or reject GCash and Maya payments" : waiting === 0 ? "Queue is clear" : `${waiting} waiting, oldest first`}
          onPress={() => router.push("/review" as Href)}
        />
      )}
      {isAdmin && (
        <LinkRow icon={<LayoutDashboard color={c.primary} size={22} />} title="Organiser tools" subtitle="Events, attendees, team and everything else" onPress={() => router.push("/organiser")} />
      )}
      {isStaff && !isAdmin && (
        <LinkRow icon={<ScanLine color={c.primary} size={22} />} title="Door crew" subtitle="Scan tickets from the Door tab" onPress={() => router.push("/door")} />
      )}

      <Card style={{ gap: space.sm }}>
        <Row style={{ alignItems: "flex-start" }}>
          <Bell color={c.foreground} size={20} style={{ marginTop: 1 }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label">Notifications</Text>
            <Text variant="caption" muted>
              {push === "granted"
                ? "On. You'll hear when a booking is confirmed, needs fixing, or an event is near."
                : push === "denied"
                  ? "Off in your phone's settings. Booking updates still come by email."
                  : push === "unsupported"
                    ? "Not available on this device. Booking updates still come by email."
                    : "Get a heads-up when your booking is confirmed or a hold is about to end."}
            </Text>
          </View>
        </Row>
        {push !== null && push !== "granted" && push !== "unsupported" && (
          <Button title={push === "denied" ? "Open settings" : "Turn on notifications"} variant="secondary" onPress={turnOnNotifications} />
        )}
      </Card>

      <Card padded={false}>
        <LinkRow
          bare
          icon={<Shield color={c.foreground} size={20} />}
          title="Privacy policy"
          onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy`).catch(() => {})}
        />
      </Card>

      <Divider />
      <Button title="Sign out" variant="destructive" onPress={confirmSignOut} />
      <Text variant="caption" muted style={{ textAlign: "center", marginTop: space.sm }}>
        Baguio Base Camp {APP_VERSION}
      </Text>
    </Screen>
  );
}

function LinkRow({ icon, title, subtitle, onPress, bare }: { icon: React.ReactNode; title: string; subtitle?: string; onPress: () => void; bare?: boolean }) {
  const { c } = useTheme();
  const body = (
    <Row gap={space.md}>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{title}</Text>
        {subtitle && <Text variant="caption" muted>{subtitle}</Text>}
      </View>
      <ChevronRight color={c.mutedForeground} size={20} />
    </Row>
  );
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {bare ? <View style={{ padding: space.lg }}>{body}</View> : <Card>{body}</Card>}
    </Pressable>
  );
}
