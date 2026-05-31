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

function injectLeafletCSS() {
  if (document.getElementById('ev-map-leaflet-css')) return
  const style = document.createElement('style')
  style.id = 'ev-map-leaflet-css'
  style.textContent = leafletCss
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
    injectLeafletCSS()
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

    this.style.display = 'block'
    this.style.width = '100%'
    this.style.height = '500px'

    const container = document.createElement('div')
    container.style.width = '100%'
    container.style.height = '100%'
    this.appendChild(container)

    this._map = L.map(container, {
      center: THAILAND_CENTER,
      zoom: 10,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(this._map)

    this._stationLayer = L.layerGroup().addTo(this._map)

    this._fetchAndUpdate()
    this._refreshInterval = setInterval(() => this._fetchAndUpdate(), 30_000)
  }

  private async _fetchAndUpdate() {
    if (!this._hass) return
    try {
      const data: StationsResponse = await this._hass.callApi('GET', 'ha_ev_map/stations')
      this._renderStations(data)
    } catch {
      // Map stays visible even if the request fails
    }
  }

  private _renderStations(data: StationsResponse) {
    if (!this._map || !this._stationLayer) return

    this._stationLayer.clearLayers()

    const { latitude, longitude } = data.center

    const locationIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:2px solid white;box-shadow:0 0 10px #3b82f680;"></div>`,
      className: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    })

    if (this._locationMarker) {
      this._locationMarker.setLatLng([latitude, longitude])
    } else {
      this._locationMarker = L.marker([latitude, longitude], {
        icon: locationIcon,
        zIndexOffset: 1000,
      })
        .addTo(this._map)
        .bindPopup('<strong>Your Location</strong>')
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
                  `<span style="display:inline-block;padding:2px 6px;margin:2px;background:#1e293b;border-radius:4px;font-size:11px;color:#e2e8f0;">${c.type}${c.powerKW > 0 ? ` ${c.powerKW} kW` : ''}</span>`,
              )
              .join('')
          : '<span style="color:#64748b;font-size:11px;">No connector data</span>'

      const popupHtml = `
        <div style="font-family:sans-serif;color:#e2e8f0;min-width:220px;">
          <h3 style="margin:0 0 4px;font-size:14px;font-weight:600;color:#f1f5f9;">${station.name}</h3>
          <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">${station.address}</p>
          <div style="margin-bottom:8px;font-size:12px;display:flex;gap:8px;flex-wrap:wrap;">
            <span><span style="color:#64748b;">Status: </span>${STATUS_LABEL[station.status] ?? 'Unknown'}</span>
            <span style="color:#64748b;">${station.distanceKm} km</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;">${connectorHtml}</div>
        </div>
      `

      L.marker([station.lat, station.lon], { icon })
        .bindPopup(popupHtml, { maxWidth: 300 })
        .addTo(this._stationLayer!)
    }
  }

  getCardSize() {
    return 6
  }
}

customElements.define('ev-map-card', EVMapCard)
