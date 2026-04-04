# Zenith

Zenith is an interactive solar and lunar calculator with a live Mapbox map. Click anywhere on the map (or search for a location) to instantly see sun and moon data for that point at any date and time.

## Features

- **Interactive map** — Displays the sun and moon arc trajectories and current position overlaid on a Mapbox map. Supports dark and light map styles.
- **Solar info** — Sunrise, sunset, solar noon, golden hour (AM & PM), day length, and current azimuth/altitude.
- **Lunar info** — Moon phase (with icon), moonrise, moonset, illumination percentage, and current azimuth/altitude.
- **Advanced panel** — Elevation of the selected point, civil twilight (dawn/dusk), nautical twilight, and astronomical twilight times.
- **Date & time controls** — Scrub through any date and time to see how solar/lunar data changes throughout the year.
- **Location search** — Geocoder search bar powered by Mapbox to jump to any place by name.
- **Geolocation** — Automatically requests the browser's location on load and centers the map there.
- **Timezone-aware** — All times are displayed in the local timezone of the selected coordinates.

## Tech Stack

- [React 19](https://react.dev/) + [Vite](https://vite.dev/)
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) for the interactive map and geocoder
- [suncalc](https://github.com/mourner/suncalc) for sun and moon calculations
- [Luxon](https://moment.github.io/luxon/) for timezone-aware date/time handling
- [Tailwind CSS](https://tailwindcss.com/) for styling

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deployment (GitHub Pages)

- Ensure the `homepage` field in `package.json` is set to `https://zenith.robertvelardejr.com`.
- Add a `CNAME` file to `public/` containing `zenith.robertvelardejr.com` (this repo now includes one).
- Install the deployment helper: `npm install --save-dev gh-pages`.
- Publish the production build to GitHub Pages with:

```bash
npm run deploy
```

- In your GitHub repository settings -> **Pages**, confirm the source branch is `gh-pages` (root). The `CNAME` file and the Pages settings should point the custom domain to `zenith.robertvelardejr.com`.
- Ensure your DNS provider (NameCheap) has a CNAME record for `zenith` pointing to `robertvelarde.github.io`.

Optionally, use a GitHub Actions workflow to build and push to `gh-pages` automatically on push to `main`.
