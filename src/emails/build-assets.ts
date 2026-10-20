/*
 * Renders the email art in ./art.ts to PNGs at 2x under public/brand/email/.
 * Run after changing the art: `pnpm exec tsx src/emails/build-assets.ts`.
 * The PNGs are committed; emails link to them by absolute URL on the app.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { EMAIL_ART, headerSvg, qrTileSvg } from "./art";

const root = process.cwd();
const fonts = path.join(root, "src", "assets", "fonts");
const logo = `data:image/png;base64,${readFileSync(path.join(root, "public", "brand", "icon-192.png")).toString("base64")}`;

function png(svg: string, width: number) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: width * 2 },
    font: { fontFiles: [path.join(fonts, "Geist-Bold.ttf")], defaultFontFamily: "Geist", loadSystemFonts: false },
  })
    .render()
    .asPng();
}

function write(publicPath: string, data: Buffer) {
  const file = path.join(root, "public", publicPath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(`wrote ${path.relative(root, file)}`);
}

for (const scene of ["day", "night"] as const) write(EMAIL_ART.header[scene], png(headerSvg(scene, logo), EMAIL_ART.header.width));
write(EMAIL_ART.qrTile.src, png(qrTileSvg(), EMAIL_ART.qrTile.size));
