import { Workspace } from "obsidian";

export type ColorScheme = "dark" | "light";

export const getColorScheme = (): ColorScheme =>
	document.body.classList.contains("theme-dark") ? "dark" : "light";

/**
 * Switches the scheme for the current session only, without touching
 * Obsidian's persisted appearance setting.
 */
export function setColorScheme(
	workspace: Workspace,
	targetColorScheme: ColorScheme
) {
	switch (targetColorScheme) {
		case "dark":
			document.body.classList.remove("theme-light");
			document.body.classList.add("theme-dark");
			break;
		case "light":
			document.body.classList.remove("theme-dark");
			document.body.classList.add("theme-light");
			break;
	}
	workspace.trigger("css-change");
}
