import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'NoteDoco',
        short_name: 'NoteDoco',
        description: 'Privacy-first, 100% client-side notes, checklists, and project organisation.',
        scope: './',
        start_url: './',
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
  },
})
