import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  // GitHub Pages serves from /Subsea-Pulse-Cesium-/
  base: '/Subsea-Pulse-Cesium-/',
  plugins: [
    cesium(), // Handles Cesium static asset (Workers, Assets, Widgets) copying
  ],
  build: {
    // Increase the chunk size warning limit for CesiumJS (it's a large library)
    chunkSizeWarningLimit: 5000,
  },
  server: {
    port: 5173,
    open: true,
  },
});
