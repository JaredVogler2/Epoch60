import { advanceFixedTick, createCampaign, dispatchAction, setPaused } from '../engine';
import type { BuildingKind, Campaign } from '../engine';
import { findSpot } from '../engine/ai/spots';
import type { SpotOptions } from '../engine/ai/spots';

/**
 * A ready-made, paused village for the title screen. It is built by the real engine (real placement, real
 * construction ticks) — not drawn — so the title hero is the same world the game plays in.
 */
export function createDemoCampaign(seed = 6001): Campaign {
  const c = createCampaign(seed);
  c.civ.res = { food: 600_000, timber: 600_000, stone: 400_000, knowledge: 0 };
  c.civ.pop = 11;
  dispatchAction(c, { type: 'beginEpoch' });
  const wants: [BuildingKind, SpotOptions][] = [
    ['cottage', { maxDist: 9 }],
    ['farm', { maxDist: 9 }],
    ['cottage', { maxDist: 9 }],
    ['lumber_camp', { maxDist: 20 }],
    ['farm', { maxDist: 9 }],
    ['archive', { maxDist: 11 }],
    ['cottage', { maxDist: 9 }],
    ['quarry', { maxDist: 24 }],
    ['seed_vault', { maxDist: 9 }],
    ['workshop', { maxDist: 10 }],
    ['cottage', { maxDist: 9 }],
  ];
  for (const [kind, opts] of wants) {
    const spot = findSpot(c, kind, opts);
    if (spot) dispatchAction(c, { type: 'build', kind, x: spot.x, y: spot.y, rot: spot.rot });
    for (let i = 0; i < 3; i++) advanceFixedTick(c);
  }
  for (let i = 0; i < 360; i++) advanceFixedTick(c);
  setPaused(c, true);
  return c;
}
