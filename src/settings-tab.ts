import {
	App,
	ButtonComponent,
	Notice,
	PluginSettingTab,
	Setting,
	TextComponent,
	ToggleComponent,
	debounce,
} from "obsidian";

import { ColorScheme } from "./color-scheme";
import { formatDate, formatDay, formatOffset, formatTime } from "./format";
import { LocationSettings, locateByIp, lookUpPlaceName } from "./locate";
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
/** Wait for typing to settle; Nominatim allows one request a second. */
const PLACE_LOOKUP_DELAY_MS = 1500;

const coordinatesKey = ({
	latitude,
	longitude,
}: Pick<LocationSettings, "latitude" | "longitude">) =>
	`${latitude}, ${longitude}`;

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
	private placeEl: HTMLElement | null = null;
	/** The coordinates whose place name is being looked up. */
	private lookingUpPlaceFor: string | null = null;
	/** The coordinates whose place name couldn't be found, so it isn't asked for again. */
	private placeNotFoundFor: string | null = null;
	private lookUpPlaceSoon = debounce(
		() => this.lookUpPlace(),
		PLACE_LOOKUP_DELAY_MS,
		true
	);
	private guessButton: ButtonComponent | null = null;
	private pauseToggle: ToggleComponent | null = null;

	constructor(app: App, plugin: SDNSPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.statusEl = containerEl.createEl("div", { cls: "sdns-status" });
		this.addPauseSetting(containerEl);

		new Setting(containerEl).setName("📍 Location").setHeading();
		this.addCoordinatesSetting(containerEl);
		this.addIpSetting(containerEl);
		this.addTimeZoneSetting(containerEl);
		addCoordinatesHelp(containerEl);

		new Setting(containerEl).setName("🔧 Offsets").setHeading();
		this.addOffsetSetting(containerEl, "sunriseOffset", "light", "sunrise");
		this.addOffsetSetting(containerEl, "sunsetOffset", "dark", "sunset");

		new Setting(containerEl).setName("📅 Schedule").setHeading();
		this.scheduleEl = containerEl.createEl("div");

		this.refresh();

		// e.g. settings saved before place names existed.
		const settings = this.plugin.settings;
		const key = coordinatesKey(settings);
		if (
			settings.locationName === "" &&
			parseCoordinates(settings) !== null &&
			this.lookingUpPlaceFor !== key &&
			this.placeNotFoundFor !== key
		) {
			void this.lookUpPlace();
		}
	}

	/** Re-renders what depends on the settings, leaving the inputs (and their focus) alone. */
	private refresh() {
		this.renderStatus();
		this.renderPlace();
		this.renderSchedule();
		this.updateGuessButton();
	}

	/** Shows a location set by a guess rather than typed into the field. */
	showLocation() {
		this.lookUpPlaceSoon.cancel();
		this.lookingUpPlaceFor = null;
		this.coordinatesText?.setValue(coordinatesKey(this.plugin.settings));
		if (this.coordinatesErrorEl) {
			this.coordinatesErrorEl.textContent = "";
		}
		this.refresh();
	}

	private async useLocation(location: LocationSettings) {
		Object.assign(this.plugin.settings, location);
		this.showLocation();
		await this.save();
	}

	/** Shows settings changed elsewhere, e.g. by the pause command's hotkey. */
	update() {
		this.pauseToggle?.setValue(this.plugin.settings.paused);
		this.refresh();
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
				(this.pauseToggle = toggle)
					.setValue(this.plugin.settings.paused)
					.onChange(async (paused) => {
						// Obsidian calls this from setValue() too, e.g. in update().
						if (paused === this.plugin.settings.paused) return;
						this.plugin.settings.paused = paused;
						await this.save();
					})
			)
			.addButton((button) =>
				button
					.setButtonText("Set hotkey")
					.setTooltip("Assign a hotkey to pause or resume")
					.onClick(() => openHotkeys(this.app, HOTKEYS_QUERY))
			);
	}

	private addCoordinatesSetting(containerEl: HTMLElement) {
		const { latitude, longitude } = this.plugin.settings;
		const value = latitude || longitude ? `${latitude}, ${longitude}` : "";

		const setting = new Setting(containerEl)
			.setName("Coordinates")
			.setDesc("Latitude and longitude of your city, as copied from a map.");
		this.placeEl = setting.descEl.createEl("div", { cls: "sdns-place" });
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
						const settings = this.plugin.settings;
						if (coordinatesKey(parsed) === coordinatesKey(settings)) return;
						settings.latitude = parsed.latitude;
						settings.longitude = parsed.longitude;
						settings.locationName = "";
						this.lookingUpPlaceFor = coordinatesKey(settings);
						this.lookUpPlaceSoon();
						await this.save();
					}, 300)
				)
		);
	}

	private addIpSetting(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName("Guess from IP address")
			.setDesc(
				"Fill in the city of your internet connection, looked up by GeoJS (geojs.io). New installs start with it. It is usually your city or a nearby one, but behind a VPN it's the VPN server's."
			)
			.addButton((button) =>
				button.setButtonText("Guess").onClick(async () => {
					button.setButtonText("Guessing…").setDisabled(true);
					const location = await locateByIp();
					button.setButtonText("Guess").setDisabled(false);
					if (location === null) {
						new Notice(
							"Couldn't guess your location from your IP address. Check your internet connection, or enter coordinates."
						);
						return;
					}
					await this.useLocation(location);
				})
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
				this.guessButton = button.onClick(() =>
					this.useLocation({ latitude, longitude, locationName: city })
				);
			});
	}

	/** Names the saved coordinates' place, unless they change while it's looked up. */
	private async lookUpPlace() {
		const settings = this.plugin.settings;
		const coordinates = parseCoordinates(settings);
		if (coordinates === null) return;
		const key = coordinatesKey(settings);
		this.lookingUpPlaceFor = key;
		this.renderPlace();

		const name = await lookUpPlaceName(coordinates);
		if (coordinatesKey(settings) !== key || this.lookingUpPlaceFor !== key) {
			return;
		}
		this.lookingUpPlaceFor = null;
		if (name === null) {
			this.placeNotFoundFor = key;
			this.renderPlace();
			return;
		}
		settings.locationName = name;
		await this.save();
	}

	private renderPlace() {
		const placeEl = this.placeEl;
		if (!placeEl) return;
		const settings = this.plugin.settings;
		const place =
			settings.locationName ||
			(this.lookingUpPlaceFor === coordinatesKey(settings)
				? "looking it up…"
				: "impossible to calculate");
		placeEl.textContent = `Place: ${place}`;
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

/** Search text that finds this plugin's commands in Settings → Hotkeys. */
const HOTKEYS_QUERY = "DayNight";

/** The bits of Obsidian's settings modal used below; not in the public API. */
interface SettingModal {
	openTabById?(
		id: string
	): { searchComponent?: { inputEl?: HTMLInputElement } } | undefined;
}

/**
 * Opens Settings → Hotkeys and types `query` into its search box. Obsidian
 * has no API for this, so each step is optional: at worst the tab opens
 * unfiltered, or nothing happens. The search box filters on "input", so
 * firing that event works like the user typing, whatever the tab's own
 * refresh methods are called in this version.
 */
function openHotkeys(app: App, query: string) {
	const { setting } = app as unknown as { setting?: SettingModal };
	const inputEl = setting?.openTabById?.("hotkeys")?.searchComponent?.inputEl;
	if (!inputEl) return;
	inputEl.value = query;
	inputEl.dispatchEvent(new Event("input"));
	inputEl.focus();
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
		text: "A city within about 200 km of you is accurate enough. Sunrise and sunset are calculated on your device. To show the place's name, the coordinates you enter are sent to OpenStreetMap's Nominatim; the IP address guess asks GeoJS.",
	});
	const credit = details.createEl("p");
	credit.append("Place names © ");
	credit.createEl("a", {
		href: "https://www.openstreetmap.org/copyright",
		text: "OpenStreetMap contributors",
	});
}
