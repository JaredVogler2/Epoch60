import { BUILDINGS } from '../content/buildings';
import { getScenario, scaledStrength } from '../content/scenario';
import { TECHS } from '../content/techs';
import { TRADITIONS, sumModifiers } from '../content/traditions';
import { UNIT } from '../core/constants';
import { emit } from '../core/events';
import type {
  ActionResult,
  Campaign,
  Civ,
  CollapseReport,
  FoundingSite,
  HazardKind,
  Interregnum,
  Resources,
  Structure,
  TechId,
  TraditionId,
  TraditionOption,
} from '../core/types';
import { bridgeCells } from '../economy/placement';
import { isStanding } from '../economy/modifiers';
import { createStructure, levelPad, removeStructure } from '../economy/structures';
import { quakeIntensityAt, resolveHazard } from '../world/hazards';
import { cellsOf, clamp, footprintCells, idx, inBounds, reachableSet, slopeSpread } from '../world/query';
import { featsOnExcavated, featsOnFounded } from './feats';

export const SURVEYS_PER_INTERREGNUM = 2;
export const EXCAVATIONS_PER_INTERREGNUM = 1;

function blankResources(): Resources {
  return { food: 0, timber: 0, stone: 0, knowledge: 0 };
}

/* ------------------------------------------------------------------ */
/* Time-skip: centuries pass over the persistent world                  */
/* ------------------------------------------------------------------ */

function centuriesOf(years: number): number {
  return years / 100;
}

/**
 * Share of rubble salvage that survives `years`, in 1/100000, by integer arithmetic only (no Math.pow: its result
 * may differ in the last bit between browsers, and salvage is part of the hashed state). Timber halves and stone loses
 * a tenth every century, linearly within a century, until the table runs out.
 */
const TIMBER_KEEP = [100000, 50000, 25000, 12500];
const STONE_KEEP = [100000, 90000, 81000, 72900, 65610, 59049];
function keepShare(table: number[], years: number): number {
  const y = Math.min((table.length - 1) * 100, Math.max(0, Math.round(years)));
  const n = Math.floor(y / 100);
  const r = y - n * 100;
  if (r === 0) return table[n]!;
  return Math.round((table[n]! * (100 - r) + table[n + 1]! * r) / 100);
}

function silted(c: Campaign, s: Structure): boolean {
  return cellsOf(s).some(([x, y]) => c.world.silt[idx(x, y, c.world.w)]! > 200);
}

function decayStructures(c: Campaign, centuries: number, log: string[]): void {
  let fell = 0;
  let buried = 0;
  for (const s of c.structures) {
    const def = BUILDINGS[s.kind];
    if (s.status === 'constructing') {
      s.status = 'rubble';
      s.cause = 'decay';
      s.salvage = {
        timber: Math.round((def.cost.timber ?? 0) * UNIT * 0.1),
        stone: Math.round((def.cost.stone ?? 0) * UNIT * 0.2),
      };
      s.provenance.push(`${def.name} at (${s.x},${s.y}) was never finished and was abandoned.`);
      continue;
    }
    if (s.status === 'active' || s.status === 'damaged') {
      const dec = Math.round(def.decay * centuries * (s.status === 'damaged' ? 1.5 : 1));
      s.integrity = Math.max(0, s.integrity - dec);
      if (s.integrity <= 250) {
        s.status = 'rubble';
        s.cause = s.cause ?? 'decay';
        s.salvage = {
          timber: Math.round((def.cost.timber ?? 0) * UNIT * def.salvage * 0.0003),
          stone: Math.round((def.cost.stone ?? 0) * UNIT * def.salvage * 0.0007),
        };
        s.provenance.push(`${def.name} at (${s.x},${s.y}) crumbled with the centuries.`);
        fell++;
      } else if (s.integrity < 600 && s.status === 'active') {
        s.status = 'damaged';
        s.provenance.push(`${def.name} at (${s.x},${s.y}) weathered into disrepair.`);
      }
    } else {
      // Rubble: wood rots, stone endures; silt and soil bury it.
      const years = centuries * 100;
      s.salvage.timber = Math.round((s.salvage.timber * keepShare(TIMBER_KEEP, years)) / 100000);
      s.salvage.stone = Math.round((s.salvage.stone * keepShare(STONE_KEEP, years)) / 100000);
      s.burial = Math.min(3, s.burial + Math.floor(centuries / 2) + (silted(c, s) ? 1 : 0));
      if (s.burial >= 3 && s.status === 'rubble') {
        s.status = 'buried';
        buried++;
      }
    }
  }
  if (fell) log.push(`${fell} standing building${fell > 1 ? 's' : ''} crumbled with age.`);
  if (buried) log.push(`${buried} ruin${buried > 1 ? 's' : ''} sank beneath soil and silt.`);
}

function regrowWorld(c: Campaign, centuries: number, log: string[]): void {
  const w = c.world;
  let burntCells = 0;
  let siltedCells = 0;
  for (let i = 0; i < w.height.length; i++) {
    if (w.water[i]) continue;
    const occ = w.occ[i]!;
    const s = occ === -1 ? undefined : c.structures.find((st) => st.id === occ);
    const built = s && isStanding(s);
    // Ash feeds the soil; silt feeds it more; both then vanish into the ground.
    if (w.scar[i]! > 400) {
      w.fertility[i] = Math.min(950, w.fertility[i]! + 110);
      burntCells++;
    }
    if (w.silt[i]! > 0) {
      w.fertility[i] = Math.min(950, w.fertility[i]! + Math.round(w.silt[i]! / 3));
      if (w.silt[i]! > 200) siltedCells++;
      w.silt[i] = 0;
    }
    const slope = Math.max(0, w.height[i]! - 300);
    const potential = clamp(Math.round(w.fertility[i]! * 0.9 + 100 - slope * 0.5), 100, 950);
    if (!built) {
      const rate = Math.round(90 * centuries * (w.scar[i]! > 400 ? 0.6 : 1) * (s ? 0.4 : 1));
      if (w.forest[i]! < potential) w.forest[i] = Math.min(potential, w.forest[i]! + rate);
    }
    w.scar[i] = Math.round(w.scar[i]! * 0.45);
    w.pollution[i] = Math.round(w.pollution[i]! * 0.5);
    w.erosion[i] = Math.round(w.erosion[i]! * 0.7);
    // Fields rested for centuries recover most of their strength.
    if (!built && w.fertility[i]! < 700 && w.rock[i]! === 0)
      w.fertility[i] = Math.min(700, w.fertility[i]! + Math.round(70 * centuries));
  }
  if (burntCells) log.push(`Forest crept back over ${burntCells} burnt cells; ash left the soil richer.`);
  if (siltedCells) log.push(`Flood silt enriched ${siltedCells} cells of the plain.`);
  // A surviving seed vault restores the land around it.
  for (const v of c.structures.filter((s) => s.kind === 'seed_vault' && isStanding(s))) {
    let n = 0;
    for (let dy = -7; dy <= 7; dy++) {
      for (let dx = -7; dx <= 7; dx++) {
        const x = v.x + dx;
        const y = v.y + dy;
        if (dx * dx + dy * dy > 49 || !inBounds(x, y, w.w, w.h)) continue;
        const i = idx(x, y, w.w);
        if (w.water[i] || w.rock[i]! > 0) continue;
        w.fertility[i] = Math.min(950, w.fertility[i]! + 140);
        w.forest[i] = Math.min(900, w.forest[i]! + 140);
        n++;
      }
    }
    log.push(`The Seed Vault at (${v.x},${v.y}) reseeded ${n} cells of the valley.`);
  }
}

/* ------------------------------------------------------------------ */
/* Founding sites                                                      */
/* ------------------------------------------------------------------ */

function padInfo(c: Campaign, x: number, y: number): { ok: boolean; onRuin: boolean } {
  let onRuin = false;
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 2; i++) {
      const cx = x + i;
      const cy = y + j;
      if (!inBounds(cx, cy, c.world.w, c.world.h)) return { ok: false, onRuin };
      const k = idx(cx, cy, c.world.w);
      if (c.world.water[k]) return { ok: false, onRuin };
      const occ = c.world.occ[k]!;
      if (occ !== -1) {
        const s = c.structures.find((st) => st.id === occ);
        if (s && (s.status === 'rubble' || s.status === 'buried')) onRuin = true;
        else if (s && !(s.kind === 'hearth' && isStanding(s))) return { ok: false, onRuin };
        else if (s) onRuin = false; // an intact old hearth: reusable
      }
    }
  }
  if (slopeSpread(c.world, x, y, 2, 2) > 60) return { ok: false, onRuin };
  return { ok: true, onRuin };
}

function soilAround(c: Campaign, x: number, y: number): number {
  let sum = 0;
  let n = 0;
  for (let dy = -3; dy <= 4; dy++) {
    for (let dx = -3; dx <= 4; dx++) {
      if (!inBounds(x + dx, y + dy, c.world.w, c.world.h)) continue;
      const k = idx(x + dx, y + dy, c.world.w);
      if (c.world.water[k]) continue;
      sum += c.world.fertility[k]!;
      n++;
    }
  }
  return n ? Math.round(sum / n) : 0;
}

function lastHearth(c: Campaign): { x: number; y: number; standing: boolean } {
  const hs = c.structures.filter((s) => s.kind === 'hearth').sort((a, b) => b.id - a.id);
  const h = hs[0];
  if (h) return { x: h.x, y: h.y, standing: isStanding(h) };
  return { x: c.world.anchors.hearth.x, y: c.world.anchors.hearth.y, standing: false };
}

function findSites(c: Campaign): FoundingSite[] {
  const scenario = getScenario(c.scenario);
  const next = scenario.epochs[c.epoch + 1];
  if (!next) return [];
  const riskKind: HazardKind = next.hazard.kind;
  const probe: Campaign = { ...c, epoch: c.epoch + 1 };
  const result = resolveHazard(probe, riskKind, next.hazard.strength);
  const riskAt = new Map<number, number>();
  for (const cell of result.cells) riskAt.set(idx(cell.x, cell.y, c.world.w), cell.intensity);
  const riskOf = (x: number, y: number): number => {
    let r = 0;
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) r = Math.max(r, riskAt.get(idx(x + dx, y + dy, c.world.w)) ?? 0);
    if (riskKind === 'quake')
      r = Math.max(r, quakeIntensityAt(c, x, y, scaledStrength(c.difficulty, next.hazard.strength)));
    return r;
  };

  const old = lastHearth(c);
  // Everything walkable from any cell around the old hearth (the hearth may stand on a river bank).
  const bridges = bridgeCells(c);
  const start = new Set<number>();
  for (const [x, y] of footprintCells(old.x - 1, old.y - 1, 4, 4)) {
    if (!inBounds(x, y, c.world.w, c.world.h) || start.has(idx(x, y, c.world.w))) continue;
    for (const v of reachableSet(c.world, bridges, x, y)) start.add(v);
  }
  const cands: { x: number; y: number; soil: number; risk: number; elev: number; onRuin: boolean }[] = [];
  const collect = (anywhere: boolean) => {
    for (let y = 1; y < c.world.h - 3; y++) {
      for (let x = 1; x < c.world.w - 3; x++) {
        if (!anywhere && !start.has(idx(x, y, c.world.w))) continue;
        const p = padInfo(c, x, y);
        if (!p.ok) continue;
        cands.push({
          x,
          y,
          soil: soilAround(c, x, y),
          risk: riskOf(x, y),
          elev: c.world.height[idx(x, y, c.world.w)]!,
          onRuin: p.onRuin,
        });
      }
    }
  };
  collect(false);
  // A campaign must never soft-lock: if the survivors are cut off, they may settle anywhere they can stand.
  if (cands.length === 0) collect(true);
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const sites: FoundingSite[] = [];
  const push = (cand: (typeof cands)[number], label: string, note: string) =>
    sites.push({
      x: cand.x,
      y: cand.y,
      label,
      note,
      fertility: cand.soil,
      risk: cand.risk,
      riskKind,
      elevation: cand.elev,
      onRuin: cand.onRuin,
    });

  // A: the ancestral hearth (or the nearest decent ground to it).
  const nearOld = [...cands].sort((a, b) => dist(a, old) - dist(b, old) || a.y - b.y || a.x - b.x)[0];
  if (nearOld) {
    push(
      nearOld,
      'The Ancestral Hearth',
      old.standing
        ? 'The old hearth still stands. Move in at once — kept to the end, it is a landmark.'
        : 'Rebuild on the old foundations: familiar ground, flat and walkable.',
    );
  }
  const anchorA = sites[0];
  // B: the richest soil.
  const far = (cand: { x: number; y: number }) => sites.every((s) => dist(cand, s) >= 7);
  const rich = [...cands]
    .filter(far)
    .sort((a, b) => b.soil - a.soil || a.risk - b.risk || a.y - b.y || a.x - b.x)[0];
  if (rich)
    push(
      rich,
      'The Fertile Flats',
      'The best soil in the valley — and the first land the next disaster will reach.',
    );
  // C: the safest ground that can still feed people.
  const safe = [...cands]
    .filter((cd) => far(cd) && cd.soil >= 330)
    .sort((a, b) => a.risk - b.risk || b.elev - a.elev || b.soil - a.soil || a.y - b.y || a.x - b.x)[0];
  if (safe)
    push(
      safe,
      'The High Ground',
      'Poorer soil and a longer walk to water, but the hazard that is coming will find less to take.',
    );
  if (!anchorA && sites.length === 0 && cands[0])
    push(cands[0], 'The Only Ground', 'Wherever the survivors can stand.');
  return sites;
}

/** What the elders say when a tradition prepares for the catastrophe the next age will bring. */
const FORESIGHT: Record<HazardKind, string> = {
  fire: 'Because the summers are getting drier, and the old burn scars remember.',
  flood: 'Because the river has risen higher every spring.',
  quake: 'Because the old walls have begun to crack, and the wells taste of stone.',
  ash: 'Because the mountain to the east has begun to smoke.',
};

function lessonOf(rep: CollapseReport): string {
  if (rep.hazard === 'fire')
    return `Because ${rep.deaths} died and ${rep.structuresLost} buildings burned in ${rep.hazardName}.`;
  if (rep.hazard === 'flood') return `Because ${rep.hazardName} swallowed the low ground.`;
  if (rep.hazard === 'quake') return `Because ${rep.hazardName} broke the valley's walls.`;
  return `Because ${rep.hazardName} buried the fields for a whole winter.`;
}

/**
 * Three ways to carry the collapse forward: a lesson from the catastrophe that just struck, a preparation for the one
 * the next age will bring, and more hands. Within a hazard the offer rotates with the seed and the age, so every
 * tradition can come up in some lineage (fixed order used to hide six of the eleven).
 */
function traditionOptions(c: Campaign): TraditionOption[] {
  const rep = c.report;
  const struck = rep?.hazard ?? null;
  const next = getScenario(c.scenario).epochs[c.epoch + 1]?.hazard.kind ?? null;
  const have = c.lineage.traditions;
  const out: TraditionOption[] = [];
  const free = (id: TraditionId) => !have.includes(id) && !out.some((o) => o.id === id);
  const pick = (kind: HazardKind | null, salt: number): TraditionId | null => {
    if (!kind) return null;
    const ids = (Object.keys(TRADITIONS) as TraditionId[]).filter(
      (id) => TRADITIONS[id].after === kind && free(id),
    );
    return ids.length ? ids[(c.seed + c.epoch * 7 + salt) % ids.length]! : null;
  };
  const lesson = pick(struck, 0);
  if (lesson && rep) out.push({ id: lesson, because: lessonOf(rep) });
  const omen = pick(next, 3);
  if (omen && next) out.push({ id: omen, because: FORESIGHT[next] });
  if (free('open_hands'))
    out.push({ id: 'open_hands', because: 'Because more hands rebuild faster than careful ones.' });
  // Top up so there is always a real choice: first from the same two hazards, then from anything left.
  for (const kind of [struck, next]) {
    while (out.length < 3) {
      const id = pick(kind, out.length + 5);
      if (!id) break;
      out.push({ id, because: kind === struck && rep ? lessonOf(rep) : FORESIGHT[kind!] });
    }
  }
  for (const id of Object.keys(TRADITIONS) as TraditionId[]) {
    if (out.length >= 3) break;
    if (free(id)) out.push({ id, because: 'Because a people shaped by older sorrows still remembers them.' });
  }
  return out.slice(0, 3);
}

/* ------------------------------------------------------------------ */
/* DEBRIEF → INTERREGNUM                                               */
/* ------------------------------------------------------------------ */

export function enterInterregnum(c: Campaign): void {
  const scenario = getScenario(c.scenario);
  const spec = scenario.epochs[c.epoch]!;
  const centuries = centuriesOf(spec.yearsAfter);
  const log: string[] = [`${spec.yearsAfter} years pass.`];
  decayStructures(c, centuries, log);
  regrowWorld(c, centuries, log);
  const inter: Interregnum = {
    years: spec.yearsAfter,
    surveysLeft: SURVEYS_PER_INTERREGNUM,
    excavationsLeft: EXCAVATIONS_PER_INTERREGNUM,
    sites: [],
    traditions: traditionOptions(c),
    summary: [],
    yield: blankResources(),
    techs: [],
    log,
  };
  c.lineage.interregnum = inter;
  inter.sites = findSites(c);
  const ruins = c.structures.filter((s) => s.status === 'rubble' || s.status === 'buried').length;
  inter.summary = [`${spec.yearsAfter} years later, ${ruins} ruins lie across the valley.`, ...log.slice(1)];
  c.lineage.history.push({
    epoch: c.epoch,
    title: `${spec.yearsAfter} years pass`,
    text: log.slice(1).join(' ') || 'The valley sleeps.',
  });
  c.phase = 'INTERREGNUM';
}

/* ------------------------------------------------------------------ */
/* Archaeology                                                         */
/* ------------------------------------------------------------------ */

function ruinTarget(c: Campaign, id: number): Structure | null {
  const s = c.structures.find((st) => st.id === id);
  return s && (s.status === 'rubble' || s.status === 'buried') ? s : null;
}

export function surveyRuin(c: Campaign, id: number): ActionResult {
  const inter = c.lineage.interregnum;
  if (c.phase !== 'INTERREGNUM' || !inter)
    return { ok: false, code: 'wrong_phase', message: 'Surveys happen between epochs' };
  const s = ruinTarget(c, id);
  if (!s) return { ok: false, code: 'bad_target', message: 'Nothing to survey there' };
  if (s.surveyed) return { ok: false, code: 'already_done', message: 'Already surveyed' };
  if (inter.surveysLeft <= 0) return { ok: false, code: 'no_slots', message: 'No survey slots left' };
  inter.surveysLeft--;
  s.surveyed = true;
  return { ok: true, id };
}

/** What digging a ruin up yields, as plain data the survey can show in advance. */
export function ruinYield(s: Structure): { resources: Resources; techs: TechId[]; note: string } {
  const scale = Math.max(0.4, 1 - 0.2 * s.burial);
  const resources = blankResources();
  resources.timber = Math.round(s.salvage.timber * scale);
  resources.stone = Math.round(s.salvage.stone * scale);
  const techs: TechId[] = [];
  let note = 'Salvage from the ruin.';
  if (s.kind === 'archive' && s.storedTechs.length) {
    techs.push(...s.storedTechs);
    resources.knowledge += 6 * UNIT;
    note = `Clay tablets still hold ${s.storedTechs.map((t) => TECHS[t].name).join(', ')}.`;
  } else if (s.kind === 'seed_vault') {
    resources.food += 12 * UNIT;
    note = 'Sealed grain jars, still good — and seed to restart the fields.';
  } else if (s.kind === 'quarry') {
    resources.stone += 6 * UNIT;
    note = 'Cut blocks stacked beside the face, never hauled away.';
  } else if (s.kind === 'hearth') {
    resources.stone += 4 * UNIT;
    note = 'Dressed hearthstones and a flat foundation.';
  } else if (s.kind === 'dam' || s.kind === 'bridge' || s.kind === 'levee') {
    note = 'The stonework is sound. It can be restored for far less than building new.';
  }
  return { resources, techs, note };
}

export function excavateRuin(c: Campaign, id: number): ActionResult {
  const inter = c.lineage.interregnum;
  if (c.phase !== 'INTERREGNUM' || !inter)
    return { ok: false, code: 'wrong_phase', message: 'Excavation happens between epochs' };
  const s = ruinTarget(c, id);
  if (!s) return { ok: false, code: 'bad_target', message: 'Nothing to excavate there' };
  if (s.excavated) return { ok: false, code: 'already_done', message: 'Already excavated' };
  if (inter.excavationsLeft <= 0) return { ok: false, code: 'no_slots', message: 'No excavation slots left' };
  inter.excavationsLeft--;
  const y = ruinYield(s);
  featsOnExcavated(c, s, y.techs);
  s.excavated = true;
  s.surveyed = true;
  s.burial = 0;
  s.status = 'rubble';
  inter.yield.timber += y.resources.timber;
  inter.yield.stone += y.resources.stone;
  inter.yield.food += y.resources.food;
  inter.yield.knowledge += y.resources.knowledge;
  s.salvage = { timber: 0, stone: 0 };
  for (const t of y.techs) if (!inter.techs.includes(t)) inter.techs.push(t);
  if (s.kind === 'seed_vault') {
    // Reseed the surrounding fields.
    for (let dy = -4; dy <= 5; dy++) {
      for (let dx = -4; dx <= 5; dx++) {
        const x = s.x + dx;
        const yy = s.y + dy;
        if (!inBounds(x, yy, c.world.w, c.world.h)) continue;
        const k = idx(x, yy, c.world.w);
        if (!c.world.water[k] && !c.world.rock[k])
          c.world.fertility[k] = Math.min(950, c.world.fertility[k]! + 120);
      }
    }
  }
  inter.log.push(`Excavated the ${BUILDINGS[s.kind].name} at (${s.x},${s.y}). ${y.note}`);
  s.provenance.push(`Excavated in epoch ${c.epoch + 2}: ${y.note}`);
  return { ok: true, id };
}

/* ------------------------------------------------------------------ */
/* INTERREGNUM → PREPARE                                               */
/* ------------------------------------------------------------------ */

export function foundNextEpoch(c: Campaign, siteIndex: number, tradition: TraditionId): ActionResult {
  const inter = c.lineage.interregnum;
  if (c.phase !== 'INTERREGNUM' || !inter)
    return { ok: false, code: 'wrong_phase', message: 'Not between epochs' };
  const site = inter.sites[siteIndex];
  if (!site) return { ok: false, code: 'invalid_choice', message: 'No such founding site' };
  if (!inter.traditions.some((t) => t.id === tradition))
    return { ok: false, code: 'invalid_choice', message: 'That tradition is not offered' };

  const scenario = getScenario(c.scenario);
  const report = c.report!;
  const nextEpoch = c.epoch + 1;
  const spec = scenario.epochs[nextEpoch]!;

  // Settle the hearth: a standing one is reused; otherwise rubble underfoot is cleared for a new foundation.
  const standingHearth = c.structures.find((s) => s.kind === 'hearth' && isStanding(s));
  const onOld =
    standingHearth && Math.abs(standingHearth.x - site.x) <= 1 && Math.abs(standingHearth.y - site.y) <= 1;
  if (!onOld) {
    if (standingHearth) {
      standingHearth.status = 'rubble';
      standingHearth.cause = 'decay';
      standingHearth.provenance.push('Abandoned when the next society founded elsewhere.');
    }
    for (const cell of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      const occ = c.world.occ[idx(site.x + cell[0], site.y + cell[1], c.world.w)]!;
      if (occ !== -1) {
        const r = c.structures.find((s) => s.id === occ);
        if (r && (r.status === 'rubble' || r.status === 'buried')) {
          inter.log.push(
            `Cleared the ruined ${BUILDINGS[r.kind].name} at (${r.x},${r.y}) to lay a new hearth.`,
          );
          removeStructure(c, r.id);
        }
      }
    }
  }
  c.epoch = nextEpoch;
  if (!onOld) {
    const hearth = createStructure(c, 'hearth', site.x, site.y, 0, 'active');
    levelPad(c, hearth);
    hearth.provenance.push(`Founded in the ${spec.ageName}.`);
  }

  // Cultural inheritance.
  c.lineage.traditions.push(tradition);
  const traditions = [...c.lineage.traditions];
  const m = sumModifiers(traditions);

  // Knowledge inheritance: only what a valid carrier preserved or the dig recovered.
  const techs: TechId[] = [...report.retainedTechs];
  for (const t of inter.techs) if (!techs.includes(t)) techs.push(t);
  for (const t of techs) if (!c.lineage.everKnown.includes(t)) c.lineage.everKnown.push(t);
  c.lineage.lostTechs = c.lineage.lostTechs.filter((t) => !techs.includes(t));

  const res: Resources = {
    food: Math.max(0, (spec.start.food + m.startFood) * UNIT + inter.yield.food),
    timber: Math.max(0, (spec.start.timber + m.startTimber) * UNIT + inter.yield.timber),
    stone: Math.max(0, (spec.start.stone + m.startStone) * UNIT + inter.yield.stone),
    knowledge: inter.yield.knowledge,
  };
  const vault = c.structures.find((s) => s.kind === 'seed_vault' && isStanding(s));
  if (vault) {
    res.food += 10 * UNIT;
    inter.log.push('Grain from the surviving Seed Vault feeds the founders.');
  }
  const pop = clamp(Math.round(spec.startPop * 0.5 + report.survivors * 0.7) + m.startPop, 5, 16);
  const civ: Civ = {
    res,
    pop,
    morale: 650,
    techs,
    research: null,
    focus: 'balanced',
    traditions,
    stats: {
      foodMade: 0,
      foodEaten: 0,
      timberMade: 0,
      stoneMade: 0,
      knowledgeMade: 0,
      built: 0,
      researched: 0,
      decisions: 0,
      born: 0,
      starved: 0,
      peakPop: pop,
    },
    popClock: 0,
    starveClock: 0,
    labor: { total: pop, builders: 0, idle: pop },
  };
  c.civ = civ;
  c.tick = 0;
  c.queue = [];
  c.events = [];
  c.prompts = [];
  c.report = null;
  c.collapseResolved = false;
  c.forecastLevel = 0;
  c.paused = false;
  c.phase = 'PREPARE';
  c.lineage.history.push({
    epoch: nextEpoch,
    title: `${spec.name}: ${site.label}`,
    text: `${pop} settlers founded the ${spec.ageName} at (${site.x},${site.y}) and adopted ${TRADITIONS[tradition].name}.`,
  });
  c.lineage.interregnum = null;
  emit(c, { code: 'epoch.founded', msg: `${spec.name} begins`, important: true });
  featsOnFounded(c, !!onOld);
  return { ok: true };
}
