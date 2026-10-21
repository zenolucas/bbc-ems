import { customAlphabet } from "nanoid";
import { SHORT_CODE_ALPHABET } from "@bbc/shared/shortcode";

export { normalizeShortCode } from "@bbc/shared/shortcode";

const gen = customAlphabet(SHORT_CODE_ALPHABET, 8);

export function generateShortCode() {
  const raw = gen();
  return `BBC-${raw.slice(0, 4)}-${raw.slice(4)}`;
}
