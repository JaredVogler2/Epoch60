import type { BuildingKind, Campaign } from '../core/types';
import { cloneCampaign } from '../save/save';
import { checkPlacement, isPlacementOk } from '../economy/placement';
import { createStructure } from '../economy/structures';
import { getForecast } from '../campaign';
import { footprint } from '../content/buildings';
import { currentHearth, type Spot } from './spots';

/* ------------------------------------------------------------------ */
/* Forecast-driven mitigation                                          */
/* ------------------------------------------------------------------ */

const EQUIPMENT: BuildingKind[] = ['firebreak', 'levee', 'dam', 'retaining_wall', 'grove', 'bridge'];

/** What the coming hazard is predicted to cost: deaths dominate, then damage to anything people built. */
export function predictedLoss(c: Campaign): number {
  const f = getForecast(c);
  let loss = f.predictedDeaths * 40;
  for (const i of f.predicted.impacts) {
    const s = c.structures.find((st) => st.id === i.id);
    if (!s || EQUIPMENT.includes(s.kind)) continue;
    loss += i.damage / 20;
  }
  return loss;
}

/**
 * The spot where one more `kind` lowers the forecast loss the most — what a careful player does with the
 * forecast overlay, by trial. Returns null unless the best candidate is a real improvement.
 */
export function mitigationSpot(
  c: Campaign,
  kind: BuildingKind,
  opts: { maxDist?: number; stride?: number; rots?: (0 | 1)[]; minGain?: number } = {},
): Spot | null {
  const near = currentHearth(c);
  const maxDist = opts.maxDist ?? 12;
  const stride = opts.stride ?? 1;
  const base = predictedLoss(c);
  if (base <= 0) return null;
  let best: Spot | null = null;
  let bestLoss = base - (opts.minGain ?? 1);
  for (const rot of opts.rots ?? [0, 1]) {
    const { w, h } = footprint(kind, rot);
    for (let y = 0; y + h <= c.world.h; y += stride) {
      for (let x = 0; x + w <= c.world.w; x += stride) {
        const dist = Math.abs(x + w / 2 - near.x) + Math.abs(y + h / 2 - near.y);
        if (dist > maxDist) continue;
        if (!isPlacementOk(checkPlacement(c, kind, x, y, rot, { ignoreAffordability: true }))) continue;
        const trial = cloneCampaign(c);
        createStructure(trial, kind, x, y, rot, 'active');
        const loss = predictedLoss(trial) + dist * 0.01;
        if (loss < bestLoss) {
          bestLoss = loss;
          best = { x, y, rot, w, h, score: base - loss };
        }
      }
    }
  }
  return best;
}
