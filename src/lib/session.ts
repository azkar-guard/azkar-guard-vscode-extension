import { azkarFor } from "./azkar";
import { localDate } from "./dates";
import { t } from "./i18n";
import { ensurePrayerDays } from "./prayer";
import { get, getSettings, set } from "./storage";
import { currentStreak } from "./streak";
import type { AzkarWindow, Dhikr, Settings } from "./types";
import { findWindow, windowKey } from "./windows";

/** Everything the UI and background need to know about "right now". */
export type Status =
  | { state: "unconfigured"; settings: Settings; streak: number }
  | { state: "error"; settings: Settings; streak: number; error: string }
  | {
      state: "active";
      settings: Settings;
      streak: number;
      window: AzkarWindow;
      items: Dhikr[];
      remaining: Record<string, number>;
      doneCount: number;
      total: number;
      complete: boolean;
    };

export type ActiveStatus = Extract<Status, { state: "active" }>;

export async function getStatus(now = Date.now()): Promise<Status> {
  const settings = await getSettings();
  const history = (await get("history")) ?? {};

  if (!settings.location) {
    return { state: "unconfigured", settings, streak: currentStreak(history, localDate(now)) };
  }

  let window: AzkarWindow | null;
  try {
    window = findWindow(await ensurePrayerDays(settings, now), now);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { state: "error", settings, streak: currentStreak(history, localDate(now)), error };
  }
  if (!window) {
    const streak = currentStreak(history, localDate(now));
    return { state: "error", settings, streak, error: t(settings.language, "error.noWindow") };
  }

  const items = azkarFor(window.session, settings.level);
  const progress = await get("progress");
  const saved = progress?.windowKey === windowKey(window) ? progress.remaining : {};
  const remaining: Record<string, number> = {};
  for (const item of items) remaining[item.id] = saved[item.id] ?? item.required_count;

  const doneCount = items.filter((i) => remaining[i.id] === 0).length;
  const complete = Boolean(history[window.date]?.[window.session]) || doneCount === items.length;

  return {
    state: "active",
    settings,
    streak: currentStreak(history, window.date),
    window,
    items,
    remaining,
    doneCount,
    total: items.length,
    complete,
  };
}

/** Count one repetition of a dhikr. Records the session as complete when all reach zero. */
export async function tap(id: string): Promise<Status> {
  const status = await getStatus();
  if (status.state !== "active" || status.complete) return status;

  const left = status.remaining[id];
  if (left === undefined || left <= 0) return status;

  const remaining = { ...status.remaining, [id]: left - 1 };
  await set("progress", { windowKey: windowKey(status.window), remaining });

  if (Object.values(remaining).every((n) => n === 0)) {
    const history = (await get("history")) ?? {};
    const { date, session } = status.window;
    history[date] = { ...history[date], [session]: Date.now() };
    await set("history", history);
  }
  return getStatus();
}
