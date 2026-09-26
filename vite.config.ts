/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    // Three.js ocupa ~900 kB por sí solo; va en su propio chunk cacheable
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Three.js y R3F en un chunk propio: cachea mejor entre despliegues
        manualChunks: (id) => (/node_modules[\\/](three|@react-three)[\\/]/.test(id) ? 'three' : undefined),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
