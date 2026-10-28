import { deserialize, serialize } from '../engine';
import type { Campaign } from '../engine';

const SAVE_KEY = 'epoch60.save.v1';
/** The Daily Ruins date a saved run started on (kept beside the save, which is engine state and knows no dates). */
const DAILY_KEY = 'epoch60.save-daily.v1';
const SETTINGS_KEY = 'epoch60.settings.v1';

export interface Settings {
  assisted: boolean;
  reducedMotion: boolean;
  quality: 'auto' | 'high' | 'medium' | 'low';
  sound: boolean;
  musicVolume: number;
  sfxVolume: number;
  showTutorial: boolean;
}

/** Honour the operating system's "reduce motion" preference until the player chooses otherwise. */
function osReducedMotion(): boolean {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export const DEFAULT_SETTINGS: Settings = {
  assisted: false,
  reducedMotion: false,
  quality: 'auto',
  sound: true,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  showTutorial: true,
};

/** The browser's localStorage, or null where it is missing or refused (private modes, tests, server render). */
export function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveCampaign(c: Campaign): boolean {
  const s = safeStorage();
  if (!s) return false;
  try {
    s.setItem(SAVE_KEY, serialize(c));
    return true;
  } catch {
    return false;
  }
}

export function hasSave(): boolean {
  const s = safeStorage();
  try {
    return !!s && s.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Returns null when there is no usable save (missing, corrupt or from another schema). */
export function loadCampaign(): Campaign | null {
  const s = safeStorage();
  if (!s) return null;
  try {
    const text = s.getItem(SAVE_KEY);
    return text ? deserialize(text) : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    safeStorage()?.removeItem(SAVE_KEY);
    safeStorage()?.removeItem(DAILY_KEY);
  } catch {
    /* ignore */
  }
}

/** Remember (or forget, with null) that the saved run is the Daily Ruins of `day`. */
export function saveDailyTag(seed: number, day: string | null): void {
  try {
    const s = safeStorage();
    if (!s) return;
    if (day) s.setItem(DAILY_KEY, JSON.stringify({ seed, day }));
    else s.removeItem(DAILY_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * The Daily Ruins date of the saved run with this seed, or null. The tag is trusted only when that date's daily
 * really is this seed, so an edited entry cannot pass an ordinary run off as a daily.
 */
export function loadDailyTag(seed: number, dailySeed: (day: string) => number): string | null {
  try {
    const raw = safeStorage()?.getItem(DAILY_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { seed?: unknown; day?: unknown };
    if (v.seed !== seed || typeof v.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.day)) return null;
    return dailySeed(v.day) === seed ? v.day : null;
  } catch {
    return null;
  }
}

/** Field-by-field: anything missing, mistyped or out of range falls back to the default (stored data is untrusted). */
export function sanitizeSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const bool = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
  const vol = (x: unknown, d: number) =>
    typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : d;
  const quality = v.quality;
  return {
    assisted: bool(v.assisted, base.assisted),
    reducedMotion: bool(v.reducedMotion, base.reducedMotion),
    quality:
      quality === 'auto' || quality === 'high' || quality === 'medium' || quality === 'low'
        ? quality
        : base.quality,
    sound: bool(v.sound, base.sound),
    musicVolume: vol(v.musicVolume, base.musicVolume),
    sfxVolume: vol(v.sfxVolume, base.sfxVolume),
    showTutorial: bool(v.showTutorial, base.showTutorial),
  };
}

export function loadSettings(): Settings {
  const s = safeStorage();
  const base = { ...DEFAULT_SETTINGS, reducedMotion: osReducedMotion() };
  try {
    const raw = s?.getItem(SETTINGS_KEY);
    if (raw) return sanitizeSettings(JSON.parse(raw), base);
  } catch {
    /* ignore */
  }
  return base;
}

export function saveSettings(settings: Settings): void {
  try {
    safeStorage()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
