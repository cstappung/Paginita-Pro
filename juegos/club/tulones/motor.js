/* ================================================================
   Tulones — el motor (UMD, TulonesMotor). Puro: ni DOM ni lienzo, así
   que corre en Node (tests/tulones.test.cjs).

   Un tulón es un muñeco de Verlet: dieciséis partículas unidas por
   restricciones de distancia. Las rígidas forman el tronco (cuello,
   pecho, pelvis, hombros y caderas cruzados, para que no se pliegue
   como un acordeón); las de los miembros son huesos de largo fijo y
   unas «mínimas» impiden que la mano atraviese el hombro. Cada miembro
   se conduce con un vector (raíz → extremo) que el jugador mueve; si el
   extremo está agarrado (`pin`), mover el vector arrastra el cuerpo y
   no el miembro, que es como se trepa en el original.

   Unidades: 100 = 1 m, y hacia abajo, el suelo en y = 0. Paso fijo de
   1/120 s: el resultado no depende de los fotogramas.

   El bulto del calzoncillo es un muelle amortiguado en el marco de la
   pelvis, empujado por la gravedad menos la aceleración de la pelvis
   (lo que un objeto suelto siente dentro de un cuerpo que se mueve).
   Así cuelga hacia la entrepierna de pie, hacia la cintura cabeza
   abajo, y se sacude con cada tirón. Nunca sale del slip: |o| ≤ 5.
   ================================================================ */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.TulonesMotor = fabrica();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const G = 980, DT = 1 / 120, ITER = 10, AMORT = 0.996, MU = 0.5, LIM_X = 1500;
  const I = { cabeza: 0, cuello: 1, pecho: 2, pelvis: 3, hombroI: 4, hombroD: 5, codoI: 6, codoD: 7, manoI: 8, manoD: 9,
    caderaI: 10, caderaD: 11, rodillaI: 12, rodillaD: 13, pieI: 14, pieD: 15 };
  const N = 16;
  const POSE = [[0, -184], [0, -161], [0, -138], [0, -96], [-24, -150], [24, -150], [-30, -114], [30, -114], [-33, -80], [33, -80],
    [-12, -94], [12, -94], [-13, -48], [13, -48], [-14, -3], [14, -3]];
  const RADIO = [17, 7, 16, 15, 9, 9, 6, 6, 6.5, 6.5, 10, 10, 7, 7, 6.5, 6.5];
  const MASA = [1.2, .6, 3, 3, 1, 1, .7, .7, .5, .5, 1.4, 1.4, 1, 1, .7, .7];

  // Miembros: 0 brazo izq (A), 1 brazo der (S), 2 pierna izq (K), 3 pierna der (L).
  const MIEMBROS = [
    { raiz: I.hombroI, med: I.codoI, ext: I.manoI, brazo: true },
    { raiz: I.hombroD, med: I.codoD, ext: I.manoD, brazo: true },
    { raiz: I.caderaI, med: I.rodillaI, ext: I.pieI, brazo: false },
    { raiz: I.caderaD, med: I.rodillaD, ext: I.pieD, brazo: false }
  ];

  const largo = (a, b) => Math.hypot(POSE[a][0] - POSE[b][0], POSE[a][1] - POSE[b][1]);
  const RIGIDAS = [];
  const ri = (a, b, k = 1) => RIGIDAS.push([a, b, largo(a, b), k]);
  ri(I.cuello, I.cabeza); ri(I.pecho, I.cuello); ri(I.pecho, I.pelvis); ri(I.hombroI, I.hombroD);
  ri(I.hombroI, I.pecho); ri(I.hombroD, I.pecho); ri(I.hombroI, I.cuello); ri(I.hombroD, I.cuello);
  ri(I.caderaI, I.caderaD); ri(I.caderaI, I.pelvis); ri(I.caderaD, I.pelvis);
  ri(I.hombroI, I.caderaI); ri(I.hombroD, I.caderaD); ri(I.hombroI, I.caderaD); ri(I.hombroD, I.caderaI);
  ri(I.pecho, I.caderaI); ri(I.pecho, I.caderaD); ri(I.cuello, I.pelvis);
  ri(I.cabeza, I.hombroI, .5); ri(I.cabeza, I.hombroD, .5);
  const HUESOS = [];
  for (const m of MIEMBROS) { HUESOS.push([m.raiz, m.med, largo(m.raiz, m.med)]); HUESOS.push([m.med, m.ext, largo(m.med, m.ext)]); }
  const MINIMAS = [[I.hombroI, I.manoI, 22], [I.hombroD, I.manoD, 22], [I.caderaI, I.pieI, 30], [I.caderaD, I.pieD, 30]];
  const LARGO_M = MIEMBROS.map(m => largo(m.raiz, m.med) + largo(m.med, m.ext));
  // Puntos de colisión a mitad de hueso, además de las partículas.
  const MUESTRAS = [[I.cabeza, I.cuello, 8], [I.pecho, I.pelvis, 15], [I.pecho, I.cuello, 12], ...HUESOS.map(h => [h[0], h[1], (RADIO[h[0]] + RADIO[h[1]]) / 2])];

  /* ---------- el cuerpo ---------- */
  function crea(x0, aspecto) {
    const p = new Float64Array(N * 2), q = new Float64Array(N * 2);
    for (let i = 0; i < N; i++) { p[i * 2] = q[i * 2] = x0 + POSE[i][0]; p[i * 2 + 1] = q[i * 2 + 1] = POSE[i][1] - 1; }
    const c = { p, q, pin: [null, null, null, null], held: [false, false, false, false], vec: [], contacto: new Array(N).fill(null),
      bulto: { x: 0, y: 0, vx: 0, vy: 0 }, vp: [0, 0], ap: [0, 0], aspecto: aspecto || null, t: 0 };
    c.vec = MIEMBROS.map(m => [p[m.ext * 2] - p[m.raiz * 2], p[m.ext * 2 + 1] - p[m.raiz * 2 + 1]]);
    return c;
  }
  const px = (c, i) => c.p[i * 2], py = (c, i) => c.p[i * 2 + 1];

  /* ---------- el mundo: cápsulas estáticas ---------- */
  // La cabra: el primer escalón, en x = 0 mirando a la derecha.
  const CABRA = [
    [-55, -92, 50, -92, 30], [52, -100, 78, -138, 16], [85, -145, 108, -128, 15], [82, -160, 70, -180, 4], [92, -160, 100, -181, 4],
    [-48, -70, -48, 0, 6.5], [-30, -70, -30, 0, 6.5], [30, -70, 30, 0, 6.5], [45, -70, 45, 0, 6.5]
  ];
  function mundo() { return { caps: CABRA.map(c => capsula(c[0], c[1], c[2], c[3], c[4])), torre: [] }; }
  function capsula(ax, ay, bx, by, r) {
    return { ax, ay, bx, by, r, x0: Math.min(ax, bx) - r, x1: Math.max(ax, bx) + r, y0: Math.min(ay, by) - r, y1: Math.max(ay, by) + r };
  }

  // Punto más cercano del segmento ab a (x,y).
  function cercano(ax, ay, bx, by, x, y) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    let t = l > 0 ? ((x - ax) * dx + (y - ay) * dy) / l : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return [ax + dx * t, ay + dy * t];
  }

  // Empuja el punto fuera de toda superficie; devuelve la normal (o null).
  function empuja(W, x, y, r) {
    let nx = 0, ny = 0, hubo = false;
    for (let k = 0; k < 3; k++) {
      let mejor = null, pen = 0;
      if (y + r > 0) { pen = y + r; mejor = [0, -1]; }
      for (const s of W.caps) {
        if (x < s.x0 - r || x > s.x1 + r || y < s.y0 - r || y > s.y1 + r) continue;
        const [cx, cy] = cercano(s.ax, s.ay, s.bx, s.by, x, y);
        const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), m = s.r + r - d;
        if (m > pen) { pen = m; mejor = d > 1e-6 ? [dx / d, dy / d] : [0, -1]; }
      }
      if (!mejor) break;
      x += mejor[0] * pen; y += mejor[1] * pen; nx = mejor[0]; ny = mejor[1]; hubo = true;
    }
    if (x < -LIM_X) x = -LIM_X; if (x > LIM_X) x = LIM_X;
    return hubo ? [x, y, nx, ny] : [x, y, null, null];
  }
  // ¿Toca superficie (con un margen)? Para el agarre automático.
  function toca(W, x, y, r) {
    if (y + r > 0) return true;
    for (const s of W.caps) {
      if (x < s.x0 - r || x > s.x1 + r || y < s.y0 - r || y > s.y1 + r) continue;
      const [cx, cy] = cercano(s.ax, s.ay, s.bx, s.by, x, y);
      if (Math.hypot(x - cx, y - cy) <= s.r + r) return true;
    }
    return false;
  }

  /* ---------- restricciones ---------- */
  function distancia(c, a, b, L, k, pinA, pinB) {
    const P = c.p, ax = P[a * 2], ay = P[a * 2 + 1], bx = P[b * 2], by = P[b * 2 + 1];
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1e-6, e = (d - L) / d * k;
    let wa = pinA ? 0 : 1 / MASA[a], wb = pinB ? 0 : 1 / MASA[b];
    const s = wa + wb; if (!s) return; wa /= s; wb /= s;
    P[a * 2] += dx * e * wa; P[a * 2 + 1] += dy * e * wa; P[b * 2] -= dx * e * wb; P[b * 2 + 1] -= dy * e * wb;
  }
  function fijado(c) { const f = new Array(N).fill(false); MIEMBROS.forEach((m, k) => { if (c.pin[k]) f[m.ext] = true; }); return f; }

  /* ---------- un paso ---------- */
  function paso(c, W) {
    const P = c.p, Q = c.q, f = fijado(c);
    const pv0 = [P[I.pelvis * 2] - Q[I.pelvis * 2], P[I.pelvis * 2 + 1] - Q[I.pelvis * 2 + 1]];
    // Verlet
    for (let i = 0; i < N; i++) {
      if (f[i]) continue;
      const x = P[i * 2], y = P[i * 2 + 1];
      P[i * 2] += (x - Q[i * 2]) * AMORT; P[i * 2 + 1] += (y - Q[i * 2 + 1]) * AMORT + G * DT * DT;
      Q[i * 2] = x; Q[i * 2 + 1] = y;
    }
    // Conducir los miembros sostenidos.
    MIEMBROS.forEach((m, k) => {
      if (!c.held[k]) return;
      const v = c.vec[k];
      if (!c.pin[k]) {
        const tx = P[m.raiz * 2] + v[0], ty = P[m.raiz * 2 + 1] + v[1];
        let dx = tx - P[m.ext * 2], dy = ty - P[m.ext * 2 + 1]; const d = Math.hypot(dx, dy);
        if (d > 3) { dx *= 3 / d; dy *= 3 / d; }
        P[m.ext * 2] += dx; P[m.ext * 2 + 1] += dy;
      } else {
        const pin = c.pin[k];
        let dx = (pin[0] - v[0]) - P[m.raiz * 2], dy = (pin[1] - v[1]) - P[m.raiz * 2 + 1];
        dx *= .35; dy *= .35; const d = Math.hypot(dx, dy); if (d > 1.5) { dx *= 1.5 / d; dy *= 1.5 / d; }
        for (let i = 0; i < N; i++) if (!f[i]) { P[i * 2] += dx; P[i * 2 + 1] += dy; Q[i * 2] += dx * .2; Q[i * 2 + 1] += dy * .2; }
        // El vector se reacomoda a lo que el cuerpo logró de verdad.
        const rx = pin[0] - P[m.raiz * 2], ry = pin[1] - P[m.raiz * 2 + 1];
        v[0] += (rx - v[0]) * .02; v[1] += (ry - v[1]) * .02;
      }
    });
    // Restricciones y choques.
    for (let it = 0; it < ITER; it++) {
      for (const r of RIGIDAS) distancia(c, r[0], r[1], r[2], r[3], f[r[0]], f[r[1]]);
      for (const h of HUESOS) distancia(c, h[0], h[1], h[2], 1, f[h[0]], f[h[1]]);
      for (const mn of MINIMAS) {
        const a = mn[0], b = mn[1], d = Math.hypot(P[b * 2] - P[a * 2], P[b * 2 + 1] - P[a * 2 + 1]);
        if (d < mn[2]) distancia(c, a, b, mn[2], 1, f[a], f[b]);
      }
      MIEMBROS.forEach((m, k) => { if (c.pin[k]) { P[m.ext * 2] = c.pin[k][0]; P[m.ext * 2 + 1] = c.pin[k][1]; } });
      if (it >= ITER - 3) choques(c, W, f);
    }
    // Rozamiento en lo que toca.
    for (let i = 0; i < N; i++) {
      const n = c.contacto[i]; if (!n || f[i]) continue;
      const vx = P[i * 2] - Q[i * 2], vy = P[i * 2 + 1] - Q[i * 2 + 1], vn = vx * n[0] + vy * n[1];
      const tx = vx - vn * n[0], ty = vy - vn * n[1];
      const nv = vn < 0 ? 0 : vn;
      Q[i * 2] = P[i * 2] - (tx * (1 - MU) + nv * n[0]); Q[i * 2 + 1] = P[i * 2 + 1] - (ty * (1 - MU) + nv * n[1]);
    }
    // El bulto.
    const pv = [P[I.pelvis * 2] - Q[I.pelvis * 2], P[I.pelvis * 2 + 1] - Q[I.pelvis * 2 + 1]];
    const ax = (pv[0] - pv0[0]) / (DT * DT), ay = (pv[1] - pv0[1]) / (DT * DT);
    c.ap[0] += (ax - c.ap[0]) * .3; c.ap[1] += (ay - c.ap[1]) * .3;
    bulto(c, DT);
    // Agarre automático: el extremo sostenido que toca algo se queda.
    MIEMBROS.forEach((m, k) => {
      if (!c.held[k] || c.pin[k]) return;
      if (toca(W, P[m.ext * 2], P[m.ext * 2 + 1], RADIO[m.ext] + 2.5)) {
        c.pin[k] = [P[m.ext * 2], P[m.ext * 2 + 1]];
        c.vec[k] = [c.pin[k][0] - P[m.raiz * 2], c.pin[k][1] - P[m.raiz * 2 + 1]];
        if (c.alAgarrar) c.alAgarrar(k);
      }
    });
    c.t += DT;
  }

  function choques(c, W, f) {
    const P = c.p;
    for (let i = 0; i < N; i++) {
      c.contacto[i] = null; if (f[i]) continue;
      const r = empuja(W, P[i * 2], P[i * 2 + 1], RADIO[i]);
      P[i * 2] = r[0]; P[i * 2 + 1] = r[1]; if (r[2] !== null) c.contacto[i] = [r[2], r[3]];
    }
    for (const s of MUESTRAS) {
      const a = s[0], b = s[1];
      const mx = (P[a * 2] + P[b * 2]) / 2, my = (P[a * 2 + 1] + P[b * 2 + 1]) / 2;
      const r = empuja(W, mx, my, s[2]);
      if (r[2] === null) continue;
      const dx = r[0] - mx, dy = r[1] - my;
      if (!f[a]) { P[a * 2] += dx; P[a * 2 + 1] += dy; }
      if (!f[b]) { P[b * 2] += dx; P[b * 2 + 1] += dy; }
    }
  }

  /* El bulto: muelle en el marco de la pelvis. */
  const BK = 900, BC = 9, BS = 1.5, BMAX = 5;
  function marco(c) {
    const P = c.p, ux = P[I.cuello * 2] - P[I.pelvis * 2], uy = P[I.cuello * 2 + 1] - P[I.pelvis * 2 + 1], l = Math.hypot(ux, uy) || 1;
    return { u: [ux / l, uy / l], r: [-uy / l, ux / l] };
  }
  function bulto(c, dt) {
    const b = c.bulto, M = marco(c);
    const fx = -c.ap[0], fy = G - c.ap[1];
    // Local: x a lo ancho (r), y hacia los pies (−u).
    const lx = fx * M.r[0] + fy * M.r[1], ly = -(fx * M.u[0] + fy * M.u[1]);
    // Equilibrio de pie: BS·G/BK ≈ 1.6 hacia la entrepierna.
    const axl = -BK * b.x - BC * b.vx + BS * lx, ayl = -BK * b.y - BC * b.vy + BS * ly;
    b.vx += axl * dt; b.vy += ayl * dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    const d = Math.hypot(b.x, b.y);
    if (d > BMAX) { b.x *= BMAX / d; b.y *= BMAX / d; const vn = (b.vx * b.x + b.vy * b.y) / (BMAX * BMAX); if (vn > 0) { b.vx -= vn * b.x * 1.5; b.vy -= vn * b.y * 1.5; } }
  }

  /* ---------- entrada ---------- */
  function mueve(c, k, dx, dy) {
    const m = MIEMBROS[k], L = LARGO_M[k], v = c.vec[k];
    v[0] += dx; v[1] += dy;
    const min = L * (m.brazo ? .3 : .35), max = L * .97, d = Math.hypot(v[0], v[1]) || 1e-6;
    if (d > max) { v[0] *= max / d; v[1] *= max / d; } else if (d < min) { v[0] *= min / d; v[1] *= min / d; }
  }
  // Delta del ratón o del stick: a los sostenidos sueltos; si todos los sostenidos agarran, a esos (trepar).
  function empujaMiembros(c, dx, dy) {
    const sueltos = [0, 1, 2, 3].filter(k => c.held[k] && !c.pin[k]);
    const destino = sueltos.length ? sueltos : [0, 1, 2, 3].filter(k => c.held[k]);
    // Un miembro agarrado empuja al revés: tirar hacia abajo sube el cuerpo.
    for (const k of destino) mueve(c, k, dx, dy);
    return destino.length;
  }
  function sostiene(c, k, on) {
    c.held[k] = !!on;
    if (!on) c.pin[k] = null;
    else { const m = MIEMBROS[k]; c.vec[k] = [px(c, m.ext) - px(c, m.raiz), py(c, m.ext) - py(c, m.raiz)]; }
  }

  /* ---------- congelar: el cuerpo pasa a ser escalón ---------- */
  function capsulasDe(c) {
    const P = c.p, X = i => P[i * 2], Y = i => P[i * 2 + 1], cap = (a, b, r) => capsula(X(a), Y(a), X(b), Y(b), r);
    return [
      cap(I.pelvis, I.cuello, 19), cap(I.hombroI, I.hombroD, 9), cap(I.caderaI, I.caderaD, 11),
      capsula(X(I.cabeza), Y(I.cabeza), X(I.cabeza), Y(I.cabeza), 17), cap(I.cuello, I.cabeza, 8),
      cap(I.hombroI, I.codoI, 7.5), cap(I.codoI, I.manoI, 6), cap(I.hombroD, I.codoD, 7.5), cap(I.codoD, I.manoD, 6),
      cap(I.caderaI, I.rodillaI, 9.5), cap(I.rodillaI, I.pieI, 7), cap(I.caderaD, I.rodillaD, 9.5), cap(I.rodillaD, I.pieD, 7),
      capsula(X(I.manoI), Y(I.manoI), X(I.manoI), Y(I.manoI), 6.5), capsula(X(I.manoD), Y(I.manoD), X(I.manoD), Y(I.manoD), 6.5),
      capsula(X(I.pieI), Y(I.pieI), X(I.pieI), Y(I.pieI), 6.5), capsula(X(I.pieD), Y(I.pieD), X(I.pieD), Y(I.pieD), 6.5)
    ];
  }
  function congela(c, W) {
    const caps = capsulasDe(c);
    W.caps.push(...caps);
    const foto = { p: Float64Array.from(c.p), bulto: { x: c.bulto.x, y: c.bulto.y }, aspecto: c.aspecto };
    W.torre.push(foto);
    return foto;
  }
  // Altura en metros: lo más alto del cuerpo.
  function altura(c) { let m = 0; for (let i = 0; i < N; i++) m = Math.max(m, -c.p[i * 2 + 1] + RADIO[i]); return m / 100; }
  function alturaMundo(W) { let m = 181 / 100; for (const s of W.caps) m = Math.max(m, -s.y0 / 100); return m; }
  function valido(c) { for (let i = 0; i < N * 2; i++) if (!Number.isFinite(c.p[i])) return false; return true; }

  /* ---------- aspecto: piel, pelo, ropa ---------- */
  const CATALOGO = {
    piel: ['#f6d2b8', '#eebc94', '#d9a06f', '#b97a4f', '#8d5534', '#5e3622', '#9cc77a', '#8fb4e6'],
    pelo: ['calvo', 'corto', 'despeinado', 'tupe', 'largo', 'afro', 'coleta', 'mohicano'],
    colorPelo: ['#2b1d14', '#5a3a22', '#9a6a3a', '#d8b067', '#c9c2b8', '#b0451f', '#2a2a2a', '#3f6fd8'],
    barba: ['ninguna', 'bigote', 'perilla', 'barba', 'leñador', 'patillas'],
    calzon: ['slip', 'boxer', 'bañador', 'corazones'],
    colorCalzon: ['#f4f2ec', '#e2483d', '#3a6fd8', '#2a2a2a', '#f2c230', '#43a35a', '#ff8fc1', '#7a4fd0'],
    calcetines: ['ninguno', 'cortos', 'rayas', 'altos'],
    colorCalcetin: ['#ffffff', '#2a2a2a', '#e2483d', '#3a6fd8', '#f2c230'],
    sombrero: ['ninguno', 'gorra', 'vaquero', 'corona', 'vikingo', 'lana'],
    colorSombrero: ['#e2483d', '#3a6fd8', '#2a2a2a', '#8b5a2b', '#43a35a', '#f2c230'],
    fisico: ['normal', 'flaco', 'panzon', 'fornido']
  };
  const PRESETS = [
    { nombre: 'Don Tulón', piel: 0, pelo: 1, colorPelo: 1, barba: 1, calzon: 0, colorCalzon: 0, calcetines: 0, colorCalcetin: 0, sombrero: 0, colorSombrero: 0, fisico: 0 },
    { nombre: 'El Leñador', piel: 1, pelo: 2, colorPelo: 5, barba: 4, calzon: 1, colorCalzon: 1, calcetines: 3, colorCalcetin: 2, sombrero: 5, colorSombrero: 0, fisico: 3 },
    { nombre: 'Vikingo', piel: 0, pelo: 4, colorPelo: 3, barba: 3, calzon: 0, colorCalzon: 3, calcetines: 0, colorCalcetin: 0, sombrero: 4, colorSombrero: 2, fisico: 3 },
    { nombre: 'Surfista', piel: 2, pelo: 4, colorPelo: 3, barba: 0, calzon: 2, colorCalzon: 2, calcetines: 0, colorCalcetin: 0, sombrero: 0, colorSombrero: 0, fisico: 1 },
    { nombre: 'Rey Tulón', piel: 3, pelo: 1, colorPelo: 0, barba: 2, calzon: 3, colorCalzon: 6, calcetines: 1, colorCalcetin: 0, sombrero: 3, colorSombrero: 5, fisico: 2 },
    { nombre: 'Vaquero', piel: 4, pelo: 1, colorPelo: 0, barba: 5, calzon: 1, colorCalzon: 3, calcetines: 2, colorCalcetin: 2, sombrero: 2, colorSombrero: 3, fisico: 0 },
    { nombre: 'Abuelo', piel: 1, pelo: 0, colorPelo: 4, barba: 1, calzon: 0, colorCalzon: 0, calcetines: 3, colorCalcetin: 0, sombrero: 0, colorSombrero: 0, fisico: 2 },
    { nombre: 'Culturista', piel: 5, pelo: 7, colorPelo: 0, barba: 0, calzon: 0, colorCalzon: 5, calcetines: 1, colorCalcetin: 1, sombrero: 1, colorSombrero: 1, fisico: 3 }
  ];
  const CAMPOS = ['piel', 'pelo', 'colorPelo', 'barba', 'calzon', 'colorCalzon', 'calcetines', 'colorCalcetin', 'sombrero', 'colorSombrero', 'fisico'];
  function limpia(a) {
    const o = { nombre: String((a && a.nombre) || 'Tulón').replace(/[<>]/g, '').slice(0, 16) || 'Tulón' };
    for (const k of CAMPOS) {
      const lista = CATALOGO[k === 'colorCalzon' ? 'colorCalzon' : k], v = a ? a[k] : 0;
      o[k] = Number.isInteger(v) && v >= 0 && v < lista.length ? v : 0;
    }
    return o;
  }
  function aleatorio(rnd, nombre) {
    rnd = rnd || Math.random;
    const o = { nombre: nombre || 'Tulón' };
    for (const k of CAMPOS) o[k] = Math.floor(rnd() * CATALOGO[k].length);
    if (rnd() < .5) o.sombrero = 0;
    return o;
  }

  return { G, DT, I, N, POSE, RADIO, MIEMBROS, LARGO_M, CABRA, CATALOGO, PRESETS, CAMPOS,
    crea, mundo, capsula, paso, mueve, empujaMiembros, sostiene, congela, capsulasDe, altura, alturaMundo, valido, marco, limpia, aleatorio };
}));
