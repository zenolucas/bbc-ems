import { readFileSync } from "node:fs";
import jsQR from "jsqr";
import { PNG } from "pngjs";

for (const f of process.argv.slice(2)) {
  const png = PNG.sync.read(readFileSync(f));
  // flatten alpha onto white so transparent backgrounds don't confuse the decoder
  const data = new Uint8ClampedArray(png.data.length);
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3] / 255;
    data[i] = Math.round(png.data[i] * a + 255 * (1 - a));
    data[i + 1] = Math.round(png.data[i + 1] * a + 255 * (1 - a));
    data[i + 2] = Math.round(png.data[i + 2] * a + 255 * (1 - a));
    data[i + 3] = 255;
  }
  const r = jsQR(data, png.width, png.height, { inversionAttempts: "dontInvert" });
  console.log(f.split("/").pop(), r ? `OK -> ${r.data.slice(0, 60)}…` : "FAILED to decode");
}
