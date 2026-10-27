import { generateWorld, validateWorld } from '../src/engine/world/generate';
import { idx } from '../src/engine/world/query';

const seed = Number(process.argv[2] ?? 6001);
const w = generateWorld(seed);
const chk = validateWorld(w);
console.log(
  'seed',
  seed,
  chk.ok,
  chk.problems,
  chk.stats,
  'hearth',
  w.anchors.hearth,
  'fire',
  w.anchors.fireOrigin,
);
const { hearth, fireOrigin } = w.anchors;
for (let y = 0; y < w.h; y++) {
  let row = '';
  for (let x = 0; x < w.w; x++) {
    const i = idx(x, y);
    let c = '.';
    if (x === hearth.x && y === hearth.y) c = 'H';
    else if (x === fireOrigin.x && y === fireOrigin.y) c = 'F';
    else if (w.water[i] === 1) c = '~';
    else if (w.water[i] === 2) c = '=';
    else if (w.rock[i]! > 0) c = 'R';
    else if (w.forest[i]! > 500) c = 'T';
    else if (w.forest[i]! > 250) c = 't';
    else if (w.fertility[i]! > 700) c = '"';
    else if (w.height[i]! > 250) c = '^';
    row += c;
  }
  const hs = [];
  for (let x = 0; x < w.w; x += 4) hs.push(String(w.height[idx(x, y)]).padStart(4));
  console.log(row, hs.join(''));
}
