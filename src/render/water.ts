import { Color, ShaderMaterial, Vector3 } from 'three';

const vert = /* glsl */ `
attribute float aDepth;
varying float vDepth;
varying vec3 vWorld;
void main() {
  vDepth = aDepth;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const frag = /* glsl */ `
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform float uFlood;
varying float vDepth;
varying vec3 vWorld;
void main() {
  float d = vDepth;
  if (d < 0.0) discard;
  vec2 p = vWorld.xz;
  float t = uTime;
  // ripples flowing downstream (+z)
  float r1 = sin(p.x * 7.0 + p.y * 3.0 - t * 1.7);
  float r2 = sin(p.x * 11.0 - p.y * 8.0 + t * 2.3);
  float r3 = sin(p.y * 6.0 - t * 1.2 + p.x * 2.0);
  vec3 n = normalize(vec3((r1 + r2 * 0.5) * 0.10, 1.0, (r2 + r3) * 0.10));
  vec3 viewDir = normalize(cameraPosition - vWorld);
  vec3 h = normalize(uSun + viewDir);
  float spec = pow(max(dot(n, h), 0.0), 90.0);
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  float deep = smoothstep(0.02, 0.34, d);
  vec3 col = mix(uShallow, uDeep, deep);
  col += vec3(1.0, 0.96, 0.85) * spec * 0.9 + fres * vec3(0.20, 0.30, 0.36);
  float streak = 0.5 + 0.5 * sin(p.y * 15.0 - t * 2.2 + sin(p.x * 6.0) * 2.0);
  float foam = smoothstep(0.075, 0.0, d) * (0.55 + 0.45 * streak);
  col = mix(col, vec3(0.96, 0.98, 0.97), clamp(foam * 0.7, 0.0, 0.75));
  float alpha = mix(0.35, 0.93, smoothstep(0.0, 0.10, d));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function makeWaterMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: new Vector3(-0.45, 0.78, 0.42).normalize() },
      uShallow: { value: new Color('#7fd0c4') },
      uDeep: { value: new Color('#1f6f86') },
      uFlood: { value: 0 },
    },
  });
}
