import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Object3D, Raycaster, Vector2, Vector3 } from 'three';
import { GRID_H, GRID_W } from '../engine';
import { store } from '../game/store';
import { cameraApi } from './CameraRig';
import { worldModel } from './world';

const ray = new Raycaster();
const ndc = new Vector2();

export interface GroundHit {
  x: number;
  z: number;
}

/** Intersect a camera ray with the terrain heightfield by marching, then bisecting. */
export function marchGround(origin: Vector3, dir: Vector3): GroundHit | null {
  const T = worldModel.terrain;
  if (!T) return null;
  let prevT = 0;
  const step = 0.35;
  for (let t = 0; t < 220; t += step) {
    const x = origin.x + dir.x * t;
    const y = origin.y + dir.y * t;
    const z = origin.z + dir.z * t;
    if (x < -2 || z < -2 || x > GRID_W + 2 || z > GRID_H + 2) {
      prevT = t;
      continue;
    }
    if (y <= T.heightAt(Math.min(GRID_W - 0.001, Math.max(0, x)), Math.min(GRID_H - 0.001, Math.max(0, z)))) {
      let lo = prevT;
      let hi = t;
      for (let i = 0; i < 12; i++) {
        const m = (lo + hi) / 2;
        const mx = origin.x + dir.x * m;
        const my = origin.y + dir.y * m;
        const mz = origin.z + dir.z * m;
        if (
          my <=
          T.heightAt(Math.min(GRID_W - 0.001, Math.max(0, mx)), Math.min(GRID_H - 0.001, Math.max(0, mz)))
        )
          hi = m;
        else lo = m;
      }
      const m = (lo + hi) / 2;
      const hx = origin.x + dir.x * m;
      const hz = origin.z + dir.z * m;
      if (hx < 0 || hz < 0 || hx > GRID_W || hz > GRID_H) return null;
      return { x: hx, z: hz };
    }
    prevT = t;
  }
  return null;
}

export function Interaction() {
  const { gl, camera, scene } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number; t: number; button: number; type: string } | null = null;

    const toNdc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const groundAt = (e: PointerEvent): GroundHit | null => {
      toNdc(e);
      ray.setFromCamera(ndc, camera);
      return marchGround(ray.ray.origin, ray.ray.direction);
    };
    const pickStructure = (e: PointerEvent): number | null => {
      toNdc(e);
      ray.setFromCamera(ndc, camera);
      const root = scene.getObjectByName('structures');
      if (!root) return null;
      const hits = ray.intersectObjects(root.children, true);
      for (const h of hits) {
        let o: Object3D | null = h.object;
        while (o) {
          const sid = (o.userData as { sid?: number }).sid;
          if (sid !== undefined) return sid;
          o = o.parent;
        }
      }
      return null;
    };

    let lastHover = 0;
    const setHover = (id: number | null) => {
      store.hoverId = id;
      el.style.cursor = id !== null ? 'pointer' : '';
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons !== 0) return;
      if (store.placing) {
        if (store.hoverId !== null) setHover(null);
        const g = groundAt(e);
        if (g) store.hoverCell(g.x, g.z);
        return;
      }
      // Desktop affordance: the building under the cursor brightens and the cursor shows it can be clicked
      // (raycast against the structures only, at most every 50 ms).
      const now = performance.now();
      if (now - lastHover < 50) return;
      lastHover = now;
      setHover(store.screen === 'game' ? pickStructure(e) : null);
    };
    const onLeave = () => setHover(null);
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button, type: e.pointerType };
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (!d) return;
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      const dragged = moved > 9 || performance.now() - cameraApi.lastDragAt < 120;
      if (dragged) return;
      if (d.button === 2) {
        // Right-click cancels placement (it never charges).
        if (store.placing) store.cancelPlacing();
        return;
      }
      if (d.button !== 0) return;
      const c = store.campaign;
      if (!c || store.screen !== 'game') return;
      if (store.placing) {
        const g = groundAt(e);
        if (!g) return;
        if (e.pointerType === 'mouse') {
          store.hoverCell(g.x, g.z);
          if (store.ghost?.ok) store.confirmPlacing();
          else if (store.ghost && !store.ghost.ok) store.showToast(store.ghost.error.message, 'error');
        } else {
          // Touch: first tap positions the ghost; the big Confirm button commits it.
          store.hoverCell(g.x, g.z);
        }
        return;
      }
      const sid = pickStructure(e);
      if (sid !== null) {
        store.select(sid);
        return;
      }
      const g = groundAt(e);
      if (g) {
        const k = Math.floor(g.z) * GRID_W + Math.floor(g.x);
        const occ = c.world.occ[k];
        if (occ !== undefined && occ !== -1) {
          store.select(occ);
          return;
        }
      }
      store.select(null);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onLeave);
      setHover(null);
    };
  }, [gl, camera, scene]);

  return null;
}
