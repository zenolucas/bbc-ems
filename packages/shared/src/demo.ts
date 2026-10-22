import { z } from "zod";
import type { MeDTO, Role } from "./api-types";

/**
 * Demo deployment: one-tap personas and the helpers around them. The server decides
 * whether any of this is on (GET /api/v1/config); clients only render what it says.
 */

export const DEMO_PERSONAS = ["member", "door", "organiser"] as const;
export type DemoPersonaKey = (typeof DEMO_PERSONAS)[number];

export const PERSONA_LABELS: Record<DemoPersonaKey, { label: string; name: string; blurb: string; role: Role }> = {
  member: { label: "Member", name: "Mara Santos", blurb: "Books tickets, pays, shows the QR at the door", role: "member" },
  door: { label: "Door crew", name: "Jun Reyes", blurb: "Scans tickets and checks people in", role: "staff" },
  organiser: { label: "Organiser", name: "Bea Cruz", blurb: "Runs events and approves payments", role: "admin" },
};

export const demoSignInSchema = z.object({ persona: z.enum(DEMO_PERSONAS) });
export const demoSettingsSchema = z.object({ enabled: z.boolean().optional(), autoApprove: z.boolean().optional() });

export type DemoStateDTO = { enabled: boolean; autoApprove: boolean };

export type ConfigDTO = {
  /** True on the demo deployment, even while its demo switch is off. */
  demoSite: boolean;
  /** Null unless the demo switch is on. */
  demo: null | (DemoStateDTO & {
    personas: { key: DemoPersonaKey; label: string; name: string; blurb: string; role: Role }[];
    /** The persona the caller is signed in as, if any. */
    current: DemoPersonaKey | null;
  });
};

export type DemoSignInDTO = { token: string | null; me: MeDTO; home: string };

export type ScanSampleKind = "valid" | "used" | "wrong-event" | "forged" | "unknown";
export type ScanSample = { kind: ScanSampleKind; label: string; text: string; via: "qr" | "code" };

/** Mock GCash receipts stamped SAMPLE, served from the web app's public/ folder. */
export const DEMO_RECEIPTS = ["/demo/sample-receipt-1.png", "/demo/sample-receipt-2.png", "/demo/sample-receipt-3.png"] as const;

export const isDemoReceipt = (url: string) => url.startsWith("/demo/");

/** A plausible 13-digit GCash reference number. */
export function demoPaymentRef() {
  let s = "";
  for (let i = 0; i < 13; i++) s += Math.floor(Math.random() * 10);
  return s;
}

export function demoReceipt() {
  return DEMO_RECEIPTS[Math.floor(Math.random() * DEMO_RECEIPTS.length)];
}
