import { useEffect, useRef, useState } from 'react';
import { BUILDINGS, EPOCH_TICKS, housingCapacity, secondsLeft } from '../engine';
import type { BuildingKind, ResourceKey } from '../engine';
import { currentSpec } from '../engine';
import { cameraApi, DEFAULT_CAMERA } from '../render/CameraRig';
import { Icon, RESOURCE_ICON, hazardIcon } from './icons';
import { ROMAN, clock, signed, units } from './format';
import { useStore } from './useStore';
import { UNIT } from '../engine';

/* ------------------------------ resource rates ------------------------------ */

/** Income per second from the engine's production counters (purchases never show up as "losses"). */
function useRates(): Record<ResourceKey, number> {
  const s = useStore();
  const c = s.campaign!;
  const last = useRef<{ tick: number; made: Record<ResourceKey, number> } | null>(null);
  const [rates, setRates] = useState<Record<ResourceKey, number>>({
    food: 0,
    timber: 0,
    stone: 0,
    knowledge: 0,
  });
  useEffect(() => {
    if (c.phase !== 'ACTIVE') {
      last.current = null;
      return;
    }
    const st = c.civ.stats;
    const now = {
      food: st.foodMade - st.foodEaten,
      timber: st.timberMade,
      stone: st.stoneMade,
      knowledge: st.knowledgeMade,
    };
    const prev = last.current;
    if (!prev || c.tick < prev.tick) {
      last.current = { tick: c.tick, made: now };
      return;
    }
    if (c.tick - prev.tick >= 15) {
      const dt = (c.tick - prev.tick) / 10;
      setRates({
        food: (now.food - prev.made.food) / UNIT / dt,
        timber: (now.timber - prev.made.timber) / UNIT / dt,
        stone: (now.stone - prev.made.stone) / UNIT / dt,
        knowledge: (now.knowledge - prev.made.knowledge) / UNIT / dt,
      });
      last.current = { tick: c.tick, made: now };
    }
  }, [s.version, c]);
  return rates;
}

export function ResourceBar() {
  const s = useStore();
  const c = s.campaign!;
  const rates = useRates();
  const cap = housingCapacity(c);
  const chip = (k: ResourceKey, label: string) => {
    const r = rates[k];
    return (
      <div className="chip" key={k} data-testid={`res-${k}`} title={label}>
        <Icon name={RESOURCE_ICON[k]} size={20} />
        <span className="chip-val">{units(c.civ.res[k])}</span>
        {c.phase === 'ACTIVE' && Math.abs(r) >= 0.05 && (
          <span className={`chip-rate ${r < 0 ? 'neg' : 'pos'}`}>{signed(r)}</span>
        )}
      </div>
    );
  };
  return (
    <div className="resbar" role="group" aria-label="Resources">
      {chip('food', 'Food')}
      {chip('timber', 'Timber')}
      {chip('stone', 'Stone')}
      {chip('knowledge', 'Knowledge')}
      <div
        className={`chip people ${c.civ.pop > cap ? 'warn' : ''}`}
        data-testid="res-people"
        title="People / homes"
      >
        <Icon name="people" size={20} />
        <span className="chip-val">{c.civ.pop}</span>
        <span className="chip-cap">/{cap}</span>
      </div>
    </div>
  );
}

/* ------------------------------ top bar ------------------------------ */

export function TopBar() {
  const s = useStore();
  const c = s.campaign!;
  const spec = currentSpec(c);
  const left = secondsLeft(c);
  const active = c.phase === 'ACTIVE';
  const urgency = active ? (left <= 5 ? 'crit' : left <= 15 ? 'warn' : left <= 25 ? 'watch' : '') : '';
  const frac = active || c.phase === 'COLLAPSING' ? c.tick / EPOCH_TICKS : 0;
  const lastWarn = [...c.events].reverse().find((e) => e.code.startsWith('forecast.'));
  const f = s.getForecastCached();
  return (
    <header className="topbar">
      <div className="top-left">
        <button
          type="button"
          className="btn-icon"
          aria-label={c.paused ? 'Resume' : 'Pause'}
          data-testid="pause"
          disabled={!active}
          onClick={() => s.togglePause()}
        >
          <Icon name={c.paused ? 'play' : 'pause'} />
        </button>
        <div className="epoch-chip" data-testid="epoch-chip">
          <span className="roman">{ROMAN[c.epoch]}</span>
          <span className="epoch-names">
            <b>{spec.name}</b>
            <small>{spec.ageName}</small>
          </span>
        </div>
      </div>
      <div className={`timer ${urgency}`} data-testid="timer" aria-live="off">
        <div className="timer-digits" data-testid="timer-digits">
          {c.phase === 'PREPARE' ? '60.0' : clock(left)}
          <span className="timer-unit">s</span>
        </div>
        <div className="timer-bar">
          <i style={{ width: `${(1 - frac) * 100}%` }} />
        </div>
        <div className="timer-hazard">
          <Icon name={hazardIcon(spec.hazard.kind)} size={16} />
          <span className="hz-name">{spec.hazard.name}</span>
          {f && f.atRisk > 0 && (
            <span className="risk" data-testid="risk-count">
              <span className="hz-sep">· </span>
              {f.atRisk} at risk
            </span>
          )}
        </div>
      </div>
      <div className="top-right">
        <button
          type="button"
          className={`btn-icon ${s.showForecast ? 'on' : ''}`}
          aria-label="Toggle hazard forecast overlay"
          aria-pressed={s.showForecast}
          data-testid="toggle-forecast"
          onClick={() => s.toggleForecast()}
        >
          <Icon name="layers" />
        </button>
        <button
          type="button"
          className="btn-icon"
          aria-label="Reset camera"
          onClick={() => {
            const h = c.world.anchors.hearth;
            cameraApi.set({ ...DEFAULT_CAMERA, x: h.x, z: h.y });
          }}
        >
          <Icon name="home" />
        </button>
        <button
          type="button"
          className={`btn-icon ${s.settings.sound ? '' : 'off'}`}
          aria-label={s.settings.sound ? 'Mute sound' : 'Unmute sound'}
          aria-pressed={!s.settings.sound}
          data-testid="toggle-sound"
          onClick={() => s.updateSettings({ sound: !s.settings.sound })}
        >
          <Icon name={s.settings.sound ? 'speaker' : 'speakerOff'} />
        </button>
        <button type="button" className="btn-icon" aria-label="Help" onClick={() => s.togglePanel('help')}>
          <Icon name="help" />
        </button>
      </div>
      {active && lastWarn && c.forecastLevel > 0 && (
        <div className={`warning level-${c.forecastLevel}`} role="alert" data-testid="warning">
          <Icon name={hazardIcon(spec.hazard.kind)} size={22} />
          <span>{lastWarn.msg}</span>
        </div>
      )}
    </header>
  );
}

/* ------------------------------ build tray ------------------------------ */

export function BuildTray() {
  const s = useStore();
  const c = s.campaign!;
  const cat = s.catalog();
  const planning = c.phase === 'PREPARE';
  const researching = c.civ.research;
  return (
    <nav className="tray" aria-label="Build" data-testid="tray">
      <div className="tray-scroll">
        {cat.map((e) => {
          const sel = s.placing?.kind === e.kind;
          const cost = (Object.keys(e.cost) as ResourceKey[]).filter((k) => e.cost[k] > 0);
          return (
            <button
              key={e.kind}
              type="button"
              className={`card ${sel ? 'selected' : ''} ${e.blocked ? 'blocked' : ''}`}
              aria-pressed={sel}
              data-testid={`card-${e.kind}`}
              aria-disabled={!!e.blocked}
              aria-label={`${e.name}${e.blocked ? ` — ${e.blocked.message}` : ''}`}
              title={e.blocked ? e.blocked.message : e.blurb}
              onClick={() => {
                if (e.blocked) {
                  s.showToast(`${e.name}: ${e.blocked.message}`, 'warn');
                  return;
                }
                if (sel) s.cancelPlacing();
                else s.startPlacing(e.kind);
              }}
            >
              <Icon name={e.kind} size={30} />
              <span className="card-name">{e.name}</span>
              <span className="card-cost">
                {cost.map((k) => (
                  <span key={k} className={`cost ${c.civ.res[k] < e.cost[k] ? 'short' : ''}`}>
                    <Icon name={RESOURCE_ICON[k]} size={12} />
                    {Math.round(e.cost[k] / UNIT)}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className={`card tool ${s.panel === 'research' ? 'selected' : ''}`}
          aria-pressed={s.panel === 'research'}
          data-testid="card-research"
          onClick={() => {
            s.cancelPlacing();
            s.togglePanel('research');
          }}
        >
          <Icon name="knowledge" size={30} />
          <span className="card-name">Research</span>
          <span className="card-cost">
            {researching ? (
              <span className="cost">…</span>
            ) : (
              <span className="cost">{units(c.civ.res.knowledge)} K</span>
            )}
          </span>
        </button>
        <button
          type="button"
          className={`card tool ${s.panel === 'focus' ? 'selected' : ''}`}
          data-testid="card-focus"
          onClick={() => {
            s.cancelPlacing();
            s.togglePanel('focus');
          }}
        >
          <Icon name="people" size={30} />
          <span className="card-name">Workers</span>
          <span className="card-cost">
            <span className="cost">{c.civ.focus}</span>
          </span>
        </button>
      </div>
      {planning && (
        <div className="tray-note">Planning: up to 3 opening orders, paid when the epoch begins.</div>
      )}
    </nav>
  );
}

export function PlacementBar() {
  const s = useStore();
  const p = s.placing;
  if (!p) return null;
  const def = BUILDINGS[p.kind as BuildingKind];
  const g = s.ghost;
  const ok = !!g && g.ok;
  const sg = s.suggest && s.suggest.kind === p.kind && s.suggest.i >= 0 ? s.suggest : null;
  const where = sg ? ` (site ${sg.i + 1} of ${sg.spots.length})` : '';
  const msg = !g
    ? 'Tap the valley to choose a site, or press Next site.'
    : g.ok
      ? `Ready — ${g.info.notes.join(' · ') || 'good ground'}${where}`
      : `${g.error.message}${where}`;
  const touch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  return (
    <div
      className={`placebar ${ok ? 'ok' : g ? 'bad' : ''}`}
      data-testid="placebar"
      role="group"
      aria-label="Placement"
    >
      <div className="place-info">
        <Icon name={p.kind} size={26} />
        <div>
          <b>{def.name}</b>
          <div className="place-msg" data-testid="place-msg" aria-live="polite">
            {msg}
          </div>
        </div>
      </div>
      <div className="place-actions">
        <button type="button" className="btn" data-testid="next-spot" onClick={() => s.suggestNext()}>
          <Icon name="next" size={20} /> Next site{!touch && <span className="kbd-hint"> (N)</span>}
        </button>
        {def.rotatable && (
          <button type="button" className="btn" data-testid="rotate" onClick={() => s.rotatePlacing()}>
            <Icon name="rotate" size={20} /> Rotate
          </button>
        )}
        <button
          type="button"
          className="btn ghost"
          data-testid="cancel-place"
          onClick={() => s.cancelPlacing()}
        >
          <Icon name="close" size={20} /> Cancel{!touch && <span className="kbd-hint"> (Esc)</span>}
        </button>
        <button
          type="button"
          className="btn primary"
          data-testid="confirm-place"
          disabled={!ok}
          onClick={() => s.confirmPlacing()}
        >
          <Icon name="check" size={20} /> Build
        </button>
      </div>
    </div>
  );
}
