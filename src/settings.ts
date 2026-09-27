import * as vscode from "vscode";
import type { Lang, Level, Location, Settings } from "./lib/types";

export const SECTION = "azkarGuard";
const LEVELS: Level[] = ["small", "medium", "full"];

/** Read the extension's settings from VS Code's configuration. */
export function readSettings(): Settings {
  const c = vscode.workspace.getConfiguration(SECTION);
  const city = c.get<string>("location.city", "").trim();
  const country = c.get<string>("location.country", "").trim();
  const latitude = c.get<number | null>("location.latitude", null);
  const longitude = c.get<number | null>("location.longitude", null);

  let location: Location | null = null;
  if (city && country) location = { kind: "city", city, country };
  else if (typeof latitude === "number" && typeof longitude === "number") {
    location = { kind: "coords", latitude, longitude };
  }

  const level = c.get<Level>("level", "small");
  return {
    location,
    method: c.get<number>("method", 3),
    level: LEVELS.includes(level) ? level : "small",
    language: resolveLanguage(c.get<string>("language", "auto")),
    notifications: c.get<boolean>("notifications", true),
    breakAfterMinutes: Math.max(5, c.get<number>("breakAfterMinutes", 60)),
    snoozeMinutes: Math.max(1, c.get<number>("snoozeMinutes", 15)),
  };
}

function resolveLanguage(setting: string): Lang {
  if (setting === "en" || setting === "ar") return setting;
  return vscode.env.language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

/** Write a setting to the user (global) scope, so it applies everywhere and syncs. */
export function updateSetting(key: string, value: unknown): Thenable<void> {
  return vscode.workspace.getConfiguration(SECTION).update(key, value, vscode.ConfigurationTarget.Global);
}
