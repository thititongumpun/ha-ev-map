import { defineConfig, loadEnv } from 'vite'
import { createReadStream, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const contentType: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const haUrl = env.HOME_ASSISTANT_URL?.replace(/\/$/, '')
  const haToken = env.HOME_ASSISTANT_TOKEN

  return {
  publicDir: false,
  plugins: [
    {
      name: 'ha-ev-map-dev-server',
      configureServer(server) {
        server.middlewares.use('/dev-api', async (req, res) => {
          if (!haUrl || !haToken) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ message: 'Set HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN in .env.local' }))
            return
          }

          try {
            const url = new URL(req.url ?? '', 'http://localhost')
            const target = `${haUrl}/api${url.pathname}${url.search}`
            const response = await fetch(target, {
              method: req.method,
              headers: {
                Authorization: `Bearer ${haToken}`,
                'Content-Type': 'application/json',
              },
            })

            res.statusCode = response.status
            res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json')
            res.end(await response.text())
          } catch (error) {
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ message: error instanceof Error ? error.message : String(error) }))
          }
        })

        server.middlewares.use('/ha_ev_map/brand', (req, res, next) => {
          const url = new URL(req.url ?? '', 'http://localhost')
          const fileName = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
          const filePath = join(process.cwd(), 'custom_components/ha_ev_map/www/brand', fileName)

          if (!existsSync(filePath)) {
            next()
            return
          }

          res.setHeader('Content-Type', contentType[extname(filePath)] ?? 'application/octet-stream')
          createReadStream(filePath).pipe(res)
        })
      },
    },
  ],
  build: {
    lib: {
      entry: 'src/ev-map-card.ts',
      formats: ['iife'],
      name: 'EVMapCard',
      fileName: () => 'ev-map-card.js',
    },
    outDir: 'custom_components/ha_ev_map/www',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  }
})
