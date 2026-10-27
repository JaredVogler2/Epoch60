import { BUILDINGS } from '../content/buildings';
import { EPOCH_TICKS } from '../core/constants';
import type { Campaign } from '../core/types';
import { RESOURCE_KEYS } from '../core/types';
import { cellsOf, idx } from '../world/query';

const STATUSES = new Set(['constructing', 'active', 'damaged', 'rubble', 'buried']);

/**
 * Structural invariants every reachable campaign state must satisfy. Used by the fuzz tests and the simulation
 * harness; returns human-readable violations (empty = healthy).
 */
export function checkInvariants(c: Campaign): string[] {
  const bad: string[] = [];
  const num = (label: string, v: number) => {
    if (!Number.isFinite(v)) bad.push(`${label} is not finite (${String(v)})`);
  };
  for (const k of RESOURCE_KEYS) {
    const v = c.civ.res[k];
    num(`resource ${k}`, v);
    if (v < 0) bad.push(`resource ${k} is negative (${v})`);
    if (!Number.isInteger(v)) bad.push(`resource ${k} is not an integer (${v})`);
  }
  num('population', c.civ.pop);
  if (c.civ.pop < 0) bad.push(`population is negative (${c.civ.pop})`);
  if (c.tick < 0 || c.tick > EPOCH_TICKS) bad.push(`tick out of range (${c.tick})`);
  if (c.civ.morale < 0 || c.civ.morale > 1000) bad.push(`morale out of range (${c.civ.morale})`);

  const w = c.world;
  for (const [name, field] of Object.entries({
    height: w.height,
    forest: w.forest,
    fertility: w.fertility,
    rock: w.rock,
    scar: w.scar,
    silt: w.silt,
  })) {
    for (let i = 0; i < field.length; i++) {
      if (!Number.isFinite(field[i]!)) {
        bad.push(`world.${name}[${i}] is not finite`);
        break;
      }
    }
  }
  for (let i = 0; i < w.fertility.length; i++) {
    if (w.fertility[i]! < 0 || w.fertility[i]! > 1000) {
      bad.push(`fertility out of range at ${i}`);
      break;
    }
  }
  for (let i = 0; i < w.forest.length; i++) {
    if (w.forest[i]! < 0 || w.forest[i]! > 1000) {
      bad.push(`forest out of range at ${i}`);
      break;
    }
  }

  // Occupancy must agree with the structure list, and no two live structures may share a cell.
  const owner = new Map<number, number>();
  for (const s of c.structures) {
    if (!STATUSES.has(s.status)) bad.push(`structure ${s.id} has unknown status ${s.status}`);
    if (!BUILDINGS[s.kind]) bad.push(`structure ${s.id} has unknown kind ${s.kind}`);
    if (s.integrity < 0 || s.integrity > 1000) bad.push(`structure ${s.id} integrity ${s.integrity}`);
    for (const [x, y] of cellsOf(s)) {
      const i = idx(x, y, w.w);
      if (w.occ[i] !== s.id) {
        // A cleared ruin may have been built over; only live structures must own their cells.
        if (s.status !== 'rubble' && s.status !== 'buried')
          bad.push(`cell (${x},${y}) is not owned by live structure ${s.id}`);
        continue;
      }
      if (owner.has(i)) bad.push(`cell (${x},${y}) is claimed by structures ${owner.get(i)} and ${s.id}`);
      owner.set(i, s.id);
    }
  }
  const ids = new Set(c.structures.map((s) => s.id));
  if (ids.size !== c.structures.length) bad.push('duplicate structure ids');
  return bad;
}
