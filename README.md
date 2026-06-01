# ha-ev-map

A HACS integration for Home Assistant that shows EV charging stations near a configured location entity on a Leaflet map. The TomTom API key stays server-side inside HA — it never reaches the browser.

## Requirements

- Home Assistant 2023.6+
- [HACS](https://hacs.xyz) installed
- A TomTom API key ([get one free](https://developer.tomtom.com/))
- A `person.*` or `device_tracker.*` entity in HA with `latitude` and `longitude` attributes

## Installation

### Via HACS (recommended)

1. In HACS, go to **Integrations** → menu (⋮) → **Custom repositories**.
2. Add `https://github.com/thititongumpun/ha-th-ev-map` with category **Integration**.
3. Search for **EV Map** and install it.
4. Restart Home Assistant.

### Manual

Copy `custom_components/ha_ev_map/` into your HA `config/custom_components/` directory and restart.

## Setup

1. Go to **Settings → Devices & Services → Add Integration** and search for **EV Map**.
2. Fill in the config form:

   | Field | Required | Description |
   |---|---|---|
   | TomTom API Key | Yes | Server-side key for the nearbySearch API |
   | Location Entity | Yes | e.g. `person.thiti` — must have lat/lon attributes |
   | Search Radius (m) | No | Default `5000` |
   | Mapbox Token | No | Reserved for future use |

   The flow validates that the entity exists and has coordinates, then makes a live TomTom test call before saving.

3. Add the card JS as a Lovelace resource — **Settings → Dashboards → Resources → Add**:

   ```
   URL:  /ha_ev_map/ev-map-card.js
   Type: JavaScript Module
   ```

## Usage

Add the card to a Home Assistant Sections dashboard with auto rows:

```yaml
type: custom:ev-map-card
aspect_ratio: "16:9"
grid_options:
  columns: full
  rows: auto
```

For masonry or other non-Sections dashboards, this is enough:

```yaml
type: custom:ev-map-card
aspect_ratio: "16:9"
```

The card uses `aspect_ratio` to calculate a stable responsive map height before Leaflet initializes. This avoids the common Home Assistant layout issue where Leaflet starts with a single 256x256 tile.

If you prefer a fixed-height map, use `height` instead:

```yaml
type: custom:ev-map-card
height: 400
```

After updating the card JavaScript, Home Assistant or the browser may keep serving an old cached copy. If the map still looks broken after an update, change the dashboard resource URL to include a new version query and hard refresh the browser:

```text
/ha_ev_map/ev-map-card.js?v=4
```

The card:

- Centers on the configured location entity and places a blue marker there.
- Fetches EV stations within the configured radius from TomTom and renders them as coloured dots.
- Includes a fullscreen button in the top-right corner of the map. Press `Esc` or click the button again to exit fullscreen.
- Refreshes automatically every 30 seconds.
- Shows station name, address, distance, and connector types in a popup when a marker is clicked.

### Marker colours

| Colour | Meaning |
|---|---|
| Blue | Your location (from the HA entity) |
| Teal | EV station — status unknown (TomTom does not provide real-time availability) |

### Connector types

Stations are normalised from TomTom's raw strings into: `CCS`, `CHAdeMO`, `Type2`, `GBT`.

## Development

```bash
yarn install
yarn build   # bundles src/ev-map-card.ts → custom_components/ha_ev_map/www/ev-map-card.js
```

Commit the built `ev-map-card.js` so HACS can serve it without a build step on the user's machine.

## Architecture

```
custom_components/ha_ev_map/   ← Python HA integration
  __init__.py                  ← registers static path + HTTP view
  config_flow.py               ← UI setup wizard
  api.py                       ← TomTom nearbySearch wrapper
  http.py                      ← GET /api/ha_ev_map/stations (auth-required)
  www/ev-map-card.js           ← built Lovelace card (do not edit directly)

src/ev-map-card.ts             ← card source (TypeScript + Leaflet)
vite.config.ts                 ← builds card as IIFE into www/
```

The `/api/ha_ev_map/stations` endpoint reads the configured location entity from `hass.states`, calls TomTom server-side, and returns `{ center, radiusMeters, stations[] }`. The Lovelace card calls this endpoint via `hass.callApi()` which handles HA authentication automatically.
