/** Crockford base32 without I, L, O, U to avoid misreads at the door. */
export const SHORT_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Normalises user-typed codes: case, confusable letters, missing dashes. */
export function normalizeShortCode(input: string) {
  const cleaned = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/^BBC/, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/U/g, "V");
  if (cleaned.length !== 8) return null;
  return `BBC-${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}
