// Запуск и игровой цикл браузера.
(function () {
  const HOURS = { 1:1.5, 2:4, 3:12, 4:36, 5:96 };
  let last = performance.now(), acc = 0, prevDay = -1, prevSpeed = -1;
  function frame(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (G && G.speed > 0 && !G.peace && !G.pending.length && $('#menu').classList.contains('hidden')) {
      acc += dt * HOURS[G.speed]; const t0 = performance.now(); let n = 0;
      while (acc >= 1 && performance.now() - t0 < 25) { tick(); acc -= 1; n++; if (G.peace || G.pending.length) break; }
      if (acc > 100) acc = 100;
    }
    if (G && Settings.v.edge && $('#menu').classList.contains('hidden') && UI.mouse.over && !document.hidden) { const m = 7, sp = 700 * dt / Render.view.z, X = UI.mouse.x, Y = UI.mouse.y; if (X <= m) Render.view.x -= sp; if (X >= innerWidth - m) Render.view.x += sp; if (Y <= m) Render.view.y -= sp; if (Y >= innerHeight - m) Render.view.y += sp; }
    if (G) { if (Render.zGoal) Render.stepZoom(Settings.v.smooth ? Math.min(1, dt * 13) : 1); document.body.classList.toggle('paused', !G.speed); if (G.preview && Shell.screen === 'main') { Render.view.x += dt * 9; if (Render.view.x > M.W * .62) Render.view.x = M.W * .38; } }
    if (G) {
      if (G.speed !== prevSpeed) { prevSpeed = G.speed; UI.renderTop(); }
      const day = Math.floor(G.hour / 24);
      if (day !== prevDay && !G.preview) { prevDay = day; UI.onDay(); if (G.pending.length) UI.showEvent(); if (G.peace) UI.renderPeace(); }
      Render.draw();
    }
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', () => Render.resize());
  UI.init(); Shell.init(); UI.diff = 1;
  Render.init($('#map'), $('#overlay'), () => {
    $('#loading').classList.add('hidden'); Shell.preview(); Shell.show('main'); requestAnimationFrame(frame);
  });
  window.Game = { advance(h) { for (let i = 0; i < h; i++) tick(); } };
})();
