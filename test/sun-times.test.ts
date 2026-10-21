import * as SunCalc from "suncalc";
import { describe, expect, it } from "vitest";

import { formatTime } from "../src/format";
import { getSchedule, getSchemeState, getSunTimes } from "../src/sun-times";

// London (the plugin default); tests run with TZ=Europe/London.
const LAT = 51.507351;
const LNG = -0.127758;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Local wall-clock time on 21 Jun 2026 (BST), as epoch ms. */
const summer = (h: number, m = 0) => new Date(2026, 5, 21, h, m).getTime();

describe("getSunTimes", () => {
	it("uses SunCalc's sunrise and sunset", () => {
		const date = new Date(2026, 5, 21, 12);
		const raw = SunCalc.getTimes(date, LAT, LNG);

		expect(getSunTimes(date, LAT, LNG)).toEqual({
			sunrise: raw.sunrise,
			sunset: raw.sunset,
		});
	});

	// Published London times (timeanddate.com): 04:43 / 21:21 and 08:04 / 15:53.
	it("matches published London times at the summer solstice", () => {
		const { sunrise, sunset } = getSunTimes(new Date(2026, 5, 21, 12), LAT, LNG);

		expect(formatTime(sunrise)).toBe("04:44");
		expect(formatTime(sunset)).toBe("21:22");
	});

	it("matches published London times at the winter solstice", () => {
		const { sunrise, sunset } = getSunTimes(new Date(2026, 11, 21, 12), LAT, LNG);

		expect(formatTime(sunrise)).toBe("08:05");
		expect(formatTime(sunset)).toBe("15:54");
	});
});

describe("getSchemeState", () => {
	const { sunrise, sunset } = getSunTimes(new Date(summer(12)), LAT, LNG);
	const tomorrowSunrise = getSunTimes(new Date(2026, 5, 22, 12), LAT, LNG).sunrise;

	it("is dark before sunrise and waits until sunrise", () => {
		const now = summer(2);

		expect(getSchemeState(now, LAT, LNG)).toEqual({
			colorScheme: "dark",
			msUntilNextChange: sunrise.getTime() - now,
		});
	});

	it("is dark just after midnight and waits until that day's sunrise", () => {
		const now = summer(0, 30);
		const state = getSchemeState(now, LAT, LNG);

		expect(state.colorScheme).toBe("dark");
		expect(now + state.msUntilNextChange).toBe(sunrise.getTime());
	});

	it("is light during the day and waits until sunset", () => {
		const now = summer(12);

		expect(getSchemeState(now, LAT, LNG)).toEqual({
			colorScheme: "light",
			msUntilNextChange: sunset.getTime() - now,
		});
	});

	it("is dark after sunset and waits until tomorrow's sunrise", () => {
		const now = summer(23);

		expect(getSchemeState(now, LAT, LNG)).toEqual({
			colorScheme: "dark",
			msUntilNextChange: tomorrowSunrise.getTime() - now,
		});
	});

	it("switches to light exactly at sunrise", () => {
		const state = getSchemeState(sunrise.getTime(), LAT, LNG);

		expect(state.colorScheme).toBe("light");
		expect(state.msUntilNextChange).toBe(sunset.getTime() - sunrise.getTime());
	});

	it("switches to dark exactly at sunset", () => {
		const state = getSchemeState(sunset.getTime(), LAT, LNG);

		expect(state.colorScheme).toBe("dark");
		expect(state.msUntilNextChange).toBe(
			tomorrowSunrise.getTime() - sunset.getTime()
		);
	});

	it("stays dark one millisecond before sunrise", () => {
		const state = getSchemeState(sunrise.getTime() - 1, LAT, LNG);

		expect(state).toEqual({ colorScheme: "dark", msUntilNextChange: 1 });
	});

	it("handles the night the clocks go back", () => {
		// 25 Oct 2026, BST -> GMT at 02:00.
		const now = new Date(2026, 9, 25, 1, 30).getTime();
		const state = getSchemeState(now, LAT, LNG);
		const { sunrise: dstSunrise } = getSunTimes(new Date(2026, 9, 25, 12), LAT, LNG);

		expect(state.colorScheme).toBe("dark");
		expect(now + state.msUntilNextChange).toBe(dstSunrise.getTime());
	});
});

/**
 * The README's promise, checked against the sun's actual position rather
 * than the implementation: light while the sun is up, dark while it's down.
 * Sunrise/sunset is when the sun's top edge crosses the horizon (-0.833°).
 * Samples within 0.5° of that are skipped: SunCalc's sunrise/sunset times
 * are accurate to ~0.3° of altitude.
 */
describe("light while the sun is up, dark while it is down", () => {
	const HORIZON_DEG = -0.833;
	const MARGIN_DEG = 0.5;
	const altitudeDeg = (t: number, lat: number, lng: number) =>
		(SunCalc.getPosition(new Date(t), lat, lng).altitude * 180) / Math.PI;

	const places: [string, number, number][] = [
		["London", LAT, LNG],
		["Tokyo", 35.68, 139.69],
		["Sydney", -33.87, 151.21],
		["Auckland", -36.85, 174.76],
		["Honolulu", 21.31, -157.86],
		["Los Angeles", 34.05, -118.24],
		["Madrid (solar time ~1.5 h behind clock)", 40.42, -3.7],
		["Urumqi (solar time ~2 h behind clock)", 43.82, 87.62],
		["Kiritimati (UTC+14)", 1.87, -157.4],
		["Quito (equator)", -0.18, -78.47],
		["Reykjavik (white nights)", 64.15, -21.94],
		["Tromsø (polar day and night)", 69.65, 18.96],
		["Longyearbyen (polar day and night)", 78.22, 15.63],
	];

	it.each(places)("%s, through 2026", (_, lat, lng) => {
		const start = Date.UTC(2026, 0, 1);
		const step = 37 * 60 * 1000 + 13 * 1000; // drifts through every time of day
		for (let now = start; now < start + 365 * DAY_MS; now += step) {
			const { colorScheme, msUntilNextChange } = getSchemeState(now, lat, lng);

			expect(Number.isFinite(msUntilNextChange)).toBe(true);
			expect(msUntilNextChange).toBeGreaterThan(0);
			expect(msUntilNextChange).toBeLessThanOrEqual(DAY_MS);

			const altitude = altitudeDeg(now, lat, lng);
			if (Math.abs(altitude - HORIZON_DEG) < MARGIN_DEG) continue;
			const expected = altitude > HORIZON_DEG ? "light" : "dark";
			if (colorScheme !== expected) {
				throw new Error(
					`${new Date(now).toISOString()}: sun at ${altitude.toFixed(2)}°, got ${colorScheme}`
				);
			}
		}
	});

	it.each(places.slice(0, 10))(
		"%s: the next change lands on a real sunrise or sunset",
		(_, lat, lng) => {
			const start = Date.UTC(2026, 0, 1);
			for (let now = start; now < start + 365 * DAY_MS; now += 5 * HOUR_MS + 7 * 60 * 1000) {
				const { colorScheme, msUntilNextChange } = getSchemeState(now, lat, lng);
				const at = now + msUntilNextChange;
				const flipped = getSchemeState(at, lat, lng).colorScheme;

				expect(flipped).not.toBe(colorScheme);
				expect(
					Math.abs(altitudeDeg(at, lat, lng) - HORIZON_DEG)
				).toBeLessThan(MARGIN_DEG);
			}
		}
	);
});

describe("getSchemeState in polar regions", () => {
	// Longyearbyen, Svalbard: midnight sun in June, polar night in December.
	const SVALBARD_LAT = 78.2232;
	const SVALBARD_LNG = 15.6267;

	it("is light during the midnight sun and re-checks in an hour", () => {
		for (const h of [0, 12]) {
			expect(
				getSchemeState(summer(h), SVALBARD_LAT, SVALBARD_LNG)
			).toEqual({ colorScheme: "light", msUntilNextChange: HOUR_MS });
		}
	});

	it("is dark during the polar night and re-checks in an hour", () => {
		const now = new Date(2026, 11, 21, 12).getTime();

		expect(getSchemeState(now, SVALBARD_LAT, SVALBARD_LNG)).toEqual({
			colorScheme: "dark",
			msUntilNextChange: HOUR_MS,
		});
	});
});

describe("getSchedule", () => {
	it("returns one entry per day starting at the start date", () => {
		const start = new Date(2026, 9, 21, 12);
		const schedule = getSchedule(start, 31, LAT, LNG);

		expect(schedule).toHaveLength(31);
		schedule.forEach(({ date }, i) => {
			expect(date).toEqual(new Date(2026, 9, 21 + i, 12));
		});
	});

	it("computes each entry with getSunTimes for that day", () => {
		const schedule = getSchedule(new Date(2026, 9, 21, 12), 3, LAT, LNG);

		for (const { date, sunrise, sunset } of schedule) {
			expect({ sunrise, sunset }).toEqual(getSunTimes(date, LAT, LNG));
		}
	});

	it("rolls over month and year boundaries", () => {
		const schedule = getSchedule(new Date(2026, 11, 30, 12), 4, LAT, LNG);

		expect(schedule.map(({ date }) => date.toDateString())).toEqual([
			"Wed Dec 30 2026",
			"Thu Dec 31 2026",
			"Fri Jan 01 2027",
			"Sat Jan 02 2027",
		]);
	});

	it("does not mutate the start date", () => {
		const start = new Date(2026, 9, 21, 12);
		getSchedule(start, 5, LAT, LNG);

		expect(start).toEqual(new Date(2026, 9, 21, 12));
	});

	it("returns an empty list for zero days", () => {
		expect(getSchedule(new Date(), 0, LAT, LNG)).toEqual([]);
	});
});
