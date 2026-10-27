import { createCampaign } from '../src/engine';
import { bestExcavation, playCampaign, type Policy } from '../src/engine/ai/bots';

const seed = Number(process.argv[2] ?? 6001);
const policy: Policy = {
  name: 'builder',
  focus: () => 'balanced',
  wants: () => [
    { id: 'farm', kind: 'farm', count: 2, spot: { avoidHazard: true } },
    { id: 'lumber', kind: 'lumber_camp', count: 1 },
    { id: 'cottage', kind: 'cottage', count: 3, spot: { avoidHazard: true } },
    { id: 'quarry', kind: 'quarry', count: 1, from: 30 },
    { id: 'archive', kind: 'archive', count: 1, from: 80, spot: { avoidHazard: true, high: true } },
    { id: 'repair', repair: true },
  ],
  site: () => 2,
  tradition: () => 'open_hands',
  excavate: bestExcavation,
};
const c = createCampaign(seed);
const run = playCampaign(c, policy);
for (const e of run.epochs) console.log(e);
console.log('final phase', c.phase, c.report?.verdict);
for (const r of c.lineage.reports)
  console.log(
    r.epoch,
    r.hazard,
    'surv',
    r.survivors,
    'lost',
    r.structuresLost,
    'dmg',
    r.structuresDamaged,
    'retained',
    r.retainedTechs,
    r.causes.slice(0, 2),
  );
console.log('history', c.lineage.history.map((h) => `${h.epoch}:${h.title}`).join(' | '));
