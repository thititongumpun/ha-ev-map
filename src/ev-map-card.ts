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
const DEFAULT_ASPECT_RATIO = '16:9'

const CARD_CSS = `
  :host {
    display: block;
    width: 100%;
    min-width: 100%;
    box-sizing: border-box;
  }
  ha-card {
    display: block;
    width: 100%;
    min-width: 100%;
    overflow: hidden;
    border-radius: var(--ha-card-border-radius, 12px);
  }

  /* HA sets max-width:100% on all img — this breaks Leaflet 256px tiles */
  .ev-map-wrap .leaflet-tile { max-width: none !important; max-height: none !important; }
  .ev-map-wrap {
    width: 100%;
    min-width: 100%;
    position: relative;
    overflow: hidden;
  }
  .ev-map-wrap .leaflet-container {
    width: 100% !important;
    height: 100% !important;
    background: #0f172a;
  }
  .ev-map-container {
    position: absolute;
    inset: 0;
    width: 100%;
    min-width: 100%;
    height: 100%;
  }

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

class EVMapCard extends HTMLElement {
  private _root: ShadowRoot
  private _hass: any = null
  private _config: Record<string, unknown> = {}
  private _map: L.Map | null = null
  private _stationLayer: L.LayerGroup | null = null
  private _locationMarker: L.Marker | null = null
  private _refreshInterval: ReturnType<typeof setInterval> | null = null
  private _resizeObserver: ResizeObserver | null = null
  private _firstRenderFrame: number | null = null
  private _delayedInvalidateTimer: ReturnType<typeof setTimeout> | null = null
  private _initializeFrame: number | null = null
  private _wrap: HTMLDivElement | null = null
  private _mapContainer: HTMLDivElement | null = null
  private _initialized = false
  private _centeredOnLocation = false

  constructor() {
    super()
    this._root = this.attachShadow({ mode: 'open' })
  }

  setConfig(config: Record<string, unknown>) {
    this._config = config
    this._updateCardLayout()
    if (this._map) {
      this._invalidateMapSize('config update')
    } else if (this._hass && this.isConnected) {
      this._scheduleMapInitialize()
    }
  }

  set hass(hass: any) {
    this._hass = hass
    if (!this._initialized && this.isConnected) {
      this._scheduleMapInitialize()
    } else if (this._map) {
      this._invalidateMapSize('hass update')
    }
  }

  connectedCallback() {
    this._updateCardLayout()
    if (this._hass && !this._initialized) {
      this._scheduleMapInitialize()
    }
  }

  disconnectedCallback() {
    if (this._refreshInterval !== null) {
      clearInterval(this._refreshInterval)
      this._refreshInterval = null
    }
    if (this._firstRenderFrame !== null) {
      cancelAnimationFrame(this._firstRenderFrame)
      this._firstRenderFrame = null
    }
    if (this._delayedInvalidateTimer !== null) {
      clearTimeout(this._delayedInvalidateTimer)
      this._delayedInvalidateTimer = null
    }
    if (this._initializeFrame !== null) {
      cancelAnimationFrame(this._initializeFrame)
      this._initializeFrame = null
    }
    this._resizeObserver?.disconnect()
    this._resizeObserver = null
    this._map?.remove()
    this._map = null
    this._stationLayer = null
    this._locationMarker = null
    this._wrap = null
    this._mapContainer = null
    this._initialized = false
    this._centeredOnLocation = false
    this._root.replaceChildren()
  }

  private _updateCardLayout() {
    this.style.display = 'block'
    this.style.width = '100%'
    this.style.minWidth = '100%'
    this.style.boxSizing = 'border-box'

    if (!this._wrap || !this._mapContainer) {
      const style = document.createElement('style')
      style.textContent = leafletCss + CARD_CSS

      const card = document.createElement('ha-card')
      card.style.width = '100%'
      card.style.minWidth = '100%'

      const wrap = document.createElement('div')
      wrap.className = 'ev-map-wrap'

      const mapContainer = document.createElement('div')
      mapContainer.className = 'ev-map-container'
      wrap.appendChild(mapContainer)
      card.appendChild(wrap)
      this._root.replaceChildren(style, card)

      this._wrap = wrap
      this._mapContainer = mapContainer
    }

    this._applyWrapperSize()
  }

  private _applyWrapperSize() {
    if (!this._wrap) return

    const height = this._getConfiguredHeight()
    const aspectRatio = this._getAspectRatio()

    this._wrap.style.width = '100%'
    this._wrap.style.minWidth = '100%'
    this._wrap.style.position = 'relative'
    this._wrap.style.overflow = 'hidden'

    if (height !== null) {
      this._wrap.style.height = `${height}px`
      this._wrap.style.aspectRatio = ''
    } else {
      this._wrap.style.height = 'auto'
      this._wrap.style.minHeight = '240px'
      this._wrap.style.aspectRatio = aspectRatio
    }

    this._mapContainer!.style.width = '100%'
    this._mapContainer!.style.minWidth = '100%'
    this._mapContainer!.style.height = '100%'
  }

  private _getConfiguredHeight() {
    const height = Number(this._config.height)
    return Number.isFinite(height) && height > 0 ? height : null
  }

  private _getAspectRatio() {
    const value = String(this._config.aspect_ratio ?? DEFAULT_ASPECT_RATIO).trim()
    const [width, height] = value.split(':').map(Number)

    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return `${width} / ${height}`
    }

    return DEFAULT_ASPECT_RATIO.replace(':', ' / ')
  }

  private _scheduleMapInitialize(attempt = 0) {
    if (this._initialized || this._map) return
    this._updateCardLayout()
    if (!this._wrap || !this._mapContainer) return

    if (this._initializeFrame !== null) return

    this._initializeFrame = requestAnimationFrame(() => {
      this._initializeFrame = null
      if (this._initialized || this._map || !this._wrap) return

      const rect = this._wrap.getBoundingClientRect()
      this._logMapSize(`before map init attempt ${attempt + 1}`)

      if ((rect.width === 0 || rect.height === 0) && attempt < 60) {
        this._scheduleMapInitialize(attempt + 1)
        return
      }

      this._initializeMap()
    })
  }

  private _initializeMap() {
    if (this._initialized || this._map || !this._wrap || !this._mapContainer) return
    this._initialized = true

    this._map = L.map(this._mapContainer, {
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

    this._resizeObserver = new ResizeObserver(() => {
      this._invalidateMapSize('resize observer')
    })
    this._resizeObserver.observe(this._wrap)

    this._invalidateMapSize('after map creation')

    this._firstRenderFrame = requestAnimationFrame(() => {
      this._firstRenderFrame = null
      this._invalidateMapSize('first render frame')
      this._fetchAndUpdate()
    })

    this._delayedInvalidateTimer = setTimeout(() => {
      this._delayedInvalidateTimer = null
      this._invalidateMapSize('300ms delayed render')
    }, 300)

    this._refreshInterval = setInterval(() => this._fetchAndUpdate(), 30_000)
  }

  private _invalidateMapSize(reason: string) {
    if (!this._map) return
    this._logMapSize(`before invalidateSize (${reason})`)
    this._map.invalidateSize(true)
    console.debug('[ev-map-card] invalidateSize()', { reason })
    this._logMapSize(`after invalidateSize (${reason})`)
  }

  private _logMapSize(reason: string) {
    const wrapperRect = this._wrap?.getBoundingClientRect()
    const mapRect = this._mapContainer?.getBoundingClientRect()

    console.debug('[ev-map-card] map size', {
      reason,
      wrapper: wrapperRect
        ? { width: wrapperRect.width, height: wrapperRect.height }
        : { width: 0, height: 0 },
      mapContainer: mapRect ? { width: mapRect.width, height: mapRect.height } : { width: 0, height: 0 },
    })
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
    const height = this._getConfiguredHeight()
    if (height !== null) return Math.ceil(height / 50)
    return 5
  }

  static getStubConfig() {
    return {
      type: 'custom:ev-map-card',
      aspect_ratio: DEFAULT_ASPECT_RATIO,
      grid_options: {
        columns: 'full',
        rows: 'auto',
      },
    }
  }
}

customElements.define('ev-map-card', EVMapCard)
