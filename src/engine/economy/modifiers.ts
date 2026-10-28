import { BUILDINGS } from '../content/buildings';
import { TECHS } from '../content/techs';
import { addMods, modifierMods } from '../content/modifiers';
import { sumModifiers, type Modifiers } from '../content/traditions';
import { UNIT } from '../core/constants';
import type { Campaign, Resources, Structure, TechId } from '../core/types';

export function hasTech(c: Campaign, t: TechId): boolean {
  return c.civ.techs.includes(t);
}

/** Every rate and resistance modifier in force: the traditions adopted, and the lineage's challenges. */
export function mods(c: Campaign): Modifiers {
  const m = sumModifiers(c.civ.traditions);
  return c.modifiers ? addMods(m, modifierMods(c)) : m;
}

/** Knowledge cost of a tech right now (whole-unit authored cost → fixed point). */
export function techCost(c: Campaign, t: TechId): number {
  const base = TECHS[t].cost * UNIT;
  const m = mods(c);
  let pm = 1000 + m.researchCost;
  // People remember there was a way: rediscovery is cheaper than first discovery.
  if (c.lineage.lostTechs.includes(t)) pm -= 350;
  return Math.max(UNIT, Math.round((base * pm) / 1000));
}

export function isStanding(s: Structure): boolean {
  return s.status === 'active' || s.status === 'damaged';
}

export function isFunctional(s: Structure): boolean {
  return s.status === 'active';
}

/** Total shelter. Damaged housing shelters half as many. */
export function housingCapacity(c: Campaign): number {
  let cap = 0;
  for (const s of c.structures) {
    const h = BUILDINGS[s.kind].housing;
    if (!h) continue;
    if (s.status === 'active') cap += h;
    else if (s.status === 'damaged') cap += Math.floor(h / 2);
  }
  return cap;
}

export function canAfford(res: Resources, cost: Resources): { ok: boolean; missing: Partial<Resources> } {
  const missing: Partial<Resources> = {};
  let ok = true;
  for (const k of Object.keys(cost) as (keyof Resources)[]) {
    if (res[k] < cost[k]) {
      ok = false;
      missing[k] = cost[k] - res[k];
    }
  }
  return { ok, missing };
}

export function addRes(a: Resources, b: Resources, sign: 1 | -1 = 1): void {
  a.food += sign * b.food;
  a.timber += sign * b.timber;
  a.stone += sign * b.stone;
  a.knowledge += sign * b.knowledge;
}

/** Cost already promised to queued, not-yet-applied actions (so players cannot over-plan). */
export function reservedCost(c: Campaign): Resources {
  const r: Resources = { food: 0, timber: 0, stone: 0, knowledge: 0 };
  for (const q of c.queue) {
    if (q.paid) continue;
    const a = q.action;
    if (a.type === 'build') {
      const d = BUILDINGS[a.kind];
      r.food += (d.cost.food ?? 0) * UNIT;
      r.timber += (d.cost.timber ?? 0) * UNIT;
      r.stone += (d.cost.stone ?? 0) * UNIT;
    } else if (a.type === 'research') {
      r.knowledge += techCost(c, a.tech);
    }
  }
  return r;
}
