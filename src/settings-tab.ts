import { App, PluginSettingTab, Setting, debounce } from "obsidian";

import { formatDate, formatTime } from "./format";
import type SDNSPlugin from "./main";
import { parseCoordinates, SDNSPluginSettings } from "./settings";
import { getSchedule } from "./sun-times";

const SCHEDULE_DAYS = 31;

export class SDNSPluginSettingTab extends PluginSettingTab {
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

		this.addCoordinateSetting(containerEl, "latitude", "Latitude");
		this.addCoordinateSetting(containerEl, "longitude", "Longitude");
		addAdditionalDescription(containerEl);
		this.addSchedule(containerEl);
	}

	private addCoordinateSetting(
		containerEl: HTMLElement,
		key: keyof SDNSPluginSettings,
		name: string
	) {
		new Setting(containerEl)
			.setName(name)
			.setDesc(
				`Please enter the ${key} of your approximate location (within ±200 km)`
			)
			.addText((text) =>
				text
					.setPlaceholder(name)
					.setValue(this.plugin.settings[key])
					.onChange(
						debounce(async (value) => {
							this.plugin.settings[key] = value;
							await this.plugin.saveSettings();
						}, 300)
					)
			);
	}

	private addSchedule(containerEl: HTMLElement) {
		const dynamicContent = containerEl.createEl("div");
		const scheduleHeader = dynamicContent.createEl("h4", {
			text: "Schedule:",
		});
		scheduleHeader.setCssStyles({
			borderTop: "1px solid var(--background-modifier-border)",
			margin: "1em auto 1em",
			paddingTop: "1em",
		});

		const coordinates = parseCoordinates(this.plugin.settings);
		if (coordinates === null) {
			dynamicContent.createEl("p", {
				text: "Enter a valid latitude (-90 to 90) and longitude (-180 to 180) to see the schedule.",
			});
			return;
		}

		const table = dynamicContent.createEl("table", {
			attr: { style: "width: 100%; text-align: center;" },
		});
		const tbody = table.createEl("tbody");
		const headerRow = tbody.createEl("tr");
		headerRow.createEl("th", { text: "Date" });
		const sunriseTh = headerRow.createEl("th");
		sunriseTh.createEl("span", { text: "Sunrise" });
		sunriseTh.createEl("br");
		sunriseTh.createEl("small", { text: "(Light mode will be enabled)" });
		const sunsetTh = headerRow.createEl("th");
		sunsetTh.createEl("span", { text: "Sunset" });
		sunsetTh.createEl("br");
		sunsetTh.createEl("small", { text: "(Dark mode will be enabled)" });

		const schedule = getSchedule(
			new Date(),
			SCHEDULE_DAYS,
			coordinates.latitude,
			coordinates.longitude
		);
		for (const { date, sunrise, sunset } of schedule) {
			const row = tbody.createEl("tr");
			row.createEl("td", { text: formatDate(date) });
			row.createEl("td", { text: formatTime(sunrise) });
			row.createEl("td", { text: formatTime(sunset) });
		}
	}
}

function addAdditionalDescription(containerEl: HTMLElement) {
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
}
