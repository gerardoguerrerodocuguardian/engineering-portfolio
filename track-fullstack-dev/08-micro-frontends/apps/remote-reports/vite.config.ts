import { defineConfig } from 'vite';

// Build = a single self-registering ES module (library mode). No React, no federation runtime:
// the contract with the shell is "define <adflow-reports>, set .tokenProvider, listen to the bus".
export default defineConfig({
  build: {
    target: 'esnext',
    lib: { entry: 'src/main.ts', formats: ['es'], fileName: () => 'adflow-reports.js' },
  },
  server: { port: 5172, cors: true },
  preview: { port: 5172, cors: true },
});
