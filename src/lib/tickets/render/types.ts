import type { TicketStyle } from "@/db/schema";

export type Theme = "light" | "dark";

export type TicketRenderInput = {
  /** Full ticket URL encoded in the QR. */
  url: string;
  shortCode: string;
  holderName: string;
  tierName: string;
  event: { title: string; startsAt: Date; endsAt?: Date | null; venueName: string };
  theme: Theme;
  /** Pre-rendered Code 128 SVG (server computes this; only Trail Pass uses it). */
  barcodeSvg?: string;
};

export type TicketRenderer = (input: TicketRenderInput) => { svg: string; width: number; height: number };

export const STYLE_META: Record<TicketStyle, { name: string; blurb: string }> = {
  summit: { name: "Summit", blurb: "Classic square QR, mountain mark in the centre, finder corners tinted sky, grass and forest." },
  "night-sky": { name: "Night Sky", blurb: "Day/night split card. The QR sits on a lit cream window with round dot modules and a crescent moon." },
  "trail-pass": { name: "Trail Pass", blurb: "Landscape boarding pass with a tear-off stub, contour-line background and a Code 128 barcode." },
  "ridge-line": { name: "Ridge Line", blurb: "QR modules banded from deep blue through pine to deep forest, framed by a jagged ridge." },
  "campfire-stamp": { name: "Campfire Stamp", blurb: "Circular patch with the logo's double ring and the event name running around it. Prints well in mono." },
};
