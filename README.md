# knosys-flight-planner

Offline VFR flight planner plugin for Knosys. Real-world GA pilot focused — global airport database, aircraft profiles, wind triangle navlog, offline map, exports to GPX / FPL (Garmin/ForeFlight) / CSV.

## Install (development)

```bash
npm install
npm run build:db     # one-time: fetch OurAirports CSVs and build airports.sqlite
npm run build        # produces main.js + styles.css
```

Copy the plugin into Knosys:

```bash
mkdir -p ~/.knosys/plugins/knosys-flight-planner
cp manifest.json main.js styles.css ~/.knosys/plugins/knosys-flight-planner/
```

Launch Knosys → Settings → Plugins → enable **Flight Planner**. A `Plane` sidebar item appears at `/flight-planner`. On first open the plugin downloads `airports.sqlite` to OPFS and prompts for a map region to download.

## Architecture

See `/Users/ryan/.claude/plans/i-would-like-to-foamy-quilt.md` for full design notes.

Extensibility seams (stable TypeScript interfaces):

- `AeroDataSource` — swap in live-API sources for airports/navaids later
- `PlanFormatCodec` — register new export formats (KML, SkyVector, etc.)
- `WeatherProvider` — swap `ManualWeatherProvider` for `NoaaWindsAloftProvider`
- `MapLayer` — add airspace, terrain, or sectional overlays
- `AirspaceSource` — openAIP (non-commercial) vs OFMA (commercial-OK)

## Tests

```bash
npm run test         # vitest run (aviation-math, codecs, stores)
```

## Data sources

- Airports / navaids / runways / frequencies — [OurAirports](https://ourairports.com/data/) (public domain)
- Magnetic variation — [NOAA WMM-2025](https://www.ncei.noaa.gov/products/world-magnetic-model) via `geomagnetism` npm
- Map tiles — [Protomaps](https://protomaps.com/) PMTiles (ODbL / public domain basemap)
- Geodesic math — `geodesy` (Chris Veness)

## Export formats (v1)

- **GPX** — SkyVector, handheld GPS, Little Navmap
- **FPL (Garmin)** — Garmin panel avionics
- **FPL (ForeFlight)** — ForeFlight Mobile
- **CSV** — spreadsheet / kneeboard print
