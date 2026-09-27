# Azkar Guard for VS Code: privacy policy

*Last updated: 2026-09-27*

Azkar Guard is a VS Code extension that reminds you to complete your morning and evening Azkar. It has no accounts, no analytics, no ads and no servers of its own.

## What is stored, and where

- **Settings** (location as coordinates and a display name, calculation method, level, language, reminder options) are ordinary VS Code settings in your user settings.
- **Progress** (tap counts for the current session), **completion history** (for the streak) and the **break timer** state are kept in VS Code's extension storage on your machine.

If you use VS Code **Settings Sync**, your settings, progress and completion history sync between your own machines through your Settings Sync account (Microsoft or GitHub), like any other VS Code setting. Nothing is sent to the Azkar Guard authors. Uninstalling the extension removes its stored state.

## What leaves your machine

**Nothing.** Prayer times are calculated on your machine with [adhan-js](https://github.com/batoulapps/adhan-js), and your location is chosen from a city list bundled with the extension, or detected from your computer's time zone. The extension makes **no network requests** and does not read your code or files.

## Activity

To time the "Azkar break", the extension notices *that* you are active in VS Code (typing, moving the cursor, switching files). This happens only in memory. It never reads, stores or sends what you type or which files you open.

## Contact

Open an issue in the project's GitHub repository.
