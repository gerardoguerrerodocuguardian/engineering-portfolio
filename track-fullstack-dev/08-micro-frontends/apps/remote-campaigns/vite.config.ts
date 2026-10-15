import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'remote_campaigns',
      filename: 'remoteEntry.js',
      exposes: { './Campaigns': './src/Campaigns.tsx' },
      // Singleton: exactly one React instance across shell + remotes (hooks break with two).
      shared: {
        react: { singleton: true, requiredVersion: '^18.3.1' },
        'react-dom': { singleton: true, requiredVersion: '^18.3.1' },
      },
      dts: false,
    }),
  ],
  server: { port: 5171, cors: true, origin: 'http://localhost:5171' },
  preview: { port: 5171, cors: true },
  build: { target: 'esnext' },
});
