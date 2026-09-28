# Changelog

## 1.0.0

First stable release, matching the browser extension's 1.0.0. The features are the same as 0.2.0.

- **New extension ID: `s403o.azkar-guard-vscode` on the VS Code Marketplace and `azkar-guard.azkar-guard-vscode` on Open VSX.** Version 0.2.0 was briefly published as `azkar-guard.azkar-guard` and then removed. The Marketplace permanently reserves removed extension names, even for the original publisher, so the extension continues under the new ID. If you installed 0.2.0, install the new ID instead; your settings carry over because they live under `azkarGuard.*`.

## 0.2.0

- **Fully offline.** Prayer times are calculated on your machine with adhan-js. No network requests at all.
- **New Set location** menu:
  - detect from your computer's time zone
  - search a bundled list of 6,000+ cities (English or Arabic names)
  - or enter coordinates
- Existing `location.city` / `location.country` settings are converted to coordinates automatically.
- Checked against AlAdhan for 9 cities × 20 methods × 2 dates: all within 1 minute. The Moonsighting Committee method intentionally follows the committee's own rules.

## 0.1.0

First version (Phase 2 of Azkar Guard).

- Status bar item with the current session's progress. It is highlighted while the session is incomplete.
- Checklist panel: tap-to-count with a 400 ms cooldown, and three levels (Small / Medium / Full).
  - Arabic or English interface; English mode adds transliteration and meaning.
  - Hadith virtue notes, completed azkar folded away, and a completion celebration.
- Azkar break: after 60 minutes of active coding (configurable) with the session incomplete, a prompt offers a short break.
  - Two snoozes per session. After that, the prompt returns on every editor/tab or window change until the session is done.
- A reminder notification every 30 minutes while a session is incomplete (can be turned off).
- Prayer-time windows from AlAdhan (city or coordinates, many calculation methods).
- Progress and streak sync between your machines through VS Code Settings Sync.
