import { Plugin } from "obsidian";

import { ColorScheme, getColorScheme, setColorScheme } from "./color-scheme";
import { DEFAULT_SETTINGS, SDNSPluginSettings } from "./settings";
import { SDNSPluginSettingTab } from "./settings-tab";
import { getSchemeState } from "./sun-times";

/**
 * SDNS: Smart DayNight Switcher
 */
export default class SDNSPlugin extends Plugin {
	private timeout: ReturnType<typeof setTimeout> | null = null;
	settings: SDNSPluginSettings = { ...DEFAULT_SETTINGS };
	defaultColorScheme: ColorScheme = getColorScheme();

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SDNSPluginSettingTab(this.app, this));

		this.checkAndSwitchColorScheme();
	}

	onunload() {
		this.clearTimeout();
		this.setColorScheme(this.defaultColorScheme);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.checkAndSwitchColorScheme();
	}

	checkAndSwitchColorScheme() {
		const { colorScheme, msUntilNextChange } = getSchemeState(
			Date.now(),
			+this.settings.latitude,
			+this.settings.longitude
		);

		this.setColorScheme(colorScheme);

		this.clearTimeout();
		this.timeout = setTimeout(
			this.checkAndSwitchColorScheme.bind(this),
			msUntilNextChange
		);
	}

	setColorScheme(targetColorScheme: ColorScheme) {
		setColorScheme(this.app.workspace, targetColorScheme);
	}

	private clearTimeout() {
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
	}
}
