// Скачивает флаги и иллюстрации с Wikimedia Commons только со свободными лицензиями.
import fs from 'fs'; import path from 'path'; import sharp from 'sharp';
const ROOT = path.resolve(import.meta.dirname, '..'); const UA = { 'User-Agent':'SteelFrontierGameAssetFetcher/1.0 (hobby game build script)' };
const FLAGS = { GER:'Flag of Germany (1867–1918).svg', NAT:'Flag of Spain (1938–1945).svg', ITA:'Flag of Italy (1861–1946).svg', ENG:'Flag of the United Kingdom.svg', FRA:'Flag of France.svg', SOV:'Flag of the Soviet Union (1923–1955).svg', POL:'Flag of Poland (1928–1980).svg', CZE:'Flag of the Czech Republic.svg', AUS:'Flag of Austria.svg', HUN:'Flag of Hungary (1920–1946).svg', ROM:'Flag of Romania.svg', YUG:'Flag of the Kingdom of Yugoslavia.svg', BUL:'Flag of Bulgaria.svg', GRE:'Flag of Greece (1822-1978).svg', ALB:'Flag of Albania (1934–1939).svg', TUR:'Flag of Turkey.svg', SPA:'Flag of the Second Spanish Republic.svg', POR:'Flag of Portugal.svg', BEL:'Flag of Belgium (civil).svg', HOL:'Flag of the Netherlands.svg', LUX:'Flag of Luxembourg.svg', DEN:'Flag of Denmark.svg', NOR:'Flag of Norway.svg', SWE:'Flag of Sweden.svg', FIN:'Flag of Finland.svg', EST:'Flag of Estonia.svg', LAT:'Flag of Latvia.svg', LIT:'Flag of Lithuania (1918–1940).svg', SWI:'Flag of Switzerland.svg', IRE:'Flag of Ireland.svg', ICE:'Flag of Iceland.svg' };
const PHOTO = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'photos.json'), 'utf8'));
const FREE = /^(public domain|pd|cc0|cc[ -]by)/i;
const sleep = ms => new Promise(s => setTimeout(s, ms));
async function api(params) {
  for (let t = 0; t < 5; t++) {
    const r = await fetch('https://commons.wikimedia.org/w/api.php?format=json&origin=*&' + new URLSearchParams(params), { headers:UA });
    if (r.status === 429) { await sleep(5000 * (t + 1)); continue; }
    return r.json();
  }
  throw new Error('api rate limited');
}
async function save(url, out, w, h, png) {
  for (let t = 0; t < 5; t++) {
    const r = await fetch(url, { headers:UA });
    if (r.status === 429) { await sleep(5000 * (t + 1)); continue; }
    if (!r.ok) throw new Error('http ' + r.status);
    const b = Buffer.from(await r.arrayBuffer());
    const s = sharp(b).resize(w, h, { fit:'cover', position:'attention' });
    if (png) await s.png().toFile(out); else await s.jpeg({ quality:72 }).toFile(out);
    return;
  }
  throw new Error('rate limited');
}
const credPath = path.join(ROOT, 'assets/credits.json');
const credits = fs.existsSync(credPath) ? JSON.parse(fs.readFileSync(credPath)) : {};
fs.mkdirSync(path.join(ROOT, 'assets/flags'), { recursive:true }); fs.mkdirSync(path.join(ROOT, 'assets/img'), { recursive:true });
const skip = new Map(); // key -> сколько первых результатов пропустить: "f_rally:2"
const force = new Set();
for (const a of process.argv.slice(2)) { const [k, n] = a.split(':'); force.add(k); if (n) skip.set(k, +n); }
async function info(titles) { const j = await api({ action:'query', titles, prop:'imageinfo', iiprop:'url|extmetadata|size|mime', iiurlwidth:640 }); return Object.values(j.query.pages); }
const clean = s => (s || '').replace(/<[^>]+>/g, '').trim().slice(0, 120);
for (const [k, f] of Object.entries(FLAGS)) {
  const out = path.join(ROOT, 'assets/flags', k + '.png');
  if (fs.existsSync(out) && !force.has(k)) continue;
  try {
    const [p] = await info('File:' + f); const ii = p.imageinfo?.[0];
    if (!ii) { console.log('NO FLAG', k, f); continue; }
    await save(ii.thumburl, out, 120, 76, true);
    credits['flag:' + k] = { file:f, url:ii.descriptionurl, license:ii.extmetadata?.LicenseShortName?.value, author:clean(ii.extmetadata?.Artist?.value) };
    await sleep(250);
  } catch (e) { console.log('FLAG ERR', k, e.message); }
}
for (const [k, q] of Object.entries(PHOTO)) {
  const out = path.join(ROOT, 'assets/img', k + '.jpg');
  if (fs.existsSync(out) && !force.has(k)) continue;
  try {
    let pages = [];
    if (q.startsWith('File:')) pages = await info(q);
    else {
      const j = await api({ action:'query', generator:'search', gsrsearch:q + ' filetype:bitmap', gsrnamespace:6, gsrlimit:20, prop:'imageinfo', iiprop:'url|extmetadata|size|mime', iiurlwidth:640 });
      pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
    }
    let done = false, sk = skip.get(k) || 0;
    for (const p of pages) {
      const ii = p.imageinfo?.[0]; if (!ii || !/jpeg|png/.test(ii.mime)) continue;
      const lic = ii.extmetadata?.LicenseShortName?.value || '';
      if (!FREE.test(lic) || ii.width < 500 || ii.width / ii.height < .9 || /swastik|hakenkreuz|hitler|nazi|\bSS\b/i.test(p.title)) continue;
      if (sk-- > 0) continue;
      await save(ii.thumburl, out, 320, 220, false);
      credits['img:' + k] = { file:p.title, url:ii.descriptionurl, license:lic, author:clean(ii.extmetadata?.Artist?.value) };
      done = true; break;
    }
    if (!done) console.log('NO PHOTO', k, q);
    await sleep(250);
  } catch (e) { console.log('PHOTO ERR', k, e.message); }
}
fs.writeFileSync(credPath, JSON.stringify(credits, null, 1));
fs.writeFileSync(path.join(ROOT, 'data/credits.js'), 'window.CREDITS=' + JSON.stringify(credits) + ';');
const sheet = process.env.SHEET;
if (sheet) {
  const items = fs.readdirSync(path.join(ROOT, 'assets/img')).filter(f => f.endsWith('.jpg')).sort();
  const fl = fs.readdirSync(path.join(ROOT, 'assets/flags')).sort();
  const cols = 10, cw = 170, ch = 136, rows = Math.ceil(items.length / cols), comp = [];
  for (let i = 0; i < items.length; i++) {
    const x = (i % cols) * cw, y = ((i / cols) | 0) * ch;
    comp.push({ input:await sharp(path.join(ROOT, 'assets/img', items[i])).resize(cw - 6, ch - 26).toBuffer(), left:x + 3, top:y + 22 });
    comp.push({ input:Buffer.from(`<svg width="${cw}" height="22"><text x="3" y="16" font-size="13" fill="#fff" font-family="Arial">${items[i].replace('.jpg', '')}</text></svg>`), left:x, top:y });
  }
  const fw = 70, frows = Math.ceil(fl.length / 16), HH = rows * ch + frows * 60;
  for (let i = 0; i < fl.length; i++) comp.push({ input:await sharp(path.join(ROOT, 'assets/flags', fl[i])).resize(fw - 6, 42).toBuffer(), left:(i % 16) * fw + 3, top:rows * ch + ((i / 16) | 0) * 60 + 3 });
  await sharp({ create:{ width:cols * cw, height:HH, channels:3, background:'#222' } }).composite(comp).jpeg({ quality:80 }).toFile(sheet);
}
console.log('done', Object.keys(credits).length);
