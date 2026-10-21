# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Obsidian community plugin ("Smart DayNight switcher", id `smart-day-night-switcher`) that computes local dawn/dusk from user-entered latitude/longitude and toggles Obsidian between light and dark color schemes. The repo is checked out directly inside a dev vault's `.obsidian/plugins/` folder, so a build output (`main.js`) is picked up by that vault on reload.

## Commands

- `npm run dev` — esbuild in watch mode, writes `main.js` with inline sourcemaps.
- `npm run build` — type-check (`tsc -noEmit -skipLibCheck`) then minified production bundle to `main.js`.
- `npm run lint` — ESLint over `src/` (config in `.eslintrc`).
- `npm version <patch|minor|major>` — bumps `package.json`, then `version-bump.mjs` syncs `manifest.json` version and adds an entry to `versions.json` (version → `minAppVersion`). Keep these three files in sync when releasing.

There is no test suite.

## Architecture

Source lives in `src/`, entry `src/main.ts` (bundled by `esbuild.config.mjs` to CommonJS at the repo root `main.js`, `obsidian`/`electron`/CodeMirror externals).

- **`main.ts` — `SDNSPlugin`** (SDNS = Smart DayNight Switcher):
  - On load, records the user's current scheme (`defaultColorScheme`) so `onunload` can restore it.
  - `checkAndSwitchColorScheme()` asks `getSchemeState()` for the current scheme and the delay until the next transition, applies it, then schedules a single `setTimeout` that calls itself again. Any existing timeout is cleared first, so it is safe to call repeatedly (e.g. from `saveSettings`).
- **`sun-times.ts`** — pure SunCalc wrappers (no DOM/Obsidian imports, so unit-testable): `getSunTimes()` ("dawn" is SunCalc's `dawn`, "dusk" is SunCalc's `sunsetStart`), `getSchemeState()` (dark before dawn, light until dusk, then dark until tomorrow's dawn), `getSchedule()` for the settings table.
- **`color-scheme.ts`** — `getColorScheme()` / `setColorScheme()`; switches by toggling `theme-light`/`theme-dark` classes on `document.body` and triggering the workspace `css-change` event; it does not change Obsidian's persisted appearance setting.
- **`settings.ts`** — settings interface and defaults (London). Latitude/longitude are stored as strings (coerced with unary `+` when used).
- **`settings-tab.ts` — `SDNSPluginSettingTab`**: builds the UI with Obsidian's `createEl`/`Setting` APIs (avoid `innerHTML`, which Obsidian's plugin review disallows). Text inputs use Obsidian's `debounce` and every save re-runs the scheduler. Renders a 31-day dawn/dusk table from `getSchedule()`; it is generated in `display()`, so it reflects new coordinates only when the tab is re-opened.
- **`format.ts`** — pure date/time formatting for the table.

`styles.css` is the unused template placeholder. `ts-debounce` is listed as a dependency but the code uses Obsidian's built-in `debounce`.
