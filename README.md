# Azkar Guard for VS Code (حارس الأذكار)

Keeps reminding you until your morning and evening Azkar are complete, right inside VS Code. Built for developers who spend the whole day in the editor and let the Azkar slip.

Phase 2 of [Azkar Guard](https://github.com/azkar-guard). The browser extension is [azkar-guard-browser-extension](https://github.com/azkar-guard/azkar-guard-browser-extension).

## How it works

- **Status bar.** `$(shield) Azkar 2/8` shows the current session's progress. It stays highlighted until the session is done. Click it to open the checklist.
- **Checklist panel.** Tap each dhikr to count it down to zero. Taps closer than 400 ms apart are ignored. A session is done only when every dhikr is complete.
- **Levels.** Choose how much time you have: Small (~3 min), Medium (~8 min) or Full. Switch right from the checklist.
- **Azkar break.** After **60 minutes of active coding** with the session still incomplete, a prompt suggests a short Azkar break.
  - Only time you're actually working in a focused VS Code counts.
  - You can **snooze twice** per session.
  - After that, the prompt comes back **every time you switch editor tab or window** until the session is done.
- **Reminders.** A notification every 30 minutes while a session is incomplete.
- **Windows.** Morning runs from Fajr to Maghrib, evening from Maghrib to the next Fajr. They're calculated **on your machine** with [adhan-js](https://github.com/batoulapps/adhan-js). There are no network calls, and it works offline.
- **Arabic or English.** Follows VS Code's display language by default.
  - English mode adds transliteration and the meaning of each dhikr.
  - The dhikr itself is always shown in Arabic.
- **Syncs with Settings Sync.** Complete the session on your laptop and your desktop knows. No account or server of ours is involved.

## Getting started

1. Install the extension.
2. When asked, choose **Set location**, or run **Azkar Guard: Set location for prayer times** from the Command Palette. Then either:
   - **Detect from time zone:** uses your computer's time zone (e.g. `Africa/Cairo` → Cairo).
   - **Search for a city:** 6,000+ cities, in English or Arabic.
   - **Enter coordinates.**
3. Click the `Azkar` item in the status bar.

## Commands

| Command | |
|---|---|
| `Azkar Guard: Open Azkar checklist` | Open the checklist panel |
| `Azkar Guard: Set location for prayer times` | Enter city and country |
| `Azkar Guard: Open settings` | Show all Azkar Guard settings |

## Settings

| Setting | Default | |
|---|---|---|
| `azkarGuard.location.latitude` / `.longitude` | (empty) | Coordinates used to calculate prayer times (set by **Set location**) |
| `azkarGuard.location.name` | (empty) | Display name, e.g. `Cairo, Egypt` |
| `azkarGuard.method` | `3` (Muslim World League) | Calculation method (20 methods) |
| `azkarGuard.level` | `small` | `small`, `medium` or `full` |
| `azkarGuard.language` | `auto` | `auto`, `en` or `ar` |
| `azkarGuard.notifications` | `true` | 30-minute reminder notifications |
| `azkarGuard.breakAfterMinutes` | `60` | Active coding minutes before an Azkar break prompt |
| `azkarGuard.snoozeMinutes` | `15` | Active minutes a snooze postpones the prompt |

## Privacy

- **No account, ads or analytics.** Nothing is sent to us.
- **What leaves your machine:** nothing. Prayer times are calculated locally and the city list is bundled.
- **Activity detection:** the extension only notices *that* you are active in VS Code. It never reads your code.

See [PRIVACY.md](PRIVACY.md).

## Credits

- **Azkar text:** Hisn al-Muslim by Sa'id bin Ali bin Wahf al-Qahtani (via hisnmuslim.com).
- **Qur'an text:** Tanzil Project ([tanzil.net](https://tanzil.net)).
- **Hadith excerpts:** fawazahmed0/hadith-api.
- **Prayer times:** adhan-js (MIT), with method parameters from AlAdhan.
- **Cities:** GeoNames (CC BY 4.0).
- **Time zones:** the IANA tz database.

Full details are in [CREDITS.md](CREDITS.md). The code is MIT-licensed. The extension is and will remain free.

## Development

Requirements: Node 22.12+ (`.nvmrc` pins 24) and VS Code 1.95+.

```bash
npm install
npm run build              # typecheck + bundle (esbuild) into dist/
npm test                   # unit tests (vitest): windows, streak, data, break timer, locations,
                           # and prayer times vs AlAdhan reference fixtures (within 1 min)
npm run test:integration   # runs src/test/suite.ts inside a real, downloaded VS Code
npm run package            # builds azkar-guard-<version>.vsix
```

To try it locally, press **F5** in VS Code to launch an Extension Development Host. Or install the `.vsix`:

```bash
code --install-extension azkar-guard-0.1.0.vsix
```

**Layout:**

```
src/extension.ts       activation, status bar, break timer, reminders, commands
src/panel.ts           checklist webview panel (strict CSP, nonce'd script)
src/webview/           checklist UI rendered in the webview
src/lib/               pure logic, copied from the browser extension: windows, streak, session, i18n
src/lib/prayer.ts      on-device prayer times (adhan-js) and the calculation method mapping
src/lib/locations.ts   offline city search, time-zone detection, legacy setting migration
src/lib/breaks.ts      break timer state machine (active minutes, snoozes, reminders)
src/data/azkar.json    azkar data, copied from the browser extension
src/data/cities.json   offline cities (scripts/build_locations.py, GeoNames)
src/data/timezones.json  time zone → principal city coordinates (IANA tz)
src/lib/fixtures/      AlAdhan reference times for the accuracy tests (scripts/build_aladhan_fixtures.mjs)
src/test/suite.ts      integration tests
```

The azkar data and pure logic are deliberately copied from the browser extension rather than shared, per the project plan.

**Publishing** (later): the VS Code Marketplace (`vsce`) and Open VSX (`ovsx`), so Cursor, Windsurf and VSCodium users can install it too.
