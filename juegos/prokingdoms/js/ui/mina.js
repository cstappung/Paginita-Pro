// pk-84/pk-85 (plan Hacha y Pico, P4; rehecha en pk-85 a pedido del dueño: «una mejora muy drástica en la visual de la
// mina, que se vea el agua, que se vean las vetas, mucho más ancha por nivel y mucho más detallada, y que los aldeanos
// cambien mucho al trabajar en la mina»). «Bajar a la mina» abre una vista a pantalla completa (main.js deja de dibujar
// el mapa mientras está abierta) con un corte lateral de la Mina Profunda:
//  - Arriba, la superficie: cielo según la hora, cerros, el castillete con sus poleas, la casa del torno con su
//    chimenea, la tolva con un carromato del color del reino y la escombrera, que crece con los pisos.
//  - Al medio, el pozo: revestido de madera, con escalera, guías, cables y la jaula, que baja con mineros y sube con
//    una vagoneta llena; en cada piso, un descanso con su farol, su campana y su placa.
//  - A los lados, las galerías: cada piso es más ancho cuanto más hondo (las vetas quedan más separadas) y crece con
//    cada veta destapada. La roca tiene el color y los detalles de su estrato (raíces, fósiles, vetitas de mármol,
//    geodas, grietas de magma), el entibado es de madera arriba y de hierro abajo, y cada veta se ve como un filón que
//    atraviesa la roca hasta su nicho, con pepitas que se achican al agotarse; las agotadas quedan como cámaras vacías.
//  - El agua se ve: napa que rezuma por las paredes, goteras con salpicaduras y una laguna en el piso que con bomba es
//    un charco y sin bomba les llega a las rodillas. El gas es una niebla verde con barricada; la ventilación, un ducto
//    con su ventilador. Todo queda a oscuras salvo lo que alumbran los faroles, las lámparas de los cascos y las vetas.
//  - Los mineros son figuras propias de la mina (casco con lámpara, overol, pañuelo del reino, tizne) con oficios:
//    picador en la veta, barrenero en el frente, palero que carga la vagoneta, carretillero que la empuja hasta el pozo
//    (o cargador con un saco si no hay rieles).
//
// SOLO DIBUJA: lo que se ve sale de b.mina (PK.Mina) y nunca decide nada. Math.random solo para polvo, chispas y gotas.
// Se arrastra en las dos direcciones (rueda: arriba y abajo; Mayús+rueda: a los lados). Tocar un piso abre su panel.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, UI = PK.UI, Sp = PK.Sprites;
  const el = (...a) => U.el(...a);
  const G = () => PK.Game, M = () => PK.Mina;

  // ---------- Escena (píxeles virtuales; x = 0 es el centro del pozo) ----------
  const SKY = 120, FH = 100, TECHO = 34, SUELO = 84, PW = 30;
  const RESCOL = Object.assign({}, Sp.CARRY, { stone: [176, 174, 166], gold: [255, 206, 64], ore: [196, 98, 60], marble: [240, 238, 230], gems: [90, 200, 255], crystal: [150, 236, 255], starIron: [196, 170, 255] });
  const rgb = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a === undefined ? 1 : a) + ')';
  const sc = (c, k) => c.map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  const mezcla = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  let V = null;
  UI.minaAbierta = () => !!V;

  // ---------- Geometría de cada piso ----------
  // Las vetas se alternan a la derecha (pares) y a la izquierda (impares) del pozo; la separación crece con la
  // profundidad: los pisos hondos son mucho más anchos.
  const sep = n => 64 + 5 * n;
  const vetaX = (n, k) => (k % 2 === 0 ? 1 : -1) * (PW / 2 + 52 + sep(n) * Math.floor(k / 2));
  function alcance(n, p) { // hasta dónde llega la galería a cada lado (x negativa a la izquierda)
    const base = 60 + 16 * n; // pk-85: mucho más ancha cuanto más honda
    let der = PW / 2 + base, izq = -(PW / 2 + base);
    for (let k = 0; k < p.i; k++) { const x = vetaX(n, k); if (x > 0) der = Math.max(der, x + 40); else izq = Math.min(izq, x - 40); }
    const nx = vetaX(n, p.i); // el frente avanza hacia la próxima veta
    if (nx > 0) der = Math.max(der, nx - 26); else izq = Math.min(izq, nx + 26);
    return { izq, der, frente: nx > 0 ? 1 : -1 };
  }
  const yPiso = n => SKY + (n - 1) * FH;

  // ---------- Pintor de píxeles ----------
  function linea(x, x0, y0, x1, y1, col, w) {
    x.fillStyle = col;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) { const px = Math.round(x0 + (x1 - x0) * i / n), py = Math.round(y0 + (y1 - y0) * i / n); x.fillRect(px - ((w || 1) >> 1), py - ((w || 1) >> 1), w || 1, w || 1); }
  }

  // ---------- Los mineros: figuras propias de 20×30, mirando a la derecha ----------
  const PIEL = [[236, 196, 160], [206, 156, 112], [150, 104, 70], [110, 74, 50]];
  const FIG = new Map();
  function figura(pose, f, col, piel, hierro, carga) {
    const key = pose + f + '|' + col.join(',') + '|' + piel + (hierro ? 'h' : '') + (carga || '');
    const ya = FIG.get(key);
    if (ya) return ya;
    const c = document.createElement('canvas'); c.width = 22; c.height = 30;
    const x = c.getContext('2d'), R = (a, b, w, h, cl) => { x.fillStyle = Array.isArray(cl) ? rgb(cl) : cl; x.fillRect(a, b, w, h); };
    const SK = PIEL[piel], OV = [58, 74, 104], OV2 = [44, 56, 80], CAM = [168, 140, 98], BOT = [52, 36, 24], CAS = hierro ? [128, 132, 142] : [140, 96, 50], CAS2 = hierro ? [92, 96, 106] : [100, 66, 32];
    const anda = pose === 'caminar' || pose === 'empujar' || pose === 'cargar';
    const inc = pose === 'empujar' ? 1 : 0; // se inclina al empujar
    // piernas y botas (en el trabajo, abiertas y firmes)
    const pz = anda ? [[0, 1], [1, 0], [0, -1], [-1, 0]][f % 4] : [0, 0];
    const p1 = 8 + pz[0] * 2, p2 = 12 + pz[1] * 2;
    R(p1, 20, 3, 7, OV2); R(p1 - 1, 27, 5, 3, BOT);
    R(p2, 20, 3, 7, OV); R(p2, 27, 5, 3, BOT);
    // cuerpo
    const cx = 7 + inc;
    R(cx, 12, 8, 9, OV); R(cx + 2, 12, 4, 4, sc(OV, 1.15)); R(cx + 1, 12, 1, 5, OV2); R(cx + 6, 12, 1, 5, OV2); // peto y tirantes
    R(cx, 19, 8, 2, [76, 50, 28]); R(cx + 5, 19, 2, 2, [214, 176, 82]); // cinturón con hebilla
    // saco a la espalda
    if (pose === 'cargar') { R(1 + inc, 9, 7, 10, [168, 136, 88]); R(2 + inc, 8, 5, 2, [150, 120, 76]); R(1 + inc, 18, 7, 1, [120, 94, 58]); if (carga) { R(3, 9, 2, 2, carga); R(5, 11, 1, 1, carga); } }
    // cabeza, pañuelo y casco con lámpara
    const hx = 8 + inc;
    R(hx, 5, 6, 7, SK); R(hx + 6, 8, 1, 2, SK); R(hx + 4, 7, 1, 1, [30, 24, 20]); R(hx + 1, 9, 1, 1, sc(SK, 0.55)); R(hx + 3, 10, 2, 1, sc(SK, 0.6)); // nariz, ojo y tizne
    R(hx - 1, 11, 8, 2, col); R(hx - 2, 12, 2, 2, sc(col, 0.8));
    R(hx - 1, 2, 8, 4, CAS); R(hx, 1, 6, 1, CAS); R(hx - 2, 5, 10, 1, CAS2); R(hx + 1, 2, 3, 1, sc(CAS, 1.25));
    R(hx + 6, 2, 2, 3, [255, 232, 140]); R(hx + 7, 3, 1, 1, [255, 255, 236]);
    // brazos y herramientas
    const brazo = (sx, sy, ex, ey) => { linea(x, sx, sy, ex, ey, rgb(CAM), 2); R(ex - 1, ey - 1, 2, 2, SK); };
    const sh = [cx + 4, 13];
    if (pose === 'picar') {
      const H = [[[5, 4], -2.4], [[10, 0], -1.2], [[17, 13], 0.75], [[14, 12], 0.2]][f % 4], [hx2, hy2] = H[0], a = H[1];
      brazo(sh[0] - 2, sh[1], hx2 - 1, hy2 + 1); brazo(sh[0], sh[1], hx2, hy2);
      const ex = hx2 + Math.cos(a) * 9, ey = hy2 + Math.sin(a) * 9;
      linea(x, hx2, hy2, ex, ey, '#8a5a30', 1);
      const px2 = -Math.sin(a), py2 = Math.cos(a);
      linea(x, ex - px2 * 4, ey - py2 * 4, ex + px2 * 4, ey + py2 * 4, '#a8aeb8', 1); R(Math.round(ex + px2 * 4), Math.round(ey + py2 * 4), 1, 1, '#e8ecf2');
    } else if (pose === 'barrenar') {
      brazo(sh[0] - 1, sh[1], 17, 12); linea(x, 16, 12, 21, 12, '#a8aeb8', 1); // el cincel contra la roca
      const mh = f % 2 ? [15, 10] : [12, 4];
      brazo(sh[0], sh[1], mh[0], mh[1]); R(mh[0] - 1, mh[1] - 3, 4, 3, '#6a6e78'); R(mh[0], mh[1] - 3, 1, 1, '#a8aeb8');
    } else if (pose === 'palear') {
      const P = [[[13, 17], [20, 26]], [[13, 13], [19, 15]], [[12, 7], [17, 2]]][f % 3];
      brazo(sh[0] - 2, sh[1], P[0][0] - 3, P[0][1] - 2); brazo(sh[0], sh[1], P[0][0], P[0][1]);
      linea(x, P[0][0] - 4, P[0][1] - 3, P[1][0], P[1][1], '#8a5a30', 1); R(P[1][0] - 1, P[1][1] - 1, 4, 3, '#8a8e98');
      if (f % 3 >= 1 && carga) R(P[1][0], P[1][1] - 2, 3, 2, carga);
    } else if (pose === 'empujar') {
      brazo(sh[0], sh[1], 19, 15); brazo(sh[0] - 1, sh[1] + 1, 18, 16);
    } else if (pose === 'cargar') {
      brazo(sh[0], sh[1], cx + 2, 10); // sujeta la correa del saco
      linea(x, cx + 2, 10, 3 + inc, 9, '#6a4a2a', 1);
    } else { // caminar con el pico al hombro
      const s = [0, 1, 0, -1][f % 4];
      brazo(sh[0], sh[1], 14 + s, 18); linea(x, 13, 18 + s, 8, 3, '#8a5a30', 1); R(5, 2, 6, 2, '#a8aeb8');
    }
    FIG.set(key, c);
    if (FIG.size > 400) FIG.delete(FIG.keys().next().value);
    return c;
  }
  // vagoneta de 20×13 (llena con el color del mineral)
  const VAG = {};
  function vagoneta(carga) {
    const k = carga ? carga.join(',') : '-';
    if (VAG[k]) return VAG[k];
    const c = document.createElement('canvas'); c.width = 20; c.height = 13;
    const x = c.getContext('2d'), R = (a, b, w, h, cl) => { x.fillStyle = Array.isArray(cl) ? rgb(cl) : cl; x.fillRect(a, b, w, h); };
    if (carga) { R(3, 1, 14, 3, sc(carga, 0.85)); R(5, 0, 8, 2, carga); R(6, 0, 2, 1, sc(carga, 1.4)); R(12, 1, 2, 1, sc(carga, 1.3)); }
    R(1, 3, 18, 2, [150, 92, 54]); R(2, 5, 16, 5, [120, 70, 40]); R(2, 5, 16, 1, [96, 54, 30]);
    for (const r of [4, 9, 14]) R(r, 7, 1, 1, [70, 40, 24]);
    for (const w of [4, 13]) { R(w, 10, 4, 3, [40, 36, 34]); R(w + 1, 11, 2, 1, [120, 120, 128]); }
    return (VAG[k] = c);
  }

  // ---------- Fondo de cada piso (roca, galería tallada, nichos, entibado), en caché ----------
  function fondo(n, p, f, L) {
    const key = [n, p.i, p.v.length ? p.v[0].k : 'x', V.XW, f.agua ? 1 : 0, f.gas ? 1 : 0].join('|');
    const cache = V.fondos[n];
    if (cache && cache.key === key) return cache.c;
    const W = V.XW * 2, c = document.createElement('canvas'); c.width = W; c.height = FH;
    const x = c.getContext('2d'), e = D.estratoDe(n), r = U.rng((V.b.mina.sem + n * 977) >>> 0), base = e.col, O = V.XW;
    const R = (a, b, w, h, cl) => { x.fillStyle = Array.isArray(cl) ? rgb(cl) : cl; x.fillRect(a, b, w, h); };
    // roca en capas horizontales
    for (let y = 0; y < FH; y++) R(0, y, W, 1, sc(base, 0.82 + 0.12 * Math.sin(y * 0.21 + n) + 0.05 * Math.sin(y * 0.73)));
    for (let i = 0; i < W * FH / 22; i++) { const s = r() < 0.12 ? 2 : 1; R(Math.floor(r() * W), Math.floor(r() * FH), s, s, sc(base, 0.62 + r() * 0.62)); }
    for (let i = 0; i < W / 9; i++) { const px = r() * W, py = r() * FH, s = 2 + Math.floor(r() * 3); R(px, py, s, s - 1, sc(base, 1.12)); R(px, py + s - 1, s, 1, sc(base, 0.6)); } // piedritas
    for (let i = 0; i < W / 60; i++) { let px = r() * W, py = r() * FH; for (let j = 0; j < 7; j++) { const nx = px + (r() - 0.3) * 9, ny = py + (r() - 0.5) * 6; linea(x, px, py, nx, ny, rgb(sc(base, 0.5)), 1); px = nx; py = ny; } } // grietas
    // detalles del estrato
    if (n <= 1) for (let i = 0; i < W / 26; i++) { let px = r() * W, py = 0; for (let j = 0; j < 8; j++) { const nx = px + (r() - 0.5) * 5, ny = py + 2 + r() * 2; linea(x, px, py, nx, ny, 'rgba(70,46,24,0.8)', 1); px = nx; py = ny; } } // raíces
    if (n >= 3 && n <= 8) for (let i = 0; i < W / 140; i++) { const px = r() * W, py = 4 + r() * (TECHO - 12); x.strokeStyle = rgb(sc(base, 1.35), 0.8); x.lineWidth = 1; x.beginPath(); for (let a = 0; a < 9; a += 0.4) x.lineTo(px + Math.cos(a) * a * 0.55, py + Math.sin(a) * a * 0.55); x.stroke(); } // fósiles
    if (n >= 9) for (let i = 0; i < W / 40; i++) { x.strokeStyle = rgb(sc(base, 1.32), 0.55); x.lineWidth = 1; x.beginPath(); let px = r() * W, py = r() * FH; x.moveTo(px, py); for (let j = 0; j < 5; j++) { px += (r() - 0.4) * 26; py += (r() - 0.5) * 10; x.lineTo(px, py); } x.stroke(); } // vetitas de mármol
    if (n >= 11) for (let i = 0; i < W / 50; i++) { const px = r() * W, py = 3 + r() * (TECHO - 10), s = 3 + Math.floor(r() * 3); R(px - 1, py - 1, s + 2, s + 2, sc(base, 0.45)); R(px, py, s, s, [120, 90, 200]); R(px + 1, py + 1, 1, 1, [230, 210, 255]); } // geodas
    if (n >= 14) for (let i = 0; i < W / 90; i++) { let px = r() * W, py = SUELO + 4 + r() * 8; for (let j = 0; j < 6; j++) { const nx = px + (r() - 0.5) * 12, ny = py + (r() - 0.5) * 4; linea(x, px, py, nx, ny, '#5a1a08', 2); px = nx; py = ny; } } // grietas de magma (el brillo va en vivo)
    // la napa: el agua rezuma por la roca
    if (f.agua) for (let i = 0; i < W / 18; i++) { const px = Math.floor(r() * W), py = Math.floor(r() * (TECHO - 4)), l = 4 + Math.floor(r() * 18); R(px, py, 1, l, 'rgba(40,70,110,0.45)'); R(px, py + l, 1, 1, 'rgba(120,170,230,0.7)'); }
    // galería: columna por columna, con el techo irregular
    const techo = new Int16Array(W);
    for (let i = 0; i < W; i++) techo[i] = TECHO + Math.round(2.5 * Math.sin(i * 0.13 + n) + 1.5 * Math.sin(i * 0.37 + n * 2));
    const izq = Math.round(L.izq + O), der = Math.round(L.der + O);
    // nichos de las vetas destapadas (las agotadas, cámaras más grandes)
    const agotada = k => !p.v.some(a => a.k === k);
    for (let k = 0; k < p.i; k++) {
      const vx = Math.round(vetaX(n, k) + O), ag = agotada(k), w = ag ? 22 : 17, h = ag ? 22 : 14;
      for (let i = -w; i <= w; i++) { const t = i / w, ci = vx + i; if (ci >= 0 && ci < W) techo[ci] = Math.min(techo[ci], Math.round(TECHO - h * Math.sqrt(Math.max(0, 1 - t * t)) + (r() - 0.5) * 2)); }
    }
    // la pared del fondo: roca en lajas (píxel por píxel, con ImageData)
    const i0 = Math.max(0, izq), i1 = Math.min(W - 1, der);
    if (i1 > i0) {
      const img = x.getImageData(i0, 0, i1 - i0 + 1, SUELO), d = img.data, ww = i1 - i0 + 1, bk = sc(base, 0.5);
      for (let i = 0; i < ww; i++) {
        const t0 = techo[i + i0], sem = U.hash(i + i0, n, 3);
        for (let y = t0; y < SUELO; y++) {
          const laja = Math.floor((y + 3 * Math.sin((i + i0) * 0.05 + sem * 6)) / 7), junta = Math.abs(((y + 3 * Math.sin((i + i0) * 0.05 + sem * 6)) % 7)) < 0.9;
          const h = U.hash(Math.floor((i + i0 + laja * 5) / 9), laja, n), ruido = U.hash(i + i0, y, n + 7);
          let k = (0.78 + 0.32 * h + 0.12 * ruido) * (junta ? 0.62 : 1) * (y - t0 < 3 ? 0.75 : 1);
          const o = (y * ww + i) * 4;
          d[o] = Math.min(255, bk[0] * k); d[o + 1] = Math.min(255, bk[1] * k); d[o + 2] = Math.min(255, bk[2] * k); d[o + 3] = 255;
        }
      }
      x.putImageData(img, i0, 0);
      for (let i = i0; i <= i1; i++) { const t0 = techo[i]; R(i, t0, 1, 1, sc(base, 1.18)); R(i, t0 + 1, 1, 1, sc(base, 0.6)); } // borde del techo
    }
    R(izq, SUELO, der - izq, 3, sc(base, 0.5)); // piso
    for (let i = 0; i < (der - izq) / 6; i++) { const px = izq + r() * (der - izq); R(px, SUELO - 1, 2, 1, sc(base, 0.7 + r() * 0.5)); } // cascajo
    // cámaras agotadas: escombros
    for (let k = 0; k < p.i; k++) if (agotada(k)) { const vx = vetaX(n, k) + O; for (let j = 0; j < 10; j++) R(vx - 14 + r() * 28, SUELO - 1 - r() * 3, 2, 2, sc(base, 0.75 + r() * 0.3)); }
    // entibado: marcos cada 30 px (madera arriba, hierro desde el piso 8)
    const hierro = n >= 8, M1 = hierro ? [104, 108, 118] : [118, 78, 42], M2 = hierro ? [70, 74, 82] : [84, 54, 28];
    const marco = cx => {
      if (cx - 2 < izq || cx + 2 > der) return;
      const t = techo[Math.round(cx)] !== undefined ? Math.max(TECHO - 3, Math.min(TECHO + 2, techo[Math.round(cx)])) : TECHO;
      R(cx - 1, t, 3, SUELO - t, M1); R(cx + 1, t, 1, SUELO - t, M2);
      R(cx - 9, t, 19, 3, M1); R(cx - 9, t + 2, 19, 1, M2);
      linea(x, cx - 6, t + 3, cx - 1, t + 8, rgb(M2), 1); linea(x, cx + 6, t + 3, cx + 2, t + 8, rgb(M2), 1);
      if (hierro) for (let y = t + 6; y < SUELO; y += 8) R(cx, y, 1, 1, [170, 174, 184]);
    };
    const enNicho = cx => { for (let k = 0; k < p.i; k++) if (Math.abs(vetaX(n, k) - cx) < 26) return true; return false; };
    for (let cx = PW / 2 + 14; cx < L.der - 6; cx += 30) if (!enNicho(cx)) marco(Math.round(cx + O));
    for (let cx = -PW / 2 - 14; cx > L.izq + 6; cx -= 30) if (!enNicho(cx)) marco(Math.round(cx + O));
    // el frente: roca viva, más clara y quebrada
    const fx = Math.round((L.frente > 0 ? L.der : L.izq) + O);
    for (let y = TECHO - 3; y < SUELO; y++) { const w = 3 + Math.floor(r() * 3); R(L.frente > 0 ? fx - w + 1 : fx, y, w, 1, sc(base, 0.95 + r() * 0.2)); }
    const cacheo = { key, c };
    V.fondos[n] = cacheo;
    return c;
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
    V = { b, root, cv, ctx: cv.getContext('2d'), top, panel, scroll: 0, cx: 0, sel: 1, t: 0, fondos: {}, part: [], k: 2, XW: 260, topKey: '', panelKey: '', drag: null, sonT: 0, luz: document.createElement('canvas') };
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('keydown', onKey);
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', () => { if (V) V.drag = null; });
    cv.addEventListener('wheel', e => {
      if (!V) return;
      e.preventDefault();
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) V.cx += (e.deltaX || e.deltaY) / V.k * 0.8; else V.scroll += e.deltaY / V.k * 0.6;
      limitar();
    }, { passive: false });
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
  const onKey = e => {
    if (!V) return;
    if (e.key === 'Escape') UI.cerrarMina();
    else if (e.key === 'ArrowLeft') { V.cx -= 40; limitar(); } else if (e.key === 'ArrowRight') { V.cx += 40; limitar(); }
    else if (e.key === 'ArrowUp') UI.minaVerPiso(Math.max(1, V.sel - 1)); else if (e.key === 'ArrowDown') UI.minaVerPiso(Math.min(M().pisos(V.b), V.sel + 1));
  };
  function medir() {
    if (!V) return;
    const box = V.cv.parentElement.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    V.cv.width = Math.max(10, Math.floor(box.width * dpr)); V.cv.height = Math.max(10, Math.floor(box.height * dpr));
    V.cv.style.width = '100%'; V.cv.style.height = '100%';
    // un piso ocupa algo más de un tercio del alto; la escala es entera (píxeles parejos)
    V.k = Math.max(1, Math.round(U.clamp(box.height / (FH * 2.4), 1.4, 4.5) * dpr));
    ancho();
    limitar();
  }
  // medio ancho del mundo: lo que pida la galería más larga (y la superficie)
  function ancho() {
    const Mi = M(), b = V.b;
    let m = 230;
    for (let n = 1; n <= Mi.pisos(b); n++) { const L = alcance(n, Mi.piso(b, n)); m = Math.max(m, -L.izq + 30, L.der + 30); }
    V.XW = Math.ceil(m / 20) * 20;
  }
  const altoTotal = () => SKY + M().pisos(V.b) * FH + 30;
  function limitar() {
    const visH = V.cv.height / V.k, visW = V.cv.width / V.k;
    V.scroll = U.clamp(V.scroll, 0, Math.max(0, altoTotal() - visH));
    const m = Math.max(0, V.XW - visW / 2);
    V.cx = U.clamp(V.cx, -m, m);
  }
  function onDown(e) { V.drag = { x: e.clientX, y: e.clientY, s: V.scroll, cx: V.cx, mov: 0 }; V.cv.setPointerCapture(e.pointerId); }
  function onMove(e) {
    if (!V || !V.drag) return;
    const dpr = V.cv.width / V.cv.getBoundingClientRect().width, dx = (e.clientX - V.drag.x) * dpr / V.k, dy = (e.clientY - V.drag.y) * dpr / V.k;
    V.drag.mov = Math.max(V.drag.mov, Math.hypot(dx, dy));
    V.scroll = V.drag.s - dy; V.cx = V.drag.cx - dx; limitar();
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
    if ((v.anchoT = (v.anchoT || 0) + dt) > 1.5) { v.anchoT = 0; const a = v.XW; ancho(); if (a !== v.XW) { v.fondos = {}; limitar(); } }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a0705'; ctx.fillRect(0, 0, v.cv.width, v.cv.height);
    const k = v.k, visW = v.cv.width / k, ox = Math.round((visW / 2 - v.cx) * k) / k;
    ctx.setTransform(k, 0, 0, k, ox * k, -Math.round(v.scroll * k));
    v.x0 = -ox; v.x1 = -ox + visW; // lo visible en x
    const pisos = Mi.pisos(b), c = Mi.cuenta(b), vis0 = v.scroll, vis1 = v.scroll + v.cv.height / k;
    if (vis0 < SKY) superficie(ctx, pisos);
    for (let n = 1; n <= pisos; n++) {
      const y0 = yPiso(n);
      if (y0 + FH < vis0 || y0 > vis1) continue;
      piso(ctx, n, y0, c[n]);
    }
    if (vis1 > yPiso(pisos) + FH) { ctx.fillStyle = '#0a0705'; ctx.fillRect(-v.XW, yPiso(pisos) + FH, v.XW * 2, 30); }
    pozo(ctx, pisos, c, vis0, vis1);
    particulas(ctx, dt);
    // la selección
    if (v.sel >= 1 && v.sel <= pisos) { ctx.strokeStyle = 'rgba(255,215,106,0.85)'; ctx.lineWidth = 2 / k; ctx.strokeRect(v.x0 + 1, yPiso(v.sel) + 1, visW - 2, FH - 2); }
    // sonido de picos según cuántos mineros se ven
    v.sonT -= dt;
    if (v.sonT <= 0 && PK.Sfx) {
      let vis = 0; for (let n = 1; n <= pisos; n++) { const y0 = yPiso(n); if (y0 + FH >= vis0 && y0 <= vis1) vis += c[n]; }
      if (vis) { PK.Sfx.play('pick'); v.sonT = 2.6 / Math.min(4, 0.5 + vis / 6); } else v.sonT = 1;
    }
  }

  // ---------- Superficie ----------
  function superficie(ctx, pisos) {
    const h = new Date(G().ahora()).getHours(), noche = h < 7 || h >= 20, XW = V.XW, Y = SKY - 14, b = V.b;
    const gr = ctx.createLinearGradient(0, 0, 0, Y);
    gr.addColorStop(0, noche ? '#0a1226' : '#5e9fd6'); gr.addColorStop(1, noche ? '#1e2846' : '#c6e2f0');
    ctx.fillStyle = gr; ctx.fillRect(-XW, 0, XW * 2, Y);
    if (noche) { ctx.fillStyle = '#e8e8ff'; for (let i = 0; i < 60; i++) ctx.fillRect(-XW + ((i * 97) % (XW * 2)), (i * 53) % (Y - 30), 1, 1); ctx.fillStyle = '#f4f0d0'; ctx.beginPath(); ctx.arc(-XW + 60, 22, 7, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (const [cx, cy] of [[-XW + 70, 26], [XW - 120, 18], [40, 14]]) { ctx.beginPath(); ctx.ellipse(cx, cy, 16, 5, 0, 0, Math.PI * 2); ctx.ellipse(cx + 10, cy - 3, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); } }
    // cerros
    ctx.fillStyle = noche ? '#1a2a24' : '#7aa070';
    ctx.beginPath(); ctx.moveTo(-XW, Y); for (let x = -XW; x <= XW; x += 10) ctx.lineTo(x, Y - 18 - 12 * Math.sin(x * 0.012) - 6 * Math.sin(x * 0.031)); ctx.lineTo(XW, Y); ctx.fill();
    ctx.fillStyle = noche ? '#22362a' : '#5c8a3c'; ctx.fillRect(-XW, Y, XW * 2, 5);
    ctx.fillStyle = '#6a4a2c'; ctx.fillRect(-XW, Y + 5, XW * 2, SKY - Y - 5);
    for (let x = -XW; x < XW; x += 7) { ctx.fillStyle = '#4e8a34'; ctx.fillRect(x, Y - 1, 1, 2); }
    // escombrera
    const esc = Math.min(70, 16 + pisos * 4);
    ctx.fillStyle = '#7e7a74'; ctx.beginPath(); ctx.moveTo(110, Y + 1); ctx.lineTo(110 + esc, Y - esc * 0.5); ctx.lineTo(110 + esc * 2.2, Y + 1); ctx.fill();
    ctx.fillStyle = '#5e5a54'; ctx.beginPath(); ctx.moveTo(110 + esc, Y - esc * 0.5); ctx.lineTo(110 + esc * 2.2, Y + 1); ctx.lineTo(110 + esc * 1.4, Y + 1); ctx.fill();
    // casa del torno con chimenea y humo
    const hierro = b.lvl >= 10, cx = 44;
    ctx.fillStyle = hierro ? '#8a5a44' : '#8a6038'; ctx.fillRect(cx, Y - 30, 52, 30);
    ctx.fillStyle = hierro ? '#74482f' : '#6e4a2a'; for (let y = Y - 28; y < Y; y += 4) ctx.fillRect(cx, y, 52, 1);
    ctx.fillStyle = '#a04a32'; ctx.beginPath(); ctx.moveTo(cx - 4, Y - 30); ctx.lineTo(cx + 26, Y - 46); ctx.lineTo(cx + 56, Y - 30); ctx.fill();
    ctx.fillStyle = '#2a1c12'; ctx.fillRect(cx + 8, Y - 16, 9, 16);
    ctx.fillStyle = noche ? '#ffd770' : '#9cc4dc'; ctx.fillRect(cx + 28, Y - 22, 7, 6); ctx.fillRect(cx + 40, Y - 22, 7, 6);
    ctx.fillStyle = '#5a4a40'; ctx.fillRect(cx + 40, Y - 64, 7, 30);
    if (b.workers.length && Math.random() < 0.35) V.part.push({ x: cx + 43, y: Y - 66, vx: 5 + Math.random() * 4, vy: -7 - Math.random() * 4, life: 0, max: 3, col: (b.mina.mont || 0) >= 2 ? [70, 66, 64] : [210, 210, 210], s: 3, puff: 1 });
    // tolva y carromato del color del reino
    const tx = -80;
    ctx.fillStyle = '#6a4426'; ctx.fillRect(tx - 14, Y - 40, 3, 40); ctx.fillRect(tx + 11, Y - 40, 3, 40);
    ctx.fillStyle = '#8a5a30'; ctx.beginPath(); ctx.moveTo(tx - 18, Y - 44); ctx.lineTo(tx + 18, Y - 44); ctx.lineTo(tx + 6, Y - 26); ctx.lineTo(tx - 6, Y - 26); ctx.fill();
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(tx - 14, Y - 46, 28, 3);
    const col = Sp.ownerColor('p');
    ctx.fillStyle = rgb(col); ctx.fillRect(tx - 16, Y - 14, 32, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(tx - 16, Y - 6, 32, 1);
    ctx.fillStyle = '#9a8a7a'; ctx.fillRect(tx - 12, Y - 17, 24, 3);
    for (const w of [tx - 10, tx + 10]) { ctx.fillStyle = '#2a1c12'; ctx.beginPath(); ctx.arc(w, Y - 3, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#8a6a40'; ctx.fillRect(w - 1, Y - 4, 2, 2); }
    ctx.fillStyle = '#d8c8a8'; ctx.fillRect(tx - 34, Y - 12, 12, 7); ctx.fillRect(tx - 24, Y - 15, 5, 5); // el buey
    // castillete: celosía con sus poleas, sobre la boca del pozo
    const pata = hierro ? '#5c6068' : '#6a4426', pata2 = hierro ? '#3e4248' : '#4a2e18', alto = 82, top = Y - alto;
    ctx.lineWidth = 2.5; ctx.strokeStyle = pata;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 30, Y); ctx.lineTo(s * 6, top); ctx.stroke(); }
    ctx.lineWidth = 1; ctx.strokeStyle = pata2;
    for (let i = 0; i < 6; i++) { const y1 = Y - i * alto / 6, y2 = Y - (i + 1) * alto / 6, w1 = 30 - 24 * i / 6, w2 = 30 - 24 * (i + 1) / 6; ctx.beginPath(); ctx.moveTo(-w1, y1); ctx.lineTo(w2, y2); ctx.moveTo(w1, y1); ctx.lineTo(-w2, y2); ctx.moveTo(-w2, y2); ctx.lineTo(w2, y2); ctx.stroke(); }
    ctx.lineWidth = 2; ctx.strokeStyle = pata; ctx.beginPath(); ctx.moveTo(26, Y); ctx.lineTo(54, Y - 34); ctx.stroke(); // puntal hacia el torno
    const ang = V.t * (b.workers.length ? 2.2 : 0);
    rueda(ctx, 0, top, 11, ang, hierro);
    if ((b.mina.mont || 0) >= 3) rueda(ctx, 13, top + 8, 9, -ang, hierro);
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(9, top + 3); ctx.lineTo(cx + 10, Y - 26); ctx.stroke();
    ctx.fillStyle = rgb(col); ctx.fillRect(-1, top - 22, 1, 10); ctx.fillRect(0, top - 22, 8, 5); // banderín
    ctx.font = '8px "Pixelify Sans", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = noche ? '#ffd76a' : '#2a1808';
    ctx.fillText(D.MINA.montacargas[b.mina.mont || 0].name, V.x0 + 6, 6);
  }
  function rueda(ctx, x, y, r, ang, hierro) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.strokeStyle = hierro ? '#a0a6b0' : '#3a2a1c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * Math.PI / 3) * r, Math.sin(i * Math.PI / 3) * r); ctx.stroke(); }
    ctx.fillStyle = '#2a2420'; ctx.fillRect(-1.5, -1.5, 3, 3);
    ctx.restore();
  }

  // ---------- Pozo y jaula ----------
  function pozo(ctx, pisos, c, vis0, vis1) {
    const y0 = Math.max(SKY - 14, vis0 - 4), y1 = Math.min(yPiso(pisos) + FH, vis1 + 4), L = -PW / 2;
    ctx.fillStyle = '#120c08'; ctx.fillRect(L, y0, PW, y1 - y0);
    for (let y = Math.floor(y0 / 10) * 10; y < y1; y += 10) { ctx.fillStyle = '#3a2818'; ctx.fillRect(L, y, 3, 9); ctx.fillRect(-L - 3, y, 3, 9); ctx.fillStyle = '#2a1c10'; ctx.fillRect(L, y + 9, PW, 1); }
    ctx.fillStyle = '#5a4a34'; for (let y = Math.floor(y0 / 6) * 6; y < y1; y += 6) ctx.fillRect(L + 4, y, 5, 1); ctx.fillRect(L + 4, y0, 1, y1 - y0); ctx.fillRect(L + 8, y0, 1, y1 - y0); // escalera
    ctx.fillStyle = '#6a6e76'; ctx.fillRect(-5, y0, 1, y1 - y0); ctx.fillRect(10, y0, 1, y1 - y0); // guías
    // descansos de cada piso con farol, campana y placa
    ctx.font = '8px "PK Num", "Pixelify Sans", monospace'; ctx.textBaseline = 'top';
    for (let n = 1; n <= pisos; n++) {
      const y = yPiso(n) + SUELO;
      if (y < vis0 - FH || y > vis1 + 10) continue;
      ctx.fillStyle = '#5a3c22'; ctx.fillRect(L - 4, y, PW + 8, 3);
      ctx.fillStyle = '#ffd770'; ctx.fillRect(L + 1, y - 34, 2, 3); // farol
      ctx.fillStyle = '#c8a040'; ctx.fillRect(-L - 6, y - 36, 3, 3); // campana
      const sel = n === V.sel, txt = 'Piso ' + n, w = 40, px = L - 6 - w;
      ctx.fillStyle = sel ? '#ffd76a' : 'rgba(30,20,12,0.9)'; ctx.fillRect(px, yPiso(n) + 6, w, 11);
      ctx.strokeStyle = sel ? '#7a4a10' : '#8a6a3a'; ctx.lineWidth = 1 / V.k; ctx.strokeRect(px, yPiso(n) + 6, w, 11);
      ctx.fillStyle = sel ? '#1a1008' : '#f0e2c0'; ctx.fillText(txt, px + 6, yPiso(n) + 7);
    }
    // la jaula baja con mineros y sube con una vagoneta llena, hasta el piso más hondo con gente
    let hondo = 0;
    for (let n = pisos; n >= 1; n--) if (c[n]) { hondo = n; break; }
    const arriba = SKY - 30, abajo = hondo ? yPiso(hondo) + SUELO - 22 : arriba, per = 8 + hondo, ph = (V.t / per) % 1;
    const f = hondo ? (ph < 0.1 ? 0 : ph < 0.5 ? (ph - 0.1) / 0.4 : ph < 0.6 ? 1 : 1 - (ph - 0.6) / 0.4) : 0, y = arriba + (abajo - arriba) * (f * f * (3 - 2 * f));
    ctx.fillStyle = '#2a2420'; ctx.fillRect(1, SKY - 96, 1, y - SKY + 96);
    const hierro = V.b.lvl >= 10;
    ctx.fillStyle = hierro ? '#7a7e86' : '#7a5232'; ctx.fillRect(-11, y, 24, 22); ctx.fillRect(-12, y - 2, 26, 2);
    ctx.fillStyle = '#1a1410'; ctx.fillRect(-9, y + 2, 20, 18);
    if (hondo) {
      const subiendo = ph >= 0.5;
      if (subiendo) ctx.drawImage(vagoneta(RESCOL.ore), -9, y + 7);
      else { const col = Sp.ownerColor('p'); ctx.drawImage(figura('caminar', 0, col, 1, hondo >= 8), -10, y - 8, 15, 22); ctx.drawImage(figura('caminar', 2, col, 2, hondo >= 8), 0, y - 8, 15, 22); }
    }
    ctx.fillStyle = hierro ? '#9aa0aa' : '#9a7046'; for (let i = 0; i < 6; i++) ctx.fillRect(-9 + i * 4, y + 2, 1, 18);
  }

  // ---------- Un piso ----------
  function piso(ctx, n, y0, mineros) {
    const b = V.b, Mi = M(), p = Mi.piso(b, n), f = Mi.info(b, n), e = f.e, L = alcance(n, p), O = V.XW;
    const bg = fondo(n, p, f, L);
    // solo lo visible del fondo
    const sx = Math.max(0, Math.floor(V.x0 + O) - 2), sw = Math.min(bg.width - sx, Math.ceil(V.x1 - V.x0) + 4);
    if (sw > 0) ctx.drawImage(bg, sx, 0, sw, FH, sx - O, y0, sw, FH);
    const cerrado = !Mi.trabajable(b, n), suelo = y0 + SUELO;
    // vetas: el filón atraviesa la roca hasta su nicho; las pepitas se achican al agotarse
    const luces = [];
    for (const a of p.v) {
      const def = Mi.veta(b, n, a.k), vx = vetaX(n, a.k);
      if (vx < V.x0 - 80 || vx > V.x1 + 80) continue;
      veta(ctx, n, y0, a, def, vx, a === p.v[0], luces);
    }
    // ducto de ventilación
    if (f.gas && p.m.ventilacion) {
      ctx.fillStyle = '#6a6e76'; ctx.fillRect(L.izq + 4, y0 + TECHO + 4, L.der - L.izq - 8, 4);
      ctx.fillStyle = '#8a8e96'; ctx.fillRect(L.izq + 4, y0 + TECHO + 4, L.der - L.izq - 8, 1);
      for (let x = L.izq + 20; x < L.der - 10; x += 24) { ctx.fillStyle = '#4a4e56'; ctx.fillRect(x, y0 + TECHO + 4, 1, 4); }
      ctx.save(); ctx.translate(PW / 2 + 12, y0 + TECHO + 12); ctx.rotate(V.t * 10); ctx.fillStyle = '#b0b6c0'; ctx.fillRect(-6, -1, 12, 2); ctx.fillRect(-1, -6, 2, 12); ctx.restore();
      ctx.strokeStyle = '#4a4e56'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(PW / 2 + 12, y0 + TECHO + 12, 7, 0, Math.PI * 2); ctx.stroke();
    }
    // rieles
    if (p.m.rieles) {
      ctx.fillStyle = '#4a3420'; for (let x = Math.ceil(L.izq / 6) * 6; x < L.der; x += 6) ctx.fillRect(x, suelo - 1, 4, 2);
      ctx.fillStyle = '#9aa0aa'; ctx.fillRect(L.izq + 2, suelo - 2, L.der - L.izq - 4, 1);
    }
    // faroles colgados de los marcos
    // faroles colgados de los marcos del entibado (uno cada dos marcos)
    if (p.m.lamparas) for (const s of [1, -1]) for (let x = s * (PW / 2 + 44); s > 0 ? x < L.der - 8 : x > L.izq + 8; x += s * 60) { if (!p.v.some(a => Math.abs(vetaX(n, a.k) - x) < 26)) { farol(ctx, x, y0 + TECHO + 3); luces.push([x, y0 + TECHO + 12, 34, 1]); } }
    // bomba de agua junto al pozo
    if (f.agua && p.m.bomba) bomba(ctx, -PW / 2 - 22, suelo, n);
    // mineros
    if (!cerrado && mineros) cuadrilla(ctx, n, p, L, suelo, mineros, luces);
    // agua: con bomba es un charco; sin bomba les llega a las rodillas
    if (f.agua) agua(ctx, L, y0, suelo, p.m.bomba);
    // gas sin ventilación: niebla verde y barricada
    if (f.gas && !p.m.ventilacion) gas(ctx, L, y0, suelo);
    // oscuridad: solo se ve lo que alumbran faroles, cascos, vetas y el descanso del pozo
    luces.push([PW / 2 + 6, suelo - 20, 30, 0.9], [-PW / 2 - 6, suelo - 20, 30, 0.9]);
    oscuridad(ctx, n, y0, L, luces, p.m.lamparas ? 0.42 : 0.62);
    // lo que tiene que leerse aunque esté oscuro: el brillo de las vetas, la superficie del agua y el magma
    for (const a of p.v) { const def = Mi.veta(b, n, a.k), vx = vetaX(n, a.k); if (vx > V.x0 - 40 && vx < V.x1 + 40) destellos(ctx, n, y0, a, def, vx); }
    if (f.agua) { const wl = suelo - (p.m.bomba ? 3 : 17); ctx.fillStyle = 'rgba(160,210,255,0.55)'; for (let x = Math.max(L.izq, V.x0); x < Math.min(L.der, V.x1); x += 2) ctx.fillRect(x, Math.round(wl + Math.sin(x * 0.18 + V.t * 2.4) * 0.9), 2, 1); }
    if (n >= 14) magma(ctx, y0);
    if (cerrado) { ctx.font = '9px "Pixelify Sans", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = '#e6ffb0'; ctx.fillText('Gas: hace falta ventilación', PW / 2 + 10, y0 + TECHO + 8); }
    // el nombre del estrato, a un costado de la placa
    ctx.font = '7px "Pixelify Sans", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(240,226,192,0.75)';
    ctx.fillText(e.name + (f.agua ? ' · agua' : '') + (f.gas ? ' · gas' : ''), PW / 2 + 6, y0 + 9);
  }

  // filón + nicho + pepitas; el que se trabaja, con más luz
  function veta(ctx, n, y0, a, def, vx, activa, luces) {
    const col = RESCOL[def.res] || [200, 200, 200], frac = U.clamp(a.q / def.cant, 0, 1), r = U.rng((V.b.mina.sem + n * 131 + a.k * 17) >>> 0);
    r();
    // el filón: una banda que baja serpenteando desde arriba de la roca hasta el nicho
    const ancho = 4 + Math.round(5 * frac), pts = [];
    let px = vx + (r() - 0.5) * 50, py = y0 + 2;
    while (py < y0 + TECHO - 10) { pts.push([px, py]); px += (vx - px) * 0.35 + (r() - 0.5) * 8; py += 5 + r() * 4; }
    pts.push([vx, y0 + TECHO - 12]);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], w = Math.max(2, Math.round(ancho * (0.55 + 0.45 * i / pts.length)));
      linea(ctx, ax, ay, bx, by, rgb(sc(col, 0.62)), w + 2);
      linea(ctx, ax, ay, bx, by, rgb(sc(col, 0.95)), w);
    }
    // pepitas y cristales en la cara del nicho (más grandes cuanto más queda)
    const m = 6 + Math.round(22 * frac);
    for (let i = 0; i < m; i++) {
      const ang = r() * Math.PI, rad = 4 + r() * 11, x = Math.round(vx + Math.cos(ang) * rad * 1.3), y = Math.round(y0 + TECHO - 4 - Math.sin(ang) * rad * 0.8), s = 1 + Math.floor(r() * (1 + 3 * frac));
      ctx.fillStyle = rgb(sc(col, 0.6)); ctx.fillRect(x - 1, y - 1, s + 2, s + 2);
      ctx.fillStyle = rgb(sc(col, 0.85 + r() * 0.3)); ctx.fillRect(x, y, s, s);
      ctx.fillStyle = rgb(sc(col, 1.45)); ctx.fillRect(x, y, 1, 1);
    }
    if (def.esp) { // cristal de cueva o hierro estelar: un racimo que late
      const ec = RESCOL[def.esp], pul = 0.75 + 0.25 * Math.sin(V.t * 3 + a.k);
      for (let i = 0; i < 4; i++) { const x = vx - 6 + i * 4, h = 5 + (i % 2) * 4; ctx.fillStyle = rgb(sc(ec, pul)); ctx.fillRect(x, y0 + TECHO - 8 - h, 3, h); ctx.fillStyle = rgb(sc(ec, 1.4)); ctx.fillRect(x, y0 + TECHO - 8 - h, 1, h); }
      luces.push([vx, y0 + TECHO - 10, 26, 1]);
    }
    luces.push([vx, y0 + TECHO - 8, activa ? 30 : 20, activa ? 0.9 : 0.6]); // un farol en cada veta abierta
  }
  // destellos que se ven aun en la oscuridad (dibujados después de la sombra)
  function destellos(ctx, n, y0, a, def, vx) {
    const col = RESCOL[def.res] || [220, 220, 220], r = U.rng((V.b.mina.sem + n * 59 + a.k * 7) >>> 0);
    for (let i = 0; i < 6; i++) {
      const x = Math.round(vx - 16 + r() * 32), y = Math.round(y0 + TECHO - 16 + r() * 12), fase = r() * 6.28;
      const s = Math.sin(V.t * 3 + fase);
      if (s < 0.6) continue;
      ctx.fillStyle = rgb(sc(col, 1.5), (s - 0.6) * 2.4); ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    }
  }
  function farol(ctx, x, y) { // farol de aceite colgado de un gancho: tapa, vidrio con llama y base
    const fl = 0.85 + 0.15 * Math.sin(V.t * 9 + x * 3);
    ctx.fillStyle = '#2a1c10'; ctx.fillRect(x, y, 1, 4); ctx.fillRect(x - 1, y + 3, 3, 1);
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x - 3, y + 4, 7, 2); ctx.fillRect(x - 3, y + 12, 7, 2);
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(x - 3, y + 6, 1, 6); ctx.fillRect(x + 3, y + 6, 1, 6);
    ctx.fillStyle = rgb([255, Math.round(200 * fl), 90]); ctx.fillRect(x - 2, y + 6, 5, 6);
    ctx.fillStyle = rgb([255, 250, Math.round(200 * fl)]); ctx.fillRect(x, y + 8, 1, 3);
  }
  function bomba(ctx, x, suelo, n) {
    const sube = Math.sin(V.t * 5) * 3, vapor = n >= 9;
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 6, suelo - 16, 12, 16);
    ctx.fillStyle = '#7a7e86'; ctx.fillRect(x - 5, suelo - 15, 10, 2);
    ctx.fillStyle = '#9aa0aa'; ctx.fillRect(x - 1, suelo - 26 + sube, 2, 10); ctx.fillRect(x - 4, suelo - 27 + sube, 8, 2); // émbolo
    ctx.save(); ctx.translate(x + 8, suelo - 10); ctx.rotate(V.t * 5); ctx.strokeStyle = '#8a8e96'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke(); ctx.restore(); // volante
    ctx.fillStyle = '#6a6e76'; ctx.fillRect(x + 6, suelo - 30, 2, 30); ctx.fillRect(x + 6, suelo - 30, PW / 2 + 8, 2); // caño que sube por el pozo
    if (Math.random() < 0.5) V.part.push({ x: x + 7 + Math.random(), y: suelo - 30, vx: 0, vy: -18, life: 0, max: 0.4, col: [120, 180, 240], s: 1, puff: 1 });
    if (vapor && Math.random() < 0.15) V.part.push({ x: x, y: suelo - 28, vx: (Math.random() - 0.5) * 6, vy: -8, life: 0, max: 1.4, col: [220, 220, 220], s: 2, puff: 1 });
  }
  function agua(ctx, L, y0, suelo, bomba) {
    const alto = bomba ? 3 : 17, wl = suelo - alto, x0 = Math.max(L.izq, V.x0 - 2), x1 = Math.min(L.der, V.x1 + 2);
    if (x1 <= x0) return;
    const g = ctx.createLinearGradient(0, wl, 0, suelo + 2);
    g.addColorStop(0, 'rgba(70,130,200,0.62)'); g.addColorStop(1, 'rgba(24,52,100,0.86)');
    ctx.fillStyle = g; ctx.fillRect(x0, wl, x1 - x0, suelo + 2 - wl);
    // reflejos que se mueven
    for (let x = Math.ceil(x0 / 14) * 14; x < x1; x += 14) { const o = (V.t * 6 + x * 0.7) % 14; ctx.fillStyle = 'rgba(200,230,255,0.35)'; ctx.fillRect(x + o, wl + 2 + ((x / 14) % 3), 4, 1); }
    // goteras desde el techo, con salpicadura
    if (Math.random() < (bomba ? 0.12 : 0.3)) { const x = x0 + Math.random() * (x1 - x0); V.part.push({ x, y: y0 + TECHO + 2, vx: 0, vy: 20, life: 0, max: 2, col: [150, 200, 255], s: 1, piso: wl, gota: 1 }); }
  }
  function gas(ctx, L, y0, suelo) {
    for (let i = 0; i < 9; i++) {
      const x = L.izq + ((i * 73 + V.t * (6 + i)) % Math.max(20, L.der - L.izq)), y = y0 + TECHO + 10 + (i % 4) * 9 + Math.sin(V.t + i) * 3;
      ctx.fillStyle = 'rgba(150,210,90,0.18)'; ctx.beginPath(); ctx.ellipse(x, y, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#7a5232';
    for (const s of [-1, 1]) { const x = s * (PW / 2 + 10); ctx.save(); ctx.translate(x, suelo - 18); ctx.rotate(s * 0.5); ctx.fillRect(-12, -2, 24, 4); ctx.rotate(-s); ctx.fillRect(-12, -2, 24, 4); ctx.restore(); }
    ctx.fillStyle = '#d8c040'; ctx.fillRect(PW / 2 + 22, suelo - 40, 14, 10); ctx.fillStyle = '#1a1408'; ctx.fillRect(PW / 2 + 28, suelo - 38, 2, 5); ctx.fillRect(PW / 2 + 28, suelo - 32, 2, 1); // cartel de peligro
  }
  function magma(ctx, y0) {
    const pul = 0.35 + 0.25 * Math.sin(V.t * 1.6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, y0 + SUELO, 0, y0 + FH);
    g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(1, 'rgba(255,90,20,' + pul * 0.5 + ')');
    ctx.fillStyle = g; ctx.fillRect(V.x0, y0 + SUELO, V.x1 - V.x0, FH - SUELO);
    ctx.restore();
  }
  // La sombra: un lienzo aparte del tamaño de lo visible del piso, oscuro, con agujeros donde hay luz
  function oscuridad(ctx, n, y0, L, luces, base) {
    const w = Math.ceil(V.x1 - V.x0) + 2, c = V.luz;
    if (c.width !== w || c.height !== FH) { c.width = w; c.height = FH; }
    const x = c.getContext('2d'), ox = V.x0 - 1;
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, w, FH);
    x.fillStyle = 'rgba(6,4,3,' + base + ')'; x.fillRect(0, 0, w, FH);
    x.globalCompositeOperation = 'destination-out';
    for (let [lx, ly, r, a] of luces) {
      if (lx + r < V.x0 || lx - r > V.x1) continue;
      r = r * 1.25;
      const g = x.createRadialGradient(lx - ox, ly - y0, 0, lx - ox, ly - y0, r);
      g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(lx - ox - r, ly - y0 - r, r * 2, r * 2);
    }
    ctx.drawImage(c, ox, y0);
    // la luz cálida encima, un poco
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [lx, ly, r, a] of luces) {
      if (lx + r < V.x0 || lx - r > V.x1 || a < 0.8) continue;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.7);
      g.addColorStop(0, 'rgba(255,170,70,' + 0.1 * a + ')'); g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g; ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  // ---------- La cuadrilla de un piso ----------
  // Hasta 10 figuras: barrenero en el frente, picadores en la veta, un palero que llena la vagoneta y un carretillero
  // que la empuja hasta el pozo (sin rieles, cargadores con un saco). Sin veta a la vista, todos al frente.
  function cuadrilla(ctx, n, p, L, suelo, cuantos, luces) {
    const col = Sp.ownerColor('p'), hierro = n >= 8, act = p.v[0], def = act ? M().veta(V.b, n, act.k) : null;
    const vx = act ? vetaX(n, act.k) : null, cc = def ? RESCOL[def.res] : RESCOL.stone, frente = L.frente > 0 ? L.der : L.izq;
    const muestra = Math.min(cuantos, 10), rieles = !!p.m.rieles, landing = vx !== null ? (vx > 0 ? PW / 2 + 10 : -PW / 2 - 10) : 0;
    let quien = 0;
    const pon = (pose, fr, x, flip, carga, mirar) => {
      quien++;
      if (!(x > V.x0 - 24 && x < V.x1 + 24)) return; // (también descarta NaN)
      const fg = figura(pose, ((fr | 0) % 4 + 4) % 4, col, (quien * 3 + n) % 4, hierro, carga);
      // un poco más grandes que en el mapa: en la mina son los protagonistas
      ctx.save(); ctx.translate(Math.round(x), suelo - 36);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(fg, -13, 0, 26, 36);
      ctx.restore();
      luces.push([x + (flip ? -9 : 9) * (mirar || 1), suelo - 30, 24, 0.85]); // la lámpara del casco
    };
    let picadores = 0;
    for (let i = 0; i < muestra; i++) {
      let rol = !act ? (i % 3 === 2 ? 'palero' : 'barrenero') : i === 0 || i === 9 ? 'barrenero' : i === 3 ? 'palero' : i === 2 || i === 6 ? 'carro' : 'picador';
      if (rol === 'barrenero') {
        const lado = L.frente, x = frente - lado * (11 + (i % 3) * 9), fr = Math.floor((V.t * 4 + i * 0.37) % 2);
        pon(i % 3 === 2 ? 'palear' : 'barrenar', i % 3 === 2 ? Math.floor((V.t * 2 + i) % 3) : fr, x, lado < 0, RESCOL.stone);
        if (fr === 1 && Math.random() < 0.2) polvo(frente - lado * 3, suelo - 16, [160, 150, 136]);
      } else if (rol === 'picador') {
        const lado = picadores % 2 ? -1 : 1, dist = 10 + Math.floor(picadores / 2) * 9;
        picadores++;
        const x = vx + lado * dist, fr = Math.floor((V.t * 2.6 + i * 0.29) % 1 * 4);
        pon('picar', fr, x, lado > 0, null);
        if (fr === 2 && Math.random() < 0.18) chispa(vx + lado * (dist - 9), suelo - 22, cc);
      } else if (rol === 'palero') {
        const x = vx + (vx > 0 ? -24 : 24), fr = Math.floor((V.t * 2 + i * 0.5) % 3);
        pon('palear', fr, x, vx > 0 ? false : true, cc);
        if (!rieles) { ctx.fillStyle = rgb(sc(cc, 0.8)); ctx.fillRect(Math.round(x + (vx > 0 ? 8 : -14)), suelo - 4, 7, 4); ctx.fillStyle = rgb(cc); ctx.fillRect(Math.round(x + (vx > 0 ? 9 : -13)), suelo - 6, 5, 2); } // montón de mineral
      } else {
        // va y viene entre la veta y el pozo: lleno hacia el pozo, vacío de vuelta
        const largo = Math.abs(vx - landing), per = largo / 14 + 3, ph = ((V.t / per) + i * 0.37) % 2;
        const t = ph < 1 ? ph : 2 - ph, x = vx + (landing - vx) * Math.min(1, Math.max(0, (t - 0.1) / 0.8)), haciaPozo = ph < 1, lleno = haciaPozo;
        const flip = (landing < vx) === haciaPozo, fr = Math.floor(V.t * 8 + i) % 4;
        if (rieles) {
          const cx = x + (flip ? -15 : 15);
          if (cx > V.x0 - 20 && cx < V.x1 + 20) ctx.drawImage(vagoneta(lleno ? cc : null), Math.round(cx - 10), suelo - 14);
          pon('empujar', fr, x, flip, null);
        } else pon(lleno ? 'cargar' : 'caminar', fr, x, flip, lleno ? cc : null);
      }
    }
    if (cuantos > muestra) { ctx.font = '8px "Pixelify Sans", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = '#ffd76a'; ctx.fillText('+' + (cuantos - muestra) + ' mineros', (vx || frente) - 14, suelo - 48); }
  }
  function polvo(x, y, col) { for (let i = 0; i < 4; i++) V.part.push({ x, y, vx: (Math.random() - 0.5) * 18, vy: -6 - Math.random() * 6, life: 0, max: 1, col, s: 2, puff: 1 }); }
  function chispa(x, y, col) { for (let i = 0; i < 3; i++) V.part.push({ x, y, vx: (Math.random() - 0.5) * 34, vy: -12 - Math.random() * 14, life: 0, max: 0.35, col: [255, 240, 180], s: 1 }); for (let i = 0; i < 2; i++) V.part.push({ x, y, vx: (Math.random() - 0.5) * 22, vy: -8, life: 0, max: 0.7, col, s: 2 }); }
  function particulas(ctx, dt) {
    const P = V.part;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; if (!q.puff) q.vy += (q.gota ? 90 : 40) * dt;
      if (q.piso && q.y >= q.piso) {
        if (q.gota) { V.part.push({ x: q.x, y: q.piso, vx: 0, vy: 0, life: 0, max: 0.5, anillo: 1, col: q.col }); for (let j = 0; j < 2; j++) V.part.push({ x: q.x, y: q.piso - 1, vx: (Math.random() - 0.5) * 20, vy: -14, life: 0, max: 0.3, col: q.col, s: 1 }); }
        P.splice(i, 1); continue;
      }
      if (q.life >= q.max) { P.splice(i, 1); continue; }
      const a = 1 - q.life / q.max;
      if (q.anillo) { ctx.strokeStyle = rgb(q.col, a * 0.8); ctx.lineWidth = 1 / V.k * 2; ctx.beginPath(); ctx.ellipse(q.x, q.y, 1 + q.life * 14, 0.5 + q.life * 3, 0, 0, Math.PI * 2); ctx.stroke(); continue; }
      ctx.fillStyle = rgb(q.col, q.puff ? 0.5 * a : a);
      ctx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.gota ? 2 : q.s);
    }
    if (P.length > 500) P.splice(0, P.length - 500);
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
        UI.btn('▲', () => UI.minaVerPiso(Math.max(1, n - 1)), { small: true, title: 'Piso de arriba' }),
        el('b', null, 'Piso ' + n + ' · ' + f.e.name),
        UI.btn('▼', () => UI.minaVerPiso(Math.min(Mi.pisos(b), n + 1)), { small: true, title: 'Piso de abajo' }),
        act ? UI.btn('Ver la veta', () => { V.cx = vetaX(n, act.k); limitar(); }, { small: true }) : null,
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
  // elegir un piso lo centra, mirando hacia su veta activa (o el frente)
  UI.minaVerPiso = function (n) {
    if (!V) return;
    const Mi = M(), p = Mi.piso(V.b, n), act = p.v[0];
    V.sel = n; V.panelKey = '';
    V.scroll = yPiso(n) - (V.cv.height / V.k - FH) / 2;
    V.cx = act ? vetaX(n, act.k) * 0.7 : 0;
    limitar();
  };
})();
