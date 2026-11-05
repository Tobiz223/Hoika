// Проверка нового интерфейса настоящей мышью и клавиатурой: node uitest.mjs <папка_скриншотов>
import puppeteer from 'puppeteer-core'; import path from 'path';
const R = path.resolve(import.meta.dirname, '..'); const OUT = process.argv[2];
const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:'new', args:['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--window-size=1600,900'] });
const p = await b.newPage(); await p.setViewport({ width:1600, height:900 });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' '))); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await p.goto('file:///' + R.replace(/\\/g, '/') + '/index.html'); await p.waitForFunction(() => document.querySelector('#loading').classList.contains('hidden'), { timeout:120000 });
const ev0 = (f, ...a) => p.evaluate(f, ...a);
const res = []; const check = (n, v) => res.push((v ? 'OK   ' : 'FAIL ') + n);
const wait = ms => new Promise(r => setTimeout(r, ms)); const shot = async n => { await wait(500); await p.screenshot({ path:path.join(OUT, n + '.png') }); };
const ev = (f, ...a) => p.evaluate(f, ...a);
const center = s => ev(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x:r.x + r.width / 2, y:r.y + r.height / 2 }; }, s);
const press = async s => { const c = await center(s); await p.mouse.click(c.x, c.y); await wait(60); };
await ev0(() => { window.__noUnloadGuard = true; UI.A.shell('pick'); }); await press('[data-a="startAs:GER"]'); await wait(700); await shot('ui_start');

check('значок войны скрыт в мирное время', await ev(() => document.querySelector('#t_war').classList.contains('hidden')));
// Клавиши в любой раскладке: физическая Q открывает политику
await p.keyboard.press('KeyQ'); check('Q открывает политику', await ev(() => UI.tab === 'politics')); await shot('ui_politics');
await p.keyboard.press('KeyE'); check('одно окно: E заменяет окно', await ev(() => UI.tab === 'tech' && document.querySelectorAll('#panel').length === 1)); await shot('ui_tech');
await p.keyboard.press('Escape'); check('Esc закрывает окно', await ev(() => UI.tab === null));

// Главное: кнопка нажимается, пока идёт время и панель обновляется
await p.keyboard.press('KeyR'); await wait(100);
const c0 = await center('[data-a="lineAdd"]'); const n0 = await ev(() => UI.me().lines.length);
await p.mouse.move(c0.x, c0.y); await p.mouse.down(); await ev(() => { for (let i = 0; i < 5; i++) { Game.advance(24); UI.onDay(); } }); await p.mouse.up(); await wait(60);
check('нажатие не теряется при обновлении панели', await ev(n => UI.me().lines.length === n + 1, n0));
await p.keyboard.press('Escape');

// Щелчок по стране: чужая -> дипломатия, своя -> политика
const scr = (prov) => ev(pr => { Render.view.z = .6; Render.view.x = PROV[pr].x; Render.view.y = PROV[pr].y; Render.clampView(); Render.draw(); const [x, y] = Render.worldToScreen(PROV[pr].x, PROV[pr].y); return { x, y }; }, prov);
const emptyProv = t => ev(t => { for (const P of M.prov) { if (G.ctrl[P.i] !== t || provDivs[P.i]?.length || P.t === 'urban') continue; return P.i; } return M.prov.find(P => G.ctrl[P.i] === t).i; }, t);
const clickProvOffset = async (t) => { const pr = await emptyProv(t); const s = await scr(pr); await wait(120); await p.mouse.click(s.x, s.y); await wait(80); };
await clickProvOffset('POL'); check('щелчок по чужой стране открывает дипломатию', await ev(() => UI.tab === 'diplo' && UI.sel.country === 'POL')); await shot('ui_diplo');
await p.keyboard.press('Escape'); await clickProvOffset('GER'); check('щелчок по своей стране открывает политику', await ev(() => UI.tab === 'politics')); await p.keyboard.press('Escape');
const dp = await emptyProv('GER'); const ds = await scr(dp); await wait(120); await p.mouse.click(ds.x, ds.y, { clickCount:2 }); await wait(100); check('двойной щелчок открывает штат', await ev(pr => Render.selProv === pr, dp)); await shot('ui_state'); await p.keyboard.press('Escape'); await p.keyboard.press('Escape');

// Режим стройки на карте
await p.keyboard.press('KeyT'); await wait(100); check('режим карты: стройка', await ev(() => Render.mode === 'build'));
const bp = await ev(() => { const c = UI.me(); const st = G.st.find(s => s && s.ctrl === c.t && !canBuild(c, s, 'civ')); return STATE_BY_ID[st.id].prov[0]; }); const bq = await ev(() => UI.me().buildq.length); const bs = await scr(bp); await wait(150); await p.mouse.click(bs.x, bs.y); await wait(100);
check('щелчок по штату ставит стройку', await ev(n => UI.me().buildq.length === n + 1, bq)); await shot('ui_build'); await p.keyboard.press('Escape'); check('выход возвращает режим карты', await ev(() => Render.mode === 'pol'));

// Войска: выбор, движение, панорама правой кнопкой не отдаёт приказ
const counter = await ev(() => { Render.view.z = .6; const P = PROV[UI.me().capital]; Render.view.x = P.x; Render.view.y = P.y; Render.draw(); const c = Render.counters.find(c => c.divs && c.x > 700 && c.x < 1400 && c.y > 150 && c.y < 700) || Render.counters.find(c => c.divs); return c && { x:c.x + c.w / 2, y:c.y + c.h / 2, id:c.divs[0], prov:c.prov }; });
await p.mouse.click(counter.x, counter.y); await wait(80); check('щелчок выбирает квадратик', await ev(i => Render.selected.has(i), counter.id));
const vx = await ev(() => Render.view.x); await p.mouse.move(800, 400); await p.mouse.down({ button:'right' }); await p.mouse.move(700, 400, { steps:4 }); await p.mouse.up({ button:'right' }); await wait(60);
check('правая кнопка с протяжкой двигает карту', await ev(v => Render.view.x !== v, vx)); check('протяжка не даёт приказ', await ev(i => G.divs[i].path.length === 0, counter.id));
await p.keyboard.press('Escape');

// Армия: рисуем фронт, стрелку, «Выполнить»
await ev(() => { G.wt = 50; declareWar('GER', 'POL', { force:true }); G.speed = 0; UI.refresh(); });
const A = await ev(() => { const A = Object.values(G.armies).find(a => a.tag === G.player); UI.A.selArmy(A.id); return A.id; }); await wait(80);
const border = await ev(() => { const list = M.prov.filter(P => G.ctrl[P.i] === 'GER' && P.land.some(a => G.ctrl[a] === 'POL')).filter(P => P.lat < 53 && P.lat > 50.5).sort((a, b) => a.y - b.y); Render.view.z = .55; const m = list[list.length >> 1]; Render.view.x = m.x; Render.view.y = m.y; Render.draw(); return list.map(P => Render.worldToScreen(P.x, P.y)); });
await press('[data-a="orderFront"]'); check('подсказка режима фронта', await ev(() => !document.querySelector('#hint').classList.contains('hidden')));
await p.mouse.move(border[0][0], border[0][1]); await p.mouse.down(); for (const [x, y] of border) await p.mouse.move(x, y, { steps:3 }); await p.mouse.up(); await wait(80);
check('фронт нарисован', await ev(i => G.armies[i].front === 'line' && G.armies[i].line.length > 1 && G.armies[i].lineTags.POL, A));
const wp = await ev(() => { const [x, y] = Render.worldToScreen(PROV[C('POL').capital].x, PROV[C('POL').capital].y); return { x:clamp(x, 80, 1500), y:clamp(y, 120, 780) }; }); const mid = border[border.length >> 1];
await press('[data-a="orderArrow"]'); await p.mouse.move(mid[0], mid[1]); await p.mouse.down(); await p.mouse.move(wp.x, wp.y, { steps:6 }); await p.mouse.up(); await wait(80);
check('стрелка нарисована', await ev(i => !!G.armies[i].target, A)); await shot('ui_plan');
await press(`[data-a="armyMode:${A}"]`); check('«Выполнить» запускает наступление', await ev(i => G.armies[i].mode === 'attack', A));
const before = await ev(() => M.prov.filter(P => G.ctrl[P.i] === 'GER').length);
await ev(() => { Game.advance(24 * 25); UI.refresh(); }); await shot('ui_war');
check('приказ армии не сброшен после боёв', await ev(i => G.armies[i].front === 'line' && G.armies[i].mode === 'attack', A));
await ev(() => { Render.selected.clear(); UI.curArmy = null; UI.renderBottom(); });
// Командиры: карточка генерала, новая группа, повышение
check('внизу видны командиры', await ev(() => { const t = document.querySelector('#armybar').innerHTML; return C('GER').gens.some(g => t.includes(g.n)) && document.querySelectorAll('#armybar .cmd .sil').length > 0; }));
await press('[data-a="cmdPick:army"]'); check('открыт выбор командира', await ev(() => !document.querySelector('#cmdpick').classList.contains('hidden'))); await shot('ui_cmdpick');
const fg = await ev(() => { const c = UI.me(); return c.gens.find(g => g.rank !== 'marshal' && !Object.values(G.armies).some(a => a.gen === g.id))?.id; });
if (fg) { await press(`[data-a="cmdArmy:${fg}"]`); check('щелчок по генералу создаёт его армию', await ev(g => Object.values(G.armies).some(a => a.gen === g), fg)); await ev(() => UI.A.selGroup(Object.values(G.groups).find(g => g.tag === G.player).id)); await ev(() => { Render.selected.clear(); UI.curGroup = null; UI.curArmy = null; UI.renderBottom(); }); } else check('есть свободный генерал', false);
const pr = await ev(() => { const c = UI.me(); c.pp = 500; const g = c.gens.find(x => x.rank !== 'marshal'); const e = promoteGeneral(c, g.id); return { e, ok:g.rank === 'marshal', army:Object.values(G.armies).some(a => a.gen === g.id) }; }); check('повышение до фельдмаршала снимает с армии', !pr.e && pr.ok && !pr.army);
const lim = await ev(() => { const c = UI.me(); const Gp = createGroup(c, []); for (let i = 0; i < 5; i++) armyToGroup(createArmy(c, []).id, Gp.id); const e = armyToGroup(createArmy(c, []).id, Gp.id); const n = Gp.armies.length; disbandGroup(Gp); return { e, n }; }); check('в группе не больше 5 армий', lim.n === 5 && !!lim.e);
// Группа: один фронт делится между армиями, покрывает весь участок и идёт за границей
const GP = await ev(() => { const c = UI.me(); for (const A of Object.values(G.armies)) if (A.tag === c.t && !A.divs.length) disbandArmy(A); const Gp = Object.values(G.groups).find(g => g.tag === c.t); for (const A of Object.values(G.armies)) if (A.tag === c.t) { A.front = null; A.line = null; A.indep = false; A.mode = 'hold'; A.target = null; if (A.group !== Gp.id) armyToGroup(A.id, Gp.id); } UI.A.selGroup(Gp.id); return Gp.id; });
const b2 = await ev(() => { const list = M.prov.filter(P => G.ctrl[P.i] === 'GER' && P.land.some(a => G.ctrl[a] === 'POL')).sort((a, b) => a.y - b.y); Render.view.z = .45; const m = list[list.length >> 1]; Render.view.x = m.x; Render.view.y = m.y; Render.draw(); return list.map(P => Render.worldToScreen(P.x, P.y)).filter(([x, y]) => x > 20 && x < 1580 && y > 110 && y < 640); });
await press('[data-a="orderFront"]'); await p.mouse.move(b2[0][0], b2[0][1]); await p.mouse.down(); for (const [x, y] of b2) await p.mouse.move(x, y, { steps:3 }); await p.mouse.up(); await wait(100);
check('фронт группы назначен всем армиям', await ev(g => { const Gp = G.groups[g]; return !!Gp.line && Gp.armies.every(i => G.armies[i].front === 'group'); }, GP));
await ev(() => { Game.advance(24 * 20); UI.refresh(); });
let cov; for (let tries = 0; tries < 4; tries++) { cov = await ev(g => { const Gp = G.groups[g], c = UI.me(); runGroupFront(c, Gp); const fp = Gp.armies.flatMap(i => { const a = G.armies[i]; runArmyFront(c, a); return a._fp || []; }); const covered = fp.filter(p => (provDivs[p] || []).some(id => G.divs[id].tag === c.t) || Object.values(G.divs).some(d => d.tag === c.t && d.slot === p)); const onBorder = fp.every(p => PROV[p].land.some(a => isEnemy(c.t, G.ctrl[a]))); const divs = Gp.armies.reduce((v, i) => v + G.armies[i].divs.length, 0); const missed = fp.filter(p => !covered.includes(p)).map(p => { const A = Gp.armies.map(i => G.armies[i]).find(a => (a._fp || []).includes(p)); return G.st[PROV[p].s].name + ' [' + A.name + ' див ' + A.divs.length + ' участок ' + A._fp.length + ']'; }); const bad = fp.filter(p => !PROV[p].land.some(a => isEnemy(c.t, G.ctrl[a]))).map(p => G.st[PROV[p].s].name + ':' + PROV[p].land.map(a => G.ctrl[a]).join('/')); return { fp:fp.length, covered:covered.length, onBorder, divs, dup:fp.length - new Set(fp).size, tags:Object.keys(Gp.lineTags || {}), missed, bad, arm:Gp.armies.map(i => G.armies[i].divs.length + '/' + (G.armies[i]._fp || []).length) }; }, GP); if (cov.covered === cov.fp) break; await ev(() => Game.advance(24 * 4)); } console.log('coverage', JSON.stringify(cov));
check('фронт стоит на текущей границе', cov.fp > 0 && cov.onBorder); check('участки армий не пересекаются', cov.dup === 0); check('весь участок закрыт', cov.covered === cov.fp || cov.divs < cov.fp);
await ev(() => { Render.view.z = .55; G.ctrlDirty = true; }); await shot('ui_front');
await ev(g => { const Gp = G.groups[g]; const a = Gp.armies.map(i => G.armies[i]).find(x => x._fp && x._fp.length); const P = PROV[a._fp[Math.floor(a._fp.length / 2)]]; Render.view.z = 1.3; Render.view.x = P.x; Render.view.y = P.y; Render.selected.clear(); UI.renderBottom(); UI.curGroup = g; UI.A.selGroup(g); }, GP); await p.screenshot({ path:path.join(OUT, 'ui_front_zoom.png'), clip:{ x:240, y:100, width:1100, height:700 } }); await new Promise(r => setTimeout(r, 300)); await p.screenshot({ path:path.join(OUT, 'ui_front_zoom.png'), clip:{ x:240, y:100, width:1100, height:700 } });
await ev(() => UI.A.cmdFor()); await shot('ui_cmdwindow'); await ev(() => UI.A.cmdClose());
const moved = await ev(g => { const Gp = G.groups[g], c = UI.me(); const before = new Set(frontProvinces(c, Gp)); const foe = [...before].flatMap(p => PROV[p].land).find(a => G.ctrl[a] === 'POL' && !(provDivs[a] || []).length) || [...before].flatMap(p => PROV[p].land).find(a => G.ctrl[a] === 'POL'); for (const id of (provDivs[foe] || []).slice()) destroyDiv(G.divs[id]); captureProv(foe, 'GER'); Game.advance(24); const line = !!Gp.line; const now = frontProvinces(c, Gp); return { line, n:now.length, border:now.every(p => PROV[p].land.some(a => isEnemy(c.t, G.ctrl[a]))) }; }, GP); check('после смены границы фронт не сброшен и на границе', moved.line && moved.n > 0 && moved.border);

// Фронт щелчком только против одной страны
const clickFront = await ev(() => { const c = UI.me(); const A = createArmy(c, Object.values(G.divs).filter(d => d.tag === c.t).slice(0, 6).map(d => d.id)); UI.A.selArmy(A.id); UI.setOrder('front'); const P = M.prov.find(P => G.ctrl[P.i] === 'CZE'); Render.view.x = P.x; Render.view.y = P.y; Render.view.z = .6; Render.draw(); UI.finishStroke([[P.x, P.y]]); runArmyFront(c, A); const fp = A._fp || []; return { front:A.front, n:fp.length, onlyCZE:fp.every(p => PROV[p].land.some(a => G.ctrl[a] === 'CZE')) }; });
check('щелчок даёт фронт только с одной страной: ' + JSON.stringify(clickFront), clickFront.front === 'CZE' && clickFront.n > 0 && clickFront.onlyCZE);
// Видимость
const vis = await ev(() => { Render.view.z = .6; Render.draw(); const seen = new Set(); for (const c of Render.counters) for (const id of (provDivs[c.prov] || [])) if (Render.pickWorld) seen.add(c.prov); const me = G.player; const neutralDrawn = Object.values(G.divs).some(d => { if (Render.visibleTag(d.tag) || Render.visibleTag(d.side || d.tag)) return false; return false; }); const [x, y] = [0, 0]; const tags = new Set(); const origCounter = Render.drawCounter; Render.drawCounter = function (g, X, Y, W, H, tag) { tags.add(tag); return origCounter.apply(this, arguments); }; Render.draw(); Render.drawCounter = origCounter; return [...tags].filter(t => !Render.visibleTag(t)); });
check('видны только свои, союзники и враги: лишних ' + vis.length, vis.length === 0);
await ev(() => UI.renderTop()); check('значок войны виден во время войны', await ev(() => !document.querySelector('#t_war').classList.contains('hidden')));
await p.keyboard.press('KeyB'); await wait(150); check('окно войны открыто', await ev(() => UI.tab === 'war' && document.querySelectorAll('.wbar').length > 1)); await shot('ui_warmenu');
const onlyMine = await ev(() => { const fake = { id:999, name:'Чужая война проверка', atk:['SWE'], def:['NOR'], start:G.hour }; G.wars.push(fake); UI.renderPanel(); const has = document.querySelector('#panel').textContent.includes('Чужая война проверка'); G.wars.pop(); return !has; }); check('чужие войны не показаны', onlyMine);
const limits = await ev(() => ({ sov:surrenderLimit(C('SOV')), fra:surrenderLimit(C('FRA')) })); check('лимиты у стран разные: ' + JSON.stringify(limits), limits.sov > limits.fra);
await p.keyboard.press('Escape');
// Автопауза при войне
const paused = await ev(() => { G.speed = 3; declareWar('GER', 'DEN', { force:true }); return G.speed; }); check('пауза при начале войны', paused === 0);
// Оповещения
const al = await ev(() => { UI.me().focus.cur = null; UI.renderAlerts(); return document.querySelectorAll('#alerts button').length; }); check('оповещения показаны: ' + al, al > 0);
await press('#alerts button'); check('оповещение открывает раздел', await ev(() => UI.tab !== null)); await p.keyboard.press('Escape');
// Мышь у края двигает карту
const ex = await ev(() => { Render.view.z = 1; Render.view.x = 2000; return Render.view.x; }); await p.mouse.move(1599, 400); await wait(400); check('край экрана двигает карту', await ev(v => Render.view.x > v, ex)); await p.mouse.move(800, 400);
await p.keyboard.press('KeyI'); await shot('ui_design'); await p.keyboard.press('KeyW'); await shot('ui_focus'); await p.keyboard.press('Escape');
await ev(() => { G.pending.push({ id:1, title:'Проверка', text:'Текст события', options:[{ t:'Понятно', fx:() => {} }] }); UI.showEvent(); }); await shot('ui_event'); await press('[data-a="eventPick:0"]');
console.log(res.join('\n')); console.log(errs.length ? errs.slice(0, 20).join('\n') : 'no errors'); await b.close();
