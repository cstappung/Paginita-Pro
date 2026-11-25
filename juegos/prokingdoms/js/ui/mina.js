// pk-84 (plan Hacha y Pico, P3 y P4): «Bajar a la mina». Vista a pantalla completa (como la batalla: main.js deja de
// dibujar el mapa mientras está abierta) con un corte lateral de la Mina Profunda: arriba el cielo y el castillete, al
// medio el pozo con la jaula del montacargas, y a los lados las galerías de cada piso, con la roca del color de su
// estrato, el entibado, las vetas (manchas del color de su mineral que se achican al agotarse), el frente de avance,
// el agua y la bomba, el gas y la ventilación, las lámparas y los mineros (S.villager con la ropa 'minero').
//
// SOLO DIBUJA: lo que se ve sale de b.mina (PK.Mina) y nunca decide nada. Math.random solo para polvo, chispas y gotas.
// Tocar un piso abre su panel (veta activa, mineros, mejoras); arriba va el montacargas y la bodega de la mina.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, UI = PK.UI, Sp = PK.Sprites;
  const el = (...a) => U.el(...a);
  const G = () => PK.Game, S = () => PK.Game.state, M = () => PK.Mina;

  // escena en píxeles virtuales: ancho fijo, se escala al ancho del lienzo
  const SW = 360, SKY = 74, FH = 56, GT = 16, GB = 44, POZO = 180, PW = 22;
  const RESCOL = Object.assign({}, Sp.CARRY, { stone: [176, 174, 166], crystal: [150, 230, 255], starIron: [190, 170, 255] });
  const rgb = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a === undefined ? 1 : a) + ')';
  const sc = (c, k) => c.map(v => Math.max(0, Math.min(255, Math.round(v * k))));

  let V = null; // { b, root, cv, ctx, top, panel, scroll, sel, t, fondos, part, k }
  UI.minaAbierta = () => !!V;

  // ---------- Posiciones de una veta en su galería ----------
  // pares a la derecha del pozo, impares a la izquierda; cada una a 26 px de la anterior de su lado
  const vetaX = k => (k % 2 === 0 ? POZO + PW / 2 + 16 + 26 * (k / 2) : POZO - PW / 2 - 16 - 26 * ((k - 1) / 2));
  const clampX = x => Math.max(8, Math.min(SW - 8, x));
  function largos(p) { // hasta dónde llega la galería a cada lado
    const der = clampX(POZO + PW / 2 + 16 + 26 * Math.ceil(p.i / 2) + 4), izq = clampX(POZO - PW / 2 - 16 - 26 * Math.floor(p.i / 2) - 4);
    return { izq, der };
  }

  // ---------- Fondo de roca de cada piso (en caché) ----------
  function fondo(n) {
    const key = n + '|' + V.b.mina.sem;
    if (V.fondos[key]) return V.fondos[key];
    const c = document.createElement('canvas'); c.width = SW; c.height = FH;
    const x = c.getContext('2d'), e = D.estratoDe(n), r = U.rng((V.b.mina.sem + n * 977) >>> 0), base = e.col;
    x.fillStyle = rgb(sc(base, 0.9)); x.fillRect(0, 0, SW, FH);
    for (let i = 0; i < 900; i++) {
      const px = Math.floor(r() * SW), py = Math.floor(r() * FH), k = 0.7 + r() * 0.5, s = r() < 0.15 ? 2 : 1;
      x.fillStyle = rgb(sc(base, k)); x.fillRect(px, py, s, s);
    }
    // vetitas de mármol o geodas según el estrato
    if (n >= 9) for (let i = 0; i < 6; i++) { x.strokeStyle = rgb(sc(base, 1.3), 0.5); x.beginPath(); let px = r() * SW, py = r() * FH; x.moveTo(px, py); for (let j = 0; j < 4; j++) { px += (r() - 0.5) * 30; py += (r() - 0.5) * 12; x.lineTo(px, py); } x.stroke(); }
    if (n >= 11) for (let i = 0; i < 5; i++) { const px = Math.floor(r() * SW), py = Math.floor(r() * (GT - 4)) + 2; x.fillStyle = rgb([150, 120, 220], 0.8); x.fillRect(px, py, 2, 2); x.fillStyle = rgb([220, 200, 255]); x.fillRect(px, py, 1, 1); }
    // franja del estrato arriba de cada piso
    x.fillStyle = rgb(sc(base, 0.6)); x.fillRect(0, 0, SW, 2);
    return (V.fondos[key] = c);
  }

  // ---------- Abrir y cerrar ----------
  UI.abrirMina = function (b) {
    if (!b || !M()) return;
    UI.cerrarMina();
    if (UI.closeModal) UI.closeModal();
    if (PK.Batalla && PK.Batalla.abierta()) PK.Batalla.cerrar();
    M().estado(b);
    const cv = el('canvas', { class: 'mv-cv' });
    const top = el('div', { class: 'mv-top' }), panel = el('div', { class: 'mv-panel' });
    const root = el('div', { id: 'minavista', role: 'dialog', 'aria-label': b.def.name }, top, el('div', { class: 'mv-campo' }, cv), panel);
    document.body.append(root);
    V = { b, root, cv, ctx: cv.getContext('2d'), top, panel, scroll: 0, sel: 1, t: 0, fondos: {}, part: [], k: 1, topKey: '', panelKey: '', drag: null, sonT: 0 };
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('keydown', onKey);
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', () => { if (V) V.drag = null; });
    cv.addEventListener('wheel', e => { if (!V) return; e.preventDefault(); V.scroll += e.deltaY / V.k * 0.6; limitar(); }, { passive: false });
    let last = performance.now();
    const bucle = now => {
      if (!V) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      try { dibujar(dt); pintarTop(); pintarPanel(); } catch (e) { console.error('mina', e); }
      requestAnimationFrame(bucle);
    };
    requestAnimationFrame(bucle);
    if (PK.Sfx) PK.Sfx.play('dig');
  };
  UI.cerrarMina = function () {
    if (!V) return;
    V.root.remove();
    window.removeEventListener('resize', medir);
    window.removeEventListener('keydown', onKey);
    V = null;
  };
  const onKey = e => { if (e.key === 'Escape') UI.cerrarMina(); };
  function medir() {
    if (!V) return;
    const box = V.cv.parentElement.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    V.cv.width = Math.max(10, Math.floor(box.width * dpr)); V.cv.height = Math.max(10, Math.floor(box.height * dpr));
    V.cv.style.width = '100%'; V.cv.style.height = '100%';
    encuadre();
    limitar();
  }
  // escala y corrimiento: encuadra las galerías (con un margen para la regla) y deja ver unos 3 pisos y medio
  function encuadre() {
    const Mi = M(), b = V.b;
    let izq = POZO - 60, der = POZO + 60;
    for (let n = 1; n <= Mi.pisos(b); n++) { const L = largos(Mi.piso(b, n)); izq = Math.min(izq, L.izq); der = Math.max(der, L.der); }
    const x0 = Math.max(0, izq - 44), x1 = Math.min(SW, der + 10), ancho = Math.max(170, x1 - x0);
    V.k = Math.min(V.cv.width / ancho, V.cv.height / (SKY + 3.4 * FH));
    const sobra = V.cv.width / V.k - ancho;
    V.ox = -x0 + Math.max(0, sobra / 2);
    V.x0 = x0 - Math.max(0, sobra / 2); // la orilla izquierda visible, en la escena
    V.encT = 0;
  }
  const altoTotal = () => SKY + M().pisos(V.b) * FH + 24;
  function limitar() { const vis = V.cv.height / V.k; V.scroll = U.clamp(V.scroll, 0, Math.max(0, altoTotal() - vis)); }
  function onDown(e) { V.drag = { y: e.clientY, s: V.scroll, mov: 0 }; V.cv.setPointerCapture(e.pointerId); }
  function onMove(e) {
    if (!V || !V.drag) return;
    const dpr = V.cv.width / V.cv.getBoundingClientRect().width, dy = (e.clientY - V.drag.y) * dpr / V.k;
    V.drag.mov = Math.max(V.drag.mov, Math.abs(dy));
    V.scroll = V.drag.s - dy; limitar();
  }
  function onUp(e) {
    if (!V || !V.drag) return;
    const d = V.drag; V.drag = null;
    if (d.mov > 4) return;
    const r = V.cv.getBoundingClientRect(), dpr = V.cv.width / r.width, y = (e.clientY - r.top) * dpr / V.k + V.scroll;
    const n = Math.floor((y - SKY) / FH) + 1;
    if (n >= 1 && n <= M().pisos(V.b)) { V.sel = n; V.panelKey = ''; if (PK.Sfx) PK.Sfx.play('pick'); }
  }

  // ---------- Dibujo ----------
  function dibujar(dt) {
    const v = V, b = v.b, ctx = v.ctx, g = G(), Mi = M();
    v.t += dt;
    if (!b.done || !g.buildings.includes(b)) { UI.cerrarMina(); return; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0e0a08'; ctx.fillRect(0, 0, v.cv.width, v.cv.height);
    if ((v.encT = (v.encT || 0) + dt) > 2) encuadre(); // las galerías crecen
    const kk = v.k;
    ctx.setTransform(kk, 0, 0, kk, v.ox * kk, -v.scroll * kk);
    const pisos = Mi.pisos(b), c = Mi.cuenta(b), vis0 = v.scroll, vis1 = v.scroll + v.cv.height / v.k, LX = Math.max(0, v.x0) + 2;
    cielo(ctx, pisos);
    for (let n = 1; n <= pisos; n++) {
      const y0 = SKY + (n - 1) * FH;
      if (y0 + FH < vis0 || y0 > vis1) continue;
      piso(ctx, n, y0, c[n]);
    }
    // pozo con cables (encima de la roca: las galerías salen de él)
    const p0 = Math.max(SKY - 4, vis0 - 4), p1 = Math.min(SKY + pisos * FH + 4, vis1 + 4);
    ctx.fillStyle = '#16100c'; ctx.fillRect(POZO - PW / 2, p0, PW, p1 - p0);
    ctx.fillStyle = '#3a2a1c'; for (let y = SKY; y < SKY + pisos * FH; y += 12) if (y > vis0 - 12 && y < vis1) { ctx.fillRect(POZO - PW / 2, y, 2, 10); ctx.fillRect(POZO + PW / 2 - 2, y, 2, 10); }
    ctx.fillStyle = '#5a5048'; ctx.fillRect(POZO - 5, SKY - 30, 1, pisos * FH + 30); ctx.fillRect(POZO + 4, SKY - 30, 1, pisos * FH + 30);
    for (let n = 1; n <= pisos; n++) { const y = SKY + (n - 1) * FH + GB; if (y > vis0 && y < vis1 + 4) { ctx.fillStyle = '#4a3420'; ctx.fillRect(POZO - PW / 2, y, PW, 2); } } // descansos de cada piso
    jaula(ctx, pisos);
    particulas(ctx, dt);
    // regla de profundidad
    ctx.font = '9px "PK Num", "Pixelify Sans", monospace'; ctx.textBaseline = 'top';
    for (let n = 1; n <= pisos; n++) {
      const y0 = SKY + (n - 1) * FH;
      if (y0 + FH < vis0 || y0 > vis1) continue;
      const sel = n === v.sel;
      ctx.fillStyle = sel ? 'rgba(255,215,106,0.9)' : 'rgba(0,0,0,0.55)'; ctx.fillRect(LX, y0 + 3, 34, 10);
      ctx.fillStyle = sel ? '#1a1008' : '#e8dcc0'; ctx.fillText('Piso ' + n, LX + 3, y0 + 4);
      if (sel) { ctx.strokeStyle = 'rgba(255,215,106,0.8)'; ctx.lineWidth = 2 / v.k; ctx.strokeRect(1, y0 + 1, SW - 2, FH - 2); }
    }
    // sonido de picos según cuántos mineros se ven
    v.sonT -= dt;
    if (v.sonT <= 0 && PK.Sfx) {
      let vis = 0; for (let n = 1; n <= pisos; n++) { const y0 = SKY + (n - 1) * FH; if (y0 + FH >= vis0 && y0 <= vis1) vis += c[n]; }
      if (vis) { PK.Sfx.play('pick'); v.sonT = 2.6 / Math.min(4, 0.5 + vis / 6); } else v.sonT = 1;
    }
  }
  function cielo(ctx, pisos) {
    const h = new Date(G().ahora()).getHours(), noche = h < 7 || h >= 20;
    const gr = ctx.createLinearGradient(0, 0, 0, SKY);
    gr.addColorStop(0, noche ? '#0c1428' : '#6aa6d8'); gr.addColorStop(1, noche ? '#1c2440' : '#bcdcee');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, SW, SKY);
    if (noche) { ctx.fillStyle = '#e8e8ff'; for (let i = 0; i < 18; i++) ctx.fillRect((i * 97) % SW, (i * 53) % (SKY - 30), 1, 1); }
    // suelo y escombrera
    ctx.fillStyle = '#5c8a3c'; ctx.fillRect(0, SKY - 8, SW, 4);
    ctx.fillStyle = '#6a4a2c'; ctx.fillRect(0, SKY - 4, SW, 4);
    const esc = Math.min(40, 10 + pisos * 2);
    ctx.fillStyle = '#7a7670'; ctx.beginPath(); ctx.moveTo(250, SKY - 8); ctx.lineTo(250 + esc, SKY - 8 - esc * 0.45); ctx.lineTo(250 + esc * 2, SKY - 8); ctx.fill();
    ctx.fillStyle = '#5e5a54'; ctx.beginPath(); ctx.moveTo(250 + esc, SKY - 8 - esc * 0.45); ctx.lineTo(250 + esc * 2, SKY - 8); ctx.lineTo(250 + esc * 1.3, SKY - 8); ctx.fill();
    // castillete
    const hierro = V.b.lvl >= 10, pata = hierro ? '#5c6068' : '#6a4426', alto = 44;
    ctx.fillStyle = pata;
    for (const [x0, x1] of [[POZO - 18, POZO - 4], [POZO + 18, POZO + 4]]) { ctx.save(); ctx.beginPath(); ctx.moveTo(x0, SKY - 8); ctx.lineTo(x1, SKY - 8 - alto); ctx.lineWidth = 2.5; ctx.strokeStyle = pata; ctx.stroke(); ctx.restore(); }
    for (let i = 1; i < 4; i++) { const y = SKY - 8 - i * 11, w = 18 - i * 3.5; ctx.fillRect(POZO - w, y, w * 2, 1.5); }
    // rueda que gira con la jaula
    const ang = V.t * (G().buildings.includes(V.b) && V.b.workers.length ? 2.4 : 0);
    ruedaEn(ctx, POZO, SKY - 8 - alto, ang, hierro);
    if (V.b.mina.mont >= 3) ruedaEn(ctx, POZO + 14, SKY - 8 - alto + 6, -ang, hierro);
    // casa del torno con su chimenea
    ctx.fillStyle = hierro ? '#8a8478' : '#8a6038'; ctx.fillRect(POZO + 34, SKY - 28, 36, 20);
    ctx.fillStyle = '#a04a32'; ctx.beginPath(); ctx.moveTo(POZO + 31, SKY - 28); ctx.lineTo(POZO + 52, SKY - 40); ctx.lineTo(POZO + 73, SKY - 28); ctx.fill();
    ctx.fillStyle = '#2a1c12'; ctx.fillRect(POZO + 40, SKY - 20, 6, 12);
    if ((V.b.mina.mont || 0) >= 2) { ctx.fillStyle = '#5a524a'; ctx.fillRect(POZO + 62, SKY - 50, 5, 22); if (Math.random() < 0.3) V.part.push({ x: POZO + 64, y: SKY - 52, vx: 4 + Math.random() * 4, vy: -6 - Math.random() * 4, life: 0, max: 2.5, col: [200, 200, 200], s: 2 }); }
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(POZO + 5, SKY - 8 - alto); ctx.lineTo(POZO + 40, SKY - 22); ctx.stroke();
    ctx.font = '8px "Pixelify Sans", monospace'; ctx.fillStyle = noche ? '#ffd76a' : '#3a2410'; ctx.textBaseline = 'top';
    ctx.fillText(D.MINA.montacargas[V.b.mina.mont || 0].name, Math.max(0, V.x0) + 4, 6);
  }
  function ruedaEn(ctx, x, y, ang, hierro) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.strokeStyle = hierro ? '#9aa0aa' : '#3a2a1c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * Math.PI / 2) * 8, Math.sin(i * Math.PI / 2) * 8); ctx.stroke(); }
    ctx.restore();
  }
  function jaula(ctx, pisos) {
    // la jaula baja y sube entre la superficie y el piso más hondo con mineros
    const c = M().cuenta(V.b); let hondo = 0;
    for (let n = pisos; n >= 1; n--) if (c[n]) { hondo = n; break; }
    const largo = hondo ? (SKY + (hondo - 1) * FH + GB - 16) - (SKY - 16) : 0, per = 6 + hondo * 0.8;
    const f = hondo ? (1 - Math.cos((V.t / per) * Math.PI * 2)) / 2 : 0, y = SKY - 16 + largo * f;
    ctx.fillStyle = '#2a2420'; ctx.fillRect(POZO - 0.5, SKY - 52, 1, y - SKY + 52);
    ctx.fillStyle = V.b.lvl >= 10 ? '#7a7e86' : '#7a5232'; ctx.fillRect(POZO - 8, y, 16, 16);
    ctx.fillStyle = '#1a1410'; ctx.fillRect(POZO - 6, y + 2, 12, 12);
    ctx.fillStyle = V.b.lvl >= 10 ? '#9aa0aa' : '#9a7046'; for (let i = 0; i < 4; i++) ctx.fillRect(POZO - 6 + i * 4, y + 2, 1, 12);
    if (f > 0.15) { ctx.fillStyle = 'rgba(180,140,90,0.9)'; ctx.fillRect(POZO - 4, y + 9, 8, 5); } // vagoneta llena subiendo
  }
  function piso(ctx, n, y0, mineros) {
    const b = V.b, Mi = M(), p = Mi.piso(b, n), f = Mi.info(b, n), e = f.e, L = largos(p), gy0 = y0 + GT, gy1 = y0 + GB;
    ctx.drawImage(fondo(n), 0, y0);
    const cerrado = !Mi.trabajable(b, n);
    // galería tallada
    ctx.fillStyle = rgb(sc(e.col, 0.28)); ctx.fillRect(L.izq, gy0, L.der - L.izq, gy1 - gy0);
    ctx.fillStyle = rgb(sc(e.col, 0.42)); ctx.fillRect(L.izq, gy1, L.der - L.izq, 3);
    // frente de avance: roca sin tallar con polvo (al lado de la próxima veta)
    const lado = p.i % 2 === 0 ? 1 : -1, fx = lado > 0 ? L.der : L.izq;
    ctx.fillStyle = rgb(sc(e.col, 0.75)); ctx.fillRect(lado > 0 ? fx - 3 : fx, gy0, 3, gy1 - gy0);
    // vetas destapadas sin agotar
    for (const a of p.v) {
      const def = Mi.veta(b, n, a.k), x = vetaX(a.k), frac = U.clamp(a.q / def.cant, 0, 1), col = RESCOL[def.res] || [200, 200, 200];
      if (x < L.izq || x > L.der) continue;
      const r = U.rng((b.mina.sem + n * 131 + a.k * 17) >>> 0), m = Math.round(4 + 10 * frac);
      for (let i = 0; i < m; i++) {
        const px = Math.round(x - 7 + r() * 14), py = Math.round(r() < 0.5 ? gy0 - 1 - r() * 7 : gy0 + r() * 4);
        ctx.fillStyle = rgb(sc(col, 0.75 + r() * 0.5)); ctx.fillRect(px, py, 2, 2);
        if (r() < 0.25) { ctx.fillStyle = rgb(sc(col, 1.35)); ctx.fillRect(px, py, 1, 1); }
      }
      if (def.esp && Math.sin(V.t * 4 + a.k) > 0.6) { ctx.fillStyle = rgb(RESCOL[def.esp]); ctx.fillRect(x - 1, gy0 - 5, 2, 2); ctx.fillRect(x, gy0 - 6, 1, 4); }
    }
    // entibado: postes y travesaño cada 22 px
    for (let x = POZO + PW / 2 + 6; x < L.der - 2; x += 22) entibo(ctx, x, gy0, gy1);
    for (let x = POZO - PW / 2 - 8; x > L.izq + 2; x -= 22) entibo(ctx, x, gy0, gy1);
    // rieles
    if (p.m.rieles) { ctx.fillStyle = '#8a8e96'; ctx.fillRect(L.izq, gy1 - 2, L.der - L.izq, 1); ctx.fillStyle = '#4a3420'; for (let x = L.izq; x < L.der; x += 5) ctx.fillRect(x, gy1 - 1, 3, 1); }
    // agua
    if (f.agua) {
      const alto = p.m.bomba ? 2 : 5;
      ctx.fillStyle = 'rgba(70,120,190,0.55)'; ctx.fillRect(L.izq, gy1 - alto, L.der - L.izq, alto);
      if (Math.random() < 0.08) V.part.push({ x: L.izq + Math.random() * (L.der - L.izq), y: gy0, vx: 0, vy: 30, life: 0, max: 0.8, col: [130, 180, 240], s: 1, piso: gy1 - alto });
      if (p.m.bomba) { const sube = Math.sin(V.t * 6) * 2; ctx.fillStyle = '#6a6e76'; ctx.fillRect(POZO - PW / 2 - 12, gy1 - 12, 6, 12); ctx.fillStyle = '#9aa0aa'; ctx.fillRect(POZO - PW / 2 - 11, gy1 - 16 + sube, 4, 4); }
    }
    // gas: velo verdoso; la ventilación gira
    if (f.gas) {
      if (p.m.ventilacion) {
        ctx.save(); ctx.translate(POZO + PW / 2 + 6, gy0 + 6); ctx.rotate(V.t * 8); ctx.fillStyle = '#9aa0aa'; ctx.fillRect(-4, -0.5, 8, 1); ctx.fillRect(-0.5, -4, 1, 8); ctx.restore();
        ctx.fillStyle = 'rgba(140,200,90,0.07)'; ctx.fillRect(L.izq, gy0, L.der - L.izq, gy1 - gy0);
      } else {
        ctx.fillStyle = 'rgba(140,200,90,' + (0.18 + 0.06 * Math.sin(V.t * 2)) + ')'; ctx.fillRect(L.izq, gy0, L.der - L.izq, gy1 - gy0);
        ctx.fillStyle = '#7a5232'; for (const s of [-1, 1]) { const x = POZO + s * (PW / 2 + 4); ctx.save(); ctx.translate(x, (gy0 + gy1) / 2); ctx.rotate(s * 0.5); ctx.fillRect(-10, -1.5, 20, 3); ctx.rotate(-s); ctx.fillRect(-10, -1.5, 20, 3); ctx.restore(); }
      }
    }
    // oscuridad y lámparas
    ctx.fillStyle = p.m.lamparas ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.32)'; ctx.fillRect(L.izq, gy0, L.der - L.izq, gy1 - gy0);
    if (p.m.lamparas) for (let x = POZO + PW / 2 + 17; x < L.der; x += 44) lampara(ctx, x, gy0 + 2);
    if (p.m.lamparas) for (let x = POZO - PW / 2 - 19; x > L.izq; x -= 44) lampara(ctx, x, gy0 + 2);
    if (!cerrado && mineros) mineroS(ctx, n, p, L, gy1, mineros, fx, lado);
    if (cerrado) { ctx.font = '8px "Pixelify Sans", monospace'; ctx.fillStyle = '#e6ffb0'; ctx.fillText('Gas: hace falta ventilación', POZO + PW / 2 + 8, gy0 + 6); }
  }
  function entibo(ctx, x, gy0, gy1) {
    ctx.fillStyle = '#6a4426'; ctx.fillRect(x, gy0, 2, gy1 - gy0); ctx.fillRect(x + 12, gy0, 2, gy1 - gy0);
    ctx.fillStyle = '#7e5430'; ctx.fillRect(x - 1, gy0, 16, 2);
  }
  function lampara(ctx, x, y) {
    const g = ctx.createRadialGradient(x, y + 4, 0, x, y + 4, 18);
    g.addColorStop(0, 'rgba(255,214,120,0.32)'); g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 18, y - 14, 36, 36);
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(x, y, 1, 3); ctx.fillStyle = '#ffd770'; ctx.fillRect(x - 1, y + 3, 3, 3);
  }
  // los mineros de un piso: en la veta, acarreando hasta el pozo y uno en el frente
  function mineroS(ctx, n, p, L, suelo, cuantos, fx, lado) {
    const col = Sp.ownerColor('p'), act = p.v[0], vx = act ? vetaX(act.k) : null, def = act ? M().veta(V.b, n, act.k) : null;
    const mostrar = Math.min(cuantos, 9);
    for (let i = 0; i < mostrar; i++) {
      const hair = i % 4, skin = (i * 2 + n) % 3;
      let x, mode = 'work', frame, tool = 'pick', flip = false, carry = null;
      const rol = i === 0 ? 'frente' : !act ? 'frente' : i % 3 === 2 ? 'carga' : 'veta';
      if (rol === 'frente') {
        x = fx - lado * (8 + (i % 3) * 5); flip = lado < 0;
        frame = Math.floor((V.t * 3 + i * 0.37) % 1 * 4);
        if (frame === 2 && Math.random() < 0.15) polvo(fx, suelo - 10, [150, 140, 130]);
      } else if (rol === 'veta') {
        x = vx + (i % 2 ? -6 : 6) - (vx > POZO ? 4 : -4); flip = x > vx;
        frame = Math.floor((V.t * 2.6 + i * 0.29) % 1 * 4);
        if (frame === 1 && Math.random() < 0.12) chispa(vx, suelo - 14, RESCOL[def.res] || [200, 200, 200]);
      } else {
        const ida = POZO + (vx > POZO ? PW / 2 + 4 : -PW / 2 - 4), per = Math.abs(vx - ida) / 10 + 1, ph = ((V.t / per) + i * 0.41) % 2;
        const t = ph < 1 ? ph : 2 - ph;
        x = ida + (vx - ida) * t; mode = 'walk'; tool = null; frame = Math.floor(V.t * 9 + i) % 6;
        flip = (ph < 1) === (vx < ida); carry = ph >= 1 ? def.res : null;
      }
      if (x < L.izq + 4 || x > L.der - 4) x = U.clamp(x, L.izq + 4, L.der - 4);
      const spr = Sp.villager(col, hair, skin, mode, frame, carry, flip, tool, false, false, null, 'minero', false);
      if (spr) ctx.drawImage(spr.c, Math.round(x - 11), suelo - 22, 22, 22);
    }
    if (cuantos > mostrar) { ctx.font = '7px "Pixelify Sans", monospace'; ctx.fillStyle = '#ffd76a'; ctx.fillText('+' + (cuantos - mostrar), L.der - 14 > POZO ? L.der - 14 : POZO + 14, suelo - 26); }
  }
  function polvo(x, y, col) { for (let i = 0; i < 3; i++) V.part.push({ x, y, vx: (Math.random() - 0.5) * 16, vy: -6 - Math.random() * 6, life: 0, max: 0.9, col, s: 2, puff: 1 }); }
  function chispa(x, y, col) { for (let i = 0; i < 3; i++) V.part.push({ x, y, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 14, life: 0, max: 0.35, col: [255, 236, 170], s: 1 }); V.part.push({ x, y, vx: (Math.random() - 0.5) * 20, vy: -8, life: 0, max: 0.6, col, s: 2 }); }
  function particulas(ctx, dt) {
    const P = V.part;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; if (!q.puff) q.vy += 40 * dt;
      if (q.piso && q.y >= q.piso) q.life = q.max;
      if (q.life >= q.max) { P.splice(i, 1); continue; }
      ctx.fillStyle = rgb(q.col, q.puff ? 0.5 * (1 - q.life / q.max) : 1 - q.life / q.max);
      ctx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s);
    }
    if (P.length > 400) P.splice(0, P.length - 400);
  }

  // ---------- Barra de arriba: montacargas y bodega ----------
  function pintarTop() {
    const v = V, b = v.b, Mi = M(), r = Mi.resumen(b), tot = PK.Libro.totalCampo(b), cap = PK.Libro.capCampo(b), s = Mi.montSig(b);
    const key = [Math.round(r.total), Math.round(tot), cap, b.workers.length, Mi.puestos(b), b.mina.mont, b.mina.mano, s && s.why, Mi.aislada(b)].join('|');
    if (key === v.topKey) return;
    v.topKey = key;
    v.top.innerHTML = '';
    v.top.append(
      el('b', { class: 'mv-nombre' }, b.def.name + ' · ' + Mi.pisos(b) + ' pisos'),
      el('span', { class: 'mv-dato' }, 'Mineros ', el('b', null, b.workers.length + '/' + Mi.puestos(b))),
      el('span', { class: 'mv-dato' + (r.limita ? ' warn-t' : '') }, 'Saca ', el('b', null, Math.round(Math.min(r.total, r.sube)) + '/min'), ' · sube hasta ' + r.sube + '/min' + (r.limita ? ' (el montacargas no da abasto)' : '')),
      el('span', { class: 'mv-dato' + (tot >= cap - 1 ? ' warn-t' : '') }, Mi.aislada(b) ? 'Ningún carromato llega: los mineros suben a pie al pueblo (la mitad)' : 'Bodega ' + U.fmt(Math.floor(tot)) + '/' + U.fmt(cap)),
      el('div', { class: 'row mv-btns' },
        s ? UI.btn(el('span', null, s.m.name + ' ', UI.costEl(s.m.cost)), () => { Mi.subirMontacargas(b); v.topKey = ''; }, { small: true, disabled: !!s.why, title: s.why || ('Sube ' + s.m.sube + ' por minuto') }) : null,
        UI.btn(b.mina.mano ? 'Reparto: a mano' : 'Reparto: automático', () => { b.mina.mano = !b.mina.mano; v.topKey = ''; }, { small: true, title: 'Automático: el capataz de la mina pasa mineros al piso que más conviene cada 10 s' }),
        UI.btn('Volver a la superficie', () => UI.cerrarMina(), { small: true, cls: 'gold' })));
  }

  // ---------- Panel del piso elegido ----------
  function pintarPanel() {
    const v = V, b = v.b, Mi = M(), n = Math.min(v.sel, Mi.pisos(b)), p = Mi.piso(b, n), f = Mi.info(b, n), c = Mi.cuenta(b);
    const act = p.v[0], def = act ? Mi.veta(b, n, act.k) : null;
    const key = [n, c[n], p.v.length, act && act.k, act && Math.floor(act.q / Math.max(1, def.cant) * 50), Math.floor(p.fr / D.MINA.avanceCosto(n) * 20), JSON.stringify(p.m), b.workers.length, G().state.era].join('|');
    if (key === v.panelKey) return;
    v.panelKey = key;
    const pel = [f.agua ? (p.m.bomba ? '💧 agua (con bomba)' : '💧 agua: rinde la mitad sin bomba') : null, f.gas ? (p.m.ventilacion ? '🌫 gas (ventilado)' : '🌫 gas: cerrado sin ventilación') : null].filter(Boolean);
    v.panel.innerHTML = '';
    v.panel.append(
      el('div', { class: 'mv-ph' },
        UI.btn('▲', () => { v.sel = Math.max(1, n - 1); v.panelKey = ''; centrar(); }, { small: true, title: 'Piso de arriba' }),
        el('b', null, 'Piso ' + n + ' · ' + f.e.name),
        UI.btn('▼', () => { v.sel = Math.min(Mi.pisos(b), n + 1); v.panelKey = ''; centrar(); }, { small: true, title: 'Piso de abajo' }),
        el('span', { class: 'small muted' }, ' rinde ×' + D.minaRitmo(n, p.m.rieles, p.m.lamparas).toFixed(2) + (pel.length ? ' · ' + pel.join(' · ') : ''))),
      el('div', { class: 'mv-fila' },
        el('span', null, 'Mineros: ', el('b', null, c[n] + '/' + Mi.puestosPiso(b, n))),
        UI.btn('−', () => { const a = otroPiso(b, n); if (a) Mi.mover(b, n, a); v.panelKey = ''; }, { small: true, disabled: !c[n], title: 'Pasa un minero de este piso a otro' }),
        UI.btn('+', () => { Mi.mover(b, 0, n); v.panelKey = ''; }, { small: true, disabled: c[n] >= Mi.puestosPiso(b, n) || !Mi.trabajable(b, n) || b.workers.length <= c[n], title: 'Trae un minero de otro piso' }),
        el('span', { class: 'small muted' }, b.workers.length < Mi.puestos(b) ? ' Hay puestos libres: manda aldeanos a la mina (o deja que el Capataz los mande).' : '')),
      el('div', { class: 'mv-fila' }, act
        ? el('span', null, 'Veta: ', UI.resIcon(def.res), ' ' + D.RES[def.res].name + ' · quedan ' + U.fmt(Math.floor(act.q)) + ' de ' + U.fmt(def.cant) + (def.esp ? ' · con ' + D.RES[def.esp].name.toLowerCase() : '') + (p.v.length > 1 ? ' · después: ' + p.v.slice(1).map(a => D.RES[Mi.veta(b, n, a.k).res].name.toLowerCase()).join(', ') : ''))
        : el('span', { class: 'warn-t' }, 'Sin vetas a la vista: los mineros cavan el frente (dan piedra) hasta destapar la próxima.')),
      el('div', { class: 'mv-fila' }, el('span', { class: 'small' }, 'Frente de avance'), el('div', { class: 'bar mv-bar' }, el('div', { class: 'fill green', style: { width: Math.min(100, (p.fr / D.MINA.avanceCosto(n)) * 100) + '%' } }), el('span', null, p.v.length >= D.MINA.maxVetas ? 'esperando: hay ' + p.v.length + ' vetas destapadas' : 'próxima veta'))),
      el('div', { class: 'mv-mejoras' }, Mi.mejorasDe(b, n).map(m => el('div', { class: 'mv-mej' + (m.tiene ? ' hecha' : '') },
        el('b', null, (m.tiene ? '✓ ' : '') + m.def.name), el('span', { class: 'small muted' }, ' ' + m.def.txt),
        m.tiene ? null : UI.btn(el('span', null, 'Poner ', UI.costEl(m.cost)), () => { Mi.comprar(b, n, m.k); v.panelKey = ''; }, { small: true, disabled: !!m.why, title: m.why || '' })))));
  }
  function otroPiso(b, n) {
    const Mi = M(), c = Mi.cuenta(b);
    let best = 0, bw = -1;
    for (let k = 1; k <= Mi.pisos(b); k++) if (k !== n && Mi.trabajable(b, k) && c[k] < Mi.puestosPiso(b, k)) { const w = 1 + D.MINA.prof * (k - 1); if (w > bw) { bw = w; best = k; } }
    return best;
  }
  function centrar() { const y = SKY + (V.sel - 1) * FH - (V.cv.height / V.k) / 3; V.scroll = y; limitar(); }
  UI.minaVerPiso = n => { if (V) { V.sel = n; V.panelKey = ''; centrar(); } };
})();
