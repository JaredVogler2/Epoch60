import { getScenario } from '../engine';
import { useStore } from './useStore';

/**
 * A polite screen-reader live region. The message is a pure function of the game state, so it changes only at
 * meaningful moments (a new age, 30 s and 10 s left, each forecast warning, the collapse, the verdict) and never every tick.
 */
export function Announcer() {
  const s = useStore();
  const c = s.campaign;
  if (!c || s.screen !== 'game') return null;
  const spec = getScenario(c.scenario).epochs[c.epoch];
  let text = '';
  switch (c.phase) {
    case 'PREPARE':
      text = `${spec?.name ?? 'A new age'}, ${spec?.ageName ?? ''}. ${spec?.brief ?? ''} Plan up to three orders, then begin.`;
      break;
    case 'ACTIVE': {
      const left = Math.ceil((600 - c.tick) / 10);
      if (c.paused) text = 'Paused.';
      else if (c.forecastLevel > 0) text = spec?.hazard.warnings[c.forecastLevel - 1] ?? '';
      else if (left <= 10) text = '10 seconds left.';
      else if (left <= 30) text = '30 seconds left.';
      else text = `${spec?.name ?? 'Epoch'} is under way.`;
      break;
    }
    case 'COLLAPSING':
    case 'COLLAPSE_PENDING':
      text = c.report ? c.report.headline : 'The catastrophe is here.';
      break;
    case 'DEBRIEF':
      text = c.report
        ? `${c.report.survivors} survived and ${c.report.structuresLost} buildings were lost. ${c.report.causes[0] ?? ''}`
        : '';
      break;
    case 'INTERREGNUM':
      text = 'Between ages. Choose what to uncover, where to found the next village, and a tradition.';
      break;
    case 'VICTORY':
    case 'DEFEAT':
      text = c.report?.verdict ? `${c.report.verdict.title}. ${c.report.verdict.reason}` : '';
      break;
  }
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="announcer">
      {text}
    </div>
  );
}
