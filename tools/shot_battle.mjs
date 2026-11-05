// Кадр с идущими сражениями: node shot_battle.mjs <файл.png>
import puppeteer from 'puppeteer-core'; import path from 'path';
const R = path.resolve(import.meta.dirname, '..');
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:'new', args:['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--window-size=1600,900'] });
const p = await b.newPage(); await p.setViewport({ width:1600, height:900 }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file:///' + R.replace(/\\/g, '/') + '/index.html'); await p.waitForFunction(() => document.querySelector('#loading').classList.contains('hidden'), { timeout:120000 });
const info = await p.evaluate(() => {
  window.__noUnloadGuard = true; UI.A.shell('pick'); UI.A.startAs('GER'); declareWar('GER', 'POL', { force:true }); G.speed = 0;
  for (const A of Object.values(G.armies)) if (A.tag === 'GER') { A.front = 'POL'; A.mode = 'attack'; }
  let n = 0, tries = 0; while (n < 3 && tries++ < 24 * 40) { Game.advance(1); n = Object.keys(G.battles).length; }
  const bs = Object.values(G.battles); let x = 0, y = 0; for (const q of bs) { x += PROV[q.prov].x; y += PROV[q.prov].y; } if (bs.length) { Render.view.x = x / bs.length; Render.view.y = y / bs.length; } Render.view.z = .85; Render.selected.clear(); UI.refresh(); G.ctrlDirty = true;
  return { battles:bs.length, tries };
});
await new Promise(r => setTimeout(r, 5200)); await p.screenshot({ path:process.argv[2] }); console.log(JSON.stringify(info), errs.join(' | ') || 'no errors'); await b.close();
