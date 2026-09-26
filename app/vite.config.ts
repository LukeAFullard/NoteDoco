import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// v2 is served from /NoteDoco/next/ on GitHub Pages until it replaces v1 (see docs/decisions/0002).
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version} (${new Date().toISOString().slice(0, 10)})`),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": an update never reloads the page mid-edit; the app asks first.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Opens the item when a reminder notification is clicked.
        importScripts: ['sw-notifications.js'],
      },
      manifest: {
        name: 'NoteDoco',
        short_name: 'NoteDoco',
        description: 'Notes, handwriting, sticky notes and a timeline. Private and offline.',
        background_color: '#10161C',
        theme_color: '#10161C',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'pwa-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
          { name: 'New note', short_name: 'Note', url: '#/new/note' },
          { name: 'New sticky', short_name: 'Sticky', url: '#/new/sticky' },
          { name: 'Ink lab', short_name: 'Ink', url: '#/lab/ink' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
