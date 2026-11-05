(function () {
  newGame('GER', 1); G.noAutosave = true;
  declareWar('GER', 'DEN', { force:true });
  const c = C('GER'), A = Object.values(G.armies).find(a => a.tag === 'GER'); A.front = 'DEN'; A.mode = 'attack';
  for (let d = 1; d <= 200; d++) {
    for (let h = 0; h < 24; h++) tick(); if (G.peace) { console.log('peace day', d); break; }
    if (d % 20 === 0) { const fp = A._fp || []; const ds = A.divs.map(i => G.divs[i]).filter(Boolean); const dan = M.prov.filter(P => G.st[P.s].owner === 'DEN'); console.log('day', d, 'fp', fp.length, 'atFront', ds.filter(x => fp.includes(x.prov)).length, 'moving', ds.filter(x => x.path.length).length, 'boarding', ds.filter(x => x.boarding).length, 'danHeld', dan.filter(P => G.ctrl[P.i] === 'DEN').length, '/', dan.length, 'sur', (C('DEN').surrender * 100 | 0), 'cap', C('DEN').capitulated, 'denDivs', Object.values(G.divs).filter(x => x.tag === 'DEN').length, 'heldLand', dan.filter(P => G.ctrl[P.i] === 'DEN').map(P => P.land.map(a => G.ctrl[a]).join('/') + (P.coastal ? '*' : '')).join(' ')); }
  }
})();
