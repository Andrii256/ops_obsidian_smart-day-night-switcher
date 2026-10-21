/** e.g. "21 Oct 2026" */
export const formatDate = (date: Date): string =>
	`${date.getDate()} ${date.toLocaleString("en-US", {
		month: "short",
	})} ${date.getFullYear()}`;

/** e.g. "07:05" */
export const formatTime = (date: Date): string =>
	`${String(date.getHours()).padStart(2, "0")}:${String(
		date.getMinutes()
	).padStart(2, "0")}`;
