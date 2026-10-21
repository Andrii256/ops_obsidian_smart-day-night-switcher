# Smart DayNight Switcher

Calculates daily sunrise and sunset times for your location and automatically switches your Obsidian theme: light mode when the sun rises ☀️ and dark mode when it sets 🌒.

No more manual theme switching!

## How to use it?

1. Install the plugin and enable it. It starts with a guess based on your IP address, or your time zone if that fails.
2. For accurate times, go to the plugin settings and enter your approximate coordinates (latitude and longitude).
3. Enjoy!

_Note: Obsidian doesn’t allow plugins to access your geolocation, so the plugin can only guess; for accuracy, enter coordinates manually._

---

### How to find your coordinates?

It’s simple!

1. Open [latlong.net](https://www.latlong.net/), [gps-coordinates.net](https://www.gps-coordinates.net/), or any similar tool.
2. Type your city name or pick a spot on the map.
3. Copy the coordinates and paste them into the plugin settings.

### Why are coordinates needed?

Sunrise and sunset times vary by location and date due to latitude, longitude, and the time of year. For example, on March 12, 2025, the sun rises at 07:05 and sets at 16:16 in Madrid, but in Warsaw (same time zone), it’s 05:22 and 17:33. Quite a difference, right? Curious why? Check [YouTube](https://www.youtube.com/results?search_query=Why+Do+Sunrise+and+Sunset+Times+Vary%3F) or this [Wikipedia article](https://en.wikipedia.org/wiki/Analemma?utm_source=chatgpt.com) for more!

_Note: Obsidian doesn’t allow plugins to access your geolocation, that is why the plugin guesses or you enter it manually._

### What if I don’t enter coordinates?

On install, the plugin uses the city of your IP address. If that fails (e.g. you’re offline), it uses the main city of your time zone (e.g. Kyiv for Europe/Kyiv), or London if your time zone has no city (such as UTC). Either can be far from you, especially behind a VPN, so the settings show which place is in use. The “Guess from IP address” and “Guess from time zone” buttons repeat a guess any time.

### Can it switch a bit before or after sunrise/sunset?

Yes. Set a sunrise and/or sunset offset (up to 3 hours) in the settings, e.g. to turn on dark mode 10 minutes before sunset.

### Can I turn it off for a while?

Yes. Turn on “Pause automatic switching” in the settings, and Obsidian’s own light/dark setting applies until you turn it off. The “Pause or resume automatic switching” command does the same, and the “Set hotkey” button next to the toggle lets you give it a hotkey.

### How does it use location data?

Sunrise/sunset times are calculated locally on your device. Two free services are used, and nothing else is sent anywhere:

- [GeoJS](https://www.geojs.io/) sees your IP address when the plugin guesses your location from it (on install, or when you press the button).
- [OpenStreetMap Nominatim](https://nominatim.org/) gets the coordinates you enter, to show the place’s name.

Still worried? Feel free to use coordinates of a nearby city (within 200 km) instead—though the further away, the less accurate the timing.

## Found a bug or have a feature idea?

Feel free to open an issue in [this repository](https://github.com/Andrii256/ops_obsidian_smart-day-night-switcher/issues). I’ll check it out and do my best to help!

