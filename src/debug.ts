import { dispatchAction, runTicks } from './engine';
import { findSpot } from './engine/ai/spots';
import { store } from './game/store';
import { cameraApi } from './render/CameraRig';

/** Test/debug hooks: enabled in dev builds and when the URL contains ?debug. Never used by gameplay. */
export function installDebug(): void {
  const enabled = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
  if (!enabled) return;
  (window as unknown as { __epoch: unknown }).__epoch = {
    store,
    camera: cameraApi,
    runTicks,
    findSpot,
    dispatchAction,
    /** Run `n` ticks instantly (tests only) and refresh the UI exactly as the real clock would. */
    fastForward: (n: number) => {
      const c = store.campaign;
      if (!c) return 0;
      const ran = runTicks(c, n);
      store.notifyTicks(ran);
      return ran;
    },
  };
}
