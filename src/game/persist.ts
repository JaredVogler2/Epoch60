import { deserialize, serialize } from '../engine';
import type { Campaign } from '../engine';

const SAVE_KEY = 'epoch60.save.v1';
const SETTINGS_KEY = 'epoch60.settings.v1';

export interface Settings {
  assisted: boolean;
  reducedMotion: boolean;
  quality: 'auto' | 'high' | 'medium' | 'low';
  sound: boolean;
  showTutorial: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  assisted: false,
  reducedMotion: false,
  quality: 'auto',
  sound: true,
  showTutorial: true,
};

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveCampaign(c: Campaign): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(SAVE_KEY, serialize(c));
    return true;
  } catch {
    return false;
  }
}

export function hasSave(): boolean {
  const s = storage();
  try {
    return !!s && s.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Returns null when there is no usable save (missing, corrupt or from another schema). */
export function loadCampaign(): Campaign | null {
  const s = storage();
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
    storage()?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadSettings(): Settings {
  const s = storage();
  try {
    const raw = s?.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings): void {
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
