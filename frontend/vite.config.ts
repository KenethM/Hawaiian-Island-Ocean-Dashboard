import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Hawaii Coral Reef Dashboard',
        short_name: 'ReefWatch',
        description: 'Live NOAA ocean data and diver observations for Hawaiian reef sites',
        theme_color: '#0c4a6e',
        background_color: '#ffffff',
        display: 'standalone',
        scope: base,
        start_url: base,
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // navigateFallback disabled — SPA routing handled by the 404.html
        // copy in the deploy workflow; enabling it causes workbox to try
        // serving a non-precached URL when the app is at a subpath.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-z]+\.tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 86400 * 7 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
