import { requestUrl } from "obsidian";

import { Coordinates, parseCoordinates, SDNSPluginSettings } from "./settings";

/** What a location guess fills in. */
export type LocationSettings = Pick<
	SDNSPluginSettings,
	"latitude" | "longitude" | "locationName"
>;

const TIMEOUT_MS = 10 * 1000;

// Free and keyless. GeoJS has no rate limits; Nominatim allows one request a
// second, asks clients to identify themselves and to credit OpenStreetMap.
const IP_LOCATION_URL = "https://get.geojs.io/v1/ip/geo.json";
const REVERSE_GEOCODING_URL = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT =
	"SmartDayNightSwitcher (Obsidian plugin; https://github.com/Andrii256/ops_obsidian_smart-day-night-switcher)";

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
	typeof value === "object" && value !== null;

/** The response body, or null if the request fails or takes too long. */
async function getJson(
	url: string,
	headers?: Record<string, string>
): Promise<unknown> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), TIMEOUT_MS);
	});
	try {
		return await Promise.race([
			requestUrl({ url, headers }).then((response) => response.json),
			timeout,
		]);
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/** "Kyiv, Ukraine", skipping missing parts; "" if there are none. */
const placeName = (...parts: unknown[]) =>
	parts
		.filter((part): part is string => typeof part === "string")
		.map((part) => part.trim())
		.filter((part) => part !== "")
		.join(", ");

/**
 * The city of the user's IP address, or null if the lookup fails or only
 * knows the country (whose middle can be far away from the user).
 */
export async function locateByIp(): Promise<LocationSettings | null> {
	const data = await getJson(IP_LOCATION_URL);
	if (!isObject(data) || !placeName(data.city)) return null;

	const latitude = String(data.latitude ?? "");
	const longitude = String(data.longitude ?? "");
	if (parseCoordinates({ latitude, longitude }) === null) return null;

	return {
		latitude,
		longitude,
		locationName: placeName(data.city, data.country),
	};
}

/** The town and country at the coordinates, or null if there is none or the lookup fails. */
export async function lookUpPlaceName({
	latitude,
	longitude,
}: Coordinates): Promise<string | null> {
	const query = `?format=jsonv2&zoom=10&accept-language=en&lat=${latitude}&lon=${longitude}`;
	const data = await getJson(REVERSE_GEOCODING_URL + query, {
		"User-Agent": USER_AGENT,
	});
	if (!isObject(data) || !isObject(data.address)) return null;

	const { city, town, village, municipality, county, state, country } =
		data.address;
	const place = [city, town, village, municipality, county, state].find(
		(part) => placeName(part) !== ""
	);
	return placeName(place, country) || null;
}
