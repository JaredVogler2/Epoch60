import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { BUILDINGS, GRID_H, GRID_W } from '../engine';
import type { Structure } from '../engine';
import { store } from '../game/store';
import { GeoBuilder, PAL, h01, rgb } from './geo';
import { INF, buildWalkable, distanceField, entranceCell, hearthOf, N8 } from './paths';
import { presentation } from './presentation';
import { groundY } from './world';

type Role = 'builder' | 'farmer' | 'lumberjack' | 'quarryman' | 'scholar' | 'idle';

const ROLE_COLOR: Record<Role, string> = {
  builder: '#e2792f',
  farmer: '#d8c05a',
  lumberjack: '#b8453a',
  quarryman: '#8e949e',
  scholar: '#4f7cc4',
  idle: '#e9dfc4',
};
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
  const torso = new GeoBuilder(11);
  torso.jitter = 0.04;
  torso.frustum(0, 0, 0, 0.14, 0.09, 0.11, 0.075, 0.17, rgb('#ffffff'));
  torso.box(-0.075, 0.1, 0, 0.035, 0.08, 0.04, rgb('#ffffff'));
  torso.box(0.075, 0.1, 0, 0.035, 0.08, 0.04, rgb('#ffffff'));
  const head = new GeoBuilder(12);
  head.jitter = 0.03;
  head.lump(0, 0.23, 0, 0.055, 0.06, 0.055, rgb('#ffffff'), { detail: 0, rough: 0.03 });
  head.lump(0, 0.255, -0.01, 0.06, 0.04, 0.058, rgb('#3a2a1c'), { detail: 0, rough: 0.03 });
  const leg = new GeoBuilder(13);
  leg.jitter = 0.04;
  leg.box(-0.03, -0.15, 0, 0.045, 0.15, 0.055, PAL.timberDark);
  const legR = new GeoBuilder(15);
  legR.jitter = 0.04;
  legR.box(0.03, -0.15, 0, 0.045, 0.15, 0.055, PAL.timberDark);
  const tool = new GeoBuilder(14);
  tool.jitter = 0.02;
  tool.beam([0, 0, 0], [0, -0.17, 0.0], 0.008, PAL.timber);
  tool.box(0, -0.2, 0, 0.07, 0.035, 0.03, PAL.stoneDark);
  return {
    torso: torso.build(),
    head: head.build(),
    leg: leg.build(),
    legR: legR.build(),
    tool: tool.build(),
  };
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
const qx = new Quaternion();
const qy = new Quaternion();

export function Citizens() {
  const geo = useMemo(() => personGeometries(), []);
  const mat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), []);
  const torsoRef = useRef<InstancedMesh>(null);
  const headRef = useRef<InstancedMesh>(null);
  const legLRef = useRef<InstancedMesh>(null);
  const legRRef = useRef<InstancedMesh>(null);
  const toolRef = useRef<InstancedMesh>(null);
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

  useFrame((state, dtRaw) => {
    const c = store.campaign;
    const torso = torsoRef.current;
    const head = headRef.current;
    const legL = legLRef.current;
    const legR = legRRef.current;
    const tool = toolRef.current;
    if (!c || !torso || !head || !legL || !legR || !tool) return;
    const visible =
      store.screen === 'title' || c.phase === 'PREPARE' || c.phase === 'ACTIVE' || c.phase === 'COLLAPSING';
    if (!visible || (c.civ.pop <= 0 && c.phase !== 'COLLAPSING')) {
      torso.count = head.count = legL.count = legR.count = tool.count = 0;
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
            const r = 1 + h01(a.id, bucket, 12) * 2.6;
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
        } else if (a.role === 'scholar') {
          tilt = 0.2;
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
      // tool at the hand
      M.copy(base);
      rot.makeTranslation(0.085, 0.2, 0.02);
      M.multiply(rot);
      rot.makeRotationX(toolSwing);
      M.multiply(rot);
      if (!showTool) M.scale(new Vector3(0.0001, 0.0001, 0.0001));
      tool.setMatrixAt(n, M);
      tmpColor.set(ROLE_COLOR[a.role]);
      torso.setColorAt(n, tmpColor);
      tmpColor.set(SKIN[a.skin]!);
      head.setColorAt(n, tmpColor);
      n++;
    }
    for (const m of [torso, head, legL, legR, tool]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }
    if (torso.instanceColor) torso.instanceColor.needsUpdate = true;
    if (head.instanceColor) head.instanceColor.needsUpdate = true;
  });

  const common = { castShadow: true, receiveShadow: false, frustumCulled: false } as const;
  return (
    <group>
      <instancedMesh ref={torsoRef} args={[geo.torso, mat, MAX]} {...common} />
      <instancedMesh ref={headRef} args={[geo.head, mat, MAX]} {...common} />
      <instancedMesh ref={legLRef} args={[geo.leg, mat, MAX]} {...common} />
      <instancedMesh ref={legRRef} args={[geo.legR, mat, MAX]} {...common} />
      <instancedMesh ref={toolRef} args={[geo.tool, mat, MAX]} {...common} />
    </group>
  );
}
