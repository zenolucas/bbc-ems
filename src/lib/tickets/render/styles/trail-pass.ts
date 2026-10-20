import { C, DISPLAY, buildMatrix, dateLine, drawQr, seeded, text, timeLine, truncate, wrap } from "../helpers";
import type { TicketRenderer } from "../types";

function contours(seed: string, w: number, h: number) {
  const rnd = seeded(seed);
  const out: string[] = [];
  for (let k = 0; k < 9; k++) {
    const cy = 40 + k * (h / 9) + rnd() * 20;
    const amp = 18 + rnd() * 30;
    let d = `M -20 ${cy}`;
    for (let x = 0; x <= w + 40; x += 60) {
      const y = cy + Math.sin((x / w) * Math.PI * (1.5 + rnd())) * amp + (rnd() - 0.5) * 10;
      d += ` L ${x} ${y.toFixed(1)}`;
    }
    out.push(`<path d="${d}" fill="none" stroke="${C.sage}" stroke-width="1.2" opacity="0.5"/>`);
  }
  return out.join("");
}

export const trailPass: TicketRenderer = (i) => {
  const W = 1000, H = 420;
  const dark = i.theme === "dark";
  const bodyW = 690;
  const bg = dark ? C.slate : C.cream;
  const fg = dark ? C.fog : C.deepForest;
  const sub = dark ? "#a9bfae" : "#5b7060";
  const m = buildMatrix(i.url);
  const qrSize = 220;
  const qx = bodyW + (W - bodyW - qrSize) / 2, qy = 70;

  const accent = dark ? C.lime : C.pine;
  const field = (x: number, y: number, label: string, value: string, size = 20) =>
    text(x, y, label, { size: 11, weight: 700, fill: accent, spacing: 2 }) + text(x, y + 26, value, { size, weight: 600, fill: fg });

  const notch = (cx: number, cy: number) => `<circle cx="${cx}" cy="${cy}" r="16" fill="${dark ? C.night : "#dfe6d8"}"/>`;

  const svg = `
  <defs><clipPath id="c"><rect width="${W}" height="${H}" rx="26"/></clipPath></defs>
  <g clip-path="url(#c)">
    <rect width="${W}" height="${H}" fill="${bg}"/>
    ${contours(i.shortCode, bodyW, H)}
    <rect x="${bodyW}" y="0" width="${W - bodyW}" height="${H}" fill="${dark ? C.night : C.white}"/>
    <rect x="0" y="0" width="${bodyW}" height="12" fill="${C.grass}"/>
    <rect x="${bodyW}" y="0" width="${W - bodyW}" height="12" fill="${C.skyDeep}"/>
    <line x1="${bodyW}" x2="${bodyW}" y1="0" y2="${H}" stroke="${sub}" stroke-width="2" stroke-dasharray="6 8"/>
    ${notch(bodyW, 0)}${notch(bodyW, H)}
  </g>
  ${text(44, 60, "TRAIL PASS · BAGUIO BASE CAMP", { size: 12, weight: 700, fill: accent, spacing: 3 })}
  ${text(44, 104, truncate(i.event.title, 36), { size: i.event.title.length > 26 ? 28 : 34, weight: 800, fill: fg, family: DISPLAY })}
  ${field(44, 160, "HOLDER", truncate(i.holderName, 24))}
  ${field(360, 160, "TIER", truncate(i.tierName, 20))}
  ${field(44, 232, "DATE", dateLine(i.event.startsAt))}
  ${field(360, 232, "TIME", timeLine(i.event.startsAt))}
  ${field(44, 304, "VENUE", truncate(i.event.venueName, 40), 18)}
  ${i.barcodeSvg ? `<g transform="translate(360 300)">${i.barcodeSvg}</g>` : ""}
  ${text(44, 392, i.shortCode, { size: 15, weight: 700, fill: sub, spacing: 2, family: DISPLAY })}
  ${drawQr(m, {
    x: qx, y: qy, size: qrSize, shape: "square",
    // Dark modules on a white plate in both themes; the scanner does not read inverted codes.
    color: () => C.deepForest,
    finderColors: [C.skyDeep, C.grass, C.pine],
    plate: { color: C.white, radius: dark ? 12 : 0, quiet: 3 },
  })}
  ${text(bodyW + (W - bodyW) / 2, 340, i.shortCode, { size: 24, weight: 800, fill: fg, anchor: "middle", spacing: 2, family: DISPLAY })}
  ${text(bodyW + (W - bodyW) / 2, 368, "scan at the door", { size: 12, fill: sub, anchor: "middle" })}`;
  return { svg: wrap(svg, W, H), width: W, height: H };
};
