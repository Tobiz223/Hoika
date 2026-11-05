// ИИ стран и главный игровой цикл.
function aiPrepareWar(c) {
  const list = Object.values(G.armies).filter(a => a.tag === c.t);
  for (const A of list) { A.front = 'all'; A.mode = aiAggressive(c) ? 'attack' : 'hold'; }
}
function aiPlanFront(c, target) { for (const A of Object.values(G.armies).filter(a => a.tag === c.t)) { A.front = target; A.mode = 'hold'; } }
function divPower(t) { let v = 0; for (const id in G.divs) { const d = G.divs[id]; if (d.tag === t) v += divStats(C(t), d.tpl).sa * d.str + divStats(C(t), d.tpl).def * d.str * .3; } return v; }
function aiAggressive(c) {
  if (G.wars.some(w => w.atk.includes(c.t))) return true;
  const contact = new Set(); for (const P of M.prov) { if (G.ctrl[P.i] !== c.t) continue; for (const a of P.land) { const o = G.ctrl[a]; if (o && isEnemy(c.t, o)) contact.add(o); } }
  if (!contact.size) return false; let en = 0; for (const t of contact) en += divPower(t); const my = divPower(c.t);
  const bold = c.i === 'fas' || c.i === 'com'; return my > en * (bold ? .7 : 1.25);
}
const AI_RESEARCH = { GER:['ind','arm','inf','air','ele','art','sup','nav'], SOV:['ind','inf','arm','art','air','sup','ele','nav'], ENG:['ind','air','nav','ele','inf','arm','art','sup'], FRA:['ind','inf','art','arm','air','sup','ele','nav'], ITA:['ind','inf','nav','air','arm','art','sup','ele'] };
function aiResearch(c) {
  while (c.tech.slots.length < researchSlots(c)) c.tech.slots.push(null);
  const y = curYear(); const prio = AI_RESEARCH[c.t] || ['ind','inf','art','air','sup','ele','arm','nav'];
  for (let i = 0; i < researchSlots(c); i++) {
    if (c.tech.slots[i]) continue; let best = null, bv = 1e9;
    for (const id in DB.TECH) { if (!canResearch(c, id)) continue; const T = DB.TECH[id]; if (T.year > y + (c.major ? 0 : 0)) continue; const v = prio.indexOf(T.cat) * 2 + (T.year - y) * 3 + Math.random() * 6 + (y - T.year > 1 ? -2 : 0); if (v < bv) { bv = v; best = id; } }
    if (best) startResearch(c, best, i);
  }
}
function aiFocus(c) {
  if (c.focus.cur) return; const opts = DB.FOCUS.filter(F => focusAvailable(c, F) && (!F.fx.gov || F.fx.gov === c.i));
  if (!opts.length) return; const pr = f => { let s = Math.random() * 3; if (f.x <= 2) s += 3; if (f.x >= 4 && f.x <= 6) s += atWar(c) ? 4 : 2; if (f.x >= 14) s += 1; if (f.id === 'fi_lab') s += 3; if (f.x >= 11 && f.x <= 13) s += DB.COUNTRIES.find(x => x.t === c.t)?.dock > 3 ? 1 : -3; return s; };
  opts.sort((a, b) => pr(b) - pr(a)); startFocus(c, opts[0].id);
}
function aiLaws(c) {
  const year = curYear();
  const step = (law, goal) => { const list = DB.LAWS[law].list; const i = list.findIndex(l => l.id === c.laws[law]), g = list.findIndex(l => l.id === goal); if (i < g) setLaw(c, law, list[i + 1].id); };
  if (G.wt > 15 || atWar(c)) step('econ', c.major && year >= 1938 ? 'war' : 'partial'); else step('econ', 'early');
  if (c.mpAvail < 60000 || atWar(c)) step('consc', atWar(c) ? 'service' : 'limited');
  if (c.pp > 300 && c.adv.length < 5) { const pool = DB.ADVISORS.filter(a => !c.adv.includes(a.id) && c.adv.filter(x => DB.ADVISORS.find(y => y.id === x).slot === a.slot).length < DB.ADV_SLOTS[a.slot]); if (pool.length) hireAdvisor(c, pool[Math.floor(Math.random() * pool.length)].id); }
  for (const fam in c.docs) { const dc = c.docs[fam]; const D = DB.DOCTRINES[fam]; const path = dc.path || D.paths[(c.t.charCodeAt(0) + fam.length) % D.paths.length].id; takeDoctrine(c, fam, path); }
}
function aiBuild(c) {
  const free = freeCivs(c); if (c.buildq.length * 15 >= free && c.buildq.length) return; const y = curDate().getUTCFullYear(); const wantCiv = y <= 1937 && !atWar(c); const order = [wantCiv ? 'civ' : 'mil', wantCiv ? 'mil' : 'civ', 'infra'];
  if ((c.res.oil || 0) < (c.resUse?.oil || 0) * .8) order.unshift('synth');
  for (const type of order) { const sts = G.st.filter(s => s && s.ctrl === c.t && s.owner === c.t && !canBuild(c, s, type)).sort((a, b) => (b.infra - a.infra) || (a.civ + a.mil - b.civ - b.mil)); if (sts[0]) { queueBuild(c, sts[0], type); return; } }
}
function aiProduction(c) {
  const mil = Math.round(c.milN); let plan;
  const y = curYear();
  if (mil <= 0) { c.lines = c.lines.filter(l => l.ship); return; }
  if (!c.major) plan = [['inf_eq',.5],['art_eq',.12],['sup_eq',.08],['ftr',.3]];
  else {
    const tankEq = c.tech.gen.mtk_eq != null ? 'mtk_eq' : 'ltk_eq';
    plan = [['inf_eq',.25],['art_eq',.1],['sup_eq',.05],['mot_eq',.05],[tankEq,.15],['ftr',.2],['cas',.07],['tac',.08],['at_eq',.03],['aa_eq',.02]];
    if (['ENG'].includes(c.t)) plan[6] = ['str', .07];
  }
  const keep = c.lines.filter(l => l.ship); const old = Object.fromEntries(c.lines.filter(l => !l.ship).map(l => [l.eq, l]));
  const lines = []; let left = mil;
  for (const [eq, p] of plan) { if (eq !== 'inf_eq' && c.tech.gen[eq] == null && !['art_eq','sup_eq','inf_eq','mot_eq'].includes(eq)) continue; const f = Math.max(1, Math.round(mil * p)); const n = Math.min(left, f); if (n <= 0) continue; left -= n; const L = old[eq] || { id:nid(), eq, eff:.15 }; L.fac = n; lines.push(L); }
  if (left > 0 && lines[0]) lines[0].fac += left;
  // Корабли
  c.lines = lines.concat(keep);
  if (c.dockN >= 1 && dockAssigned(c) < c.dockN) { const t = c.major ? (Math.random() < .5 ? 'dd' : Math.random() < .5 ? 'cl' : 'ss') : 'dd'; if (keep.length < 2) addLine(c, t, Math.min(5, Math.ceil(c.dockN - dockAssigned(c))), true); }
  for (const l of c.lines) if (l.ship) l.fac = Math.min(l.fac, Math.max(1, Math.round(c.dockN / Math.max(1, c.lines.filter(x => x.ship).length))));
}
function aiRecruit(c) {
  const count = Object.values(G.divs).reduce((v, d) => v + (d.tag === c.t), 0); const target = Math.round((c.milN + 4) * (atWar(c) ? 3.5 : 2.5) + (c.major ? 10 : 0));
  const pending = c.recruit.reduce((v, r) => v + r.n, 0);
  const cap = Math.max(c.major ? 18 : 6, Math.round(c.milN * (c.t === 'SOV' ? .35 : .6)));
  if (count + pending < target && c.mpAvail > 20000 && pending < cap) {
    const t = c.major && c.tpls.tank && Math.random() < .15 ? 'tank' : c.major && c.tpls.mot && Math.random() < .1 ? 'mot' : 'inf';
    c.recruit.push({ id:nid(), tpl:c.tpls[t] ? t : 'inf', n:Math.min(c.major ? 8 : 4, target - count - pending), prog:0, dest:null });
  }
  // Шаблоны без снаряжения не должны стопорить набор, режим армий пересматривается
  for (const r of c.recruit) { const s = divStats(c, r.tpl); if (r.prog >= s.train) { r.wait = (r.wait || 0) + 7; if (r.wait > 45 && r.tpl !== 'inf') { r.tpl = 'inf'; r.wait = 0; } } }
  if (atWar(c)) { const mode = aiAggressive(c) ? 'attack' : 'hold'; for (const A of Object.values(G.armies)) if (A.tag === c.t) { A.front = 'all'; A.mode = mode; } }
  // Армейские новобранцы
  const orphan = Object.values(G.divs).filter(d => d.tag === c.t && !d.army); if (orphan.length) { let A = Object.values(G.armies).find(a => a.tag === c.t && a.divs.length < 24); const ids = orphan.map(o => o.id); if (A) { for (const id of ids) { if (A.divs.length >= 30) { A = createArmy(c, [], null); } G.divs[id].army = A.id; A.divs.push(id); } } else A = createArmy(c, ids); if (atWar(c)) { A.front = 'all'; A.mode = aiAggressive(c) ? 'attack' : 'hold'; } }
  // Обновление шаблона пехоты
  if (curYear() >= 1938 && c.tpls.inf && !c.tpls.inf.grid.includes('art') && !c.flags.tplUp) { c.flags.tplUp = true; const g = c.tpls.inf.grid; g[15] = 'art'; g[16] = 'art'; c.dcache = {}; if (c.tech.done.t_eng) c.tpls.inf.sup[0] = 'eng'; if (c.tech.done.t_rec) c.tpls.inf.sup[1] = 'rec'; c.dcache = {}; }
}
function aiAir(c) {
  for (const k of ['ftr','cas','tac','str','nav']) { if ((c.stock[k] || 0) >= 80) { const w = createWing(c, k, Math.floor(c.stock[k])); if (w) c.stock[k] -= Math.floor(c.stock[k]); } }
  // Куда направить: зоны с фронтом, иначе столичная
  const hot = new Set(); if (atWar(c)) { for (const b of Object.values(G.battles)) { const a0 = G.divs[b.atk[0]]; if (!a0) continue; if (side(a0) === c.t || isEnemy(side(a0), c.t)) { const z = G.st[PROV[b.prov].s]?.zone; if (z != null) hot.add(z); } } }
  const list = [...hot]; let zones = list; const base = bestBase(c); const baseZone = base?.zone ?? 0; if (!zones.length) zones = [baseZone];
  for (const id in G.wings) {
    const w = G.wings[id]; if (w.tag !== c.t) continue; const z = zones[Math.floor(Math.random() * zones.length)];
    const near = G.st.filter(s => s && s.ctrl === c.t && s.air > 0 && s.zone != null).sort((a, b) => Math.hypot(G.zones[a.zone].x - G.zones[z].x, G.zones[a.zone].y - G.zones[z].y) - Math.hypot(G.zones[b.zone].x - G.zones[z].x, G.zones[b.zone].y - G.zones[z].y))[0]; if (near) w.base = near.id;
    w.zone = z; w.mission = { ftr:'sup', cas:'cas', tac:'cas', str:'str', nav:'nav' }[w.type];
    if (w.mission === 'nav') { const sea = M.prov.filter(p => p.coastal && G.ctrl[p.i] === c.t)[0]; if (sea) w.sea = sea.seaAdj[0]; else w.mission = null; }
    if (w.mission === 'str' && !atWar(c)) w.mission = null;
  }
}
function aiNavy(c) {
  for (const id in G.fleets) {
    const f = G.fleets[id]; if (f.tag !== c.t || f.travel > 0 || !f.ships.length) continue; const hp = f.ships.reduce((v, s) => v + s.hp / shipStat(c, s.t, 'hp'), 0) / f.ships.length;
    if (hp < .6) { if (f.mission !== 'base') orderFleet(f, f.zone, 'base'); continue; }
    if (f.mission === 'base' && hp > .9) { const port = homePort(c); if (port) orderFleet(f, PROV[port].seaAdj[0], 'patrol'); }
  }
}
function aiDiplo(c) {
  if (!atWar(c) && !c.faction && !c.major && c.ai) {
    if (c.i !== 'dem' && G.wt > 40) { const best = Object.values(G.factions).find(F => C(F.leader).i === c.i); if (best && Math.random() < .03) joinFaction(c, best.id); }
  }
  // Торговля
  const need = c.resUse || {}, have = c.resHave || {};
  if (c.trade.length < 6) for (const r in need) if ((have[r] || 0) < need[r] * .8) { const sellers = Object.values(G.c).filter(s => s.t !== c.t && !s.dead && !s.capitulated && !isEnemy(c.t, s.t) && tradeOffer(c.t, s.t, r) >= 8).sort((a, b) => tradeOffer(c.t, b.t, r) - tradeOffer(c.t, a.t, r)); if (sellers[0] && freeCivs(c) > 3) { tradeBuy(c, sellers[0].t, r, 8); break; } }
}
function aiDaily(c, phase) {
  if (phase === 0) { aiResearch(c); aiFocus(c); }
  if (phase === 1) aiBuild(c);
  if (phase === 2) aiProduction(c);
  if (phase === 3) aiRecruit(c);
  if (phase === 4) { aiLaws(c); aiDiplo(c); }
  if (phase === 5) aiAir(c);
  if (phase === 6) aiNavy(c);
}

// ---------- главный цикл ----------
function tick() {
  G.hour++;
  hourlyMove(); hourlyBattles(); hourlyLandings();
  if (G.hour % 4 === 0) hourlyOrgRecover();
  const h = G.hour % 6;
  for (const id in G.groups) { if (id % 6 !== h) continue; const Gp = G.groups[id]; const c = C(Gp.tag); if (c && !c.capitulated && !c.ai) runGroupFront(c, Gp); }
  for (const id in G.armies) { const A = G.armies[id]; if (id % 6 !== h) continue; const c = C(A.tag); if (!c || c.capitulated || A.front == null) continue; if (c.ai && !atWar(c) && G.hour % 24 !== h) continue; runArmyFront(c, A); }
  if (G.hour % 24 === 0) dayTick();
}
function dayTick() {
  const day = G.hour / 24; const dt = curDate();
  if (dt.getUTCDate() === 1 || !G.snow.length) updateWeather();
  for (const t in G.c) { const c = G.c[t]; if (c.dead || c.capitulated) continue; dailyCountry(c); if (c.ai) aiDaily(c, (day + t.charCodeAt(0) + t.charCodeAt(1)) % 7); }
  computeStateCtrl(); dailySupplyEffects(); dailyAir(); dailyNavy(); dailySurrender(); warEndCheck(); dailyEvents();
  // Опыт за учения и мирное время
  for (const t in G.c) { const c = G.c[t]; if (c.dead) continue; c.xp.army = Math.min(999, c.xp.army + .03 + (c.m.xp || 0)); c.xp.air = Math.min(999, c.xp.air + .02); c.xp.navy = Math.min(999, c.xp.navy + .015); if (t === G.player && dt.getUTCDate() === 1 && dt.getUTCMonth() % 1 === 0) { /* автосейв ниже */ } }
  if (dt.getUTCDate() === 1 && !G.noAutosave && typeof Save !== 'undefined') Save.auto();
  G.day = day;
}
const Save = {
  key:'steelFrontier.save.',
  dump() { return JSON.stringify(G, (k, v) => { if (v instanceof Float32Array) return undefined; if (k === 'dcache') return undefined; return v; }); },
  load(json) { G = JSON.parse(json); G.groups = G.groups || {}; for (const g of Object.values(G.c).flatMap(c => c.gens)) g.rank = g.rank || 'general'; for (const t in G.c) { const c = G.c[t]; c.dcache = {}; c.sup = null; recalcMods(c); } recalcWarRel(); rebuildIndex(); for (const t in G.c) if (!G.c[t].dead) computeSupply(G.c[t]); if (!G.snow.length) updateWeather(); G.ctrlDirty = true; },
  write(slot) { try { localStorage.setItem(this.key + slot, this.dump()); localStorage.setItem(this.key + slot + '.meta', JSON.stringify({ when:new Date().toLocaleString('ru'), date:dateStr(), tag:C(G.player).n })); return true; } catch (e) { return false; } },
  read(slot) { try { const j = localStorage.getItem(this.key + slot); if (!j) return false; this.load(j); return true; } catch (e) { return false; } },
  meta(slot) { try { return JSON.parse(localStorage.getItem(this.key + slot + '.meta')); } catch (e) { return null; } },
  auto() { this.write('auto'); },
};
