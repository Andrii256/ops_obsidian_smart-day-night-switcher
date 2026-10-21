import { TIME_ZONE_COORDINATES } from "./time-zones";

export interface TimeZoneGuess {
	timeZone: string;
	/** e.g. "New York" for America/New_York */
	city: string;
	latitude: string;
	longitude: string;
}

export function getTimeZone(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return undefined;
	}
}

/**
 * Coordinates of the time zone's principal city, which can be hundreds of
 * kilometres from the user; null for unknown zones and UTC.
 */
export function guessFromTimeZone(
	timeZone = getTimeZone()
): TimeZoneGuess | null {
	if (
		timeZone === undefined ||
		!Object.prototype.hasOwnProperty.call(TIME_ZONE_COORDINATES, timeZone)
	) {
		return null;
	}
	const [latitude, longitude] = TIME_ZONE_COORDINATES[timeZone];
	return {
		timeZone,
		city: (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " "),
		latitude: String(latitude),
		longitude: String(longitude),
	};
}
