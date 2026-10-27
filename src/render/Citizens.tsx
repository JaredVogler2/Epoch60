import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { BUILDINGS, GRID_H, GRID_W } from '../engine';
import type { Structure } from '../engine';
import { store } from '../game/store';
import { GeoBuilder, PAL, h01, rgb } from './geo';
import { INF, buildWalkable, distanceField, entranceCell, hearthOf, N8 } from './paths';
import { presentation } from './presentation';
import { groundY } from './world';

export type Role = 'builder' | 'farmer' | 'lumberjack' | 'quarryman' | 'scholar' | 'idle';

/** Where the villagers are and what they do, for tests and captures (read-only; gameplay never uses it). */
export const citizensApi: { list: () => { x: number; z: number; role: Role; moving: boolean }[] } = {
  list: () => [],
};

/** Tunic hue by job; each age dyes it differently (see `tunic`). */
const ROLE_COLOR: Record<Role, string> = {
  builder: '#e2792f',
  farmer: '#d8c05a',
  lumberjack: '#b8453a',
  quarryman: '#8e949e',
  scholar: '#4f7cc4',
  idle: '#e9dfc4',
};
/** Undyed cloth: the first age's tunics are mostly this. */
const LINEN = new Color('#cbb68c');
/** Trousers and leggings per age: undyed wool, dyed cloth, dark tailored wool. */
const TROUSERS = ['#6f5a40', '#55473a', '#34343c'];
type Hat = 'brim' | 'cap';
/** What each job wears on its head — the silhouette that tells them apart from a distance. */
const HEADWEAR: Record<Role, { hat: Hat; color: string; scale: [number, number, number] } | null> = {
  farmer: { hat: 'brim', color: '#e3c46a', scale: [1.25, 0.85, 1.25] },
  builder: { hat: 'brim', color: '#8a6440', scale: [0.84, 1, 0.84] },
  quarryman: { hat: 'brim', color: '#6f665b', scale: [0.74, 0.8, 0.74] },
  lumberjack: { hat: 'cap', color: '#8e3a2c', scale: [1, 1, 1] },
  scholar: { hat: 'cap', color: '#2f3d66', scale: [1, 1.2, 1] },
  idle: null,
};
type Tool = 'mallet' | 'axe' | 'pick' | 'hoe' | 'tablet';
const TOOL_OF: Record<Role, Tool | null> = {
  builder: 'mallet',
  lumberjack: 'axe',
  quarryman: 'pick',
  farmer: 'hoe',
  scholar: 'tablet',
  idle: null,
};
const TOOLS: Tool[] = ['mallet', 'axe', 'pick', 'hoe', 'tablet'];
const HATS: Hat[] = ['brim', 'cap'];
const SKIN = ['#f1c9a0', '#d9a36f', '#b57a4d', '#8d5a36'];
const MAX = 40;
const STILL = typeof location !== 'undefined' && new URLSearchParams(location.search).has('still');

interface Agent {
  id: number;
  x: number;
  z: number;
  heading: number;
  role: Role;
  /** Structure being worked at (null = idle around the hearth). */
  site: number | null;
  target: number;
  offX: number;
  offZ: number;
  phase: number;
  speed: number;
  skin: number;
  wanderBucket: number;
  moving: boolean;
}

function roleOf(s: Structure): Role {
  const d = BUILDINGS[s.kind];
  if (s.status === 'constructing') return 'builder';
  switch (d.job) {
    case 'food':
      return 'farmer';
    case 'timber':
      return 'lumberjack';
    case 'stone':
      return 'quarryman';
    case 'knowledge':
      return 'scholar';
    default:
      return 'builder';
  }
}

function personGeometries() {
  const white = rgb('#ffffff');
  const torso = new GeoBuilder(11);
  torso.jitter = 0.04;
  torso.frustum(0, 0, 0, 0.15, 0.1, 0.11, 0.075, 0.17, white);
  // A sash at the waist: the tunic's own colour, darker.
  torso.frustum(0, 0.035, 0, 0.142, 0.096, 0.137, 0.093, 0.022, rgb('#8a8278'));
  torso.box(-0.078, 0.1, 0, 0.035, 0.08, 0.04, white);
  torso.box(0.078, 0.1, 0, 0.035, 0.08, 0.04, white);
  const head = new GeoBuilder(12);
  head.jitter = 0.03;
  head.lump(0, 0.235, 0, 0.061, 0.066, 0.061, white, { detail: 0, rough: 0.03 });
  head.lump(0, 0.262, -0.012, 0.066, 0.043, 0.064, rgb('#3a2a1c'), { detail: 0, rough: 0.03 });
  const leg = new GeoBuilder(13);
  leg.jitter = 0.04;
  leg.box(-0.03, -0.15, 0, 0.045, 0.15, 0.055, white);
  const legR = new GeoBuilder(15);
  legR.jitter = 0.04;
  legR.box(0.03, -0.15, 0, 0.045, 0.15, 0.055, white);

  // Headwear, white so each job can tint it: a brimmed hat (straw, felt or leather) and a soft cap with a tip.
  const brim = new GeoBuilder(16);
  brim.cyl(0, 0.272, 0, 0.11, 0.08, 0.014, 10, white);
  brim.cyl(0, 0.284, 0, 0.058, 0.044, 0.052, 8, white);
  const cap = new GeoBuilder(17);
  cap.lump(0, 0.272, -0.006, 0.07, 0.048, 0.069, white, { detail: 0, rough: 0.02 });
  cap.cyl(0, 0.3, -0.03, 0.03, 0, 0.05, 6, white);

  // Tools hang from the hand along -y and swing about it; colours are baked (wood, iron, stone).
  const wood = PAL.timber;
  const iron = rgb('#9aa3ad');
  const mallet = new GeoBuilder(18);
  mallet.beam([0, 0, 0], [0, -0.15, 0], 0.008, wood);
  mallet.box(0, -0.19, 0, 0.065, 0.045, 0.045, PAL.woodLight);
  const axe = new GeoBuilder(19);
  axe.beam([0, 0, 0], [0, -0.2, 0], 0.008, wood);
  axe.box(0, -0.205, 0.028, 0.012, 0.055, 0.05, iron);
  const pick = new GeoBuilder(20);
  pick.beam([0, 0, 0], [0, -0.19, 0], 0.008, wood);
  pick.beam([0, -0.195, -0.06], [0, -0.195, 0.06], 0.011, iron);
  const hoe = new GeoBuilder(21);
  hoe.beam([0, 0, 0], [0, -0.25, 0], 0.007, wood);
  hoe.box(0, -0.255, 0.022, 0.055, 0.012, 0.045, iron);
  const tablet = new GeoBuilder(22);
  tablet.box(0, -0.06, 0.035, 0.075, 0.09, 0.014, PAL.clay);
  return {
    torso: torso.build(),
    head: head.build(),
    leg: leg.build(),
    legR: legR.build(),
    hats: { brim: brim.build(), cap: cap.build() } as Record<Hat, BufferGeometry>,
    tools: {
      mallet: mallet.build(),
      axe: axe.build(),
      pick: pick.build(),
      hoe: hoe.build(),
      tablet: tablet.build(),
    } as Record<Tool, BufferGeometry>,
  };
}

/** A tunic's colour: the job's hue, undyed linen in the first age, bright dyes in the second, deep wool in the third. */
function tunic(out: Color, role: Role, epoch: number, person: number): Color {
  out.set(ROLE_COLOR[role]);
  if (epoch <= 0) out.lerp(LINEN, 0.45);
  else if (epoch === 1) out.lerp(LINEN, 0.12);
  else out.multiplyScalar(0.8);
  return out.multiplyScalar(0.94 + h01(person, 9, 2) * 0.12);
}

const M = new Matrix4();
const base = new Matrix4();
const rot = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3(1.3, 1.3, 1.3);
const tmpColor = new Color();
const EULER_AXIS_X = new Vector3(1, 0, 0);
const EULER_AXIS_Y = new Vector3(0, 1, 0);
/** Parks an instance that has nothing to show (no hat, no tool) at zero scale. */
const HIDDEN = new Matrix4().makeScale(0, 0, 0);
const HAT_UP = new Matrix4().makeTranslation(0, 0.272, 0);
const HAT_DOWN = new Matrix4().makeTranslation(0, -0.272, 0);
const hatScale = new Matrix4();
const qx = new Quaternion();
const qy = new Quaternion();

export function Citizens() {
  const geo = useMemo(() => personGeometries(), []);
  const mat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), []);
  const torsoRef = useRef<InstancedMesh>(null);
  const headRef = useRef<InstancedMesh>(null);
  const legLRef = useRef<InstancedMesh>(null);
  const legRRef = useRef<InstancedMesh>(null);
  const hatRefs = useRef<Partial<Record<Hat, InstancedMesh | null>>>({});
  const toolRefs = useRef<Partial<Record<Tool, InstancedMesh | null>>>({});
  const agents = useRef<Agent[]>([]);
  const cache = useRef<{
    sig: string;
    walk: Uint8Array;
    fields: Map<number, Int16Array>;
    home: number;
    hx: number;
    hz: number;
  } | null>(null);
  const lastAssign = useRef(-1);
  useEffect(() => {
    citizensApi.list = () => agents.current.map((a) => ({ x: a.x, z: a.z, role: a.role, moving: a.moving }));
    return () => {
      citizensApi.list = () => [];
    };
  }, []);

  useFrame((state, dtRaw) => {
    const c = store.campaign;
    const torso = torsoRef.current;
    const head = headRef.current;
    const legL = legLRef.current;
    const legR = legRRef.current;
    const hats = HATS.map((h) => hatRefs.current[h]);
    const tools = TOOLS.map((k) => toolRefs.current[k]);
    if (!c || !torso || !head || !legL || !legR || hats.some((m) => !m) || tools.some((m) => !m)) return;
    const extras = [...hats, ...tools] as InstancedMesh[];
    const visible =
      store.screen === 'title' || c.phase === 'PREPARE' || c.phase === 'ACTIVE' || c.phase === 'COLLAPSING';
    if (!visible || (c.civ.pop <= 0 && c.phase !== 'COLLAPSING')) {
      for (const m of [torso, head, legL, legR, ...extras]) m.count = 0;
      return;
    }
    const frozen = store.screen === 'game' && c.phase === 'ACTIVE' && c.paused;
    // `?still` (tests) renders on demand, so allow bigger steps to let people walk between captures.
    const dt = frozen ? 0 : Math.min(dtRaw, STILL ? 1 : 0.1);
    const t = state.clock.elapsedTime;

    // Walkable grid and fields are rebuilt only when buildings change.
    let sig = `${c.epoch}|${c.structures.length}`;
    for (const s of c.structures) sig += `${s.id}${s.status[0]}`;
    if (!cache.current || cache.current.sig !== sig) {
      const walk = buildWalkable(c);
      const h = hearthOf(c);
      const hc = h
        ? { x: h.x + h.w / 2, y: h.y + h.h / 2 }
        : { x: c.world.anchors.hearth.x + 1, y: c.world.anchors.hearth.y + 1 };
      const homeStruct =
        h ?? ({ x: c.world.anchors.hearth.x, y: c.world.anchors.hearth.y, w: 2, h: 2 } as Structure);
      const home = entranceCell(walk, homeStruct, { x: hc.x, y: hc.y + 6 });
      cache.current = { sig, walk, fields: new Map(), home, hx: hc.x, hz: hc.y };
    }
    const cc = cache.current;
    const fieldFor = (target: number): Int16Array => {
      let f = cc.fields.get(target);
      if (!f) {
        f = distanceField(cc.walk, [target]);
        cc.fields.set(target, f);
      }
      return f;
    };

    // Assignment: mirror the engine's labor allocation (construction first, then staffed jobs), refreshed at ~4 Hz.
    const ag = agents.current;
    while (ag.length < c.civ.pop && ag.length < MAX) {
      const id = ag.length;
      const hx = cc.home >= 0 ? (cc.home % GRID_W) + 0.5 : cc.hx;
      const hz = cc.home >= 0 ? Math.floor(cc.home / GRID_W) + 0.5 : cc.hz;
      ag.push({
        id,
        x: hx + (h01(id, 1, 1) - 0.5) * 0.6,
        z: hz + (h01(id, 2, 1) - 0.5) * 0.6,
        heading: h01(id, 3, 1) * 6.28,
        role: 'idle',
        site: null,
        target: cc.home,
        offX: (h01(id, 4, 1) - 0.5) * 0.5,
        offZ: (h01(id, 5, 1) - 0.5) * 0.5,
        phase: h01(id, 6, 1) * 6.28,
        speed: 0.95 + h01(id, 7, 1) * 0.35,
        skin: Math.floor(h01(id, 8, 1) * SKIN.length),
        wanderBucket: -1,
        moving: false,
      });
    }
    // During the cinematic the dead are still on their feet until the hazard reaches them.
    const shown =
      c.phase === 'COLLAPSING' && c.report && presentation.active
        ? c.report.survivorsBefore - Math.floor(c.report.deaths * Math.min(1, presentation.front * 1.1))
        : c.civ.pop;
    while (ag.length < shown && ag.length < MAX) {
      const id = ag.length;
      ag.push({
        ...ag[0]!,
        id,
        x: ag[0]!.x + (h01(id, 1, 5) - 0.5),
        z: ag[0]!.z + (h01(id, 2, 5) - 0.5),
        skin: id % SKIN.length,
      });
    }
    ag.length = Math.min(ag.length, Math.min(shown, MAX));
    if (t - lastAssign.current > 0.25 || lastAssign.current < 0) {
      lastAssign.current = t;
      const tasks: { site: number; role: Role }[] = [];
      const sorted = [...c.structures].sort((a, b) => a.id - b.id);
      for (const s of sorted)
        if (s.status === 'constructing')
          for (let i = 0; i < s.workers; i++) tasks.push({ site: s.id, role: 'builder' });
      for (const s of sorted) {
        if (s.status !== 'active' && s.status !== 'damaged') continue;
        for (let i = 0; i < s.workers; i++) tasks.push({ site: s.id, role: roleOf(s) });
      }
      // Idle people spread wider as there are more of them, so a big village does not knot around its hearth.
      const idleSpread = 2.6 + Math.sqrt(Math.max(0, ag.length - tasks.length)) * 0.55;
      ag.forEach((a, i) => {
        const task = tasks[i];
        if (task) {
          a.site = task.site;
          a.role = task.role;
          const s = c.structures.find((st) => st.id === task.site);
          a.target = s ? entranceCell(cc.walk, s, { x: cc.hx, y: cc.hz }) : cc.home;
          if (a.target < 0) a.target = cc.home;
        } else {
          a.site = null;
          a.role = 'idle';
          // Idle people drift around the hearth, choosing a new spot every few seconds.
          const bucket = Math.floor(t / (5 + (a.id % 4)));
          if (a.wanderBucket !== bucket || a.target < 0) {
            a.wanderBucket = bucket;
            const ang = h01(a.id, bucket, 11) * Math.PI * 2;
            const r = 1 + h01(a.id, bucket, 12) * idleSpread;
            const hx = Math.floor(cc.hx + Math.cos(ang) * r);
            const hz = Math.floor(cc.hz + Math.sin(ang) * r);
            const k = hz * GRID_W + hx;
            a.target = hx >= 0 && hz >= 0 && hx < GRID_W && hz < GRID_H && cc.walk[k] ? k : cc.home;
          }
        }
      });
    }

    // Move and animate.
    let n = 0;
    const flee = c.phase === 'COLLAPSING';
    for (const a of ag) {
      const tx = (a.target % GRID_W) + 0.5 + a.offX;
      const tz = Math.floor(a.target / GRID_W) + 0.5 + a.offZ;
      const cx = Math.floor(a.x);
      const cz = Math.floor(a.z);
      const field = a.target >= 0 ? fieldFor(a.target) : null;
      let wx = tx;
      let wz = tz;
      const cur = cz * GRID_W + cx;
      let atTarget = false;
      if (field && cx >= 0 && cz >= 0 && cx < GRID_W && cz < GRID_H) {
        const d = field[cur]!;
        if (d >= INF) {
          // standing somewhere unreachable (e.g. a building was placed on them): step out to the hearth
          if (cc.home >= 0) {
            a.x = (cc.home % GRID_W) + 0.5;
            a.z = Math.floor(cc.home / GRID_W) + 0.5;
          }
        } else if (d === 0) {
          atTarget = true;
        } else {
          let best = cur;
          let bd = d;
          for (const [dx, dy] of N8) {
            const nx = cx + dx;
            const ny = cz + dy;
            if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
            const ni = ny * GRID_W + nx;
            if (field[ni]! < bd) {
              bd = field[ni]!;
              best = ni;
            }
          }
          wx = (best % GRID_W) + 0.5;
          wz = Math.floor(best / GRID_W) + 0.5;
        }
      }
      const dx = wx - a.x;
      const dz = wz - a.z;
      const dist = Math.hypot(dx, dz);
      const arrived = atTarget && dist < 0.08;
      a.moving = !arrived && dist > 0.02 && dt > 0;
      if (a.moving) {
        const speed = (flee ? 2.0 : 1.0) * a.speed;
        const stepLen = Math.min(dist, speed * dt);
        a.x += (dx / dist) * stepLen;
        a.z += (dz / dist) * stepLen;
        const want = Math.atan2(dx, dz);
        let dh = want - a.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        a.heading += dh * Math.min(1, dt * 9);
      }
      // pose
      const walkT = t * 7 * a.speed + a.phase;
      const bob = a.moving ? Math.abs(Math.sin(walkT)) * 0.025 : 0;
      let tilt = 0;
      let toolSwing = 0;
      let showTool = false;
      if (!a.moving) {
        const w = t * 5 + a.phase;
        if (a.role === 'builder' || a.role === 'lumberjack' || a.role === 'quarryman') {
          toolSwing = -0.5 + Math.sin(w * (a.role === 'builder' ? 1.6 : 1.1)) * 0.9;
          tilt = 0.12 + Math.max(0, Math.sin(w * (a.role === 'builder' ? 1.6 : 1.1))) * 0.18;
          showTool = true;
        } else if (a.role === 'farmer') {
          tilt = 0.55 + Math.sin(w * 0.5) * 0.15;
          toolSwing = -0.9 + Math.sin(w * 0.9) * 0.35;
          showTool = true;
        } else if (a.role === 'scholar') {
          tilt = 0.2;
          showTool = true;
        } else {
          tilt = Math.sin(w * 0.4) * 0.03;
        }
      }
      const y = groundY(a.x, a.z) + 0.16 + bob;
      pos.set(a.x, y, a.z);
      qy.setFromAxisAngle(EULER_AXIS_Y, a.heading);
      qx.setFromAxisAngle(EULER_AXIS_X, tilt);
      quat.copy(qy).multiply(qx);
      base.compose(pos, quat, scl);
      torso.setMatrixAt(n, base);
      head.setMatrixAt(n, base);
      const swing = a.moving ? Math.sin(walkT) * 0.7 : 0;
      rot.makeRotationX(swing);
      M.copy(base).multiply(rot);
      legL.setMatrixAt(n, M);
      rot.makeRotationX(-swing);
      M.copy(base).multiply(rot);
      legR.setMatrixAt(n, M);
      // Headwear follows the head; only the job's own hat shape is shown.
      const wear = HEADWEAR[a.role];
      HATS.forEach((h, k) => {
        const m = hats[k]!;
        if (wear?.hat === h) {
          // Scaled about the hat's own height, so a wide straw brim stays on the head.
          hatScale.makeScale(wear.scale[0], wear.scale[1], wear.scale[2]);
          M.copy(base).multiply(HAT_UP).multiply(hatScale).multiply(HAT_DOWN);
          m.setMatrixAt(n, M);
          m.setColorAt(n, tmpColor.set(wear.color));
        } else m.setMatrixAt(n, HIDDEN);
      });
      // The job's tool at the hand, swinging while at work; a scholar holds a tablet up to read.
      const own = TOOL_OF[a.role];
      TOOLS.forEach((k, i) => {
        const m = tools[i]!;
        if (k !== own || !showTool) {
          m.setMatrixAt(n, HIDDEN);
          return;
        }
        M.copy(base);
        rot.makeTranslation(0.085, 0.2, 0.02);
        M.multiply(rot);
        rot.makeRotationX(k === 'tablet' ? -1.25 : toolSwing);
        M.multiply(rot);
        m.setMatrixAt(n, M);
      });
      torso.setColorAt(n, tunic(tmpColor, a.role, c.epoch, a.id));
      tmpColor.set(TROUSERS[Math.min(2, c.epoch)]!).multiplyScalar(0.92 + h01(a.id, 10, 2) * 0.16);
      legL.setColorAt(n, tmpColor);
      legR.setColorAt(n, tmpColor);
      tmpColor.set(SKIN[a.skin]!);
      head.setColorAt(n, tmpColor);
      n++;
    }
    for (const m of [torso, head, legL, legR, ...extras]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  const common = { castShadow: true, receiveShadow: false, frustumCulled: false } as const;
  // Hats and tools are a few pixels across: their shadows would be invisible, so they skip the shadow pass.
  const small = { ...common, castShadow: false } as const;
  return (
    <group>
      <instancedMesh ref={torsoRef} args={[geo.torso, mat, MAX]} {...common} />
      <instancedMesh ref={headRef} args={[geo.head, mat, MAX]} {...common} />
      <instancedMesh ref={legLRef} args={[geo.leg, mat, MAX]} {...common} />
      <instancedMesh ref={legRRef} args={[geo.legR, mat, MAX]} {...common} />
      {HATS.map((h) => (
        <instancedMesh
          key={h}
          ref={(m) => {
            hatRefs.current[h] = m;
          }}
          args={[geo.hats[h], mat, MAX]}
          {...small}
        />
      ))}
      {TOOLS.map((k) => (
        <instancedMesh
          key={k}
          ref={(m) => {
            toolRefs.current[k] = m;
          }}
          args={[geo.tools[k], mat, MAX]}
          {...small}
        />
      ))}
    </group>
  );
}
