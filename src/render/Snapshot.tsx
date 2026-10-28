import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { PerspectiveCamera, Vector4 } from 'three';
import type { Fog, Object3D, Scene, WebGLRenderer } from 'three';
import { store } from '../game/store';
import type { SnapshotRequest } from '../game/store';
import { DEFAULT_CAMERA, cameraApi } from './CameraRig';

/**
 * Then and now: the render layer photographs the valley from one fixed viewpoint (the default framing, centred on the
 * age's hearth) when the store asks — as the minute ends, and again afterwards — so the two pictures line up. Overlays
 * (forecast, lens, rings, ghost) are hidden for the shot; the sky dome and the haze are set for the snapshot camera and
 * restored; the frame is drawn into a corner of the canvas and read straight back (the canvas keeps its drawing
 * buffer), then the normal view is redrawn. The pictures are JPEG data URLs kept only for this session.
 */

/** Thumbnail size in device pixels (16:9), never wider than the canvas. */
const WIDTH = 480;
const DIST = 40;

/** Frames to wait after a request first appears, so the scene shows the state it was asked for. */
const SETTLE_FRAMES = 3;

function capture(gl: WebGLRenderer, scene: Scene, focus: { x: number; z: number }): string | null {
  const canvas = gl.domElement;
  const w = Math.min(WIDTH, canvas.width);
  const h = Math.round((w * 9) / 16);
  if (w < 16 || h > canvas.height) return null;
  const cam = new PerspectiveCamera(30, w / h, 0.5, 260);
  const { az, polar } = DEFAULT_CAMERA;
  const ground = cameraApi.heightAt(focus.x, focus.z);
  cam.position.set(
    focus.x + Math.sin(az) * DIST * Math.cos(polar),
    ground + Math.sin(polar) * DIST,
    focus.z + Math.cos(az) * DIST * Math.cos(polar),
  );
  cam.lookAt(focus.x, ground, focus.z);
  cam.updateMatrixWorld();

  const hidden: Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData.overlay && o.visible) {
      o.visible = false;
      hidden.push(o);
    }
  });
  const dome = scene.getObjectByName('sky-dome');
  const domeAt = dome?.position.clone();
  dome?.position.copy(cam.position);
  const fog = scene.fog as Fog | null;
  const haze = fog ? { near: fog.near, far: fog.far } : null;
  if (fog) {
    fog.near = DIST * 1.05;
    fog.far = DIST * 3.6;
  }
  const viewport = gl.getViewport(new Vector4());
  const scissor = gl.getScissor(new Vector4());
  const scissorTest = gl.getScissorTest();
  const pr = gl.getPixelRatio();
  let url: string | null = null;
  try {
    gl.setRenderTarget(null);
    gl.setViewport(0, 0, w / pr, h / pr);
    gl.setScissor(0, 0, w / pr, h / pr);
    gl.setScissorTest(true);
    gl.render(scene, cam);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    if (ctx) {
      // GL's origin is the bottom-left corner; the canvas image's is the top-left.
      ctx.drawImage(canvas, 0, canvas.height - h, w, h, 0, 0, w, h);
      url = out.toDataURL('image/jpeg', 0.72);
    }
  } finally {
    gl.setScissorTest(scissorTest);
    gl.setScissor(scissor);
    gl.setViewport(viewport);
    if (dome && domeAt) dome.position.copy(domeAt);
    if (fog && haze) Object.assign(fog, haze);
    for (const o of hidden) o.visible = true;
  }
  return url;
}

export function SnapshotCapture() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const waiting = useRef<{ key: string; frames: number } | null>(null);
  /** Shots that could not be taken (a canvas too small): asked once, never retried every frame. */
  const failed = useRef(new Set<string>());
  // On-demand rendering (`?still`) draws only when asked: a pending picture keeps frames coming until it is taken.
  const pending = (): SnapshotRequest | null => {
    const want = store.snapshotWanted();
    return want && !failed.current.has(`${want.epoch}:${want.kind}`) ? want : null;
  };
  useEffect(
    () =>
      store.subscribe(() => {
        if (pending()) invalidate();
      }),
    [invalidate],
  );
  useFrame(() => {
    const want = pending();
    if (!want) {
      waiting.current = null;
      return;
    }
    const key = `${want.epoch}:${want.kind}`;
    if (waiting.current?.key !== key) waiting.current = { key, frames: 0 };
    if (++waiting.current.frames < SETTLE_FRAMES) {
      invalidate();
      return;
    }
    waiting.current = null;
    const url = capture(gl, scene, want.focus);
    if (url) store.recordSnapshot(want, url);
    else failed.current.add(key);
    // The shot drew over a corner of the canvas: draw the normal view again.
    invalidate();
  });
  return null;
}
