// Builds a village that shows every age's architecture and the engineering works. Run through scripts/shot.mjs --js.
(() => {
  const e = window.__epoch;
  e.store.newGame(6001);
  const c = e.store.campaign;
  c.civ.techs = [
    'masonry',
    'irrigation',
    'writing',
    'bronze_tools',
    'ironworking',
    'crop_rotation',
    'forestry',
    'hydrology',
    'seismic_engineering',
  ];
  c.civ.res = { food: 900000, timber: 900000, stone: 900000, knowledge: 0 };
  c.civ.pop = 28;
  c.civ.focus = 'build';
  c.epoch = 0;
  e.store.dispatch({ type: 'beginEpoch' });
  const put = (k, epoch, opts = {}) => {
    c.epoch = epoch;
    const s = e.findSpot(c, k, { maxDist: 16, ...opts });
    if (!s) {
      console.log('no spot', k);
      return;
    }
    console.log('placed', k, s.x, s.y, s.rot);
    e.store.dispatch({ type: 'build', kind: k, x: s.x, y: s.y, rot: s.rot });
    e.runTicks(c, 2);
  };
  // The same cottage in three ages: thatch, tile, slate.
  put('cottage', 0);
  put('cottage', 1);
  put('cottage', 2);
  put('stone_house', 0);
  put('stone_house', 1);
  put('stone_house', 2);
  c.epoch = 2;
  put('farm', 2);
  put('lumber_camp', 2, { maxDist: 22 });
  put('quarry', 2, { maxDist: 26 });
  put('forge', 2);
  put('grove', 2);
  put('retaining_wall', 2, { rots: [0] });
  put('levee', 2, { rots: [0, 1] });
  put('dam', 2, { maxDist: 22, rots: [0, 1] });
  put('bridge', 2, { maxDist: 22, rots: [0, 1] });
  c.epoch = 2;
  e.runTicks(c, 590);
  e.store.pause('user');
  // Screenshots only: hide the pause card so the village is visible.
  document.head.insertAdjacentHTML('beforeend', '<style>.overlay.pause{display:none!important}</style>');
})();
