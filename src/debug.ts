import { computeHash, dispatchAction, runTicks } from './engine';
import { findSpot } from './engine/ai/spots';
import { store } from './game/store';
import { cameraApi } from './render/CameraRig';
import { citizensApi } from './render/Citizens';
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
    /** Integrity hash of the live campaign, for comparing a browser run with a recorded transcript. */
    hash: () => (store.campaign ? computeHash(store.campaign) : null),
    /**
     * Run `n` ticks instantly (tests only) and refresh the UI exactly as the real clock would. The frame that
     * straddles this synchronous jump is ignored by the clock, like a begin or resume, so it never reads as a stall.
     */
    fastForward: (n: number) => {
      const c = store.campaign;
      if (!c) return 0;
      const ran = runTicks(c, n);
      store.clockResetSeq++;
      store.notifyTicks(ran);
      return ran;
    },
  };
}
