/**
 * Builds the app icons and splash image from the brand logo.
 *
 *   node mobile/scripts/generate-assets.mjs
 *
 * Source: public/brand/bbc-logo.png (1685px, transparent corners). Re-run after
 * changing the logo. Uses sharp from the workspace's node_modules.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = (f) => path.join(root, "mobile/assets", f);
const LOGO = path.join(root, "public/brand/bbc-logo.png");
const CREAM = { r: 0xf6, g: 0xf4, b: 0xec, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

/** Logo scaled to `size` px, centred on a `canvas` px square. */
async function placed(canvas, size, background, input = LOGO) {
  const logo = await sharp(input).resize(size, size, { fit: "contain", background: CLEAR }).png().toBuffer();
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background } })
    .composite([{ input: logo, gravity: "center" }])
    .png();
}

/**
 * White-on-transparent silhouette from the logo's alpha (its outlines are
 * transparent cut-outs). The pale clouds would come out half-grey, so
 * near-white pixels become holes too.
 */
async function silhouette(size) {
  const { data, info } = await sharp(LOGO).resize(size, size, { fit: "contain", background: CLEAR }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    // A narrow band keeps edges smooth without leaving the pale clouds half-grey
    const whiteness = Math.min(1, Math.max(0, (min - 205) / 15));
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(data[i + 3] * (1 - whiteness));
  }
  return sharp(data, { raw: info }).png();
}

async function main() {
  // iOS and the store listing: opaque, logo with a margin on cream
  await (await placed(1024, 880, CREAM)).flatten({ background: CREAM }).removeAlpha().toFile(out("icon.png"));

  // Android adaptive icon (108dp canvas, 66dp safe circle = 61% of it): the round logo sits at 59%
  await (await placed(1024, 600, CLEAR)).toFile(out("android-icon-foreground.png"));
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CREAM } }).png().toFile(out("android-icon-background.png"));
  const mono = await (await silhouette(600)).toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: CLEAR } }).composite([{ input: mono, gravity: "center" }]).png().toFile(out("android-icon-monochrome.png"));

  // Splash: logo alone on transparent; the splash plugin supplies the background colour
  await (await placed(1024, 1024, CLEAR)).toFile(out("splash-icon.png"));

  // Android status-bar notification icon: 96px, all white on transparent, small margin
  const small = await (await silhouette(84)).toBuffer();
  await sharp({ create: { width: 96, height: 96, channels: 4, background: CLEAR } }).composite([{ input: small, gravity: "center" }]).png().toFile(out("notification-icon.png"));

  // Web favicon for `expo start --web`
  await (await placed(48, 48, CLEAR)).toFile(out("favicon.png"));
  console.log("assets written to mobile/assets");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
