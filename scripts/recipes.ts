/**
 * How much does Normal demand? Plays the minimal recipes of `minimalRecipe` (one Archive, optionally one landmark)
 * on many seeds and counts victories — the K-003 yardstick.
 *   npx vite-node scripts/recipes.ts [--seeds 40] [--from 1] [--difficulty normal]
 */
import { createCampaign, type Difficulty } from '../src/engine';
import { playCampaign } from '../src/engine/ai/bots';
import { minimalRecipe } from '../src/engine/ai/routes';

const arg = (name: string, d: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? d) : d;
};
const N = Number(arg('seeds', '40'));
const FROM = Number(arg('from', '1'));
const difficulty = arg('difficulty', 'normal') as Difficulty;

console.log(`Minimal recipes, seeds ${FROM}–${FROM + N - 1}, ${difficulty}`);
for (const scenario of ['greenvale', 'ashen']) {
  for (const landmark of ['none', 'vault', 'hold'] as const) {
    let wins = 0;
    const missed: Record<string, number> = {};
    for (let seed = FROM; seed < FROM + N; seed++) {
      const c = createCampaign(seed, 'standard', scenario, difficulty);
      playCampaign(c, minimalRecipe(landmark));
      if (c.phase === 'VICTORY') wins++;
      for (const x of c.report?.verdict?.conditions ?? [])
        if (!x.met) missed[x.label] = (missed[x.label] ?? 0) + 1;
    }
    console.log(
      `${scenario.padEnd(9)} ${`recipe-${landmark}`.padEnd(13)} ${wins}/${N}  missed: ${JSON.stringify(missed)}`,
    );
  }
}
