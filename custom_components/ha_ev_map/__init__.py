from __future__ import annotations

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .http import EVMapConfigView, EVMapRouteView, EVMapStationsView

PLATFORMS: list[str] = []


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                url_path=f"/{DOMAIN}",
                path=hass.config.path(f"custom_components/{DOMAIN}/www"),
                cache_headers=False,
            )
        ]
    )
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # Views resolve the config entry per-request, so register them only once —
    # re-registering on entry reload (e.g. after reconfigure) raises on duplicate routes.
    if not hass.data.get(DOMAIN):
        hass.data[DOMAIN] = True
        hass.http.register_view(EVMapStationsView(hass))
        hass.http.register_view(EVMapConfigView(hass))
        hass.http.register_view(EVMapRouteView(hass))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return True
