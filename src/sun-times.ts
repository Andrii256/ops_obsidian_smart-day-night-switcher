// Import the SunCalc library to calculate sun position and light phases
import * as SunCalc from "suncalc"; // Documentation: https://www.npmjs.com/package/suncalc

import { ColorScheme } from "./color-scheme";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SunTimes {
	dawn: Date;
	dusk: Date;
}

/**
 * "Dawn" is SunCalc's `dawn`, "dusk" is SunCalc's `sunsetStart`.
 */
export function getSunTimes(
	date: Date,
	latitude: number,
	longitude: number
): SunTimes {
	const { dawn, sunsetStart: dusk } = SunCalc.getTimes(
		date,
		latitude,
		longitude
	);
	return { dawn, dusk };
}

export interface SchemeState {
	colorScheme: ColorScheme;
	/** Milliseconds until the next transition (today's dawn, today's dusk or tomorrow's dawn). */
	msUntilNextChange: number;
}

export function getSchemeState(
	now: number,
	latitude: number,
	longitude: number
): SchemeState {
	const { dawn, dusk } = getSunTimes(new Date(now), latitude, longitude);
	const tomorrowDawn = getSunTimes(
		new Date(now + DAY_MS),
		latitude,
		longitude
	).dawn;

	if (now < dawn.getTime()) {
		return { colorScheme: "dark", msUntilNextChange: dawn.getTime() - now };
	}
	if (now < dusk.getTime()) {
		return { colorScheme: "light", msUntilNextChange: dusk.getTime() - now };
	}
	return {
		colorScheme: "dark",
		msUntilNextChange: tomorrowDawn.getTime() - now,
	};
}

export interface ScheduleEntry extends SunTimes {
	date: Date;
}

export function getSchedule(
	startDate: Date,
	days: number,
	latitude: number,
	longitude: number
): ScheduleEntry[] {
	const entries: ScheduleEntry[] = [];
	for (let i = 0; i < days; i++) {
		const date = new Date(startDate);
		date.setDate(startDate.getDate() + i);
		entries.push({ date, ...getSunTimes(date, latitude, longitude) });
	}
	return entries;
}
