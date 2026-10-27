import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { GRID_H, GRID_W } from '../engine';
import { store } from '../game/store';
import { presentation } from './presentation';

export interface CameraState {
  x: number;
  z: number;
  /** Radians; 0 = camera south of the target looking north. */
  az: number;
  /** Elevation of the camera above the horizon, radians. */
  polar: number;
  dist: number;
}

export const DEFAULT_CAMERA: CameraState = { x: 17, z: 17, az: 0.3, polar: 0.78, dist: 46 };
const MIN_DIST = 7;
const MAX_DIST = 70;
const MIN_POLAR = 0.42;
const MAX_POLAR = 1.22;

/** Imperative handle for tests and the debug API. */
export const cameraApi: {
  get: () => CameraState;
  set: (p: Partial<CameraState>, instant?: boolean) => void;
  /** Set when a gesture moved the camera, so a tap handler can ignore the pointer-up that ended a drag. */
  lastDragAt: number;
  heightAt: (x: number, z: number) => number;
  /** Request one frame (used by `?still` mode). */
  render: () => void;
  /** Project a ground point to client pixel coordinates (for tests). */
  project: (x: number, z: number) => { x: number; y: number } | null;
} = {
  get: () => ({ ...DEFAULT_CAMERA }),
  set: () => undefined,
  lastDragAt: 0,
  heightAt: () => 0,
  render: () => undefined,
  project: () => null,
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function CameraRig({ enabled }: { enabled: boolean }) {
  const { camera, gl, size } = useThree();
  const target = useRef<CameraState>({ ...DEFAULT_CAMERA });
  const cur = useRef<CameraState>({ ...DEFAULT_CAMERA });
  const keys = useRef(new Set<string>());
  const lastFocusId = useRef(0);
  const lastScreen = useRef('');

  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let downAt = 0;
    let moved = 0;
    let mode: 'pan' | 'orbit' = 'pan';
    let pinchDist = 0;
    let pinchAngle = 0;
    const cam = camera as PerspectiveCamera;

    const groundPerPixel = () => {
      const t = target.current;
      const fov = (cam.fov * Math.PI) / 180;
      return (2 * Math.tan(fov / 2) * t.dist) / Math.max(1, size.height);
    };
    const panBy = (dx: number, dy: number) => {
      const t = target.current;
      const k = groundPerPixel();
      const sinA = Math.sin(t.az);
      const cosA = Math.cos(t.az);
      // finger right → world follows → target moves left; finger down → target moves forward (away)
      t.x += (-cosA * dx + (-sinA * dy) / Math.sin(t.polar)) * k;
      t.z += (sinA * dx + (-cosA * dy) / Math.sin(t.polar)) * k;
    };

    const onDown = (e: PointerEvent) => {
      if (!enabled) return;
      el.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        downAt = performance.now();
        moved = 0;
        mode = e.button === 2 || e.ctrlKey || e.shiftKey || e.altKey ? 'orbit' : 'pan';
      }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchAngle = Math.atan2(b.y - a.y, b.x - a.x);
        moved = 99;
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      const t = target.current;
      if (pointers.size === 1) {
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved < 7) return;
        cameraApi.lastDragAt = performance.now();
        if (mode === 'orbit') {
          t.az -= dx * 0.006;
          t.polar = clamp(t.polar + dy * 0.005, MIN_POLAR, MAX_POLAR);
        } else {
          panBy(dx, dy);
        }
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (pinchDist > 0) t.dist = clamp((t.dist * pinchDist) / Math.max(20, d), MIN_DIST, MAX_DIST);
        let da = ang - pinchAngle;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        t.az -= da;
        pinchDist = d;
        pinchAngle = ang;
        panBy(dx / 2, dy / 2);
        cameraApi.lastDragAt = performance.now();
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      void downAt;
    };
    const onWheel = (e: WheelEvent) => {
      if (!enabled) return;
      e.preventDefault();
      const t = target.current;
      if (e.shiftKey || e.ctrlKey) {
        t.az -= e.deltaY * 0.002;
      } else {
        t.dist = clamp(t.dist * Math.exp(e.deltaY * 0.0011), MIN_DIST, MAX_DIST);
      }
    };
    const onContext = (e: Event) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // While a building is being placed the arrow keys move the ghost, not the camera.
      if (store.placing && e.key.startsWith('Arrow')) return;
      keys.current.add(e.key.toLowerCase());
      if (e.key === 'Home') {
        Object.assign(target.current, DEFAULT_CAMERA);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const onBlur = () => keys.current.clear();

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContext);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContext);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [camera, gl, size.height, enabled]);

  useEffect(() => {
    cameraApi.project = (x, z) => {
      const v = new Vector3(x, cameraApi.heightAt(x, z), z).project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    };
    cameraApi.get = () => ({ ...cur.current });
    cameraApi.set = (p, instant) => {
      Object.assign(target.current, p);
      if (instant) Object.assign(cur.current, target.current);
    };
  }, [camera, gl]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const t = target.current;
    const c = cur.current;
    // keyboard
    const k = keys.current;
    if (k.size) {
      const speed = t.dist * 0.9 * dt;
      const sinA = Math.sin(t.az);
      const cosA = Math.cos(t.az);
      let fx = 0;
      let fz = 0;
      if (k.has('w') || k.has('arrowup')) {
        fx -= sinA;
        fz -= cosA;
      }
      if (k.has('s') || k.has('arrowdown')) {
        fx += sinA;
        fz += cosA;
      }
      if (k.has('a') || k.has('arrowleft')) {
        fx -= cosA;
        fz += sinA;
      }
      if (k.has('d') || k.has('arrowright')) {
        fx += cosA;
        fz -= sinA;
      }
      t.x += fx * speed;
      t.z += fz * speed;
      if (k.has('q')) t.az += 1.4 * dt;
      if (k.has('e')) t.az -= 1.4 * dt;
      if (k.has('=') || k.has('+')) t.dist = clamp(t.dist * (1 - 1.2 * dt), MIN_DIST, MAX_DIST);
      if (k.has('-') || k.has('_')) t.dist = clamp(t.dist * (1 + 1.2 * dt), MIN_DIST, MAX_DIST);
    }
    // Per-screen composition: the title frames the village beside the card; the game frames the hearth.
    if (store.screen !== lastScreen.current && store.campaign) {
      lastScreen.current = store.screen;
      const h = store.campaign.world.anchors.hearth;
      const portrait = size.height > size.width;
      if (store.screen === 'title') {
        Object.assign(t, {
          x: h.x + (portrait ? 0 : -3.2),
          z: h.y + (portrait ? 5.2 : -0.5),
          az: 0.55,
          polar: portrait ? 0.95 : 0.7,
          dist: portrait ? 30 : 24,
        });
        Object.assign(c, t);
      } else {
        Object.assign(t, { x: h.x, z: h.y, az: 0.3, polar: 0.78, dist: portrait ? 40 : 32 });
      }
    }
    // The title screen slowly turns the valley like a music-box diorama.
    if (store.screen === 'title') t.az += dt * 0.03;
    // store focus requests
    const fr = store.focusRequest;
    if (fr && fr.id !== lastFocusId.current) {
      lastFocusId.current = fr.id;
      t.x = fr.x;
      t.z = fr.y;
      if (fr.zoom) t.dist = clamp(fr.zoom, MIN_DIST, MAX_DIST);
    }
    // bounds
    t.x = clamp(t.x, 1, GRID_W - 1);
    t.z = clamp(t.z, 1, GRID_H - 1);
    t.dist = clamp(t.dist, MIN_DIST, MAX_DIST);
    t.polar = clamp(t.polar, MIN_POLAR, MAX_POLAR);
    // smoothing (frame-rate independent)
    const a = 1 - Math.exp(-dt * 11);
    c.x += (t.x - c.x) * a;
    c.z += (t.z - c.z) * a;
    c.dist += (t.dist - c.dist) * a;
    c.polar += (t.polar - c.polar) * a;
    const da = t.az - c.az;
    c.az += da * a;
    const ground = cameraApi.heightAt(c.x, c.z);
    const cp = Math.cos(c.polar);
    const sp = Math.sin(c.polar);
    camera.position.set(
      c.x + Math.sin(c.az) * c.dist * cp,
      ground + sp * c.dist,
      c.z + Math.cos(c.az) * c.dist * cp,
    );
    // Quake: the camera trembles while the shockwave crosses the valley (never in reduced-motion mode).
    if (
      presentation.active &&
      presentation.hazard === 'quake' &&
      !store.settings.reducedMotion &&
      presentation.t < 0.85
    ) {
      const amp = 0.16 * (1 - presentation.t / 0.85);
      const tt = performance.now() / 1000;
      camera.position.x += Math.sin(tt * 47) * amp;
      camera.position.y += Math.sin(tt * 61 + 1) * amp * 0.7;
      camera.position.z += Math.cos(tt * 53) * amp;
    }
    // never dip underground
    const floor = cameraApi.heightAt(camera.position.x, camera.position.z) + 1.2;
    if (camera.position.y < floor) camera.position.y = floor;
    camera.lookAt(c.x, ground, c.z);
  });

  return null;
}
