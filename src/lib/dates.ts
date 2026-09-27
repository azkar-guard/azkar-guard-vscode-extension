import type { Lang } from "./types";

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

/** Shift a YYYY-MM-DD date by n days (calendar arithmetic, timezone-free). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** YYYY-MM-DD of an instant in the browser's local timezone. */
export function localDate(epochMs: number): string {
  const t = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export function formatTime(epochMs: number, lang: Lang): string {
  return new Date(epochMs).toLocaleTimeString(lang === "ar" ? "ar" : [], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
