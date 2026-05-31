from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

import aiohttp


@dataclass
class Connector:
    type: str
    power_kw: float
    status: str = "unknown"


@dataclass
class EVStation:
    id: str
    name: str
    address: str
    lat: float
    lon: float
    connectors: list[Connector] = field(default_factory=list)
    status: str = "unknown"
    distance_km: Optional[float] = None


def _to_connector_type(raw: str) -> str:
    v = raw.lower()
    if "ccs" in v or "combo" in v:
        return "CCS"
    if "chademo" in v:
        return "CHAdeMO"
    if "gbt" in v or "20234" in v:
        return "GBT"
    return "Type2"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(a))


def _normalise(result: dict, center_lat: float, center_lon: float) -> Optional[EVStation]:
    charging_park = result.get("chargingPark", {})
    connectors_data = charging_park.get("connectors") or []
    if not connectors_data:
        return None

    connectors = [
        Connector(
            type=_to_connector_type(c.get("connectorType", "")),
            power_kw=float(c.get("ratedPowerKW", 0)),
        )
        for c in connectors_data
    ]

    position = result.get("position", {})
    lat = float(position.get("lat", 0))
    lon = float(position.get("lon", 0))

    return EVStation(
        id=result["id"],
        name=result.get("poi", {}).get("name", ""),
        address=result.get("address", {}).get("freeformAddress", ""),
        lat=lat,
        lon=lon,
        connectors=connectors,
        distance_km=round(_haversine_km(center_lat, center_lon, lat, lon), 2),
    )


async def search_ev_stations_nearby(
    session: aiohttp.ClientSession,
    api_key: str,
    lat: float,
    lon: float,
    radius_meters: int = 5000,
    limit: int = 20,
) -> list[EVStation]:
    params = {
        "key": api_key,
        "lat": str(lat),
        "lon": str(lon),
        "radius": str(radius_meters),
        "limit": str(limit),
        "categorySet": "7309",
        "language": "th-TH",
        "view": "Unified",
        "relatedPois": "off",
    }
    url = "https://api.tomtom.com/search/2/nearbySearch/.json"

    async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
        resp.raise_for_status()
        data = await resp.json()

    stations: list[EVStation] = []
    for r in data.get("results", []):
        station = _normalise(r, lat, lon)
        if station is not None:
            stations.append(station)

    stations.sort(key=lambda s: s.distance_km or 0)
    return stations
