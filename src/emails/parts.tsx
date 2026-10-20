import { Button, Column, Img, Link, Row, Text } from "@react-email/components";
import type { ReactNode } from "react";

import { env } from "@/lib/env";
import { EMAIL_ART } from "./art";
import { C, MONO } from "./layout";

const appUrl = env.appUrl;

/** Small caps line above the title; pine by default (grass is 2.4:1 on white). */
export function Eyebrow({ children, color = C.pine }: { children: ReactNode; color?: string }) {
  return (
    <Text style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: "2px", lineHeight: "16px", textTransform: "uppercase", margin: "0 0 8px" }}>
      {children}
    </Text>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={{ color: C.ink, fontSize: 26, fontWeight: 700, lineHeight: "30px", margin: "0 0 12px" }}>{children}</Text>;
}

export function P({ children }: { children: ReactNode }) {
  return <Text style={{ color: C.body, fontSize: 15, lineHeight: "23px", margin: "0 0 12px" }}>{children}</Text>;
}

/** Muted 13px copy: the venue line, footnotes under the button. */
export function Fine({ children, size = 13, top = 0 }: { children: ReactNode; size?: number; top?: number }) {
  return <Text style={{ color: C.muted, fontSize: size, lineHeight: size === 12 ? "18px" : "20px", margin: `${top}px 0 12px` }}>{children}</Text>;
}

export function Mono({ children, color }: { children: ReactNode; color?: string }) {
  return <span style={{ fontFamily: MONO, color }}>{children}</span>;
}

export type Venue = { when: string; venue: string; venueAddress?: string | null; mapUrl?: string | null };

/** "Sat, Nov 1 · 7:00 PM · Canto, Romulo Dr · Map" */
export function Where(p: Venue) {
  return (
    <Fine>
      {p.when} · {p.venue}
      {p.venueAddress ? `, ${p.venueAddress}` : ""}
      {p.mapUrl && (
        <>
          {" · "}
          <Link href={p.mapUrl} style={{ color: C.link, fontWeight: 700 }}>
            Map
          </Link>
        </>
      )}
    </Fine>
  );
}

/** A cream panel for organiser notes, payment details and the door-crew hint. */
export function Note({ children, accent }: { children: ReactNode; accent?: string }) {
  return (
    <Text
      style={{
        backgroundColor: C.page,
        borderRadius: accent ? "4px 12px 12px 4px" : 12,
        borderLeft: accent ? `4px solid ${accent}` : undefined,
        color: C.muted,
        fontSize: 13,
        lineHeight: "20px",
        padding: "12px 14px",
        margin: "4px 0 14px",
      }}
    >
      {children}
    </Text>
  );
}

/** The one pill-shaped call to action. */
export function PillButton({ href, children, large }: { href: string; children: ReactNode; large?: boolean }) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: C.pine,
        color: "#ffffff",
        borderRadius: 999,
        fontSize: large ? 16 : 15,
        fontWeight: 700,
        lineHeight: "20px",
        padding: large ? "14px 26px" : "13px 22px",
        textDecoration: "none",
        display: "inline-block",
        margin: "6px 0 14px",
      }}
    >
      {children}
    </Button>
  );
}

export type StubTicket = { id: string; shortCode: string; tier: string; holder: string };

/**
 * One ticket as a stub: cream block, dashed grass left edge (the perforation),
 * QR tile, code, "tier · holder", and a link to the ticket page. `rename` flags a
 * spare ticket still in the booker's name.
 */
export function TicketStub({ t, rename }: { t: StubTicket; rename?: boolean }) {
  return (
    <Row style={{ backgroundColor: C.page, borderLeft: `4px dashed ${C.grass}`, borderRadius: "4px 12px 12px 4px", marginBottom: 10 }}>
      <Column style={{ width: 44, padding: "12px 0 12px 14px", verticalAlign: "middle" }}>
        <Img src={`${appUrl}${EMAIL_ART.qrTile.src}`} width={EMAIL_ART.qrTile.size} height={EMAIL_ART.qrTile.size} alt="" style={{ display: "block", border: 0 }} />
      </Column>
      <Column style={{ padding: "12px 10px 12px 14px", verticalAlign: "middle" }}>
        <Text style={{ fontFamily: MONO, color: C.ink, fontSize: 15, fontWeight: 700, letterSpacing: "1px", lineHeight: "20px", margin: 0 }}>{t.shortCode}</Text>
        <Text style={{ color: C.muted, fontSize: 13, lineHeight: "18px", margin: 0 }}>
          {t.tier} · {t.holder}
          {rename && <span style={{ color: C.danger, fontWeight: 700 }}> · rename for your guest</span>}
        </Text>
      </Column>
      <Column align="right" style={{ padding: "12px 14px 12px 0", verticalAlign: "middle", whiteSpace: "nowrap" }}>
        <Link href={`${appUrl}/tickets/${t.id}`} style={{ color: C.link, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          View ticket
        </Link>
      </Column>
    </Row>
  );
}

/** Label/value lines inside a Note, e.g. GCash account name and number. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span style={{ color: C.muted }}>{label}: </span>
      <strong style={{ color: C.ink }}>{children}</strong>
      <br />
    </>
  );
}
