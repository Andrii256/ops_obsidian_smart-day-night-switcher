import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { debounce } from "ts-debounce";
const SunCalc = require("suncalc"); // https://www.npmjs.com/package/suncalc

interface ATSPluginSettings {
	latitude: string;
	longitude: string;
}

const DEFAULT_SETTINGS: ATSPluginSettings = {
	latitude: "51.507351",
	longitude: "-0.127758",
};

export default class ATSPlugin extends Plugin {
	private timeout: ReturnType<typeof setTimeout> | null;
	settings: ATSPluginSettings;
	defaultMode: "dark" | "light";

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ATSPluginSettingTab(this.app, this));

		this.saveDefaultMode();
		this.checkAndSwitchTheme();
	}

	onunload() {
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}

		this.setMode(this.defaultMode);
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
		this.checkAndSwitchTheme();
	}

	checkAndSwitchTheme() {
		const now = Date.now();
		// const now = new Date('2025-03-11 14:00').getTime();

		const { dawn, dusk } = SunCalc.getTimes(
			new Date(),
			+this.settings.latitude,
			+this.settings.longitude
		);
		const tomorrowDawn = SunCalc.getTimes(
			new Date(now + 24 * 60 * 60 * 1000),
			+this.settings.latitude,
			+this.settings.longitude
		).dawn;

		const times = {
			dawn: dawn.getTime(),
			dusk: dusk.getTime(),
			tomorrowDawn: tomorrowDawn.getTime(),
		};

		let checkDelay: number;

		if (now < dawn) {
			this.setMode("dark");
			checkDelay = times.dawn - now;
		} else if (now >= dawn && now < dusk) {
			this.setMode("light");
			checkDelay = times.dusk - now;
		} else {
			this.setMode("dark");
			checkDelay = times.tomorrowDawn - now;
		}

		if (this.timeout) {
			clearTimeout(this.timeout);
		}

		this.timeout = setTimeout(
			this.checkAndSwitchTheme.bind(this),
			checkDelay
		);
	}

	setMode(targetMode: "dark" | "light") {
		switch (targetMode) {
			case "dark":
				document.body.classList.remove("theme-light");
				document.body.classList.add("theme-dark");
				break;
			case "light":
				document.body.classList.remove("theme-dark");
				document.body.classList.add("theme-light");
				break;
		}
		this.app.workspace.trigger("css-change");
	}

	saveDefaultMode() {
		const getMode = () =>
			document.body.classList.contains("theme-dark") ? "dark" : "light";

		this.defaultMode = getMode();
	}
}

class ATSPluginSettingTab extends PluginSettingTab {
	plugin: ATSPlugin;

	constructor(app: App, plugin: ATSPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h3", { text: "Starting Point Coordinates" });

		containerEl.createDiv().innerHTML = `<p>Please enter the latitude and longitude of your aproximate location (coords of any city within ±200 km)</p>`;

		new Setting(containerEl)
			.setName("Latitude")
			.setDesc(
				"Please enter the latitude of your approximate location (within ±200 km)"
			)
			.addText((text) =>
				text
					.setPlaceholder("Latitude")
					.setValue(this.plugin.settings.latitude)
					.onChange(
						debounce(async (value) => {
							this.plugin.settings.latitude = value;
							await this.plugin.saveSettings();
						}, 1000)
					)
			);

		new Setting(containerEl)
			.setName("Longitude")
			.setDesc(
				"Please enter the longitude of your approximate location (within ±200 km)"
			)
			.addText((text) =>
				text
					.setPlaceholder("Longitude")
					.setValue(this.plugin.settings.longitude)
					.onChange(async (value) => {
						this.plugin.settings.longitude = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createDiv().innerHTML = `<p><small >To easily find your latitude and longitude, you can use any simple online service, such as <a href="https://www.latlong.net/">latlong.net</a>, <a href="https://www.gps-coordinates.net/">gps-coordinates.net</a>, or any other similar tools available on the web.</small ><br/><br /><small >* Obsidian does not provide developers with access to geolocation, so this plugin cannot automatically determine your coordinates.</small > <br /> <small style="display: inline-block; margin-top: 0.4em;" >&nbsp;However, <strong>to accurately calculate sunrise and sunset times in your location</strong>, the formula needs an approximate location (within ±200 km) of where you are.</small ></p>`;
	}
}
