// Import the SunCalc library to calculate sun position and light phases
import SunCalc from "suncalc"; // Documentation: https://www.npmjs.com/package/suncalc

import { App, Plugin, PluginSettingTab, Setting, debounce } from "obsidian";

/**
 * SDNS: Smart DayNight Switcher
 */

interface SDNSPluginSettings {
	latitude: string;
	longitude: string;
}

const DEFAULT_SETTINGS: SDNSPluginSettings = {
	latitude: "51.507351",
	longitude: "-0.127758",
};

const DYNAMIC_DIV_ID = "a440b9a8-80d9-4b4b-b7a3-0265c8964997"; // unique ID to make sure it will not clash with other plugins

export default class SDNSPlugin extends Plugin {
	private timeout: ReturnType<typeof setTimeout> | null;
	settings: SDNSPluginSettings;
	defaultColorScheme: "dark" | "light";

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SDNSPluginSettingTab(this.app, this));

		this.saveDefaultColorScheme();
		this.checkAndSwitchColorScheme();
	}

	onunload() {
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}

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
		this.updateScheduleHTML();
	}

	updateScheduleHTML() {
		const container = document.getElementById(DYNAMIC_DIV_ID);

		if (container) {
			container.innerHTML = this.generateScheduleHTML();
		}
	}

	generateScheduleHTML() {
		const date = new Date();
		const rows = [];

		for (let i = 0; i <= 30; i++) {
			const { dawn, sunsetStart: dusk } = SunCalc.getTimes(
				date,
				+this.settings.latitude,
				+this.settings.longitude
			);

			const dateStr = `${date.getDate()} ${date.toLocaleString("en-US", {
				month: "short",
			})} ${date.getFullYear()}`; // date 'DD MMM YYYY'
			const dawnStr = `${String(dawn.getHours()).padStart(
				2,
				"0"
			)}:${String(dawn.getMinutes()).padStart(2, "0")}`; //  dawn 'HH:MM'
			const duskStr = `${String(dusk.getHours()).padStart(
				2,
				"0"
			)}:${String(dusk.getMinutes()).padStart(2, "0")}`; // dusk 'HH:MM'

			rows.push(
				`<tr><td>${dateStr}</td><td>${dawnStr}</td><td>${duskStr}</td></tr>`
			);

			date.setDate(date.getDate() + 1); // to increase date before next call
		}

		const html = `<div id="a440b9a8-80d9-4b4b-b7a3-0265c8964997"><h4 style=" border-top: 1px solid var(--background-modifier-border); margin: 1em auto 1em; padding-top: 1em;">Schedule:</h4><table style="width: 100%;text-align: center;"> <tbody> <tr> <th>Date</th> <th>Dawn<br><small>(Light mode will be enabled)</small></th> <th>Dusk<br><small>(Dark mode will be enabled)</small></th> ${rows.join(
			""
		)}</tbody></table>`;

		return html;
	}

	checkAndSwitchColorScheme() {
		const now = Date.now();

		const { dawn, sunsetStart: dusk } = SunCalc.getTimes(
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
			this.setColorScheme("dark");
			checkDelay = times.dawn - now;
		} else if (now >= dawn && now < dusk) {
			this.setColorScheme("light");
			checkDelay = times.dusk - now;
		} else {
			this.setColorScheme("dark");
			checkDelay = times.tomorrowDawn - now;
		}

		if (this.timeout) {
			clearTimeout(this.timeout);
		}

		this.timeout = setTimeout(
			this.checkAndSwitchColorScheme.bind(this),
			checkDelay
		);
	}

	setColorScheme(targetColorScheme: "dark" | "light") {
		switch (targetColorScheme) {
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

	saveDefaultColorScheme() {
		const getColorScheme = () =>
			document.body.classList.contains("theme-dark") ? "dark" : "light";

		this.defaultColorScheme = getColorScheme();
	}
}

class SDNSPluginSettingTab extends PluginSettingTab {
	plugin: SDNSPlugin;

	constructor(app: App, plugin: SDNSPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h3", { text: "Starting Point Coordinates" });

		containerEl.createDiv().innerHTML = `<p>Please enter the latitude and longitude of your approximate location (coords of any city within ±200 km)</p>`;

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
						}, 300)
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
					.onChange(
						debounce(async (value) => {
							this.plugin.settings.longitude = value;
							await this.plugin.saveSettings();
						}, 300)
					)
			);

		containerEl.createDiv().innerHTML = `<p><small >To easily find your latitude and longitude, you can use any simple online service, such as <a href="https://www.latlong.net/">latlong.net</a>, <a href="https://www.gps-coordinates.net/">gps-coordinates.net</a>, or any other similar tools available on the web.</small ><br/><br /><small >* Obsidian does not provide developers with access to geolocation, so this plugin cannot automatically determine your coordinates.</small > <br /> <small style="display: inline-block; margin-top: 0.4em;" >&nbsp;However, <strong>to accurately calculate sunrise and sunset times in your location</strong>, the formula needs an approximate location (within ±200 km) of where you are.</small ></p>`;

		const dynamicContent = containerEl.createDiv();
		dynamicContent.id = DYNAMIC_DIV_ID;
		dynamicContent.innerHTML = this.plugin.generateScheduleHTML();
	}
}
