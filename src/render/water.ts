import { Color, ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from 'three';
import { ATMO_GLSL, atmo } from './atmosphere';

const vert = /* glsl */ `
attribute float aDepth;
varying float vDepth;
#include <fog_pars_vertex>
${ATMO_GLSL.common}
void main() {
  vDepth = aDepth;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vAtmoWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const frag = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform float uFlood;
varying float vDepth;
#include <fog_pars_fragment>
${ATMO_GLSL.common}
${ATMO_GLSL.cloud}
void main() {
  float d = vDepth;
  if (d < 0.0) discard;
  vec2 p = vAtmoWorld.xz;
  float t = uAtmoTime * (0.35 + 0.65 * uAtmoMotion);
  // Two noise layers drifting downstream (+z) at different speeds: a flowing, non-repeating surface.
  vec2 f1 = p * vec2(2.2, 1.2) + vec2(0.0, -t * 0.55);
  vec2 f2 = p * vec2(3.7, 2.9) + vec2(t * 0.11, -t * 0.9);
  float e = 0.06;
  float h1 = atmoNoise(f1) + 0.5 * atmoNoise(f2);
  float hx = atmoNoise(f1 + vec2(e, 0.0)) + 0.5 * atmoNoise(f2 + vec2(e, 0.0));
  float hz = atmoNoise(f1 + vec2(0.0, e)) + 0.5 * atmoNoise(f2 + vec2(0.0, e));
  vec3 n = normalize(vec3((h1 - hx) * 1.0, 1.0, (h1 - hz) * 1.0));
  vec3 viewDir = normalize(cameraPosition - vAtmoWorld);
  vec3 hv = normalize(uSun + viewDir);
  float spec = pow(max(dot(n, hv), 0.0), 220.0);
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  float deep = smoothstep(0.02, 0.32, d);
  vec3 col = mix(uShallow, uDeep, deep);
  // Light rolling over the bed in the shallows.
  col *= 0.92 + 0.16 * smoothstep(0.35, 0.8, atmoNoise(p * 3.1 + vec2(t * 0.2, -t * 0.35))) * (1.0 - deep);
  col *= atmoCloud(p);
  col += vec3(1.0, 0.95, 0.82) * spec * 0.4 * atmoCloud(p) + fres * vec3(0.08, 0.13, 0.16);
  // Foam: a broken, breathing line along the banks.
  float edge = smoothstep(0.035, 0.0, d);
  float broken = smoothstep(0.35, 0.75, atmoNoise(p * 6.0 + vec2(0.0, -t * 0.8)));
  float foam = edge * (0.35 + 0.65 * broken);
  col = mix(col, uFoam, clamp(foam * 0.6, 0.0, 0.65));
  float alpha = mix(0.4, 0.94, smoothstep(0.0, 0.11, d));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/** Sun direction shared with the scene's key light (see SUN_OFFSET in Scene.tsx). */
export const SUN_DIR = new Vector3(-22, 28, 10).normalize();

export function makeWaterMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uSun: { value: SUN_DIR.clone() },
        uShallow: { value: new Color('#62b3ad') },
        uDeep: { value: new Color('#2b6f7e') },
        uFoam: { value: new Color('#f1efe2') },
        uFlood: { value: 0 },
      },
    ]),
  });
}

/** The water shares the global clock, wind and clouds by reference (merge() clones, so re-link after creation). */
export function linkWaterAtmosphere(m: ShaderMaterial): ShaderMaterial {
  Object.assign(m.uniforms, atmo.uniforms);
  return m;
}
