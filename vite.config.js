import { defineConfig } from 'vite';

// Cesium version pinned to match installed npm package
const CESIUM_VERSION = '1.115.0';
const CESIUM_CDN = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

export default defineConfig({
  // GitHub Pages serves from /Subsea-Pulse-Cesium-/
  base: '/Subsea-Pulse-Cesium-/',

  plugins: [
    // Inject Cesium CDN scripts into HTML for both dev and production.
    // Avoids shipping the 14 MB Cesium Workers bundle in the deploy.
    {
      name: 'cesium-cdn-inject',
      transformIndexHtml() {
        return [
          {
            tag: 'link',
            attrs: {
              rel: 'stylesheet',
              href: `${CESIUM_CDN}/Widgets/widgets.css`,
            },
            injectTo: 'head-prepend',
          },
          {
            tag: 'script',
            attrs: { src: `${CESIUM_CDN}/Cesium.js` },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  ],

  server: {
    port: 5173,
    open: true,
  },
});
