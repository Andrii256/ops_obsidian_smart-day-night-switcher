// Import the SunCalc library to calculate sun position and light phases
import * as SunCalc from "suncalc"; // Documentation: https://www.npmjs.com/package/suncalc

import { ColorScheme } from "./color-scheme";

const DAY_MS = 24 * 60 * 60 * 1000;
const POLAR_RECHECK_MS = 60 * 60 * 1000;
/** Sun altitude at SunCalc's sunrise/sunset (top edge on the horizon, with refraction). */
const HORIZON_RAD = (-0.833 * Math.PI) / 180;

export interface SunTimes {
	sunrise: Date;
	sunset: Date;
}

/**
 * Invalid Dates when the sun doesn't rise or set that day (polar day/night).
 */
export function getSunTimes(
	date: Date,
	latitude: number,
	longitude: number
): SunTimes {
	const { sunrise, sunset } = SunCalc.getTimes(date, latitude, longitude);
	return { sunrise, sunset };
}

export interface SchemeState {
	colorScheme: ColorScheme;
	/** Milliseconds until the next sunrise or sunset (at most an hour during polar day/night). */
	msUntilNextChange: number;
}

interface SunEvent {
	time: number;
	colorScheme: ColorScheme;
}

/** Light from sunrise to sunset, dark otherwise. */
export function getSchemeState(
	now: number,
	latitude: number,
	longitude: number
): SchemeState {
	// SunCalc picks the solar day nearest to the given time, so yesterday,
	// today and tomorrow always bracket `now` when the sun rises and sets.
	const events: SunEvent[] = [];
	for (const offset of [-DAY_MS, 0, DAY_MS]) {
		const { sunrise, sunset } = getSunTimes(
			new Date(now + offset),
			latitude,
			longitude
		);
		events.push(
			{ time: sunrise.getTime(), colorScheme: "light" },
			{ time: sunset.getTime(), colorScheme: "dark" }
		);
	}
	const known = events
		.filter((e) => !isNaN(e.time))
		.sort((a, b) => a.time - b.time);

	const last = known.filter((e) => e.time <= now).pop();
	const next = known.find(
		(e) => e.time > now && e.colorScheme !== last?.colorScheme
	);

	if (last && next) {
		return { colorScheme: last.colorScheme, msUntilNextChange: next.time - now };
	}

	// Polar day/night: no sunrise or sunset nearby. Decide by the sun's
	// altitude and re-check later.
	const { altitude } = SunCalc.getPosition(new Date(now), latitude, longitude);
	const firstUpcoming = known.find((e) => e.time > now);
	return {
		colorScheme: altitude > HORIZON_RAD ? "light" : "dark",
		msUntilNextChange: Math.min(
			POLAR_RECHECK_MS,
			firstUpcoming ? firstUpcoming.time - now : Infinity
		),
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
