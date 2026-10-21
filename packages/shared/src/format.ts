/** Display formatting shared by the web and the app. Times are always Manila time, wherever the phone is. */
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
/** Compact time left for holds and countdowns: "3d 4h", "20h 05m", "14m", "<1m". Never negative. */
export function fmtLeft(ms: number) {
  const m = Math.floor(Math.max(0, ms) / 60e3);
  if (m < 1) return "<1m";
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(min).padStart(2, "0")}m`;
  return `${min}m`;
}
