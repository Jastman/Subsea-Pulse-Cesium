import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

// Always match CDN version to the installed npm package
const { version: CESIUM_VERSION } = JSON.parse(
  readFileSync('./node_modules/cesium/package.json', 'utf8')
);

// jsDelivr serves npm packages directly — guaranteed to match the installed version
const CESIUM_CDN = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium`;

export default defineConfig({
  // GitHub Pages serves from /Subsea-Pulse-Cesium-/
  base: '/Subsea-Pulse-Cesium-/',

  plugins: [
    {
      name: 'cesium-cdn-inject',
      transformIndexHtml() {
        return [
          {
            tag: 'link',
            attrs: { rel: 'stylesheet', href: `${CESIUM_CDN}/Widgets/widgets.css` },
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
