import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const api = process.env['API_URL'] ?? 'http://127.0.0.1:8787';
const proxy = { '/api': { target: api, changeOrigin: true, ws: true, rewrite: (p: string) => p.replace(/^\/api/, '') } };

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'AdFlow Retail POS',
        short_name: 'AdFlow POS',
        description: 'Offline-first point of sale (demo, synthetic data)',
        theme_color: '#0f3d3e',
        background_color: '#f4f1ea',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg}'] },
    }),
  ],
  server: { proxy },
  preview: { port: 4173, proxy },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
