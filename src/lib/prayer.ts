import { CalculationMethod, CalculationParameters, Coordinates, HighLatitudeRule, PrayerTimes } from "adhan";
import { DAY, localDate } from "./dates";
import type { Location, PrayerDay } from "./types";

/**
 * Calculation methods by AlAdhan method id (the ids used in settings since v0.1).
 * Methods adhan-js ships are used as-is. The others are defined from the parameters
 * AlAdhan publishes for them (https://api.aladhan.com/v1/methods, fetched 2026-09-27).
 */
const METHODS: Record<number, () => CalculationParameters> = {
  1: CalculationMethod.Karachi,
  2: CalculationMethod.NorthAmerica, // ISNA
  3: CalculationMethod.MuslimWorldLeague,
  4: CalculationMethod.UmmAlQura,
  5: CalculationMethod.Egyptian,
  8: () => custom(19.5, { minutes: 90 }), // Gulf Region
  9: CalculationMethod.Kuwait,
  10: CalculationMethod.Qatar,
  11: CalculationMethod.Singapore,
  12: () => custom(12, { angle: 12 }), // UOIF, France
  13: CalculationMethod.Turkey,
  14: () => custom(16, { angle: 15 }), // Spiritual Administration of Muslims of Russia
  // adhan-js implements the committee's own rules (seasonal Fajr/Isha, its own high-latitude
  // handling, Maghrib +3 min); AlAdhan's version simplifies them, so the two differ on purpose.
  15: CalculationMethod.MoonsightingCommittee,
  16: CalculationMethod.Dubai,
  17: () => custom(20, { angle: 18 }), // JAKIM, Malaysia
  18: () => custom(18, { angle: 18 }), // Tunisia
  19: () => custom(18, { angle: 17 }), // Algeria
  20: () => custom(20, { angle: 18 }), // Kemenag, Indonesia
  // Morocco: AlAdhan's published params omit it, but its times put Maghrib 5 minutes after
  // sunset in every sample we recorded (src/lib/fixtures/aladhan.json).
  21: () => custom(19, { angle: 17 }, 5),
  23: () => custom(18, { angle: 18 }, 5), // Jordan: Maghrib 5 minutes after sunset
};

export const METHOD_IDS = Object.keys(METHODS).map(Number);

function custom(fajrAngle: number, isha: { angle: number } | { minutes: number }, maghribMinutes = 0): CalculationParameters {
  const params = CalculationMethod.Other();
  params.fajrAngle = fajrAngle;
  if ("angle" in isha) params.ishaAngle = isha.angle;
  else params.ishaInterval = isha.minutes;
  params.methodAdjustments.maghrib = maghribMinutes;
  return params;
}

export function methodParameters(method: number): CalculationParameters {
  const params = (METHODS[method] ?? METHODS[3]!)();
  // Angle-based high-latitude handling, the same default AlAdhan uses. The Moonsighting
  // Committee method keeps its own rules.
  if (method !== 15) params.highLatitudeRule = HighLatitudeRule.TwilightAngle;
  return params;
}

/** Fajr and Maghrib for one local calendar date, or null if they don't exist there (polar day/night). */
export function prayerDay(location: Location, method: number, date: string): PrayerDay | null {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const times = new PrayerTimes(new Coordinates(location.latitude, location.longitude), new Date(y, m - 1, d), methodParameters(method));
  const fajr = times.fajr.getTime();
  const maghrib = times.maghrib.getTime();
  return Number.isNaN(fajr) || Number.isNaN(maghrib) ? null : { fajr, maghrib };
}

/**
 * Prayer days covering yesterday..day after tomorrow (local dates), computed on-device.
 * Nothing is fetched and nothing needs caching: the computation is deterministic.
 */
export function prayerDays(location: Location, method: number, now: number): Record<string, PrayerDay> {
  const days: Record<string, PrayerDay> = {};
  for (const n of [-1, 0, 1, 2]) {
    const date = localDate(now + n * DAY);
    const day = prayerDay(location, method, date);
    if (day) days[date] = day;
  }
  return days;
}
