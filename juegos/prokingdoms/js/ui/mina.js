// pk-84/pk-85/pk-86 (plan Hacha y Pico, P4). Rehecha en pk-85 a pedido del dueño («una mejora muy drástica en la visual
// de la mina, que se vea el agua, que se vean las vetas, mucho más ancha por nivel y mucho más detallada») y otra vez en
// pk-86 («mineros con más píxeles, no tan simples, y que cualquier evento que ocurra en la mina se vea visualmente, que
// se sienta que está todo vivo»). «Bajar a la mina» abre una vista a pantalla completa (main.js deja de dibujar el mapa
// mientras está abierta) con un corte lateral de la Mina Profunda:
//  - Arriba, la superficie: cielo según la hora (pájaros de día, luciérnagas de noche), el castillete con sus poleas, la
//    casa del torno, el malacate con su caballo o la máquina a vapor, la tolva que se llena con lo que sube y el
//    carromato que se va lleno y vuelve vacío. Con la bodega llena, el mineral se amontona y hay un cartel.
//  - Al medio, el pozo, con la jaula: baja y sube de verdad, piso por piso, con los mineros que entran, salen o cambian
//    de piso, y con una vagoneta del mineral de cada piso. Al llegar suena la campana del descanso.
//  - A los lados, las galerías: roca de su estrato, entibado, vetas con su filón, el frente que se agrieta a medida que
//    avanza (y se carga con barrenos cuando está por destapar), cajones, barriles, herramientas, altarcitos, pizarras con
//    las vetas agotadas, ratas, murciélagos y el canario de los pisos con gas.
//  - Los mineros (24×36 en la escena, dibujados al doble de resolución, con contorno): cada uno tiene cara, barba, piel,
//    ropa y contextura propias según su id, camina a su puesto y hace su oficio (picador, barrenero, palero,
//    carretillero o cargador), descansa sentado en un cajón (más cuando la bodega está llena o el montacargas no da
//    abasto) y festeja cuando se destapa una veta.
//  - Cada evento de la mina se ve: veta nueva (voladura en el frente, temblor, polvo y cascotes), veta agotada (derrumbe
//    del nicho), bolsón de gemas, cristal o hierro estelar, mejora puesta (los rieles se tienden, los faroles se
//    encienden uno por uno, la bomba baja el agua, la ventilación despeja el gas), piso nuevo y montacargas nuevo. Lo que
//    sube se ve como «+N mineral» al descargar la jaula.
//
// SOLO DIBUJA: lo que se ve sale de b.mina (PK.Mina) y nunca decide nada. Los eventos salen de comparar el estado con el
// del cuadro anterior. Math.random solo para polvo, chispas, gotas y bichos.
// Se arrastra en las dos direcciones (rueda: arriba y abajo; Mayús+rueda: a los lados). Tocar un piso abre su panel.
(function () {
  'use strict';
  const PK = window.PK, U = PK.U, D = PK.D, UI = PK.UI, Sp = PK.Sprites;
  const el = (...a) => U.el(...a);
  const G = () => PK.Game, M = () => PK.Mina;

  // ---------- Escena (píxeles virtuales; x = 0 es el centro del pozo) ----------
  const SKY = 120, FH = 100, TECHO = 34, SUELO = 84, VY = 58, PW = 30, JH = 42, YS = SKY - 14;
  const VELJ = [45, 70, 100, 140]; // la jaula, en píxeles por segundo, según el montacargas
  const RESCOL = Object.assign({}, Sp.CARRY, { stone: [176, 174, 166], gold: [255, 206, 64], ore: [196, 98, 60], marble: [240, 238, 230], gems: [90, 200, 255], crystal: [150, 236, 255], starIron: [196, 170, 255] });
  const rgb = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a === undefined ? 1 : a) + ')';
  const sc = (c, k) => c.map(v => Math.max(0, Math.min(255, Math.round(v * k))));

  let V = null;
  UI.minaAbierta = () => !!V;

  // ---------- Geometría de cada piso ----------
  // Las vetas se alternan a la derecha (pares) y a la izquierda (impares) del pozo; la separación crece con la
  // profundidad: los pisos hondos son mucho más anchos.
  const sep = n => 64 + 5 * n;
  const vetaX = (n, k) => (k % 2 === 0 ? 1 : -1) * (PW / 2 + 52 + sep(n) * Math.floor(k / 2));
  function alcance(n, p) { // hasta dónde llega la galería a cada lado (x negativa a la izquierda)
    const base = 60 + 16 * n;
    let der = PW / 2 + base, izq = -(PW / 2 + base);
    for (let k = 0; k < p.i; k++) { const x = vetaX(n, k); if (x > 0) der = Math.max(der, x + 40); else izq = Math.min(izq, x - 40); }
    const nx = vetaX(n, p.i); // el frente avanza hacia la próxima veta
    if (nx > 0) der = Math.max(der, nx - 26); else izq = Math.min(izq, nx + 26);
    return { izq, der, frente: nx > 0 ? 1 : -1 };
  }
  const yPiso = n => SKY + (n - 1) * FH;
  const yParada = n => (n === 0 ? YS : yPiso(n) + SUELO) - JH; // el techo de la jaula detenida en el piso n (0 = arriba)
  const descanso = lado => lado * (PW / 2 + 8); // donde se espera la jaula, a cada lado del pozo

  // ---------- Pintor de píxeles ----------
  function linea(x, x0, y0, x1, y1, col, w) {
    x.fillStyle = col;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) { const px = Math.round(x0 + (x1 - x0) * i / n), py = Math.round(y0 + (y1 - y0) * i / n); x.fillRect(px - ((w || 1) >> 1), py - ((w || 1) >> 1), w || 1, w || 1); }
  }
  const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // R: rectángulo, L: línea gruesa, O: óvalo; todo en enteros, sin suavizado (pixel art)
  function pincel(c) {
    const x = c.getContext('2d');
    const R = (a, b, w, h, cl) => { x.fillStyle = Array.isArray(cl) ? rgb(cl) : cl; x.fillRect(Math.round(a), Math.round(b), Math.round(w), Math.round(h)); };
    const L = (x0, y0, x1, y1, cl, w) => linea(x, x0, y0, x1, y1, Array.isArray(cl) ? rgb(cl) : cl, w);
    const O = (cx, cy, rx, ry, cl) => { for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 0.5)) ** 2))); R(cx - w, cy + y, w * 2 + 1, 1, cl); } };
    return { x, R, L, O };
  }
  // contorno oscuro de un píxel alrededor de todo lo pintado: es lo que hace que los mineros se lean en la penumbra
  function contorno(c, col) {
    const x = c.getContext('2d'), w = c.width, h = c.height, im = x.getImageData(0, 0, w, h), d = im.data, s = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) s[i] = d[i * 4 + 3] > 100 ? 1 : 0;
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
      const p = y * w + i;
      if (s[p]) continue;
      if ((i > 0 && s[p - 1]) || (i < w - 1 && s[p + 1]) || (y > 0 && s[p - w]) || (y < h - 1 && s[p + w])) { const o = p * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; }
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  const BORDE = [22, 14, 10];
  // codo o rodilla entre a y b (dos huesos de largo l1 y l2); lado elige hacia dónde dobla
  function ik(ax, ay, bx, by, l1, l2, lado) {
    let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    if (d > l1 + l2 - 0.01) { const k = (l1 + l2 - 0.01) / d; dx *= k; dy *= k; bx = ax + dx; by = ay + dy; d = l1 + l2 - 0.01; }
    d = Math.max(d, Math.abs(l1 - l2) + 0.01);
    const a = Math.acos(U.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), base = Math.atan2(dy, dx);
    return [ax + Math.cos(base + lado * a) * l1, ay + Math.sin(base + lado * a) * l1, bx, by];
  }
  // LRU chico para los lienzos de sprites
  function cache(map, key, max, hacer) {
    const ya = map.get(key);
    if (ya) { map.delete(key); map.set(key, ya); return ya; }
    const c = hacer();
    map.set(key, c);
    if (map.size > max) map.delete(map.keys().next().value);
    return c;
  }

  // ---------- Los mineros: 48×72 píxeles de sprite (24×36 en la escena), mirando a la derecha ----------
  const PIELES = [[242, 204, 168], [226, 176, 132], [194, 138, 96], [148, 100, 68], [106, 72, 48]];
  const PELOS = [[40, 30, 24], [96, 60, 34], [156, 74, 36], [210, 174, 100], [176, 172, 166]];
  const OVERS = [[62, 86, 128], [120, 90, 58], [90, 94, 104], [72, 94, 66]];
  const CAMISAS = [[188, 160, 116], [160, 60, 50], [212, 206, 192], [94, 118, 154]];
  const ASP = new Map();
  // la cara y la ropa de cada minero salen de su id: siempre el mismo
  function aspecto(id) {
    let a = ASP.get(id);
    if (a) return a;
    // (U.hash da valores parecidos para ids seguidos: los mineros vecinos salían iguales; el generador mezcla bien)
    const r = U.rng((Math.imul(id + 1, 2654435761) ^ 0x5bd1e995) >>> 0), t = []; for (let i = 0; i < 14; i++) t.push(r());
    const h = k => t[k];
    a = { piel: Math.floor(h(1) * PIELES.length), pelo: Math.floor(h(2) * PELOS.length), barba: Math.floor(h(3) * 5), over: Math.floor(h(4) * OVERS.length), cam: Math.floor(h(5) * CAMISAS.length), cuerpo: Math.floor(h(6) * 3), guantes: h(7) < 0.5, cantimplora: h(8) < 0.6, mangas: h(9) < 0.45, cicatriz: h(10) < 0.12, remiendo: h(13) < 0.35, vel: 0.85 + h(11) * 0.3, off: h(12) * 100 };
    if (a.pelo === 4 && a.barba < 3) a.barba = 3; // los canosos, con barba
    a.key = [a.piel, a.pelo, a.barba, a.over, a.cam, a.cuerpo, +a.guantes, +a.cantimplora, +a.mangas, +a.cicatriz, +a.remiendo].join('');
    ASP.set(id, a);
    return a;
  }
  const FIG = new Map();
  function figura(pose, f, a, col, hierro, carga) {
    return cache(FIG, pose + f + a.key + col + (hierro ? 'h' : '') + (carga || ''), 700, () => pintarMinero(pose, f, a, col, hierro, carga));
  }
  function pintarMinero(pose, f, a, col, hierro, carga) {
    const c = lienzo(48, 72), { R, L, O } = pincel(c);
    const SK = PIELES[a.piel], SK2 = sc(SK, 0.8), PE = PELOS[a.pelo];
    const OV = OVERS[a.over], OV2 = sc(OV, 0.72), OV3 = sc(OV, 1.2), CA = CAMISAS[a.cam], CA2 = sc(CA, 0.72), CA3 = sc(CA, 1.15);
    const GU = a.guantes ? [132, 92, 54] : SK, GU2 = sc(GU, 0.78), BO = [72, 50, 32], BO2 = [42, 28, 18], CU = [88, 58, 32], ORO = [228, 188, 86];
    const MAD = [150, 100, 56], MAD2 = [106, 70, 38], FE = [152, 158, 170], FE2 = [102, 106, 116], FE3 = [224, 230, 240];
    const CAS = hierro ? [142, 148, 160] : [178, 126, 60], CAS2 = sc(CAS, 0.68), CAS3 = sc(CAS, 1.28);
    const hw = 5 + a.cuerpo; // medio ancho del torso
    // la pose: inclinación, cuánto se agacha, pies (lejano y cercano), manos (lejana y cercana) y herramienta
    let lean = 1, baja = 0, pl = [17, 72], pc = [30, 72], ml, mc, herr = null, sentado = false, sx = 0, sy = 0;
    const fija = () => { sx = 24 + lean; sy = 27 + baja + (lean > 3 ? 1 : 0); };
    const paso = (largo, alza) => { const C = [[-1, 1, 0, 0], [-0.2, 0.2, 0, -1], [1, -1, 0, 0], [0.2, -0.2, -1, 0]][f % 4]; pl = [23 + C[0] * largo, 72 + C[2] * alza]; pc = [23 + C[1] * largo, 72 + C[3] * alza]; baja = f % 2 ? 0 : 1; };
    switch (pose) {
      case 'caminar': case 'cargar': case 'empujar': {
        paso(pose === 'empujar' ? 8 : 7, 3);
        lean = pose === 'empujar' ? 6 : pose === 'cargar' ? 2 : 1;
        if (pose === 'empujar') { pl[0] -= 3; pc[0] -= 3; }
        fija();
        const bal = [6, 0, -6, 0][f % 4];
        if (pose === 'empujar') { ml = [sx + 12, sy + 10]; mc = [sx + 14, sy + 11]; }
        else if (pose === 'cargar') { ml = [sx - bal * 0.6, sy + 15]; mc = [sx + 2, sy - 4]; herr = ['saco']; }
        else { ml = [sx - bal, sy + 15]; mc = [sx + 5, sy + 4]; herr = ['pico', mc, -2.3]; }
        break;
      }
      case 'picar': {
        pl = [15, 72]; pc = [32, 72];
        const F = [[-2, 0, -6, -13, -2.5], [0, 0, 1, -16, -1.25], [5, 2, 11, 5, 0.55], [4, 1, 9, 1, 0.22]][f % 4];
        lean = F[0]; baja = F[1]; fija();
        const ang = F[4];
        ml = [sx + F[2], sy + F[3]]; mc = [ml[0] + Math.cos(ang) * 5, ml[1] + Math.sin(ang) * 5]; herr = ['pico', ml, ang, true];
        break;
      }
      case 'barrenar': {
        baja = 7; lean = 3; pl = [33, 72]; pc = [12, 72]; fija();
        ml = [sx + 11, sy + 7];
        mc = f % 2 ? [sx + 7, sy + 3] : [sx + 1, sy - 9];
        herr = ['barreno', f % 2 ? -0.3 : -1.6];
        break;
      }
      case 'palear': {
        pl = [16, 72]; pc = [31, 72];
        const F = [[6, 4, 4, 12, 10, 16, 45, 68], [3, 2, 3, 6, 10, 6, 45, 50], [0, 0, 1, -2, 9, -6, 43, 26]][f % 3];
        lean = F[0]; baja = F[1]; fija();
        ml = [sx + F[2], sy + F[3]]; mc = [sx + F[4], sy + F[5]]; herr = ['pala', [F[6], F[7]], f % 3];
        break;
      }
      case 'descansar': {
        sentado = true; baja = 12; lean = 0; fija();
        pl = [30, 72]; pc = [33, 72];
        ml = [sx + 8, sy + 14];
        mc = f % 2 ? (a.cantimplora ? [sx + 6, sy - 7] : [sx + 5, sy - 12]) : [sx + 10, sy + 14];
        if (f % 2 && a.cantimplora) herr = ['beber'];
        break;
      }
      case 'festejar': {
        const s = f % 2; baja = s ? -3 : 0; lean = 0; pl = [18, 72 - s * 4]; pc = [29, 72 - s * 4]; fija();
        ml = [sx - 4, sy - 16]; mc = [sx + 6, sy - 17]; herr = ['pico', [mc[0], mc[1] + 2], -1.75];
        break;
      }
      default: { // esperar, con el farol de mano
        pl = [19, 72]; pc = [28, 72]; lean = 0; baja = f % 2; fija();
        ml = [sx - 1, sy + 15]; mc = [sx + 4, sy + 14]; herr = ['farol'];
      }
    }
    const hx = sentado ? 20 : 23, hy = 43 + baja;
    // piernas: pantalón del overol, rodillera y bota con suela
    const pierna = (foot, cerca) => {
      const T = cerca ? OV : OV2, B = cerca ? BO : BO2, h0 = [hx + (cerca ? 1 : -1), hy];
      const k = sentado ? [h0[0] + 11, h0[1] + 1] : ik(h0[0], h0[1], foot[0], foot[1] - 5, 14, 14, -1);
      L(h0[0], h0[1], k[0], k[1], T, 6);
      L(k[0], k[1], foot[0], foot[1] - 6, T, 5);
      if (cerca && a.remiendo) { R(k[0] - 2, k[1] - 1, 4, 4, sc(OV, 1.32)); R(k[0] - 1, k[1], 1, 1, OV2); }
      const fx = Math.round(foot[0]), fy = Math.round(foot[1]);
      R(fx - 3, fy - 7, 7, 6, B); R(fx + 4, fy - 4, 3, 3, B); R(fx - 3, fy - 1, 10, 1, BO2); R(fx - 2, fy - 7, 5, 1, sc(B, 1.35)); R(fx, fy - 5, 2, 1, sc(B, 1.25));
    };
    // brazos: manga (arremangada o no), antebrazo y mano o guante
    const brazo = (s, m, cerca) => {
      const M1 = cerca ? CA : CA2, e = ik(s[0], s[1], m[0], m[1], 10, 10, 1);
      L(s[0], s[1], e[0], e[1], M1, 5);
      L(e[0], e[1], e[2], e[3], a.mangas ? (cerca ? SK : SK2) : M1, 4);
      if (a.mangas) R(e[0] - 2, e[1] - 2, 4, 3, cerca ? CA3 : CA);
      R(e[2] - 2, e[3] - 2, 4, 4, cerca ? GU : GU2);
      if (cerca) R(e[2] - 2, e[3] - 2, 4, 1, sc(GU, 1.2));
    };
    const mano = (m, cerca) => { R(m[0] - 2, m[1] - 2, 4, 4, cerca ? GU : GU2); };
    // torso: camisa arriba, peto del overol con bolsillo, tirantes, botones, cinturón con hebilla
    const torso = () => {
      const top = sy - 1, bot = hy, cint = hy - 5, pechera = sy + 6;
      for (let y = top; y <= bot; y++) {
        const t = (y - top) / (bot - top), cx = Math.round(sx + (hx - sx) * t), w = hw - (y === top ? 1 : 0) + (a.cuerpo === 2 && t > 0.45 && t < 0.9 ? 1 : 0);
        const arriba = y < cint, T = arriba ? CA : OV;
        R(cx - w, y, w * 2 + 1, 1, T); R(cx - w, y, 2, 1, arriba ? CA2 : OV2); R(cx + w, y, 1, 1, arriba ? CA3 : OV3);
        if (a.cam === 1 && arriba && (y % 4 === 0)) R(cx - w, y, w * 2 + 1, 1, sc(CA, 0.78)); // camisa a cuadros
        if (y >= pechera && arriba) R(cx - w + 2, y, w * 2 - 3, 1, y === pechera ? OV3 : OV);
      }
      const cx0 = Math.round(sx + (hx - sx) * ((pechera - top) / (bot - top)));
      L(cx0 - hw + 2, pechera, sx - 3, sy, OV2, 1); L(cx0 + hw - 2, pechera, sx + 3, sy, OV2, 1);
      R(cx0 - hw + 2, pechera, 1, 1, ORO); R(cx0 + hw - 2, pechera, 1, 1, ORO);
      R(cx0 - 1, pechera + 2, 5, 4, OV2); R(cx0 - 1, pechera + 2, 5, 1, OV3); R(cx0 + 2, pechera + 1, 1, 2, [220, 210, 186]); // bolsillo con su lápiz
      R(hx - hw, cint, hw * 2 + 1, 2, CU); R(hx + 1, cint, 3, 2, ORO); R(hx + hw - 3, cint + 2, 3, 3, sc(CU, 1.2));
      R(hx - hw - 2, cint - 1, 3, 4, [72, 72, 78]); R(hx - hw - 2, cint - 1, 3, 1, [120, 120, 128]); // la batería de la lámpara
      if (a.cantimplora) { R(hx - hw + 1, cint + 2, 3, 5, [118, 124, 108]); R(hx - hw + 1, cint + 2, 3, 1, [160, 166, 150]); }
    };
    // cabeza: pañuelo del reino, cara con oreja, ojo, ceja, nariz y tizne; barba; casco con ala y lámpara
    const cabeza = () => {
      const cx = sx + 2, cy = sy - 9;
      R(cx - 2, sy - 4, 4, 4, SK2);
      R(cx - 4, sy - 3, 9, 3, col); R(cx - 3, sy - 3, 6, 1, sc(col, 1.25)); R(cx - 6, sy - 2, 3, 3, sc(col, 0.8)); R(cx - 7, sy + 1, 2, 2, sc(col, 0.8));
      O(cx, cy, 5, 6, SK);
      R(cx + 3, cy - 5, 2, 9, sc(SK, 1.06)); // la cara, más iluminada por la lámpara
      R(cx - 5, cy - 4, 3, 7, PE);
      R(cx - 2, cy - 1, 2, 3, SK2); R(cx - 1, cy, 1, 1, sc(SK, 0.62));
      R(cx + 2, cy - 3, 3, 1, sc(PE, 0.9));
      R(cx + 3, cy - 1, 1, 2, [26, 18, 14]); R(cx + 4, cy - 1, 1, 1, [236, 230, 220]);
      R(cx + 5, cy, 2, 2, SK); R(cx + 6, cy + 1, 1, 1, SK2);
      R(cx, cy + 1, 2, 1, sc(SK, 0.7)); R(cx - 1, cy + 3, 1, 1, sc(SK, 0.7)); // tizne
      if (a.cicatriz) R(cx + 1, cy - 2, 1, 3, sc(SK, 1.2));
      const B = a.barba;
      if (B < 3) R(cx + 3, cy + 3, 2, 1, sc(SK, 0.55));
      if (B === 1) for (let i = 0; i < 6; i++) R(cx + 1 + (i % 3) * 2, cy + 3 + Math.floor(i / 3) * 2, 1, 1, sc(PE, 0.85));
      if (B === 2) { R(cx + 2, cy + 2, 5, 1, PE); R(cx + 2, cy + 3, 1, 1, PE); R(cx + 6, cy + 3, 1, 1, PE); }
      if (B >= 3) { R(cx - 1, cy + 1, 7, 5, PE); R(cx, cy + 6, 5, 1, PE); R(cx + 5, cy + 1, 2, 3, PE); R(cx + 1, cy + 2, 3, 1, sc(PE, 1.2)); R(cx + 3, cy + 3, 2, 1, sc(PE, 0.5)); }
      if (B === 4) { R(cx + 1, cy + 7, 4, 2, PE); R(cx + 2, cy + 9, 2, 1, PE); }
      const cs = [2, 4, 5, 5, 6, 6];
      for (let i = 0; i < 6; i++) R(cx - cs[i] - 1, cy - 11 + i, cs[i] * 2 + 2, 1, CAS);
      R(cx - 3, cy - 10, 4, 1, CAS3); R(cx - 4, cy - 9, 2, 2, CAS3); R(cx - 1, cy - 11, 2, 6, sc(CAS, 1.1));
      R(cx - 7, cy - 5, 16, 1, CAS2); R(cx - 6, cy - 6, 14, 1, sc(CAS, 0.85));
      if (hierro) for (let i = -4; i <= 4; i += 4) R(cx + i, cy - 7, 1, 1, [212, 216, 226]);
      R(cx + 4, cy - 10, 4, 4, [86, 86, 94]); R(cx + 7, cy - 9, 2, 2, [255, 236, 150]); R(cx + 8, cy - 9, 1, 1, [255, 255, 232]);
      L(cx - 6, cy - 5, hx - hw - 1, hy - 6, [40, 32, 28], 1);
    };
    // herramientas
    const pico = (B, ang) => {
      const dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx, Hx = B[0] + dx * 19, Hy = B[1] + dy * 19;
      L(B[0] - dx * 3, B[1] - dy * 3, Hx, Hy, MAD, 2);
      L(Hx - px * 8 - dx * 2, Hy - py * 8 - dy * 2, Hx, Hy, FE, 2); L(Hx, Hy, Hx + px * 8 - dx * 2, Hy + py * 8 - dy * 2, FE, 2);
      R(Hx + px * 8 - dx * 2, Hy + py * 8 - dy * 2, 1, 1, FE3); R(Hx - px * 8 - dx * 2, Hy - py * 8 - dy * 2, 1, 1, FE3);
      R(Hx - 1, Hy - 1, 3, 3, FE2);
    };
    const pala = (C, fr) => {
      let dx = C[0] - ml[0], dy = C[1] - ml[1];
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const px = -dy, py = dx;
      L(ml[0] - dx * 4, ml[1] - dy * 4, C[0], C[1], MAD, 2);
      L(ml[0] - dx * 4 - px * 2, ml[1] - dy * 4 - py * 2, ml[0] - dx * 4 + px * 2, ml[1] - dy * 4 + py * 2, MAD2, 2);
      for (let i = 0; i < 8; i++) { const h = i < 5 ? 3 : 7 - i, x0 = C[0] + dx * i, y0 = C[1] + dy * i; L(x0 - px * h, y0 - py * h, x0 + px * h, y0 + py * h, i === 0 ? FE2 : FE, 1); }
      if (carga && fr >= 1) { R(C[0] + dx * 3 - 3, C[1] + dy * 3 - 4, 6, 3, carga); R(C[0] + dx * 3 - 1, C[1] + dy * 3 - 5, 2, 1, sc(carga, 1.4)); }
    };
    // con el cuerpo sentado, el cajón va debajo
    if (sentado) { R(8, 57, 24, 15, MAD2); R(8, 57, 24, 1, MAD); for (const y of [61, 66]) R(8, y, 24, 1, sc(MAD2, 0.75)); R(8, 57, 2, 15, sc(MAD2, 0.8)); R(30, 57, 2, 15, sc(MAD2, 0.8)); }
    pierna(pl, false);
    brazo([sx - 2, sy + 1], ml, false);
    if (herr && herr[0] === 'saco') {
      O(sx - 4, sy - 4, 8, 6, [178, 146, 98]); O(sx - 5, sy - 6, 5, 3, [198, 166, 116]); R(sx + 3, sy - 9, 2, 4, [120, 92, 60]);
      for (let i = -6; i <= 2; i += 3) R(sx + i, sy + 1, 1, 1, [130, 104, 70]);
      if (carga) { R(sx - 7, sy - 11, 3, 2, carga); R(sx - 3, sy - 12, 2, 2, sc(carga, 1.25)); }
    }
    torso();
    pierna(pc, true);
    cabeza();
    if (herr) {
      const t = herr[0];
      if (t === 'pico') pico(herr[1], herr[2]);
      else if (t === 'pala') pala(herr[1], herr[2]);
      else if (t === 'barreno') { // el cincel contra la roca y la maceta
        L(ml[0] - 1, ml[1], ml[0] + 10, ml[1], FE, 2); R(ml[0] + 10, ml[1] - 1, 1, 1, FE3);
        const ang = herr[1], dx = Math.cos(ang), dy = Math.sin(ang), Hx = mc[0] + dx * 8, Hy = mc[1] + dy * 8;
        L(mc[0] - dx * 2, mc[1] - dy * 2, Hx, Hy, MAD, 2); L(Hx + dy * 3, Hy - dx * 3, Hx - dy * 3, Hy + dx * 3, FE2, 4); R(Hx - 1, Hy - 1, 1, 1, FE3);
      } else if (t === 'farol') { R(mc[0], mc[1] + 1, 1, 2, [40, 32, 28]); R(mc[0] - 2, mc[1] + 3, 5, 7, [74, 62, 48]); R(mc[0] - 1, mc[1] + 5, 3, 3, [255, 214, 120]); R(mc[0], mc[1] + 6, 1, 1, [255, 255, 222]); }
      else if (t === 'beber') { R(mc[0] - 1, mc[1] - 6, 4, 7, [118, 124, 108]); R(mc[0], mc[1] - 7, 2, 1, [60, 60, 60]); R(mc[0] - 1, mc[1] - 6, 1, 7, [160, 166, 150]); }
    }
    brazo([sx + 1, sy + 1], mc, true);
    if (herr && (herr[3] || herr[0] === 'pala')) mano(ml, false); // la otra mano también agarra el mango
    return contorno(c, BORDE);
  }
  // vagoneta de 44×28 (22×14 en la escena): tablones, flejes con remaches, ruedas con rayos; llena, con el mineral
  const VAG = new Map();
  function vagoneta(carga, f) {
    return cache(VAG, (carga ? String(carga) : '-') + (f & 1), 60, () => {
      const c = lienzo(44, 28), { R, O } = pincel(c), W1 = [134, 84, 46], W2 = [98, 58, 32], FE = [110, 114, 124], FE3 = [184, 190, 200];
      if (carga) {
        const r = U.rng((carga[0] * 7919 + carga[1] * 31 + carga[2]) >>> 0);
        O(22, 8, 16, 5, sc(carga, 0.68)); O(22, 7, 11, 4, sc(carga, 0.88));
        for (let i = 0; i < 18; i++) { const x = 8 + r() * 28, y = 3 + r() * 7, s = 1 + Math.floor(r() * 2); R(x, y, s + 1, s + 1, sc(carga, 0.8 + r() * 0.45)); R(x, y, 1, 1, sc(carga, 1.55)); }
      }
      for (let y = 8; y < 22; y++) { const ins = Math.round((y - 8) * 0.22); R(2 + ins, y, 40 - ins * 2, 1, (y - 8) % 4 === 3 ? W2 : W1); R(2 + ins, y, 1, 1, W2); R(41 - ins, y, 1, 1, sc(W1, 1.2)); }
      R(1, 7, 42, 2, FE); R(1, 7, 42, 1, FE3);
      for (const x of [9, 21, 33]) { R(x, 9, 2, 12, FE); for (let y = 11; y < 21; y += 4) R(x, y, 1, 1, FE3); }
      R(7, 20, 30, 2, [50, 46, 44]);
      for (const wx of [12, 32]) {
        O(wx, 23, 4, 4, [46, 42, 40]); O(wx, 23, 3, 3, [64, 60, 58]);
        if (f & 1) { R(wx - 3, 23, 7, 1, [96, 92, 90]); R(wx, 20, 1, 7, [96, 92, 90]); } else { R(wx - 2, 21, 1, 1, [96, 92, 90]); R(wx + 2, 21, 1, 1, [96, 92, 90]); R(wx - 2, 25, 1, 1, [96, 92, 90]); R(wx + 2, 25, 1, 1, [96, 92, 90]); }
        R(wx, 23, 1, 1, FE3);
      }
      return contorno(c, BORDE);
    });
  }
  // bichos y cosas de la galería, también al doble de resolución
  const SPR = new Map();
  function bicho(tipo, f) {
    return cache(SPR, tipo + f, 80, () => {
      if (tipo === 'rata') {
        const c = lienzo(16, 9), { R, L, O } = pincel(c), P = [94, 82, 76];
        O(7, 5, 4, 2, P); R(4, 3, 6, 1, [124, 112, 104]); R(10, 3, 3, 3, P); R(13, 4, 1, 2, P); R(14, 5, 1, 1, [230, 150, 150]); R(10, 2, 2, 1, [204, 142, 142]); R(11, 4, 1, 1, [10, 8, 8]);
        L(3, 6, 0, f ? 4 : 8, [172, 122, 122], 1);
        R(5 + f, 7, 1, 2, P); R(9 - f, 7, 1, 2, P);
        return contorno(c, BORDE);
      }
      if (tipo === 'murc') { // f: 0 colgado, 1 y 2 volando
        const c = lienzo(18, 12), { R, L, O } = pincel(c), P = [64, 52, 60];
        if (f === 0) { O(9, 6, 2, 4, P); R(7, 3, 1, 7, sc(P, 0.8)); R(11, 3, 1, 7, sc(P, 0.8)); R(8, 0, 1, 2, P); R(10, 0, 1, 2, P); R(8, 9, 1, 1, [255, 90, 80]); R(10, 9, 1, 1, [255, 90, 80]); }
        else { const y = f === 1 ? 1 : 10; O(9, 6, 2, 2, P); L(8, 6, 1, y, P, 2); L(10, 6, 17, y, P, 2); L(4, (6 + y) / 2, 1, y, sc(P, 0.8), 1); L(14, (6 + y) / 2, 17, y, sc(P, 0.8), 1); R(8, 5, 1, 1, [255, 90, 80]); R(10, 5, 1, 1, [255, 90, 80]); R(8, 3, 1, 1, P); R(10, 3, 1, 1, P); }
        return contorno(c, BORDE);
      }
      if (tipo === 'canario') {
        const c = lienzo(14, 20), { R, L } = pincel(c), Or = [208, 170, 70];
        L(7, 0, 7, 3, [60, 50, 40], 1);
        R(1, 4, 12, 1, Or); R(1, 17, 12, 2, Or); R(2, 3, 10, 1, Or);
        for (const x of [1, 4, 7, 10, 12]) R(x, 4, 1, 13, Or);
        R(3, 13, 8, 1, [150, 100, 50]);
        const y = f ? 8 : 9;
        R(5, y, 4, 4, [252, 218, 64]); R(4, y + 1, 1, 2, [232, 190, 40]); R(8, y - 1, 2, 2, [252, 218, 64]); R(10, y, 1, 1, [230, 130, 40]); R(9, y - 1, 1, 1, [20, 14, 10]); R(6, y + 4, 1, 1, [230, 130, 40]);
        return contorno(c, BORDE);
      }
      // caballo del malacate (36×26), caminando
      const c = lienzo(36, 26), { R, L, O } = pincel(c), P = [132, 88, 52], P2 = sc(P, 0.75), CR = [52, 36, 26];
      const pz = [[0, 3], [2, 1], [3, 0], [1, 2]][f % 4];
      for (const [x, k] of [[9, pz[0]], [12, pz[1]], [23, pz[1]], [26, pz[0]]]) { L(x, 15, x + k - 1.5, 23, x === 12 || x === 26 ? P : P2, 2); R(x + k - 2, 23, 3, 2, CR); }
      O(18, 12, 10, 4, P); R(10, 9, 14, 1, sc(P, 1.2));
      L(26, 11, 30, 4, P, 4); R(29, 2, 6, 4, P); R(34, 4, 1, 2, CR); R(31, 3, 1, 1, [10, 8, 8]); R(29, 1, 2, 2, P2);
      L(27, 9, 30, 2, CR, 1); L(28, 10, 31, 3, CR, 1);
      L(8, 11, 4, 18, CR, 2);
      R(15, 8, 8, 2, [150, 60, 50]); // la collera
      return contorno(c, BORDE);
    });
  }
  // utilería de la galería (48 o menos de ancho, en píxeles de sprite)
  function prop(tipo, n) {
    return cache(SPR, 'p' + tipo + n, 120, () => {
      const MAD = [138, 92, 52], MAD2 = [98, 64, 36], FE = [128, 132, 142], FE3 = [196, 202, 212];
      let c, P;
      const nuevo = (w, h) => { c = lienzo(w, h); P = pincel(c); return P; };
      switch (tipo) {
        case 'barril': case 'polvora': {
          const { R } = nuevo(18, 24), M1 = tipo === 'polvora' ? [150, 52, 40] : MAD;
          for (let y = 0; y < 24; y++) { const w = 6 + Math.round(2 * Math.sin(Math.PI * y / 23)); R(9 - w, y, w * 2, 1, M1); R(9 - w, y, 2, 1, sc(M1, 0.7)); R(8 + w, y, 1, 1, sc(M1, 1.2)); for (let x = 9 - w + 4; x < 9 + w; x += 4) R(x, y, 1, 1, sc(M1, 0.8)); }
          for (const y of [3, 11, 19]) R(1, y, 16, 2, FE);
          R(3, 0, 12, 1, sc(M1, 1.3));
          if (tipo === 'polvora') { R(6, 6, 6, 4, [30, 24, 20]); R(7, 7, 4, 2, [240, 220, 180]); R(8, 13, 2, 2, [30, 24, 20]); }
          break;
        }
        case 'cajon': case 'cajones': {
          const alto = tipo === 'cajones' ? 2 : 1, { R, L } = nuevo(24, 18 * alto);
          for (let k = 0; k < alto; k++) {
            const y0 = k * 18, x0 = k ? 3 : 0, w = k ? 18 : 24;
            R(x0, y0, w, 18, MAD); for (const y of [5, 11]) R(x0, y0 + y, w, 1, MAD2);
            R(x0, y0, w, 2, sc(MAD, 1.2)); R(x0, y0, 2, 18, MAD2); R(x0 + w - 2, y0, 2, 18, MAD2);
            L(x0 + 2, y0 + 16, x0 + w - 3, y0 + 2, MAD2, 1);
            for (const [x, y] of [[x0 + 1, y0 + 1], [x0 + w - 2, y0 + 1], [x0 + 1, y0 + 16], [x0 + w - 2, y0 + 16]]) R(x, y, 1, 1, FE3);
          }
          if (tipo === 'cajones') { const { R: R2 } = P; R2(6, 22, 12, 5, [60, 40, 24]); R2(7, 23, 10, 3, [220, 200, 150]); } // un cartel con la marca
          break;
        }
        case 'herramientas': {
          const { R, L } = nuevo(30, 36);
          R(1, 4, 3, 32, MAD2); R(26, 4, 3, 32, MAD2); R(0, 3, 30, 3, MAD); R(0, 3, 30, 1, sc(MAD, 1.25));
          L(8, 6, 8, 30, MAD, 2); L(2, 9, 14, 9, FE, 2); R(2, 9, 1, 1, FE3); R(14, 9, 1, 1, FE3); // pico colgado
          L(19, 6, 19, 24, MAD, 2); for (let i = 0; i < 8; i++) { const h = i < 5 ? 3 : 7 - i; L(19 - h, 24 + i, 19 + h, 24 + i, FE, 1); } // pala
          R(23, 10, 4, 4, [170, 140, 90]); R(24, 11, 2, 2, MAD2); // rollo de soga
          break;
        }
        case 'balde': {
          const { R, L } = nuevo(26, 14);
          for (let y = 3; y < 14; y++) { const w = 5 - Math.floor((y - 3) / 5); R(7 - w, y, w * 2, 1, FE); R(7 - w, y, 1, 1, sc(FE, 0.7)); }
          R(3, 3, 8, 2, [70, 120, 190]); R(4, 3, 3, 1, [170, 210, 250]); L(2, 3, 7, 0, [70, 70, 76], 1); L(7, 0, 12, 3, [70, 70, 76], 1);
          R(16, 7, 9, 7, [150, 156, 166]); R(16, 7, 9, 2, [190, 196, 206]); L(17, 6, 20, 3, [90, 90, 96], 1); L(20, 3, 23, 6, [90, 90, 96], 1); // la vianda
          break;
        }
        case 'sacos': {
          const { R, O } = nuevo(28, 16), S1 = [176, 144, 96];
          O(8, 9, 7, 6, S1); O(19, 10, 7, 5, sc(S1, 0.9)); R(6, 2, 4, 3, sc(S1, 0.8)); R(18, 4, 3, 2, sc(S1, 0.75));
          R(4, 7, 6, 1, sc(S1, 1.15)); R(9, 9, 1, 1, [120, 96, 64]); R(20, 11, 1, 1, [120, 96, 64]);
          break;
        }
        case 'maderos': {
          const { R } = nuevo(36, 16);
          for (const [y, x0] of [[10, 0], [10, 0], [4, 5]]) { R(x0, y, 30, 6, MAD); R(x0, y, 30, 1, sc(MAD, 1.25)); R(x0, y + 5, 30, 1, MAD2); R(x0 + 29, y, 5, 6, [196, 156, 104]); R(x0 + 31, y + 2, 1, 2, [140, 100, 60]); }
          break;
        }
        case 'carretilla': {
          const { R, L, O } = nuevo(32, 20);
          for (let y = 4; y < 12; y++) R(6 + (y - 4), y, 20 - (y - 4), 1, (y % 3) ? [100, 104, 114] : [80, 84, 94]);
          R(6, 3, 21, 2, [140, 146, 156]);
          L(20, 11, 30, 17, MAD2, 2); L(2, 9, 8, 10, MAD2, 2);
          O(10, 15, 4, 4, [46, 42, 40]); R(10, 15, 1, 1, FE3); L(4, 12, 3, 19, MAD2, 2);
          break;
        }
        case 'altar': {
          const { R } = nuevo(16, 24);
          R(1, 4, 14, 20, [70, 52, 40]); R(3, 6, 10, 14, [36, 26, 20]); R(0, 2, 16, 3, MAD); R(7, 0, 2, 3, MAD2);
          R(6, 8, 4, 9, [214, 206, 190]); R(7, 7, 2, 2, [232, 216, 190]); R(6, 12, 4, 1, [170, 70, 60]); // la santita
          R(3, 18, 2, 3, [240, 236, 220]); R(11, 18, 2, 3, [240, 236, 220]); // velas (la llama va en vivo)
          R(1, 21, 14, 3, MAD2);
          break;
        }
        default: { // pizarra con las vetas agotadas de este piso, en palotes
          const { R, L } = nuevo(26, 20);
          R(0, 0, 26, 18, MAD); R(2, 2, 22, 14, [40, 52, 46]); L(4, 18, 2, 20, MAD2, 2); L(22, 18, 24, 20, MAD2, 2);
          const cnt = Math.min(15, n);
          for (let i = 0; i < cnt; i++) { const g = Math.floor(i / 5), j = i % 5; if (j < 4) R(4 + g * 7 + j, 4, 1, 6, [220, 226, 220]); else L(3 + g * 7, 9, 8 + g * 7, 4, [220, 226, 220], 1); }
          R(4, 12, 10, 1, [200, 206, 200]); R(16, 12, 5, 1, [200, 206, 200]);
        }
      }
      return contorno(c, BORDE);
    });
  }

  // ---------- Fondo de cada piso (roca, galería tallada, nichos, entibado), en caché ----------
  function fondo(n, p, f, L) {
    const key = [n, p.i, p.v.length ? p.v[0].k : 'x', V.XW, f.agua ? 1 : 0, f.gas ? 1 : 0].join('|');
    const cacheo = V.fondos[n];
    if (cacheo && cacheo.key === key) return cacheo.c;
    const W = V.XW * 2, c = lienzo(W, FH);
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
      const vx = Math.round(vetaX(n, k) + O), ag = agotada(k), w = ag ? 24 : 19, h = ag ? 8 : 5;
      for (let i = -w; i <= w; i++) { const t = i / w, ci = vx + i; if (ci >= 0 && ci < W) techo[ci] = Math.min(techo[ci], Math.round(TECHO - h * Math.sqrt(Math.max(0, 1 - t * t)) + (r() - 0.5) * 2)); }
    }
    // la pared del fondo: roca en lajas (píxel por píxel, con ImageData)
    const i0 = Math.max(0, izq), i1 = Math.min(W - 1, der);
    if (i1 > i0) {
      const img = x.getImageData(i0, 0, i1 - i0 + 1, SUELO), d = img.data, ww = i1 - i0 + 1, bk = sc(base, 0.5);
      // hornacinas: la veta se pica en la pared del fondo, a la altura del pecho (pk-87: arriba parecía que minaban el techo)
      const horn = [];
      for (let k = 0; k < p.i; k++) { const ag = agotada(k); horn.push({ cx: vetaX(n, k) + O, rx: ag ? 23 : 18, cy: VY - 4, ry: SUELO - VY + 6 + (ag ? 2 : 0), ag }); }
      for (let i = 0; i < ww; i++) {
        const t0 = techo[i + i0], sem = U.hash(i + i0, n, 3);
        for (let y = t0; y < SUELO; y++) {
          const laja = Math.floor((y + 3 * Math.sin((i + i0) * 0.05 + sem * 6)) / 7), junta = Math.abs(((y + 3 * Math.sin((i + i0) * 0.05 + sem * 6)) % 7)) < 0.9;
          const h = U.hash(Math.floor((i + i0 + laja * 5) / 9), laja, n), ruido = U.hash(i + i0, y, n + 7);
          let k = (0.78 + 0.32 * h + 0.12 * ruido) * (junta ? 0.62 : 1) * (y - t0 < 3 ? 0.75 : 1);
          for (const q of horn) {
            if (Math.abs(i + i0 - q.cx) > q.rx + 1) continue;
            const dx = (i + i0 - q.cx) / q.rx, dy = (y - q.cy) / q.ry, dd = dx * dx + dy * dy;
            if (dd >= 1) continue;
            k *= dd > 0.8 ? (y < q.cy ? 1.22 : 0.85) : (q.ag ? 0.42 : 0.5) + 0.38 * dd; // borde con luz arriba, hondo al centro
          }
          const o = (y * ww + i) * 4;
          d[o] = Math.min(255, bk[0] * k); d[o + 1] = Math.min(255, bk[1] * k); d[o + 2] = Math.min(255, bk[2] * k); d[o + 3] = 255;
        }
      }
      x.putImageData(img, i0, 0);
      for (let i = i0; i <= i1; i++) { const t0 = techo[i]; R(i, t0, 1, 1, sc(base, 1.18)); R(i, t0 + 1, 1, 1, sc(base, 0.6)); } // borde del techo
    }
    R(izq, SUELO, der - izq, 3, sc(base, 0.5)); // piso
    for (let i = 0; i < (der - izq) / 6; i++) { const px = izq + r() * (der - izq); R(px, SUELO - 1, 2, 1, sc(base, 0.7 + r() * 0.5)); } // cascajo
    // telarañas en los rincones de las puntas
    for (const [cx, s] of [[izq + 1, 1], [der - 1, -1]]) {
      const t0 = techo[U.clamp(cx, 0, W - 1)] + 1;
      for (let a = 0; a < 4; a++) linea(x, cx, t0, cx + s * (3 + a * 3), t0 + 12 - a * 3, 'rgba(220,220,220,0.35)', 1);
      for (let k = 1; k < 4; k++) linea(x, cx + s * k * 2, t0 + k * 2.5, cx + s * k * 3.5, t0 + k * 1.2, 'rgba(220,220,220,0.3)', 1);
    }
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
      else R(cx - 1, t + 10, 3, 1, sc(M1, 1.25));
    };
    const enNicho = cx => { for (let k = 0; k < p.i; k++) if (Math.abs(vetaX(n, k) - cx) < 26) return true; return false; };
    for (let cx = PW / 2 + 14; cx < L.der - 6; cx += 30) if (!enNicho(cx)) marco(Math.round(cx + O));
    for (let cx = -PW / 2 - 14; cx > L.izq + 6; cx -= 30) if (!enNicho(cx)) marco(Math.round(cx + O));
    // el frente: roca viva, más clara y quebrada
    const fx = Math.round((L.frente > 0 ? L.der : L.izq) + O);
    for (let y = TECHO - 3; y < SUELO; y++) { const w = 3 + Math.floor(r() * 3); R(L.frente > 0 ? fx - w + 1 : fx, y, w, 1, sc(base, 0.95 + r() * 0.2)); }
    V.fondos[n] = { key, c };
    return c;
  }
  // utilería del piso: lugares fijos con la semilla, lejos del pozo (ahí se descansa y se espera), de las vetas y del frente
  const TIPOS = ['barril', 'cajon', 'herramientas', 'balde', 'sacos', 'maderos', 'carretilla', 'altar', 'pizarra', 'polvora', 'cajones'];
  function propsDe(n, p, L) {
    const key = [n, p.i, L.izq, L.der].join('|'), ya = V.props[n];
    if (ya && ya.key === key) return ya.list;
    const r = U.rng((V.b.mina.sem + n * 3301) >>> 0), list = [];
    r();
    const libre = x => x > L.izq + 22 && x < L.der - 22 && !Array.from({ length: p.i + 1 }, (_, k) => k).some(k => Math.abs(vetaX(n, k) - x) < 34);
    let pizarra = false;
    for (const s of [1, -1]) for (let x = s * (PW / 2 + 74); s > 0 ? x < L.der - 20 : x > L.izq + 20; x += s * (26 + r() * 22)) {
      const q = r(), t0 = TIPOS[Math.floor(r() * TIPOS.length)];
      if (!libre(x) || q < 0.42) continue;
      let t = t0;
      if (t === 'polvora' && n < 3) t = 'barril';
      if (t === 'pizarra') { if (pizarra) t = 'cajon'; pizarra = true; }
      list.push({ t, x: Math.round(x) });
    }
    V.props[n] = { key, list };
    return list;
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
    V = {
      b, root, cv, ctx: cv.getContext('2d'), top, panel, scroll: 0, cx: 0, sel: 1, t: 0, dt: 0, fondos: {}, props: {}, part: [], k: 2, XW: 260, topKey: '', panelKey: '', drag: null, sonT: 0, luz: lienzo(10, 10),
      act: new Map(), listo: false, porPiso: {}, prev: {}, prod: {}, fiesta: {}, obra: {}, revela: {}, campana: {}, agua: {}, gasA: {}, vetaNueva: {}, ratas: [], murc: {}, txt: [], flash: [], temblor: 0,
      jaula: { y: yParada(0), n: 0, est: 'quieto', t: 0, pas: [], carga: null, cargaN: 0, ult: 0, dist: 1 },
      tolva: 0, carro: { x: -80, est: 'carga', t: 0, lleno: 0 }, porte: [], porteT: 0, descanso: 0.1, lleno: false, produce: false, estadoT: 0, rueda: 0, montT: -9,
    };
    medir();
    // el panel de abajo se llena después de abrir y achica el lienzo: se vuelve a medir cada vez que cambia su caja
    // (si no, el navegador estira el dibujo y los píxeles quedan disparejos)
    if (window.ResizeObserver) { V.ro = new ResizeObserver(() => medir()); V.ro.observe(cv.parentElement); }
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
    if (V.ro) V.ro.disconnect();
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
    const centro = V.medido ? V.scroll + V.cv.height / V.k / 2 : null; // al cambiar de tamaño, se mantiene lo que se mira
    V.cv.width = Math.max(10, Math.floor(box.width * dpr)); V.cv.height = Math.max(10, Math.floor(box.height * dpr));
    V.cv.style.width = '100%'; V.cv.style.height = '100%';
    // un piso ocupa cerca de la mitad del alto, con escala entera (píxeles parejos). Los mineros están dibujados al doble
    // de resolución: con escala par cada píxel suyo cae entero; con 3 quedan de 1,5 y se nota poco
    const k = U.clamp(box.height / (FH * 2), 1.4, 5) * dpr;
    V.k = Math.max(1, Math.round(k));
    if (centro !== null) V.scroll = centro - V.cv.height / V.k / 2;
    V.medido = true;
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
  const visible = n => { const y0 = n === 0 ? 0 : yPiso(n), y1 = n === 0 ? SKY : y0 + FH, v0 = V.scroll, v1 = V.scroll + V.cv.height / V.k; return y1 >= v0 && y0 <= v1; };
  const sonar = (n, s) => { if (PK.Sfx && visible(n)) PK.Sfx.play(s); };

  // ---------- Dibujo ----------
  function dibujar(dt) {
    const v = V, b = v.b, ctx = v.ctx, g = G(), Mi = M();
    v.t += dt; v.dt = dt;
    if (!b.done || !g.buildings.includes(b)) { UI.cerrarMina(); return; }
    if ((v.anchoT = (v.anchoT || 0) + dt) > 1.5) { v.anchoT = 0; const a = v.XW; ancho(); if (a !== v.XW) { v.fondos = {}; limitar(); } }
    estado(dt);
    eventos();
    sincronizar();
    jaulaPaso(dt);
    actoresPaso(dt);
    superficiePaso(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a0705'; ctx.fillRect(0, 0, v.cv.width, v.cv.height);
    const k = v.k, visW = v.cv.width / k;
    let sx = 0, sy = 0;
    if (v.temblor > 0) { v.temblor -= dt; const a = Math.min(1, v.temblor) * 2; sx = Math.round(Math.sin(v.t * 61) * a); sy = Math.round(Math.cos(v.t * 47) * a); }
    const ox = Math.round((visW / 2 - v.cx) * k) / k + sx;
    ctx.setTransform(k, 0, 0, k, ox * k, -Math.round(v.scroll * k) + sy * k);
    v.x0 = -ox; v.x1 = -ox + visW; // lo visible en x
    const pisos = Mi.pisos(b), vis0 = v.scroll, vis1 = v.scroll + v.cv.height / k;
    if (vis0 < SKY) superficie(ctx, pisos);
    for (let n = 1; n <= pisos; n++) {
      const y0 = yPiso(n);
      if (y0 + FH < vis0 || y0 > vis1) continue;
      piso(ctx, n, y0);
    }
    if (vis1 > yPiso(pisos) + FH) { ctx.fillStyle = '#0a0705'; ctx.fillRect(-v.XW, yPiso(pisos) + FH, v.XW * 2, 30); }
    pozo(ctx, pisos, vis0, vis1);
    particulas(ctx, dt);
    destellosEv(ctx, dt);
    textos(ctx, dt);
    // la selección
    if (v.sel >= 1 && v.sel <= pisos) { ctx.strokeStyle = 'rgba(255,215,106,0.85)'; ctx.lineWidth = 2 / k; ctx.strokeRect(v.x0 + 1, yPiso(v.sel) + 1, visW - 2, FH - 2); }
    // sonido de picos según cuántos mineros trabajan a la vista
    v.sonT -= dt;
    if (v.sonT <= 0 && PK.Sfx) {
      let vis = 0;
      for (let n = 1; n <= pisos; n++) if (visible(n)) vis += (v.porPiso[n] || []).filter(a => a.est === 'trabaja' && a.rol !== 'descanso').length;
      if (vis) { PK.Sfx.play('pick'); v.sonT = 2.6 / Math.min(4, 0.5 + vis / 6); } else v.sonT = 1;
    }
  }
  // lo que cambia poco: si la bodega está llena, si el montacargas no da abasto (más mineros descansan)
  function estado(dt) {
    if ((V.estadoT -= dt) > 0) return;
    V.estadoT = 0.5;
    const b = V.b, Mi = M(), r = Mi.resumen(b), tot = PK.Libro.totalCampo(b), cap = PK.Libro.capCampo(b);
    V.lleno = !Mi.aislada(b) && tot >= cap - 1;
    V.aislada = Mi.aislada(b);
    V.descanso = V.lleno ? 0.7 : r.limita ? 0.3 : 0.1;
    V.produce = r.total > 0 && !V.lleno;
  }

  // ---------- Eventos: lo que cambió desde el cuadro anterior ----------
  function eventos() {
    const b = V.b, Mi = M(), pisos = Mi.pisos(b), prev = V.prev;
    if (prev.pisos !== undefined && pisos > prev.pisos) for (let n = prev.pisos + 1; n <= pisos; n++) evPisoNuevo(n);
    prev.pisos = pisos;
    const mont = b.mina.mont || 0;
    if (prev.mont !== undefined && mont > prev.mont) evMontacargas(mont);
    prev.mont = mont;
    for (let n = 1; n <= pisos; n++) {
      const p = Mi.piso(b, n), q = prev[n], L = alcance(n, p);
      const ahora = { i: p.i, v: new Map(p.v.map(a => [a.k, [a.q, a.e]])), m: Object.keys(p.m).filter(k => p.m[k]).sort().join(','), fx: L.frente > 0 ? L.der : L.izq };
      if (q) {
        for (let k = q.i, c = 0; k < p.i && c < 3; k++, c++) evVeta(n, k, q.fx);
        for (const [k, [qq, ee]] of q.v) {
          const now = ahora.v.get(k), def = Mi.veta(b, n, k);
          const dq = now ? qq - now[0] : qq;
          if (dq > 0) { const pr = V.prod[n] = V.prod[n] || {}; pr[def.res] = (pr[def.res] || 0) + dq; }
          if (!now) evAgotada(n, k, def);
          else if (now[1] < ee - 1e-9) evEspecial(n, k, def);
        }
        if (ahora.m !== q.m) { const antes = q.m.split(','); for (const k of ahora.m.split(',')) if (k && !antes.includes(k)) evMejora(n, k); }
      }
      prev[n] = ahora;
    }
  }
  function aviso(x, y, txt, col, dur) { V.txt.push({ x, y, txt, col, t: 0, max: dur || 2.6 }); if (V.txt.length > 30) V.txt.shift(); }
  function destello(x, y, r, col, max) { V.flash.push({ x, y, r, col, t: 0, max: max || 0.5 }); }
  function cascotes(x, y, piso, col, n, lado) {
    for (let i = 0; i < n; i++) V.part.push({ x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 20, vx: (lado || (Math.random() < 0.5 ? -1 : 1)) * (15 + Math.random() * 70), vy: -20 - Math.random() * 50, t: 0, max: 3 + Math.random() * 2, col: sc(col, 0.7 + Math.random() * 0.5), s: Math.random() < 0.35 ? 2 : 1, piso, rebota: 1 });
  }
  function nube(x, y, col, n, ancho) {
    for (let i = 0; i < n; i++) V.part.push({ x: x + (Math.random() - 0.5) * (ancho || 30), y: y + (Math.random() - 0.5) * 24, vx: (Math.random() - 0.5) * 16, vy: -3 - Math.random() * 5, t: 0, max: 2.5 + Math.random() * 2, col, s: 3, puff: 1, crece: 1 });
  }
  function brillos(x, y, col, n, fuerza) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * (fuerza || 50); V.part.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, t: 0, max: 0.8 + Math.random() * 0.8, col, s: 1, brillo: 1 }); }
  }
  function evVeta(n, k, fx) {
    const b = V.b, def = M().veta(b, n, k), y0 = yPiso(n), col = RESCOL[def.res] || [200, 200, 200], lado = fx > 0 ? -1 : 1;
    if (visible(n)) V.temblor = Math.max(V.temblor, 0.6);
    destello(fx, y0 + 60, 70, [255, 190, 110], 0.45);
    cascotes(fx, y0 + 56, y0 + SUELO - 1, D.estratoDe(n).col, 26, lado);
    nube(fx + lado * 10, y0 + 58, sc(D.estratoDe(n).col, 1.4), 16, 40);
    for (let i = 0; i < 8; i++) V.part.push({ x: fx + lado * Math.random() * 60, y: y0 + TECHO, vx: 0, vy: 10, t: 0, max: 3, col: sc(D.estratoDe(n).col, 1.1), s: 1, piso: y0 + SUELO - 1 });
    V.vetaNueva[n + '|' + k] = V.t;
    V.fiesta[n] = V.t + 2.6;
    aviso(vetaX(n, k), y0 + TECHO - 2, '¡Nueva veta de ' + D.RES[def.res].name.toLowerCase() + (def.esp ? ' con ' + D.RES[def.esp].name.toLowerCase() : '') + '!', col, 3.2);
    sonar(n, 'boom');
  }
  function evAgotada(n, k, def) {
    const y0 = yPiso(n), vx = vetaX(n, k), col = RESCOL[def.res] || [200, 200, 200];
    cascotes(vx, y0 + VY - 14, y0 + SUELO - 1, D.estratoDe(n).col, 14);
    nube(vx, y0 + VY, sc(D.estratoDe(n).col, 1.3), 8, 30);
    aviso(vx, y0 + TECHO - 2, 'Veta de ' + D.RES[def.res].name.toLowerCase() + ' agotada', sc(col, 0.8), 2.6);
    if (def.hall) {
      brillos(vx, y0 + VY, RESCOL.gems, 46, 70);
      destello(vx, y0 + VY, 50, [110, 210, 255], 0.8);
      aviso(vx, y0 + TECHO + 10, '¡Bolsón de gemas! +' + def.hall, RESCOL.gems, 3.4);
      V.fiesta[n] = V.t + 3;
      sonar(n, 'coin');
    } else sonar(n, 'dig');
  }
  function evEspecial(n, k, def) {
    const y0 = yPiso(n), vx = vetaX(n, k), col = RESCOL[def.esp] || [220, 220, 255];
    destello(vx, y0 + VY, 44, col, 0.9);
    brillos(vx, y0 + VY, col, 24, 40);
    aviso(vx, y0 + TECHO - 12, '¡' + D.RES[def.esp].name + '!', col, 3);
    sonar(n, 'magia');
  }
  function evMejora(n, k) {
    const def = D.MINA.mejoras[k], y0 = yPiso(n);
    V.obra[n + '|' + k] = V.t;
    for (const s of [1, -1]) brillos(descanso(s) + s * 14, y0 + SUELO - 20, [255, 226, 120], 10, 30);
    aviso(PW / 2 + 40, y0 + TECHO + 6, '¡' + (def ? def.name : k) + '!', [180, 240, 150], 3);
    sonar(n, 'build');
  }
  function evPisoNuevo(n) {
    const y0 = yPiso(n);
    V.revela[n] = V.t;
    nube(PW / 2 + 30, y0 + 60, [150, 140, 126], 12, 60); nube(-PW / 2 - 30, y0 + 60, [150, 140, 126], 12, 60);
    aviso(0, y0 + TECHO + 4, '¡Piso ' + n + ' excavado!', [255, 215, 106], 3.4);
    if (visible(n)) V.temblor = Math.max(V.temblor, 0.4);
    sonar(n, 'dig');
  }
  function evMontacargas(i) {
    V.montT = V.t;
    brillos(0, YS - 80, [255, 226, 120], 40, 60);
    aviso(0, YS - 104, '¡' + D.MINA.montacargas[i].name + '!', [255, 215, 106], 3.4);
    sonar(0, 'level');
  }
  const progObra = (n, k) => { const t = V.obra[n + '|' + k]; return t === undefined ? 1 : U.clamp((V.t - t) / 2.2, 0, 1); };

  // ---------- Los mineros: cada uno con su cara, su oficio y su camino ----------
  // V.act: id → { id, a (aspecto), n (piso; 0 = superficie), est, x, dest, fase, dir, rol, rolPose, rolDir, carga, lleno }
  //  est: 'trabaja' (en su piso) · 'alPozo' (camina al pozo para cambiar de piso o salir) · 'espera' (en el descanso,
  //  esperando la jaula) · 'jaula' (adentro) · 'llega' (arriba, camina al castillete) · 'va' (arriba, vuelve al pueblo)
  function sincronizar() {
    const b = V.b, m = b.mina, pisos = M().pisos(b), ws = new Set(b.workers);
    let viajan = 0;
    for (const a of V.act.values()) if (a.est !== 'trabaja') viajan++;
    for (const id of b.workers) {
      const dest = U.clamp(m.asig[id] || 1, 1, pisos);
      let a = V.act.get(id);
      if (!a) {
        a = { id, a: aspecto(id), n: dest, est: 'trabaja', x: null, dest, fase: 0, dir: 1 };
        if (V.listo && viajan < 18) { a.n = 0; a.est = 'llega'; a.x = -130 - Math.random() * 40; viajan++; } // los que llegan, bajan por el castillete
        V.act.set(id, a);
      }
      a.dest = dest;
    }
    for (const a of V.act.values()) {
      if (!ws.has(a.id)) a.dest = 0;
      if (a.est === 'trabaja' && a.n !== a.dest) {
        if (viajan < 18) { a.est = 'alPozo'; viajan++; } else if (a.dest === 0) V.act.delete(a.id); else { a.n = a.dest; a.x = null; }
      } else if (a.est === 'espera' && a.n === a.dest) a.est = a.n === 0 ? 'va' : 'trabaja';
      else if (a.est === 'llega' && a.dest === 0) a.est = 'va';
    }
    V.listo = true;
  }
  function actoresPaso(dt) {
    const por = {};
    for (const a of V.act.values()) (por[a.n] = por[a.n] || []).push(a);
    V.porPiso = por;
    for (const k in por) {
      const n = +k, lista = por[k];
      if (n === 0) { pasoSup(lista, dt); continue; }
      const P = planPiso(n);
      roles(lista.filter(a => a.est === 'trabaja').sort((p, q) => p.id - q.id), P);
      const esp = { 1: 0, '-1': 0 };
      for (const a of lista) {
        if (a.est === 'jaula') continue;
        if (a.est === 'alPozo' || a.est === 'espera') {
          const s = (a.x === null ? 1 : Math.sign(a.x)) || 1;
          a.tx = descanso(s) + s * (esp[s]++ % 3) * 7; a.rolPose = 'esperar'; a.rolDir = -s; a.rol = 'viaje'; a.carga = null;
        }
        mover(a, dt, P);
        if (a.est === 'alPozo' && !a.camina) a.est = 'espera';
      }
    }
  }
  function mover(a, dt, P) {
    if (a.x === null || !isFinite(a.x)) a.x = a.tx;
    const d = a.tx - a.x, sp = (P && P.lento ? 13 : 26) * a.a.vel, paso = Math.min(Math.abs(d), sp * dt);
    a.camina = Math.abs(d) > 1.5;
    if (paso > 0) { a.x += Math.sign(d) * paso; a.fase += paso; }
    a.dir = a.camina ? Math.sign(d) : a.rolDir || a.dir || 1;
  }
  function planPiso(n) {
    const b = V.b, Mi = M(), p = Mi.piso(b, n), f = Mi.info(b, n), L = alcance(n, p), act = p.v[0];
    const def = act ? Mi.veta(b, n, act.k) : null, vx = act ? vetaX(n, act.k) : null;
    return { n, p, f, L, act, def, vx, e: f.e, cc: def ? RESCOL[def.res] : RESCOL.stone, frente: L.frente > 0 ? L.der : L.izq, rieles: !!p.m.rieles, lento: f.agua && !p.m.bomba, cerrado: !Mi.trabajable(b, n), fiesta: (V.fiesta[n] || 0) > V.t };
  }
  // el reparto de oficios de un piso: barrenero en el frente, picadores en la veta, un palero que llena la vagoneta y
  // carretilleros que la llevan al pozo (sin rieles, cargadores con un saco). Sin veta a la vista, todos al frente.
  function roles(lista, P) {
    const cnt = { barr: 0, pic: 0, desc: { 1: 0, '-1': 0 } };
    lista.forEach((a, i) => {
      a.carga = null; a.lleno = false;
      const rol = !P.act ? (i % 3 === 2 ? 'palero' : 'barrenero') : i === 0 || i === 7 ? 'barrenero' : i === 3 ? 'palero' : i === 2 || i === 6 ? 'carro' : 'picador';
      a.rol = rol;
      const lado0 = (P.vx !== null ? Math.sign(P.vx) : P.L.frente) || 1;
      if (P.cerrado) { a.tx = descanso(lado0) + lado0 * (cnt.barr++ % 4) * 8; a.rolPose = 'esperar'; a.rolDir = -lado0; return; }
      if (rol !== 'carro' && descansa(a)) {
        const s = (a.x === null ? lado0 : Math.sign(a.x)) || 1, j = cnt.desc[s]++;
        a.rol = 'descanso'; a.tx = s * (PW / 2 + 26 + j * 18); a.rolPose = 'descansar'; a.rolDir = -s;
        return;
      }
      if (rol === 'barrenero') {
        const lado = P.L.frente, j = cnt.barr++;
        a.tx = P.frente - lado * (11 + j * 10); a.rolDir = lado;
        if (j % 2) { a.rolPose = 'palear'; a.carga = RESCOL.stone; } else a.rolPose = P.p.v.length >= D.MINA.maxVetas ? 'esperar' : 'barrenar';
      } else if (rol === 'picador') {
        const j = cnt.pic++, lado = j % 2 ? -1 : 1;
        a.tx = P.vx + lado * (9 + Math.floor(j / 2) * 15); a.rolPose = 'picar'; a.rolDir = -lado;
      } else if (rol === 'palero') {
        a.tx = P.vx === null ? P.frente - P.L.frente * 30 : P.vx + (P.vx > 0 ? -36 : 36);
        a.rolPose = 'palear'; a.rolDir = P.vx === null ? P.L.frente : Math.sign(P.vx - a.tx); a.carga = P.cc;
      } else {
        // va y viene entre la veta y el pozo: lleno hacia el pozo, vacío de vuelta
        const land = Math.sign(P.vx) * (PW / 2 + 12), largo = Math.abs(P.vx - land), per = largo / 14 + 3, ph = ((V.t / per) + i * 0.37) % 2;
        const t = ph < 1 ? ph : 2 - ph, hacia = ph < 1;
        a.tx = P.vx + (land - P.vx) * U.clamp((t - 0.1) / 0.8, 0, 1); a.lleno = hacia;
        a.rolDir = Math.sign(hacia ? land - P.vx : P.vx - land) || 1;
        a.rolPose = P.rieles ? 'empujar' : hacia ? 'cargar' : 'caminar';
        if (!P.rieles && hacia) a.carga = P.cc;
      }
      if (P.fiesta && rol !== 'carro') a.rolPose = 'festejar';
    });
  }
  function descansa(a) { const per = 40 + (a.a.off % 1) * 40, fase = (V.t + a.a.off * 13) % per; return fase < per * V.descanso; }
  // arriba: los que llegan caminan hasta el castillete y esperan la jaula; los que se van caminan al pueblo
  function pasoSup(lista, dt) {
    let esp = 0;
    for (const a of lista) {
      if (a.est === 'jaula') continue;
      if (a.est === 'llega' || a.est === 'espera') { a.tx = -PW / 2 - 8 - (esp++ % 4) * 7; a.rolPose = 'esperar'; a.rolDir = 1; }
      else if (a.est === 'va') { a.tx = Math.max(-V.XW, -200) - 30; a.rolPose = 'caminar'; a.rolDir = -1; }
      a.rol = 'viaje';
      mover(a, dt, null);
      if (a.est === 'llega' && !a.camina) a.est = 'espera';
      if (a.est === 'va' && !a.camina) V.act.delete(a.id);
    }
  }
  function poseDe(a) {
    if (a.camina && a.rol !== 'carro') return [a.carga && a.rol !== 'palero' ? 'cargar' : 'caminar', Math.floor(a.fase / 4) % 4];
    const o = a.a.off, vel = a.a.vel;
    switch (a.rolPose) {
      case 'empujar': case 'cargar': case 'caminar': return [a.rolPose, Math.floor(a.fase / 4) % 4];
      case 'picar': return ['picar', Math.floor((V.t * 1.3 * vel + o) % 1 * 4)];
      case 'barrenar': return ['barrenar', Math.floor((V.t * 4 * vel + o) % 2)];
      case 'palear': return ['palear', Math.floor((V.t * 1.6 * vel + o) % 3)];
      case 'descansar': return ['descansar', ((V.t + o) % 9) < 2.5 ? 1 : 0];
      case 'festejar': return ['festejar', Math.floor(V.t * 5 + o) % 2];
      default: return ['esperar', Math.floor(V.t * 1.2 + o) % 2];
    }
  }
  // dibuja un minero de pie sobre `suelo` (y lo que sale de su trabajo: chispas, polvo, mineral, salpicaduras)
  function dibujarMinero(ctx, a, suelo, P, luces) {
    const [pose, fr] = poseDe(a), col = Sp.ownerColor('p'), hierro = P ? P.n >= 8 : false;
    const carga = pose === 'palear' || pose === 'cargar' ? a.carga || (P ? P.cc : null) : null;
    const fg = figura(pose, fr, a.a, col, hierro, carga), x = Math.round(a.x * 2) / 2;
    ctx.save(); ctx.translate(x, suelo - 36);
    if (a.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(fg, -12, 0, 24, 36);
    ctx.restore();
    if (luces) luces.push([x + a.dir * 4, suelo - 31, 26, 0.85]);
    if (a.ultP === pose && a.ultF === fr) return;
    a.ultP = pose; a.ultF = fr;
    if (!P) return;
    if (pose === 'picar' && fr === 2) chispa(x + a.dir * 15, suelo - 16, P.cc);
    else if (pose === 'barrenar' && fr === 1) { chispa(x + a.dir * 12, suelo - 20, [210, 210, 210]); if (Math.random() < 0.4) polvo(x + a.dir * 12, suelo - 18, sc(P.e.col, 1.3)); }
    else if (pose === 'palear' && fr === 2) for (let i = 0; i < 3; i++) V.part.push({ x: x + a.dir * 9, y: suelo - 30, vx: a.dir * (4 + Math.random() * 14), vy: -16 - Math.random() * 10, t: 0, max: 1.4, col: carga || P.cc, s: 1, piso: suelo - 2 });
    else if (P.lento && (pose === 'caminar' || pose === 'empujar' || pose === 'cargar') && fr % 2 === 0) salpicar(x, suelo - (V.agua[P.n] || 17));
  }

  // ---------- La jaula ----------
  // Primero lleva gente (los que esperan en un descanso o arriba); si no hay, va a buscar mineral a los pisos que
  // trabajan, de a uno, y lo sube a la tolva. Con la bodega llena se queda arriba: no hay adónde subirlo.
  function jaulaPaso(dt) {
    const J = V.jaula, b = V.b;
    if (J.est === 'va') {
      const ty = yParada(J.n), d = ty - J.y, base = Math.max(VELJ[b.mina.mont || 0] || 45, J.dist / 8);
      const s = Math.min(Math.abs(d), Math.max(10, Math.min(base, Math.abs(d) * 2.2)) * dt);
      J.y += Math.sign(d) * s;
      V.rueda += Math.sign(d) * s * 0.09;
      if (Math.abs(ty - J.y) < 0.5) { J.y = ty; llegar(J); }
      return;
    }
    if (J.est === 'para') { if ((J.t -= dt) > 0) return; J.est = 'quieto'; }
    let n = null;
    if (J.pas.length) n = J.pas[0].dest;
    else {
      let esp = null;
      for (const a of V.act.values()) if (a.est === 'espera' && a.n !== a.dest) { esp = a; break; }
      if (esp) n = esp.n;
      else if (J.carga) n = 0;
      else n = pisoConMineral();
    }
    if (n === null) n = 0;
    if (n === J.n) { if (J.pas.length || J.carga || hayQueEsperan(n) || (n > 0 && !J.carga)) llegar(J); else { J.est = 'para'; J.t = 0.5; } return; }
    J.n = n; J.est = 'va'; J.dist = Math.abs(yParada(n) - J.y);
    if (PK.Sfx && visible(0)) PK.Sfx.play('torno');
  }
  const hayQueEsperan = n => { for (const a of V.act.values()) if (a.est === 'espera' && a.n === n && a.dest !== n) return true; return false; };
  function pisoConMineral() {
    if (!V.produce) return null;
    const Mi = M(), b = V.b, N = Mi.pisos(b);
    for (let i = 1; i <= N; i++) {
      const n = ((V.jaula.ult + i - 1) % N) + 1, l = V.porPiso[n] || [];
      if (Mi.trabajable(b, n) && l.some(a => a.est === 'trabaja')) { V.jaula.ult = n; return n; }
    }
    return null;
  }
  function llegar(J) {
    const n = J.n, Mi = M(), b = V.b;
    J.est = 'para'; J.t = 1.4; V.campana[n] = V.t;
    // bajan los que van a este piso
    J.pas = J.pas.filter(a => {
      if (a.dest !== n || !V.act.has(a.id)) return V.act.has(a.id);
      const s = Math.random() < 0.5 ? 1 : -1;
      a.n = n; a.est = n === 0 ? 'va' : 'trabaja'; a.x = n === 0 ? -PW / 2 - 6 : descanso(s); a.fase = 0;
      return false;
    });
    // mineral: arriba se descarga en la tolva; abajo se carga una vagoneta del piso
    if (n === 0 && J.carga) { descargar(J); J.carga = null; }
    else if (n > 0 && !J.carga && Mi.trabajable(b, n) && (V.porPiso[n] || []).some(a => a.est === 'trabaja')) {
      const p = Mi.piso(b, n), act = p.v[0];
      J.carga = act ? RESCOL[Mi.veta(b, n, act.k).res] : RESCOL.stone; J.cargaN = n;
      const y = yPiso(n) + SUELO - 10;
      for (let i = 0; i < 6; i++) V.part.push({ x: (Math.random() < 0.5 ? -1 : 1) * (PW / 2 + 6), y, vx: 0, vy: -24, t: 0, max: 1, col: J.carga, s: 1, piso: y + 8, haciaX: 0 });
    }
    // suben los que esperan acá (hasta 4)
    for (const a of V.act.values()) if (a.est === 'espera' && a.n === n && a.dest !== n && J.pas.length < 4) { a.est = 'jaula'; J.pas.push(a); }
    sonar(n, 'campana');
  }
  function descargar(J) {
    const pr = V.prod[J.cargaN] || {}, partes = Object.keys(pr).filter(r => pr[r] >= 1).sort((a, b) => pr[b] - pr[a]).slice(0, 2);
    if (partes.length) aviso(-44, YS - 62, partes.map(r => '+' + U.fmt(Math.floor(pr[r])) + ' ' + D.RES[r].name.toLowerCase()).join(' · '), RESCOL[partes[0]] || [240, 230, 200], 2.6);
    for (const r of partes) pr[r] -= Math.floor(pr[r]);
    for (let i = 0; i < 9; i++) V.part.push({ x: -12, y: YS - 26, vx: -40 - Math.random() * 30, vy: -50 - Math.random() * 20, t: 0, max: 2, col: J.carga, s: Math.random() < 0.4 ? 2 : 1, piso: YS - 46, haciaX: -70 });
    V.tolva = Math.min(1, V.tolva + 0.25);
    sonar(0, 'deposit');
  }

  // ---------- Superficie ----------
  function superficiePaso(dt) {
    // el carromato espera junto a la tolva; cuando está llena (o pasó un rato), se va al pueblo y vuelve vacío
    const c = V.carro, base = -80;
    if (V.aislada) c.est = 'lejos';
    else if (c.est === 'carga') { c.x = base; c.t += dt; if (V.tolva >= 1 || (V.tolva > 0.3 && c.t > 25)) { c.est = 'va'; c.lleno = V.tolva; V.tolva = 0; c.t = 0; } }
    else if (c.est === 'va') { c.x -= 22 * dt; if (c.x < -V.XW - 60) { c.est = 'lejos'; c.t = 0; } }
    else if (c.est === 'lejos') { c.t += dt; if (c.t > 6 && !V.aislada) { c.est = 'vuelve'; c.x = -V.XW - 60; c.lleno = 0; } }
    else if (c.est === 'vuelve') { c.x += 22 * dt; if (c.x >= base) { c.x = base; c.est = 'carga'; c.t = 0; } }
    // sin carromato que llegue, los mineros suben a pie con sacos al pueblo
    if (V.aislada && V.b.workers.length && (V.porteT -= dt) <= 0) { V.porteT = 6 + Math.random() * 4; V.porte.push({ x: -PW / 2 - 8, a: aspecto(900000 + Math.floor(Math.random() * 40)), fase: 0, col: V.jaula.carga || RESCOL.ore }); }
    for (let i = V.porte.length - 1; i >= 0; i--) { const q = V.porte[i]; q.x -= 18 * dt; q.fase += 18 * dt; if (q.x < -V.XW - 30) V.porte.splice(i, 1); }
  }
  function superficie(ctx, pisos) {
    const h = new Date(G().ahora()).getHours(), noche = h < 7 || h >= 20, XW = V.XW, Y = YS, b = V.b, J = V.jaula;
    const gr = ctx.createLinearGradient(0, 0, 0, Y);
    gr.addColorStop(0, noche ? '#0a1226' : '#5e9fd6'); gr.addColorStop(1, noche ? '#1e2846' : '#c6e2f0');
    ctx.fillStyle = gr; ctx.fillRect(-XW, 0, XW * 2, Y);
    if (noche) { ctx.fillStyle = '#e8e8ff'; for (let i = 0; i < 60; i++) ctx.fillRect(-XW + ((i * 97) % (XW * 2)), (i * 53) % (Y - 30), 1, 1); ctx.fillStyle = '#f4f0d0'; ctx.beginPath(); ctx.arc(-XW + 60, 22, 7, 0, Math.PI * 2); ctx.fill(); }
    else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const [c0, cy] of [[-XW + 70, 26], [XW - 120, 18], [40, 14]]) { const cx = ((c0 + V.t * 2 + XW) % (XW * 2 + 60)) - XW - 30; ctx.beginPath(); ctx.ellipse(cx, cy, 16, 5, 0, 0, Math.PI * 2); ctx.ellipse(cx + 10, cy - 3, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); }
      // pájaros
      ctx.fillStyle = '#2a2a34';
      for (let i = 0; i < 4; i++) { const x = ((V.t * (14 + i * 3) + i * 170) % (XW * 2 + 100)) - XW - 50, y = 30 + i * 9 + Math.sin(V.t * 1.4 + i) * 4, al = Math.sin(V.t * 9 + i * 2) > 0 ? -1 : 0; ctx.fillRect(x - 2, y + al, 2, 1); ctx.fillRect(x, y + 1, 1, 1); ctx.fillRect(x + 1, y + al, 2, 1); }
    }
    // cerros
    ctx.fillStyle = noche ? '#1a2a24' : '#7aa070';
    ctx.beginPath(); ctx.moveTo(-XW, Y); for (let x = -XW; x <= XW; x += 10) ctx.lineTo(x, Y - 18 - 12 * Math.sin(x * 0.012) - 6 * Math.sin(x * 0.031)); ctx.lineTo(XW, Y); ctx.fill();
    ctx.fillStyle = noche ? '#22362a' : '#5c8a3c'; ctx.fillRect(-XW, Y, XW * 2, 5);
    ctx.fillStyle = '#6a4a2c'; ctx.fillRect(-XW, Y + 5, XW * 2, SKY - Y - 5);
    for (let x = -XW; x < XW; x += 7) { ctx.fillStyle = '#4e8a34'; ctx.fillRect(x, Y - 1, 1, 2); }
    if (noche) for (let i = 0; i < 14; i++) { const a = Math.sin(V.t * 2 + i * 1.7); if (a < 0.3) continue; ctx.fillStyle = 'rgba(220,255,120,' + (a - 0.3) + ')'; ctx.fillRect(-XW + ((i * 131) % (XW * 2)) + Math.sin(V.t * 0.6 + i) * 6, Y - 6 - (i % 5) * 4 + Math.cos(V.t * 0.8 + i) * 3, 1, 1); } // luciérnagas
    // escombrera
    const esc = Math.min(70, 16 + pisos * 4);
    ctx.fillStyle = '#7e7a74'; ctx.beginPath(); ctx.moveTo(110, Y + 1); ctx.lineTo(110 + esc, Y - esc * 0.5); ctx.lineTo(110 + esc * 2.2, Y + 1); ctx.fill();
    ctx.fillStyle = '#5e5a54'; ctx.beginPath(); ctx.moveTo(110 + esc, Y - esc * 0.5); ctx.lineTo(110 + esc * 2.2, Y + 1); ctx.lineTo(110 + esc * 1.4, Y + 1); ctx.fill();
    // casa del torno con chimenea y humo (más humo mientras la jaula se mueve, si es a vapor)
    const hierro = b.lvl >= 10, cx = 44, mont = b.mina.mont || 0;
    ctx.fillStyle = hierro ? '#8a5a44' : '#8a6038'; ctx.fillRect(cx, Y - 30, 52, 30);
    ctx.fillStyle = hierro ? '#74482f' : '#6e4a2a'; for (let y = Y - 28; y < Y; y += 4) ctx.fillRect(cx, y, 52, 1);
    ctx.fillStyle = '#a04a32'; ctx.beginPath(); ctx.moveTo(cx - 4, Y - 30); ctx.lineTo(cx + 26, Y - 46); ctx.lineTo(cx + 56, Y - 30); ctx.fill();
    ctx.fillStyle = '#2a1c12'; ctx.fillRect(cx + 8, Y - 16, 9, 16);
    ctx.fillStyle = noche ? '#ffd770' : '#9cc4dc'; ctx.fillRect(cx + 28, Y - 22, 7, 6); ctx.fillRect(cx + 40, Y - 22, 7, 6);
    ctx.fillStyle = '#5a4a40'; ctx.fillRect(cx + 40, Y - 64, 7, 30);
    const humo = J.est === 'va' && mont >= 2 ? 0.8 : b.workers.length ? 0.35 : 0.1;
    if (Math.random() < humo) V.part.push({ x: cx + 43, y: Y - 66, vx: 5 + Math.random() * 4, vy: -7 - Math.random() * 4, t: 0, max: 3, col: mont >= 2 ? [70, 66, 64] : [210, 210, 210], s: 3, puff: 1, crece: 1 });
    if (mont >= 2) { const em = Math.sin(V.rueda * 3) * 4; ctx.fillStyle = '#7a7e86'; ctx.fillRect(cx + 52, Y - 14, 10, 6); ctx.fillStyle = '#b0b6c0'; ctx.fillRect(cx + 56 + em, Y - 12, 8, 2); } // el cilindro de vapor
    // el malacate: un caballo que da vueltas al cabrestante
    if (mont === 1) {
      const px = -36, mov = J.est === 'va', a = mov ? V.t * 0.9 : 0, hx = px + Math.sin(a) * 16, dir = Math.cos(a) >= 0 ? 1 : -1;
      ctx.fillStyle = '#6a4426'; ctx.fillRect(px - 2, Y - 22, 4, 22); ctx.fillRect(px - 5, Y - 24, 10, 3);
      ctx.strokeStyle = '#6a4426'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, Y - 18); ctx.lineTo(hx, Y - 12); ctx.stroke();
      ctx.save(); ctx.translate(Math.round(hx * 2) / 2, Y - 13); if (dir < 0) ctx.scale(-1, 1); ctx.drawImage(bicho('caballo', mov ? Math.floor(V.t * 6) % 4 : 0), -9, 0, 18, 13); ctx.restore();
    }
    // tolva (se llena con lo que sube) y el carromato del color del reino
    const tx = -80;
    ctx.fillStyle = '#6a4426'; ctx.fillRect(tx - 14, Y - 40, 3, 40); ctx.fillRect(tx + 11, Y - 40, 3, 40);
    ctx.fillStyle = '#8a5a30'; ctx.beginPath(); ctx.moveTo(tx - 18, Y - 44); ctx.lineTo(tx + 18, Y - 44); ctx.lineTo(tx + 6, Y - 26); ctx.lineTo(tx - 6, Y - 26); ctx.fill();
    if (V.tolva > 0 || V.lleno) { const tc = J.carga || RESCOL.ore, hh = Math.round(2 + 6 * (V.lleno ? 1 : V.tolva)); ctx.fillStyle = rgb(sc(tc, 0.8)); ctx.fillRect(tx - 15, Y - 44 - hh + 2, 30, hh); ctx.fillStyle = rgb(tc); for (let i = 0; i < 6; i++) ctx.fillRect(tx - 13 + i * 5, Y - 44 - hh + 1 + (i % 2), 2, 2); }
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(tx - 14, Y - 46, 28, 3);
    const col = Sp.ownerColor('p'), car = V.carro;
    if (car.est !== 'lejos') carromato(ctx, car.x, Y, col, car.est === 'vuelve' ? 1 : -1, car.est === 'va' ? car.lleno : car.est === 'carga' ? V.tolva * 0.5 : 0);
    // con la bodega llena: montones al pie de la tolva y un cartel
    if (V.lleno) {
      for (const [x, w] of [[tx + 20, 14], [tx + 34, 10], [tx - 28, 12]]) { ctx.fillStyle = rgb(sc(RESCOL.ore, 0.75)); ctx.beginPath(); ctx.moveTo(x - w, Y + 1); ctx.lineTo(x, Y - w * 0.7); ctx.lineTo(x + w, Y + 1); ctx.fill(); }
      if (Math.sin(V.t * 5) > -0.3) { ctx.fillStyle = '#3a2412'; ctx.fillRect(tx - 30, Y - 66, 60, 12); ctx.font = '8px "Pixelify Sans", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = '#ffd76a'; ctx.fillText('¡Bodega llena!', tx - 27, Y - 65); }
    }
    // castillete: celosía con sus poleas, sobre la boca del pozo
    const pata = hierro ? '#5c6068' : '#6a4426', pata2 = hierro ? '#3e4248' : '#4a2e18', alto = 82, top = Y - alto;
    ctx.lineWidth = 2.5; ctx.strokeStyle = pata;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 30, Y); ctx.lineTo(s * 6, top); ctx.stroke(); }
    ctx.lineWidth = 1; ctx.strokeStyle = pata2;
    for (let i = 0; i < 6; i++) { const y1 = Y - i * alto / 6, y2 = Y - (i + 1) * alto / 6, w1 = 30 - 24 * i / 6, w2 = 30 - 24 * (i + 1) / 6; ctx.beginPath(); ctx.moveTo(-w1, y1); ctx.lineTo(w2, y2); ctx.moveTo(w1, y1); ctx.lineTo(-w2, y2); ctx.moveTo(-w2, y2); ctx.lineTo(w2, y2); ctx.stroke(); }
    ctx.lineWidth = 2; ctx.strokeStyle = pata; ctx.beginPath(); ctx.moveTo(26, Y); ctx.lineTo(54, Y - 34); ctx.stroke();
    rueda(ctx, 0, top, 11, V.rueda, hierro);
    if (mont >= 3) rueda(ctx, 13, top + 8, 9, -V.rueda, hierro);
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(9, top + 3); ctx.lineTo(cx + 10, Y - 26); ctx.stroke();
    ctx.fillStyle = rgb(col); ctx.fillRect(-1, top - 22, 1, 10); ctx.fillRect(0, top - 22, 8, 5); // banderín
    if (V.t - V.montT < 4) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, top, 0, 0, top, 30); g.addColorStop(0, 'rgba(255,220,120,' + 0.5 * (1 - (V.t - V.montT) / 4) + ')'); g.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = g; ctx.fillRect(-30, top - 30, 60, 60); ctx.restore(); }
    // la gente de arriba: los que llegan, los que se van y los que suben a pie con sacos
    const lista = V.porPiso[0] || [];
    for (const a of lista) if (a.est !== 'jaula') dibujarMinero(ctx, a, Y + 1, null, null);
    for (const q of V.porte) { const fg = figura('cargar', Math.floor(q.fase / 4) % 4, q.a, col, false, q.col); ctx.save(); ctx.translate(Math.round(q.x * 2) / 2, Y + 1 - 36); ctx.scale(-1, 1); ctx.drawImage(fg, -12, 0, 24, 36); ctx.restore(); }
    ctx.font = '8px "Pixelify Sans", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = noche ? '#ffd76a' : '#2a1808';
    ctx.fillText(D.MINA.montacargas[mont].name, V.x0 + 6, 6);
  }
  function carromato(ctx, x, Y, col, dir, carga) {
    ctx.save(); ctx.translate(Math.round(x), 0); if (dir > 0) ctx.scale(-1, 1);
    ctx.fillStyle = rgb(col); ctx.fillRect(-16, Y - 14, 32, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-16, Y - 6, 32, 1);
    ctx.fillStyle = '#9a8a7a'; ctx.fillRect(-12, Y - 17, 24, 3);
    if (carga > 0) { const c = V.jaula.carga || RESCOL.ore, h = Math.round(1 + 6 * carga); ctx.fillStyle = rgb(sc(c, 0.8)); ctx.fillRect(-13, Y - 17 - h, 26, h); ctx.fillStyle = rgb(c); for (let i = 0; i < 5; i++) ctx.fillRect(-11 + i * 5, Y - 18 - h + (i % 2), 2, 2); }
    const giro = Math.floor(x / 3) % 2;
    for (const w of [-10, 10]) { ctx.fillStyle = '#2a1c12'; ctx.beginPath(); ctx.arc(w, Y - 3, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#8a6a40'; ctx.fillRect(w - 1, Y - 4, 2, 2); ctx.fillRect(giro ? w - 3 : w, giro ? Y - 3 : Y - 6, giro ? 6 : 1, giro ? 1 : 6); }
    const p = Math.floor(V.t * 4) % 2 && V.carro.est !== 'carga' ? 1 : 0;
    ctx.fillStyle = '#d8c8a8'; ctx.fillRect(-34, Y - 12, 12, 7); ctx.fillRect(-38, Y - 15, 5, 5); ctx.fillRect(-33 + p, Y - 5, 2, 5); ctx.fillRect(-25 - p, Y - 5, 2, 5); // el buey
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(-39, Y - 16, 2, 1); ctx.fillRect(-22, Y - 11, 6, 1);
    ctx.restore();
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
  function pozo(ctx, pisos, vis0, vis1) {
    const y0 = Math.max(YS, vis0 - 4), y1 = Math.min(yPiso(pisos) + FH, vis1 + 4), L = -PW / 2, J = V.jaula;
    ctx.fillStyle = '#120c08'; ctx.fillRect(L, y0, PW, y1 - y0);
    for (let y = Math.floor(y0 / 10) * 10; y < y1; y += 10) { ctx.fillStyle = '#3a2818'; ctx.fillRect(L, y, 3, 9); ctx.fillRect(-L - 3, y, 3, 9); ctx.fillStyle = '#2a1c10'; ctx.fillRect(L, y + 9, PW, 1); }
    ctx.fillStyle = '#5a4a34'; for (let y = Math.floor(y0 / 6) * 6; y < y1; y += 6) ctx.fillRect(L + 4, y, 5, 1); ctx.fillRect(L + 4, y0, 1, y1 - y0); ctx.fillRect(L + 8, y0, 1, y1 - y0); // escalera
    ctx.fillStyle = '#6a6e76'; ctx.fillRect(-13, y0, 1, y1 - y0); ctx.fillRect(12, y0, 1, y1 - y0); // guías
    // descansos de cada piso con farol, señal, campana y placa
    ctx.font = '8px "PK Num", "Pixelify Sans", monospace'; ctx.textBaseline = 'top';
    for (let n = 1; n <= pisos; n++) {
      const y = yPiso(n) + SUELO;
      if (y < vis0 - FH || y > vis1 + 10) continue;
      ctx.fillStyle = '#5a3c22'; ctx.fillRect(L - 4, y, PW + 8, 3); ctx.fillStyle = '#7a5434'; ctx.fillRect(L - 4, y, PW + 8, 1);
      ctx.fillStyle = '#ffd770'; ctx.fillRect(L + 1, y - 34, 2, 3); // farol
      const aqui = J.n === n && J.est !== 'va';
      ctx.fillStyle = aqui ? '#7dff7a' : '#7a2018'; ctx.fillRect(L + 1, y - 28, 2, 2); // la señal: verde con la jaula en el piso
      campana(ctx, -L - 5, y - 37, V.campana[n]);
      const sel = n === V.sel, txt = 'Piso ' + n, w = 40, px = L - 6 - w;
      ctx.fillStyle = sel ? '#ffd76a' : 'rgba(30,20,12,0.9)'; ctx.fillRect(px, yPiso(n) + 6, w, 11);
      ctx.strokeStyle = sel ? '#7a4a10' : '#8a6a3a'; ctx.lineWidth = 1 / V.k; ctx.strokeRect(px, yPiso(n) + 6, w, 11);
      ctx.fillStyle = sel ? '#1a1008' : '#f0e2c0'; ctx.fillText(txt, px + 6, yPiso(n) + 7);
    }
    // la jaula: cable, cadenas, marco, techo, piso y reja; adentro, los que viajan o una vagoneta
    const y = Math.round(J.y), hierro = V.b.lvl >= 10 || (V.b.mina.mont || 0) >= 2, M1 = hierro ? '#7a7e86' : '#7a5232', M2 = hierro ? '#9aa0aa' : '#9a7046';
    ctx.fillStyle = '#2a2420'; ctx.fillRect(0, SKY - 96, 1, y - 6 - SKY + 96);
    ctx.strokeStyle = '#3a3430'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0.5, y - 6); ctx.lineTo(-11, y); ctx.moveTo(0.5, y - 6); ctx.lineTo(12, y); ctx.stroke();
    ctx.fillStyle = '#1a1410'; ctx.fillRect(-11, y + 3, 23, JH - 6);
    ctx.fillStyle = 'rgba(255,210,120,0.12)'; ctx.fillRect(-11, y + 3, 23, JH - 6);
    const col = Sp.ownerColor('p');
    J.pas.slice(0, 3).forEach((a, i) => { const fg = figura('esperar', 0, a.a, col, J.n >= 8); ctx.drawImage(fg, [-11, -1, -6][i], y + JH - 3 - 36, 24, 36); });
    if (J.carga) ctx.drawImage(vagoneta(J.carga, 0), -11, y + JH - 3 - 14, 22, 14);
    ctx.fillStyle = M1; ctx.fillRect(-13, y, 2, JH); ctx.fillRect(12, y, 2, JH); ctx.fillRect(-14, y, 29, 3); ctx.fillRect(-14, y + JH - 3, 29, 3);
    ctx.fillStyle = M2; ctx.fillRect(-14, y, 29, 1); for (let i = 0; i < 6; i++) ctx.fillRect(-10 + i * 4, y + 3, 1, JH - 6); ctx.fillRect(-11, y + Math.round(JH / 2), 23, 1);
    ctx.fillStyle = '#ffd770'; ctx.fillRect(0, y + 4, 2, 2);
    if (J.pas.length > 3) { ctx.font = '7px "Pixelify Sans", monospace'; ctx.fillStyle = '#ffd76a'; ctx.fillText('+' + (J.pas.length - 3), 15, y + 4); }
  }
  function campana(ctx, x, y, t0) {
    const dt = t0 === undefined ? 9 : V.t - t0, a = dt < 1.2 ? Math.sin(dt * 18) * 0.5 * (1.2 - dt) : 0;
    ctx.save(); ctx.translate(x + 1.5, y); ctx.rotate(a);
    ctx.fillStyle = '#5a4a34'; ctx.fillRect(-0.5, -2, 1, 2);
    ctx.fillStyle = '#c8a040'; ctx.fillRect(-1.5, 0, 3, 3); ctx.fillRect(-2, 2, 4, 1); ctx.fillStyle = '#f0d070'; ctx.fillRect(-1, 0, 1, 2);
    ctx.restore();
  }

  // ---------- Un piso ----------
  function piso(ctx, n, y0) {
    const b = V.b, Mi = M(), P = planPiso(n), p = P.p, f = P.f, L = P.L, O = V.XW, suelo = y0 + SUELO;
    const bg = fondo(n, p, f, L);
    const sx = Math.max(0, Math.floor(V.x0 + O) - 2), sw = Math.min(bg.width - sx, Math.ceil(V.x1 - V.x0) + 4);
    if (sw > 0) ctx.drawImage(bg, sx, 0, sw, FH, sx - O, y0, sw, FH);
    const luces = [], ext = Math.max(-L.izq, L.der);
    // vetas: el filón atraviesa la roca hasta su nicho; las pepitas se achican al agotarse
    for (const a of p.v) {
      const def = Mi.veta(b, n, a.k), vx = vetaX(n, a.k);
      if (vx < V.x0 - 80 || vx > V.x1 + 80) continue;
      veta(ctx, n, y0, a, def, vx, a === p.v[0], luces);
    }
    frente(ctx, n, y0, P);
    // ducto de ventilación (se tiende desde el pozo cuando se pone)
    if (f.gas && p.m.ventilacion) {
      const pr = progObra(n, 'ventilacion'), a0 = Math.max(L.izq + 4, -PW / 2 - pr * ext), a1 = Math.min(L.der - 4, PW / 2 + pr * ext);
      ctx.fillStyle = '#6a6e76'; ctx.fillRect(a0, y0 + TECHO + 4, a1 - a0, 4);
      ctx.fillStyle = '#8a8e96'; ctx.fillRect(a0, y0 + TECHO + 4, a1 - a0, 1);
      for (let x = Math.ceil(a0 / 24) * 24; x < a1; x += 24) { ctx.fillStyle = '#4a4e56'; ctx.fillRect(x, y0 + TECHO + 4, 1, 4); }
      ctx.save(); ctx.translate(PW / 2 + 12, y0 + TECHO + 12); ctx.rotate(V.t * 10); ctx.fillStyle = '#b0b6c0'; ctx.fillRect(-6, -1, 12, 2); ctx.fillRect(-1, -6, 2, 12); ctx.restore();
      ctx.strokeStyle = '#4a4e56'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(PW / 2 + 12, y0 + TECHO + 12, 7, 0, Math.PI * 2); ctx.stroke();
      // el canario de los pisos con gas: si canta, se puede trabajar
      const cy = y0 + TECHO + 2, hop = (V.t * 3 + n) % 4 < 0.6 ? 1 : 0;
      ctx.fillStyle = '#2a1c10'; ctx.fillRect(-PW / 2 - 16, y0 + TECHO - 2, 1, 4);
      ctx.drawImage(bicho('canario', hop), -PW / 2 - 19.5, cy, 7, 10);
      luces.push([-PW / 2 - 16, cy + 6, 12, 0.5]);
    }
    // utilería
    for (const q of propsDe(n, p, L)) {
      if (q.x < V.x0 - 30 || q.x > V.x1 + 30) continue;
      const c = prop(q.t, q.t === 'pizarra' ? p.i - p.v.length : 0), w = c.width / 2, h = c.height / 2;
      ctx.drawImage(c, Math.round(q.x - w / 2), suelo - h, w, h);
      if (q.t === 'altar') { const fl = Math.sin(V.t * 13 + q.x) > 0 ? 1 : 0; ctx.fillStyle = '#ffd27a'; ctx.fillRect(q.x - 2.5, suelo - 4 - 1 - fl * 0.5, 1, 1); ctx.fillRect(q.x + 3, suelo - 4 - 1 - (1 - fl) * 0.5, 1, 1); luces.push([q.x, suelo - 6, 16, 0.6]); }
    }
    // rieles (se tienden desde el pozo cuando se ponen)
    if (p.m.rieles) {
      const pr = progObra(n, 'rieles'), a0 = Math.max(L.izq + 2, -PW / 2 - pr * ext), a1 = Math.min(L.der - 2, PW / 2 + pr * ext);
      ctx.fillStyle = '#4a3420'; for (let x = Math.ceil(a0 / 6) * 6; x < a1; x += 6) ctx.fillRect(x, suelo - 1, 4, 2);
      ctx.fillStyle = '#9aa0aa'; ctx.fillRect(a0, suelo - 2, a1 - a0, 1);
      if (pr < 1) for (const s of [1, -1]) brillos(s * (PW / 2 + pr * ext), suelo - 3, [255, 220, 150], 1, 20);
    }
    // faroles colgados de los marcos del entibado (uno cada dos marcos); al ponerlos, se encienden uno por uno
    if (p.m.lamparas) {
      const pr = progObra(n, 'lamparas');
      for (const s of [1, -1]) for (let x = s * (PW / 2 + 44); s > 0 ? x < L.der - 8 : x > L.izq + 8; x += s * 60) {
        if (Math.abs(x) > PW / 2 + pr * ext || p.v.some(a => Math.abs(vetaX(n, a.k) - x) < 26)) continue;
        farol(ctx, x, y0 + TECHO + 3); luces.push([x, y0 + TECHO + 12, 34, 1]);
      }
    }
    // bomba de agua junto al pozo (baja colgada cuando se pone)
    if (f.agua && p.m.bomba) bomba(ctx, -PW / 2 - 22, suelo - Math.round((1 - progObra(n, 'bomba')) * 30), n);
    // murciélagos colgados en los pisos de arriba; a veces salen a volar
    if (n <= 6) murcielagos(ctx, n, y0, L);
    // ratas
    ratas(ctx, n, suelo, P);
    // los mineros (primero las vagonetas, después la gente)
    const lista = (V.porPiso[n] || []).filter(a => a.est !== 'jaula');
    if (P.rieles) for (const a of lista) if (a.est === 'trabaja' && a.rol === 'carro') { const cx = a.x + a.dir * 17; if (cx > V.x0 - 20 && cx < V.x1 + 20) ctx.drawImage(vagoneta(a.lleno ? P.cc : null, Math.floor(a.fase / 3)), Math.round(cx * 2) / 2 - 11, suelo - 14, 22, 14); }
    for (const a of lista) if (a.x > V.x0 - 30 && a.x < V.x1 + 30) dibujarMinero(ctx, a, suelo, P, luces);
    // montón de mineral junto al palero (sin rieles)
    if (!P.rieles && P.vx !== null && lista.some(a => a.rol === 'palero')) { const x = P.vx + (P.vx > 0 ? -25 : 25); ctx.fillStyle = rgb(sc(P.cc, 0.8)); ctx.fillRect(Math.round(x - 4), suelo - 4, 8, 4); ctx.fillStyle = rgb(P.cc); ctx.fillRect(Math.round(x - 3), suelo - 6, 5, 2); }
    // agua: con bomba es un charco; sin bomba les llega a las rodillas (la bomba la baja de a poco)
    if (f.agua) { const meta = p.m.bomba ? 3 : 17, w = V.agua[n] === undefined ? meta : V.agua[n]; V.agua[n] = w + U.clamp(meta - w, -3 * V.dt, 3 * V.dt); agua(ctx, L, y0, suelo, V.agua[n], p.m.bomba); }
    // gas: niebla verde y barricada; con ventilación se despeja de a poco
    if (f.gas) { const meta = p.m.ventilacion ? 0 : 1, a = V.gasA[n] === undefined ? meta : V.gasA[n]; V.gasA[n] = a + U.clamp(meta - a, -0.35 * V.dt, 0.35 * V.dt); if (V.gasA[n] > 0.01) gas(ctx, L, y0, suelo, V.gasA[n]); }
    // oscuridad: solo se ve lo que alumbran faroles, cascos, vetas y el descanso del pozo
    luces.push([PW / 2 + 6, suelo - 20, 30, 0.9], [-PW / 2 - 6, suelo - 20, 30, 0.9]);
    oscuridad(ctx, n, y0, L, luces, p.m.lamparas ? 0.42 : 0.62);
    // lo que tiene que leerse aunque esté oscuro: el brillo de las vetas, la superficie del agua, el polvo en la luz y el magma
    for (const a of p.v) { const def = Mi.veta(b, n, a.k), vx = vetaX(n, a.k); if (vx > V.x0 - 40 && vx < V.x1 + 40) destellos(ctx, n, y0, a, def, vx); }
    if (f.agua) { const wl = suelo - V.agua[n]; ctx.fillStyle = 'rgba(160,210,255,0.55)'; for (let x = Math.max(L.izq, V.x0); x < Math.min(L.der, V.x1); x += 2) ctx.fillRect(x, Math.round(wl + Math.sin(x * 0.18 + V.t * 2.4) * 0.9), 2, 1); }
    motas(ctx, luces);
    if (n >= 14) magma(ctx, y0, L);
    if (P.cerrado) { ctx.font = '9px "Pixelify Sans", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = '#e6ffb0'; ctx.fillText('Gas: hace falta ventilación', PW / 2 + 10, y0 + TECHO + 8); }
    // el nombre del estrato, a un costado de la placa
    ctx.font = '7px "Pixelify Sans", monospace'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(240,226,192,0.75)';
    ctx.fillText(f.e.name + (f.agua ? ' · agua' : '') + (f.gas ? ' · gas' : ''), PW / 2 + 6, y0 + 9);
    // un piso recién excavado aparece de a poco
    const rv = V.revela[n];
    if (rv !== undefined && V.t - rv < 2.5) { ctx.fillStyle = 'rgba(10,7,5,' + (1 - (V.t - rv) / 2.5) + ')'; ctx.fillRect(V.x0, y0, V.x1 - V.x0, FH); }
    // de vez en cuando cae tierra del techo
    if (Math.random() < V.dt * 0.25) { const x = L.izq + Math.random() * (L.der - L.izq); for (let i = 0; i < 3; i++) V.part.push({ x: x + Math.random() * 3, y: y0 + TECHO + 1, vx: 0, vy: 4 + i * 6, t: 0, max: 3, col: sc(f.e.col, 1.15), s: 1, piso: suelo - 1 }); }
  }
  // el frente se agrieta a medida que avanza; a punto de destapar, tiene los barrenos cargados con su mecha
  function frente(ctx, n, y0, P) {
    const p = P.p, fx = P.frente, lado = P.L.frente, prog = U.clamp(p.fr / D.MINA.avanceCosto(n), 0, 1), r = U.rng((V.b.mina.sem + n * 71 + p.i * 13) >>> 0);
    if (fx < V.x0 - 40 || fx > V.x1 + 40) return;
    const cuantas = Math.floor(prog * 10);
    for (let i = 0; i < 10; i++) {
      let x = fx - lado, y = y0 + TECHO + 3 + r() * 44;
      const pasos = [];
      for (let j = 0; j < 5; j++) { const nx = x - lado * (2 + r() * 5), ny = y + (r() - 0.5) * 7; pasos.push([x, y, nx, ny]); x = nx; y = ny; }
      if (i < cuantas) for (const [a, b2, c, d] of pasos) linea(ctx, a, b2, c, d, 'rgba(16,10,8,0.85)', 1);
    }
    if (p.v.length >= D.MINA.maxVetas) { // detenido: dos tablones cruzados
      ctx.fillStyle = '#8a5a30';
      ctx.save(); ctx.translate(fx - lado * 8, y0 + 60); ctx.rotate(0.5); ctx.fillRect(-14, -1.5, 28, 3); ctx.rotate(-1); ctx.fillRect(-14, -1.5, 28, 3); ctx.restore();
    } else if (prog > 0.8) {
      for (let i = 0; i < 3; i++) {
        const y = y0 + TECHO + 14 + i * 11, hx = fx - lado * 2;
        ctx.fillStyle = '#0c0806'; ctx.fillRect(hx - 1, y, 2, 2);
        ctx.fillStyle = '#c8b890'; for (let j = 1; j < 5; j++) ctx.fillRect(hx - lado * j, y + 1 + Math.round(Math.sin(j + i) * 1.5), 1, 1);
        if (Math.sin(V.t * 14 + i * 2) > 0.2) { ctx.fillStyle = '#ff7a24'; ctx.fillRect(hx - lado * 5, y + 1, 1, 1); }
      }
    }
  }
  function murcielagos(ctx, n, y0, L) {
    let m = V.murc[n];
    if (!m) { const r = U.rng((V.b.mina.sem + n * 557) >>> 0); m = V.murc[n] = []; for (let i = 0; i < 2 + Math.floor(r() * 2); i++) { const x = L.izq + 20 + r() * (L.der - L.izq - 40); if (Math.abs(x) > PW) m.push({ x0: x, x, y: 0, vuela: 0 }); } }
    for (const q of m) {
      if (q.vuela <= 0 && Math.random() < V.dt * 0.03) q.vuela = 5 + Math.random() * 3;
      if (q.vuela > 0) {
        q.vuela -= V.dt;
        const t = 1 - q.vuela / 8, dx = Math.sin(t * Math.PI) * 70 * (q.x0 > 0 ? -1 : 1);
        q.x = q.x0 + dx; q.y = Math.sin(t * Math.PI * 5) * 5 + Math.sin(t * Math.PI) * 12;
        if (q.vuela <= 0) { q.x = q.x0; q.y = 0; }
      }
      if (q.x < V.x0 - 10 || q.x > V.x1 + 10) continue;
      const fr = q.vuela > 0 ? 1 + (Math.floor(V.t * 12) % 2) : 0;
      ctx.drawImage(bicho('murc', fr), Math.round(q.x * 2) / 2 - 4.5, y0 + TECHO - 4 + q.y, 9, 6);
    }
  }
  function ratas(ctx, n, suelo, P) {
    if (!P.lento && !P.cerrado && Math.random() < V.dt * 0.05 && V.ratas.filter(r => r.n === n).length < 2) { const s = Math.random() < 0.5 ? 1 : -1; V.ratas.push({ n, x: s > 0 ? P.L.izq + 4 : P.L.der - 4, dir: s, pausa: 0, vida: 14 }); if (PK.Sfx && Math.random() < 0.4) PK.Sfx.play('rata'); }
    for (let i = V.ratas.length - 1; i >= 0; i--) {
      const q = V.ratas[i];
      if (q.n !== n) continue;
      q.vida -= V.dt;
      if (q.pausa > 0) q.pausa -= V.dt; else { q.x += q.dir * 38 * V.dt; if (Math.random() < V.dt * 0.6) q.pausa = 0.4 + Math.random() * 1.2; }
      // si un minero camina cerca, se da vuelta y escapa
      for (const a of V.porPiso[n] || []) if (a.camina && Math.abs(a.x - q.x) < 14 && Math.sign(a.x - q.x) === q.dir) { q.dir = -q.dir; q.pausa = 0; if (PK.Sfx && q.x > V.x0 && q.x < V.x1) PK.Sfx.play('rata'); break; }
      if (q.vida <= 0 || q.x < P.L.izq || q.x > P.L.der) { V.ratas.splice(i, 1); continue; }
      if (q.x < V.x0 - 10 || q.x > V.x1 + 10) continue;
      ctx.save(); ctx.translate(Math.round(q.x * 2) / 2, suelo - 4.5); if (q.dir < 0) ctx.scale(-1, 1); ctx.drawImage(bicho('rata', q.pausa > 0 ? 0 : Math.floor(V.t * 14) % 2), -4, 0, 8, 4.5); ctx.restore();
    }
  }

  // filón + nicho + pepitas; el que se trabaja, con más luz; una veta recién destapada brilla un rato
  function veta(ctx, n, y0, a, def, vx, activa, luces) {
    // el filón cruza la roca en diagonal y aflora en la hornacina de la pared, a la altura del pico; abajo, el mineral
    // ya arrancado espera la pala
    const col = RESCOL[def.res] || [200, 200, 200], frac = U.clamp(a.q / def.cant, 0, 1), r = U.rng((V.b.mina.sem + n * 131 + a.k * 17) >>> 0);
    const s = r() < 0.5 ? -1 : 1, ancho = 2 + Math.round(1.5 * frac), cy = y0 + VY;
    // el filón: una línea quebrada y fina que baja en diagonal por la pared del fondo, con dos ramitas
    const filon = (x, y, dx, hasta, w, ramas) => {
      const pts = [[x, y]];
      while (y < hasta) { x += dx * (3 + r() * 4) + (r() - 0.5) * 4; y += 3 + r() * 3; pts.push([x, y]); }
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i], enRoca = by < y0 + TECHO + 3, ww = Math.max(1, Math.round(w * (0.6 + 0.4 * Math.sin(i * 1.7 + ax))));
        ctx.globalAlpha = enRoca ? 0.4 : 0.95;
        linea(ctx, ax, ay, bx, by, rgb(sc(col, 0.42)), ww + 2);
        linea(ctx, ax, ay, bx, by, rgb(sc(col, enRoca ? 0.7 : 0.88)), ww);
        if (!enRoca && ww > 1) { ctx.fillStyle = rgb(sc(col, 1.35)); ctx.fillRect(Math.round(bx), Math.round(by), 1, 1); }
        if (ramas && i % 4 === 2 && !enRoca) filon(bx, by, -dx * 0.6, by + 8 + r() * 6, Math.max(1, w - 1), false);
      }
      ctx.globalAlpha = 1;
    };
    filon(vx - s * (14 + r() * 6), y0 + TECHO + 5, s, cy + 16, ancho, true); // todo dentro de la pared: arriba, en el techo, parecía que minaban hacia arriba
    // la masa del afloramiento: pepitas en la cara de la pared (se achican y ralean al agotarse)
    const m = 8 + Math.round(26 * frac);
    for (let i = 0; i < m; i++) {
      const ang = r() * Math.PI * 2, rad = Math.sqrt(r()), x = Math.round(vx + Math.cos(ang) * rad * 13), y = Math.round(cy - 2 + Math.sin(ang) * rad * 11), sz = 1 + Math.floor(r() * (1 + 3 * frac));
      if (r() > 0.35 + 0.65 * frac) continue;
      ctx.fillStyle = rgb(sc(col, 0.45)); ctx.fillRect(x - 1, y - 1, sz + 2, sz + 2);
      ctx.fillStyle = rgb(sc(col, 0.8 + r() * 0.35)); ctx.fillRect(x, y, sz, sz);
      ctx.fillStyle = rgb(sc(col, 1.5)); ctx.fillRect(x, y, 1, 1);
    }
    // picaduras recientes: marcas claras en la roca alrededor
    for (let i = 0; i < 6; i++) { const x = Math.round(vx + (r() - 0.5) * 30), y = Math.round(cy - 8 + r() * 18); ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fillRect(x, y, 2, 1); }
    // el montón al pie de la pared
    const mon = Math.round(2 + 6 * frac), bx0 = vx + s * 4, suelo = y0 + SUELO;
    for (let j = 0; j < mon * 3; j++) {
      const t = (r() - 0.5) * 2, hh = Math.max(0, Math.round(mon * (1 - t * t) * (0.6 + r() * 0.5))), x = Math.round(bx0 + t * (mon + 5));
      ctx.fillStyle = rgb(sc(col, 0.55)); ctx.fillRect(x - 1, suelo - hh - 1, 3, hh + 1);
      ctx.fillStyle = rgb(sc(col, 0.85 + r() * 0.3)); ctx.fillRect(x, suelo - hh - 1, 2, 2);
    }
    if (def.esp) {
      // cristales que brotan de la hornacina
      const ec = RESCOL[def.esp], pul = 0.75 + 0.25 * Math.sin(V.t * 3 + a.k);
      for (let i = 0; i < 5; i++) {
        const x = vx - 9 + i * 4 + (i % 2), h = 4 + ((i * 7) % 3) * 3, y = cy + 6 - (i % 2) * 14;
        ctx.fillStyle = rgb(sc(ec, 0.45)); ctx.fillRect(x - 1, y - h - 1, 5, h + 2);
        ctx.fillStyle = rgb(sc(ec, pul)); ctx.fillRect(x, y - h, 3, h);
        ctx.fillStyle = rgb(sc(ec, 1.4)); ctx.fillRect(x, y - h, 1, h);
      }
      luces.push([vx, cy, 26, 1]);
    }
    const nueva = V.vetaNueva[n + '|' + a.k], brillo = nueva !== undefined && V.t - nueva < 5 ? 1 - (V.t - nueva) / 5 : 0;
    luces.push([vx, cy, (activa ? 30 : 20) + brillo * 26, activa || brillo ? 0.9 : 0.6]);
  }
  // destellos que se ven aun en la oscuridad (dibujados después de la sombra)
  function destellos(ctx, n, y0, a, def, vx) {
    const col = RESCOL[def.res] || [220, 220, 220], r = U.rng((V.b.mina.sem + n * 59 + a.k * 7) >>> 0), nueva = V.vetaNueva[n + '|' + a.k], extra = nueva !== undefined && V.t - nueva < 5 ? 6 : 0;
    for (let i = 0; i < 6 + extra; i++) {
      const x = Math.round(vx - 15 + r() * 30), y = Math.round(y0 + VY - 12 + r() * 22), fase = r() * 6.28;
      const s = Math.sin(V.t * (3 + extra) + fase);
      if (s < 0.6) continue;
      ctx.fillStyle = rgb(sc(col, 1.5), (s - 0.6) * 2.4); ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    }
  }
  function farol(ctx, x, y) {
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
    ctx.fillStyle = '#9aa0aa'; ctx.fillRect(x - 1, suelo - 26 + sube, 2, 10); ctx.fillRect(x - 4, suelo - 27 + sube, 8, 2);
    ctx.save(); ctx.translate(x + 8, suelo - 10); ctx.rotate(V.t * 5); ctx.strokeStyle = '#8a8e96'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#6a6e76'; ctx.fillRect(x + 6, suelo - 30, 2, 30); ctx.fillRect(x + 6, suelo - 30, PW / 2 + 8, 2);
    if (Math.random() < 0.5) V.part.push({ x: x + 7 + Math.random(), y: suelo - 30, vx: 0, vy: -18, t: 0, max: 0.4, col: [120, 180, 240], s: 1, puff: 1 });
    if (vapor && Math.random() < 0.15) V.part.push({ x, y: suelo - 28, vx: (Math.random() - 0.5) * 6, vy: -8, t: 0, max: 1.4, col: [220, 220, 220], s: 2, puff: 1, crece: 1 });
  }
  function agua(ctx, L, y0, suelo, alto, bomba) {
    const wl = suelo - alto, x0 = Math.max(L.izq, V.x0 - 2), x1 = Math.min(L.der, V.x1 + 2);
    if (x1 <= x0) return;
    const g = ctx.createLinearGradient(0, wl, 0, suelo + 2);
    g.addColorStop(0, 'rgba(70,130,200,0.62)'); g.addColorStop(1, 'rgba(24,52,100,0.86)');
    ctx.fillStyle = g; ctx.fillRect(x0, wl, x1 - x0, suelo + 2 - wl);
    for (let x = Math.ceil(x0 / 14) * 14; x < x1; x += 14) { const o = (V.t * 6 + x * 0.7) % 14; ctx.fillStyle = 'rgba(200,230,255,0.35)'; ctx.fillRect(x + o, wl + 2 + ((x / 14) % 3), 4, 1); }
    if (Math.random() < (bomba ? 0.12 : 0.3)) { const x = x0 + Math.random() * (x1 - x0); V.part.push({ x, y: y0 + TECHO + 2, vx: 0, vy: 20, t: 0, max: 2, col: [150, 200, 255], s: 1, piso: wl, gota: 1 }); }
    if (alto > 8 && Math.random() < 0.06) { const x = x0 + Math.random() * (x1 - x0); V.part.push({ x, y: suelo - 2, vx: 0, vy: -6, t: 0, max: (alto - 2) / 6, col: [190, 230, 255], s: 1, puff: 1 }); } // burbujas
  }
  function salpicar(x, y) { for (let i = 0; i < 3; i++) V.part.push({ x: x + (Math.random() - 0.5) * 6, y, vx: (Math.random() - 0.5) * 24, vy: -14 - Math.random() * 8, t: 0, max: 0.5, col: [170, 210, 255], s: 1, piso: y + 1 }); V.part.push({ x, y, vx: 0, vy: 0, t: 0, max: 0.5, anillo: 1, col: [170, 210, 255] }); }
  function gas(ctx, L, y0, suelo, al) {
    for (let i = 0; i < 9; i++) {
      const x = L.izq + ((i * 73 + V.t * (6 + i)) % Math.max(20, L.der - L.izq)), y = y0 + TECHO + 10 + (i % 4) * 9 + Math.sin(V.t + i) * 3;
      ctx.fillStyle = 'rgba(150,210,90,' + 0.18 * al + ')'; ctx.beginPath(); ctx.ellipse(x, y, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (al < 0.5) return;
    ctx.fillStyle = '#7a5232';
    for (const s of [-1, 1]) { const x = s * (PW / 2 + 10); ctx.save(); ctx.translate(x, suelo - 18); ctx.rotate(s * 0.5); ctx.fillRect(-12, -2, 24, 4); ctx.rotate(-s); ctx.fillRect(-12, -2, 24, 4); ctx.restore(); }
    ctx.fillStyle = '#d8c040'; ctx.fillRect(PW / 2 + 22, suelo - 40, 14, 10); ctx.fillStyle = '#1a1408'; ctx.fillRect(PW / 2 + 28, suelo - 38, 2, 5); ctx.fillRect(PW / 2 + 28, suelo - 32, 2, 1);
  }
  function magma(ctx, y0, L) {
    const pul = 0.35 + 0.25 * Math.sin(V.t * 1.6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, y0 + SUELO, 0, y0 + FH);
    g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(1, 'rgba(255,90,20,' + pul * 0.5 + ')');
    ctx.fillStyle = g; ctx.fillRect(V.x0, y0 + SUELO, V.x1 - V.x0, FH - SUELO);
    ctx.restore();
    if (Math.random() < 0.25) V.part.push({ x: L.izq + Math.random() * (L.der - L.izq), y: y0 + SUELO + 2, vx: (Math.random() - 0.5) * 6, vy: -10 - Math.random() * 8, t: 0, max: 1.6, col: [255, 140 + Math.floor(Math.random() * 80), 40], s: 1, brillo: 1, puff: 1 }); // brasas
  }
  // motas de polvo que flotan en la luz de faroles y cascos
  function motas(ctx, luces) {
    for (let j = 0; j < luces.length; j++) {
      const [lx, ly, r, a] = luces[j];
      if (a < 0.85 || lx < V.x0 - r || lx > V.x1 + r) continue;
      for (let i = 0; i < 3; i++) {
        const x = lx + Math.sin(V.t * 0.5 + i * 2.1 + lx) * r * 0.5, y = ly + Math.cos(V.t * 0.37 + i * 1.7 + j) * r * 0.4, al = 0.25 + 0.2 * Math.sin(V.t * 2 + i + j);
        ctx.fillStyle = 'rgba(255,236,190,' + al + ')'; ctx.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, 0.5, 0.5);
      }
    }
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
    // los destellos de los eventos también alumbran
    for (const q of V.flash) {
      if (q.y < y0 - q.r || q.y > y0 + FH + q.r) continue;
      const a = 1 - q.t / q.max, g = x.createRadialGradient(q.x - ox, q.y - y0, 0, q.x - ox, q.y - y0, q.r * 1.4);
      g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(q.x - ox - q.r * 1.4, q.y - y0 - q.r * 1.4, q.r * 2.8, q.r * 2.8);
    }
    ctx.drawImage(c, ox, y0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [lx, ly, r, a] of luces) {
      if (lx + r < V.x0 || lx - r > V.x1 || a < 0.8) continue;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.7);
      g.addColorStop(0, 'rgba(255,170,70,' + 0.1 * a + ')'); g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g; ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  // ---------- Partículas, destellos y carteles ----------
  function polvo(x, y, col) { for (let i = 0; i < 4; i++) V.part.push({ x, y, vx: (Math.random() - 0.5) * 18, vy: -6 - Math.random() * 6, t: 0, max: 1, col, s: 2, puff: 1, crece: 1 }); }
  function chispa(x, y, col) { for (let i = 0; i < 3; i++) V.part.push({ x, y, vx: (Math.random() - 0.5) * 34, vy: -12 - Math.random() * 14, t: 0, max: 0.35, col: [255, 240, 180], s: 0.5, brillo: 1 }); for (let i = 0; i < 2; i++) V.part.push({ x, y, vx: (Math.random() - 0.5) * 22, vy: -8, t: 0, max: 0.9, col, s: 1, piso: y + 16 }); }
  function particulas(ctx, dt) {
    const P = V.part;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (!q.puff && !q.quieta) q.vy += (q.gota ? 90 : 60) * dt;
      if (q.haciaX !== undefined) q.vx += (q.haciaX - q.x) * dt * 0.5;
      if (q.piso && q.y >= q.piso && !q.quieta) {
        if (q.gota && Math.random() < 0.15 && PK.Sfx) PK.Sfx.play('gota');
        if (q.gota) { P.push({ x: q.x, y: q.piso, vx: 0, vy: 0, t: 0, max: 0.5, anillo: 1, col: q.col }); for (let j = 0; j < 2; j++) P.push({ x: q.x, y: q.piso - 1, vx: (Math.random() - 0.5) * 20, vy: -14, t: 0, max: 0.3, col: q.col, s: 1 }); P.splice(i, 1); continue; }
        if (q.rebota && q.vy > 12) { q.y = q.piso; q.vy = -q.vy * 0.3; q.vx *= 0.5; }
        else if (q.rebota) { q.y = q.piso; q.vy = 0; q.vx = 0; q.quieta = 1; }
        else { P.splice(i, 1); continue; }
      }
      if (q.t >= q.max) { P.splice(i, 1); continue; }
      const a = 1 - q.t / q.max;
      if (q.anillo) { ctx.strokeStyle = rgb(q.col, a * 0.8); ctx.lineWidth = 1 / V.k * 2; ctx.beginPath(); ctx.ellipse(q.x, q.y, 1 + q.t * 14, 0.5 + q.t * 3, 0, 0, Math.PI * 2); ctx.stroke(); continue; }
      const s = q.crece ? q.s * (1 + q.t * 1.6) : q.s;
      if (q.brillo) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgb(q.col, a); ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s); if (s <= 1) { ctx.fillStyle = rgb(q.col, a * 0.5); ctx.fillRect(q.x - 1.5, q.y, 3, 0.5); ctx.fillRect(q.x, q.y - 1.5, 0.5, 3); } ctx.restore(); continue; }
      ctx.fillStyle = rgb(q.col, q.puff ? 0.45 * a : q.quieta ? Math.min(1, a * 3) : a);
      ctx.fillRect(Math.round(q.x * 2) / 2, Math.round(q.y * 2) / 2, s, q.gota ? 2 : s);
    }
    if (P.length > 700) P.splice(0, P.length - 700);
  }
  function destellosEv(ctx, dt) {
    if (!V.flash.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = V.flash.length - 1; i >= 0; i--) {
      const q = V.flash[i];
      q.t += dt;
      if (q.t >= q.max) { V.flash.splice(i, 1); continue; }
      const a = 1 - q.t / q.max, g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r);
      g.addColorStop(0, rgb(q.col, 0.7 * a)); g.addColorStop(1, rgb(q.col, 0));
      ctx.fillStyle = g; ctx.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2);
    }
    ctx.restore();
  }
  function textos(ctx, dt) {
    ctx.font = '8px "Pixelify Sans", monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    for (let i = V.txt.length - 1; i >= 0; i--) {
      const q = V.txt[i];
      q.t += dt;
      if (q.t >= q.max) { V.txt.splice(i, 1); continue; }
      const y = q.y - 10 - q.t * 5, a = q.t > q.max * 0.7 ? (q.max - q.t) / (q.max * 0.3) : Math.min(1, q.t * 6);
      const x = U.clamp(q.x, V.x0 + 50, V.x1 - 50);
      const o = Math.max(0.5, 1 / V.k);
      ctx.fillStyle = 'rgba(14,9,6,' + 0.9 * a + ')';
      for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [o, o], [-o, o]]) ctx.fillText(q.txt, x + dx, y + dy);
      ctx.fillStyle = rgb(q.col.map(v => Math.round(v + (255 - v) * 0.4)), a); ctx.fillText(q.txt, x, y);
    }
    ctx.textAlign = 'left';
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
