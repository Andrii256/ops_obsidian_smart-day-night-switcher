import { requestUrl, RequestUrlResponsePromise } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { locateByIp, lookUpPlaceName } from "../src/locate";

vi.mock("obsidian", async (importOriginal) => ({
	...(await importOriginal<typeof import("obsidian")>()),
	requestUrl: vi.fn(),
}));

const respond = (json: unknown) =>
	vi
		.mocked(requestUrl)
		.mockReturnValue(
			Promise.resolve({ json }) as unknown as RequestUrlResponsePromise
		);

const requestedUrl = () => {
	const [request] = vi.mocked(requestUrl).mock.calls[0];
	return typeof request === "string" ? request : request.url;
};

beforeEach(() => {
	vi.mocked(requestUrl).mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("locateByIp", () => {
	// Abridged response of https://get.geojs.io/v1/ip/geo.json
	const GEOJS = {
		city: "Ostrava",
		country: "Czechia",
		latitude: "49.7977",
		longitude: "18.2311",
		timezone: "Europe/Prague",
	};

	it("gives the city's coordinates and name", async () => {
		respond(GEOJS);

		expect(await locateByIp()).toEqual({
			latitude: "49.7977",
			longitude: "18.2311",
			locationName: "Ostrava, Czechia",
		});
		expect(requestedUrl()).toBe("https://get.geojs.io/v1/ip/geo.json");
	});

	it("fails when it only knows the country", async () => {
		respond({ ...GEOJS, city: undefined });

		expect(await locateByIp()).toBeNull();
	});

	it("fails on missing or invalid coordinates", async () => {
		respond({ ...GEOJS, latitude: "nil" });
		expect(await locateByIp()).toBeNull();

		respond({ ...GEOJS, longitude: undefined });
		expect(await locateByIp()).toBeNull();
	});

	it("fails when the request fails", async () => {
		vi.mocked(requestUrl).mockReturnValue(
			Promise.reject(new Error("offline")) as unknown as RequestUrlResponsePromise
		);

		expect(await locateByIp()).toBeNull();
	});

	it("gives up after 10 seconds", async () => {
		vi.useFakeTimers();
		vi.mocked(requestUrl).mockReturnValue(
			new Promise(() => undefined) as unknown as RequestUrlResponsePromise
		);
		const result = locateByIp();

		await vi.advanceTimersByTimeAsync(10 * 1000);
		expect(await result).toBeNull();
	});
});

describe("lookUpPlaceName", () => {
	const KYIV = { latitude: 50.45, longitude: 30.52 };

	it("names the city and country at the coordinates", async () => {
		respond({ address: { city: "Kyiv", state: "Kyiv", country: "Ukraine" } });

		expect(await lookUpPlaceName(KYIV)).toBe("Kyiv, Ukraine");

		const url = new URL(requestedUrl());
		expect(url.origin + url.pathname).toBe(
			"https://nominatim.openstreetmap.org/reverse"
		);
		expect(url.searchParams.get("lat")).toBe("50.45");
		expect(url.searchParams.get("lon")).toBe("30.52");
	});

	it("identifies the plugin, as Nominatim requires", async () => {
		respond({ address: { city: "Kyiv" } });
		await lookUpPlaceName(KYIV);

		const [request] = vi.mocked(requestUrl).mock.calls[0];
		expect(typeof request !== "string" && request.headers?.["User-Agent"]).toContain(
			"SmartDayNightSwitcher"
		);
	});

	it("falls back to a town, village or larger area", async () => {
		respond({ address: { town: "Bucha", county: "Bucha Raion", country: "Ukraine" } });
		expect(await lookUpPlaceName(KYIV)).toBe("Bucha, Ukraine");

		respond({ address: { state: "Svalbard", country: "Norway" } });
		expect(await lookUpPlaceName(KYIV)).toBe("Svalbard, Norway");
	});

	it("fails where there is no place, e.g. at sea", async () => {
		respond({ error: "Unable to geocode" });

		expect(await lookUpPlaceName({ latitude: 0, longitude: -30 })).toBeNull();
	});

	it("fails when the request fails", async () => {
		vi.mocked(requestUrl).mockReturnValue(
			Promise.reject(new Error("429")) as unknown as RequestUrlResponsePromise
		);

		expect(await lookUpPlaceName(KYIV)).toBeNull();
	});
});
