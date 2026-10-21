import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getColorScheme } from "../src/color-scheme";
import { DEFAULT_SETTINGS } from "../src/settings";
import { SDNSPluginSettingTab } from "../src/settings-tab";
import { getSunTimes } from "../src/sun-times";
import { createPlugin, stubTimeZone } from "./helpers";

const LAT = +DEFAULT_SETTINGS.latitude;
const LNG = +DEFAULT_SETTINGS.longitude;

/** Local wall-clock time on 21 Jun 2026 (BST). */
const summer = (h: number, m = 0) => new Date(2026, 5, 21, h, m);
const { sunrise, sunset } = getSunTimes(summer(12), LAT, LNG);
const tomorrowSunrise = getSunTimes(new Date(2026, 5, 22, 12), LAT, LNG).sunrise;

/** The pending switch plus the once-a-minute wake check. */
const TIMERS_WHILE_RUNNING = 2;

beforeEach(() => {
	vi.useFakeTimers();
	document.body.className = "theme-light";
});

afterEach(() => {
	vi.useRealTimers();
});

describe("loadSettings", () => {
	it("uses defaults when the saved settings are empty", async () => {
		const plugin = createPlugin({});
		await plugin.loadSettings();

		expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
		expect(plugin.saveData).not.toHaveBeenCalled();
	});

	it("guesses coordinates from the time zone on a fresh install, once", async () => {
		// Tests run in Europe/London; zone.tab puts it at 51°30'30"N 0°07'31"W.
		const plugin = createPlugin(null);
		await plugin.loadSettings();

		const guessed = { ...DEFAULT_SETTINGS, latitude: "51.5083", longitude: "-0.1253" };
		expect(plugin.settings).toEqual(guessed);
		expect(plugin.saveData).toHaveBeenCalledWith(guessed);
	});

	it("falls back to London when the time zone has no city", async () => {
		stubTimeZone("Etc/UTC");
		const plugin = createPlugin(null);
		await plugin.loadSettings();
		vi.unstubAllGlobals();

		expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
	});

	it("overrides defaults with saved values", async () => {
		const plugin = createPlugin({ latitude: "48.8566" });
		await plugin.loadSettings();

		expect(plugin.settings).toEqual({
			...DEFAULT_SETTINGS,
			latitude: "48.8566",
		});
	});

	it("does not mutate DEFAULT_SETTINGS", async () => {
		const before = { ...DEFAULT_SETTINGS };
		const plugin = createPlugin({ latitude: "1", longitude: "2" });
		await plugin.loadSettings();
		plugin.settings.latitude = "3";

		expect(DEFAULT_SETTINGS).toEqual(before);
	});
});

describe("onload", () => {
	it("registers the settings tab", async () => {
		vi.setSystemTime(summer(12));
		const plugin = createPlugin();
		const addSettingTab = vi.spyOn(plugin, "addSettingTab");
		await plugin.onload();

		expect(addSettingTab).toHaveBeenCalledOnce();
		expect(addSettingTab.mock.calls[0][0]).toBeInstanceOf(
			SDNSPluginSettingTab
		);
	});

	it("applies the scheme for the current time", async () => {
		vi.setSystemTime(summer(2));
		const plugin = createPlugin();
		await plugin.onload();

		expect(getColorScheme()).toBe("dark");
		expect(plugin.app.workspace.trigger).toHaveBeenCalledWith("css-change");
	});

	it("uses saved coordinates", async () => {
		// Noon in London is still before sunrise in Honolulu (UTC-10).
		vi.setSystemTime(summer(12));
		const plugin = createPlugin({ latitude: "21.3069", longitude: "-157.8583" });
		await plugin.onload();

		expect(getColorScheme()).toBe("dark");
	});
});

describe("pause", () => {
	it("leaves Obsidian's own scheme and schedules nothing while paused", async () => {
		vi.setSystemTime(summer(2));
		const plugin = createPlugin({ paused: true });
		await plugin.onload();

		expect(getColorScheme()).toBe("light");
		vi.advanceTimersByTime(sunset.getTime() - Date.now());
		expect(getColorScheme()).toBe("light");
	});

	it("restores Obsidian's own scheme when paused, and resumes when unpaused", async () => {
		vi.setSystemTime(summer(2));
		const plugin = createPlugin();
		await plugin.onload();
		expect(getColorScheme()).toBe("dark");

		plugin.settings.paused = true;
		await plugin.saveSettings();
		expect(getColorScheme()).toBe("light");

		plugin.settings.paused = false;
		await plugin.saveSettings();
		expect(getColorScheme()).toBe("dark");
		vi.advanceTimersByTime(sunrise.getTime() - Date.now());
		expect(getColorScheme()).toBe("light");
	});

	it("has a command, for a hotkey, that pauses and resumes", async () => {
		vi.setSystemTime(summer(2));
		const plugin = createPlugin();
		const addCommand = vi.spyOn(plugin, "addCommand");
		await plugin.onload();
		const command = addCommand.mock.calls[0]?.[0];
		expect(command?.name).toBe("Pause or resume automatic switching");

		await command?.callback?.();
		expect(plugin.settings.paused).toBe(true);
		expect(plugin.saveData).toHaveBeenLastCalledWith(
			expect.objectContaining({ paused: true })
		);
		expect(getColorScheme()).toBe("light");

		await command?.callback?.();
		expect(plugin.settings.paused).toBe(false);
		expect(getColorScheme()).toBe("dark");
	});
});

describe("scheduling", () => {
	it("switches to light at sunrise and back to dark at sunset", async () => {
		vi.setSystemTime(summer(2));
		const plugin = createPlugin();
		await plugin.onload();
		expect(getColorScheme()).toBe("dark");

		vi.advanceTimersByTime(sunrise.getTime() - Date.now() - 1);
		expect(getColorScheme()).toBe("dark");

		vi.advanceTimersByTime(1);
		expect(getColorScheme()).toBe("light");

		vi.advanceTimersByTime(sunset.getTime() - Date.now());
		expect(getColorScheme()).toBe("dark");
	});

	it("switches to light again at tomorrow's sunrise", async () => {
		vi.setSystemTime(summer(23));
		const plugin = createPlugin();
		await plugin.onload();
		expect(getColorScheme()).toBe("dark");

		vi.advanceTimersByTime(tomorrowSunrise.getTime() - Date.now());
		expect(getColorScheme()).toBe("light");
	});

	it("keeps exactly one pending switch", async () => {
		vi.setSystemTime(summer(2));
		const plugin = createPlugin();
		await plugin.onload();
		expect(vi.getTimerCount()).toBe(TIMERS_WHILE_RUNNING);

		plugin.checkAndSwitchColorScheme();
		plugin.checkAndSwitchColorScheme();
		expect(vi.getTimerCount()).toBe(TIMERS_WHILE_RUNNING);

		vi.advanceTimersByTime(sunrise.getTime() - Date.now());
		expect(vi.getTimerCount()).toBe(TIMERS_WHILE_RUNNING);
	});

	it("catches up within a minute after the computer wakes from sleep", async () => {
		vi.setSystemTime(summer(12));
		const plugin = createPlugin();
		await plugin.onload();
		expect(getColorScheme()).toBe("light");

		// Asleep from noon to 22:00: the wall clock jumps past sunset but
		// timers don't advance, so the sunset timeout hasn't fired.
		vi.setSystemTime(summer(22));
		expect(getColorScheme()).toBe("light");

		vi.advanceTimersByTime(60 * 1000);
		expect(getColorScheme()).toBe("dark");
	});

	it("does not re-apply the scheme every minute", async () => {
		vi.setSystemTime(summer(12));
		const plugin = createPlugin();
		await plugin.onload();
		const trigger = vi.mocked(plugin.app.workspace.trigger);
		trigger.mockClear();

		vi.advanceTimersByTime(sunset.getTime() - Date.now() - 1);
		expect(trigger).not.toHaveBeenCalled();
	});
});

describe("saveSettings", () => {
	it("persists the settings", async () => {
		vi.setSystemTime(summer(12));
		const plugin = createPlugin();
		await plugin.onload();
		plugin.settings.latitude = "48.8566";
		await plugin.saveSettings();

		expect(plugin.saveData).toHaveBeenCalledWith({
			...DEFAULT_SETTINGS,
			latitude: "48.8566",
		});
	});

	it("re-applies the scheme for the new coordinates", async () => {
		vi.setSystemTime(summer(12));
		const plugin = createPlugin();
		await plugin.onload();
		expect(getColorScheme()).toBe("light");

		plugin.settings.latitude = "21.3069";
		plugin.settings.longitude = "-157.8583";
		await plugin.saveSettings();

		expect(getColorScheme()).toBe("dark");
		expect(vi.getTimerCount()).toBe(TIMERS_WHILE_RUNNING);
	});
});

describe("offsets", () => {
	const MINUTE_MS = 60 * 1000;

	it("switches 30 minutes after sunrise and 30 minutes before sunset", async () => {
		vi.setSystemTime(summer(2));
		const plugin = createPlugin({ sunriseOffset: "30", sunsetOffset: "-30" });
		await plugin.onload();

		vi.advanceTimersByTime(sunrise.getTime() + 30 * MINUTE_MS - Date.now() - 1);
		expect(getColorScheme()).toBe("dark");
		vi.advanceTimersByTime(1);
		expect(getColorScheme()).toBe("light");

		vi.advanceTimersByTime(sunset.getTime() - 30 * MINUTE_MS - Date.now() - 1);
		expect(getColorScheme()).toBe("light");
		vi.advanceTimersByTime(1);
		expect(getColorScheme()).toBe("dark");
	});

	it("re-applies the scheme when an offset is saved", async () => {
		vi.setSystemTime(new Date(sunset.getTime() + 10 * MINUTE_MS));
		const plugin = createPlugin();
		await plugin.onload();
		expect(getColorScheme()).toBe("dark");

		plugin.settings.sunsetOffset = "20";
		await plugin.saveSettings();
		expect(getColorScheme()).toBe("light");

		vi.advanceTimersByTime(10 * MINUTE_MS);
		expect(getColorScheme()).toBe("dark");
	});

	it("ignores an invalid offset", async () => {
		vi.setSystemTime(new Date(sunset.getTime() + 10 * MINUTE_MS));
		const plugin = createPlugin({ sunsetOffset: "20 min" });
		await plugin.onload();

		expect(getColorScheme()).toBe("dark");
	});
});

describe("invalid coordinates", () => {
	it("leaves the scheme alone and schedules no switch on load", async () => {
		vi.setSystemTime(summer(2));
		const plugin = createPlugin({ latitude: "-", longitude: "0" });
		await plugin.onload();
		vi.advanceTimersByTime(24 * 60 * 60 * 1000);

		expect(getColorScheme()).toBe("light");
		expect(plugin.app.workspace.trigger).not.toHaveBeenCalled();
	});

	it("stops the schedule while the input is invalid and resumes once fixed", async () => {
		vi.setSystemTime(summer(2));
		const plugin = createPlugin();
		await plugin.onload();
		expect(getColorScheme()).toBe("dark");

		plugin.settings.latitude = "";
		await plugin.saveSettings();
		expect(getColorScheme()).toBe("dark");
		expect(vi.getTimerCount()).toBe(TIMERS_WHILE_RUNNING - 1);

		plugin.settings.latitude = DEFAULT_SETTINGS.latitude;
		await plugin.saveSettings();
		expect(vi.getTimerCount()).toBe(TIMERS_WHILE_RUNNING);

		vi.advanceTimersByTime(sunrise.getTime() - Date.now());
		expect(getColorScheme()).toBe("light");
	});
});

describe("polar coordinates", () => {
	it("does not spin when there is no sunrise or sunset", async () => {
		vi.setSystemTime(summer(2));
		const plugin = createPlugin({ latitude: "78.2232", longitude: "15.6267" });
		await plugin.onload();
		expect(getColorScheme()).toBe("light");

		const trigger = vi.mocked(plugin.app.workspace.trigger);
		trigger.mockClear();
		vi.advanceTimersByTime(60 * 60 * 1000 - 1);
		expect(trigger).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(trigger).toHaveBeenCalledOnce();
	});
});

describe("onunload", () => {
	it("restores the scheme that was active before the plugin loaded", async () => {
		document.body.className = "theme-light";
		vi.setSystemTime(summer(2));
		const plugin = createPlugin();
		await plugin.onload();
		expect(getColorScheme()).toBe("dark");

		plugin.unload();
		expect(getColorScheme()).toBe("light");
	});

	it("restores a dark default too", async () => {
		document.body.className = "theme-dark";
		vi.setSystemTime(summer(12));
		const plugin = createPlugin();
		await plugin.onload();
		expect(getColorScheme()).toBe("light");

		plugin.unload();
		expect(getColorScheme()).toBe("dark");
	});

	it("cancels the pending switch and the wake check", async () => {
		vi.setSystemTime(summer(2));
		const plugin = createPlugin();
		await plugin.onload();
		plugin.unload();

		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(24 * 60 * 60 * 1000);
		expect(getColorScheme()).toBe("light");
	});

	it("is safe to call before onload", () => {
		const plugin = createPlugin();
		expect(() => plugin.unload()).not.toThrow();
	});
});
