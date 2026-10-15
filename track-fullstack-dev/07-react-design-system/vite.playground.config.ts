import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Simple demo page (used when Storybook is not available). `npm run dev`.
export default defineConfig({ root: 'playground', plugins: [react()], build: { outDir: '../playground-dist' } });
