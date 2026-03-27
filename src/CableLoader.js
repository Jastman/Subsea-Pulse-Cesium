/**
 * CableLoader.js
 * Fetches the TeleGeography submarine cable GeoJSON and builds
 * Cesium polyline entities with the custom pulse material.
 */

// Cesium is loaded as a global via CDN <script> in index.html
/* global Cesium */
const { Material, Cartesian3, ArcType } = Cesium;

import { buildPulseMaterialFabric } from './Shaders.js';

const CABLE_GEOJSON_URL =
  'https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/web/public/api/v3/cable/cable-geo.json';

export async function fetchCables(onProgress) {
  onProgress?.('Fetching cable data…');
  const resp = await fetch(CABLE_GEOJSON_URL);
  if (!resp.ok) throw new Error(`Failed to fetch cable data: ${resp.status}`);
  const geojson = await resp.json();
  onProgress?.('Parsing features…');
  return geojson.features ?? [];
}

function extractLineStrings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

function coordsToCartesian(coords) {
  return coords
    .filter(([lon, lat]) => isFinite(lon) && isFinite(lat))
    .map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat));
}

function parseRfsYear(rfs) {
  if (!rfs) return null;
  const match = String(rfs).match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

export function buildCableEntities(viewer, features, sharedUniforms, yearFilter) {
  const records = [];

  for (const feature of features) {
    const props = feature.properties ?? {};
    const lineStrings = extractLineStrings(feature.geometry);
    if (lineStrings.length === 0) continue;

    const rfsYear = parseRfsYear(props.ready_for_service ?? props.rfs_year);

    const material = new Material({
      fabric: buildPulseMaterialFabric({
        speed:     sharedUniforms.speed,
        intensity: sharedUniforms.intensity,
        stress:    sharedUniforms.stress,
      }),
      translucent: true,
    });

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

  viewer.scene.preRender.addEventListener(() => {
    const currentYear = yearFilter.maxYear;
    for (const rec of records) {
      const visible = rec.rfsYear === null || rec.rfsYear <= currentYear;
      rec.entity.show = visible;
      if (visible) {
        const u = rec.material.uniforms;
        u.speed     = sharedUniforms.speed;
        u.intensity = sharedUniforms.intensity;
        u.stress    = sharedUniforms.stress;
      }
    }
  });

  return records;
}

export function findPickedCable(records, picked) {
  if (!picked?.id) return null;
  return records.find(r => r.entity === picked.id) ?? null;
}
