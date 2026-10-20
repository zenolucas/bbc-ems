/**
 * Deterministic pseudo-random (FNV-1a seed, mulberry32 stream) so stars, contours
 * and ticket decorations render the same on the server and the client, and the
 * same every time for a given seed. Shared by the ticket renderers and <Skyline>.
 */
export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
