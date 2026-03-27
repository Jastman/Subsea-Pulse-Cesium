/**
 * Shaders.js
 * Custom GLSL material source for the animated submarine cable pulse effect.
 * Used with Cesium's Material fabric system as a PolylineMaterial.
 *
 * Uniforms:
 *   speed     — how fast the pulse travels along the line (0.5 – 5.0)
 *   intensity — glow brightness multiplier (0.5 – 3.0)
 *   stress    — 0.0 = healthy cyan, 1.0 = congested red
 */

export const PULSE_MATERIAL_TYPE = 'SubseaPulse';

/**
 * GLSL source for the czm_getMaterial function.
 * czm_frameNumber is a built-in Cesium uniform (integer frame counter).
 * materialInput.s is the normalised position along the polyline [0, 1].
 */
export const PULSE_SHADER_SOURCE = `
uniform float speed;
uniform float intensity;
uniform float stress;

czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);

  float s = materialInput.s;

  // Advance pulse position based on frame number and speed
  float t = mod(float(czm_frameNumber) * speed * 0.0025, 1.0);

  // Distance from the leading edge of the pulse (wrapped)
  float dist = abs(fract(s - t) - 0.5) * 2.0;

  // Sharp leading edge, soft tail
  float pulse = pow(1.0 - smoothstep(0.0, 0.18, dist), 2.0);

  // Secondary trailing glow
  float trail = (1.0 - smoothstep(0.0, 0.45, dist)) * 0.25;

  // Base dim line so cables are always faintly visible
  float base = 0.12;

  // Color: interpolate cyan (#00F5FF) → red (#FF3131) by stress
  vec3 cyanColor = vec3(0.0, 0.961, 1.0);
  vec3 redColor  = vec3(1.0, 0.192, 0.192);
  vec3 lineColor = mix(cyanColor, redColor, stress);

  // Boost intensity at high stress (more frantic look)
  float effectiveIntensity = intensity * (1.0 + stress * 1.5);

  float brightness = base + (pulse + trail) * effectiveIntensity;
  material.diffuse  = lineColor * brightness;
  material.emission = lineColor * (pulse * effectiveIntensity * 0.9);
  material.alpha    = clamp(base + (pulse + trail) * 0.9, 0.0, 1.0);

  return material;
}
`;

/**
 * Build a Cesium Material fabric definition for the pulse shader.
 * @param {object} [overrides] - override default uniform values
 */
export function buildPulseMaterialFabric(overrides = {}) {
  return {
    type: PULSE_MATERIAL_TYPE,
    uniforms: {
      speed:     overrides.speed     ?? 1.0,
      intensity: overrides.intensity ?? 1.2,
      stress:    overrides.stress    ?? 0.0,
    },
    source: PULSE_SHADER_SOURCE,
  };
}
