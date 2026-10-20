import { Body, Container, Head, Html, Img, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

import { env } from "@/lib/env";
import { EMAIL_ART, HEADER_BG, type EmailScene } from "./art";

const appUrl = env.appUrl;

/**
 * Email palette: the Alpine Day brand values, written out because mail clients
 * have no CSS variables. Every text colour here clears 4.5:1 on white and on cream.
 */
export const C = {
  page: "#f6f4ec",
  card: "#ffffff",
  ink: "#0b3d2e",
  body: "#2f4a4f",
  muted: "#5b7060",
  pine: "#1b5e3b",
  grass: "#39b54a",
  link: "#1e6fa3",
  warn: "#6b4f00",
  danger: "#b4321f",
  line: "#dfe5da",
} as const;

/** System fonts only: web fonts are blocked or ignored by most mail clients. */
export const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const MONO = "Menlo, Consolas, 'Courier New', monospace";

/**
 * The shared frame: cream page, a white 560px card with the Skyline strip on top
 * (day for bookings, night for sign-in) and a footer line. The strip is a PNG
 * (see ./art.ts); the cell behind it carries the sky colour and the alt text, so
 * the band still reads when images are blocked.
 */
export function EmailLayout({
  preview,
  scene = "day",
  footnote,
  children,
}: {
  preview: string;
  scene?: EmailScene;
  /** A second footer line, e.g. why the recipient got this email. */
  footnote?: ReactNode;
  children: ReactNode;
}) {
  const header = EMAIL_ART.header;
  return (
    <Html lang="en">
      <Head>
        {/* The design is light-only; this stops Apple Mail from half-inverting it. */}
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: C.page, fontFamily: FONT, color: C.ink, margin: 0, padding: "24px 12px" }}>
        <Container
          style={{ backgroundColor: C.card, border: `1px solid ${C.line}`, borderRadius: 16, maxWidth: 560, margin: "0 auto", overflow: "hidden", fontFamily: FONT }}
        >
          <Section style={{ backgroundColor: HEADER_BG[scene], borderRadius: "16px 16px 0 0" }}>
            <Img
              src={`${appUrl}${header[scene]}`}
              width={header.width}
              height={header.height}
              alt="Baguio Base Camp"
              style={{
                display: "block",
                width: "100%",
                maxWidth: header.width,
                height: "auto",
                border: 0,
                borderRadius: "16px 16px 0 0",
                // styles the alt text when images are off
                color: scene === "day" ? C.ink : "#ffffff",
                fontFamily: FONT,
                fontSize: 16,
                fontWeight: 700,
              }}
            />
          </Section>
          <Section style={{ padding: "24px 28px 20px" }}>{children}</Section>
          <Section style={{ borderTop: `1px solid ${C.line}`, padding: "14px 28px 20px" }}>
            <Text style={{ color: C.muted, fontSize: 12, lineHeight: "18px", textAlign: "center", margin: 0 }}>
              Sent by Baguio Base Camp · Baguio City
              {footnote && (
                <>
                  <br />
                  {footnote}
                </>
              )}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
