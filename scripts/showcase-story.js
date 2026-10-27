// A village with a cottage in the fire's path, advanced until the wildfire decision appears.
(() => {
  const e = window.__epoch;
  e.store.newGame(6001);
  const c = e.store.campaign;
  c.civ.res = { food: 90000, timber: 90000, stone: 30000, knowledge: 0 };
  const h = c.world.anchors.hearth;
  const spot = e.findSpot(c, 'cottage', { near: { x: h.x + 5, y: h.y + 2 }, maxDist: 6 });
  if (spot) e.store.dispatch({ type: 'build', kind: 'cottage', x: spot.x, y: spot.y, rot: spot.rot });
  const farm = e.findSpot(c, 'farm', { maxDist: 10 });
  if (farm) e.store.dispatch({ type: 'build', kind: 'farm', x: farm.x, y: farm.y, rot: 0 });
  e.store.dispatch({ type: 'beginEpoch' });
  e.runTicks(c, 175);
  e.store.pause('user');
  document.head.insertAdjacentHTML('beforeend', '<style>.overlay.pause{display:none!important}</style>');
  e.store.focusOn(h.x + 2, h.y, 24);
})();
