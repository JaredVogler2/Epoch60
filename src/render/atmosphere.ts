import { Color, Vector2 } from 'three';
import type { Material, WebGLProgramParametersWithUniforms } from 'three';

/**
 * Shared, render-only atmosphere: one clock, one wind, one sky for every material in the valley.
 * Materials opt in with `atmosphere(material, opts)`, which injects GLSL through `onBeforeCompile` (no forked shaders).
 * Nothing here reads or writes campaign state.
 */
export const atmo = {
  uniforms: {
    uAtmoTime: { value: 0 },
    /** World-space wind direction × strength (cells). */
    uAtmoWind: { value: new Vector2(0.8, 0.45) },
    /** 1 = full ambient motion, 0 = reduced motion (wind, cloud drift and birds stop). */
    uAtmoMotion: { value: 1 },
    /** Strength of moving cloud shadows (0 = off). */
    uAtmoClouds: { value: 1 },
  },
  /** Sky gradient and distance haze; the mood director tints these as a disaster approaches. */
  zenith: new Color('#9cc3e2'),
  horizon: new Color('#f1e2c6'),
  haze: new Color('#e6dac2'),
};

const COMMON = /* glsl */ `
uniform float uAtmoTime;
uniform vec2 uAtmoWind;
uniform float uAtmoMotion;
uniform float uAtmoClouds;
varying vec3 vAtmoWorld;
float atmoHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float atmoNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(atmoHash(i), atmoHash(i + vec2(1.0, 0.0)), u.x),
             mix(atmoHash(i + vec2(0.0, 1.0)), atmoHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float atmoFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 4; k++) {
    v += a * atmoNoise(p);
    p = p * 2.03 + vec2(17.1, 9.3);
    a *= 0.5;
  }
  return v;
}
`;

const VERT_WIND = /* glsl */ `
uniform float uAtmoSway;
vec3 atmoWindOffset(vec3 w, float weight) {
  float ph = dot(w.xz, vec2(0.37, 0.61));
  float t = uAtmoTime * uAtmoMotion;
  float s = sin(t * 1.7 + ph) * 0.55 + sin(t * 2.9 + ph * 1.7) * 0.25 + sin(t * 0.63 + ph * 0.45) * 0.45;
  return vec3(uAtmoWind.x, 0.0, uAtmoWind.y) * (s * weight * uAtmoMotion);
}
`;

/** Replaces three's project_vertex so the world position (after instancing) is known, and wind can move it. */
const PROJECT = (wind: boolean) => /* glsl */ `
vec4 atmoW = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  atmoW = instanceMatrix * atmoW;
#endif
atmoW = modelMatrix * atmoW;
${wind ? 'float atmoH = max(position.y, 0.0); atmoW.xyz += atmoWindOffset(atmoW.xyz, atmoH * atmoH * uAtmoSway);' : ''}
vAtmoWorld = atmoW.xyz;
vec4 mvPosition = viewMatrix * atmoW;
gl_Position = projectionMatrix * mvPosition;
`;

const FRAG_CLOUD = /* glsl */ `
float atmoCloud(vec2 xz) {
  vec2 drift = uAtmoTime * uAtmoMotion * vec2(0.33, 0.14);
  float n = atmoFbm((xz - drift) * 0.055);
  return mix(1.0, 0.74, smoothstep(0.5, 0.7, n) * uAtmoClouds);
}
`;

/** Hand-painted ground: soft anisotropic strokes and low-frequency colour drift, multiplied over the vertex paint. */
const FRAG_PAINT = /* glsl */ `
vec3 atmoPaint(vec2 xz, vec3 base) {
  vec2 q = vec2(xz.x * 0.9 + xz.y * 0.35, xz.y * 0.9 - xz.x * 0.35);
  float strokes = atmoFbm(q * vec2(2.6, 0.9));
  float drift = atmoFbm(xz * 0.18 + vec2(3.7, 1.3));
  float k = 0.9 + 0.2 * strokes;
  vec3 warm = base * vec3(1.06, 1.02, 0.9);
  vec3 cool = base * vec3(0.92, 0.98, 1.02);
  return mix(cool, warm, drift) * k;
}
`;

export interface AtmosphereOptions {
  /** Moving cloud shadows on direct light. */
  clouds?: boolean;
  /** Wind sway; the value scales displacement by (local height)². 0 = none. */
  sway?: number;
  /** Painterly ground layer (terrain only). */
  paint?: boolean;
  /** Instance colour tints only vertices with `aFoliage` = 1 (tree crowns), so trunks keep their bark colour. */
  foliageMask?: boolean;
}

/** Opt a built-in lit material into the shared atmosphere. Returns the same material. */
export function atmosphere<T extends Material>(m: T, opts: AtmosphereOptions = {}): T {
  const clouds = opts.clouds ?? true;
  const sway = opts.sway ?? 0;
  const paint = opts.paint ?? false;
  const mask = opts.foliageMask ?? false;
  const key = `atmo:${clouds ? 1 : 0}:${sway > 0 ? 1 : 0}:${paint ? 1 : 0}:${mask ? 1 : 0}`;
  const own = { uAtmoSway: { value: sway } };
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, atmo.uniforms, own);
    let vert =
      COMMON +
      (sway > 0 ? VERT_WIND : '') +
      shader.vertexShader.replace('#include <project_vertex>', PROJECT(sway > 0));
    if (mask)
      vert =
        'attribute float aFoliage;\n' +
        vert.replace(
          '#include <color_vertex>',
          `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
  vColor.xyz = color.xyz * mix(vec3(1.0), instanceColor.xyz, aFoliage);
#endif`,
        );
    shader.vertexShader = vert;
    let frag = COMMON + (clouds ? FRAG_CLOUD : '') + (paint ? FRAG_PAINT : '') + shader.fragmentShader;
    if (paint)
      frag = frag.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n  diffuseColor.rgb = atmoPaint(vAtmoWorld.xz, diffuseColor.rgb);',
      );
    if (clouds)
      frag = frag.replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
  float atmoC = atmoCloud(vAtmoWorld.xz);
  reflectedLight.directDiffuse *= atmoC;
  reflectedLight.directSpecular *= atmoC;`,
      );
    shader.fragmentShader = frag;
  };
  m.customProgramCacheKey = () => key;
  return m;
}

/** GLSL for custom ShaderMaterials (water, sky) that want the same clouds and clock. */
export const ATMO_GLSL = { common: COMMON, cloud: FRAG_CLOUD };
