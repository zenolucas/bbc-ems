/**
 * An "Add to calendar" link as an inline .ics file, so it works without a route
 * and opens in Apple, Google or Outlook calendars alike. Server-safe: no clock reads.
 */
export function icsHref(ev: { slug: string; title: string; startsAt: Date; endsAt: Date | null; venueName: string; venueAddress?: string | null; updatedAt: Date }, url?: string) {
  const end = ev.endsAt ?? new Date(ev.startsAt.getTime() + 4 * 3600e3);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Baguio Base Camp//EMS//EN",
    "BEGIN:VEVENT",
    `UID:${ev.slug}@baguiobasecamp`,
    `DTSTAMP:${stamp(ev.updatedAt)}`,
    `DTSTART:${stamp(ev.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(ev.title)}`,
    `LOCATION:${esc([ev.venueName, ev.venueAddress].filter(Boolean).join(", "))}`,
    ...(url ? [`URL:${url}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
}
