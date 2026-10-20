import { C, DISPLAY, buildMatrix, dateLine, drawQr, seeded, text, timeLine, truncate, wrap } from "../helpers";
import type { TicketRenderer } from "../types";

export const nightSky: TicketRenderer = (i) => {
  const W = 600, H = 880;
  const m = buildMatrix(i.url);
  const rnd = seeded(i.shortCode);
  const qrSize = 380;
  const qx = (W - qrSize) / 2, qy = 258;
  const stars: string[] = [];
  for (let k = 0; k < 70; k++) {
    const x = rnd() * W, y = rnd() * H;
    // keep stars off the QR window
    if (x > qx - 40 && x < qx + qrSize + 40 && y > qy - 40 && y < qy + qrSize + 40) continue;
    stars.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + rnd() * 1.8).toFixed(1)}" fill="${C.star}" opacity="${(0.4 + rnd() * 0.6).toFixed(2)}"/>`);
  }
  const frame = i.theme === "light" ? `<rect width="${W}" height="${H}" rx="32" fill="${C.cream}"/>` : "";
  const inset = i.theme === "light" ? 10 : 0;

  const svg = `
  ${frame}
  <defs>
    <linearGradient id="day" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.sky}"/><stop offset="1" stop-color="${C.skyDeep}"/></linearGradient>
    <clipPath id="card"><rect x="${inset}" y="${inset}" width="${W - 2 * inset}" height="${H - 2 * inset}" rx="${32 - inset}"/></clipPath>
  </defs>
  <g clip-path="url(#card)">
    <rect width="${W}" height="${H}" fill="${C.night}"/>
    <polygon points="0,0 ${W * 0.62},0 0,${H * 0.46}" fill="url(#day)"/>
    <circle cx="86" cy="96" r="26" fill="${C.sun}"/>
    <circle cx="86" cy="96" r="34" fill="none" stroke="${C.sun}" stroke-width="3" stroke-dasharray="6 10"/>
    ${stars.join("")}
    <circle cx="${W - 96}" cy="120" r="34" fill="${C.star}"/>
    <circle cx="${W - 82}" cy="110" r="30" fill="${C.night}"/>
  </g>
  ${text(48, 176, "BAGUIO BASE CAMP", { size: 13, weight: 700, fill: C.star, spacing: 4 })}
  ${text(48, 216, truncate(i.event.title, 30), { size: i.event.title.length > 22 ? 28 : 34, weight: 800, fill: C.white, family: DISPLAY })}
  ${drawQr(m, {
    x: qx, y: qy, size: qrSize, shape: "dot",
    color: () => C.night,
    finderColors: [C.night, C.night, C.night],
    finderInner: C.skyDeep,
    plate: { color: C.cream, radius: 28, quiet: 4 },
  })}
  ${text(W / 2, 708, i.shortCode, { size: 36, weight: 800, fill: C.star, anchor: "middle", spacing: 3, family: DISPLAY })}
  ${text(W / 2, 744, truncate(i.holderName, 30), { size: 22, weight: 700, fill: C.white, anchor: "middle", family: DISPLAY })}
  ${text(W / 2, 770, `${i.tierName} · ${dateLine(i.event.startsAt)} · ${timeLine(i.event.startsAt)}`, { size: 14, fill: "#a9bfae", anchor: "middle" })}
  ${text(W / 2, 794, truncate(i.event.venueName, 44), { size: 14, fill: "#a9bfae", anchor: "middle" })}
  <path d="M0 ${H - 40} L70 ${H - 72} L130 ${H - 50} L210 ${H - 82} L290 ${H - 55} L360 ${H - 76} L440 ${H - 46} L520 ${H - 68} L600 ${H - 44} L600 ${H} L0 ${H} Z" fill="${C.pine}" clip-path="url(#card)"/>
  <path d="M0 ${H - 20} L90 ${H - 44} L180 ${H - 26} L280 ${H - 50} L380 ${H - 28} L480 ${H - 46} L600 ${H - 24} L600 ${H} L0 ${H} Z" fill="${C.deepForest}" clip-path="url(#card)"/>
  ${text(W / 2, 850, "one scan per ticket", { size: 12, fill: C.sage, anchor: "middle" })}`;
  return { svg: wrap(svg, W, H), width: W, height: H };
};
