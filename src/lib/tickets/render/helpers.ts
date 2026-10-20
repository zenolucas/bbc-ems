import { format } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { finderIndex, isLogoZone, type QrMatrix, qrMatrix } from "../qr";

export const C = {
  sky: "#3cc5e8",
  skyDeep: "#1e6fa3",
  lime: "#8cc63e",
  grass: "#39b54a",
  forest: "#1f9a3e",
  pine: "#1b5e3b",
  deepForest: "#0b3d2e",
  night: "#1c2f34",
  slate: "#27404a",
  sun: "#f7e017",
  star: "#f5f0a0",
  cream: "#f6f4ec",
  fog: "#e8f0e6",
  sage: "#9db58a",
  moss: "#4f7942",
  white: "#ffffff",
};

export const FONT = `Geist, 'Geist Sans', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif`;
export const MONO = `'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace`;
/** Display face for event titles, short codes and holder names (the web UI's headline font). */
export const DISPLAY = `'Bricolage Grotesque', Geist, 'Geist Sans', Inter, system-ui, sans-serif`;

export function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export function dateLine(d: Date) {
  return format(new TZDate(d, "Asia/Manila"), "EEE, MMM d, yyyy");
}
export function timeLine(d: Date) {
  return format(new TZDate(d, "Asia/Manila"), "h:mm a");
}

export type ModuleShape = "square" | "dot" | "rounded";

export type QrDrawOptions = {
  x: number;
  y: number;
  /** Rendered side length of the QR (excluding quiet zone). */
  size: number;
  shape?: ModuleShape;
  /** Colour for a data module; return null to skip. */
  color?: (mx: number, my: number, n: number) => string | null;
  /** Finder colours per index (TL, TR, BL). */
  finderColors?: [string, string, string];
  finderInner?: string;
  /** Reserve a centre square (fraction of width) for a logo. */
  logoFraction?: number;
  /** Render a light backing plate behind the QR including the quiet zone. */
  plate?: { color: string; radius?: number; quiet?: number };
};

/** Draws a QR from a matrix as SVG markup, with finder patterns drawn as clean shapes. */
export function drawQr(m: QrMatrix, o: QrDrawOptions) {
  const n = m.size;
  const unit = o.size / n;
  const shape = o.shape ?? "square";
  const color = o.color ?? (() => C.deepForest);
  const fc = o.finderColors ?? [C.deepForest, C.deepForest, C.deepForest];
  const parts: string[] = [];

  if (o.plate) {
    const q = (o.plate.quiet ?? 4) * unit;
    parts.push(
      `<rect x="${o.x - q}" y="${o.y - q}" width="${o.size + 2 * q}" height="${o.size + 2 * q}" rx="${o.plate.radius ?? 0}" fill="${o.plate.color}"/>`,
    );
  }

  // Data modules
  const r = unit / 2;
  for (let my = 0; my < n; my++) {
    for (let mx = 0; mx < n; mx++) {
      if (!m.modules[my][mx]) continue;
      if (finderIndex(n, mx, my) !== -1) continue;
      if (o.logoFraction && isLogoZone(n, mx, my, o.logoFraction)) continue;
      const fill = color(mx, my, n);
      if (!fill) continue;
      const px = o.x + mx * unit;
      const py = o.y + my * unit;
      if (shape === "dot") {
        parts.push(`<circle cx="${(px + r).toFixed(2)}" cy="${(py + r).toFixed(2)}" r="${(r * 0.92).toFixed(2)}" fill="${fill}"/>`);
      } else if (shape === "rounded") {
        parts.push(`<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${(unit * 1.02).toFixed(2)}" height="${(unit * 1.02).toFixed(2)}" rx="${(unit * 0.3).toFixed(2)}" fill="${fill}"/>`);
      } else {
        // Slight overdraw avoids hairline gaps between adjacent modules when rasterised.
        parts.push(`<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${(unit * 1.03).toFixed(2)}" height="${(unit * 1.03).toFixed(2)}" fill="${fill}"/>`);
      }
    }
  }

  // Finder patterns: 7x7 outer, 5x5 light, 3x3 inner.
  const finders: [number, number][] = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ];
  finders.forEach(([fx, fy], i) => {
    const px = o.x + fx * unit;
    const py = o.y + fy * unit;
    const rad = shape === "square" ? 0 : unit * 1.2;
    const innerRad = shape === "square" ? 0 : unit * 0.6;
    parts.push(
      `<rect x="${px}" y="${py}" width="${7 * unit}" height="${7 * unit}" rx="${rad}" fill="${fc[i]}"/>`,
      `<rect x="${px + unit}" y="${py + unit}" width="${5 * unit}" height="${5 * unit}" rx="${rad * 0.7}" fill="${o.plate?.color ?? C.white}"/>`,
      `<rect x="${px + 2 * unit}" y="${py + 2 * unit}" width="${3 * unit}" height="${3 * unit}" rx="${innerRad}" fill="${o.finderInner ?? fc[i]}"/>`,
    );
  });

  return parts.join("");
}

export function buildMatrix(url: string) {
  return qrMatrix(url, "H");
}

/** The BBC mountain mark, sized to fit a `size` square at (x, y). */
export function mountainMark(x: number, y: number, size: number, opts: { bg?: string; ring?: string } = {}) {
  const s = size / 100;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="50" cy="50" r="50" fill="${opts.bg ?? C.white}"/>
    <circle cx="50" cy="50" r="44" fill="none" stroke="${opts.ring ?? C.sky}" stroke-width="5"/>
    <path d="M12 70 L34 32 L45 50 L51 41 L60 56 L70 45 L90 70 Z" fill="${C.grass}"/>
    <path d="M12 70 L34 32 L45 50 L39 58 L47 70 Z" fill="${C.lime}"/>
    <path d="M60 56 L70 45 L90 70 L75 70 Z" fill="${C.forest}"/>
    <rect x="12" y="72" width="78" height="5" fill="${C.pine}"/>
    <circle cx="28" cy="26" r="5" fill="${C.sun}"/>
  </g>`;
}

/** Deterministic pseudo-random for stars/contours so a ticket always renders the same. */
export { seeded } from "@/lib/seeded";

export function wrap(svgInner: string, width: number, height: number, extraAttrs = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="${FONT}" ${extraAttrs}>${svgInner}</svg>`;
}

export function text(
  x: number,
  y: number,
  s: string,
  o: { size: number; weight?: number | string; fill?: string; anchor?: "start" | "middle" | "end"; spacing?: number; family?: string; opacity?: number } ,
) {
  return `<text x="${x}" y="${y}" font-size="${o.size}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? C.deepForest}" text-anchor="${o.anchor ?? "start"}"${o.spacing ? ` letter-spacing="${o.spacing}"` : ""}${o.family ? ` font-family="${o.family}"` : ""}${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}>${esc(s)}</text>`;
}
