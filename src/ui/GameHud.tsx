import { useEffect } from 'react';
import { BuildTray, PlacementBar, ResourceBar, TopBar } from './Hud';
import { FocusPanel, HelpPanel, Inspector, PauseOverlay, ResearchPanel, Toast } from './Panels';
import { CollapseOverlay, DebriefScreen, EndScreen, InterregnumScreen, PrepareCard } from './Screens';
import { Announcer } from './Announcer';
import { StoryChip } from './Story';
import { useStore } from './useStore';

/** Keyboard: Esc cancels/closes, Space pauses, R rotates, N next site, arrows move the ghost, 1-9 pick a building, Enter confirms. */
function useShortcuts(): void {
  const s = useStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const c = s.campaign;
      if (!c || s.screen !== 'game') return;
      // Behind the pause card only Space (resume) works; the dialog itself handles Escape and Tab.
      if (c.phase === 'ACTIVE' && c.paused) {
        if (e.key === ' ' && tag !== 'BUTTON') {
          e.preventDefault();
          s.togglePause();
        }
        return;
      }
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
      // Placement and building keys only mean something while the minute is being planned or played.
      if (c.phase !== 'PREPARE' && c.phase !== 'ACTIVE') return;
      if (e.key.toLowerCase() === 'r' && s.placing) {
        s.rotatePlacing();
        return;
      }
      if (e.key.toLowerCase() === 'n' && s.placing) {
        s.suggestNext();
        return;
      }
      if (s.placing && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (d) s.nudgePlacing(d[0]!, d[1]!);
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
      <Announcer />
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
        <StoryChip />
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
