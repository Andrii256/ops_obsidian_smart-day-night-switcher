// Import the SunCalc library to calculate sun position and light phases
import * as SunCalc from "suncalc"; // Documentation: https://www.npmjs.com/package/suncalc

import { ColorScheme } from "./color-scheme";

const MINUTE_MS = 60 * 1000;
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

/** Minutes to shift each switch by; negative switches before the sun event. */
export interface Offsets {
	sunrise: number;
	sunset: number;
}

export const NO_OFFSETS: Offsets = { sunrise: 0, sunset: 0 };

const shift = (date: Date, minutes: number) =>
	new Date(date.getTime() + minutes * MINUTE_MS);

/** Sunrise and sunset shifted by the offsets: when light and dark mode start. */
export function getSwitchTimes(
	date: Date,
	latitude: number,
	longitude: number,
	offsets: Offsets = NO_OFFSETS
): SunTimes {
	const { sunrise, sunset } = getSunTimes(date, latitude, longitude);
	return {
		sunrise: shift(sunrise, offsets.sunrise),
		sunset: shift(sunset, offsets.sunset),
	};
}

export interface SchemeState {
	colorScheme: ColorScheme;
	/** Milliseconds until the next (offset) sunrise or sunset (at most an hour during polar day/night). */
	msUntilNextChange: number;
}

interface SunEvent {
	time: number;
	colorScheme: ColorScheme;
}

/** Light from (offset) sunrise to (offset) sunset, dark otherwise. */
export function getSchemeState(
	now: number,
	latitude: number,
	longitude: number,
	offsets: Offsets = NO_OFFSETS
): SchemeState {
	// SunCalc picks the solar day nearest to the given time, so these days
	// always bracket `now` when the sun rises and sets. Two days each way
	// rather than one, because offsets can cancel out whole days or nights
	// (below); only the outermost events depend on days left out.
	const raw: SunEvent[] = [];
	for (const day of [-2, -1, 0, 1, 2]) {
		const { sunrise, sunset } = getSwitchTimes(
			new Date(now + day * DAY_MS),
			latitude,
			longitude,
			offsets
		);
		raw.push(
			{ time: sunrise.getTime(), colorScheme: "light" },
			{ time: sunset.getTime(), colorScheme: "dark" }
		);
	}

	const known: SunEvent[] = [];
	for (const event of raw.filter((e) => !isNaN(e.time))) {
		// Offsets can move a switch to or past the following one, e.g. a
		// sunrise offset longer than a short polar winter day. That period
		// (day or night) vanishes, so both switches cancel out.
		const prev = known[known.length - 1];
		if (
			prev &&
			prev.colorScheme !== event.colorScheme &&
			prev.time >= event.time
		) {
			known.pop();
		} else {
			known.push(event);
		}
	}
	known.sort((a, b) => a.time - b.time);

	const last = known.filter((e) => e.time <= now).pop();
	const next = known.find(
		(e) => e.time > now && e.colorScheme !== last?.colorScheme
	);
	const firstUpcoming = known.find((e) => e.time > now);

	if (last && next) {
		// Re-check within a day: switches further out are near the edge of
		// the window, where a cancellation may be missing.
		return {
			colorScheme: last.colorScheme,
			msUntilNextChange: Math.min(DAY_MS, next.time - now),
		};
	}

	const recheck = Math.min(
		POLAR_RECHECK_MS,
		firstUpcoming ? firstUpcoming.time - now : Infinity
	);

	const cancelled = known.length < raw.filter((e) => !isNaN(e.time)).length;
	if (cancelled) {
		// Days or nights vanished, so the scheme holds across the gap: it's
		// that of the last switch, or the opposite of the first one.
		const first = known[0] ?? raw.find((e) => !isNaN(e.time));
		return {
			colorScheme:
				last?.colorScheme ??
				(first?.colorScheme === "light" ? "dark" : "light"),
			msUntilNextChange: recheck,
		};
	}

	// Polar day/night: no sunrise or sunset nearby. Decide by the sun's
	// altitude and re-check later.
	const { altitude } = SunCalc.getPosition(new Date(now), latitude, longitude);
	return {
		colorScheme: altitude > HORIZON_RAD ? "light" : "dark",
		msUntilNextChange: recheck,
	};
}

export interface ScheduleEntry extends SunTimes {
	date: Date;
}

/** Switch times (sunrise/sunset with offsets applied) for each day. */
export function getSchedule(
	startDate: Date,
	days: number,
	latitude: number,
	longitude: number,
	offsets: Offsets = NO_OFFSETS
): ScheduleEntry[] {
	const entries: ScheduleEntry[] = [];
	for (let i = 0; i < days; i++) {
		const date = new Date(startDate);
		date.setDate(startDate.getDate() + i);
		entries.push({
			date,
			...getSwitchTimes(date, latitude, longitude, offsets),
		});
	}
	return entries;
}
