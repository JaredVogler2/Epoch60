import { computeHash, dispatchAction, runTicks } from './engine';
import { findSpot } from './engine/ai/spots';
import { store } from './game/store';
import { cameraApi } from './render/CameraRig';
import { citizensApi } from './render/Citizens';
import { omensApi } from './render/Omens';
import { perfApi } from './render/perf';
import { presentation } from './render/presentation';

/** Test/debug hooks: enabled in dev builds and when the URL contains ?debug. Never used by gameplay. */
export function installDebug(): void {
  const enabled = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
  if (!enabled) return;
  (window as unknown as { __epoch: unknown }).__epoch = {
    store,
    camera: cameraApi,
    presentation,
    runTicks,
    findSpot,
    dispatchAction,
    /** Frame-time and draw-call statistics of the live scene (see scripts/perf-probe.mjs). */
    perf: { reset: () => perfApi.reset(), stats: () => perfApi.stats() },
    /** The villagers drawn this frame: position, job and whether they are walking. */
    citizens: () => citizensApi.list(),
    /** Captures only: everyone stands where they were walking to on the next frame (see `citizensApi.settle`). */
    settleCitizens: () => citizensApi.settle(),
    /** The coming catastrophe's omens drawn this frame: its kind, how strong (0..1) and which effects. */
    omens: () => omensApi.state(),
    /** Integrity hash of the live campaign, for comparing a browser run with a recorded transcript. */
    hash: () => (store.campaign ? computeHash(store.campaign) : null),
    /**
     * Run `n` ticks instantly (tests only) and refresh the UI exactly as the real clock would. The frame that
     * straddles this synchronous jump is ignored by the clock, like a begin or resume, so it never reads as a stall;
     * so are the next few, because the redraw the jump causes can itself take seconds under software GL (K-011).
     */
    fastForward: (n: number) => {
      const c = store.campaign;
      if (!c) return 0;
      const ran = runTicks(c, n);
      store.clockResetSeq++;
      store.notifyTicks(ran);
      let frames = 3;
      const forgive = () => {
        store.clockResetSeq++;
        if (--frames > 0) requestAnimationFrame(forgive);
      };
      requestAnimationFrame(forgive);
      return ran;
    },
  };
}
