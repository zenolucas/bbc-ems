import Constants from "expo-constants";

/**
 * The Next app. EXPO_PUBLIC_API_URL is inlined at build time (see eas.json).
 * In development the Android emulator reaches the host's localhost at 10.0.2.2.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3100").replace(/\/$/, "");

export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

/** Added to the WebView user agent; the web admin hides its own account menu when it sees it. */
export const WEBVIEW_UA_SUFFIX = `BBCApp/${APP_VERSION}`;
