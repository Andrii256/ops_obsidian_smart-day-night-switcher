import type { Offsets } from "./sun-times";

export interface SDNSPluginSettings {
	latitude: string;
	longitude: string;
	/** e.g. "Kyiv, Ukraine"; "" until it is known (looked up by the settings tab). */
	locationName: string;
	/** Minutes, see parseOffsets(). */
	sunriseOffset: string;
	sunsetOffset: string;
	/** Leave the color scheme to Obsidian's own appearance setting. */
	paused: boolean;
}

// London, unless the first run guesses the location (see SDNSPlugin.onload).
// No name, so settings saved before names existed get theirs looked up.
export const DEFAULT_SETTINGS: SDNSPluginSettings = {
	latitude: "51.507351",
	longitude: "-0.127758",
	locationName: "",
	sunriseOffset: "0",
	sunsetOffset: "0",
	paused: false,
};

export const MAX_OFFSET_MINUTES = 180;

/** The command that flips `paused`, so it can have a hotkey. */
export const TOGGLE_PAUSE_COMMAND = {
	id: "toggle-pause",
	name: "Pause or resume automatic switching",
};

export interface Coordinates {
	latitude: number;
	longitude: number;
}

const parseCoordinate = (value: string, limit: number): number | null => {
	if (value.trim() === "") return null;
	const n = +value;
	return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
};

/** Returns null while either value is empty, non-numeric or out of range. */
export function parseCoordinates(
	settings: Pick<SDNSPluginSettings, "latitude" | "longitude">
): Coordinates | null {
	const latitude = parseCoordinate(settings.latitude, 90);
	const longitude = parseCoordinate(settings.longitude, 180);
	return latitude === null || longitude === null
		? null
		: { latitude, longitude };
}

const parseOffset = (value: string): number => {
	const n = +value;
	return Number.isFinite(n) && Math.abs(n) <= MAX_OFFSET_MINUTES ? n : 0;
};

/** Empty, non-numeric or out-of-range offsets count as 0. */
export function parseOffsets(settings: SDNSPluginSettings): Offsets {
	return {
		sunrise: parseOffset(settings.sunriseOffset),
		sunset: parseOffset(settings.sunsetOffset),
	};
}

export type CoordinatesInput =
	| { latitude: string; longitude: string; error?: undefined }
	| { error: string };

/**
 * Splits "lat, lng" as copied from a map (a comma, semicolon or space
 * between them) into the two settings, or explains what is wrong with it.
 */
export function parseCoordinatesInput(value: string): CoordinatesInput {
	const parts = value
		.replace(/°/g, "")
		.split(/[,;\s]+/)
		.filter((part) => part !== "");
	if (parts.length !== 2) {
		return {
			error: "Enter latitude and longitude separated by a comma, e.g. 51.5074, -0.1278",
		};
	}
	const [latitude, longitude] = parts;
	if (parseCoordinate(latitude, 90) === null) {
		return { error: "Latitude must be a number from -90 to 90" };
	}
	if (parseCoordinate(longitude, 180) === null) {
		return { error: "Longitude must be a number from -180 to 180" };
	}
	return { latitude, longitude };
}
