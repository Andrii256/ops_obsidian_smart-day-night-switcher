import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatDate, formatTime } from "../src/format";
import { DEFAULT_SETTINGS } from "../src/settings";
import { SDNSPluginSettingTab } from "../src/settings-tab";
import { getSunTimes } from "../src/sun-times";
import { createPlugin } from "./helpers";

const NOW = new Date(2026, 9, 21, 12);

async function renderTab(savedData: unknown = null) {
	const plugin = createPlugin(savedData);
	await plugin.loadSettings();
	const saveSettings = vi.spyOn(plugin, "saveSettings").mockResolvedValue();
	const tab = new SDNSPluginSettingTab(plugin.app, plugin);
	tab.display();
	return { plugin, tab, saveSettings, containerEl: tab.containerEl };
}

const settingItems = (containerEl: HTMLElement) =>
	Array.from(containerEl.querySelectorAll<HTMLElement>(".setting-item"));

const inputFor = (containerEl: HTMLElement, name: string) => {
	const item = settingItems(containerEl).find(
		(el) => el.querySelector(".setting-item-name")?.textContent === name
	);
	const input = item?.querySelector("input");
	if (!input) throw new Error(`No input for setting "${name}"`);
	return input;
};

const type = (input: HTMLInputElement, value: string) => {
	input.value = value;
	input.dispatchEvent(new Event("input"));
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("coordinate settings", () => {
	it("renders latitude and longitude settings", async () => {
		const { containerEl } = await renderTab();

		const items = settingItems(containerEl);
		expect(items).toHaveLength(2);
		expect(
			items.map((el) => el.querySelector(".setting-item-name")?.textContent)
		).toEqual(["Latitude", "Longitude"]);
		expect(
			items[0].querySelector(".setting-item-description")?.textContent
		).toContain("latitude");
		expect(
			items[1].querySelector(".setting-item-description")?.textContent
		).toContain("longitude");
	});

	it("shows the current values with placeholders", async () => {
		const { containerEl } = await renderTab({
			latitude: "48.8566",
			longitude: "2.3522",
		});

		const lat = inputFor(containerEl, "Latitude");
		const lng = inputFor(containerEl, "Longitude");
		expect(lat.value).toBe("48.8566");
		expect(lng.value).toBe("2.3522");
		expect(lat.placeholder).toBe("Latitude");
		expect(lng.placeholder).toBe("Longitude");
	});

	it("saves a new latitude after a 300 ms debounce", async () => {
		const { plugin, containerEl, saveSettings } = await renderTab();

		type(inputFor(containerEl, "Latitude"), "48.8566");
		vi.advanceTimersByTime(299);
		expect(saveSettings).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(saveSettings).toHaveBeenCalledOnce();
		expect(plugin.settings).toEqual({
			latitude: "48.8566",
			longitude: DEFAULT_SETTINGS.longitude,
		});
	});

	it("saves a new longitude", async () => {
		const { plugin, containerEl, saveSettings } = await renderTab();

		type(inputFor(containerEl, "Longitude"), "2.3522");
		vi.advanceTimersByTime(300);

		expect(saveSettings).toHaveBeenCalledOnce();
		expect(plugin.settings.longitude).toBe("2.3522");
		expect(plugin.settings.latitude).toBe(DEFAULT_SETTINGS.latitude);
	});

	it("saves once with the last value when typing quickly", async () => {
		const { plugin, containerEl, saveSettings } = await renderTab();
		const input = inputFor(containerEl, "Latitude");

		type(input, "4");
		type(input, "48");
		type(input, "48.8");
		vi.advanceTimersByTime(300);

		expect(saveSettings).toHaveBeenCalledOnce();
		expect(plugin.settings.latitude).toBe("48.8");
	});
});

describe("help text", () => {
	it("links to coordinate lookup services", async () => {
		const { containerEl } = await renderTab();

		const hrefs = Array.from(containerEl.querySelectorAll("a")).map((a) =>
			a.getAttribute("href")
		);
		expect(hrefs).toEqual([
			"https://www.latlong.net/",
			"https://www.gps-coordinates.net/",
		]);
	});
});

describe("schedule table", () => {
	const rows = (containerEl: HTMLElement) =>
		Array.from(containerEl.querySelectorAll("table tr")).map((tr) =>
			Array.from(tr.children).map((cell) => cell.textContent)
		);

	it("has a header row and 31 days", async () => {
		const { containerEl } = await renderTab();
		const [header, ...days] = rows(containerEl);

		expect(header).toEqual([
			"Date",
			"Sunrise(Light mode will be enabled)",
			"Sunset(Dark mode will be enabled)",
		]);
		expect(days).toHaveLength(31);
	});

	it("starts today and lists consecutive days", async () => {
		const { containerEl } = await renderTab();
		const days = rows(containerEl).slice(1);

		expect(days[0][0]).toBe("21 Oct 2026");
		expect(days[1][0]).toBe("22 Oct 2026");
		expect(days[30][0]).toBe("20 Nov 2026");
	});

	it("shows sunrise and sunset for the saved coordinates", async () => {
		const { containerEl } = await renderTab({
			latitude: "48.8566",
			longitude: "2.3522",
		});
		const days = rows(containerEl).slice(1);
		const { sunrise, sunset } = getSunTimes(NOW, 48.8566, 2.3522);

		expect(days[0]).toEqual([
			formatDate(NOW),
			formatTime(sunrise),
			formatTime(sunset),
		]);
	});
});

describe("schedule with invalid coordinates", () => {
	it("shows a hint instead of the table", async () => {
		const { containerEl } = await renderTab({ latitude: "-", longitude: "0" });

		expect(containerEl.querySelector("table")).toBeNull();
		expect(containerEl.textContent).toContain("Enter a valid latitude");
	});
});

describe("display", () => {
	it("replaces previous content when re-opened", async () => {
		const { tab, containerEl } = await renderTab();
		const before = containerEl.innerHTML;

		tab.display();

		expect(containerEl.innerHTML).toBe(before);
		expect(settingItems(containerEl)).toHaveLength(2);
		expect(containerEl.querySelectorAll("table")).toHaveLength(1);
	});
});
