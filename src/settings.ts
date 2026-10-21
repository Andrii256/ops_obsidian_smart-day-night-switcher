import type { Offsets } from "./sun-times";

export interface SDNSPluginSettings {
	latitude: string;
	longitude: string;
	/** Minutes, see parseOffsets(). */
	sunriseOffset: string;
	sunsetOffset: string;
}

// London
export const DEFAULT_SETTINGS: SDNSPluginSettings = {
	latitude: "51.507351",
	longitude: "-0.127758",
	sunriseOffset: "0",
	sunsetOffset: "0",
};

export const MAX_OFFSET_MINUTES = 180;

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
	settings: SDNSPluginSettings
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
