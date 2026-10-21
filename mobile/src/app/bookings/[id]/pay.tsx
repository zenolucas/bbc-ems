import { peso } from "@bbc/shared/format";
import { paySchema } from "@bbc/shared/schemas";
import { Image } from "expo-image";
import { File as FSFile } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ImagePlus } from "lucide-react-native";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { Button, ErrorView, Field, Loading, Notice, Screen, Text } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useBooking, useSubmitPayment } from "@/lib/attendee";
import { offerPush } from "@/lib/push";
import { radius, space, useTheme } from "@/theme";

const MAX_WIDTH = 1600;

type Picked = { uri: string; width: number; height: number };

/** Shrinks a receipt screenshot to a JPEG well under Vercel's 4.5 MB request limit. */
async function shrink(asset: ImagePicker.ImagePickerAsset): Promise<Picked> {
  const ctx = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH, height: null });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export default function PayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useBooking(id);
  const submit = useSubmitPayment(id);
  const { c } = useTheme();
  const [image, setImage] = useState<Picked | null>(null);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState<"pick" | "upload" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (q.isPending) return <><Stack.Screen options={{ title: "Upload receipt" }} /><Loading /></>;
  if (q.isError) return <><Stack.Screen options={{ title: "Upload receipt" }} /><ErrorView error={q.error} onRetry={() => q.refetch()} /></>;
  const b = q.data;
  const resubmit = b.status === "rejected";
  const open = b.status === "pending_payment" || b.status === "rejected";

  async function pick() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos access needed", "Allow access to your photos so you can pick the GCash or Maya receipt screenshot.", [
        { text: "Not now", style: "cancel" },
        { text: "Open settings", onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsMultipleSelection: false });
    if (res.canceled || !res.assets?.[0]) return;
    setBusy("pick");
    try {
      setImage(await shrink(res.assets[0]));
    } catch {
      setError("Couldn't read that image. Try another screenshot.");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setError(null);
    if (!image) return setError("Add the receipt screenshot to continue.");
    const refCheck = paySchema.shape.paymentRef.safeParse(ref);
    if (!refCheck.success) return setError(refCheck.error.issues[0].message);
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("folder", "payments");
      // An expo-file-system File, not React Native's { uri, name, type }: Expo's fetch (the global
      // fetch since SDK 52+) rejects uri parts, and File gives it the bytes and image/jpeg from the .jpg name
      form.append("file", new FSFile(image.uri) as unknown as Blob);
      const { url } = await api<{ url: string }>("/api/upload", { form, timeoutMs: 60_000 });
      await submit.mutateAsync({ paymentRef: refCheck.data, paymentProofUrl: url });
      // The best moment to offer notifications; offerPush's own alert says "Receipt sent" too
      if (!(await offerPush("receipt"))) Alert.alert("Receipt sent", "We'll let you know once it's confirmed.");
      // Opened straight from a notification or link there is nothing behind this screen
      if (router.canGoBack()) router.back();
      else router.replace(`/bookings/${b.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed. Check your signal and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen edges={["bottom"]} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: resubmit ? "Send the new receipt" : "Send us the receipt" }} />
        {!open ? (
          <Notice tone="info" title="Nothing to pay here">This booking isn&apos;t waiting for a payment any more.</Notice>
        ) : (
          <>
            <Text muted>
              Send <Text style={{ fontWeight: "700" }}>{peso(b.totalCents)}</Text> by GCash or Maya first, then add the confirmation screenshot and its reference number.
            </Text>

            <View style={{ gap: 6 }}>
              <Text variant="label">{resubmit ? "New receipt screenshot" : "Receipt screenshot"}</Text>
              <Pressable
                onPress={pick}
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel={image ? "Change receipt screenshot" : resubmit ? "Upload the new screenshot" : "Upload receipt screenshot"}
                style={[styles.drop, { borderColor: c.border, backgroundColor: c.surface1 }]}
              >
                {image ? (
                  <Image source={image.uri} style={{ width: "100%", aspectRatio: Math.max(0.4, image.width / image.height), maxHeight: 420, borderRadius: radius.sm }} contentFit="contain" />
                ) : busy === "pick" ? (
                  <Loading />
                ) : (
                  <View style={{ alignItems: "center", gap: space.sm, paddingVertical: space.xl }}>
                    <ImagePlus size={30} color={c.mutedForeground} />
                    <Text variant="label">{resubmit ? "Upload the new screenshot" : "Upload receipt screenshot"}</Text>
                    <Text variant="caption" muted>From your photos</Text>
                  </View>
                )}
              </Pressable>
              {image && <Button title="Choose a different image" variant="ghost" onPress={pick} disabled={!!busy} />}
            </View>

            <Field
              label={resubmit ? "New reference number" : "Reference number"}
              value={ref}
              onChangeText={setRef}
              placeholder="e.g. 1234 567 890123"
              keyboardType="number-pad"
              hint="Shown on the GCash/Maya confirmation screen after you send."
              returnKeyType="done"
            />

            {error && <Text variant="caption" color={c.destructive} accessibilityLiveRegion="assertive">{error}</Text>}
            <Button
              size="lg"
              title={busy === "upload" ? "Sending…" : resubmit ? "Resubmit for review" : "Submit for review"}
              loading={busy === "upload"}
              disabled={!image || busy !== null}
              onPress={send}
            />
            {!image && <Text variant="caption" muted style={{ textAlign: "center" }}>Add the receipt screenshot to continue.</Text>}
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  drop: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: radius.lg, padding: space.md, alignItems: "center", justifyContent: "center", minHeight: 150 },
});
