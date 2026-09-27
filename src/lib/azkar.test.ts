import { describe, expect, it } from "vitest";
import { ALL_AZKAR, azkarFor, LEVELS } from "./azkar";

describe("azkar data", () => {
  it("has unique ids and valid fields", () => {
    const ids = ALL_AZKAR.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of ALL_AZKAR) {
      expect(["morning", "evening", "both"]).toContain(d.session);
      expect(LEVELS).toContain(d.level);
      expect(d.required_count).toBeGreaterThan(0);
      expect(d.arabic_text.length).toBeGreaterThan(0);
    }
  });

  it("has an English translation for every dhikr and virtue notes in both languages", () => {
    for (const d of ALL_AZKAR) {
      expect(d.translation_en.length, d.id).toBeGreaterThan(0);
      expect(d.transliteration.length, d.id).toBeGreaterThan(0);
      expect(Boolean(d.virtue_note), d.id).toBe(Boolean(d.virtue_note_ar));
    }
  });

  it("makes levels cumulative for both sessions", () => {
    for (const session of ["morning", "evening"] as const) {
      const [small, medium, full] = LEVELS.map((l) => azkarFor(session, l).map((d) => d.id));
      expect(small!.length).toBeGreaterThan(0);
      expect(medium).toEqual(expect.arrayContaining(small!));
      expect(full).toEqual(expect.arrayContaining(medium!));
      expect(full!.length).toBeGreaterThan(medium!.length);
    }
  });

  it("never mixes morning-only and evening-only azkar", () => {
    expect(azkarFor("morning", "full").some((d) => d.session === "evening")).toBe(false);
    expect(azkarFor("evening", "full").some((d) => d.session === "morning")).toBe(false);
  });
});
