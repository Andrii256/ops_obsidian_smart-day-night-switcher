import { Plugin } from "obsidian";

import { ColorScheme, getColorScheme, setColorScheme } from "./color-scheme";
import {
	DEFAULT_SETTINGS,
	parseCoordinates,
	parseOffsets,
	SDNSPluginSettings,
} from "./settings";
import { SDNSPluginSettingTab } from "./settings-tab";
import { getSchemeState } from "./sun-times";

/** How often to compare the wall clock with the next switch time. */
const WAKE_CHECK_MS = 60 * 1000;

/**
 * SDNS: Smart DayNight Switcher
 */
export default class SDNSPlugin extends Plugin {
	private timeout: ReturnType<typeof setTimeout> | null = null;
	/** Wall-clock time of the next switch; null while nothing is scheduled. */
	private nextChangeAt: number | null = null;
	settings: SDNSPluginSettings = { ...DEFAULT_SETTINGS };
	defaultColorScheme: ColorScheme = getColorScheme();

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SDNSPluginSettingTab(this.app, this));

		this.checkAndSwitchColorScheme();

		// Timers don't count time the computer spends asleep, so the timeout
		// alone can fire hours late after a wake. Catch up within a minute.
		this.registerInterval(
			window.setInterval(() => {
				if (this.nextChangeAt !== null && Date.now() >= this.nextChangeAt) {
					this.checkAndSwitchColorScheme();
				}
			}, WAKE_CHECK_MS)
		);
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
		this.clearTimeout();

		// Leave the scheme alone until the user enters valid coordinates;
		// saveSettings re-runs this once they do.
		const coordinates = parseCoordinates(this.settings);
		if (coordinates === null) return;

		const { colorScheme, msUntilNextChange } = getSchemeState(
			Date.now(),
			coordinates.latitude,
			coordinates.longitude,
			parseOffsets(this.settings)
		);

		this.setColorScheme(colorScheme);

		this.nextChangeAt = Date.now() + msUntilNextChange;
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
		this.nextChangeAt = null;
	}
}
