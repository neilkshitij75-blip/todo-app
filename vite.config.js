import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Icons/splash live in public/ and are copied as-is; make sure the SW
      // precaches the ones the browser actually requests.
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'apple-touch-icon-180x180.png',
        'apple-splash-*.png',
      ],
      manifest: {
        name: 'My Tasks',
        short_name: 'Tasks',
        description: 'A fast, offline-ready personal task list.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#863bff',
        background_color: '#863bff',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell: precache the built JS/CSS/HTML so launch is instant offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Supabase reads (GET): serve last-known tasks when offline.
            urlPattern: ({ url, request }) =>
              url.hostname.endsWith('.supabase.co') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-reads',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase writes (POST/PATCH/DELETE): queue while offline and
            // replay automatically once the connection is back.
            urlPattern: ({ url, request }) =>
              url.hostname.endsWith('.supabase.co') && request.method !== 'GET',
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'supabase-writes',
                options: { maxRetentionTime: 60 * 24 }, // minutes (24h)
              },
            },
          },
        ],
      },
      devOptions: {
        // Toggle to true if you want to exercise the SW under `vite dev`.
        enabled: false,
      },
    }),
  ],
})
