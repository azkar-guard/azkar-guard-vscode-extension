import { describe, expect, it } from "vitest";
import {
  afterPrompt,
  ACTIVE_GRACE_MS,
  forWindow,
  freshBreakState,
  MAX_SNOOZES,
  NAG_INTERVAL_MS,
  promptOnEditorChange,
  snoozesLeft,
  tick,
} from "./breaks";
import { MINUTE } from "./dates";
import type { BreakState } from "./types";

const settings = { breakAfterMinutes: 60, snoozeMinutes: 15 };
const T0 = Date.parse("2026-09-27T09:00:00Z");
const working = (now: number) => ({ now, focused: true, lastActivityAt: now - 10_000, complete: false, notifications: true });

/** Run `minutes` ticks of active work; returns the state and whether a prompt fired. */
function work(state: BreakState, minutes: number, start = T0) {
  let prompted = false;
  for (let i = 0; i < minutes; i++) {
    const r = tick(state, working(start + i * MINUTE));
    state = r.state;
    prompted ||= r.prompt;
  }
  return { state, prompted };
}

describe("break timer", () => {
  it("prompts only after the configured minutes of active work", () => {
    const s = freshBreakState("2026-09-27:morning", settings);
    expect(work(s, 59).prompted).toBe(false);
    expect(work(s, 60).prompted).toBe(true);
  });

  it("does not count unfocused or idle minutes", () => {
    let s = freshBreakState("k", settings);
    s = tick(s, { ...working(T0), focused: false }).state;
    s = tick(s, { ...working(T0), lastActivityAt: T0 - ACTIVE_GRACE_MS - 1 }).state;
    expect(s.activeMinutes).toBe(0);
  });

  it("never prompts or nags once the session is complete", () => {
    const s = { ...freshBreakState("k", settings), activeMinutes: 500 };
    expect(tick(s, { ...working(T0), complete: true })).toMatchObject({ prompt: false, nag: false });
  });

  it("resets when the window changes", () => {
    const s = { ...freshBreakState("2026-09-27:morning", settings), activeMinutes: 42, snoozesUsed: 2 };
    expect(forWindow(s, "2026-09-27:morning", settings)).toBe(s);
    expect(forWindow(s, "2026-09-27:evening", settings)).toMatchObject({ activeMinutes: 0, snoozesUsed: 0 });
  });
});

describe("snoozing", () => {
  it("allows two snoozes, each pushing the prompt back by snoozeMinutes", () => {
    let s = work(freshBreakState("k", settings), 60).state;
    s = afterPrompt(s, "snooze", settings);
    expect(s).toMatchObject({ snoozesUsed: 1, dueAt: 75 });
    expect(snoozesLeft(s)).toBe(1);
    s = afterPrompt(work(s, 15).state, "snooze", settings);
    expect(snoozesLeft(s)).toBe(0);
    expect(afterPrompt(s, "snooze", settings).snoozesUsed).toBe(MAX_SNOOZES);
  });

  it("counts Esc as a snooze while snoozes remain", () => {
    const s = afterPrompt(freshBreakState("k", settings), "dismiss", settings);
    expect(s.snoozesUsed).toBe(1);
  });

  it("returns on every editor change once snoozes are used up", () => {
    const s = { ...freshBreakState("k", settings), snoozesUsed: MAX_SNOOZES };
    expect(promptOnEditorChange(freshBreakState("k", settings), false)).toBe(false);
    expect(promptOnEditorChange(s, false)).toBe(true);
    expect(promptOnEditorChange(s, true)).toBe(false);
  });
});

describe("30-minute reminders", () => {
  it("nags on the first tick of a window, then every 30 minutes", () => {
    let s = freshBreakState("k", { breakAfterMinutes: 999 });
    const first = tick(s, working(T0));
    expect(first.nag).toBe(true);
    s = first.state;
    expect(tick(s, working(T0 + NAG_INTERVAL_MS - MINUTE)).nag).toBe(false);
    expect(tick(s, working(T0 + NAG_INTERVAL_MS)).nag).toBe(true);
  });

  it("respects the notifications setting and never nags on the same tick as a prompt", () => {
    const s = { ...freshBreakState("k", settings), activeMinutes: 59 };
    expect(tick(s, { ...working(T0), notifications: false }).nag).toBe(false);
    expect(tick(s, working(T0))).toMatchObject({ prompt: true, nag: false });
  });
});
