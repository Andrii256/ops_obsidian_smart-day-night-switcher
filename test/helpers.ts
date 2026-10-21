import type { App, PluginManifest } from "obsidian";
import { vi } from "vitest";

import SDNSPlugin from "../src/main";

export const createApp = () =>
	({ workspace: { trigger: vi.fn() } } as unknown as App);

const manifest: PluginManifest = {
	id: "smart-day-night-switcher",
	name: "Smart DayNight switcher",
	version: "0.0.0",
	minAppVersion: "0.0.0",
	author: "",
	description: "",
};

/**
 * Creates the plugin with `loadData` returning `savedData`. The default `{}`
 * is "saved, nothing changed"; pass `null` for a fresh install.
 */
export function createPlugin(savedData: unknown = {}) {
	const plugin = new SDNSPlugin(createApp(), manifest);
	vi.spyOn(plugin, "loadData").mockResolvedValue(savedData);
	vi.spyOn(plugin, "saveData").mockResolvedValue();
	return plugin;
}

/** Makes `Intl` report `timeZone`; undo with `vi.unstubAllGlobals()`. */
export function stubTimeZone(timeZone: string) {
	vi.stubGlobal("Intl", {
		...Intl,
		DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone }) }),
	});
}
