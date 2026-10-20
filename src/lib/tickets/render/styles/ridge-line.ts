import { C, buildMatrix, dateLine, drawQr, text, timeLine, truncate, wrap } from "../helpers";
import type { TicketRenderer } from "../types";

/** Dark, scanner-safe bands from the logo's sky down to the deep forest. */
const BANDS = ["#1e6fa3", "#1f6a7a", "#1b5e3b", "#1f7a3e", "#0b3d2e"];

export const ridgeLine: TicketRenderer = (i) => {
  const W = 600, H = 880;
  const dark = i.theme === "dark";
  const bg = dark ? C.night : C.cream;
  const fg = dark ? C.fog : C.deepForest;
  const sub = dark ? "#a9bfae" : "#5b7060";
  const m = buildMatrix(i.url);
  const qrSize = 390;
  const qx = (W - qrSize) / 2, qy = 268;
  const bandColor = (_x: number, y: number, n: number) => BANDS[Math.min(BANDS.length - 1, Math.floor((y / n) * BANDS.length))];

  // Jagged ridge frame around the QR plate
  const top = qy - 40, bottom = qy + qrSize + 40, left = qx - 40, right = qx + qrSize + 40;
  const ridgeTop = `M${left} ${top + 30} L${left + 60} ${top + 4} L${left + 120} ${top + 22} L${left + 200} ${top - 8} L${left + 280} ${top + 14} L${left + 350} ${top - 2} L${left + 420} ${top + 20} L${right} ${top + 6} L${right} ${top + 30} Z`;
  const ridgeBottom = `M${left} ${bottom - 30} L${left + 70} ${bottom + 15} L${left + 150} ${bottom - 20} L${left + 230} ${bottom + 30} L${left + 320} ${bottom - 10} L${left + 400} ${bottom + 25} L${right} ${bottom} L${right} ${bottom - 30} Z`;

  const svg = `
  <rect width="${W}" height="${H}" rx="32" fill="${bg}"/>
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.sky}"/><stop offset="1" stop-color="${C.skyDeep}"/></linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.grass}"/><stop offset="1" stop-color="${C.pine}"/></linearGradient>
  </defs>
  ${text(48, 84, "BAGUIO BASE CAMP", { size: 13, weight: 700, fill: C.skyDeep, spacing: 4 })}
  ${text(48, 128, truncate(i.event.title, 30), { size: i.event.title.length > 22 ? 28 : 34, weight: 700, fill: fg })}
  ${text(48, 162, `${dateLine(i.event.startsAt)} · ${timeLine(i.event.startsAt)}`, { size: 16, fill: sub })}
  ${text(48, 188, truncate(i.event.venueName, 44), { size: 16, fill: sub })}
  <path d="${ridgeTop}" fill="url(#sky)"/>
  <path d="${ridgeBottom}" fill="url(#ground)"/>
  ${drawQr(m, {
    x: qx, y: qy, size: qrSize, shape: "square",
    color: bandColor,
    finderColors: [BANDS[0], BANDS[0], BANDS[4]],
    plate: { color: C.white, radius: 6, quiet: 4 },
  })}
  ${text(W / 2, 760, i.shortCode, { size: 34, weight: 700, fill: fg, anchor: "middle", spacing: 3 })}
  ${text(W / 2, 796, truncate(i.holderName, 30), { size: 18, weight: 600, fill: fg, anchor: "middle" })}
  ${text(W / 2, 822, i.tierName, { size: 15, fill: sub, anchor: "middle" })}
  ${text(W / 2, 856, "one scan per ticket · keep brightness up", { size: 12, fill: sub, anchor: "middle" })}`;
  return { svg: wrap(svg, W, H), width: W, height: H };
};
