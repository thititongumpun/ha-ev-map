import './ev-map-card'

const status = document.getElementById('dev-status')

const hass = {
  states: {},
  async callApi(method: string, path: string) {
    if (method !== 'GET') throw new Error(`Unsupported method ${method}`)

    const response = await fetch(`/dev-api/${path}`)
    const contentType = response.headers.get('content-type') ?? ''
    const data = contentType.includes('application/json') ? await response.json() : await response.text()

    if (!response.ok) {
      const message = typeof data === 'object' && data && 'message' in data ? String(data.message) : String(data)
      if (status) status.textContent = `Real data failed: ${message}`
      throw new Error(message)
    }

    if (path === 'ha_ev_map/stations' && status) {
      const count = Array.isArray(data.stations) ? data.stations.length : 0
      status.textContent = `Loaded ${count} real stations from Home Assistant.`
    }

    return data
  },
}

const card = document.querySelector('ev-map-card') as HTMLElement & {
  setConfig(config: Record<string, unknown>): void
  hass: typeof hass
}

card.setConfig({
  type: 'custom:ev-map-card',
  aspect_ratio: '16:9',
})
card.hass = hass
