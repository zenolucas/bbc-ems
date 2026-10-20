import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import sharp from "sharp";
import { getEventBySlug } from "@/lib/events";
import { fmtRange } from "@/lib/format";
import { priceSummary } from "@/components/event/event-card";

export const alt = "Event";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori renders only the fonts it is handed: Geist for the eyebrow, Bricolage for the rest.
// The meta line is Bricolage too: Satori mis-measures some Geist words ("Ketchup", "Yangbew")
// and leaves a double-width gap after them.
const fontDir = join(process.cwd(), "src", "assets", "fonts");
const [geist, geistBold, bricolageSemiBold, bricolage, logoPng] = await Promise.all([
  readFile(join(fontDir, "Geist-Regular.ttf")),
  readFile(join(fontDir, "Geist-Bold.ttf")),
  readFile(join(fontDir, "BricolageGrotesque-SemiBold.ttf")),
  readFile(join(fontDir, "BricolageGrotesque-ExtraBold.ttf")),
  readFile(join(process.cwd(), "public", "brand", "icon-192.png")),
]);
const logo = `data:image/png;base64,${logoPng.toString("base64")}`;

/** The sharp poster on the right: at most this box, keeping the poster's aspect. */
const POSTER_BOX = { width: 440, height: 504, right: 56 };

/**
 * Loads the cover image as a downscaled JPEG data URI with its size. Satori's own
 * fetch refuses private addresses (so local `/uploads/...` would fail in dev) and
 * would decode a full 8 MB upload; sharp also flattens WebP/GIF to one frame.
 * Any failure falls back to the skyline.
 */
async function loadPoster(url: string | null | undefined) {
  if (!url) return null;
  try {
    let bytes: Buffer;
    if (url.startsWith("/uploads/")) {
      bytes = await readFile(join(process.cwd(), "public", normalize(url)));
    } else if (/^https?:\/\//.test(url)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      bytes = Buffer.from(await res.arrayBuffer());
    } else return null;
    const base = sharp(bytes).rotate().flatten({ background: "#1c2f34" });
    const [{ data, info }, backdrop] = await Promise.all([
      base.clone().resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true }),
      // A small cover crop for the blurred backdrop: a fraction of the pixels to blur.
      base.clone().resize({ width: 400, height: 210, fit: "cover" }).jpeg({ quality: 70 }).toBuffer(),
    ]);
    const uri = (b: Buffer) => `data:image/jpeg;base64,${b.toString("base64")}`;
    return { src: uri(data), backdrop: uri(backdrop), width: info.width, height: info.height };
  } catch (e) {
    console.error("[og] poster", e);
    return null;
  }
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  const title = event?.title ?? "Baguio Base Camp";
  const meta = event ? [fmtRange(event.startsAt, event.endsAt), event.venueName].filter(Boolean).join(" · ") : "";
  const price = priceSummary(event?.tiers ?? []);
  const poster = await loadPoster(event?.coverImageUrl);

  // Poster layout: scale to fit the box, centred vertically; the copy column ends 48px before it.
  const fit = poster ? Math.min(POSTER_BOX.width / poster.width, POSTER_BOX.height / poster.height) : 0;
  const pw = poster ? Math.round(poster.width * fit) : 0;
  const ph = poster ? Math.round(poster.height * fit) : 0;
  const copyRight = poster ? POSTER_BOX.right + pw + 48 : 96;
  const titleSize = poster ? (title.length > 36 ? 52 : 64) : title.length > 40 ? 56 : 72;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Geist", background: "#0e1c20" }}>
        {poster ? (
          <>
            {/* Blurred poster as the backdrop, oversized so the blur has no soft dark edge. */}
            <img src={poster.backdrop} alt="" width={1360} height={714} style={{ position: "absolute", left: -80, top: -42, width: 1360, height: 714, filter: "blur(28px)" }} />
            <div style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex", background: "linear-gradient(90deg, rgba(11,22,26,.92) 0%, rgba(11,22,26,.78) 55%, rgba(11,22,26,.35) 100%)" }} />
            <img
              src={poster.src}
              alt=""
              width={pw}
              height={ph}
              style={{ position: "absolute", left: 1200 - POSTER_BOX.right - pw, top: Math.round((630 - ph) / 2), width: pw, height: ph, borderRadius: 20, boxShadow: "0 24px 48px rgba(0,0,0,.45)" }}
            />
          </>
        ) : (
          <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3cc5e8" />
                <stop offset=".48" stopColor="#1e6fa3" />
                <stop offset=".52" stopColor="#27404a" />
                <stop offset="1" stopColor="#0e1c20" />
              </linearGradient>
            </defs>
            <rect width="1200" height="630" fill="url(#sky)" />
            {/* the sun sits right of the logo lockup */}
            <circle cx="470" cy="150" r="40" fill="#f7e017" />
            <circle cx="470" cy="150" r="56" fill="none" stroke="#f7e017" strokeWidth="3" strokeDasharray="8 14" />
            <g fill="#f5f0a0">
              <circle cx="860" cy="90" r="3" />
              <circle cx="960" cy="160" r="2.4" />
              <circle cx="1060" cy="70" r="3" />
              <circle cx="1120" cy="210" r="2" />
              <circle cx="760" cy="60" r="2" />
              <circle cx="900" cy="230" r="1.6" />
            </g>
            <circle cx="1040" cy="130" r="36" fill="#f5f0a0" />
            <circle cx="1056" cy="118" r="30" fill="#1c3a4a" />
            <path d="M0 630V420L210 230L360 360L570 130L780 340L900 250L1200 470V630Z" fill="#8cc63e" />
            <path d="M0 630V500L180 400L390 480L600 300L810 460L990 380L1200 520V630Z" fill="#39b54a" />
            <path d="M0 630V570L240 500L480 580L720 480L960 560L1200 520V630Z" fill="#1f9a3e" />
          </svg>
        )}
        {/* Forest-tinted floor so white copy holds up over the lime ridges. */}
        {!poster && <div style={{ position: "absolute", left: 0, top: 260, width: 1200, height: 370, display: "flex", background: "linear-gradient(180deg, rgba(11,61,46,0) 0%, rgba(11,61,46,.55) 100%)" }} />}
        <div style={{ position: "absolute", left: 60, top: 50, display: "flex", alignItems: "center", gap: 18 }}>
          <img src={logo} alt="" width={84} height={84} style={{ width: 84, height: 84 }} />
          <div style={{ display: "flex", color: poster ? "#f5f0a0" : "#ffffff", fontSize: 20, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            Baguio Base Camp
          </div>
        </div>
        <div style={{ position: "absolute", left: 60, right: copyRight, bottom: 64, display: "flex", flexDirection: "column", gap: 16, color: "white" }}>
          <div
            style={{
              fontFamily: "Bricolage Grotesque",
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              // Satori throws on `undefined` style values, so the shadow is spread in only when needed
              ...(poster ? {} : { textShadow: "0 2px 12px rgba(11,61,46,.4)" }),
            }}
          >
            {title}
          </div>
          {meta && <div style={{ display: "flex", fontFamily: "Bricolage Grotesque", fontWeight: 600, fontSize: 26, lineHeight: 1.3, color: poster ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.95)" }}>{meta}</div>}
          {price && (
            <div style={{ display: "flex", alignSelf: "flex-start", background: "#f7e017", color: "#0b3d2e", padding: "8px 24px", borderRadius: 999, fontFamily: "Bricolage Grotesque", fontSize: 26, fontWeight: 800 }}>
              {price}
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: geist, weight: 400, style: "normal" },
        { name: "Geist", data: geistBold, weight: 700, style: "normal" },
        { name: "Bricolage Grotesque", data: bricolageSemiBold, weight: 600, style: "normal" },
        { name: "Bricolage Grotesque", data: bricolage, weight: 800, style: "normal" },
      ],
    },
  );
}
