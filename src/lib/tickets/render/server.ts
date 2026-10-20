import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import * as bwipjs from "bwip-js/node";
import type { TicketStyle } from "@/db/schema";
import { renderTicketSvg } from "./index";
import type { TicketRenderInput } from "./types";

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");
const FONT_FILES = ["Geist-Regular.ttf", "Geist-SemiBold.ttf", "Geist-Bold.ttf"].map((f) => path.join(FONT_DIR, f));
let fontsChecked: Promise<void> | null = null;
function ensureFonts() {
  // Touching the files keeps them in Vercel's output file trace.
  return (fontsChecked ??= Promise.all(FONT_FILES.map((f) => readFile(f))).then(() => undefined));
}

/** Code 128 barcode as an inline SVG fragment sized for the Trail Pass body. */
export function barcodeSvg(code: string, dark: boolean) {
  const raw = bwipjs.toSVG({
    bcid: "code128",
    text: code.replace(/-/g, ""),
    scale: 2,
    height: 14,
    includetext: false,
    barcolor: dark ? "e8f0e6" : "0b3d2e",
  });
  // bwip-js returns a full <svg …>; make it a sized nested svg so it can be positioned.
  return raw.replace(/<svg([^>]*)>/, (_m: string, attrs: string) => {
    const vb = attrs.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 300 60";
    return `<svg viewBox="${vb}" width="300" height="70" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">`;
  });
}

export function renderTicket(style: TicketStyle, input: Omit<TicketRenderInput, "barcodeSvg">) {
  const withBarcode: TicketRenderInput =
    style === "trail-pass" ? { ...input, barcodeSvg: barcodeSvg(input.shortCode, input.theme === "dark") } : input;
  return renderTicketSvg(style, withBarcode);
}

export async function renderTicketPng(style: TicketStyle, input: Omit<TicketRenderInput, "barcodeSvg">, scale = 2) {
  const { svg, width } = renderTicket(style, input);
  await ensureFonts();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width * scale },
    font: { fontFiles: FONT_FILES, defaultFontFamily: "Geist", loadSystemFonts: false },
    background: "transparent",
  });
  return Buffer.from(resvg.render().asPng());
}
