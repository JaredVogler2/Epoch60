export type QualityTier = 'high' | 'medium' | 'low';

/**
 * The single source of truth for graphics scaling. Every tier keeps the same art direction: the low tier drops
 * cost (resolution, density, post, ambience), never the palette, the lighting model or any gameplay information.
 */
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
  /** Composer with gentle miniature (tilt-shift) blur and a colour grade. */
  post: boolean;
  /** Small flocks circling the valley. */
  birds: boolean;
  /** Density of the decorative valley beyond the board (0 = none). */
  outskirts: number;
}

export const TIERS: Record<QualityTier, Omit<QualitySettings, 'dpr'>> = {
  high: {
    tier: 'high',
    shadowMap: 2048,
    antialias: true,
    foliage: 1,
    grass: 1,
    wind: true,
    post: true,
    birds: true,
    outskirts: 1,
  },
  medium: {
    tier: 'medium',
    shadowMap: 1024,
    antialias: true,
    foliage: 0.8,
    grass: 0.55,
    wind: true,
    post: false,
    birds: true,
    outskirts: 0.7,
  },
  low: {
    tier: 'low',
    shadowMap: 1024,
    antialias: false,
    foliage: 0.6,
    grass: 0.25,
    wind: true,
    post: false,
    birds: false,
    outskirts: 0.4,
  },
};

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

let softwareCache: boolean | null = null;
/** True when WebGL runs on a CPU rasteriser (SwiftShader, llvmpipe…): auto quality then starts low. */
export function isSoftwareRenderer(): boolean {
  if (softwareCache !== null) return softwareCache;
  softwareCache = false;
  try {
    const cv = document.createElement('canvas');
    const gl = (cv.getContext('webgl2') ?? cv.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      softwareCache = /swiftshader|llvmpipe|software|softpipe/i.test(name);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    softwareCache = false;
  }
  return softwareCache;
}

/** Pick a tier from the user setting and the device. Auto = desktops high, phones medium, CPU rasterisers low. */
export function resolveQuality(setting: 'auto' | QualityTier): QualitySettings {
  // `?quality=low|medium|high` overrides the setting (used by tests and for support).
  const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('quality');
  if (q === 'low' || q === 'medium' || q === 'high') setting = q;
  const tier: QualityTier =
    setting === 'auto' ? (isSoftwareRenderer() ? 'low' : isTouchDevice() ? 'medium' : 'high') : setting;
  const dprCap = tier === 'high' ? 2 : tier === 'medium' ? 1.75 : 1.25;
  const dpr = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, dprCap);
  return { ...TIERS[tier], dpr };
}
