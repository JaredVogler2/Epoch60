import { advanceFixedTick, createCampaign, dispatchAction, runTicks } from '../../src/engine';
import type { Action, Campaign } from '../../src/engine';
import { findSpot } from '../../src/engine/ai/spots';
import type { SpotOptions } from '../../src/engine/ai/spots';

export const CANON = 6001;
export const U = 1000;

export function fresh(seed = CANON): Campaign {
  return createCampaign(seed);
}

export function begin(c: Campaign): void {
  const r = dispatchAction(c, { type: 'beginEpoch' });
  if (!r.ok) throw new Error('begin failed: ' + JSON.stringify(r));
}

export function place(
  c: Campaign,
  kind: Parameters<typeof findSpot>[1],
  opts: SpotOptions = {},
): { x: number; y: number; rot: 0 | 1 } {
  const spot = findSpot(c, kind, { ignoreAffordability: false, ...opts });
  if (!spot) throw new Error('no spot for ' + kind);
  const r = dispatchAction(c, { type: 'build', kind, x: spot.x, y: spot.y, rot: spot.rot });
  if (!r.ok) throw new Error('build failed: ' + JSON.stringify(r));
  return spot;
}

export function act(c: Campaign, a: Action) {
  return dispatchAction(c, a);
}

/** A scripted, fully deterministic opening used by several tests. */
export function scriptedEpoch(c: Campaign): void {
  place(c, 'farm', { avoidHazard: true });
  place(c, 'lumber_camp', { maxDist: 18 });
  place(c, 'cottage', { avoidHazard: true });
  begin(c);
  runTicks(c, 200);
  try {
    place(c, 'cottage', { avoidHazard: true });
  } catch {
    /* not enough timber yet — the epoch still plays out */
  }
  runTicks(c, 400);
}

export { advanceFixedTick, runTicks };
