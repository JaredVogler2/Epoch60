/**
 * How long does a won lineage last in the long chronicle? Plays the two winning route policies on many seeds of both
 * scenarios, carries every victory on to the twelfth age (`playCampaign` with `ages: 12`: never rested early) and
 * counts how many ages each lasted, how it ended, and the survivors and deaths of each later age. Writes a markdown
 * table (stdout, or --out).
 *   npx vite-node scripts/chronicle.ts [--seeds 20] [--from 1] [--out docs/balance/chronicle.md]
 */
import { writeFileSync } from 'node:fs';
import { MAX_AGES, chronicleEnding, createCampaign, epochSpec } from '../src/engine';
import { playCampaign } from '../src/engine/ai/bots';
import { ROUTES } from '../src/engine/ai/routes';

const arg = (name: string, d: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? d) : d;
};
const N = Number(arg('seeds', '20'));
const FROM = Number(arg('from', '1'));
const out = arg('out', '');
const POLICIES = ['engineers', 'archivists'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const lines: string[] = [
  `# The long chronicle, measured (generated)`,
  '',
  `\`npx vite-node scripts/chronicle.ts --seeds ${N} --from ${FROM}\`: seeds ${FROM}–${FROM + N - 1}, Normal. Every`,
  `victory is carried on toward the ${MAX_AGES}th age and never rested early. "Lasted" counts the ages each lineage lived,`,
  `the age that ended it included. Bots, not people: the route policies meet each returning catastrophe with the plan`,
  `they made for its first coming (\`planAge\`), so these numbers show how the rising catastrophes wear down a fixed`,
  `plan, not how long a player who adapts can last.`,
  '',
];
for (const scenario of ['greenvale', 'ashen']) {
  lines.push(`## ${scenario === 'greenvale' ? 'Greenvale' : 'The Ashen Winter'}`, '');
  const later = Array.from({ length: MAX_AGES - 3 }, (_, k) => k + 3);
  lines.push(
    `Later ages: ${later.map((e) => `${ROMAN[e]} ${epochSpec({ scenario, endless: { rested: false } }, e).hazard.headline} (strength ${epochSpec({ scenario, endless: { rested: false } }, e).hazard.strength})`).join(' · ')}.`,
    '',
  );
  lines.push(
    '| Policy | Won | Lasted (ages: lineages) | Complete | Mean survivors per later age (IV → XII) |',
  );
  lines.push('| --- | --- | --- | --- | --- |');
  for (const name of POLICIES) {
    let won = 0;
    let complete = 0;
    const lasted = new Map<number, number>();
    const survivors = later.map(() => ({ sum: 0, n: 0 }));
    for (let seed = FROM; seed < FROM + N; seed++) {
      const c = createCampaign(seed, 'standard', scenario, 'normal');
      playCampaign(c, ROUTES[name]!, { ages: MAX_AGES });
      if (!c.endless) continue;
      won++;
      const end = chronicleEnding(c);
      if (end?.how === 'complete') complete++;
      lasted.set(c.epoch + 1, (lasted.get(c.epoch + 1) ?? 0) + 1);
      for (const r of c.lineage.reports) {
        if (r.epoch < 3) continue;
        survivors[r.epoch - 3]!.sum += r.survivors;
        survivors[r.epoch - 3]!.n++;
      }
      console.error(`${scenario} ${name} seed ${seed}: ${end?.how ?? '?'} after ${c.epoch + 1} ages`);
    }
    const dist = [...lasted.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ages, n]) => `${ages}: ${n}`)
      .join(', ');
    const means = survivors.map((s) => (s.n ? (s.sum / s.n).toFixed(1) : '–')).join(' · ');
    lines.push(`| ${name} | ${won}/${N} | ${dist || '–'} | ${complete}/${won} | ${means} |`);
  }
  lines.push('');
}
const md = lines.join('\n');
if (out) writeFileSync(out, md + '\n');
else console.log(md);
