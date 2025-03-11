import { Plugin } from "obsidian";
const SunCalc = require("suncalc");

const tempCoords = {
	latitude: 49.84079,
	longitude: 18.29088,
};

export default class EasyThemeSwitcherPlugin extends Plugin {
	private timeout: ReturnType<typeof setTimeout> | null;

	async onload() {
		this.checkAndSwitchTheme(tempCoords.latitude, tempCoords.longitude);
	}

	onunload() {
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
	}

	checkAndSwitchTheme(latt: number, long: number) {
		const now = Date.now();
		const { dawn, dusk } = SunCalc.getTimes(new Date(), latt, long);
		const tomorrowDawn = SunCalc.getTimes(
			new Date(now + 24 * 60 * 60 * 1000),
			latt,
			long
		).dawn;

		const times = {
			dawn: dawn.getTime(),
			dusk: dusk.getTime(),
			tomorrowDawn: tomorrowDawn.getTime(),
		};

		let checkDelay: number;

		if (now < dawn) {
			this.setMode("dark");
			checkDelay = times.dawn - now;
		} else if (now >= dawn && now < dusk) {
			this.setMode("light");
			checkDelay = times.dusk - now;
		} else {
			this.setMode("dark");
			checkDelay = times.tomorrowDawn - now;
		}

		this.timeout = setTimeout(
			this.checkAndSwitchTheme.bind(this, latt, long),
			checkDelay
		);
	}

	setMode(targetMode: "dark" | "light") {
		switch (targetMode) {
			case "dark":
				document.body.classList.remove("theme-light");
				document.body.classList.add("theme-dark");
				break;
			case "light":
				document.body.classList.remove("theme-dark");
				document.body.classList.add("theme-light");
				break;
		}
		this.app.workspace.trigger("css-change");
	}
}
