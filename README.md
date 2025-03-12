# Smart DayNight Switcher

## What does this plugin do?
This plugin calculates daily sunrise and sunset times for your location and automatically switches your Obsidian theme: light mode when the sun rises ☀️ and dark mode when it sets 🌒.

No more manual theme switching!

## How to use it?
1. Install the plugin and enable it.
2. Go to the plugin settings and enter your approximate coordinates (latitude and longitude).
3. Enjoy!

_Note: Obsidian doesn’t allow plugins to access your geolocation, so you’ll need to input it manually._

----

### How to find your coordinates?
It’s simple!
1. Open [latlong.net](https://www.latlong.net/), [gps-coordinates.net](https://www.gps-coordinates.net/), or any similar tool.
2. Type your city name or pick a spot on the map.
3. Copy the coordinates and paste them into the plugin settings.

### Why are coordinates needed?
Sunrise and sunset times vary by location and date due to latitude, longitude, and the time of year. For example, on March 12, 2025, the sun rises at 07:05 and sets at 16:16 in Madrid, but in Warsaw (same time zone), it’s 05:22 and 17:33. Quite a difference, right? Curious why? Check [YouTube](https://www.youtube.com/results?search_query=Why+Do+Sunrise+and+Sunset+Times+Vary%3F) or this [Wikipedia article](https://en.wikipedia.org/wiki/Analemma?utm_source=chatgpt.com) for more!

_Note: Obsidian doesn’t allow plugins to access your geolocation, that is why you need to input it manually._

### What if I don’t enter coordinates?
The plugin defaults to London’s coordinates, switching themes based on sunrise/sunset there.

### How does it use location data?
The plugin uses your latitude and longitude in a formula to calculate sunrise/sunset times locally on your device. No data is sent anywhere. Still worried? Feel free to use coordinates of a nearby city (within 200 km) instead—though the further away, the less accurate the timing.

## Found a bug or have a feature idea?
Feel free to open an issue in [this repository](https://github.com/Andrii256/ops_obsidian_smart-day-night-switcher/issues). I’ll check it out and do my best to help!
