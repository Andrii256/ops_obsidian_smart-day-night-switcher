import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatDate, formatTime } from "../src/format";
import { locateByIp, lookUpPlaceName } from "../src/locate";
import { DEFAULT_SETTINGS } from "../src/settings";
import { SDNSPluginSettingTab } from "../src/settings-tab";
import { getSunTimes } from "../src/sun-times";
import { createPlugin, stubTimeZone } from "./helpers";

vi.mock("../src/locate", () => ({
	locateByIp: vi.fn(),
	lookUpPlaceName: vi.fn(),
}));

// London (the default) at noon: light until sunset.
const NOW = new Date(2026, 9, 21, 12);
const MINUTE_MS = 60 * 1000;

async function renderTab(savedData: unknown = {}) {
	const plugin = createPlugin(savedData);
	await plugin.loadSettings();
	const saveSettings = vi.spyOn(plugin, "saveSettings").mockResolvedValue();
	const tab = new SDNSPluginSettingTab(plugin.app, plugin);
	tab.display();
	return { plugin, tab, saveSettings, containerEl: tab.containerEl };
}

const settingItems = (containerEl: HTMLElement) =>
	Array.from(containerEl.querySelectorAll<HTMLElement>(".setting-item"));

const settingNamed = (containerEl: HTMLElement, name: string) => {
	const item = settingItems(containerEl).find(
		(el) => el.querySelector(".setting-item-name")?.textContent === name
	);
	if (!item) throw new Error(`No setting "${name}"`);
	return item;
};

const inputFor = (containerEl: HTMLElement, name: string) => {
	const input = settingNamed(containerEl, name).querySelector("input");
	if (!input) throw new Error(`No input for setting "${name}"`);
	return input;
};

const descOf = (containerEl: HTMLElement, name: string) =>
	settingNamed(containerEl, name).querySelector(".setting-item-description")
		?.textContent;

const errorOf = (containerEl: HTMLElement, name: string) =>
	settingNamed(containerEl, name).querySelector(".sdns-error")?.textContent;

const type = (input: HTMLInputElement, value: string) => {
	input.value = value;
	input.dispatchEvent(new Event("input"));
};

const statusText = (containerEl: HTMLElement) =>
	containerEl.querySelector(".sdns-status")?.textContent;

const rows = (containerEl: HTMLElement) =>
	Array.from(containerEl.querySelectorAll("table tr")).map((tr) =>
		Array.from(tr.children).map((cell) => cell.textContent)
	);

const LIGHT = "☀️ Light mode";
const DARK = "🌒 Dark mode";

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
	vi.mocked(locateByIp).mockReset().mockResolvedValue(null);
	vi.mocked(lookUpPlaceName).mockReset().mockResolvedValue(null);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("layout", () => {
	it("groups settings under headings", async () => {
		const { containerEl } = await renderTab();

		expect(
			settingItems(containerEl).map((el) => [
				el.querySelector(".setting-item-name")?.textContent,
				el.classList.contains("setting-item-heading"),
			])
		).toEqual([
			["Pause automatic switching", false],
			["📍 Location", true],
			["Coordinates", false],
			["Guess from IP address", false],
			["Guess from time zone", false],
			["🔧 Offsets", true],
			[LIGHT, false],
			[DARK, false],
			["📅 Schedule", true],
		]);
	});

	it("does not use inline styles", async () => {
		const { containerEl } = await renderTab();

		expect(containerEl.querySelector("[style]")).toBeNull();
	});
});

describe("status", () => {
	it("shows the current mode and the next switch", async () => {
		const { containerEl } = await renderTab();
		const { sunset } = getSunTimes(NOW, 51.507351, -0.127758);

		expect(statusText(containerEl)).toBe(
			`${LIGHT} now · switches to dark today at ${formatTime(sunset)}`
		);
	});

	it("says when the next switch is tomorrow", async () => {
		vi.setSystemTime(new Date(2026, 9, 21, 22));
		const { containerEl } = await renderTab();
		const { sunrise } = getSunTimes(
			new Date(2026, 9, 22, 12),
			51.507351,
			-0.127758
		);

		expect(statusText(containerEl)).toBe(
			`${DARK} now · switches to light tomorrow at ${formatTime(sunrise)}`
		);
	});

	it("covers polar night, when the sun does not rise", async () => {
		vi.setSystemTime(new Date(2026, 11, 21, 12));
		const { containerEl } = await renderTab({
			latitude: "78.2232",
			longitude: "15.6267",
		});

		expect(statusText(containerEl)).toBe(
			`${DARK} now · no switch within the next day`
		);
	});

	it("asks for coordinates while they are invalid", async () => {
		const { containerEl } = await renderTab({ latitude: "", longitude: "" });

		expect(statusText(containerEl)).toContain("Enter your coordinates");
	});
});

describe("coordinates", () => {
	it("shows the saved latitude and longitude in one field", async () => {
		const { containerEl } = await renderTab({
			latitude: "48.8566",
			longitude: "2.3522",
		});

		const input = inputFor(containerEl, "Coordinates");
		expect(input.value).toBe("48.8566, 2.3522");
		expect(input.placeholder).toBe("51.5074, -0.1278");
		expect(errorOf(containerEl, "Coordinates")).toBe("");
	});

	it("saves a pasted pair after a 300 ms debounce", async () => {
		const { plugin, containerEl, saveSettings } = await renderTab();

		type(inputFor(containerEl, "Coordinates"), "48.8566, 2.3522");
		vi.advanceTimersByTime(299);
		expect(saveSettings).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(saveSettings).toHaveBeenCalledOnce();
		expect(plugin.settings).toEqual({
			...DEFAULT_SETTINGS,
			latitude: "48.8566",
			longitude: "2.3522",
		});
	});

	it("saves once with the last value when typing quickly", async () => {
		const { plugin, containerEl, saveSettings } = await renderTab();
		const input = inputFor(containerEl, "Coordinates");

		type(input, "4");
		type(input, "48.8, 2");
		type(input, "48.8, 2.3");
		await vi.advanceTimersByTimeAsync(300);

		expect(saveSettings).toHaveBeenCalledOnce();
		expect(plugin.settings.longitude).toBe("2.3");
	});

	it("explains invalid input and keeps the last valid location", async () => {
		const { plugin, containerEl, saveSettings } = await renderTab();

		type(inputFor(containerEl, "Coordinates"), "95, 2");
		await vi.advanceTimersByTimeAsync(300);

		expect(errorOf(containerEl, "Coordinates")).toContain("-90 to 90");
		expect(saveSettings).not.toHaveBeenCalled();
		expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
	});

	it("clears the error once the input is fixed", async () => {
		const { containerEl } = await renderTab();
		const input = inputFor(containerEl, "Coordinates");

		type(input, "48.8566");
		await vi.advanceTimersByTimeAsync(300);
		expect(errorOf(containerEl, "Coordinates")).not.toBe("");

		type(input, "48.8566, 2.3522");
		await vi.advanceTimersByTimeAsync(300);
		expect(errorOf(containerEl, "Coordinates")).toBe("");
	});

	it("updates the status and schedule without re-opening the tab", async () => {
		const { containerEl } = await renderTab();
		const input = inputFor(containerEl, "Coordinates");

		type(input, "48.8566, 2.3522");
		await vi.advanceTimersByTimeAsync(300);

		const { sunrise } = getSunTimes(NOW, 48.8566, 2.3522);
		expect(rows(containerEl)[1][1]).toBe(formatTime(sunrise));
		// The field being edited stays in place.
		expect(containerEl.contains(input)).toBe(true);
	});

	it("has collapsed help with links to coordinate lookup services", async () => {
		const { containerEl } = await renderTab();
		const help = containerEl.querySelector("details");

		expect(help?.open).toBe(false);
		expect(help?.querySelector("summary")?.textContent).toBe(
			"How do I find my coordinates?"
		);
		expect(
			Array.from(help?.querySelectorAll("a") ?? []).map((a) =>
				a.getAttribute("href")
			)
		).toEqual([
			"https://www.latlong.net/",
			"https://www.gps-coordinates.net/",
			"https://www.openstreetmap.org/copyright",
		]);
	});
});

describe("pause", () => {
	const toggle = (containerEl: HTMLElement) =>
		inputFor(containerEl, "Pause automatic switching");

	it("is off by default", async () => {
		const { containerEl } = await renderTab();

		expect(toggle(containerEl).checked).toBe(false);
	});

	it("saves and shows the paused state", async () => {
		const { plugin, containerEl, saveSettings } = await renderTab();

		const input = toggle(containerEl);
		input.checked = true;
		input.dispatchEvent(new Event("change"));
		await vi.advanceTimersByTimeAsync(0);

		expect(plugin.settings.paused).toBe(true);
		expect(saveSettings).toHaveBeenCalledOnce();
		expect(statusText(containerEl)).toBe("⏸ Automatic switching is paused");
	});

	it("shows a saved pause", async () => {
		const { containerEl } = await renderTab({ paused: true });

		expect(toggle(containerEl).checked).toBe(true);
		expect(statusText(containerEl)).toBe("⏸ Automatic switching is paused");
	});

	it("shows a pause or resume from the command's hotkey right away", async () => {
		const plugin = createPlugin();
		const addCommand = vi.spyOn(plugin, "addCommand");
		const addSettingTab = vi.spyOn(plugin, "addSettingTab");
		await plugin.onload();
		const tab = addSettingTab.mock.calls[0]?.[0] as SDNSPluginSettingTab;
		tab.display();
		const { containerEl } = tab;
		const command = addCommand.mock.calls[0]?.[0];

		await command?.callback?.();
		expect(toggle(containerEl).checked).toBe(true);
		expect(statusText(containerEl)).toBe("⏸ Automatic switching is paused");

		await command?.callback?.();
		expect(toggle(containerEl).checked).toBe(false);
		expect(statusText(containerEl)).toContain("now");
		plugin.unload();
	});

	const hotkeyButton = (containerEl: HTMLElement) =>
		settingNamed(containerEl, "Pause automatic switching").querySelector(
			"button"
		);

	it("opens the hotkeys tab and searches for DayNight", async () => {
		const { plugin, containerEl } = await renderTab();
		const inputEl = document.createElement("input");
		const typed: string[] = [];
		inputEl.addEventListener("input", () => typed.push(inputEl.value));
		const openTabById = vi.fn(() => ({ searchComponent: { inputEl } }));
		Object.assign(plugin.app, { setting: { openTabById } });

		expect(hotkeyButton(containerEl)?.textContent).toBe("Set hotkey");
		hotkeyButton(containerEl)?.click();

		expect(openTabById).toHaveBeenCalledWith("hotkeys");
		// The "input" event is what makes Obsidian filter the list.
		expect(typed).toEqual(["DayNight"]);
	});

	it("does nothing if Obsidian's settings internals are missing", async () => {
		const { containerEl } = await renderTab();

		expect(() => hotkeyButton(containerEl)?.click()).not.toThrow();
	});
});

describe("place", () => {
	const placeText = (containerEl: HTMLElement) =>
		settingNamed(containerEl, "Coordinates").querySelector(".sdns-place")
			?.textContent;

	it("shows the saved place name as text", async () => {
		const { containerEl } = await renderTab({ locationName: "London" });

		expect(placeText(containerEl)).toBe("Place: London");
		expect(lookUpPlaceName).not.toHaveBeenCalled();
	});

	it("looks up the place of coordinates saved without a name", async () => {
		vi.mocked(lookUpPlaceName).mockResolvedValue("Paris, France");
		const { plugin, containerEl, saveSettings } = await renderTab({
			latitude: "48.8566",
			longitude: "2.3522",
		});
		expect(placeText(containerEl)).toBe("Place: looking it up…");

		await vi.advanceTimersByTimeAsync(0);

		expect(lookUpPlaceName).toHaveBeenCalledWith({
			latitude: 48.8566,
			longitude: 2.3522,
		});
		expect(plugin.settings.locationName).toBe("Paris, France");
		expect(saveSettings).toHaveBeenCalledOnce();
		expect(placeText(containerEl)).toBe("Place: Paris, France");
	});

	it("looks up the place of typed coordinates once typing settles", async () => {
		vi.mocked(lookUpPlaceName).mockResolvedValue("Paris, France");
		const { plugin, containerEl } = await renderTab({ locationName: "London" });
		const input = inputFor(containerEl, "Coordinates");

		type(input, "48.8, 2.3");
		await vi.advanceTimersByTimeAsync(300);
		type(input, "48.8566, 2.3522");
		await vi.advanceTimersByTimeAsync(300);
		expect(placeText(containerEl)).toBe("Place: looking it up…");
		expect(lookUpPlaceName).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1500);

		expect(lookUpPlaceName).toHaveBeenCalledOnce();
		expect(lookUpPlaceName).toHaveBeenCalledWith({
			latitude: 48.8566,
			longitude: 2.3522,
		});
		expect(plugin.settings.locationName).toBe("Paris, France");
		expect(placeText(containerEl)).toBe("Place: Paris, France");
	});

	it("says when the place can't be found, and doesn't ask again", async () => {
		const { tab, containerEl } = await renderTab({
			latitude: "0",
			longitude: "-30",
		});
		await vi.advanceTimersByTimeAsync(0);

		expect(placeText(containerEl)).toBe("Place: impossible to calculate");

		tab.display();
		await vi.advanceTimersByTimeAsync(0);
		expect(lookUpPlaceName).toHaveBeenCalledOnce();
		expect(placeText(containerEl)).toBe("Place: impossible to calculate");
	});

	it("ignores a lookup answer for coordinates that changed meanwhile", async () => {
		let answer: (name: string) => void = () => undefined;
		vi.mocked(lookUpPlaceName).mockReturnValue(
			new Promise((resolve) => (answer = resolve))
		);
		const { plugin, containerEl } = await renderTab({
			latitude: "48.8566",
			longitude: "2.3522",
		});

		settingNamed(containerEl, "Guess from time zone")
			.querySelector("button")
			?.click();
		answer("Paris, France");
		await vi.advanceTimersByTimeAsync(0);

		expect(plugin.settings.locationName).toBe("London");
		expect(placeText(containerEl)).toBe("Place: London");
	});
});

describe("guess from IP address", () => {
	const button = (containerEl: HTMLElement) => {
		const el = settingNamed(containerEl, "Guess from IP address").querySelector(
			"button"
		);
		if (!el) throw new Error("No button");
		return el;
	};
	const KYIV = {
		latitude: "50.4547",
		longitude: "30.5238",
		locationName: "Kyiv, Ukraine",
	};

	it("fills in and saves the IP address's location and place", async () => {
		vi.mocked(locateByIp).mockResolvedValue(KYIV);
		const { plugin, containerEl, saveSettings } = await renderTab({
			locationName: "London",
		});

		button(containerEl).click();
		expect(button(containerEl).disabled).toBe(true);
		await vi.advanceTimersByTimeAsync(0);

		expect(plugin.settings).toMatchObject(KYIV);
		expect(saveSettings).toHaveBeenCalledOnce();
		expect(inputFor(containerEl, "Coordinates").value).toBe(
			"50.4547, 30.5238"
		);
		expect(
			settingNamed(containerEl, "Coordinates").querySelector(".sdns-place")
				?.textContent
		).toBe("Place: Kyiv, Ukraine");
		expect(button(containerEl).disabled).toBe(false);
	});

	it("keeps the location if the lookup fails", async () => {
		const { plugin, containerEl, saveSettings } = await renderTab({
			locationName: "London",
		});

		button(containerEl).click();
		await vi.advanceTimersByTimeAsync(0);

		expect(plugin.settings).toEqual({ ...DEFAULT_SETTINGS, locationName: "London" });
		expect(saveSettings).not.toHaveBeenCalled();
		expect(button(containerEl).disabled).toBe(false);
	});
});

describe("guess from time zone", () => {
	// Tests run in Europe/London.
	const button = (containerEl: HTMLElement) => {
		const el = settingNamed(containerEl, "Guess from time zone").querySelector(
			"button"
		);
		if (!el) throw new Error("No button");
		return el;
	};

	it("names the time zone and its city", async () => {
		const { containerEl } = await renderTab();

		expect(descOf(containerEl, "Guess from time zone")).toContain(
			"London (51.5083, -0.1253)"
		);
		expect(descOf(containerEl, "Guess from time zone")).toContain(
			"Europe/London"
		);
		expect(button(containerEl).textContent).toBe("Use London");
		expect(button(containerEl).disabled).toBe(false);
	});

	it("fills in and saves the city's coordinates", async () => {
		const { plugin, containerEl, saveSettings } = await renderTab({
			latitude: "48.8566",
			longitude: "2.3522",
		});

		button(containerEl).click();
		await vi.advanceTimersByTimeAsync(0);

		expect(plugin.settings.latitude).toBe("51.5083");
		expect(plugin.settings.longitude).toBe("-0.1253");
		expect(saveSettings).toHaveBeenCalledOnce();
		expect(inputFor(containerEl, "Coordinates").value).toBe(
			"51.5083, -0.1253"
		);
		expect(button(containerEl).textContent).toBe("Using London");
		expect(button(containerEl).disabled).toBe(true);
	});

	it("clears an error in the coordinates field", async () => {
		const { containerEl } = await renderTab();
		type(inputFor(containerEl, "Coordinates"), "nonsense");
		await vi.advanceTimersByTimeAsync(300);
		expect(errorOf(containerEl, "Coordinates")).not.toBe("");

		button(containerEl).click();
		await vi.advanceTimersByTimeAsync(0);

		expect(errorOf(containerEl, "Coordinates")).toBe("");
	});

	it("is hidden when the time zone has no city", async () => {
		stubTimeZone("UTC");
		const { containerEl } = await renderTab();
		vi.unstubAllGlobals();

		expect(() => settingNamed(containerEl, "Guess from time zone")).toThrow();
	});
});

describe("switch times", () => {
	const controls = (containerEl: HTMLElement, name: string) => {
		const item = settingNamed(containerEl, name);
		const minutes = item.querySelector("input");
		const direction = item.querySelector("select");
		if (!minutes || !direction) throw new Error(`No controls for "${name}"`);
		return { minutes, direction };
	};

	const choose = (select: HTMLSelectElement, value: string) => {
		select.value = value;
		select.dispatchEvent(new Event("change"));
	};

	it("default to switching at sunrise and sunset", async () => {
		const { containerEl } = await renderTab();

		for (const [name, event] of [
			[LIGHT, "sunrise"],
			[DARK, "sunset"],
		]) {
			const { minutes, direction } = controls(containerEl, name);
			expect(minutes.type).toBe("number");
			expect([minutes.min, minutes.max, minutes.value]).toEqual(["0", "180", "0"]);
			expect(
				Array.from(direction.options).map((o) => o.textContent)
			).toEqual([`before ${event}`, `after ${event}`]);
			expect(descOf(containerEl, name)).toBe(`Switch at ${event}`);
		}
	});

	it("show saved offsets as minutes before or after", async () => {
		const { containerEl } = await renderTab({
			sunriseOffset: "30",
			sunsetOffset: "-90",
		});

		const light = controls(containerEl, LIGHT);
		expect([light.minutes.value, light.direction.value]).toEqual(["30", "after"]);
		expect(descOf(containerEl, LIGHT)).toBe("Switch 30 min after sunrise");

		const dark = controls(containerEl, DARK);
		expect([dark.minutes.value, dark.direction.value]).toEqual(["90", "before"]);
		expect(descOf(containerEl, DARK)).toBe("Switch 1 h 30 min before sunset");
	});

	it.each([
		[LIGHT, "sunriseOffset"],
		[DARK, "sunsetOffset"],
	] as const)("%s saves minutes before as a negative offset", async (name, key) => {
		const { plugin, containerEl, saveSettings } = await renderTab();
		const { minutes, direction } = controls(containerEl, name);

		type(minutes, "45");
		choose(direction, "before");
		expect(descOf(containerEl, name)).toMatch(/^Switch 45 min before/);
		await vi.advanceTimersByTimeAsync(300);

		expect(saveSettings).toHaveBeenCalledOnce();
		expect(plugin.settings[key]).toBe("-45");
	});

	it("saves minutes after as a positive offset", async () => {
		const { plugin, containerEl } = await renderTab({ sunsetOffset: "-30" });

		choose(controls(containerEl, DARK).direction, "after");
		await vi.advanceTimersByTimeAsync(300);

		expect(plugin.settings.sunsetOffset).toBe("30");
	});

	it("treat an empty field as switching exactly at the event", async () => {
		const { plugin, containerEl } = await renderTab({ sunsetOffset: "-30" });

		type(controls(containerEl, DARK).minutes, "");
		await vi.advanceTimersByTimeAsync(300);

		expect(descOf(containerEl, DARK)).toBe("Switch at sunset");
		expect(plugin.settings.sunsetOffset).toBe("0");
	});

	it.each([["181"], ["-5"]])(
		"explain and do not save %j",
		async (input) => {
			const { plugin, containerEl, saveSettings } = await renderTab();

			type(controls(containerEl, DARK).minutes, input);
			await vi.advanceTimersByTimeAsync(300);

			const desc = settingNamed(containerEl, DARK).querySelector(
				".setting-item-description"
			);
			expect(desc?.textContent).toBe("Enter a number of minutes from 0 to 180");
			expect(desc?.classList.contains("sdns-invalid")).toBe(true);
			expect(saveSettings).not.toHaveBeenCalled();
			expect(plugin.settings.sunsetOffset).toBe("0");
		}
	);
});

describe("schedule", () => {
	it("shows the next 7 days starting today, highlighted", async () => {
		const { containerEl } = await renderTab();
		const [header, ...days] = rows(containerEl);

		expect(header).toEqual(["Date", LIGHT, DARK]);
		expect(days.map(([date]) => date)).toEqual([
			"21 Oct 2026",
			"22 Oct 2026",
			"23 Oct 2026",
			"24 Oct 2026",
			"25 Oct 2026",
			"26 Oct 2026",
			"27 Oct 2026",
		]);
		expect(
			containerEl.querySelector("tbody tr")?.classList.contains("sdns-today")
		).toBe(true);
	});

	it("expands to 31 days and back", async () => {
		const { containerEl } = await renderTab();
		const toggle = () =>
			containerEl.querySelector<HTMLButtonElement>(".sdns-schedule-toggle");

		expect(toggle()?.textContent).toBe("Show 31 days");
		toggle()?.click();
		expect(rows(containerEl)).toHaveLength(32);
		expect(rows(containerEl)[31][0]).toBe("20 Nov 2026");

		expect(toggle()?.textContent).toBe("Show less");
		toggle()?.click();
		expect(rows(containerEl)).toHaveLength(8);
	});

	it("shows switch times with the offsets applied", async () => {
		const { containerEl } = await renderTab({
			latitude: "48.8566",
			longitude: "2.3522",
			sunriseOffset: "30",
			sunsetOffset: "-15",
		});
		const { sunrise, sunset } = getSunTimes(NOW, 48.8566, 2.3522);

		expect(rows(containerEl)[1]).toEqual([
			formatDate(NOW),
			formatTime(new Date(sunrise.getTime() + 30 * MINUTE_MS)),
			formatTime(new Date(sunset.getTime() - 15 * MINUTE_MS)),
		]);
	});

	it("shows a hint instead of the table for invalid coordinates", async () => {
		const { containerEl } = await renderTab({ latitude: "-", longitude: "0" });

		expect(containerEl.querySelector("table")).toBeNull();
		expect(containerEl.textContent).toContain("Enter valid coordinates");
		expect(errorOf(containerEl, "Coordinates")).toContain("Latitude");
	});
});

describe("display", () => {
	it("replaces previous content when re-opened", async () => {
		const { tab, containerEl } = await renderTab();
		const before = containerEl.innerHTML;

		tab.display();

		expect(containerEl.innerHTML).toBe(before);
		expect(containerEl.querySelectorAll("table")).toHaveLength(1);
	});
});
