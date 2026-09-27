import type { BreakState, History, Progress, Settings } from "./types";

/** Persistent state, backed by VS Code's `globalState` (see extension.ts). */
interface Store {
  progress: Progress;
  history: History;
  breakState: BreakState;
}

export type StoreKey = keyof Store;

/** Keys synced across machines through VS Code Settings Sync. */
export const SYNCED_KEYS: StoreKey[] = ["progress", "history"];

/** The subset of vscode.Memento this module needs, so the logic stays testable without VS Code. */
export interface Memento {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void> | Promise<void>;
}

let memento: Memento | undefined;
let settingsSource: (() => Settings) | undefined;

export function initStorage(state: Memento, settings: () => Settings): void {
  memento = state;
  settingsSource = settings;
}

function requireMemento(): Memento {
  if (!memento) throw new Error("storage used before initStorage()");
  return memento;
}

export async function get<K extends StoreKey>(key: K): Promise<Store[K] | undefined> {
  return requireMemento().get<Store[K]>(key);
}

export async function set<K extends StoreKey>(key: K, value: Store[K]): Promise<void> {
  await requireMemento().update(key, value);
}

/** Settings live in VS Code's configuration (also synced by Settings Sync). */
export async function getSettings(): Promise<Settings> {
  if (!settingsSource) throw new Error("storage used before initStorage()");
  return settingsSource();
}
