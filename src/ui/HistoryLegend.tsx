import { useEffect, useMemo, useRef } from 'react';
import { ROMAN } from './format';
import { ELDER_COLOR, ERODED_COLOR, REACH_COLORS, ageColor, historyLayers } from '../render/history';
import { useStore } from './useStore';

/**
 * What the history lens on the map is showing: each age's buildings and ruins, where each catastrophe reached, and the
 * worn ground. With `reveal`, it scrolls itself into view as it appears (the briefing card scrolls, and the legend opens
 * below its fold).
 */
export function HistoryLegend({ reveal = false }: { reveal?: boolean }) {
  const s = useStore();
  const c = s.campaign!;
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (reveal) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [reveal]);
  // Rebuilt only when the structures, the world or the age change (the store emits far more often than that).
  const h = useMemo(
    () => historyLayers(c),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c, s.structRev, s.worldRev, c.epoch],
  );
  const elders = h.sites.filter((x) => x.epoch < 0);
  const elderRuins = elders.filter((x) => x.ruin).length;
  return (
    <ul ref={ref} className="history-legend" data-testid="history-legend" aria-label="History on the map">
      {elders.length > 0 && (
        <li data-testid="history-age-elder">
          <i className="swatch" style={{ background: ELDER_COLOR }} aria-hidden="true" />
          Before the founders: {elders.length - elderRuins} standing, {elderRuins}{' '}
          {elderRuins === 1 ? 'ruin' : 'ruins'}
        </li>
      )}
      {h.ages.map((name, e) => {
        const mine = h.sites.filter((x) => x.epoch === e);
        const ruins = mine.filter((x) => x.ruin).length;
        return (
          <li key={e} data-testid={`history-age-${e}`}>
            <i className="swatch" style={{ background: ageColor(e) }} aria-hidden="true" />
            <b>{ROMAN[e]}</b> {name}: {mine.length - ruins} standing, {ruins} {ruins === 1 ? 'ruin' : 'ruins'}
          </li>
        );
      })}
      {h.reach.map((r) => (
        <li key={`reach-${r.epoch}`} data-testid={`history-reach-${r.epoch}`}>
          <i className="swatch ground" style={{ borderColor: REACH_COLORS[r.kind] }} aria-hidden="true" />
          {r.name} (age {ROMAN[r.epoch]}) reached {r.cells.length} cell{r.cells.length === 1 ? '' : 's'}
        </li>
      ))}
      {h.eroded.length > 0 && (
        <li data-testid="history-eroded">
          <i className="swatch ground" style={{ borderColor: ERODED_COLOR }} aria-hidden="true" />
          {h.eroded.length} cell{h.eroded.length === 1 ? '' : 's'} of eroded ground (quarries, felling,
          floods)
        </li>
      )}
    </ul>
  );
}
