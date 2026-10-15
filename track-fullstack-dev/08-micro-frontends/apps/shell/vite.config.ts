import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

// The shell declares NO static remotes: they are registered at runtime from /manifest.json,
// so a remote can be redeployed (or rolled back) without rebuilding the shell.
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'shell',
      remotes: {},
      shared: {
        react: { singleton: true, requiredVersion: '^18.3.1' },
        'react-dom': { singleton: true, requiredVersion: '^18.3.1' },
      },
      dts: false,
    }),
  ],
  server: { port: 5170, cors: true },
  preview: { port: 5170, cors: true },
  build: { target: 'esnext' },
});
