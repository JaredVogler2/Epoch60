import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/** Runtime switches the frame-time governor may turn off on a struggling device (never gameplay information). */
export const graphics = { post: true, shed: 0 };

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Separable miniature blur (tilt-shift): a sharp band around the focus line, softening toward the top (the far valley)
 * more than toward the bottom (the near foreground). The vertical pass also applies a gentle warm grade in linear HDR.
 */
const frag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uStep;
uniform float uFocus;
uniform float uBand;
uniform float uMax;
uniform float uGrade;
varying vec2 vUv;
void main() {
  float dy = vUv.y - uFocus;
  float k = smoothstep(uBand, uBand + 0.38, abs(dy)) * (dy > 0.0 ? 1.0 : 0.6);
  vec2 s = uStep * (uMax * k / 3.2307692308);
  vec4 c = texture2D(tDiffuse, vUv) * 0.2270270270;
  c += texture2D(tDiffuse, vUv + s * 1.3846153846) * 0.3162162162;
  c += texture2D(tDiffuse, vUv - s * 1.3846153846) * 0.3162162162;
  c += texture2D(tDiffuse, vUv + s * 3.2307692308) * 0.0702702703;
  c += texture2D(tDiffuse, vUv - s * 3.2307692308) * 0.0702702703;
  if (uGrade > 0.5) {
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    c.rgb = mix(vec3(l), c.rgb, 1.07) * vec3(1.025, 1.0, 0.965);
  }
  gl_FragColor = c;
}
`;

function tiltPass(grade: boolean): ShaderPass {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uStep: { value: new Vector2() },
      uFocus: { value: 0.46 },
      uBand: { value: 0.16 },
      uMax: { value: 6 },
      uGrade: { value: grade ? 1 : 0 },
    },
    vertexShader: vert,
    fragmentShader: frag,
  });
}

/**
 * High-tier image pipeline: scene → MSAA HDR target → tilt-shift (H, V + grade) → OutputPass (the one and only
 * tone-mapping and sRGB step). When the governor sheds effects, the scene is drawn directly instead.
 */
export function Post() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const { composer, h, v } = useMemo(() => {
    const rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    const c = new EffectComposer(gl, rt);
    c.addPass(new RenderPass(scene, camera));
    const hp = tiltPass(false);
    const vp = tiltPass(true);
    c.addPass(hp);
    c.addPass(vp);
    c.addPass(new OutputPass());
    return { composer: c, h: hp, v: vp };
  }, [gl, scene, camera]);
  useEffect(
    () => () => {
      for (const p of composer.passes) p.dispose();
      composer.dispose();
    },
    [composer],
  );
  useFrame(() => {
    if (!graphics.post) {
      gl.render(scene, camera);
      return;
    }
    const dpr = gl.getPixelRatio();
    const w = Math.max(1, Math.round(size.width * dpr));
    const ht = Math.max(1, Math.round(size.height * dpr));
    if (composer.renderTarget1.width !== w || composer.renderTarget1.height !== ht) {
      composer.setPixelRatio(dpr);
      composer.setSize(size.width, size.height);
    }
    // blur radius scales with the shorter side so phones and monitors look alike
    const max = Math.min(w, ht) * 0.006;
    h.uniforms.uStep!.value.set(1 / w, 0);
    v.uniforms.uStep!.value.set(0, 1 / ht);
    h.uniforms.uMax!.value = max;
    v.uniforms.uMax!.value = max;
    composer.render();
  }, 1);
  return null;
}
