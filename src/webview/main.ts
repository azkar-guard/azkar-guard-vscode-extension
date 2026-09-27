// Checklist webview. Renders the state the extension posts, and sends taps and
// level changes back; all persistence happens in the extension host.
import { formatTime } from "../lib/dates";
import { t } from "../lib/i18n";
import type { ActiveStatus, Status } from "../lib/session";
import type { Dhikr, Lang, Level, Session } from "../lib/types";
import type { FromWebview, ToWebview } from "../protocol";
import { h } from "./dom";

declare function acquireVsCodeApi(): { postMessage(message: FromWebview): void };
const vscode = acquireVsCodeApi();

/** Minimum gap between counted taps, to prevent rapid-fire tapping. */
const TAP_COOLDOWN_MS = 400;
/** Number of light dots in the completion animation. */
const SPARKS = 12;
const LEVELS: Level[] = ["small", "medium", "full"];

// Static markup (no user data), so innerHTML is safe here.
const SEAL_SVG = `<svg viewBox="0 0 52 52" aria-hidden="true">
  <circle class="seal-ring" cx="26" cy="26" r="24" />
  <path class="seal-check" d="M15 27 l7 7 l15 -15" />
</svg>`;

const root = document.getElementById("app")!;
const brandName = document.getElementById("brand-name")!;

let current: ToWebview | undefined;
let lastTap = 0;
// Whether the collapsed "completed" group is expanded; kept across re-renders.
let doneOpen = false;
// The dhikr of the tap we are waiting on, to detect completions when the new state arrives.
let pendingTap: { id: string; wasComplete: boolean } | undefined;
let celebrate = false;

window.addEventListener("message", (event: MessageEvent<ToWebview>) => {
  if (event.data?.type !== "state") return;
  const previous = current;
  current = event.data;

  const tapped = pendingTap;
  pendingTap = undefined;
  const status = current.status;
  celebrate = Boolean(tapped && !tapped.wasComplete && status.state === "active" && status.complete);
  render();
  celebrate = false;

  const dhikrFinished =
    tapped && status.state === "active" && !status.complete && status.remaining[tapped.id] === 0 &&
    previous?.status.state === "active" && previous.status.remaining[tapped.id] !== 0;
  if (dhikrFinished) focusNext();
});

vscode.postMessage({ type: "ready" });

function render(): void {
  if (!current) return;
  const lang = current.lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  brandName.textContent = t(lang, "brand.name");

  const scrollTop = document.scrollingElement?.scrollTop ?? 0;
  const focusedId = (document.activeElement as HTMLElement | null)?.dataset.id;
  root.replaceChildren(view(current.status, lang), footer(lang));
  if (document.scrollingElement) document.scrollingElement.scrollTop = scrollTop;
  if (focusedId) root.querySelector<HTMLElement>(`[data-id="${CSS.escape(focusedId)}"]`)?.focus();
}

/** Bring the next unfinished dhikr to the top of the view after one is completed. */
function focusNext(): void {
  const next = root.querySelector<HTMLElement>(".list .dhikr-button");
  if (!next) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  next.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  next.focus({ preventScroll: true });
}

function onTap(id: string, button: HTMLElement): void {
  const now = Date.now();
  if (pendingTap || now - lastTap < TAP_COOLDOWN_MS) {
    button.classList.remove("rejected");
    void button.offsetWidth; // restart the animation
    button.classList.add("rejected");
    return;
  }
  lastTap = now;
  pendingTap = { id, wasComplete: current?.status.state === "active" && current.status.complete };
  vscode.postMessage({ type: "tap", id });
}

function view(status: Status, lang: Lang): HTMLElement {
  switch (status.state) {
    case "unconfigured":
      return h(
        "section",
        { class: "panel" },
        h("h2", {}, t(lang, "unconfigured.title")),
        h("p", {}, t(lang, "unconfigured.body")),
        button(t(lang, "setup.action"), () => vscode.postMessage({ type: "setLocation" })),
      );
    case "error":
      return h(
        "section",
        { class: "panel" },
        h("h2", {}, t(lang, "error.title")),
        h("p", { class: "muted" }, status.error),
        h("div", { class: "actions" }, button(t(lang, "action.settings"), () => vscode.postMessage({ type: "openSettings" }))),
      );
    case "active":
      return status.complete ? completeView(status, lang) : activeView(status, lang);
  }
}

const streakText = (lang: Lang, n: number) => t(lang, "meta.streak", { n, days: t(lang, n === 1 ? "days.one" : "days.other") });

function header(status: ActiveStatus, lang: Lang): HTMLElement {
  const { session, end } = status.window;
  const percent = Math.round((status.doneCount / status.total) * 100);
  return h(
    "header",
    { class: "session-header" },
    h(
      "div",
      { class: "title-row" },
      h("h1", {}, t(lang, `session.${session}`)),
      lang === "en" && h("span", { class: "arabic-title", lang: "ar", dir: "rtl" }, t("ar", `session.${session}`)),
    ),
    h(
      "p",
      { class: "meta" },
      [
        t(lang, "meta.progress", { done: status.doneCount, total: status.total }),
        t(lang, "meta.ends", { time: formatTime(end, lang) }),
        streakText(lang, status.streak),
      ].join(" · "),
    ),
    h("div", { class: "bar", role: "progressbar", "aria-valuenow": String(percent), "aria-valuemin": "0", "aria-valuemax": "100", style: `--p:${percent}%` }),
  );
}

function levelPicker(status: ActiveStatus, lang: Lang): HTMLElement {
  const pick = (level: Level) => {
    const selected = level === status.settings.level;
    const el = h(
      "button",
      { type: "button", class: `level${selected ? " selected" : ""}`, "aria-pressed": String(selected) },
      h("strong", {}, t(lang, `level.${level}`)),
      h("span", {}, t(lang, "level.minutes", { n: current?.minutes[level] ?? 0 })),
    );
    el.addEventListener("click", () => vscode.postMessage({ type: "level", level }));
    return el;
  };
  return h("div", { class: "levels", role: "group", "aria-label": t(lang, "level.group") }, ...LEVELS.map(pick));
}

function doneGroup(done: Dhikr[], lang: Lang): HTMLElement {
  const group = h(
    "details",
    { class: "done-group", open: doneOpen },
    h("summary", {}, t(lang, "done.summary", { n: done.length })),
    h(
      "ol",
      { class: "done-list" },
      ...done.map((d) =>
        h("li", { class: "dhikr done" }, h("span", { class: "check", "aria-hidden": "true" }, "✓"), h("span", { class: "arabic snippet", lang: "ar", dir: "rtl" }, d.arabic_text)),
      ),
    ),
  );
  group.addEventListener("toggle", () => {
    doneOpen = group.open;
  });
  return group;
}

function dhikrCard(d: Dhikr, left: number, lang: Lang): HTMLElement {
  const virtue =
    lang === "ar"
      ? d.virtue_note_ar && h("p", { class: "virtue", lang: "ar", dir: "rtl" }, d.virtue_note_ar)
      : d.virtue_note && h("p", { class: "virtue", lang: "en", dir: "ltr" }, d.virtue_note);
  const card = h(
    "button",
    { type: "button", class: "dhikr-button", "data-id": d.id, "aria-label": t(lang, "tap.label", { n: left }) },
    h("p", { class: "arabic", lang: "ar", dir: "rtl" }, d.arabic_text),
    lang === "en" && h("p", { class: "transliteration", lang: "ar-Latn", dir: "ltr" }, d.transliteration),
    lang === "en" && h("p", { class: "translation", lang: "en", dir: "ltr" }, d.translation_en),
    h("div", { class: "card-footer" }, virtue || h("span"), h("span", { class: "count", "aria-hidden": "true" }, String(left))),
  );
  card.addEventListener("click", () => onTap(d.id, card));
  return h("li", { class: "dhikr" }, card);
}

function activeView(status: ActiveStatus, lang: Lang): HTMLElement {
  const left = (d: Dhikr) => status.remaining[d.id] ?? 0;
  const done = status.items.filter((d) => left(d) === 0);
  const pending = status.items.filter((d) => left(d) > 0);
  return h(
    "div",
    {},
    header(status, lang),
    levelPicker(status, lang),
    done.length > 0 && doneGroup(done, lang),
    h("ol", { class: "list" }, ...pending.map((d) => dhikrCard(d, left(d), lang))),
  );
}

function completeView(status: ActiveStatus, lang: Lang): HTMLElement {
  const next: Session = status.window.session === "morning" ? "evening" : "morning";
  const reminder = current!.reminder;
  const seal = h("div", { class: "seal" });
  seal.innerHTML = SEAL_SVG;
  if (celebrate) {
    for (let i = 0; i < SPARKS; i++) {
      seal.append(h("span", { class: "spark", style: `--a:${(360 / SPARKS) * i}deg;--d:${(i % 3) * 60}ms` }));
    }
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  }
  return h(
    "section",
    { class: `panel complete${celebrate ? " celebrate" : ""}`, role: "status" },
    seal,
    h("p", { class: "arabic big", lang: "ar", dir: "rtl" }, t(lang, "complete.praise")),
    h("h2", {}, t(lang, "complete.title", { session: t(lang, `session.${status.window.session}`) })),
    h(
      "p",
      { class: "meta" },
      [t(lang, "complete.next", { session: t(lang, `session.${next}`), time: formatTime(status.window.end, lang) }), streakText(lang, status.streak)].join(" · "),
    ),
    h("blockquote", {}, reminder.text, h("cite", {}, reminder.ref)),
  );
}

/** Source credits. Tanzil's licence requires a visible link to tanzil.net wherever its text appears. */
function footer(lang: Lang): HTMLElement {
  const link = (href: string, label: string) => h("a", { href }, label);
  return h(
    "footer",
    { class: "sources" },
    t(lang, "footer.sources"), " ",
    link("https://www.hisnmuslim.com", t(lang, "footer.azkar")), " · ",
    link("https://tanzil.net", t(lang, "footer.quran")), " · ",
    link("https://github.com/batoulapps/adhan-js", t(lang, "footer.prayer")), " · ",
    link("https://www.geonames.org", t(lang, "footer.cities")),
  );
}

function button(label: string, onClick: () => void, variant = "primary"): HTMLButtonElement {
  const el = h("button", { type: "button", class: `btn ${variant}` }, label);
  el.addEventListener("click", onClick);
  return el;
}
