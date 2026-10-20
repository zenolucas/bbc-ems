/*
 * Renders every ticket style in both themes from the sample token, writes the
 * PNGs to .smoke/tickets/ and decodes each one. Fails if any QR stops decoding,
 * so font or layout changes to the renderers can't silently break scanning.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { TICKET_STYLES } from "../src/db/schema";
import { renderTicketPng } from "../src/lib/tickets/render/server";
import { sampleTicket } from "../src/lib/tickets/sample";

const out = path.join(process.cwd(), ".smoke", "tickets");
mkdirSync(out, { recursive: true });

function decode(buf: Buffer) {
  const png = PNG.sync.read(buf);
  // flatten alpha onto white so transparent backgrounds don't confuse the decoder
  const data = new Uint8ClampedArray(png.data.length);
  for (let i = 0; i < png.data.length; i += 4) {
    const a = png.data[i + 3] / 255;
    data[i] = Math.round(png.data[i] * a + 255 * (1 - a));
    data[i + 1] = Math.round(png.data[i + 1] * a + 255 * (1 - a));
    data[i + 2] = Math.round(png.data[i + 2] * a + 255 * (1 - a));
    data[i + 3] = 255;
  }
  // No inversion on purpose: the door scanner (@zxing/browser) only reads dark-on-light
  // codes, so every style, in both themes, must decode that way.
  return jsQR(data, png.width, png.height, { inversionAttempts: "dontInvert" })?.data ?? null;
}

async function main() {
  for (const style of TICKET_STYLES) {
    for (const theme of ["light", "dark"] as const) {
      const input = sampleTicket(theme, "http://localhost:3100");
      const png = await renderTicketPng(style, input);
      const file = path.join(out, `bbc-${style}-${theme}.png`);
      writeFileSync(file, png);
      const decoded = decode(png);
      const ok = decoded === input.url;
      console.log(`${ok ? "PASS" : "FAIL"} ${style} ${theme} ${ok ? "" : `-> ${decoded ?? "no QR found"}`}`);
      if (!ok) process.exitCode = 1;
    }
  }
  console.log(`PNGs in ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
