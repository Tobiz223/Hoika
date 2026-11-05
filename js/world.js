// Состояние партии, инициализация мира, экономика, исследования, политика.
let G = null;
const M = window.MAPDATA;
const PROV = []; // статические данные суши и моря по id
const STATE_BY_ID = {};
for (const p of M.prov) { p.sea = false; p.adjSet = new Set(p.adj); p.rivSet = new Set(p.riv || []); PROV[p.i] = p; }
for (const s of M.sea) { s.sea = true; s.adjSet = new Set(s.adj); PROV[s.i] = s; }
for (const p of M.prov) { p.coastal = p.adj.some(a => PROV[a].sea); p.seaAdj = p.adj.filter(a => PROV[a].sea); p.land = p.adj.filter(a => !PROV[a].sea); }
for (const s of M.states) STATE_BY_ID[s.id] = s;
const SEA_IDS = M.sea.map(s => s.i), LAND_IDS = M.prov.map(p => p.i);
const DEG = Math.PI / 180;
function project(lon, lat) {
  const l = (lon - M.LON0) * DEG, p = lat * DEG, s0 = Math.sin(M.LAT0 * DEG), c0 = Math.cos(M.LAT0 * DEG);
  const k = Math.sqrt(2 / (1 + s0 * Math.sin(p) + c0 * Math.cos(p) * Math.cos(l)));
  return [(M.R * k * Math.cos(p) * Math.sin(l) - M.X0) / M.KM, (M.Y1 - M.R * k * (c0 * Math.sin(p) - s0 * Math.cos(p) * Math.cos(l))) / M.KM];
}
function nearestLand(lon, lat) {
  const [x, y] = project(lon, lat); let b = 0, bd = 1e18;
  for (const p of M.prov) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; b = p.i; } }
  return b;
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const fmt = (v, d = 0) => { const a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'М'; if (a >= 1e4) return (v / 1e3).toFixed(0) + 'к'; if (a >= 1e3) return (v / 1e3).toFixed(1) + 'к'; return v.toFixed(d); };
const pct = (v, d = 0) => (v * 100).toFixed(d) + '%';
function nid() { return G.nextId++; }
const C = t => G.c[t];
const stOf = p => G.st[PROV[p].s];
const ctrlOf = p => G.ctrl[p];
const ownerOf = p => G.st[PROV[p].s].owner;

// ---------- дата ----------
const START = Date.UTC(1936, 0, 1);
function curDate() { return new Date(START + G.hour * 3600000); }
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
function dateStr() { const d = curDate(); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, '0')}:00`; }
function curYear() { return curDate().getUTCFullYear(); }
function dateNum() { const d = curDate(); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); }
function logMsg(text, tag, kind) { G.log.unshift({ d: dateStr().split(',')[0], text, tag, kind }); if (G.log.length > 120) G.log.pop(); if (typeof UI !== 'undefined' && (!tag || tag === G.player)) UI.toast(text, kind); }

// ---------- инициализация ----------
function newCountry(d) {
  const c = {
    t:d.t, n:d.n, color:d.c, i:d.i, l:d.l, major:!!d.major, pop:d.pop || 1, party:Object.assign({ dem:.25, fas:.25, com:.25, neu:.25 }, d.party),
    pp:40, st:d.st || .5, war:d.w || .1, stab:d.st || .5, warsup:d.w || .1,
    laws:Object.assign({}, DB.LAW_DEFAULT, DB.LAW_START[d.t] || {}), adv:[], ideas:[], flags:{},
    focus:{ done:[], cur:null, prog:0 }, tech:{ done:{}, slots:[null, null, null], bonus:{}, gen:{} }, rslot:0, slotBonus:0,
    docs:{ land:{ path:null, n:0 }, air:{ path:null, n:0 }, navy:{ path:null, n:0 } }, xp:{ army:d.major ? 30 : 10, air:10, navy:10 },
    stock:{}, q:{}, fielded:{}, lines:[], buildq:[], mpUsed:0, mpAvail:0, mpMax:0,
    tpls:{}, recruit:[], gens:[], rel:{}, nap:{}, guar:[], access:{}, faction:null, master:null, trade:[], justify:null, canFaction:!!d.major,
    capitulated:false, surrender:0, colonial:d.col || {}, mpc:d.mpc || 1, ai:true, milN:0, civN:0, dockN:0, res:{}, resUse:{}, resTrade:{}, m:{}, sm:{}, dcache:{}, armyN:0,
    vpMax:1, planes:{}, lend:[], history:{ kills:0, losses:0 }, formed:false, natl:{},
  };
  for (const k of DB.EQ_ORDER) { c.stock[k] = 0; c.q[k] = 1; c.fielded[k] = 0; }
  return c;
}
function newGame(player, difficulty) {
  G = { hour:0, speed:0, player, difficulty:difficulty || 1, c:{}, st:[], ctrl:[], fort:[], vp:[], cities:[], divs:{}, armies:{}, groups:{}, battles:{}, wings:{}, fleets:{}, wars:[], factions:{}, wt:0, nextId:1, log:[], events:{}, landings:[], peace:null, zoneAir:{}, zoneNav:{}, snow:[], volunteers:[], winter:0, pending:[], ended:false };
  for (const d of DB.COUNTRIES) G.c[d.t] = newCountry(d);
  recalcWarRel();
  for (const k in provDivs) delete provDivs[k];
  // штаты
  for (const s of M.states) {
    G.st[s.id] = { id:s.id, name:s.name, owner:s.owner, orig:s.owner, cores:[s.owner], civ:0, mil:0, dock:0, synth:0, infra:C(s.owner) ? DB.COUNTRIES.find(d => d.t === s.owner).infra : 1, aa:0, air:0, slots:2, res:{}, mp:0, resist:0, bomb:0, sudeten:!!s.sudeten, ctrl:s.owner, lat:0 };
    for (const p of s.prov) { G.ctrl[p] = s.owner; G.fort[p] = 0; G.vp[p] = 0; }
    const avg = s.prov.reduce((v, p) => v + PROV[p].lat, 0) / Math.max(1, s.prov.length); G.st[s.id].lat = avg;
  }
  for (const s of M.sea) G.ctrl[s.i] = null;
  G.st[0] = null;
  // города и очки победы
  const seen = new Set();
  for (const c of M.cities) {
    const st = G.st[PROV[c.p].s]; if (!st) continue;
    if (!seen.has(c.p)) {
      seen.add(c.p);
      const vp = c.cap ? 30 : c.pop >= 3e6 ? 20 : c.pop >= 1.5e6 ? 12 : c.pop >= 8e5 ? 8 : c.pop >= 3e5 ? 3 : 1;
      G.vp[c.p] = vp; G.cities.push({ n:c.n, en:c.en, x:c.x, y:c.y, p:c.p, pop:c.pop, vp });
    }
  }
  for (const s of M.states) if (!s.prov.some(p => G.vp[p])) { const p = s.prov[0]; if (p) G.vp[p] = 1; }
  // столицы
  for (const d of DB.COUNTRIES) {
    const c = G.c[d.t]; const cities = M.cities.filter(x => x.en === d.cap && G.st[PROV[x.p].s].owner === d.t);
    let prov = cities[0]?.p;
    if (!prov && d.cap2) prov = M.cities.find(x => x.en === d.cap2)?.p;
    if (!prov) { const own = M.cities.filter(x => G.st[PROV[x.p].s].owner === d.t); prov = own[0]?.p; }
    if (!prov) prov = M.states.find(s => s.owner === d.t)?.prov[0];
    c.capital = prov; if (prov) G.vp[prov] = Math.max(G.vp[prov], 30);
    const stAll = c.pop > 20 ? 3 : 2;
    c.capState = prov ? PROV[prov].s : 0;
  }
  // заселение, заводы, ресурсы
  const byOwner = {};
  for (const s of M.states) (byOwner[s.owner] = byOwner[s.owner] || []).push(s);
  for (const d of DB.COUNTRIES) {
    const list = byOwner[d.t] || []; const tot = list.reduce((v, s) => v + s.pop + 1e4, 0) || 1;
    for (const s of list) {
      const st = G.st[s.id]; const w = (s.pop + 1e4) / tot;
      st.mp = d.pop * 1e6 * w; st.slots = clamp(2 + Math.round(w * 10) + (s.pop > 1e6 ? 2 : 0), 2, 12);
      if (s.pop > 1.5e6) st.infra = Math.min(5, st.infra + 1);
      if (s.prov.some(p => PROV[p].t === 'urban')) st.infra = Math.min(5, st.infra + 1);
    }
    const hot = new Set(); for (const c of M.cities) if (DB.IND_CITIES.includes(c.en) && G.st[PROV[c.p].s]?.owner === d.t) hot.add(PROV[c.p].s);
    const weight = s => (s.pop + 3e4) * (hot.has(s.id) ? 3 : 1);
    const place = (n, key, filter) => {
      const pool = list.filter(filter || (() => true)); if (!pool.length) return;
      for (let i = 0; i < n; i++) { let b = pool[0], bv = -1; for (const s of pool) { const st = G.st[s.id]; const used = st.civ + st.mil + st.dock; if (used >= st.slots) continue; const v = weight(s) / (1 + used); if (v > bv) { bv = v; b = s; } } G.st[b.id][key]++; }
    };
    place(d.civ, 'civ'); place(d.mil, 'mil');
    const coastal = s => s.prov.some(p => PROV[p].coastal);
    const dockHot = new Set((DB.PORT_DOCK[d.t] || []).map(n => M.cities.find(c => c.en === n)?.p).filter(Boolean).map(p => PROV[p].s));
    place(d.dock, 'dock', s => coastal(s) && (dockHot.size === 0 || dockHot.has(s.id)));
    for (const s of list) { const st = G.st[s.id]; st.slots = Math.max(st.slots, st.civ + st.mil + st.dock); if (st.civ + st.mil > 1) st.aa = 1; if (st.civ + st.mil > 3 || st.id === G.c[d.t].capState) st.air = 3; }
  }
  // Постоянные форты
  addFortLine('FRA', [[6.2,49.5],[7.5,49.1],[8.1,48.7],[7.6,48.3],[7.5,47.7]], 8); // линия вдоль немецкой границы
  addFortLine('GER', [[6.8,49.3],[7.2,50.5],[6.5,51.3]], 2);
  addFortLine('CZE', [[13.5,50.5],[15.5,50.6],[17.5,50]], 4);
  // Месторождения
  for (const [res, lon, lat, amt] of DB.DEPOSITS) { const st = stOf(nearestLand(lon, lat)); st.res[res] = (st.res[res] || 0) + amt; }
  // Хоть какие-то ресурсы у каждой страны
  // Шаблоны и начальная армия
  for (const d of DB.COUNTRIES) {
    const c = G.c[d.t];
    for (const t of DB.TECH_BASE) grantTech(c, t);
    if (d.major) for (const t of DB.TECH_MAJOR) grantTech(c, t);
    if (d.t === 'GER') ['i_con2','t_mech','t_mtk1','t_ltk2','t_para'].forEach(t => { if (t === 't_mech') return; grantTech(c, t); });
    if (d.t === 'ENG' || d.t === 'FRA') ['n_arm2','t_mar'].forEach(t => grantTech(c, t));
    c.tpls = {}; for (const k of Object.keys(DB.TPL)) if (tplAllowed(c, DB.TPL[k])) c.tpls[k] = JSON.parse(JSON.stringify(DB.TPL[k]));
    if (!c.tpls.inf) c.tpls.inf = JSON.parse(JSON.stringify(DB.TPL.inf));
    recalcMods(c);
    makeGenerals(c);
    const eqStart = d.major ? 1.3 : .8;
    // начальный склад
    for (const [tk, n] of Object.entries(d.divs || {})) {
      const t = c.tpls[tk] || c.tpls.inf;
      for (let i = 0; i < n; i++) { if (c.capital) spawnDivision(c, tk in c.tpls ? tk : 'inf', initialProv(c), .9); }
    }
    for (const eq of ['inf_eq','sup_eq','art_eq','mot_eq']) c.stock[eq] = Math.round((eq === 'inf_eq' ? 900 : eq === 'art_eq' ? 40 : 40) * d.pop ** .6 * eqStart);
    for (const [k, n] of Object.entries(d.pl || {})) { c.stock[k] = 0; createWing(c, k, n); }
    for (const [k, n] of Object.entries(d.sh || {})) addShips(c, k, n);
    // начальные линии
    aiSetupLines(c);
    c.mpUsed = 0;
    updateCountryEcon(c);
    c.pp = d.major ? 50 : 25;
    makeArmiesInit(c);
  }
  // Начальные отношения
  for (const a of DB.COUNTRIES) for (const b of DB.COUNTRIES) if (a.t !== b.t) G.c[a.t].rel[b.t] = a.i === b.i ? 25 : 0;
  // Стартовые фракции
  createFaction('ENG', 'Союзники', ['FRA']);
  // Рейнская демилитаризация не моделируется отдельно — смотри события
  G.wt = 3;
  const spirit = (t, name, m, until) => { const c = G.c[t]; c.ideas.push({ name, mod:m, until }); recalcMods(c); };
  spirit('SOV', 'Большая чистка', { org:-.2, sa:-.2, def:-.15, plan:-.2 }, 19420101);
  spirit('GER', 'Подготовленный генштаб', { sa:.1, brk:.15, org:.15, plan:.1 }, 19430101);
  spirit('FRA', 'Пораженческие настроения', { org:-.15, def:-.1 }, 19420101);
  spirit('ENG', 'Островная стратегия', { dom:.1 }, 19420101);
  C(player).ai = false;
  computeZones();
  for (const w of Object.values(G.wings)) { const st = G.st[w.base]; if (st) w.zone = st.zone; }
  recalcWarRel();
  updateWeather();
  for (const t in G.c) computeSupply(G.c[t]);
  const scale = { 0:1.15, 1:1, 2:.9 }[G.difficulty];
  if (G.difficulty !== 1) { const c = C(player); c.ideas.push({ name:G.difficulty === 0 ? 'Лёгкий режим' : 'Тяжёлый режим', mod:{ prod:scale - 1, build:scale - 1, research:scale - 1 } }); recalcMods(c); }
  dailyAll();
  return G;
}
function addFortLine(tag, pts, lvl) { for (const [lon, lat] of pts) { const p = nearestLand(lon, lat); if (ownerOf(p) === tag) G.fort[p] = lvl; for (const a of PROV[p].land) if (ownerOf(a) === tag && Math.random() < .6) G.fort[a] = Math.max(G.fort[a], lvl - 2); } }
function initialProv(c) { const owned = M.states.filter(s => s.owner === c.t).flatMap(s => s.prov).filter(p => PROV[p].land.length); return owned[Math.floor(Math.random() * owned.length)] || c.capital; }
function tplAllowed(c, t) { return [...t.grid, ...t.sup].every(b => { const req = b && (DB.BAT[b] || DB.SUP[b])?.tech; return !req || c.tech.done[req]; }); }
function grantTech(c, id) { if (c.tech.done[id]) return; const T = DB.TECH[id]; if (!T) return; c.tech.done[id] = true; if (T.fx.gen) { const [eq, g] = T.fx.gen; c.tech.gen[eq] = Math.max(c.tech.gen[eq] || 0, g); } }
function makeGenerals(c) {
  const names = DB.GENERALS[c.t] || []; const n = c.major ? Math.max(4, names.length) : 2; const traits = Object.keys(DB.TRAITS);
  for (let i = 0; i < n; i++) c.gens.push(newGeneral(c, names[i], traits[(i * 3 + c.t.charCodeAt(0)) % traits.length]));
}
function newGeneral(c, name, trait) {
  const nm = name || DB.GENERAL_FALLBACK[(c.t.charCodeAt(0) + c.t.charCodeAt(1) + c.gens.length * 7) % DB.GENERAL_FALLBACK.length];
  const seed = nm.length * 7 + c.gens.length; return { id:nid(), n:nm, rank:'general', skill:1 + (seed % 3), atk:1 + (seed % 4), def:1 + ((seed >> 1) % 4), log:1 + ((seed >> 2) % 3), plan:1 + ((seed >> 3) % 3), xp:0, traits:trait ? [trait] : [] };
}

// ---------- модификаторы ----------
function recalcMods(c) {
  const m = {}; const add = o => { if (o) for (const k in o) m[k] = (m[k] || 0) + o[k]; };
  for (const l in c.laws) { const L = DB.LAWS[l].list.find(x => x.id === c.laws[l]); add(L?.mod); }
  for (const id of c.adv) add(DB.ADVISORS.find(a => a.id === id)?.mod);
  for (const i of c.ideas) add(i.mod);
  for (const id in c.tech.done) add(DB.TECH[id]?.fx.mod);
  for (const fam in c.docs) { const dc = c.docs[fam]; if (!dc.path) continue; const P = DB.DOCTRINES[fam].paths.find(p => p.id === dc.path); P.nodes.slice(0, dc.n).forEach(n => add(n.mod)); }
  for (const id of c.focus.done) add(DB.FOCUS_MAP[id]?.fx.mod);
  c.m = m;
  // модули кораблей
  const sm = {}; for (const s of DB.SHIP_ORDER) sm[s] = {};
  for (const id in c.tech.done) { const f = DB.TECH[id]?.fx.ship; if (!f) continue; for (const t of f.types) for (const k in f) if (k !== 'types') sm[t][k] = (sm[t][k] || 0) + f[k]; }
  c.sm = sm; c.dcache = {};
}
const mod = (c, k) => c.m[k] || 0;

// ---------- статистика дивизии ----------
function divStats(c, tplId) {
  if (c.dcache[tplId]) return c.dcache[tplId];
  const t = c.tpls[tplId] || DB.TPL.inf; const r = { w:0, hp:0, sa:0, ha:0, def:0, brk:0, mp:0, eq:{}, spd:99, train:0, sup:0, air:0, hard:0, arm:0, prc:0, orgN:0, orgS:0, armMax:0, prcMax:0, ter:{}, river:0, plan:0, ent:0, reserve:0, sup_mul:1, casualty:0, resist:0, amph:0, bats:0, fort:0, tank:0, rec:0 };
  const q = eqs => { let v = 0, n = 0; for (const e in eqs) { v += c.q[e] * eqs[e]; n += eqs[e]; } return n ? v / n : 1; };
  const addB = (b, line) => {
    const f = q(b.eq);
    r.w += b.w || 0; r.hp += b.hp * (line ? 1 : .5); r.sa += b.sa * f; r.ha += b.ha * f; r.def += b.def * f; r.brk += b.brk * f; r.mp += b.mp; r.sup += b.sup; r.air += (b.air || 0) * f;
    for (const e in b.eq) r.eq[e] = (r.eq[e] || 0) + b.eq[e];
    r.train = Math.max(r.train, b.train || 0);
    if (line) { r.orgS += b.org; r.orgN++; r.spd = Math.min(r.spd, b.spd); r.hard += b.hard; r.bats++; r.arm += b.arm * f; r.armMax = Math.max(r.armMax, b.arm * f); r.prc += b.prc * f; r.prcMax = Math.max(r.prcMax, b.prc * f); if (b.group === 'arm') r.tank++; for (const k in b.ter || {}) r.ter[k] = (r.ter[k] || 0) + b.ter[k] / 3; if (b.amph) r.amph += .08; }
    else { r.river += b.river || 0; r.plan += b.plan || 0; r.ent += b.ent || 0; r.reserve += b.reserve || 0; r.sup_mul += b.sup_mul || 0; r.casualty += b.casualty || 0; r.resist += b.resist || 0; r.fort += b.fort || 0; r.orgS += (b.org_bonus || 0) * Math.max(1, r.orgN); }
  };
  for (const b of t.grid) if (b && DB.BAT[b]) addB(DB.BAT[b], true);
  for (const b of t.sup) if (b && DB.SUP[b]) addB(DB.SUP[b], false);
  const n = Math.max(1, r.bats);
  r.org = r.orgS / Math.max(1, r.orgN) * (1 + mod(c, 'org')); r.hard /= n; r.arm = (r.arm / n) * .7 + r.armMax * .3; r.prc = (r.prc / n) * .6 + r.prcMax * .4;
  r.sa *= 1 + mod(c, 'sa'); r.ha *= 1 + mod(c, 'ha'); r.def *= 1 + mod(c, 'def'); r.brk *= 1 + mod(c, 'brk'); r.arm *= 1 + mod(c, 'arm');
  r.spd = (r.spd === 99 ? 4 : r.spd) * (1 + mod(c, 'spd')); r.sup = r.sup * Math.max(.3, r.sup_mul) * (1 + mod(c, 'sup_use'));
  r.train = (r.train || 90) * (1 - mod(c, 'train'));
  r.ico = r.tank ? 'arm' : r.spd >= 8 ? 'mot' : t.grid.includes('mtn') ? 'mtn' : t.grid.includes('cav') ? 'cav' : t.grid.includes('mar') ? 'mar' : t.grid.includes('para') ? 'para' : 'inf';
  c.dcache[tplId] = r; return r;
}

// ---------- экономика ----------
function stateFactor(st, c) { if (st.owner === c.t || st.cores.includes(c.t)) return 1; return Math.max(.1, (1 - st.resist / 100) * .5); }
function stateWork(st) { return Math.max(.2, 1 - (st.bomb || 0) / 100); }
function updateCountryEcon(c) {
  let civ = 0, mil = 0, dock = 0, synth = 0, mp = 0; const res = {}; let vp = 0;
  for (const st of G.st) {
    if (!st || st.ctrl !== c.t) continue; const f = stateFactor(st, c) * stateWork(st);
    civ += st.civ * f; mil += st.mil * f; dock += st.dock * f; synth += st.synth * f; mp += st.mp * (st.owner === c.t || st.cores.includes(c.t) ? 1 : .15);
    for (const r in st.res) res[r] = (res[r] || 0) + st.res[r] * f * (1 + mod(c, 'res'));
  }
  // колонии и морские рейды
  const raid = c.raidLoss || 0;
  for (const r in c.colonial) res[r] = (res[r] || 0) + c.colonial[r] * (1 - raid);
  res.oil = (res.oil || 0) + synth * 6 * (1 + mod(c, 'synth')); res.rub = (res.rub || 0) + synth * 3 * (1 + mod(c, 'synth'));
  c.civN = civ; c.milN = mil; c.dockN = dock; c.res = res; c.synthN = synth;
  const L = DB.LAWS.consc.list.find(l => l.id === c.laws.consc);
  c.mpMax = mp * c.mpc * L.mp * (1 + mod(c, 'mp_mul'));
  c.mpAvail = c.mpMax - c.mpUsed;
}
function consumerShare(c) { const L = DB.LAWS.econ.list.find(l => l.id === c.laws.econ); return Math.max(0, L.cg - .02 * Math.max(0, c.stab - .7)); }
function tradeCost(c) { return c.trade.reduce((v, d) => v + d.fac, 0); }
function freeCivs(c) { const cg = c.civN * consumerShare(c); return Math.max(0, c.civN - cg - tradeCost(c)); }
function workFactor(c) { return Math.max(.3, 1 + mod(c, 'work') + (c.stab < .5 ? (c.stab - .5) * .8 : (c.stab - .5) * .2)); }
function milAssigned(c) { return c.lines.filter(l => !l.ship).reduce((v, l) => v + l.fac, 0); }
function dockAssigned(c) { return c.lines.filter(l => l.ship).reduce((v, l) => v + l.fac, 0); }

function dailyProduction(c) {
  // спрос на ресурсы
  const need = {}; let totalMil = milAssigned(c), totalDock = dockAssigned(c);
  const scaleM = totalMil > c.milN ? c.milN / Math.max(1, totalMil) : 1, scaleD = totalDock > c.dockN ? c.dockN / Math.max(1, totalDock) : 1;
  for (const l of c.lines) {
    const cost = l.ship ? DB.SHIP[l.ship].res : DB.EQ[l.eq].res, f = l.fac * (l.ship ? scaleD : scaleM);
    for (const r in cost) need[r] = (need[r] || 0) + cost[r] * f * (l.ship ? .1 : 1) * 2;
  }
  const have = {}; for (const r in c.res) have[r] = c.res[r]; // торговля уже в c.res через tradeIn
  for (const d of c.trade) have[d.res] = (have[d.res] || 0) + d.amt;
  for (const t in G.c) for (const d of G.c[t].trade) if (d.from === c.t) have[d.res] = (have[d.res] || 0) - d.amt;
  c.resUse = need; c.resHave = have;
  const ratio = {}; for (const r in need) ratio[r] = need[r] ? clamp((have[r] || 0) / need[r], 0, 1) : 1;
  const prod = 1 + mod(c, 'prod'); const work = workFactor(c); const cap = .5 + mod(c, 'eff_cap');
  for (const l of c.lines) {
    const cost = l.ship ? DB.SHIP[l.ship] : DB.EQ[l.eq]; let r = 1; for (const k in cost.res) r = Math.min(r, .25 + .75 * (ratio[k] ?? 1));
    const f = l.fac * (l.ship ? scaleD : scaleM);
    l.eff = Math.min(cap, (l.eff || .1) + (cap - (l.eff || .1)) * .005 * (1 + mod(c, 'eff_gain')));
    if (f <= 0) continue;
    const ic = f * (l.ship ? 2.5 * (1 + mod(c, 'dock_out')) : 4.5) * (.2 + l.eff) * prod * work * r;
    if (l.ship) {
      l.prog = (l.prog || 0) + ic;
      while (l.prog >= cost.cost) { l.prog -= cost.cost; addShips(c, l.ship, 1, true); if (l.left && --l.left <= 0) { l.fac = 0; break; } }
    } else {
      const n = ic / cost.cost; const gen = c.tech.gen[l.eq] ?? -1; const newQ = DB.EQ[l.eq].gens[clamp(gen, 0, DB.EQ[l.eq].gens.length - 1)] || 1;
      const tot = c.stock[l.eq] + c.fielded[l.eq] + 1; c.q[l.eq] = (c.q[l.eq] * tot + newQ * n) / (tot + n); c.stock[l.eq] += n;
      if (DB.EQ[l.eq].air) { c.planes[l.eq] = (c.planes[l.eq] || 0) + n; }
    }
  }
  // Ленд-лиз
  for (const ll of c.lend) { const to = C(ll.to); if (!to || to.capitulated) continue; const avail = Math.min(c.stock[ll.eq] || 0, ll.perDay); if (avail > 0) { c.stock[ll.eq] -= avail; to.stock[ll.eq] += avail; if (DB.EQ[ll.eq].air) {to.planes[ll.eq] = (to.planes[ll.eq] || 0) + avail;} } }
  // Строительство
  let budget = freeCivs(c);
  const out = 5 * work * (1 + mod(c, 'build'));
  c.buildUsed = 0;
  const done = [];
  for (const b of c.buildq) {
    if (budget <= 0) break;
    const f = Math.min(15, budget); budget -= f; c.buildUsed += f;
    const infra = G.st[b.s]?.infra || 3; b.prog = (b.prog || 0) + f * out * (.6 + infra * .1);
    if (b.prog >= DB.BUILD[b.type].cost) done.push(b);
  }
  for (const b of done) {
    const st = G.st[b.s]; c.buildq.splice(c.buildq.indexOf(b), 1);
    if (st.ctrl !== c.t) continue;
    if (b.type === 'fort') G.fort[b.prov] = Math.min(10, (G.fort[b.prov] || 0) + 1);
    else st[b.type] = (st[b.type] || 0) + 1;
    if (b.type === 'civ' || b.type === 'mil' || b.type === 'dock' || b.type === 'synth') updateCountryEcon(c);
  }
  // Убираем готовые корабельные заказы
  c.lines = c.lines.filter(l => !(l.ship && l.fac <= 0 && l.left !== undefined));
}
function usedSlots(st) { return st.civ + st.mil + st.dock + st.synth; }
function queuedSlots(c, st) { return c.buildq.filter(b => b.s === st.id && DB.BUILD[b.type].slot).length; }
function canBuild(c, st, type, prov) {
  if (!st || st.ctrl !== c.t) return 'Штат не под контролем';
  const B = DB.BUILD[type];
  if (B.slot && usedSlots(st) + queuedSlots(c, st) >= st.slots + (c.slotBonus || 0)) return 'Нет свободных слотов в штате';
  if (type === 'dock' && !M.states.find(s => s.id === st.id).prov.some(p => PROV[p].coastal)) return 'Верфь строится только у моря';
  if (B.max && type !== 'fort') { const q = c.buildq.filter(b => b.s === st.id && b.type === type).length; if ((st[type] || 0) + q >= B.max) return 'Достигнут максимум'; }
  if (type === 'fort' && prov && (G.fort[prov] || 0) + c.buildq.filter(b => b.prov === prov).length >= 10) return 'Достигнут максимум';
  return null;
}
function queueBuild(c, st, type, prov) { const e = canBuild(c, st, type, prov); if (e) return e; c.buildq.push({ id:nid(), s:st.id, type, prov:prov || null, prog:0 }); return null; }
function addLine(c, eq, fac, ship) { c.lines.push(ship ? { id:nid(), ship:eq, fac, eff:.15, prog:0, left:ship === true ? undefined : ship } : { id:nid(), eq, fac, eff:.15 }); }
function aiSetupLines(c) {
  c.lines = []; const m = c.milN || G.st.reduce((v, s) => v + (s && s.owner === c.t ? s.mil : 0), 0);
  if (m <= 0) return;
  const plan = c.major ? [['inf_eq',.3],['ftr',.15],['art_eq',.1],['sup_eq',.07],['ltk_eq',.15],['mot_eq',.08],['tac',.08],['cas',.07]] : [['inf_eq',.5],['art_eq',.15],['sup_eq',.1],['ftr',.25]];
  for (const [eq, p] of plan) { const f = Math.max(1, Math.round(m * p)); if (milAssigned(c) + f <= m) addLine(c, eq, f); }
}

// ---------- исследования ----------
function researchSlots(c) { return Math.min(5, 3 + c.rslot); }
function techCost(c, T, withBonus) {
  const y = curYear(); let f = 1;
  if (T.year > y) f *= 1 + .6 * (T.year - y) + .3 * Math.max(0, (T.year - y) - 1);
  else if (T.year < y) f *= Math.max(.5, 1 - .1 * (y - T.year));
  const bonus = withBonus !== false ? (c.tech.bonus[T.cat] || 0) : 0; return T.days * f * (1 - bonus);
}
function techSpeed(c, T) { return (c.major ? 1 : .8) * (1 + mod(c, 'research') + mod(c, 'r_' + T.cat)); }
function canResearch(c, id) { const T = DB.TECH[id]; if (!T || c.tech.done[id]) return false; if (T.req.some(r => !c.tech.done[r])) return false; if (c.tech.slots.some(s => s && s.id === id)) return false; return true; }
function startResearch(c, id, slot) {
  if (!canResearch(c, id)) return false; const T = DB.TECH[id];
  let idx = slot; if (idx == null) idx = c.tech.slots.findIndex((s, i) => !s && i < researchSlots(c)); if (idx < 0 || idx >= researchSlots(c)) return false;
  c.tech.slots[idx] = { id, prog:0, cost:techCost(c, T) }; delete c.tech.bonus[T.cat]; return true;
}
function dailyResearch(c) {
  while (c.tech.slots.length < researchSlots(c)) c.tech.slots.push(null);
  for (let i = 0; i < c.tech.slots.length; i++) {
    const s = c.tech.slots[i]; if (!s) continue; const T = DB.TECH[s.id];
    s.prog += techSpeed(c, T);
    if (s.prog >= s.cost) {
      grantTech(c, s.id); c.tech.slots[i] = null; recalcMods(c);
      if (T.fx.slots) c.slotBonus += T.fx.slots;
      if (T.fx.rslot) c.rslot += T.fx.rslot;
      unlockTemplates(c);
      if (!c.ai) logMsg('Исследовано: ' + T.n, c.t, 'good');
      // поколение становится источником качества для новых линий автоматически
    }
  }
}
function unlockTemplates(c) { for (const k of Object.keys(DB.TPL)) if (!c.tpls[k] && tplAllowed(c, DB.TPL[k])) c.tpls[k] = JSON.parse(JSON.stringify(DB.TPL[k])); }

// ---------- доктрины ----------
function takeDoctrine(c, fam, path) {
  const dc = c.docs[fam], D = DB.DOCTRINES[fam], P = D.paths.find(p => p.id === (dc.path || path)); if (!P) return 'Нет пути';
  if (dc.path && dc.path !== path) return 'Уже выбран другой путь';
  const node = P.nodes[dc.n]; if (!node) return 'Путь завершён'; if (c.xp[D.xp] < node.xp) return 'Не хватает опыта';
  c.xp[D.xp] -= node.xp; dc.path = P.id; dc.n++; recalcMods(c); return null;
}

// ---------- законы и советники ----------
function lawCost(c, law, id) { const L = DB.LAWS[law].list.find(x => x.id === id); return L.cost; }
function setLaw(c, law, id) {
  const L = DB.LAWS[law].list.find(x => x.id === id); if (!L) return 'Нет закона'; const cost = L.cost * (1 + mod(c, 'dipl') * 0);
  if (c.pp < cost) return 'Не хватает политической власти'; if (L.war && c.warsup < L.war) return 'Нужна поддержка войны ' + pct(L.war); if (L.wt && G.wt < L.wt && !atWar(c)) return 'Нужна мировая напряжённость ' + L.wt + '%';
  c.pp -= cost; c.laws[law] = id; recalcMods(c); return null;
}
function hireAdvisor(c, id) {
  const A = DB.ADVISORS.find(a => a.id === id); if (!A) return 'Нет такого советника';
  if (c.adv.includes(id)) return 'Уже назначен'; if (c.adv.filter(x => DB.ADVISORS.find(a => a.id === x).slot === A.slot).length >= DB.ADV_SLOTS[A.slot]) return 'Нет свободных мест';
  const cost = DB.ADV_COST[A.slot]; if (c.pp < cost) return 'Не хватает политической власти'; c.pp -= cost; c.adv.push(id); recalcMods(c); return null;
}
function dismissAdvisor(c, id) { c.adv = c.adv.filter(x => x !== id); recalcMods(c); }

// ---------- фокусы ----------
function focusAvailable(c, F) {
  if (c.focus.done.includes(F.id) || c.focus.cur === F.id) return false;
  if (F.ex && F.ex.some(e => c.focus.done.includes(e) || c.focus.cur === e)) return false;
  if (!F.req.length) return true;
  return F.any ? F.req.some(r => c.focus.done.includes(r)) : F.req.every(r => c.focus.done.includes(r));
}
function startFocus(c, id) { const F = DB.FOCUS_MAP[id]; if (!F || c.focus.cur || !focusAvailable(c, F)) return false; c.focus.cur = id; c.focus.prog = 0; return true; }
function focusSpeed(c) { return 1 + mod(c, 'focus'); }
function applyEffect(c, fx) {
  if (!fx) return;
  const add = (k, n, filt) => { for (let i = 0; i < n; i++) { const pool = G.st.filter(s => s && s.ctrl === c.t && s.owner === c.t && (!filt || filt(s))).sort((a, b) => (usedSlots(a) / a.slots) - (usedSlots(b) / b.slots)); const s = pool[0]; if (s) { s[k] = (s[k] || 0) + 1; if (usedSlots(s) > s.slots) s.slots = usedSlots(s); } } updateCountryEcon(c); };
  if (fx.civ) add('civ', fx.civ); if (fx.mil) add('mil', fx.mil);
  if (fx.dock) add('dock', fx.dock, s => M.states.find(x => x.id === s.id).prov.some(p => PROV[p].coastal));
  if (fx.synth) add('synth', fx.synth);
  if (fx.infra) { const cap = stOf(c.capital); if (cap) cap.infra = Math.min(5, cap.infra + fx.infra); for (const s of G.st) if (s && s.owner === c.t && s.infra < 3) s.infra += fx.infra; }
  if (fx.forts) borderProvs(c).forEach(p => { G.fort[p] = Math.min(10, (G.fort[p] || 0) + fx.forts); });
  if (fx.airbases) G.st.filter(s => s && s.owner === c.t && s.mil + s.civ > 1).slice(0, 5).forEach(s => { s.air = Math.min(10, s.air + fx.airbases); });
  if (fx.slots) c.slotBonus += fx.slots; if (fx.rslot) c.rslot += fx.rslot;
  if (fx.xp) for (const k in fx.xp) c.xp[k] += fx.xp[k];
  if (fx.war) c.warsup = clamp(c.warsup + fx.war, 0, 1), c.war += fx.war;
  if (fx.stab) c.stab = clamp(c.stab + fx.stab, 0, 1), c.st += fx.stab;
  if (fx.pop) { for (const k in fx.pop) c.party[k] = (c.party[k] || 0) + fx.pop[k]; normParty(c); }
  if (fx.gov) setGovernment(c, fx.gov);
  if (fx.tech) fx.tech.forEach(t => { grantTech(c, t); }), unlockTemplates(c);
  if (fx.rbonus) c.tech.bonus[fx.rbonus.cat] = Math.max(c.tech.bonus[fx.rbonus.cat] || 0, fx.rbonus.v);
  if (fx.general) for (let i = 0; i < fx.general; i++) c.gens.push(newGeneral(c));
  if (fx.give) for (const k in fx.give) { c.stock[k] = (c.stock[k] || 0) + fx.give[k]; if (DB.EQ[k]?.air) c.planes[k] = (c.planes[k] || 0) + fx.give[k]; }
  if (fx.canFaction) c.canFaction = true;
  if (fx.idea) c.ideas.push(fx.idea);
  recalcMods(c);
}
function normParty(c) { let t = 0; for (const k in c.party) t += c.party[k]; for (const k in c.party) c.party[k] /= t || 1; }
function setGovernment(c, ideo) {
  if (c.i === ideo) return; const was = c.i; c.i = ideo; c.party[ideo] = Math.max(c.party[ideo] || 0, .55); normParty(c); c.l = c.l && c.leaderBy && c.leaderBy[ideo] || 'Новое правительство';
  c.st = clamp(c.st - .05, 0, 1);
  if (c.faction) { const F = G.factions[c.faction]; if (F && F.leader !== c.t && C(F.leader).i !== ideo) leaveFaction(c); }
  logMsg(`${c.n}: смена власти — ${DB.IDEO[ideo].n}`, null, 'info');
}

// ---------- ежедневная политика ----------
function dailyPolitics(c) {
  const base = 2 + mod(c, 'pp');
  c.pp += base * (1 + mod(c, 'pp_mul')) * (c.stab < .4 ? .7 : 1);
  c.pp = Math.min(c.pp, 2000);
  // стабильность и поддержка войны к базовому значению с модификаторами
  const ideoFit = (c.party[c.i] || 0) - .5;
  const stT = clamp(c.st + mod(c, 'stab') + ideoFit * .15 - (atWar(c) ? .05 : 0) - warExhaustion(c), 0, 1);
  c.stab += (stT - c.stab) * .02;
  const wT = clamp(c.war + mod(c, 'warsup') + (atWar(c) ? .1 : 0) + G.wt / 400, 0, 1);
  c.warsup += (wT - c.warsup) * .02;
  // партии медленно тянутся к правящей
  c.party[c.i] += .0002; normParty(c);
  // фокус
  if (c.focus.cur) {
    c.focus.prog += focusSpeed(c); const F = DB.FOCUS_MAP[c.focus.cur];
    if (c.focus.prog >= F.days) { c.focus.done.push(F.id); c.focus.cur = null; c.focus.prog = 0; applyEffect(c, F.fx); if (!c.ai) logMsg('Фокус завершён: ' + F.n, c.t, 'good'); }
  }
  if (c.justify) { c.justify.days--; if (c.justify.days <= 0) { const tg = c.justify.target; c.wargoals = c.wargoals || {}; c.wargoals[tg] = true; G.wt = Math.min(100, G.wt + 1); if (!c.ai) logMsg('Цель войны обоснована: ' + C(tg).n, c.t, 'good'); c.justify = null; } }
}
function warExhaustion(c) { return c.warExh || 0; }

// ---------- зоны ----------
function computeZones() {
  // Воздушные зоны — кластеры штатов
  const seeds = []; const states = M.states.filter(s => s.prov.length); const step = 34;
  const k = Math.round(states.length / 14) + 8; const pts = states.map(s => { let x = 0, y = 0; for (const p of s.prov) { x += PROV[p].x; y += PROV[p].y; } return [x / s.prov.length, y / s.prov.length, s.id]; });
  for (let i = 0; i < k; i++) seeds.push([pts[(i * 37) % pts.length][0], pts[(i * 37) % pts.length][1]]);
  let asg = [];
  for (let it = 0; it < 12; it++) {
    const sum = seeds.map(() => [0, 0, 0]); asg = pts.map(p => { let b = 0, bd = 1e18; seeds.forEach((s, i) => { const d = (p[0] - s[0]) ** 2 + (p[1] - s[1]) ** 2; if (d < bd) { bd = d; b = i; } }); sum[b][0] += p[0]; sum[b][1] += p[1]; sum[b][2]++; return b; });
    seeds.forEach((s, i) => { if (sum[i][2]) { s[0] = sum[i][0] / sum[i][2]; s[1] = sum[i][1] / sum[i][2]; } });
  }
  G.zones = seeds.map((s, i) => ({ id:i, x:s[0], y:s[1], states:[] }));
  asg.forEach((z, i) => { G.zones[z].states.push(pts[i][2]); G.st[pts[i][2]].zone = z; });
  // названия зон по главному городу
  for (const Z of G.zones) { let best = ''; let pop = -1; for (const sid of Z.states) { const s = STATE_BY_ID[sid]; if (s.pop > pop) { pop = s.pop; best = s.name; } } Z.name = best || 'Зона ' + Z.id; }
}

// ---------- ежедневный проход ----------
function dailyAll() {
  for (const t in G.c) { const c = G.c[t]; if (!c.alive && c.alive !== undefined) continue; updateCountryEcon(c); }
  computeStateCtrl();
}
function dailyCountry(c) {
  updateCountryEcon(c);
  dailyProduction(c);
  dailyResearch(c);
  dailyPolitics(c);
  dailyRecruit(c);
  dailyReinforce(c);
}
function computeStateCtrl() {
  for (const st of G.st) {
    if (!st) continue; const s = STATE_BY_ID[st.id]; const cnt = {};
    for (const p of s.prov) cnt[G.ctrl[p]] = (cnt[G.ctrl[p]] || 0) + 1 + (G.vp[p] || 0) * .3;
    let b = st.owner, bv = -1; for (const k in cnt) { if (cnt[k] > bv) { bv = cnt[k]; b = k; } }
    if (b !== st.ctrl) { st.ctrl = b; if (b !== st.owner && !st.cores.includes(b)) st.resist = Math.max(st.resist, 55); }
    if (st.resist > 0) st.resist = Math.max(0, st.resist - .08);
    if (st.bomb > 0) st.bomb = Math.max(0, st.bomb - .5);
  }
}
function borderProvs(c) { return M.prov.filter(P => G.ctrl[P.i] === c.t && P.land.some(a => G.ctrl[a] && G.ctrl[a] !== c.t)).map(P => P.i); }
