import type { Reminder } from "./lib/reminders";
import type { Status } from "./lib/session";
import type { Lang, Level } from "./lib/types";

/** Messages from the checklist webview to the extension. */
export type FromWebview =
  | { type: "ready" }
  | { type: "tap"; id: string }
  | { type: "level"; level: Level }
  | { type: "setLocation" }
  | { type: "openSettings" };

/** Messages from the extension to the checklist webview. */
export type ToWebview = {
  type: "state";
  status: Status;
  lang: Lang;
  /** Estimated minutes per level for the current session. */
  minutes: Record<Level, number>;
  reminder: Reminder;
};
