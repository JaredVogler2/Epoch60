import { useState } from 'react';
import { hasSave } from '../game/persist';
import { SCENARIOS, getScenario } from '../engine';
import { Icon } from './icons';
import { useStore } from './useStore';

export function TitleScreen() {
  const s = useStore();
  const [view, setView] = useState<'main' | 'help' | 'settings'>('main');
  const canContinue = hasSave();
  const [scenarioId, setScenarioId] = useState('greenvale');
  const scenario = getScenario(scenarioId);
  return (
    <div className="title-layer" data-testid="title">
      <div className="title-card">
        <h1 className="logo">EPOCH</h1>
        <p className="tagline">The 60-Second Civilization</p>
        <p className="promise">{scenario.tagline}</p>
        {view === 'main' && (
          <div className="title-actions">
            <div className="scenario-pick" role="radiogroup" aria-label="Scenario">
              {Object.values(SCENARIOS).map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  role="radio"
                  aria-checked={sc.id === scenarioId}
                  className={`scenario ${sc.id === scenarioId ? 'on' : ''}`}
                  data-testid={`scenario-${sc.id}`}
                  onClick={() => setScenarioId(sc.id)}
                >
                  <b>{sc.name}</b>
                  <small>{sc.epochs.map((e) => e.hazard.name.toLowerCase()).join(' · ')}</small>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn primary big"
              data-testid="new-game"
              onClick={() => s.newGame(undefined, undefined, scenarioId)}
            >
              <Icon name="play" size={22} /> New Lineage
            </button>
            <button
              type="button"
              className="btn big"
              data-testid="continue"
              disabled={!canContinue}
              onClick={() => s.continueGame()}
            >
              Continue
            </button>
            <div className="title-row">
              <button
                type="button"
                className="btn ghost"
                data-testid="how-to"
                onClick={() => setView('help')}
              >
                <Icon name="help" size={18} /> How to play
              </button>
              <button
                type="button"
                className="btn ghost"
                data-testid="settings"
                onClick={() => setView('settings')}
              >
                Settings
              </button>
            </div>
          </div>
        )}
        {view === 'help' && (
          <div className="title-sub" data-testid="title-help">
            <ol className="howto">
              <li>
                You have <b>60 active seconds</b> to build a civilization — the clock stops whenever you leave
                or pause.
              </li>
              <li>
                The striped overlay is the exact path of the coming disaster. Build around it, block it, or
                reinforce.
              </li>
              <li>
                When time ends the world collapses, but ruins, scars and knowledge <b>stay</b> for the next
                people.
              </li>
              <li>
                Three ages, one valley. Break the cycle: keep people alive, a landmark standing, and knowledge
                remembered.
              </li>
            </ol>
            <button type="button" className="btn" onClick={() => setView('main')}>
              Back
            </button>
          </div>
        )}
        {view === 'settings' && (
          <div className="title-sub" data-testid="title-settings">
            <label className="toggle">
              <input
                type="checkbox"
                checked={s.settings.assisted}
                onChange={(e) => s.updateSettings({ assisted: e.target.checked })}
              />
              <span>
                <b>Assisted mode</b>
                <small>The same 60 simulated seconds at half speed. Scored separately.</small>
              </span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={s.settings.reducedMotion}
                onChange={(e) => s.updateSettings({ reducedMotion: e.target.checked })}
              />
              <span>
                <b>Reduced motion</b>
                <small>Skips cinematic camera moves and screen shake.</small>
              </span>
            </label>
            <label className="select">
              <b>Graphics quality</b>
              <select
                value={s.settings.quality}
                onChange={(e) =>
                  s.updateSettings({ quality: e.target.value as 'auto' | 'high' | 'medium' | 'low' })
                }
              >
                <option value="auto">Auto</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <p className="dim small">Quality changes apply on the next launch.</p>
            <button type="button" className="btn" onClick={() => setView('main')}>
              Back
            </button>
          </div>
        )}
      </div>
      <p className="footnote">No accounts. Saves stay in this browser.</p>
    </div>
  );
}
