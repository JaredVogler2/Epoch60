import { createCampaign, dispatchAction, runTicks, getForecast } from '../src/engine';
import { findSpot, sumField } from '../src/engine/ai/spots';
import type { BuildingKind, Campaign } from '../src/engine';
import type { SpotOptions } from '../src/engine/ai/spots';

const U = 1000;
const seed = Number(process.argv[2] ?? 6001);
const c: Campaign = createCampaign(seed);

function show(label: string) {
  const r = c.civ.res;
  console.log(
    `[${label}] t=${(c.tick / 10).toFixed(1)}s pop=${c.civ.pop} F=${(r.food / U).toFixed(1)} T=${(r.timber / U).toFixed(1)} S=${(r.stone / U).toFixed(1)} K=${(r.knowledge / U).toFixed(1)} labor=${JSON.stringify(c.civ.labor)}`,
  );
}
function build(kind: BuildingKind, opts: SpotOptions = {}) {
  const spot = findSpot(c, kind, opts);
  if (!spot) return console.log('  no spot for', kind);
  const r = dispatchAction(c, { type: 'build', kind, x: spot.x, y: spot.y, rot: spot.rot });
  console.log('  build', kind, spot, r.ok ? 'ok' : r);
}
const soil = (x: number, y: number, w: number, h: number) =>
  sumField(c, c.world.fertility, x, y, w, h) / (w * h) / 5;
const rock = (x: number, y: number, w: number, h: number) =>
  sumField(c, c.world.rock, x - 1, y - 1, w + 2, h + 2) * 2;
const trees = (x: number, y: number, w: number, h: number) =>
  sumField(c, c.world.forest, x - 3, y - 3, w + 6, h + 6) / 60;

show('start');
console.log('forecast', getForecast(c).atRisk, getForecast(c).predictedDeaths, getForecast(c).predicted.area);
build('farm', { bonus: soil });
build('cottage');
dispatchAction(c, { type: 'beginEpoch' });
build('lumber_camp', { bonus: trees, maxDist: 16 });
runTicks(c, 100);
show('10s');
build('cottage');
build('farm', { bonus: soil });
runTicks(c, 150);
show('25s');
build('quarry', { bonus: rock, maxDist: 20 });
build('archive', { avoidHazard: true, high: true });
runTicks(c, 150);
show('40s');
const f = getForecast(c);
console.log('forecast', f.atRisk, f.predictedDeaths, f.predicted.area);
runTicks(c, 400);
show('end');
console.log(
  c.phase,
  c.report?.headline,
  c.report?.causes,
  'survivors',
  c.report?.survivors,
  'retained',
  c.report?.retainedTechs,
  c.report?.score,
);
for (const s of c.structures) console.log(' ', s.kind, s.x, s.y, s.status, s.progress / 1000);
