import type { TerrainModel } from './terrain';

/** The currently built terrain, shared with components that must sit on it. */
export const worldModel: { terrain: TerrainModel | null } = { terrain: null };

export function groundY(x: number, z: number): number {
  return worldModel.terrain ? worldModel.terrain.heightAt(x, z) : 0;
}
