# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
yarn dev        # start dev server (localhost:3000)
yarn build      # production build + type check
yarn start      # run production build
yarn lint       # ESLint
yarn tsc --noEmit  # type check only
```

## Environment Variables

Required in `.env.local`:

```
TOMTOM_API_KEY=...              # server-side only — EV station search proxy
```

`TOMTOM_API_KEY` must never be exposed to the browser. It is accessed only in `app/api/stations/route.ts`.

Optional Home Assistant-backed current location:

```
HOME_ASSISTANT_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=...                 # long-lived access token
HOME_ASSISTANT_LOCATION_ENTITY=person.thiti
```

These are server-side only. `HOME_ASSISTANT_LOCATION_ENTITY` can be a `person.*` or `device_tracker.*` entity with `latitude` and `longitude` attributes.

## Architecture

**Purpose:** Next.js web app embedded as an iframe panel in Home Assistant (`panel_iframe` in `configuration.yaml`). Shows EV charging stations in Thailand on a MapCN / MapLibre dark map.

### Data flow

```
Browser (HA iframe)
  └─ EVMap.tsx (client)
       ├─ fetches GET /api/stations?bbox&connector  (on map move + filter change)
       └─ renders MapCN / MapLibre markers + bottom sheet

app/api/stations/route.ts  (Next.js API route)
  └─ calls lib/tomtom.ts → TomTom nearbySearch API (server-side, key hidden)
       └─ filters by connector type server-side
       └─ returns EVStation[]
```

### Key files

| File | Role |
|---|---|
| `app/api/stations/route.ts` | API proxy — validates bbox params, filters by connector, calls TomTom |
| `lib/tomtom.ts` | TomTom nearbySearch wrapper — types match real API response exactly |
| `types/station.ts` | Shared types: `EVStation`, `Connector`, `ConnectorType`, `AvailabilityStatus` |
| `components/EVMap.tsx` | `'use client'` — MapCN map composition, station markers, location pin |
| `components/ui/map.tsx` | MapCN shadcn component built on MapLibre GL |
| `components/FilterBar.tsx` | Floating chip bar — connector filter + locate button |
| `components/StationBottomSheet.tsx` | Slide-up station detail panel |
| `components/EVMapWrapper.tsx` | `'use client'` wrapper that dynamic-imports `EVMap` with `ssr: false` |

### Important constraints

- `EVMap` must be dynamically imported with `ssr: false` — it uses browser APIs (MapLibre GL, `navigator.geolocation`). The wrapper `EVMapWrapper.tsx` handles this. Next.js 16 does not allow `ssr: false` in Server Components.
- `dynamic()` with `ssr: false` can only be called inside a Client Component (`'use client'`).
- TomTom `nearbySearch` does not support connector filtering via query text — filtering happens after fetch in the API route by matching `connector.type`.
- TomTom `nearbySearch` does not return real-time availability — all station statuses are `'unknown'`.
- Connector type values from the API are plain strings like `"IEC62196Type2Outlet"`, `"IEC62196Type2CCS"`, `"Chademo"` — mapped in `lib/tomtom.ts:toConnectorType()`.

### Marker colours

| Colour | Status |
|---|---|
| `#22c55e` green | available |
| `#eab308` yellow | busy |
| `#ef4444` red | offline |
| `#14b8a6` teal | unknown (no live data from TomTom) |
| `#3b82f6` blue (pulsing) | current user location — always z-index 10 |

### Home Assistant integration

```yaml
# configuration.yaml
panel_iframe:
  ev-map:                          # key MUST contain a hyphen (HA requirement)
    title: EV Map
    url: http://<server-ip>:3000
    icon: mdi:ev-station
```

Geolocation inside the HA iframe requires both HA and the Next.js app to be on the same protocol (both HTTP or both HTTPS). Geolocation fails silently — the map still loads without the location pin.
