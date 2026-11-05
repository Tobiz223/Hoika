// Авиация: зоны и миссии. Флот: готовые типы, автобой, господство, рейды.
function wingCount(c, type) { let n = 0; for (const id in G.wings) { const w = G.wings[id]; if (w.tag === c.t && w.type === type) n += w.n; } return n; }
function bestBase(c) { let b = null, bv = -1; for (const st of G.st) { if (!st || st.ctrl !== c.t || !st.air) continue; if (st.air > bv) { bv = st.air; b = st; } } return b || G.st[c.capState]; }
function createWing(c, type, n, state) {
  const st = state || bestBase(c); if (!st) return null;
  const w = { id:nid(), tag:c.t, type, n, base:st.id, zone:st.zone ?? 0, mission:null, name:`${(c.wingN = (c.wingN || 0) + 1)}-е крыло` }; G.wings[w.id] = w; return w;
}
const AIR_MISSIONS = { sup:'Превосходство в воздухе', cas:'Штурмовка', tac:'Тактические удары', str:'Стратегические бомбардировки', nav:'Удары по морю' };
const WING_MISSIONS = { ftr:['sup'], cas:['cas'], tac:['cas','tac','str'], str:['str','tac'], nav:['nav','cas'] };
function zoneDistOK(w) { const st = G.st[w.base]; if (!st || st.zone == null) return false; if (w.mission === 'nav') return true; const a = G.zones[st.zone], b = G.zones[w.zone]; if (!a || !b) return false; const r = (w.type === 'ftr' ? 620 : w.type === 'str' ? 1500 : 850) + (C(w.tag).m.air_range ? 200 : 0); return Math.hypot(a.x - b.x, a.y - b.y) * M.KM < r; }
function dailyAir() {
  const zones = {}; const q = (c, t) => c.q[t] || 1;
  for (const id in G.wings) {
    const w = G.wings[id], c = C(w.tag); if (!c || c.capitulated || !w.mission || w.n <= 0) continue;
    if (G.st[w.base]?.ctrl !== w.tag || !zoneDistOK(w)) continue;
    const key = w.mission === 'nav' ? 'S' + w.sea : w.zone; const z = zones[key] || (zones[key] = { wings:[] }); z.wings.push(w);
    // пополнение из склада
    const need = 100 - w.n; if (need > 0 && c.stock[w.type] >= 1) { const g = Math.min(need, c.stock[w.type], 8); c.stock[w.type] -= g; w.n += g; }
  }
  const nextAir = {};
  for (const key in zones) {
    const Z = zones[key]; const tags = [...new Set(Z.wings.map(w => w.tag))];
    const res = { sup:{}, cas:{} }; const fighters = {};
    for (const t of tags) fighters[t] = Z.wings.filter(w => w.tag === t && w.type === 'ftr').reduce((v, w) => v + w.n * q(C(t), 'ftr') * (1 + (C(t).m.ftr_atk || 0)), 0);
    for (const t of tags) {
      let ours = 0, foes = 0; for (const u of tags) { if (u === t || isAlly(t, u)) ours += fighters[u]; else if (isEnemy(t, u)) foes += fighters[u]; }
      res.sup[t] = (ours + 20) / (ours + foes + 40);
    }
    for (const w of Z.wings) {
      const c = C(w.tag), sup = res.sup[w.tag]; let foes = 0; for (const u of tags) if (isEnemy(w.tag, u)) foes += fighters[u];
      const hasWar = atWar(c); if (!hasWar) continue;
      let hit = 0;
      if (foes > 0) hit = (w.type === 'ftr' ? .012 : .025) * foes / Math.max(50, foes + w.n * q(c, w.type)) * (1 - (w.type === 'str' ? (c.m.str_def || 0) : 0)) * (1 + (1 - sup));
      const lost = w.n * hit; w.n = Math.max(0, w.n - lost); c.history.planes = (c.history.planes || 0) + lost;
      const gainAir = lost > 0 ? .02 : 0; c.xp.air = Math.min(999, c.xp.air + gainAir);
      const p = w.n * q(c, w.type) * sup;
      if (w.mission === 'cas' && key !== 'S') { res.cas[w.tag] = (res.cas[w.tag] || 0) + p * (1 + (c.m.cas_atk || 0)) / 1500; }
      if (w.mission === 'tac' && typeof key === 'number' || (w.mission === 'tac' && !String(key).startsWith('S'))) {
        const zn = G.zones[+key]; if (zn) for (const sid of zn.states) for (const prov of M.states.find(s => s.id === sid).prov) { const foesHere = hostileDivsAt(w.tag, prov); for (const e of foesHere) { e.org = Math.max(0, e.org - p * .006); } }
      }
      if (w.mission === 'str' && !String(key).startsWith('S')) {
        const zn = G.zones[+key]; if (zn) { const tg = zn.states.map(s => G.st[s]).filter(s => s.ctrl && isEnemy(w.tag, s.ctrl) && (s.civ + s.mil)).sort((a, b) => (b.civ + b.mil) - (a.civ + a.mil))[0]; if (tg) { const aa = 1 - tg.aa * .1; const dmg = p * .03 * (1 + (c.m.str_atk || 0)) * aa * (1 - (C(tg.ctrl)?.m.bomb_res || 0)); tg.bomb = Math.min(80, (tg.bomb || 0) + dmg); w.n = Math.max(0, w.n - w.n * tg.aa * .002); } }
      }
      if (w.mission === 'nav' && String(key).startsWith('S')) {
        const sea = +String(key).slice(1); for (const fid in G.fleets) { const f = G.fleets[fid]; if (f.zone !== sea || !isEnemy(w.tag, f.tag) || f.travel > 0 || !f.ships.length) continue; const sh = f.ships[Math.floor(Math.random() * f.ships.length)]; const dmg = p * .12; sh.hp -= dmg * (1 - (shipStat(C(f.tag), sh.t, 'aa') * .01)); if (sh.hp <= 0) { f.ships.splice(f.ships.indexOf(sh), 1); logNaval(f, sh, 'потоплен авиацией'); } }
      }
    }
    if (!String(key).startsWith('S')) nextAir[key] = res;
  }
  G.zoneAir = nextAir;
  for (const id in G.wings) { if (G.wings[id].n < .5) delete G.wings[id]; }
}

// ---------- флот ----------
function shipStat(c, t, k) { const B = DB.SHIP[t]; let v = B[k] || 0; const sm = c.sm?.[t]; if (sm && sm[k]) v *= 1 + sm[k]; if (k === 'gun') v *= 1 + (c.m.gun || 0) * (t === 'cv' ? 0 : 1) + (t === 'cv' ? (c.m.cv_atk || 0) : 0); if (t === 'ss' && k === 'tor') v *= 1 + (c.m.ss_atk || 0); return v; }
function homePort(c) { const cand = M.prov.filter(p => p.coastal && G.ctrl[p.i] === c.t); if (!cand.length) return null; cand.sort((a, b) => (G.st[b.s].dock - G.st[a.s].dock) || (G.vp[b.i] - G.vp[a.i])); return cand[0].i; }
function addShips(c, t, n, fresh) {
  let f = Object.values(G.fleets).find(x => x.tag === c.t && x.reserve);
  if (!f) { const port = homePort(c); if (!port) return; const z = PROV[port].seaAdj[0]; f = { id:nid(), tag:c.t, name:'Основной флот', zone:z, mission:'base', ships:[], port, travel:0, reserve:true }; G.fleets[f.id] = f; }
  for (let i = 0; i < n; i++) f.ships.push({ t, hp:shipStat(c, t, 'hp') });
  if (fresh && !c.ai) logMsg(`Спущен на воду: ${DB.SHIP[t].n}`, c.t, 'good');
}
function logNaval(f, sh, why) { const hs = C(f.tag).history; hs.ships = (hs.ships || 0) + 1; if (f.tag === G.player) logMsg(`${DB.SHIP[sh.t].n} (${f.name}) ${why}`, f.tag, 'bad'); }
function fleetPower(f) { const c = C(f.tag); let v = 0; for (const s of f.ships) v += (shipStat(c, s.t, 'gun') + shipStat(c, s.t, 'tor') * .5) * (s.hp / shipStat(c, s.t, 'hp')); return v; }
function orderFleet(f, zone, mission) {
  const c = C(f.tag); if (mission === 'base') { const port = homePort(c); if (port) { f.port = port; zone = PROV[port].seaAdj[0]; } }
  const dist = Math.hypot(PROV[zone].x - PROV[f.zone].x, PROV[zone].y - PROV[f.zone].y) * M.KM; f.travel = Math.ceil(dist / 650); f.zone = zone; f.mission = mission;
}
function splitFleet(f, types) { const c = C(f.tag); const nf = { id:nid(), tag:f.tag, name:`${(c.fleetN = (c.fleetN || 0) + 1) + 1}-я эскадра`, zone:f.zone, mission:'base', ships:[], port:f.port, travel:0 }; for (const t in types) { let n = types[t]; for (let i = f.ships.length - 1; i >= 0 && n > 0; i--) if (f.ships[i].t === t) { nf.ships.push(f.ships.splice(i, 1)[0]); n--; } } G.fleets[nf.id] = nf; return nf; }
function dailyNavy() {
  const byZone = {}; G.zoneNav = {};
  for (const id in G.fleets) {
    const f = G.fleets[id]; if (!C(f.tag) || C(f.tag).capitulated) { delete G.fleets[id]; continue; } if (!f.ships.length && !f.reserve) { delete G.fleets[id]; continue; }
    if (f.travel > 0) { f.travel--; continue; }
    if (f.mission === 'base') { for (const s of f.ships) { const c = C(f.tag), mx = shipStat(c, s.t, 'hp'); s.hp = Math.min(mx, s.hp + mx * .025 * (1 + (c.m.repair || 0))); } continue; }
    (byZone[f.zone] = byZone[f.zone] || []).push(f);
    if (f.mission === 'patrol') { const z = G.zoneNav[f.zone] = G.zoneNav[f.zone] || {}; z[f.tag] = (z[f.tag] || 0) + fleetPower(f) * (1 + (C(f.tag).m.dom || 0)); }
  }
  for (const z in byZone) {
    const list = byZone[z]; let pair = null;
    for (const a of list) for (const b of list) if (a !== b && isEnemy(a.tag, b.tag) && (a.mission === 'patrol' || b.mission === 'patrol')) pair = pair || [a, b];
    if (pair) navalBattle(list, +z);
  }
  // рейды
  for (const t in G.c) G.c[t].raidLoss = 0;
  for (const id in G.fleets) {
    const f = G.fleets[id]; if (f.mission !== 'raid' || f.travel > 0) continue; const atk = C(f.tag);
    const coast = M.prov.filter(p => p.seaAdj.includes(f.zone)).map(p => G.ctrl[p.i]); const pw = fleetPower(f) * (1 + (atk.m.raid || 0));
    for (const t of new Set(coast)) { if (!t || !isEnemy(f.tag, t)) continue; const v = C(t); const def = (G.zoneNav[f.zone]?.[t] || 0); v.raidLoss = Math.min(.6, (v.raidLoss || 0) + clamp(pw / (200 + def * 2), 0, .25)); }
  }
}
function navalBattle(list, z) {
  const c0 = {}; const sides = []; const assign = f => { for (const s of sides) if (s.fleets.some(o => isAlly(o.tag, f.tag))) { s.fleets.push(f); return; } sides.push({ fleets:[f] }); };
  for (const f of list) assign(f);
  if (sides.length < 2) return;
  const [A, B] = sides; const round = (S, T) => {
    const targets = T.fleets.flatMap(f => f.ships.map(s => ({ f, s }))); if (!targets.length) return;
    for (const f of S.fleets) { const c = C(f.tag); for (const sh of f.ships) {
      const pool = targets.filter(x => x.s.hp > 0); if (!pool.length) return;
      const det = shipStat(c, sh.t, 'det'); const tg = pool[Math.floor(Math.random() * pool.length)]; const vis = shipStat(C(tg.f.tag), tg.s.t, 'vis');
      if (tg.s.t === 'ss' && Math.random() > shipStat(c, sh.t, 'asw') * .04 + det * .005) continue;
      if (Math.random() > clamp(.25 + det / (det + 30) * .5 + vis * .005, .1, .9)) continue;
      const dmg = shipStat(c, sh.t, 'gun') * .3 + shipStat(c, sh.t, 'tor') * (Math.random() < .25 ? 1.2 : .1);
      tg.s.hp -= dmg;
    } }
  };
  for (let i = 0; i < 6; i++) { round(A, B); round(B, A); }
  for (const S of [A, B]) for (const f of S.fleets) {
    for (let i = f.ships.length - 1; i >= 0; i--) if (f.ships[i].hp <= 0) { const s = f.ships.splice(i, 1)[0]; logNaval(f, s, 'потоплен в бою'); C(f.tag).xp.navy = Math.min(999, C(f.tag).xp.navy + .3); }
    if (f.ships.length) { const tot = f.ships.reduce((v, s) => v + s.hp / shipStat(C(f.tag), s.t, 'hp'), 0) / f.ships.length; if (tot < .45) { orderFleet(f, f.zone, 'base'); if (f.tag === G.player) logMsg(`${f.name} отходит на базу для ремонта`, f.tag, 'bad'); } }
  }
  if ((A.fleets.some(f => f.tag === G.player) || B.fleets.some(f => f.tag === G.player))) { G.navLog = G.navLog || {}; if (!G.navLog[z] || G.hour - G.navLog[z] > 24 * 14) { G.navLog[z] = G.hour; logMsg(`Морское сражение: ${PROV[z].name}`, G.player, 'info'); } }
}
