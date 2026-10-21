import {
	App,
	ButtonComponent,
	PluginSettingTab,
	Setting,
	TextComponent,
	debounce,
} from "obsidian";

import { ColorScheme } from "./color-scheme";
import { formatDate, formatDay, formatOffset, formatTime } from "./format";
import type SDNSPlugin from "./main";
import {
	MAX_OFFSET_MINUTES,
	parseCoordinates,
	parseCoordinatesInput,
	parseOffsets,
} from "./settings";
import { getNextSwitch, getSchedule, getSchemeState } from "./sun-times";
import { guessFromTimeZone } from "./time-zone";

const SCHEDULE_DAYS = 31;
const SCHEDULE_DAYS_COLLAPSED = 7;

type Direction = "before" | "after";

/** Minutes from 0 to MAX_OFFSET_MINUTES (empty is 0), or null if invalid. */
function parseOffsetAmount(value: string): number | null {
	if (value.trim() === "") return 0;
	const n = +value;
	return Number.isFinite(n) && n >= 0 && n <= MAX_OFFSET_MINUTES ? n : null;
}

const SCHEME_LABELS: Record<ColorScheme, string> = {
	light: "☀️ Light mode",
	dark: "🌒 Dark mode",
};

export class SDNSPluginSettingTab extends PluginSettingTab {
	plugin: SDNSPlugin;
	private statusEl: HTMLElement | null = null;
	private scheduleEl: HTMLElement | null = null;
	private scheduleExpanded = false;
	private coordinatesText: TextComponent | null = null;
	private coordinatesErrorEl: HTMLElement | null = null;
	private guessButton: ButtonComponent | null = null;

	constructor(app: App, plugin: SDNSPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.statusEl = containerEl.createEl("div", { cls: "sdns-status" });
		this.addPauseSetting(containerEl);

		new Setting(containerEl).setName("Location").setHeading();
		this.addCoordinatesSetting(containerEl);
		this.addTimeZoneSetting(containerEl);
		addCoordinatesHelp(containerEl);

		new Setting(containerEl).setName("Switch times").setHeading();
		this.addOffsetSetting(containerEl, "sunriseOffset", "light", "sunrise");
		this.addOffsetSetting(containerEl, "sunsetOffset", "dark", "sunset");

		new Setting(containerEl).setName("Schedule").setHeading();
		this.scheduleEl = containerEl.createEl("div");

		this.refresh();
	}

	/** Re-renders what depends on the settings, leaving the inputs (and their focus) alone. */
	private refresh() {
		this.renderStatus();
		this.renderSchedule();
		this.updateGuessButton();
	}

	private async save() {
		await this.plugin.saveSettings();
		this.refresh();
	}

	private addPauseSetting(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName("Pause automatic switching")
			.setDesc(
				"Use Obsidian's own appearance setting until you turn this off."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.paused)
					.onChange(async (paused) => {
						this.plugin.settings.paused = paused;
						await this.save();
					})
			);
	}

	private addCoordinatesSetting(containerEl: HTMLElement) {
		const { latitude, longitude } = this.plugin.settings;
		const value = latitude || longitude ? `${latitude}, ${longitude}` : "";

		const setting = new Setting(containerEl)
			.setName("Coordinates")
			.setDesc("Latitude and longitude of your city, as copied from a map.");
		const errorEl = setting.descEl.createEl("div", { cls: "sdns-error" });
		this.coordinatesErrorEl = errorEl;
		const showError = (input: string) => {
			errorEl.textContent = parseCoordinatesInput(input).error ?? "";
		};
		showError(value);

		setting.addText((text) =>
			(this.coordinatesText = text)
				.setPlaceholder("51.5074, -0.1278")
				.setValue(value)
				.onChange(
					debounce(async (input: string) => {
						showError(input);
						const parsed = parseCoordinatesInput(input);
						// Keep switching with the last valid location while the user types.
						if (parsed.error !== undefined) return;
						this.plugin.settings.latitude = parsed.latitude;
						this.plugin.settings.longitude = parsed.longitude;
						await this.save();
					}, 300)
				)
		);
	}

	private addTimeZoneSetting(containerEl: HTMLElement) {
		const guess = guessFromTimeZone();
		if (guess === null) return;
		const { timeZone, city, latitude, longitude } = guess;

		new Setting(containerEl)
			.setName("Guess from time zone")
			.setDesc(
				`Fill in ${city} (${latitude}, ${longitude}), the main city of your time zone, ${timeZone}. New installs start with it. It can be hundreds of kilometres away, so your own coordinates give more accurate times.`
			)
			.addButton((button) => {
				this.guessButton = button.onClick(async () => {
					this.plugin.settings.latitude = latitude;
					this.plugin.settings.longitude = longitude;
					this.coordinatesText?.setValue(`${latitude}, ${longitude}`);
					if (this.coordinatesErrorEl) {
						this.coordinatesErrorEl.textContent = "";
					}
					await this.save();
				});
			});
	}

	/** "Use <city>", or disabled while those coordinates are already in use. */
	private updateGuessButton() {
		const guess = guessFromTimeZone();
		if (this.guessButton === null || guess === null) return;
		const { latitude, longitude } = this.plugin.settings;
		const inUse =
			latitude === guess.latitude && longitude === guess.longitude;
		this.guessButton
			.setButtonText(inUse ? `Using ${guess.city}` : `Use ${guess.city}`)
			.setDisabled(inUse);
	}

	private addOffsetSetting(
		containerEl: HTMLElement,
		key: "sunriseOffset" | "sunsetOffset",
		colorScheme: ColorScheme,
		event: string
	) {
		const offsets = parseOffsets(this.plugin.settings);
		const minutes = key === "sunriseOffset" ? offsets.sunrise : offsets.sunset;

		const setting = new Setting(containerEl).setName(
			SCHEME_LABELS[colorScheme]
		);
		setting.settingEl.classList.add("sdns-offset");

		// The offset as a size in minutes plus a direction, so nobody has to
		// remember what a minus sign means.
		let amount = String(Math.abs(minutes));
		let direction: Direction = minutes < 0 ? "before" : "after";

		const save = debounce(async (value: number) => {
			this.plugin.settings[key] = String(value);
			await this.save();
		}, 300);
		const update = () => {
			const size = parseOffsetAmount(amount);
			setting.descEl.classList.toggle("sdns-invalid", size === null);
			if (size === null) {
				setting.setDesc(
					`Enter a number of minutes from 0 to ${MAX_OFFSET_MINUTES}`
				);
				return;
			}
			const value = direction === "before" ? -size : size;
			setting.setDesc(`Switch ${formatOffset(value, event)}`);
			save(value);
		};
		setting.setDesc(`Switch ${formatOffset(minutes, event)}`);

		setting.addText((text) => {
			text.inputEl.type = "number";
			text.inputEl.min = "0";
			text.inputEl.max = String(MAX_OFFSET_MINUTES);
			text.inputEl.step = "5";
			text
				.setPlaceholder("0")
				.setValue(amount)
				.onChange((value) => {
					amount = value;
					update();
				});
		});
		setting.controlEl.createEl("span", { text: "min" });
		setting.addDropdown((dropdown) =>
			dropdown
				.addOptions({ before: `before ${event}`, after: `after ${event}` })
				.setValue(direction)
				.onChange((value) => {
					direction = value as Direction;
					update();
				})
		);
	}

	private renderStatus() {
		const statusEl = this.statusEl;
		if (!statusEl) return;
		statusEl.empty();

		if (this.plugin.settings.paused) {
			statusEl.createEl("strong", {
				text: "⏸ Automatic switching is paused",
			});
			return;
		}

		const coordinates = parseCoordinates(this.plugin.settings);
		if (coordinates === null) {
			statusEl.createEl("span", {
				text: "Enter your coordinates below to start switching automatically.",
			});
			return;
		}

		const now = new Date();
		const { latitude, longitude } = coordinates;
		const offsets = parseOffsets(this.plugin.settings);
		const { colorScheme } = getSchemeState(
			now.getTime(),
			latitude,
			longitude,
			offsets
		);
		const next = getNextSwitch(now.getTime(), latitude, longitude, offsets);

		statusEl.createEl("strong", { text: `${SCHEME_LABELS[colorScheme]} now` });
		statusEl.createEl("span", {
			text: next
				? ` · switches to ${next.colorScheme} ${formatDay(next.time, now)} at ${formatTime(next.time)}`
				: " · no switch within the next day",
		});
	}

	private renderSchedule() {
		const scheduleEl = this.scheduleEl;
		if (!scheduleEl) return;
		scheduleEl.empty();

		const coordinates = parseCoordinates(this.plugin.settings);
		if (coordinates === null) {
			scheduleEl.createEl("p", {
				text: "Enter valid coordinates to see when the theme switches.",
			});
			return;
		}

		const table = scheduleEl.createEl("table", { cls: "sdns-schedule" });
		const headerRow = table.createEl("thead").createEl("tr");
		headerRow.createEl("th", { text: "Date" });
		headerRow.createEl("th", { text: SCHEME_LABELS.light });
		headerRow.createEl("th", { text: SCHEME_LABELS.dark });

		const tbody = table.createEl("tbody");
		const schedule = getSchedule(
			new Date(),
			this.scheduleExpanded ? SCHEDULE_DAYS : SCHEDULE_DAYS_COLLAPSED,
			coordinates.latitude,
			coordinates.longitude,
			parseOffsets(this.plugin.settings)
		);
		schedule.forEach(({ date, sunrise, sunset }, i) => {
			const row = tbody.createEl("tr", i === 0 ? { cls: "sdns-today" } : {});
			row.createEl("td", { text: formatDate(date) });
			row.createEl("td", { text: formatTime(sunrise) });
			row.createEl("td", { text: formatTime(sunset) });
		});

		const toggle = scheduleEl.createEl("button", {
			cls: "sdns-schedule-toggle",
			text: this.scheduleExpanded
				? "Show less"
				: `Show ${SCHEDULE_DAYS} days`,
		});
		toggle.addEventListener("click", () => {
			this.scheduleExpanded = !this.scheduleExpanded;
			this.renderSchedule();
		});
	}
}

function addCoordinatesHelp(containerEl: HTMLElement) {
	const details = containerEl.createEl("details", { cls: "sdns-help" });
	details.createEl("summary", { text: "How do I find my coordinates?" });

	const steps = details.createEl("ol");
	const open = steps.createEl("li");
	open.append("Open ");
	open.createEl("a", { href: "https://www.latlong.net/", text: "latlong.net" });
	open.append(", ");
	open.createEl("a", {
		href: "https://www.gps-coordinates.net/",
		text: "gps-coordinates.net",
	});
	open.append(" or any map.");
	steps.createEl("li", { text: "Search for your city." });
	steps.createEl("li", {
		text: "Copy its latitude and longitude and paste them above.",
	});

	details.createEl("p", {
		text: "A city within about 200 km of you is accurate enough. Obsidian doesn't let plugins detect your location, so it has to be entered here; it never leaves your device and is only used to calculate sunrise and sunset.",
	});
}
