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

/** e.g. "at sunrise", "15 min before sunset", "1 h 30 min after sunrise" */
export function formatOffset(minutes: number, event: string): string {
	if (minutes === 0) return `at ${event}`;
	const abs = Math.abs(minutes);
	const hours = Math.floor(abs / 60);
	const duration = [hours && `${hours} h`, abs % 60 && `${abs % 60} min`]
		.filter(Boolean)
		.join(" ");
	return `${duration} ${minutes > 0 ? "after" : "before"} ${event}`;
}

const startOfDay = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "today", "tomorrow" or e.g. "on 23 Oct 2026", relative to `now` */
export function formatDay(date: Date, now: Date): string {
	const days = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
	if (days === 0) return "today";
	if (days === 1) return "tomorrow";
	return `on ${formatDate(date)}`;
}
