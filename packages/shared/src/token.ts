/**
 * Ticket token format (URL-safe, fits comfortably in a version 6-8 QR):
 *   v1.<ticketId>.<eventId>.<signature>
 * Signature: ECDSA P-256 / SHA-256 over `ticketId|eventId` (raw r||s, base64url).
 * The same module runs on the server (issuing + verifying), in the browser
 * scanner and in the mobile app (offline verification). The CryptoKey helpers
 * use Web Crypto; React Native has none, so it passes its own `Verifier`.
 */
export const TOKEN_VERSION = "v1";

export type TicketTokenParts = { version: string; ticketId: string; eventId: string; signature: string };

const enc = new TextEncoder();

export function signingInput(ticketId: string, eventId: string): Uint8Array<ArrayBuffer> {
  const bytes = enc.encode(`${ticketId}|${eventId}`);
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  out.set(bytes);
  return out;
}

export function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeJwk(b64: string): JsonWebKey {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(b64)));
}

export async function importPrivateKey(b64jwk: string) {
  return crypto.subtle.importKey("jwk", decodeJwk(b64jwk), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export async function importPublicKey(b64jwk: string) {
  return crypto.subtle.importKey("jwk", decodeJwk(b64jwk), { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
}

export async function signTicket(key: CryptoKey, ticketId: string, eventId: string) {
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, signingInput(ticketId, eventId));
  return bytesToB64url(new Uint8Array(sig));
}

/** Checks a raw r||s P-256 signature over `message` (SHA-256 is the verifier's job). */
export type Verifier = (signature: Uint8Array, message: Uint8Array) => boolean | Promise<boolean>;

export async function verifyWith(verify: Verifier, parts: TicketTokenParts) {
  try {
    return await verify(b64urlToBytes(parts.signature), signingInput(parts.ticketId, parts.eventId));
  } catch {
    return false;
  }
}

export function webCryptoVerifier(key: CryptoKey): Verifier {
  return (signature, message) =>
    crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature as Uint8Array<ArrayBuffer>, message as Uint8Array<ArrayBuffer>);
}

export async function verifyTicketSignature(key: CryptoKey, parts: TicketTokenParts) {
  return verifyWith(webCryptoVerifier(key), parts);
}

export function encodeToken(parts: Omit<TicketTokenParts, "version">) {
  return `${TOKEN_VERSION}.${parts.ticketId}.${parts.eventId}.${parts.signature}`;
}

/** Accepts a bare token or a full ticket URL (…/t/<token>). */
export function parseToken(input: string): TicketTokenParts | null {
  let raw = input.trim();
  const m = raw.match(/\/t\/([^/?#]+)/);
  if (m) raw = decodeURIComponent(m[1]);
  const parts = raw.split(".");
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) return null;
  const [version, ticketId, eventId, signature] = parts;
  if (!ticketId || !eventId || !signature) return null;
  return { version, ticketId, eventId, signature };
}

export function ticketUrl(appUrl: string, token: string) {
  return `${appUrl.replace(/\/$/, "")}/t/${token}`;
}
