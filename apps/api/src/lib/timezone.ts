const KARACHI_TZ = "Asia/Karachi";

export function karachiYear(date: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: KARACHI_TZ, year: "numeric" }).format(date));
}

/** YYYY-MM-DD in Asia/Karachi — use for "today's sale" style calendar-day filters, never the UTC date. */
export function karachiDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KARACHI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

/**
 * UTC instants for the start/end of "today" in Asia/Karachi (fixed UTC+5, no DST) — a
 * 1 AM PKT sale is 8 PM UTC the *previous* day, so this must never be the UTC calendar day.
 */
export function karachiDayRangeUtc(date: Date = new Date()): { start: Date; end: Date } {
  const dateStr = karachiDateString(date);
  const start = new Date(`${dateStr}T00:00:00+05:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
