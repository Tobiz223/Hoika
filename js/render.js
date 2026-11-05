// Отрисовка карты: WebGL2 (провинции, цвета, границы) и 2D-слой (квадратики дивизий, подписи).
const Render = {
  view:{ x:M.W * .45, y:M.H * .5, z:.32 }, mode:'pol', selProv:0, selState:0, hoverProv:0, counters:[], selected:new Set(), pathPreview:null, box:null, targetMode:null,
  idData:null, lut:null, lutTex:null, gl:null, dirty:true,

  init(glCanvas, overlay, onReady) {
    this.cv = glCanvas; this.ov = overlay; this.ctx = overlay.getContext('2d');
    const gl = this.gl = glCanvas.getContext('webgl2', { antialias:false, preserveDrawingBuffer:true });
    if (!gl) { alert('Нужен браузер с поддержкой WebGL2'); return; }
    const load = (src, cb) => { const im = new Image(); im.onload = () => cb(im); im.src = src; };
    load(window.TEX.prov, im => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d', { willReadFrequently:true }); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, im.width, im.height).data; this.idData = new Uint16Array(im.width * im.height);
      for (let i = 0; i < this.idData.length; i++) this.idData[i] = d[i * 4] + d[i * 4 + 1] * 256;
      this.buildEdges(im.width, im.height);
      const tex = this.mkTex(gl.TEXTURE0, gl.RGBA8, im.width, im.height, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(d.buffer), gl.NEAREST);
      load(window.TEX.base, im2 => {
        gl.activeTexture(gl.TEXTURE1); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, im2); gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.setupGL(); this.resize(); onReady();
      });
    });
  },
  mkTex(unit, ifmt, w, h, fmt, type, data, filter) { const gl = this.gl; gl.activeTexture(unit); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; },
  setupGL() {
    const gl = this.gl;
    const vs = `#version 300 es
in vec2 p; out vec2 sp; void main(){ sp=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;
    const fs = `#version 300 es
precision highp float; precision highp int;
uniform sampler2D uId, uBase, uLut; uniform vec2 uSize, uScreen, uOrigin; uniform float uZ, uTime; uniform int uLandN, uShowProv, uHover;
in vec2 sp; out vec4 o;
int idAt(ivec2 c){ c=clamp(c,ivec2(0),ivec2(uSize)-1); vec4 v=texelFetch(uId,c,0); return int(v.r*255.+.5)+int(v.g*255.+.5)*256; }
vec4 lut(int id,int row){ return texelFetch(uLut,ivec2(id,row),0); }
int stateOf(int id){ vec4 v=lut(id,2); return int(v.r*255.+.5)+int(v.g*255.+.5)*256; }
int ctrlOf(int id){ return int(lut(id,2).b*255.+.5); }
void main(){
  vec2 w = uOrigin + vec2(sp.x, 1.-sp.y)*uScreen/uZ;
  vec3 base = texture(uBase, w/uSize).rgb;
  vec2 f = w-.5; ivec2 ic = ivec2(floor(f)); vec2 fr = fract(f);
  int a=idAt(ic), b=idAt(ic+ivec2(1,0)), c=idAt(ic+ivec2(0,1)), d=idAt(ic+ivec2(1,1));
  // Сглаженная заливка по четырём соседним тексельным id
  vec4 ca=lut(a,0), cb=lut(b,0), cc=lut(c,0), cd=lut(d,0);
  float s=smoothstep(.35,.65,fr.x), t=smoothstep(.35,.65,fr.y);
  vec4 fill = mix(mix(ca,cb,s),mix(cc,cd,s),t);
  vec3 col = mix(base, fill.rgb, fill.a);
  int id = idAt(ivec2(floor(w)));
  // Снег
  float snow = lut(id,1).a; if(id>0 && id<=uLandN && snow>.01) col = mix(col, vec3(.92,.95,1.), snow*.42);
  // Штриховка оккупации
  vec4 inf = lut(id,2); int flags=int(inf.a*255.+.5);
  if((flags&4)!=0){ float st=mod((w.x+w.y)*uZ,18.); if(st<8.) col=mix(base, lut(id,1).rgb, .62); }
  // Границы: в экранных пикселях
  float px = 1./uZ; int here=id;
  float bc=0.,bs=0.,bp=0.,bcoast=0.;
  for(int i=0;i<8;i++){
    vec2 dir=vec2(cos(float(i)*.7854),sin(float(i)*.7854));
    int n1=idAt(ivec2(floor(w+dir*px*1.5))); int n2=idAt(ivec2(floor(w+dir*px*.8)));
    if(n1!=here){
      bool la=here>0&&here<=uLandN, lb=n1>0&&n1<=uLandN;
      if(la&&lb){ if(ctrlOf(n1)!=ctrlOf(here)) bc=1.; else if(stateOf(n1)!=stateOf(here)) bs=1.; else if(uShowProv==1) bp=1.; }
      else if(la!=lb) bcoast=1.;
      else if(here>uLandN&&n1>uLandN&&uShowProv==1) bp=max(bp,.4);
    }
  }
  if(bcoast>0.) col=mix(col,vec3(.06,.07,.08),.75);
  if(bp>0.) col=mix(col,vec3(0.),.28*bp);
  if(bs>0.) col=mix(col,vec3(.05),.5);
  if(bc>0.) col=mix(col,vec3(.03,.02,.02),.92);
  // Выделение
  if((flags&2)!=0) col=mix(col,vec3(1.,.95,.6),.16);
  if(id>0&&id<=uLandN&&stateOf(id)==uHover) col=mix(col,vec3(1.,.98,.85),.13);
  if((flags&1)!=0) col=mix(col,vec3(1.,.95,.5),.3);
  if((flags&8)!=0) col=mix(col,vec3(.45,.9,.5),.3);
  if((flags&16)!=0) col=mix(col,vec3(.95,.3,.25),.4);
  // Виньетка моря
  o=vec4(col,1.);
}`;
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr); this.pr = pr;
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {}; for (const n of ['uId', 'uBase', 'uLut', 'uSize', 'uScreen', 'uOrigin', 'uZ', 'uTime', 'uLandN', 'uShowProv', 'uHover']) this.u[n] = gl.getUniformLocation(pr, n);
    gl.uniform1i(this.u.uId, 0); gl.uniform1i(this.u.uBase, 1); gl.uniform1i(this.u.uLut, 2); gl.uniform2f(this.u.uSize, M.W, M.H); gl.uniform1i(this.u.uLandN, M.landN);
    this.lutW = 2048; this.lut = new Uint8Array(this.lutW * 4 * 3);
    this.lutTex = this.mkTex(gl.TEXTURE2, gl.RGBA8, this.lutW, 3, gl.RGBA, gl.UNSIGNED_BYTE, this.lut, gl.NEAREST);
    this.tagIndex = {};
  },
  resize() {
    const dpr = 1; const w = this.cv.clientWidth * dpr | 0, h = this.cv.clientHeight * dpr | 0;
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; this.ov.width = w; this.ov.height = h; if (this.gl) this.gl.viewport(0, 0, w, h); }
  },
  hexRGB(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; },
  tagIdx(t) { if (!(t in this.tagIndex)) this.tagIndex[t] = Object.keys(this.tagIndex).length + 1; return this.tagIndex[t]; },
  modeColor(P) {
    // возвращает [r,g,b,alpha 0..1] для провинции
    const ct = G.ctrl[P.i], me = G.player;
    switch (this.mode) {
      case 'pick': { const c = C(ct); const on = ct === Shell.pickTag; return [...this.hexRGB(c ? c.color : '#555555'), on ? .92 : .4]; }
      case 'build': { const st = G.st[P.s]; if (st.ctrl !== me) return [50, 50, 50, .55]; const e = canBuild(C(me), st, UI.sel.buildType, P.i); return e ? [110, 95, 75, .65] : [80, 170, 70, .72]; }
      case 'pol': { const c = C(ct); return [...this.hexRGB(c ? c.color : '#555555'), .72]; }
      case 'faction': { if (!ct) return [60, 60, 60, .6]; const c = C(ct); if (c.faction) { const F = G.factions[c.faction]; return [...this.hexRGB(C(F.leader).color), .8]; } return [120, 118, 110, .55]; }
      case 'ideo': { const c = C(ct); return [...this.hexRGB(c ? DB.IDEO[c.i].c : '#555555'), .75]; }
      case 'dip': { if (ct === me) return [70, 170, 80, .75]; if (isEnemy(me, ct)) return [200, 50, 45, .8]; if (isAlly(me, ct)) return [80, 130, 200, .7]; const r = (C(ct)?.rel?.[me] || 0); return r > 30 ? [120, 170, 140, .55] : r < -20 ? [170, 110, 80, .55] : [120, 120, 110, .55]; }
      case 'infra': { const st = G.st[P.s]; const v = st.infra / 5; return [230 * (1 - v) + 40, 200 * v + 40, 60, .78]; }
      case 'res': { const st = G.st[P.s]; let n = 0; for (const r in st.res) n += st.res[r]; if (!n) return [90, 90, 80, .6]; const v = clamp(n / 60, .2, 1); return [255 * v, 180 * v, 30, .85]; }
      case 'ind': { const st = G.st[P.s]; const n = st.civ + st.mil * 1.2 + st.dock; const v = clamp(n / 12, 0, 1); return [80 + 170 * v, 90, 60 + 40 * (1 - v), .78]; }
      case 'sup': { const c = C(me); if (!c.sup) return [90, 90, 90, .5]; const v = c.sup[P.i]; if (v <= 0) return [160, 40, 40, .7]; return [230 * (1 - v) + 20, 200 * v + 30, 50, .75]; }
      case 'ter': { const T = { plains:[176, 190, 110], forest:[50, 110, 60], hills:[170, 140, 90], mountain:[120, 100, 90], marsh:[90, 130, 120], urban:[170, 170, 170], desert:[220, 200, 130] }[P.t]; return [...T, .8]; }
      case 'air': { const st = G.st[P.s]; const zn = st.zone; return [40 + (zn * 73) % 180, 60 + (zn * 151) % 160, 60 + (zn * 211) % 180, .55]; }
      case 'weather': { const w = G.snow[P.i]; return w === 3 ? [220, 235, 255, .85] : w === 2 ? [190, 210, 240, .7] : w === 1 ? [130, 90, 50, .7] : [90, 150, 80, .4]; }
      case 'resist': { const st = G.st[P.s]; const v = clamp(st.resist / 70, 0, 1); return [100 + 150 * v, 150 * (1 - v) + 40, 60, .7]; }
    }
    return [120, 120, 120, .5];
  },
  updateLUT() {
    const L = this.lut, W = this.lutW; const peace = G.peace;
    for (const P of M.prov) {
      const i = P.i; const [r, g, b, a] = this.modeColor(P); let q = i * 4;
      L[q] = r; L[q + 1] = g; L[q + 2] = b; L[q + 3] = a * 255;
      const st = G.st[P.s], own = C(st.owner), ct = G.ctrl[P.i];
      const oc = this.hexRGB(own ? own.color : '#555555'); q = (W + i) * 4; L[q] = oc[0]; L[q + 1] = oc[1]; L[q + 2] = oc[2]; L[q + 3] = (G.snow[i] === 3 ? 1 : G.snow[i] === 2 ? .65 : 0) * 255;
      q = (W * 2 + i) * 4; L[q] = P.s & 255; L[q + 1] = P.s >> 8; L[q + 2] = this.tagIdx(ct || '?');
      let fl = 0; if (this.selProv === i) fl |= 1; if (this.selState === P.s) fl |= 2; if (ct !== st.owner && this.mode === 'pol') fl |= 4;
      if (peace) { if (peace.taken[P.s] === G.player) fl |= 8; else if (peace.taken[P.s]) fl |= 16; else if (peace.lands.includes(P.s)) fl |= 2; }
      L[q + 3] = fl;
    }
    for (const S of M.sea) { let q = S.i * 4; const nav = this.mode === 'navy' && G.zoneNav[S.i]; L[q] = nav ? 60 : 0; L[q + 1] = nav ? 100 : 0; L[q + 2] = nav ? 190 : 0; L[q + 3] = nav ? 100 : (this.selProv === S.i ? 80 : 0); q = (W + S.i) * 4; L[q + 3] = 0; q = (W * 2 + S.i) * 4; L[q] = 0; L[q + 1] = 0; L[q + 2] = 0; L[q + 3] = this.selProv === S.i ? 1 : 0; }
    const gl = this.gl; gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.lutTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, 3, gl.RGBA, gl.UNSIGNED_BYTE, L); this.dirty = false;
    this.labels = null;
  },
  screenToWorld(sx, sy) { return [this.view.x + (sx - this.cv.width / 2) / this.view.z, this.view.y + (sy - this.cv.height / 2) / this.view.z]; },
  worldToScreen(x, y) { return [(x - this.view.x) * this.view.z + this.cv.width / 2, (y - this.view.y) * this.view.z + this.cv.height / 2]; },
  // Точки общей границы каждой пары сухопутных провинций
  buildEdges(w, h) {
    const E = this.edges = new Map(), D = this.idData, L = M.landN; const add = (a, b, x, y) => { const k = a < b ? a * 65536 + b : b * 65536 + a; let e = E.get(k); if (!e) E.set(k, e = []); e.push(x, y); };
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) { const i = x + y * w, a = D[i]; if (!a || a > L) continue; const r = D[i + 1], u = D[i + w]; if (r !== a && r && r <= L) add(a, r, x + 1, y + .5); if (u !== a && u && u <= L) add(a, u, x + .5, y + 1); }
    this.chains = new Map();
  },
  // Упорядоченные отрезки границы (строятся один раз и кэшируются)
  borderChain(a, b) {
    const k = a < b ? a * 65536 + b : b * 65536 + a; let c = this.chains.get(k); if (c) return c; const e = this.edges.get(k); c = []; if (!e) { this.chains.set(k, c); return c; }
    const pts = []; for (let i = 0; i < e.length; i += 2) pts.push([e[i], e[i + 1]]); const left = pts.filter((_, i) => i % 3 === 0); if (pts.length > 1) left.push(pts[pts.length - 1]);
    let cur = 0, far = -1; for (let i = 0; i < left.length; i++) { const v = (left[i][0] - left[0][0]) ** 2 + (left[i][1] - left[0][1]) ** 2; if (v > far) { far = v; cur = i; } }
    let seg = [left[cur]]; const used = new Uint8Array(left.length); used[cur] = 1;
    for (let n = 1; n < left.length; n++) { let bi = -1, bd = 1e18; for (let i = 0; i < left.length; i++) { if (used[i]) continue; const v = (left[i][0] - left[cur][0]) ** 2 + (left[i][1] - left[cur][1]) ** 2; if (v < bd) { bd = v; bi = i; } } if (bi < 0) break; used[bi] = 1; if (bd > 64) { if (seg.length > 1) c.push(seg); seg = []; } seg.push(left[bi]); cur = bi; }
    if (seg.length > 1) c.push(seg); this.chains.set(k, c); return c;
  },
  drawFrontBorder(g, c, X, list, color, width) {
    if (!list || !list.length) return; const v = this.view, W = this.ov.width, H = this.ov.height; const segs = [];
    for (const p of list) { const P = PROV[p]; const [sx, sy] = this.worldToScreen(P.x, P.y); if (sx < -200 || sy < -200 || sx > W + 200 || sy > H + 200) continue; for (const a of P.land) if (frontFoe(c, X, G.ctrl[a])) for (const s of this.borderChain(p, a)) segs.push(s); }
    if (!segs.length) return; g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; const tr = () => { g.beginPath(); for (const s of segs) { s.forEach(([x, y], i) => { const a = (x - v.x) * v.z + W / 2, b = (y - v.y) * v.z + H / 2; if (i) g.lineTo(a, b); else g.moveTo(a, b); }); } g.stroke(); };
    g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = width + 3; tr(); g.strokeStyle = color; g.lineWidth = width; tr(); g.restore();
  },
  stepZoom(k) { if (!this.zGoal) return; const v = this.view, [ax, ay] = this.zAnchor || [this.cv.width / 2, this.cv.height / 2], [wx, wy] = this.screenToWorld(ax, ay), minZ = Math.max(this.cv.width / M.W, this.cv.height / M.H) * .98; this.zGoal = clamp(this.zGoal, minZ, 6); v.z += (this.zGoal - v.z) * k; const [nx, ny] = this.screenToWorld(ax, ay); v.x += wx - nx; v.y += wy - ny; if (Math.abs(this.zGoal - v.z) < .002) { v.z = this.zGoal; this.zGoal = 0; } },
  ping(x, y, color) { (this.pings = this.pings || []).push({ x, y, color, t:performance.now() }); },
  drawPings(g) { if (!this.pings || !this.pings.length) return; const now = performance.now(); this.pings = this.pings.filter(p => now - p.t < 520); for (const p of this.pings) { const k = (now - p.t) / 520, [sx, sy] = this.worldToScreen(p.x, p.y); g.strokeStyle = p.color; g.globalAlpha = 1 - k; g.lineWidth = 2.5; g.beginPath(); g.arc(sx, sy, 4 + k * 22, 0, 7); g.stroke(); g.beginPath(); g.arc(sx, sy, 2 + k * 11, 0, 7); g.stroke(); g.globalAlpha = 1; } },
  pickWorld(x, y) { const X = x | 0, Y = y | 0; if (X < 0 || Y < 0 || X >= M.W || Y >= M.H) return 0; return this.idData[X + Y * M.W]; },
  pick(sx, sy) { const [x, y] = this.screenToWorld(sx, sy); const X = x | 0, Y = y | 0; if (X < 0 || Y < 0 || X >= M.W || Y >= M.H) return 0; return this.idData[X + Y * M.W]; },
  clampView() { const v = this.view; const minZ = Math.max(this.cv.width / M.W, this.cv.height / M.H) * .98; v.z = clamp(v.z, minZ, 6); const hw = this.cv.width / 2 / v.z, hh = this.cv.height / 2 / v.z; v.x = clamp(v.x, Math.min(hw, M.W / 2), Math.max(M.W - hw, M.W / 2)); v.y = clamp(v.y, Math.min(hh, M.H / 2), Math.max(M.H - hh, M.H / 2)); },
  draw() {
    if (!G) return; this.resize(); this.clampView(); if (G.ctrlDirty || this.dirty) { this.updateLUT(); G.ctrlDirty = false; }
    const gl = this.gl, v = this.view; const w = this.cv.width, h = this.cv.height;
    gl.uniform2f(this.u.uScreen, w, h); gl.uniform2f(this.u.uOrigin, v.x - w / 2 / v.z, v.y - h / 2 / v.z); gl.uniform1f(this.u.uZ, v.z); gl.uniform1i(this.u.uShowProv, v.z > .55 ? 1 : 0); gl.uniform1i(this.u.uHover, this.hoverState || -1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.drawOverlay();
  },
  // Подписи стран
  buildLabels() {
    const groups = {}; const seen = new Set(); this.labels = [];
    for (const P of M.prov) { if (seen.has(P.i)) continue; const ct = G.ctrl[P.i]; if (!ct) continue; const q = [P.i]; seen.add(P.i); const pts = [];
      for (let i = 0; i < q.length; i++) { const u = PROV[q[i]]; pts.push([u.x, u.y, u.a]); for (const a of u.land) if (!seen.has(a) && G.ctrl[a] === ct) { seen.add(a); q.push(a); } }
      (groups[ct] = groups[ct] || []).push(pts); }
    for (const t in groups) {
      const big = groups[t].sort((a, b) => b.length - a.length)[0]; if (big.length < 2 && C(t).pop > .5 && !['LUX','ICE','ALB'].includes(t)) continue;
      let mx = 0, my = 0, W = 0; for (const [x, y, a] of big) { mx += x * a; my += y * a; W += a; } mx /= W; my /= W;
      let xx = 0, yy = 0, xy = 0; for (const [x, y, a] of big) { xx += a * (x - mx) ** 2; yy += a * (y - my) ** 2; xy += a * (x - mx) * (y - my); }
      let ang = .5 * Math.atan2(2 * xy, xx - yy); ang = clamp(ang, -.55, .55);
      const ext = Math.sqrt(Math.max(xx, yy) / W) * 3.2; this.labels.push({ t:C(t).n.toUpperCase(), x:mx, y:my, ang, ext:Math.max(ext, 60), tag:t });
    }
  },
  drawOverlay() {
    const g = this.ctx, v = this.view; g.clearRect(0, 0, this.ov.width, this.ov.height);
    if (!this.labels) this.buildLabels();
    // страны
    if (v.z < .8) for (const L of this.labels) {
      const [sx, sy] = this.worldToScreen(L.x, L.y); const ext = L.ext * v.z; const fs = clamp(ext / Math.max(4, L.t.length) * 1.25, 8, 42); if (fs < 9) continue;
      if (sx < -200 || sy < -100 || sx > this.ov.width + 200 || sy > this.ov.height + 100) continue;
      g.save(); g.translate(sx, sy); g.rotate(L.ang); g.font = `600 ${fs}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = fs * .16; g.strokeStyle = 'rgba(0,0,0,.55)'; g.fillStyle = 'rgba(246,238,216,.9)';
      const sp = L.t.split('').join(' '); g.strokeText(sp, 0, 0); g.fillText(sp, 0, 0); g.restore();
    }
    // города
    if (v.z > .28) { g.textAlign = 'left'; g.textBaseline = 'middle'; for (const c of G.cities) { const minVP = v.z < .4 ? 20 : v.z < .7 ? 8 : v.z < 1.1 ? 3 : 1; if (c.vp < minVP) continue; const [sx, sy] = this.worldToScreen(c.x, c.y); if (sx < -40 || sy < -20 || sx > this.ov.width + 40 || sy > this.ov.height + 20) continue;
      g.fillStyle = c.vp >= 20 ? '#ffd66b' : '#f0e8d0'; g.strokeStyle = '#111'; g.lineWidth = 1; g.beginPath(); g.arc(sx, sy, c.vp >= 20 ? 3.2 : 2.2, 0, 7); g.fill(); g.stroke(); g.font = `${c.vp >= 20 ? 600 : 400} ${c.vp >= 20 ? 12 : 11}px Arial`; g.lineWidth = 2.5; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(c.n, sx + 5, sy); g.fillStyle = '#f5efdd'; g.fillText(c.n, sx + 5, sy); } }
    // зона морей
    if (v.z > .25) { g.font = 'italic 11px Georgia, serif'; g.fillStyle = 'rgba(190,215,235,.55)'; g.textAlign = 'center'; for (const s of M.sea) { const [sx, sy] = this.worldToScreen(s.x, s.y); if (s.a < 25000 && v.z < .5) continue; g.fillText(s.name, sx, sy); } }
    // пути выбранных
    if (G.preview) { this.drawPlans(g); return; }
    this.drawPlans(g); this.drawBuildSlots(g); this.drawPaths(g); this.drawFleets(g); this.drawUnits(g); this.drawBattles(g); this.drawLandings(g);
    this.drawPings(g);
    if (this.box) { g.strokeStyle = '#ffe28a'; g.lineWidth = 1.5; g.fillStyle = 'rgba(255,230,140,.12)'; const b = this.box; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); g.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
  },
  polyline(g, pts, color, width) { if (pts.length < 2) return; g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; const tr = () => { g.beginPath(); pts.forEach(([x, y], i) => { const [a, b] = this.worldToScreen(x, y); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke(); }; g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = width + 3; tr(); g.strokeStyle = color; g.lineWidth = width; tr(); g.restore(); },
  drawPlans(g) {
    if (this.stroke) { const s = this.stroke; if (s.kind === 'front') this.polyline(g, s.pts, '#7fe06a', 5); else if (s.pts.length > 1) { const a = s.pts[0], b = s.pts[s.pts.length - 1]; this.arrow(g, a[0], a[1], b[0], b[1], '#d9402f'); } }
    if (this.mode === 'build') return; const c = C(G.player), cur = UI.curArmy, cg = UI.curGroup;
    for (const A of Object.values(G.armies)) { if (A.tag !== G.player || !A._fp || !A.front) continue; const sel = A.id === cur || (cg && A.group === cg); this.drawFrontBorder(g, c, A.front === 'group' ? G.groups[A.group] || A : A, A._fp, A.mode === 'attack' ? (sel ? '#ff6a4a' : 'rgba(225,90,60,.8)') : (sel ? '#8df07a' : 'rgba(120,205,100,.7)'), sel ? 5 : 3); }
  },
  drawBuildSlots(g) {
    if (this.mode !== 'build') return; const me = C(G.player); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 12px Arial';
    for (const st of G.st) { if (!st || st.ctrl !== me.t) continue; const S = STATE_BY_ID[st.id]; if (!S.prov.length) continue; let x = 0, y = 0; for (const p of S.prov) { x += PROV[p].x; y += PROV[p].y; } const [sx, sy] = this.worldToScreen(x / S.prov.length, y / S.prov.length); if (sx < -20 || sy < -20 || sx > this.ov.width + 20 || sy > this.ov.height + 20) continue; const free = st.slots + (me.slotBonus || 0) - usedSlots(st) - queuedSlots(me, st); g.fillStyle = 'rgba(15,15,10,.8)'; g.fillRect(sx - 12, sy - 9, 24, 18); g.strokeStyle = '#c9a24f'; g.lineWidth = 1; g.strokeRect(sx - 12, sy - 9, 24, 18); g.fillStyle = free > 0 ? '#a7ef8f' : '#e08a70'; g.fillText(free, sx, sy); }
  },
  drawPaths(g) {
    g.lineCap = 'round';
    for (const id of this.selected) { if (UI.curArmy || UI.curGroup) break; const d = G.divs[id]; if (!d || !d.path.length) continue; g.strokeStyle = 'rgba(255,220,110,.9)'; g.lineWidth = 2.5; g.setLineDash([9, 7]); g.lineDashOffset = -(performance.now() / 45) % 16; g.beginPath(); let [x, y] = this.worldToScreen(PROV[d.prov].x, PROV[d.prov].y); g.moveTo(x, y); for (const p of d.path) { [x, y] = this.worldToScreen(PROV[p].x, PROV[p].y); g.lineTo(x, y); } g.stroke(); g.setLineDash([]); g.fillStyle = '#ffdc6e'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    // стрелки армий игрока
    for (const A of Object.values(G.armies)) { if (A.tag !== G.player || !A.target || !A._fp || !A._fp.length) continue; let cx = 0, cy = 0; for (const p of A._fp) { cx += PROV[p].x; cy += PROV[p].y; } cx /= A._fp.length; cy /= A._fp.length; this.arrow(g, cx, cy, PROV[A.target].x, PROV[A.target].y, A.mode === 'attack' ? '#d9402f' : '#d9a63a'); }
  },
  arrow(g, x0, y0, x1, y1, color) { const [a, b] = this.worldToScreen(x0, y0), [c, d] = this.worldToScreen(x1, y1); const ang = Math.atan2(d - b, c - a), L = Math.hypot(c - a, d - b); if (L < 16) return; g.save(); g.translate(a, b); g.rotate(ang); g.fillStyle = color; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5; g.globalAlpha = .85; g.beginPath(); g.moveTo(0, -5); g.lineTo(L - 20, -5); g.lineTo(L - 20, -13); g.lineTo(L, 0); g.lineTo(L - 20, 13); g.lineTo(L - 20, 5); g.lineTo(0, 5); g.closePath(); g.fill(); g.stroke(); g.restore(); },
  drawCounter(g, x, y, w, h, tag, ico, count, org, str, sel, inBattle, sideTag) {
    const c = C(tag); const col = c ? c.color : '#666';
    // объёмный квадратик: тень, фаска, блик
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x + 1.5, y + 2, w, h);
    const grd = g.createLinearGradient(x, y, x, y + h); grd.addColorStop(0, this.tint(col, 1.28)); grd.addColorStop(.5, col); grd.addColorStop(1, this.tint(col, .68)); g.fillStyle = grd; g.fillRect(x, y, w, h);
    g.strokeStyle = sel ? '#ffe36b' : 'rgba(10,10,10,.9)'; g.lineWidth = sel ? 2 : 1; g.strokeRect(x + .5, y + .5, w - 1, h - 1);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 1.5, y + h - 2); g.lineTo(x + 1.5, y + 1.5); g.lineTo(x + w - 2, y + 1.5); g.stroke();
    // значок НАТО-типа
    const bx = x + 3, by = y + 3, bw = Math.min(16, w * .5), bh = h - 10;
    g.fillStyle = 'rgba(245,240,225,.92)'; g.fillRect(bx, by, bw, bh); g.strokeStyle = '#111'; g.lineWidth = 1; g.strokeRect(bx + .5, by + .5, bw - 1, bh - 1); g.beginPath();
    if (ico === 'inf' || ico === 'mtn' || ico === 'para' || ico === 'mar') { g.moveTo(bx, by); g.lineTo(bx + bw, by + bh); g.moveTo(bx + bw, by); g.lineTo(bx, by + bh); }
    else if (ico === 'arm') { g.ellipse(bx + bw / 2, by + bh / 2, bw * .36, bh * .28, 0, 0, 7); }
    else if (ico === 'cav') { g.moveTo(bx, by + bh); g.lineTo(bx + bw, by); }
    else { g.moveTo(bx, by); g.lineTo(bx + bw, by + bh); g.moveTo(bx + bw, by); g.lineTo(bx, by + bh); g.moveTo(bx + 2, by + bh - 1.5); g.lineTo(bx + bw - 2, by + bh - 1.5); }
    g.stroke();
    if (ico === 'mtn') { g.fillStyle = '#111'; g.beginPath(); g.moveTo(bx + bw / 2 - 3, by + bh); g.lineTo(bx + bw / 2, by + bh - 4); g.lineTo(bx + bw / 2 + 3, by + bh); g.fill(); }
    // число дивизий
    g.font = '700 11px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.lineWidth = 2.5; g.strokeStyle = 'rgba(0,0,0,.75)'; const tx = x + bw + 3 + (w - bw - 3) / 2; g.strokeText(count, tx, y + (h - 6) / 2); g.fillText(count, tx, y + (h - 6) / 2);
    // полоски: организация и прочность
    g.fillStyle = '#111'; g.fillRect(x + 1, y + h - 6, w - 2, 5); g.fillStyle = org > .5 ? '#5cc05a' : org > .25 ? '#d8b73c' : '#d8503c'; g.fillRect(x + 1, y + h - 6, (w - 2) * clamp(org, 0, 1), 2.5); g.fillStyle = '#7fa8d8'; g.fillRect(x + 1, y + h - 3.2, (w - 2) * clamp(str, 0, 1), 2.2);
  },
  tint(hex, f) { const [r, g, b] = this.hexRGB(hex); return `rgb(${clamp(r * f, 0, 255) | 0},${clamp(g * f, 0, 255) | 0},${clamp(b * f, 0, 255) | 0})`; },
  visibleTag(t) { const me = G.player; return t === me || isAlly(me, t) || isEnemy(me, t); },
  drawUnits(g) {
    this.counters = []; const v = this.view; const W = v.z > .45 ? 40 : 30, H = v.z > .45 ? 26 : 22; const stacks = {};
    for (const k in provDivs) { const arr = provDivs[k]; if (!arr.length) continue; for (const id of arr) { const d = G.divs[id]; if (!d || !this.visibleTag(d.side || d.tag) && !this.visibleTag(d.tag)) continue; const key = k + '|' + d.tag; (stacks[key] = stacks[key] || { prov:+k, tag:d.tag, divs:[] }).divs.push(d); } }
    // На мелком масштабе показываем только игрока и его врагов
        if (v.z < .3) { for (const A of Object.values(G.armies)) { if (A.tag !== G.player || !A.divs.length) continue; let x = 0, y = 0, n = 0, org = 0, str = 0, sel = false; const ico = {}, ids = []; for (const i of A.divs) { const d = G.divs[i]; if (!d) continue; const st = divStats(C(d.tag), d.tpl); x += PROV[d.prov].x; y += PROV[d.prov].y; org += d.org / Math.max(1, st.org); str += d.str; ico[st.ico] = (ico[st.ico] || 0) + 1; n++; ids.push(i); if (this.selected.has(i)) sel = true; } if (!n) continue; const [sx, sy] = this.worldToScreen(x / n, y / n); const best = Object.entries(ico).sort((a, b) => b[1] - a[1])[0][0]; this.drawCounter(g, sx - 22, sy - 14, 44, 28, G.player, best, n, org / n, str / n, sel); this.counters.push({ x:sx - 22, y:sy - 14, w:44, h:28, divs:ids, prov:0, army:A.id }); } for (const key in stacks) if (stacks[key].tag === G.player && stacks[key].divs.every(d => d.army)) delete stacks[key]; }
    const groups = {}; for (const key in stacks) { const S = stacks[key]; (groups[S.prov] = groups[S.prov] || []).push(S); }
    for (const p in groups) {
      const P = PROV[p]; const list = groups[p]; let [sx, sy] = this.worldToScreen(P.x, P.y); if (sx < -60 || sy < -40 || sx > this.ov.width + 60 || sy > this.ov.height + 40) continue;
      list.forEach((S, i) => {
                const moving = S.divs.find(d => d.path.length && !d.attacking); let x = sx - W / 2 + i * (W + 2) - (list.length - 1) * (W + 2) / 2, y = sy - H / 2;
        if (moving && moving.path.length) { const nx = PROV[moving.path[0]]; const f = clamp(moving.prog / Math.max(1, DIST(moving.prov, moving.path[0])), 0, 1); const [ax, ay] = this.worldToScreen(nx.x, nx.y); x += (ax - sx) * f; y += (ay - sy) * f; }
        let org = 0, str = 0, ico = {}; let sel = false; for (const d of S.divs) { const st = divStats(C(d.tag), d.tpl); org += d.org / Math.max(1, st.org); str += d.str; ico[st.ico] = (ico[st.ico] || 0) + 1; if (this.selected.has(d.id)) sel = true; }
        const n = S.divs.length; const best = Object.entries(ico).sort((a, b) => b[1] - a[1])[0][0];
        this.drawCounter(g, x, y, W, H, S.tag, best, n, org / n, str / n, sel);
        if (S.tag === G.player) this.counters.push({ x, y, w:W, h:H, divs:S.divs.map(d => d.id), prov:+p });
        else this.counters.push({ x, y, w:W, h:H, enemy:true, prov:+p });
      });
    }
  },
  drawBattles(g) {
    this.battleHit = [];
    for (const k in G.battles) {
      const b = G.battles[k], P = PROV[b.prov]; if (!this.visibleTag(b.atkSide) && !this.visibleTag(G.ctrl[b.prov])) continue; const [sx, sy] = this.worldToScreen(P.x, P.y); if (sx < -40 || sy < -40 || sx > this.ov.width + 40 || sy > this.ov.height + 40) continue;
      const x = sx - 9, y = sy - 32, pulse = .5 + .5 * Math.sin(performance.now() / 220); g.fillStyle = `rgba(230,70,40,${.14 + pulse * .22})`; g.beginPath(); g.arc(sx, y + 8, 14 + pulse * 5, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.arc(sx, y + 8, 11, 0, 7); g.fill(); g.strokeStyle = '#e8c55a'; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = '#f3ead2'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(sx - 6, y + 2); g.lineTo(sx + 6, y + 14); g.moveTo(sx + 6, y + 2); g.lineTo(sx - 6, y + 14); g.stroke();
      const adv = clamp((b.lastAdv || 1) / ((b.lastAdv || 1) + 1), 0, 1); g.fillStyle = '#a33'; g.fillRect(sx - 14, y + 20, 28, 4); g.fillStyle = '#5a5'; g.fillRect(sx - 14, y + 20, 28 * adv, 4);
      this.battleHit.push({ x:sx - 13, y:y - 4, w:26, h:30, prov:b.prov });
    }
    // линии атак
    g.strokeStyle = 'rgba(230,70,50,.75)'; g.lineWidth = 2;
    for (const k in G.battles) { const b = G.battles[k]; if (!this.visibleTag(b.atkSide) && !this.visibleTag(G.ctrl[b.prov])) continue; const seen = new Set(); for (const id of b.atk) { const d = G.divs[id]; if (!d || seen.has(d.prov)) continue; seen.add(d.prov); if (d.prov === b.prov) continue; const [a, c] = this.worldToScreen(PROV[d.prov].x, PROV[d.prov].y), [e, f] = this.worldToScreen(PROV[b.prov].x, PROV[b.prov].y); g.beginPath(); g.moveTo(a, c); g.lineTo(e, f); g.stroke(); } }
  },
  drawFleets(g) {
    const zs = {}; for (const id in G.fleets) { const f = G.fleets[id]; if (!f.ships.length || f.mission === 'base' || !this.visibleTag(f.tag)) continue; (zs[f.zone] = zs[f.zone] || []).push(f); }
    this.fleetHit = [];
    for (const z in zs) { const P = PROV[z]; let [sx, sy] = this.worldToScreen(P.x, P.y); sy += 12; zs[z].forEach((f, i) => { const x = sx - 12 + i * 26, y = sy; const col = C(f.tag).color; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x + 1, y + 2, 24, 14); g.fillStyle = col; g.fillRect(x, y, 24, 14); g.strokeStyle = f.tag === G.player ? '#cfe6ff' : '#111'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, 23, 13); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + 3, y + 8); g.lineTo(x + 21, y + 8); g.lineTo(x + 18, y + 12); g.lineTo(x + 6, y + 12); g.fill(); g.font = '700 9px Arial'; g.textAlign = 'center'; g.fillText(f.ships.length, x + 12, y + 5); this.fleetHit.push({ x, y, w:24, h:14, fleet:f.id }); }); }
  },
  drawLandings(g) { for (const L of G.landings) { const d = G.divs[L.divs[0]]; if (!d || L.tag !== G.player) continue; this.arrow(g, PROV[d.prov].x, PROV[d.prov].y, PROV[L.to].x, PROV[L.to].y, '#3f8fd8'); } },
};
