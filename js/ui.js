// Каркас интерфейса: панели, ввод на карте, горячие клавиши, оповещения, звук.
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${clamp(v, 0, 1) * 100}%"></i></div>`;
const swatch = t => { const c = C(t), f = c && !c.formedAs ? `url(assets/flags/${t}.png)` : 'none'; return `<span class="swatch" style="background-color:${c ? c.color : '#555'};background-image:${f}"></span>`; };
// Раздел, значок, клавиша (физическая, поэтому работает и в русской раскладке)
const PANELS = [['politics','Политика','⚖','Q'],['focus','Фокусы','✪','W'],['tech','Исследования','⚗','E'],['prod','Производство','⚙','R'],['build','Стройка','⚒','T'],['trade','Торговля','⇄','Y'],['army','Армия','⚔','U'],['design','Конструктор дивизий','▦','I'],['air','Авиация','✈︎','O'],['navy','Флот','⚓︎','P'],['diplo','Дипломатия','✉︎','G'],['log','Журнал','☰','L']];
const MODES = [['pol','Политика'],['faction','Блоки'],['dip','Отношения'],['ideo','Идеология'],['ter','Местность'],['weather','Погода'],['sup','Снабжение'],['infra','Дороги'],['res','Ресурсы'],['ind','Заводы'],['air','Зоны авиации'],['resist','Сопротивление']];
const svgCursor = (svg, x, y, fb) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>${svg}</svg>`)}") ${x} ${y}, ${fb}`;
const CURSORS = {
  move:svgCursor(`<path d='M16 3 L26 15 L20 15 L20 28 L12 28 L12 15 L6 15 Z' fill='#7fc66c' stroke='#000' stroke-width='2'/>`, 16, 3, 'pointer'),
  attack:svgCursor(`<circle cx='16' cy='16' r='10' fill='none' stroke='#000' stroke-width='5'/><circle cx='16' cy='16' r='10' fill='none' stroke='#e8493a' stroke-width='3'/><path d='M16 1V10M16 22V31M1 16H10M22 16H31' stroke='#000' stroke-width='4'/><path d='M16 2V10M16 22V30M2 16H10M22 16H30' stroke='#e8493a' stroke-width='2'/>`, 16, 16, 'crosshair'),
  build:svgCursor(`<path d='M6 26 L18 14 L22 18 L10 30 Z' fill='#8c6d2c' stroke='#000' stroke-width='2'/><path d='M14 4 L28 12 L24 20 L10 10 Z' fill='#c8c8c0' stroke='#000' stroke-width='2'/>`, 14, 4, 'pointer'),
  no:'not-allowed', pen:svgCursor(`<path d='M4 28 L8 18 L24 3 L29 8 L14 24 Z' fill='#e8d27a' stroke='#000' stroke-width='2'/>`, 4, 28, 'crosshair'),
};

// Точечное обновление DOM: кнопка под курсором не пересоздаётся, поэтому нажатия не теряются.
function morph(el, html) {
  if (el._html === html) return; el._html = html;
  const t = document.createElement('template'); t.innerHTML = html; syncChildren(el, t.content);
}
function syncChildren(a, b) {
  const A = a.childNodes, Bn = [...b.childNodes];
  for (let i = 0; i < Bn.length; i++) {
    const n = Bn[i], o = A[i];
    if (!o) { a.appendChild(n); continue; }
    if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName) { a.replaceChild(n, o); continue; }
    if (n.nodeType === 3 || n.nodeType === 8) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; continue; }
    for (const at of [...o.attributes]) if (!n.hasAttribute(at.name)) o.removeAttribute(at.name);
    for (const at of [...n.attributes]) if (o.getAttribute(at.name) !== at.value) o.setAttribute(at.name, at.value);
    if (n.nodeName === 'INPUT') { if (document.activeElement !== o) o.value = n.getAttribute('value') ?? ''; continue; }
    if (n.nodeName === 'SELECT') { syncChildren(o, n); const sel = n.querySelector('option[selected]'); if (document.activeElement !== o) o.value = sel ? sel.value : (n.options[0]?.value ?? ''); continue; }
    if (n.nodeName === 'svg') { if (o.outerHTML !== n.outerHTML) a.replaceChild(n, o); continue; }
    syncChildren(o, n);
  }
  while (A.length > Bn.length) a.removeChild(a.lastChild);
}

const Sound = {
  on:true, ctx:null,
  play(kind) {
    if (!this.on) return; try {
      const c = this.ctx || (this.ctx = new (window.AudioContext || window.webkitAudioContext)()); if (c.state === 'suspended') c.resume();
      const T = { hover:[900, .012, 'sine', .012], click:[520, .035, 'square', .04], order:[300, .09, 'sawtooth', .06], err:[130, .16, 'square', .06], open:[240, .06, 'triangle', .08], build:[180, .1, 'square', .07], stamp:[95, .22, 'square', .14], drum:[62, .55, 'sawtooth', .2], type:[1400, .02, 'square', .02] }[kind] || [400, .04, 'square', .04];
      const o = c.createOscillator(), g = c.createGain(); o.type = T[2]; o.frequency.value = T[0]; if (kind === 'drum') o.frequency.exponentialRampToValueAtTime(38, c.currentTime + T[1]); g.gain.setValueAtTime(T[3] * (this.volume ?? .6) * 1.6, c.currentTime); g.gain.exponentialRampToValueAtTime(.0005, c.currentTime + T[1]); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + T[1]);
    } catch (e) { /* звук необязателен */ }
  },
};

const UI = {
  tab:null, sel:{ country:null, techCat:'inf', buildType:'civ', design:null, slotPick:null, tradeRes:'oil', fleet:null }, order:null, curArmy:null, mouse:{ x:0, y:0, over:false },
  init() {
    $('#tabs').innerHTML = PANELS.map(([k, n, ic, key]) => `<button data-a="tab:${k}" id="t_${k}" data-tip="${n} (${key})">${ic}<kbd>${key}</kbd></button>`).join('') + `<button data-a="tab:war" id="t_war" class="warbtn hidden" data-tip="Война (B). Значок виден, пока вы воюете.">⚑<kbd>B</kbd></button>` + `<button data-a="menu" data-tip="Меню (F10)" style="width:34px;height:34px;align-self:center;font-size:14px">≡</button>`;
    $('#modes').innerHTML = MODES.map(([k, n]) => `<button data-a="mode:${k}" id="m_${k}">${n}</button>`).join('');
    document.addEventListener('click', e => { const t = e.target.closest('[data-a]'); if (!t || t.disabled) return; Sound.play('click'); const [a, ...args] = t.dataset.a.split(':'); if (UI.A[a]) UI.A[a](...args, t, e); });
    document.addEventListener('change', e => { const t = e.target.closest('[data-c]'); if (!t) return; const [a, ...args] = t.dataset.c.split(':'); if (UI.A[a]) UI.A[a](...args, t.value, t); });
    document.addEventListener('mousemove', e => { UI.mouse.x = e.clientX; UI.mouse.y = e.clientY; UI.mouse.over = true; const t = e.target.closest?.('[data-tip]'); if (t) this.showTip(t.dataset.tip, e); else if (e.target.id !== 'overlay') $('#tip').classList.add('hidden'); });
    document.addEventListener('mouseleave', () => { UI.mouse.over = false; });
    // Наведение на карточку обновляет панель подробностей; деревья двигаются зажатой мышью
    document.addEventListener('mouseover', e => { const t = e.target.closest?.('[data-hov]'); if (!t) return; const id = t.dataset.hov.split(':')[1]; if (this.sel.focusHov !== id) { this.sel.focusHov = id; if (this.tab === 'focus') this.renderPanel(); } });
    let pan = null; document.addEventListener('mousedown', e => { const b = e.target.closest?.('.pan'); if (b && e.button === 0 && !e.target.closest('button')) { pan = { b, x:e.clientX, y:e.clientY, l:b.scrollLeft, t:b.scrollTop }; b.classList.add('grab'); } });
    window.addEventListener('mousemove', e => { if (pan) { pan.b.scrollLeft = pan.l - (e.clientX - pan.x); pan.b.scrollTop = pan.t - (e.clientY - pan.y); } }); window.addEventListener('mouseup', () => { if (pan) { pan.b.classList.remove('grab'); pan = null; } });
    this.bindMap(); this.bindKeys();
  },
  showTip(text, e) { const T = $('#tip'); T.classList.remove('hidden'); T.textContent = text; T.style.left = Math.min(e.clientX + 16, innerWidth - 335) + 'px'; T.style.top = Math.min(e.clientY + 16, innerHeight - 150) + 'px'; },
  bindKeys() {
    document.addEventListener('keydown', e => {
      if (!G || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || !$('#menu').classList.contains('hidden')) return;
      if (e.code === 'Space') { e.preventDefault(); UI.A.pause(); return; }
      if (/^Digit[1-5]$/.test(e.code)) { UI.A.speed(e.code.slice(5)); return; }
      if (e.code === 'NumpadAdd' || e.code === 'Equal') { UI.A.speed(clamp((G.speed || 0) + 1, 1, 5)); return; }
      if (e.code === 'NumpadSubtract' || e.code === 'Minus') { UI.A.speed(clamp((G.speed || 2) - 1, 1, 5)); return; }
      if (e.code === 'Escape') { if (this.cmdOpen) { this.cmdOpen = false; this.renderCmdPick(); return; } if (this.order) { this.setOrder(null); return; } if (this.tab) { this.closePanel(); return; } if (Render.selProv) { Render.selProv = 0; Render.selState = 0; Render.dirty = true; this.renderProv(); return; } if (Render.selected.size) { Render.selected.clear(); this.curArmy = null; this.curGroup = null; this.renderBottom(); this.renderArmyBar(); return; } UI.A.menu(); return; }
      if (e.code === 'F10') { e.preventDefault(); UI.A.menu(); return; }
      if (e.code === 'Delete') { UI.A.stopDivs(); return; }
      if (e.code === 'KeyB') { if (this.myWars().length) { Sound.play('open'); this.openTab('war'); } return; }
      const P = PANELS.find(p => 'Key' + p[3] === e.code); if (P) { Sound.play('open'); this.openTab(P[0]); return; }
      const pan = 70 / Render.view.z; if (e.code === 'ArrowLeft') Render.view.x -= pan; if (e.code === 'ArrowRight') Render.view.x += pan; if (e.code === 'ArrowUp') Render.view.y -= pan; if (e.code === 'ArrowDown') Render.view.y += pan;
    });
  },
  toast(text, kind) { if (G && G.preview) return; Sound.play('type'); const d = document.createElement('div'); d.className = 'toast ' + (kind || ''); d.textContent = text; const b = $('#toasts'); b.prepend(d); while (b.children.length > 4) b.lastChild.remove(); setTimeout(() => d.remove(), 6000); },
  err(e) { if (e) { Sound.play('err'); this.toast(e, 'bad'); } return !e; },
  me() { return C(G.player); },
  refresh() { this.renderTop(); this.renderAlerts(); this.renderArmyBar(); if (this.tab) this.renderPanel(); this.renderBottom(); this.renderProv(); },
  onDay() { this.refresh(); },

  // ---------- верх ----------
  renderTop() {
    const c = this.me(); if (!c) return;
    const netRes = Object.keys(DB.RES).map(r => { const h = (c.resHave?.[r] ?? c.res[r] ?? 0), u = c.resUse?.[r] || 0, n = h - u; return `<div class="stat" data-tip="${DB.RES[r]}: добыча и импорт ${h.toFixed(0)}, расход ${u.toFixed(0)}"><b class="${n < 0 ? 'bad' : ''}">${n >= 0 ? '+' : ''}${n.toFixed(0)}</b><span>${DB.RES[r]}</span></div>`; }).join('');
    morph($('#top'), `<span data-a="tab:politics">${swatch(c.t)}</span><div class="name" data-a="tab:politics">${esc(c.n)}</div><div class="sep"></div>
    <div class="stat" data-tip="Политическая власть, в день +${(2 + mod(c, 'pp')).toFixed(2)}. Нужна для законов, советников и дипломатии."><b class="gold">${c.pp.toFixed(0)}</b><span>Власть</span></div>
    <div class="stat" data-tip="Стабильность влияет на заводы и власть"><b>${pct(c.stab)}</b><span>Стабильн.</span></div>
    <div class="stat" data-tip="Поддержка войны открывает законы и отодвигает капитуляцию"><b>${pct(c.warsup)}</b><span>Война</span></div>
    <div class="stat" data-tip="Свободные люди: ${fmt(c.mpAvail)} из ${fmt(c.mpMax)}"><b class="${c.mpAvail < 20000 ? 'bad' : ''}">${fmt(c.mpAvail)}</b><span>Люди</span></div><div class="sep"></div>
    <div class="stat" data-tip="Гражданские заводы: всего ${c.civN.toFixed(1)}, товары ${(c.civN * consumerShare(c)).toFixed(1)}, торговля ${tradeCost(c)}, на стройке ${(c.buildUsed || 0).toFixed(1)}"><b>${freeCivs(c).toFixed(0)}/${c.civN.toFixed(0)}</b><span>Гражд.</span></div>
    <div class="stat" data-tip="Военные заводы: на линиях ${milAssigned(c)} из ${c.milN.toFixed(1)}"><b>${milAssigned(c)}/${c.milN.toFixed(0)}</b><span>Воен.</span></div>
    <div class="stat" data-tip="Верфи: на заказах ${dockAssigned(c)}"><b>${dockAssigned(c)}/${c.dockN.toFixed(0)}</b><span>Верфи</span></div><div class="sep"></div>${netRes}<div class="sep"></div>
    <div class="stat" data-tip="Мировая напряжённость"><b class="${G.wt > 50 ? 'bad' : ''}">${G.wt.toFixed(0)}%</b><span>Напряж.</span></div>
    <div id="clock"><div class="date">${dateStr()}</div><button class="${G.speed === 0 ? 'on' : ''}" data-a="pause" data-tip="Пауза (пробел)">❚❚</button>${[1, 2, 3, 4, 5].map(s => `<button class="${G.speed === s ? 'on' : ''}" data-a="speed:${s}" data-tip="Скорость ${s}">${s}</button>`).join('')}<button data-a="sound" data-tip="Звук кнопок">${Sound.on ? '♪' : '✕'}</button></div>`);
    PANELS.forEach(([k]) => { const b = $('#t_' + k); if (b) b.classList.toggle('on', this.tab === k); });
    const myWar = this.myWars().length > 0, wb = $('#t_war'); if (wb) { wb.classList.toggle('hidden', !myWar); wb.classList.toggle('on', this.tab === 'war'); } if (!myWar && this.tab === 'war') this.closePanel();
    MODES.forEach(([k]) => { const b = $('#m_' + k); if (b) b.classList.toggle('on', Render.mode === k); });
  },
  myWars() { const c = this.me(); if (!c) return []; return G.wars.filter(w => w.atk.includes(c.t) || w.def.includes(c.t)); },
  // ---------- оповещения ----------
  alerts() {
    const c = this.me(), out = []; if (!c || c.dead) return out;
    if (!c.focus.cur && DB.FOCUS.some(F => focusAvailable(c, F))) out.push(['focus', '✪', 'Не выбран национальный фокус', 'red']);
    const emptyR = c.tech.slots.slice(0, researchSlots(c)).filter(s => !s).length; if (emptyR) out.push(['tech', '⚗', `Пустые слоты исследований: ${emptyR}`, 'red']);
    if (freeCivs(c) - (c.buildUsed || 0) >= 1) out.push(['build', '⚒', `Простаивают гражданские заводы: ${(freeCivs(c) - (c.buildUsed || 0)).toFixed(0)}`, '']);
    if (c.milN - milAssigned(c) >= 1) out.push(['prod', '⚙', `Простаивают военные заводы: ${(c.milN - milAssigned(c)).toFixed(0)}`, '']);
    if (c.dockN - dockAssigned(c) >= 1) out.push(['prod', '⚓︎', `Простаивают верфи: ${(c.dockN - dockAssigned(c)).toFixed(0)}`, '']);
    if (Object.values(G.wings).some(w => w.tag === c.t && !w.mission) && atWar(c)) out.push(['air', '✈︎', 'Есть авиакрылья без миссии', '']);
    const short = c.lines.length ? Object.keys(DB.RES).filter(r => (c.resUse?.[r] || 0) > (c.resHave?.[r] ?? 0) + .5) : []; if (short.length) out.push(['trade', '⇄', `Не хватает ресурсов: ${short.map(r => DB.RES[r]).join(', ')}`, 'red']);
    if (c.pp >= 200) out.push(['politics', '⚖', `Накопилось власти: ${c.pp.toFixed(0)}. Потратьте на законы и советников.`, '']);
    if (atWar(c) && !Object.values(G.armies).some(a => a.tag === c.t && a.front)) out.push(['army', '⚔', 'Идёт война, но у армий нет фронта', 'red']);
    return out;
  },
  renderAlerts() { morph($('#alerts'), this.alerts().map(([t, ic, tx, cl]) => `<button class="${cl}" data-a="tabOpen:${t}" data-tip="${esc(tx)}">${ic}</button>`).join('')); },
  // ---------- окна ----------
  openTab(k) { if (this.tab === k) return this.closePanel(); this.setOrder(null); this.tab = k; if (k === 'build') { if (Render.mode !== 'build') this.prevMode = Render.mode; Render.mode = 'build'; Render.dirty = true; } else this.leaveBuild(); this.renderPanel(); this.renderTop(); },
  leaveBuild() { if (Render.mode === 'build') { Render.mode = this.prevMode || 'pol'; Render.dirty = true; } },
  closePanel() { this.tab = null; this.leaveBuild(); const p = $('#panel'); p.classList.add('hidden'); p._html = null; document.body.classList.remove('pnl', 'widep'); this.renderTop(); },
  renderPanel() {
    const p = $('#panel'); if (!this.tab) return; const fn = UI.P[this.tab]; if (!fn) return;
    const was = p.classList.contains('hidden'); p.classList.remove('hidden'); document.body.classList.add('pnl'); const wd = ['focus', 'tech', 'design'].includes(this.tab); p.classList.toggle('wide', wd); document.body.classList.toggle('widep', wd);
    if (p._tab !== this.tab) { p._html = null; p.innerHTML = ''; p.scrollTop = 0; p._tab = this.tab; }
    morph(p, `<button class="closex" data-a="closeTab" data-tip="Закрыть (Esc)">✕</button>` + fn.call(UI));
  },
  // ---------- портреты командиров внизу ----------
  armyCard(a, c) {
    const g = c.gens.find(x => x.id === a.gen), ic = a.mode === 'attack' ? 'Наступление' : a.front ? 'На фронте' : 'В резерве', over = a.divs.length > MAX_ARMY_DIVS;
    return `<button data-a="selArmy:${a.id}" class="cmd ${this.curArmy === a.id ? 'on' : ''} ${a.mode === 'attack' ? 'atk' : ''}" data-tip="${esc(a.name)}\n${g ? 'Генерал: ' + esc(g.n) + ', ур.' + g.skill : 'Нет командира'}\nДивизий: ${a.divs.length} из ${MAX_ARMY_DIVS}\n${ic}"><i class="sil ${g ? '' : 'none'}"></i><b class="${over ? 'over' : ''}">${a.divs.length}/${MAX_ARMY_DIVS}</b></button>`;
  },
  renderArmyBar() {
    this.renderCmdPick(); const c = this.me(); if (!c) return; const army = Object.values(G.armies).filter(a => a.tag === c.t);
    const COLORS = ['#a8402f', '#3f6fa8', '#5c8a3f', '#a8842e', '#7b4fa0', '#3f8f8a'];
    const groups = Object.values(G.groups).filter(g => g.tag === c.t).map((Gp, i) => { const f = c.gens.find(x => x.id === Gp.fm), arm = Gp.armies.map(x => G.armies[x]).filter(Boolean), n = arm.reduce((v, a) => v + a.divs.length, 0);
      return `<div class="agroup" style="border-color:${COLORS[i % COLORS.length]}"><button data-a="selGroup:${Gp.id}" class="cmd fm ${this.curGroup === Gp.id ? 'on' : ''} ${Gp.mode === 'attack' ? 'atk' : ''}" data-tip="${esc(Gp.name)}\n${f ? 'Фельдмаршал: ' + esc(f.n) + ', ур.' + f.skill : 'Нет фельдмаршала'}\nАрмий: ${arm.length} из ${MAX_GROUP_ARMIES}, дивизий: ${n}"><i class="sil star ${f ? '' : 'none'}"></i><b>${arm.length}/${MAX_GROUP_ARMIES}</b></button>${arm.map(a => this.armyCard(a, c)).join('')}${arm.length < MAX_GROUP_ARMIES ? `<button class="cmd add" data-a="cmdPick:army:${Gp.id}" data-tip="Новая армия в этой группе">+</button>` : ''}</div>`; }).join('');
    const loose = army.filter(a => !(a.group && G.groups[a.group])), free = Object.values(G.divs).filter(d => d.tag === c.t && !d.army).length;
    morph($('#armybar'), `<button class="cmd add big" data-a="cmdPick:group" data-tip="Новая группа армий с фельдмаршалом">+</button>` + groups + loose.map(a => this.armyCard(a, c)).join('') + `<button class="cmd add" data-a="cmdPick:army" data-tip="Новая армия с генералом">+</button>` + (free ? `<button class="cmd free ${this.freeSel ? 'on' : ''}" data-a="selFree" data-tip="Дивизии без армии: ${free}"><i class="sil none"></i><b>${free}</b></button>` : ''));
  },
  // ---------- окно выбора командира ----------
  renderCmdPick() {
    const el = $('#cmdpick'), M_ = this.cmdMode; if (!this.cmdOpen || !M_) { el.classList.add('hidden'); el._html = null; return; } el.classList.remove('hidden'); const c = this.me();
    const army = Object.values(G.armies).filter(a => a.tag === c.t), grp = Object.values(G.groups).filter(g => g.tag === c.t), wantMarshal = M_.kind === 'group'; const X = M_.id ? (wantMarshal ? G.groups[M_.id] : G.armies[M_.id]) : null;
    const usedBy = g => { const a = army.find(x => x.gen === g.id), f = grp.find(x => x.fm === g.id); return a ? a.name : f ? f.name : null; };
    let list = c.gens.filter(g => (g.rank === 'marshal') === wantMarshal); if (!M_.all) list = list.filter(g => !usedBy(g) || (X && (X.gen === g.id || X.fm === g.id))); list.sort((a, b) => b.skill - a.skill);
    const act = g => X ? 'cmdSet:' + g.id : (wantMarshal ? 'cmdGroup:' : 'cmdArmy:') + g.id;
    const row = g => { const u = usedBy(g), cur = X && (X.gen === g.id || X.fm === g.id), open = M_.details === g.id; return `<div class="crow ${cur ? 'cur' : ''}"><i class="sil ${g.rank === 'marshal' ? 'star' : ''}"></i><div class="grow"><div class="cname">${g.rank === 'marshal' ? 'Фельдмаршал' : 'Генерал'} <b>${esc(g.n)}</b></div><div class="cst"><span data-tip="Уровень">★${g.skill}</span><span data-tip="Атака">А ${g.atk}</span><span data-tip="Защита">З ${g.def}</span><span data-tip="Логистика">Л ${g.log}</span><span data-tip="Планирование">П ${g.plan}</span>${g.traits.map(t => `<em data-tip="${esc(DB.TRAITS[t].d)}">${DB.TRAITS[t].n}</em>`).join('')}</div>${open ? `<div class="mute">Опыт: ${g.xp.toFixed(0)}. ${u ? 'Сейчас: ' + esc(u) : 'В резерве'}. ${g.rank === 'marshal' ? 'Даёт группе +' + (g.skill * 1.2).toFixed(1) + '% к бою.' : 'Атака +' + g.atk * 3 + '%, защита +' + g.def * 3 + '%.'}</div>` : (u ? `<div class="mute">${esc(u)}</div>` : '')}</div><div class="cbtn"><button class="go" data-a="${act(g)}" ${cur ? 'disabled' : ''}>Назначить</button><button data-a="cmdDetails:${g.id}">Подробнее</button>${g.rank === 'marshal' ? `<button data-a="demoteGen:${g.id}">Понизить</button>` : `<button data-a="promoteGen:${g.id}" ${c.pp < PROMOTE_COST ? 'disabled' : ''} data-tip="До фельдмаршала: ${PROMOTE_COST} власти">Повысить</button>`}</div></div>`; };
    const title = X ? (wantMarshal ? 'Фельдмаршал: ' : 'Генерал: ') + esc(X.name) : (wantMarshal ? 'Новая группа армий: выберите фельдмаршала' : 'Новая армия: выберите генерала');
    morph(el, `<div class="row between chead"><b>${title}</b><span class="row"><label class="row"><input type="checkbox" data-c="cmdAll" ${M_.all ? 'checked' : ''}>занятые</label><button data-a="cmdClose">✕</button></span></div><div class="clist">${list.map(row).join('') || `<div class="mute" style="padding:10px">${wantMarshal ? 'Нет свободных фельдмаршалов. Включите «занятые» или повысьте генерала.' : 'Нет свободных генералов. Включите «занятые» или наймите нового.'}</div>`}${wantMarshal ? `<h3>Повысить генерала</h3>${c.gens.filter(g => g.rank !== 'marshal').map(row).join('')}` : ''}</div><div class="row between cfoot"><button data-a="hireGen" data-tip="50 власти">Новый командир</button>${X ? '<button data-a="cmdUnset">Снять командира</button>' : ''}</div>`);
  },
  // ---------- приказы ----------
  setOrder(o) { this.order = o; const h = $('#hint'); if (h) { h.textContent = { front:'Щёлкните по стране: фронт по всей границе с ней. Или зажмите и проведите вдоль нужного участка. Esc — отмена.', arrow:'Зажмите левую кнопку у фронта и тяните к цели наступления. Esc — отмена.', landing:'Щёлкните побережье: чужое для десанта, своё для переброски. Esc — отмена.' }[o] || ''; h.classList.toggle('hidden', !o); } this.renderBottom(); },
  // Маленькая панель действий над портретами и отдельное окно со списком дивизий
  renderBottom() {
    const P = $('#plans'), L = $('#divlist'); const ids = [...Render.selected].filter(i => G.divs[i]); Render.selected = new Set(ids); const A = this.curArmy && G.armies[this.curArmy], Gp = this.curGroup && G.groups[this.curGroup]; if (!A) this.curArmy = null; if (!Gp) this.curGroup = null;
    if (!ids.length && !A && !Gp) { P.classList.add('hidden'); L.classList.add('hidden'); P._html = null; L._html = null; document.body.classList.remove('sel'); return; }
    document.body.classList.add('sel'); P.classList.remove('hidden'); L.classList.remove('hidden'); const c = this.me(), order = this.order, X = Gp || A;
    const btn = (a, ic, tip, cls = '', off = false) => `<button class="pl ${cls}" data-a="${a}" ${off ? 'disabled' : ''} data-tip="${esc(tip)}">${ic}</button>`;
    const hasFront = X && !!(Gp ? (Gp.line || Gp.front) : A.front), atk = X && X.mode === 'attack'; let h = '';
    if (X) h += btn('orderFront', '═', Gp ? 'Фронт группы: щелчок по стране или протяжка вдоль границы. Участок поделится между армиями.' : 'Фронт: щелчок по стране или протяжка вдоль границы', order === 'front' ? 'on' : '') + btn('orderArrow', '➤', hasFront ? 'Стрелка наступления: тяните к цели' : 'Сначала нарисуйте фронт', order === 'arrow' ? 'on' : '', !hasFront) + btn((Gp ? 'groupMode:' + Gp.id : 'armyMode:' + A.id), atk ? '■' : '▶', atk ? 'Остановить наступление' : 'Выполнить план: начать наступление', atk ? 'war' : 'go', !hasFront) + btn((Gp ? 'groupClear:' + Gp.id : 'armyClear:' + A.id), '✕', 'Сбросить план', '', !hasFront) + '<span class="plsep"></span>' + btn('cmdFor', '☺', Gp ? 'Сменить фельдмаршала' : 'Сменить генерала');
    h += btn('landing', '⚓\uFE0E', 'Морем: десант или переброска. Нужно господство на море.', order === 'landing' ? 'on' : '') + btn('stopDivs', '✋', 'Стоп: отменить движение (Delete)');
    if (!X) h += btn('newArmy', '+', 'Создать армию из выбранных дивизий');
    if (X) h += btn(Gp ? 'groupDisband:' + Gp.id : 'armyDisband:' + A.id, '⌫', Gp ? 'Расформировать группу' : 'Расформировать армию');
    morph(P, h);
    const fp = Gp ? Gp.armies.flatMap(i => G.armies[i]?._fp || []).length : A ? (A._fp?.length || 0) : 0; const warn = [];
    if (X && hasFront && fp > ids.length) warn.push(`Мало войск: ${ids.length} дивизий на ${fp} провинций фронта.`); if (X && hasFront && !fp) warn.push('Нет контакта с противником: войска ждут, приказ сохранён.'); if (A && A.divs.length > MAX_ARMY_DIVS) warn.push(`Перегрузка армии: штраф ${A.divs.length - MAX_ARMY_DIVS}%.`); if (A && A.front === 'group') warn.push('Приказ идёт от группы. Свой фронт отделит армию от плана.');
    const title = Gp ? '★ ' + esc(Gp.name) : A ? esc(A.name) : 'Выбранные дивизии';
    morph(L, `<div class="dlhead"><b>${title}</b><span>⚔ ${ids.length}</span></div>${warn.map(w => `<div class="dlwarn">${w}</div>`).join('')}<div class="dlctl">${Gp ? '' : `<select data-c="divsTo"><option value="">Передать в армию…</option>${Object.values(G.armies).filter(x => x.tag === c.t && x.id !== this.curArmy).map(x => `<option value="${x.id}">${esc(x.name)} (${x.divs.length}/${MAX_ARMY_DIVS})</option>`).join('')}</select>`}${A ? `<select data-c="armyGroup:${A.id}"><option value="">Без группы</option>${Object.values(G.groups).filter(g => g.tag === c.t).map(g => `<option value="${g.id}" ${g.id === A.group ? 'selected' : ''}>${esc(g.name)} (${g.armies.length}/${MAX_GROUP_ARMIES})</option>`).join('')}</select>` : ''}</div><div class="dllist">${ids.map(i => { const d = G.divs[i], s = divStats(C(d.tag), d.tpl); return `<div class="dlrow" data-a="selDiv:${i}" data-tip="${esc(d.name)}\nШтат: ${esc(G.st[PROV[d.prov].s]?.name)}\nОрганизация ${d.org.toFixed(0)}/${s.org.toFixed(0)}, прочность ${pct(d.str)}\nОпыт ${pct(d.xp)}, окопы ${d.ent.toFixed(1)}, план ${pct(d.plan)}\nСнабжение ${pct(d.sup)}, погода ${WEATHER[weatherOf(d.prov)].n}"><span>${esc(d.name)}</span>${bar(d.org / s.org)}${bar(d.str, 'b')}</div>`; }).join('')}</div>`);
  },
  // ---------- штат ----------
  renderProv() {
    const p = Render.selProv, el = $('#prov'); if (!p) { el.classList.add('hidden'); el._html = null; return; } el.classList.remove('hidden'); const P = PROV[p]; const close = `<button class="closex" data-a="closeProv">✕</button>`;
    if (P.sea) { const nav = G.zoneNav[p] || {}; morph(el, close + `<h2>${esc(P.name)}</h2><div class="mute">Морская зона</div><h3>Господство</h3>${Object.entries(nav).map(([t, v]) => `<div>${swatch(t)}${esc(C(t).n)}: ${v.toFixed(0)}</div>`).join('') || '<div class="mute">Никто не патрулирует</div>'}${UI.sel.fleet ? `<button data-a="fleetGo:${p}" style="margin-top:6px">Направить выбранный флот</button>` : ''}`); return; }
    const st = G.st[P.s], ct = G.ctrl[p], own = C(st.owner), c = C(ct), me = this.me(); const T = TERRAIN[P.t], W = WEATHER[weatherOf(p)]; const city = G.cities.find(x => x.p === p);
    const res = Object.entries(st.res).map(([r, v]) => `${DB.RES[r]} ${v.toFixed(0)}`).join(', ') || 'нет'; const eff = stateFactor(st, c || me) * stateWork(st); const battle = G.battles[p];
    morph(el, close + `<h2>${esc(st.name)}</h2><div>${swatch(st.owner)}Владелец: ${esc(own?.n)}${ct !== st.owner ? `<br>${swatch(ct)}Контроль: ${esc(c?.n)}` : ''}</div>
      <div class="mute">${city ? esc(city.n) + ' · ' : ''}${T.n} · ${W.n}${G.vp[p] ? ' · очки победы ' + G.vp[p] : ''}</div>
      <table style="margin-top:5px"><tr><td>Гражд. заводы</td><td>${st.civ}</td><td>Воен. заводы</td><td>${st.mil}</td></tr><tr><td>Верфи</td><td>${st.dock}</td><td>Синтетика</td><td>${st.synth}</td></tr><tr><td>Дороги</td><td>${st.infra}/5</td><td>ПВО</td><td>${st.aa}/5</td></tr><tr><td>Аэродром</td><td>${st.air}/10</td><td>Форт</td><td>${G.fort[p]}/10</td></tr><tr><td>Слоты</td><td>${usedSlots(st)}/${st.slots + (me.slotBonus || 0)}</td><td>Люди</td><td>${fmt(st.mp)}</td></tr></table>
      <div style="margin-top:4px">Ресурсы: ${res}</div>${st.resist > 1 ? `<div class="row">Сопротивление ${st.resist.toFixed(0)}% ${bar(st.resist / 100, 'r')}</div>` : ''}${eff < 1 ? `<div class="mute">Отдача штата: ${pct(eff)}</div>` : ''}
      ${battle ? `<button data-a="battle:${p}" class="war" style="margin-top:5px">Сражение здесь</button>` : ''}
      ${st.ctrl === me.t ? `<div class="row" style="margin-top:6px"><button data-a="deployHere:${p}" class="${this.sel.deploy === p ? 'on' : ''}" data-tip="Новые дивизии будут появляться здесь">Развёртывание здесь</button><button data-a="tabOpen:build">Стройка</button></div>` : ''}`);
  },
  // ---------- мышь на карте ----------
  bindMap() {
    const ov = $('#overlay'); let box = null, rdrag = null, mdrag = null, stroke = null;
    ov.addEventListener('wheel', e => { e.preventDefault(); const v = Render.view; Render.zGoal = (Render.zGoal || v.z) * (e.deltaY < 0 ? 1.2 : .83); Render.zAnchor = [e.offsetX, e.offsetY]; if (!Settings.v.smooth) { Render.stepZoom(1); } }, { passive:false });
    ov.addEventListener('contextmenu', e => e.preventDefault());
    ov.addEventListener('dblclick', e => { const id = Render.pick(e.offsetX, e.offsetY); if (id && !this.order && this.tab !== 'build') { Render.selProv = id; Render.selState = PROV[id].sea ? 0 : PROV[id].s; Render.dirty = true; this.renderProv(); } });
    ov.addEventListener('mousedown', e => {
      if (!G) return;
      if (e.button === 1) { mdrag = { x:e.clientX, y:e.clientY, vx:Render.view.x, vy:Render.view.y }; e.preventDefault(); return; }
      if (e.button === 2) { rdrag = { x:e.clientX, y:e.clientY, vx:Render.view.x, vy:Render.view.y, moved:false }; return; }
      if (e.button === 0) {
        if (this.order === 'front' || this.order === 'arrow') { stroke = [Render.screenToWorld(e.offsetX, e.offsetY)]; Render.stroke = { kind:this.order, pts:stroke }; return; }
        box = { x0:e.offsetX, y0:e.offsetY, x1:e.offsetX, y1:e.offsetY, moved:false }; Render.box = box;
      }
    });
    window.addEventListener('mousemove', e => {
      const drag = rdrag || mdrag; if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 5) { drag.moved = true; Render.view.x = drag.vx - dx / Render.view.z; Render.view.y = drag.vy - dy / Render.view.z; } }
      if (stroke && e.target === ov) { const w = Render.screenToWorld(e.offsetX, e.offsetY), l = stroke[stroke.length - 1]; if (Math.hypot(w[0] - l[0], w[1] - l[1]) * Render.view.z > 8) stroke.push(w); }
      if (box && e.target === ov) { box.x1 = e.offsetX; box.y1 = e.offsetY; if (Math.abs(box.x1 - box.x0) + Math.abs(box.y1 - box.y0) > 7) box.moved = true; }
      if (e.target === ov && G) { const id = Render.pick(e.offsetX, e.offsetY); Render.hoverState = id && !PROV[id].sea ? PROV[id].s : 0; ov.style.cursor = this.cursorFor(id); const T = $('#tip'); if (id && !box && !drag && !stroke) this.showTip(this.provTip(id), e); else T.classList.add('hidden'); }
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 1) { mdrag = null; return; }
      if (e.button === 2 && rdrag) { const R = rdrag; rdrag = null; if (!R.moved && e.target === ov) this.rightClick(e.offsetX, e.offsetY, e.shiftKey); return; }
      if (e.button !== 0) return;
      if (stroke) { const pts = stroke; stroke = null; Render.stroke = null; this.finishStroke(pts); return; }
      if (!box) return; const b = box; box = null; Render.box = null;
      if (b.moved) { const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1); if (!e.shiftKey) Render.selected.clear(); this.curArmy = null; this.curGroup = null; for (const c of Render.counters) if (c.divs && c.x + c.w > x0 && c.x < x1 && c.y + c.h > y0 && c.y < y1) c.divs.forEach(i => Render.selected.add(i)); this.renderBottom(); this.renderArmyBar(); return; }
      if (e.target === ov) this.leftClick(e.offsetX, e.offsetY, e.shiftKey);
    });
  },
  cursorFor(id) {
    if (this.order === 'front' || this.order === 'arrow') return CURSORS.pen;
    if (this.order === 'landing') return id && !PROV[id].sea && PROV[id].coastal ? CURSORS.move : CURSORS.no;
    if (this.tab === 'build' && id && !PROV[id].sea) return canBuild(this.me(), G.st[PROV[id].s], this.sel.buildType, id) ? CURSORS.no : CURSORS.build;
    if (Render.selected.size && id && !PROV[id].sea) { const ct = G.ctrl[id]; if (isEnemy(G.player, ct)) return CURSORS.attack; return canEnter(G.player, id) ? CURSORS.move : CURSORS.no; }
    return 'default';
  },
  provTip(id) {
    const P = PROV[id]; if (P.sea) return P.name; const st = G.st[P.s], ct = G.ctrl[id], c = C(ct), me = this.me(), city = G.cities.find(x => x.p === id);
    let t = `${st.name}${city ? ' (' + city.n + ')' : ''}\n${c?.n || ''}${isEnemy(me.t, ct) ? ' — враг' : isAlly(me.t, ct) && ct !== me.t ? ' — союзник' : ''}\n${TERRAIN[P.t].n}, ${WEATHER[weatherOf(id)].n}${G.fort[id] ? ', форт ' + G.fort[id] : ''}${G.vp[id] ? ', очки победы ' + G.vp[id] : ''}`;
    if (this.tab === 'build') { const e = canBuild(me, st, this.sel.buildType, id); t += `\nСлоты: ${usedSlots(st)}/${st.slots + (me.slotBonus || 0)}\n${e || 'Щёлкните, чтобы построить: ' + DB.BUILD[this.sel.buildType].n}`; }
    else if (me.sup) t += `\nСнабжение: ${pct(me.sup[id])}`;
    return t;
  },
  finishStroke(pts) {
    const c = this.me(), A = this.curGroup ? G.groups[this.curGroup] : G.armies[this.curArmy]; if (!A) return this.setOrder(null);
    if (this.order === 'arrow') { const [x, y] = pts[pts.length - 1]; const id = Render.pickWorld(x, y); if (!id || PROV[id].sea) { this.err('Цель должна быть на суше'); return; } A.target = id; Sound.play('order'); this.setOrder(null); this.renderArmyBar(); return; }
    // Просто щелчок: фронт по всей границе с этой страной
    let drawn = 0; for (let i = 1; i < pts.length; i++) drawn += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (drawn * Render.view.z < 24) {
      const id = Render.pickWorld(pts[0][0], pts[0][1]); if (!id || PROV[id].sea) return this.err('Щёлкните по стране на карте'); let t = G.ctrl[id];
      if (t === c.t || isAlly(c.t, t)) { let bd = 1e18; t = null; for (const P of M.prov) { const o = G.ctrl[P.i]; if (!o || o === c.t || isAlly(c.t, o) || !P.land.some(a => friendly(c.t, a))) continue; const d = (P.x - pts[0][0]) ** 2 + (P.y - pts[0][1]) ** 2; if (d < bd) { bd = d; t = o; } } }
      if (!t) return this.err('Рядом нет границы с другой страной'); if (!M.prov.some(P => G.ctrl[P.i] === t && P.land.some(a => friendly(c.t, a)))) return this.err('С этой страной нет общей границы');
      A.front = t; A.line = null; A.lineTags = null; A.target = null; if (this.curArmy && A.group) A.indep = true; this.applyFront(c, A); return;
    }
    // Протяжка: участок только против одной страны, под которой прошла линия больше всего
    const score = {}; for (const [x, y] of pts) { const id = Render.pickWorld(x, y); if (!id || PROV[id].sea) continue; const P = PROV[id], here = G.ctrl[id]; if (here && !friendly(c.t, id)) { score[here] = (score[here] || 0) + 3; continue; } for (const a of P.land) { const o = G.ctrl[a]; if (o && !friendly(c.t, a)) score[o] = (score[o] || 0) + 1; } }
    let best = null, bv = 0; for (const t in score) { const v = score[t] * (isEnemy(c.t, t) ? 3 : 1); if (v > bv) { bv = v; best = t; } }
    if (!best) return this.err('Проведите линию вдоль границы с другой страной');
    const tags = { [best]:true };
    A.front = 'line'; A.line = pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1); A.lineTags = tags; A.target = null; if (this.curArmy && A.group) A.indep = true; this.applyFront(c, A);
  },
  applyFront(c, X) { if (this.curGroup) runGroupFront(c, X); for (const a of Object.values(G.armies)) if (a.tag === c.t && (a === X || (this.curGroup && a.group === X.id))) runArmyFront(c, a); Sound.play('order'); this.setOrder(null); this.renderArmyBar(); },
  leftClick(x, y, shift) {
    const id = Render.pick(x, y);
    if (Shell.canvasUsed()) { const t = id && !PROV[id].sea ? G.ctrl[id] : null; if (t && DB.COUNTRIES.some(d => d.t === t)) { Shell.pickTag = t; Sound.play('click'); Shell.renderPick(); } return; }
    if (G.preview) return;
    if (this.order === 'landing') { if (id && !PROV[id].sea) { const e = orderLanding([...Render.selected].map(i => G.divs[i]).filter(Boolean), id); if (this.err(e)) { Sound.play('order'); this.toast('Войска грузятся на суда', 'good'); } this.setOrder(null); } return; }
    if (G.peace && id && !PROV[id].sea) { const s = PROV[id].s; if (G.peace.lands.includes(s)) { if (G.peace.taken[s] === G.player) peaceUndo(s); else this.err(peaceTake(s)); G.ctrlDirty = true; this.renderPeace(); return; } }
    if (this.tab === 'build') { if (id && !PROV[id].sea) { const e = queueBuild(this.me(), G.st[PROV[id].s], this.sel.buildType, id); if (this.err(e)) { Sound.play('build'); const [wx, wy] = Render.screenToWorld(x, y); Render.ping(wx, wy, '#ffd66b'); } this.renderPanel(); this.renderAlerts(); } return; }
    for (const b of Render.battleHit || []) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { UI.A.battle(b.prov); return; }
    for (const f of Render.fleetHit || []) if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) { if (G.fleets[f.fleet]?.tag === G.player) { UI.sel.fleet = f.fleet; if (UI.tab !== 'navy') UI.openTab('navy'); else UI.renderPanel(); } return; }
    for (let i = Render.counters.length - 1; i >= 0; i--) { const c = Render.counters[i]; if (c.divs && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) { if (!shift) Render.selected.clear(); this.curArmy = c.army || null; this.curGroup = null; c.divs.forEach(d => Render.selected.add(d)); Sound.play('click'); this.renderBottom(); this.renderArmyBar(); return; } }
    // Снятие выделения не открывает окно: иначе промах по карте закрывал бы текущую работу
    if (Render.selected.size) { Render.selected.clear(); this.curArmy = null; this.curGroup = null; this.renderBottom(); this.renderArmyBar(); return; }
    if (id && !PROV[id].sea && G.ctrl[id]) { const t = G.ctrl[id]; Sound.play('open'); if (t === G.player) { if (this.tab !== 'politics') this.openTab('politics'); } else { this.sel.country = t; if (this.tab !== 'diplo') this.openTab('diplo'); else this.renderPanel(); } }
  },
  rightClick(x, y, shift) {
    const id = Render.pick(x, y); if (!id) return;
    if (PROV[id].sea) { const f = G.fleets[UI.sel.fleet]; if (this.tab === 'navy' && f && f.tag === G.player) { orderFleet(f, id, f.mission === 'base' ? 'patrol' : f.mission); Sound.play('order'); UI.renderPanel(); } return; }
    if (G.preview || !Render.selected.size) return; let ok = 0, fail = 0; for (const i of Render.selected) { const d = G.divs[i]; if (!d) continue; if (orderMove(d, id, shift)) ok++; else fail++; }
    if (ok) { Sound.play('order'); const [wx, wy] = Render.screenToWorld(x, y); Render.ping(wx, wy, isEnemy(G.player, G.ctrl[id]) ? '#ff6a4a' : '#8df07a'); } else if (fail) this.err(PROV[id].coastal ? 'Нет сухопутного пути. Используйте кнопку «Морем».' : 'Туда нет пути');
  },
  // ---------- меню и модальные окна ----------
  showMenu() { Shell.show(G && !G.preview ? 'pause' : 'main'); },
  showEvent() { const e = G.pending[0], m = $('#modal'); if (!e) { m.classList.add('hidden'); return; } G.speed = 0; m.removeAttribute('style'); m.classList.remove('hidden'); Sound.play('stamp'); m.innerHTML = `<div class="telegram"><small>ТЕЛЕГРАММА · ${esc(dateStr().split(',')[0])}</small><i class="stamp">СРОЧНО</i><h2>${esc(e.title)}</h2><div>${esc(e.text)}</div><div class="row">${e.options.map((o, i) => `<button data-a="eventPick:${i}">${esc(o.t)}</button>`).join('')}</div></div>`; },
  openPeace() { this.renderPeace(); },
  renderPeace() {
    const P = G.peace, m = $('#modal'); if (!P) { m.classList.add('hidden'); return; } const me = G.player; m.classList.remove('hidden'); m.style.background = 'transparent'; m.style.pointerEvents = 'none'; m.style.alignItems = 'flex-start'; m.style.justifyContent = 'flex-start';
    const byLoser = {}; for (const id of P.lands) { const o = G.st[id].owner; (byLoser[o] = byLoser[o] || []).push(id); }
    m.innerHTML = `<div class="box" style="pointer-events:auto;margin:98px 0 0 6px;width:500px"><h2>Мирная конференция: ${esc(P.war)}</h2><div>Ваши очки: <b class="gold">${P.score[me].toFixed(1)}</b>. Щёлкайте штаты на карте или в списке.</div>
    ${Object.entries(byLoser).map(([t, ids]) => `<h3>${swatch(t)}${esc(C(t).n)} <button data-a="peacePuppet:${t}">Марионетка</button> ${P.puppets[t] ? '<span class="good">будет марионеткой</span>' : ''}</h3><div class="row">${ids.map(id => { const s = G.st[id]; const mine = P.taken[id] === me; return `<button class="${mine ? 'on' : ''}" data-a="peaceToggle:${id}" data-tip="Стоимость ${stateScoreCost(s).toFixed(1)}">${esc(s.name)}</button>`; }).join('')}</div>`).join('')}<div class="row" style="margin-top:9px"><button data-a="peaceDone" class="on">Завершить конференцию</button></div></div>`;
  },
  onPlayerCapitulated() { UI.toast('Ваша страна капитулировала. Партия продолжается, пока идёт война союзников.', 'bad'); },
  onPlayerDead() { const m = $('#modal'); m.removeAttribute('style'); m.classList.remove('hidden'); m.innerHTML = `<div class="box"><h2>Страна прекратила существование</h2><p>Можно наблюдать за миром или начать новую партию.</p><div class="row"><button data-a="closeModal">Наблюдать</button><button data-a="menu">Меню</button></div></div>`; },
};
