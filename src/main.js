/**
 * main.js — Subsea Pulse entry point
 *
 * Initialises the CesiumJS viewer, loads cable data, wires up UI controls,
 * and starts the latency simulation.
 */

// Cesium is loaded as a global via CDN <script> in index.html
/* global Cesium */

import { fetchCables, buildCableEntities, findPickedCable } from './CableLoader.js';
import { LatencySimulator } from './LatencySimulator.js';
import {
  setLoadStatus,
  hideLoadingOverlay,
  updateHUD,
  setCableCount,
  showCableSidebar,
  hideCableSidebar,
  initStressSlider,
  initYearSlider,
  initSidebarClose,
} from './UI.js';

// ─── Cesium Ion Token ─────────────────────────────────────────────────────────
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

// ─── Shared mutable state objects (passed by reference to CableLoader) ────────
const sharedUniforms = { speed: 1.0, intensity: 1.2, stress: 0.0 };
const yearFilter     = { maxYear: 2025 };

// ─── Viewer ──────────────────────────────────────────────────────────────────

setLoadStatus('Initializing globe…');

const viewer = new Cesium.Viewer('cesiumContainer', {
  animation:             false,
  baseLayerPicker:       false,
  fullscreenButton:      false,
  geocoder:              false,
  homeButton:            false,
  infoBox:               false,
  sceneModePicker:       false,
  selectionIndicator:    false,
  timeline:              false,
  navigationHelpButton:  false,
  navigationInstructionsInitiallyVisible: false,
  creditContainer:       document.createElement('div'),
  terrainProvider: new Cesium.EllipsoidTerrainProvider(),
});

viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0B0E14');
viewer.scene.skyBox.show      = true;
viewer.scene.sun.show         = false;
viewer.scene.moon.show        = false;
viewer.scene.skyAtmosphere.show = true;
viewer.scene.globe.baseColor             = Cesium.Color.fromCssColorString('#0d1117');
viewer.scene.globe.showGroundAtmosphere  = false;
viewer.scene.globe.enableLighting        = false;

async function initTerrain() {
  setLoadStatus('Loading bathymetry terrain…');
  try {
    const terrain = await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
      requestWaterMask: false,
      requestVertexNormals: false,
    });
    viewer.terrainProvider = terrain;
  } catch (err) {
    console.warn('Bathymetry terrain unavailable, using ellipsoid:', err.message);
  }

  try {
    viewer.scene.globe.translucency.enabled        = true;
    viewer.scene.globe.translucency.frontFaceAlpha = 0.75;
    viewer.scene.globe.translucency.backFaceAlpha  = 0.0;
    viewer.scene.globe.undergroundColor = Cesium.Color.fromCssColorString('#050810');
    viewer.scene.globe.undergroundColorAlphaByDistance = new Cesium.NearFarScalar(
      1e3, 0.9, 1e7, 0.0
    );
  } catch (err) {
    console.warn('Globe translucency not supported in this build:', err.message);
  }
}

function setCameraHome() {
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(10.0, 20.0, 22_000_000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch:   Cesium.Math.toRadians(-90),
      roll:    0,
    },
  });
}

async function boot() {
  await initTerrain();
  setCameraHome();

  setLoadStatus('Downloading cable database…');
  let features;
  try {
    features = await fetchCables(setLoadStatus);
  } catch (err) {
    setLoadStatus(`Error: ${err.message}`);
    console.error('Failed to load cable data', err);
    return;
  }

  setLoadStatus(`Building ${features.length} cable routes…`);
  await new Promise(r => setTimeout(r, 50));

  const cableRecords = buildCableEntities(viewer, features, sharedUniforms, yearFilter);
  setCableCount(cableRecords.length);
  hideLoadingOverlay();

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.position);
    if (!picked) { hideCableSidebar(); return; }
    const record = findPickedCable(cableRecords, picked);
    if (!record) { hideCableSidebar(); return; }
    const p = record.properties;
    showCableSidebar({
      name:          p.name             ?? p.cable_name ?? '—',
      owners:        p.owners           ?? p.owner      ?? null,
      length:        p.length           ?? p.cable_length_km ?? null,
      rfs:           p.ready_for_service ?? p.rfs_year  ?? null,
      landingPoints: p.landing_points   ?? null,
      stress:        sharedUniforms.stress,
    });
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.position);
    if (!picked) hideCableSidebar();
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  initSidebarClose();

  initStressSlider((normalizedStress) => {
    sharedUniforms.stress = normalizedStress;
    sharedUniforms.speed = 1.0 + normalizedStress * 3.0;
    simulator.setStress(normalizedStress);
  });

  initYearSlider((year) => {
    yearFilter.maxYear = year;
    const visible = cableRecords.filter(r => r.rfsYear === null || r.rfsYear <= year);
    setCableCount(visible.length);
  });

  const simulator = new LatencySimulator();
  simulator.onUpdate((data) => { updateHUD(data); });
  simulator.start();
}

boot().catch(console.error);
