import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BackSide, Fog, Mesh, ShaderMaterial } from 'three';
import { store } from '../game/store';
import { atmo } from './atmosphere';
import { cameraApi } from './CameraRig';

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uHaze;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col;
  if (h >= 0.0) col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.9, h), 0.75));
  else col = mix(uHorizon, uHaze * 0.94, smoothstep(0.0, -0.35, h));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The world around the diorama: a gradient sky that follows the camera, and distance haze in the same colour as the
 * horizon, so the board's far edge and soil cut melt into warm air instead of a void. Also advances the shared clock.
 */
export function Sky() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const dome = useRef<Mesh>(null);
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: atmo.zenith },
          uHorizon: { value: atmo.horizon },
          uHaze: { value: atmo.haze },
        },
      }),
    [],
  );
  useEffect(() => {
    scene.fog = new Fog(atmo.haze.clone(), 40, 140);
    return () => {
      scene.fog = null;
    };
  }, [scene]);
  useFrame((state) => {
    atmo.uniforms.uAtmoTime.value = state.clock.elapsedTime;
    atmo.uniforms.uAtmoMotion.value = store.settings.reducedMotion ? 0 : 1;
    if (dome.current) dome.current.position.copy(camera.position);
    const fog = scene.fog as Fog | null;
    if (fog) {
      // Haze starts just beyond the focus and swallows the far valley: atmospheric perspective at any zoom.
      const d = cameraApi.get().dist;
      fog.color.copy(atmo.haze);
      fog.near = d * 1.05;
      fog.far = d * 3.6;
    }
    gl.setClearColor(atmo.haze, 1);
  });
  return (
    <mesh ref={dome} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[220, 32, 16]} />
    </mesh>
  );
}
