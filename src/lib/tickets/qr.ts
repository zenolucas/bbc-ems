import QRCode from "qrcode";

export type QrMatrix = { size: number; modules: boolean[][] };

/** Builds the module matrix at error-correction level H (30%) so logos and
 * colouring in the styled renderers stay within tolerance. */
export function qrMatrix(data: string, ecl: "M" | "Q" | "H" = "H"): QrMatrix {
  const qr = QRCode.create(data, { errorCorrectionLevel: ecl });
  const size = qr.modules.size;
  const modules: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) row.push(Boolean(qr.modules.get(y, x)));
    modules.push(row);
  }
  return { size, modules };
}

/** True when (x, y) belongs to one of the three finder patterns (7x7 incl. border). */
export function isFinder(size: number, x: number, y: number) {
  const inTL = x < 7 && y < 7;
  const inTR = x >= size - 7 && y < 7;
  const inBL = x < 7 && y >= size - 7;
  return inTL || inTR || inBL;
}

/** Which finder (0 TL, 1 TR, 2 BL) or -1. */
export function finderIndex(size: number, x: number, y: number) {
  if (x < 7 && y < 7) return 0;
  if (x >= size - 7 && y < 7) return 1;
  if (x < 7 && y >= size - 7) return 2;
  return -1;
}

/** Modules covered by a centred square logo of `fraction` of the width. */
export function isLogoZone(size: number, x: number, y: number, fraction = 0.22) {
  const half = Math.floor((size * fraction) / 2);
  const c = Math.floor(size / 2);
  return Math.abs(x - c) <= half && Math.abs(y - c) <= half;
}
