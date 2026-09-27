export type Session = "morning" | "evening";
export type Level = "small" | "medium" | "full";
export type Lang = "en" | "ar";

/** One entry of src/data/azkar.json. */
export interface Dhikr {
  id: string;
  session: Session | "both";
  arabic_text: string;
  required_count: number;
  /** Smallest level that includes this dhikr. Levels are cumulative: small ⊂ medium ⊂ full. */
  level: Level;
  source: string;
  /** English translation of meaning. */
  translation_en: string;
  /** Latin transliteration for readers who cannot read Arabic script. */
  transliteration: string;
  virtue_note?: string;
  /** Arabic virtue note: a verbatim hadith excerpt with reference, or a paraphrase marked «بمعناه». */
  virtue_note_ar?: string;
}

export type Location =
  | { kind: "city"; city: string; country: string }
  | { kind: "coords"; latitude: number; longitude: number };

export interface Settings {
  location: Location | null;
  /** Aladhan calculation method id. */
  method: number;
  level: Level;
  /** Reminder notification every 30 minutes while a session is incomplete. */
  notifications: boolean;
  /** Interface language (resolved from the setting; "auto" follows VS Code's display language). */
  language: Lang;
  /** Minutes of active coding, with the session incomplete, before an "Azkar break" prompt. */
  breakAfterMinutes: number;
  /** Minutes of active coding a snooze postpones the next prompt by. */
  snoozeMinutes: number;
}

/**
 * Azkar-break bookkeeping for the current window. Reset whenever the window changes.
 * "Active" minutes only count while VS Code is focused and the user touched it recently.
 */
export interface BreakState {
  windowKey: string;
  activeMinutes: number;
  /** Active minutes at which the next prompt is due. */
  dueAt: number;
  snoozesUsed: number;
  /** Epoch ms of the last 30-minute reminder notification. */
  lastNagAt: number;
}

/** Prayer times for one calendar date, as epoch milliseconds. */
export interface PrayerDay {
  fajr: number;
  maghrib: number;
}

export interface PrayerCache {
  /** Identifies the location + method the days were fetched for. */
  key: string;
  /** Keyed by YYYY-MM-DD in the location's own calendar. */
  days: Record<string, PrayerDay>;
}

/** An active Azkar window. Morning = Fajr → Maghrib, Evening = Maghrib → next Fajr. */
export interface AzkarWindow {
  session: Session;
  /** Date the window started on (YYYY-MM-DD); an evening after midnight belongs to the previous date. */
  date: string;
  start: number;
  end: number;
}

/** Tap progress for the current window only; reset when the window changes. */
export interface Progress {
  windowKey: string;
  remaining: Record<string, number>;
}

/** Completion timestamps (epoch ms) per date and session. */
export type History = Record<string, Partial<Record<Session, number>>>;
