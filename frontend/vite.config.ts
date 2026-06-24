import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Hawaii Coral Reef Dashboard',
        short_name: 'ReefWatch',
        description: 'Live NOAA ocean data and diver observations for Hawaiian reef sites',
        theme_color: '#0c4a6e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Cache static assets; skip API calls (live data must be fresh)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
        navigateFallback: '/index.html',
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
