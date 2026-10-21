import { describe, expect, it } from "vitest";

import { guessFromTimeZone } from "../src/time-zone";

describe("guessFromTimeZone", () => {
	it("uses the system time zone by default", () => {
		// Pinned to Europe/London in vitest.config.mts.
		expect(guessFromTimeZone()).toEqual({
			timeZone: "Europe/London",
			city: "London",
			latitude: "51.5083",
			longitude: "-0.1253",
		});
	});

	it("gives the city's coordinates and a readable name", () => {
		expect(guessFromTimeZone("America/New_York")).toEqual({
			timeZone: "America/New_York",
			city: "New York",
			latitude: "40.7142",
			longitude: "-74.0064",
		});
	});

	it("knows legacy names some runtimes still report", () => {
		const kyiv = guessFromTimeZone("Europe/Kyiv");

		expect(guessFromTimeZone("Europe/Kiev")).toMatchObject({
			latitude: kyiv?.latitude,
			longitude: kyiv?.longitude,
		});
		expect(guessFromTimeZone("Asia/Calcutta")).toMatchObject({
			latitude: guessFromTimeZone("Asia/Kolkata")?.latitude,
		});
	});

	it("covers every time zone this runtime supports, apart from UTC-like ones", () => {
		// Not in the ES6 lib this project compiles against.
		const { supportedValuesOf } = Intl as unknown as {
			supportedValuesOf(key: "timeZone"): string[];
		};
		const missing = supportedValuesOf("timeZone").filter(
			(zone) => guessFromTimeZone(zone) === null
		);

		expect(missing.filter((zone) => !/^(Etc\/|UTC$|GMT$)/.test(zone))).toEqual([]);
	});

	it.each([["UTC"], ["Etc/UTC"], ["Etc/GMT+3"], ["Not/AZone"], ["constructor"], [undefined]])(
		"returns null for %s",
		(zone) => {
			expect(guessFromTimeZone(zone ?? "")).toBeNull();
		}
	);
});
