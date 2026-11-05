(function () {
  newGame('GER', 1); G.noAutosave = true;
  declareWar('GER', 'POL', { force:true });
  const c = C('GER');
  const A = Object.values(G.armies).filter(a => a.tag === 'GER');
  for (const a of A) { a.front = 'POL'; a.mode = 'attack'; }
  const rep = () => {
    const ds = Object.values(G.divs).filter(d => d.tag === 'GER'); const s0 = divStats(c, 'inf');
    const hist = {}; for (const d of ds) { const k = (Math.round(d.sup * 5) / 5).toFixed(1); hist[k] = (hist[k] || 0) + 1; }
    const load = {}; for (const d of ds) { const st = PROV[d.prov].s; load[st] = (load[st] || 0) + divStats(c, d.tpl).sup; }
    const top = Object.entries(load).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, l]) => G.st[s].name + ':' + l.toFixed(1) + '/inf' + G.st[s].infra);
    const front = new Set(frontProvinces(c, A[0]));
    const atFront = ds.filter(d => front.has(d.prov)).length;
    const elig = ds.filter(d => front.has(d.prov) && !d.path.length && !d.attacking && d.org >= s0.org * .55 && d.str >= .35 && d.sup >= .1).length;
    console.log(dateStr().split(',')[0], 'd', ds.length, 'org', (ds.reduce((v, d) => v + d.org, 0) / ds.length).toFixed(1), '/', s0.org.toFixed(0), 'str', (ds.reduce((v, d) => v + d.str, 0) / ds.length).toFixed(2), 'sup', JSON.stringify(hist), 'front', front.size, 'atFront', atFront, 'elig', elig, 'moving', ds.filter(d => d.path.length).length, 'atk', ds.filter(d => d.attacking).length, 'battles', Object.keys(G.battles).length, 'GERprov', M.prov.filter(P => G.ctrl[P.i] === 'GER').length, 'load', top.join(' '), 'weather', WEATHER[weatherOf(c.capital)].n);
  };
  rep();
  for (let d = 1; d <= __days; d++) { for (let h = 0; h < 24; h++) tick(); if (G.peace) peaceFinish(); while (G.pending.length) G.pending.shift().options[0].fx(); if (d % 5 === 0) rep(); }
})();
