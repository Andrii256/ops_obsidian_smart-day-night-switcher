import { describe, expect, it } from "vitest";

import { formatDate, formatTime } from "../src/format";

describe("formatDate", () => {
	it("formats as day, short month and year", () => {
		expect(formatDate(new Date(2026, 9, 21))).toBe("21 Oct 2026");
	});

	it("does not pad single-digit days", () => {
		expect(formatDate(new Date(2026, 0, 5))).toBe("5 Jan 2026");
	});
});

describe("formatTime", () => {
	it("zero-pads hours and minutes", () => {
		expect(formatTime(new Date(2026, 0, 1, 7, 5))).toBe("07:05");
	});

	it("uses 24-hour time", () => {
		expect(formatTime(new Date(2026, 0, 1, 21, 18))).toBe("21:18");
	});

	it("formats midnight as 00:00", () => {
		expect(formatTime(new Date(2026, 0, 1, 0, 0))).toBe("00:00");
	});

	it("drops seconds instead of rounding", () => {
		expect(formatTime(new Date(2026, 0, 1, 3, 56, 59))).toBe("03:56");
	});

	it("shows a dash for an Invalid Date", () => {
		expect(formatTime(new Date(NaN))).toBe("—");
	});
});
