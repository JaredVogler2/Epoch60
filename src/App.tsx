import { useEffect, useState } from 'react';
import { attachClock, EpochClock } from './game/clock';
import { store } from './game/store';
import { GameCanvas } from './render/Scene';
import { GameHud } from './ui/GameHud';
import { TitleScreen } from './ui/Title';
import { useStore } from './ui/useStore';

export function App() {
  // The title screen shows a real, paused village built by the engine, so the 3D scene is always mounted.
  useState(() => {
    if (!store.campaign) store.initDemo();
    return true;
  });
  const s = useStore();
  useEffect(() => {
    const clock = new EpochClock(store);
    return attachClock(store, clock);
  }, []);
  return (
    <div className="game-root" data-screen={s.screen}>
      <GameCanvas />
      {s.screen === 'title' ? <TitleScreen /> : <GameHud />}
    </div>
  );
}
