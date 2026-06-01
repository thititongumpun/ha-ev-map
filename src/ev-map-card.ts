import maplibregl from 'maplibre-gl'
import maplibreCss from 'maplibre-gl/dist/maplibre-gl.css?inline'

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

const THAILAND_CENTER: [number, number] = [100.523186, 13.736717]
const DEFAULT_ASPECT_RATIO = '16:9'

const CARTO_DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'carto',
      type: 'raster',
      source: 'carto',
    },
  ],
}

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
  .ev-map-wrap {
    width: 100%;
    min-width: 100%;
    position: relative;
    overflow: hidden;
    background: #0f172a;
  }
  .ev-map-container {
    position: absolute;
    inset: 0;
    width: 100%;
    min-width: 100%;
    height: 100%;
  }
  .ev-map-container .maplibregl-canvas {
    width: 100% !important;
    height: 100% !important;
  }
  .ev-map-wrap:fullscreen,
  .ev-map-wrap.maplibregl-pseudo-fullscreen {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    min-width: 100vw !important;
    background: #0f172a;
    z-index: 2147483647;
  }
  .ev-map-wrap:fullscreen .ev-map-container,
  .ev-map-wrap.maplibregl-pseudo-fullscreen .ev-map-container,
  .ev-map-wrap:fullscreen .maplibregl-canvas-container,
  .ev-map-wrap.maplibregl-pseudo-fullscreen .maplibregl-canvas-container,
  .ev-map-wrap:fullscreen .maplibregl-canvas,
  .ev-map-wrap.maplibregl-pseudo-fullscreen .maplibregl-canvas {
    width: 100vw !important;
    height: 100vh !important;
  }
  .ev-map-marker {
    border-radius: 999px;
    border: 2px solid rgba(255,255,255,0.6);
    cursor: pointer;
  }
  .ev-map-marker-location {
    width: 16px;
    height: 16px;
    background: #3b82f6;
    border-color: #fff;
    box-shadow: 0 0 10px #3b82f680;
  }
  .ev-map-marker-station {
    width: 12px;
    height: 12px;
  }
  .ev-map-popup .maplibregl-popup-content {
    background: #0f172a;
    color: #e2e8f0;
    border: 1px solid #1e293b;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    padding: 12px 14px;
  }
  .ev-map-popup .maplibregl-popup-tip {
    border-top-color: #0f172a;
    border-bottom-color: #0f172a;
  }
  .ev-map-popup .maplibregl-popup-close-button {
    color: #94a3b8;
    font-size: 18px;
    padding: 4px 8px;
  }
  .ev-map-popup .maplibregl-popup-close-button:hover {
    color: #e2e8f0;
    background: transparent;
  }
`

class EVMapCard extends HTMLElement {
  private _root: ShadowRoot
  private _hass: any = null
  private _config: Record<string, unknown> = {}
  private _map: maplibregl.Map | null = null
  private _stationMarkers: maplibregl.Marker[] = []
  private _locationMarker: maplibregl.Marker | null = null
  private _refreshInterval: ReturnType<typeof setInterval> | null = null
  private _resizeObserver: ResizeObserver | null = null
  private _firstRenderFrame: number | null = null
  private _delayedResizeTimer: ReturnType<typeof setTimeout> | null = null
  private _initializeFrame: number | null = null
  private _wrap: HTMLDivElement | null = null
  private _mapContainer: HTMLDivElement | null = null
  private _initialized = false
  private _centeredOnLocation = false
  private _fullscreenChangeHandler = () => {
    this._resizeMap('fullscreen change')
    requestAnimationFrame(() => this._resizeMap('fullscreen frame'))
    setTimeout(() => this._resizeMap('fullscreen settled'), 300)
  }

  constructor() {
    super()
    this._root = this.attachShadow({ mode: 'open' })
  }

  setConfig(config: Record<string, unknown>) {
    this._config = config
    this._updateCardLayout()
    if (this._map) {
      this._resizeMap('config update')
    } else if (this._hass && this.isConnected) {
      this._scheduleMapInitialize()
    }
  }

  set hass(hass: any) {
    this._hass = hass
    if (!this._initialized && this.isConnected) {
      this._scheduleMapInitialize()
    } else if (this._map) {
      this._resizeMap('hass update')
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
    if (this._delayedResizeTimer !== null) {
      clearTimeout(this._delayedResizeTimer)
      this._delayedResizeTimer = null
    }
    if (this._initializeFrame !== null) {
      cancelAnimationFrame(this._initializeFrame)
      this._initializeFrame = null
    }
    this._resizeObserver?.disconnect()
    this._resizeObserver = null
    this._clearStationMarkers()
    this._locationMarker?.remove()
    this._locationMarker = null
    this._map?.remove()
    this._map = null
    this._wrap = null
    this._mapContainer = null
    this._initialized = false
    this._centeredOnLocation = false
    document.removeEventListener('fullscreenchange', this._fullscreenChangeHandler)
    this._root.replaceChildren()
  }

  private _updateCardLayout() {
    this.style.display = 'block'
    this.style.width = '100%'
    this.style.minWidth = '100%'
    this.style.boxSizing = 'border-box'

    if (!this._wrap || !this._mapContainer) {
      const style = document.createElement('style')
      style.textContent = maplibreCss + CARD_CSS

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
    if (!this._wrap || !this._mapContainer) return

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

    this._mapContainer.style.width = '100%'
    this._mapContainer.style.minWidth = '100%'
    this._mapContainer.style.height = '100%'
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

  private _getAspectRatioValue() {
    const value = String(this._config.aspect_ratio ?? DEFAULT_ASPECT_RATIO).trim()
    const [width, height] = value.split(':').map(Number)

    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return width / height
    }

    return 16 / 9
  }

  private _syncMapContainerSize(reason: string) {
    if (!this._wrap || !this._mapContainer) return

    const hostRect = this.getBoundingClientRect()
    const parentRect = this.parentElement?.getBoundingClientRect()
    const cardRect = this._wrap.parentElement?.getBoundingClientRect()
    const fullscreen = this._isFullscreen()
    const width = fullscreen
      ? window.innerWidth
      : Math.max(hostRect.width, parentRect?.width ?? 0, cardRect?.width ?? 0)

    if (width <= 0) return

    const configuredHeight = this._getConfiguredHeight()
    const height = fullscreen ? window.innerHeight : configuredHeight ?? Math.max(240, width / this._getAspectRatioValue())

    this.style.width = '100%'
    this.style.minWidth = '100%'
    this._wrap.style.width = `${width}px`
    this._wrap.style.minWidth = '100%'
    this._wrap.style.height = `${height}px`
    this._mapContainer.style.width = `${width}px`
    this._mapContainer.style.minWidth = '100%'
    this._mapContainer.style.height = `${height}px`
    this._syncMapLibreInnerSize(width, height)

    console.debug('[ev-map-card] synced MapLibre container size', { reason, width, height })
  }

  private _syncMapLibreInnerSize(width: number, height: number) {
    if (!this._mapContainer) return

    const innerElements = this._mapContainer.querySelectorAll<HTMLElement>(
      '.maplibregl-canvas-container, .maplibregl-canvas',
    )

    for (const element of innerElements) {
      element.style.width = `${width}px`
      element.style.height = `${height}px`
    }
  }

  private _isFullscreen() {
    return (
      document.fullscreenElement === this._wrap ||
      this.shadowRoot?.fullscreenElement === this._wrap ||
      this._wrap?.classList.contains('maplibregl-pseudo-fullscreen') === true
    )
  }

  private _scheduleMapInitialize(attempt = 0) {
    if (this._initialized || this._map) return
    this._updateCardLayout()
    if (!this._wrap || !this._mapContainer) return

    if (this._initializeFrame !== null) return

    this._initializeFrame = requestAnimationFrame(() => {
      this._initializeFrame = null
      if (this._initialized || this._map || !this._wrap) return

      this._syncMapContainerSize(`before map init attempt ${attempt + 1}`)
      const rect = this._mapContainer?.getBoundingClientRect()
      this._logMapSize(`before map init attempt ${attempt + 1}`)

      if ((!rect || rect.width <= 256 || rect.height <= 0) && attempt < 60) {
        this._scheduleMapInitialize(attempt + 1)
        return
      }

      this._initializeMap()
    })
  }

  private _initializeMap() {
    if (this._initialized || this._map || !this._wrap || !this._mapContainer) return
    this._initialized = true
    this._syncMapContainerSize('initialize map')

    this._map = new maplibregl.Map({
      container: this._mapContainer,
      style: CARTO_DARK_STYLE,
      center: THAILAND_CENTER,
      zoom: 10,
      attributionControl: true,
    })

    this._map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-left')
    this._map.addControl(new maplibregl.FullscreenControl({ container: this._wrap, pseudo: true }), 'top-right')
    document.addEventListener('fullscreenchange', this._fullscreenChangeHandler)

    this._resizeObserver = new ResizeObserver(() => {
      this._resizeMap('resize observer')
    })
    this._resizeObserver.observe(this._wrap)
    this._resizeObserver.observe(this)
    if (this.parentElement) {
      this._resizeObserver.observe(this.parentElement)
    }

    this._resizeMap('after map creation')

    this._firstRenderFrame = requestAnimationFrame(() => {
      this._firstRenderFrame = null
      this._resizeMap('first render frame')
      this._fetchAndUpdate()
    })

    this._delayedResizeTimer = setTimeout(() => {
      this._delayedResizeTimer = null
      this._resizeMap('300ms delayed render')
    }, 300)

    this._refreshInterval = setInterval(() => this._fetchAndUpdate(), 30_000)
  }

  private _resizeMap(reason: string) {
    if (!this._map) return
    this._syncMapContainerSize(reason)
    this._logMapSize(`before resize (${reason})`)
    this._map.resize()
    console.debug('[ev-map-card] map.resize()', { reason })
    this._logMapSize(`after resize (${reason})`)
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
    if (!this._map) return

    this._clearStationMarkers()

    const { latitude, longitude } = data.center

    if (this._locationMarker) {
      this._locationMarker.setLngLat([longitude, latitude])
    } else {
      this._locationMarker = new maplibregl.Marker({
        element: this._createMarkerElement('location'),
        anchor: 'center',
      })
        .setLngLat([longitude, latitude])
        .setPopup(
          new maplibregl.Popup({ className: 'ev-map-popup', closeButton: false }).setHTML(
            '<strong style="color:#f1f5f9;">Your Location</strong>',
          ),
        )
        .addTo(this._map)
    }

    if (!this._centeredOnLocation) {
      this._map.flyTo({ center: [longitude, latitude], zoom: 13, essential: true })
      this._centeredOnLocation = true
    }

    for (const station of data.stations) {
      const color = STATUS_COLOR[station.status] ?? STATUS_COLOR['unknown']
      const marker = new maplibregl.Marker({
        element: this._createMarkerElement('station', color),
        anchor: 'center',
      })
        .setLngLat([station.lon, station.lat])
        .setPopup(new maplibregl.Popup({ className: 'ev-map-popup', maxWidth: '280px' }).setHTML(this._popupHtml(station)))
        .addTo(this._map)

      this._stationMarkers.push(marker)
    }
  }

  private _createMarkerElement(type: 'location' | 'station', color?: string) {
    const element = document.createElement('div')
    element.className = `ev-map-marker ev-map-marker-${type}`

    if (color) {
      element.style.background = color
      element.style.boxShadow = `0 0 6px ${color}80`
    }

    return element
  }

  private _popupHtml(station: EVStation) {
    const connectorHtml =
      station.connectors.length > 0
        ? station.connectors
            .map(
              (connector) =>
                `<span style="display:inline-block;padding:2px 6px;margin:2px;background:#1e293b;border-radius:4px;font-size:11px;color:#e2e8f0;">${connector.type}${connector.powerKW > 0 ? ` ${connector.powerKW} kW` : ''}</span>`,
            )
            .join('')
        : '<span style="color:#64748b;font-size:11px;">No connector data</span>'

    return `
      <div style="font-family:sans-serif;min-width:200px;">
        <h3 style="margin:0 0 4px;font-size:13px;font-weight:600;color:#f1f5f9;">${station.name}</h3>
        <p style="margin:0 0 8px;font-size:11px;color:#94a3b8;line-height:1.4;">${station.address}</p>
        <div style="margin-bottom:8px;font-size:11px;display:flex;gap:8px;flex-wrap:wrap;">
          <span><span style="color:#64748b;">Status: </span>${STATUS_LABEL[station.status] ?? 'Unknown'}</span>
          <span style="color:#64748b;">${station.distanceKm} km</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;">${connectorHtml}</div>
      </div>`
  }

  private _clearStationMarkers() {
    for (const marker of this._stationMarkers) {
      marker.remove()
    }
    this._stationMarkers = []
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
