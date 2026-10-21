import { format } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { TZ } from "@bbc/shared/format";

export * from "@bbc/shared/format";

function local(d: Date | string) {
  return new TZDate(typeof d === "string" ? new Date(d) : d, TZ);
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
