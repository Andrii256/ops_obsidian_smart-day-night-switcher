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

/** Creates the plugin with `loadData` returning `savedData`. */
export function createPlugin(savedData: unknown = null) {
	const plugin = new SDNSPlugin(createApp(), manifest);
	vi.spyOn(plugin, "loadData").mockResolvedValue(savedData);
	vi.spyOn(plugin, "saveData").mockResolvedValue();
	return plugin;
}
