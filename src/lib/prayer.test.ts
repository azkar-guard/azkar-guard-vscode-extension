import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/aladhan.json";
import { METHOD_IDS, prayerDay, prayerDays } from "./prayer";

/**
 * On-device times vs AlAdhan reference times (recorded by scripts/build_aladhan_fixtures.mjs)
 * for 9 cities, 2 dates (June and December solstices) and every method.
 */
const TOLERANCE_MIN = 1;
/** Difference in whole minutes: AlAdhan reports minutes, and some methods (e.g. Singapore) round up. */
const minutesApart = (a: number, b: number) => Math.abs(Math.round((a - b) / 60000));
/** Methods where adhan-js follows the authority's own rules and intentionally differs from AlAdhan. */
const INTENTIONAL = new Set([15]); // Moonsighting Committee

describe("on-device prayer times", () => {
  it("covers every method in settings", () => {
    expect(new Set(fixtures.map((f) => f.method))).toEqual(new Set(METHOD_IDS));
  });

  const cases = fixtures.filter((f) => !INTENTIONAL.has(f.method));
  it.each(cases)("method $method, $city, $date: within 1 min of AlAdhan", (f) => {
    const day = prayerDay({ latitude: f.lat, longitude: f.lng }, f.method, f.date);
    expect(day).not.toBeNull();
    expect(minutesApart(day!.fajr, Date.parse(f.fajr))).toBeLessThanOrEqual(TOLERANCE_MIN);
    expect(minutesApart(day!.maghrib, Date.parse(f.maghrib))).toBeLessThanOrEqual(TOLERANCE_MIN);
  });

  it("computes a Moonsighting Committee day with Fajr before Maghrib", () => {
    const day = prayerDay({ latitude: 30.0626, longitude: 31.2497 }, 15, "2026-06-21");
    expect(day && day.fajr < day.maghrib).toBe(true);
  });

  it("returns yesterday..day after tomorrow, in order", () => {
    const days = prayerDays({ latitude: 30.0626, longitude: 31.2497 }, 5, Date.parse("2026-09-27T12:00:00+03:00"));
    const dates = Object.keys(days);
    expect(dates).toHaveLength(4);
    for (const d of Object.values(days)) expect(d.fajr).toBeLessThan(d.maghrib);
  });

  it("falls back to Muslim World League for an unknown method id", () => {
    const loc = { latitude: 30.0626, longitude: 31.2497 };
    expect(prayerDay(loc, 999, "2026-06-21")).toEqual(prayerDay(loc, 3, "2026-06-21"));
  });
});
