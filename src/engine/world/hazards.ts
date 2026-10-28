import { BUILDINGS } from '../content/buildings';
import { hazardStrength } from '../content/modifiers';
import { chronicleStepPm, epochSpec } from '../content/scenario';
import type {
  BuildingKind,
  Campaign,
  HazardCell,
  HazardKind,
  HazardResult,
  Structure,
  StructureImpact,
  StructureStatus,
  World,
} from '../core/types';
import { mods } from '../economy/modifiers';
import { FOOD_PER_PERSON_TICK } from '../economy/economy';
import { UNIT } from '../core/constants';
import { N4, cellsOf, clamp, idx, inBounds } from './query';

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function structureAt(c: Campaign, i: number): Structure | undefined {
  const id = c.world.occ[i]!;
  return id === -1 ? undefined : c.structures.find((s) => s.id === id);
}

/** Effective resistance (permille, clamped) of a structure against a hazard. */
export function resistanceOf(c: Campaign, s: Structure, hazard: HazardKind): number {
  const def = BUILDINGS[s.kind];
  const m = mods(c);
  const trad =
    hazard === 'fire'
      ? m.fireResist
      : hazard === 'flood'
        ? m.floodResist
        : hazard === 'ash'
          ? m.ashResist
          : m.quakeResist;
  let tech = 0;
  if (hazard === 'quake' && c.civ.techs.includes('seismic_engineering')) tech += 250;
  let wall = 0;
  if (hazard === 'quake') {
    for (const w of c.structures) {
      if (w.kind !== 'retaining_wall' || (w.status !== 'active' && w.status !== 'damaged')) continue;
      const dx = Math.abs(w.x + w.w / 2 - (s.x + s.w / 2));
      const dy = Math.abs(w.y + w.h / 2 - (s.y + s.h / 2));
      if (dx <= 5 && dy <= 5) wall = 250;
    }
  }
  // Damaged buildings are weaker; a half-built one is still just scaffolding.
  const state = s.status === 'damaged' ? -150 : s.status === 'constructing' ? -250 : 0;
  return clamp(def.resist[hazard] + s.bonus[hazard] + trad + tech + wall + state, 0, 980);
}

function classify(damage: number): StructureStatus {
  if (damage >= 600) return 'rubble';
  if (damage >= 250) return 'damaged';
  return 'active';
}

/* ------------------------------------------------------------------ */
/* Fire                                                                */
/* ------------------------------------------------------------------ */

const FIRE_K = 700;
const EMBER_COST = 42;

/** Fuel 0..100 per cell: what a wildfire can eat. Bare earth, water and rock stop it. */
export function fuelMap(c: Campaign): number[] {
  const w = c.world;
  const fuel = new Array<number>(w.w * w.h).fill(0);
  for (let i = 0; i < fuel.length; i++) {
    if (w.water[i]) continue;
    if (w.rock[i]! > 0) continue;
    let f = 12; // dry grass
    f = Math.max(f, Math.round(w.forest[i]! / 10));
    if (w.scar[i]! > 400) f = Math.round(f * 0.35); // already burnt ground
    fuel[i] = f;
  }
  for (const s of c.structures) {
    const def = BUILDINGS[s.kind];
    for (const [x, y] of cellsOf(s)) {
      const i = idx(x, y, w.w);
      if (s.status === 'rubble' || s.status === 'buried') {
        fuel[i] = def.material === 'stone' || def.material === 'earth' || def.material === 'iron' ? 3 : 18;
      } else {
        fuel[i] = s.status === 'constructing' ? Math.round(def.fuel * 0.6) : def.fuel;
      }
    }
  }
  return fuel;
}

function simulateFire(c: Campaign, budget: number): HazardCell[] {
  const w = c.world;
  const fuel = fuelMap(c);
  const { fireOrigin, wind } = w.anchors;
  const n = w.w * w.h;
  const arrival = new Array<number>(n).fill(Infinity);
  const start = idx(fireOrigin.x, fireOrigin.y, w.w);
  arrival[start] = 0;
  // Dial-style bucket queue: costs are small integers.
  const buckets: number[][] = [];
  const push = (cost: number, cell: number) => {
    (buckets[cost] ??= []).push(cell);
  };
  push(0, start);
  const stepCost = (fuelHere: number, dx: number, dy: number): number => {
    const base = Math.max(2, Math.round(FIRE_K / (fuelHere + 3)));
    const align = dx * wind.dx + dy * wind.dy; // 1 with the wind, -1 against
    const pct = align > 0 ? 75 : align < 0 ? 150 : 100;
    return Math.max(1, Math.round((base * pct) / 100));
  };
  for (let cost = 0; cost <= budget; cost++) {
    const list = buckets[cost];
    if (!list) continue;
    for (let k = 0; k < list.length; k++) {
      const cell = list[k]!;
      if (arrival[cell]! !== cost) continue;
      const cx = cell % w.w;
      const cy = (cell - cx) / w.w;
      for (const [dx, dy] of N4) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!inBounds(nx, ny, w.w, w.h)) continue;
        const ni = idx(nx, ny, w.w);
        const f = fuel[ni]!;
        if (f > 0) {
          const nc = cost + stepCost(f, dx, dy);
          if (nc <= budget && nc < arrival[ni]!) {
            arrival[ni] = nc;
            push(nc, ni);
          }
        } else if (!w.water[ni]) {
          // A single bare cell can be leapt by embers; two cannot. Rivers are two cells wide.
          const jx = cx + dx * 2;
          const jy = cy + dy * 2;
          if (!inBounds(jx, jy, w.w, w.h)) continue;
          const ji = idx(jx, jy, w.w);
          const jf = fuel[ji]!;
          if (jf <= 0 || w.water[ji]) continue;
          const align = dx * wind.dx + dy * wind.dy;
          if (align < 0) continue; // embers do not fly upwind
          const nc = cost + EMBER_COST + stepCost(jf, dx, dy);
          if (nc <= budget && nc < arrival[ji]!) {
            arrival[ji] = nc;
            push(nc, ji);
          }
        }
      }
    }
  }
  const cells: HazardCell[] = [];
  for (let i = 0; i < n; i++) {
    if (arrival[i]! === Infinity) continue;
    cells.push({
      x: i % w.w,
      y: Math.floor(i / w.w),
      arrival: arrival[i]!,
      intensity: clamp(fuel[i]! * 10, 120, 1000),
    });
  }
  return cells;
}

/* ------------------------------------------------------------------ */
/* Flood                                                               */
/* ------------------------------------------------------------------ */

const FLOOD_FRICTION = 5;
/** Permille multiplier on quake damage (see resolveHazard). */
export const QUAKE_SEVERITY_PM = 1600;

export function catchmentForestFraction(w: World): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < w.height.length; i++) {
    if (w.water[i]) continue;
    sum += w.forest[i]!;
    n++;
  }
  return n ? sum / n / 1000 : 0;
}

/** Peak river rise (centi-cells) this epoch: bare slopes shed water faster, so deforestation raises it. */
export function floodPeak(c: Campaign, strength: number = epochSpec(c, c.epoch).hazard.strength): number {
  const fc = catchmentForestFraction(c.world);
  const factor = clamp(1000 + Math.round((0.42 - fc) * 1500), 650, 1550);
  return Math.round((strength * factor) / 1000);
}

function simulateFlood(c: Campaign, strength: number): HazardCell[] {
  const w = c.world;
  const peak = floodPeak(c, strength);
  const n = w.w * w.h;
  // Effective barrier height: levees stand 2.2 cells tall on top of the ground.
  const eff = w.height.slice();
  for (const s of c.structures) {
    if (s.kind !== 'levee' || (s.status !== 'active' && s.status !== 'damaged')) continue;
    const bonus = s.status === 'active' ? 220 : 110;
    for (const [x, y] of cellsOf(s)) eff[idx(x, y, w.w)]! += bonus;
  }
  // Planted groves slow water: each grove cell is worth a little barrier height.
  for (const s of c.structures) {
    if (s.kind !== 'grove' || s.status !== 'active') continue;
    for (const [x, y] of cellsOf(s)) eff[idx(x, y, w.w)]! += 90;
  }
  // A dam clips the crest for everything downstream (rows with larger y).
  let damY = -1;
  for (const s of c.structures)
    if (s.kind === 'dam' && (s.status === 'active' || s.status === 'damaged')) damY = Math.max(damY, s.y);
  // Silt and shape: river rows.
  const head = new Array<number>(n).fill(-Infinity);
  const dist = new Array<number>(n).fill(0);
  const queue: number[] = [];
  for (let y = 0; y < w.h; y++) {
    const p = damY >= 0 && y > damY + 1 ? Math.round(peak * 0.62) : peak;
    for (let x = 0; x < w.w; x++) {
      const i = idx(x, y, w.w);
      if (!w.water[i]) continue;
      head[i] = w.height[i]! + p;
      queue.push(i);
    }
  }
  // Relaxation: water spreads outward, losing head to friction, blocked by effective ground height.
  let qi = 0;
  while (qi < queue.length) {
    const cell = queue[qi++]!;
    const cx = cell % w.w;
    const cy = (cell - cx) / w.w;
    const hh = head[cell]!;
    for (const [dx, dy] of N4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny, w.w, w.h)) continue;
      const ni = idx(nx, ny, w.w);
      const nh = hh - FLOOD_FRICTION;
      if (nh <= eff[ni]!) continue;
      if (nh > head[ni]!) {
        head[ni] = nh;
        dist[ni] = dist[cell]! + 1;
        queue.push(ni);
      }
    }
  }
  const cells: HazardCell[] = [];
  for (let i = 0; i < n; i++) {
    if (head[i]! === -Infinity) continue;
    if (w.water[i]) continue;
    const depth = head[i]! - w.height[i]!; // levees raise the barrier, not the ground
    if (depth <= 3) continue;
    cells.push({
      x: i % w.w,
      y: Math.floor(i / w.w),
      arrival: dist[i]!,
      intensity: clamp(depth * 4, 40, 1000),
    });
  }
  return cells;
}

/* ------------------------------------------------------------------ */
/* Quake                                                               */
/* ------------------------------------------------------------------ */

export function quakeIntensityAt(c: Campaign, x: number, y: number, strength: number): number {
  const e = c.world.anchors.quakeEpicenter;
  const d2 = (x - e.x) * (x - e.x) + (y - e.y) * (y - e.y);
  let i = Math.round((strength * 46) / (46 + d2));
  const k = idx(Math.round(x), Math.round(y), c.world.w);
  if (c.world.rock[k]! > 0)
    i = Math.round(i * 0.7); // bedrock
  else if (c.world.height[k]! < 85) i = Math.round(i * 1.25); // soft floodplain amplifies shaking
  return clamp(i, 0, 1000);
}

function simulateQuake(c: Campaign, strength: number): HazardCell[] {
  const w = c.world;
  const e = w.anchors.quakeEpicenter;
  const cells: HazardCell[] = [];
  for (let y = 0; y < w.h; y++) {
    for (let x = 0; x < w.w; x++) {
      const inten = quakeIntensityAt(c, x, y, strength);
      if (inten < 140) continue;
      cells.push({
        x,
        y,
        arrival: Math.round(Math.sqrt((x - e.x) * (x - e.x) + (y - e.y) * (y - e.y)) * 4),
        intensity: inten,
      });
    }
  }
  return cells;
}

/* ------------------------------------------------------------------ */
/* Ashfall winter                                                      */
/* ------------------------------------------------------------------ */

/** Ticks of lost harvest the village must live through on its reserves (30 s of the story's winter). */
export const ASH_WINTER_TICKS = 300;
/** Permille multiplier on ash damage: wet ash is heavy, and roofs fail all at once. */
export const ASH_SEVERITY_PM = 1500;
/** Food (whole units) a sealed Granary keeps safe through an ashfall winter. */
export const GRANARY_RESERVE = 25;

/** The vent lies upwind of the valley; the plume drifts with the prevailing wind. */
export function ventOf(c: Campaign): { x: number; y: number } {
  const { hearth, wind } = c.world.anchors;
  return {
    x: clamp(Math.round(hearth.x - wind.dx * 13), 2, c.world.w - 3),
    y: clamp(Math.round(hearth.y - wind.dy * 13) - 4, 2, c.world.h - 3),
  };
}

/** Ash depth (permille of a "roof-breaking" load) at a cell for a plume of the given strength. */
export function ashDepthAt(c: Campaign, x: number, y: number, strength: number): number {
  const v = ventOf(c);
  const { wind } = c.world.anchors;
  const dx = x - v.x;
  const dy = y - v.y;
  const along = dx * wind.dx + dy * wind.dy; // positive downwind
  const across = dx * wind.dy - dy * wind.dx;
  // The plume carries far downwind and barely upwind.
  const eff = across * across + (along > 0 ? along * 0.45 : along * 2) ** 2;
  return clamp(Math.round((strength * 70) / (70 + eff)), 0, 1000);
}

function simulateAsh(c: Campaign, strength: number): HazardCell[] {
  const w = c.world;
  const cells: HazardCell[] = [];
  for (let y = 0; y < w.h; y++) {
    for (let x = 0; x < w.w; x++) {
      if (w.water[idx(x, y, w.w)]) continue; // the river carries ash away
      const depth = ashDepthAt(c, x, y, strength);
      if (depth < 120) continue;
      const v = ventOf(c);
      const dx = x - v.x;
      const dy = y - v.y;
      // Math.sqrt of an integer is exact-rounded everywhere (Math.hypot is not guaranteed to be).
      cells.push({ x, y, arrival: Math.round(Math.sqrt(dx * dx + dy * dy) * 6), intensity: depth });
    }
  }
  return cells;
}

/** Food (whole units) the village must have to see out the winter, and what it has safely put by. */
export function winterLarder(c: Campaign): { need: number; have: number; perPerson: number } {
  const perPerson = (FOOD_PER_PERSON_TICK * ASH_WINTER_TICKS) / UNIT;
  const granaries = c.structures.filter(
    (s) => s.kind === 'granary' && (s.status === 'active' || s.status === 'damaged'),
  );
  const sealed = granaries.reduce(
    (n, s) => n + (s.status === 'active' ? GRANARY_RESERVE : Math.floor(GRANARY_RESERVE / 2)),
    0,
  );
  return {
    need: Math.round(c.civ.pop * perPerson),
    have: Math.floor(c.civ.res.food / UNIT) + sealed,
    perPerson,
  };
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

const KIND_NAME: Record<BuildingKind, string> = Object.fromEntries(
  (Object.keys(BUILDINGS) as BuildingKind[]).map((k) => [k, BUILDINGS[k].name]),
) as Record<BuildingKind, string>;

function describe(
  s: Structure,
  hazard: HazardKind,
  resist: number,
  exposure: number,
  damage: number,
  after: StructureStatus,
): string {
  const res = Math.round(resist / 10);
  const nm = KIND_NAME[s.kind];
  const what =
    hazard === 'fire'
      ? `${Math.round(exposure / 10)}% of its ground burned`
      : hazard === 'flood'
        ? `water ${exposure}cm deep`
        : hazard === 'ash'
          ? `${Math.round(exposure / 10)} cm of ash on the roof`
          : `shaking ${Math.round(exposure / 10)}%`;
  const verdict = after === 'rubble' ? 'was destroyed' : after === 'damaged' ? 'was damaged' : 'came through';
  return `${nm} (${hazard} resistance ${res}%) ${verdict}: ${what}, damage ${Math.round(damage / 10)}%.`;
}

/**
 * In the long chronicle a returning catastrophe is fiercer in every way, by the same step per age past the scenario's
 * last as its strength (permille; 1000 in every other age): it reaches further (strength), harms every building it
 * reaches more, and old defences hold less against it (`effectiveResistance`). Harm alone was not enough: a late
 * village's resistances reach their cap (traditions stack every age), so multiplying its tiny vulnerability changed
 * nothing, and every winning bot lineage lived all twelve ages.
 */
export function chronicleSeverityPm(c: Pick<Campaign, 'scenario' | 'endless' | 'epoch'>): number {
  return c.endless ? chronicleStepPm(c.scenario, c.epoch) : 1000;
}

/** A building's resistance as this age's catastrophe meets it: in the long chronicle, divided by its severity. */
export function effectiveResistance(
  c: Campaign,
  s: Structure,
  hazard: HazardKind,
  severity = chronicleSeverityPm(c),
): number {
  const r = resistanceOf(c, s, hazard);
  return severity === 1000 ? r : Math.round((r * 1000) / severity);
}

/**
 * Pure projection of what the hazard would do right now. The live forecast and the final resolution both call
 * this, so the player's mitigation choices have exactly the effect the overlay promised.
 */
export function resolveHazard(
  c: Campaign,
  kind: HazardKind = epochSpec(c, c.epoch).hazard.kind,
  nominal: number = epochSpec(c, c.epoch).hazard.strength,
): HazardResult {
  // Difficulty and challenges scale the authored strength here, once, so the forecast, the resolution and every
  // caller agree.
  const strength = hazardStrength(c, kind, nominal);
  const severity = chronicleSeverityPm(c);
  const cells =
    kind === 'fire'
      ? simulateFire(c, strength)
      : kind === 'flood'
        ? simulateFlood(c, strength)
        : kind === 'ash'
          ? simulateAsh(c, strength)
          : simulateQuake(c, strength);
  const w = c.world;
  const map = new Map<number, HazardCell>();
  for (const cell of cells) map.set(idx(cell.x, cell.y, w.w), cell);
  const impacts: StructureImpact[] = [];
  for (const s of c.structures) {
    if (s.status === 'rubble' || s.status === 'buried') continue;
    const fp = cellsOf(s);
    let hit = 0;
    let maxI = 0;
    let depthSum = 0;
    for (const [x, y] of fp) {
      const hc = map.get(idx(x, y, w.w));
      if (!hc) continue;
      hit++;
      maxI = Math.max(maxI, hc.intensity);
      depthSum += hc.intensity / 4;
    }
    if (hit === 0) continue;
    const resist = effectiveResistance(c, s, kind, severity);
    let exposure: number;
    let damage: number;
    if (kind === 'fire') {
      exposure = Math.round((hit * 1000) / fp.length);
      damage = Math.round((exposure * (1000 - resist)) / 1000);
    } else if (kind === 'flood') {
      const depth = Math.round(depthSum / hit); // cm of water over the floor
      exposure = depth;
      const share = Math.round((hit * 1000) / fp.length);
      damage = Math.round((clamp(depth * 12, 0, 1000) * (1000 - resist) * share) / 1_000_000);
    } else if (kind === 'ash') {
      exposure = maxI;
      damage = Math.round((maxI * (1000 - resist) * ASH_SEVERITY_PM) / 1_000_000);
    } else {
      exposure = maxI;
      // Ground motion is violent: the same intensity does far more harm than a fire's heat or a flood's depth.
      damage = Math.round((maxI * (1000 - resist) * QUAKE_SEVERITY_PM) / 1_000_000);
    }
    const before = s.status;
    // Damage is a permille like the rest: a fiercer return can at most destroy a building.
    if (severity !== 1000) damage = Math.min(1000, Math.round((damage * severity) / 1000));
    const after = classify(damage);
    impacts.push({
      id: s.id,
      kind: s.kind,
      x: s.x,
      y: s.y,
      before,
      after,
      exposure,
      damage,
      reason: describe(s, kind, resist, exposure, damage, after),
    });
  }
  let span = 0;
  for (const cell of cells) span = Math.max(span, cell.arrival);
  return { kind, cells, impacts, span, area: cells.length };
}

export { structureAt };
