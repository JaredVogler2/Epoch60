import { BUILDINGS, footprint } from '../content/buildings';
import { UNIT } from '../core/constants';
import type { BuildingKind, Campaign, Structure, StructureStatus } from '../core/types';
import { cellsOf, idx, meanHeight } from '../world/query';

export function findStructure(c: Campaign, id: number): Structure | undefined {
  return c.structures.find((s) => s.id === id);
}

export function createStructure(
  c: Campaign,
  kind: BuildingKind,
  x: number,
  y: number,
  rot: 0 | 1,
  status: StructureStatus,
): Structure {
  const { w, h } = footprint(kind, rot);
  const s: Structure = {
    id: c.nextId++,
    kind,
    x,
    y,
    w,
    h,
    rot,
    originEpoch: c.epoch,
    status,
    progress: 0,
    integrity: 1000,
    bonus: { fire: 0, flood: 0, quake: 0, ash: 0 },
    workers: 0,
    acc: 0,
    staffing: 0,
    storedTechs: [],
    cause: null,
    salvage: { timber: 0, stone: 0 },
    burial: 0,
    surveyed: false,
    excavated: false,
    provenance: [],
    repairs: 0,
  };
  c.structures.push(s);
  for (const [cx, cy] of cellsOf(s)) c.world.occ[idx(cx, cy, c.world.w)] = s.id;
  return s;
}

/** Level the ground under a footprint (a permanent change to the persistent terrain). */
export function levelPad(c: Campaign, s: Structure): void {
  const def = BUILDINGS[s.kind];
  if (def.water === 'require' || s.kind === 'levee') return;
  const pad = meanHeight(c.world, s.x, s.y, s.w, s.h);
  for (const [cx, cy] of cellsOf(s)) {
    const i = idx(cx, cy, c.world.w);
    c.world.height[i] = pad;
    if (s.kind !== 'grove') c.world.forest[i] = 0;
  }
}

export function removeStructure(c: Campaign, id: number): Structure | undefined {
  const k = c.structures.findIndex((s) => s.id === id);
  if (k < 0) return undefined;
  const [s] = c.structures.splice(k, 1);
  if (s)
    for (const [cx, cy] of cellsOf(s)) {
      const i = idx(cx, cy, c.world.w);
      if (c.world.occ[i] === id) c.world.occ[i] = -1;
    }
  return s;
}

export function costUnits(kind: BuildingKind): { timber: number; stone: number; food: number } {
  const d = BUILDINGS[kind];
  return {
    timber: (d.cost.timber ?? 0) * UNIT,
    stone: (d.cost.stone ?? 0) * UNIT,
    food: (d.cost.food ?? 0) * UNIT,
  };
}
