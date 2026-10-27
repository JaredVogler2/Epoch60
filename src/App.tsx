import { useSyncExternalStore } from 'react';
import { hasSave } from './game/persist';
import { store } from './game/store';

/** Subscribe a component to the store; re-renders whenever the version bumps. */
export function useStore(): typeof store {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}

export function App() {
  const s = useStore();
  const canContinue = hasSave();
  return (
    <main className="title">
      <h1>EPOCH</h1>
      <p className="tagline">The 60-Second Civilization</p>
      <p className="promise">Three ages. One landscape. Every choice survives.</p>
      <div className="title-actions">
        <button type="button" onClick={() => s.newGame()}>
          New Lineage
        </button>
        <button type="button" disabled={!canContinue} onClick={() => s.continueGame()}>
          Continue
        </button>
      </div>
      {s.screen === 'game' && s.campaign && (
        <p className="status" data-testid="engine-status">
          Engine running: epoch {s.campaign.epoch + 1}, phase {s.campaign.phase}. The 3D world is being built
          (phase 03).
        </p>
      )}
    </main>
  );
}
