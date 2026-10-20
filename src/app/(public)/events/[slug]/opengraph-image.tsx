import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getEventBySlug } from "@/lib/events";
import { fmtRange } from "@/lib/format";
import { priceSummary } from "@/components/event/event-card";

export const alt = "Event";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori renders only the fonts it is handed: Geist for the meta lines, Bricolage for the title.
const fontDir = join(process.cwd(), "src", "assets", "fonts");
const [geist, geistSemiBold, bricolage] = await Promise.all([
  readFile(join(fontDir, "Geist-Regular.ttf")),
  readFile(join(fontDir, "Geist-SemiBold.ttf")),
  readFile(join(fontDir, "BricolageGrotesque-ExtraBold.ttf")),
]);

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  const title = event?.title ?? "Baguio Base Camp";
  const when = event ? fmtRange(event.startsAt, event.endsAt) : "";
  const venue = event?.venueName ?? "";
  const price = priceSummary(event?.tiers ?? []);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg,#3cc5e8 0%,#1e6fa3 48%,#27404a 52%,#0e1c20 100%)", position: "relative", fontFamily: "Geist" }}>
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", left: 0, top: 0 }}>
          <circle cx="170" cy="140" r="44" fill="#f7e017" />
          <circle cx="1040" cy="130" r="36" fill="#f5f0a0" />
          <circle cx="1056" cy="118" r="30" fill="#1c3a4a" />
          <path d="M0 630 L0 420 L210 230 L360 360 L570 130 L780 340 L900 250 L1200 470 L1200 630 Z" fill="#8cc63e" />
          <path d="M0 630 L0 500 L180 400 L390 480 L600 300 L810 460 L990 380 L1200 520 L1200 630 Z" fill="#39b54a" />
          <path d="M0 630 L0 570 L240 500 L480 580 L720 480 L960 560 L1200 520 L1200 630 Z" fill="#1f9a3e" />
        </svg>
        <div style={{ position: "absolute", left: 64, top: 56, display: "flex", alignItems: "center", gap: 16, color: "white", fontSize: 24, letterSpacing: 6, fontWeight: 600 }}>
          BAGUIO BASE CAMP
        </div>
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 72, display: "flex", flexDirection: "column", gap: 14, color: "white" }}>
          <div style={{ fontFamily: "Bricolage Grotesque", fontSize: title.length > 40 ? 56 : 72, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, textShadow: "0 2px 12px rgba(11,61,46,.35)" }}>{title}</div>
          <div style={{ display: "flex", gap: 24, fontSize: 28, opacity: 0.95 }}>
            <span>{when}</span>
            {venue && <span>· {venue}</span>}
          </div>
          {price && <div style={{ display: "flex", alignSelf: "flex-start", background: "#f7e017", color: "#0b3d2e", padding: "8px 20px", borderRadius: 999, fontSize: 26, fontWeight: 600 }}>{price}</div>}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: geist, weight: 400, style: "normal" },
        { name: "Geist", data: geistSemiBold, weight: 600, style: "normal" },
        { name: "Bricolage Grotesque", data: bricolage, weight: 800, style: "normal" },
      ],
    },
  );
}
