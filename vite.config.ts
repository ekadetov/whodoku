/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/whodoku/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Whodoku',
        short_name: 'Whodoku',
        description: 'A free daily murder-mystery logic puzzle.',
        start_url: '/whodoku/',
        scope: '/whodoku/',
        display: 'standalone',
        background_color: '#fbf8f1',
        theme_color: '#7a2e3b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
  },
})
