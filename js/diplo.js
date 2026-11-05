// Дипломатия, война, капитуляция, мирная конференция, события, формируемые страны.
function autoPause() { if (G && G.speed > 0) { G.speedBefore = G.speed; G.speed = 0; } }
function atWar(c) { return c.en && Object.keys(c.en).length > 0; }
function isEnemy(a, b) { return !!(a && b && a !== b && G.c[a]?.en && G.c[a].en[b]); }
function isAlly(a, b) {
  if (!a || !b) return false; if (a === b) return true; const A = G.c[a], Bb = G.c[b]; if (!A || !Bb) return false;
  if (A.faction && A.faction === Bb.faction) return true; if (A.master === b || Bb.master === a) return true; if (A.cob && A.cob[b]) return true; return false;
}
function recalcWarRel() {
  for (const t in G.c) { G.c[t].en = {}; G.c[t].cob = {}; }
  for (const w of G.wars) for (const [S, O] of [[w.atk, w.def], [w.def, w.atk]]) for (const a of S) { for (const b of O) G.c[a].en[b] = true; for (const b of S) if (a !== b) G.c[a].cob[b] = true; }
}
function factionOf(c) { return c.faction ? G.factions[c.faction] : null; }
function createFaction(leader, name, members) {
  const id = 'F' + nid(); G.factions[id] = { id, name, leader, members:[leader, ...members], color:C(leader).color };
  C(leader).faction = id; for (const m of members) C(m).faction = id; return id;
}
function joinFaction(c, fid) { const F = G.factions[fid]; if (!F || c.faction) return false; F.members.push(c.t); c.faction = fid; for (const w of G.wars) { if (w.atk.includes(F.leader)) addToWar(w, c.t, 'atk'); else if (w.def.includes(F.leader)) addToWar(w, c.t, 'def'); } return true; }
function leaveFaction(c) { const F = factionOf(c); if (!F) return; F.members = F.members.filter(m => m !== c.t); c.faction = null; if (!F.members.length) delete G.factions[F.id]; else if (F.leader === c.t) { F.leader = F.members[0]; } }
function addToWar(w, tag, sd) { const O = sd === 'atk' ? w.def : w.atk; if (w[sd].includes(tag) || O.includes(tag)) return; w[sd].push(tag); warBase(w, tag); recalcWarRel(); if (tag === G.player) { logMsg(`Вы вступили в войну: ${w.name}`, tag, 'bad'); autoPause(); } const c = C(tag); if (c.ai) aiPrepareWar(c); }
function declareWar(a, b, opts = {}) {
  const A = C(a), Bc = C(b); if (!A || !Bc || a === b) return 'Нельзя'; if (isEnemy(a, b)) return 'Уже в войне'; if (A.nap?.[b] && !opts.force) return 'Действует пакт о ненападении'; if (isAlly(a, b) && !opts.force) return 'Вы союзники';
  if (!opts.force && !(A.wargoals && A.wargoals[b])) return 'Нет обоснования войны'; if (A.capitulated || Bc.capitulated) return 'Страна капитулировала';
  const w = { id:nid(), name:opts.name || `${A.n} против ${Bc.n}`, atk:[a], def:[b], start:G.hour, goal:opts.goal || 'conquest' };
  // Присоединение: у цели фракция и гаранты, у нападающего фракция
  const addF = (tag, sd) => { const F = factionOf(C(tag)); if (F) for (const m of F.members) if (m !== tag && !C(m).capitulated && !w[sd].includes(m) && !(sd === 'def' ? w.atk : w.def).includes(m)) w[sd].push(m); };
  addF(b, 'def'); if (!opts.noAllies) addF(a, 'atk');
  for (const t in G.c) { if (G.c[t].guar?.includes(b) && !w.atk.includes(t) && !w.def.includes(t) && !G.c[t].capitulated) { w.def.push(t); addF(t, 'def'); } }
  // Марионетки
  for (const t in G.c) { const m = G.c[t].master; if (m && w.def.includes(m) && !w.def.includes(t) && !w.atk.includes(t)) w.def.push(t); else if (m && w.atk.includes(m) && !w.atk.includes(t) && !w.def.includes(t)) w.atk.push(t); }
  for (const t of [...w.atk, ...w.def]) warBase(w, t);
  G.wars.push(w); recalcWarRel();
  if (w.atk.includes(G.player) || w.def.includes(G.player)) { autoPause(); if (typeof Shell !== 'undefined') Shell.bigNews('ОБЪЯВЛЕНА ВОЙНА', w.name, `${A.n} напала на страну: ${Bc.n}`, 'war'); }
  G.wt = Math.min(100, G.wt + (Bc.major ? 12 : 4) * (A.i === 'dem' ? .3 : 1));
  logMsg(`Война: ${A.n} напала на ${Bc.n}`, null, 'bad');
  for (const t of [...w.atk, ...w.def]) { const c = C(t); if (c.ai) aiPrepareWar(c); }
  return null;
}
function warEndCheck() {
  for (const w of [...G.wars]) {
    w.atk = w.atk.filter(t => !C(t).capitulated); w.def = w.def.filter(t => !C(t).capitulated);
    if (!w.atk.length || !w.def.length) {
      G.wars.splice(G.wars.indexOf(w), 1); recalcWarRel();
      const winners = w.atk.length ? w.atk : w.def; const losers = (w.losers || []).concat();
      startPeace(w, winners, losers);
    }
  }
}
// Сколько очков победы занято врагом и при каком уровне страна падёт
function surrenderOf(c) { let total = 0, lost = 0; for (const P of M.prov) { const st = G.st[P.s]; if (st.owner !== c.t) continue; total += G.vp[P.i]; if (G.ctrl[P.i] && isEnemy(c.t, G.ctrl[P.i])) lost += G.vp[P.i]; } return total ? lost / total : 0; }
function surrenderLimit(c) { const base = DB.SUR_LIMIT[c.t] ?? .7; return clamp(base + (c.stab - .5) * .1 + (c.warsup - .5) * .1, .3, .98); }
function dailySurrender() {
  for (const t in G.c) { const c = G.c[t]; if (c.capitulated || c.dead || !atWar(c)) continue; c.surrender = surrenderOf(c); if (c.surrender >= surrenderLimit(c)) capitulate(c); }
}
// Статистика войны: разница со снимком на момент вступления
function warSnapshot(c) { const h = c.history; return { cas:h.cas || 0, divs:h.losses || 0, ships:h.ships || 0, planes:h.planes || 0, kills:h.kills || 0 }; }
function warBase(w, t) { w.base = w.base || {}; if (!w.base[t]) w.base[t] = warSnapshot(C(t)); }
function capitulate(c) {
  if (isEnemy(G.player, c.t) || isAlly(G.player, c.t)) { autoPause(); if (typeof Shell !== 'undefined') Shell.bigNews('КАПИТУЛЯЦИЯ', c.n, isEnemy(G.player, c.t) ? 'Противник сложил оружие' : 'Союзник сложил оружие', isEnemy(G.player, c.t) ? 'good' : 'war'); } c.capitulated = true; logMsg(`${c.n} капитулирует!`, null, 'bad');
  const occ = {}; for (const P of M.prov) { if (G.st[P.s].owner === c.t && G.ctrl[P.i] && isEnemy(c.t, G.ctrl[P.i])) occ[G.ctrl[P.i]] = (occ[G.ctrl[P.i]] || 0) + 1; }
  let main = null, mv = -1; for (const k in occ) if (occ[k] > mv) { mv = occ[k]; main = k; }
  // запоминаем проигравшего во всех войнах и передаём остаток контроля
  for (const w of G.wars) if (w.atk.includes(c.t) || w.def.includes(c.t)) { w.losers = w.losers || []; w.losers.push(c.t); w.fallen = w.fallen || {}; w.fallen[c.t] = (w.atk.includes(c.t) ? 'atk' : 'def'); }
  for (const P of M.prov) if (G.ctrl[P.i] === c.t && main) { G.ctrl[P.i] = main; }
  for (const id in G.divs) if (G.divs[id].tag === c.t) destroyDiv(G.divs[id]);
  for (const id in G.wings) if (G.wings[id].tag === c.t) delete G.wings[id];
  for (const id in G.fleets) if (G.fleets[id].tag === c.t) delete G.fleets[id];
  for (const id in G.armies) if (G.armies[id].tag === c.t) delete G.armies[id];
  for (const id in G.groups) if (G.groups[id].tag === c.t) delete G.groups[id];
  c.lines = []; c.buildq = []; c.recruit = [];
  c.trade = []; for (const t in G.c) G.c[t].trade = G.c[t].trade.filter(d => d.from !== c.t);
  if (c.faction) leaveFaction(c);
  recalcWarRel(); warEndCheck();
  G.ctrlDirty = true;
  if (c.t === G.player && !G.peace && typeof UI !== 'undefined') UI.onPlayerCapitulated();
}
function vpOfState(st) { return STATE_BY_ID[st.id].prov.reduce((v, p) => v + G.vp[p], 0); }
function stateScoreCost(st) { return 2 + vpOfState(st) * .6 + (st.civ + st.mil + st.dock) * 2; }
function startPeace(w, winners, losers) {
  if (!losers.length) return;
  const score = {}; for (const t of winners) { let s = 15; for (const P of M.prov) if (G.ctrl[P.i] === t && losers.includes(G.st[P.s].owner)) s += 1 + G.vp[P.i]; score[t] = s * (C(t).major ? 1.2 : 1); }
  const lands = G.st.filter(s => s && losers.includes(s.owner)).map(s => s.id);
  const conf = { war:w.name, winners, losers, score, turn:0, lands, taken:{}, puppets:{}, passed:{} };
  // ИИ-страны всегда берут штаты, которые занимают
  if (winners.includes(G.player)) { G.peace = conf; G.speedBefore = G.speed; G.speed = 0; if (typeof UI !== 'undefined') UI.openPeace(); return; }
  aiResolvePeace(conf); finalizePeace(conf);
}
function aiResolvePeace(conf) {
  const order = conf.winners.slice().sort((a, b) => conf.score[b] - conf.score[a]);
  for (const t of order) {
    if (t === G.player) continue;
    const my = conf.lands.filter(id => !conf.taken[id] && G.st[id].ctrl === t).sort((a, b) => stateScoreCost(G.st[b]) - stateScoreCost(G.st[a]));
    for (const id of my) { const cost = stateScoreCost(G.st[id]); if (conf.score[t] >= cost) { conf.score[t] -= cost; conf.taken[id] = t; } }
    const ally = conf.lands.filter(id => !conf.taken[id]);
    for (const id of ally) { const cost = stateScoreCost(G.st[id]); if (conf.score[t] >= cost * 1.4 && C(t).major) { conf.score[t] -= cost * 1.4; conf.taken[id] = t; } }
  }
}
function peaceTake(id) { const conf = G.peace, me = G.player; if (!conf || conf.taken[id] === me || !conf.lands.includes(id)) return 'Нельзя'; if (conf.taken[id]) return 'Штат уже занят'; const cost = stateScoreCost(G.st[id]); if (conf.score[me] < cost) return 'Не хватает очков'; conf.score[me] -= cost; conf.taken[id] = me; return null; }
function peaceUndo(id) { const conf = G.peace; if (conf.taken[id] !== G.player) return; conf.score[G.player] += stateScoreCost(G.st[id]); delete conf.taken[id]; }
function peacePuppet(tag) { const conf = G.peace; const left = conf.lands.filter(id => G.st[id].owner === tag && !conf.taken[id]); const cost = left.reduce((v, id) => v + stateScoreCost(G.st[id]) * .35, 0); if (conf.score[G.player] < cost) return 'Не хватает очков'; conf.score[G.player] -= cost; conf.puppets[tag] = G.player; return null; }
function peaceFinish() { const conf = G.peace; G.peace = null; aiResolvePeace(conf); finalizePeace(conf); G.speed = G.speedBefore || 1; }
function setStateOwner(st, tag) { st.owner = tag; st.ctrl = tag; if (!st.cores.includes(tag)) st.resist = Math.max(st.resist, 40); for (const p of STATE_BY_ID[st.id].prov) G.ctrl[p] = tag; }
function finalizePeace(conf) {
  for (const id in conf.taken) setStateOwner(G.st[id], conf.taken[id]);
  for (const t of conf.losers) {
    const c = C(t); const left = G.st.filter(s => s && s.owner === t);
    for (const s of left) { for (const p of STATE_BY_ID[s.id].prov) G.ctrl[p] = t; s.ctrl = t; }
    if (!left.length) { markDead(c); continue; }
    c.capitulated = false; c.surrender = 0; c.master = conf.puppets[t] || c.master || null; c.ideas = c.ideas.filter(i => !i.defeated);
    if (c.capital && G.st[PROV[c.capital].s].owner !== t) { const cand = G.cities.filter(x => G.st[PROV[x.p].s].owner === t).sort((a, b) => b.vp - a.vp)[0]; c.capital = cand ? cand.p : STATE_BY_ID[left[0].id].prov[0]; c.capState = PROV[c.capital].s; }
    c.mpUsed = 0; recalcMods(c); aiSetupLines(c);
    if (c.t !== G.player) { c.tpls.inf = c.tpls.inf || JSON.parse(JSON.stringify(DB.TPL.inf)); c.ai = true; }
    else { G.player = c.t; }
  }
  // Проверка освобождения своего: не-проигравшие владельцы оккупированных штатов получают их обратно
  for (const st of G.st) { if (!st) continue; const o = C(st.owner); if (!o || o.capitulated) continue; if (!isEnemy(st.owner, st.ctrl) && st.ctrl !== st.owner) { if (!isAlly(st.owner, st.ctrl) || !(st.ctrl in o.en)) for (const p of STATE_BY_ID[st.id].prov) if (!isEnemy(st.owner, G.ctrl[p])) G.ctrl[p] = st.owner; st.ctrl = st.owner; } }
  computeStateCtrl();
  G.ctrlDirty = true;
  G.wt = clamp(G.wt - 2, 0, 100);
  logMsg(`Мир заключён: ${conf.war}`, null, 'info');
  for (const t in G.c) if (G.c[t] && !G.c[t].dead) updateCountryEcon(G.c[t]);
  if (G.c[G.player].dead && typeof UI !== 'undefined') UI.onPlayerDead?.();
}
function markDead(c) { c.dead = true; c.capitulated = true; if (c.faction) leaveFaction(c); for (const t in G.c) if (G.c[t].master === c.t) G.c[t].master = null; }

// ---------- Дипломатические действия ----------
const DIPL = {
 improve:{ n:'Улучшить отношения', cost:20, d:'+15 к отношениям' },
 guarantee:{ n:'Гарантия независимости', cost:50, d:'Вы вступите в войну, если на страну нападут' },
 nap:{ n:'Пакт о ненападении', cost:75, d:'Война между вами невозможна' },
 access:{ n:'Запросить военный доступ', cost:25, d:'Войска могут идти через страну' },
 join:{ n:'Пригласить во фракцию', cost:25, d:'Страна становится союзником' },
 justify:{ n:'Обосновать войну', cost:50, d:'Цель появится через 30 дней' },
 war:{ n:'Объявить войну', cost:0, d:'Нужно обоснование' },
};
function diplCost(c, k) { return DIPL[k].cost * (1 + mod(c, 'dipl')) * (k === 'justify' ? 1 + mod(c, 'justify') : 1); }
function diplCheck(c, k, t) {
  const o = C(t); if (!o || o.dead || o.capitulated) return 'Страна недоступна'; if (c.t === t) return 'Нельзя';
  if (k !== 'war' && c.pp < diplCost(c, k)) return 'Не хватает власти';
  if (k === 'guarantee' && c.guar.includes(t)) return 'Уже есть гарантия'; if (k === 'guarantee' && (isEnemy(c.t, t) || isAlly(c.t, t))) return 'Нельзя';
  if (k === 'nap' && c.nap[t]) return 'Пакт уже действует'; if (k === 'nap' && isEnemy(c.t, t)) return 'Вы в войне';
  if (k === 'access' && (c.access[t] || isEnemy(c.t, t))) return 'Нельзя';
  if (k === 'join') { const F = factionOf(c); if (!F && !c.canFaction) return 'Нужен фокус «Международный блок» или статус державы'; if (o.faction) return 'Страна уже во фракции'; if (F && F.leader !== c.t) return 'Приглашать может только лидер'; if (o.i !== c.i && o.i !== 'neu') return 'Другая идеология'; if (isEnemy(c.t, t)) return 'Вы в войне'; }
  if (k === 'justify') { if (c.justify) return 'Уже обосновывается'; if (c.wargoals?.[t]) return 'Обоснование уже есть'; if (G.wt < (c.i === 'fas' ? 0 : c.i === 'com' ? 15 : 35) && !isEnemy(c.t, t)) return `Нужна мировая напряжённость ${c.i === 'com' ? 15 : 35}%`; if (isAlly(c.t, t)) return 'Вы союзники'; if (c.nap[t]) return 'Есть пакт о ненападении'; }
  if (k === 'war') { if (isEnemy(c.t, t)) return 'Уже в войне'; if (c.nap[t]) return 'Есть пакт'; if (!c.wargoals?.[t]) return 'Нет обоснования'; if (isAlly(c.t, t)) return 'Союзники'; }
  return null;
}
function diplAI(c, k, t) { // Согласие ИИ
  const o = C(t), rel = o.rel[c.t] || 0; if (!o.ai) return true;
  if (k === 'nap') return rel > -20 && (Math.random() < .5 + rel / 100);
  if (k === 'access') return rel > 20 || isAlly(c.t, t);
  if (k === 'join') return o.i === c.i ? rel > -10 : rel > 30;
  return true;
}
function diplDo(c, k, t) {
  const e = diplCheck(c, k, t); if (e) return e; const o = C(t);
  if (k !== 'war') c.pp -= diplCost(c, k);
  if (k === 'improve') { o.rel[c.t] = clamp((o.rel[c.t] || 0) + 15, -100, 100); c.rel[t] = clamp((c.rel[t] || 0) + 8, -100, 100); return null; }
  if (k === 'guarantee') { c.guar.push(t); o.rel[c.t] = (o.rel[c.t] || 0) + 20; return null; }
  if (k === 'justify') { c.justify = { target:t, days:30 * (o.major ? 1.5 : 1) * (c.i === 'dem' ? 1.5 : 1) }; G.wt = Math.min(100, G.wt + .3); return null; }
  if (k === 'war') return declareWar(c.t, t);
  if (!diplAI(c, k, t)) return `${o.n} отказывается`;
  if (k === 'nap') { c.nap[t] = true; o.nap[c.t] = true; return null; }
  if (k === 'access') { c.access[t] = true; return null; }
  if (k === 'join') { if (!c.faction) createFaction(c.t, `Блок: ${c.n}`, []); joinFaction(o, c.faction); return null; }
  return 'Нет действия';
}
function sendVolunteers(c, target, n) {
  const host = C(target); if (!host || !atWar(host)) return 'У страны нет войны'; if (atWar(c)) return 'Вы сами в войне'; if (isEnemy(c.t, target)) return 'Нельзя';
  const pick = Object.values(G.divs).filter(d => d.tag === c.t && !d.attacking).slice(0, n);
  if (!pick.length) return 'Нет свободных дивизий'; let cnt = 0;
  for (const d of pick) { const p = PROV[host.capital] ? host.capital : anyControlled(host); if (!p) break; d.side = target; d.path = []; moveIdx(d, p); d.army = null; cnt++; }
  c.warsup = clamp(c.warsup + .01 * cnt, 0, 1); logMsg(`Добровольцы отправлены: ${host.n}, дивизий: ${cnt}`, c.t, 'info'); return null;
}
function addLend(c, to, eq, perDay) { c.lend = c.lend.filter(x => !(x.to === to && x.eq === eq)); if (perDay > 0) c.lend.push({ to, eq, perDay }); }
function tradeOffer(buyer, seller, res) {
  const S = C(seller); if (!S || S.dead) return 0; const law = DB.LAWS.trade.list.find(l => l.id === S.laws.trade); const avail = (S.res[res] || 0) * law.ex - S.trade.reduce((v, d) => 0, 0) - tradedOut(S, res);
  return Math.max(0, Math.floor(avail));
}
function tradedOut(S, res) { let v = 0; for (const t in G.c) for (const d of G.c[t].trade) if (d.from === S.t && d.res === res) v += d.amt; return v; }
function tradeBuy(c, seller, res, amt) {
  const S = C(seller); if (isEnemy(c.t, seller)) return 'Вы в войне'; const avail = tradeOffer(c.t, seller, res); if (avail < 1) return 'Нет на экспорт';
  const a = Math.min(amt, avail); if ((S.rel[c.t] || 0) < -30 && S.ai) return 'Плохие отношения';
  const fac = Math.ceil(a / 8); if (freeCivs(c) < fac) return 'Нет свободных заводов'; const ex = c.trade.find(d => d.from === seller && d.res === res);
  if (ex) { ex.amt += a; ex.fac = Math.ceil(ex.amt / 8); } else c.trade.push({ from:seller, res, amt:a, fac }); S.civN += 0; return null;
}
function tradeCancel(c, i) { c.trade.splice(i, 1); }

// ---------- формируемые страны ----------
function formableStatus(c) {
  const out = [];
  if (DB.EU_FROM.includes(c.t) && !c.formed && !G.events.formedEUR) {
    const members = new Set([c.t, ...((factionOf(c)?.members) || [])]);
    const miss = DB.EU_REQUIRED.filter(t => { const cap = G.c[t]?.capital; const own = t in G.c ? G.st.some(s => s && s.orig === t && (members.has(s.owner) || members.has(s.ctrl))) : false; return !own || !cap || !G.st.filter(s => s && s.orig === t).every(s => members.has(s.owner) || members.has(s.ctrl)); });
    out.push({ id:'EUR', n:'Европейский союз', d:`Демократия, Франция, Германия, Италия, Бенилюкс у вас или во фракции. Нужно: ${c.i === 'dem' ? 'демократия есть' : 'демократия'}${miss.length ? ', нет: ' + miss.map(m => C(m)?.n).join(', ') : ''}`, can:c.i === 'dem' && !miss.length && c.pp >= 100, cost:100 });
  }
  if ((c.t === 'ITA' || c.romeProgress) && !c.formed && !G.events.formedROM2) {
    const regions = Object.entries(DB.ROME_REGIONS).map(([id, R]) => { const sts = romeStates(R); const held = sts.filter(s => s.ctrl === c.t || s.owner === c.t); return { id, n:R.n, done:!!c.natl[id], total:sts.length, held:held.length, can:!c.natl[id] && sts.length > 0 && held.length === sts.length && c.pp >= 75 }; });
    const all = regions.every(r => r.done);
    out.push({ id:'ROM2', n:'Римская империя', d:'Захватывайте земли и проводите национализацию регионов. Когда все регионы национализированы, можно провозгласить империю.', regions, can:all && c.pp >= 100, cost:100 });
  }
  return out;
}
function romeStates(R) { return G.st.filter(s => s && R.orig.includes(s.orig) && (!R.maxLat || s.lat <= R.maxLat)); }
function nationalize(c, id) {
  const R = DB.ROME_REGIONS[id]; if (!R || c.natl[id]) return 'Нельзя'; const sts = romeStates(R); if (!sts.length) return 'Нет земель'; if (!sts.every(s => s.ctrl === c.t || s.owner === c.t)) return 'Нужно контролировать весь регион'; if (c.pp < 75) return 'Нужно 75 власти';
  c.pp -= 75; c.natl[id] = true; for (const s of sts) { if (!s.cores.includes(c.t)) s.cores.push(c.t); s.owner = c.t; s.resist = 0; } c.ideas.push({ name:`Национализация: ${R.n}`, mod:{ stab:.01, pp:.05 } }); recalcMods(c); logMsg(`Национализирован регион: ${R.n}`, c.t, 'good'); return null;
}
function formCountry(c, id) {
  const st = formableStatus(c).find(x => x.id === id); if (!st || !st.can) return 'Условия не выполнены'; c.pp -= st.cost; const X = DB.EXTRA[id];
  const oldName = c.n; c.n = X.n; c.color = X.c; c.formed = true; c.formedAs = id; G.events['formed' + id] = true; if (X.i) setGovernment(c, X.i);
  c.ideas.push(DB.FORM_BONUS[id]); c.stab = clamp(c.stab + .1, 0, 1);
  if (id === 'EUR') { const F = factionOf(c); if (F) for (const m of [...F.members]) { if (m === c.t) continue; const o = C(m); const accept = !o.ai || (o.rel[c.t] || 0) > -30 && !o.major; if (o.ai && accept) absorbCountry(c, o); } for (const r of DB.EU_REQUIRED) for (const s of G.st) if (s && s.orig === r && (s.owner === c.t || s.ctrl === c.t)) { if (!s.cores.includes(c.t)) s.cores.push(c.t); s.owner = c.t; s.resist = 0; } }
  if (id === 'ROM2') for (const R of Object.values(DB.ROME_REGIONS)) for (const s of romeStates(R)) if (!s.cores.includes(c.t)) s.cores.push(c.t);
  recalcMods(c); logMsg(`${oldName} провозглашает: ${c.n}!`, null, 'good'); G.ctrlDirty = true; return null;
}
function absorbCountry(c, o) {
  for (const s of G.st) if (s && s.owner === o.t) { s.owner = c.t; s.cores.push(c.t); } for (const P of M.prov) if (G.ctrl[P.i] === o.t) G.ctrl[P.i] = c.t;
  for (const id in G.divs) if (G.divs[id].tag === o.t) { const d = G.divs[id]; d.tag = c.t; if (!c.tpls[d.tpl]) c.tpls[d.tpl] = JSON.parse(JSON.stringify(o.tpls[d.tpl])); d.army = null; }
  for (const k of DB.EQ_ORDER) c.stock[k] += o.stock[k]; for (const id in G.fleets) if (G.fleets[id].tag === o.t) G.fleets[id].tag = c.t; for (const id in G.wings) if (G.wings[id].tag === o.t) G.wings[id].tag = c.t;
  for (const id in G.armies) if (G.armies[id].tag === o.t) delete G.armies[id];
  for (const id in G.groups) if (G.groups[id].tag === o.t) delete G.groups[id];
  markDead(o); c.pop += o.pop; rebuildIndex();
}
function annexPeaceful(a, b) { for (const s of G.st) if (s && s.owner === b) { setStateOwner(s, a); s.resist = 0; if (!s.cores.includes(a)) s.cores.push(a); } const o = C(b); for (const id in G.divs) if (G.divs[id].tag === b) destroyDiv(G.divs[id]); for (const id in G.wings) if (G.wings[id].tag === b) delete G.wings[id]; for (const id in G.fleets) if (G.fleets[id].tag === b) delete G.fleets[id]; for (const id in G.armies) if (G.armies[id].tag === b) delete G.armies[id]; for (const id in G.groups) if (G.groups[id].tag === b) delete G.groups[id]; markDead(o); G.ctrlDirty = true; updateCountryEcon(C(a)); }

// ---------- гражданские войны (механика заложена для будущих путей) ----------
function startCivilWar(tag, newTag, stateIds, opts = {}) {
  const old = C(tag), X = DB.EXTRA[newTag]; if (!X || !old) return null;
  const n = newCountry({ t:newTag, n:X.n, c:X.c, i:X.i, l:X.l, pop:old.pop * .45, st:.6, w:.6, party:X.party });
  n.tech = JSON.parse(JSON.stringify(old.tech)); n.tpls = JSON.parse(JSON.stringify(old.tpls)); for (const k of DB.EQ_ORDER) { n.stock[k] = Math.floor(old.stock[k] * .45); old.stock[k] *= .55; n.q[k] = old.q[k]; } n.pp = 30; G.c[newTag] = n; n.rel = {}; old.rel[newTag] = -100; n.rel[tag] = -100;
  for (const id of stateIds) { const s = G.st[id]; if (!s) continue; s.cores.push(newTag); setStateOwner(s, newTag); s.resist = 0; }
  n.capital = STATE_BY_ID[stateIds[0]].prov[0]; const cc = G.cities.filter(c => stateIds.includes(PROV[c.p].s)).sort((a, b) => b.vp - a.vp)[0]; if (cc) n.capital = cc.p; n.capState = PROV[n.capital].s;
  makeGenerals(n); recalcMods(n);
  // Войска перебегают
  for (const d of Object.values(G.divs)) { if (d.tag === tag && G.ctrl[d.prov] === newTag) { d.tag = newTag; d.army = null; d.path = []; } }
  for (const id in G.armies) { const A = G.armies[id]; if (A.tag === tag) A.divs = A.divs.filter(x => G.divs[x]?.tag === tag); }
  makeArmiesInit(n); aiSetupLines(n); updateCountryEcon(n);
  const w = { id:nid(), name:opts.name || `Гражданская война: ${old.n}`, atk:[newTag], def:[tag], start:G.hour, goal:'civil' }; warBase(w, newTag); warBase(w, tag); G.wars.push(w); recalcWarRel();
  logMsg(`Гражданская война: ${old.n}!`, null, 'bad'); G.ctrlDirty = true; for (const t of [tag, newTag]) if (C(t).ai) aiPrepareWar(C(t)); rebuildIndex();
  return n;
}

// ---------- исторические события (ИИ следует гибко) ----------
const EV = [];
const ev = (id, date, fn) => EV.push({ id, date, fn });
function isAI(t) { return C(t) && C(t).ai && !C(t).dead && !C(t).capitulated; }
function aliveT(t) { return C(t) && !C(t).dead && !C(t).capitulated; }
function askPlayer(title, text, options) { G.pending.push({ id:nid(), title, text, options }); if (G.speed > 0) { G.speedBefore = G.speed; G.speed = 0; } if (typeof UI !== 'undefined') UI.showEvent?.(); }
function warAI(a, b, name) { if (!isAI(a) || !aliveT(b) || isEnemy(a, b) || isAlly(a, b)) return false; return !declareWar(a, b, { force:true, name }); }
function initEvents() {}
ev('rhine', 19360307, () => { if (!aliveT('GER')) return; C('GER').stab = clamp(C('GER').stab + .03, 0, 1); C('GER').warsup = clamp(C('GER').warsup + .05, 0, 1); G.wt += 2; logMsg('Германия ввела войска в Рейнскую область', null, 'info'); });
ev('ethiopia', 19360505, () => { G.wt += 1; });
ev('spain', 19360718, () => {
  if (!aliveT('SPA') || C('SPA').faction) return; const names = ['Галисия','Старая Кастилия','Наварра','Риоха','Эстремадура','Андалусия','Балеарские острова','Кантабрия','Новая Кастилия'];
  const ids = G.st.filter(s => s && s.owner === 'SPA' && names.some(n => s.name.includes(n))).map(s => s.id); const north = G.st.filter(s => s && s.owner === 'SPA' && s.lat > 41.2 && !/Катал|Страна Басков|Астур|Кантаб/.test(s.name)).map(s => s.id); const list = [...new Set(north.concat(ids.slice(0, 3)))];
  const go = () => { startCivilWar('SPA', 'NAT', list.length ? list : ids, { name:'Гражданская война в Испании' }); G.wt += 2; if (isAI('GER') && aliveT('NAT') && !atWar(C('GER'))) sendVolunteers(C('GER'), 'NAT', 2); if (isAI('ITA') && aliveT('NAT') && !atWar(C('ITA'))) sendVolunteers(C('ITA'), 'NAT', 3); if (isAI('SOV') && !atWar(C('SOV'))) sendVolunteers(C('SOV'), 'SPA', 2); };
  if (G.player === 'SPA') { askPlayer('Мятеж генералов', 'В июле 1936 года часть армии подняла мятеж. Какую сторону вы возглавите?', [{ t:'Республика', fx:() => go() }, { t:'Националисты', fx:() => { go(); switchPlayer('NAT'); } }]); } else go();
});
ev('axis', 19361025, () => { if (!aliveT('GER') || !aliveT('ITA')) return; if (C('GER').i !== 'fas' || C('ITA').i !== 'fas') return; if (!C('GER').ai || !C('ITA').ai) return; createFaction('GER', 'Ось', ['ITA']); });
ev('comintern', 19370101, () => { if (isAI('SOV') && !C('SOV').faction) createFaction('SOV', 'Коминтерн', []); });
ev('tension1', 19370707, () => { G.wt += 4; logMsg('Японо-китайская война усиливает мировую напряжённость', null, 'info'); });
ev('anschluss', 19380312, () => {
  if (!aliveT('AUS') || !aliveT('GER') || C('GER').i !== 'fas' || isEnemy('GER', 'AUS')) return; const go = () => { annexPeaceful('GER', 'AUS'); G.wt += 3; logMsg('Аншлюс: Австрия присоединена к Германии', null, 'bad'); };
  if (G.player === 'GER') askPlayer('Аншлюс', 'Австрия готова к присоединению. Провести аншлюс?', [{ t:'Присоединить Австрию', fx:go }, { t:'Отказаться', fx:() => {} }]);
  else if (G.player === 'AUS') askPlayer('Ультиматум Германии', 'Берлин требует присоединения. Что ответить?', [{ t:'Уступить', fx:go }, { t:'Сопротивляться', fx:() => declareWar('GER', 'AUS', { force:true, name:'Австрийская война' }) }]);
  else if (C('GER').ai) go();
});
ev('munich', 19380930, () => {
  if (!aliveT('CZE') || !aliveT('GER') || isEnemy('GER', 'CZE')) return; const sud = G.st.filter(s => s && s.sudeten && s.owner === 'CZE'); const take = () => { for (const s of sud) setStateOwner(s, 'GER'); G.wt += 4; logMsg('Мюнхенское соглашение: Судеты переданы Германии', null, 'bad'); };
  const war = () => declareWar('GER', 'CZE', { force:true, name:'Судетский кризис' });
  if (G.player === 'CZE') askPlayer('Мюнхенское соглашение', 'Союзники требуют уступить Судеты.', [{ t:'Уступить Судеты', fx:take }, { t:'Отказаться и воевать', fx:war }]);
  else if (G.player === 'GER') askPlayer('Судетский вопрос', 'Союзники готовы передать Судеты. Принять?', [{ t:'Принять соглашение', fx:take }, { t:'Отказаться', fx:() => {} }]);
  else if (G.player === 'ENG' || G.player === 'FRA') askPlayer('Мюнхенская конференция', 'Германия требует Судеты. Как поступите?', [{ t:'Уступить ради мира', fx:take }, { t:'Поддержать Чехословакию', fx:() => { C(G.player).guar.push('CZE'); war(); } }]);
  else if (C('GER').ai) take();
});
ev('prague', 19390315, () => { if (isAI('GER') && aliveT('CZE') && !G.events.prague_done && !C('CZE').faction && !isEnemy('GER', 'CZE')) { if (G.player === 'CZE') { askPlayer('Оккупация Праги', 'Германия требует капитуляции остатка страны.', [{ t:'Подчиниться', fx:() => annexPeaceful('GER', 'CZE') }, { t:'Сражаться', fx:() => declareWar('GER', 'CZE', { force:true }) }]); } else annexPeaceful('GER', 'CZE'); G.wt += 5; } });
ev('alb', 19390407, () => { if (isAI('ITA') && aliveT('ALB')) warAI('ITA', 'ALB', 'Итало-албанская война'); });
ev('guar_pol', 19390331, () => { if (isAI('ENG') && aliveT('POL')) C('ENG').guar.push('POL'); if (isAI('FRA') && aliveT('POL')) C('FRA').guar.push('POL'); });
ev('molotov', 19390823, () => { if (isAI('GER') && isAI('SOV')) { C('GER').nap.SOV = true; C('SOV').nap.GER = true; G.events.partition = true; logMsg('Пакт Молотова — Риббентропа', null, 'bad'); } });
ev('poland', 19390901, () => { if (warAI('GER', 'POL', 'Вторжение в Польшу')) G.wt += 10; });
ev('sov_pol', 19390917, () => { if (G.events.partition && aliveT('POL') && isAI('SOV')) warAI('SOV', 'POL', 'Польский поход'); });
ev('winter', 19391130, () => { if (aliveT('FIN')) warAI('SOV', 'FIN', 'Зимняя война'); });
ev('weser', 19400409, () => { if (isAI('GER') && !isEnemy('GER', 'DEN')) { warAI('GER', 'DEN', 'Операция на Севере'); warAI('GER', 'NOR', 'Операция на Севере'); } });
ev('gelb', 19400510, () => { if (isEnemy('GER', 'FRA') || isAI('GER') && aliveT('FRA') && C('POL').capitulated) { if (!isEnemy('GER', 'FRA')) warAI('GER', 'FRA', 'Война на Западе'); warAI('GER', 'BEL'); warAI('GER', 'HOL'); warAI('GER', 'LUX'); } });
ev('italy_war', 19400610, () => { if (isAI('ITA') && aliveT('FRA') && C('ITA').i === 'fas') { const F = factionOf(C('ITA')); if (F && C('GER').faction === F.id) { for (const w of G.wars) if (w.atk.includes('GER') && w.def.includes('FRA')) addToWar(w, 'ITA', 'atk'); } else warAI('ITA', 'FRA'); } });
ev('italy_gre', 19401028, () => { if (isAI('ITA') && aliveT('GRE')) warAI('ITA', 'GRE', 'Итало-греческая война'); });
ev('axis_join', 19401120, () => { const F = factionOf(C('GER')); if (!F) return; for (const t of ['HUN','ROM','BUL']) if (isAI(t) && !C(t).faction && C(t).i !== 'dem') { C(t).i = 'fas'; joinFaction(C(t), F.id); } });
ev('marita', 19410406, () => { if (isAI('GER')) { warAI('GER', 'YUG', 'Балканская кампания'); warAI('GER', 'GRE', 'Балканская кампания'); } });
ev('barbarossa', 19410622, () => { if (isAI('GER') && aliveT('SOV')) { C('GER').nap.SOV = false; C('SOV').nap.GER = false; if (warAI('GER', 'SOV', 'Вторжение в СССР')) G.wt += 15; if (C('ENG').faction && aliveT('ENG')) { C('SOV').nap = {}; } } });
ev('lendlease', 19410311, () => { G.events.usLend = true; logMsg('США начинают поставки по ленд-лизу', null, 'info'); });
ev('usa', 19411211, () => { G.wt += 10; logMsg('США вступают в войну на стороне Союзников', null, 'bad'); G.events.usWar = true; });
const EV_PLANS = [ // заблаговременная подготовка фронта ИИ
 ['GER','POL',19390720],['SOV','POL',19390820],['SOV','FIN',19391020],['GER','FRA',19400401],['GER','BEL',19400401],['GER','SOV',19410510],['ITA','GRE',19401001],['GER','YUG',19410301],
];
function dailyEvents() {
  const dn = dateNum();
  if (curDate().getUTCDate() === 1) for (const t in G.c) { const c = G.c[t]; const before = c.ideas.length; c.ideas = c.ideas.filter(i => !i.until || i.until > dn); if (c.ideas.length !== before) recalcMods(c); }
  for (const E of EV) { if (!G.events[E.id] && dn >= E.date) { G.events[E.id] = true; E.fn(); } }
  for (const [a, b, dt] of EV_PLANS) { const key = 'plan_' + a + b; if (!G.events[key] && dn >= dt && isAI(a) && aliveT(b)) { G.events[key] = true; aiPlanFront(C(a), b); } }
  if (G.events.usLend && curDate().getUTCDate() === 1) { // ежемесячный ленд-лиз США
    const mul = G.events.usWar ? 2.5 : 1;
    for (const t of ['ENG','SOV','FRA']) { const c = C(t); if (!c || c.dead || c.capitulated) continue; if (t === 'SOV' && !isEnemy('GER', 'SOV')) continue; c.stock.inf_eq += 2000 * mul; c.stock.mot_eq += 300 * mul; c.stock.ftr += 60 * mul; c.stock.sup_eq += 60 * mul; c.stock.mtk_eq += 40 * mul; c.stock.tac += 20 * mul; }
  }
  // напряжённость потихоньку растёт
  if (curDate().getUTCDate() === 1) { G.wt = clamp(G.wt + (G.wars.length ? .2 : .1), 0, 100); }
  G.wt = clamp(G.wt, 0, 100);
}
function switchPlayer(tag) { C(G.player).ai = true; G.player = tag; C(tag).ai = false; if (typeof UI !== 'undefined') UI.refresh?.(); }
