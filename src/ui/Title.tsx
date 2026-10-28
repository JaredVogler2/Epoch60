import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { MAX_BACKUP_CHARS, checkBackup, downloadBackup, importedBranch } from '../game/backup';
import type { BackupPlan } from '../game/backup';
import { hasSave, loadCampaign, unfinishedSave } from '../game/persist';
import {
  CHALLENGE_IDS,
  UNLOCKED_BY,
  challengeBlocked,
  expeditionFor,
  unlockedChallenges,
} from '../game/challenges';
import { bestFor, dailyRun, parseShare, seedFromText, utcDate } from '../game/modes';
import { DIFFICULTY, FEATS, FEAT_IDS, MAX_MODIFIERS, MODIFIERS, SCENARIOS, getScenario } from '../engine';
import type { Campaign, Difficulty, ModifierId } from '../engine';
import { CodexList } from './Codex';
import { ROMAN } from './format';
import { Icon } from './icons';
import { useDialog } from './useDialog';
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
  // There is room for one saved lineage: starting another over one with progress asks first.
  const [confirm, setConfirm] = useState<{ save: Campaign; go: () => void } | null>(null);
  // The button that asked, given focus back when the question is answered "keep it" (it was hidden meanwhile).
  const askedFrom = useRef<string | null>(null);
  const start = (go: () => void) => {
    const save = unfinishedSave();
    if (!save) return go();
    askedFrom.current = (document.activeElement as HTMLElement | null)?.dataset?.testid ?? null;
    setConfirm({ save, go });
  };
  useEffect(() => {
    if (confirm || !askedFrom.current) return;
    document
      .querySelector<HTMLElement>(`[data-testid="${askedFrom.current}"]`)
      ?.focus({ preventScroll: true });
    askedFrom.current = null;
  }, [confirm]);
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
        {view === 'main' && confirm && (
          <ConfirmStart
            save={confirm.save}
            onKeep={() => setConfirm(null)}
            onReplace={() => {
              setConfirm(null);
              confirm.go();
            }}
          />
        )}
        {view === 'main' && !confirm && (
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
                onClick={() =>
                  start(() => {
                    const n = 1 + Math.floor(Math.random() * 999_999);
                    const drawn = expeditionFor(n, scenarioId, open);
                    setSeedText(String(n));
                    setChosen(drawn);
                    s.newGame(n, undefined, scenarioId, difficulty, undefined, drawn);
                  })
                }
              >
                Expedition: a random valley, challenges drawn from those open
              </button>
            </details>
            <button
              type="button"
              className="btn primary big"
              data-testid="new-game"
              onClick={() =>
                start(() =>
                  s.newGame(typed ?? undefined, undefined, scenarioId, difficulty, undefined, chosen),
                )
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
                onClick={() =>
                  start(() => {
                    const n = 1 + Math.floor(Math.random() * 999_999);
                    setSeedText(String(n));
                    s.newGame(n, undefined, scenarioId, difficulty, undefined, chosen);
                  })
                }
              >
                Random valley
              </button>
            </div>
            <p className={`diff-note${typed ? '' : ' generic'}`} id="seed-note" data-testid="seed-note">
              {typed
                ? `Valley ${typed}${shared.seed === typed ? ' (shared link)' : ''}${best ? ` · your best: ${best.outcome === 'victory' ? 'won' : 'lost'} with ${best.survivors} survivors, legacy ${best.legacy ?? 0}` : ''}`
                : 'A number or any words. Same seed, same valley and same disasters — share it.'}
            </p>
            <button
              type="button"
              className="btn"
              data-testid="daily"
              onClick={() =>
                start(() => s.newGame(daily.seed, undefined, daily.scenario, daily.difficulty, daily.daily))
              }
            >
              Daily Ruins · {daily.daily} UTC · {getScenario(daily.scenario).name}
              {dailyBest ? ` · best: ${dailyBest.outcome === 'victory' ? 'won' : 'lost'}` : ''}
            </button>
            <button
              type="button"
              className="btn big continue"
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
        {view === 'main' && !confirm && (
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
            <YourData />
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
              {r.branch !== undefined ? ` · branch from age ${ROMAN[r.branch]}` : ''}
              {r.endless ? ` · ${r.title.toLowerCase()} after ${r.epochs} ages` : ''}
            </li>
          ))}
        </ul>
      )}
      <p className="footnote">No accounts. Saves stay in this browser.</p>
    </div>
  );
}

const lineageLabel = (c: Campaign) =>
  `${SCENARIOS[c.scenario]?.name ?? c.scenario}, age ${ROMAN[c.epoch] ?? c.epoch + 1} · ` +
  `${DIFFICULTY[c.difficulty]?.name ?? c.difficulty} · seed ${c.seed}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Asked before a new lineage replaces a saved one with progress (Escape or "Keep it" keeps it). */
function ConfirmStart({
  save,
  onKeep,
  onReplace,
}: {
  save: Campaign;
  onKeep: () => void;
  onReplace: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onKeep);
  return (
    <div
      className="confirm-start"
      ref={ref}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-start-title"
      aria-describedby="confirm-start-what"
      data-testid="confirm-start"
    >
      <h2 id="confirm-start-title">Start a new lineage?</h2>
      <p id="confirm-start-what">
        Your saved lineage ({lineageLabel(save)}) will be replaced: there is room for one. To keep it, export
        a backup first (Settings, Your data).
      </p>
      <div className="title-row">
        <button type="button" className="btn big" data-autofocus data-testid="confirm-keep" onClick={onKeep}>
          Keep it
        </button>
        <button type="button" className="btn primary big" data-testid="confirm-replace" onClick={onReplace}>
          Start the new lineage
        </button>
      </div>
    </div>
  );
}

/** Settings, Your data: what this browser keeps, and a backup of it to export or import. */
function YourData() {
  const s = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const [plan, setPlan] = useState<BackupPlan | null>(null);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  // The lineage an import would replace, read once per file chosen.
  const here = useMemo(() => (plan?.lineage ? loadCampaign() : null), [plan]);
  // The settings card scrolls: what a file holds, and how an export or import went, are brought into view.
  useEffect(() => {
    if (!plan) return;
    previewRef.current?.scrollIntoView?.({ block: 'nearest' });
    previewRef.current?.focus({ preventScroll: true });
  }, [plan]);
  useEffect(() => {
    if (note) noteRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [note]);
  const exportNow = () => {
    const b = downloadBackup();
    setPlan(null);
    setNote({
      text:
        `Backup exported: ${b.lineage ? 'your saved lineage, ' : ''}` +
        `${plural(b.codex.length, 'Codex feat', 'Codex feats')} and ${plural(b.runs.length, 'run card', 'run cards')}.`,
    });
  };
  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // Cleared so that choosing the same file again is noticed.
    e.target.value = '';
    if (!f) return;
    setPlan(null);
    if (f.size > MAX_BACKUP_CHARS * 4) {
      setNote({ text: 'That file is too large to be an EPOCH backup.', bad: true });
      return;
    }
    let text: string;
    try {
      text = await f.text();
    } catch {
      setNote({ text: 'That file could not be read.', bad: true });
      return;
    }
    const r = checkBackup(text);
    setNote(r.ok ? null : { text: r.reason, bad: true });
    if (r.ok) setPlan(r.plan);
  };
  const importNow = (p: BackupPlan) => {
    const r = s.importBackup(p);
    setPlan(null);
    const lineage = r.lineage
      ? 'the lineage (Continue resumes it), '
      : p.lineage
        ? 'not the lineage (this browser would not store it), '
        : '';
    setNote({
      text:
        `Imported ${lineage}${plural(r.newFeats, 'new Codex feat', 'new Codex feats')} and ` +
        `${plural(r.newRuns, 'new run card', 'new run cards')}.`,
      bad: !r.lineage && !!p.lineage,
    });
  };
  const empty = !!plan && !plan.lineage && !plan.codex.length && !plan.runs.length;
  return (
    <section className="your-data" aria-labelledby="your-data-title" data-testid="your-data">
      <h3 id="your-data-title">Your data</h3>
      <p className="dim small">
        Everything EPOCH remembers (your saved lineage, the Codex and your run cards) is kept in this browser
        and nowhere else: there are no accounts, and nothing is sent anywhere. Clearing this site's data
        erases it. A backup keeps a copy, or carries it to another browser or device.
      </p>
      <div className="title-row">
        <button type="button" className="btn" data-testid="export-backup" onClick={exportNow}>
          Export a backup
        </button>
        <button
          type="button"
          className="btn"
          data-testid="import-backup"
          onClick={() => fileRef.current?.click()}
        >
          Import a backup…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="import-file"
          onChange={(e) => void choose(e)}
        />
      </div>
      {plan && (
        <div
          className="import-preview"
          ref={previewRef}
          tabIndex={-1}
          role="group"
          aria-label="The backup to import"
          data-testid="import-preview"
        >
          <p>This backup holds:</p>
          <ul>
            {plan.lineage && (
              <li data-testid="import-lineage">
                a lineage: {lineageLabel(plan.lineage.campaign)}
                {plan.lineage.campaign.phase === 'VICTORY' || plan.lineage.campaign.phase === 'DEFEAT'
                  ? ' (ended)'
                  : ''}
              </li>
            )}
            {plan.lineageUnreadable && (
              <li className="note-warn" data-testid="import-unreadable">
                a lineage that does not read back (damaged, or from another version), left out
              </li>
            )}
            <li>{plural(plan.codex.length, 'Codex feat', 'Codex feats')}</li>
            <li>{plural(plan.runs.length, 'run card', 'run cards')}</li>
            {plan.dropped > 0 && (
              <li>{plural(plan.dropped, 'entry', 'entries')} this version cannot use, left out</li>
            )}
          </ul>
          {plan.lineage && here && (
            <p className="note-warn" data-testid="import-replaces">
              Its lineage replaces the one saved here ({lineageLabel(here)}).
            </p>
          )}
          {plan.lineage && importedBranch(plan.lineage) !== null && (
            <p className="dim small" data-testid="import-branch">
              Brought back from a backup, it plays on as a branch from age{' '}
              {ROMAN[importedBranch(plan.lineage)!]}: its feats count, but its card is never ranked (a backup
              could otherwise retry a lost age).
            </p>
          )}
          <p className="dim small">Its feats and run cards join this browser's; nothing else here changes.</p>
          <div className="title-row">
            <button
              type="button"
              className="btn primary"
              data-testid="import-confirm"
              disabled={empty}
              onClick={() => importNow(plan)}
            >
              {empty ? 'Nothing to import' : 'Import'}
            </button>
            <button type="button" className="btn" data-testid="import-cancel" onClick={() => setPlan(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {note && (
        <p
          className={note.bad ? 'data-note bad' : 'data-note'}
          ref={noteRef}
          role="status"
          data-testid="data-note"
        >
          {note.text}
        </p>
      )}
    </section>
  );
}
