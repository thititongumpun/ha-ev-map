from __future__ import annotations

import aiohttp
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import search_ev_stations_nearby
from .const import (
    CONF_LOCATION_ENTITY,
    CONF_MAPBOX_TOKEN,
    CONF_RADIUS,
    CONF_TOMTOM_API_KEY,
    DEFAULT_RADIUS,
    DOMAIN,
)

STEP_USER_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_TOMTOM_API_KEY): str,
        vol.Required(CONF_LOCATION_ENTITY): str,
        vol.Optional(CONF_MAPBOX_TOKEN, default=""): str,
        vol.Optional(CONF_RADIUS, default=DEFAULT_RADIUS): int,
    }
)


class HAEVMapConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors: dict[str, str] = {}
        lat: float | None = None
        lon: float | None = None

        if user_input is not None:
            api_key: str = user_input[CONF_TOMTOM_API_KEY]
            entity_id: str = user_input[CONF_LOCATION_ENTITY]
            radius: int = int(user_input.get(CONF_RADIUS, DEFAULT_RADIUS))

            state = self.hass.states.get(entity_id)
            if not state:
                errors[CONF_LOCATION_ENTITY] = "entity_not_found"
            else:
                try:
                    lat = float(state.attributes["latitude"])
                    lon = float(state.attributes["longitude"])
                except (KeyError, ValueError, TypeError):
                    errors[CONF_LOCATION_ENTITY] = "entity_no_location"

            if not errors and lat is not None and lon is not None:
                try:
                    session = async_get_clientsession(self.hass)
                    await search_ev_stations_nearby(
                        session, api_key, lat, lon, radius_meters=1000, limit=1
                    )
                except aiohttp.ClientResponseError as exc:
                    if exc.status == 403:
                        errors[CONF_TOMTOM_API_KEY] = "invalid_api_key"
                    else:
                        errors["base"] = "cannot_connect"
                except Exception:  # noqa: BLE001
                    errors["base"] = "cannot_connect"

            if not errors:
                await self.async_set_unique_id(DOMAIN)
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=f"EV Map ({entity_id})",
                    data=user_input,
                )

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_SCHEMA,
            errors=errors,
        )
