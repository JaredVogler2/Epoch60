import type { Campaign, CollapseReport, HazardKind, Structure, StructureStatus, World } from '../engine';
import { GRID_W } from '../engine';

/**
 * Render-only state for the collapse cinematic. The engine has ALREADY resolved the cataclysm when this runs; the
 * presentation merely shows the world as it was until the hazard front reaches each cell/building. It never writes
 * to the campaign and can be skipped or replayed (even after a refresh) without changing any outcome.
 */
export const presentation: {
  active: boolean;
  /** Normalised progress 0..1 of the whole cinematic. */
  t: number;
  /** Normalised front position 0..1 (cells with normalised arrival <= front have been hit). */
  front: number;
  hazard: HazardKind;
  duration: number;
  startedAt: number;
  rev: number;
  world: World | null;
  report: CollapseReport | null;
  /** structure id → normalised arrival of the hazard at its footprint. */
  hit: Map<number, { a: number; before: StructureStatus; after: StructureStatus }>;
  /** Test override: freeze the presentation at this progress. */
  override: number | null;
} = {
  active: false,
  t: 0,
  front: 0,
  hazard: 'fire',
  duration: 5.5,
  startedAt: 0,
  rev: 0,
  world: null,
  report: null,
  hit: new Map(),
  override: null,
};

/** The front reaches everything by this fraction of the timeline; the rest is aftermath. */
export const FRONT_END = 0.82;

export function frontOf(t: number): number {
  return Math.min(1, t / FRONT_END);
}

export function renderWorld(c: Campaign): World {
  return presentation.active && presentation.world ? presentation.world : c.world;
}

/** Status to draw for a structure right now (pre-collapse until the front arrives). */
export function visualStatus(s: Structure): StructureStatus {
  if (!presentation.active) return s.status;
  const h = presentation.hit.get(s.id);
  if (!h) return s.status;
  return presentation.front >= h.a ? s.status : h.before;
}

/** Seconds since the front reached a structure (negative before it arrives). */
export function sinceHit(s: Structure): number {
  const h = presentation.hit.get(s.id);
  if (!presentation.active || !h) return -1;
  return (presentation.front - h.a) * FRONT_END * presentation.duration;
}

export function beginPresentation(c: Campaign, now: number, duration: number): void {
  const r = c.report!;
  presentation.active = true;
  presentation.report = r;
  presentation.hazard = r.hazard;
  presentation.duration = duration;
  presentation.startedAt = now;
  presentation.t = 0;
  presentation.front = 0;
  const span = Math.max(1, r.result.span);
  const arrivalAt = new Map<number, number>();
  for (const cell of r.result.cells) arrivalAt.set(cell.y * GRID_W + cell.x, cell.arrival / span);
  presentation.hit = new Map();
  for (const imp of r.result.impacts) {
    const s = c.structures.find((st) => st.id === imp.id);
    if (!s) continue;
    let a = Infinity;
    for (let j = 0; j < s.h; j++) {
      for (let i = 0; i < s.w; i++) {
        const v = arrivalAt.get((s.y + j) * GRID_W + s.x + i);
        if (v !== undefined && v < a) a = v;
      }
    }
    presentation.hit.set(s.id, { a: Number.isFinite(a) ? a : 0, before: imp.before, after: imp.after });
  }
  rebuildWorld(c);
}

export function endPresentation(): void {
  if (!presentation.active) return;
  presentation.active = false;
  presentation.world = null;
  presentation.report = null;
  presentation.hit.clear();
  presentation.rev++;
}

/** Restore pre-collapse terrain fields for every cell the front has not yet reached. */
export function rebuildWorld(c: Campaign): void {
  const r = presentation.report;
  if (!r) return;
  const w = c.world;
  const pw: World = {
    ...w,
    forest: w.forest.slice(),
    scar: w.scar.slice(),
    silt: w.silt.slice(),
    pollution: w.pollution.slice(),
  };
  const span = Math.max(1, r.result.span);
  r.result.cells.forEach((cell, k) => {
    const a = cell.arrival / span;
    if (a > presentation.front) {
      const i = r.before.cells[k]!;
      pw.forest[i] = r.before.forest[k]!;
      pw.scar[i] = r.before.scar[k]!;
      pw.silt[i] = r.before.silt[k]!;
      pw.pollution[i] = r.before.pollution[k]!;
    }
  });
  presentation.world = pw;
  presentation.rev++;
}
