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
  /** Consecutive windows still over budget at the minimum pixel ratio: the cue to shed optional effects. */
  strained = 0;
  private acc = 0;
  private n = 0;
  private calm = 0;
  private slow = 0;

  constructor(
    private readonly cfg: GovernorConfig,
    start = cfg.maxDpr,
  ) {
    this.dpr = Math.min(cfg.maxDpr, Math.max(cfg.minDpr, start));
  }

  /**
   * Feed one frame's duration. Returns a new pixel ratio when it should change, otherwise null.
   * A lone frame longer than 250 ms is a hitch (tab switch, shader compile, garbage collection) and is ignored; a run
   * of them is a device that cannot draw the scene at this resolution at all, and counts as a window over budget.
   */
  sample(dtMs: number): number | null {
    if (!(dtMs > 0)) return null;
    if (dtMs > 250) {
      if (++this.slow < SLOW_RUN) return null;
      this.slow = 0;
      this.acc = 0;
      this.n = 0;
      return this.overBudget();
    }
    this.slow = 0;
    this.acc += dtMs;
    this.n++;
    if (this.n < 90) return null;
    const avg = this.acc / this.n;
    this.acc = 0;
    this.n = 0;
    if (avg > this.cfg.budgetMs * 1.25) return this.overBudget();
    this.strained = 0;
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

  private overBudget(): number | null {
    this.calm = 0;
    if (this.dpr > this.cfg.minDpr) {
      this.strained = 0;
      this.dpr = Math.max(this.cfg.minDpr, Math.round(this.dpr * 0.85 * 100) / 100);
      return this.dpr;
    }
    this.strained++;
    return null;
  }
}

/** Consecutive over-250 ms frames that mean "too slow", not "a hitch". */
export const SLOW_RUN = 8;

/**
 * What to give up while the governor stays strained at its lowest pixel ratio, one step per two strained windows:
 * 1 = the post chain, 2 = the birds and the valley beyond the board. Never geometry the player needs, never information.
 */
export const MAX_SHED = 2;

/** Frame-time statistics over a ring of recent frames. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
}
