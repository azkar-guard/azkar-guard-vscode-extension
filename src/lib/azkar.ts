import data from "../data/azkar.json";
import type { Dhikr, Level, Session } from "./types";

export const ALL_AZKAR = data as Dhikr[];

export const LEVELS: Level[] = ["small", "medium", "full"];

/** Azkar for a session at a level, in source order. Levels are cumulative. */
export function azkarFor(session: Session, level: Level): Dhikr[] {
  const max = LEVELS.indexOf(level);
  return ALL_AZKAR.filter(
    (d) => (d.session === session || d.session === "both") && LEVELS.indexOf(d.level) <= max,
  );
}

/** Rough time estimate for a level: ~1.2s per tap plus ~20s reading per dhikr. */
export function estimateMinutes(session: Session, level: Level): number {
  const items = azkarFor(session, level);
  const taps = items.reduce((sum, d) => sum + d.required_count, 0);
  return Math.max(1, Math.round((taps * 1.2 + items.length * 20) / 60));
}
