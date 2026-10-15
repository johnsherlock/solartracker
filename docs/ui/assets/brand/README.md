# Brand Assets

Solar Tracker logo files: a generation curve with a glowing sun at its peak,
above a "solar" (white) + "tracker" (yellow) wordmark.

| File | Size | Use |
|---|---|---|
| `solartracker-transparent-cropped.png` | 1591×817, transparent | Dark backgrounds only — the white "solar" disappears on light ones |
| `solartracker-dark-cropped.png` | 980×525, dark background | Social cards, README headers, anywhere the background isn't controlled |
| `solartracker-dark-120x120.png` | 120×120, dark background | Square slots: Google OAuth consent screen logo, app/store icons |

Notes:

- The Google OAuth logo needs the app's domain verified in Google Search
  Console and triggers Google brand verification (see `docs/deployment.md`).
- The in-app favicon is still `apps/web/app/icon.svg` (the simple sun mark).
  At 16–32px the curve-and-sun logo would be hard to read, so swapping it in
  would need a simplified small-size variant.
