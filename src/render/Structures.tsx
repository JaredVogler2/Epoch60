import { useFrame } from '@react-three/fiber';
import { memo, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Plane, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { BUILDINGS } from '../engine';
import type { Campaign, Structure } from '../engine';
import { store } from '../game/store';
import { buildingModel, ruinGeometry, scaffoldGeometry } from './models/buildings';
import type { BuildingModel } from './models/buildings';
import { groundY } from './world';
import { presentation, sinceHit, visualStatus } from './presentation';
import { BurnFx, DustPuff } from './CollapseFx';
import { h01 } from './geo';

const modelCache = new Map<string, BuildingModel>();
const ruinCache = new Map<string, BufferGeometry>();
const scaffoldCache = new Map<string, BufferGeometry>();

function modelFor(s: Structure): BuildingModel {
  const variant = (s.id * 7 + s.x * 3 + s.y) % 3;
  const key = `${s.kind}:${s.w}x${s.h}:${variant}:${s.id % 5}:${s.originEpoch}`;
  let m = modelCache.get(key);
  if (!m) {
    m = buildingModel(s.kind, s.w, s.h, variant, 100 + s.id * 31 + variant, s.originEpoch);
    modelCache.set(key, m);
  }
  return m;
}

function useStructRev(): string {
  return useSyncExternalStore(
    store.subscribe,
    () => `${store.campaign?.epoch ?? -1}:${store.structRev}:${presentation.rev}`,
  );
}

/** Facing: houses turn their doors toward the hearth, with a little hand-placed irregularity. */
function facing(s: Structure, hx: number, hz: number): number {
  const cx = s.x + s.w / 2;
  const cz = s.y + s.h / 2;
  if (s.kind === 'cottage' || s.kind === 'workshop' || s.kind === 'stone_house') {
    const a = Math.atan2(hx - cx, hz - cz);
    const snapped = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
    return snapped + (h01(s.id, 3, 3) - 0.5) * 0.25;
  }
  if (s.kind === 'archive' || s.kind === 'seed_vault' || s.kind === 'lumber_camp' || s.kind === 'quarry') {
    return (h01(s.id, 4, 4) - 0.5) * 0.3;
  }
  return 0;
}

const white = new Color(1, 1, 1);

/** Where a building's chimney (or the hearth's fire) breathes out, in the building's own frame. */
function chimneyOf(s: Structure): [number, number, number] {
  if (s.kind === 'hearth') return [0, 0.7, 0];
  if (s.kind === 'forge') return [0.5, 2.0, -0.35];
  if (s.kind === 'stone_house') return [s.id % 3 === 1 ? -0.45 : 0.55, 1.8, s.id % 3 === 1 ? 0.2 : -0.25];
  return s.id % 3 === 1 ? [0, 1.45, 0] : s.id % 3 === 2 ? [0.45, 1.25, -0.35] : [0.65, 1.38, -0.28];
}

export interface SmokeSource {
  x: number;
  y: number;
  z: number;
  seed: number;
  /** Forge smoke is darker and heavier. */
  dark: boolean;
}

/** Every chimney that is smoking right now, in world space (render-only; read by the instanced smoke field). */
export function smokeSources(c: Campaign | null): SmokeSource[] {
  if (!c) return [];
  const out: SmokeSource[] = [];
  const hx = c.world.anchors.hearth.x + 1;
  const hz = c.world.anchors.hearth.y + 1;
  for (const s of c.structures) {
    if (s.kind !== 'cottage' && s.kind !== 'hearth' && s.kind !== 'forge' && s.kind !== 'stone_house')
      continue;
    const st = visualStatus(s);
    if (st === 'constructing' || st === 'rubble' || st === 'buried') continue;
    const [lx, ly, lz] = chimneyOf(s);
    const r = facing(s, hx, hz);
    const cx = s.x + s.w / 2;
    const cz = s.y + s.h / 2;
    out.push({
      x: cx + lx * Math.cos(r) + lz * Math.sin(r),
      y: groundY(cx, cz) - 0.02 + ly,
      z: cz - lx * Math.sin(r) + lz * Math.cos(r),
      seed: s.id,
      dark: s.kind === 'forge',
    });
  }
  return out;
}

const StructureView = memo(function StructureView({ s, rev }: { s: Structure; rev: string }) {
  void rev;
  const def = BUILDINGS[s.kind];
  const group = useRef<Group>(null);
  const cropRef = useRef<Mesh>(null);
  const glowMat = useRef<MeshBasicMaterial>(null);
  const growth = useRef(0);
  // A finished building settles with a small bounce and a puff of sawdust.
  const finishedAt = useRef<number | null>(null);
  const prevStatus = useRef(visualStatus(s));
  const [settle, setSettle] = useState(0);
  const settleOn = useRef(false);
  // During the collapse cinematic a building looks as it did until the hazard front reaches it.
  const status = visualStatus(s);
  const statusRef = useRef(status);
  statusRef.current = status;
  const ruin = status === 'rubble' || status === 'buried';
  const model = useMemo(() => modelFor(s), [s]);
  const hearth = store.campaign!.world.anchors.hearth;
  const rotY = useMemo(() => facing(s, hearth.x + 1, hearth.y + 1), [s, hearth.x, hearth.y]);
  const c = store.campaign!;
  const burnt = s.cause === 'fire';
  const stoneish = def.material === 'stone' || def.material === 'earth' || def.material === 'iron';
  const ruinGeo = useMemo(() => {
    if (!ruin) return null;
    const key = `${s.id}:${s.kind}:${burnt}:${s.burial}:${c.epoch > s.originEpoch}`;
    let g = ruinCache.get(key);
    if (!g) {
      g = ruinGeometry(s.kind, s.w, s.h, 300 + s.id, {
        burnt,
        stone: stoneish,
        burial: s.burial,
        old: c.epoch > s.originEpoch || s.burial > 0,
        wet: s.cause === 'flood',
      });
      ruinCache.set(key, g);
    }
    return g;
  }, [ruin, s.id, s.kind, s.w, s.h, burnt, stoneish, s.burial, s.cause, s.originEpoch, c.epoch]);
  const scaffold = useMemo(() => {
    const key = `${s.kind}:${s.w}x${s.h}`;
    let g = scaffoldCache.get(key);
    if (!g) {
      g = scaffoldGeometry(s.w, s.h, model.height, 900 + s.id, def.material === 'stone');
      scaffoldCache.set(key, g);
    }
    return g;
  }, [s.kind, s.w, s.h, model.height, s.id, def.material]);

  const plane = useMemo(() => new Plane(new Vector3(0, -1, 0), 1e4), []);
  const mat = useMemo(() => {
    const m = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0,
      clippingPlanes: [plane],
      clipShadows: true,
    });
    return m;
  }, [plane]);
  const cropMat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), []);

  const cx = s.x + s.w / 2;
  const cz = s.y + s.h / 2;
  const baseY = useMemo(() => {
    void rev; // terrain is rebuilt when revisions change, so the ground height must be re-read
    return groundY(cx, cz) - 0.02;
  }, [cx, cz, rev]);
  const since = sinceHit(s);
  const hit = presentation.hit.get(s.id);
  const burning =
    presentation.active &&
    presentation.hazard === 'fire' &&
    since >= 0 &&
    since < 2.6 &&
    !!hit &&
    hit.after !== 'active';
  const puff = presentation.active && since >= 0 && since < 1.6 && !!hit && hit.after === 'rubble';

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const now = state.clock.elapsedTime;
    const total = def.buildWork * 1000;
    const st = statusRef.current;
    if (prevStatus.current === 'constructing' && st === 'active' && !presentation.active) {
      finishedAt.current = now;
      if (!store.settings.reducedMotion) {
        settleOn.current = true;
        setSettle((n) => n + 1);
      }
    }
    prevStatus.current = st;
    const since = finishedAt.current === null ? Infinity : now - finishedAt.current;
    const bounce =
      since < 0.9 && !store.settings.reducedMotion ? Math.exp(-since * 5) * Math.sin(since * 20) : 0;
    g.scale.set(1 - 0.035 * bounce, 1 + 0.07 * bounce, 1 - 0.035 * bounce);
    if (settleOn.current && since > 1.7) {
      settleOn.current = false;
      setSettle(0);
    }
    const frac = st === 'constructing' ? Math.min(1, s.progress / Math.max(1, total)) : 1;
    // Sweep the clip plane up through the model as it is assembled.
    const height = model.height * 1.08;
    plane.constant = st === 'constructing' ? baseY + 0.04 + frac * height : 1e4;
    // Damaged buildings are scorched and dimmed.
    if (st === 'damaged') {
      const k = Math.max(0.35, s.integrity / 1000);
      mat.color.setRGB(0.55 + 0.35 * k, 0.5 + 0.35 * k, 0.48 + 0.3 * k);
      if (s.cause === 'fire') mat.color.multiplyScalar(0.8);
    } else {
      mat.color.copy(white);
    }
    // The building under the mouse brightens a little (desktop hover affordance; `HoverRing` draws its outline).
    // A multiplied lift keeps the shading's contrast, where added light would wash the walls and roof out.
    if (store.hoverId === s.id && !store.placing) mat.color.multiplyScalar(1.15);
    // Crops ripen while a staffed farm is active.
    if (s.kind === 'farm') {
      const target =
        st === 'active' ? 0.25 + 0.75 * Math.min(1, s.staffing / 1000) : st === 'damaged' ? 0.2 : 0.05;
      growth.current += (target - growth.current) * Math.min(1, dt * 0.35);
      if (cropRef.current) {
        const gr = growth.current;
        cropRef.current.scale.set(1, 0.12 + 0.88 * gr, 1);
        cropRef.current.visible = st !== 'constructing' || frac > 0.5;
      }
    }
    if (glowMat.current) {
      const flick = 0.82 + 0.18 * Math.sin(now * 9 + s.id) * Math.sin(now * 5.3 + s.id * 2);
      const on = st === 'active' || st === 'damaged';
      glowMat.current.color.setRGB(on ? 1.5 * flick : 0, on ? 1.05 * flick : 0, on ? 0.45 * flick : 0);
    }
  });

  return (
    <group ref={group} position={[cx, baseY, cz]} rotation={[0, rotY, 0]} userData={{ sid: s.id }}>
      {!ruin && (
        <mesh geometry={model.main} material={mat} castShadow receiveShadow userData={{ sid: s.id }} />
      )}
      {!ruin && model.glow && (
        <mesh geometry={model.glow}>
          <meshBasicMaterial ref={glowMat} vertexColors toneMapped={false} />
        </mesh>
      )}
      {!ruin && model.crops && (
        <mesh ref={cropRef} geometry={model.crops} material={cropMat} castShadow receiveShadow />
      )}
      {!ruin && status === 'constructing' && (
        <mesh geometry={scaffold} material={cropMat} castShadow receiveShadow />
      )}
      {ruin && ruinGeo && (
        <mesh geometry={ruinGeo} material={cropMat} castShadow receiveShadow userData={{ sid: s.id }} />
      )}
      {/* invisible pick volume so small buildings remain easy to tap */}
      <mesh position={[0, 0.5, 0]} visible={false} userData={{ sid: s.id }}>
        <boxGeometry args={[s.w * 0.95, 1.0, s.h * 0.95]} />
        <meshBasicMaterial />
      </mesh>
      {s.kind === 'hearth' && !ruin && <Flame />}
      {burning && <BurnFx w={s.w} h={s.h} seed={s.id} />}
      {puff && <DustPuff w={s.w} h={s.h} seed={s.id} />}
      {settle > 0 && <DustPuff key={settle} w={s.w} h={s.h} seed={s.id + settle} light />}
    </group>
  );
});

function Flame() {
  const outer = useRef<Mesh>(null);
  const inner = useRef<Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const f = 0.85 + 0.25 * Math.sin(t * 11) * Math.sin(t * 7.3);
    if (outer.current) {
      outer.current.scale.set(1 + 0.12 * Math.sin(t * 9), f, 1 + 0.12 * Math.cos(t * 8));
      outer.current.rotation.y = t * 1.5;
    }
    if (inner.current) inner.current.scale.set(1, 0.9 + 0.3 * Math.sin(t * 13 + 1), 1);
  });
  return (
    <group position={[0, 0.14, 0]}>
      <mesh ref={outer}>
        <coneGeometry args={[0.2, 0.55, 6]} />
        <meshBasicMaterial color={[2.2, 0.9, 0.25]} toneMapped={false} transparent opacity={0.92} />
      </mesh>
      <mesh ref={inner} position={[0, -0.03, 0]}>
        <coneGeometry args={[0.1, 0.34, 5]} />
        <meshBasicMaterial color={[2.6, 2.0, 0.8]} toneMapped={false} />
      </mesh>
      <pointLight color="#ff9a3c" intensity={1.4} distance={4.5} decay={2} position={[0, 0.4, 0]} />
    </group>
  );
}

export function Structures() {
  const rev = useStructRev();
  const c = store.campaign;
  if (!c) return null;
  return (
    <group name="structures">
      {c.structures.map((s) => (
        <StructureView key={s.id} s={s} rev={rev} />
      ))}
    </group>
  );
}
