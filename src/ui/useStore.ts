import { useSyncExternalStore } from 'react';
import { store } from '../game/store';

/** Subscribe a component to the store; re-renders whenever the version bumps. */
export function useStore(): typeof store {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}
