/**
 * Adaptive resolution. Frame time is averaged over short windows; when a device cannot keep its target the pixel
 * ratio steps down (cheap, immediate, and never removes geometry or forecast information), and after a long calm
 * stretch it steps back up. Pure, so the policy is unit-tested without a GPU.
 */
export interface GovernorConfig {
  /** Frame budget in ms: 1000/60 for desktops, 1000/30 for phones. */
  budgetMs: number;
  minDpr: number;
  maxDpr: number;
}

export class DprGovernor {
  dpr: number;
  private acc = 0;
  private n = 0;
  private calm = 0;

  constructor(
    private readonly cfg: GovernorConfig,
    start = cfg.maxDpr,
  ) {
    this.dpr = Math.min(cfg.maxDpr, Math.max(cfg.minDpr, start));
  }

  /**
   * Feed one frame's duration. Returns a new pixel ratio when it should change, otherwise null.
   * Frames longer than 250 ms are ignored (tab switches, shader compiles, garbage collection).
   */
  sample(dtMs: number): number | null {
    if (!(dtMs > 0) || dtMs > 250) return null;
    this.acc += dtMs;
    this.n++;
    if (this.n < 90) return null;
    const avg = this.acc / this.n;
    this.acc = 0;
    this.n = 0;
    if (avg > this.cfg.budgetMs * 1.25 && this.dpr > this.cfg.minDpr) {
      this.calm = 0;
      this.dpr = Math.max(this.cfg.minDpr, Math.round(this.dpr * 0.85 * 100) / 100);
      return this.dpr;
    }
    if (avg < this.cfg.budgetMs * 0.6) {
      this.calm++;
      if (this.calm >= 4 && this.dpr < this.cfg.maxDpr) {
        this.calm = 0;
        this.dpr = Math.min(this.cfg.maxDpr, Math.round((this.dpr + 0.1) * 100) / 100);
        return this.dpr;
      }
    } else {
      this.calm = 0;
    }
    return null;
  }
}

/** Frame-time statistics over a ring of recent frames. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
}
