export interface SDNSPluginSettings {
	latitude: string;
	longitude: string;
}

// London
export const DEFAULT_SETTINGS: SDNSPluginSettings = {
	latitude: "51.507351",
	longitude: "-0.127758",
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
	settings: SDNSPluginSettings
): Coordinates | null {
	const latitude = parseCoordinate(settings.latitude, 90);
	const longitude = parseCoordinate(settings.longitude, 180);
	return latitude === null || longitude === null
		? null
		: { latitude, longitude };
}
