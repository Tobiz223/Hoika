(function () {
  newGame('SWI', 1); G.noAutosave = true; C(G.player).ai = true;
  const T = {}, N = {}; for (const n of ['runArmyFront', 'findPath', 'frontProvinces', 'routeToSlot', 'nearestCoast', 'seaRouteOK', 'orderLanding', 'orderAlong', 'hostileDivsAt']) { const f = globalThis[n]; if (!f) continue; T[n] = 0; N[n] = 0; globalThis[n] = function () { const t = performance.now(); const r = f.apply(this, arguments); T[n] += performance.now() - t; N[n]++; return r; }; }
  let last = performance.now();
  const stop = 365 * 5 + 190;
  for (let d = 1; d <= stop; d++) {
    for (let h = 0; h < 24; h++) tick(); if (G.peace) peaceFinish(); while (G.pending.length) G.pending.shift().options[0].fx();
    if (d % 30 === 0 && d > 365 * 4.5) {
      const arm = Object.values(G.armies), by = {}; for (const a of arm) by[a.tag] = (by[a.tag] || 0) + 1; const big = arm.slice().sort((a, b) => b.divs.length - a.divs.length)[0], fpMax = Math.max(...arm.map(a => (a._fp || []).length));
      console.log(dateStr().split(',')[0], 'ms/день', ((performance.now() - last) / 30).toFixed(0), 'армий', arm.length, 'макс див в армии', big.divs.length, big.tag, 'макс участок', fpMax, 'посадок', G.landings.length, 'лишние', Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4).join(' '), Object.keys(T).map(k => k + ' ' + (T[k] / 30).toFixed(0) + 'мс×' + (N[k] / 30 | 0)).join(', '));
      for (const k in T) { T[k] = 0; N[k] = 0; } last = performance.now();
    }
  }
})();
