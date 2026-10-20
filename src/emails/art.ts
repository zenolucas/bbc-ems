import { seeded } from "../lib/seeded";

/**
 * Source art for the email images. Gmail strips inline <svg> and Outlook desktop
 * never draws it, so the emails reference PNGs rendered once from these SVGs by
 * `pnpm exec tsx src/emails/build-assets.ts` (written to public/brand/email/).
 * Edit here, re-run the script, commit the PNGs.
 */
export type EmailScene = "day" | "night";

/** Where the rendered PNGs live under public/, and their display sizes. */
export const EMAIL_ART = {
  header: { day: "/brand/email/header-day.png", night: "/brand/email/header-night.png", width: 560, height: 112 },
  qrTile: { src: "/brand/email/qr-tile.png", size: 44 },
} as const;

/** The sky colour behind each header, so the band still reads when images are blocked. */
export const HEADER_BG: Record<EmailScene, string> = { day: "#3cc5e8", night: "#0e1c20" };

const FAR = "M0 112V70L60 44L130 72L220 30L310 76L400 46L490 80L560 56V112Z";
const NEAR = "M0 112V92L80 80L170 100L270 72L370 98L460 78L560 96V112Z";
/** Pine tips standing on the near ridge, in 560×112 units. */
const PINES: [number, number][] = [
  [110, 74],
  [126, 77],
  [282, 62],
  [298, 66],
  [470, 67],
  [486, 70],
];

function pine(x: number, y: number) {
  return `M${x} ${y}l-5 13h10z M${x} ${y - 7}l-3.6 9.4h7.2z`;
}

/** The 560×112 Skyline strip with the logo lockup: day for bookings, night for sign-in. */
export function headerSvg(scene: EmailScene, logoHref: string) {
  const day = scene === "day";
  const c = day
    ? { far: "#8cc63e", near: "#39b54a", pine: "#1b5e3b", text: "#0b3d2e" }
    : { far: "#244d3a", near: "#17422f", pine: "#0b3d2e", text: "#ffffff" };
  const rnd = seeded("email-header");
  const stars = Array.from({ length: 16 }, () => ({ x: 200 + rnd() * 360, y: 8 + rnd() * 52, r: 0.7 + rnd() * 1, o: 0.5 + rnd() * 0.5 }));

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="560" height="112" viewBox="0 0 560 112">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      ${day ? `<stop offset="0" stop-color="#3cc5e8"/><stop offset="1" stop-color="#9fe0f3"/>` : `<stop offset="0" stop-color="#0b161a"/><stop offset="1" stop-color="#1f4a5c"/>`}
    </linearGradient>
    <mask id="moon"><rect width="560" height="112" fill="#fff"/><circle cx="507" cy="29" r="12" fill="#000"/></mask>
  </defs>
  <rect width="560" height="112" fill="url(#sky)"/>
  ${
    day
      ? `<circle cx="488" cy="34" r="13" fill="#f7e017"/>
  <circle cx="488" cy="34" r="19" fill="none" stroke="#f7e017" stroke-width="1.6" stroke-dasharray="3 5"/>
  <g fill="#ffffff" opacity="0.92">
    <ellipse cx="392" cy="30" rx="26" ry="7"/><ellipse cx="404" cy="24" rx="14" ry="8"/><ellipse cx="380" cy="26" rx="11" ry="6"/>
    <ellipse cx="262" cy="18" rx="16" ry="5"/><ellipse cx="270" cy="14" rx="9" ry="5"/>
  </g>`
      : `<g fill="#f5f0a0">${stars.map((s) => `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${s.r.toFixed(2)}" opacity="${s.o.toFixed(2)}"/>`).join("")}</g>
  <circle cx="500" cy="34" r="14" fill="#f5f0a0" mask="url(#moon)"/>`
  }
  <path d="${FAR}" fill="${c.far}"/>
  <path d="${NEAR}" fill="${c.near}"/>
  <g fill="${c.pine}">${PINES.map(([x, y]) => `<path d="${pine(x, y)}"/>`).join("")}</g>
  <image x="24" y="22" width="40" height="40" xlink:href="${logoHref}"/>
  <text x="74" y="47.5" font-family="Geist" font-size="16" font-weight="700" fill="${c.text}">Baguio Base Camp</text>
</svg>`;
}

/** The white 44×44 tile with a QR glyph that leads each ticket stub. */
export function qrTileSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
  <rect x="0.5" y="0.5" width="43" height="43" rx="8" fill="#ffffff" stroke="#0b3d2e" stroke-opacity="0.14"/>
  <g transform="translate(11 11)" fill="none" stroke="#1b5e3b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
    <path d="M14 14h3v3M21 14v3M14 21h3M21 21h.01"/>
  </g>
</svg>`;
}
