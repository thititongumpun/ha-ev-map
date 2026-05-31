import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
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
})
