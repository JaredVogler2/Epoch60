import { percentile } from './governor';

/** What a measurement run reports (all figures belong to the browser/GPU that produced them). */
export interface PerfStats {
  frames: number;
  fps: number;
  p50Ms: number;
  p95Ms: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  pixelRatio: number;
  heapMB: number | null;
}

const ring: number[] = [];
let info: (() => Omit<PerfStats, 'frames' | 'fps' | 'p50Ms' | 'p95Ms' | 'heapMB'>) | null = null;

export const perfApi = {
  attach(fn: NonNullable<typeof info>): void {
    info = fn;
  },
  /** Called once per rendered frame with its duration. */
  frame(dtMs: number): void {
    if (dtMs <= 0 || dtMs > 1000) return;
    ring.push(dtMs);
    if (ring.length > 300) ring.shift();
  },
  reset(): void {
    ring.length = 0;
  },
  stats(): PerfStats | null {
    if (!info || !ring.length) return null;
    const sum = ring.reduce((a, b) => a + b, 0);
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return {
      frames: ring.length,
      fps: Math.round(((1000 * ring.length) / sum) * 10) / 10,
      p50Ms: Math.round(percentile(ring, 50) * 10) / 10,
      p95Ms: Math.round(percentile(ring, 95) * 10) / 10,
      ...info(),
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
    };
  },
};
