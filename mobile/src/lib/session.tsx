import type { MeDTO } from "@bbc/shared/api-types";
import * as SecureStore from "expo-secure-store";
import Storage from "expo-sqlite/kv-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { api, ApiError, setApiToken, setUnauthorizedHandler } from "./api";

const TOKEN_KEY = "bbc.session";
const ME_KEY = "bbc:me";

type Status = "loading" | "signedOut" | "signedIn";

type SessionValue = {
  status: Status;
  me: MeDTO | null;
  isStaff: boolean;
  isAdmin: boolean;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, otp: string) => Promise<MeDTO>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  /** Optimistic local update after PATCH /me. */
  setMe: (me: MeDTO) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

type Hook = () => Promise<unknown> | void;
const beforeSignOut = new Set<Hook>();
const afterSignOut = new Set<Hook>();

/** Runs while the token still works (e.g. unregister this phone's push token). */
export function onBeforeSignOut(fn: Hook) {
  beforeSignOut.add(fn);
  return () => void beforeSignOut.delete(fn);
}
/** Runs after the token is gone (e.g. wipe cached tickets). */
export function onAfterSignOut(fn: Hook) {
  afterSignOut.add(fn);
  return () => void afterSignOut.delete(fn);
}

async function runHooks(hooks: Set<Hook>) {
  // Never let a slow or offline hook keep someone signed in
  await Promise.all([...hooks].map((h) => Promise.race([Promise.resolve().then(h).catch(() => {}), new Promise((r) => setTimeout(r, 4000))])));
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMeState] = useState<MeDTO | null>(null);
  const signingOut = useRef(false);

  const setMe = useCallback((m: MeDTO) => {
    setMeState(m);
    Storage.setItem(ME_KEY, JSON.stringify(m)).catch(() => {});
  }, []);

  const clearLocal = useCallback(async () => {
    setApiToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await Storage.removeItem(ME_KEY).catch(() => {});
    setMeState(null);
    setStatus("signedOut");
    await runHooks(afterSignOut);
  }, []);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      await runHooks(beforeSignOut);
      await api("/api/auth/sign-out", { method: "POST", body: {}, timeoutMs: 5000 }).catch(() => {});
      await clearLocal();
    } finally {
      signingOut.current = false;
    }
  }, [clearLocal]);

  const refreshMe = useCallback(async () => {
    try {
      setMe(await api<MeDTO>("/api/v1/me"));
    } catch (e) {
      // Offline: keep the cached profile so tickets still open. 401 is handled by the unauthorized hook.
      if (!(e instanceof ApiError)) throw e;
    }
  }, [setMe]);

  // Restore on launch: token from the keystore, profile from the cache (works with no signal)
  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      if (!token) return setStatus("signedOut");
      setApiToken(token);
      const cached = await Storage.getItem(ME_KEY).catch(() => null);
      if (cached) setMeState(JSON.parse(cached));
      setStatus("signedIn");
      refreshMe();
    })();
  }, [refreshMe]);

  useEffect(() => {
    // The server revoked the session (signed out elsewhere, expired): drop it here too.
    setUnauthorizedHandler(() => void clearLocal());
    return () => setUnauthorizedHandler(null);
  }, [clearLocal]);

  // Role changes (an organiser invites you to the door crew) show up when the app comes back
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && status === "signedIn") refreshMe();
    });
    return () => sub.remove();
  }, [status, refreshMe]);

  const sendCode = useCallback(async (email: string) => {
    await api("/api/auth/email-otp/send-verification-otp", { body: { email: email.trim().toLowerCase(), type: "sign-in" } });
  }, []);

  const verifyCode = useCallback(
    async (email: string, otp: string) => {
      const res = await api<Response>("/api/auth/sign-in/email-otp", { body: { email: email.trim().toLowerCase(), otp }, raw: true });
      const token = res.headers.get("set-auth-token");
      if (!token) throw new ApiError(500, "Signed in, but the server sent no session. Try again.");
      setApiToken(token);
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      const profile = await api<MeDTO>("/api/v1/me");
      setMe(profile);
      setStatus("signedIn");
      return profile;
    },
    [setMe],
  );

  const value = useMemo<SessionValue>(
    () => ({
      status,
      me,
      isStaff: me?.role === "staff" || me?.role === "admin",
      isAdmin: me?.role === "admin",
      sendCode,
      verifyCode,
      signOut,
      refreshMe,
      setMe,
    }),
    [status, me, sendCode, verifyCode, signOut, refreshMe, setMe],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const v = useContext(SessionContext);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
