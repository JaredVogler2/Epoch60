import { useEffect, useRef } from 'react';
import {
  BUILDINGS,
  REINFORCE_BONUS,
  TECHS,
  UNIT,
  repairBlocked,
  repairCost,
  ruinYield,
  techCost,
} from '../engine';
import type { HazardKind, LaborFocus, ResourceKey, Structure, TechId } from '../engine';
import { currentSpec } from '../engine';
import { Icon, RESOURCE_ICON, hazardIcon } from './icons';
import { units } from './format';
import { ruinFacts } from './ruins';
import { useStore } from './useStore';
import { useDialog } from './useDialog';

function CostLine({ cost }: { cost: Record<ResourceKey, number> }) {
  const keys = (Object.keys(cost) as ResourceKey[]).filter((k) => cost[k] > 0);
  return (
    <span className="costline">
      {keys.map((k) => (
        <span key={k} className="cost">
          <Icon name={RESOURCE_ICON[k]} size={14} />
          {Math.ceil(cost[k] / UNIT)}
        </span>
      ))}
    </span>
  );
}

function statusLabel(s: Structure): string {
  const d = BUILDINGS[s.kind];
  switch (s.status) {
    case 'constructing': {
      const pct = Math.min(100, Math.round(s.progress / Math.max(1, d.buildWork * 10)));
      return s.repairs > 0 ? `Repairing — ${pct}%` : `Under construction — ${pct}%`;
    }
    case 'active':
      return s.workers < d.workers
        ? 'Working (short-handed)'
        : d.workers > 0 || d.housing > 0
          ? 'Working'
          : 'Standing';
    case 'damaged':
      return 'Damaged';
    case 'rubble':
      return 'Ruin';
    case 'buried':
      return 'Buried ruin';
  }
}

/** A ruin's story and what it is worth now: who built it, for what, how it fell, what clearing or restoring does. */
function RuinFactsView() {
  const s = useStore();
  const c = s.campaign!;
  const st = c.structures.find((x) => x.id === s.selectedId)!;
  const f = ruinFacts(c, st);
  return (
    <div className="ruin-facts" data-testid="ruin-facts">
      <p className="blurb" data-testid="ruin-built">
        {f.built} {f.purpose}
      </p>
      <p className="blurb" data-testid="ruin-fell">
        {f.fell}
      </p>
      {/* Once dug up, what it held has been taken: only an unexcavated ruin still has a survey to tell. */}
      {!st.excavated &&
        (st.surveyed ? (
          <p className="blurb">{ruinYield(st).note}</p>
        ) : (
          <p className="blurb dim">What lies beneath is unknown until it is surveyed between ages.</p>
        ))}
      <ul className="facts">
        <li data-testid="ruin-clear">
          <Icon name="trash" size={14} /> {f.clear}
        </li>
        <li data-testid="ruin-restore">
          <Icon name="wrench" size={14} /> {f.restore}
        </li>
      </ul>
    </div>
  );
}

export function Inspector() {
  const s = useStore();
  const c = s.campaign!;
  const st = s.selectedId !== null ? c.structures.find((x) => x.id === s.selectedId) : undefined;
  if (!st) return null;
  const d = BUILDINGS[st.kind];
  const f = s.getForecastCached();
  const impact = f?.predicted.impacts.find((i) => i.id === st.id);
  const ruin = st.status === 'rubble' || st.status === 'buried';
  const timed = c.phase === 'ACTIVE' || c.phase === 'PREPARE';
  const hz = currentSpec(c).hazard.kind as HazardKind;
  const rc = repairCost(st);
  // A restorable ruin over its kind's limit still shows the button, disabled, so the reason is visible.
  const repairWhy = repairBlocked(c, st);
  const canRepair = timed && (!repairWhy || repairWhy.code === 'limit_reached');
  const canReinforce =
    (st.status === 'active' || st.status === 'damaged') && st.bonus[hz] < REINFORCE_BONUS && timed;
  const resist = (k: HazardKind) => Math.round((d.resist[k] + st.bonus[k]) / 10);
  return (
    <aside className="inspector" data-testid="inspector" aria-label={`${d.name} details`}>
      <header>
        <Icon name={st.kind} size={28} />
        <div className="insp-title">
          <b>{d.name}</b>
          <small data-testid="insp-status">{statusLabel(st)}</small>
        </div>
        <button type="button" className="btn-icon sm" aria-label="Close" onClick={() => s.select(null)}>
          <Icon name="close" size={18} />
        </button>
      </header>
      {!ruin && (
        <>
          <p className="blurb">{d.blurb}</p>
          <ul className="facts">
            {d.workers > 0 && st.status !== 'constructing' && (
              <li>
                <Icon name="people" size={14} /> Workers {st.workers}/{d.workers}
              </li>
            )}
            {d.housing > 0 && (
              <li>
                <Icon name="cottage" size={14} /> Shelters{' '}
                {st.status === 'damaged' ? Math.floor(d.housing / 2) : d.housing}
              </li>
            )}
            {d.retains > 0 && (
              <li>
                <Icon name="knowledge" size={14} /> Carries{' '}
                {d.retains + (c.civ.techs.includes('writing') ? 2 : 0)} technologies through a collapse
              </li>
            )}
            <li>
              <Icon name="fire" size={14} /> {resist('fire')}% · <Icon name="flood" size={14} />{' '}
              {resist('flood')}% · <Icon name="quake" size={14} /> {resist('quake')}% resistance
            </li>
          </ul>
          {impact && impact.after !== 'active' && (
            <div className={`risk-box ${impact.after}`} data-testid="insp-risk">
              <Icon name={hazardIcon(hz)} size={18} />
              <span>
                {impact.after === 'rubble' ? 'Will be destroyed' : 'Will be damaged'} by the{' '}
                {currentSpec(c).hazard.name.toLowerCase()}. {impact.reason}
              </span>
            </div>
          )}
          {impact && impact.after === 'active' && (
            <div className="risk-box safe">
              Safe from the coming {currentSpec(c).hazard.name.toLowerCase()}.
            </div>
          )}
        </>
      )}
      {ruin && <RuinFactsView />}
      <div className="insp-actions">
        {st.status === 'constructing' && st.repairs === 0 && timed && (
          <button
            type="button"
            className="btn"
            data-testid="act-cancel"
            onClick={() => s.dispatch({ type: 'cancel', id: st.id })}
          >
            <Icon name="close" size={18} /> Cancel
          </button>
        )}
        {canRepair && (
          <button
            type="button"
            className="btn"
            data-testid="act-repair"
            disabled={!!repairWhy}
            title={repairWhy?.message}
            onClick={() => s.dispatch({ type: 'repair', id: st.id })}
          >
            <Icon name="wrench" size={18} /> {ruin ? 'Restore' : 'Repair'} <CostLine cost={rc} />
          </button>
        )}
        {canReinforce && (
          <button
            type="button"
            className="btn"
            data-testid="act-reinforce"
            onClick={() => s.dispatch({ type: 'reinforce', id: st.id, hazard: hz })}
          >
            <Icon name="shield" size={18} /> Reinforce vs {hz}
          </button>
        )}
        {timed && st.kind !== 'hearth' && st.status !== 'constructing' && (
          <button
            type="button"
            className="btn ghost"
            data-testid="act-demolish"
            onClick={() => {
              s.dispatch({ type: 'demolish', id: st.id });
              s.select(null);
            }}
          >
            <Icon name="trash" size={18} /> {ruin ? 'Clear ruin' : 'Demolish'}
          </button>
        )}
      </div>
    </aside>
  );
}

export function ResearchPanel() {
  const s = useStore();
  const c = s.campaign!;
  if (s.panel !== 'research') return null;
  const techs = Object.values(TECHS).filter((t) => t.enabled);
  return (
    <section className="panel" data-testid="research-panel" aria-label="Research">
      <header>
        <h2>Research</h2>
        <button type="button" className="btn-icon sm" aria-label="Close" onClick={() => s.closePanel()}>
          <Icon name="close" size={18} />
        </button>
      </header>
      <p className="dim">
        One discovery at a time. Only what an Archive (or the people's memory) carries survives a collapse.
      </p>
      <div className="tech-list">
        {techs.map((t) => {
          const known = c.civ.techs.includes(t.id);
          const active = c.civ.research?.tech === t.id;
          const prereq = t.requires.filter((r) => !c.civ.techs.includes(r));
          const cost = techCost(c, t.id);
          const lost = c.lineage.lostTechs.includes(t.id);
          const can =
            !known && !active && prereq.length === 0 && !c.civ.research && c.civ.res.knowledge >= cost;
          return (
            <article
              key={t.id}
              className={`tech ${known ? 'known' : ''} ${active ? 'active' : ''}`}
              data-testid={`tech-${t.id}`}
            >
              <div className="tech-head">
                <b>{t.name}</b>
                <span className={`tag ${t.branch}`}>{t.branch}</span>
              </div>
              <p>{t.blurb}</p>
              <div className="tech-foot">
                <span className="cost">
                  <Icon name="knowledge" size={14} /> {Math.ceil(cost / UNIT)}
                  {lost && <em> (remembered)</em>}
                </span>
                <span className="dim">{(t.ticks / 10).toFixed(0)} s</span>
                <button
                  type="button"
                  className="btn primary sm"
                  disabled={!can}
                  data-testid={`research-${t.id}`}
                  onClick={() => s.dispatch({ type: 'research', tech: t.id as TechId })}
                >
                  {known
                    ? 'Known'
                    : active
                      ? `${Math.ceil((c.civ.research?.remaining ?? 0) / 10)} s…`
                      : prereq.length
                        ? `Needs ${TECHS[prereq[0]!].name}`
                        : 'Research'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const FOCI: { id: LaborFocus; label: string; icon: string; note: string }[] = [
  { id: 'balanced', label: 'Balanced', icon: 'people', note: 'Food, timber, stone, knowledge in turn.' },
  { id: 'build', label: 'Build first', icon: 'workshop', note: '70% of hands go to construction.' },
  { id: 'food', label: 'Food', icon: 'food', note: 'Farms staffed before anything else.' },
  { id: 'timber', label: 'Timber', icon: 'timber', note: 'Lumber camps first.' },
  { id: 'stone', label: 'Stone', icon: 'stone', note: 'Quarries first.' },
  { id: 'knowledge', label: 'Knowledge', icon: 'knowledge', note: 'Archives first.' },
];

export function FocusPanel() {
  const s = useStore();
  const c = s.campaign!;
  if (s.panel !== 'focus') return null;
  return (
    <section className="panel" data-testid="focus-panel" aria-label="Worker focus">
      <header>
        <h2>Where should hands go?</h2>
        <button type="button" className="btn-icon sm" aria-label="Close" onClick={() => s.closePanel()}>
          <Icon name="close" size={18} />
        </button>
      </header>
      <p className="dim">
        {c.civ.labor.builders} building · {c.civ.labor.idle} idle · {c.civ.pop} people
      </p>
      <div className="focus-list">
        {FOCI.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`focus ${c.civ.focus === f.id ? 'selected' : ''}`}
            data-testid={`focus-${f.id}`}
            onClick={() => {
              s.dispatch({ type: 'setFocus', focus: f.id });
              s.closePanel();
            }}
          >
            <Icon name={f.icon} size={22} />
            <b>{f.label}</b>
            <small>{f.note}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function HelpPanel() {
  const s = useStore();
  if (s.panel !== 'help') return null;
  return (
    <section className="panel" data-testid="help-panel" aria-label="How to play">
      <header>
        <h2>How to play</h2>
        <button type="button" className="btn-icon sm" aria-label="Close" onClick={() => s.closePanel()}>
          <Icon name="close" size={18} />
        </button>
      </header>
      <ol className="howto">
        <li>
          You have <b>60 active seconds</b> to build a civilization. The clock only runs while the game is
          open and unpaused.
        </li>
        <li>Pick a building, tap the valley to place it. Green means legal; red hatching says why not.</li>
        <li>
          The striped overlay is the <b>exact</b> path of the coming disaster. Build out of it, block it, or
          reinforce.
        </li>
        <li>
          When time ends, the world collapses — but ruins, scars, forests and knowledge <b>stay</b> for the
          next people.
        </li>
        <li>
          Archives carry technology through collapse. Between epochs you may dig up one ruin and choose where
          to begin again.
        </li>
      </ol>
    </section>
  );
}

export function Toast() {
  const s = useStore();
  const t = s.toast;
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => s.clearToast(), t.tone === 'error' ? 4200 : 2600);
    return () => clearTimeout(id);
  }, [t, s]);
  if (!t || !t.text) return null;
  return (
    <div className={`toast ${t.tone}`} role="status" data-testid="toast">
      {t.text}
    </div>
  );
}

const PAUSE_TEXT: Record<string, string> = {
  user: 'Paused. The clock is stopped and nothing is happening.',
  hidden: 'Paused while you were away. No time passed in the valley.',
  stalled: 'Paused because the device stalled. No time was lost.',
  reload: 'Welcome back. Your civilization is waiting at exactly the second you left it.',
  graphics: 'Paused while the graphics restarted. No time was lost.',
};

export function PauseOverlay() {
  const s = useStore();
  const c = s.campaign!;
  if (!(c.phase === 'ACTIVE' && c.paused)) return null;
  return <PauseDialog />;
}

function PauseDialog() {
  const s = useStore();
  const c = s.campaign!;
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, () => s.resume());
  return (
    <div
      ref={ref}
      className="overlay pause"
      data-testid="pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Paused"
    >
      <div className="card-modal">
        <h2>Paused</h2>
        <p>{PAUSE_TEXT[s.pauseReason ?? 'user']}</p>
        <p className="dim">
          {(c.tick / 10).toFixed(1)} s elapsed · {((600 - c.tick) / 10).toFixed(1)} s left
        </p>
        <button
          type="button"
          className="btn primary big"
          data-testid="resume"
          data-autofocus
          onClick={() => s.resume()}
        >
          <Icon name="play" size={22} /> Resume
        </button>
        <button type="button" className="btn ghost" onClick={() => s.quitToTitle()}>
          Save &amp; quit to title
        </button>
      </div>
    </div>
  );
}

export { units };
