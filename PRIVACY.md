# Azkar Guard for VS Code: privacy policy

*Last updated: 2026-09-27*

Azkar Guard is a VS Code extension that reminds you to complete your morning and evening Azkar. It has no accounts, no analytics, no ads and no servers of its own.

## What is stored, and where

- **Settings** (location, calculation method, level, language, reminder options) are ordinary VS Code settings in your user settings.
- **Progress** (tap counts for the current session), **completion history** (for the streak), the **break timer** state and **cached prayer times** are kept in VS Code's extension storage on your machine.

If you use VS Code **Settings Sync**, your settings, progress and completion history sync between your own machines through your Settings Sync account (Microsoft or GitHub), like any other VS Code setting. Nothing is sent to the Azkar Guard authors. Uninstalling the extension removes its stored state.

## What leaves your machine

- **Prayer times:** to calculate Fajr and Maghrib, the extension requests prayer times from the [AlAdhan API](https://aladhan.com) (`api.aladhan.com`). Each request contains your city and country, or your coordinates, plus the calculation method. AlAdhan receives these the way any web server receives a request, including your IP address. See [AlAdhan's terms](https://aladhan.com/credits-and-terms).
- **Nothing else.** The extension does not read your code or files, and makes no other network requests.

## Activity

To time the "Azkar break", the extension notices *that* you are active in VS Code (typing, moving the cursor, switching files). This happens only in memory. It never reads, stores or sends what you type or which files you open.

## Contact

Open an issue in the project's GitHub repository.
