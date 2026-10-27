import { createCampaign, type Difficulty } from '../src/engine';
import { playCampaign, type Policy } from '../src/engine/ai/bots';
import { ROUTES } from '../src/engine/ai/routes';

const policies: Record<string, Policy> = ROUTES;
const name = process.argv[2] ?? 'engineers';
const seedArg = process.argv[3];
const seed = seedArg && /^\d+$/.test(seedArg) ? Number(seedArg) : 6001;
const policy = policies[name];
if (!policy) throw new Error(`unknown policy ${name}`);
const scenarioArg = process.argv.find((a) => a.startsWith('--scenario='))?.slice(11) ?? 'greenvale';
const difficultyArg = (process.argv.find((a) => a.startsWith('--difficulty='))?.slice(13) ??
  'normal') as Difficulty;
const c = createCampaign(seed, 'standard', scenarioArg, difficultyArg);
const trace = process.argv.includes('--trace');
const onlyEpoch = process.argv.find((a) => a.startsWith('--epoch='))?.slice(8);
const run = playCampaign(c, policy, {
  onTick: trace
    ? (cc) => {
        if (onlyEpoch !== undefined && cc.epoch !== Number(onlyEpoch)) return;
        if (cc.tick % 50 !== 0) return;
        const st: Record<string, string> = {};
        for (const s of cc.structures) {
          if (s.status === 'rubble' || s.status === 'buried') continue;
          const k = `${s.kind}${s.status === 'constructing' ? '*' : ''}`;
          st[k] = String(Number(st[k] ?? 0) + 1);
        }
        const r = cc.civ.res;
        console.log(
          `e${cc.epoch} t${String(cc.tick).padStart(3)} pop ${cc.civ.pop} f${Math.round(r.food / 1000)} t${Math.round(r.timber / 1000)} s${Math.round(r.stone / 1000)} k${(r.knowledge / 1000).toFixed(1)} res=${cc.civ.research?.tech ?? '-'} ${JSON.stringify(st)}`,
        );
      }
    : undefined,
});
for (const r of c.lineage.reports) {
  console.log(
    `E${r.epoch} ${r.hazard.padEnd(5)} survivors ${String(r.survivors).padStart(2)} deaths ${String(r.deaths).padStart(2)} lost ${String(r.structuresLost).padStart(2)} dmg ${String(r.structuresDamaged).padStart(2)} retained [${r.retainedTechs.join(',')}] lost-techs [${r.lostTechs?.join(',') ?? ''}]`,
  );
}
for (const e of run.epochs) console.log(`E${e.epoch} stories [${e.stories.join(', ')}]`);
for (const e of run.epochs)
  console.log(
    `E${e.epoch} civ techs [${e.techs.join(',')}] res ${JSON.stringify(e.resources)} standing-after ${JSON.stringify(e.built)}`,
  );
console.log(
  'ended',
  c.phase,
  c.report?.verdict?.outcome,
  c.report?.verdict?.conditions.map((x) => `${x.label}: ${x.have}/${x.need}`).join(' | '),
);
console.log('epochs', run.epochs.length);
if (process.argv.includes('--structures')) {
  for (const s of c.structures)
    console.log(
      `#${s.id} ${s.kind} (${s.x},${s.y}) e${s.originEpoch} ${s.status} int=${s.integrity} cause=${s.cause} stored=[${s.storedTechs}] bonus=${JSON.stringify(s.bonus)}\n    ${s.provenance.slice(-3).join(' / ')}`,
    );
}
