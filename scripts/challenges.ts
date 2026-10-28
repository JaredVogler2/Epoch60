/**
 * What does each challenge do to a lineage? Plays the route policies (and the steward) on many seeds of both scenarios,
 * once in the standard valley and once with each challenge alone, and counts wins, survivors, deaths per catastrophe
 * and the cells each catastrophe reached. Writes a markdown table (stdout, or --out).
 *   npx vite-node scripts/challenges.ts [--seeds 40] [--from 1] [--out docs/balance/challenges.md]
 */
import { writeFileSync } from 'node:fs';
import { MODIFIERS, checkModifiers, createCampaign } from '../src/engine';
import type { ModifierId } from '../src/engine';
import { playCampaign } from '../src/engine/ai/bots';
import { ROUTES } from '../src/engine/ai/routes';

const arg = (name: string, d: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? d) : d;
};
const N = Number(arg('seeds', '40'));
const FROM = Number(arg('from', '1'));
const out = arg('out', '');
const POLICIES = ['engineers', 'archivists', 'steward'];

interface Tally {
  wins: number;
  survivors: number;
  deaths: number[];
  reach: number[];
  dug: number;
}
const blank = (): Tally => ({ wins: 0, survivors: 0, deaths: [0, 0, 0], reach: [0, 0, 0], dug: 0 });

const lines: string[] = [
  `# Challenges, measured (generated)`,
  '',
  `\`npx vite-node scripts/challenges.ts --seeds ${N} --from ${FROM}\`: seeds ${FROM}–${FROM + N - 1}, Normal. Each cell is`,
  `wins out of ${N}, then the mean survivors at the end, the mean deaths in each age's catastrophe and the mean cells it`,
  `reached. Bots, not people: the route policies were tuned on the standard valley and do not adapt to a challenge, so`,
  `these numbers measure what a challenge does to a fixed plan, not how hard it is for a player who reads it.`,
  '',
];
for (const scenario of ['greenvale', 'ashen']) {
  lines.push(`## ${scenario === 'greenvale' ? 'Greenvale' : 'The Ashen Winter'}`, '');
  lines.push('| Challenge | Policy | Wins | Survivors | Deaths I · II · III | Cells reached I · II · III |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  const sets: ModifierId[][] = [
    [],
    ...(Object.keys(MODIFIERS) as ModifierId[])
      .filter((m) => checkModifiers([m], scenario).ok)
      .map((m) => [m]),
  ];
  for (const mods of sets) {
    for (const name of POLICIES) {
      const t = blank();
      for (let seed = FROM; seed < FROM + N; seed++) {
        const c = createCampaign(seed, 'standard', scenario, 'normal', mods);
        playCampaign(c, ROUTES[name]!);
        if (c.phase === 'VICTORY') t.wins++;
        t.survivors += c.lineage.reports.at(-1)?.survivors ?? 0;
        c.lineage.reports.forEach((r, i) => {
          t.deaths[i]! += r.deaths;
          t.reach[i]! += r.result.cells.length;
        });
        if (c.structures.some((s) => s.originEpoch < 0 && s.excavated)) t.dug++;
      }
      const mean = (v: number) => (v / N).toFixed(1);
      const label = mods.length ? MODIFIERS[mods[0]!].name : 'standard';
      lines.push(
        `| ${label} | ${name} | ${t.wins}/${N}${mods.includes('buried_library') ? ` (dug ${t.dug})` : ''} | ${mean(t.survivors)} | ${t.deaths.map(mean).join(' · ')} | ${t.reach.map((r) => Math.round(r / N)).join(' · ')} |`,
      );
      console.error(`${scenario} ${label} ${name}: ${t.wins}/${N}`);
    }
  }
  lines.push('');
}
const md = lines.join('\n');
if (out) writeFileSync(out, md + '\n');
else console.log(md);
