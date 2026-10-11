// Opening hours ("HH:MM" in the app time zone). Safe for client code.
import { TIME_ZONE } from "@/lib/catalog";

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Minutes since midnight in the app time zone. */
export function minutesInZone(now: Date, timeZone = TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** Whether a shop is within its hours at `now`. Handles overnight hours (e.g. 18:00–02:00). */
export function isOpenAt(hours: { opensAt: string; closesAt: string }, now: Date, timeZone = TIME_ZONE): boolean {
  const open = toMinutes(hours.opensAt);
  const close = toMinutes(hours.closesAt);
  const t = minutesInZone(now, timeZone);
  return open < close ? t >= open && t < close : t >= open || t < close;
}
