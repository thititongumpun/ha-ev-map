# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn build      # bundle src/ev-map-card.ts → custom_components/ha_ev_map/www/ev-map-card.js
yarn dev        # vite dev server (for card development only)
```

No test framework is configured. Before submitting changes run `yarn build` and confirm it exits cleanly.

## Architecture

This is a HACS `integration`-type repository. It has two parts that ship together:

1. **Python HA integration** (`custom_components/ha_ev_map/`) — installed by HACS into Home Assistant, exposes an authenticated REST endpoint, and registers the card JS as a static asset.
2. **Lovelace card** (`src/ev-map-card.ts`) — TypeScript custom element bundled by Vite into `custom_components/ha_ev_map/www/ev-map-card.js` and served by HA.

### Data flow

```
Lovelace dashboard
  └─ <ev-map-card>  (custom element, Leaflet map)
       └─ hass.callApi('GET', 'ha_ev_map/stations')   ← authenticated via HA frontend

Home Assistant HTTP layer
  └─ EVMapStationsView  (custom_components/ha_ev_map/http.py)
       ├─ reads location_entity from hass.states (lat/lon)
       └─ calls TomTom nearbySearch API  (api.py)
            └─ normalises → EVStation[]  (id, name, address, lat, lon, connectors, distanceKm)
```

The TomTom API key never reaches the browser — it lives in the HA config entry (stored by `config_flow.py`).

### Key files

| File | Role |
|---|---|
| `custom_components/ha_ev_map/const.py` | `DOMAIN`, config key constants, `DEFAULT_RADIUS` |
| `custom_components/ha_ev_map/api.py` | `search_ev_stations_nearby()` — async TomTom wrapper, haversine distance, connector normalisation |
| `custom_components/ha_ev_map/http.py` | `EVMapStationsView` at `/api/ha_ev_map/stations` |
| `custom_components/ha_ev_map/__init__.py` | `async_setup` registers static path `/ha_ev_map/ev-map-card.js`; `async_setup_entry` registers the HTTP view |
| `custom_components/ha_ev_map/config_flow.py` | UI config flow — validates location entity (lat/lon), validates TomTom key with a live test call |
| `src/ev-map-card.ts` | Lovelace card source — Leaflet map, station markers, popup details, 30 s auto-refresh |
| `vite.config.ts` | Bundles card as IIFE to `custom_components/ha_ev_map/www/ev-map-card.js`; `publicDir: false` |

### Important constraints

- **Connector normalisation** happens in `api.py:_to_connector_type()`. TomTom returns raw strings like `"IEC62196Type2CCS"`, `"Chademo"` — mapped to `"CCS"`, `"CHAdeMO"`, `"GBT"`, `"Type2"`, `"Tesla"`.
- **TomTom does not return real-time availability** — all station statuses are `"unknown"` (teal markers).
- **Stations without `chargingPark.connectors`** are filtered out in `api.py:_normalise()`.
- **HA auth**: the card calls `hass.callApi(...)` which handles bearer tokens automatically. `EVMapStationsView` has `requires_auth = True`.
- **Static path** is registered in `async_setup` (not `async_setup_entry`) so the JS is served even before the integration is configured.

### Marker colours

| Colour | Meaning |
|---|---|
| `#22c55e` green | available |
| `#eab308` yellow | busy |
| `#ef4444` red | offline |
| `#14b8a6` teal | unknown (all TomTom stations) |
| `#3b82f6` blue | HA location entity marker (z-index 1000) |

### HA installation

After HACS installs the integration, add the card resource in **Settings → Dashboards → Resources**:

```
URL:  /ha_ev_map/ev-map-card.js
Type: JavaScript Module
```

Lovelace card config:

```yaml
type: custom:ev-map-card
```

Config flow fields: `tomtom_api_key` (required), `location_entity` e.g. `person.thiti` (required), `mapbox_token` (optional, unused currently), `radius` in metres (default 5000).
