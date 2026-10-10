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

   El bulto del calzoncillo es un péndulo en el marco de la pelvis,
   movido por la gravedad menos la aceleración de la pelvis (lo que un
   objeto suelto siente dentro de un cuerpo que se mueve). Así cuelga
   hacia los pies de pie, se va hacia la cintura cabeza abajo y se
   bambolea con cada tirón. `bulto.x/y` es la punta respecto del enganche.
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
  const MASA_TOTAL = MASA.reduce((a, b) => a + b, 0);

  // Miembros: 0 brazo izq, 1 brazo der, 2 pierna izq, 3 pierna der (las teclas, más abajo).
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
  // Tono muscular: un miembro que nadie sostiene vuelve suave a su largo de pie (las piernas sostienen la pelvis)
  // y, si algo apoya, el torso se equilibra sobre la pelvis. Sin esto el muñeco se derrumba en cuclillas.
  // Como en el original: aparece en pose T y en reposo los brazos bajan a BRAZO_REPOSO bajo la horizontal.
  // POSE (brazos pegados al cuerpo) queda para los retratos.
  const BRAZO_REPOSO = 40 * Math.PI / 180;
  function brazosA(ang) {
    const pose = POSE.map(v => v.slice());
    MIEMBROS.forEach((m, k) => {
      if (!m.brazo) return;
      const lado = Math.sign(POSE[m.raiz][0]), [hx, hy] = POSE[m.raiz], cx = lado * Math.cos(ang), cy = Math.sin(ang);
      pose[m.med] = [hx + cx * largo(m.raiz, m.med), hy + cy * largo(m.raiz, m.med)];
      pose[m.ext] = [hx + cx * LARGO_M[k], hy + cy * LARGO_M[k]];
    });
    return pose;
  }
  const POSE_T = brazosA(0), POSE_REPOSO = brazosA(BRAZO_REPOSO);
  // Pose de codo/rodilla y extremo respecto de la raíz, en el marco del torso (r a lo ancho, u hacia la cabeza).
  const RESTO_M = MIEMBROS.map(m => [m.med, m.ext].map(i => [POSE_REPOSO[i][0] - POSE_REPOSO[m.raiz][0], POSE_REPOSO[m.raiz][1] - POSE_REPOSO[i][1]]));
  const TONO_PIERNA = .1, TONO_BRAZO = .008, TONO_TORSO = .04, TONO_AMORT = .7, TONO_MAX = .15;
  // Agarre: el extremo sostenido tiene que tocar este tiempo seguido, y si ya tocaba al apretar, despegarse antes.
  const AGARRE_T = .12, ARMA_SEPARA = 12;
  // Pierna que nadie sostiene: no se dobla por debajo de esta fracción de su largo de pie (no se arrodilla al caer).
  // Recién soltada y doblada no se abre de golpe (patearía el suelo): queda firme cuando el tono ya la estiró.
  const PIERNA_FIRME = .92;
  // Miembro sostenido suelto: cuánto se acerca la punta a su objetivo en cada iteración del solver, con tope por iteración.
  const GUIA = .3, GUIA_MAX = .3;
  /* Alcanzar: con otro miembro agarrado, el suelto puede apuntar ALCANCE más allá de su largo. Entonces su punta es
     un ancla que avanza ALC_VEL por paso hacia el objetivo y los huesos arrastran el cuerpo detrás (girando sobre el
     agarre, con las piernas colgando). Si el cuerpo ya no da más, la punta vuelve a donde llega el brazo. */
  // Empujar con lo agarrado: tope por paso, y qué parte se vuelve velocidad (con mucha, al soltar salía disparado).
  const EMPUJE_VEL = 2.5, EMPUJE_INERCIA = .1;
  /* Impulso (acción y reacción): mover rápido un miembro sostenido suelto empuja el cuerpo hacia donde va el ratón,
     pero solo si el cuerpo toca algo contra lo que empujar y no está agarrado (colgado manda el alcance). Solo
     cuenta lo brusco: lo movido por paso por encima de IMPULSO_UMBRAL; IMPULSO_K de eso se vuelve velocidad. Topes
     de velocidad del centro distintos: de lado generoso (el cuerpo va hacia donde tiras) y hacia arriba chico
     (se despega del suelo pero no rebota ni salta). */
  const IMPULSO_K = .15, IMPULSO_VEL_X = 1, IMPULSO_VEL_Y = 1.2, IMPULSO_UMBRAL = 3.5;
  const TORSO_ARRIBA = [I.cuello, I.cabeza, I.pecho], TORSO_ABAJO = [I.pelvis, I.caderaI, I.caderaD];
  const ALCANCE = 120, ALC_VEL = 2, ALC_HOLGURA = 4;
  // Red de seguridad: ninguna partícula pasa de esta velocidad (unidades por paso; 10 ≈ 12 m/s).
  const VEL_MAX = 10;
  // Puntos de colisión a mitad de hueso, además de las partículas.
  const MUESTRAS = [[I.cabeza, I.cuello, 8], [I.pecho, I.pelvis, 15], [I.pecho, I.cuello, 12], ...HUESOS.map(h => [h[0], h[1], (RADIO[h[0]] + RADIO[h[1]]) / 2])];

  /* ---------- el cuerpo ---------- */
  function crea(x0, aspecto) {
    const p = new Float64Array(N * 2), q = new Float64Array(N * 2);
    for (let i = 0; i < N; i++) { p[i * 2] = q[i * 2] = x0 + POSE_T[i][0]; p[i * 2 + 1] = q[i * 2 + 1] = POSE_T[i][1] - 1; }
    const c = { p, q, pin: [null, null, null, null], held: [false, false, false, false], vec: [], contacto: new Array(N).fill(null),
      bulto: { x: 0, y: largoBulto(aspecto), ang: 0, w: 0 }, vp: [0, 0], ap: [0, 0], aspecto: aspecto || null, t: 0,
      armado: [true, true, true, true], roce: [0, 0, 0, 0], firme: [true, true, true, true], impulso: [0, 0] };
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
  /* Resorte hacia la pose: mueve rodilla/codo y extremo hacia su sitio y la raíz al revés, según las masas.
     Solo con el cuerpo erguido (acostado queda flojo) y con el objetivo fuera de toda superficie: un objetivo
     dentro del suelo empuja contra él en cada paso y lanza el cuerpo por los aires. */
  function tono(c, f, W) {
    const P = c.p, mc = marco(c), erguido = Math.max(0, -mc.u[1]) ** 2;
    // Solo de pie: colgado las piernas cuelgan, y sentado empujaba las piernas contra el suelo y avanzaba como oruga.
    if (erguido < .05 || !dePie(c)) return;
    MIEMBROS.forEach((m, k) => {
      if (c.held[k]) return;
      const kt = (m.brazo ? TONO_BRAZO : TONO_PIERNA) * erguido, a = m.raiz;
      [m.med, m.ext].forEach((b, j) => {
        const rv = RESTO_M[k][j];
        const obj = empuja(W, P[a * 2] + rv[0] * mc.r[0] + rv[1] * mc.u[0], P[a * 2 + 1] + rv[0] * mc.r[1] + rv[1] * mc.u[1], RADIO[b]);
        let dx = obj[0] - P[b * 2], dy = obj[1] - P[b * 2 + 1];
        // Tope: agachado lejos de la pose, el tono levanta en medio segundo en vez de dar un salto.
        const dd = Math.hypot(dx, dy) * kt; if (dd > TONO_MAX) { dx *= TONO_MAX / dd; dy *= TONO_MAX / dd; }
        let wa = f[a] ? 0 : 1 / MASA[a], wb = f[b] ? 0 : 1 / MASA[b];
        const sw = wa + wb; if (!sw) return; wa /= sw; wb /= sw;
        // P y Q a la vez: recoloca sin dar velocidad. Como resorte puro rebotaba al aterrizar (pogo).
        const bx = dx * kt * wb, by = dy * kt * wb, ax = dx * kt * wa, ay = dy * kt * wa, Q = c.q;
        P[b * 2] += bx; P[b * 2 + 1] += by; Q[b * 2] += bx * TONO_AMORT; Q[b * 2 + 1] += by * TONO_AMORT;
        P[a * 2] -= ax; P[a * 2 + 1] -= ay; Q[a * 2] -= ax * TONO_AMORT; Q[a * 2 + 1] -= ay * TONO_AMORT;
      });
    });
  }
  /* La punta del miembro sostenido suelto va hacia raíz + vec dentro del solver, así los huesos no la devuelven al cuerpo.
     Con apoyo solo se mueve la punta (la reacción la pone el suelo; dársela a la raíz la clavaba contra él y salía
     disparado). En el aire, la reacción se reparte en todo el cuerpo: si no, agitar los miembros hace de hélice.
     El objetivo se saca de toda superficie: empujar contra el suelo no debe bombear energía cada paso. */
  function guia(c, f, W) {
    const P = c.p;
    let rx = 0, ry = 0;
    MIEMBROS.forEach((m, k) => {
      if (!c.held[k] || c.pin[k] || f[m.ext]) return;
      const v = c.vec[k], a = m.raiz, b = m.ext;
      const obj = empuja(W, P[a * 2] + v[0], P[a * 2 + 1] + v[1], RADIO[b]);
      let dx = (obj[0] - P[b * 2]) * GUIA, dy = (obj[1] - P[b * 2 + 1]) * GUIA;
      const d = Math.hypot(dx, dy); if (d > GUIA_MAX) { dx *= GUIA_MAX / d; dy *= GUIA_MAX / d; }
      P[b * 2] += dx; P[b * 2 + 1] += dy;
      rx += dx * MASA[b]; ry += dy * MASA[b];
    });
    // La reacción siempre al cuerpo entero: con un pie apoyado, sostener brazo y pierna también lo empujaba de lado.
    if (rx || ry) { for (let i = 0; i < N; i++) if (!f[i]) { P[i * 2] -= rx / MASA_TOTAL; P[i * 2 + 1] -= ry / MASA_TOTAL; } }
  }
  // De pie de verdad: algún pie apoyado y nada del tronco ni las rodillas en el suelo (sentado o tirado no cuenta).
  function dePie(c) {
    if (!(c.contacto[I.pieI] || c.contacto[I.pieD])) return false;
    for (const i of [I.pelvis, I.pecho, I.cabeza, I.rodillaI, I.rodillaD, I.caderaI, I.caderaD]) if (c.contacto[i]) return false;
    return true;
  }
  function impulsa(c, f) {
    const im = c.impulso, P = c.p, Q = c.q;
    const apoyo = !c.pin.some(Boolean) && c.contacto.some(Boolean), l = Math.hypot(im[0], im[1]);
    if (apoyo && l > IMPULSO_UMBRAL) {
      const dv = (l - IMPULSO_UMBRAL) * IMPULSO_K;
      let ax = im[0] / l * dv, ay = im[1] / l * dv, vx = 0, vy = 0, m = 0;
      for (let i = 0; i < N; i++) if (!f[i]) { vx += (P[i * 2] - Q[i * 2]) * MASA[i]; vy += (P[i * 2 + 1] - Q[i * 2 + 1]) * MASA[i]; m += MASA[i]; }
      vx /= m || 1; vy /= m || 1;
      if (ax > 0) ax = Math.min(ax, Math.max(0, IMPULSO_VEL_X - vx)); else ax = Math.max(ax, Math.min(0, -IMPULSO_VEL_X - vx));
      ay = ay < 0 ? Math.max(ay, Math.min(0, -IMPULSO_VEL_Y - vy)) : 0;
      if (ax || ay) for (let i = 0; i < N; i++) if (!f[i]) { Q[i * 2] -= ax; Q[i * 2 + 1] -= ay; }
    }
    im[0] = im[1] = 0;
  }
  function fijado(c) { const f = new Array(N).fill(false); MIEMBROS.forEach((m, k) => { if (c.pin[k]) f[m.ext] = true; }); return f; }

  /* ---------- un paso ---------- */
  function paso(c, W) {
    const P = c.p, Q = c.q, f = fijado(c);
    const alcanza = MIEMBROS.map((m, k) => c.held[k] && !c.pin[k] && c.pin.some(Boolean) && Math.hypot(c.vec[k][0], c.vec[k][1]) > LARGO_M[k] * .97 + 1);
    MIEMBROS.forEach((m, k) => { if (alcanza[k]) f[m.ext] = true; });
    const pv0 = [P[I.pelvis * 2] - Q[I.pelvis * 2], P[I.pelvis * 2 + 1] - Q[I.pelvis * 2 + 1]];
    // Verlet
    for (let i = 0; i < N; i++) {
      if (f[i]) continue;
      const x = P[i * 2], y = P[i * 2 + 1];
      let vx = (x - Q[i * 2]) * AMORT, vy = (y - Q[i * 2 + 1]) * AMORT;
      const vv = Math.hypot(vx, vy); if (vv > VEL_MAX) { vx *= VEL_MAX / vv; vy *= VEL_MAX / vv; }
      P[i * 2] += vx; P[i * 2 + 1] += vy + G * DT * DT;
      Q[i * 2] = x; Q[i * 2 + 1] = y;
    }
    impulsa(c, f);
    // Conducir los miembros sostenidos.
    MIEMBROS.forEach((m, k) => {
      if (!c.held[k]) return;
      const v = c.vec[k];
      if (!c.pin[k]) {
        if (!c.pin.some(Boolean)) { recorta(v, LARGO_M[k] * .97); return; }
        if (!alcanza[k]) return;
        const obj = empuja(W, P[m.raiz * 2] + v[0], P[m.raiz * 2 + 1] + v[1], RADIO[m.ext]);
        const gx = obj[0] - P[m.ext * 2], gy = obj[1] - P[m.ext * 2 + 1], g = Math.hypot(gx, gy);
        if (g > ALC_HOLGURA) { const a = Math.min(g, ALC_VEL) / g; P[m.ext * 2] += gx * a; P[m.ext * 2 + 1] += gy * a; }
        Q[m.ext * 2] = P[m.ext * 2]; Q[m.ext * 2 + 1] = P[m.ext * 2 + 1];
      } else {
        const pin = c.pin[k];
        let dx = (pin[0] - v[0]) - P[m.raiz * 2], dy = (pin[1] - v[1]) - P[m.raiz * 2 + 1];
        dx *= .35; dy *= .35; const d = Math.hypot(dx, dy); if (d > EMPUJE_VEL) { dx *= EMPUJE_VEL / d; dy *= EMPUJE_VEL / d; }
        // Casi sin velocidad: si el objetivo queda dentro del suelo, empujar cada paso no debe acumular energía.
        for (let i = 0; i < N; i++) if (!f[i]) { P[i * 2] += dx; P[i * 2 + 1] += dy; Q[i * 2] += dx * (1 - EMPUJE_INERCIA); Q[i * 2 + 1] += dy * (1 - EMPUJE_INERCIA); }
        // El vector se reacomoda a lo que el cuerpo logró de verdad; deprisa si va muy por delante.
        const rx = pin[0] - P[m.raiz * 2], ry = pin[1] - P[m.raiz * 2 + 1], atraso = Math.hypot(rx - v[0], ry - v[1]);
        const sigue = atraso > 25 ? .15 : .02;
        v[0] += (rx - v[0]) * sigue; v[1] += (ry - v[1]) * sigue;
      }
    });
    /* Equilibrio: de pie y con los pies apoyados, la parte de arriba se va sobre la pelvis y la de abajo al revés,
       con el impulso total en cero. Acostado no actúa: antes empujaba siempre hacia el mismo lado y se deslizaba solo. */
    const mcE = marco(c);
    if (-mcE.u[1] > .5 && dePie(c)) {
      const ex = (P[I.pelvis * 2] - P[I.cuello * 2]) * TONO_TORSO;
      let mArriba = 0, mAbajo = 0;
      for (const i of TORSO_ARRIBA) if (!f[i]) mArriba += MASA[i];
      for (const i of TORSO_ABAJO) if (!f[i]) mAbajo += MASA[i];
      if (mArriba && mAbajo) {
        for (const i of TORSO_ARRIBA) if (!f[i]) P[i * 2] += ex;
        for (const i of TORSO_ABAJO) if (!f[i]) P[i * 2] -= ex * mArriba / mAbajo;
      }
    }
    // Restricciones y choques.
    for (let it = 0; it < ITER; it++) {
      tono(c, f, W);
      guia(c, f, W);
      for (const r of RIGIDAS) distancia(c, r[0], r[1], r[2], r[3], f[r[0]], f[r[1]]);
      for (const h of HUESOS) distancia(c, h[0], h[1], h[2], 1, f[h[0]], f[h[1]]);
      MIEMBROS.forEach((m, k) => {
        if (m.brazo || c.held[k]) return;
        const a = m.raiz, b = m.ext, min = Math.hypot(RESTO_M[k][1][0], RESTO_M[k][1][1]) * PIERNA_FIRME;
        const d = Math.hypot(P[b * 2] - P[a * 2], P[b * 2 + 1] - P[a * 2 + 1]);
        if (d >= min) c.firme[k] = true;
        else if (c.firme[k]) distancia(c, a, b, min, .5, f[a], f[b]);
      });
      for (const mn of MINIMAS) {
        const a = mn[0], b = mn[1], d = Math.hypot(P[b * 2] - P[a * 2], P[b * 2 + 1] - P[a * 2 + 1]);
        if (d < mn[2]) distancia(c, a, b, mn[2], 1, f[a], f[b]);
      }
      MIEMBROS.forEach((m, k) => { if (c.pin[k]) { P[m.ext * 2] = c.pin[k][0]; P[m.ext * 2 + 1] = c.pin[k][1]; } });
      if (it >= ITER - 3) choques(c, W, f);
    }
    // El ancla que alcanza no puede dejar el brazo más largo de lo que es: si el cuerpo no la siguió, vuelve.
    MIEMBROS.forEach((m, k) => {
      if (!alcanza[k]) return;
      const dx = P[m.ext * 2] - P[m.raiz * 2], dy = P[m.ext * 2 + 1] - P[m.raiz * 2 + 1], d = Math.hypot(dx, dy) || 1e-6, L = LARGO_M[k];
      if (d > L + 1) { P[m.ext * 2] = Q[m.ext * 2] = P[m.raiz * 2] + dx / d * L; P[m.ext * 2 + 1] = Q[m.ext * 2 + 1] = P[m.raiz * 2 + 1] + dy / d * L; }
    });
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
    // Agarre automático: el extremo sostenido que toca algo un rato se queda.
    MIEMBROS.forEach((m, k) => {
      if (!c.held[k] || c.pin[k]) return;
      if (!toca(W, P[m.ext * 2], P[m.ext * 2 + 1], RADIO[m.ext] + 2.5)) {
        // Rearmar pide despegarse de verdad: un temblor de unas unidades no cuenta.
        if (!toca(W, P[m.ext * 2], P[m.ext * 2 + 1], RADIO[m.ext] + ARMA_SEPARA)) c.armado[k] = true;
        c.roce[k] = 0; return;
      }
      if (!c.armado[k]) return;
      c.roce[k] += DT;
      if (c.roce[k] >= AGARRE_T - 1e-9) {
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

  /* El bulto: péndulo colgado de la entrepierna, en el marco de la pelvis. BULTO_L es su largo físico (fija el
     ritmo del vaivén para el tamaño «grande»; los demás escalan con su largo), y BULTO_MAX lo lejos que gira. */
  const BULTO_L = 14, BULTO_AMORT = 1.6, BULTO_MAX = 2.4;
  function marco(c) {
    const P = c.p, ux = P[I.cuello * 2] - P[I.pelvis * 2], uy = P[I.cuello * 2 + 1] - P[I.pelvis * 2 + 1], l = Math.hypot(ux, uy) || 1;
    return { u: [ux / l, uy / l], r: [-uy / l, ux / l] };
  }
  function bulto(c, dt) {
    const b = c.bulto, M = marco(c);
    const fx = -c.ap[0], fy = G - c.ap[1];
    // Local: x a lo ancho (r), y hacia los pies (−u).
    const lx = fx * M.r[0] + fy * M.r[1], ly = -(fx * M.u[0] + fy * M.u[1]);
    // Péndulo: θ = 0 cuelga hacia los pies; se acelera según la componente tangente de la gravedad sentida.
    const s = Math.sin(b.ang), co = Math.cos(b.ang), largo = largoBulto(c.aspecto);
    b.w += ((lx * co - ly * s) / (BULTO_L * Math.max(largo, 6) / 12) - BULTO_AMORT * b.w) * dt;
    b.ang += b.w * dt;
    if (b.ang > BULTO_MAX) { b.ang = BULTO_MAX; if (b.w > 0) b.w *= -.3; }
    if (b.ang < -BULTO_MAX) { b.ang = -BULTO_MAX; if (b.w < 0) b.w *= -.3; }
    b.x = largo * Math.sin(b.ang); b.y = largo * Math.cos(b.ang);
  }


  /* ---------- entrada ---------- */
  function recorta(v, max) { const d = Math.hypot(v[0], v[1]); if (d > max) { v[0] *= max / d; v[1] *= max / d; } }
  function mueve(c, k, dx, dy) {
    const m = MIEMBROS[k], L = LARGO_M[k], v = c.vec[k];
    v[0] += dx; v[1] += dy;
    const otroAgarra = !c.pin[k] && c.pin.some((p, j) => p && j !== k);
    const min = L * (m.brazo ? .3 : .35), max = L * .97 + (otroAgarra ? ALCANCE : 0), d = Math.hypot(v[0], v[1]) || 1e-6;
    if (d > max) { v[0] *= max / d; v[1] *= max / d; } else if (d < min) { v[0] *= min / d; v[1] *= min / d; }
  }
  // Delta del ratón o del stick: a los sostenidos sueltos; si todos los sostenidos agarran, a esos (trepar).
  function empujaMiembros(c, dx, dy) {
    const sueltos = [0, 1, 2, 3].filter(k => c.held[k] && !c.pin[k]);
    const destino = sueltos.length ? sueltos : [0, 1, 2, 3].filter(k => c.held[k]);
    if (sueltos.length) { c.impulso[0] += dx; c.impulso[1] += dy; }
    // Un miembro agarrado empuja al revés: tirar hacia abajo sube el cuerpo.
    for (const k of destino) mueve(c, k, dx, dy);
    return destino.length;
  }
  function sostiene(c, k, on) {
    c.held[k] = !!on; c.armado[k] = false; c.roce[k] = 0; c.firme[k] = false;
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
    colorCalzon: ['#f4f2ec', '#e2483d', '#3a6fd8', '#2a2a2a', '#f2c230', '#43a35a', '#ff8fc1', '#7a4fd0', 'chilena'],
    calcetines: ['ninguno', 'cortos', 'rayas', 'altos'],
    colorCalcetin: ['#ffffff', '#2a2a2a', '#e2483d', '#3a6fd8', '#f2c230'],
    sombrero: ['ninguno', 'gorra', 'vaquero', 'corona', 'vikingo', 'lana', 'chupalla', 'paja'],
    colorSombrero: ['#e2483d', '#3a6fd8', '#2a2a2a', '#8b5a2b', '#43a35a', '#f2c230'],
    fisico: ['normal', 'flaco', 'panzon', 'fornido'],
    tamano: ['chico', 'promedio', 'grande', 'anaconda']
  };
  // Largo del bulto (unidades del dibujo del torso) para cada tamaño; 0 es un circulito sin péndulo.
  const LARGO_BULTO = { chico: 0, promedio: 6, grande: 12, anaconda: 70 };
  // Lo que falta en un aspecto guardado antes de que existiera el campo (el bulto de siempre es «grande»).
  const DEFECTO = { tamano: 2 };
  // Ya no se eligen: siempre slip, sin calcetines y el sombrero con su color propio. Se guardan fijos.
  const FIJOS = { calzon: 0, calcetines: 0, colorCalcetin: 0, colorSombrero: 0 };
  function largoBulto(aspecto) { return LARGO_BULTO[CATALOGO.tamano[aspecto && Number.isInteger(aspecto.tamano) ? aspecto.tamano : DEFECTO.tamano]] ?? 12; }
  const PRESETS = [
    { nombre: 'Don Tulón', piel: 0, pelo: 1, colorPelo: 1, barba: 1, calzon: 0, colorCalzon: 0, calcetines: 0, colorCalcetin: 0, sombrero: 0, colorSombrero: 0, fisico: 0, tamano: 2 },
    { nombre: 'El Leñador', piel: 1, pelo: 2, colorPelo: 5, barba: 4, calzon: 1, colorCalzon: 1, calcetines: 3, colorCalcetin: 2, sombrero: 5, colorSombrero: 0, fisico: 3, tamano: 2 },
    { nombre: 'Vikingo', piel: 0, pelo: 4, colorPelo: 3, barba: 3, calzon: 0, colorCalzon: 3, calcetines: 0, colorCalcetin: 0, sombrero: 4, colorSombrero: 2, fisico: 3, tamano: 2 },
    { nombre: 'Surfista', piel: 2, pelo: 4, colorPelo: 3, barba: 0, calzon: 2, colorCalzon: 2, calcetines: 0, colorCalcetin: 0, sombrero: 0, colorSombrero: 0, fisico: 1, tamano: 2 },
    { nombre: 'Rey Tulón', piel: 3, pelo: 1, colorPelo: 0, barba: 2, calzon: 3, colorCalzon: 6, calcetines: 1, colorCalcetin: 0, sombrero: 3, colorSombrero: 5, fisico: 2, tamano: 2 },
    { nombre: 'Vaquero', piel: 4, pelo: 1, colorPelo: 0, barba: 5, calzon: 1, colorCalzon: 3, calcetines: 2, colorCalcetin: 2, sombrero: 2, colorSombrero: 3, fisico: 0, tamano: 2 },
    { nombre: 'Abuelo', piel: 1, pelo: 0, colorPelo: 4, barba: 1, calzon: 0, colorCalzon: 0, calcetines: 3, colorCalcetin: 0, sombrero: 0, colorSombrero: 0, fisico: 2, tamano: 2 },
    { nombre: 'Culturista', piel: 5, pelo: 7, colorPelo: 0, barba: 0, calzon: 0, colorCalzon: 5, calcetines: 1, colorCalcetin: 1, sombrero: 1, colorSombrero: 1, fisico: 3, tamano: 2 },
    { nombre: 'El Huaso', piel: 2, pelo: 1, colorPelo: 0, barba: 1, calzon: 0, colorCalzon: 8, calcetines: 3, colorCalcetin: 0, sombrero: 6, colorSombrero: 0, fisico: 2, tamano: 2 },
    { nombre: 'Pirata', piel: 1, pelo: 2, colorPelo: 6, barba: 0, calzon: 2, colorCalzon: 2, calcetines: 0, colorCalcetin: 0, sombrero: 7, colorSombrero: 0, fisico: 1, tamano: 1 }
  ];
  const CAMPOS = ['piel', 'pelo', 'colorPelo', 'barba', 'calzon', 'colorCalzon', 'calcetines', 'colorCalcetin', 'sombrero', 'colorSombrero', 'fisico', 'tamano'];
  function limpia(a) {
    const o = { nombre: String((a && a.nombre) || 'Tulón').replace(/[<>]/g, '').slice(0, 16) || 'Tulón' };
    for (const k of CAMPOS) {
      const lista = CATALOGO[k === 'colorCalzon' ? 'colorCalzon' : k], v = a ? a[k] : 0;
      o[k] = Number.isInteger(v) && v >= 0 && v < lista.length ? v : (DEFECTO[k] ?? 0);
    }
    return Object.assign(o, FIJOS);
  }
  function aleatorio(rnd, nombre) {
    rnd = rnd || Math.random;
    const o = { nombre: nombre || 'Tulón' };
    for (const k of CAMPOS) o[k] = Math.floor(rnd() * CATALOGO[k].length);
    if (rnd() < .5) o.sombrero = 0;
    return limpia(o);
  }

  /* ---------------- teclas ---------------- */
  // Acciones reasignables: los cuatro miembros (índice de MIEMBROS), congelar y pausa.
  const ACCIONES = ['0', '1', '2', '3', 'congela', 'pausa'];
  const TECLAS = { 0: 'KeyA', 1: 'KeyD', 2: 'KeyW', 3: 'KeyS', congela: 'Space', pausa: 'KeyP' };
  // Fijas: Escape pausa y cancela, las flechas llevan los miembros, Tab mueve el foco.
  const RESERVADAS = ['Escape', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  const teclaValida = c => typeof c === 'string' && /^[A-Za-z][A-Za-z0-9]{0,24}$/.test(c) && RESERVADAS.indexOf(c) < 0;
  // Lo guardado se acepta acción por acción; una tecla repetida o rara vuelve a la de fábrica.
  function limpiaTeclas(t) {
    const o = {}, usadas = new Set();
    for (const a of ACCIONES) {
      const c = t && t[a];
      if (teclaValida(c) && !usadas.has(c)) { o[a] = c; usadas.add(c); }
    }
    for (const a of ACCIONES) {
      if (o[a]) continue;
      const c = usadas.has(TECLAS[a]) ? ACCIONES.map(x => TECLAS[x]).find(x => !usadas.has(x)) : TECLAS[a];
      o[a] = c; usadas.add(c);
    }
    return o;
  }
  // Asignar una tecla ya usada intercambia: la otra acción se queda con la anterior.
  function asignaTecla(t, accion, code) {
    const o = limpiaTeclas(t);
    if (ACCIONES.indexOf(accion) < 0 || !teclaValida(code)) return o;
    const otra = ACCIONES.find(a => a !== accion && o[a] === code);
    if (otra) o[otra] = o[accion];
    o[accion] = code;
    return o;
  }
  const NOMBRE_TECLA = {
    Space: 'Espacio', Enter: 'Enter', Backspace: '⌫', ShiftLeft: 'Shift izq.', ShiftRight: 'Shift der.',
    ControlLeft: 'Ctrl izq.', ControlRight: 'Ctrl der.', AltLeft: 'Alt izq.', AltRight: 'Alt der.',
    MetaLeft: '⌘ izq.', MetaRight: '⌘ der.', CapsLock: 'Bloq Mayús'
  };
  // `mapa` es el del teclado real (navigator.keyboard.getLayoutMap), para que Semicolon diga Ñ en un teclado español.
  function nombreTecla(code, mapa) {
    if (NOMBRE_TECLA[code]) return NOMBRE_TECLA[code];
    const real = mapa && mapa.get && mapa.get(code);
    if (real && real.trim()) return real.toUpperCase();
    let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
    m = /^Digit(\d)$/.exec(code); if (m) return m[1];
    m = /^Numpad(.+)$/.exec(code); if (m) return 'Num ' + m[1];
    return code;
  }

  /* ---------------- en línea: la sala ----------------
     La física no viaja: cada pantalla simula solo al que trepa en ella. Al registro de la sala va lo que decide
     la partida, y este reductor (lo usa `redTulones` de colabtex) lo vuelve a pasar en cada pantalla:

     - `{t:"listo", uid, on}`: antes del primer turno, cada uno dice si está listo (personalizar lo quita). La torre
       empieza cuando la sala está cerrada y todos los que siguen dentro (dos o más) lo están.
     - `{t:"sale", uid, n, at, a}`: el del turno n empieza a trepar (`a`, su aspecto). Fija el reloj del turno.
     - `{t:"congela", uid, n, at, p, b, a}`: su cuerpo al acabar, con las coordenadas en décimas (`codificaPose`).
       La altura y si supera la línea roja se recalculan aquí, no se cree lo que diga la pantalla.
     - `{t:"plazo", uid, n, at}`: cualquiera de la sala, pasado el plazo del turno n sin congela (cerró la pestaña,
       se quedó sin red). Ese turno acaba sin cuerpo: eliminado, como el que no supera la línea.
     - `{t:"reloj", uid, n, at}`: cualquiera de la sala, cuando el turno n no tiene hora de inicio (el primero, o
       el que sigue a un abandono, que no trae `at`). La primera vale y desde ella cuenta el plazo.
     - `{t:"abandona"}` (y la expulsión por votos, que llega igual): fuera; si era su turno, pasa al siguiente.

     `at` es la hora del servidor (las reglas la acotan a unos segundos de `now`), así que el plazo se juzga
     con jugadas, no con relojes de cada uno. El límite honesto: un cliente reescrito puede mandar una pose
     inventada; se exige que sea un cuerpo (huesos de su largo) y que no quede más de ALTO_MAX sobre la torre. */
  const SALA = { TIEMPOS: [30, 45, 60, 90], RONDAS: [0, 3, 5, 10], LISTO_MS: 15000, GRACIA_MS: 8000, ALTO_MAX: 3, SUPERA_MIN: .01, HOLGURA_HUESO: .35 };
  const tiempoSala = v => (SALA.TIEMPOS.indexOf(+v) >= 0 ? +v : 45);
  const rondasSala = v => (SALA.RONDAS.indexOf(+v) >= 0 ? +v : 0);
  function codificaPose(P) { return Array.from(P, v => Math.round(v * 10)).join(','); }
  function decodificaPose(s) {
    if (typeof s !== 'string' || s.length > 400) return null;
    const v = s.split(',');
    if (v.length !== N * 2) return null;
    const P = new Float64Array(N * 2);
    for (let i = 0; i < N * 2; i++) {
      if (!/^-?\d{1,6}$/.test(v[i])) return null;
      P[i] = +v[i] / 10;
      if (i % 2 === 0 ? Math.abs(P[i]) > LIM_X + 20 : P[i] > 5) return null;
    }
    return P;
  }
  // Un cuerpo de verdad: cada hueso y el tronco cerca de su largo (el solver deja algo de holgura).
  function poseSana(P) {
    const d = (a, b) => Math.hypot(P[a * 2] - P[b * 2], P[a * 2 + 1] - P[b * 2 + 1]);
    for (const h of HUESOS) if (Math.abs(d(h[0], h[1]) - h[2]) > h[2] * SALA.HOLGURA_HUESO) return false;
    for (const r of RIGIDAS) if (r[3] === 1 && Math.abs(d(r[0], r[1]) - r[2]) > r[2] * SALA.HOLGURA_HUESO) return false;
    return true;
  }
  function codificaBulto(b) { return b ? Math.round(b.x * 10) + ',' + Math.round(b.y * 10) : ''; }
  function decodificaBulto(s, asp) {
    const m = typeof s === 'string' ? /^(-?\d{1,4}),(-?\d{1,4})$/.exec(s) : null;
    return m ? { x: +m[1] / 10, y: +m[2] / 10 } : { x: 0, y: largoBulto(asp) };
  }
  function codificaAspecto(a) { const o = limpia(a); return CAMPOS.map(k => o[k]).join('.'); }
  function decodificaAspecto(s, nombre) {
    const o = { nombre: nombre || 'Tulón' };
    const v = typeof s === 'string' && s.length <= 60 ? s.split('.') : [];
    CAMPOS.forEach((k, i) => { o[k] = /^\d{1,2}$/.test(v[i] || '') ? +v[i] : undefined; });
    return limpia(o);
  }
  function alturaPose(P) { let m = 0; for (let i = 0; i < N; i++) m = Math.max(m, -P[i * 2 + 1] + RADIO[i]); return m / 100; }

  /* `jugadores`: [{uid, nombre}] en orden de asiento. `op`: {tiempo, rondas, listos}. Devuelve lo que pintan la
     sala y el marco. Sin hora de inicio (`inicio` 0) el plazo no corre hasta que alguien escribe `reloj`. */
  function reducirSala(jugadas, jugadores, op) {
    op = op || {};
    const tiempo = tiempoSala(op.tiempo), rondas = rondasSala(op.rondas), ms = tiempo * 1000;
    const js = jugadores || [], ids = js.map(j => j.uid), n0 = js.length;
    const fuera = {}, eliminados = {}, mejores = {}, aspectos = {};
    for (const u of ids) mejores[u] = 0;
    const W = mundo(), torre = [], hist = [];
    let idx = 0, ronda = 1, n = 0, inicio = 0, saleAt = 0, ganador = null, motivo = '';
    const activo = i => !fuera[ids[i]] && !eliminados[ids[i]];
    const enPie = () => ids.filter((u, i) => activo(i));
    const meta = () => alturaMundo(W);
    const plazoDe = () => (saleAt ? saleAt + ms + SALA.GRACIA_MS : inicio ? inicio + SALA.LISTO_MS + ms + SALA.GRACIA_MS : Infinity);
    function cierra() {
      const q = enPie();
      if (!q.length) { ganador = ''; motivo = Object.keys(eliminados).length ? 'nadie' : 'abandono'; return true; }
      if (n0 > 1 && q.length === 1) {
        ganador = q[0];
        motivo = ids.some(u => eliminados[u] && !fuera[u]) ? 'ultimo' : 'abandono';
        return true;
      }
      return false;
    }
    function porRondas() {
      const q = enPie();
      let max = -1, quien = '';
      for (const u of q) { if (mejores[u] > max) { max = mejores[u]; quien = u; } else if (mejores[u] === max) quien = ''; }
      ganador = quien; motivo = 'rondas';
    }
    // Pasa al siguiente en pie. `at` es la hora con la que acabó el turno: de ella cuenta el siguiente.
    function siguiente(at) {
      saleAt = 0; n++;
      inicio = Number.isFinite(at) && at > 0 ? at : 0;
      if (cierra()) return;
      do { idx++; if (idx >= n0) { idx = 0; ronda++; } } while (!activo(idx));
      if (rondas && ronda > rondas) porRondas();
    }
    // La torre empieza cuando la sala está cerrada (`op.listos`) y todos los que siguen dentro, dos o más, dieron «Listo».
    const sala = op.listos !== false && n0 > 0, preparados = {};
    let empezo = false;
    const todosListos = () => { const q = ids.filter(u => !fuera[u]); return q.length >= 2 && q.every(u => preparados[u]); };
    const arranca = at => { empezo = true; inicio = at > 0 ? at : 0; idx = 0; while (idx < n0 && !activo(idx)) idx++; };
    for (const j of jugadas || []) {
      if (ganador !== null) break;
      const u = j && j.uid, i = ids.indexOf(u);
      if (i < 0) continue;
      const at = Number.isFinite(j.at) ? j.at : 0;
      if (!empezo) {
        if (j.t === 'abandona' && !fuera[u]) { fuera[u] = true; hist.push({ e: 'sale', uid: u }); }
        else if (j.t === 'listo' && !fuera[u]) preparados[u] = j.on !== false;
        if (sala && todosListos()) arranca(j.t === 'listo' ? at : 0);
        continue;
      }
      if (j.t === 'abandona') {
        if (fuera[u]) continue;
        fuera[u] = true; hist.push({ e: 'sale', uid: u });
        if (i === idx) siguiente(at); else cierra();
        continue;
      }
      if (fuera[u] || j.n !== n) continue;
      const turno = ids[idx];
      if (j.t === 'sale') {
        if (u !== turno || saleAt) continue;
        saleAt = at || inicio || 0;
        if (inicio && saleAt > inicio + SALA.LISTO_MS) saleAt = inicio + SALA.LISTO_MS;
        if (typeof j.a === 'string') aspectos[u] = j.a;
        continue;
      }
      if (j.t === 'reloj') {
        if (!inicio && !saleAt && at > 0) inicio = at;
        continue;
      }
      if (j.t === 'plazo') {
        if (!(at >= plazoDe())) continue;
        eliminados[turno] = ronda;
        hist.push({ e: 'plazo', uid: turno, ronda });
        siguiente(at);
        continue;
      }
      if (j.t !== 'congela' || u !== turno) continue;
      if (at && at > plazoDe()) continue;
      const P = decodificaPose(j.p), m = meta();
      if (!P || !poseSana(P)) continue;
      const h = alturaPose(P);
      if (h > m + SALA.ALTO_MAX) continue;
      const a = typeof j.a === 'string' ? j.a : aspectos[u] || '';
      const asp = decodificaAspecto(a, (js[i] && js[i].nombre) || '');
      const foto = { uid: u, p: P, bulto: decodificaBulto(j.b, asp), aspecto: asp, h };
      W.caps.push(...capsulasDe({ p: P })); W.torre.push(foto); torre.push(foto);
      mejores[u] = Math.max(mejores[u], h);
      const ok = h > m + SALA.SUPERA_MIN;
      if (!ok) eliminados[u] = ronda;
      hist.push({ e: 'congela', uid: u, h, meta: m, ok, ronda });
      siguiente(at);
    }
    if (!empezo && sala && todosListos()) arranca(0);
    if (ganador === null && sala && (empezo || n0 > 1)) cierra();
    const fin = ganador !== null;
    const puntos = {};
    for (const u of ids) puntos[u] = Math.round(mejores[u] * 100);
    return {
      fase: fin ? 'fin' : !empezo ? 'espera' : 'jugando', empezo, preparados,
      turno: !empezo || fin ? '' : ids[idx], n, ronda, rondas, tiempo,
      inicio, saleAt, plazo: !empezo || fin ? 0 : plazoDe(), meta: meta(),
      torre, mejores, puntos, fuera, eliminados, vivos: enPie(), aspectos, hist: hist.slice(-40),
      ganador, motivo
    };
  }

  // Versión visible en el título mientras se ajusta la física (quitar al terminar).
  const VERSION = 'tulones-18';

  return { VERSION, largoBulto, FIJOS, G, DT, I, N, POSE, POSE_T, RADIO, MIEMBROS, LARGO_M, AGARRE_T, CABRA, CATALOGO, PRESETS, CAMPOS, ACCIONES, TECLAS, RESERVADAS,
    crea, mundo, capsula, paso, mueve, empujaMiembros, sostiene, congela, capsulasDe, altura, alturaMundo, valido, marco, limpia, aleatorio,
    teclaValida, limpiaTeclas, asignaTecla, nombreTecla,
    SALA, tiempoSala, rondasSala, codificaPose, decodificaPose, poseSana, codificaBulto, decodificaBulto, codificaAspecto, decodificaAspecto,
    alturaPose, reducirSala };
}));
