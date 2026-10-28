import { useState } from 'react';
import type { CSSProperties } from 'react';

/**
 * The valley from one viewpoint as an age's minute ended and afterwards, laid over each other: drag to compare. The
 * pictures exist only when this session saw both moments (a game resumed from a save has none), so callers show
 * this only when both are there.
 */
export function ThenNow({
  then,
  after,
  thenLabel,
  afterLabel,
}: {
  then: string;
  after: string;
  thenLabel: string;
  afterLabel: string;
}) {
  const [split, setSplit] = useState(50);
  return (
    <figure className="then-now" data-testid="then-now">
      <div className="then-now-frame" style={{ '--split': `${split}%` } as CSSProperties}>
        <img src={after} alt={afterLabel} draggable={false} data-testid="then-now-after" />
        <img src={then} alt={thenLabel} className="then" draggable={false} data-testid="then-now-then" />
        <span className="then-now-line" aria-hidden="true" />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={split}
        aria-label={`Compare ${thenLabel.toLowerCase()} (left) with ${afterLabel.toLowerCase()} (right)`}
        data-testid="then-now-slider"
        onChange={(e) => setSplit(Number(e.target.value))}
      />
      <figcaption>
        <span>{thenLabel}</span>
        <span>{afterLabel}</span>
      </figcaption>
    </figure>
  );
}
