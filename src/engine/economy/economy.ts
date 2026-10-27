import { BUILDINGS } from '../content/buildings';
import { TECHS } from '../content/techs';
import { UNIT } from '../core/constants';
import { emit } from '../core/events';
import type { Campaign, ResourceKey, Structure } from '../core/types';
import { RESOURCE_KEYS } from '../core/types';
import { footprintCells, idx, inBounds } from '../world/query';
import { hasTech, housingCapacity, mods } from './modifiers';

export const FOOD_PER_PERSON_TICK = 12; // 0.12 food/s each
export const GROWTH_TICKS = 70;
export const STARVE_TICKS = 50;
export const RES_CAP = 900 * UNIT;

const DEFAULT_ORDER: ResourceKey[] = ['food', 'timber', 'stone', 'knowledge'];

function activeOrDamaged(s: Structure): boolean {
  return s.status === 'active' || s.status === 'damaged';
}

/** Output multiplier for a building that is only partly intact. */
function conditionPm(s: Structure): number {
  return s.status === 'damaged' ? 400 : 1000;
}

/* ------------------------------------------------------------------ */
/* Labor                                                               */
/* ------------------------------------------------------------------ */

export function allocateLabor(c: Campaign): void {
  for (const s of c.structures) {
    s.workers = 0;
    s.staffing = 0;
  }
  let labor = c.civ.pop;
  const total = labor;
  const projects = c.structures.filter((s) => s.status === 'constructing').sort((a, b) => a.id - b.id);
  const share = c.civ.focus === 'build' ? 700 : 450;
  let remaining = projects.length ? Math.min(labor, Math.ceil((labor * share) / 1000)) : 0;
  const cap = remaining;
  for (const p of projects) {
    const n = Math.min(BUILDINGS[p.kind].maxBuilders, remaining);
    p.workers = n;
    remaining -= n;
  }
  const builders = cap - remaining;
  labor -= builders;

  const staffed = c.structures.filter((s) => activeOrDamaged(s)).sort((a, b) => a.id - b.id);
  // Support buildings (workshop, forge) first: they are force multipliers that cost hands.
  for (const s of staffed) {
    const d = BUILDINGS[s.kind];
    if (d.workers > 0 && d.job === null) {
      const n = Math.min(d.workers, labor);
      s.workers = n;
      labor -= n;
    }
  }
  const focus = c.civ.focus;
  const order: ResourceKey[] =
    focus === 'build' || focus === 'balanced'
      ? DEFAULT_ORDER
      : [focus as ResourceKey, ...DEFAULT_ORDER.filter((k) => k !== focus)];
  for (const key of order) {
    for (const s of staffed) {
      const d = BUILDINGS[s.kind];
      if (d.job !== key || d.workers === 0) continue;
      const n = Math.min(d.workers, labor);
      s.workers = n;
      labor -= n;
    }
  }
  for (const s of staffed) {
    const d = BUILDINGS[s.kind];
    s.staffing = d.workers > 0 ? Math.round((s.workers * 1000) / d.workers) : 1000;
  }
  c.civ.labor = { total, builders, idle: labor };
}

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

export function buildSpeedPm(c: Campaign): number {
  let pm = 1000 + mods(c).buildSpeed;
  const shop = c.structures.find((s) => s.kind === 'workshop' && s.status === 'active');
  if (shop) pm += Math.round((300 * shop.staffing) / 1000);
  if (hasTech(c, 'bronze_tools')) pm += 150;
  return Math.max(300, Math.min(2500, pm));
}

export function stepConstruction(c: Campaign): void {
  const speed = buildSpeedPm(c);
  for (const s of c.structures) {
    if (s.status !== 'constructing' || s.workers === 0) continue;
    const d = BUILDINGS[s.kind];
    s.progress += s.workers * speed;
    if (s.progress >= d.buildWork * 1000) {
      s.progress = d.buildWork * 1000;
      s.status = 'active';
      s.integrity = 1000;
      c.civ.stats.built++;
      emit(c, {
        code: 'build.complete',
        msg: `${d.name} finished`,
        id: s.id,
        x: s.x,
        y: s.y,
        important: d.heritage,
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Production                                                          */
/* ------------------------------------------------------------------ */

function forestAround(c: Campaign, s: Structure, radius: number): number {
  const cx = Math.round(s.x + (s.w - 1) / 2);
  const cy = Math.round(s.y + (s.h - 1) / 2);
  let sum = 0;
  for (let j = -radius; j <= radius; j++) {
    for (let i = -radius; i <= radius; i++) {
      if (i * i + j * j > radius * radius || !inBounds(cx + i, cy + j, c.world.w, c.world.h)) continue;
      sum += c.world.forest[idx(cx + i, cy + j, c.world.w)]!;
    }
  }
  return sum;
}

/** Remove `amount` permille of forest, densest cell first, within radius of a structure. */
function fellTrees(c: Campaign, s: Structure, radius: number, amount: number): void {
  const cx = Math.round(s.x + (s.w - 1) / 2);
  const cy = Math.round(s.y + (s.h - 1) / 2);
  let best = -1;
  let bestV = 0;
  for (let j = -radius; j <= radius; j++) {
    for (let i = -radius; i <= radius; i++) {
      if (i * i + j * j > radius * radius || !inBounds(cx + i, cy + j, c.world.w, c.world.h)) continue;
      const k = idx(cx + i, cy + j, c.world.w);
      if (c.world.forest[k]! > bestV) {
        bestV = c.world.forest[k]!;
        best = k;
      }
    }
  }
  if (best >= 0) {
    c.world.forest[best] = Math.max(0, c.world.forest[best]! - amount);
    c.world.erosion[best] = Math.min(1000, c.world.erosion[best]! + Math.round(amount / 8));
  }
}

function quarryDeposit(c: Campaign, s: Structure): number[] {
  const cells: number[] = [];
  for (const [x, y] of footprintCells(s.x - 1, s.y - 1, s.w + 2, s.h + 2)) {
    if (!inBounds(x, y, c.world.w, c.world.h)) continue;
    const k = idx(x, y, c.world.w);
    if (c.world.rock[k]! > 0) cells.push(k);
  }
  return cells.sort((a, b) => c.world.rock[b]! - c.world.rock[a]! || a - b);
}

export function farmFertilityPm(c: Campaign, s: Structure): number {
  let f = 0;
  let n = 0;
  for (const [x, y] of footprintCells(s.x, s.y, s.w, s.h)) {
    f += c.world.fertility[idx(x, y, c.world.w)]!;
    n++;
  }
  return Math.round(f / Math.max(1, n));
}

export function stepProduction(c: Campaign): void {
  const m = mods(c);
  const res = c.civ.res;
  const stats = c.civ.stats;
  for (const s of c.structures) {
    if (!activeOrDamaged(s)) continue;
    const d = BUILDINGS[s.kind];
    const cond = conditionPm(s);

    // Upkeep: unpaid upkeep idles the building this tick.
    let funded = true;
    for (const k of RESOURCE_KEYS) {
      const u = d.upkeep[k];
      if (!u || s.staffing === 0) continue;
      const need = Math.round((u * s.staffing) / 1000);
      if (res[k] >= need) res[k] -= need;
      else funded = false;
    }
    if (!funded) continue;

    if (s.kind === 'hearth') {
      const out = Math.round((10 * cond * (1000 + m.knowledgeRate)) / 1_000_000);
      res.knowledge = Math.min(RES_CAP, res.knowledge + out);
      stats.knowledgeMade += out;
      continue;
    }
    if (!d.job || d.output === 0 || s.staffing === 0) continue;

    if (d.job === 'food') {
      const fert = farmFertilityPm(c, s);
      const soil = 400 + Math.round((fert * 800) / 1000);
      let tech = 1000 + m.foodRate;
      if (hasTech(c, 'irrigation')) tech += 250;
      const out = Math.round((d.output * s.staffing * soil * tech * cond) / 1e12);
      res.food = Math.min(RES_CAP, res.food + out);
      stats.foodMade += out;
      if (!hasTech(c, 'crop_rotation')) {
        s.acc += s.staffing;
        while (s.acc >= 5000) {
          s.acc -= 5000;
          for (const [x, y] of footprintCells(s.x, s.y, s.w, s.h)) {
            const k = idx(x, y, c.world.w);
            c.world.fertility[k] = Math.max(60, c.world.fertility[k]! - 1);
          }
        }
      }
    } else if (d.job === 'timber') {
      const eff = Math.min(1000, Math.round((forestAround(c, s, 3) * 1000) / 9000));
      const out = Math.round((d.output * s.staffing * eff * (1000 + m.timberRate) * cond) / 1e12);
      if (out > 0) {
        res.timber = Math.min(RES_CAP, res.timber + out);
        stats.timberMade += out;
        s.acc += out;
        const per = hasTech(c, 'forestry') ? 24 : 40;
        while (s.acc >= UNIT) {
          s.acc -= UNIT;
          fellTrees(c, s, 3, per);
        }
      } else if (eff === 0 && c.tick % 100 === 0) {
        emit(c, {
          code: 'camp.barren',
          msg: 'A Lumber Camp has felled every tree within reach',
          id: s.id,
          x: s.x,
          y: s.y,
        });
      }
    } else if (d.job === 'stone') {
      const deposit = quarryDeposit(c, s);
      if (deposit.length === 0) {
        if (c.tick % 100 === 0)
          emit(c, {
            code: 'quarry.depleted',
            msg: 'A Quarry has run out of stone',
            id: s.id,
            x: s.x,
            y: s.y,
          });
        continue;
      }
      let tech = 1000 + m.stoneRate;
      if (hasTech(c, 'masonry')) tech += 250;
      const out = Math.round((d.output * s.staffing * tech * cond) / 1e9);
      res.stone = Math.min(RES_CAP, res.stone + out);
      stats.stoneMade += out;
      s.acc += out;
      while (s.acc >= UNIT) {
        s.acc -= UNIT;
        const k = deposit.find((cell) => c.world.rock[cell]! > 0);
        if (k === undefined) break;
        c.world.rock[k] = c.world.rock[k]! - 1;
        c.world.erosion[k] = Math.min(1000, c.world.erosion[k]! + 4);
        if (c.world.rock[k]! % 3 === 0) c.world.height[k] = Math.max(0, c.world.height[k]! - 1);
      }
    } else if (d.job === 'knowledge') {
      let tech = 1000 + m.knowledgeRate;
      if (hasTech(c, 'writing')) tech += 400;
      const out = Math.round((d.output * s.staffing * tech * cond) / 1e9);
      res.knowledge = Math.min(RES_CAP, res.knowledge + out);
      stats.knowledgeMade += out;
    }
  }
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export function stepPopulation(c: Campaign): void {
  const civ = c.civ;
  const cap = housingCapacity(c);
  const need = civ.pop * FOOD_PER_PERSON_TICK;
  let shortage = false;
  if (civ.res.food >= need) {
    civ.res.food -= need;
    civ.stats.foodEaten += need;
    civ.starveClock = Math.max(0, civ.starveClock - 2);
  } else {
    civ.stats.foodEaten += civ.res.food;
    civ.res.food = 0;
    shortage = true;
    civ.starveClock++;
  }
  if (shortage) {
    civ.morale = Math.max(0, civ.morale - 2);
    if (civ.starveClock === 1)
      emit(c, {
        code: 'food.shortage',
        msg: 'The granaries are empty — people are going hungry',
        important: true,
      });
    if (civ.starveClock >= STARVE_TICKS && civ.pop > 0) {
      civ.pop--;
      civ.starveClock = 0;
      civ.stats.starved++;
      emit(c, { code: 'pop.starved', msg: 'Someone starved', important: true });
    }
  } else if (civ.pop > cap) {
    civ.morale = Math.max(0, civ.morale - 1);
    if (c.tick % 100 === 0)
      emit(c, { code: 'pop.crowded', msg: 'People are sleeping outdoors — build more homes' });
  } else {
    civ.morale = Math.min(850, civ.morale + 1);
  }
  const fed = !shortage && civ.res.food >= civ.pop * 60;
  if (fed && civ.pop < cap && civ.morale >= 350) {
    civ.popClock++;
    if (civ.popClock >= GROWTH_TICKS) {
      civ.popClock = 0;
      civ.pop++;
      civ.stats.born++;
      civ.stats.peakPop = Math.max(civ.stats.peakPop, civ.pop);
      emit(c, { code: 'pop.born', msg: 'A child is born' });
    }
  } else {
    civ.popClock = Math.max(0, civ.popClock - 1);
  }
}

/* ------------------------------------------------------------------ */
/* Research                                                            */
/* ------------------------------------------------------------------ */

export function stepResearch(c: Campaign): void {
  const job = c.civ.research;
  if (!job) return;
  job.remaining--;
  if (job.remaining <= 0) {
    c.civ.techs.push(job.tech);
    if (!c.lineage.everKnown.includes(job.tech)) c.lineage.everKnown.push(job.tech);
    c.lineage.lostTechs = c.lineage.lostTechs.filter((t) => t !== job.tech);
    c.civ.research = null;
    c.civ.stats.researched++;
    emit(c, { code: 'research.done', msg: `${TECHS[job.tech].name} discovered`, important: true });
  }
}
