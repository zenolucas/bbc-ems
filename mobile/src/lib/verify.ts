import { p256 } from "@noble/curves/nist.js";
import { b64urlToBytes, type Verifier } from "@bbc/shared/token";

/** Base64url JWK → object. Hand-rolled because Hermes' TextDecoder support varies; JWKs are ASCII. */
function decodeJwkAscii(b64: string): { x?: string; y?: string } {
  let s = "";
  for (const b of b64urlToBytes(b64)) s += String.fromCharCode(b);
  return JSON.parse(s);
}

/**
 * Offline ticket check for React Native, which has no Web Crypto. Takes the
 * manifest's public key (base64url JWK) and checks raw r||s P-256 signatures.
 *
 * `lowS: false` matters: Web Crypto on the server signs with either S, so with
 * noble's default (low-S only) about half of all real tickets would read as forged.
 */
export function nobleVerifier(publicKeyB64Jwk: string): Verifier {
  const jwk = decodeJwkAscii(publicKeyB64Jwk);
  if (!jwk.x || !jwk.y) throw new Error("Not an EC public key");
  const x = b64urlToBytes(jwk.x);
  const y = b64urlToBytes(jwk.y);
  const point = new Uint8Array(65);
  point[0] = 0x04;
  point.set(x, 1);
  point.set(y, 33);
  return (signature, message) => p256.verify(signature, message, point, { prehash: true, lowS: false, format: "compact" });
}
