import { BUILDINGS } from '../content/buildings';
import { getScenario, victoryFor } from '../content/scenario';
import { TECHS } from '../content/techs';
import { UNIT } from '../core/constants';
import { emit } from '../core/events';
import type {
  BuildingKind,
  Campaign,
  CollapseReport,
  HazardKind,
  HazardResult,
  ScoreBreakdown,
  Structure,
  StructureImpact,
  StructureStatus,
  TechId,
  Verdict,
} from '../core/types';
import { isStanding } from '../economy/modifiers';
import { resolveHazard, winterLarder } from '../world/hazards';
import { cellsOf, idx } from '../world/query';
import { featsOnCollapse } from './feats';

const SEVERITY: Record<StructureStatus, number> = {
  constructing: 0,
  active: 0,
  damaged: 1,
  rubble: 2,
  buried: 2,
};

/** Share of occupants lost when their home is destroyed / damaged. */
const DEATH_DESTROYED = 550;
const DEATH_DAMAGED = 120;
const DEATH_OUTDOORS: Record<HazardKind, number> = { fire: 400, flood: 400, quake: 250, ash: 150 };

/** How many technologies a society can carry out of a collapse, given each archive's post-hazard status. */
export function techRetentionCapacity(
  c: Campaign,
  carriers: { kind: Structure['kind']; status: StructureStatus }[],
): number {
  // Oral tradition: a surviving people always remember at least one thing.
  let cap = 1;
  const bonus = c.civ.techs.includes('writing') ? 2 : 0;
  for (const a of carriers) {
    const base = BUILDINGS[a.kind].retains + (a.kind === 'archive' ? bonus : 0);
    if (a.status === 'active') cap += base;
    else if (a.status === 'damaged') cap += Math.floor(base / 2);
  }
  return cap;
}

/** Order techs by value to the next society: costlier first, id as the stable tie-break. */
function byValue(ts: TechId[]): TechId[] {
  return [...ts].sort((a, b) => TECHS[b].cost - TECHS[a].cost || (a < b ? -1 : 1));
}

function nameOf(s: Structure): string {
  return `${BUILDINGS[s.kind].name} at (${s.x},${s.y})`;
}

export function computeDeaths(
  c: Campaign,
  impacts: StructureImpact[],
  kind: HazardKind,
): { deaths: number; lines: string[] } {
  const byId = new Map(impacts.map((i) => [i.id, i]));
  const housing = c.structures.filter((s) => BUILDINGS[s.kind].housing > 0 && isStanding(s));
  const capOf = (s: Structure) =>
    s.status === 'active' ? BUILDINGS[s.kind].housing : Math.floor(BUILDINGS[s.kind].housing / 2);
  const totalCap = housing.reduce((n, s) => n + capOf(s), 0);
  const pop = c.civ.pop;
  const housed = Math.min(pop, totalCap);
  const overflow = pop - housed;
  let deaths = 0;
  const lines: string[] = [];
  let left = housed;
  housing.forEach((s, k) => {
    const share = totalCap
      ? k === housing.length - 1
        ? left
        : Math.floor((housed * capOf(s)) / totalCap)
      : 0;
    left -= share;
    const imp = byId.get(s.id);
    if (!imp) return;
    const rate = imp.after === 'rubble' ? DEATH_DESTROYED : imp.after === 'damaged' ? DEATH_DAMAGED : 0;
    const dead = Math.min(share, Math.ceil((share * rate) / 1000));
    if (dead > 0) {
      deaths += dead;
      lines.push(
        `${dead} died when the ${BUILDINGS[s.kind].name} at (${s.x},${s.y}) ${imp.after === 'rubble' ? 'fell' : 'was damaged'}.`,
      );
    }
  });
  if (overflow > 0 && impacts.length > 0) {
    const dead = Math.ceil((overflow * DEATH_OUTDOORS[kind]) / 1000);
    deaths += dead;
    lines.push(
      `${dead} of ${overflow} people sleeping outdoors were caught in the open — there were not enough homes.`,
    );
  }
  if (kind === 'ash') {
    // No harvest comes: the village lives on what it has put by. Shortfall is paid in lives.
    const { need, have, perPerson } = winterLarder(c);
    if (have < need) {
      const starved = Math.min(pop, Math.ceil((need - have) / perPerson));
      deaths += starved;
      lines.push(
        `${starved} starved in the ash winter: ${have} food put by against ${need} needed for ${pop} people.`,
      );
    }
  }
  return { deaths: Math.min(deaths, pop), lines };
}

function applyWorldEffects(c: Campaign, result: HazardResult): void {
  const w = c.world;
  for (const cell of result.cells) {
    const i = idx(cell.x, cell.y, w.w);
    if (result.kind === 'fire') {
      w.forest[i] = Math.round(w.forest[i]! * 0.06);
      w.scar[i] = Math.max(w.scar[i]!, 600 + Math.min(400, cell.intensity / 2));
    } else if (result.kind === 'flood') {
      w.silt[i] = Math.min(1000, w.silt[i]! + Math.round(cell.intensity / 2));
      w.erosion[i] = Math.min(1000, w.erosion[i]! + 30);
    } else if (result.kind === 'ash') {
      // Ash poisons soil for generations: pollution lingers (it only halves per interregnum), fertility and trees suffer.
      w.pollution[i] = Math.min(1000, w.pollution[i]! + Math.round(cell.intensity / 3));
      w.fertility[i] = Math.max(60, w.fertility[i]! - Math.round(cell.intensity / 6));
      w.forest[i] = Math.round(w.forest[i]! * (1 - Math.min(0.6, cell.intensity / 1600)));
    } else {
      if (cell.intensity >= 400)
        w.erosion[i] = Math.min(1000, w.erosion[i]! + Math.round(cell.intensity / 5));
    }
  }
}

function salvageFor(s: Structure, kind: HazardKind): { timber: number; stone: number } {
  const d = BUILDINGS[s.kind];
  const t = (d.cost.timber ?? 0) * UNIT;
  const st = (d.cost.stone ?? 0) * UNIT;
  const woodKeep = kind === 'fire' ? 150 : 650;
  const stoneKeep = kind === 'quake' ? 700 : 900;
  return {
    timber: Math.round((t * d.salvage * woodKeep) / 1_000_000),
    stone: Math.round((st * d.salvage * stoneKeep) / 1_000_000),
  };
}

/** Landmarks standing that an age before `epoch` raised: the victory's landmark rule, and the legacy's. */
export function earlierLandmarks(c: Campaign, epoch: number): Structure[] {
  return c.structures.filter((s) => BUILDINGS[s.kind].heritage && isStanding(s) && s.originEpoch < epoch);
}

function heritageOf(c: Campaign): Structure[] {
  return c.structures.filter((s) => BUILDINGS[s.kind].heritage && isStanding(s));
}

function scoreOf(
  c: Campaign,
  survivors: number,
  retained: TechId[],
  heritage: number,
  standing: number,
): ScoreBreakdown {
  const w = c.world;
  let f = 0;
  let fe = 0;
  let n = 0;
  for (let i = 0; i < w.height.length; i++) {
    if (w.water[i]) continue;
    f += w.forest[i]!;
    fe += w.fertility[i]!;
    n++;
  }
  const s = c.civ.stats;
  const people = survivors * 100;
  const livelihood = Math.round(s.foodMade / UNIT) * 2 + standing * 10;
  const knowledge = retained.length * 120 + s.researched * 30;
  const ecology = Math.round((f + fe) / Math.max(1, n) / 10);
  const heritageScore = heritage * 150;
  return {
    people,
    livelihood,
    knowledge,
    ecology,
    heritage: heritageScore,
    total: people + livelihood + knowledge + ecology + heritageScore,
  };
}

export const LANDMARK_LABEL = 'Landmarks from an earlier age still standing';
/** What counts as a landmark, in words: every heritage building. */
export const LANDMARK_HINT = `Landmarks are ${(Object.keys(BUILDINGS) as BuildingKind[])
  .filter((k) => BUILDINGS[k].heritage && BUILDINGS[k].enabled)
  .map((k) => (k === 'hearth' ? 'a Hearth the later societies kept' : `a ${BUILDINGS[k].name}`))
  .join(', ')
  .replace(/, ([^,]*)$/, ' or $1')}; an Archive carries knowledge, not a landmark.`;

export function evaluateVerdict(c: Campaign, survivors: number, retained: TechId[]): Verdict | null {
  const scenario = getScenario(c.scenario);
  const final = c.epoch >= scenario.epochs.length - 1;
  if (survivors < 3) {
    return {
      outcome: 'defeat',
      title: 'No one is left to remember',
      conditions: [{ label: 'Survivors to found a new society', have: survivors, need: 3, met: false }],
      reason: `Only ${survivors} survived. A society needs at least 3 founders to begin again.`,
    };
  }
  if (!final) return null;
  const v = victoryFor(scenario, c.difficulty);
  const crossEra = earlierLandmarks(c, c.epoch).length;
  const conditions = [
    { label: 'Surviving people', have: survivors, need: v.minSurvivors, met: survivors >= v.minSurvivors },
    {
      label: LANDMARK_LABEL,
      have: crossEra,
      need: v.minHeritage,
      met: crossEra >= v.minHeritage,
    },
    {
      label: 'Technologies carried through the collapse',
      have: retained.length,
      need: v.minRetainedTechs,
      met: retained.length >= v.minRetainedTechs,
    },
  ];
  const ok = conditions.every((x) => x.met);
  const missed = conditions.filter((x) => !x.met).map((x) => x.label.toLowerCase());
  return {
    outcome: ok ? 'victory' : 'defeat',
    title: ok ? 'The cycle is broken' : 'The valley is silent',
    conditions,
    reason: ok
      ? 'Your people, your landmarks and your knowledge outlasted three collapses.'
      : `Not enough of: ${missed.join('; ')}.${conditions[1]!.met ? '' : ` ${LANDMARK_HINT}`}`,
  };
}

/**
 * Resolve the epoch's cataclysm exactly once from the authoritative state, then freeze the result in a
 * CollapseReport. The presentation is read-only: skipping or replaying it can never change the outcome.
 */
export function collapseEpoch(c: Campaign): CollapseReport | null {
  if (c.collapseResolved) return c.report;
  if (c.phase !== 'ACTIVE') return null;
  c.phase = 'COLLAPSE_PENDING';
  const spec = getScenario(c.scenario).epochs[c.epoch]!;
  const kind = spec.hazard.kind;
  const result = resolveHazard(c, kind);
  // The same flood with no levee or dam standing: what the defences kept the water from (a pure projection).
  const undefended =
    kind === 'flood'
      ? resolveHazard(
          { ...c, structures: c.structures.filter((s) => s.kind !== 'levee' && s.kind !== 'dam') },
          kind,
        )
      : null;
  const survivorsBefore = c.civ.pop;
  // The works standing when the minute ends: the village's livelihood, which clearing and rebuilding cannot inflate.
  const standingBefore = c.structures.filter(isStanding).length;
  const { deaths, lines } = computeDeaths(c, result.impacts, kind);
  // The larder as it stood before the winter: the report must explain the deaths, not the empty village after them.
  const larder = kind === 'ash' ? winterLarder(c) : null;

  // Which technologies are written where, before anything falls.
  const archives = c.structures.filter((s) => BUILDINGS[s.kind].retains > 0 && s.status !== 'constructing');
  const bonus = c.civ.techs.includes('writing') ? 2 : 0;
  const unassigned = byValue(c.civ.techs);
  for (const a of archives) {
    if (a.status === 'rubble' || a.status === 'buried') continue;
    const cap = BUILDINGS[a.kind].retains + (a.kind === 'archive' ? bonus : 0);
    a.storedTechs = unassigned.splice(0, cap);
  }
  // (Archives that fall below keep whatever they had stored: it stays recoverable in the ruin.)
  const retainedCap = techRetentionCapacity(
    c,
    archives.map((a) => ({
      kind: a.kind,
      status: result.impacts.find((i) => i.id === a.id)?.after ?? a.status,
    })),
  );
  const retained = byValue(c.civ.techs).slice(0, retainedCap);
  const lost = c.civ.techs.filter((t) => !retained.includes(t));

  // Apply structure outcomes. Statuses only ever get worse.
  let lostN = 0;
  let damagedN = 0;
  const impactById = new Map(result.impacts.map((i) => [i.id, i]));
  for (const s of c.structures) {
    const imp = impactById.get(s.id);
    if (!imp) {
      if (isStanding(s) || s.status === 'constructing') {
        s.provenance.push(`Untouched by ${spec.hazard.headline}.`);
      }
      continue;
    }
    let after = imp.after;
    if (s.status === 'constructing' && after === 'active') after = 'constructing';
    if (s.status === 'constructing' && after === 'damaged') after = 'rubble';
    // A building already in disrepair that this hazard barely touched is no worse for it: not "damaged by" it.
    const noWorse = s.status === 'damaged' && imp.after === 'active';
    if (SEVERITY[after] < SEVERITY[s.status] || (after === 'active' && s.status === 'damaged'))
      after = s.status;
    const wasStanding = isStanding(s) || s.status === 'constructing';
    s.status = after;
    // Integrity, like status, only gets worse: a light blow never mends an older wound.
    s.integrity = Math.min(s.integrity, Math.max(0, 1000 - imp.damage));
    if (after === 'rubble') {
      s.cause = kind;
      s.salvage = salvageFor(s, kind);
      s.burial = 0;
      if (wasStanding) lostN++;
      s.provenance.push(
        `${nameOf(s)} was destroyed by ${spec.hazard.headline}. ${BUILDINGS[s.kind].material === 'stone' ? 'Its stone footings remain.' : 'Little but charred footings remain.'}`,
      );
      emit(c, {
        code: 'struct.destroyed',
        msg: `${BUILDINGS[s.kind].name} destroyed`,
        id: s.id,
        x: s.x,
        y: s.y,
        important: true,
      });
    } else if (noWorse) {
      s.provenance.push(`${nameOf(s)} came through ${spec.hazard.headline}, still in disrepair.`);
    } else if (after === 'damaged') {
      s.cause = kind;
      damagedN++;
      s.provenance.push(`${nameOf(s)} was damaged by ${spec.hazard.headline} but stands.`);
    } else {
      s.provenance.push(`${nameOf(s)} survived ${spec.hazard.headline}.`);
    }
  }
  // Snapshot affected cells before the world is scarred, so the presentation can replay the transition.
  const before = {
    cells: [] as number[],
    forest: [] as number[],
    scar: [] as number[],
    silt: [] as number[],
    pollution: [] as number[],
  };
  for (const cell of result.cells) {
    const i = idx(cell.x, cell.y, c.world.w);
    before.cells.push(i);
    before.forest.push(c.world.forest[i]!);
    before.scar.push(c.world.scar[i]!);
    before.silt.push(c.world.silt[i]!);
    before.pollution.push(c.world.pollution[i]!);
  }
  applyWorldEffects(c, result);
  c.civ.pop = Math.max(0, c.civ.pop - deaths);
  const survivors = c.civ.pop;

  lost.forEach((t) => {
    if (!c.lineage.lostTechs.includes(t)) c.lineage.lostTechs.push(t);
  });

  const heritage = heritageOf(c);
  const score = scoreOf(c, survivors, retained, heritage.length, standingBefore);
  const intact = c.structures.filter(
    (s) => s.status === 'active' && (s.provenance.at(-1) ?? '').includes('survived'),
  ).length;

  // Causal lines, most decisive first.
  const causes: string[] = [];
  const houses = result.impacts.filter((i) => BUILDINGS[i.kind].housing > 0);
  const lostHouses = houses.filter((i) => i.after === 'rubble');
  if (lostHouses.length) {
    const sample = lostHouses[0]!;
    causes.push(`${lostHouses.length} home${lostHouses.length > 1 ? 's' : ''} fell. ${sample.reason}`);
  }
  for (const l of lines.slice(0, 2)) causes.push(l);
  const keep = heritage.filter((h) => h.originEpoch === c.epoch);
  if (keep.length) causes.push(`${keep.map(nameOf).join(', ')} survived — built to last.`);
  const hasFirebreak = c.structures.some((s) => s.kind === 'firebreak' && isStanding(s));
  if (kind === 'fire' && !hasFirebreak && result.area > 20)
    causes.push('No firebreak stood between the burning forest and the village.');
  if (kind === 'flood' && result.impacts.length)
    causes.push(
      'The river rose over low ground. A levee, a dam, or building higher up would have kept your people dry.',
    );
  if (kind === 'quake' && result.impacts.some((i) => i.after !== 'active'))
    causes.push('Braced frames, stone footings and retaining walls decide who stands after a quake.');
  if (larder) {
    const l = larder;
    causes.push(
      l.have >= l.need
        ? `The larders held: ${l.have} food put by for the ${l.need} the winter needed.`
        : `The winter needed ${l.need} food and only ${l.have} was put by. A sealed Granary, food saved before the ash, and a Seed Vault decide who eats.`,
    );
    if (result.impacts.some((i) => i.after !== 'active'))
      causes.push('Wet ash is heavy. Thatch bowed and fell; steep stone and slate roofs shed it.');
  }
  const near = result.impacts.filter(
    (i) => (i.damage >= 520 && i.damage < 600) || (i.damage >= 200 && i.damage < 250),
  );
  if (near.length) {
    const n = near[0]!;
    causes.push(
      `The ${BUILDINGS[n.kind].name} at (${n.x},${n.y}) came within ${n.damage >= 520 ? 600 - n.damage : 250 - n.damage} points of ${n.damage >= 520 ? 'collapse' : 'damage'}: a little more reinforcement would have changed its fate.`,
    );
  }
  if (lost.length)
    causes.push(
      `${lost.map((t) => TECHS[t].name).join(', ')} ${lost.length > 1 ? 'were' : 'was'} forgotten — nothing durable carried ${lost.length > 1 ? 'them' : 'it'}.`,
    );
  if (!causes.length) causes.push('Your preparations held. The valley lived through it.');

  const verdict = evaluateVerdict(c, survivors, retained);
  const headline = `${spec.hazard.headline} took ${deaths} ${deaths === 1 ? 'life' : 'lives'} and ${lostN} ${lostN === 1 ? 'building' : 'buildings'}.`;

  const report: CollapseReport = {
    epoch: c.epoch,
    before,
    hazard: kind,
    hazardName: spec.hazard.headline,
    headline,
    survivorsBefore,
    deaths,
    survivors,
    structuresLost: lostN,
    structuresDamaged: damagedN,
    structuresIntact: intact,
    retainedTechs: retained,
    lostTechs: lost,
    result,
    causes: causes.slice(0, 5),
    score,
    heritage: heritage.map((h) => h.id),
    verdict,
  };
  c.report = report;
  c.lineage.reports.push(report);
  c.lineage.score += score.total;
  c.lineage.history.push({ epoch: c.epoch, title: spec.hazard.headline, text: headline });
  featsOnCollapse(c, report, larder, undefended);
  c.collapseResolved = true;
  c.phase = 'COLLAPSING';
  emit(c, { code: 'collapse', msg: headline, important: true });
  return report;
}

export { cellsOf };
