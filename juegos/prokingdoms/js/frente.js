// Frentes (plan de guerra, G2, pk-55): la batalla por una parcela, a la vista en el mapa. El campamento de asedio,
// los dos bandos que chocan, las flechas de las torres, los caídos, la parcela que se va tiñendo con el avance y
// el estandarte del centro que cambia de manos.
// ES SOLO DIBUJO. La batalla la decide el plan (D.asedioPlan, en terr.js) y aquí se pinta el instante «ahora» con
// D.asedioEn: ningún número de balance vive en este archivo, nada de lo que hace entra en el guardado y si el dibujo
// y la barra no coinciden, está mal el dibujo. Las figuras no se simulan: su puesto sale de (semilla, índice, avance)
// y solo se suaviza el paso de un puesto al siguiente.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, W = PK.World, Sp = PK.Sprites;
  const Fr = (PK.Frente = { finales: [], reps: [] });
  const G = () => PK.Game;
  const S = () => PK.Game.state;
  const PS = D.PARCEL, MED = PS / 2;
  // Dirección de avance según el lado por donde entran (T.ladoDe): 0 norte, 1 este, 2 sur, 3 oeste.
  const AVANCE = [[0, 1], [-1, 0], [0, -1], [1, 0]];
  const MAX_A = 14, MAX_D = 12, DETALLE = 3;   // figuras por bando y frentes dibujados con figuras
  const A_DISTANCIA = { archer: 1, crossbow: 1, mage: 1, cleric: 1, catapult: 2 }; // fila desde la que pelean
  const ARMA = { militia: 'hammer', spear: 'spear', knight: 'sword', rider: 'spear', monk: 'hammer' };
  const FINAL = 7;                              // segundos de epílogo (estandarte, festejo o retirada)
  const TELA = [214, 198, 156];

  // ---------- Geometría de la parcela ----------
  // s: profundidad desde el borde por donde entran (0) hasta el del fondo (8); l: de lado, −4 a 4.
  function geo(f) {
    const P = W.PW, x0 = (f.k % P) * PS, y0 = Math.floor(f.k / P) * PS, a = AVANCE[f.lado] || AVANCE[0], p = [-a[1], a[0]];
    const cx = x0 + MED, cy = y0 + MED;
    return { x0, y0, cx, cy, a, p, en: (s, l) => [cx + a[0] * (s - MED) + p[0] * l, cy + a[1] * (s - MED) + p[1] * l] };
  }
  // Hasta dónde llegó la línea de choque y hasta dónde se tiñe el suelo.
  const linea = e => (e.etapa === 0 ? 0.7 + 1.9 * e.f : e.etapa === 1 ? 2.6 + 1.2 * e.f : 3.8);
  const tinte = e => (e.etapa < 2 ? linea(e) : 3.8 + 4.2 * e.f);
  const libre = (x, y) => { x = Math.floor(x); y = Math.floor(y); return W.passable(x, y) && W.bAt[W.idx(x, y)] < 0 && !(W.wall && W.wall[W.idx(x, y)]); };
  // El lugar despejado más cercano al que se pide (las figuras no se paran sobre árboles ni edificios).
  function despejado(esc, x, y) {
    if (libre(x, y)) return [x, y];
    const key = Math.round(x * 2) + ',' + Math.round(y * 2);
    let r = esc.snap.get(key);
    if (r) return r;
    r = [x, y];
    let md = 1e9;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const tx = Math.floor(x) + i, ty = Math.floor(y) + j;
      if (!libre(tx, ty)) continue;
      const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
      if (d < md) { md = d; r = [tx + 0.3 + 0.4 * U.hash(tx, ty, esc.sem % 97), ty + 0.3 + 0.4 * U.hash(ty, tx, esc.sem % 89)]; }
    }
    esc.snap.set(key, r);
    return r;
  }
  const colorDe = (slot, tipo) => (slot === D.MY_SLOT ? (Sp.colorDeTropa ? Sp.colorDeTropa(tipo) : D.PLAYER_COLOR) : Sp.ownerColor(D.ownerOfSlot(slot)));
  const colorReino = slot => (slot === D.MY_SLOT ? D.PLAYER_COLOR : Sp.ownerColor(D.ownerOfSlot(slot)));

  // ---------- El reparto: quién pelea en cada bando ----------
  const ESC = new Map();
  function repartir(n, pesos) { // n figuras según pesos, al menos una de cada peso > 0 si alcanza
    const ks = Object.keys(pesos).filter(k => pesos[k] > 0), tot = ks.reduce((s, k) => s + pesos[k], 0), out = {};
    let quedan = n;
    for (const k of ks) { out[k] = quedan > 0 ? 1 : 0; quedan -= out[k]; }
    for (const k of ks.slice().sort((a, b) => pesos[b] - pesos[a])) { const mas = Math.min(quedan, Math.max(0, Math.round((pesos[k] / tot) * n) - 1)); out[k] += mas; quedan -= mas; }
    if (quedan > 0 && ks.length) out[ks.slice().sort((a, b) => pesos[b] - pesos[a])[0]] += quedan;
    return out;
  }
  function escena(f) {
    let esc = ESC.get(f.id);
    if (esc && esc.sem === f.plan.semilla) return esc;
    const R = U.rng((f.plan.semilla || 1) + 977 + f.k), plan = f.plan;
    esc = { id: f.id, sem: plan.semilla || 1, atk: [], def: [], snap: new Map(), bv: -1, etapa: -1, nuevo: true, tFlecha: 0, tTorre: 0, torres: null };
    // atacantes: los tipos que se mandaron (o una hueste inventada con la semilla, si no se saben)
    let tipos;
    const tot = f.units ? PK.Troops.total(f.units) : 0;
    if (tot > 0) tipos = PK.Troops.pickTypes(f.units, U.clamp(tot, 4, MAX_A));
    else { const base = ['militia', 'spear', 'archer', 'militia', 'spear', 'knight', 'archer', 'militia', 'spear', 'knight']; tipos = base.slice(0, 8 + Math.floor(R() * 3)); }
    const orden = tipos.map((t, i) => [R() + (A_DISTANCIA[t] ? 0.35 : 0), i]).sort((x, y) => x[0] - y[0]).map(x => x[1]); // los de adelante caen antes
    const filas = [[], [], []];
    tipos.forEach((t, i) => filas[A_DISTANCIA[t] || 0].push(i));
    tipos.forEach((t, i) => {
      const fila = A_DISTANCIA[t] || 0, en = filas[fila], j = en.indexOf(i), paso = Math.min(1.05, 6.6 / Math.max(1, en.length));
      esc.atk.push({ lado: 'a', tipo: t, i, fila, l: (j - (en.length - 1) / 2) * paso + (R() - 0.5) * 0.3, umbral: (orden.indexOf(i) + 0.5) / tipos.length, x: 0, y: 0, cayo: 0, cd: R() * 2, fase: R() * 6 });
    });
    // defensores: por etapa, según lo que pesa cada una en la defensa (las partes a escala del plan)
    const peso = {};
    D.ASEDIO.etapas.forEach(id => { peso[id] = D.ASEDIO.partes[id].reduce((s, k) => s + (plan.parts[k] || 0), 0); if (peso[id] < plan.def * 0.02) peso[id] = 0; });
    const cuantos = repartir(MAX_D, peso), era = (PK.Terr.realmInfo(f.a) || { era: S().era }).era;
    const GENTE = { frontera: ['militia', 'spear', 'militia'], defensas: [era >= 4 ? 'crossbow' : 'archer', 'archer'], estandarte: ['knight', 'spear', 'militia', 'archer', 'knight'] };
    D.ASEDIO.etapas.forEach((id, e) => {
      const n = cuantos[id] || 0;
      for (let j = 0; j < n; j++) {
        const tipo = GENTE[id][j % GENTE[id].length], fila = A_DISTANCIA[tipo] ? 1 : 0;
        esc.def.push({ lado: 'd', tipo, i: esc.def.length, etapa: e, j, n, fila, l: (j - (n - 1) / 2) * Math.min(1.1, 6.6 / n) + (R() - 0.5) * 0.3, umbral: (j + 0.3 + 0.5 * R()) / n, x: 0, y: 0, cayo: 0, cd: R() * 2, fase: R() * 6 });
      }
    });
    ESC.set(f.id, esc);
    return esc;
  }

  // ---------- Los frentes que hay que dibujar ----------
  // Los de verdad (terr.js), las repeticiones en curso y los epílogos. Cada uno con su estado (D.asedioEn).
  function todos() {
    const now = Date.now(), pn = performance.now(), out = [];
    if (!S() || D.temaActivo === 'mar') return out;
    for (const f of PK.Terr.frentes()) out.push({ f, e: D.asedioEn(f.plan, (now - f.ini) / 1000), fin: null });
    for (const r of Fr.reps.slice()) {
      const t = ((pn - r.t0) / 1000) * r.vel;
      if (t >= r.f.plan.total) { Fr.reps.splice(Fr.reps.indexOf(r), 1); Fr.final(r.f, r.f.plan.gano); continue; }
      out.push({ f: r.f, e: D.asedioEn(r.f.plan, t), fin: null, rep: true });
    }
    for (const x of Fr.finales.slice()) {
      const t = (pn - x.t0) / 1000;
      if (t > FINAL) { Fr.finales.splice(Fr.finales.indexOf(x), 1); ESC.delete(x.f.id); continue; }
      if (out.some(o => o.f.id === x.f.id)) continue;
      out.push({ f: x.f, e: D.asedioEn(x.f.plan, x.f.plan.total), fin: { t, gano: x.gano } });
    }
    return out;
  }
  // Epílogo: el asedio terminó (terr.js lo avisa con el resultado ya aplicado).
  Fr.final = function (f, ganoAtk) {
    Fr.finales = Fr.finales.filter(x => x.f.id !== f.id);
    Fr.finales.push({ f, gano: !!ganoAtk, t0: performance.now() });
    const g = geo(f), mio = f.de === D.MY_SLOT || f.a === D.MY_SLOT, bien = f.de === D.MY_SLOT ? ganoAtk : !ganoAtk;
    if (PK.Troops) PK.Troops.texts.push({ x: g.cx, y: g.cy, t: 0, text: !mio ? (ganoAtk ? 'Parcela tomada' : 'Asedio rechazado') : bien ? '¡Victoria!' : 'Derrota', col: !mio || bien ? '#ffe27a' : '#ff8a70' });
    if (ganoAtk && PK.Render.burst && visible(g)) PK.Render.burst(g.cx, g.cy, colorReino(f.de), 40);
  };
  // «Ver de nuevo»: la batalla guardada (st.terr.battles[i].rep), acelerada, en el mismo lugar.
  Fr.repetir = function (b, sinCamara) {
    if (!b || !b.rep || !b.rep.plan) return false;
    const r = b.rep, f = { id: 'r' + b.k, k: b.k, de: r.de, a: r.a, lado: r.lado || 0, plan: r.plan, units: r.units, rep: true };
    Fr.reps = Fr.reps.filter(x => x.f.id !== f.id);
    Fr.finales = Fr.finales.filter(x => x.f.id !== f.id);
    ESC.delete(f.id);
    Fr.reps.push({ f, t0: performance.now(), vel: Math.max(4, r.plan.total / 40) });
    const g = geo(f);
    if (PK.Troops) PK.Troops.texts.push({ x: g.cx, y: g.cy, t: 0, text: 'Repetición', col: '#cfe0ff' });
    if (!sinCamara) acercar(g);
    return true;
  };
  function acercar(g) {
    const R = PK.Render;
    R.centerOn(g.cx, g.cy);
    if (R.cam && R.cam.z < 2 && Math.min(window.innerWidth, window.innerHeight) >= 560) { R.cam.z = 2; R.clampCam(); R.centerOn(g.cx, g.cy); }
  }
  Fr.ver = f => acercar(geo(f));
  let visFn = null;
  function visible(g) { const [px, py] = PK.Render.iso(g.cx, g.cy); return !visFn || visFn(px - 190, py - 110, 380, 230); }

  // ---------- Suelo: el avance teñido, la línea, el borde en disputa y el anillo del estandarte ----------
  Fr.suelo = function (ctx, vis) {
    visFn = vis || visFn;
    const R = PK.Render, lista = todos();
    if (!lista.length) return;
    const pn = performance.now(), quieto = !!PK.menosMov, dal = Sp.daltonico && Sp.daltonico();
    const poli = pts => { ctx.beginPath(); pts.forEach(([x, y], i) => { const [px, py] = R.iso(x, y); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.closePath(); };
    for (const { f, e, fin } of lista) {
      const g = geo(f);
      if (!visible(g)) continue;
      const col = colorReino(f.de).map(c => Math.min(255, c + 30)), banda = (s0, s1) => [g.en(s0, -MED), g.en(s0, MED), g.en(s1, MED), g.en(s1, -MED)];
      let hasta = tinte(e), alfa = 0.3;
      if (fin) { if (fin.gano) { hasta = PS; alfa = 0.3 * Math.max(0, 1 - fin.t / FINAL); } else hasta = tinte(e) * Math.max(0, 1 - fin.t / 3); }
      if (hasta > 0.05 && alfa > 0.01) {
        const pt = dal ? Sp.patronSlotDe(D.ownerOfSlot(f.de)) : -1;
        ctx.fillStyle = pt >= 0 ? Sp.trama(ctx, pt, col, alfa) : 'rgba(' + col.join(',') + ',' + alfa.toFixed(2) + ')';
        poli(banda(0, hasta)); ctx.fill();
        // rayas a lo ancho, una por casilla: se lee como terreno tomado y no como una sombra
        ctx.strokeStyle = 'rgba(' + col.join(',') + ',' + (alfa * 1.3).toFixed(2) + ')'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let s = 0.5; s < hasta; s += 1) { const a = R.iso(...g.en(s, -MED)), b = R.iso(...g.en(s, MED)); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
        ctx.stroke();
      }
      if (!fin) {
        // la línea del frente, que late
        const late = quieto ? 0.75 : 0.55 + 0.35 * Math.sin(pn / 220);
        ctx.strokeStyle = 'rgba(255,238,170,' + late.toFixed(2) + ')'; ctx.lineWidth = 2;
        const a = R.iso(...g.en(hasta, -MED)), b = R.iso(...g.en(hasta, MED));
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        // borde de la parcela en disputa: guiones rojos y blancos que corren
        const des = quieto ? 0 : -pn / 60;
        ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
        ctx.strokeStyle = 'rgba(232,58,42,0.95)'; ctx.lineDashOffset = des; poli(banda(0.12, PS - 0.12)); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineDashOffset = des + 6; poli(banda(0.12, PS - 0.12)); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
      }
      // el anillo del estandarte: se llena con el avance de la última etapa
      if (e.etapa === 2 && !fin) {
        const [px, py] = R.iso(g.cx, g.cy), rx = 1.35 * 22.6, ry = 1.35 * 11.3;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,12,6,0.55)';
        ctx.beginPath(); ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(' + col.join(',') + ',0.95)';
        ctx.beginPath(); ctx.ellipse(px, py, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * U.clamp(e.f, 0, 1)); ctx.stroke();
      }
      ctx.lineWidth = 1;
    }
  };

  // ---------- Sprites propios: tienda del campamento, y uno vacío para lo que se pinta a mano ----------
  const TIENDAS = {};
  let VACIO = null;
  function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function vacio() { return VACIO || (VACIO = { c: lienzo(1, 1) }); }
  function tienda(col) {
    const key = col.join(',');
    if (TIENDAS[key]) return TIENDAS[key];
    const c = lienzo(24, 20), x = c.getContext('2d'), rgb = (v, k) => 'rgb(' + v.map(n => Math.round(U.clamp(n * k, 0, 255))).join(',') + ')';
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(3, 17, 19, 2);
    for (let y = 0; y < 12; y++) { // lona: un triángulo con el lado derecho en sombra
      const w = 2 + y * 1.6, x0 = Math.round(12 - w / 2);
      x.fillStyle = rgb(TELA, 1); x.fillRect(x0, 6 + y, Math.ceil(w / 2), 1);
      x.fillStyle = rgb(TELA, 0.74); x.fillRect(x0 + Math.ceil(w / 2), 6 + y, Math.floor(w / 2), 1);
    }
    x.fillStyle = '#2a1a10'; for (let y = 0; y < 6; y++) x.fillRect(11 - Math.floor(y / 3), 12 + y, 2 + Math.floor(y / 2), 1); // la entrada
    x.fillStyle = rgb(col, 0.9); x.fillRect(3, 16, 18, 1);                 // franja del color del reino
    x.fillStyle = '#3a2a1a'; x.fillRect(12, 1, 1, 6);                      // mástil y gallardete
    x.fillStyle = rgb(col, 1); x.fillRect(13, 1, 5, 3); x.fillStyle = rgb(col, 0.7); x.fillRect(13, 3, 3, 1);
    return (TIENDAS[key] = { c });
  }

  // ---------- Las figuras ----------
  function cara(dx, dy) { return { flip: dx - dy < 0, back: dx + dy < 0 }; }
  function sprite(fig, col, modo, cuadro, c) {
    if (fig.tipo === 'catapult' || (D.ARMY[fig.tipo] || {}).maquina) return Sp.cart(col, fig.tipo === 'catapult' ? 'stone' : 'wood', c.flip, cuadro % 4, modo === 'walk'); // G5: las máquinas van sobre ruedas
    return Sp.troop(fig.tipo, col, modo, cuadro, c.flip, c.back, modo === 'work' ? ARMA[fig.tipo] || null : null, fig.i);
  }
  function item(fig, col, modo, cuadro, c, salto, id) {
    const [px, py0] = PK.Render.iso(fig.x, fig.y), py = py0 - (salto || 0), spr = sprite(fig, col, modo, cuadro, c);
    return { d: fig.x + fig.y, k: 'troop', o: { frente: id, enemy: true }, spr, x: px - spr.ax, y: py - spr.ay, px, py };
  }
  // Una figura caída: el mismo dibujo, tendido, que se desvanece.
  function caido(fig, col, edad, id) {
    const [px, py] = PK.Render.iso(fig.x, fig.y), spr = sprite(fig, col, 'idle', 0, { flip: fig.i % 2 === 0, back: false });
    const alfa = U.clamp(1.2 - edad / 6, 0, 1), giro = (fig.i % 2 ? 1 : -1) * Math.min(1, edad * 5) * Math.PI / 2;
    return {
      d: fig.x + fig.y - 0.4, k: 'troop', o: { frente: id, enemy: true }, spr: vacio(), x: px, y: py, px, py,
      after: ctx => {
        ctx.save(); ctx.globalAlpha = alfa; ctx.translate(Math.round(px), Math.round(py) - 2); ctx.rotate(giro);
        if (spr.k) ctx.drawImage(spr.c, -spr.ax, -spr.ay, spr.w, spr.h); else ctx.drawImage(spr.c, -spr.ax, -spr.ay);
        ctx.restore();
      },
    };
  }
  function mover(fig, x, y, dt, vel, ya) {
    if (ya) { fig.x = x; fig.y = y; return false; }
    const dx = x - fig.x, dy = y - fig.y, d = Math.hypot(dx, dy);
    if (d < 0.08) return false;
    const paso = Math.min(d, vel * dt);
    fig.x += (dx / d) * paso; fig.y += (dy / d) * paso; fig.dx = dx / d; fig.dy = dy / d;
    return d > 0.2;
  }
  function flecha(de, a, alto, col, fn) {
    if (!PK.Life || PK.Life.arrows.length > 60) return;
    const d = Math.hypot(a.x - de.x, a.y - de.y);
    PK.Life.arrows.push({ x0: de.x, y0: de.y, z0: alto, w: { x: a.x, y: a.y }, t: 0, dur: Math.max(0.18, d / 11), dmg: 0, col: col || null, fn: fn || (() => {}) });
  }
  function polvo(x, y, n) {
    const [px, py] = PK.Render.iso(x, y), P = PK.Render.particles;
    for (let i = 0; i < n; i++) P.push({ x: px + (Math.random() - 0.5) * 10, y: py - 3, vx: (Math.random() - 0.5) * 16, vy: -6 - Math.random() * 7, life: 0, max: 0.8, s: 1, puff: [196, 176, 140] });
  }
  // Las torres y el Centro Urbano del defensor que alcanzan la parcela (las mismas 18 casillas de D.parcelDefenseParts).
  function torresDe(esc, f, g) {
    const bv = G().blockVer;
    if (esc.torres && esc.bv === bv) return esc.torres;
    esc.bv = bv; esc.snap.clear();
    const dueno = D.ownerOfSlot(f.a);
    esc.torres = G().buildings.filter(b => b.owner === dueno && b.done && (b.type === 'tower' || b.type === 'tc' || b.type === 'fuerte') && Math.hypot(b.cx - g.cx, b.cy - g.cy) < 18);
    return esc.torres;
  }

  // Lo que dibuja render.js junto con aldeanos y edificios (ordenado por profundidad).
  Fr.collect = function (list, dt, vis) {
    visFn = vis;
    const lista = todos();
    if (!lista.length) { if (ESC.size) ESC.clear(); return; }
    const pn = performance.now() / 1000, R = PK.Render;
    const push = it => { const w = it.spr.k ? it.spr.w : it.spr.c.width, h = it.spr.k ? it.spr.h : it.spr.c.height; if (vis(it.x - 12, it.y - 12, w + 24, h + 24)) list.push(it); };
    let detalle = 0;
    for (const { f, e, fin, rep } of lista) {
      const g = geo(f);
      if (!visible(g) || ++detalle > DETALLE) continue;
      const esc = escena(f), torres = torresDe(esc, f, g), ya = esc.nuevo;
      const colA = t => colorDe(f.de, t), colD = t => colorDe(f.a, t), ca = cara(g.a[0], g.a[1]), cd = cara(-g.a[0], -g.a[1]);
      const li = linea(e), anillo = e.etapa === 2;

      // --- campamento de asedio: dos tiendas, la fogata y el estandarte del atacante
      if (!fin || !fin.gano || fin.t < 3) {
        for (const l of [-1.7, 1.7]) {
          const [x, y] = despejado(esc, ...g.en(-1.5, l)), [px, py] = R.iso(x, y), spr = tienda(colorReino(f.de));
          push({ d: x + y, k: 'troop', o: { frente: f.id, enemy: true }, spr, x: Math.round(px - 12), y: Math.round(py - 16), px, py });
        }
        const [fx, fy] = despejado(esc, ...g.en(-1.2, 0)), [px, py] = R.iso(fx, fy);
        if (Math.random() < dt * 5) R.particles.push({ x: px + (Math.random() - 0.5) * 3, y: py - 3, vx: 2, vy: -9, life: 0, max: 1.6, s: 1, c: 80 });
        if (Math.random() < dt * 4) R.particles.push({ x: px + (Math.random() - 0.5) * 4, y: py - 2, vx: (Math.random() - 0.5) * 6, vy: -12, life: 0, max: 0.5, s: 1, rgb: [255, 150, 60] });
      }

      // --- quién sigue en pie
      const vivosA = [], vivosD = [];
      for (const a of esc.atk) {
        const cae = e.bajasA >= a.umbral;
        if (cae && !a.cayo) a.cayo = ya ? -1 : pn;
        if (!cae) vivosA.push(a);
      }
      for (const d of esc.def) {
        const cae = d.etapa < e.etapa || (d.etapa === e.etapa && e.f >= d.umbral && !(fin && !fin.gano));
        if (cae && !d.cayo) d.cayo = ya ? -1 : pn;
        if (!cae) vivosD.push(d);
      }

      // --- atacantes
      for (const a of esc.atk) {
        const col = colA(a.tipo);
        if (a.cayo) { if (a.cayo > 0 && pn - a.cayo < 6) push(caido(a, col, pn - a.cayo, f.id)); continue; }
        let s = li - 0.5 - a.fila * 0.75, l = a.l, festeja = false, vuelve = false;
        if (anillo && !fin) { const ang = (a.i / esc.atk.length) * Math.PI * 1.5 - Math.PI * 0.75, r = 1.9 + a.fila * 0.7; s = MED - Math.cos(ang) * r; l = Math.sin(ang) * r; }
        if (fin) { if (fin.gano) { const ang = (a.i / esc.atk.length) * Math.PI * 2, r = 1.2 + a.fila * 0.5; s = MED - Math.cos(ang) * r; l = Math.sin(ang) * r; festeja = true; } else { s = -1.4; vuelve = true; } }
        const [x, y] = despejado(esc, ...g.en(s, l));
        if (ya) { const [ix, iy] = e.etapa === 0 && e.k < 0.08 ? g.en(-1.2, a.l * 0.5) : [x, y]; a.x = ix; a.y = iy; }
        const anda = mover(a, x, y, dt, vuelve ? 2.6 : 2.3, false);
        if (vuelve && !anda) continue; // llegó al campamento: ya se fue
        const c = anda ? cara(a.dx || g.a[0], a.dy || g.a[1]) : ca, pelea = !anda && !fin && vivosD.length > 0;
        const lejos = !!A_DISTANCIA[a.tipo];
        if (pelea && lejos) {
          a.cd -= dt;
          if (a.cd <= 0) {
            a.cd = (a.tipo === 'catapult' ? 3.2 : 1.6) + Math.random() * 1.4;
            const b = a.tipo === 'catapult' && torres.length && e.etapa === 1 ? { x: torres[a.i % torres.length].cx, y: torres[a.i % torres.length].cy } : vivosD[Math.floor(Math.random() * vivosD.length)];
            if (a.tipo === 'catapult') flecha(a, b, 10, '#8a8478', () => { polvo(b.x, b.y, 6); if (R.sonarEnCasilla) R.sonarEnCasilla('pick', b.x, b.y); });
            else if (a.tipo !== 'cleric') flecha(a, b, 12);
          }
        }
        const modo = anda ? 'walk' : pelea && !lejos ? 'work' : 'idle';
        const cuadro = anda ? Math.floor(pn * 9 + a.i * 1.7) % 6 : modo === 'work' ? Math.floor((pn * 1.4 + a.fase) * 4) % 4 : 0;
        const it = item(a, col, modo, cuadro, c, festeja && !anda ? Math.abs(Math.sin(pn * 6 + a.i)) * 3 : 0, f.id);
        if (a.i === 0 && !fin) estandarteDe(it, colorReino(f.de), c.flip);
        push(it);
      }

      // --- defensores
      for (const d of esc.def) {
        const col = colD(d.tipo);
        if (d.cayo) { if (d.cayo > 0 && pn - d.cayo < 6) push(caido(d, col, pn - d.cayo, f.id)); continue; }
        let s, l = d.l, festeja = false;
        if (d.etapa === 2) { const ang = (d.j / Math.max(1, d.n)) * Math.PI * 2 + 0.4, r = 0.75 + d.fila * 0.25; s = MED + Math.cos(ang) * r; l = Math.sin(ang) * r; }
        else if (d.etapa === e.etapa) s = li + 0.5 + d.fila * 0.75;
        else s = d.etapa === 1 ? 3.3 + d.fila * 0.5 : 1.2;
        if (fin && !fin.gano) festeja = true;
        const [x, y] = despejado(esc, ...g.en(s, l));
        const anda = mover(d, x, y, dt, 2.1, ya);
        const enLucha = !fin && vivosA.length > 0 && (d.etapa === e.etapa || d.fila > 0), lejos = d.fila > 0;
        const c = anda ? cara(d.dx || -g.a[0], d.dy || -g.a[1]) : cd;
        if (enLucha && lejos && !anda) {
          d.cd -= dt;
          if (d.cd <= 0) { d.cd = (d.etapa === e.etapa ? 1.5 : 3.2) + Math.random() * 1.5; flecha(d, vivosA[Math.floor(Math.random() * vivosA.length)], 12); }
        }
        const modo = anda ? 'walk' : enLucha && !lejos ? 'work' : 'idle';
        const cuadro = anda ? Math.floor(pn * 9 + d.i * 1.3) % 6 : modo === 'work' ? Math.floor((pn * 1.4 + d.fase) * 4) % 4 : 0;
        push(item(d, col, modo, cuadro, c, festeja && !anda ? Math.abs(Math.sin(pn * 6 + d.i)) * 3 : 0, f.id));
      }

      // --- el estandarte del centro
      push(mastil(f, g, e, fin, esc));

      // --- lo que pasa alrededor: polvo y golpes en la línea, torres que disparan, humo en lo que cayó
      if (!fin && vivosA.length && vivosD.length) {
        if (Math.random() < dt * 8) {
          const m = vivosA[Math.floor(Math.random() * vivosA.length)];
          if (!A_DISTANCIA[m.tipo]) {
            const [cx, cy] = R.iso(m.x + g.a[0] * 0.4, m.y + g.a[1] * 0.4);
            R.particles.push({ x: cx, y: cy - 4, vx: (Math.random() - 0.5) * 14, vy: -6 - Math.random() * 6, life: 0, max: 0.8, s: 1, puff: [196, 176, 140] });
            if (Math.random() < 0.5) R.particles.push({ x: cx, y: cy - 10, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 20, life: 0, max: 0.25, s: 1, rgb: [255, 236, 170] });
            if (Math.random() < 0.22 && R.sonarEn) R.sonarEn(Math.random() < 0.5 ? 'hit' : 'pick', cx, cy);
          }
        }
        esc.tTorre -= dt;
        if (esc.tTorre <= 0 && torres.length) {
          esc.tTorre = (e.etapa === 1 ? 0.5 : 1.6) / Math.min(3, torres.length) + Math.random() * 0.4;
          const b = torres[Math.floor(Math.random() * torres.length)];
          flecha({ x: b.cx, y: b.cy }, vivosA[Math.floor(Math.random() * vivosA.length)], b.type === 'tower' ? 36 : 30, '#e8d8a8');
        }
      }
      if (e.etapa === 2 || (fin && fin.gano)) for (const b of torres) { // defensas vencidas: humo en las de la parcela
        if (W.parcel(Math.floor(b.cx), Math.floor(b.cy)) !== f.k || Math.random() > dt * 4) continue;
        const [px, py] = R.iso(b.cx, b.cy);
        R.particles.push({ x: px + (Math.random() - 0.5) * 6, y: py - 26, vx: 3, vy: -9, life: 0, max: 2.2, s: 1, big: 1.5, c: 50 });
      }

      // --- cambio de etapa: cartel y cuerno (no al cargar ni en una repetición acelerada)
      if (!fin && esc.etapa !== e.etapa) {
        if (!ya || e.k < 0.08) {
          const txt = ['¡Al ataque!', '¡A las defensas!', '¡Por el estandarte!'][e.etapa];
          if (PK.Troops) PK.Troops.texts.push({ x: g.cx, y: g.cy, t: 0, text: txt, col: '#fff2c0' });
          if (!rep && PK.Sfx && esc.etapa >= 0) PK.Sfx.play('cuerno');
        }
        esc.etapa = e.etapa;
      }
      // --- G4: una decisión nueva (la trae el plan): cartel sobre la batalla
      const nAcc = (f.plan.acc || []).length;
      if (esc.nAcc !== undefined && nAcc > esc.nAcc && !fin && !rep && PK.Troops) {
        const x = f.plan.acc[nAcc - 1], T = D.ASEDIO.tacticas[x.v];
        const txt = { tactica: T ? '¡' + T.nombre + '!' : 'Ritmo normal', refuerzo: '¡Llegan refuerzos!', salida: '¡Salida de la guarnición!', retirada: '¡Retirada!', rendir: 'La parcela se rinde' }[x.tipo];
        if (txt) PK.Troops.texts.push({ x: g.cx, y: g.cy - 1, t: 0, text: txt, col: x.tipo === 'salida' || x.tipo === 'rendir' ? '#cfe0ff' : '#ffd27a' });
        if (PK.Sfx && (x.tipo === 'refuerzo' || x.tipo === 'salida')) PK.Sfx.play('cuerno');
      }
      esc.nAcc = nAcc;
      esc.nuevo = false;
    }
  };
  // El que va adelante lleva el estandarte de su reino (como las columnas en marcha de troops.js).
  function estandarteDe(it, col, flip) {
    it.after = ctx => {
      const x = Math.round(it.px + (flip ? -6 : 5)), y = Math.round(it.py), w = 7, wave = Math.floor(performance.now() / 180) % 2;
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x, y - 30, 1, 20);
      ctx.fillStyle = 'rgb(' + col.join(',') + ')'; ctx.fillRect(flip ? x - w : x + 1, y - 30 + wave, w, 5);
      ctx.fillStyle = '#e8b83a'; ctx.fillRect(flip ? x - w : x + 1, y - 26 + wave, w, 1);
    };
  }
  // El mástil del centro: la bandera del defensor; si la parcela cae, se arría y sube la del atacante.
  function mastil(f, g, e, fin, esc) {
    const [x, y] = despejado(esc, g.cx, g.cy), [px, py] = PK.Render.iso(x, y);
    return {
      d: x + y - 0.2, k: 'troop', o: { frente: f.id, enemy: true }, spr: vacio(), x: px, y: py, px, py,
      after: ctx => {
        const X = Math.round(px), Y = Math.round(py), ALTO = 34, ond = PK.menosMov ? 0 : Math.round(Math.sin(performance.now() / 240));
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X - 3, Y - 1, 8, 2);
        ctx.fillStyle = '#2a1a0e'; ctx.fillRect(X, Y - ALTO, 2, ALTO);
        ctx.fillStyle = '#e8c860'; ctx.fillRect(X - 1, Y - ALTO - 2, 4, 2);
        let col = colorReino(f.a), baja = 0;
        if (fin && fin.gano) { // 1,5 s arriando, 1,5 s izando
          if (fin.t < 1.5) baja = (fin.t / 1.5) * (ALTO - 10);
          else { col = colorReino(f.de); baja = Math.max(0, 1 - (fin.t - 1.5) / 1.5) * (ALTO - 10); }
        }
        const fy = Y - ALTO + Math.round(baja);
        ctx.fillStyle = 'rgb(' + col.join(',') + ')'; ctx.fillRect(X + 2, fy, 11, 7 + ond); ctx.fillRect(X + 2, fy + 7 + ond, 7, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(X + 5, fy + 2, 4, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X + 2, fy + 6 + ond, 11, 1);
      },
    };
  }

  // ---------- Minimapa: la parcela en disputa parpadea ----------
  Fr.minimapa = function (ctx, toMM) {
    const lista = todos();
    if (!lista.length) return;
    const on = PK.menosMov || Math.floor(performance.now() / 350) % 2 === 0;
    for (const { f, fin } of lista) {
      if (fin) continue;
      const g = geo(f), [x, y] = toMM(g.cx, g.cy);
      ctx.fillStyle = on ? '#ff4030' : '#ffffff';
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
      ctx.fillStyle = '#2a0a06'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      ctx.fillStyle = on ? '#ffe27a' : '#ff4030'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  };

  // ---------- Para la interfaz ----------
  // Las filas de la tira de cola (ui.js): un asedio en curso con sus dos barras y sus tres etapas.
  Fr.filas = function () {
    const out = [];
    for (const { f, e, fin, rep } of todos()) {
      if (fin || rep) continue;
      const n = PK.Terr.nombreFrente(f);
      out.push({ k: 'fr' + f.id, f, e, titulo: n.titulo, otro: n.otro });
    }
    return out;
  };
  Fr.hay = () => todos().some(o => !o.fin);
})();
