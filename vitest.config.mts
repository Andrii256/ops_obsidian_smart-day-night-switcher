import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pin the timezone so local-time assertions (dawn/dusk hours, formatted
// dates) don't depend on the machine running the tests. Set here, before
// workers start, so every test process inherits it.
process.env.TZ = "Europe/London";

export default defineConfig({
	resolve: {
		alias: {
			// The `obsidian` npm package ships type definitions only; at
			// runtime the API is provided by the app, so tests use a stub.
			obsidian: fileURLToPath(
				new URL("./test/__mocks__/obsidian.ts", import.meta.url)
			),
		},
	},
	test: {
		environment: "happy-dom",
		include: ["test/**/*.test.ts"],
		setupFiles: ["test/setup.ts"],
		restoreMocks: true,
	},
});
