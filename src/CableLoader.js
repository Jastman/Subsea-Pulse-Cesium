/**
 * CableLoader.js
 * Fetches the TeleGeography submarine cable GeoJSON and builds
 * Cesium polyline entities with the custom pulse material.
 */

import {
  Material,
  Cartesian3,
  ArcType,
} from 'cesium';
import { buildPulseMaterialFabric, PULSE_MATERIAL_TYPE } from './Shaders.js';

const CABLE_GEOJSON_URL =
  'https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/web/public/api/v3/cable/cable-geo.json';

/**
 * Fetch and parse the TeleGeography cable GeoJSON.
 * Returns an array of GeoJSON Feature objects.
 */
export async function fetchCables(onProgress) {
  onProgress?.('Fetching cable data…');
  const resp = await fetch(CABLE_GEOJSON_URL);
  if (!resp.ok) throw new Error(`Failed to fetch cable data: ${resp.status}`);
  const geojson = await resp.json();
  onProgress?.('Parsing features…');
  return geojson.features ?? [];
}

/**
 * Extract a flat list of coordinate arrays from a GeoJSON geometry.
 * Handles LineString and MultiLineString.
 */
function extractLineStrings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') {
    return [geometry.coordinates];
  }
  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates;
  }
  return [];
}

/**
 * Convert a GeoJSON coordinate array [[lon,lat], ...] to Cesium Cartesian3[].
 */
function coordsToCartesian(coords) {
  return coords
    .filter(([lon, lat]) => isFinite(lon) && isFinite(lat))
    .map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat));
}

/**
 * Parse the ready_for_service string into a 4-digit year integer, or null.
 */
function parseRfsYear(rfs) {
  if (!rfs) return null;
  const match = String(rfs).match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Build all cable entities and add them to the viewer.
 *
 * @param {import('cesium').Viewer} viewer
 * @param {Array}  features        GeoJSON features
 * @param {object} sharedUniforms  Object with { speed, intensity, stress } — mutated externally
 * @param {object} yearFilter      Object with { maxYear } — mutated externally
 * @returns {Array} array of { entity, properties, rfsYear, material } records
 */
export function buildCableEntities(viewer, features, sharedUniforms, yearFilter) {
  const records = [];

  for (const feature of features) {
    const props = feature.properties ?? {};
    const lineStrings = extractLineStrings(feature.geometry);
    if (lineStrings.length === 0) continue;

    const rfsYear = parseRfsYear(props.ready_for_service ?? props.rfs_year);

    // Create one material per cable (shares uniform object reference)
    const material = new Material({
      fabric: buildPulseMaterialFabric({
        speed:     sharedUniforms.speed,
        intensity: sharedUniforms.intensity,
        stress:    sharedUniforms.stress,
      }),
      translucent: true,
    });

    // Each cable may have multiple line segments (MultiLineString)
    for (const coords of lineStrings) {
      const positions = coordsToCartesian(coords);
      if (positions.length < 2) continue;

      const entity = viewer.entities.add({
        polyline: {
          positions,
          width: 1.8,
          material,
          clampToGround: false,
          arcType: ArcType.NONE,
        },
      });

      records.push({ entity, properties: props, rfsYear, material });
    }
  }

  // Pre-render hook: sync uniforms and year filter every frame
  viewer.scene.preRender.addEventListener(() => {
    const currentYear = yearFilter.maxYear;
    for (const rec of records) {
      // Year visibility
      const visible = rec.rfsYear === null || rec.rfsYear <= currentYear;
      rec.entity.show = visible;

      if (visible) {
        // Sync shader uniforms from the shared mutable object
        const u = rec.material.uniforms;
        u.speed     = sharedUniforms.speed;
        u.intensity = sharedUniforms.intensity;
        u.stress    = sharedUniforms.stress;
      }
    }
  });

  return records;
}

/**
 * Given a pick result from viewer.scene.pick(), find the matching cable record.
 */
export function findPickedCable(records, picked) {
  if (!picked?.id) return null;
  return records.find(r => r.entity === picked.id) ?? null;
}
