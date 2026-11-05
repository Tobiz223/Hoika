// Оболочка игры: настройки, меню, выпадающие списки, большие объявления, защита от случайных действий браузера.
const Settings = {
  v:{ volume:.6, uiScale:1, edge:true, smooth:true },
  load() { try { Object.assign(this.v, JSON.parse(localStorage.getItem('steelFrontier.settings')) || {}); } catch (e) { /* настройки необязательны */ } this.apply(); },
  save() { try { localStorage.setItem('steelFrontier.settings', JSON.stringify(this.v)); } catch (e) { /* настройки необязательны */ } this.apply(); },
  apply() { Sound.volume = this.v.volume; Sound.on = this.v.volume > 0; for (const s of ['#top', '#tabs', '#panel', '#prov', '#armybar', '#plans', '#divlist', '#cmdpick', '#modes', '#alerts']) { const e = $(s); if (e) e.style.zoom = this.v.uiScale; } },
};
function flagUrl(t) { const c = C(t); if (c && c.formedAs) return ''; return `assets/flags/${t}.png`; }

const Shell = {
  screen:'main', pickTag:'GER',
  init() {
    // Браузерное поведение не должно мешать игре
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('dragstart', e => e.preventDefault());
    window.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive:false });
    document.addEventListener('keydown', e => { if (e.ctrlKey && ['KeyS', 'KeyP', 'KeyU', 'KeyF', 'Equal', 'Minus', 'Digit0'].includes(e.code)) { e.preventDefault(); if (e.code === 'KeyS' && G && !G.preview) { UI.toast(Save.write('a') ? 'Партия сохранена в слот A' : 'Не удалось сохранить', 'good'); } } if (e.code === 'F11') { e.preventDefault(); this.fullscreen(); } });
    window.addEventListener('beforeunload', e => { if (G && !G.preview && !window.__noUnloadGuard) { e.preventDefault(); e.returnValue = ''; } });
    // Свой выпадающий список вместо браузерного
    document.addEventListener('mousedown', e => {
      const pop = $('#gsel'); if (pop && !e.target.closest('#gsel')) pop.remove();
      const s = e.target.closest?.('select'); if (!s) return; e.preventDefault(); s.focus(); const r = s.getBoundingClientRect(); const box = document.createElement('div'); box.id = 'gsel';
      box.innerHTML = [...s.options].map(o => `<div data-v="${esc(o.value)}" class="${o.value === s.value ? 'cur' : ''}">${esc(o.textContent)}</div>`).join(''); document.body.appendChild(box);
      const h = Math.min(330, box.offsetHeight); box.style.left = Math.min(r.left, innerWidth - box.offsetWidth - 6) + 'px'; box.style.minWidth = r.width + 'px'; box.style.top = (r.bottom + h > innerHeight ? Math.max(6, r.top - h) : r.bottom) + 'px';
      box.addEventListener('mousedown', ev => { const d = ev.target.closest('[data-v]'); if (!d) return; s.value = d.dataset.v; Sound.play('click'); box.remove(); s.blur(); s.dispatchEvent(new Event('change', { bubbles:true })); });
    });
    document.addEventListener('mouseover', e => { const b = e.target.closest?.('button:not(:disabled)'); if (b && b !== this.lastHover) { this.lastHover = b; Sound.play('hover'); } else if (!b) this.lastHover = null; });
    Settings.load();
  },
  fullscreen() { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* не везде доступно */ } },
  preview() { for (const k in provDivs) delete provDivs[k]; newGame('GER', 1); G.preview = true; G.noAutosave = true; Render.tagIndex = {}; Render.dirty = true; Render.labels = null; Render.mode = 'pol'; Render.selected.clear(); Render.view.x = M.W * .5; Render.view.y = M.H * .5; Render.view.z = .42; },
  show(screen) { this.screen = screen; document.body.classList.add('inmenu'); $('#menu').classList.remove('hidden'); $('#modal').classList.add('hidden'); $('#cmdpick').classList.add('hidden'); if (!G) this.preview(); if (screen === 'pick') { Render.mode = 'pick'; Render.dirty = true; } else if (G.preview && Render.mode === 'pick') { Render.mode = 'pol'; Render.dirty = true; } this.render(); },
  hide() { document.body.classList.remove('inmenu'); $('#menu').classList.add('hidden'); },
  canvasUsed() { return this.screen === 'pick' && G && G.preview; },
  render() {
    const m = $('#menu'), inGame = G && !G.preview; const slots = ['a', 'b', 'c', 'auto'];
    const col = (body, back) => `<div class="mmshade"></div><div class="mmcol"><h1>СТАЛЬНОЙ<br>РУБЕЖ</h1><div class="sub">Европа · 1936</div>${body}${back ? `<button class="mmbtn" data-a="shell:${back}" style="margin-top:9px">Назад</button>` : ''}<div class="mmfoot">Одиночная игра</div></div>`;
    const btn = (a, n, off) => `<button class="mmbtn" data-a="${a}" ${off ? 'disabled' : ''}>${n}</button>`;
    if (this.screen === 'main') m.innerHTML = col(btn('shell:pick', 'Новая игра') + btn('shell:load', 'Загрузить') + btn('shell:settings', 'Настройки') + btn('shell:credits', 'Авторы и лицензии'));
    else if (this.screen === 'pause') m.innerHTML = col(btn('resume', 'Продолжить') + btn('shell:save', 'Сохранить') + btn('shell:load', 'Загрузить') + btn('shell:settings', 'Настройки') + btn('exitMenu', 'Выйти в главное меню'));
    else if (this.screen === 'save') m.innerHTML = col('<h3 style="color:#d9b65e">Сохранить партию</h3>' + ['a', 'b', 'c'].map(s => { const i = Save.meta(s); return btn('saveSlot:' + s, `Слот ${s.toUpperCase()}${i ? ': ' + esc(i.tag) + '<br><small>' + esc(i.date) + '</small>' : ': пусто'}`); }).join(''), 'pause');
    else if (this.screen === 'load') m.innerHTML = col('<h3 style="color:#d9b65e">Загрузить партию</h3>' + slots.map(s => { const i = Save.meta(s); const n = s === 'auto' ? 'Автосохранение' : 'Слот ' + s.toUpperCase(); return btn('loadSlot:' + s, i ? n + ': ' + esc(i.tag) + '<br><small>' + esc(i.date) + '</small>' : n + ': пусто', !i); }).join(''), inGame ? 'pause' : 'main');
    else if (this.screen === 'settings') { const v = Settings.v; m.innerHTML = col(`<div class="mmform"><label>Громкость<input type="range" min="0" max="1" step=".05" value="${v.volume}" data-c="setVal:volume"></label><label>Размер интерфейса<input type="range" min=".8" max="1.4" step=".05" value="${v.uiScale}" data-c="setVal:uiScale"></label><label>Сдвиг карты у края экрана<input type="checkbox" ${v.edge ? 'checked' : ''} data-c="setBool:edge"></label><label>Плавная камера<input type="checkbox" ${v.smooth ? 'checked' : ''} data-c="setBool:smooth"></label><button class="mmbtn" data-a="fullscreen">Полный экран (F11)</button></div>`, inGame ? 'pause' : 'main'); }
    else if (this.screen === 'credits') { const cr = Object.values(window.CREDITS || {}); m.innerHTML = `<div class="mmshade" style="width:640px"></div><div class="mmcol" style="width:560px"><h1 style="font-size:30px">Авторы и лицензии</h1><div class="sub">Карта: Natural Earth, NASA Blue Marble, высоты Mapzen. Шрифты: Oswald, PT Sans, PT Mono (OFL).</div><div class="credits">${cr.map(c => `<div>${esc(c.file.replace('File:', ''))} — ${esc(c.author || 'автор не указан')} · ${esc(c.license || '')}</div>`).join('') || 'Иллюстрации ещё не загружены.'}</div><button class="mmbtn" data-a="shell:main" style="margin-top:9px;flex:none">Назад</button></div>`; }
    else if (this.screen === 'pick') this.renderPick();
  },
  renderPick() {
    const m = $('#menu'), d = DB.COUNTRIES.find(x => x.t === this.pickTag), c = C(d.t); const count = Object.values(G.divs).filter(v => v.tag === d.t).length; const lst = l => l.map(x => `<button class="flagbtn ${x.t === d.t ? 'on' : ''}" data-a="pickCountry:${x.t}"><span class="swatch" style="background:${x.c} url(assets/flags/${x.t}.png)"></span>${esc(x.n)}</button>`).join('');
    const diff = ['Лёгкая', 'Обычная', 'Тяжёлая'].map((n, i) => `<button class="${UI.diff === i ? 'on' : ''}" data-a="diff:${i}">${n}</button>`).join('');
    m.innerHTML = `<div class="mmshade"></div><div class="mmcol" style="padding-top:26px"><h3 style="color:#d9b65e;margin:0">Великие державы</h3><div class="flaggrid">${lst(DB.COUNTRIES.filter(x => x.major))}</div><h3 style="color:#d9b65e">Другие страны</h3><div class="flaggrid">${lst(DB.COUNTRIES.filter(x => !x.major))}</div><button class="mmbtn" data-a="shell:main" style="margin-top:9px">Назад</button></div>
    <div class="pickside"><div class="bigflag" style="background-color:${d.c};background-image:url(assets/flags/${d.t}.png)"></div><h2>${esc(d.n)}</h2><div class="mute" style="color:#a79f88">${esc(d.l)} · ${DB.IDEO[c.i].n}</div>
    <div class="pickstat"><span>Население</span><b>${d.pop} млн</b></div><div class="pickstat"><span>Гражданские заводы</span><b>${d.civ}</b></div><div class="pickstat"><span>Военные заводы</span><b>${d.mil}</b></div><div class="pickstat"><span>Верфи</span><b>${d.dock}</b></div><div class="pickstat"><span>Дивизии</span><b>${count}</b></div><div class="pickstat"><span>Капитуляция при потере</span><b>${pct(surrenderLimit(c))}</b></div>
    <div style="margin-top:12px">Сложность</div><div class="row">${diff}</div><button class="mmbtn go" data-a="startAs:${d.t}" style="margin-top:auto;text-align:center">Начать за страну: ${esc(d.n)}</button></div>`;
    Render.dirty = true;
  },
  // Большое объявление о войне и капитуляциях
  bigNews(kicker, title, sub, kind) {
    const old = $('#bignews'); if (old) old.remove(); if (G && G.preview) return; const d = document.createElement('div'); d.id = 'bignews'; d.className = kind || ''; d.innerHTML = `<small>${esc(kicker)}</small><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`; document.body.appendChild(d); Sound.play(kind === 'war' ? 'drum' : 'stamp'); setTimeout(() => d.remove(), 4300);
  },
};
