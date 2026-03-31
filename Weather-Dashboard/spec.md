# Weather Dashboard — Product Specification

## Overview

A clean, single-page weather dashboard web application that allows the user to search for any city and view current conditions alongside a multi-day forecast. The app is powered by the [OpenWeatherMap API](https://openweathermap.org/api) and runs entirely in the browser with no backend required.

---

## API Configuration

- **Provider:** OpenWeatherMap
- **Base URL:** `https://api.openweathermap.org/data/2.5/`
- **API Key:** Store in a `config.js` file as a constant (do not hard-code in HTML)
- **Key endpoints to use:**
  - `weather` — current weather by city name
  - `forecast` — 5-day / 3-hour forecast
  - `onecall` — (optional) hourly breakdown and alerts

> ⚠️ **Security note:** Never commit your API key to a public repository. Use a `.env` file or a `config.js` that is listed in `.gitignore`.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 (Flexbox / Grid), or Tailwind CSS |
| Logic | Vanilla JavaScript (ES6+) |
| Hosting | Any static host (GitHub Pages, Netlify, Vercel) |

No build step or framework is required, keeping the project simple and portable.

---

## Features

### 1. City Search
- A prominent search bar at the top of the page
- User types a city name and presses Enter or clicks a Search button
- The app fetches current weather and forecast data for that city
- Displays a user-friendly error message if the city is not found (API 404)

### 2. Current Conditions Panel
Displays the following for the searched city:
- City name and country code
- Local date and time (derived from `timezone` offset in API response)
- Weather condition icon (from `https://openweathermap.org/img/wn/`)
- Weather description (e.g., "Partly Cloudy")
- Temperature (°F / °C toggle)
- Feels-like temperature
- Humidity (%)
- Wind speed and direction
- Visibility
- Sunrise and sunset times

### 3. 5-Day Forecast Strip
- A horizontal row of 5 cards, one per day
- Each card shows: day of week, high/low temperatures, and a condition icon
- Data sourced from the `forecast` endpoint, aggregated by day

### 4. Unit Toggle
- A toggle switch (°F ↔ °C) that converts all displayed temperatures without re-fetching
- Default unit: °F

### 5. Recent Searches
- A small list of the last 5 searched cities stored in `localStorage`
- Clicking a recent city re-loads its weather instantly

### 6. Dynamic Background / Theme
- The background color or imagery changes based on weather condition and time of day
  - e.g., sunny daytime → warm gradient; rainy → cool grey; night → dark navy

---

## Page Layout

```
┌─────────────────────────────────────────────┐
│  🌤  Weather Dashboard          [°F] [°C]   │
├─────────────────────────────────────────────┤
│  [ Search for a city...          ] [Search] │
│  Recent: Austin | Denver | Miami            │
├──────────────────┬──────────────────────────┤
│  CURRENT         │  DETAILS                 │
│  New York, US    │  Humidity: 62%           │
│  68°F            │  Wind: 12 mph NW         │
│  ☁️ Partly Cloudy │  Visibility: 10 mi       │
│  Feels like 65°F │  Sunrise: 6:42 AM        │
│                  │  Sunset:  7:18 PM        │
├──────────────────┴──────────────────────────┤
│         5-DAY FORECAST                      │
│  [Thu] [Fri] [Sat] [Sun] [Mon]              │
│  ☀️72° 🌧65° ⛅68° ☀️74° ☀️76°             │
└─────────────────────────────────────────────┘
```

---

## File Structure

```
weather-dashboard/
├── index.html          # App shell and layout
├── style.css           # All visual styling
├── app.js              # Main application logic
├── config.js           # API key constant (gitignored)
├── .gitignore          # Excludes config.js
└── README.md           # Setup instructions
```

---

## config.js (template)

```js
// config.js — DO NOT commit to version control
const API_KEY = "YOUR_API_KEY_HERE";
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| City not found (404) | Show inline message: "City not found. Please try again." |
| Network error | Show: "Unable to reach weather service. Check your connection." |
| Empty search | Shake the search bar, do not submit |
| API rate limit | Show: "Too many requests. Please wait a moment." |

---

## Future Enhancements (v2)

- **Geolocation:** Auto-detect user's current city on first load
- **Weather alerts:** Display any active NWS/API alerts for the searched city
- **Hourly chart:** A line chart showing temperature trend across the next 24 hours
- **Map view:** Embed a weather radar or map tile layer
- **PWA support:** Add a service worker so the app works offline with cached data

---

## Development Checklist

- [ ] Set up project folder and file structure
- [ ] Add API key to `config.js` and add to `.gitignore`
- [ ] Build HTML layout skeleton
- [ ] Style with CSS (mobile-first, responsive)
- [ ] Implement search and current weather fetch
- [ ] Implement 5-day forecast fetch and display
- [ ] Add °F/°C toggle logic
- [ ] Add recent searches with `localStorage`
- [ ] Add dynamic background theming
- [ ] Test error states (bad city name, no network)
- [ ] Deploy to static hosting
