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
  brand?: string
  connectors: Connector[]
  status: string
  distanceKm: number
}

interface StationsResponse {
  center: { latitude: number; longitude: number; entityId: string; heading?: number | null }
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

const BRAND_LOGOS: Array<{ path: string; aliases: string[] }> = [
  { path: 'brand/altervim.png', aliases: ['altervim'] },
  { path: 'brand/charge24.jpg', aliases: ['charge24', 'charge 24'] },
  { path: 'brand/ea-anywhere.png', aliases: ['ea anywhere', 'energy absolute'] },
  { path: 'brand/elexa.png', aliases: ['elexa', 'elex by egat', 'egat', 'elex'] },
  { path: 'brand/ev_station_pluz.jpg', aliases: ['ev station pluz', 'ev station plu', 'pluz', 'ptt'] },
  { path: 'brand/evolt.jpg', aliases: ['evolt'] },
  { path: 'brand/ginka.png', aliases: ['ginka'] },
  { path: 'brand/igreen.png', aliases: ['igreen', 'i green'] },
  { path: 'brand/mea.jpg', aliases: ['mea ev', 'mea'] },
  { path: 'brand/mg.jpg', aliases: ['mg'] },
  { path: 'brand/on-ion.png', aliases: ['on-ion', 'on ion', 'onion', 'arun plus'] },
  { path: 'brand/pea_volta.png', aliases: ['pea volta', 'volta'] },
  { path: 'brand/rever.png', aliases: ['rever'] },
  { path: 'brand/sharge.png', aliases: ['sharge'] },
  { path: 'brand/shell.png', aliases: ['shell'] },
  { path: 'brand/spark.jpg', aliases: ['spark'] },
  { path: 'brand/susco.png', aliases: ['susco'] },
  { path: 'brand/tesla.png', aliases: ['tesla'] },
  { path: 'brand/onecharge.png', aliases: ['onecharge'] },
  { path: 'brand/charge+.png', aliases: ['charge+'] },
  { path: 'brand/qcharge.png', aliases: ['qcharge'] }

]

const ROUTE_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 11C2 11 3 8 6 7C9 6 11 3 11 3" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round"/><path d="M9 3H11V5" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`

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

const MAP_STYLES: Array<{ id: string; label: string; style: maplibregl.StyleSpecification | string; pitch?: number }> = [
  { id: 'default', label: 'Dark', style: CARTO_DARK_STYLE, pitch: 0 },
  { id: 'openstreetmap', label: 'OpenStreetMap', style: 'https://tiles.openfreemap.org/styles/bright', pitch: 0 },
  { id: 'liberty', label: 'Liberty 3D', style: 'https://tiles.openfreemap.org/styles/liberty', pitch: 45 },
]

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
    width: 18px;
    height: 18px;
    background: #3b82f6;
    border-color: #fff;
    box-shadow: 0 0 10px #3b82f680;
    position: relative;
  }
  .ev-map-marker-location-heading {
    position: absolute;
    left: 50%;
    top: -12px;
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-bottom: 13px solid #3b82f6;
    transform-origin: 50% 21px;
    filter: drop-shadow(0 0 4px rgba(59,130,246,0.7));
  }
  .ev-map-marker-location-heading::after {
    content: '';
    position: absolute;
    left: -3px;
    top: 3px;
    width: 0;
    height: 0;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-bottom: 8px solid #bfdbfe;
  }
  .ev-map-marker-station {
    min-width: 24px;
    height: 24px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f8fafc;
    font-size: 8px;
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0;
    border-color: rgba(255,255,255,0.78);
    box-shadow: 0 2px 8px rgba(0,0,0,0.38);
    overflow: hidden;
  }
  .ev-map-marker-station.has-logo {
    padding: 0;
    border: 0;
    background: transparent !important;
    box-shadow: none !important;
  }
  .ev-brand-logo {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  .ev-brand-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .ev-station-list-toggle {
    position: absolute;
    bottom: 10px;
    left: 10px;
    width: 30px;
    height: 30px;
    background: rgba(15,23,42,0.92);
    border: 1px solid #334155;
    border-radius: 4px;
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 2;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    user-select: none;
  }
  .ev-station-list-toggle:hover { background: rgba(30,41,59,0.97); }
  .ev-station-list-toggle.active { background: rgba(30,41,59,0.97); border-color: #64748b; }
  .ev-station-list {
    position: absolute;
    bottom: 48px;
    left: 10px;
    width: 210px;
    max-height: calc(50% - 60px);
    overflow-y: auto;
    background: rgba(15,23,42,0.92);
    border: 1px solid #334155;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    z-index: 2;
    display: none;
  }
  .ev-station-list::-webkit-scrollbar { width: 4px; }
  .ev-station-list::-webkit-scrollbar-track { background: transparent; }
  .ev-station-list::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
  .ev-station-list-header {
    padding: 6px 10px;
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #1e293b;
    position: sticky;
    top: 0;
    background: rgba(15,23,42,0.97);
  }
  .ev-station-list-item {
    padding: 7px 10px;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }
  .ev-station-list-item:last-child { border-bottom: none; }
  .ev-station-list-item:hover { background: rgba(30,41,59,0.9); }
  .ev-station-list-item-main {
    flex: 1;
    display: flex;
    align-items: flex-start;
    gap: 6px;
    cursor: pointer;
    min-width: 0;
  }
  .ev-station-list-route-btn {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 1px;
    opacity: 0.5;
  }
  .ev-station-list-route-btn:hover { background: rgba(59,130,246,0.2); opacity: 1; }
  .ev-route-panel {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(10,18,35,0.97);
    border-top: 1px solid #334155;
    z-index: 4;
    display: none;
    padding: 10px 12px 12px;
    backdrop-filter: blur(4px);
  }
  .ev-route-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .ev-route-close {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #64748b;
    border-radius: 4px;
  }
  .ev-route-close:hover { color: #e2e8f0; background: rgba(30,41,59,0.8); }
  .ev-route-name {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: #f1f5f9;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .ev-route-meta {
    font-size: 11px;
    color: #64748b;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .ev-route-meta-sep { color: #334155; }
  .ev-route-apps {
    display: flex;
    gap: 8px;
  }
  .ev-route-app {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 6px 2px;
    border-radius: 10px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: border-color 0.15s;
    text-decoration: none;
  }
  .ev-route-app:hover { border-color: #334155; background: rgba(30,41,59,0.6); }
  .ev-route-app-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
  .ev-route-app-label {
    font-size: 9px;
    color: #94a3b8;
    text-align: center;
    line-height: 1.2;
    white-space: nowrap;
  }
  .ev-station-list-dot {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 1px;
    color: #f8fafc;
    font-size: 7px;
    font-weight: 800;
    line-height: 1;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.55);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ev-station-list-dot.has-logo {
    border: 0;
    background: transparent !important;
  }
  .ev-station-list-name {
    font-size: 11px;
    color: #e2e8f0;
    flex: 1;
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .ev-station-list-dist {
    font-size: 10px;
    color: #64748b;
    white-space: nowrap;
    padding-top: 1px;
  }
  .ev-locate-btn {
    position: absolute;
    top: 96px;
    left: 10px;
    width: 30px;
    height: 30px;
    background: rgba(15,23,42,0.92);
    border: 1px solid #334155;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    user-select: none;
  }
  .ev-locate-btn:hover { background: rgba(30,41,59,0.97); }
  .ev-traffic-toggle {
    position: absolute;
    top: 124px;
    right: 10px;
    width: 30px;
    height: 30px;
    background: rgba(15,23,42,0.92);
    border: 1px solid #334155;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    user-select: none;
  }
  .ev-traffic-toggle:hover { background: rgba(30,41,59,0.97); }
  .ev-traffic-toggle.active { background: rgba(30,41,59,0.97); border-color: #f59e0b; }
  .ev-traffic-toggle.active svg path, .ev-traffic-toggle.active svg circle, .ev-traffic-toggle.active svg rect { stroke: #f59e0b; }
  .ev-pitch-toggle {
    position: absolute;
    top: 86px;
    right: 10px;
    width: 30px;
    height: 30px;
    background: rgba(15,23,42,0.92);
    border: 1px solid #334155;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    user-select: none;
  }
  .ev-pitch-toggle:hover { background: rgba(30,41,59,0.97); }
  .ev-pitch-toggle.active { background: rgba(30,41,59,0.97); border-color: #3b82f6; }
  .ev-pitch-toggle.active svg path { stroke: #3b82f6; }
  .ev-style-toggle {
    position: absolute;
    top: 48px;
    right: 10px;
    width: 30px;
    height: 30px;
    background: rgba(15,23,42,0.92);
    border: 1px solid #334155;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    user-select: none;
  }
  .ev-style-toggle:hover { background: rgba(30,41,59,0.97); }
  .ev-style-toggle.active { background: rgba(30,41,59,0.97); border-color: #64748b; }
  .ev-style-panel {
    position: absolute;
    top: 86px;
    right: 10px;
    width: 148px;
    background: rgba(15,23,42,0.95);
    border: 1px solid #334155;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    z-index: 2;
    display: none;
    overflow: hidden;
  }
  .ev-style-panel-header {
    padding: 6px 10px;
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #1e293b;
  }
  .ev-style-option {
    padding: 8px 10px;
    cursor: pointer;
    font-size: 11px;
    color: #94a3b8;
    border-bottom: 1px solid #1e293b;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .ev-style-option:last-child { border-bottom: none; }
  .ev-style-option:hover { background: rgba(30,41,59,0.9); color: #e2e8f0; }
  .ev-style-option.selected { color: #e2e8f0; }
  .ev-style-option-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    border: 1.5px solid #475569;
    flex-shrink: 0;
  }
  .ev-style-option.selected .ev-style-option-dot {
    background: #3b82f6;
    border-color: #3b82f6;
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
  .ev-popup-card {
    font-family: sans-serif;
    min-width: 210px;
  }
  .ev-popup-header {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 4px;
  }
  .ev-popup-brand {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.6);
    color: #f8fafc;
    font-size: 9px;
    font-weight: 800;
    line-height: 1;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.32);
  }
  .ev-popup-brand.has-logo {
    border: 0;
    background: transparent !important;
    box-shadow: none;
  }
  .ev-popup-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    color: #f1f5f9;
  }
  .ev-popup-route-btn {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    padding: 0;
  }
  .ev-popup-route-btn:hover {
    background: rgba(59,130,246,0.2);
  }
  .ev-popup-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }
  .ev-popup-address {
    margin: 0 0 8px;
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.4;
  }
  .ev-popup-meta {
    margin-bottom: 8px;
    font-size: 11px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .ev-popup-muted {
    color: #64748b;
  }
  .ev-popup-connectors {
    display: flex;
    flex-wrap: wrap;
  }
  .ev-popup-connector {
    display: inline-block;
    padding: 2px 6px;
    margin: 2px;
    background: #1e293b;
    border-radius: 4px;
    font-size: 11px;
    color: #e2e8f0;
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
  private _stationList: HTMLDivElement | null = null
  private _stationListToggle: HTMLDivElement | null = null
  private _stylePanel: HTMLDivElement | null = null
  private _styleToggle: HTMLDivElement | null = null
  private _pitchToggle: HTMLDivElement | null = null
  private _trafficToggle: HTMLDivElement | null = null
  private _locateBtn: HTMLDivElement | null = null
  private _activeStyleId = 'openstreetmap'
  private _pitchEnabled = false
  private _trafficEnabled = false
  private _tomtomKey: string | null = null
  private _routePanel: HTMLDivElement | null = null
  private _routeStation: EVStation | null = null
  private _routeCoords: number[][] | null = null
  private _listOpen = false
  private _initialized = false
  private _centeredOnLocation = false
  private _currentStations: EVStation[] = []

  private static _cachedData: StationsResponse | null = null
  private static _lastCenter: { lat: number; lon: number } | null = null
  private static _lastEntityId: string | null = null
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
    this._stationList = null
    this._stationListToggle = null
    this._stylePanel = null
    this._styleToggle = null
    this._pitchToggle = null
    this._trafficToggle = null
    this._locateBtn = null
    this._pitchEnabled = false
    this._trafficEnabled = false
    this._routePanel = null
    this._routeStation = null
    this._routeCoords = null
    this._listOpen = false
    this._initialized = false
    this._centeredOnLocation = false
    this._currentStations = []
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

      const stationList = document.createElement('div')
      stationList.className = 'ev-station-list'
      const listHeader = document.createElement('div')
      listHeader.className = 'ev-station-list-header'
      listHeader.textContent = 'Stations'
      stationList.appendChild(listHeader)

      const toggle = document.createElement('div')
      toggle.className = 'ev-station-list-toggle'
      toggle.innerHTML = `<svg width="14" height="12" viewBox="0 0 14 12" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="14" height="2" rx="1" fill="#e2e8f0"/><rect y="5" width="14" height="2" rx="1" fill="#e2e8f0"/><rect y="10" width="14" height="2" rx="1" fill="#e2e8f0"/></svg>`
      toggle.addEventListener('click', () => {
        this._listOpen = !this._listOpen
        toggle.classList.toggle('active', this._listOpen)
        if (this._stationList) {
          this._stationList.style.display = this._listOpen && this._currentStations.length > 0 ? 'block' : 'none'
        }
      })

      const styleToggle = document.createElement('div')
      styleToggle.className = 'ev-style-toggle'
      styleToggle.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1L12.5 4L7 7L1.5 4Z" stroke="#e2e8f0" stroke-width="1.2" stroke-linejoin="round" fill="none"/><path d="M1.5 7L7 10L12.5 7" stroke="#e2e8f0" stroke-width="1.2" stroke-linecap="round" fill="none"/><path d="M1.5 10L7 13L12.5 10" stroke="#e2e8f0" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>`

      const stylePanel = document.createElement('div')
      stylePanel.className = 'ev-style-panel'
      const stylePanelHeader = document.createElement('div')
      stylePanelHeader.className = 'ev-style-panel-header'
      stylePanelHeader.textContent = 'Map Style'
      stylePanel.appendChild(stylePanelHeader)

      for (const s of MAP_STYLES) {
        const opt = document.createElement('div')
        opt.className = 'ev-style-option' + (s.id === this._activeStyleId ? ' selected' : '')
        opt.dataset.styleId = s.id
        const dot = document.createElement('div')
        dot.className = 'ev-style-option-dot'
        const label = document.createElement('span')
        label.textContent = s.label
        opt.appendChild(dot)
        opt.appendChild(label)
        opt.addEventListener('click', () => {
          this._applyMapStyle(s.id)
          stylePanel.style.display = 'none'
          styleToggle.classList.remove('active')
        })
        stylePanel.appendChild(opt)
      }

      styleToggle.addEventListener('click', () => {
        const open = stylePanel.style.display === 'block'
        stylePanel.style.display = open ? 'none' : 'block'
        styleToggle.classList.toggle('active', !open)
      })

      const pitchToggle = document.createElement('div')
      pitchToggle.className = 'ev-pitch-toggle'
      pitchToggle.title = '3D view'
      pitchToggle.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1L12.5 4L7 7L1.5 4Z" stroke="#e2e8f0" stroke-width="1.2" stroke-linejoin="round"/><path d="M1.5 4L1.5 9L7 12L7 7Z" stroke="#e2e8f0" stroke-width="1.2" stroke-linejoin="round"/><path d="M12.5 4L12.5 9L7 12L7 7Z" stroke="#e2e8f0" stroke-width="1.2" stroke-linejoin="round"/></svg>`
      pitchToggle.addEventListener('click', () => {
        this._setPitch(!this._pitchEnabled)
      })

      const locateBtn = document.createElement('div')
      locateBtn.className = 'ev-locate-btn'
      locateBtn.title = 'Fly to my location'
      locateBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="7" cy="7" r="3" stroke="#e2e8f0" stroke-width="1.2"/><line x1="7" y1="0.5" x2="7" y2="3.5" stroke="#e2e8f0" stroke-width="1.2" stroke-linecap="round"/><line x1="7" y1="10.5" x2="7" y2="13.5" stroke="#e2e8f0" stroke-width="1.2" stroke-linecap="round"/><line x1="0.5" y1="7" x2="3.5" y2="7" stroke="#e2e8f0" stroke-width="1.2" stroke-linecap="round"/><line x1="10.5" y1="7" x2="13.5" y2="7" stroke="#e2e8f0" stroke-width="1.2" stroke-linecap="round"/></svg>`
      locateBtn.addEventListener('click', () => this._flyToCurrentLocation())

      const trafficToggle = document.createElement('div')
      trafficToggle.className = 'ev-traffic-toggle'
      trafficToggle.title = 'Traffic overlay'
      trafficToggle.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="4.5" width="11" height="5" rx="1.5" stroke="#e2e8f0" stroke-width="1.2"/><path d="M3 4.5L4.2 2H9.8L11 4.5" stroke="#e2e8f0" stroke-width="1.2" stroke-linejoin="round"/><circle cx="3.5" cy="10" r="1.5" stroke="#e2e8f0" stroke-width="1.2"/><circle cx="10.5" cy="10" r="1.5" stroke="#e2e8f0" stroke-width="1.2"/></svg>`
      trafficToggle.addEventListener('click', () => this._toggleTraffic())

      const routePanel = document.createElement('div')
      routePanel.className = 'ev-route-panel'

      wrap.appendChild(mapContainer)
      wrap.appendChild(stationList)
      wrap.appendChild(toggle)
      wrap.appendChild(stylePanel)
      wrap.appendChild(styleToggle)
      wrap.appendChild(pitchToggle)
      wrap.appendChild(locateBtn)
      wrap.appendChild(trafficToggle)
      wrap.appendChild(routePanel)
      card.appendChild(wrap)
      this._root.replaceChildren(style, card)

      this._wrap = wrap
      this._mapContainer = mapContainer
      this._stationList = stationList
      this._stationListToggle = toggle
      this._stylePanel = stylePanel
      this._styleToggle = styleToggle
      this._pitchToggle = pitchToggle
      this._locateBtn = locateBtn
      this._trafficToggle = trafficToggle
      this._routePanel = routePanel
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

    const initialStyle = MAP_STYLES.find((s) => s.id === this._activeStyleId) ?? MAP_STYLES[0]
    this._map = new maplibregl.Map({
      container: this._mapContainer,
      style: initialStyle.style,
      center: THAILAND_CENTER,
      zoom: 10,
      pitch: initialStyle.pitch ?? 0,
      attributionControl: {},
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
      this._fetchConfig()
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

  private _positionUnchanged(lat: number, lon: number): boolean {
    if (!EVMapCard._lastCenter) return false
    const EPSILON = 0.0001 // ~11 m
    return Math.abs(lat - EVMapCard._lastCenter.lat) <= EPSILON && Math.abs(lon - EVMapCard._lastCenter.lon) <= EPSILON
  }

  private async _fetchAndUpdate() {
    if (!this._hass) return

    if (EVMapCard._cachedData && EVMapCard._lastEntityId) {
      const state = this._hass.states[EVMapCard._lastEntityId]
      const lat = state?.attributes?.latitude
      const lon = state?.attributes?.longitude
      if (lat !== undefined && lon !== undefined && this._positionUnchanged(lat, lon)) {
        this._renderStations(EVMapCard._cachedData)
        return
      }
    }

    try {
      const data: StationsResponse = await this._hass.callApi('GET', 'ha_ev_map/stations')
      EVMapCard._cachedData = data
      EVMapCard._lastCenter = { lat: data.center.latitude, lon: data.center.longitude }
      EVMapCard._lastEntityId = data.center.entityId
      this._renderStations(data)
    } catch {
      // map stays visible if request fails
    }
  }

  private _renderStations(data: StationsResponse) {
    if (!this._map) return

    this._clearStationMarkers()

    const { latitude, longitude, heading } = data.center

    if (this._locationMarker) {
      this._locationMarker.setLngLat([longitude, latitude])
      this._updateLocationHeading(heading)
    } else {
      this._locationMarker = new maplibregl.Marker({
        element: this._createMarkerElement('location', undefined, heading),
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
      const color = this._stationMarkerColor(station)
      const marker = new maplibregl.Marker({
        element: this._createMarkerElement('station', color, station),
        anchor: 'center',
      })
        .setLngLat([station.lon, station.lat])
        .setPopup(
          new maplibregl.Popup({ className: 'ev-map-popup', maxWidth: '280px' }).setDOMContent(
            this._createStationPopupContent(station),
          ),
        )
        .addTo(this._map)

      this._stationMarkers.push(marker)
    }

    this._currentStations = data.stations
    this._updateStationList()
  }

  private _createMarkerElement(type: 'location', color?: string, heading?: number | null): HTMLDivElement
  private _createMarkerElement(type: 'station', color?: string, station?: EVStation): HTMLDivElement
  private _createMarkerElement(type: 'location' | 'station', color?: string, detail?: EVStation | number | null) {
    const element = document.createElement('div')
    element.className = `ev-map-marker ev-map-marker-${type}`

    if (type === 'location') {
      const heading = typeof detail === 'number' ? detail : null
      if (heading !== null) {
        const arrow = document.createElement('span')
        arrow.className = 'ev-map-marker-location-heading'
        arrow.style.transform = `translateX(-50%) rotate(${heading}deg)`
        element.appendChild(arrow)
      }
    } else if (color) {
      element.style.background = color
      element.style.boxShadow = `0 0 6px ${color}80`
      const station = detail && typeof detail === 'object' ? detail : undefined
      element.title = station?.brand || station?.name || 'EV station'
      if (this._stationLogoPath(station)) element.classList.add('has-logo')
      element.appendChild(this._createBrandVisual(station))
    }

    return element
  }

  private _updateLocationHeading(heading?: number | null) {
    const element = this._locationMarker?.getElement()
    if (!element) return

    let arrow = element.querySelector<HTMLElement>('.ev-map-marker-location-heading')
    if (typeof heading !== 'number') {
      arrow?.remove()
      return
    }

    if (!arrow) {
      arrow = document.createElement('span')
      arrow.className = 'ev-map-marker-location-heading'
      element.appendChild(arrow)
    }
    arrow.style.transform = `translateX(-50%) rotate(${heading}deg)`
  }

  private _stationMarkerLabel(station?: EVStation) {
    const text = (station?.brand || station?.name || 'EV').trim()
    const words = text.match(/[A-Za-z0-9]+/g) ?? []
    if (words.length >= 2) return `${words[0]![0]}${words[1][0]}`.toUpperCase()
    return (words[0] ?? text).slice(0, 3).toUpperCase()
  }

  private _stationMarkerColor(station: EVStation) {
    return STATUS_COLOR[station.status] ?? STATUS_COLOR['unknown']
  }

  private _stationLogoPath(station?: EVStation) {
    const haystack = this._normaliseBrandText(`${station?.brand ?? ''} ${station?.name ?? ''}`)
    if (!haystack) return undefined

    const logo = BRAND_LOGOS.find((entry) =>
      entry.aliases.some((alias) => haystack.includes(this._normaliseBrandText(alias))),
    )
    return logo?.path
  }

  private _normaliseBrandText(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9+]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private _createBrandVisual(station?: EVStation) {
    const logoPath = this._stationLogoPath(station)
    if (logoPath) {
      const img = document.createElement('img')
      img.className = 'ev-brand-logo'
      img.src = `/ha_ev_map/${logoPath}`
      img.alt = station?.brand || station?.name || 'EV station'
      img.loading = 'lazy'
      img.addEventListener('error', () => {
        img.replaceWith(this._createBrandFallback(station))
      })
      return img
    }
    return this._createBrandFallback(station)
  }

  private _createBrandFallback(station?: EVStation) {
    const fallback = document.createElement('span')
    fallback.className = 'ev-brand-fallback'
    fallback.textContent = this._stationMarkerLabel(station)
    return fallback
  }

  private _createStationPopupContent(station: EVStation) {
    const content = document.createElement('div')
    content.className = 'ev-popup-card'

    const header = document.createElement('div')
    header.className = 'ev-popup-header'

    const brand = document.createElement('div')
    brand.className = 'ev-popup-brand'
    if (this._stationLogoPath(station)) {
      brand.classList.add('has-logo')
    } else {
      brand.style.background = this._stationMarkerColor(station)
    }
    brand.appendChild(this._createBrandVisual(station))

    const title = document.createElement('h3')
    title.className = 'ev-popup-title'
    title.textContent = station.name

    const routeBtn = document.createElement('button')
    routeBtn.className = 'ev-popup-route-btn'
    routeBtn.type = 'button'
    routeBtn.title = 'Get route'
    routeBtn.setAttribute('aria-label', `Get route to ${station.name}`)
    routeBtn.innerHTML = ROUTE_ICON_SVG
    routeBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      this._requestRoute(station)
    })

    header.appendChild(brand)
    header.appendChild(title)

    const address = document.createElement('p')
    address.className = 'ev-popup-address'
    address.textContent = station.address

    const meta = document.createElement('div')
    meta.className = 'ev-popup-meta'

    const status = document.createElement('span')
    const statusLabel = document.createElement('span')
    statusLabel.className = 'ev-popup-muted'
    statusLabel.textContent = 'Status: '
    status.appendChild(statusLabel)
    status.appendChild(document.createTextNode(STATUS_LABEL[station.status] ?? 'Unknown'))

    const distance = document.createElement('span')
    distance.className = 'ev-popup-muted'
    distance.textContent = `${station.distanceKm} km`

    meta.appendChild(status)
    meta.appendChild(distance)

    const connectors = document.createElement('div')
    connectors.className = 'ev-popup-connectors'

    if (station.connectors.length > 0) {
      for (const connector of station.connectors) {
        const chip = document.createElement('span')
        chip.className = 'ev-popup-connector'
        chip.textContent = `${connector.type}${connector.powerKW > 0 ? ` ${connector.powerKW} kW` : ''}`
        connectors.appendChild(chip)
      }
    } else {
      const empty = document.createElement('span')
      empty.className = 'ev-popup-muted'
      empty.style.fontSize = '11px'
      empty.textContent = 'No connector data'
      connectors.appendChild(empty)
    }

    content.appendChild(header)
    content.appendChild(address)
    content.appendChild(meta)
    content.appendChild(connectors)

    const footer = document.createElement('div')
    footer.className = 'ev-popup-footer'
    footer.appendChild(routeBtn)
    content.appendChild(footer)

    return content
  }

  private async _fetchConfig() {
    if (this._tomtomKey || !this._hass) return
    try {
      const cfg = await this._hass.callApi('GET', 'ha_ev_map/config')
      this._tomtomKey = (cfg as { tomtom_key: string }).tomtom_key
    } catch {
      // traffic stays disabled if config fetch fails
    }
  }

  private _flyToCurrentLocation() {
    if (!this._map || !EVMapCard._cachedData) return
    const { latitude, longitude } = EVMapCard._cachedData.center
    this._map.flyTo({ center: [longitude, latitude], zoom: 15, essential: true })
  }

  private _toggleTraffic() {
    if (!this._tomtomKey) return
    this._trafficEnabled = !this._trafficEnabled
    this._trafficToggle?.classList.toggle('active', this._trafficEnabled)
    if (this._trafficEnabled) {
      this._addTrafficLayer()
    } else {
      this._removeTrafficLayer()
    }
  }

  private _addTrafficLayer() {
    if (!this._map || !this._tomtomKey) return
    if (this._map.getSource('tomtom-traffic')) return
    this._map.addSource('tomtom-traffic', {
      type: 'raster',
      tiles: [
        `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${this._tomtomKey}&tileSize=256`,
      ],
      tileSize: 256,
    })
    this._map.addLayer({ id: 'tomtom-traffic', type: 'raster', source: 'tomtom-traffic', paint: { 'raster-opacity': 0.75 } })
  }

  private _removeTrafficLayer() {
    if (!this._map) return
    if (this._map.getLayer('tomtom-traffic')) this._map.removeLayer('tomtom-traffic')
    if (this._map.getSource('tomtom-traffic')) this._map.removeSource('tomtom-traffic')
  }

  private _applyMapStyle(id: string) {
    if (!this._map || id === this._activeStyleId) return
    const entry = MAP_STYLES.find((s) => s.id === id)
    if (!entry) return
    this._activeStyleId = id
    this._map.setStyle(entry.style as maplibregl.StyleSpecification | string)
    this._map.once('style.load', () => {
      if (entry.pitch !== undefined) this._setPitch(entry.pitch > 0)
      if (this._trafficEnabled) this._addTrafficLayer()
      if (this._routeCoords) this._drawRoute(this._routeCoords)
    })
    if (this._stylePanel) {
      for (const el of this._stylePanel.querySelectorAll<HTMLElement>('.ev-style-option')) {
        el.classList.toggle('selected', el.dataset.styleId === id)
      }
    }
  }

  private _setPitch(enabled: boolean) {
    if (!this._map) return
    this._pitchEnabled = enabled
    this._map.easeTo({ pitch: enabled ? 45 : 0, duration: 600 })
    this._pitchToggle?.classList.toggle('active', enabled)
  }

  private async _requestRoute(station: EVStation) {
    if (!this._hass || !this._map) return
    try {
      const data = await this._hass.callApi(
        'GET',
        `ha_ev_map/route?to_lat=${station.lat}&to_lon=${station.lon}`,
      ) as { distanceKm: number; durationMin: number; geojson: { type: string; coordinates: number[][] } }
      this._routeStation = station
      this._routeCoords = data.geojson.coordinates
      this._drawRoute(this._routeCoords)
      this._showRoutePanel(station, data.distanceKm, data.durationMin)
    } catch {
      // silently fail — map stays in current state
    }
  }

  private _drawRoute(coords: number[][]) {
    if (!this._map) return
    this._clearRoute()
    const geojson: maplibregl.GeoJSONSourceSpecification = {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
    }
    this._map.addSource('ev-route', geojson)
    this._map.addLayer({ id: 'ev-route-shadow', type: 'line', source: 'ev-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#000', 'line-width': 8, 'line-opacity': 0.25 } })
    this._map.addLayer({ id: 'ev-route-line', type: 'line', source: 'ev-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#3b82f6', 'line-width': 4.5 } })
  }

  private _clearRoute() {
    if (!this._map) return
    for (const id of ['ev-route-line', 'ev-route-shadow']) {
      if (this._map.getLayer(id)) this._map.removeLayer(id)
    }
    if (this._map.getSource('ev-route')) this._map.removeSource('ev-route')
  }

  private _showRoutePanel(station: EVStation, distanceKm: number, durationMin: number) {
    if (!this._routePanel) return

    this._routePanel.innerHTML = ''

    // info row
    const info = document.createElement('div')
    info.className = 'ev-route-info'

    const closeBtn = document.createElement('div')
    closeBtn.className = 'ev-route-close'
    closeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1L11 11M11 1L1 11" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/></svg>`
    closeBtn.addEventListener('click', () => {
      this._clearRoute()
      this._routeStation = null
      this._routeCoords = null
      if (this._routePanel) this._routePanel.style.display = 'none'
    })

    const name = document.createElement('div')
    name.className = 'ev-route-name'
    name.textContent = station.name

    const meta = document.createElement('div')
    meta.className = 'ev-route-meta'
    meta.innerHTML = `<span>${distanceKm} km</span><span class="ev-route-meta-sep">·</span><span>${durationMin} min</span>`

    info.appendChild(closeBtn)
    info.appendChild(name)
    info.appendChild(meta)

    // app buttons row
    const apps = document.createElement('div')
    apps.className = 'ev-route-apps'

    const appDefs = [
      {
        label: 'Apple Maps',
        bg: 'linear-gradient(145deg,#34d399 0%,#60a5fa 58%,#f87171 100%)',
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3.5 5.2L7.6 3.6L12.4 5.2L16.5 3.6V14.8L12.4 16.4L7.6 14.8L3.5 16.4V5.2Z" fill="white" fill-opacity="0.9"/><path d="M7.6 3.6V14.8M12.4 5.2V16.4" stroke="#1e293b" stroke-opacity="0.25" stroke-width="1"/><path d="M5 11.8C6.9 9.8 8.9 9 11 9.2C12.5 9.3 13.6 8.8 15 7.2" stroke="#2563eb" stroke-width="1.4" stroke-linecap="round"/><circle cx="15" cy="7.2" r="1.4" fill="#ef4444"/></svg>`,
        url: `https://maps.apple.com/?daddr=${station.lat},${station.lon}&dirflg=d`,
      },
      {
        label: 'Google Maps',
        bg: 'linear-gradient(145deg,#4285F4,#34A853)',
        icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1C5.69 1 3 3.69 3 7c0 4.5 6 10 6 10s6-5.5 6-10c0-3.31-2.69-6-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z" fill="white"/>  </svg>`,
        url: `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}&travelmode=driving`,
      },
      {
        label: 'AMap',
        bg: 'linear-gradient(145deg,#0097A7,#00BCD4)',
        icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1C5.69 1 3 3.69 3 7c0 4.5 6 10 6 10s6-5.5 6-10c0-3.31-2.69-6-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z" fill="white"/></svg>`,
        url: `https://uri.amap.com/navigation?to=${station.lon},${station.lat},${encodeURIComponent(station.name)}&mode=driving&callnative=1`,
      },
      {
        label: 'Waze',
        bg: 'linear-gradient(145deg,#33CCFF,#0099CC)',
        icon: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="8" r="5.5" stroke="white" stroke-width="1.5"/><circle cx="6.5" cy="7" r="1" fill="white"/><circle cx="11.5" cy="7" r="1" fill="white"/><path d="M6.5 10c.5 1 4 1 5 0" stroke="white" stroke-width="1.2" stroke-linecap="round"/></svg>`,
        url: `https://waze.com/ul?ll=${station.lat},${station.lon}&navigate=yes`,
      },
    ]

    for (const app of appDefs) {
      const btn = document.createElement('a')
      btn.className = 'ev-route-app'
      btn.href = app.url
      btn.target = '_blank'
      btn.rel = 'noopener'

      const icon = document.createElement('div')
      icon.className = 'ev-route-app-icon'
      icon.style.background = app.bg
      icon.innerHTML = app.icon

      const label = document.createElement('div')
      label.className = 'ev-route-app-label'
      label.textContent = app.label

      btn.appendChild(icon)
      btn.appendChild(label)
      apps.appendChild(btn)
    }

    this._routePanel.appendChild(info)
    this._routePanel.appendChild(apps)
    this._routePanel.style.display = 'block'
  }

  private _updateStationList() {
    if (!this._stationList) return

    // remove all items except the sticky header
    while (this._stationList.children.length > 1) {
      this._stationList.removeChild(this._stationList.lastChild!)
    }

    if (this._currentStations.length === 0) {
      this._stationList.style.display = 'none'
      if (this._stationListToggle) this._stationListToggle.style.display = 'none'
      return
    }

    if (this._stationListToggle) this._stationListToggle.style.display = 'flex'
    this._stationList.style.display = this._listOpen ? 'block' : 'none'

    for (let i = 0; i < this._currentStations.length; i++) {
      const station = this._currentStations[i]
      const color = this._stationMarkerColor(station)

      const item = document.createElement('div')
      item.className = 'ev-station-list-item'

      // clickable main area: dot + name + dist
      const main = document.createElement('div')
      main.className = 'ev-station-list-item-main'
      main.addEventListener('click', () => this._flyToStation(i))

      const dot = document.createElement('div')
      dot.className = 'ev-station-list-dot'
      if (this._stationLogoPath(station)) {
        dot.classList.add('has-logo')
      } else {
        dot.style.background = color
      }
      dot.title = station.brand || station.name
      dot.appendChild(this._createBrandVisual(station))

      const name = document.createElement('span')
      name.className = 'ev-station-list-name'
      name.textContent = station.name

      const dist = document.createElement('span')
      dist.className = 'ev-station-list-dist'
      dist.textContent = `${station.distanceKm} km`

      main.appendChild(dot)
      main.appendChild(name)
      main.appendChild(dist)

      // route button
      const routeBtn = document.createElement('div')
      routeBtn.className = 'ev-station-list-route-btn'
      routeBtn.title = 'Get route'
      routeBtn.innerHTML = ROUTE_ICON_SVG
      routeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this._requestRoute(station)
      })

      item.appendChild(main)
      item.appendChild(routeBtn)
      this._stationList.appendChild(item)
    }
  }

  private _flyToStation(index: number) {
    if (!this._map) return
    const station = this._currentStations[index]
    if (!station) return

    this._map.flyTo({ center: [station.lon, station.lat], zoom: 16, essential: true })

    const marker = this._stationMarkers[index]
    if (marker) {
      for (const m of this._stationMarkers) m.getPopup()?.remove()
      setTimeout(() => marker.togglePopup(), 600)
    }
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
