/**
 * Proves every feat is attainable: plays a small set of scripted lineages (variants of the route policies) that earn
 * the feats the route fixtures do not, records their replayable transcripts in fixtures/feats/, and writes
 * fixtures/feats.md — which recorded run earns which feat, in which age. Run after any rules, content or feat change:
 *   npx vite-node scripts/record-feats.ts
 * `tests/engine/feats.test.ts` replays every transcript and fails if a feat stops being earned.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import {
  FEATS,
  FEAT_GROUPS,
  FEAT_IDS,
  computeHash,
  createCampaign,
  replayCampaign,
  resolveHazard,
  transcriptOf,
} from '../src/engine';
import type { Campaign, Difficulty, FeatId, Transcript } from '../src/engine';
import { playCampaign, type Policy, type Want } from '../src/engine/ai/bots';
import { sumField } from '../src/engine/ai/spots';
import { archivists, minimalRecipe } from '../src/engine/ai/routes';

const SEED = 6001;
const has = (t: string) => (c: Campaign) => c.civ.techs.includes(t as never);

/** Prefer the coming hazard's path, weighted by its intensity (to put something where it will be tested). */
function inPath(c: Campaign) {
  const cells = new Map<number, number>();
  for (const h of resolveHazard(c).cells) cells.set(h.y * c.world.w + h.x, h.intensity);
  return (x: number, y: number, w: number, h: number) => {
    let s = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) s += cells.get((y + j) * c.world.w + x + i) ?? 0;
    return s / 20;
  };
}
/** Prefer ground the fire burned. */
const burnt = (c: Campaign) => (x: number, y: number, w: number, h: number) =>
  sumField(c, c.world.scar, x, y, w, h) / 10;

/** The Archivists, with river works in the Age of Bronze: levees or a Dam, reinforcement, more homes. */
function riverAge(name: string, opts: { grove: boolean; levees: boolean; dam: boolean }): Policy {
  return {
    ...archivists,
    name,
    wants: (c) => {
      const ws = archivists
        .wants(c)
        .map((w): Want =>
          opts.grove && c.epoch === 0 && w.id === 'r-masonry'
            ? { id: 'r-forestry', research: 'forestry' }
            : w,
        );
      if (c.epoch !== 1) return ws;
      return [
        ws[0]!,
        ...(opts.grove
          ? [
              {
                id: 'grove',
                kind: 'grove' as const,
                count: 1,
                when: has('forestry'),
                spot: { maxDist: 20, bonus: burnt(c) },
              },
            ]
          : []),
        { id: 'repair', repair: true },
        { id: 'lumber-x', kind: 'lumber_camp', count: 1 },
        { id: 'farm-x', kind: 'farm', count: 1, spot: { avoidHazard: true } },
        { id: 'reinforce', reinforce: ['lumber_camp', 'farm', 'cottage'] },
        ...(opts.dam
          ? [
              { id: 'quarry', kind: 'quarry' as const, count: 1 },
              {
                id: 'dam',
                kind: 'dam' as const,
                count: 1,
                save: true,
                when: has('hydrology'),
                rot: [0, 1] as (0 | 1)[],
                spot: { maxDist: 30 },
              },
            ]
          : []),
        ...(opts.levees
          ? [
              {
                id: 'levee',
                kind: 'levee' as const,
                count: 2,
                when: has('hydrology'),
                mitigate: { stride: 2, maxDist: 24 },
              },
            ]
          : []),
        { id: 'cottage-x', kind: 'cottage', count: 4, spot: { avoidHazard: true } },
        ...ws.slice(1),
      ];
    },
  };
}

interface FeatRun {
  policy: Policy;
  scenario: string;
  difficulty: Difficulty;
  /** The feats this run exists to prove (it may earn others too). */
  proves: FeatId[];
}

const RUNS: FeatRun[] = [
  {
    policy: { ...minimalRecipe('vault'), name: 'recipe-vault' },
    scenario: 'greenvale',
    difficulty: 'normal',
    proves: ['three_branches', 'light_footprint'],
  },
  {
    policy: { ...archivists, name: 'archivists-hard' },
    scenario: 'greenvale',
    difficulty: 'hard',
    proves: ['hard_won'],
  },
  {
    // The first Archive is raised in the fire's path; it outlives the fire but the flood breaks it and the centuries
    // bring it down, and the third age digs up its tablets.
    policy: {
      ...archivists,
      name: 'fallen-archive',
      wants: (c) =>
        archivists
          .wants(c)
          .map((w): Want =>
            c.epoch === 0 && w.id === 'archive' ? { ...w, spot: { maxDist: 18, bonus: inPath(c) } } : w,
          ),
    },
    scenario: 'greenvale',
    difficulty: 'normal',
    proves: ['grandparents_library'],
  },
  {
    policy: riverAge('levees-and-grove', { grove: true, levees: true, dam: false }),
    scenario: 'greenvale',
    difficulty: 'normal',
    proves: ['flood_held', 'forest_returns', 'reinforced_stood'],
  },
  {
    policy: riverAge('dam', { grove: false, levees: true, dam: true }),
    scenario: 'greenvale',
    difficulty: 'normal',
    proves: ['river_works'],
  },
];
mkdirSync('fixtures/feats', { recursive: true });
const earned = new Map<string, { phase: string; feats: { id: FeatId; epoch: number }[] }>();

// The route fixtures first (recorded by scripts/record-traces.ts), then the feat runs.
for (const dir of ['greenvale', 'ashen']) {
  for (const f of readdirSync(`fixtures/${dir}`).sort()) {
    const t = JSON.parse(readFileSync(`fixtures/${dir}/${f}`, 'utf8')) as Transcript;
    const c = replayCampaign(t);
    earned.set(`${dir}/${f.replace('.json', '')}`, { phase: c.phase, feats: c.lineage.feats });
  }
}
for (const r of RUNS) {
  const c = createCampaign(SEED, 'standard', r.scenario, r.difficulty);
  playCampaign(c, r.policy);
  const t = transcriptOf(c);
  if (computeHash(replayCampaign(t)) !== t.finalHash)
    throw new Error(`${r.policy.name}: replay diverged from the live run`);
  const ids = c.lineage.feats.map((f) => f.id);
  const missing = r.proves.filter((id) => !ids.includes(id));
  if (missing.length)
    throw new Error(`${r.policy.name} no longer earns ${missing.join(', ')} — adjust the policy`);
  writeFileSync(`fixtures/feats/${r.policy.name}.json`, JSON.stringify(t) + '\n');
  earned.set(`feats/${r.policy.name}`, { phase: c.phase, feats: c.lineage.feats });
}

const unproven = FEAT_IDS.filter((id) => ![...earned.values()].some((e) => e.feats.some((f) => f.id === id)));
if (unproven.length) throw new Error(`No recorded run earns: ${unproven.join(', ')}`);

const AGE = ['I', 'II', 'III'];
const rows = FEAT_IDS.map((id) => {
  const by = [...earned.entries()]
    .flatMap(([name, e]) => {
      const f = e.feats.find((x) => x.id === id);
      return f ? [`${name} (age ${AGE[f.epoch] ?? f.epoch + 1})`] : [];
    })
    .join(', ');
  const d = FEATS[id];
  return `| ${FEAT_GROUPS[d.group]} | **${d.name}** | ${d.how} | ${by} |`;
});
const runRows = [...earned.entries()].map(
  ([name, e]) =>
    `| ${name} | ${e.phase} | ${e.feats.length} | ${e.feats.map((f) => FEATS[f.id].name).join(', ') || '—'} |`,
);
const md = `# Feats — EXECUTED

Generated by \`npx vite-node scripts/record-feats.ts\` (seed ${SEED}, rules/content ${createCampaign(SEED).rules}/${createCampaign(SEED).content}).
Every feat is awarded by the engine at the moment it happens (\`src/engine/legacy/feats.ts\`) and kept in the lineage, so
each recorded run below replays to exactly these feats; \`tests/engine/feats.test.ts\` checks that, and that every feat
is earned by at least one recorded run. The route fixtures are recorded by \`scripts/record-traces.ts\`; the runs in
\`fixtures/feats/\` are variants of the route policies written to reach the feats the routes do not.

## Which recorded run earns each feat

| Group | Feat | Rule | Earned by (age) |
| --- | --- | --- | --- |
${rows.join('\n')}

## What each recorded run earns

| Run | Result | Feats | Which |
| --- | --- | --- | --- |
${runRows.join('\n')}
`;
writeFileSync('fixtures/feats.md', md);
console.log(rows.join('\n'));
