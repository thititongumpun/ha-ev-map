import L from 'leaflet'
import leafletCss from 'leaflet/dist/leaflet.css?inline'

interface Connector {
  type: string
  powerKW: number
  status: string
}

interface EVStation {
  id: string
  name: string
  address: string
  lat: number
  lon: number
  connectors: Connector[]
  status: string
  distanceKm: number
}

interface StationsResponse {
  center: { latitude: number; longitude: number; entityId: string }
  radiusMeters: number
  stations: EVStation[]
}

const STATUS_COLOR: Record<string, string> = {
  available: '#22c55e',
  busy: '#eab308',
  offline: '#ef4444',
  unknown: '#14b8a6',
}

const STATUS_LABEL: Record<string, string> = {
  available: 'Available',
  busy: 'Busy',
  offline: 'Offline',
  unknown: 'Unknown',
}

const THAILAND_CENTER: [number, number] = [13.736717, 100.523186]

const CARD_CSS = `
  /* HA sets max-width:100% on all img — this breaks Leaflet 256px tiles */
  .ev-map-wrap .leaflet-tile { max-width: none !important; max-height: none !important; }
  .ev-map-wrap .leaflet-container { background: #0f172a; }

  /* Dark popup theme */
  .ev-map-popup .leaflet-popup-content-wrapper {
    background: #0f172a;
    color: #e2e8f0;
    border: 1px solid #1e293b;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .ev-map-popup .leaflet-popup-content { margin: 12px 14px; }
  .ev-map-popup .leaflet-popup-tip { background: #0f172a; }
  .ev-map-popup .leaflet-popup-close-button { color: #94a3b8 !important; }
  .ev-map-popup .leaflet-popup-close-button:hover { color: #e2e8f0 !important; }
`

function injectCSS() {
  if (document.getElementById('ev-map-styles')) return
  const style = document.createElement('style')
  style.id = 'ev-map-styles'
  style.textContent = leafletCss + CARD_CSS
  document.head.appendChild(style)
}

class EVMapCard extends HTMLElement {
  private _hass: any = null
  private _config: Record<string, unknown> = {}
  private _map: L.Map | null = null
  private _stationLayer: L.LayerGroup | null = null
  private _locationMarker: L.Marker | null = null
  private _refreshInterval: ReturnType<typeof setInterval> | null = null
  private _initialized = false
  private _centeredOnLocation = false

  setConfig(config: Record<string, unknown>) {
    this._config = config
  }

  set hass(hass: any) {
    this._hass = hass
    if (!this._initialized && this.isConnected) {
      this._initializeMap()
    }
  }

  connectedCallback() {
    injectCSS()
    if (this._hass && !this._initialized) {
      this._initializeMap()
    }
  }

  disconnectedCallback() {
    if (this._refreshInterval !== null) {
      clearInterval(this._refreshInterval)
      this._refreshInterval = null
    }
    this._map?.remove()
    this._map = null
    this._locationMarker = null
    this._initialized = false
    this._centeredOnLocation = false
  }

  private _initializeMap() {
    if (this._initialized) return
    this._initialized = true

    const height = Number(this._config.height ?? 400)

    this.style.display = 'block'
    this.style.overflow = 'hidden'
    this.style.borderRadius = 'var(--ha-card-border-radius, 12px)'

    // Wrapper carries the scoped CSS class so our selectors don't bleed globally
    const wrap = document.createElement('div')
    wrap.className = 'ev-map-wrap'
    wrap.style.cssText = `width:100%;height:${height}px;position:relative;`
    this.appendChild(wrap)

    this._map = L.map(wrap, {
      center: THAILAND_CENTER,
      zoom: 10,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(this._map)

    this._stationLayer = L.layerGroup().addTo(this._map)

    // Double-RAF: first frame adds element to DOM, second frame has computed layout
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._map?.invalidateSize()
        this._fetchAndUpdate()
      })
    })

    this._refreshInterval = setInterval(() => this._fetchAndUpdate(), 30_000)
  }

  private async _fetchAndUpdate() {
    if (!this._hass) return
    try {
      const data: StationsResponse = await this._hass.callApi('GET', 'ha_ev_map/stations')
      this._renderStations(data)
    } catch {
      // map stays visible if request fails
    }
  }

  private _renderStations(data: StationsResponse) {
    if (!this._map || !this._stationLayer) return

    this._stationLayer.clearLayers()

    const { latitude, longitude } = data.center

    if (this._locationMarker) {
      this._locationMarker.setLatLng([latitude, longitude])
    } else {
      const locationIcon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:2px solid white;box-shadow:0 0 10px #3b82f680;"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      this._locationMarker = L.marker([latitude, longitude], {
        icon: locationIcon,
        zIndexOffset: 1000,
      })
        .addTo(this._map)
        .bindPopup('<strong style="color:#f1f5f9;">Your Location</strong>', {
          className: 'ev-map-popup',
        })
    }

    if (!this._centeredOnLocation) {
      this._map.setView([latitude, longitude], 13)
      this._centeredOnLocation = true
    }

    for (const station of data.stations) {
      const color = STATUS_COLOR[station.status] ?? STATUS_COLOR['unknown']
      const icon = L.divIcon({
        html: `<div style="width:12px;height:12px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.6);box-shadow:0 0 6px ${color}80;"></div>`,
        className: '',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      })

      const connectorHtml =
        station.connectors.length > 0
          ? station.connectors
              .map(
                (c) =>
                  `<span style="display:inline-block;padding:2px 6px;margin:2px;background:#1e293b;border-radius:4px;font-size:11px;color:#e2e8f0;">${c.type}${c.powerKW > 0 ? ` ${c.powerKW} kW` : ''}</span>`,
              )
              .join('')
          : '<span style="color:#64748b;font-size:11px;">No connector data</span>'

      const popupHtml = `
        <div style="font-family:sans-serif;min-width:200px;">
          <h3 style="margin:0 0 4px;font-size:13px;font-weight:600;color:#f1f5f9;">${station.name}</h3>
          <p style="margin:0 0 8px;font-size:11px;color:#94a3b8;line-height:1.4;">${station.address}</p>
          <div style="margin-bottom:8px;font-size:11px;display:flex;gap:8px;flex-wrap:wrap;">
            <span><span style="color:#64748b;">Status: </span>${STATUS_LABEL[station.status] ?? 'Unknown'}</span>
            <span style="color:#64748b;">${station.distanceKm} km</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;">${connectorHtml}</div>
        </div>`

      L.marker([station.lat, station.lon], { icon })
        .bindPopup(popupHtml, { maxWidth: 280, className: 'ev-map-popup' })
        .addTo(this._stationLayer!)
    }
  }

  getCardSize() {
    return Math.ceil(Number(this._config.height ?? 400) / 50)
  }
}

customElements.define('ev-map-card', EVMapCard)
