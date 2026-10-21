import { describe, expect, it } from "vitest";

import {
	DEFAULT_SETTINGS,
	parseCoordinates,
	parseOffsets,
} from "../src/settings";

const parse = (latitude: string, longitude: string) =>
	parseCoordinates({ ...DEFAULT_SETTINGS, latitude, longitude });

describe("parseCoordinates", () => {
	it("parses the defaults", () => {
		expect(parseCoordinates(DEFAULT_SETTINGS)).toEqual({
			latitude: 51.507351,
			longitude: -0.127758,
		});
	});

	it("accepts surrounding whitespace and the range limits", () => {
		expect(parse(" -90 ", "180")).toEqual({ latitude: -90, longitude: 180 });
	});

	it("accepts zero", () => {
		expect(parse("0", "0")).toEqual({ latitude: 0, longitude: 0 });
	});

	it.each([
		["empty latitude", "", "0"],
		["empty longitude", "0", ""],
		["blank", "  ", "0"],
		["a lone minus sign", "0", "-"],
		["trailing garbage", "48.8a", "0"],
		["latitude out of range", "90.1", "0"],
		["longitude out of range", "0", "-180.1"],
		["infinity", "0", "Infinity"],
	])("rejects %s", (_, latitude, longitude) => {
		expect(parse(latitude, longitude)).toBeNull();
	});
});

describe("parseOffsets", () => {
	const offsets = (sunriseOffset: string, sunsetOffset: string) =>
		parseOffsets({ ...DEFAULT_SETTINGS, sunriseOffset, sunsetOffset });

	it("defaults to switching exactly at sunrise and sunset", () => {
		expect(parseOffsets(DEFAULT_SETTINGS)).toEqual({ sunrise: 0, sunset: 0 });
	});

	it("parses minutes after (positive) and before (negative)", () => {
		expect(offsets("30", "-30")).toEqual({ sunrise: 30, sunset: -30 });
	});

	it("accepts surrounding whitespace and the ±180 limits", () => {
		expect(offsets(" -180 ", "180")).toEqual({ sunrise: -180, sunset: 180 });
	});

	it.each([
		["empty", ""],
		["blank", "  "],
		["a lone minus sign", "-"],
		["trailing garbage", "30m"],
		["over 180", "181"],
		["under -180", "-180.5"],
		["infinity", "Infinity"],
	])("treats %s as 0", (_, value) => {
		expect(offsets(value, value)).toEqual({ sunrise: 0, sunset: 0 });
	});
});
