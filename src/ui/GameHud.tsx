import { useEffect } from 'react';
import { BuildTray, PlacementBar, ResourceBar, TopBar } from './Hud';
import { FocusPanel, HelpPanel, Inspector, PauseOverlay, ResearchPanel, Toast } from './Panels';
import { CollapseOverlay, DebriefScreen, EndScreen, InterregnumScreen, PrepareCard } from './Screens';
import { useStore } from './useStore';

/** Keyboard: Esc cancels/closes, Space pauses, R rotates, 1-9 pick a building, Enter confirms placement. */
function useShortcuts(): void {
  const s = useStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const c = s.campaign;
      if (!c || s.screen !== 'game') return;
      if (e.key === 'Escape') {
        if (s.placing) s.cancelPlacing();
        else if (s.panel) s.closePanel();
        else if (s.selectedId !== null) s.select(null);
        s.clearToast();
        return;
      }
      if (e.key === ' ' && (e.target as HTMLElement | null)?.tagName !== 'BUTTON') {
        e.preventDefault();
        s.togglePause();
        return;
      }
      if (e.key.toLowerCase() === 'r' && s.placing) {
        s.rotatePlacing();
        return;
      }
      if (e.key === 'Enter' && s.placing && s.ghost?.ok) {
        s.confirmPlacing();
        return;
      }
      if (/^[1-9]$/.test(e.key) && (c.phase === 'PREPARE' || c.phase === 'ACTIVE')) {
        const entry = s.catalog()[Number(e.key) - 1];
        if (entry && !entry.blocked) s.startPlacing(entry.kind);
        else if (entry?.blocked) s.showToast(`${entry.name}: ${entry.blocked.message}`, 'warn');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s]);
}

export function GameHud() {
  const s = useStore();
  useShortcuts();
  const c = s.campaign!;
  const timed = c.phase === 'PREPARE' || c.phase === 'ACTIVE';
  const showTray = timed && !s.placing;
  return (
    <div className="hud" data-testid="hud" data-phase={c.phase}>
      <TopBar />
      <ResourceBar />
      <div className="side-panels">
        <ResearchPanel />
        <FocusPanel />
        <HelpPanel />
      </div>
      <Inspector />
      <div className="bottom-dock">
        <Toast />
        <PrepareCard />
        {s.placing && <PlacementBar />}
        {showTray && <BuildTray />}
      </div>
      <CollapseOverlay />
      <DebriefScreen />
      <InterregnumScreen />
      <EndScreen />
      <PauseOverlay />
    </div>
  );
}
