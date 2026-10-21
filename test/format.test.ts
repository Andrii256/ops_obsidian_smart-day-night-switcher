import { describe, expect, it } from "vitest";

import { formatDate, formatDay, formatOffset, formatTime } from "../src/format";

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

describe("formatOffset", () => {
	it.each([
		[0, "at sunset"],
		[15, "15 min after sunset"],
		[-15, "15 min before sunset"],
		[60, "1 h after sunset"],
		[-90, "1 h 30 min before sunset"],
		[180, "3 h after sunset"],
	])("describes %i minutes", (minutes, expected) => {
		expect(formatOffset(minutes, "sunset")).toBe(expected);
	});
});

describe("formatDay", () => {
	const now = new Date(2026, 9, 21, 23, 30);

	it("says today and tomorrow", () => {
		expect(formatDay(new Date(2026, 9, 21, 0, 5), now)).toBe("today");
		expect(formatDay(new Date(2026, 9, 22, 0, 5), now)).toBe("tomorrow");
	});

	it("gives the date further out", () => {
		expect(formatDay(new Date(2026, 9, 23, 8), now)).toBe("on 23 Oct 2026");
	});

	it("counts calendar days across a DST change", () => {
		// Clocks go back on 25 Oct 2026 in London.
		const before = new Date(2026, 9, 24, 23, 30);
		expect(formatDay(new Date(2026, 9, 25, 23, 30), before)).toBe("tomorrow");
	});
});
