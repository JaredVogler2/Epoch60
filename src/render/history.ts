import { BUILDINGS, getScenario } from '../engine';
import type { Campaign, HazardCell, HazardKind } from '../engine';

/**
 * The history lens: what each age left in the valley. Every building and ruin is marked with the age that raised it,
 * each past catastrophe with the ground it reached — exactly the cells its collapse report recorded — and the land with
 * the soil the ages wore away. Pure: the overlay draws it and the legend counts it.
 */

/**
 * Erosion (0..1000) from which ground counts as worn away. Quarrying, felling and floods all erode it and an interregnum
 * keeps 70%; between ages the deepest marks measure 25–56 on the recorded runs. What crosses this is felled woodland the
 * flood then washed over, and quarry pits. A flood alone (+30, so 21 once the centuries pass) stays below it: its reach
 * is drawn from the record instead.
 */
export const ERODED_AT = 30;

export interface HistorySite {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  epoch: number;
  ruin: boolean;
  name: string;
}

/** Where one past catastrophe reached, from its collapse report. */
export interface HistoryReach {
  epoch: number;
  kind: HazardKind;
  name: string;
  cells: HazardCell[];
}

export interface HistoryLayers {
  sites: HistorySite[];
  /** One per catastrophe so far, oldest first. */
  reach: HistoryReach[];
  /** Land cells (with their erosion) worn away by quarries, felling and floods. */
  eroded: { x: number; y: number; intensity: number }[];
  /** Age names, oldest first, for the legend. */
  ages: string[];
}

/**
 * Whether the lens is on the map: always between ages (choosing what to dig and where to found), and while planning an
 * inherited age when the player asks for it. The first age has no history, so a toggle left on by an earlier lineage
 * cannot hide its forecast.
 */
export function lensShown(c: Campaign | null, screen: string, wanted: boolean): boolean {
  return (
    !!c &&
    screen === 'game' &&
    (c.phase === 'INTERREGNUM' || (c.phase === 'PREPARE' && c.epoch > 0 && wanted))
  );
}

export function historyLayers(c: Campaign): HistoryLayers {
  const w = c.world;
  const sites: HistorySite[] = c.structures.map((s) => ({
    id: s.id,
    x: s.x,
    y: s.y,
    w: s.w,
    h: s.h,
    epoch: s.originEpoch,
    ruin: s.status === 'rubble' || s.status === 'buried',
    name: BUILDINGS[s.kind].name,
  }));
  const reach = c.lineage.reports.map((r) => ({
    epoch: r.epoch,
    kind: r.hazard,
    name: r.hazardName,
    cells: r.result.cells,
  }));
  const eroded: HistoryLayers['eroded'] = [];
  for (let y = 0; y < w.h; y++)
    for (let x = 0; x < w.w; x++) {
      const i = y * w.w + x;
      if (w.water[i] !== 1 && w.erosion[i]! >= ERODED_AT) eroded.push({ x, y, intensity: w.erosion[i]! });
    }
  const ages = getScenario(c.scenario)
    .epochs.slice(0, c.epoch + 1)
    .map((e) => e.ageName);
  return { sites, reach, eroded, ages };
}

/** One colour per age, oldest first (the overlay and the legend share them). */
export const AGE_COLORS = ['#f2b33d', '#3fc7c2', '#b48cff', '#ff8a5c', '#7fd28a', '#ff6a9a'];
/** Works older than the lineage (the Buried Library's people) have their own colour, apart from every age's. */
export const ELDER_COLOR = '#8fa3b8';
/** The colour of the age that raised a work. */
export function ageColor(epoch: number): string {
  return epoch < 0 ? ELDER_COLOR : AGE_COLORS[epoch % AGE_COLORS.length]!;
}
/** A past catastrophe's reach, kept apart from the age colours (the fire's red is not the first age's amber). */
export const REACH_COLORS: Record<HazardKind, string> = {
  fire: '#ff3d2e',
  flood: '#4f6dff',
  quake: '#f4efe2',
  ash: '#8f8f8f',
};
export const ERODED_COLOR = '#d8cbb0';
