import { C, buildMatrix, dateLine, drawQr, esc, text, truncate, wrap } from "../helpers";
import type { TicketRenderer } from "../types";

export const campfireStamp: TicketRenderer = (i) => {
  const W = 700, H = 760;
  const dark = i.theme === "dark";
  const bg = dark ? C.night : C.cream;
  const fg = dark ? C.fog : C.deepForest;
  const sub = dark ? "#a9bfae" : "#5b7060";
  const m = buildMatrix(i.url);
  const cx = W / 2, cy = 330;
  const R = 300; // outer ring
  const qrSize = 300; // fits inside r≈225 circle (300/√2 ≈ 212)
  const qx = cx - qrSize / 2, qy = cy - qrSize / 2 - 10;
  const ringText = `BAGUIO BASE CAMP  •  ${truncate(i.event.title, 34).toUpperCase()}  •  `;
  const textR = R - 36;

  const svg = `
  <rect width="${W}" height="${H}" rx="32" fill="${bg}"/>
  <defs>
    <path id="ring" d="M ${cx} ${cy - textR} a ${textR} ${textR} 0 1 1 -0.01 0"/>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="${C.skyDeep}"/>
  <circle cx="${cx}" cy="${cy}" r="${R - 10}" fill="${C.sky}"/>
  <circle cx="${cx}" cy="${cy}" r="${R - 18}" fill="${dark ? C.slate : C.white}"/>
  <circle cx="${cx}" cy="${cy}" r="${R - 56}" fill="none" stroke="${C.grass}" stroke-width="8"/>
  <circle cx="${cx}" cy="${cy}" r="${R - 68}" fill="${C.white}"/>
  <text font-size="22" font-weight="700" fill="${fg}" letter-spacing="3"><textPath href="#ring" startOffset="0">${esc(ringText + ringText)}</textPath></text>
  ${drawQr(m, {
    x: qx, y: qy, size: qrSize, shape: "square",
    color: () => "#111111",
    finderColors: ["#111111", "#111111", "#111111"],
    plate: { color: C.white, radius: 0, quiet: 3 },
  })}
  ${text(cx, qy + qrSize + 46, i.shortCode, { size: 24, weight: 700, fill: "#111111", anchor: "middle", spacing: 3 })}
  ${text(cx, 686, truncate(i.holderName, 30), { size: 18, weight: 600, fill: fg, anchor: "middle" })}
  ${text(cx, 712, `${i.tierName} · ${dateLine(i.event.startsAt)} · ${truncate(i.event.venueName, 30)}`, { size: 14, fill: sub, anchor: "middle" })}
  ${text(cx, 740, "one scan per ticket", { size: 12, fill: sub, anchor: "middle" })}`;
  return { svg: wrap(svg, W, H), width: W, height: H };
};
