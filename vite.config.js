import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png', 'third-party-notices.txt'],
      manifest: {
        id: '.',
        name: 'ACG Collector',
        short_name: 'ACG',
        description: 'Personal Collector app for Anime, Comics, and Games merchandise.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        lang: 'zh-TW',
        categories: ['lifestyle', 'utilities'],
        theme_color: '#0f1115',
        background_color: '#0f1115',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,jpg}'],
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
  }
});
