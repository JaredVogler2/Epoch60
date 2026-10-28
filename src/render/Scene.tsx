import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  BufferGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
} from 'three';
import type { ToneMapping } from 'three';
import { epochSpec } from '../engine';
import { store } from '../game/store';
import { Foliage, crownMaterial } from './Foliage';
import { Outskirts } from './Outskirts';
import { Birds } from './Birds';
import { Post, graphics } from './Post';
import { Structures } from './Structures';
import { Citizens } from './Citizens';
import { AshFall, CollapseDirector, HazardFront } from './CollapseFx';
import { Omens } from './Omens';
import { FrontFx } from './FrontFx';
import { Interaction } from './Interaction';
import {
  ForecastOverlay,
  HistoryLens,
  HoverRing,
  PlacementGhost,
  PlannedMarkers,
  RiskMarkers,
  SelectionRing,
} from './Overlays';
import { CameraRig, DEFAULT_CAMERA, cameraApi } from './CameraRig';
import { resolveQuality } from './quality';
import { DprGovernor, MAX_SHED } from './governor';
import { perfApi } from './perf';
import { buildWalkable, roadMask } from './paths';
import { buildSkirt, buildTerrain, buildWater, padsOf } from './terrain';
import type { TerrainModel } from './terrain';
import { detailTexture } from './textures';
import { linkWaterAtmosphere, makeWaterMaterial } from './water';
import { renderWorld } from './presentation';
import { presentation } from './presentation';
import { worldModel } from './world';
import { atmo, atmosphere } from './atmosphere';
import { Sky } from './Sky';
import { SmokeField } from './SmokeField';
import { SnapshotCapture } from './Snapshot';

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
  const water = useMemo(() => linkWaterAtmosphere(makeWaterMaterial()), []);
  const detail = useMemo(() => detailTexture(), []);
  // Painted ground: vertex paint from the world fields × grain texture × brush noise, with drifting cloud shadows.
  const ground = useMemo(
    () =>
      atmosphere(
        new MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.96, metalness: 0 }),
        { paint: true },
      ),
    [detail],
  );
  const soil = useMemo(
    () =>
      atmosphere(new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), {
        clouds: false,
      }),
    [],
  );
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
  // The terrain rebuilds ~100 times an epoch (felling, fire, floods): free each superseded GPU buffer.
  useEffect(() => () => skirt.dispose(), [skirt]);
  useEffect(() => () => waterGeom.dispose(), [waterGeom]);

  return (
    <group>
      <mesh geometry={model.geometry} material={ground} castShadow receiveShadow />
      <mesh geometry={skirt} material={soil} receiveShadow />
      <mesh geometry={waterGeom} material={water} renderOrder={2} />
    </group>
  );
}

const SUN_CALM = new Color('#ffe2b8');
const SKY_CALM = new Color('#cfe2f4');
const ZENITH_CALM = atmo.zenith.clone();
const HORIZON_CALM = atmo.horizon.clone();
const HAZE_CALM = atmo.haze.clone();
interface Mood {
  sun: Color;
  sky: Color;
  dim: number;
  zenith: Color;
  horizon: Color;
}
const MOODS: Record<string, Mood> = {
  fire: {
    sun: new Color('#ff9650'),
    sky: new Color('#ffb48a'),
    dim: 0.28,
    zenith: new Color('#c99d86'),
    horizon: new Color('#f2b78c'),
  },
  flood: {
    sun: new Color('#a9bdd0'),
    sky: new Color('#8fa6bf'),
    dim: 0.32,
    zenith: new Color('#8098ad'),
    horizon: new Color('#b8c3cb'),
  },
  quake: {
    sun: new Color('#e6caa0'),
    sky: new Color('#c9b79a'),
    dim: 0.22,
    zenith: new Color('#b8a891'),
    horizon: new Color('#dcc6a0'),
  },
  ash: {
    sun: new Color('#b8b2a6'),
    sky: new Color('#a39f98'),
    dim: 0.5,
    zenith: new Color('#99958f'),
    horizon: new Color('#b5b0a8'),
  },
};

/** Sun from the front-left of the default view: house fronts are lit (as in the reference) and shadows fall to the right. */
const SUN_OFFSET: [number, number, number] = [-22, 28, 10];

function Lights({ shadowMap }: { shadowMap: number }) {
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  // As the clock runs down the sky turns: warm dread for fire, grey for floods, dust for quakes, pallor for ash.
  useFrame(() => {
    const c = store.campaign;
    const l = sun.current;
    const h = hemi.current;
    if (!l || !h) return;
    let u = 0;
    if (c && store.screen === 'game') {
      if (c.phase === 'ACTIVE') u = Math.min(1, Math.max(0, (c.tick - 300) / 300));
      else if (c.phase === 'COLLAPSING') u = 1;
    }
    const kind = presentation.report?.hazard ?? (c ? epochSpec(c, c.epoch).hazard.kind : undefined) ?? 'fire';
    const m = MOODS[kind] ?? MOODS.fire!;
    l.color.copy(SUN_CALM).lerp(m.sun, u * 0.7);
    l.intensity = 2.5 * (1 - m.dim * u);
    h.color.copy(SKY_CALM).lerp(m.sky, u * 0.6);
    atmo.zenith.copy(ZENITH_CALM).lerp(m.zenith, u * 0.75);
    atmo.horizon.copy(HORIZON_CALM).lerp(m.horizon, u * 0.75);
    atmo.haze.copy(HAZE_CALM).lerp(m.horizon, u * 0.7);
  });
  useEffect(() => {
    const l = sun.current;
    if (!l) return;
    l.target.position.set(17, 0, 17);
    l.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <hemisphereLight ref={hemi} args={['#cfe2f4', '#7d6a48', 1.05]} />
      <directionalLight
        ref={sun}
        position={[17 + SUN_OFFSET[0], SUN_OFFSET[1], 17 + SUN_OFFSET[2]]}
        intensity={2.5}
        color="#ffe2b8"
        castShadow={shadowMap > 0}
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={5}
        shadow-camera-far={110}
        shadow-radius={4}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
    </>
  );
}

/**
 * Adapts the pixel ratio to the device (auto quality only, continuous rendering only) and feeds the performance probe.
 * Geometry, foliage and forecast information are never reduced.
 */
function Governor({ maxDpr, adaptive, phone }: { maxDpr: number; adaptive: boolean; phone: boolean }) {
  const gl = useThree((st) => st.gl);
  const setDpr = useThree((st) => st.setDpr);
  const gov = useMemo(
    () => new DprGovernor({ budgetMs: phone ? 1000 / 30 : 1000 / 60, minDpr: 0.6, maxDpr }),
    [maxDpr, phone],
  );
  useEffect(() => {
    perfApi.attach(() => ({
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      programs: gl.info.programs?.length ?? 0,
      pixelRatio: gl.getPixelRatio(),
    }));
  }, [gl]);
  useFrame((_, dt) => {
    perfApi.frame(dt * 1000);
    if (!adaptive) return;
    const next = gov.sample(dt * 1000);
    if (next !== null) setDpr(next);
    // Still over budget at the lowest resolution: shed optional effects one step at a time (see MAX_SHED).
    if (gov.strained >= 2 && graphics.shed < MAX_SHED) {
      graphics.shed++;
      graphics.post = false;
      gov.strained = 0;
    }
  });
  return null;
}

/** Exposes an on-demand render for deterministic test screenshots (`?still`). */
function StillHook() {
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => {
    cameraApi.render = () => invalidate();
  }, [invalidate]);
  return null;
}

const TONES: Record<string, ToneMapping> = {
  neutral: NeutralToneMapping,
  agx: AgXToneMapping,
  aces: ACESFilmicToneMapping,
};

export function GameCanvas() {
  const quality = useMemo(() => resolveQuality(store.settings.quality), []);
  // `?tone=` lets captures compare tone curves; the default is the one chosen by inspection.
  const tone = useMemo(() => new URLSearchParams(location.search).get('tone') ?? 'neutral', []);
  const still = useMemo(() => new URLSearchParams(location.search).has('still'), []);
  // A lost WebGL context (GPU reset, iOS memory pressure) pauses the clock; on restore the renderer is rebuilt from
  // scratch. All game state lives in the store, so nothing in the valley is lost.
  const [generation, setGeneration] = useState(0);
  const [lost, setLost] = useState(false);
  return (
    <>
      <Canvas
        key={generation}
        className="game-canvas"
        frameloop={still ? 'demand' : 'always'}
        shadows={{ type: PCFShadowMap }}
        dpr={quality.dpr}
        gl={{
          antialias: quality.antialias,
          alpha: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        }}
        camera={{ fov: 30, near: 0.5, far: 260, position: [20, 22, 40] }}
        onCreated={({ gl }) => {
          gl.toneMapping = TONES[tone] ?? NeutralToneMapping;
          gl.toneMappingExposure = tone === 'agx' ? 1.15 : tone === 'aces' ? 0.9 : 0.95;
          gl.outputColorSpace = SRGBColorSpace;
          gl.localClippingEnabled = true;
          const el = gl.domElement;
          el.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            store.pause('graphics');
            setLost(true);
          });
          el.addEventListener('webglcontextrestored', () => {
            setLost(false);
            setGeneration((g) => g + 1);
          });
        }}
      >
        <Sky />
        <Lights shadowMap={quality.shadowMap} />
        <Valley />
        {quality.outskirts > 0 && (
          <Outskirts density={quality.outskirts} crown={crownMaterial(quality.wind)} />
        )}
        <Foliage />
        <Structures />
        <SmokeField />
        <Citizens />
        {quality.birds && <Birds />}
        <HazardFront />
        <FrontFx />
        <AshFall />
        <Omens density={quality.tier === 'low' ? 0.6 : 1} />
        <CollapseDirector />
        <ForecastOverlay />
        <HistoryLens />
        <RiskMarkers />
        <PlannedMarkers />
        <SelectionRing />
        <HoverRing />
        <PlacementGhost />
        <Interaction />
        <CameraRig enabled />
        <StillHook />
        <SnapshotCapture />
        {quality.post && <Post />}
        <Governor
          maxDpr={quality.dpr}
          adaptive={!still && store.settings.quality === 'auto'}
          phone={quality.tier !== 'high'}
        />
      </Canvas>
      <div className="vignette" aria-hidden="true" />
      {lost && (
        <div className="gl-lost" role="status">
          Restoring the valley&hellip; your civilization is paused.
        </div>
      )}
    </>
  );
}

export { DEFAULT_CAMERA };
