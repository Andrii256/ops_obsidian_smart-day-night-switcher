import type { Workspace } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getColorScheme, setColorScheme } from "../src/color-scheme";

const createWorkspace = () =>
	({ trigger: vi.fn() } as unknown as Workspace & {
		trigger: ReturnType<typeof vi.fn>;
	});

beforeEach(() => {
	document.body.className = "";
});

describe("getColorScheme", () => {
	it("reports dark when the body has theme-dark", () => {
		document.body.classList.add("theme-dark");
		expect(getColorScheme()).toBe("dark");
	});

	it("reports light when the body has theme-light", () => {
		document.body.classList.add("theme-light");
		expect(getColorScheme()).toBe("light");
	});

	it("falls back to light when no theme class is set", () => {
		expect(getColorScheme()).toBe("light");
	});
});

describe("setColorScheme", () => {
	it("switches from light to dark", () => {
		document.body.classList.add("theme-light");
		setColorScheme(createWorkspace(), "dark");

		expect(document.body.classList.contains("theme-dark")).toBe(true);
		expect(document.body.classList.contains("theme-light")).toBe(false);
	});

	it("switches from dark to light", () => {
		document.body.classList.add("theme-dark");
		setColorScheme(createWorkspace(), "light");

		expect(document.body.classList.contains("theme-light")).toBe(true);
		expect(document.body.classList.contains("theme-dark")).toBe(false);
	});

	it("leaves unrelated body classes alone", () => {
		document.body.classList.add("theme-light", "is-mobile");
		setColorScheme(createWorkspace(), "dark");

		expect(document.body.classList.contains("is-mobile")).toBe(true);
	});

	it("triggers css-change so Obsidian re-renders", () => {
		const workspace = createWorkspace();
		setColorScheme(workspace, "dark");

		expect(workspace.trigger).toHaveBeenCalledOnce();
		expect(workspace.trigger).toHaveBeenCalledWith("css-change");
	});
});
