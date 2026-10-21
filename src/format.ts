/** e.g. "21 Oct 2026" */
export const formatDate = (date: Date): string =>
	`${date.getDate()} ${date.toLocaleString("en-US", {
		month: "short",
	})} ${date.getFullYear()}`;

const pad = (n: number) => String(n).padStart(2, "0");

/** e.g. "07:05"; "—" for an Invalid Date (no sunrise/sunset during polar day/night) */
export const formatTime = (date: Date): string =>
	isNaN(date.getTime())
		? "—"
		: `${pad(date.getHours())}:${pad(date.getMinutes())}`;
