import { C, buildMatrix, dateLine, drawQr, mountainMark, text, timeLine, truncate, wrap } from "../helpers";
import type { TicketRenderer } from "../types";

export const summit: TicketRenderer = (i) => {
  const W = 600, H = 880;
  const dark = i.theme === "dark";
  const bg = dark ? C.slate : C.cream;
  const fg = dark ? C.fog : C.deepForest;
  const sub = dark ? "#a9bfae" : "#5b7060";
  const m = buildMatrix(i.url);
  const qrSize = 400;
  const qx = (W - qrSize) / 2, qy = 250;
  const logo = 88;

  const svg = `
  <rect width="${W}" height="${H}" rx="32" fill="${bg}"/>
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${C.sky}"/><stop offset=".5" stop-color="${C.skyDeep}"/><stop offset="1" stop-color="${C.night}"/></linearGradient></defs>
  <rect x="0" y="0" width="${W}" height="14" rx="7" fill="url(#g)"/>
  ${text(48, 92, "BAGUIO BASE CAMP", { size: 13, weight: 700, fill: C.grass, spacing: 4 })}
  ${text(48, 138, truncate(i.event.title, 30), { size: i.event.title.length > 22 ? 28 : 34, weight: 700, fill: fg })}
  ${text(48, 172, `${dateLine(i.event.startsAt)} · ${timeLine(i.event.startsAt)}`, { size: 16, fill: sub })}
  ${text(48, 198, truncate(i.event.venueName, 44), { size: 16, fill: sub })}
  ${drawQr(m, {
    x: qx, y: qy, size: qrSize, shape: "square",
    color: () => (dark ? C.fog : C.deepForest),
    finderColors: dark ? [C.sky, C.lime, C.grass] : [C.skyDeep, C.grass, C.pine],
    finderInner: undefined,
    logoFraction: 0.2,
    plate: { color: dark ? C.night : C.white, radius: 20, quiet: 4 },
  })}
  ${mountainMark(W / 2 - logo / 2, qy + qrSize / 2 - logo / 2, logo, { bg: dark ? C.night : C.white })}
  ${text(W / 2, 735, i.shortCode, { size: 34, weight: 700, fill: fg, anchor: "middle", spacing: 3 })}
  ${text(W / 2, 772, truncate(i.holderName, 30), { size: 18, weight: 600, fill: fg, anchor: "middle" })}
  ${text(W / 2, 798, i.tierName, { size: 15, fill: sub, anchor: "middle" })}
  <line x1="48" x2="${W - 48}" y1="826" y2="826" stroke="${dark ? "#3a5560" : "#d9e0d2"}" stroke-dasharray="4 6"/>
  ${text(W / 2, 854, "Show this code at the door · one scan per ticket", { size: 12, fill: sub, anchor: "middle" })}`;
  return { svg: wrap(svg, W, H), width: W, height: H };
};
