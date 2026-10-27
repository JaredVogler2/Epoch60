import { useState } from 'react';
import { hasSave } from '../game/persist';
import { bestFor, dailyRun, parseShare, seedFromText, utcDate } from '../game/modes';
import { DIFFICULTY, SCENARIOS, getScenario } from '../engine';
import type { Difficulty } from '../engine';
import { Icon } from './icons';
import { useStore } from './useStore';

export function TitleScreen() {
  const s = useStore();
  const [view, setView] = useState<'main' | 'help' | 'settings'>('main');
  const canContinue = hasSave();
  const [scenarioId, setScenarioId] = useState(() =>
    typeof location === 'undefined' ? 'greenvale' : (parseShare(location.search).scenario ?? 'greenvale'),
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(() =>
    typeof location === 'undefined' ? 'normal' : (parseShare(location.search).difficulty ?? 'normal'),
  );
  // A shared link (?seed=…&scenario=…&difficulty=…) pre-selects exactly that valley.
  const [shared] = useState(() => (typeof location === 'undefined' ? {} : parseShare(location.search)));
  const [seedText, setSeedText] = useState(shared.seed ? String(shared.seed) : '');
  const daily = dailyRun(utcDate(new Date()));
  const typed = seedFromText(seedText);
  const spec = { seed: typed ?? 6001, scenario: scenarioId, difficulty };
  const best = typed ? bestFor(s.runs, spec) : null;
  const scenario = getScenario(scenarioId);
  const dailyBest = bestFor(s.runs, daily);
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
            <div className="difficulty-pick" role="radiogroup" aria-label="Difficulty">
              {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={d === difficulty}
                  className={`diff ${d === difficulty ? 'on' : ''}`}
                  data-testid={`difficulty-${d}`}
                  title={DIFFICULTY[d].blurb}
                  onClick={() => setDifficulty(d)}
                >
                  {DIFFICULTY[d].name}
                </button>
              ))}
            </div>
            <p className="diff-note" data-testid="difficulty-note">
              {DIFFICULTY[difficulty].blurb}
            </p>
            <button
              type="button"
              className="btn primary big"
              data-testid="new-game"
              onClick={() => s.newGame(typed ?? undefined, undefined, scenarioId, difficulty)}
            >
              <Icon name="play" size={22} /> New Lineage
            </button>
            <div className="seed-row">
              <label className="seed-field">
                <span>Seed</span>
                <input
                  type="text"
                  inputMode="text"
                  maxLength={64}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="6001 or any words"
                  value={seedText}
                  data-testid="seed-input"
                  aria-describedby="seed-note"
                  onChange={(e) => setSeedText(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn"
                data-testid="random-valley"
                onClick={() => {
                  const n = 1 + Math.floor(Math.random() * 999_999);
                  setSeedText(String(n));
                  s.newGame(n, undefined, scenarioId, difficulty);
                }}
              >
                Random valley
              </button>
            </div>
            <p className="diff-note" id="seed-note" data-testid="seed-note">
              {typed
                ? `Valley ${typed}${shared.seed === typed ? ' (shared link)' : ''}${best ? ` · your best: ${best.outcome === 'victory' ? 'won' : 'lost'} with ${best.survivors} survivors` : ''}`
                : 'Same seed, same valley and same disasters — share it.'}
            </p>
            <button
              type="button"
              className="btn"
              data-testid="daily"
              onClick={() => s.newGame(daily.seed, undefined, daily.scenario, daily.difficulty, daily.daily)}
            >
              Daily Ruins · {daily.daily} UTC · {getScenario(daily.scenario).name}
              {dailyBest ? ` · best: ${dailyBest.outcome === 'victory' ? 'won' : 'lost'}` : ''}
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
            <label className="toggle">
              <input
                type="checkbox"
                checked={s.settings.sound}
                data-testid="setting-sound"
                onChange={(e) => s.updateSettings({ sound: e.target.checked })}
              />
              <span>
                <b>Sound</b>
                <small>Procedural music and effects. Off silences everything.</small>
              </span>
            </label>
            <label className="slider">
              <b>Music volume</b>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={s.settings.musicVolume}
                data-testid="setting-music"
                onChange={(e) => s.updateSettings({ musicVolume: Number(e.target.value) })}
              />
            </label>
            <label className="slider">
              <b>Effects volume</b>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={s.settings.sfxVolume}
                data-testid="setting-sfx"
                onChange={(e) => s.updateSettings({ sfxVolume: Number(e.target.value) })}
              />
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
      {s.runs.length > 0 && view === 'main' && (
        <ul className="recent-runs" data-testid="recent-runs" aria-label="Recent lineages">
          {s.runs.slice(0, 3).map((r) => (
            <li key={r.id}>
              {r.outcome === 'victory' ? '✓' : '✗'} {getScenario(r.scenario).name} · {r.difficulty} · seed{' '}
              {r.seed} · {r.survivors} survivors{r.daily ? ` · daily ${r.daily}` : ''}
            </li>
          ))}
        </ul>
      )}
      <p className="footnote">No accounts. Saves stay in this browser.</p>
    </div>
  );
}
