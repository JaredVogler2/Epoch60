import { useEffect, useRef } from 'react';
import { ROMAN } from './format';
import { AGE_COLORS, ERODED_COLOR, REACH_COLORS, historyLayers } from '../render/history';
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
  const h = historyLayers(c);
  return (
    <ul ref={ref} className="history-legend" data-testid="history-legend" aria-label="History on the map">
      {h.ages.map((name, e) => {
        const mine = h.sites.filter((x) => x.epoch === e);
        const ruins = mine.filter((x) => x.ruin).length;
        return (
          <li key={e} data-testid={`history-age-${e}`}>
            <i
              className="swatch"
              style={{ background: AGE_COLORS[e % AGE_COLORS.length] }}
              aria-hidden="true"
            />
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
