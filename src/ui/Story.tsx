import { useEffect, useRef } from 'react';
import { UNIT } from '../engine';
import type { ResourceKey, StoryOption } from '../engine';
import { Icon, RESOURCE_ICON } from './icons';
import { useStore } from './useStore';

function Price({ cost }: { cost: StoryOption['cost'] }) {
  const keys = (Object.keys(cost ?? {}) as ResourceKey[]).filter((k) => (cost?.[k] ?? 0) > 0);
  if (!keys.length) return <span className="story-free">free</span>;
  return (
    <span className="costline">
      {keys.map((k) => (
        <span key={k} className="cost">
          <Icon name={RESOURCE_ICON[k]} size={14} />
          {cost?.[k]}
        </span>
      ))}
    </span>
  );
}

/**
 * One compact decision at a time, docked above the build tray. It never pauses play and never blocks the map:
 * when its countdown ends the free default is applied.
 */
export function StoryChip() {
  const s = useStore();
  const c = s.campaign!;
  const seen = useRef(0);
  const open = c.phase === 'ACTIVE' ? c.prompts.find((p) => p.status === 'open') : undefined;

  // Tell the player what their answer did, once.
  const last = [...c.prompts].reverse().find((p) => p.status === 'resolved' && p.outcome);
  useEffect(() => {
    if (!last || last.seq <= seen.current) return;
    seen.current = last.seq;
    if (last.chosen !== last.defaultOption || !last.auto) s.showToast(last.outcome ?? '', 'good');
  }, [last, s]);
  useEffect(() => {
    if (c.phase === 'PREPARE') seen.current = 0;
  }, [c.phase]);

  if (!open) return null;
  const secs = Math.max(0, Math.ceil((open.deadlineTick - c.tick) / 10));
  const frac = Math.max(0, Math.min(1, (open.deadlineTick - c.tick) / (open.deadlineTick - open.openedTick)));
  return (
    <section
      className="story"
      data-testid="story-chip"
      data-story={open.story}
      aria-live="polite"
      aria-label={`Decision: ${open.title}`}
    >
      <header>
        <b>{open.title}</b>
        <span className="story-timer" data-testid="story-timer">
          {secs}s
        </span>
      </header>
      <div className="story-bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${frac})` }} />
      </div>
      <p>{open.body}</p>
      <div className="story-options">
        {open.options.map((o) => {
          const poor = (Object.keys(o.cost ?? {}) as ResourceKey[]).some(
            (k) => c.civ.res[k] < (o.cost?.[k] ?? 0) * UNIT,
          );
          return (
            <button
              key={o.id}
              type="button"
              className={`story-option ${o.id === open.defaultOption ? 'is-default' : ''}`}
              data-testid={`story-option-${o.id}`}
              aria-disabled={poor}
              title={o.detail}
              onClick={() => {
                if (poor) {
                  s.showToast(`${o.label}: not enough resources`, 'warn');
                  return;
                }
                s.dispatch({ type: 'choose', prompt: open.seq, option: o.id });
              }}
            >
              <span className="story-label">
                {o.label}
                <Price cost={o.cost} />
              </span>
              <small>{o.detail}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
