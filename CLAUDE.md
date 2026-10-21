# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Obsidian community plugin ("Smart DayNight switcher", id `smart-day-night-switcher`) that computes local dawn/dusk from user-entered latitude/longitude and toggles Obsidian between light and dark color schemes. The repo is checked out directly inside a dev vault's `.obsidian/plugins/` folder, so a build output (`main.js`) is picked up by that vault on reload.

## Commands

- `npm run dev` — esbuild in watch mode, writes `main.js` with inline sourcemaps.
- `npm run build` — type-check (`tsc -noEmit -skipLibCheck`) then minified production bundle to `main.js`.
- `npx eslint main.ts` — lint (config in `.eslintrc`; no npm script for it).
- `npm version <patch|minor|major>` — bumps `package.json`, then `version-bump.mjs` syncs `manifest.json` version and adds an entry to `versions.json` (version → `minAppVersion`). Keep these three files in sync when releasing.

There is no test suite.

## Architecture

All source is in `main.ts` (bundled by `esbuild.config.mjs` to CommonJS, `obsidian`/`electron`/CodeMirror externals).

- **`SDNSPlugin`** (SDNS = Smart DayNight Switcher):
  - On load, records the user's current scheme (`defaultColorScheme`) so `onunload` can restore it.
  - `checkAndSwitchColorScheme()` uses `SunCalc.getTimes()` — "dawn" is SunCalc's `dawn`, "dusk" is SunCalc's `sunsetStart` — applies the scheme for the current period, then schedules a single `setTimeout` for the next transition (today's dawn, today's dusk, or tomorrow's dawn) that calls itself again. Any existing timeout is cleared first, so it is safe to call repeatedly (e.g. from `saveSettings`).
  - `setColorScheme()` switches by toggling `theme-light`/`theme-dark` classes on `document.body` and triggering the workspace `css-change` event; it does not change Obsidian's persisted appearance setting.
- **Settings**: latitude/longitude are stored as strings (coerced with unary `+` when used); defaults are London. Text inputs use Obsidian's `debounce` and every save re-runs the scheduler.
- **`SDNSPluginSettingTab`**: builds the UI with Obsidian's `createEl`/`Setting` APIs (avoid `innerHTML`, which Obsidian's plugin review disallows) and renders a 31-day dawn/dusk schedule table from the same SunCalc calls as the scheduler. The table is generated in `display()`, so it reflects new coordinates only when the tab is re-opened.

`styles.css` is the unused template placeholder. `ts-debounce` is listed as a dependency but the code uses Obsidian's built-in `debounce`.
