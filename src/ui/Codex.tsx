import {
  BUILDINGS,
  DIFFICULTY,
  FEATS,
  FEAT_GROUPS,
  FEAT_IDS,
  SCENARIOS,
  TECHS,
  getScenario,
} from '../engine';
import type { Campaign, FeatGroup, FeatId } from '../engine';
import type { CodexEntry } from '../game/codex';
import { ROMAN } from './format';
import { Icon, hazardIcon } from './icons';

const GROUPS = Object.keys(FEAT_GROUPS) as FeatGroup[];
const where = (id: FeatId) =>
  FEATS[id].scenarios ? ` (${FEATS[id].scenarios!.map((s) => SCENARIOS[s]?.name ?? s).join(', ')})` : '';

/** Every feat, earned or not. Only Codex entries (copied from played lineages) are ever shown as earned. */
export function CodexList({ codex }: { codex: CodexEntry[] }) {
  const byId = new Map(codex.map((e) => [e.id, e]));
  return (
    <div className="codex" data-testid="codex">
      <p className="codex-count" data-testid="codex-count">
        <b>{codex.length}</b> of {FEAT_IDS.length} feats recorded on this device
      </p>
      {GROUPS.map((g) => (
        <section key={g} className="codex-group">
          <h4>{FEAT_GROUPS[g]}</h4>
          <ul>
            {FEAT_IDS.filter((id) => FEATS[id].group === g).map((id) => {
              const e = byId.get(id);
              const d = FEATS[id];
              return (
                <li
                  key={id}
                  className={`feat ${e ? 'earned' : 'locked'}`}
                  data-testid={`feat-${id}`}
                  data-earned={e ? 'yes' : 'no'}
                >
                  <span className="feat-mark" aria-hidden="true">
                    {e ? <Icon name="check" size={16} /> : <span className="feat-dot" />}
                  </span>
                  <span className="feat-text">
                    <b>{d.name}</b>
                    <span className="sr-only">{e ? ' (earned)' : ' (not yet earned)'}</span>
                    <small>
                      {d.how}
                      {where(id)}
                    </small>
                    {e && (
                      <>
                        <small className="feat-lesson">{d.lesson}</small>
                        <small className="feat-when">
                          {e.at.slice(0, 10)} · {SCENARIOS[e.scenario]?.name ?? e.scenario} ·{' '}
                          {DIFFICULTY[e.difficulty].name} · seed {e.seed}
                          {e.mode === 'assisted' ? ' · assisted' : ''}
                          {e.daily ? ` · Daily Ruins ${e.daily}` : ''}
                        </small>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Feats a lineage earned (in the order earned), marking the ones this device had never seen before. */
export function FeatChips({ ids, fresh, testId }: { ids: FeatId[]; fresh: FeatId[]; testId: string }) {
  if (!ids.length) return null;
  return (
    <ul className="feat-chips" data-testid={testId}>
      {ids.map((id) => (
        <li key={id} className={fresh.includes(id) ? 'fresh' : ''} title={FEATS[id].how}>
          <Icon name="star" size={14} /> {FEATS[id].name}
          {fresh.includes(id) && <span className="tag">new</span>}
        </li>
      ))}
    </ul>
  );
}

/** The most valuable technology a society knew when its age ended. */
function bestInvention(techs: string[]): string | null {
  const known = techs.filter((t): t is keyof typeof TECHS => t in TECHS);
  known.sort((a, b) => TECHS[b].cost - TECHS[a].cost || (a < b ? -1 : 1));
  return known[0] ? TECHS[known[0]].name : null;
}

/** One entry per age, from the collapse reports the lineage kept: who lived, what struck, what stood, why. */
export function AtlasOfAges({ c }: { c: Campaign }) {
  const scenario = getScenario(c.scenario);
  return (
    <ol className="atlas" data-testid="atlas">
      {c.lineage.reports.map((r) => {
        const spec = scenario.epochs[r.epoch];
        const landmarks = r.heritage
          .map((id) => c.structures.find((s) => s.id === id))
          .filter((s) => !!s)
          .map((s) => BUILDINGS[s.kind].name);
        const invention = bestInvention([...r.retainedTechs, ...r.lostTechs]);
        const feats = c.lineage.feats.filter((f) => f.epoch === r.epoch).map((f) => FEATS[f.id].name);
        return (
          <li key={r.epoch} className="atlas-age" data-testid="atlas-age">
            <p className="atlas-head">
              <span className="roman">{ROMAN[r.epoch]}</span>
              <b>{spec?.name ?? `Age ${r.epoch + 1}`}</b>
              <span className="dim"> · {spec?.ageName}</span>
            </p>
            <p className="atlas-facts">
              <span>
                <Icon name={hazardIcon(r.hazard)} size={14} /> {r.hazardName}
              </span>
              <span>
                <Icon name="people" size={14} /> {r.survivorsBefore} → {r.survivors}
              </span>
              <span>
                <Icon name="knowledge" size={14} /> {invention ?? 'no technology'}
                {r.lostTechs.length > 0 && <span className="neg"> ({r.lostTechs.length} forgotten)</span>}
              </span>
              <span>
                <Icon name="hearth" size={14} /> {landmarks.length ? landmarks.join(', ') : 'no landmark'}{' '}
                standing
              </span>
              <span>
                <Icon name="grove" size={14} /> ecology {r.score.ecology}
              </span>
            </p>
            <p className="atlas-cause">{r.causes[0]}</p>
            {feats.length > 0 && <p className="atlas-feats">Feats: {feats.join(', ')}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export interface Idea {
  head: string;
  body: string;
}

/**
 * Concrete things to try next, drawn from this lineage: first what it lacked when the end came, then a feat this
 * device has not seen yet that the scenario allows, then another valley or difficulty. Always at least two.
 */
export function nextIdeas(c: Campaign, codex: CodexEntry[]): Idea[] {
  const out: Idea[] = [];
  const v = c.report?.verdict;
  if (v && v.outcome === 'defeat') {
    // A final verdict lists people, landmarks and knowledge in that order; an early end has one condition (founders).
    const [people, landmarks, knowledge] = v.conditions;
    if (v.conditions.length === 1)
      out.push({
        head: 'Shelter first',
        body: 'Put homes outside the striped forecast path before anything else, so enough people live to begin again.',
      });
    else {
      if (people && !people.met)
        out.push({
          head: `Keep more people alive (${people.have} of ${people.need})`,
          body: "Homes out of the last catastrophe's path, and food put by before it comes.",
        });
      if (landmarks && !landmarks.met)
        out.push({
          head: 'Keep a landmark from an earlier age',
          body: 'Found the next society within a cell of a standing hearth, or raise a Seed Vault, a Dam or a Bridge where no later disaster reaches.',
        });
      if (knowledge && !knowledge.met)
        out.push({
          head: `Carry more knowledge (${knowledge.have} of ${knowledge.need})`,
          body: "An Archive out of the later disasters' way, and Writing so it holds five technologies.",
        });
    }
  }
  const have = new Set(codex.map((e) => e.id));
  for (const id of FEAT_IDS) {
    if (out.length >= 3) break;
    const d = FEATS[id];
    if (have.has(id) || d.group === 'endings' || (d.scenarios && !d.scenarios.includes(c.scenario))) continue;
    out.push({ head: d.name, body: `${d.how} ${d.lesson}` });
  }
  if (out.length < 2) {
    const other = Object.values(SCENARIOS).find((s) => s.id !== c.scenario);
    if (other)
      out.push({
        head: `Another valley: ${other.name}`,
        body: `${other.epochs.map((e) => e.hazard.name).join(', ')}.`,
      });
  }
  if (out.length < 2 && c.difficulty !== 'hard') out.push({ head: 'Hard', body: DIFFICULTY.hard.blurb });
  return out.slice(0, 3);
}
