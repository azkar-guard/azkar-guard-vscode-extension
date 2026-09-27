import { addDays } from "./dates";
import type { History } from "./types";

/** A day counts only when both its morning and evening sessions were completed. */
export function isDayComplete(history: History, date: string): boolean {
  const day = history[date];
  return Boolean(day?.morning && day?.evening);
}

/**
 * Consecutive complete days ending at `today`, or at the day before if `today`
 * is still in progress — an unfinished today does not break the streak yet.
 */
export function currentStreak(history: History, today: string): number {
  let date = isDayComplete(history, today) ? today : addDays(today, -1);
  let streak = 0;
  while (isDayComplete(history, date)) {
    streak++;
    date = addDays(date, -1);
  }
  return streak;
}
