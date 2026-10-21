import Constants from "expo-constants";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Storage from "expo-sqlite/kv-store";
import { Alert, Platform } from "react-native";
import { api } from "./api";

const TOKEN_KEY = "bbc.pushToken";
const DEVICE_KEY = "bbc.deviceId";

/** The server sends every push on this channel (src/lib/push.ts on the web side). */
export const CHANNEL_ID = "default";

/** Banners show while the app is open too; booking news is worth the interruption. */
export function configureForegroundHandling() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Bookings and reminders",
    importance: AndroidImportance.HIGH,
    lightColor: "#8CC63E",
  });
}

function projectId(): string | undefined {
  return Constants.easConfig?.projectId ?? (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
}

/** Stable per install: Android's app-scoped id, or a random id kept in the keystore. */
async function deviceId() {
  if (Platform.OS === "android") {
    try {
      const id = Application.getAndroidId();
      if (id) return id;
    } catch {}
  }
  let id = await SecureStore.getItemAsync(DEVICE_KEY).catch(() => null);
  if (!id) {
    id = `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await SecureStore.setItemAsync(DEVICE_KEY, id).catch(() => {});
  }
  return id;
}

export type PushState = "unsupported" | "denied" | "undetermined" | "granted";

export async function pushPermission(): Promise<PushState> {
  if (!Device.isDevice) return "unsupported";
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

/**
 * Asks (if needed), then registers this phone with the server. Returns the
 * resulting permission state. Never throws: push is a nice-to-have next to email.
 */
export async function enablePush({ ask }: { ask: boolean }): Promise<PushState> {
  try {
    if (!Device.isDevice) return "unsupported"; // emulators get no push token
    await ensureChannel(); // Android 13+ shows the permission prompt only once a channel exists
    let state = await pushPermission();
    if (state === "undetermined" && ask) {
      const { status } = await Notifications.requestPermissionsAsync();
      state = status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
    }
    if (state !== "granted") return state;
    const id = projectId();
    if (!id) {
      // No EAS project yet (run `eas init`); the app works without push until then
      if (__DEV__) console.log("[push] no EAS projectId; skipping push registration");
      return state;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await registerToken(token);
    return state;
  } catch (e) {
    if (__DEV__) console.log("[push] enable failed", e);
    return "undetermined";
  }
}

/** Moments where a notification is obviously worth having. Asking then gets far more yeses than at sign-in. */
export type PushMoment = "receipt" | "free-booking" | "waitlist";

const ASKED_KEY = "bbc:push-offered-at";
const ASK_EVERY_MS = 7 * 24 * 3600e3;

const OFFER: Record<PushMoment, { title: string; body: string }> = {
  receipt: {
    title: "Receipt sent",
    body: "An organiser will check it soon. Want a notification on this phone when it's approved?",
  },
  "free-booking": {
    title: "Turn on notifications?",
    body: "Get a reminder before the event and hear right away if anything about your booking changes.",
  },
  waitlist: {
    title: "Get notified when seats free up?",
    body: "A notification reaches you faster than email, and whoever books first gets the tickets.",
  },
};

/**
 * Offers notifications at a moment that explains them. Already allowed: re-registers quietly.
 * Never asked: shows our own explanation first ("Not now" / "Turn on"), and only once a week,
 * so the one-shot system prompt is spent on someone who wants it. Returns true if it showed
 * the explanation, so callers can skip a confirmation alert of their own.
 */
export async function offerPush(moment: PushMoment): Promise<boolean> {
  try {
    const state = await pushPermission();
    if (state === "granted") {
      void enablePush({ ask: false });
      return false;
    }
    if (state !== "undetermined") return false;
    const last = Number((await Storage.getItem(ASKED_KEY)) ?? 0);
    if (Date.now() - last < ASK_EVERY_MS) return false;
    await Storage.setItem(ASKED_KEY, String(Date.now()));
    const { title, body } = OFFER[moment];
    Alert.alert(title, body, [
      { text: "Not now", style: "cancel" },
      { text: "Turn on", onPress: () => void enablePush({ ask: true }) },
    ]);
    return true;
  } catch {
    return false;
  }
}

async function registerToken(token: string) {
  await api("/api/v1/push/register", { body: { token, platform: Platform.OS === "ios" ? "ios" : "android", deviceId: await deviceId() } });
  await SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {});
}

/** Called on sign-out while the session still works, so the old account stops getting this phone's pushes. */
export async function unregisterPush() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await api("/api/v1/push/unregister", { body: { token }, timeoutMs: 4000 }).catch(() => {});
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
}

/** Re-fetches the Expo token after the device token rolls, and registers it again. */
export async function refreshAfterTokenChange() {
  const id = projectId();
  if (!id || (await pushPermission()) !== "granted") return;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    const previous = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
    if (data !== previous) await registerToken(data);
  } catch (e) {
    if (__DEV__) console.log("[push] token refresh failed", e);
  }
}

/** Only app paths we know how to open; anything else lands on the tickets tab. */
export function routeForNotification(data: unknown): string {
  const url = typeof data === "object" && data && "url" in data ? String((data as { url: unknown }).url) : "";
  if (/^\/bookings\/[A-Za-z0-9_-]+$/.test(url)) return url;
  if (/^\/tickets(\/[A-Za-z0-9_-]+)?$/.test(url)) return url;
  if (/^\/events\/[A-Za-z0-9_-]+$/.test(url)) return url;
  return "/tickets";
}
