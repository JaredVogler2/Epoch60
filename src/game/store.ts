import {
  BUILDINGS,
  checkPlacement,
  createCampaign,
  dispatchAction,
  footprint,
  getCatalog,
  getForecast,
  setPaused,
} from '../engine';
import type { CatalogEntry } from '../engine';
import type {
  Action,
  ActionResult,
  BuildingKind,
  Campaign,
  Forecast,
  GameMode,
  PlacementOk,
  ActionError,
} from '../engine';
import { createDemoCampaign } from './demo';
import { explain } from './messages';
import {
  DEFAULT_SETTINGS,
  clearSave,
  loadCampaign,
  loadSettings,
  saveCampaign,
  saveSettings,
} from './persist';
import type { Settings } from './persist';

export type PauseReason = 'user' | 'hidden' | 'stalled' | 'reload';
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

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = (): number => this.version;

  private emit(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  /* ------------------------------ lifecycle ------------------------------ */

  newGame(seed: number = CANON_SEED, mode?: GameMode): void {
    const m: GameMode = mode ?? (this.settings.assisted ? 'assisted' : 'standard');
    this.campaign = createCampaign(seed, m);
    this.afterReplace();
    this.clockResetSeq++;
    this.screen = 'game';
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
    this.afterReplace();
    this.screen = 'game';
    if (c.phase === 'ACTIVE') this.pauseReason = 'reload';
    this.emit();
    return true;
  }

  /** Adopt an existing campaign (used by tests and the browser debug hooks). */
  adopt(c: Campaign): void {
    this.campaign = c;
    this.afterReplace();
    this.screen = 'game';
    this.emit();
  }

  quitToTitle(): void {
    if (this.campaign) {
      if (this.campaign.phase === 'ACTIVE') this.pause('user');
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
    this.emit();
  }

  private onPhaseChange(phase: string): void {
    this.lastPhase = phase;
    this.skipRequested = false;
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
      s += `${st.id}:${st.status}:${st.bonus.fire + st.bonus.flood + st.bonus.quake};`;
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
    this.emit();
    return r;
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
    this.emit();
  }

  cancelPlacing(): void {
    if (!this.placing) return;
    this.placing = null;
    this.ghost = null;
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
