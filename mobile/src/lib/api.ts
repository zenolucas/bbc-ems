import { API_URL } from "./config";

/** A failed API call. `status` 0 means the request never got an answer (offline, timeout). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
  get offline() {
    return this.status === 0;
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

/**
 * Demo: pretend the door has no signal. Scanner calls (/api/scan/*) fail as if offline,
 * so check-ins queue on the phone and sync when it's switched back off. Not persisted.
 */
let simulatedOffline = false;
const offlineListeners = new Set<(v: boolean) => void>();

export function isSimulatedOffline() {
  return simulatedOffline;
}
export function setSimulatedOffline(v: boolean) {
  simulatedOffline = v;
  offlineListeners.forEach((fn) => fn(v));
}
export function subscribeSimulatedOffline(fn: (v: boolean) => void) {
  offlineListeners.add(fn);
  return () => void offlineListeners.delete(fn);
}

export function setApiToken(t: string | null) {
  token = t;
}
export function getApiToken() {
  return token;
}
/** Called once when a signed-in request comes back 401 (session revoked or expired). */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** JSON body. */
  body?: unknown;
  /** Multipart body (uploads). */
  form?: FormData;
  timeoutMs?: number;
  /** Returns the raw Response (to read headers) instead of parsed JSON. */
  raw?: boolean;
};

/** Headers every request carries. Exported for downloads and the WebView. */
export function baseHeaders(): Record<string, string> {
  return {
    // better-auth's sign-in CSRF check accepts this trusted origin (src/lib/auth.ts on the server)
    Origin: "bbcems://",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  if (simulatedOffline && path.startsWith("/api/scan/")) throw new ApiError(0, "No connection (simulated for the demo).");
  const headers: Record<string, string> = baseHeaders();
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: ctrl.signal,
    });
  } catch (e) {
    // Also catches bad request bodies, which would otherwise look like a lost signal while developing
    if (__DEV__) console.warn("[api]", path, e);
    throw new ApiError(0, "No connection. Check your signal and try again.");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 && token) onUnauthorized?.();
  if (opts.raw) {
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    return res as T;
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("json") ? await res.json() : null) as T;
}

async function errorMessage(res: Response) {
  try {
    const data = await res.json();
    // better-auth answers { message, code }; our routes answer { error }
    if (data?.error) return String(data.error);
    if (data?.message) return String(data.message);
  } catch {}
  if (res.status === 429) return "Too many tries. Wait a minute and try again.";
  if (res.status >= 500) return "Something went wrong on our side. Try again in a moment.";
  return `Request failed (${res.status})`;
}
