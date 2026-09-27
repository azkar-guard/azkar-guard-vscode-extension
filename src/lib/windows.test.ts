import { describe, expect, it } from "vitest";
import type { PrayerDay } from "./types";
import { findWindow, windowKey } from "./windows";

const at = (iso: string) => Date.parse(iso);

const days: Record<string, PrayerDay> = {
  "2026-09-26": { fajr: at("2026-09-26T04:15:00+03:00"), maghrib: at("2026-09-26T18:00:00+03:00") },
  "2026-09-27": { fajr: at("2026-09-27T04:16:00+03:00"), maghrib: at("2026-09-27T17:59:00+03:00") },
};

describe("findWindow", () => {
  it("returns the morning window between Fajr and Maghrib", () => {
    const w = findWindow(days, at("2026-09-26T09:00:00+03:00"));
    expect(w).toMatchObject({ session: "morning", date: "2026-09-26" });
    expect(w && windowKey(w)).toBe("2026-09-26:morning");
  });

  it("returns the evening window between Maghrib and next Fajr", () => {
    const w = findWindow(days, at("2026-09-26T21:00:00+03:00"));
    expect(w).toMatchObject({ session: "evening", date: "2026-09-26", end: days["2026-09-27"]!.fajr });
  });

  it("keeps an after-midnight evening on the previous date", () => {
    const w = findWindow(days, at("2026-09-27T02:00:00+03:00"));
    expect(w).toMatchObject({ session: "evening", date: "2026-09-26" });
  });

  it("treats Fajr as the start of morning and Maghrib as the start of evening", () => {
    expect(findWindow(days, days["2026-09-27"]!.fajr)?.session).toBe("morning");
    expect(findWindow(days, days["2026-09-26"]!.maghrib)?.session).toBe("evening");
  });

  it("returns null when the next day's Fajr is not cached", () => {
    expect(findWindow(days, at("2026-09-27T20:00:00+03:00"))).toBeNull();
  });
});
