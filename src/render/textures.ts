import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import { h01 } from './geo';

let detail: CanvasTexture | null = null;

/** Tileable grass/soil grain, multiplied over the vertex colours so the ground has texture at every zoom. */
export function detailTexture(): CanvasTexture {
  if (detail) return detail;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(S, S);
  // tileable value noise: sample on a torus
  const lat = (x: number, y: number, o: number, n: number) => h01(((x % n) + n) % n, ((y % n) + n) % n, o);
  const vn = (x: number, y: number, n: number, o: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = lat(ix, iy, o, n);
    const b = lat(ix + 1, iy, o, n);
    const c = lat(ix, iy + 1, o, n);
    const d = lat(ix + 1, iy + 1, o, n);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      let n =
        vn(u * 8, v * 8, 8, 1) * 0.45 + vn(u * 24, v * 24, 24, 2) * 0.3 + vn(u * 64, v * 64, 64, 3) * 0.25;
      // fine blade-like speckle
      n += (h01(x, y, 9) - 0.5) * 0.12;
      const k = Math.max(0, Math.min(1, n));
      const val = Math.round(150 + k * 105);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  detail = new CanvasTexture(cv);
  detail.wrapS = detail.wrapT = RepeatWrapping;
  detail.colorSpace = SRGBColorSpace;
  detail.anisotropy = 8;
  detail.minFilter = LinearMipmapLinearFilter;
  return detail;
}
