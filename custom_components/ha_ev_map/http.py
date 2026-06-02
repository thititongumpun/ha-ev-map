from __future__ import annotations

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import EVStation, search_ev_stations_nearby
from .const import CONF_LOCATION_ENTITY, CONF_RADIUS, CONF_TOMTOM_API_KEY, DEFAULT_RADIUS, DOMAIN


class EVMapStationsView(HomeAssistantView):
    url = "/api/ha_ev_map/stations"
    name = "api:ha_ev_map:stations"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def get(self, request):  # noqa: ANN001
        entries = self._hass.config_entries.async_entries(DOMAIN)
        if not entries:
            return self.json_message("Integration not configured", 503)

        entry = entries[0]
        api_key: str = entry.data[CONF_TOMTOM_API_KEY]
        entity_id: str = entry.data[CONF_LOCATION_ENTITY]
        radius: int = int(entry.data.get(CONF_RADIUS, DEFAULT_RADIUS))

        state = self._hass.states.get(entity_id)
        if not state:
            return self.json_message(f"Entity {entity_id} not found", 404)

        try:
            lat = float(state.attributes["latitude"])
            lon = float(state.attributes["longitude"])
        except (KeyError, ValueError, TypeError):
            return self.json_message(
                f"Entity {entity_id} has no latitude/longitude attributes", 422
            )

        try:
            session = async_get_clientsession(self._hass)
            stations = await search_ev_stations_nearby(
                session, api_key, lat, lon, radius_meters=radius
            )
        except Exception as exc:  # noqa: BLE001
            return self.json_message(str(exc), 500)

        return self.json(
            {
                "center": {
                    "latitude": lat,
                    "longitude": lon,
                    "entityId": entity_id,
                },
                "radiusMeters": radius,
                "stations": [_station_dict(s) for s in stations],
            }
        )


class EVMapRouteView(HomeAssistantView):
    url = "/api/ha_ev_map/route"
    name = "api:ha_ev_map:route"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def get(self, request):  # noqa: ANN001
        entries = self._hass.config_entries.async_entries(DOMAIN)
        if not entries:
            return self.json_message("Integration not configured", 503)

        entry = entries[0]
        api_key: str = entry.data[CONF_TOMTOM_API_KEY]
        entity_id: str = entry.data[CONF_LOCATION_ENTITY]

        state = self._hass.states.get(entity_id)
        if not state:
            return self.json_message(f"Entity {entity_id} not found", 404)

        try:
            origin_lat = float(state.attributes["latitude"])
            origin_lon = float(state.attributes["longitude"])
        except (KeyError, ValueError, TypeError):
            return self.json_message("Entity has no lat/lon attributes", 422)

        try:
            to_lat = float(request.query["to_lat"])
            to_lon = float(request.query["to_lon"])
        except (KeyError, ValueError, TypeError):
            return self.json_message("Missing or invalid to_lat/to_lon", 400)

        url = (
            f"https://api.tomtom.com/routing/1/calculateRoute/"
            f"{origin_lat},{origin_lon}:{to_lat},{to_lon}/json"
        )
        params = {"key": api_key, "travelMode": "car", "traffic": "true"}

        try:
            session = async_get_clientsession(self._hass)
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return self.json_message(f"TomTom routing error {resp.status}", 502)
                data = await resp.json()
        except Exception as exc:  # noqa: BLE001
            return self.json_message(str(exc), 500)

        route = data["routes"][0]
        summary = route["summary"]
        points = route["legs"][0]["points"]

        return self.json({
            "distanceKm": round(summary["lengthInMeters"] / 1000, 1),
            "durationMin": round(summary["travelTimeInSeconds"] / 60),
            "geojson": {
                "type": "LineString",
                "coordinates": [[p["longitude"], p["latitude"]] for p in points],
            },
        })


class EVMapConfigView(HomeAssistantView):
    url = "/api/ha_ev_map/config"
    name = "api:ha_ev_map:config"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass

    async def get(self, request):  # noqa: ANN001
        entries = self._hass.config_entries.async_entries(DOMAIN)
        if not entries:
            return self.json_message("Integration not configured", 503)
        entry = entries[0]
        return self.json({"tomtom_key": entry.data[CONF_TOMTOM_API_KEY]})


def _station_dict(station: EVStation) -> dict:
    return {
        "id": station.id,
        "name": station.name,
        "address": station.address,
        "lat": station.lat,
        "lon": station.lon,
        "connectors": [
            {"type": c.type, "powerKW": c.power_kw, "status": c.status}
            for c in station.connectors
        ],
        "status": station.status,
        "distanceKm": station.distance_km,
    }
