import { addDays } from "./dates";
import type { AzkarWindow, PrayerDay } from "./types";

/**
 * Find the Azkar window containing `now`.
 * Morning = Fajr → Maghrib of the same date; Evening = Maghrib → Fajr of the next date.
 * Returns null if the cached days do not cover `now`.
 */
export function findWindow(days: Record<string, PrayerDay>, now: number): AzkarWindow | null {
  for (const [date, day] of Object.entries(days)) {
    if (now >= day.fajr && now < day.maghrib) {
      return { session: "morning", date, start: day.fajr, end: day.maghrib };
    }
    const next = days[addDays(date, 1)];
    if (next && now >= day.maghrib && now < next.fajr) {
      return { session: "evening", date, start: day.maghrib, end: next.fajr };
    }
  }
  return null;
}

export function windowKey(w: AzkarWindow): string {
  return `${w.date}:${w.session}`;
}
