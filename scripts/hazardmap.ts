import { createCampaign, resolveHazard, fuelMap } from '../src/engine';
import type { HazardKind } from '../src/engine';
import { idx } from '../src/engine/world/query';
const seed = Number(process.argv[2] ?? 6001);
const kind = (process.argv[3] ?? 'fire') as HazardKind;
const strength = Number(process.argv[4] ?? 0) || undefined;
const c = createCampaign(seed);
if (kind === 'flood') c.epoch = 1;
if (kind === 'quake') c.epoch = 2;
const r = resolveHazard(c, kind, strength);
const m = new Map(r.cells.map((h) => [idx(h.x, h.y), h]));
const fuel = fuelMap(c);
const { hearth, fireOrigin } = c.world.anchors;
console.log(kind, 'cells', r.cells.length, 'span', r.span);
for (let y = 0; y < c.world.h; y++) {
  let row = '';
  for (let x = 0; x < c.world.w; x++) {
    const i = idx(x, y);
    const h = m.get(i);
    let ch = '.';
    if (c.world.water[i]) ch = '~';
    else if (c.world.rock[i]! > 0) ch = 'R';
    else if (fuel[i]! >= 40) ch = 't';
    if (h) ch = String(Math.min(9, Math.floor((h.arrival / (r.span || 1)) * 9.99)));
    if (x === hearth.x && y === hearth.y) ch = 'H';
    if (x === fireOrigin.x && y === fireOrigin.y) ch = 'F';
    row += ch;
  }
  console.log(row);
}
