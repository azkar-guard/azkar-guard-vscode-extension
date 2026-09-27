import * as vscode from "vscode";
import { cityLocation, findCity } from "./lib/locations";
import type { Lang, Level, Location, Settings } from "./lib/types";

export const SECTION = "azkarGuard";
const LEVELS: Level[] = ["small", "medium", "full"];

/** Read the extension's settings from VS Code's configuration. */
export function readSettings(): Settings {
  const c = vscode.workspace.getConfiguration(SECTION);
  const level = c.get<Level>("level", "small");
  return {
    location: readLocation(c),
    method: c.get<number>("method", 3),
    level: LEVELS.includes(level) ? level : "small",
    language: resolveLanguage(c.get<string>("language", "auto")),
    notifications: c.get<boolean>("notifications", true),
    breakAfterMinutes: Math.max(5, c.get<number>("breakAfterMinutes", 60)),
    snoozeMinutes: Math.max(1, c.get<number>("snoozeMinutes", 15)),
  };
}

function readLocation(c: vscode.WorkspaceConfiguration): Location | null {
  const latitude = c.get<number | null>("location.latitude", null);
  const longitude = c.get<number | null>("location.longitude", null);
  if (typeof latitude === "number" && typeof longitude === "number") {
    const name = c.get<string>("location.name", "").trim();
    return { latitude, longitude, ...(name ? { name } : {}) };
  }
  // Settings from before on-device calculation: resolve the city from the offline list.
  const legacy = legacyCity();
  const city = legacy && findCity(legacy.city, legacy.country);
  return city ? cityLocation(city) : null;
}

/** A free-text city/country from before v0.2, if still set. */
export function legacyCity(): { city: string; country: string } | undefined {
  const c = vscode.workspace.getConfiguration(SECTION);
  const city = c.get<string>("location.city", "").trim();
  const country = c.get<string>("location.country", "").trim();
  return city ? { city, country } : undefined;
}

function resolveLanguage(setting: string): Lang {
  if (setting === "en" || setting === "ar") return setting;
  return vscode.env.language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

/** Write a setting to the user (global) scope, so it applies everywhere and syncs. */
export function updateSetting(key: string, value: unknown): Thenable<void> {
  return vscode.workspace.getConfiguration(SECTION).update(key, value, vscode.ConfigurationTarget.Global);
}

/** Save a location as coordinates (plus display name), replacing any legacy city/country. */
export async function saveLocation(location: Location): Promise<void> {
  await updateSetting("location.latitude", location.latitude);
  await updateSetting("location.longitude", location.longitude);
  await updateSetting("location.name", location.name ?? "");
  await updateSetting("location.city", undefined);
  await updateSetting("location.country", undefined);
}
