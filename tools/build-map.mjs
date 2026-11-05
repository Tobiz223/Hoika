// Собирает карту Европы 1936 года: id-текстуру провинций, спутниковую подложку и данные.
// Запуск: node build-map.mjs <папка_с_исходниками>  (GeoJSON Natural Earth, Blue Marble, тайлы высот)
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SRC = process.argv[2];
const OUT = path.resolve(import.meta.dirname, '../data');
fs.mkdirSync(OUT, { recursive: true });

const W = 4096, H = 3516, KM = 1.294, LON0 = 18, LAT0 = 52, R = 6371;
const X0 = -2400, Y1 = 2300; // км: левый край и верхний край
const D = Math.PI / 180;
const sin0 = Math.sin(LAT0 * D), cos0 = Math.cos(LAT0 * D);
function proj(lon, lat) {
  const l = (lon - LON0) * D, p = lat * D;
  const k = Math.sqrt(2 / (1 + sin0 * Math.sin(p) + cos0 * Math.cos(p) * Math.cos(l)));
  const x = R * k * Math.cos(p) * Math.sin(l);
  const y = R * k * (cos0 * Math.sin(p) - sin0 * Math.cos(p) * Math.cos(l));
  return [(x - X0) / KM, (Y1 - y) / KM];
}
function unproj(px, py) {
  const x = (px * KM + X0) / R, y = (Y1 - py * KM) / R;
  const rho = Math.hypot(x, y);
  if (rho < 1e-9) return [LON0, LAT0];
  const c = 2 * Math.asin(rho / 2), sc = Math.sin(c), cc = Math.cos(c);
  return [LON0 + Math.atan2(x * sc, rho * cos0 * cc - y * sin0 * sc) / D, Math.asin(cc * sin0 + y * sc * cos0 / rho) / D];
}
const load = f => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));

function fill(ring_list, cb) {
  // even-odd заливка набора колец в пиксельных координатах
  let ymin = 1e9, ymax = -1e9;
  for (const r of ring_list) for (const p of r) { if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1]; }
  ymin = Math.max(0, Math.floor(ymin)); ymax = Math.min(H - 1, Math.ceil(ymax));
  const buckets = new Map();
  for (const r of ring_list) for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    if (a[1] === b[1]) continue;
    const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
    for (let y = Math.max(ymin, Math.ceil(lo - 0.5)); y <= ymax && y + 0.5 < hi; y++) {
      if (y + 0.5 < lo) continue;
      const x = a[0] + (y + 0.5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]);
      let s = buckets.get(y); if (!s) buckets.set(y, s = []); s.push(x);
    }
  }
  for (const [y, s] of buckets) {
    s.sort((p, q) => p - q);
    for (let i = 0; i + 1 < s.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(s[i] - 0.5)), x1 = Math.min(W - 1, Math.floor(s[i + 1] - 0.5));
      for (let x = x0; x <= x1; x++) cb(x + y * W);
    }
  }
}
function polys(g) { return g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; }
function inRegion(poly) {
  let n = 0;
  for (const c of poly[0]) if (c[0] > -36 && c[0] < 78 && c[1] > 24 && c[1] < 80) { n++; break; }
  return n > 0;
}
const projRings = poly => poly.map(r => r.map(c => proj(c[0], c[1])));

// ---------- владельцы 1936 ----------
const OWNER = { ALB:'ALB',AND:'FRA',AUT:'AUS',BEL:'BEL',BGR:'BUL',BIH:'YUG',BLR:'SOV',CHE:'SWI',CYP:'ENG',CYN:'ENG',CZE:'CZE',DEU:'GER',DNK:'DEN',ESP:'SPA',EST:'EST',FIN:'FIN',FRA:'FRA',GBR:'ENG',GRC:'GRE',HRV:'YUG',HUN:'HUN',IRL:'IRE',ISL:'ICE',ITA:'ITA',KOS:'YUG',LIE:'SWI',LTU:'LIT',LUX:'LUX',LVA:'LAT',MCO:'FRA',MDA:'ROM',MKD:'YUG',MLT:'ENG',MNE:'YUG',NLD:'HOL',NOR:'NOR',POL:'POL',PRT:'POR',ROU:'ROM',RUS:'SOV',SRB:'YUG',SMR:'ITA',SVK:'CZE',SVN:'YUG',SWE:'SWE',TUR:'TUR',UKR:'SOV',VAT:'ITA',ARM:'SOV',GEO:'SOV',AZE:'SOV',KAZ:'SOV',UZB:'SOV',TKM:'SOV' };
const NAME_OWNER = { 'POL:Lower Silesian':'GER','POL:Opole':'GER','POL:Lubusz':'GER','POL:West Pomeranian':'GER','POL:Warmian-Masurian':'GER','RUS:Kaliningrad':'GER','UKR:Transcarpathia':'CZE','UKR:Chernivtsi':'ROM','BGR:Dobrich':'ROM','BGR:Silistra':'ROM','HRV:Istarska':'ITA','HRV:Primorsko-Goranska':'ITA' };
const NAME_RU = { 'RUS:Kaliningrad':'Восточная Пруссия','POL:West Pomeranian':'Померания','POL:Lower Silesian':'Нижняя Силезия','POL:Opole':'Верхняя Силезия','POL:Lubusz':'Бранденбург-Ост','POL:Warmian-Masurian':'Мазурия','UKR:Transcarpathia':'Подкарпатская Русь','UKR:Chernivtsi':'Буковина','BGR:Dobrich':'Южная Добруджа','HRV:Istarska':'Истрия' };
const SINGLE = { BIH:'Босния', SVN:'Словения', MKD:'Вардарская Македония', KOS:'Косово', MDA:'Бессарабия', MLT:'Мальта', AZE:'Азербайджан', LIE:'Лихтенштейн', AND:'Андорра', LUX:'Люксембург', ARM:'Армения', GEO:'Грузия', CYN:'Кипр', CYP:'Кипр', MCO:'Монако', VAT:'Лацио', SMR:'Сан-Марино' };
const REGION_RU = {
  'Northern Ireland':'Северная Ирландия','West Wales and the Valleys':'Уэльс','East Wales':'Восточный Уэльс','North West':'Северо-Запад Англии','West Midlands':'Западный Мидленд','South West':'Юго-Запад Англии','Eastern':'Восточная Шотландия','North East':'Нортумбрия','South Western':'Юго-Западная Шотландия','Yorkshire and the Humber':'Йоркшир','East Midlands':'Восточный Мидленд','East':'Восточная Англия','South East':'Юго-Восток Англии','Highlands and Islands':'Хайленд','North Eastern':'Абердиншир','Greater London':'Лондон',
  'Valle d\'Aosta':'Аоста','Piemonte':'Пьемонт','Lombardia':'Ломбардия','Trentino-Alto Adige':'Южный Тироль','Liguria':'Лигурия','Emilia-Romagna':'Эмилия-Романья','Marche':'Марке','Veneto':'Венето','Friuli-Venezia Giulia':'Фриули','Abruzzo':'Абруцци','Molise':'Молизе','Apulia':'Апулия','Basilicata':'Базиликата','Calabria':'Калабрия','Campania':'Кампания','Lazio':'Лацио','Toscana':'Тоскана','Sicily':'Сицилия','Sardegna':'Сардиния','Umbria':'Умбрия',
  'Foral de Navarra':'Наварра','País Vasco':'Страна Басков','Aragón':'Арагон','Cataluña':'Каталония','Extremadura':'Эстремадура','Andalucía':'Андалусия','Galicia':'Галисия','Castilla y León':'Старая Кастилия','Valenciana':'Валенсия','Murcia':'Мурсия','Asturias':'Астурия','Cantabria':'Кантабрия','Islas Baleares':'Балеарские острова','La Rioja':'Риоха','Castilla-La Mancha':'Новая Кастилия','Madrid':'Мадрид',
  'Alentejo':'Алентежу','Norte':'Северная Португалия','Centro':'Центральная Португалия','Algarve':'Алгарве','Lisbon':'Лиссабон','Norte, Centro':'Северная Португалия',
  'Vidzeme':'Видземе','Riga':'Рига','Latgale':'Латгале','Zemgale':'Земгале','Kurzeme':'Курземе' };
const REGION_MODE = new Set(['GBR','ITA','ESP','PRT','LVA']);

// Ручные полигоны 1936 года (lon,lat). on — кто подлежит замене.
const OVERRIDES = [
  { owner:'POL', name:'Кресы: Полесье', on:['SOV'], poly:[[22,54.6],[27.0,55.8],[28.2,55.1],[27.2,54.2],[26.8,53.5],[27.6,52.7],[27.6,51.6],[22,51.6]] },
  { owner:'POL', name:'Кресы: Волынь', on:['SOV'], poly:[[22,51.6],[27.6,51.6],[27.3,50.6],[26.6,50.3],[26.3,49.5],[26.2,48.5],[22,48.5]] },
  { owner:'POL', name:'Виленщина', on:['LIT'], poly:[[23.6,54.1],[24.9,54.85],[25.0,55.15],[26.0,55.75],[27.2,55.6],[27,53.9]] },
  { owner:'GER', name:'Задняя Померания', on:['POL'], poly:[[15.9,54.9],[17.85,54.9],[17.45,53.9],[17.1,53.2],[16.0,52.9],[15.3,53.0]] },
  { owner:'GER', name:'Данциг', on:['POL'], nomerge:true, poly:[[18.35,54.5],[18.95,54.5],[19.4,54.45],[19.25,54.1],[18.5,54.1]] },
  { owner:'GER', name:'Глейвиц', on:['POL'], poly:[[18.0,50.75],[18.85,50.5],[18.8,50.2],[18.15,49.95],[17.9,50.2]] },
  { owner:'GER', name:'Позен-Вест', on:['POL'], poly:[[15.5,53.2],[17.1,53.2],[16.4,52.3],[16.0,51.9],[15.2,52.0]] },
  { owner:'ROM', name:'Буджак', on:['SOV'], poly:[[28.1,45.3],[29.9,45.1],[30.8,46.1],[30.1,46.45],[28.9,46.5],[28.2,46]] },
  { owner:'SOV', name:'Приднестровье', on:['ROM'], poly:[[27.7,48.45],[28.2,48.1],[28.95,47.6],[29.2,47.05],[30.15,46.4],[30.6,47.8],[28.7,48.7]] },
  { owner:'FIN', name:'Выборг', on:['SOV'], poly:[[27.5,60.4],[29.1,60.12],[30.05,60.1],[31.1,60.3],[32.9,61.25],[31.4,62.65],[31.6,63.1],[30.5,63.2],[29,61.8],[27.5,61]] },
  { owner:'FIN', name:'Петсамо', on:['SOV'], poly:[[28.3,68.9],[29.2,69.0],[31.6,69.75],[31.6,70.3],[28.5,70.3],[28.2,69.6]] },
  { owner:'ITA', name:'Юлийская Крайна', on:['YUG'], poly:[[13.3,46.45],[14.15,46.45],[14.5,45.75],[14.6,45.3],[14.3,45.2],[13.45,45.45],[13.3,45.8]] },
  { owner:'ITA', name:'Додеканес', on:['GRE'], poly:[[26.4,37.5],[28.5,37.1],[28.5,35.7],[26.5,35.7]] },
  { owner:'CZE', name:'Судеты', on:['CZE'], nomerge:true, sudeten:true, poly:[[12.0,50.4],[12.2,50.35],[13.4,50.8],[14.3,51.15],[15.2,51.05],[16.3,50.65],[17.2,50.45],[18.4,50.05],[17.95,49.75],[17,49.95],[16,50.15],[15.2,50.55],[14.2,50.6],[13.4,50.2],[13.1,49.6],[13.9,48.95],[12.6,48.95],[12.0,49.7]] },
  { owner:'CZE', name:'Южные Судеты', on:['CZE'], nomerge:true, sudeten:true, poly:[[13.7,48.95],[14.8,49.1],[15.6,49.0],[16.8,48.95],[17,48.55],[14.5,48.5],[13.7,48.6]] },
];
const MARSH = [ [[24,52.2],[29,52.5],[29.5,51.5],[24.5,51.2]], [[20.5,53.7],[23,53.7],[23,53],[20.5,53]] ];

const SEAS = [
 ['Норвежское море (север)',0,70],['Норвежское море',4,65],['Баренцево море',38,72],['Кольский залив',36,69.8],['Белое море',38,65.5],['Датский пролив',-22,68],['Исландская впадина',-16,61],['Северная Атлантика',-30,58],['Атлантика: Роколл',-14,55],['Фарерский рубеж',-6,62],['Северное море (север)',2,60],['Северное море (центр)',3,56.5],['Северное море (юг)',3,53.3],['Скагеррак',10,58],['Каттегат',11.3,56.8],['Датские проливы',12.5,55],['Балтика (запад)',15,55.2],['Балтика (центр)',19,56.7],['Рижский залив',23,57.8],['Финский залив',26,59.8],['Ботнический залив',20,62],['Ботническое море',23,65],['Ирландское море',-4.8,53.5],['Кельтское море',-7.5,50.5],['Ла-Манш',-1,50],['Западные подходы',-13,48],['Бискайский залив',-5,45.5],['Атлантика: Азоры',-20,43],['Атлантика: Иберия',-13,39],['Кадисский залив',-8,36],['Атлантика: Марокко',-16,32],['Гибралтар',-4,36],['Море Альборан',-1,36.8],['Балеарское море',3,40],['Лионский залив',5,42.5],['Лигурийское море',9,43.6],['Тирренское море',12,40],['Алжирское побережье',4,37.5],['Сицилийский пролив',11.5,36.8],['Ионическое море (север)',18,38.5],['Адриатика (север)',14,44],['Адриатика (юг)',17.5,41.5],['Ионическое море (юг)',19,35],['Залив Сидра',16,32],['Левантийский бассейн',28,33.5],['Эгейское море (север)',25,39.5],['Эгейское море (юг)',25.2,36.8],['Критское море',24,34],['Кипрские воды',33,35],['Левант',35,33],['Мраморное море',28,40.7],['Чёрное море (запад)',30,43.5],['Чёрное море (центр)',34,43],['Чёрное море (восток)',38.5,42.5],['Азовское море',37,46],['Каспий (север)',50,44.5],['Каспий (юг)',51,39.5],['Атлантика: Канары',-25,28] ];

// ---------- растеризация ----------
console.time('raster');
const unit = new Int32Array(W * H);      // 0 море, -1 мёртвая земля, -2 озеро, >0 индекс единицы
const units = [null];
const adm0 = load('ne_10m_admin_0_countries.geojson');
for (const f of adm0.features) for (const poly of polys(f.geometry)) if (inRegion(poly)) fill(projRings(poly), i => { unit[i] = -1; });
// Территории без адм. деления (например Северный Кипр) получаем из admin0
for (const f of adm0.features) {
  const a = f.properties.ADM0_A3;
  if (!['CYN'].includes(a)) continue;
  units.push({ a, name:'Кипр', ru:'Кипр', owner:OWNER[a], group:'S:'+a });
  for (const poly of polys(f.geometry)) fill(projRings(poly), i => { unit[i] = units.length - 1; });
}
const adm1 = load('ne_10m_admin_1_states_provinces.geojson');
for (const f of adm1.features) {
  const p = f.properties, a = p.adm0_a3, key = a + ':' + p.name;
  if (!OWNER[a]) continue;
  const ps = polys(f.geometry).filter(inRegion);
  if (!ps.length) continue;
  const owner = NAME_OWNER[key] || OWNER[a];
  let group, ru = NAME_RU[key] || p.name_ru || p.name_en || p.name;
  if (SINGLE[a] && !NAME_OWNER[key]) { group = 'S:' + a; ru = SINGLE[a]; }
  else if (REGION_MODE.has(a) && !NAME_OWNER[key]) { group = 'R:' + a + ':' + p.region; ru = REGION_RU[p.region] || p.region || ru; }
  else group = 'U:' + key;
  units.push({ a, name:p.name, ru, owner, group });
  const id = units.length - 1;
  for (const poly of ps) fill(projRings(poly), i => { unit[i] = id; });
}
console.log('units', units.length);
for (const [i, o] of OVERRIDES.entries()) {
  units.push({ a:'OVR', name:o.name, ru:o.name, owner:o.owner, group:'O:' + i, nomerge:o.nomerge, sudeten:o.sudeten, on:o.on });
  const id = units.length - 1, on = new Set(o.on);
  fill([o.poly.map(c => proj(c[0], c[1]))], k => { const u = unit[k]; if (u > 0 && on.has(units[u].owner)) unit[k] = id; });
}
for (const f of load('ne_10m_lakes.geojson').features) {
  if (f.properties.scalerank > 5) continue;
  for (const poly of polys(f.geometry)) if (inRegion(poly)) fill(projRings(poly), i => { if (unit[i] !== 0) unit[i] = -2; });
}
console.timeEnd('raster');

// ---------- штаты: группировка и слияние мелких ----------
const groupId = new Map(); let states = [null];
for (let u = 1; u < units.length; u++) {
  const U = units[u], key = U.owner + '|' + U.group;
  if (!groupId.has(key)) { groupId.set(key, states.length); states.push({ owner:U.owner, names:{}, area:0, nomerge:!!U.nomerge, sudeten:!!U.sudeten, parent:0 }); }
  U.st = groupId.get(key);
}
const sidOf = new Int32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const u = unit[i];
  if (u > 0) { const s = units[u].st; sidOf[i] = s; states[s].area++; states[s].names[units[u].ru] = (states[s].names[units[u].ru] || 0) + 1; }
}
const find = s => { while (states[s].parent) s = states[s].parent; return s; };
const MIN_PX = o => ({ SOV:26000, TUR:20000, SWE:16000, NOR:16000, FIN:16000, GER:14000, FRA:14000, POL:15000 }[o] || 11000) / (KM * KM);
function stateAdj() {
  const adj = new Map();
  const add = (a, b) => { if (!adj.has(a)) adj.set(a, new Map()); const m = adj.get(a); m.set(b, (m.get(b) || 0) + 1); };
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const i = x + y * W; const a = sidOf[i]; if (!a) continue;
    const A = find(a);
    for (const j of [i + 1, i + W]) { const b = sidOf[j]; if (b && b !== a) { const B = find(b); if (A !== B) { add(A, B); add(B, A); } } }
  }
  return adj;
}
for (let pass = 0; pass < 6; pass++) {
  const adj = stateAdj(); let merged = 0;
  const order = [...Array(states.length).keys()].slice(1).filter(s => !states[s].parent && states[s].area > 0).sort((a, b) => states[a].area - states[b].area);
  for (const s of order) {
    const S = states[s]; if (S.parent || S.nomerge || S.area >= MIN_PX(S.owner)) continue;
    let best = 0, bv = 1e18;
    for (const [n, len] of adj.get(s) || []) {
      const t = find(n), T = states[t];
      if (t === s || T.owner !== S.owner || T.nomerge) continue;
      const v = T.area / Math.sqrt(len);
      if (v < bv) { bv = v; best = t; }
    }
    if (best) { const T = states[best]; T.area += S.area; for (const k in S.names) T.names[k] = (T.names[k] || 0) + S.names[k]; S.parent = best; merged++; }
  }
  if (!merged) break;
}
// крошечные изолированные штаты присоединяем к ближайшему своему
const finalIdx = new Map(); const ST = [null];
function stateCenters() {
  const c = new Map();
  for (let i = 0; i < W * H; i++) { const a = sidOf[i]; if (!a) continue; const f = find(a); let e = c.get(f); if (!e) c.set(f, e = [0, 0, 0]); e[0] += i % W; e[1] += (i / W) | 0; e[2]++; }
  return c;
}
let centers = stateCenters();
for (const [s, c] of centers) if (c[2] < 1500 / (KM * KM) && !states[s].nomerge) {
  let best = 0, bd = 1e18; const cx = c[0] / c[2], cy = c[1] / c[2];
  for (const [t, d] of centers) if (t !== s && states[t].owner === states[s].owner && d[2] >= 1500 / (KM * KM)) { const v = (d[0] / d[2] - cx) ** 2 + (d[1] / d[2] - cy) ** 2; if (v < bd) { bd = v; best = t; } }
  if (best) { states[s].parent = best; states[best].area += states[s].area; }
}
for (let s = 1; s < states.length; s++) { const S = states[s]; if (S.parent || !S.area) continue; finalIdx.set(s, ST.length); const nm = Object.entries(S.names).sort((a, b) => b[1] - a[1])[0][0]; ST.push({ id:ST.length, owner:S.owner, name:nm, area:0, sudeten:S.sudeten || undefined, prov:[] }); }
for (let i = 0; i < W * H; i++) { const a = sidOf[i]; sidOf[i] = a ? finalIdx.get(find(a)) : 0; }
console.log('states', ST.length - 1);

// ---------- провинции: k-means с шумом внутри штата ----------
function noise2(x, y) { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), f = x - xi, g = y - yi, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g); const a = noise2(xi, yi), b = noise2(xi + 1, yi), c = noise2(xi, yi + 1), d = noise2(xi + 1, yi + 1); return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v; }
const warpX = (x, y) => x + (vnoise(x / 40, y / 40) - .5) * 48 + (vnoise(x / 11, y / 11) - .5) * 14;
const warpY = (x, y) => y + (vnoise(x / 40 + 91, y / 40 + 37) - .5) * 48 + (vnoise(x / 11 + 7, y / 11 + 3) - .5) * 14;
const TARGET = o => ({ SOV:16000, TUR:12000, SWE:11000, NOR:11000, FIN:11000, SPA:8000, ICE:30000 }[o] || 5600) / (KM * KM);
const pid = new Int32Array(W * H);
const stPixels = ST.map(() => []);
for (let i = 0; i < W * H; i++) if (sidOf[i]) stPixels[sidOf[i]].push(i);
const PR = [null];
for (let s = 1; s < ST.length; s++) {
  const px = stPixels[s]; const n = Math.max(1, Math.round(px.length / TARGET(ST[s].owner)));
  const xs = new Float32Array(px.length), ys = new Float32Array(px.length);
  for (let k = 0; k < px.length; k++) { const x = px[k] % W, y = (px[k] / W) | 0; xs[k] = warpX(x, y); ys[k] = warpY(x, y); }
  const cen = [];
  // farthest-point seeding
  let idx = 0; { let sx = 0, sy = 0; for (let k = 0; k < px.length; k++) { sx += xs[k]; sy += ys[k]; } sx /= px.length; sy /= px.length; let b = 1e18; for (let k = 0; k < px.length; k++) { const d = (xs[k] - sx) ** 2 + (ys[k] - sy) ** 2; if (d < b) { b = d; idx = k; } } }
  cen.push([xs[idx], ys[idx]]);
  const md = new Float32Array(px.length).fill(1e18);
  while (cen.length < n) { const c = cen[cen.length - 1]; let far = 0, fv = -1; for (let k = 0; k < px.length; k += 3) { const d = (xs[k] - c[0]) ** 2 + (ys[k] - c[1]) ** 2; if (d < md[k]) md[k] = d; if (md[k] > fv) { fv = md[k]; far = k; } } cen.push([xs[far], ys[far]]); }
  const asg = new Int32Array(px.length);
  for (let it = 0; it < 8; it++) {
    const sum = cen.map(() => [0, 0, 0]);
    for (let k = 0; k < px.length; k++) { let b = 0, bd = 1e18; for (let c = 0; c < n; c++) { const d = (xs[k] - cen[c][0]) ** 2 + (ys[k] - cen[c][1]) ** 2; if (d < bd) { bd = d; b = c; } } asg[k] = b; sum[b][0] += xs[k]; sum[b][1] += ys[k]; sum[b][2]++; }
    for (let c = 0; c < n; c++) if (sum[c][2]) cen[c] = [sum[c][0] / sum[c][2], sum[c][1] / sum[c][2]];
  }
  const base = PR.length;
  for (let c = 0; c < n; c++) PR.push({ id:PR.length, st:s });
  for (let k = 0; k < px.length; k++) pid[px[k]] = base + asg[k];
}
// отделяем крупные изолированные куски (острова) в свои провинции
{
  const seen = new Uint8Array(W * H), stack = new Int32Array(W * H);
  const byProv = new Map();
  for (let i = 0; i < W * H; i++) {
    if (!pid[i] || seen[i]) continue;
    const p = pid[i]; let sp = 0, cnt = 0; stack[sp++] = i; seen[i] = 1; const pix = [];
    while (sp) { const c = stack[--sp]; pix.push(c); cnt++; for (const n of [c - 1, c + 1, c - W, c + W]) { if (n >= 0 && n < W * H && !seen[n] && pid[n] === p) { seen[n] = 1; stack[sp++] = n; } } }
    let e = byProv.get(p); if (!e) byProv.set(p, e = []); e.push(pix);
  }
  for (const [p, comps] of byProv) {
    comps.sort((a, b) => b.length - a.length);
    for (let c = 1; c < comps.length; c++) {
      const comp = comps[c];
      // сосед той же области?
      const nb = new Map();
      for (const i of comp) for (const n of [i - 1, i + 1, i - W, i + W]) { if (n >= 0 && n < W * H && pid[n] && pid[n] !== p && PR[pid[n]].st === PR[p].st) nb.set(pid[n], (nb.get(pid[n]) || 0) + 1); }
      if (nb.size) { const t = [...nb.entries()].sort((a, b) => b[1] - a[1])[0][0]; for (const i of comp) pid[i] = t; }
      else if (comp.length > 180) { const id = PR.length; PR.push({ id, st:PR[p].st }); for (const i of comp) pid[i] = id; }
    }
  }
}
const LAND_N = PR.length - 1;
console.log('land provinces', LAND_N);

// ---------- морские зоны ----------
const seaSeeds = SEAS.map(s => proj(s[1], s[2]));
const seaBase = PR.length;
SEAS.forEach((s, k) => PR.push({ id:seaBase + k, sea:true, name:s[0] }));
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = x + y * W; if (unit[i] !== 0) continue;
  const X = x + (vnoise(x / 90, y / 90) - .5) * 90, Y = y + (vnoise(x / 90 + 5, y / 90 + 9) - .5) * 90;
  let b = 0, bd = 1e18;
  for (let k = 0; k < seaSeeds.length; k++) { const d = (X - seaSeeds[k][0]) ** 2 + (Y - seaSeeds[k][1]) ** 2; if (d < bd) { bd = d; b = k; } }
  pid[i] = seaBase + b;
}

// ---------- реки ----------
const riverMask = new Uint8Array(W * H);
const riverLines = [];
for (const f of load('ne_10m_rivers_lake_centerlines.geojson').features) {
  if (f.properties.scalerank > 6) continue;
  const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [];
  for (const l of lines) {
    if (!l.some(c => c[0] > -15 && c[0] < 65 && c[1] > 30 && c[1] < 72)) continue;
    const pts = l.map(c => proj(c[0], c[1])); riverLines.push({ pts, r:f.properties.scalerank });
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; const n = Math.ceil(Math.hypot(bx - ax, by - ay)) + 1;
      for (let t = 0; t <= n; t++) { const x = Math.round(ax + (bx - ax) * t / n), y = Math.round(ay + (by - ay) * t / n); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const k = x + dx + (y + dy) * W; if (k >= 0 && k < W * H) riverMask[k] = 1; } }
    }
  }
}

// ---------- смежность ----------
const adjM = new Map();
for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
  const i = x + y * W, a = pid[i]; if (!a) continue;
  for (const j of [i + 1, i + W]) {
    const b = pid[j]; if (!b || a === b) continue;
    const k = a < b ? a * 100000 + b : b * 100000 + a; let e = adjM.get(k); if (!e) adjM.set(k, e = [0, 0]); e[0]++; if (riverMask[i]) e[1]++;
  }
}
// ---------- высоты ----------
const DEM_X0 = 12, DEM_Y0 = 7, DEM_NX = 11, DEM_NY = 7, DS = 256;
const dem = new Float32Array(DEM_NX * DS * DEM_NY * DS);
for (let tx = 0; tx < DEM_NX; tx++) for (let ty = 0; ty < DEM_NY; ty++) {
  const { data, info } = await sharp(path.join(SRC, 'dem', `${tx + DEM_X0}_${ty + DEM_Y0}.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < DS; y++) for (let x = 0; x < DS; x++) { const q = (x + y * DS) * info.channels; dem[tx * DS + x + (ty * DS + y) * DEM_NX * DS] = data[q] * 256 + data[q + 1] + data[q + 2] / 256 - 32768; }
}
function elev(lon, lat) {
  const n = 32, X = (lon + 180) / 360 * n, Y = (1 - Math.log(Math.tan(lat * D) + 1 / Math.cos(lat * D)) / Math.PI) / 2 * n;
  const x = Math.floor((X - DEM_X0) * DS), y = Math.floor((Y - DEM_Y0) * DS);
  if (x < 0 || y < 0 || x >= DEM_NX * DS || y >= DEM_NY * DS) return 0;
  return dem[x + y * DEM_NX * DS];
}
// ---------- спутниковая подложка ----------
console.time('sat');
const SATW = 12000, SATH = 5672, sat = Buffer.alloc(SATW * SATH * 3);
for (let q = 0; q < 4; q++) {
  const { data } = await sharp(path.join(SRC, `bm${q}.jpg`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ox = q % 2 ? 6000 : 0, oy = q > 1 ? 2836 : 0;
  for (let y = 0; y < 2836; y++) data.copy(sat, (ox + (oy + y) * SATW) * 3, y * 6000 * 3, (y + 1) * 6000 * 3);
}
function satAt(lon, lat, out) {
  const fx = (lon + 35) / 110 * SATW - .5, fy = (76 - lat) / 52 * SATH - .5;
  const x = Math.max(0, Math.min(SATW - 2, Math.floor(fx))), y = Math.max(0, Math.min(SATH - 2, Math.floor(fy))), u = Math.max(0, Math.min(1, fx - x)), v = Math.max(0, Math.min(1, fy - y));
  for (let c = 0; c < 3; c++) {
    const a = sat[(x + y * SATW) * 3 + c], b = sat[(x + 1 + y * SATW) * 3 + c], d = sat[(x + (y + 1) * SATW) * 3 + c], e = sat[(x + 1 + (y + 1) * SATW) * 3 + c];
    out[c] = (a * (1 - u) + b * u) * (1 - v) + (d * (1 - u) + e * u) * v;
  }
}
const base = Buffer.alloc(W * H * 3);
const pel = new Map(); const col = [0, 0, 0];
const landKm = LAND_N;
const stat = Array.from({ length: PR.length }, () => ({ n:0, sx:0, sy:0, e:0, e2:0, green:0, snow:0 }));
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = x + y * W; const [lon, lat] = unproj(x + .5, y + .5);
  satAt(lon, lat, col);
  let r = col[0], g = col[1], b = col[2]; const p = pid[i], u = unit[i];
  if (p > 0 && p <= LAND_N) {
    const s = stat[p]; s.n++; s.sx += x; s.sy += y;
    if ((x & 3) === 0 && (y & 3) === 0) { const e = elev(lon, lat); s.e += e; s.e2 += e * e; if (g > r * 1.02 && g < 85) s.green++; }
  } else if (p > LAND_N) { const s = stat[p]; s.n++; s.sx += x; s.sy += y; }
  if (p > LAND_N || u === -2) { const k = .55; r = r * k + 8; g = g * k + 20; b = b * k + 38; }
  else if (u === -1) { const l = (r + g + b) / 3; r = l * .45 + 34; g = l * .45 + 32; b = l * .45 + 30; }
  const q = i * 3; base[q] = Math.min(255, r); base[q + 1] = Math.min(255, g); base[q + 2] = Math.min(255, b);
}
console.timeEnd('sat');
// реки подложки
for (const { pts, r } of riverLines) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; const n = Math.ceil(Math.hypot(bx - ax, by - ay)) + 1;
    for (let t = 0; t <= n; t++) {
      const x = Math.round(ax + (bx - ax) * t / n), y = Math.round(ay + (by - ay) * t / n), k = x + y * W; if (k < 0 || k >= W * H || pid[k] === 0 || pid[k] > LAND_N) continue;
      const q = k * 3; base[q] = base[q] * .45 + 30 * .55; base[q + 1] = base[q + 1] * .45 + 70 * .55; base[q + 2] = base[q + 2] * .45 + 110 * .55;
    }
  }
}
await sharp(base, { raw:{ width:W, height:H, channels:3 } }).jpeg({ quality:72, mozjpeg:true }).toFile(path.join(OUT, 'base.jpg'));
// id-карта
const idb = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) { const p = pid[i]; idb[i * 3] = p & 255; idb[i * 3 + 1] = p >> 8; idb[i * 3 + 2] = 0; }
await sharp(idb, { raw:{ width:W, height:H, channels:3 } }).png({ compressionLevel:9, palette:false }).toFile(path.join(OUT, 'prov.png'));

// ---------- города ----------
const RENAME = { 'Wroclaw':'Бреслау','Wrocław':'Бреслау','Gdansk':'Данциг','Gdańsk':'Данциг','Szczecin':'Штеттин','Kaliningrad':'Кёнигсберг','Volgograd':'Сталинград','Saint Petersburg':'Ленинград','St. Petersburg':'Ленинград','Nizhny Novgorod':'Горький','Samara':'Куйбышев','Yekaterinburg':'Свердловск','Vilnius':'Вильно','Tbilisi':'Тифлис','Istanbul':'Стамбул','Olsztyn':'Алленштайн','Kyiv':'Киев','Kiev':'Киев','Dnipro':'Днепропетровск','Lviv':"Львов",'Donetsk':'Сталино','Perm':'Молотов','Klaipeda':'Мемель','Bratislava':'Братислава','Ljubljana':'Любляна','Tallinn':'Таллин','Oslo':'Осло','Dublin':'Дублин','Tirana':'Тирана','Skopje':'Скопье','Sarajevo':'Сараево','Podgorica':'Титоград','Zagreb':'Загреб' };
const cities = [];
for (const f of load('ne_10m_populated_places.geojson').features) {
  const P = f.properties, [lon, lat] = f.geometry.coordinates;
  if (lon < -30 || lon > 75 || lat < 26 || lat > 76) continue;
  const [x, y] = proj(lon, lat); const X = Math.round(x), Y = Math.round(y);
  if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
  // ищем ближайшую сухопутную провинцию в малом радиусе
  let pp = 0; for (let r = 0; r <= 6 && !pp; r++) for (let dy = -r; dy <= r && !pp; dy++) for (let dx = -r; dx <= r; dx++) { const k = X + dx + (Y + dy) * W; if (k >= 0 && k < W * H && pid[k] > 0 && pid[k] <= LAND_N) { pp = pid[k]; break; } }
  if (!pp) continue;
  const pop = P.POP_MAX || 0, cap = P.ADM0CAP === 1;
  if (pop < 60000 && !cap) continue;
  cities.push({ n:RENAME[P.NAME] || RENAME[P.NAMEASCII] || P.NAME_RU || P.NAME, x:X, y:Y, p:pp, pop, cap:cap ? 1 : 0, lon, lat, en:P.NAME });
}
cities.sort((a, b) => b.pop - a.pop);

// ---------- данные провинций ----------
const cityByProv = new Map(); for (const c of cities) if (!cityByProv.has(c.p)) cityByProv.set(c.p, c);
for (let p = 1; p < PR.length; p++) {
  const P = PR[p], s = stat[p];
  P.x = Math.round(s.sx / Math.max(1, s.n)); P.y = Math.round(s.sy / Math.max(1, s.n)); P.a = Math.round(s.n * KM * KM); P.adj = []; P.riv = [];
}
const best = new Float64Array(PR.length).fill(1e18), bx = new Int32Array(PR.length), by = new Int32Array(PR.length);
for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { const p = pid[x + y * W]; if (!p) continue; const d = (x - PR[p].x) ** 2 + (y - PR[p].y) ** 2; if (d < best[p]) { best[p] = d; bx[p] = x; by[p] = y; } }
for (let p = 1; p < PR.length; p++) { if (best[p] < 1e17) { PR[p].x = bx[p]; PR[p].y = by[p]; } }
for (const [k, e] of adjM) {
  const a = Math.floor(k / 100000), b = k % 100000; if (e[0] < 2) continue;
  PR[a].adj.push(b); PR[b].adj.push(a);
  if (a <= LAND_N && b <= LAND_N && e[1] / e[0] > .3) { PR[a].riv.push(b); PR[b].riv.push(a); }
}
const inPoly = (poly, lon, lat) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { if ((poly[i][1] > lat) !== (poly[j][1] > lat) && lon < (poly[j][0] - poly[i][0]) * (lat - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c; } return c; };
const provOut = [];
for (let p = 1; p <= LAND_N; p++) {
  const P = PR[p], s = stat[p], n = Math.max(1, s.n / 16); const m = s.e / n, sd = Math.sqrt(Math.max(0, s.e2 / n - m * m)); const gr = s.green / n;
  const [lon, lat] = unproj(P.x, P.y); let t = 'plains';
  if (sd > 330 || m > 1500) t = 'mountain'; else if (sd > 130 || m > 650) t = 'hills'; else if (gr > .78) t = "forest";
  if (MARSH.some(q => inPoly(q, lon, lat))) t = 'marsh';
  if (lat < 38.5 && t === 'plains' && lon > 30) t = 'desert';
  const c = cityByProv.get(p); if (c && c.pop >= 750000) t = 'urban';
  if (P.st) ST[P.st].prov.push(p);
  provOut.push({ i:p, s:P.st, x:P.x, y:P.y, a:P.a, t, adj:P.adj, riv:P.riv.length ? P.riv : undefined, lat:+lat.toFixed(1) });
}
for (let s = 1; s < ST.length; s++) { ST[s].area = ST[s].prov.reduce((v, p) => v + PR[p].a, 0); ST[s].pop = cities.filter(c => PR[c.p].st === s).reduce((v, c) => v + c.pop, 0); }
const seaOut = []; for (let p = LAND_N + 1; p < PR.length; p++) seaOut.push({ i:p, name:PR[p].name, x:PR[p].x, y:PR[p].y, a:PR[p].a, adj:PR[p].adj });
const out = { W, H, KM, LON0, LAT0, X0, Y1, R, landN:LAND_N, prov:provOut, sea:seaOut, states:ST.slice(1), cities:cities.slice(0, 900).map(c => ({ n:c.n, en:c.en, x:c.x, y:c.y, p:c.p, pop:c.pop, cap:c.cap })) };
fs.writeFileSync(path.join(OUT, 'map.js'), 'window.MAPDATA=' + JSON.stringify(out) + ';');
fs.writeFileSync(path.join(OUT, 'tex.js'), 'window.TEX={prov:"data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'prov.png')).toString('base64') + '",base:"data:image/jpeg;base64,' + fs.readFileSync(path.join(OUT, 'base.jpg')).toString('base64') + '"};');
const count = {}; for (const s of ST.slice(1)) count[s.owner] = (count[s.owner] || 0) + 1; console.log(count);
const tc = {}; for (const p of provOut) tc[p.t] = (tc[p.t] || 0) + 1; console.log(tc);
// контрольная картинка владельцев
const palette = {}; const ctl = Buffer.alloc((W >> 1) * (H >> 1) * 3);
for (let y = 0; y < H >> 1; y++) for (let x = 0; x < W >> 1; x++) {
  const i = x * 2 + y * 2 * W, p = pid[i], q = (x + y * (W >> 1)) * 3; const s = p > 0 && p <= LAND_N ? ST[PR[p].st] : null;
  if (!s) { ctl[q] = base[i * 3]; ctl[q + 1] = base[i * 3 + 1]; ctl[q + 2] = base[i * 3 + 2]; continue; }
  const pl = palette[s.owner] || (palette[s.owner] = [60 + Math.random() * 180 | 0, 60 + Math.random() * 180 | 0, 60 + Math.random() * 180 | 0]);
  const bd = pid[i + 2] !== p || pid[i + 2 * W] !== p, sb = PR[pid[i + 2]]?.st !== PR[p].st || PR[pid[i + 2 * W]]?.st !== PR[p].st;
  const f = sb ? .35 : bd ? .75 : 1; ctl[q] = pl[0] * f; ctl[q + 1] = pl[1] * f; ctl[q + 2] = pl[2] * f;
}
await sharp(ctl, { raw:{ width:W >> 1, height:H >> 1, channels:3 } }).jpeg({ quality:80 }).toFile(path.join(SRC, 'control.jpg'));
console.log('sizes', fs.statSync(path.join(OUT, 'prov.png')).size, fs.statSync(path.join(OUT, 'base.jpg')).size, fs.statSync(path.join(OUT, 'map.js')).size);
