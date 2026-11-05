// Дивизии, набор, снабжение, движение, бой, погода, армии и фронты.
const provDivs = {}; // индекс: провинция -> массив id дивизий (пересчитывается)
for (const [a, b] of DB.STRAITS) { const pa = nearestLand(a[0], a[1]), pb = nearestLand(b[0], b[1]); if (pa && pb && pa !== pb && !PROV[pa].adjSet.has(pb)) { PROV[pa].adj.push(pb); PROV[pb].adj.push(pa); PROV[pa].land.push(pb); PROV[pb].land.push(pa); PROV[pa].adjSet.add(pb); PROV[pb].adjSet.add(pa); } }
const DIST = (a, b) => Math.hypot(PROV[a].x - PROV[b].x, PROV[a].y - PROV[b].y) * M.KM;
const TERRAIN = {
 plains:{n:'Равнина',atk:0,spd:1,w:90}, forest:{n:'Лес',atk:-.1,spd:.8,w:84}, hills:{n:'Холмы',atk:-.2,spd:.75,w:80}, mountain:{n:'Горы',atk:-.35,spd:.55,w:75},
 marsh:{n:'Болота',atk:-.3,spd:.5,w:78}, urban:{n:'Город',atk:-.25,spd:.9,w:96}, desert:{n:'Пустыня',atk:0,spd:.9,w:90},
};
const side = d => d.side || d.tag;
function divAt(p) { return (provDivs[p] || []); }
function rebuildIndex() { for (const k in provDivs) delete provDivs[k]; for (const id in G.divs) { const d = G.divs[id]; (provDivs[d.prov] = provDivs[d.prov] || []).push(d.id); } }
function moveIdx(d, to) { const a = provDivs[d.prov]; if (a) { const i = a.indexOf(d.id); if (i >= 0) a.splice(i, 1); } (provDivs[to] = provDivs[to] || []).push(d.id); d.prov = to; }

function spawnDivision(c, tplId, prov, str) {
  const s = divStats(c, tplId), n = (c.divCount = (c.divCount || 0) + 1);
  const d = { id:nid(), tag:c.t, tpl:tplId, prov, str:str ?? 1, org:s.org * (str ?? 1), xp:0, path:[], prog:0, attacking:null, ent:0, army:null, sup:1, name:`${n}-я ${(c.tpls[tplId] || DB.TPL.inf).name.replace(' дивизия', '')}`, plan:0, manual:false };
  G.divs[d.id] = d; (provDivs[prov] = provDivs[prov] || []).push(d.id);
  return d;
}
function destroyDiv(d, reason) {
  const C_ = C(d.tag); removeFromBattle(d); const a = provDivs[d.prov]; if (a) { const i = a.indexOf(d.id); if (i >= 0) a.splice(i, 1); } delete G.divs[d.id];
  if (d.army && G.armies[d.army]) { const A = G.armies[d.army]; A.divs = A.divs.filter(x => x !== d.id); }
  C_.history.losses++;
  if (reason && d.tag === G.player) logMsg(`${d.name} уничтожена: ${reason}`, d.tag, 'bad');
}
function fieldedCount(c) { const f = {}; for (const k of DB.EQ_ORDER) f[k] = 0; for (const id in G.divs) { const d = G.divs[id]; if (d.tag !== c.t) continue; const s = divStats(c, d.tpl); for (const e in s.eq) f[e] += s.eq[e] * d.str; } for (const k in c.planes) if (DB.EQ[k]) f[k] = (f[k] || 0) + (wingCount(c, k)); c.fielded = f; }

function dailyRecruit(c) {
  fieldedCount(c);
  for (let i = c.recruit.length - 1; i >= 0; i--) {
    const r = c.recruit[i]; const s = divStats(c, r.tpl); if (r.prog < s.train) r.prog += 1 + (c.m.train || 0);
    if (r.prog >= s.train) {
      if (r.n <= 0) { c.recruit.splice(i, 1); continue; }
      if (c.mpAvail < s.mp) continue;
      let fill = 1; for (const e in s.eq) fill = Math.min(fill, (c.stock[e] || 0) / s.eq[e]);
      if (fill < .5) continue;
      const pl = r.dest && G.ctrl[r.dest] === c.t ? r.dest : (G.ctrl[c.capital] === c.t ? c.capital : anyControlled(c));
      if (!pl) continue;
      for (const e in s.eq) c.stock[e] -= s.eq[e] * fill;
      c.mpUsed += s.mp * fill; c.mpAvail -= s.mp * fill;
      const d = spawnDivision(c, r.tpl, pl, fill);
      if (r.army && G.armies[r.army]) { d.army = r.army; G.armies[r.army].divs.push(d.id); }
      r.n--;
      if (r.n <= 0) c.recruit.splice(i, 1);
    }
  }
}
function anyControlled(c) { for (const p of LAND_IDS) if (G.ctrl[p] === c.t) return p; return null; }
function dailyReinforce(c) {
  const need = {}; let mpNeed = 0; const list = [];
  for (const id in G.divs) { const d = G.divs[id]; if (d.tag !== c.t || d.str >= .999) continue; list.push(d); const s = divStats(c, d.tpl), g = Math.min(.03, 1 - d.str); mpNeed += s.mp * g; for (const e in s.eq) need[e] = (need[e] || 0) + s.eq[e] * g; }
  if (!list.length) return; const rMp = mpNeed ? clamp(c.mpAvail / mpNeed, 0, 1) : 1; let rMin = 1, rSum = 0, rN = 0; for (const e in need) { const v = need[e] ? clamp((c.stock[e] || 0) / need[e], 0, 1) : 1; rMin = Math.min(rMin, v); rSum += v; rN++; } const r = rMp * (rN ? Math.max(rMin, rSum / rN * .7) : 1);
  for (const d of list) { const g = Math.min(.03, 1 - d.str) * r * (d.sup > .3 ? 1 : .2); if (g <= 0) continue; d.str += g; const s = divStats(c, d.tpl); c.mpUsed += s.mp * g; c.mpAvail -= s.mp * g; for (const e in s.eq) c.stock[e] = Math.max(0, c.stock[e] - s.eq[e] * g); }
}

// ---------- погода ----------
function weatherOf(p) { return G.snow[p] || 0; }
const WEATHER = { 0:{n:'Ясно',spd:1,atk:0,att:0}, 1:{n:'Распутица',spd:.45,atk:-.25,att:0}, 2:{n:'Снег',spd:.75,atk:-.15,att:.0004}, 3:{n:'Сильный мороз',spd:.55,atk:-.3,att:.0015} };
function updateWeather() {
  const m = curDate().getUTCMonth() + 1; const yr = curDate().getUTCFullYear(); G.snow = [];
  const east = x => x > 2000;
  for (const P of M.prov) {
    const L = P.lat - (P.t === 'mountain' ? 6 : 0) + (P.x < 1100 ? 5 : 0); let w = 0; const cold = m === 12 || m <= 2;
    if ((L >= 58 && (m >= 10 || m <= 4)) || (L >= 50 && (m >= 11 || m <= 3)) || (L >= 42 && cold)) w = (L >= 56 && cold) || (P.x > 2300 && L >= 50 && cold) || (L >= 62 && (m === 11 || m === 3)) ? 3 : 2;
    else if (east(P.x) && L >= 46 && (m === 10 || m === 4 || (m === 11 && L < 50) || (m === 3 && L < 50))) w = 1;
    G.snow[P.i] = w;
  }
}

// ---------- снабжение ----------
function friendly(tag, p) { const ct = G.ctrl[p]; if (!ct) return false; return ct === tag || isAlly(tag, ct) || (C(tag).access && C(tag).access[ct]); }
function computeSupply(c) {
  const sup = c.sup = new Float32Array(PROV.length); const src = [];
  if (G.ctrl[c.capital] === c.t || (G.ctrl[c.capital] && isAlly(c.t, G.ctrl[c.capital]))) src.push([c.capital, 0]);
  for (const city of G.cities) if (city.vp >= 8 && friendly(c.t, city.p) && city.p !== c.capital) src.push([city.p, 2]);
  // порты дают снабжение, если море не перекрыто
  for (const P of M.prov) if (P.coastal && G.ctrl[P.i] === c.t && P.seaAdj.some(z => !seaBlockedFor(c, z))) src.push([P.i, G.vp[P.i] >= 1 ? 3 : 6]);
  if (!src.length) return;
  const cost = new Float64Array(PROV.length).fill(1e9), q = [...src]; for (const [p, v] of src) cost[p] = v;
  // Простейшая очередь с релаксацией
  for (let i = 0; i < q.length; i++) {
    const [p, v] = q[i]; if (v > cost[p]) continue;
    for (const a of PROV[p].land) {
      if (!friendly(c.t, a)) continue; const infra = G.st[PROV[a].s].infra, nv = v + (1.6 - infra * .2) * (PROV[a].t === 'mountain' ? 1.5 : 1);
      if (nv < cost[a]) { cost[a] = nv; q.push([a, nv]); }
    }
    if (q.length > 40000) break;
  }
  const load = {}; for (const id in G.divs) { const d = G.divs[id]; if (d.tag !== c.t) continue; const st = PROV[d.prov].s; if (st) load[st] = (load[st] || 0) + divStats(c, d.tpl).sup; }
  const mul = 1 + (G.st[0] ? 0 : 0);
  for (const P of M.prov) {
    if (cost[P.i] > 1e8) { sup[P.i] = 0; continue; }
    const rng = clamp(1.2 - cost[P.i] * .04, .25, 1); const st = G.st[P.s]; const cap = 8 + st.infra * 5 + (st.ctrl === c.t && st.owner === c.t ? 8 : 0); const l = load[P.s] || 0;
    sup[P.i] = rng * (l > cap ? clamp(cap / l, .25, 1) : 1) * (weatherOf(P.i) === 3 ? .8 : weatherOf(P.i) === 1 ? .85 : 1);
  }
}
function seaBlockedFor(c, zone) { const Z = G.zoneNav[zone]; if (!Z) return false; let me = 0, en = 0; for (const t in Z) { if (t === c.t || isAlly(c.t, t)) me += Z[t]; else if (isEnemy(c.t, t)) en += Z[t]; } return en > 0 && en > me * 1.5; }
function dailySupplyEffects() {
  for (const t in G.c) { const c = G.c[t]; if (c.dead) continue; if (atWar(c) || !c.sup) computeSupply(c); }
  for (const id in G.divs) {
    const d = G.divs[id], c = C(d.tag); if (!c) continue; const s = c.sup ? c.sup[d.prov] : 1; d.sup = s;
    const stats = divStats(c, d.tpl); const w = WEATHER[weatherOf(d.prov)];
    let att = atWar(c) ? w.att * (1 - (c.m.winter || 0)) : 0; if (s <= .05) att += .012; else if (s < .4) att += .001;
    if (att > 0) { d.str -= att; if (d.org > 0) d.org = Math.max(0, d.org - att * 30); }
    if (s <= .05) d.org = Math.max(0, d.org - 3);
    if (d.str <= .04) { destroyDiv(d, 'окружена и без снабжения'); continue; }
    if (!d.path.length && !d.attacking) d.ent = Math.min(10 * (1 + stats.ent + (c.m.ent || 0)), d.ent + .4); else d.ent = Math.max(0, d.ent - 1);
    d.plan = (!d.path.length && !d.attacking) ? Math.min(.3 + stats.plan + (c.m.plan || 0), d.plan + .012) : Math.max(0, d.plan - .02);
  }
}

// ---------- путь ----------
function canEnter(tag, p) { const ct = G.ctrl[p]; if (!ct) return false; return ct === tag || isAlly(tag, ct) || C(tag).access?.[ct] || isEnemy(tag, ct); }
function findPath(tag, from, to, hostileOK = true) {
  if (from === to) return []; const dist = new Float64Array(PROV.length).fill(1e12), prev = new Int32Array(PROV.length); const heap = [[0, from]]; dist[from] = 0;
  const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
  const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { let m = i, a = i * 2 + 1, b = a + 1; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
  while (heap.length) {
    const [dv, u] = pop(); if (dv > dist[u]) continue; if (u === to) break;
    for (const a of PROV[u].land) {
      if (!canEnter(tag, a)) continue; if (!hostileOK && isEnemy(tag, G.ctrl[a])) continue;
      const T = TERRAIN[PROV[a].t]; const w = DIST(u, a) / (T.spd * (.5 + G.st[PROV[a].s].infra * .1)) * (PROV[u].rivSet?.has(a) ? 1.2 : 1) * (isEnemy(tag, G.ctrl[a]) ? 1.5 : 1);
      if (dist[u] + w < dist[a]) { dist[a] = dist[u] + w; prev[a] = u; push([dist[a], a]); }
    }
  }
  if (dist[to] >= 1e12) return null; const path = []; for (let u = to; u !== from; u = prev[u]) path.push(u); return path.reverse();
}
function orderMove(d, to, append) {
  const from = append && d.path.length ? d.path[d.path.length - 1] : d.prov;
  const path = findPath(d.tag, from, to); if (!path) return false;
  if (!append) { const was = d.attacking; d.path = path; if (was && was !== path[0]) { removeFromBattle(d); d.attacking = null; d.prog = 0; } else if (!was) d.prog = 0; } else d.path = d.path.concat(path);
  d.manual = true; return true;
}

// ---------- движение (каждый час) ----------
function moveSpeed(d, c, s, to) {
  const T = TERRAIN[PROV[to].t]; const w = WEATHER[weatherOf(to)]; const infra = G.st[PROV[to].s].infra;
  const m = d.sup < .4 ? clamp(d.sup + .4, .4, 1) : 1;
  return s.spd * .7 * T.spd * w.spd * (.75 + infra * .08) * m * (PROV[d.prov].rivSet?.has(to) ? .75 : 1);
}
function hostileDivsAt(tag, p) { const out = []; for (const id of (provDivs[p] || [])) { const e = G.divs[id]; if (e && isEnemy(tag, side(e))) out.push(e); } return out; }
// Кто реально держит провинцию: отступающие бой не принимают
function blockersAt(tag, p) { return hostileDivsAt(tag, p).filter(e => !(e.retreat > 0 && e.path.length)); }
function hourlyMove() {
  for (const id in G.divs) {
    const d = G.divs[id]; const c = C(d.tag);
    if (!d.path.length) { d.prog = 0; if (d.manual) d.manual = false; }
    if (d.attacking) continue;
    if (!d.path.length) continue;
    const next = d.path[0];
    if (!canEnter(side(d), next)) { d.path = []; d.prog = 0; continue; }
    if (blockersAt(side(d), next).length) { joinBattle(d, next); continue; }
    const s = divStats(c, d.tpl);
    d.prog += moveSpeed(d, c, s, next);
    if (d.prog >= DIST(d.prov, next)) {
      d.prog = 0; moveIdx(d, next); d.path.shift(); d.ent = 0;
      const ct = G.ctrl[next];
      if (ct !== side(d) && isEnemy(side(d), ct)) captureProv(next, side(d));
      // отход из боя при необходимости
      if (G.battles[d.prov]) { const b = G.battles[d.prov]; if (!b.def.includes(d.id) && isEnemy(side(d), b.atkSide)) b.def.push(d.id); }
    }
  }
}
function captureProv(p, tag) {
  const old = G.ctrl[p]; let newCt = tag; const owner = ownerOf(p);
  // Освобождение своей или союзной земли
  if (owner !== tag && isAlly(tag, owner) && !C(owner).capitulated) newCt = owner;
  G.ctrl[p] = newCt; G.fort[p] = Math.max(0, (G.fort[p] || 0) - 1);
  if (G.vp[p] >= 8 && (old === G.player || newCt === G.player)) { const ci = G.cities.find(x => x.p === p); logMsg(`${ci ? ci.n : 'Город'} переходит под контроль: ${C(newCt).n}`, G.player, newCt === G.player ? 'good' : 'bad'); if (G.vp[p] >= 12) autoPause(); }
  G.ctrlDirty = true;
}

// ---------- бой ----------
function joinBattle(d, prov) {
  let b = G.battles[prov];
  if (!b) { b = G.battles[prov] = { prov, atk:[], def:[], atkSide:side(d), start:G.hour }; for (const id of provDivs[prov] || []) { const e = G.divs[id]; if (isEnemy(side(d), side(e))) b.def.push(id); } }
  if (b.atkSide !== side(d) && !isAlly(b.atkSide, side(d))) { return; }
  if (!b.atk.includes(d.id)) b.atk.push(d.id); d.attacking = prov; d.ent = 0;
}
function removeFromBattle(d) {
  if (d.attacking && G.battles[d.attacking]) { const b = G.battles[d.attacking]; b.atk = b.atk.filter(x => x !== d.id); }
  const b2 = G.battles[d.prov]; if (b2) b2.def = b2.def.filter(x => x !== d.id);
  d.attacking = null;
}
function airBonus(tag, prov) { const z = G.st[PROV[prov].s]?.zone; const a = G.zoneAir[z]; if (!a) return 0; const my = a.cas?.[tag] || 0, sup = a.sup?.[tag] ?? .5; return clamp(my * (.3 + sup), 0, .35); }
function genMods(d) { const A = d.army && G.armies[d.army]; if (!A || !A.gen) return null; const c = C(d.tag); return c.gens.find(g => g.id === A.gen); }
function divFight(d, isAtk, b, sideDirs) {
  const c = C(d.tag); const s = divStats(c, d.tpl); const P = PROV[b.prov]; const T = TERRAIN[P.t]; const w = WEATHER[weatherOf(b.prov)];
  let f = 1 + (d.xp || 0) * .3 + commandBonus(d); const g = genMods(d);
  if (g) { f += (isAtk ? g.atk : g.def) * .03; for (const tr of g.traits) { const TT = DB.TRAITS[tr]; if (tr === 'aggressive' && isAtk) f += .08; if (tr === 'mountain' && (P.t === 'mountain' || P.t === 'hills')) f += .15; if (tr === 'urban' && P.t === 'urban') f += .15; if (tr === 'infantry' && !isAtk) f += .1; } }
  f += (s.ter[P.t] || 0) + (c.m.hill_bonus && (P.t === 'hills' || P.t === 'mountain') ? c.m.hill_bonus : 0) + (c.m.urban_bonus && P.t === 'urban' ? c.m.urban_bonus : 0);
  f += airBonus(side(d), b.prov) * (1 + (c.m.air_sup || 0));
  if (isAtk) { f += T.atk + w.atk + d.plan * .8; const riv = PROV[d.prov].rivSet?.has(b.prov); if (riv) f -= .3 * (1 - clamp(s.river, 0, 1)); if (d.landing) f -= .5 - s.amph; }
  else f += d.plan * .5 + (w.atk * .3);
  f *= clamp(d.sup + .25, .2, 1);
  const str = .3 + .7 * d.str;
  return { sa:s.sa * f * str, ha:s.ha * f * str, def:s.def * (1 + (d.ent || 0) * .03 + (c.m.fort_bonus && !isAtk ? c.m.fort_bonus : 0)) * str, brk:s.brk * str, hard:s.hard, arm:s.arm, prc:s.prc, hp:s.hp, w:s.w, stats:s };
}
function resolveSide(shooters, targets, b, attackerSide) {
  const n = targets.length; if (!n) return;
  for (const a of shooters) {
    const t = targets[Math.floor(Math.random() * n)]; const A = a._f, D = t._f; if (!A || !D) continue;
    let shots = A.sa * (1 - D.hard) + A.ha * D.hard;
    if (A.arm > D.prc) shots *= 1.15;
    const defVal = attackerSide ? D.def * (1 + (G.fort[b.prov] || 0) * .07 * (1 - clamp(A.stats.fort || 0, 0, .9))) : D.brk;
    const left = t._defLeft ?? (t._defLeft = defVal);
    const blocked = Math.min(shots, left); t._defLeft = Math.max(0, left - blocked);
    let hits = blocked * .1 + (shots - blocked) * .4;
    if (D.arm > A.prc) hits *= .55;
    const fortPenalty = attackerSide ? Math.max(.4, 1 - (G.fort[b.prov] || 0) * .06) : 1;
    hits *= fortPenalty;
    t._orgD = (t._orgD || 0) + hits * .065;
    t._strD = (t._strD || 0) + hits * .045 / Math.max(10, D.hp) * (1 + (C(t.tag).m.casualty || 0));
  }
}
function retreatDiv(d, b) {
  const c = C(d.tag), opts = PROV[d.prov].land.filter(a => { const ct = G.ctrl[a]; return ct && !isEnemy(side(d), ct) && canEnter(side(d), a) && !hostileDivsAt(side(d), a).length; });
  if (!opts.length) { destroyDiv(d, 'нет пути отхода'); return; }
  let best = opts[0], bv = -1e9; for (const o of opts) { const v = (c.sup ? c.sup[o] : 1) * 10 - DIST(d.prov, b.atkFrom || d.prov) * 0 + (PROV[o].t !== 'mountain' ? 1 : 0) + Math.random(); if (v > bv) { bv = v; best = o; } }
  b.def = b.def.filter(x => x !== d.id); d.path = [best]; d.prog = 0; d.attacking = null; d.ent = 0; d.plan = 0; d.manual = false; d.retreat = 24;
}
function hourlyBattles() {
  for (const k in G.battles) {
    const b = G.battles[k]; b.atk = b.atk.filter(id => G.divs[id] && G.divs[id].attacking === b.prov); b.def = (provDivs[b.prov] || []).filter(id => { const e = G.divs[id]; return e && isEnemy(b.atkSide, side(e)) && !(e.retreat > 0 && e.path.length); });
    if (!b.atk.length || !b.def.length) { for (const id of b.atk) { const d = G.divs[id]; if (d) { d.attacking = null; if (d.prov === b.prov && !b.def.length && isEnemy(side(d), G.ctrl[b.prov])) captureProv(b.prov, side(d)); } } delete G.battles[k]; continue; }
    const P = PROV[b.prov], T = TERRAIN[P.t]; const dirs = new Set(b.atk.map(id => G.divs[id].prov)).size;
    const widthAtk = T.w * (1 + .4 * (dirs - 1)) * (1 + (C(G.divs[b.atk[0]].tag).m.cwidth || 0)), widthDef = T.w * (1 + .4 * (dirs - 1));
    const pick = (list, width) => { const act = []; let w = 0; for (const id of list) { const d = G.divs[id]; const s = divStats(C(d.tag), d.tpl); const inFront = d._front; if (w + s.w <= width * 1.15 || !act.length) { act.push(d); w += s.w; } } return act; };
    // Резервы: сильнейшие по организации в бою, остальные ждут
    const sortKey = id => -G.divs[id].org; b.atk.sort((x, y) => sortKey(x) - sortKey(y)); b.def.sort((x, y) => sortKey(x) - sortKey(y));
    const A = pick(b.atk, widthAtk), D = pick(b.def, widthDef); b.reserveA = b.atk.length - A.length; b.reserveD = b.def.length - D.length;
    for (const d of A) { d._f = divFight(d, true, b); d._defLeft = undefined; d._orgD = 0; d._strD = 0; }
    for (const d of D) { d._f = divFight(d, false, b); d._defLeft = undefined; d._orgD = 0; d._strD = 0; }
    resolveSide(A, D, b, true); resolveSide(D, A, b, false);
    let lost = [];
    for (const d of [...A, ...D]) {
      d.org = Math.max(0, d.org - d._orgD); d.str = Math.max(0, d.str - d._strD); d.xp = Math.min(1, d.xp + .0006 * (1 + (C(d.tag).m.div_xp || 0)));
      if (d.org <= .5) lost.push(d); if (d.str <= .02) d._dead = true;
      { const h = C(d.tag).history; h.cas = (h.cas || 0) + d._strD * divStats(C(d.tag), d.tpl).mp; }
      delete d._f;
    }
    { const pw = (x, atk) => { const st = divStats(C(x.tag), x.tpl); return x.org * x.str * (atk ? st.sa + st.ha + st.brk : st.sa + st.ha + st.def * .25); }; b.lastAdv = (A.reduce((v, x) => v + pw(x, true), 0) + 1) / (D.reduce((v, x) => v + pw(x, false), 0) + 1); }
    for (const d of lost) {
      if (d._dead) { destroyDiv(d, 'уничтожена в бою'); continue; }
      if (A.includes(d)) { removeFromBattle(d); d.path = []; d.prog = 0; d.plan = 0; d.noAttack = G.hour + 60; }
      else retreatDiv(d, b);
    }
    // Опыт за бой
    if (G.hour % 24 === 0) { const a0 = G.divs[b.atk[0]]; if (a0) gainWarXP(C(a0.tag), .5); const d0 = G.divs[b.def[0]]; if (d0) gainWarXP(C(d0.tag), .5); }
  }
  for (const id in G.divs) { const d = G.divs[id]; if (d.retreat > 0) d.retreat--; }
}
function gainWarXP(c, v) { c.xp.army = Math.min(999, c.xp.army + v * .3); for (const Gp of Object.values(G.groups)) if (Gp.tag === c.t && Gp.fm) { const f = c.gens.find(x => x.id === Gp.fm); if (f) { f.xp += v * .5; if (f.xp > 90 * f.skill && f.skill < 6) { f.skill++; f.xp = 0; if (!c.ai) logMsg(`Фельдмаршал ${f.n} получил новый уровень`, c.t, 'good'); } } } for (const a of Object.values(G.armies)) if (a.tag === c.t && a.gen) { const g = c.gens.find(x => x.id === a.gen); if (g) { g.xp += v; if (g.xp > 60 * g.skill && g.skill < 6) { g.skill++; g.xp = 0; g.atk++; g.def++; if (!c.ai) logMsg(`Генерал ${g.n} получил новый уровень`, c.t, 'good'); } } } }
function hourlyOrgRecover() {
  for (const id in G.divs) {
    const d = G.divs[id]; if (d.attacking || G.battles[d.prov]?.def.includes(d.id)) continue;
    const c = C(d.tag), s = divStats(c, d.tpl), mx = s.org * clamp(d.sup + .2, .2, 1);
    if (d.org < mx) d.org = Math.min(mx, d.org + (d.path.length ? .5 : 1.4)); else if (d.org > mx) d.org -= .5;
  }
}

// ---------- армии и фронты ----------
function makeArmiesInit(c) {
  const ids = Object.values(G.divs).filter(d => d.tag === c.t).map(d => d.id); if (!ids.length) return; const per = 24, made = []; let n = 1;
  if (c.major && c.gens[0]) c.gens[0].rank = 'marshal';
  for (let i = 0; i < ids.length; i += per) { made.push(createArmy(c, ids.slice(i, i + per), `${n}-я армия`).id); n++; }
  if (c.major) createGroup(c, made.slice(0, MAX_GROUP_ARMIES));
}
function createArmy(c, ids, name) {
  const A = { id:nid(), tag:c.t, name:name || `${(c.armyN = (c.armyN || 0) + 1)}-я армия`, divs:[], gen:null, mode:'hold', front:null, target:null, garrison:false };
  G.armies[A.id] = A;
  const freeGen = c.gens.find(g => g.rank !== 'marshal' && !Object.values(G.armies).some(x => x.gen === g.id)); if (freeGen) A.gen = freeGen.id;
  for (const id of ids) { const d = G.divs[id]; if (!d) continue; if (d.army && G.armies[d.army]) G.armies[d.army].divs = G.armies[d.army].divs.filter(x => x !== id); d.army = A.id; A.divs.push(id); }
  return A;
}
function disbandArmy(A) { if (A.group) armyToGroup(A.id, null); for (const id of A.divs) { const d = G.divs[id]; if (d) { d.army = null; d.slot = null; } } delete G.armies[A.id]; }
function distToLine(x, y, pts) { if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]); let b = 1e12; for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1); b = Math.min(b, Math.hypot(x - ax - dx * t, y - ay - dy * t)); } return b; }
// Кто считается противником на этом участке фронта
function frontFoe(c, X, o) {
  if (!o || o === c.t || isAlly(c.t, o)) return false;
  if (X.front === 'all' || X.front == null) return isEnemy(c.t, o);
  if (X.line) { const T = X.lineTags || {}; if (T[o]) return true; if (!isEnemy(c.t, o)) return false; for (const t in T) if (isAlly(o, t)) return true; return false; }
  return o === X.front || (isAlly(o, X.front) && isEnemy(c.t, o));
}
let contactCache = {}, contactHour = -1;
function frontContacts(c, X) { const win = G.hour - G.hour % 6; if (contactHour !== win) { contactCache = {}; contactHour = win; } const key = X.line || !c.ai ? null : c.t + '|' + X.front; if (key && contactCache[key]) return contactCache[key]; const out = key ? (contactCache[key] = []) : []; for (const P of M.prov) { const ct = G.ctrl[P.i]; if ((ct === c.t || isAlly(c.t, ct)) && P.land.some(a => frontFoe(c, X, G.ctrl[a]))) out.push(P.i); } return out; }
// Участок по линии: опорные точки каждый раз притягиваются к текущей границе, поэтому фронт идёт за войсками и не сбрасывается
function frontProvinces(c, X) {
  const contacts = frontContacts(c, X); if (!X.line || !contacts.length) return contacts;
  const snapR = 700 / M.KM, line = [];
  for (const [x, y] of X.line) { let b = null, bd = 1e18; for (const p of contacts) { const d = (PROV[p].x - x) ** 2 + (PROV[p].y - y) ** 2; if (d < bd) { bd = d; b = p; } } const q = b && bd < snapR * snapR ? [PROV[b].x, PROV[b].y] : [x, y]; const l = line[line.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) line.push(q); }
  X.line = line; const R = 190 / M.KM;
  return contacts.filter(p => distToLine(PROV[p].x, PROV[p].y, line) < R);
}
// Порядок провинций вдоль фронта
function orderAlong(list) {
  if (list.length < 3) return list.slice(); let mx = 0, my = 0; for (const p of list) { mx += PROV[p].x; my += PROV[p].y; } mx /= list.length; my /= list.length; let xx = 0, yy = 0, xy = 0; for (const p of list) { const a = PROV[p].x - mx, b = PROV[p].y - my; xx += a * a; yy += b * b; xy += a * b; }
  const t = .5 * Math.atan2(2 * xy, xx - yy), cx = Math.cos(t), sy = Math.sin(t); return list.slice().sort((a, b) => (PROV[a].x * cx + PROV[a].y * sy) - (PROV[b].x * cx + PROV[b].y * sy));
}
// Группа армий: общий участок делится между армиями по числу дивизий
function runGroupFront(c, Gp) {
  if (!Gp.line && !Gp.front) return; const arm = Gp.armies.map(i => G.armies[i]).filter(a => a && !a.indep && a.divs.length); if (!arm.length) return;
  const list = orderAlong(frontProvinces(c, Gp)); const total = arm.reduce((v, a) => v + a.divs.length, 0); let start = 0, acc = 0;
  arm.forEach((a, i) => { acc += a.divs.length; const end = i === arm.length - 1 ? list.length : Math.round(list.length * acc / total); a._sector = list.slice(start, Math.max(end, start)); start = end; a.front = 'group'; a.mode = Gp.mode; a.target = Gp.target || null; });
}
// Ближайшее своё побережье, куда можно дойти по суше
function nearestCoast(tag, from) { if (PROV[from].coastal && friendly(tag, from)) return from; const seen = new Set([from]), q = [from]; for (let i = 0; i < q.length; i++) for (const a of PROV[q[i]].land) { if (seen.has(a) || !friendly(tag, a)) continue; if (PROV[a].coastal) return a; seen.add(a); q.push(a); } return 0; }
// Маршрут к участку фронта: по суше, а если суша отрезана, то через порт морем
function routeToSlot(c, d, p) {
  const path = findPath(c.t, d.prov, p, false); if (path) { d.path = path; d.prog = 0; return true; }
  const from = nearestCoast(c.t, d.prov), to = nearestCoast(c.t, p); if (!from || !to) return false; if (c.ai && G.ctrl[to] !== c.t) return false; const r = seaRouteOK(c.t, from, to); if (!r || r.block) return false;
  if (d.prov !== from) { const pp = findPath(c.t, d.prov, from, false); if (!pp) return false; d.path = pp; d.prog = 0; return true; }
  if (orderLanding([d], to)) return false; G.landings[G.landings.length - 1].auto = true; return true;
}
function runArmyFront(c, A) {
  if (!A.divs.length) return;
  const list = A.front === 'group' ? (A._sector || []) : orderAlong(frontProvinces(c, A)); A._fp = list; if (!list.length) return; // Нет контакта: армия держит позицию, приказ сохраняется
  const fronts = new Set(list), dvs = A.divs.map(i => G.divs[i]).filter(Boolean), n = dvs.length, m = list.length;
  // Сколько дивизий нужно каждой провинции: равномерно по всему участку
  const want = {}; for (const p of list) want[p] = 0;
  if (n >= m) { const base = Math.floor(n / m); let extra = n - base * m; for (const p of list) want[p] = base; const prio = A.target ? list.slice().sort((a, b) => DIST(a, A.target) - DIST(b, A.target)) : list.filter((_, i) => i % 2 === 0).concat(list.filter((_, i) => i % 2)); for (const p of prio) { if (extra-- <= 0) break; want[p]++; } }
  else for (let i = 0; i < n; i++) want[list[Math.min(m - 1, Math.floor((i + .5) * m / n))]]++;
  const have = {}; for (const p of list) have[p] = 0; const free = [];
  for (const d of dvs) { if (d.slot && !fronts.has(d.slot)) d.slot = null; if (d.boarding) { if (d.slot) have[d.slot]++; continue; } if (d.manual || d.retreat > 0) continue; if (d.attacking || (d.path.length === 1 && isEnemy(c.t, G.ctrl[d.path[0]]))) { if (fronts.has(d.prov)) { d.slot = d.prov; have[d.prov]++; } continue; } if (d.slot && have[d.slot] < want[d.slot] + 1) have[d.slot]++; else { d.slot = null; free.push(d); } }
  // Сначала занимаем провинцию, где уже стоим, затем ближайший незакрытый участок
  for (const d of free) if (fronts.has(d.prov) && have[d.prov] < want[d.prov]) { d.slot = d.prov; have[d.prov]++; d.path = []; d.prog = 0; }
  let routes = 0;
  const maxRoutes = c.ai ? 5 : 14;
  for (const p of list) { if (have[p] || !want[p]) continue; let pick = null, bd = 1e18; for (const d of dvs) { if (!d.slot || d.attacking || d.boarding || d.manual || have[d.slot] < 2 || (d.moved || 0) > G.hour) continue; const v = DIST(d.prov, p); if (v < bd) { bd = v; pick = d; } } if (pick) { have[pick.slot]--; pick.slot = null; free.push(pick); } }
  for (const d of free) { if (d.slot || routes >= maxRoutes || (d.noRoute || 0) > G.hour) continue; const cand = list.filter(p => have[p] < want[p]).sort((a, b) => DIST(d.prov, a) - DIST(d.prov, b)).slice(0, c.ai ? 2 : 4); if (!cand.length) break; let ok = false; for (const p of cand) { routes++; if (!routeToSlot(c, d, p)) continue; d.slot = p; d.moved = G.hour + 72; have[p]++; ok = true; break; } if (!ok) d.noRoute = G.hour + (c.ai ? 96 : 12); }
  // Дивизии сверх потребности держатся рядом с участком, а не стоят где попало
  A._gaps = list.filter(p => !have[p]).length;
  for (const d of dvs) if (d.slot && !d.boarding && !d.manual && !d.attacking && !d.path.length && d.prov !== d.slot && routes < maxRoutes) { routes++; if (!routeToSlot(c, d, d.slot)) { d.slot = null; d.noRoute = G.hour + (c.ai ? 96 : 12); } }
  // Наступление: из провинции бьют вместе и по одной цели, соседние участки поддерживают начатый бой
  if (A.mode !== 'attack') return;
  const byProv = {};
  for (const d of dvs) {
    if (d.boarding || d.manual || d.attacking || d.path.length || d.retreat > 0 || !fronts.has(d.prov)) continue;
    const s = divStats(c, d.tpl); if ((d.noAttack || 0) > G.hour || d.org < s.org * .7 || d.str < .3 || d.sup < .1) continue;
    (byProv[d.prov] = byProv[d.prov] || []).push(d);
  }
  const tp = A.target ? PROV[A.target] : null;
  for (const p in byProv) {
    const group = byProv[p]; let best = 0, bv = -1e9, bestEn = 0;
    for (const t of PROV[p].land) {
      const ct = G.ctrl[t]; if (!ct || !isEnemy(c.t, ct)) continue;
      const foes = hostileDivsAt(c.t, t); let en = 0; for (const e of foes) { const st = divStats(C(e.tag), e.tpl); en += st.def * e.str * (e.org / Math.max(1, st.org)); }
      let v = foes.length ? -en * .01 : 3; v -= (G.fort[t] || 0) * .4 + (PROV[t].t === 'mountain' ? 1 : 0) + (PROV[p].rivSet?.has(+t) ? .5 : 0); v += (G.vp[t] || 0) * .15; if (G.battles[t]) v += 2.5;
      if (tp) v -= Math.hypot(PROV[t].x - tp.x, PROV[t].y - tp.y) * .012;
      if (v > bv) { bv = v; best = t; bestEn = en * .25 * (1 + (G.fort[t] || 0) * .12); }
    }
    if (!best) continue;
    let my = 0; for (const d of group) { const st = divStats(c, d.tpl); my += st.sa * d.str * (d.org / Math.max(1, st.org)); }
    if (bestEn > 0 && my <= bestEn * (A.aggr ?? .9) && !G.battles[best]) continue; // Сил мало: ждём подкреплений, а не гибнем поодиночке
    for (const d of group) { d.path = [best]; d.prog = 0; }
  }
}

// ---------- командование: генералы, фельдмаршалы, группы армий ----------
const MAX_ARMY_DIVS = 24, MAX_GROUP_ARMIES = 5, PROMOTE_COST = 100;
function createGroup(c, armyIds, name) {
  c.groupN = (c.groupN || 0) + 1; const Gp = { id:nid(), tag:c.t, name:name || `Группа армий ${c.groupN}`, fm:null, armies:[], mode:'hold', front:null, line:null, lineTags:null, target:null };
  G.groups[Gp.id] = Gp; const fm = c.gens.find(g => g.rank === 'marshal' && !Object.values(G.groups).some(x => x.fm === g.id)); if (fm) Gp.fm = fm.id;
  for (const id of armyIds || []) armyToGroup(id, Gp.id); return Gp;
}
function armyToGroup(aid, gid) {
  const A = G.armies[aid]; if (!A) return 'Нет армии'; const Gp = gid ? G.groups[gid] : null; if (Gp && Gp.armies.length >= MAX_GROUP_ARMIES && A.group !== Gp.id) return `В группе не больше ${MAX_GROUP_ARMIES} армий`;
  if (A.group && G.groups[A.group]) G.groups[A.group].armies = G.groups[A.group].armies.filter(x => x !== aid); A.group = Gp ? Gp.id : null; A.indep = false; if (Gp) Gp.armies.push(aid); else if (A.front === 'group') { A.front = null; A.mode = 'hold'; A.target = null; A._sector = null; A._fp = null; } return null;
}
function disbandGroup(Gp) { for (const id of Gp.armies.slice()) armyToGroup(id, null); delete G.groups[Gp.id]; }
function promoteGeneral(c, gid) { const g = c.gens.find(x => x.id === gid); if (!g) return 'Нет генерала'; if (g.rank === 'marshal') return 'Уже фельдмаршал'; if (c.pp < PROMOTE_COST) return `Нужно ${PROMOTE_COST} власти`; c.pp -= PROMOTE_COST; g.rank = 'marshal'; for (const A of Object.values(G.armies)) if (A.gen === gid) A.gen = null; return null; }
function demoteMarshal(c, gid) { const g = c.gens.find(x => x.id === gid); if (!g || g.rank !== 'marshal') return 'Это не фельдмаршал'; g.rank = 'general'; for (const Gp of Object.values(G.groups)) if (Gp.fm === gid) Gp.fm = null; return null; }
function assignArmyGeneral(A, gid) { if (gid) { const g = C(A.tag).gens.find(x => x.id === gid); if (!g || g.rank === 'marshal') return 'Армией командует генерал'; for (const o of Object.values(G.armies)) if (o.gen === gid && o !== A) o.gen = null; } A.gen = gid || null; return null; }
function assignGroupMarshal(Gp, gid) { if (gid) { const g = C(Gp.tag).gens.find(x => x.id === gid); if (!g || g.rank !== 'marshal') return 'Группой командует фельдмаршал'; for (const o of Object.values(G.groups)) if (o.fm === gid && o !== Gp) o.fm = null; } Gp.fm = gid || null; return null; }
function moveDivsToArmy(ids, aid) { const A = G.armies[aid]; if (!A) return 'Нет армии'; for (const id of ids) { const d = G.divs[id]; if (!d || d.tag !== A.tag || d.army === aid) continue; if (d.army && G.armies[d.army]) G.armies[d.army].divs = G.armies[d.army].divs.filter(x => x !== id); d.army = aid; d.slot = null; A.divs.push(id); } return null; }
function commandBonus(d) { const A = d.army && G.armies[d.army]; if (!A) return 0; let f = A.divs.length > MAX_ARMY_DIVS ? -(A.divs.length - MAX_ARMY_DIVS) * .01 : 0; const Gp = A.group && G.groups[A.group]; if (Gp && Gp.fm) { const fm = C(d.tag).gens.find(g => g.id === Gp.fm); if (fm) f += fm.skill * .012; } return f; }

// ---------- десанты ----------
function isPort(p) { return PROV[p].coastal && (G.vp[p] > 0); }
function seaRouteOK(tag, from, to) {
  // Соединены ли прибрежные провинции морем, и нет ли вражеского превосходства на конечной зоне
  const q = PROV[from].seaAdj.slice(), seen = new Set(q); const goal = new Set(PROV[to].seaAdj);
  for (let i = 0; i < q.length; i++) { const z = q[i]; if (goal.has(z)) return { z, block:seaBlockedFor(C(tag), z) }; for (const a of PROV[z].adj) if (PROV[a].sea && !seen.has(a)) { seen.add(a); q.push(a); } }
  return null;
}
function orderLanding(divs, to) {
  if (!divs.length) return 'Нет дивизий'; const tag = divs[0].tag, c = C(tag);
  if (!PROV[to].coastal) return 'Цель должна быть на побережье';
  const ct = G.ctrl[to]; const friendlyDest = friendly(tag, to);
  if (!friendlyDest && !isEnemy(tag, ct)) return 'Нет войны с владельцем этой земли';
  for (const d of divs) if (!PROV[d.prov].coastal) return 'Дивизии должны стоять на побережье';
  const route = seaRouteOK(tag, divs[0].prov, to); if (!route) return 'Нет морского пути'; if (route.block) return 'Нет господства на море у цели';
  const base = friendlyDest ? 3 : 10; const days = base * (1 + (c.m.land_prep || 0));
  G.landings.push({ id:nid(), tag, divs:divs.map(d => d.id), to, left:days * 24, friendly:friendlyDest, zone:route.z });
  for (const d of divs) { d.path = []; d.boarding = true; removeFromBattle(d); }
  return null;
}
function hourlyLandings() {
  for (const L of [...G.landings]) {
    L.left--; if (L.left > 0) continue; G.landings.splice(G.landings.indexOf(L), 1);
    const c = C(L.tag); const divs = L.divs.map(i => G.divs[i]).filter(Boolean); for (const d of divs) d.boarding = false;
    if (seaBlockedFor(c, L.zone)) { if (!c.ai) logMsg('Десант сорван: нет господства на море', c.t, 'bad'); for (const d of divs) { d.str *= .8; } continue; }
    for (const d of divs) {
      moveIdx(d, L.to); d.org *= .7; d.ent = 0; d.plan = 0; d.landing = !L.friendly;
      if (!L.friendly && !hostileDivsAt(side(d), L.to).length && isEnemy(side(d), G.ctrl[L.to])) captureProv(L.to, side(d));
      else if (!L.friendly) { joinBattle(d, L.to); }
    }
    if (!c.ai && !L.auto) logMsg(L.friendly ? 'Переброска морем завершена' : 'Войска высадились на побережье', c.t, 'good');
  }
}
