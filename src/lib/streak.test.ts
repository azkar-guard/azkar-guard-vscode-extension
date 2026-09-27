import { describe, expect, it } from "vitest";
import { currentStreak, isDayComplete } from "./streak";
import type { History } from "./types";

const both = { morning: 1, evening: 2 };

describe("streak", () => {
  it("counts a day only when both sessions are complete", () => {
    expect(isDayComplete({ "2026-09-25": { morning: 1 } }, "2026-09-25")).toBe(false);
    expect(isDayComplete({ "2026-09-25": both }, "2026-09-25")).toBe(true);
  });

  it("does not break the streak while today is still in progress", () => {
    const history: History = { "2026-09-24": both, "2026-09-25": both, "2026-09-26": { morning: 1 } };
    expect(currentStreak(history, "2026-09-26")).toBe(2);
  });

  it("includes today once it is complete", () => {
    const history: History = { "2026-09-25": both, "2026-09-26": both };
    expect(currentStreak(history, "2026-09-26")).toBe(2);
  });

  it("stops at the first incomplete day", () => {
    const history: History = { "2026-09-22": both, "2026-09-24": { evening: 1 }, "2026-09-25": both };
    expect(currentStreak(history, "2026-09-26")).toBe(1);
  });

  it("crosses month boundaries", () => {
    const history: History = { "2026-08-31": both, "2026-09-01": both };
    expect(currentStreak(history, "2026-09-01")).toBe(2);
  });
});
