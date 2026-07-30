# ha-ev-map

A HACS integration for Home Assistant that shows EV charging stations near a configured location entity on an interactive MapLibre map. The TomTom API key stays server-side inside HA — it never reaches the browser.

## Requirements

- Home Assistant 2023.6+
- [HACS](https://hacs.xyz) installed
- A TomTom API key ([get one free](https://developer.tomtom.com/))
- A `person.*` or `device_tracker.*` entity in HA with `latitude` and `longitude` attributes

## Installation

### Via HACS (recommended)

1. In HACS, go to **Integrations** → menu (⋮) → **Custom repositories**.
2. Add `https://github.com/thititongumpun/ha-ev-map` with category **Integration**.
3. Search for **EV Map** and install it.
4. Restart Home Assistant.

### Manual

Copy `custom_components/ha_ev_map/` into your HA `config/custom_components/` directory and restart.

## Setup

1. Go to **Settings → Devices & Services → Add Integration** and search for **EV Map**.
2. Fill in the config form:

   | Field | Required | Description |
   |---|---|---|
   | TomTom API Key | Yes | Server-side key for nearbySearch, traffic, and routing APIs |
   | Location Entity | Yes | e.g. `person.thiti` — must have lat/lon attributes |
   | Search Radius (m) | No | Default `5000` |

   The flow validates that the entity exists and has coordinates, then makes a live TomTom test call before saving.

3. Add the card JS as a Lovelace resource — **Settings → Dashboards → Resources → Add**:

   ```
   URL:  /ha_ev_map/ev-map-card.js?v=0.3.8
   Type: JavaScript Module
   ```

## Usage

Add the card to a Home Assistant Sections dashboard:

```yaml
type: custom:ev-map-card
aspect_ratio: "16:9"
grid_options:
  columns: full
  rows: auto
```

For masonry or other non-Sections dashboards:

```yaml
type: custom:ev-map-card
aspect_ratio: "16:9"
```

Use `height` instead of `aspect_ratio` for a fixed-height map:

```yaml
type: custom:ev-map-card
height: 400
```

Home Assistant and browsers cache Lovelace module resources by URL. After updating the card JavaScript, force a fresh copy by bumping the resource URL version query to the installed release version and hard-refreshing the browser:

```
/ha_ev_map/ev-map-card.js?v=0.3.8
```

## Features

### Map

- Centers on the configured location entity and places a blue marker there. If the entity exposes `course`, `heading`, `bearing`, or `direction`, the marker shows a directional heading arrow.
- Fetches EV stations within the configured radius from TomTom and renders them as compact brand badges. Local logo files in `www/brand/` are matched by brand aliases, with initials as a fallback.
- Auto-refreshes every 30 seconds.
- Fullscreen button (top-right). Press `Esc` or click again to exit.
- Clicking a station marker (or a station in the list) pings it with a short outline pulse alongside its popup.

### Map styles

A style picker button (top-right, below fullscreen) lets you switch between three base maps:

| Style | Description |
|---|---|
| Dark | CARTO dark tiles (default) |
| OpenStreetMap | OpenFreeMap bright style |
| Liberty 3D | OpenFreeMap liberty style with 45° pitch |

### 3D / pitch toggle

A pitch toggle button lets you tilt the map into a 3D perspective view and back to flat independently of the selected map style.

### Traffic overlay

A traffic button overlays live TomTom traffic flow tiles on the map. The overlay persists when switching map styles.

### Fly to location

A locate button flies the map camera back to your configured location entity instantly.

### Station list

A hamburger button (bottom-left) opens a collapsible panel listing all nearby stations with name, distance, and connectors. Click any entry to fly to that station on the map.

### AC / DC filter

A segmented control (bottom-left, next to the station list button) filters stations by charger current: **All**, **AC**, or **DC**. A station is kept when any of its connectors matches — CCS and CHAdeMO count as DC, Type 2 as AC, GB/T and Tesla by rated power (≥ 43 kW is DC). The filter applies to both the map markers and the station list, and persists across the 30-second auto-refresh.

### Routing

Click the blue arrow button next to any station in the list (or in its popup) to:

1. Draw a traffic-aware route line on the map using the TomTom Routing API.
2. Show a route panel with distance (km) and estimated drive time (min).
3. Open the route in an external navigation app: **Apple Maps**, **Google Maps**, **AMap**, or **Waze**.

The route line persists across map style switches.

## Marker colours

| Colour | Meaning |
|---|---|
| Blue | Your location (from the HA entity) |
| Green | Station — available |
| Yellow | Station — busy |
| Red | Station — offline |
| Teal | Station — status unknown (TomTom does not provide real-time availability) |

## Connector types

Stations are normalised from TomTom's raw strings into: `CCS`, `CHAdeMO`, `Type2`, `GBT`, `Tesla`.

## Development

```bash
yarn install
yarn build   # bundles src/ev-map-card.ts → custom_components/ha_ev_map/www/ev-map-card.js
```

Commit the built `ev-map-card.js` so HACS can serve it without a build step on the user's machine.

## Architecture

```
custom_components/ha_ev_map/   ← Python HA integration
  __init__.py                  ← registers static JS path + HTTP views
  config_flow.py               ← UI setup wizard
  api.py                       ← TomTom nearbySearch wrapper
  http.py                      ← REST endpoints (stations, config, route)
  www/ev-map-card.js           ← built Lovelace card (do not edit directly)

src/ev-map-card.ts             ← card source (TypeScript + MapLibre GL)
vite.config.ts                 ← builds card as IIFE into www/
```

### REST endpoints

| Endpoint | Description |
|---|---|
| `GET /api/ha_ev_map/stations` | Returns `{ center, radiusMeters, stations[] }` — calls TomTom nearbySearch server-side |
| `GET /api/ha_ev_map/config` | Returns `{ tomtom_key }` — used by the card for traffic tile auth |
| `GET /api/ha_ev_map/route?to_lat=X&to_lon=Y` | Returns `{ distanceKm, durationMin, geojson }` — calls TomTom Routing API with traffic |

All endpoints require HA authentication (`requires_auth = True`). The card uses `hass.callApi()` which handles bearer tokens automatically.

The TomTom API key never reaches the browser — it lives in the HA config entry.
