// Прогон в настоящем браузере: node browsertest.mjs <папка_для_скриншотов>
import puppeteer from 'puppeteer-core'; import path from 'path';
const R = path.resolve(import.meta.dirname, '..'); const OUT = process.argv[2];
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:'new', args:['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--allow-file-access-from-files', '--window-size=1600,900'] });
const p = await b.newPage(); await p.setViewport({ width:1600, height:900 });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await p.goto('file:///' + R.replace(/\\/g, '/') + '/index.html'); await p.waitForFunction(() => document.querySelector('#loading').classList.contains('hidden'), { timeout:120000 });
const shot = async n => { await new Promise(r => setTimeout(r, 900)); await p.screenshot({ path:path.join(OUT, n + '.png') }); };
await shot('menu');
const click = s => p.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('no ' + s); e.click(); }, s);
await click('[data-a="startAs:GER"]'); await shot('start');
for (const t of ['politics', 'focus', 'tech', 'prod', 'build', 'trade', 'army', 'design', 'air', 'navy', 'diplo', 'log']) { await click(`[data-a="tab:${t}"]`); await shot('tab_' + t); await click(`[data-a="tab:${t}"]`); }
await p.evaluate(() => { UI.A.tab('design'); UI.A.dslot(20); UI.A.dset('art'); UI.A.dsup(0); UI.A.dset('eng'); }); await shot('designer'); await p.evaluate(() => UI.closePanel());
await p.evaluate(() => { UI.A.mode('pol'); const A = Object.values(G.armies).find(a => a.tag === G.player); UI.A.selArmy(A.id); }); await shot('army_selected');
await p.evaluate(() => { Render.selected.clear(); UI.renderBottom(); C('POL').wargoals = {}; G.wt = 40; declareWar('GER', 'POL', { force:true }); for (const A of Object.values(G.armies)) if (A.tag === 'GER') { A.front = 'POL'; A.mode = 'attack'; } Game.advance(24 * 20); while (G.pending.length) { const e = G.pending.shift(); e.options[0].fx(); } Render.view.x = PROV[C('POL').capital].x; Render.view.y = PROV[C('POL').capital].y; Render.view.z = .7; G.ctrlDirty = true; UI.refresh(); }); await shot('war');
await p.evaluate(() => { Render.view.z = .32; G.ctrlDirty = true; }); await shot('war_far');
const dump = await p.evaluate(() => { const s = Save.dump(); const ok = Save.write('a'); return { size:s.length, ok }; }); console.log('save', dump);
const okLoad = await p.evaluate(() => { const h = G.hour; const r = Save.read('a'); return r && G.hour === h; }); console.log('load', okLoad);
console.log(errs.length ? errs.slice(0, 20).join('\n') : 'no errors'); await b.close();
