export type QualityTier = 'high' | 'medium' | 'low';

export interface QualitySettings {
  tier: QualityTier;
  dpr: number;
  shadowMap: number;
  antialias: boolean;
  /** Multiplier on instanced vegetation counts. */
  foliage: number;
  grass: number;
  /** Vertex wind on crowns and grass. */
  wind: boolean;
}

export const TIERS: Record<QualityTier, Omit<QualitySettings, 'dpr'>> = {
  high: { tier: 'high', shadowMap: 2048, antialias: true, foliage: 1, grass: 1, wind: true },
  medium: { tier: 'medium', shadowMap: 1024, antialias: true, foliage: 0.8, grass: 0.55, wind: true },
  low: { tier: 'low', shadowMap: 1024, antialias: false, foliage: 0.6, grass: 0.25, wind: true },
};

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/** Pick a tier from the user setting and the device. Auto = phones medium, desktops high. */
export function resolveQuality(setting: 'auto' | QualityTier): QualitySettings {
  // `?quality=low|medium|high` overrides the setting (used by tests and for support).
  const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('quality');
  if (q === 'low' || q === 'medium' || q === 'high') setting = q;
  const tier: QualityTier = setting === 'auto' ? (isTouchDevice() ? 'medium' : 'high') : setting;
  const dprCap = tier === 'high' ? 2 : tier === 'medium' ? 1.75 : 1.25;
  const dpr = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, dprCap);
  return { ...TIERS[tier], dpr };
}
