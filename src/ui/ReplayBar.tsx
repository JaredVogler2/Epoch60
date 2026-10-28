import { ROMAN } from './format';
import { useStore } from './useStore';
import type { Replay } from '../game/store';

const PHASE: Record<string, string> = {
  PREPARE: 'planning',
  ACTIVE: 'the minute',
  COLLAPSE_PENDING: 'the catastrophe',
  COLLAPSING: 'the catastrophe',
  DEBRIEF: 'the debrief',
  INTERREGNUM: 'between ages',
  VICTORY: 'the victory',
};
const SPEEDS: Replay['speed'][] = [1, 2, 4];

/** While a finished lineage is watched again: where the replay is, its speed, and the way out. */
export function ReplayBar() {
  const s = useStore();
  const r = s.replay;
  const c = s.campaign;
  if (!r || !c || r.matched !== null) return null;
  return (
    <div className="replay-bar" role="group" aria-label="Replay" data-testid="replay-bar">
      <span className="replay-where">
        <b>Watching the lineage again</b>
        <small>
          Age {ROMAN[c.epoch]} · {PHASE[c.phase] ?? ''} · action {r.next} of {r.actions.length}
        </small>
      </span>
      <span className="replay-speeds" role="radiogroup" aria-label="Replay speed">
        {SPEEDS.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={r.speed === v}
            className={`diff ${r.speed === v ? 'on' : ''}`}
            data-testid={`replay-speed-${v}`}
            onClick={() => s.setReplaySpeed(v)}
          >
            {v}×
          </button>
        ))}
      </span>
      {c.phase === 'ACTIVE' && (
        <button type="button" className="btn" data-testid="replay-pause" onClick={() => s.togglePause()}>
          {c.paused ? 'Resume' : 'Pause'}
        </button>
      )}
      <button type="button" className="btn" data-testid="replay-stop" onClick={() => s.stopReplay()}>
        Stop
      </button>
    </div>
  );
}
