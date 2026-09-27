// Integration tests, run inside a real VS Code by test/run.mjs.
// Kept dependency-free: a tiny sequential runner with node:assert.
import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import type { TestApi } from "../extension";

const tests: [string, () => Promise<void>][] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push([name, fn]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let api: TestApi;
const prompts: string[] = [];

async function configure(key: string, value: unknown): Promise<void> {
  await vscode.workspace.getConfiguration("azkarGuard").update(key, value, vscode.ConfigurationTarget.Global);
}

async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean, what: string, ms = 20000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (ok(v)) return v;
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await sleep(250);
  }
}

test("activates and registers its commands", async () => {
  const ext = vscode.extensions.getExtension("azkar-guard.azkar-guard");
  assert.ok(ext, "extension found");
  api = (await ext.activate()) as TestApi;
  assert.ok(api, "test API returned in test mode");
  const commands = await vscode.commands.getCommands(true);
  for (const c of ["azkarGuard.openChecklist", "azkarGuard.setLocation", "azkarGuard.openSettings"]) {
    assert.ok(commands.includes(c), `${c} registered`);
  }
});

test("is unconfigured until a location is set", async () => {
  assert.equal((await api.status()).state, "unconfigured");
});

test("converts an old free-text city setting to coordinates from the offline list", async () => {
  await configure("location.city", "Cairo");
  await configure("location.country", "Egypt");
  await api.migrateLegacyLocation();
  const c = vscode.workspace.getConfiguration("azkarGuard");
  assert.equal(c.get("location.latitude"), 30.0626);
  assert.equal(c.get("location.longitude"), 31.2497);
  assert.equal(c.get("location.name"), "Cairo, Egypt");
  assert.equal(c.get("location.city"), "", "legacy city cleared");
});

test("computes the current window on-device from coordinates", async () => {
  await configure("breakAfterMinutes", 5);
  await configure("snoozeMinutes", 2);
  const status = await waitFor(() => api.status(), (s) => s.state === "active", "active status");
  assert.equal(status.state, "active");
});

test("Set location → Detect from time zone saves coordinates without any network", async () => {
  const w = vscode.window as unknown as Record<string, unknown>;
  const originals = { quickPick: w.showQuickPick, info: w.showInformationMessage };
  let offered: string[] = [];
  w.showQuickPick = async (items: readonly { label: string }[]) => {
    offered = items.map((i) => i.label);
    return items[0]; // "Detect from time zone" is first when the zone is known
  };
  w.showInformationMessage = async () => undefined;
  try {
    await configure("location.latitude", null);
    await configure("location.longitude", null);
    await vscode.commands.executeCommand("azkarGuard.setLocation");
    const c = vscode.workspace.getConfiguration("azkarGuard");
    assert.ok(offered.length === 3, `three choices offered (${offered.join(" | ")})`);
    assert.equal(typeof c.get("location.latitude"), "number");
    assert.ok(String(c.get("location.name")).length > 0, "display name saved");
  } finally {
    w.showQuickPick = originals.quickPick;
    w.showInformationMessage = originals.info;
  }
  // Back to Cairo for the remaining tests.
  await configure("location.latitude", 30.0626);
  await configure("location.longitude", 31.2497);
});

test("opens the checklist as a webview tab", async () => {
  await vscode.commands.executeCommand("azkarGuard.openChecklist");
  await sleep(500);
  const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
  const webview = tabs.find((t) => t.input instanceof vscode.TabInputWebview && t.input.viewType.endsWith("azkarGuard.checklist"));
  assert.ok(webview, "checklist tab open");
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
});

test("prompts after the configured active minutes, and allows exactly two snoozes", async () => {
  // Stub the modal: record the message and answer according to `answer`.
  const original = vscode.window.showWarningMessage;
  (vscode.window as { showWarningMessage: unknown }).showWarningMessage = async (message: string, ...rest: unknown[]) => {
    prompts.push(message);
    // Pick "Snooze" while it is offered; with no snooze left there is no second button,
    // which behaves like pressing Esc.
    const buttons = rest.filter((x): x is string => typeof x === "string");
    return buttons[1];
  };
  try {
    await api.simulateActiveMinutes(4);
    assert.equal(prompts.length, 0, "no prompt before 5 active minutes");
    await api.simulateActiveMinutes(1);
    assert.equal(prompts.length, 1, "prompt at 5 active minutes");
    assert.deepEqual(pick(await api.breakState()), { snoozesUsed: 1, dueAt: 7 });

    await api.simulateActiveMinutes(2);
    assert.equal(prompts.length, 2, "prompt again after the 2-minute snooze");
    assert.deepEqual(pick(await api.breakState()), { snoozesUsed: 2, dueAt: 9 });

    // No snoozes left: every editor/tab change brings the prompt back.
    await api.editorChanged();
    assert.equal(prompts.length, 3, "prompt on editor change once snoozes are used up");
    await api.editorChanged();
    assert.equal(prompts.length, 4, "and again on the next change");
  } finally {
    (vscode.window as { showWarningMessage: unknown }).showWarningMessage = original;
  }
});

test("stops prompting once the session is complete", async () => {
  await api.completeSession();
  const status = await api.status();
  assert.ok(status.state === "active" && status.complete, "session complete");
  const before = prompts.length;
  await api.editorChanged();
  await api.simulateActiveMinutes(30);
  assert.equal(prompts.length, before, "no prompts after completion");
});

function pick(state: unknown): { snoozesUsed: number; dueAt: number } {
  const s = state as { snoozesUsed: number; dueAt: number };
  return { snoozesUsed: s.snoozesUsed, dueAt: s.dueAt };
}

export async function run(): Promise<void> {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
    } catch (err) {
      failed++;
      console.log(`  ✗ ${name}\n    ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\n${tests.length - failed} passed, ${failed} failed`);
  if (failed) throw new Error(`${failed} integration test(s) failed`);
}
