(() => {
  const e = window.__epoch;
  e.store.newGame(6001);
  const c = e.store.campaign;
  c.civ.res = { food: 900000, timber: 900000, stone: 900000, knowledge: 0 };
  e.store.dispatch({ type: 'beginEpoch' });
  const kinds = [
    'cottage',
    'cottage',
    'cottage',
    'farm',
    'farm',
    'lumber_camp',
    'quarry',
    'workshop',
    'archive',
    'seed_vault',
    'firebreak',
    'cottage',
  ];
  for (const k of kinds) {
    const opts = k === 'quarry' ? { maxDist: 24 } : k === 'lumber_camp' ? { maxDist: 20 } : { maxDist: 14 };
    if (k === 'firebreak') opts.rots = [1];
    const s = e.findSpot(c, k, opts);
    if (!s) {
      console.log('no spot', k);
      continue;
    }
    e.store.dispatch({ type: 'build', kind: k, x: s.x, y: s.y, rot: s.rot });
    e.runTicks(c, 2);
  }
  e.runTicks(c, 330);
  e.store.pause('user');
})();
