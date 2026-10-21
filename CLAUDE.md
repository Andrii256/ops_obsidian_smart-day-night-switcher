# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Obsidian community plugin ("Smart DayNight switcher", id `smart-day-night-switcher`) that computes local sunrise/sunset from user-entered latitude/longitude and toggles Obsidian between light and dark color schemes. The repo is checked out directly inside a dev vault's `.obsidian/plugins/` folder, so a build output (`main.js`) is picked up by that vault on reload.

## Commands

- `npm run dev` — esbuild in watch mode, writes `main.js` with inline sourcemaps.
- `npm run build` — type-check (`tsc -noEmit -skipLibCheck`) then minified production bundle to `main.js`.
- `npm run lint` — ESLint over `src/` and `test/` (config in `.eslintrc`).
- `npm test` — Vitest, single run. `npm run test:watch` for watch mode; `npx vitest run test/sun-times.test.ts` or `-t "<name>"` for one file/test.
- `npm version <patch|minor|major>` — bumps `package.json`, then `version-bump.mjs` syncs `manifest.json` version and adds an entry to `versions.json` (version → `minAppVersion`). Keep these three files in sync when releasing.

## Testing

README.md is the spec: tests should assert what it promises, not implementation details. `test/sun-times.test.ts` checks "light while the sun is up" against `SunCalc.getPosition` for cities across time zones and polar latitudes, independent of `getSunTimes`.


Vitest + happy-dom, configured in `vitest.config.mts` (`.mts` because the package isn't `"type": "module"`). Tests live in `test/*.test.ts`. Vitest 5 needs Node `^22.12 || ^24 || >=26` (see `engines`). `tsconfig.json` includes `**/*.ts`, so `npm run build` also type-checks the tests.

- **`obsidian` is stubbed.** The npm package is types-only, so `resolve.alias` points it at `test/__mocks__/obsidian.ts` (`Plugin` with `registerInterval`/`unload()` — call `plugin.unload()` in tests, not `onunload()`, so registered intervals are cleared — `PluginSettingTab`, `Setting` with Obsidian's `.setting-item` markup, `debounce`). Tests are type-checked against the real typings, so keep the stub's signatures compatible; add to it when source starts using more of the API.
- **Obsidian's DOM helpers** (`createEl`, `empty`, `setCssStyles`) are polyfilled on `HTMLElement.prototype` in `test/setup.ts`.
- **Timezone is pinned to `Europe/London`** in the config, so expected local times (e.g. London sunrise `04:44` on 21 Jun 2026) are stable on any machine. Use `vi.useFakeTimers()` + `vi.setSystemTime()` for anything that reads the clock or schedules timers.
- `test/helpers.ts` → `createPlugin(savedData)` builds an `SDNSPlugin` with a fake `app` and spied `loadData`/`saveData`. Note `defaultColorScheme` is captured at construction, so set `document.body` classes before creating the plugin.

## Architecture

Source lives in `src/`, entry `src/main.ts` (bundled by `esbuild.config.mjs` to CommonJS at the repo root `main.js`, `obsidian`/`electron`/CodeMirror externals).

- **`main.ts` — `SDNSPlugin`** (SDNS = Smart DayNight Switcher):
  - On load, records the user's current scheme (`defaultColorScheme`) so `onunload` can restore it.
  - `checkAndSwitchColorScheme()` asks `getSchemeState()` for the current scheme and the delay until the next transition, applies it, then schedules a single `setTimeout` that calls itself again. Any existing timeout is cleared first, so it is safe to call repeatedly (e.g. from `saveSettings`).
  - Timers don't advance while the computer sleeps, so `onload` also registers a once-a-minute interval (`registerInterval`) that re-runs the check if the wall clock has passed `nextChangeAt`.
- **`sun-times.ts`** — pure SunCalc wrappers (no DOM/Obsidian imports, so unit-testable): `getSunTimes()` (SunCalc's `sunrise`/`sunset`, per the README: light when the sun rises, dark when it sets), `getSchemeState()` (collects sunrise/sunset events for yesterday/today/tomorrow; the scheme is the type of the last event, the delay runs to the next opposite event; during polar day/night it picks by sun altitude vs −0.833° and re-checks within an hour, so the delay is never `NaN`, which `setTimeout` would treat as 0 and loop), `getSchedule()` for the settings table.
- **`color-scheme.ts`** — `getColorScheme()` / `setColorScheme()`; switches by toggling `theme-light`/`theme-dark` classes on `document.body` and triggering the workspace `css-change` event; it does not change Obsidian's persisted appearance setting.
- **`settings.ts`** — settings interface and defaults (London). Latitude/longitude are stored as strings; `parseCoordinates()` turns them into numbers, or `null` if empty, non-numeric or out of range. While it is `null` the scheduler does nothing and the settings tab shows a hint instead of the table.
- **`settings-tab.ts` — `SDNSPluginSettingTab`**: builds the UI with Obsidian's `createEl`/`Setting` APIs (avoid `innerHTML`, which Obsidian's plugin review disallows). Text inputs use Obsidian's `debounce` and every save re-runs the scheduler. Renders a 31-day sunrise/sunset table from `getSchedule()`; it is generated in `display()`, so it reflects new coordinates only when the tab is re-opened.
- **`format.ts`** — pure date/time formatting for the table.

`styles.css` is the unused template placeholder. `ts-debounce` is listed as a dependency but the code uses Obsidian's built-in `debounce`.
