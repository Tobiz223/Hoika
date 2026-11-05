// Сквозная проверка действий игрока настоящей мышью и кнопками.
import puppeteer from 'puppeteer-core'; import path from 'path';
const R = path.resolve(import.meta.dirname, '..'); const OUT = process.argv[2];
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:'new', args:['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--window-size=1600,900'] });
const p = await b.newPage(); await p.setViewport({ width:1600, height:900 });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' '))); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await p.goto('file:///' + R.replace(/\\/g, '/') + '/index.html'); await p.waitForFunction(() => document.querySelector('#loading').classList.contains('hidden'), { timeout:120000 });
const ev0 = (f, ...a) => p.evaluate(f, ...a);
const res = []; const check = (n, v) => { res.push((v ? 'OK   ' : 'FAIL ') + n); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const click = s => p.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('no ' + s); e.click(); }, s);
await ev0(() => { window.__noUnloadGuard = true; UI.A.shell('pick'); }); await click('[data-a="startAs:GER"]'); await wait(800);

// 1. Выбор квадратика мышью и движение правой кнопкой
await p.evaluate(() => { Render.view.z = .6; Render.draw(); });
const info = await p.evaluate(() => { const c = Render.counters.find(c => c.divs && c.prov && c.x > 200 && c.x < 1300 && c.y > 110 && c.y < 720); return c ? { x:c.x + c.w / 2, y:c.y + c.h / 2, n:c.divs.length, id:c.divs[0], prov:c.prov } : null; });
await p.mouse.move(info.x, info.y); await p.mouse.down(); await p.mouse.up(); await wait(200);
check('клик выбирает дивизии', await p.evaluate(id => Render.selected.has(id), info.id));
const target = await p.evaluate(prov => { const P = PROV[prov]; const a = P.land.find(q => G.ctrl[q] === G.player); const n = PROV[a]; return { a, ...Render.worldToScreen(n.x, n.y) }; }, info.prov).catch(() => null);
const scr = await p.evaluate(prov => { const P = PROV[prov]; const a = P.land.find(q => G.ctrl[q] === G.player); const [x, y] = Render.worldToScreen(PROV[a].x, PROV[a].y); return { a, x, y }; }, info.prov);
await p.mouse.move(scr.x, scr.y); await p.mouse.down({ button:'right' }); await p.mouse.up({ button:'right' }); await wait(200);
check('правый клик задаёт путь', await p.evaluate((id, a) => { const d = G.divs[id]; return d.path[d.path.length - 1] === a; }, info.id, scr.a));
await p.evaluate(() => Game.advance(24 * 12)); check('дивизия дошла', await p.evaluate((id, a) => G.divs[id].prov === a, info.id, scr.a));

// 2. Рамка
await p.evaluate(() => { Render.selected.clear(); UI.renderBottom(); });
await p.mouse.move(250, 110); await p.mouse.down(); await p.mouse.move(1350, 790, { steps:5 }); await p.mouse.up(); await wait(200);
check('рамка выделяет', await p.evaluate(() => Render.selected.size > 0));

// 3. Скорость и время
const h0 = await p.evaluate(() => G.hour); await click('[data-a="speed:5"]'); await wait(1500); await click('[data-a="pause"]');
check('время идёт', await p.evaluate(h => G.hour > h, h0));

// 4. Конструктор: сохранить шаблон и набрать дивизию
await click('[data-a="tab:design"]'); await click('[data-a="newTpl"]'); await click('[data-a="dslot:0"]'); await click('[data-a="dset:inf"]'); await click('[data-a="dslot:1"]'); await click('[data-a="dset:inf"]');
const wrongGroupDisabled = await p.evaluate(() => { UI.A.dslot(2); const b = document.querySelector('[data-a="dset:art"]'); return b.disabled; });
check('колонка не принимает другой род войск', wrongGroupDisabled);
await p.evaluate(() => { UI.A.dset('inf'); UI.me().xp.army = 100; UI.renderPanel(); }); await click('[data-a="dsave"]');
const tplKey = await p.evaluate(() => UI.sel.design.key); check('шаблон сохранён', await p.evaluate(k => !!UI.me().tpls[k], tplKey));
await click('[data-a="tab:army"]'); await click(`[data-a="recruit:${tplKey}:1"]`); check('набор поставлен', await p.evaluate(() => UI.me().recruit.length > 0));
const before = await p.evaluate(() => Object.values(G.divs).filter(d => d.tag === G.player).length);
await p.evaluate(() => { UI.me().stock.inf_eq += 5000; Game.advance(24 * 95); }); check('новая дивизия появилась', await p.evaluate(b => Object.values(G.divs).filter(d => d.tag === G.player).length > b, before));
await click('[data-a="tab:army"]');

// 5. Фокус, наука, закон, советник, стройка, производство, торговля
await click('[data-a="tab:focus"]'); await click('[data-a="focus:fi_plan"]'); check('фокус начат', await p.evaluate(() => UI.me().focus.cur === 'fi_plan')); await click('[data-a="tab:focus"]');
await click('[data-a="tab:tech"]'); await click('[data-a="research:t_inf2"]'); check('исследование начато', await p.evaluate(() => UI.me().tech.slots.some(s => s && s.id === 't_inf2')));
await click('[data-a="techCat:nav"]'); await click('[data-a="research:n_gun2"]');
const hp0 = await p.evaluate(() => shipStat(UI.me(), 'bb', 'gun')); await p.evaluate(() => { grantTech(UI.me(), 'n_gun2'); recalcMods(UI.me()); }); check('модуль усиливает тип корабля', await p.evaluate(h => shipStat(UI.me(), 'bb', 'gun') > h, hp0)); await click('[data-a="tab:tech"]');
await click('[data-a="tab:politics"]'); await p.evaluate(() => { UI.me().pp = 500; UI.renderPanel(); }); await click('[data-a="law:edu:public"]'); check('закон принят', await p.evaluate(() => UI.me().laws.edu === 'public')); await click('[data-a="advHire:a_tycoon"]'); check('советник нанят', await p.evaluate(() => UI.me().adv.includes('a_tycoon'))); await click('[data-a="tab:politics"]');
await click('[data-a="tab:build"]'); const bq0 = await p.evaluate(() => UI.me().buildq.length); await p.evaluate(() => { const c = UI.me(); const st = G.st.find(s => s && s.ctrl === c.t && !canBuild(c, s, 'civ')); const P = PROV[STATE_BY_ID[st.id].prov[0]]; Render.view.x = P.x; Render.view.y = P.y; Render.clampView(); const [x, y] = Render.worldToScreen(P.x, P.y); UI.leftClick(x, y); }); check('стройка в очереди', await p.evaluate(b => UI.me().buildq.length > b, bq0)); await click('[data-a="tab:build"]');
await click('[data-a="tab:prod"]'); const l0 = await p.evaluate(() => UI.me().lines.length); await click('[data-a="lineAdd"]'); check('линия добавлена', await p.evaluate(l => UI.me().lines.length > l, l0)); await click('[data-a="shipAdd"]'); await click('[data-a="tab:prod"]');
await click('[data-a="tab:trade"]'); await click('[data-a="tradeRes:oil"]'); const buy = await p.$('[data-a^="tradeBuy:"]'); if (buy) { await click('[data-a^="tradeBuy:"]'); check('сделка заключена', await p.evaluate(() => UI.me().trade.length > 0)); } else check('есть продавцы нефти', false); await click('[data-a="tab:trade"]');

// 6. Авиация и флот
await click('[data-a="tab:air"]'); await p.evaluate(() => { const w = Object.values(G.wings).find(w => w.tag === G.player && w.type === 'ftr'); UI.A.wingMission(w.id, 'sup'); UI.A.wingZone(w.id, G.st[w.base].zone); }); check('миссия авиации', await p.evaluate(() => Object.values(G.wings).some(w => w.tag === G.player && w.mission === 'sup'))); await click('[data-a="tab:air"]');
await click('[data-a="tab:navy"]'); await click('[data-a="fleetMission:patrol"]'); check('флот на патруль', await p.evaluate(() => Object.values(G.fleets).some(f => f.tag === G.player && f.mission === 'patrol'))); await click('[data-a="tab:navy"]');

// 7. Война, армия, наступление, мирная конференция
await p.evaluate(() => { const c = UI.me(); c.wargoals = { LUX:true, DEN:true }; c.pp = 500; UI.sel.country = 'DEN'; UI.tab = 'diplo'; UI.renderPanel(); }); await click('[data-a="dip:war"]');
check('война объявлена', await p.evaluate(() => isEnemy(G.player, 'DEN'))); await click('[data-a="tab:diplo"]');
await p.evaluate(() => { const A = Object.values(G.armies).find(a => a.tag === G.player); UI.A.selArmy(A.id); UI.A.armyFront(A.id, 'DEN'); UI.A.armyMode(A.id); });
let peace = false; for (let i = 0; i < 40 && !peace; i++) { peace = await p.evaluate(() => { Game.advance(24 * 8); return !!G.peace; }); }
check('капитуляция и конференция', peace);
if (peace) { await wait(300); await p.evaluate(() => UI.renderPeace()); await p.screenshot({ path:path.join(OUT, 'peace.png') }); const id = await p.evaluate(() => { const P = G.peace; P.score[G.player] = 500; UI.renderPeace(); return P.lands[0]; }); await click(`[data-a="peaceToggle:${id}"]`); check('штат выбран', await p.evaluate(i => G.peace.taken[i] === G.player, id)); await click('[data-a="peaceDone"]'); await wait(300); check('штат присоединён', await p.evaluate(i => G.st[i].owner === G.player, id)); }

// 8. Десант
const land = await p.evaluate(() => { const c = UI.me(); const coast = M.prov.find(P => P.coastal && G.ctrl[P.i] === c.t && G.vp[P.i] > 0); const d = spawnDivision(c, 'inf', coast.i, 1); declareWar(G.player, 'NOR', { force:true }); const tgt = M.prov.find(P => P.coastal && G.ctrl[P.i] === 'NOR' && !hostileDivsAt(G.player, P.i).length); const e = orderLanding([d], tgt.i); return { e, id:d.id, tgt:tgt.i }; });
check('приказ на десант: ' + (land.e || 'принят'), !land.e);
await p.evaluate(() => Game.advance(24 * 11)); check('десант высадился', await p.evaluate(l => G.divs[l.id] && (G.divs[l.id].prov === l.tgt), land));

// 9. Формируемые: Рим и ЕС
const rome = await p.evaluate(() => { UI.A.startAs('ITA'); const c = UI.me(); c.pp = 2000; const log = []; for (const id in DB.ROME_REGIONS) { const R = DB.ROME_REGIONS[id]; for (const s of romeStates(R)) setStateOwner(s, 'ITA'); log.push(nationalize(c, id)); c.pp = 2000; } const e = formCountry(c, 'ROM2'); return { log, e, n:c.n }; });
check('Римская империя: ' + rome.n + ' ' + (rome.e || ''), rome.n === 'Римская империя' && !rome.e);
const eu = await p.evaluate(() => { UI.A.startAs('FRA'); const c = UI.me(); c.pp = 1000; for (const t of DB.EU_REQUIRED) if (t !== 'FRA') for (const s of G.st) if (s && s.orig === t) setStateOwner(s, 'FRA'); const e = formCountry(c, 'EUR'); return { e, n:c.n }; });
check('Европейский союз: ' + eu.n + ' ' + (eu.e || ''), eu.n === 'Европейский союз' && !eu.e);
await p.evaluate(() => { Game.advance(48); UI.refresh(); }); await wait(600); await p.screenshot({ path:path.join(OUT, 'eu.png') });

console.log(res.join('\n')); console.log(errs.length ? errs.slice(0, 20).join('\n') : 'no errors'); await b.close();
