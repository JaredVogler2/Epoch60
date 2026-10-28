import {
  BUILDINGS,
  FEATS,
  checkPlacement,
  createCampaign,
  dispatchAction,
  footprint,
  getCatalog,
  getForecast,
  setPaused,
} from '../engine';
import { suggestSpots } from '../engine/economy/suggest';
import type { SuggestedSpot } from '../engine/economy/suggest';
import type { CatalogEntry } from '../engine';
import type {
  Action,
  ActionResult,
  BuildingKind,
  Campaign,
  Difficulty,
  FeatId,
  Forecast,
  GameMode,
  PlacementOk,
  ActionError,
} from '../engine';
import { loadCodex, recordFeats } from './codex';
import type { CodexEntry } from './codex';
import { createDemoCampaign } from './demo';
import { cardOf, dailyRun, loadRuns, saveRun } from './modes';
import type { RunCard } from './modes';
import { explain } from './messages';
import {
  DEFAULT_SETTINGS,
  clearSave,
  loadCampaign,
  loadDailyTag,
  loadSettings,
  saveCampaign,
  saveDailyTag,
  saveSettings,
} from './persist';
import type { Settings } from './persist';

export type PauseReason = 'user' | 'hidden' | 'stalled' | 'reload' | 'graphics';
export type Screen = 'title' | 'game';
export type Panel = 'research' | 'focus' | 'help' | 'settings' | null;

export interface Placing {
  kind: BuildingKind;
  rot: 0 | 1;
  x: number | null;
  y: number | null;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'warn' | 'error' | 'good';
}

export const CANON_SEED = 6001;

/**
 * Runtime holder for the one authoritative Campaign plus all UI state. The campaign is mutated in place by
 * the engine; React reads it through `version` (any change) and the render layer through `worldRev` / `structRev`.
 */
export class GameStore {
  campaign: Campaign | null = null;
  screen: Screen = 'title';
  version = 0;
  worldRev = 0;
  structRev = 0;
  /** Bumped whenever the clock must forget its last frame time (begin, resume, new game). */
  clockResetSeq = 0;
  selectedId: number | null = null;
  /** Structure under the mouse (render-only affordance; set by the interaction layer, read every frame, never emitted). */
  hoverId: number | null = null;
  placing: Placing | null = null;
  ghost: { ok: true; info: PlacementOk } | { ok: false; error: ActionError } | null = null;
  showForecast = true;
  panel: Panel = null;
  toast: Toast | null = null;
  pauseReason: PauseReason | null = null;
  settings: Settings = loadSettings();
  /** One-shot camera focus request consumed by the camera rig. */
  focusRequest: { x: number; y: number; zoom?: number; id: number } | null = null;
  /** True once the collapse presentation is allowed to be skipped. */
  skipRequested = false;
  /** Interregnum selections (site, tradition, ruin under inspection). */
  inter: { site: number; tradition: string | null; ruin: number | null } = {
    site: 0,
    tradition: null,
    ruin: null,
  };
  /** Seconds the collapse presentation has played (read-only, drives animation). */
  collapseClock = 0;

  private listeners = new Set<() => void>();
  private lastWorldSig = 0;
  private lastStructSig = '';
  private forecastKey = '';
  private forecastValue: Forecast | null = null;
  private toastSeq = 0;
  private focusSeq = 0;
  private lastPhase = '';
  private lastSaveTick = -1;
  /** UTC date when the current run is a Daily Ruins challenge. */
  runDaily: string | null = null;
  /** Finished runs, newest first (local only). */
  runs: RunCard[] = loadRuns();
  /** Every feat this device has seen a lineage earn (local only). */
  codex: CodexEntry[] = loadCodex();
  /** Feats the current lineage brought into the Codex for the first time. */
  newFeats: FeatId[] = [];
  /** How many of the current lineage's feats have been copied into the Codex. */
  private seenFeats = 0;
  /** Cycling list of suggested sites for the building being placed (the keyboard / screen-reader path). */
  suggest: { kind: BuildingKind; key: string; spots: SuggestedSpot[]; i: number } | null = null;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = (): number => this.version;

  private emit(): void {
    this.version++;
    // One failing listener (audio, a view) must never starve the others or the clock.
    for (const l of this.listeners) {
      try {
        l();
      } catch (e) {
        console.error('[epoch60] listener failed', e);
      }
    }
  }

  /* ------------------------------ lifecycle ------------------------------ */

  newGame(
    seed: number = CANON_SEED,
    mode?: GameMode,
    scenarioId = 'greenvale',
    difficulty: Difficulty = 'normal',
    daily?: string,
  ): void {
    this.runDaily = daily ?? null;
    const m: GameMode = mode ?? (this.settings.assisted ? 'assisted' : 'standard');
    this.campaign = createCampaign(seed, m, scenarioId, difficulty);
    saveDailyTag(seed, this.runDaily);
    this.afterReplace();
    this.clockResetSeq++;
    this.screen = 'game';
    this.syncCodex(false);
    this.autosave(true);
    this.emit();
  }

  /** Notify subscribers that render-only state (the collapse presentation) changed. */
  bump(): void {
    this.emit();
  }

  /** Show a living (paused) village behind the title screen. */
  initDemo(): void {
    this.campaign = createDemoCampaign();
    this.afterReplace();
    this.screen = 'title';
    this.pauseReason = null;
  }

  /** Resume a saved game. An ACTIVE save always comes back paused. */
  continueGame(): boolean {
    const c = loadCampaign();
    if (!c) return false;
    this.campaign = c;
    this.runDaily = loadDailyTag(c.seed, (day) => dailyRun(day).seed);
    this.afterReplace();
    this.screen = 'game';
    this.syncCodex(false);
    if (c.phase === 'ACTIVE') this.pauseReason = 'reload';
    this.emit();
    return true;
  }

  /** Adopt an existing campaign (used by tests and the browser debug hooks). */
  adopt(c: Campaign): void {
    this.campaign = c;
    this.afterReplace();
    this.screen = 'game';
    this.syncCodex(false);
    this.emit();
  }

  quitToTitle(): void {
    const c = this.campaign;
    // A finished lineage is already on its run card; saving it again would bring the ending back as "Continue".
    if (c && c.phase !== 'VICTORY' && c.phase !== 'DEFEAT') {
      if (c.phase === 'ACTIVE') this.pause('user');
      this.autosave(true);
    }
    this.screen = 'title';
    this.placing = null;
    this.panel = null;
    this.emit();
  }

  abandonSave(): void {
    clearSave();
    this.emit();
  }

  private afterReplace(): void {
    this.selectedId = null;
    this.hoverId = null;
    this.placing = null;
    this.ghost = null;
    this.panel = null;
    this.toast = null;
    this.pauseReason = null;
    this.inter = { site: 0, tradition: null, ruin: null };
    this.collapseClock = 0;
    this.forecastKey = '';
    this.lastWorldSig = 0;
    this.lastStructSig = '';
    this.lastPhase = this.campaign?.phase ?? '';
    this.lastSaveTick = -1;
    this.seenFeats = 0;
    this.newFeats = [];
    this.refreshRevs();
    this.worldRev++;
    this.structRev++;
  }

  /* ------------------------------ time ------------------------------ */

  pause(reason: PauseReason): void {
    const c = this.campaign;
    if (!c || c.phase !== 'ACTIVE' || c.paused) return;
    setPaused(c, true);
    this.pauseReason = reason;
    this.autosave(true);
    this.emit();
  }

  resume(): void {
    const c = this.campaign;
    if (!c || c.phase !== 'ACTIVE') return;
    setPaused(c, false);
    this.pauseReason = null;
    this.clockResetSeq++;
    this.emit();
  }

  togglePause(): void {
    const c = this.campaign;
    if (!c || c.phase !== 'ACTIVE') return;
    if (c.paused) this.resume();
    else this.pause('user');
  }

  /** Called by the clock after it ran `n` ticks. */
  notifyTicks(_n: number): void {
    this.refreshRevs();
    const c = this.campaign;
    if (c) {
      if (c.phase !== this.lastPhase) this.onPhaseChange(c.phase);
      else if (c.tick - this.lastSaveTick >= 50) this.autosave(false);
    }
    this.syncCodex(true);
    this.emit();
  }

  private onPhaseChange(phase: string): void {
    this.lastPhase = phase;
    this.skipRequested = false;
    if (phase === 'VICTORY' || phase === 'DEFEAT') {
      const card = this.campaign ? cardOf(this.campaign, this.runDaily ?? undefined, new Date()) : null;
      if (card) this.runs = saveRun(card);
    }
    if (phase !== 'ACTIVE') {
      this.placing = null;
      this.ghost = null;
    }
    this.autosave(true);
  }

  private autosave(force: boolean): void {
    const c = this.campaign;
    if (!c) return;
    if (!force && c.tick === this.lastSaveTick) return;
    this.lastSaveTick = c.tick;
    saveCampaign(c);
  }

  private refreshRevs(): void {
    const c = this.campaign;
    if (!c) return;
    const w = c.world;
    let sig = 0;
    for (let i = 0; i < w.forest.length; i++) {
      sig =
        (Math.imul(sig, 31) +
          w.forest[i]! +
          w.fertility[i]! * 3 +
          w.scar[i]! * 7 +
          w.silt[i]! * 5 +
          w.height[i]! +
          w.rock[i]!) |
        0;
    }
    if (sig !== this.lastWorldSig) {
      this.lastWorldSig = sig;
      this.worldRev++;
    }
    let s = `${c.epoch}|`;
    for (const st of c.structures)
      s += `${st.id}:${st.status}:${st.bonus.fire}:${st.bonus.flood}:${st.bonus.quake}:${st.bonus.ash};`;
    if (s !== this.lastStructSig) {
      this.lastStructSig = s;
      this.structRev++;
    }
  }

  /* ------------------------------ actions ------------------------------ */

  /** Validate and send an action to the engine; surfaces failures as toasts. */
  dispatch(action: Action, opts: { quiet?: boolean } = {}): ActionResult {
    const c = this.campaign;
    if (!c) return { ok: false, code: 'wrong_phase', message: 'No game' };
    const r = dispatchAction(c, action);
    if (r.ok && action.type === 'beginEpoch') this.clockResetSeq++;
    if (r.ok && action.type === 'found') {
      // A new age opens framed on its new hearth.
      const h = [...c.structures]
        .reverse()
        .find((st) => st.kind === 'hearth' && (st.status === 'active' || st.status === 'damaged'));
      if (h) this.focusOn(h.x + h.w / 2, h.y + h.h / 2, 30);
    }
    if (!r.ok && !opts.quiet) this.showToast(explain(r), 'error');
    this.refreshRevs();
    if (c.phase !== this.lastPhase) this.onPhaseChange(c.phase);
    else if (r.ok && action.type !== 'setFocus') this.autosave(true);
    this.syncCodex(true);
    this.emit();
    return r;
  }

  /**
   * Copy the lineage's newly earned feats into the Codex. Feats earned in play or between ages are announced with a
   * toast; those a catastrophe brings are listed by the debrief and the ending instead. The title screen's demo
   * village never counts.
   */
  private syncCodex(announce: boolean): void {
    const c = this.campaign;
    if (!c || this.screen !== 'game' || c.lineage.feats.length === this.seenFeats) return;
    this.seenFeats = c.lineage.feats.length;
    const r = recordFeats(this.codex, c, this.runDaily, new Date());
    if (!r.added.length) return;
    this.codex = r.codex;
    this.newFeats = [...this.newFeats, ...r.added];
    if (announce && (c.phase === 'PREPARE' || c.phase === 'ACTIVE' || c.phase === 'INTERREGNUM'))
      this.toast = {
        id: ++this.toastSeq,
        text: `New in your Codex: ${r.added.map((id) => FEATS[id].name).join(', ')}.`,
        tone: 'good',
      };
  }

  showToast(text: string, tone: Toast['tone'] = 'info'): void {
    this.toast = { id: ++this.toastSeq, text, tone };
    this.emit();
  }

  clearToast(): void {
    if (this.toast) {
      this.toast = null;
      this.emit();
    }
  }

  updateSettings(patch: Partial<Settings>): void {
    this.settings = { ...DEFAULT_SETTINGS, ...this.settings, ...patch };
    saveSettings(this.settings);
    this.emit();
  }

  /* ------------------------------ selection and placement ------------------------------ */

  select(id: number | null): void {
    this.selectedId = id;
    if (id !== null) this.placing = null;
    this.emit();
  }

  focusOn(x: number, y: number, zoom?: number): void {
    this.focusRequest = { x, y, zoom, id: ++this.focusSeq };
    this.emit();
  }

  /** Open a side panel (toggling it off if already open). */
  togglePanel(p: Exclude<Panel, null>): void {
    this.panel = this.panel === p ? null : p;
    this.emit();
  }

  closePanel(): void {
    if (this.panel === null) return;
    this.panel = null;
    this.emit();
  }

  toggleForecast(): void {
    this.showForecast = !this.showForecast;
    this.emit();
  }

  /** Update interregnum selections (site, tradition, ruin under inspection). */
  setInter(patch: Partial<GameStore['inter']>): void {
    this.inter = { ...this.inter, ...patch };
    this.emit();
  }

  startPlacing(kind: BuildingKind): void {
    const c = this.campaign;
    if (!c || (c.phase !== 'PREPARE' && c.phase !== 'ACTIVE')) return;
    this.selectedId = null;
    this.placing = { kind, rot: 0, x: null, y: null };
    this.ghost = null;
    this.suggest = null;
    this.emit();
  }

  cancelPlacing(): void {
    if (!this.placing) return;
    this.placing = null;
    this.ghost = null;
    this.suggest = null;
    this.emit();
  }

  /**
   * Step to the next suggested site (safe-from-forecast first, then nearest the village) without any pointing:
   * the accessible, one-handed way to place a building.
   */
  suggestNext(): void {
    const c = this.campaign;
    const p = this.placing;
    if (!c || !p) return;
    const key = `${p.kind}:${this.structRev}:${Math.floor(c.tick / 40)}`;
    if (!this.suggest || this.suggest.key !== key || this.suggest.kind !== p.kind) {
      const f = this.getForecastCached();
      const avoid = f ? new Set(f.predicted.cells.map((h) => h.y * c.world.w + h.x)) : undefined;
      this.suggest = { kind: p.kind, key, spots: suggestSpots(c, p.kind, { avoid, limit: 12 }), i: -1 };
    }
    const sg = this.suggest;
    if (!sg.spots.length) {
      this.showToast('No legal site you can afford right now.', 'warn');
      return;
    }
    sg.i = (sg.i + 1) % sg.spots.length;
    const spot = sg.spots[sg.i]!;
    p.rot = spot.rot;
    p.x = spot.x;
    p.y = spot.y;
    this.updateGhost();
    this.focusOn(spot.x + spot.w / 2, spot.y + spot.h / 2);
    this.emit();
  }

  /** Move the ghost one cell (arrow keys). The first nudge adopts the first suggested site. */
  nudgePlacing(dx: number, dy: number): void {
    const c = this.campaign;
    const p = this.placing;
    if (!c || !p) return;
    if (p.x === null || p.y === null) {
      this.suggestNext();
      return;
    }
    const { w, h } = footprintOf(p.kind, p.rot);
    p.x = Math.max(0, Math.min(c.world.w - w, p.x + dx));
    p.y = Math.max(0, Math.min(c.world.h - h, p.y + dy));
    this.updateGhost();
    this.focusOn(p.x + w / 2, p.y + h / 2);
    this.emit();
  }

  rotatePlacing(): void {
    const p = this.placing;
    if (!p) return;
    p.rot = p.rot === 0 ? 1 : 0;
    this.updateGhost();
    this.emit();
  }

  /** Move the ghost's top-left cell so the footprint is centred on (cx, cy). */
  hoverCell(cx: number, cy: number): void {
    const p = this.placing;
    const c = this.campaign;
    if (!p || !c) return;
    const { w, h } = footprintOf(p.kind, p.rot);
    const x = Math.round(cx - w / 2);
    const y = Math.round(cy - h / 2);
    if (p.x === x && p.y === y) return;
    p.x = x;
    p.y = y;
    this.updateGhost();
    this.emit();
  }

  updateGhost(): void {
    const p = this.placing;
    const c = this.campaign;
    if (!p || !c || p.x === null || p.y === null) {
      this.ghost = null;
      return;
    }
    const r = checkPlacement(c, p.kind, p.x, p.y, p.rot);
    this.ghost = r.ok ? { ok: true, info: r } : { ok: false, error: r };
  }

  confirmPlacing(): ActionResult {
    const p = this.placing;
    if (!p || p.x === null || p.y === null)
      return { ok: false, code: 'bad_target', message: 'Choose a site first' };
    const r = this.dispatch({ type: 'build', kind: p.kind, x: p.x, y: p.y, rot: p.rot });
    if (r.ok) {
      this.showToast(`${footprintLabel(p.kind)} ordered`, 'good');
      // Stay in placement mode for rapid follow-up builds, but re-validate the same spot.
      this.updateGhost();
      this.placing = null;
      this.ghost = null;
      this.emit();
    }
    return r;
  }

  /* ------------------------------ forecast ------------------------------ */

  /** The build tray, with why each building is or is not available. */
  catalog(): CatalogEntry[] {
    const c = this.campaign;
    return c ? getCatalog(c) : [];
  }

  getForecastCached(): Forecast | null {
    const c = this.campaign;
    if (!c) return null;
    const key = `${this.structRev}:${this.worldRev}:${c.epoch}:${c.civ.techs.length}:${c.civ.traditions.length}`;
    if (key !== this.forecastKey || !this.forecastValue) {
      this.forecastKey = key;
      this.forecastValue = getForecast(c);
    }
    return this.forecastValue;
  }
}

function footprintOf(kind: BuildingKind, rot: 0 | 1): { w: number; h: number } {
  return footprint(kind, rot);
}
function footprintLabel(kind: BuildingKind): string {
  return BUILDINGS[kind].name;
}

export const store = new GameStore();
