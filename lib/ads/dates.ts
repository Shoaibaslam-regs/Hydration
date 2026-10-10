import { TIME_ZONE } from "@/lib/catalog";

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Calendar day (YYYY-MM-DD) of a moment, in the app time zone. */
export function dayKey(date: Date): string {
  return dayKeyFormat.format(date);
}

/**
 * Midnight at the start of a YYYY-MM-DD day in the app time zone, as a Date.
 * Works for any fixed-offset zone and for zones with DST (uses the offset at that day).
 */
export function startOfDayInZone(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const utcGuess = new Date(Date.UTC(y, m - 1, d));
  // How far the zone is ahead of UTC at that moment.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(utcGuess)
      .map((p) => [p.type, p.value]),
  );
  const asZone = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(utcGuess.getTime() - (asZone - utcGuess.getTime()));
}

/** Start of the day after `day`: an exclusive end bound for a day-based range. */
export function endOfDayInZone(day: string): Date {
  const next = new Date(startOfDayInZone(day).getTime() + 36 * 60 * 60 * 1000);
  return startOfDayInZone(dayKey(next));
}
