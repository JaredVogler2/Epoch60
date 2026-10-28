import { useEffect, useRef, useState } from 'react';
import { hasSave } from '../game/persist';
import {
  CHALLENGE_IDS,
  UNLOCKED_BY,
  challengeBlocked,
  expeditionFor,
  unlockedChallenges,
} from '../game/challenges';
import { bestFor, dailyRun, parseShare, seedFromText, utcDate } from '../game/modes';
import { DIFFICULTY, FEATS, FEAT_IDS, MAX_MODIFIERS, MODIFIERS, SCENARIOS, getScenario } from '../engine';
import type { Difficulty, ModifierId } from '../engine';
import { CodexList } from './Codex';
import { ROMAN } from './format';
import { Icon } from './icons';
import { useStore } from './useStore';

export function TitleScreen() {
  const s = useStore();
  const [view, setView] = useState<'main' | 'help' | 'settings' | 'codex'>('main');
  // Each view starts at its top: the card keeps its scroll position otherwise (a long Codex opened mid-list).
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cardRef.current?.scrollTo?.({ top: 0 });
  }, [view]);
  const canContinue = hasSave();
  const [badSave, setBadSave] = useState(false);
  const [scenarioId, setScenarioId] = useState(() =>
    typeof location === 'undefined' ? 'greenvale' : (parseShare(location.search).scenario ?? 'greenvale'),
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(() =>
    typeof location === 'undefined' ? 'normal' : (parseShare(location.search).difficulty ?? 'normal'),
  );
  // A shared link (?seed=…&scenario=…&difficulty=…) pre-selects exactly that valley.
  const [shared] = useState(() => (typeof location === 'undefined' ? {} : parseShare(location.search)));
  const [seedText, setSeedText] = useState(shared.seed ? String(shared.seed) : '');
  const [chosen, setChosen] = useState<ModifierId[]>(() => shared.modifiers ?? []);
  // Challenges open from the Codex; a shared link opens the ones it names.
  const open = new Set([...unlockedChallenges(s.codex), ...(shared.modifiers ?? [])]);
  const toggle = (id: ModifierId) =>
    setChosen((now) => CHALLENGE_IDS.filter((x) => (x === id ? !now.includes(x) : now.includes(x))));
  const pickScenario = (id: string) => {
    setScenarioId(id);
    // A challenge that does not suit the new scenario (no quake comes in the Ashen Winter) is dropped.
    setChosen((now) => now.filter((m) => !MODIFIERS[m].scenarios || MODIFIERS[m].scenarios!.includes(id)));
  };
  const daily = dailyRun(utcDate(new Date()));
  const typed = seedFromText(seedText);
  const mode = s.settings.assisted ? ('assisted' as const) : ('standard' as const);
  const spec = { seed: typed ?? 6001, scenario: scenarioId, difficulty, mode, modifiers: chosen };
  const best = typed ? bestFor(s.runs, spec) : null;
  const scenario = getScenario(scenarioId);
  const dailyBest = bestFor(s.runs, { ...daily, mode });
  return (
    <div className="title-layer" data-testid="title">
      <div className="title-card" ref={cardRef}>
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
                  onClick={() => pickScenario(sc.id)}
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
            <details className="challenges" data-testid="challenges" open={chosen.length > 0 || undefined}>
              <summary>
                Challenges{' '}
                <small data-testid="challenges-summary">
                  {chosen.length
                    ? chosen.map((m) => MODIFIERS[m].name).join(' · ')
                    : `none · ${open.size} of ${CHALLENGE_IDS.length} open`}
                </small>
              </summary>
              <div className="challenge-pick" role="group" aria-label={`Challenges, up to ${MAX_MODIFIERS}`}>
                {CHALLENGE_IDS.map((id) => {
                  const d = MODIFIERS[id];
                  const on = chosen.includes(id);
                  const why = challengeBlocked(id, chosen, scenarioId, open, MAX_MODIFIERS);
                  const clash = chosen.find((c) => (d.excludes ?? []).includes(c));
                  const note =
                    why === 'locked'
                      ? `Opens when you earn “${FEATS[UNLOCKED_BY[id]].name}”`
                      : why === 'unsuited'
                        ? `Not in ${scenario.name}`
                        : why === 'clash' && clash
                          ? `Not with ${MODIFIERS[clash].name}`
                          : why === 'full'
                            ? `At most ${MAX_MODIFIERS}`
                            : d.summary;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-disabled={why ? true : undefined}
                      className={`challenge ${on ? 'on' : ''} ${why === 'locked' ? 'locked' : ''}`}
                      data-testid={`challenge-${id}`}
                      title={d.effects.join(' ')}
                      onClick={() => {
                        if (!why) toggle(id);
                      }}
                    >
                      <b>
                        {why === 'locked' && <Icon name="lock" size={14} />} {d.name}
                      </b>
                      <small>{note}</small>
                    </button>
                  );
                })}
              </div>
              {chosen.length > 0 && (
                <ul className="challenge-effects" data-testid="challenge-effects">
                  {chosen.flatMap((m) => MODIFIERS[m].effects.map((e) => <li key={`${m}:${e}`}>{e}</li>))}
                </ul>
              )}
              <p className="dim small">
                Each changes the valley, a catastrophe or your people for the whole lineage. A lineage with
                challenges is compared only with lineages that had the same ones.
              </p>
              <button
                type="button"
                className="btn"
                data-testid="expedition"
                disabled={open.size === 0}
                onClick={() => {
                  const n = 1 + Math.floor(Math.random() * 999_999);
                  const drawn = expeditionFor(n, scenarioId, open);
                  setSeedText(String(n));
                  setChosen(drawn);
                  s.newGame(n, undefined, scenarioId, difficulty, undefined, drawn);
                }}
              >
                Expedition: a random valley, challenges drawn from those open
              </button>
            </details>
            <button
              type="button"
              className="btn primary big"
              data-testid="new-game"
              onClick={() =>
                s.newGame(typed ?? undefined, undefined, scenarioId, difficulty, undefined, chosen)
              }
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
                  placeholder="e.g. 6001"
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
                  s.newGame(n, undefined, scenarioId, difficulty, undefined, chosen);
                }}
              >
                Random valley
              </button>
            </div>
            <p className="diff-note" id="seed-note" data-testid="seed-note">
              {typed
                ? `Valley ${typed}${shared.seed === typed ? ' (shared link)' : ''}${best ? ` · your best: ${best.outcome === 'victory' ? 'won' : 'lost'} with ${best.survivors} survivors, legacy ${best.legacy ?? 0}` : ''}`
                : 'A number or any words. Same seed, same valley and same disasters — share it.'}
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
              onClick={() => {
                if (!s.continueGame()) {
                  // Unreadable or from an incompatible version: set it aside instead of failing silently forever.
                  s.abandonSave();
                  setBadSave(true);
                }
              }}
            >
              Continue
            </button>
            {badSave && (
              <p className="note-warn" role="status" data-testid="bad-save">
                That save could not be read (damaged or from another version) and has been set aside.
              </p>
            )}
          </div>
        )}
        {view === 'main' && (
          <div className="title-row title-more">
            <button type="button" className="btn ghost" data-testid="how-to" onClick={() => setView('help')}>
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
            <button
              type="button"
              className="btn ghost"
              data-testid="open-codex"
              onClick={() => setView('codex')}
            >
              <Icon name="star" size={18} /> Codex {s.codex.length}/{FEAT_IDS.length}
            </button>
          </div>
        )}
        {view === 'codex' && (
          <div className="title-sub" data-testid="title-codex">
            <CodexList codex={s.codex} />
            <button type="button" className="btn" onClick={() => setView('main')}>
              Back
            </button>
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
                Three ages, one valley. Break the cycle: keep people alive, a landmark standing (a hearth you
                keep, a Seed Vault, a Dam or a Bridge) and knowledge remembered in an Archive.
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
              {r.outcome === 'victory' ? '✓' : '✗'} {SCENARIOS[r.scenario]?.name ?? r.scenario} ·{' '}
              {r.difficulty}
              {r.mode === 'assisted' ? ' · assisted' : ''} · seed {r.seed} · {r.survivors} survivors
              {r.legacy !== undefined ? ` · legacy ${r.legacy}` : ''}
              {r.daily ? ` · daily ${r.daily}` : ''}
              {r.modifiers ? ` · ${r.modifiers.map((m) => MODIFIERS[m].name).join(', ')}` : ''}
              {r.branch ? ` · branch from age ${ROMAN[r.branch]}` : ''}
            </li>
          ))}
        </ul>
      )}
      <p className="footnote">No accounts. Saves stay in this browser.</p>
    </div>
  );
}
