/**
 * The door's decision rules, with no React Native imports so they can be tested
 * in Node. Mirrors the web scanner (src/components/scanner/use-scanner.ts in the
 * Next app): same result kinds, copy, local-result semantics and id formats.
 */
import { fmtTime } from "@bbc/shared/format";
import type { CheckinOutcome, LocalResult, Manifest, ManifestTicket } from "@bbc/shared/scan-types";
import { normalizeShortCode } from "@bbc/shared/shortcode";
import { parseToken, verifyWith, type Verifier } from "@bbc/shared/token";

export type ScanKind = "ok" | "duplicate" | "invalid" | "void" | "wrong-event" | "stale";

export type ScanResult = {
  kind: ScanKind;
  ticket?: ManifestTicket;
  detail?: string;
  at: number;
  /** The scanned payload, kept so a "stale" result can be retried after a refresh. */
  raw?: string;
};

/** online: last request reached the server. offline: it didn't. auth: signed out or no door access. */
export type Connection = "online" | "offline" | "auth";

export type QueuedCheckin = {
  clientId: string;
  ticketId: string | null;
  rawPayload: string | null;
  scannedAt: string;
  localResult: LocalResult;
};

/** ticketId → ISO time of the local check-in, until the server confirms it. */
export type LocalUsed = Record<string, string>;

export type RecentScan = { at: number; kind: string; holder?: string; code?: string; tier?: string };

export type FeedbackKind = "ok" | "duplicate" | "invalid" | "void" | "warn";

export const TIMEOUT_MS = 8000;
/** Ignore identical frames from the camera. */
export const SAME_TEXT_MS = 3000;
/** A guest often keeps their phone up after the green screen. */
export const AFTER_OK_MS = 10_000;
/** The camera's pause after any hit, like the web reader's delayBetweenScanSuccess. */
export const AFTER_HIT_MS = 800;
export const RECENT_LIMIT = 10;
export const NOTES_LIMIT = 20;

/** How long a result stays up: quick for green, longer for anything the door needs to read. */
export function dismissAfterMs(kind: ScanKind) {
  return kind === "ok" ? 2500 : kind === "stale" ? 12_000 : 5000;
}

export const toLocal = (k: ScanKind): LocalResult => (k === "ok" ? "ok" : k === "duplicate" ? "duplicate" : k === "void" ? "void" : "invalid");
export const toFeedback = (k: ScanKind): FeedbackKind => (k === "ok" ? "ok" : k === "duplicate" ? "duplicate" : k === "stale" ? "warn" : "invalid");

const time = (iso: string | null | undefined) => (iso ? fmtTime(iso) : "?");

export const TITLES: Record<ScanKind, string> = {
  ok: "Welcome in",
  duplicate: "Already scanned",
  stale: "Not in list yet",
  invalid: "Invalid ticket",
  void: "Voided ticket",
  "wrong-event": "Wrong event",
};

const NO_LIST = "The ticket list hasn't downloaded to this phone yet. Get signal once, then try again.";

export function newClientId(now = Date.now()) {
  return `c-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newDeviceId(now = Date.now()) {
  return `dev-${Math.random().toString(36).slice(2, 10)}${now.toString(36)}`;
}

export function evaluateTicket(t: ManifestTicket, usedMap: LocalUsed, at = Date.now()): ScanResult {
  if (t.status === "void") return { kind: "void", ticket: t, detail: "An organiser cancelled this ticket. Don't let them in; send them to an organiser.", at };
  if (t.status === "used") return { kind: "duplicate", ticket: t, detail: `First scanned at ${time(t.checkedInAt)}`, at };
  if (usedMap[t.id]) return { kind: "duplicate", ticket: t, detail: `Scanned on this phone at ${time(usedMap[t.id])}`, at };
  return { kind: "ok", ticket: t, at };
}

/**
 * What to do with a scan:
 * - record: queue it for the server (every ticket decision is kept for the audit trail)
 * - show: tell the door, but don't queue (a problem with this phone, not the ticket)
 * - ignore: a repeat frame of something just handled
 */
export type Decision =
  | { action: "record"; ticketId: string | null; raw: string; result: ScanResult }
  | { action: "show"; result: ScanResult }
  | { action: "ignore" };

export type ScanContext = {
  eventId: string;
  manifest: Manifest | null;
  verifier: Verifier | null;
  used: LocalUsed;
  /** text → last time seen, for repeat-frame suppression. Mutated. */
  seenText: Map<string, number>;
  /** ticketId → time it was let in on this phone. Read only. */
  okTicket: Map<string, number>;
  now?: number;
};

export async function decideText(text: string, ctx: ScanContext, opts: { force?: boolean } = {}): Promise<Decision> {
  const at = ctx.now ?? Date.now();
  if (!opts.force) {
    const seen = ctx.seenText.get(text);
    if (seen && at - seen < SAME_TEXT_MS) return { action: "ignore" };
  }
  ctx.seenText.set(text, at);

  const parts = parseToken(text);
  if (!parts) return { action: "record", ticketId: null, raw: text, result: { kind: "invalid", detail: "This isn't a Baguio Base Camp ticket QR.", at } };
  const okAt = ctx.okTicket.get(parts.ticketId);
  if (!opts.force && okAt && at - okAt < AFTER_OK_MS) return { action: "ignore" };
  if (!ctx.verifier) return { action: "show", result: { kind: "invalid", detail: NO_LIST, at } };
  const sigOk = await verifyWith(ctx.verifier, parts);
  if (!sigOk) return { action: "record", ticketId: null, raw: text, result: { kind: "invalid", detail: "The signature check failed. This QR may be fake or edited.", at } };
  if (parts.eventId !== ctx.eventId) return { action: "record", ticketId: null, raw: text, result: { kind: "wrong-event", detail: "This is a real ticket, but for a different event.", at } };
  const t = ctx.manifest?.tickets.find((x) => x.id === parts.ticketId);
  if (!t) return { action: "record", ticketId: parts.ticketId, raw: text, result: { kind: "stale", raw: text, detail: "Genuine ticket, but it's not in this phone's list yet. It was probably just bought.", at } };
  return { action: "record", ticketId: t.id, raw: text, result: evaluateTicket(t, ctx.used, at) };
}

export function decideCode(input: string, manifest: Manifest | null, used: LocalUsed, at = Date.now()): Decision {
  const code = normalizeShortCode(input);
  if (!code) return { action: "show", result: { kind: "invalid", detail: "Codes look like BBC-XXXX-XXXX (8 letters and numbers).", at } };
  if (!manifest) return { action: "show", result: { kind: "invalid", detail: NO_LIST, at } };
  const t = manifest.tickets.find((x) => x.code === code);
  if (!t) return { action: "record", ticketId: null, raw: code, result: { kind: "invalid", detail: `No ticket ${code} for this event. Check for typos, or refresh the list if it was just bought.`, at } };
  return { action: "record", ticketId: t.id, raw: code, result: evaluateTicket(t, used, at) };
}

export function queuedFor(ticketId: string | null, raw: string, result: ScanResult, now = Date.now()): QueuedCheckin {
  return { clientId: newClientId(now), ticketId, rawPayload: raw, scannedAt: new Date(now).toISOString(), localResult: toLocal(result.kind) };
}

export function recentFor(result: ScanResult): RecentScan {
  return { at: result.at, kind: result.kind, holder: result.ticket?.holder, code: result.ticket?.code, tier: result.ticket?.tier };
}

/**
 * Reads the server's answer to a sync. Only check-ins the door admitted can
 * conflict; the rest were already refusals. A fresh "ok" means the server list
 * moved on, so the manifest is refetched.
 */
export function readOutcomes(outcomes: Pick<CheckinOutcome, "clientId" | "result" | "checkedInAt" | "holder">[], queue: QueuedCheckin[]) {
  let refetch = false;
  const notes: string[] = [];
  for (const o of outcomes) {
    const local = queue.find((x) => x.clientId === o.clientId);
    if (local?.localResult !== "ok") continue;
    const who = o.holder || "A guest";
    if (o.result === "duplicate") notes.push(`${who} was already let in on another device at ${time(o.checkedInAt)}.`);
    else if (o.result === "void") notes.push(`${who} was let in, but an organiser had voided that ticket. Check with them.`);
    else if (o.result === "invalid") notes.push(`A ticket let in at ${time(local.scannedAt)} isn't valid on the server.`);
    if (o.result === "ok") refetch = true;
  }
  if (notes.length) refetch = true;
  return { refetch, notes, done: new Set(outcomes.map((o) => o.clientId)) };
}

/** Local check-ins still waiting for the server; the rest of the used map can go (an admin's undo must show). */
export function pendingTicketIds(queue: QueuedCheckin[]) {
  return new Set(queue.filter((x) => x.localResult === "ok" && x.ticketId).map((x) => x.ticketId as string));
}

export function stats(manifest: Manifest | null, used: LocalUsed) {
  const live = (manifest?.tickets ?? []).filter((t) => t.status !== "void");
  return { total: live.length, checkedIn: live.filter((t) => t.status === "used" || (t.status === "valid" && used[t.id])).length };
}

export function eventEnded(manifest: Manifest | null, now = Date.now()) {
  if (!manifest) return false;
  return new Date(manifest.endsAt ?? new Date(manifest.startsAt).getTime() + 6 * 3600e3).getTime() < now;
}

// ---- type code

export const CODE_LEN = 8;

/** Formats as the user types: BBC-XXXX-XXXX. */
export function formatCode(v: string) {
  const alnum = v.toUpperCase().replace(/[^0-9A-Z]/g, "");
  // Still typing the prefix itself ("B", "BB"): don't read it as the code yet
  if ("BBC".startsWith(alnum)) return alnum;
  const raw = alnum.replace(/^BBC/, "").slice(0, CODE_LEN);
  return `BBC-${raw.slice(0, 4)}${raw.length > 4 ? `-${raw.slice(4)}` : ""}`;
}

/** Characters typed after the BBC- prefix. */
export const typedChars = (code: string) => (code.startsWith("BBC-") ? code.slice(4).replace(/-/g, "").length : 0);

// ---- guest list

export function matchGuests(tickets: ManifestTicket[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return tickets;
  const codeQ = q.replace(/[\s-]/g, "").replace(/^bbc/, "");
  return tickets.filter((t) => t.holder.toLowerCase().includes(q) || t.code.toLowerCase().includes(codeQ) || t.tier.toLowerCase().includes(q));
}

/** Splits `text` around case-insensitive matches of `q`, for highlighting. */
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const out: { text: string; hit: boolean }[] = [];
  let i = 0;
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, i)) {
    if (at > i) out.push({ text: text.slice(i, at), hit: false });
    out.push({ text: text.slice(at, at + q.length), hit: true });
    i = at + q.length;
  }
  if (i < text.length) out.push({ text: text.slice(i), hit: false });
  return out;
}
