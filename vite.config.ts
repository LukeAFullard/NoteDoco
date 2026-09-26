import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        navigateFallback: `${base}index.html`,
        // v2 is served from ${base}next/ with its own service worker; don't answer its navigations with v1.
        navigateFallbackDenylist: [new RegExp(`^${base}next/`)],
      },
      manifest: {
        name: 'NoteDoco',
        short_name: 'NoteDoco',
        description: 'Privacy-first, 100% client-side notes, checklists, and project organisation.',
        background_color: '#10161C',
        theme_color: '#10161C',
        icons: [
          { src: 'pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'pwa-512x512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // app/ is v2 with its own test setup.
    exclude: ['**/node_modules/**', 'app/**'],
  },
})
