import * as vscode from "vscode";
import { estimateMinutes, LEVELS } from "./lib/azkar";
import { afterPrompt, forWindow, promptOnEditorChange, snoozesLeft, tick, type PromptChoice } from "./lib/breaks";
import { formatTime, MINUTE } from "./lib/dates";
import { t } from "./lib/i18n";
import { randomReminder, type Reminder } from "./lib/reminders";
import { getStatus, tap, type ActiveStatus, type Status } from "./lib/session";
import { get, initStorage, set, SYNCED_KEYS } from "./lib/storage";
import type { Lang, Level } from "./lib/types";
import { windowKey } from "./lib/windows";
import { ChecklistPanel } from "./panel";
import type { FromWebview } from "./protocol";
import { readSettings, SECTION, updateSetting } from "./settings";

/** Host-side tap guard, just under the webview's 400 ms cooldown. */
const TAP_COOLDOWN_MS = 350;
/** Ignore focus/editor events right after a modal prompt closes, so it cannot re-trigger itself. */
const PROMPT_QUIET_MS = 1500;

export function activate(context: vscode.ExtensionContext): TestApi | undefined {
  initStorage(context.globalState, readSettings);
  // Progress and history follow the user across machines via VS Code Settings Sync.
  context.globalState.setKeysForSync(SYNCED_KEYS);
  const controller = new Controller(context);
  context.subscriptions.push(controller);
  void controller.start();
  // Integration tests (src/test) drive time and inspect state; nothing is exported otherwise.
  return context.extensionMode === vscode.ExtensionMode.Test ? controller.testApi() : undefined;
}

/** Hooks for the integration tests only (returned from activate() in test mode). */
export interface TestApi {
  status(): Promise<Status>;
  breakState(): Promise<unknown>;
  /** Run `n` minute ticks as if the user were actively coding. */
  simulateActiveMinutes(n: number): Promise<void>;
  /** Simulate switching editor tabs. */
  editorChanged(): Promise<void>;
  /** Tap every remaining dhikr down to zero. */
  completeSession(): Promise<void>;
}

export function deactivate(): void {}

class Controller implements vscode.Disposable {
  private readonly statusBar = vscode.window.createStatusBarItem("azkarGuard.status", vscode.StatusBarAlignment.Left, 50);
  private readonly panel: ChecklistPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastActivityAt = Date.now();
  private focused = vscode.window.state.focused;
  private promptOpen = false;
  private quietUntil = 0;
  private lastTapAt = 0;
  private setupOffered = false;
  /** One reminder per window, so the completion screen doesn't change text on every refresh. */
  private reminder: { key: string; lang: Lang; value: Reminder } | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.panel = new ChecklistPanel(context.extensionUri, (m) => void this.onWebviewMessage(m));
    this.statusBar.name = "Azkar Guard";
    this.statusBar.command = "azkarGuard.openChecklist";
    this.disposables.push(
      this.statusBar,
      this.panel,
      vscode.commands.registerCommand("azkarGuard.openChecklist", () => this.openChecklist()),
      vscode.commands.registerCommand("azkarGuard.setLocation", () => this.setLocation()),
      vscode.commands.registerCommand("azkarGuard.openSettings", () => this.openSettings()),
      // Anything the user does in VS Code counts as activity for the break timer.
      vscode.workspace.onDidChangeTextDocument(() => this.activity()),
      vscode.window.onDidChangeTextEditorSelection(() => this.activity()),
      vscode.window.onDidChangeActiveTerminal(() => this.activity()),
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.activity();
        void this.onEditorChange();
      }),
      vscode.window.onDidChangeWindowState((state) => {
        const gainedFocus = state.focused && !this.focused;
        this.focused = state.focused;
        if (gainedFocus) {
          this.activity();
          void this.onEditorChange();
        }
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(SECTION)) void this.refresh();
      }),
    );
  }

  async start(): Promise<void> {
    await this.refresh();
    this.timer = setInterval(() => void this.minute(), MINUTE);
  }

  dispose(): void {
    clearInterval(this.timer);
    for (const d of this.disposables) d.dispose();
  }

  testApi(): TestApi {
    return {
      status: () => getStatus(),
      breakState: () => get("breakState"),
      simulateActiveMinutes: async (n) => {
        for (let i = 0; i < n; i++) {
          this.focused = true;
          this.activity();
          await this.minute();
        }
      },
      editorChanged: async () => {
        this.quietUntil = 0;
        await this.onEditorChange();
      },
      completeSession: async () => {
        const status = await getStatus();
        if (status.state !== "active") return;
        for (const d of status.items) {
          for (let left = status.remaining[d.id] ?? 0; left > 0; left--) await tap(d.id);
        }
        await this.refresh();
      },
    };
  }

  private activity(): void {
    this.lastActivityAt = Date.now();
  }

  /** Recompute status, update the status bar and the open checklist. */
  private async refresh(): Promise<Status> {
    const status = await getStatus();
    this.renderStatusBar(status);
    this.postToPanel(status);
    if (status.state === "unconfigured" && !this.setupOffered) {
      this.setupOffered = true;
      void this.offerSetup(status.settings.language);
    }
    return status;
  }

  /** Runs every minute: counts active time and decides on break prompts and reminders. */
  private async minute(): Promise<void> {
    const status = await this.refresh();
    if (status.state !== "active") return;
    const state = forWindow(await get("breakState"), windowKey(status.window), status.settings);
    const result = tick(state, {
      now: Date.now(),
      focused: this.focused,
      lastActivityAt: this.lastActivityAt,
      complete: status.complete,
      notifications: status.settings.notifications,
    });
    await set("breakState", result.state);
    // Never interrupt the user while they are doing their azkar in the checklist.
    if (result.prompt && !this.panel.active) await this.prompt(status);
    else if (result.nag && !this.panel.visible) this.nag(status);
  }

  /** After both snoozes are used, the prompt returns on every editor/tab or window change. */
  private async onEditorChange(): Promise<void> {
    if (this.promptOpen || Date.now() < this.quietUntil || this.panel.active) return;
    const status = await getStatus();
    if (status.state !== "active") return;
    const state = forWindow(await get("breakState"), windowKey(status.window), status.settings);
    if (promptOnEditorChange(state, status.complete)) await this.prompt(status);
  }

  private async prompt(status: ActiveStatus): Promise<void> {
    if (this.promptOpen) return;
    this.promptOpen = true;
    try {
      const lang = status.settings.language;
      const key = windowKey(status.window);
      const left = snoozesLeft(forWindow(await get("breakState"), key, status.settings));
      const start = t(lang, "break.start");
      const snooze = left > 0 ? t(lang, "break.snooze", { n: left }) : undefined;
      const message = t(lang, "break.message", {
        session: t(lang, `session.${status.window.session}`),
        done: status.doneCount,
        total: status.total,
        n: minutesLeft(status),
      });
      const buttons = snooze ? [start, snooze] : [start];
      const choice = await vscode.window.showWarningMessage(message, { modal: true }, ...buttons);
      const picked: PromptChoice = choice === start ? "break" : choice === snooze ? "snooze" : "dismiss";
      const current = forWindow(await get("breakState"), key, status.settings);
      await set("breakState", afterPrompt(current, picked, status.settings));
      if (picked === "break") this.openChecklist();
    } finally {
      this.promptOpen = false;
      this.quietUntil = Date.now() + PROMPT_QUIET_MS;
    }
  }

  private nag(status: ActiveStatus): void {
    const lang = status.settings.language;
    const open = t(lang, "action.openChecklist");
    const session = t(lang, `session.${status.window.session}`);
    const text = `${t(lang, "notify.title", { session })} ${t(lang, "notify.body", { done: status.doneCount, total: status.total })}`;
    void vscode.window.showInformationMessage(text, open).then((choice) => {
      if (choice === open) this.openChecklist();
    });
  }

  private renderStatusBar(status: Status): void {
    const lang = status.settings.language;
    const warning = new vscode.ThemeColor("statusBarItem.warningBackground");
    if (status.state === "unconfigured") {
      this.statusBar.text = `$(shield) ${t(lang, "status.setup")}`;
      this.statusBar.tooltip = t(lang, "setup.prompt");
      this.statusBar.backgroundColor = warning;
    } else if (status.state === "error") {
      this.statusBar.text = `$(shield) ${t(lang, "status.error")}`;
      this.statusBar.tooltip = status.error;
      this.statusBar.backgroundColor = undefined;
    } else {
      const session = t(lang, `session.${status.window.session}`);
      if (status.complete) {
        this.statusBar.text = `$(shield) ${t(lang, "status.done")}`;
        this.statusBar.tooltip = t(lang, "status.tooltipDone", { session });
        this.statusBar.backgroundColor = undefined;
      } else {
        this.statusBar.text = `$(shield) ${t(lang, "status.progress", { done: status.doneCount, total: status.total })}`;
        this.statusBar.tooltip = t(lang, "status.tooltip", { session, done: status.doneCount, total: status.total });
        this.statusBar.backgroundColor = warning;
      }
    }
    this.statusBar.show();
  }

  private postToPanel(status: Status): void {
    if (!this.panel.visible) return;
    const lang = status.settings.language;
    const session = status.state === "active" ? status.window.session : "morning";
    const minutes = Object.fromEntries(LEVELS.map((l) => [l, estimateMinutes(session, l)])) as Record<Level, number>;
    const key = status.state === "active" ? windowKey(status.window) : "none";
    if (this.reminder?.key !== key || this.reminder.lang !== lang) this.reminder = { key, lang, value: randomReminder(lang) };
    this.panel.setTitle(status.state === "active" ? t(lang, `session.${session}`) : t(lang, "brand.name"));
    this.panel.post({ type: "state", status, lang, minutes, reminder: this.reminder.value });
  }

  private openChecklist(): void {
    this.panel.show(readSettings().language);
    void this.refresh();
  }

  private async onWebviewMessage(message: FromWebview): Promise<void> {
    switch (message.type) {
      case "ready":
        await this.refresh();
        return;
      case "tap": {
        const now = Date.now();
        if (now - this.lastTapAt >= TAP_COOLDOWN_MS) {
          this.lastTapAt = now;
          await tap(message.id);
        }
        await this.refresh();
        return;
      }
      case "level":
        await updateSetting("level", message.level);
        return;
      case "setLocation":
        await this.setLocation();
        return;
      case "openSettings":
        await this.openSettings();
        return;
    }
  }

  private async offerSetup(lang: Lang): Promise<void> {
    const action = t(lang, "setup.action");
    const choice = await vscode.window.showInformationMessage(t(lang, "setup.prompt"), action);
    if (choice === action) await this.setLocation();
  }

  private async setLocation(): Promise<void> {
    const settings = readSettings();
    const lang = settings.language;
    const current = settings.location?.kind === "city" ? settings.location : undefined;
    const required = (value: string) => (value.trim() ? undefined : t(lang, "options.errCity"));
    const city = await vscode.window.showInputBox({ prompt: t(lang, "setup.city"), value: current?.city, ignoreFocusOut: true, validateInput: required });
    if (city === undefined) return;
    const country = await vscode.window.showInputBox({ prompt: t(lang, "setup.country"), value: current?.country, ignoreFocusOut: true, validateInput: required });
    if (country === undefined) return;
    await updateSetting("location.city", city.trim());
    await updateSetting("location.country", country.trim());

    const status = await this.refresh();
    if (status.state === "active") {
      const session = t(lang, `session.${status.window.session}`);
      void vscode.window.showInformationMessage(t(lang, "setup.saved", { session, time: formatTime(status.window.end, lang) }));
    } else if (status.state === "error") {
      void vscode.window.showErrorMessage(status.error);
    }
  }

  private openSettings(): Thenable<unknown> {
    return vscode.commands.executeCommand("workbench.action.openSettings", `@ext:${this.context.extension.id}`);
  }
}

/** Rough minutes left for the current session: ~1.2 s per remaining tap plus ~20 s per unfinished dhikr. */
function minutesLeft(status: ActiveStatus): number {
  const pending = status.items.filter((d) => (status.remaining[d.id] ?? 0) > 0);
  const taps = pending.reduce((sum, d) => sum + (status.remaining[d.id] ?? 0), 0);
  return Math.max(1, Math.round((taps * 1.2 + pending.length * 20) / 60));
}
