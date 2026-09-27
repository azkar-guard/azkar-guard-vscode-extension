import { MINUTE } from "./dates";
import type { BreakState, Settings } from "./types";

/** Snoozes allowed per session before the prompt returns on every editor/tab change. */
export const MAX_SNOOZES = 2;
/** A minute counts as "active" if VS Code is focused and was used within this long. */
export const ACTIVE_GRACE_MS = 2 * MINUTE;
/** Reminder notification cadence while a session is incomplete (shared core mechanic). */
export const NAG_INTERVAL_MS = 30 * MINUTE;

export type PromptChoice = "break" | "snooze" | "dismiss";

export function freshBreakState(windowKey: string, settings: Pick<Settings, "breakAfterMinutes">): BreakState {
  // lastNagAt 0: remind as soon as a new window is seen.
  return { windowKey, activeMinutes: 0, dueAt: settings.breakAfterMinutes, snoozesUsed: 0, lastNagAt: 0 };
}

/** Keep the state for the current window, or start fresh when the window changed. */
export function forWindow(
  state: BreakState | undefined,
  windowKey: string,
  settings: Pick<Settings, "breakAfterMinutes">,
): BreakState {
  return state?.windowKey === windowKey ? state : freshBreakState(windowKey, settings);
}

export interface TickInput {
  now: number;
  focused: boolean;
  lastActivityAt: number;
  complete: boolean;
  notifications: boolean;
}

/**
 * Advance one minute. Counts an active minute when the user is working, and decides
 * whether to show the break prompt and/or the 30-minute reminder (never both at once).
 */
export function tick(state: BreakState, input: TickInput): { state: BreakState; prompt: boolean; nag: boolean } {
  if (input.complete) return { state, prompt: false, nag: false };

  const active = input.focused && input.now - input.lastActivityAt <= ACTIVE_GRACE_MS;
  const next = { ...state, activeMinutes: state.activeMinutes + (active ? 1 : 0) };

  const prompt = next.activeMinutes >= next.dueAt;
  const nag = !prompt && input.notifications && input.now - next.lastNagAt >= NAG_INTERVAL_MS;
  if (nag) next.lastNagAt = input.now;
  return { state: next, prompt, nag };
}

/**
 * Apply the user's answer to a break prompt. Every outcome pushes the next time-based
 * prompt `snoozeMinutes` of active work into the future; only "snooze" uses up a snooze.
 * Dismissing (Esc) while snoozes remain counts as a snooze, so it cannot be used to
 * bypass the limit.
 */
export function afterPrompt(
  state: BreakState,
  choice: PromptChoice,
  settings: Pick<Settings, "snoozeMinutes">,
): BreakState {
  const next = { ...state, dueAt: state.activeMinutes + settings.snoozeMinutes };
  if (choice === "snooze" || (choice === "dismiss" && state.snoozesUsed < MAX_SNOOZES)) {
    next.snoozesUsed = Math.min(MAX_SNOOZES, state.snoozesUsed + 1);
  }
  return next;
}

export function snoozesLeft(state: BreakState): number {
  return Math.max(0, MAX_SNOOZES - state.snoozesUsed);
}

/**
 * Once both snoozes are used up, the prompt returns on every editor/tab or window change
 * until the session is complete.
 */
export function promptOnEditorChange(state: BreakState, complete: boolean): boolean {
  return !complete && state.snoozesUsed >= MAX_SNOOZES;
}
