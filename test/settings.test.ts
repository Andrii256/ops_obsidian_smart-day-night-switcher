import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, parseCoordinates } from "../src/settings";

const parse = (latitude: string, longitude: string) =>
	parseCoordinates({ latitude, longitude });

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
