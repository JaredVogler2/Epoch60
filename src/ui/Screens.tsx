import { useEffect, useRef, useState } from 'react';
import {
  BUILDINGS,
  DIFFICULTY,
  FEAT_IDS,
  TECHS,
  TRADITIONS,
  UNIT,
  currentSpec,
  getScenario,
  legacyOf,
  ruinYield,
  unplan,
  victoryFor,
} from '../engine';
import type { HazardKind, Structure, TraditionId } from '../engine';
import { clearSave } from '../game/persist';
import { presentation } from '../render/presentation';
import { AtlasOfAges, FeatChips, nextIdeas } from './Codex';
import { HistoryLegend } from './HistoryLegend';
import { ThenNow } from './ThenNow';
import { chronicleOf } from './chronicle';
import { Icon, hazardIcon } from './icons';
import { ROMAN } from './format';
import { shareQuery } from '../game/modes';
import { useStore } from './useStore';
import { useDialog } from './useDialog';

/* ------------------------------ PREPARE ------------------------------ */

export function PrepareCard() {
  const s = useStore();
  const c = s.campaign!;
  // Roomy screens show the briefing by default; phones (and short landscape screens) keep it to a one-line header until tapped.
  const [open, setOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > 720 && window.innerHeight > 520,
  );
  if (c.phase !== 'PREPARE') return null;
  const spec = currentSpec(c);
  const scenario = getScenario(c.scenario);
  const f = s.getForecastCached();
  const plans = c.queue.filter((q) => q.action.type === 'build' || q.action.type === 'research');
  const inherited = c.structures.filter((x) => x.originEpoch < c.epoch);
  const touch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const ruins = inherited.filter((x) => x.status === 'rubble' || x.status === 'buried').length;
  const standing = inherited.filter((x) => x.status === 'active' || x.status === 'damaged').length;
  const win = victoryFor(scenario, c.difficulty);
  const landmarksNow = inherited.filter(
    (x) => BUILDINGS[x.kind].heritage && (x.status === 'active' || x.status === 'damaged'),
  ).length;
  return (
    <section className={`prepare ${open ? 'open' : ''}`} data-testid="prepare" aria-label="Epoch briefing">
      <button type="button" className="prepare-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="roman">{ROMAN[c.epoch]}</span>
        <span className="prepare-head">
          <b>{spec.name}</b>
          <small>
            {f
              ? `${f.name} will strike · ${f.atRisk} building${f.atRisk === 1 ? '' : 's'} at risk`
              : spec.ageName}
          </small>
        </span>
        <span className="chev">{open ? '▾' : '▴'}</span>
      </button>
      <div className="prepare-body">
        <p className="brief">{spec.brief}</p>
        <p className="goal">
          <Icon name="star" size={14} /> {spec.goal}
        </p>
        <p className="scarcity">{spec.scarcityNote}</p>
        {c.epoch > 0 && (
          <p className="inherit" data-testid="inherit-summary">
            <Icon name="layers" size={14} /> Inherited: {standing} standing work{standing === 1 ? '' : 's'},{' '}
            {ruins} ruin{ruins === 1 ? '' : 's'}, {c.civ.techs.length} technolog
            {c.civ.techs.length === 1 ? 'y' : 'ies'}
            {c.civ.techs.length > 0 && ` (${c.civ.techs.map((t) => TECHS[t].name).join(', ')})`}.{' '}
            <button
              type="button"
              className="btn sm"
              aria-pressed={s.showHistory}
              data-testid="toggle-history"
              onClick={() => s.toggleHistory()}
            >
              {s.showHistory ? 'Hide history' : 'Show history on the map'}
              {!touch && <span className="kbd-hint"> (H)</span>}
            </button>
          </p>
        )}
        {c.epoch > 0 && s.showHistory && <HistoryLegend reveal />}
        {f && (
          <div className="forecast-box">
            <Icon name={hazardIcon(spec.hazard.kind)} size={20} />
            <span>
              Forecast at the end of the minute: <b>{f.atRisk}</b> building{f.atRisk === 1 ? '' : 's'} lost or
              damaged, about <b>{f.predictedDeaths}</b> {f.predictedDeaths === 1 ? 'life' : 'lives'}. The
              striped overlay shows the path — change it by how and where you build.
            </span>
          </div>
        )}
        <div className="plans">
          <b>Opening orders {plans.length}/3</b>
          {plans.length === 0 && (
            <span className="dim">
              Pick a building below, then place it. Orders are paid when the clock starts.
            </span>
          )}
          {plans.map((q) => (
            <div className="plan" key={q.seq} data-testid="plan-item">
              {q.action.type === 'build' ? (
                <>
                  <Icon name={q.action.kind} size={18} /> {BUILDINGS[q.action.kind].name}
                </>
              ) : q.action.type === 'research' ? (
                <>
                  <Icon name="knowledge" size={18} /> Research {TECHS[q.action.tech].name}
                </>
              ) : null}
              <button
                type="button"
                className="btn-icon sm"
                aria-label="Withdraw plan"
                onClick={() => {
                  unplan(c, q.seq);
                  s.dispatch({ type: 'setFocus', focus: c.civ.focus }, { quiet: true });
                }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="victory-goals" data-testid="victory-goals">
          <b>To break the cycle, after {scenario.epochs.at(-1)!.hazard.headline}:</b>
          <ul>
            <li>
              <Icon name="people" size={14} /> {win.minSurvivors} people alive
            </li>
            <li>
              <Icon name="hearth" size={14} /> {win.minHeritage} landmark{win.minHeritage === 1 ? '' : 's'}{' '}
              from an earlier age: a hearth you keep, a Seed Vault, a Dam or a Bridge
              {c.epoch > 0 && <span className="dim"> ({landmarksNow} now)</span>}
            </li>
            <li>
              <Icon name="archive" size={14} /> {win.minRetainedTechs} technologies carried through: memory
              keeps one, a standing hearth one, an Archive the rest
            </li>
          </ul>
        </div>
        <p className="dim small">
          {scenario.name} · epoch {c.epoch + 1} of {scenario.epochs.length} · preparing takes no time.
          {s.branch !== null && (
            <span data-testid="branch-mark">
              {' '}
              A branch replayed from Age {ROMAN[s.branch]}: its feats count, but it is never ranked.
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        className="btn primary big begin"
        data-testid="begin"
        onClick={() => {
          s.cancelPlacing();
          s.dispatch({ type: 'beginEpoch' });
        }}
      >
        <Icon name="play" size={22} /> Begin Epoch
      </button>
    </section>
  );
}

/* ------------------------------ COLLAPSE ------------------------------ */

export function CollapseOverlay() {
  const s = useStore();
  const c = s.campaign!;
  if (c.phase !== 'COLLAPSING' || !c.report) return null;
  const r = c.report;
  // The 3D world plays the hazard front first; the headline card appears when the front has passed.
  const done = !presentation.active || presentation.t >= 0.84 || s.settings.reducedMotion;
  return (
    <div
      className={`collapse-overlay ${r.hazard} ${done ? 'done' : 'playing'}`}
      data-testid="collapse"
      role="alert"
    >
      {done ? (
        <>
          <div className="collapse-title">
            <Icon name={hazardIcon(r.hazard as HazardKind)} size={34} />
            <h1>{r.hazardName}</h1>
            <p>{r.headline}</p>
          </div>
          <button
            type="button"
            className="btn primary big"
            data-testid="skip-collapse"
            onClick={() => s.dispatch({ type: 'continue' })}
          >
            See what survived
          </button>
        </>
      ) : (
        <div className="collapse-banner">
          <Icon name={hazardIcon(r.hazard as HazardKind)} size={22} />
          <b>{r.hazardName}</b>
          <button
            type="button"
            className="btn sm"
            data-testid="skip-collapse"
            onClick={() => s.dispatch({ type: 'continue' })}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ DEBRIEF ------------------------------ */

export function DebriefScreen() {
  const s = useStore();
  const c = s.campaign!;
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, undefined, true, c.phase === 'DEBRIEF' && !!c.report);
  if (c.phase !== 'DEBRIEF' || !c.report) return null;
  const r = c.report;
  const final = r.verdict;
  return (
    <div
      ref={ref}
      className="overlay debrief"
      data-testid="debrief"
      role="dialog"
      aria-modal="true"
      aria-label="Collapse report"
    >
      <div className="card-modal wide">
        <p className="eyebrow">
          Epoch {ROMAN[r.epoch]} · {currentSpec(c).name}
        </p>
        <h1>{r.hazardName}</h1>
        <p className="headline">{r.headline}</p>
        <div className="stats-grid">
          <div className="stat">
            <Icon name="people" size={22} />
            <b>{r.survivors}</b>
            <small>survived of {r.survivorsBefore}</small>
          </div>
          <div className="stat">
            <Icon name="skull" size={22} />
            <b>{r.deaths}</b>
            <small>lost</small>
          </div>
          <div className="stat">
            <Icon name="cottage" size={22} />
            <b>{r.structuresLost}</b>
            <small>destroyed · {r.structuresDamaged} damaged</small>
          </div>
          <div className="stat">
            <Icon name="knowledge" size={22} />
            <b>{r.retainedTechs.length}</b>
            <small>technologies carried</small>
          </div>
        </div>
        <h3>Why it happened</h3>
        <ul className="causes" data-testid="causes">
          {r.causes.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
        {(r.retainedTechs.length > 0 || r.lostTechs.length > 0) && (
          <p className="tech-line">
            {r.retainedTechs.length > 0 && (
              <span>
                <b>Remembered:</b> {r.retainedTechs.map((t) => TECHS[t].name).join(', ')}.{' '}
              </span>
            )}
            {r.lostTechs.length > 0 && (
              <span className="neg">
                <b>Forgotten:</b> {r.lostTechs.map((t) => TECHS[t].name).join(', ')}.
              </span>
            )}
          </p>
        )}
        <FeatChips
          ids={c.lineage.feats.filter((f) => f.epoch === r.epoch).map((f) => f.id)}
          fresh={s.newFeats}
          testId="debrief-feats"
        />
        <div className="score" data-testid="score">
          <span>People {r.score.people}</span>
          <span>Livelihood {r.score.livelihood}</span>
          <span>Knowledge {r.score.knowledge}</span>
          <span>Ecology {r.score.ecology}</span>
          <span>Heritage {r.score.heritage}</span>
          <b>Total {r.score.total}</b>
        </div>
        {final && (
          <div className={`verdict ${final.outcome}`} data-testid="verdict">
            <h3>{final.title}</h3>
            <p>{final.reason}</p>
            <ul>
              {final.conditions.map((cd) => (
                <li key={cd.label} className={cd.met ? 'met' : 'unmet'}>
                  <Icon name={cd.met ? 'check' : 'close'} size={16} /> {cd.label}: {cd.have} / {cd.need}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          className="btn primary big"
          data-testid="debrief-continue"
          data-autofocus
          onClick={() => s.dispatch({ type: 'continue' })}
        >
          {final
            ? final.outcome === 'victory'
              ? 'See the ending'
              : 'See the ending'
            : 'Let the centuries pass'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ INTERREGNUM ------------------------------ */

function RuinRow({ st }: { st: Structure }) {
  const s = useStore();
  const c = s.campaign!;
  const inter = c.lineage.interregnum!;
  const y = ruinYield(st);
  const sel = s.inter.ruin === st.id;
  const d = BUILDINGS[st.kind];
  const gain = (Object.keys(y.resources) as (keyof typeof y.resources)[])
    .filter((k) => y.resources[k] > 0)
    .map((k) => `${Math.floor(y.resources[k] / UNIT)} ${k}`);
  return (
    <div className={`ruin ${sel ? 'selected' : ''}`} data-testid="ruin-row">
      <button
        type="button"
        className="ruin-main"
        onClick={() => {
          s.setInter({ ruin: st.id });
          s.select(st.id);
          s.focusOn(st.x + st.w / 2, st.y + st.h / 2, 16);
        }}
      >
        <Icon name={st.kind} size={22} />
        <span>
          <b>{d.name}</b>
          <small>
            ({st.x},{st.y}) · age {ROMAN[st.originEpoch]} ·{' '}
            {st.status === 'buried' ? 'deeply buried' : 'ruin'} · {st.cause ?? 'time'}
          </small>
        </span>
      </button>
      {st.surveyed || st.excavated ? (
        <p className="ruin-note">
          {y.note}
          {y.techs.length > 0 && <b> Knowledge: {y.techs.map((t) => TECHS[t].name).join(', ')}.</b>}
          {gain.length > 0 && <span className="dim"> Salvage: {gain.join(', ')}.</span>}
        </p>
      ) : (
        <p className="ruin-note dim">Unsurveyed.</p>
      )}
      <div className="ruin-actions">
        {!st.surveyed && !st.excavated && (
          <button
            type="button"
            className="btn sm"
            disabled={inter.surveysLeft <= 0}
            data-testid="survey"
            onClick={() => s.dispatch({ type: 'survey', id: st.id })}
          >
            Survey ({inter.surveysLeft})
          </button>
        )}
        {!st.excavated && (
          <button
            type="button"
            className="btn sm primary"
            disabled={inter.excavationsLeft <= 0}
            data-testid="excavate"
            onClick={() => s.dispatch({ type: 'excavate', id: st.id })}
          >
            Excavate ({inter.excavationsLeft})
          </button>
        )}
        {st.excavated && <span className="tag done">Excavated</span>}
      </div>
    </div>
  );
}

export function InterregnumScreen() {
  const s = useStore();
  const c = s.campaign!;
  const inter = c.lineage.interregnum;
  // Not modal (the valley stays explorable), but keyboard focus lands on the first choice when the age ends.
  const interRef = useRef<HTMLElement>(null);
  useDialog(interRef, undefined, false, c.phase === 'INTERREGNUM' && !!inter);
  useEffect(() => {
    if (c.phase === 'INTERREGNUM' && inter && inter.sites[s.inter.site]) {
      const st = inter.sites[s.inter.site]!;
      s.focusOn(st.x + 1, st.y + 1, 26);
    }
    // Only on entering / changing the chosen site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.phase, s.inter.site]);
  if (c.phase !== 'INTERREGNUM' || !inter) return null;
  // Landmarks and knowledge stores (their tablets can be dug up) head the list.
  const notable = (x: Structure) => Number(BUILDINGS[x.kind].heritage || BUILDINGS[x.kind].retains > 0);
  const ruins = c.structures
    .filter((x) => x.status === 'rubble' || x.status === 'buried')
    .sort((a, b) => notable(b) - notable(a) || a.id - b.id);
  const oldHearth = c.structures.find(
    (x) => x.kind === 'hearth' && (x.status === 'active' || x.status === 'damaged'),
  );
  const tradition = (s.inter.tradition ?? inter.traditions[0]!.id) as TraditionId;
  const nextSpec = getScenario(c.scenario).epochs[c.epoch + 1];
  const pics = s.snapshots[c.epoch];
  return (
    <aside ref={interRef} className="interregnum" data-testid="interregnum" aria-label="Between ages">
      <header>
        <p className="eyebrow">{inter.years} years pass</p>
        <h2>The valley sleeps</h2>
      </header>
      {pics?.then && pics.after && (
        <ThenNow
          then={pics.then}
          after={pics.after}
          thenLabel="As the minute ended"
          afterLabel={`${inter.years} years later`}
        />
      )}
      <ul className="inter-log">
        {inter.summary.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <HistoryLegend />

      <h3>
        Ruins{' '}
        <small className="dim">
          {inter.surveysLeft} survey · {inter.excavationsLeft} dig left
        </small>
      </h3>
      <div className="ruin-list">
        {ruins.length === 0 && <p className="dim">Nothing of the old age remains to be dug up.</p>}
        {ruins.map((r) => (
          <RuinRow key={r.id} st={r} />
        ))}
      </div>

      <h3>Where will your people begin?</h3>
      <div className="site-list">
        {inter.sites.map((st, i) => {
          // Founding within a cell of a standing hearth moves into it; anywhere else abandons it to ruin.
          const keeps = !!oldHearth && Math.abs(oldHearth.x - st.x) <= 1 && Math.abs(oldHearth.y - st.y) <= 1;
          return (
            <button
              key={i}
              type="button"
              className={`site ${s.inter.site === i ? 'selected' : ''}`}
              aria-pressed={s.inter.site === i}
              data-testid={`site-${i}`}
              onClick={() => {
                s.setInter({ site: i });
                s.focusOn(st.x + 1, st.y + 1, 22);
              }}
            >
              <b>{st.label}</b>
              <small>{st.note}</small>
              <span className="site-stats">
                <span>Soil {Math.round(st.fertility / 10)}%</span>
                <span className={st.risk > 500 ? 'neg' : st.risk > 150 ? 'warn' : 'pos'}>
                  <Icon name={hazardIcon(st.riskKind)} size={12} />{' '}
                  {st.risk > 500 ? 'Severe' : st.risk > 150 ? 'Exposed' : 'Safe'}
                </span>
                {st.onRuin && <span>On old foundations</span>}
                {oldHearth && (
                  <span className={keeps ? 'pos' : 'warn'}>
                    {keeps ? 'Keeps the old hearth' : 'Abandons the old hearth'}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <h3>What will they remember?</h3>
      <div className="trad-list">
        {inter.traditions.map((t) => {
          const d = TRADITIONS[t.id];
          return (
            <button
              key={t.id}
              type="button"
              className={`trad ${tradition === t.id ? 'selected' : ''}`}
              aria-pressed={tradition === t.id}
              data-testid={`trad-${t.id}`}
              onClick={() => {
                s.setInter({ tradition: t.id });
              }}
            >
              <b>{d.name}</b>
              <small className="because">{t.because}</small>
              <span className="pos">+ {d.upside}</span>
              <span className="neg">− {d.downside}</span>
            </button>
          );
        })}
      </div>

      <div className="found-bar">
        <button
          type="button"
          className="btn primary big"
          data-testid="found"
          onClick={() => {
            const r = s.dispatch({ type: 'found', site: s.inter.site, tradition });
            if (r.ok) s.setInter({ site: 0, tradition: null, ruin: null });
          }}
        >
          Found the {nextSpec?.ageName ?? 'next age'}
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------ END ------------------------------ */

export function EndScreen() {
  const s = useStore();
  const c = s.campaign!;
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, undefined, true, c.phase === 'VICTORY' || c.phase === 'DEFEAT');
  if (c.phase !== 'VICTORY' && c.phase !== 'DEFEAT') return null;
  const win = c.phase === 'VICTORY';
  const branchAges = s.branchAges();
  const v = c.report?.verdict;
  const legacy = legacyOf(c);
  const chronicle = chronicleOf(c);
  return (
    <div
      ref={ref}
      className={`overlay end ${win ? 'win' : 'lose'}`}
      data-testid="end"
      role="dialog"
      aria-modal="true"
      aria-label="Ending"
    >
      <div className="card-modal wide">
        <p className="eyebrow">{win ? 'Victory' : 'Defeat'}</p>
        <h1 data-testid="end-title">{v?.title ?? (win ? 'The cycle is broken' : 'The valley is silent')}</h1>
        <p className="headline">{v?.reason}</p>
        {v && (
          <ul className="verdict-list">
            {v.conditions.map((cd) => (
              <li key={cd.label} className={cd.met ? 'met' : 'unmet'}>
                <Icon name={cd.met ? 'check' : 'close'} size={16} /> {cd.label}: {cd.have} / {cd.need}
              </li>
            ))}
          </ul>
        )}
        {legacy && (
          <section className="legacy" data-testid="legacy" aria-label="Legacy">
            <h3>
              Legacy <b data-testid="legacy-total">{legacy.total}</b>
            </h3>
            <ul>
              {legacy.parts.map((p) => (
                <li key={p.key} data-testid={`legacy-${p.key}`}>
                  <b>
                    {p.label} {p.points}
                  </b>{' '}
                  · {p.basis}
                </li>
              ))}
            </ul>
            <p className="dim small">
              Only what lasted counts: the people, knowledge, works and feats the lineage ends with.
            </p>
          </section>
        )}
        <h3>Atlas of Ages</h3>
        <AtlasOfAges c={c} pics={s.snapshots} />
        {chronicle.length > 0 && (
          <>
            <h3>Chronicle of works</h3>
            <ul className="chronicle" data-testid="chronicle">
              {chronicle.map((b) => (
                <li key={b.id} data-testid="chronicle-work">
                  <b>{b.title}.</b> {b.story.join(' ')}
                </li>
              ))}
            </ul>
          </>
        )}
        <h3>
          Feats of this lineage{' '}
          <small className="dim" data-testid="end-codex-count">
            · Codex {s.codex.length}/{FEAT_IDS.length}
          </small>
        </h3>
        {c.lineage.feats.length ? (
          <FeatChips ids={c.lineage.feats.map((f) => f.id)} fresh={s.newFeats} testId="end-feats" />
        ) : (
          <p className="dim">None this time.</p>
        )}
        <h3>Ideas for the next lineage</h3>
        <ul className="ideas" data-testid="next-ideas">
          {nextIdeas(c, s.codex).map((x) => (
            <li key={x.head}>
              <b>{x.head}.</b> {x.body}
            </li>
          ))}
        </ul>
        <p className="score-total">
          Seed {c.seed} · {getScenario(c.scenario).name} · {DIFFICULTY[c.difficulty].name}
          {s.runDaily ? ` · Daily Ruins ${s.runDaily}` : ''}
          {s.branch !== null && (
            <span data-testid="branch-mark"> · a branch from Age {ROMAN[s.branch]}, not ranked</span>
          )}
        </p>
        {branchAges.length > 0 && (
          <p className="dim small" data-testid="replay-note">
            Replaying an age starts a branch from its founding: everything after it is played again. Its feats
            count; it is never ranked against straight lineages.
          </p>
        )}
        <div className="end-actions">
          <button
            type="button"
            className="btn primary big"
            data-testid="play-again"
            data-autofocus
            onClick={() => {
              clearSave();
              s.newGame(c.seed, undefined, c.scenario, c.difficulty, s.runDaily ?? undefined);
            }}
          >
            Play again
          </button>
          {branchAges.map((e) => (
            <button
              key={e}
              type="button"
              className="btn"
              data-testid={`replay-age-${e}`}
              onClick={() => s.branchFrom(e)}
            >
              Replay from Age {ROMAN[e]}
            </button>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() => {
              clearSave();
              s.newGame(
                ((c.seed * 1103515245 + 12345) >>> 0) % 99999 || 1,
                undefined,
                c.scenario,
                c.difficulty,
              );
            }}
          >
            New valley
          </button>
          <button
            type="button"
            className="btn"
            data-testid="copy-link"
            onClick={() => {
              const url = `${location.origin}${location.pathname}${shareQuery({ seed: c.seed, scenario: c.scenario, difficulty: c.difficulty, daily: s.runDaily ?? undefined })}`;
              void navigator.clipboard?.writeText(url).then(
                () => s.showToast('Link to this valley copied.', 'good'),
                () => s.showToast(url, 'info'),
              );
            }}
          >
            Copy link to this valley
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              clearSave();
              s.quitToTitle();
            }}
          >
            Title
          </button>
        </div>
      </div>
    </div>
  );
}
