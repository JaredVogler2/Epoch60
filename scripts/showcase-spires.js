// Builds a village comparing the Age of Iron (age III) with the long chronicle's Age of Spires (age IV on): the same
// cottages, stone houses, granaries and Archives raised in each. Run through scripts/shot.mjs --js.
(() => {
  const e = window.__epoch;
  e.store.newGame(6001);
  const c = e.store.campaign;
  // A lineage carrying its chronicle on (only such a lineage reaches age IV).
  c.endless = { rested: false };
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
    const s = e.findSpot(c, k, { maxDist: 14, ...opts });
    if (!s) {
      console.log('no spot', k);
      return;
    }
    console.log('placed', k, epoch, s.x, s.y, s.rot);
    e.store.dispatch({ type: 'build', kind: k, x: s.x, y: s.y, rot: s.rot });
    e.runTicks(c, 2);
  };
  for (const epoch of [2, 3]) {
    put('cottage', epoch);
    put('cottage', epoch);
    put('cottage', epoch);
    put('stone_house', epoch);
    put('stone_house', epoch);
    put('granary', epoch);
    put('archive', epoch, { maxDist: 18 });
  }
  c.epoch = 3;
  // Long enough for every building to finish, before the first warning (no catastrophe or forecast in the picture).
  e.runTicks(c, 340 - c.tick);
  if (e.store.showForecast) e.store.toggleForecast();
  e.store.pause('user');
  // Screenshots only: hide the pause card, the story card and the tray so the village is visible.
  document.head.insertAdjacentHTML(
    'beforeend',
    '<style>.overlay.pause,.story,.tray{display:none!important}</style>',
  );
})();
