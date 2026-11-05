(function () {
  const t0 = performance.now();
  newGame(__player, 1); G.noAutosave = true; C(G.player).ai = true;
  console.log('init ms', (performance.now() - t0) | 0, 'divs', Object.keys(G.divs).length, 'prov', M.prov.length, 'states', M.states.length);
  const show = () => {
    let s = dateStr().split(',')[0] + ' wt ' + G.wt.toFixed(0) + ' wars ' + G.wars.length + ' battles ' + Object.keys(G.battles).length + ' divs ' + Object.keys(G.divs).length + ' | ';
    for (const t of ['GER', 'SOV', 'ENG', 'FRA', 'ITA', 'POL']) { const c = G.c[t]; if (!c) continue; s += t + (c.capitulated ? '†' : '') + ' c' + c.civN.toFixed(0) + ' m' + c.milN.toFixed(0) + ' d' + Object.values(G.divs).filter(d => d.tag === t).length + ' pp' + c.pp.toFixed(0) + ' mp' + fmt(c.mpAvail) + ' s' + ((c.surrender || 0) * 100 | 0) + ' ; '; }
    console.log(s);
  };
  let last = performance.now();
  for (let d = 1; d <= __days; d++) {
    for (let h = 0; h < 24; h++) tick();
    if (G.peace) peaceFinish();
    while (G.pending.length) { const e = G.pending.shift(); e.options[0].fx(); }
    if (d % 120 === 0) { show(); console.log('  ms', (performance.now() - last) | 0); last = performance.now(); }
  }
  const by = {}; for (const P of M.prov) { const c = G.ctrl[P.i]; by[c] = (by[c] || 0) + 1; } console.log(JSON.stringify(by));
  console.log(G.log.slice(0, 40).map(l => l.d + ': ' + l.text).join('\n'));
})();
