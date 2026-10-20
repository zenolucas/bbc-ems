import { format, formatDistanceToNowStrict, isSameDay } from "date-fns";
import { TZDate } from "@date-fns/tz";

export const TZ = "Asia/Manila";

export function peso(cents: number) {
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}

function local(d: Date | string) {
  return new TZDate(typeof d === "string" ? new Date(d) : d, TZ);
}

export function fmtDate(d: Date | string, pattern = "EEE, MMM d, yyyy") {
  return format(local(d), pattern);
}
export function fmtTime(d: Date | string) {
  return format(local(d), "h:mm a");
}
export function fmtDateTime(d: Date | string) {
  return format(local(d), "EEE, MMM d, yyyy · h:mm a");
}
export function fmtRange(start: Date | string, end?: Date | string | null) {
  const s = local(start);
  if (!end) return `${format(s, "EEE, MMM d, yyyy")} · ${format(s, "h:mm a")}`;
  const e = local(end);
  if (isSameDay(s, e)) return `${format(s, "EEE, MMM d, yyyy")} · ${format(s, "h:mm a")} – ${format(e, "h:mm a")}`;
  return `${format(s, "MMM d, h:mm a")} – ${format(e, "MMM d, yyyy, h:mm a")}`;
}
export function relative(d: Date | string) {
  return formatDistanceToNowStrict(typeof d === "string" ? new Date(d) : d, { addSuffix: true });
}
/** For <input type="datetime-local"> values, rendered in Manila time. */
export function toLocalInput(d: Date | string | null | undefined) {
  if (!d) return "";
  return format(local(d), "yyyy-MM-dd'T'HH:mm");
}
/** Parses a datetime-local string as Manila time into a UTC Date. */
export function fromLocalInput(v: string | null | undefined) {
  if (!v) return null;
  const [date, time] = v.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, TZ).getTime());
}
