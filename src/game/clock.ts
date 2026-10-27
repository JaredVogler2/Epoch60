import { advanceFixedTick } from '../engine';
import type { GameStore } from './store';

/** One simulation tick is 100 ms of *active, foreground* play. */
export const TICK_MS = 100;
/**
 * A frame gap above this is a true stall (phone call, throttled tab, debugger): pause with an explanation.
 * Shorter hitches (shader compiles, GC) just cost wall time — the simulation never fast-forwards to repay it.
 */
export const STALL_MS = 2500;
/** Never run more than this many ticks in a single frame; excess wall time is dropped, not owed. */
export const MAX_TICKS_PER_FRAME = 6;
/** Assisted mode runs the same 600 ticks at half speed. */
export const ASSISTED_SPEED = 0.5;

/**
 * Bridges wall-clock frames to deterministic ticks. It owns *no* game time: the tick counter lives in the
 * campaign. Rendering frame rate can only change how many frames it takes to run a tick, never the outcome.
 */
export class EpochClock {
  private acc = 0;
  private seen = 0;

  constructor(private readonly store: GameStore) {}

  reset(): void {
    this.acc = 0;
  }

  /** Advance by a wall-clock frame delta. Returns the number of ticks run. */
  step(dtMs: number): number {
    const c = this.store.campaign;
    if (this.seen !== this.store.clockResetSeq) {
      // Begin / resume / new game: ignore the frame that straddles the transition (it may include a hitch).
      this.seen = this.store.clockResetSeq;
      this.acc = 0;
      return 0;
    }
    if (!c || c.phase !== 'ACTIVE' || c.paused) {
      this.acc = 0;
      return 0;
    }
    if (!Number.isFinite(dtMs) || dtMs < 0) dtMs = 0;
    if (dtMs > STALL_MS) {
      this.acc = 0;
      this.store.pause('stalled');
      return 0;
    }
    this.acc += dtMs * (c.mode === 'assisted' ? ASSISTED_SPEED : 1);
    let n = 0;
    while (this.acc >= TICK_MS && n < MAX_TICKS_PER_FRAME) {
      this.acc -= TICK_MS;
      if (!advanceFixedTick(c)) break;
      n++;
      if (c.phase !== 'ACTIVE') break;
    }
    if (this.acc > TICK_MS) this.acc = TICK_MS; // bounded: never owe more than one tick
    if (n > 0) this.store.notifyTicks(n);
    return n;
  }
}

/** Wire an EpochClock to requestAnimationFrame and page visibility. Returns a disposer. */
export function attachClock(store: GameStore, clock: EpochClock): () => void {
  let raf = 0;
  let last: number | null = null;
  const frame = (t: number) => {
    if (last !== null) clock.step(t - last);
    last = t;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const onVisibility = () => {
    if (document.hidden) store.pause('hidden');
    last = null;
    clock.reset();
  };
  const onPageHide = () => store.pause('hidden');
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('blur', onVisibility);
  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('blur', onVisibility);
  };
}
