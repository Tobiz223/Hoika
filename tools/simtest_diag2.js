(function () {
  newGame('SWI', 1); G.noAutosave = true; C(G.player).ai = true;
  declareWar('GER', 'POL', { force:true }); recalcWarRel();
  for (const A of Object.values(G.armies)) if (A.tag === 'GER' || A.tag === 'POL') { A.front = 'all'; A.mode = A.tag === 'GER' ? 'attack' : 'hold'; }
  for (let d = 0; d < 25; d++) { for (let h = 0; h < 24; h++) tick(); }
  const born = {}, last = {}; const dur = [], why = {}; let samples = 0;
  for (let h = 0; h < 24 * 20; h++) {
    for (const k in G.battles) { const b = G.battles[k]; if (!born[k]) born[k] = G.hour; last[k] = { atk:b.atk.map(i => { const d = G.divs[i]; return d && { id:i, org:d.org, max:divStats(C(d.tag), d.tpl).org, sa:d.prov, tag:d.tag }; }).filter(Boolean), def:b.def.map(i => { const d = G.divs[i]; return d && { id:i, org:d.org, tag:d.tag }; }).filter(Boolean) }; }
    tick();
    for (const k in born) { if (G.battles[k]) continue; const L = last[k]; dur.push(G.hour - born[k]); const atkAlive = L.atk.filter(x => G.divs[x.id] && G.divs[x.id].attacking == null); let r = 'other'; const atkOrg = L.atk.reduce((v, x) => Math.min(v, x.org), 1e9), defOrg = L.def.reduce((v, x) => Math.min(v, x.org), 1e9); if (!L.def.length) r = 'нет защитников'; else if (!L.atk.length) r = 'нет атакующих'; else if (atkOrg < 3) r = 'атака выдохлась'; else if (defOrg < 3) r = 'защита отступила'; else r = 'внезапно atk ' + atkOrg.toFixed(0) + ' def ' + defOrg.toFixed(0) + ' n' + L.atk.length + '/' + L.def.length; const key = r.startsWith('внезапно') ? 'внезапно' : r; why[key] = (why[key] || 0) + 1; if (r.startsWith('внезапно') && samples++ < 6) console.log(' ', r, 'длил.', G.hour - born[k], 'сторона', L.atk[0].tag, '->', L.def[0].tag, 'attacking сейчас', L.atk.map(x => G.divs[x.id] ? G.divs[x.id].attacking + '/' + G.divs[x.id].path.length + '/m' + G.divs[x.id].manual : 'dead').join(' ')); delete born[k]; delete last[k]; }
  }
  dur.sort((a, b) => a - b); console.log('боёв', dur.length, 'медиана часов', dur[dur.length >> 1], 'макс', dur[dur.length - 1], JSON.stringify(why), 'сдача POL', (C('POL').surrender * 100 | 0) + '%');
})();
