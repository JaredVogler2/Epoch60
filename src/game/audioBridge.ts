import type { Campaign } from '../engine';
import { audio } from './audio';
import type { Sfx } from './audio';

/** What the bridge remembered about the last campaign state it looked at. */
export interface Seen {
  campaign: Campaign | null;
  epoch: number;
  events: number;
  phase: string;
  prompts: number;
}

export const NOTHING_SEEN: Seen = { campaign: null, epoch: -1, events: 0, phase: '', prompts: 0 };

const EVENT_SOUND: [RegExp, Sfx][] = [
  [/^build\.complete$/, 'complete'],
  [/^build\.start$/, 'place'],
  [/^research\.done$/, 'research'],
  [/^forecast\.\d$/, 'warning'],
  [/^story\.open\./, 'story'],
  [/^epoch\.begin$/, 'begin'],
  [/^epoch\.founded$/, 'found'],
];

/**
 * Pure mapping from "what changed in the game" to sounds and a music mood. No audio objects are touched here, so it
 * can be tested exhaustively without a browser.
 */
export function soundsFor(
  seen: Seen,
  c: Campaign | null,
): { sfx: Sfx[]; next: Seen; era: number; tension: number } {
  if (!c) return { sfx: [], next: NOTHING_SEEN, era: 0, tension: 0 };
  const sfx: Sfx[] = [];
  const fresh = seen.campaign !== c || seen.epoch !== c.epoch;
  const from = fresh ? 0 : seen.events;
  // Only the newest few events can matter; a loaded game must not replay a whole epoch of sound.
  const start = fresh ? Math.max(0, c.events.length - 3) : from;
  for (let i = start; i < c.events.length; i++) {
    const code = c.events[i]!.code;
    for (const [re, s] of EVENT_SOUND) {
      if (re.test(code)) {
        sfx.push(s);
        break;
      }
    }
  }
  if (!fresh && c.phase !== seen.phase) {
    if (c.phase === 'COLLAPSING' && c.report) sfx.push(c.report.hazard);
    else if (c.phase === 'VICTORY') sfx.push('victory');
    else if (c.phase === 'DEFEAT') sfx.push('defeat');
  }
  // At most three sounds per observation, and never the same sound twice in one go.
  const out = [...new Set(sfx)].slice(0, 3);
  let tension = 0;
  if (c.phase === 'ACTIVE') tension = Math.max(0, Math.min(1, (c.tick - 350) / 250));
  else if (c.phase === 'COLLAPSING') tension = 1;
  return {
    sfx: out,
    next: { campaign: c, epoch: c.epoch, events: c.events.length, phase: c.phase, prompts: c.prompts.length },
    era: c.epoch,
    tension,
  };
}

/** Connect the game to the audio engine: gestures unlock it, state changes drive it, pausing silences it. */
export function attachAudio(store: {
  subscribe: (fn: () => void) => () => void;
  campaign: Campaign | null;
  screen: string;
  settings: { sound: boolean; musicVolume: number; sfxVolume: number };
}): () => void {
  let seen: Seen = NOTHING_SEEN;
  const unlock = () => audio.unlock();
  const press = (e: Event) => {
    const t = e.target as HTMLElement | null;
    if (audio.unlocked && t?.closest?.('button')) audio.play('click');
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  window.addEventListener('click', press);
  const sync = () => {
    audio.configure({
      sound: store.settings.sound,
      musicVolume: store.settings.musicVolume,
      sfxVolume: store.settings.sfxVolume,
    });
    const c = store.campaign;
    const r = soundsFor(seen, c);
    seen = r.next;
    for (const s of r.sfx) audio.play(s);
    audio.setMood(r.era, r.tension);
    const quiet =
      document.hidden || (c !== null && store.screen === 'game' && c.phase === 'ACTIVE' && c.paused);
    audio.setActive(!quiet);
  };
  const off = store.subscribe(sync);
  const vis = () => sync();
  document.addEventListener('visibilitychange', vis);
  return () => {
    off();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('click', press);
    document.removeEventListener('visibilitychange', vis);
  };
}
