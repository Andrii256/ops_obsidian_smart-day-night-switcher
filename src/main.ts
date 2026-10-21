import { Notice, Plugin } from "obsidian";

import { ColorScheme, getColorScheme, setColorScheme } from "./color-scheme";
import { locateByIp } from "./locate";
import {
	DEFAULT_SETTINGS,
	parseCoordinates,
	parseOffsets,
	SDNSPluginSettings,
	TOGGLE_PAUSE_COMMAND,
} from "./settings";
import { SDNSPluginSettingTab } from "./settings-tab";
import { getSchemeState } from "./sun-times";
import { guessFromTimeZone } from "./time-zone";

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
	private settingTab: SDNSPluginSettingTab | null = null;
	/** Nothing was saved yet, so onload still has to guess the location. */
	private isFreshInstall = false;
	private isUnloaded = false;

	async onload() {
		await this.loadSettings();
		this.settingTab = new SDNSPluginSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);
		this.addCommand({
			...TOGGLE_PAUSE_COMMAND,
			callback: () => this.togglePause(),
		});

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

		// Not awaited: switching already runs with the time zone guess.
		if (this.isFreshInstall) void this.locateFreshInstall();
	}

	onunload() {
		this.isUnloaded = true;
		this.clearTimeout();
		this.setColorScheme(this.defaultColorScheme);
	}

	async loadSettings() {
		const saved = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);

		// Nothing saved yet: a fresh install. Start from the time zone's main
		// city rather than London; onload then tries the IP address.
		if (saved == null) {
			this.isFreshInstall = true;
			const guess = guessFromTimeZone();
			if (guess) {
				this.settings.latitude = guess.latitude;
				this.settings.longitude = guess.longitude;
				this.settings.locationName = guess.city;
			}
		}
	}

	/**
	 * Replaces the time zone guess with the IP address's location, if that
	 * lookup works, and saves either, so the guess happens only once.
	 */
	private async locateFreshInstall() {
		const { latitude, longitude } = this.settings;
		const location = await locateByIp();
		// Unsaved, so the next start tries again.
		if (this.isUnloaded) return;

		// Keep coordinates the user entered in the meantime.
		const unchanged =
			this.settings.latitude === latitude &&
			this.settings.longitude === longitude;
		if (location && unchanged) {
			Object.assign(this.settings, location);
			this.settingTab?.showLocation();
		}
		await this.saveSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.checkAndSwitchColorScheme();
	}

	async togglePause() {
		this.settings.paused = !this.settings.paused;
		await this.saveSettings();
		// The hotkey also works while the settings tab is open.
		this.settingTab?.update();
		new Notice(
			this.settings.paused
				? "Automatic switching paused"
				: "Automatic switching resumed"
		);
	}

	checkAndSwitchColorScheme() {
		this.clearTimeout();

		if (this.settings.paused) {
			this.setColorScheme(this.defaultColorScheme);
			return;
		}

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
