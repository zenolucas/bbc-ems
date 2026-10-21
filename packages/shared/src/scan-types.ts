/** What /api/scan/manifest returns and /api/scan/sync accepts. Shared by the web and app scanners. */

export type ManifestTicket = {
  id: string;
  code: string;
  holder: string;
  tier: string;
  status: "valid" | "used" | "void";
  checkedInAt: string | null;
};

export type Manifest = {
  eventId: string;
  title: string;
  status: "draft" | "published" | "cancelled" | "ended";
  startsAt: string;
  endsAt: string | null;
  venue: string;
  publicKey: string;
  version: string;
  tickets: ManifestTicket[];
};

export type LocalResult = "ok" | "duplicate" | "invalid" | "void";

export type IncomingCheckin = {
  clientId: string;
  ticketId: string | null;
  rawPayload: string | null;
  scannedAt: string;
  /** What the door saw. Anything but "ok" is recorded for the audit trail and never admits. Missing = "ok" (older clients). */
  localResult?: LocalResult;
};

export type CheckinOutcome = {
  clientId: string;
  ticketId: string | null;
  result: "ok" | "duplicate" | "invalid" | "void";
  checkedInAt: string | null;
  holder?: string;
};
