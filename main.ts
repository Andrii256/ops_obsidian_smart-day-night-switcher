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

		containerEl.createEl("p", {
			text: "Please enter the latitude and longitude of your approximate location (coords of any city within ±200 km)",
		});

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

		const addAdditionalDescription = () => {
			const additionalDescription = containerEl.createEl("p");

			additionalDescription.createEl("small", {
				text: "To easily find your latitude and longitude, you can use any simple online service, such as ",
			});
			additionalDescription.createEl("small").createEl("a", {
				href: "https://www.latlong.net/",
				text: "latlong.net",
			});
			additionalDescription.createEl("small", { text: ", " });
			additionalDescription.createEl("small").createEl("a", {
				href: "https://www.gps-coordinates.net/",
				text: "gps-coordinates.net",
			});
			additionalDescription.createEl("small", {
				text: ", or any other similar tools available on the web.",
			});
			additionalDescription.createEl("br");
			additionalDescription.createEl("br");
			additionalDescription.createEl("small", {
				text: "* Obsidian does not provide developers with access to geolocation, so this plugin cannot automatically determine your coordinates.",
			});
			additionalDescription.createEl("br");
			additionalDescription.createEl("small", { text: "However, " });
			additionalDescription.createEl("small").createEl("strong", {
				text: "to accurately calculate sunrise and sunset times in your location",
			});
			additionalDescription.createEl("small", {
				text: ", the formula needs an approximate location (within ±200 km) of where you are.",
			});
		};
		addAdditionalDescription();

		const addSchedule = () => {
			const dynamicContent = containerEl.createEl("div");
			const scheduleHeader = dynamicContent.createEl("h4", {
				text: "Schedule:",
			});
			scheduleHeader.setCssStyles({
				borderTop: "1px solid var(--background-modifier-border)",
				margin: "1em auto 1em",
				paddingTop: "1em",
			});

			const table = dynamicContent.createEl("table", {
				attr: { style: "width: 100%; text-align: center;" },
			});
			const tbody = table.createEl("tbody");
			const headerRow = tbody.createEl("tr");
			headerRow.createEl("th", { text: "Date" });
			const dawnTh = headerRow.createEl("th");
			dawnTh.createEl("span", { text: "Dawn" });
			dawnTh.createEl("br");
			dawnTh.createEl("small", { text: "(Light mode will be enabled)" });
			const duskTh = headerRow.createEl("th");
			duskTh.createEl("span", { text: "Dusk" });
			duskTh.createEl("br");
			duskTh.createEl("small", { text: "(Dark mode will be enabled)" });

			const date = new Date();
			for (let i = 0; i <= 30; i++) {
				const { dawn, sunsetStart: dusk } = SunCalc.getTimes(
					date,
					+this.plugin.settings.latitude,
					+this.plugin.settings.longitude
				);

				const dateStr = `${date.getDate()} ${date.toLocaleString(
					"en-US",
					{
						month: "short",
					}
				)} ${date.getFullYear()}`;
				const dawnStr = `${String(dawn.getHours()).padStart(
					2,
					"0"
				)}:${String(dawn.getMinutes()).padStart(2, "0")}`;
				const duskStr = `${String(dusk.getHours()).padStart(
					2,
					"0"
				)}:${String(dusk.getMinutes()).padStart(2, "0")}`;

				const row = tbody.createEl("tr");
				row.createEl("td", { text: dateStr });
				row.createEl("td", { text: dawnStr });
				row.createEl("td", { text: duskStr });

				date.setDate(date.getDate() + 1);
			}
		};
		addSchedule();
	}
}
