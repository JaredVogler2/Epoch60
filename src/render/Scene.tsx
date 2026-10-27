import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  NeutralToneMapping,
  BufferGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  PCFShadowMap,
  ShaderMaterial,
  SRGBColorSpace,
} from 'three';
import { getScenario } from '../engine';
import { store } from '../game/store';
import { Foliage } from './Foliage';
import { Structures } from './Structures';
import { Citizens } from './Citizens';
import { AshFall, CollapseDirector, HazardFront } from './CollapseFx';
import { Interaction } from './Interaction';
import { ForecastOverlay, PlacementGhost, PlannedMarkers, RiskMarkers, SelectionRing } from './Overlays';
import { CameraRig, DEFAULT_CAMERA, cameraApi } from './CameraRig';
import { resolveQuality } from './quality';
import { buildWalkable, roadMask } from './paths';
import { buildSkirt, buildTerrain, buildWater, padsOf } from './terrain';
import type { TerrainModel } from './terrain';
import { detailTexture } from './textures';
import { makeWaterMaterial } from './water';
import { renderWorld } from './presentation';
import { presentation } from './presentation';
import { worldModel } from './world';

/** Re-render only when terrain-affecting state actually changes. */
function useRevs(): string {
  return useSyncExternalStore(
    store.subscribe,
    () => `${store.campaign?.epoch ?? -1}:${store.worldRev}:${store.structRev}:${presentation.rev}`,
  );
}

function Valley() {
  const revs = useRevs();
  const geomRef = useRef<BufferGeometry | undefined>(undefined);
  const water = useMemo(() => makeWaterMaterial(), []);
  const detail = useMemo(() => detailTexture(), []);
  const model: TerrainModel = useMemo(() => {
    void revs;
    const c = store.campaign!;
    const pads = padsOf(c.structures, c.world);
    const m = buildTerrain(renderWorld(c), pads, roadMask(c, buildWalkable(c)), geomRef.current);
    geomRef.current = m.geometry;
    worldModel.terrain = m;
    cameraApi.heightAt = m.heightAt;
    return m;
  }, [revs]);
  const skirt = useMemo(() => buildSkirt(model), [model]);
  const waterGeom = useMemo(() => buildWater(model), [model]);

  useFrame(({ clock }) => {
    (water as ShaderMaterial).uniforms.uTime!.value = clock.elapsedTime;
  });

  return (
    <group>
      <mesh geometry={model.geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors map={detail} roughness={0.96} metalness={0} />
      </mesh>
      <mesh geometry={skirt} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} />
      </mesh>
      <mesh geometry={waterGeom} material={water} renderOrder={2} />
    </group>
  );
}

const SUN_CALM = new Color('#ffe9c4');
const SKY_CALM = new Color('#d4e6ff');
const MOODS: Record<string, { sun: Color; sky: Color; dim: number }> = {
  fire: { sun: new Color('#ff9650'), sky: new Color('#ffb48a'), dim: 0.28 },
  flood: { sun: new Color('#a9bdd0'), sky: new Color('#8fa6bf'), dim: 0.32 },
  quake: { sun: new Color('#e6caa0'), sky: new Color('#c9b79a'), dim: 0.22 },
  ash: { sun: new Color('#b8b2a6'), sky: new Color('#a39f98'), dim: 0.5 },
};

function Lights({ shadowMap }: { shadowMap: number }) {
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  // As the clock runs down the sky turns: warm dread for fire, grey for floods, dust for quakes.
  useFrame(() => {
    const c = store.campaign;
    const l = sun.current;
    const h = hemi.current;
    if (!c || !l || !h) return;
    let u = 0;
    if (store.screen === 'game') {
      if (c.phase === 'ACTIVE') u = Math.min(1, Math.max(0, (c.tick - 300) / 300));
      else if (c.phase === 'COLLAPSING') u = 1;
    }
    const kind =
      presentation.report?.hazard ??
      (c ? getScenario(c.scenario).epochs[c.epoch]?.hazard.kind : undefined) ??
      'fire';
    const m = MOODS[kind] ?? MOODS.fire!;
    l.color.copy(SUN_CALM).lerp(m.sun, u * 0.7);
    l.intensity = 2.1 * (1 - m.dim * u);
    h.color.copy(SKY_CALM).lerp(m.sky, u * 0.6);
  });
  useEffect(() => {
    const l = sun.current;
    if (!l) return;
    l.target.position.set(16, 0, 16);
    l.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <hemisphereLight ref={hemi} args={['#d4e6ff', '#8a7650', 1.15]} />
      <directionalLight
        ref={sun}
        position={[-6, 30, 38]}
        intensity={2.1}
        color="#ffe9c4"
        castShadow={shadowMap > 0}
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={5}
        shadow-camera-far={120}
        shadow-radius={3}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />
    </>
  );
}

/** Exposes an on-demand render for deterministic test screenshots (`?still`). */
function StillHook() {
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => {
    cameraApi.render = () => invalidate();
  }, [invalidate]);
  return null;
}

export function GameCanvas() {
  const quality = useMemo(() => resolveQuality(store.settings.quality), []);
  const still = useMemo(() => new URLSearchParams(location.search).has('still'), []);
  return (
    <Canvas
      className="game-canvas"
      frameloop={still ? 'demand' : 'always'}
      shadows={{ type: PCFShadowMap }}
      dpr={quality.dpr}
      gl={{
        antialias: quality.antialias,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      }}
      camera={{ fov: 30, near: 0.5, far: 260, position: [20, 22, 40] }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping;
        gl.toneMappingExposure = 0.95;
        gl.outputColorSpace = SRGBColorSpace;
        gl.localClippingEnabled = true;
      }}
    >
      <Lights shadowMap={quality.shadowMap} />
      <Valley />
      <Foliage />
      <Structures />
      <Citizens />
      <HazardFront />
      <AshFall />
      <CollapseDirector />
      <ForecastOverlay />
      <RiskMarkers />
      <PlannedMarkers />
      <SelectionRing />
      <PlacementGhost />
      <Interaction />
      <CameraRig enabled />
      <StillHook />
    </Canvas>
  );
}

export { DEFAULT_CAMERA };
