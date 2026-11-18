// Retratos de héroes y de los personajes que hablan (pk-50, pedido del dueño: «se ven todos similares y poco
// detallados»). Pixel art de 36x36 hecho por código, con luz desde arriba a la izquierda, contorno oscuro y brillo de
// borde. Cada cara sale de la semilla: forma de la cara, piel, ojos (forma y color), cejas, nariz, boca, edad (arrugas
// y canas), peinado (corto, raya, flequillo, puntas, rizos, calvo, cresta, largo, trenzas, cola, moño), barba
// (rala, bigote, candado, completa, larga), pecas, lunar, cicatriz y pendiente. La clase pone la ropa, lo que lleva en
// la cabeza y el fondo; el rasgo del héroe, el gesto (valiente frunce el ceño, suertudo sonríe, erudito usa gafas).
// Los personajes de la historia fijan lo suyo con `rasgos` (D.PERSONAJES): el parche de Tuerto Valdés, la corona del
// Rey Bandido, el monóculo de Tobías…
// Uso: heroes.js (H.retrato) llama a PK.Retratos.canvas(h, cl, ao) y guarda el dataURL. Los accesorios del Pase
// (ao) se dibujan con las coordenadas de los viejos retratos de 24x24, escaladas (A24).
(function () {
  'use strict';
  const PK = window.PK, U = PK.U;
  const R = (PK.Retratos = {});
  const N = 36, CX = 17.5, TY = 8; // centro de la cara y fila de arriba de la cabeza
  R.N = N;

  const PIELES = [[250, 218, 186], [236, 194, 156], [214, 164, 120], [176, 122, 84], [134, 88, 58], [98, 64, 44]];
  const PELOS = [[34, 24, 20], [74, 46, 28], [118, 74, 38], [178, 122, 56], [226, 196, 122], [156, 52, 30], [204, 96, 40], [54, 54, 62]];
  const CANAS = [[168, 162, 156], [214, 210, 204], [236, 234, 230]];
  const IRIS = [[82, 52, 30], [46, 94, 156], [58, 112, 60], [104, 80, 44], [36, 34, 38], [120, 96, 160], [70, 130, 140]];
  const CARAS = {
    oval: [3.5, 5, 5.5, 6, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6, 6, 5.5, 5, 4.5, 3.5, 2.5],
    cuadrada: [4, 5.5, 6, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6, 5.5, 4.5, 3.5],
    redonda: [3.5, 5, 6, 6.5, 7, 7, 7, 7, 7, 7, 7, 7, 6.5, 6, 5.5, 5, 4, 2.5],
    larga: [3.5, 4.5, 5, 5.5, 6, 6, 6, 6, 6, 6, 6, 6, 5.5, 5.5, 5, 4.5, 4, 3, 2],
  };
  const GESTO = { // el rasgo del héroe → cejas, boca y ojos
    valiente: { cejas: 'enojada', boca: 'mueca' }, prudente: { cejas: 'recta', boca: 'seria' }, avaro: { cejas: 'alzada', boca: 'mueca', ojos: 'entornado' },
    erudito: { cejas: 'alzada', boca: 'neutral', gafas: true }, robusto: { cejas: 'gruesa', boca: 'seria', cara: 'cuadrada' }, veloz: { cejas: 'alzada', boca: 'sonrisa' },
    suertudo: { cejas: 'alzada', boca: 'risa', ojos: 'feliz' },
  };

  const cl3 = v => U.clamp(Math.round(v), 0, 255);
  const sh = (c, f) => [cl3(c[0] * f), cl3(c[1] * f), cl3(c[2] * f)];
  const mx = (a, b, t) => [cl3(a[0] + (b[0] - a[0]) * t), cl3(a[1] + (b[1] - a[1]) * t), cl3(a[2] + (b[2] - a[2]) * t)];
  const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
  // ruido fijo por píxel (para hebras de pelo y barba sin patrones que se repitan)
  const hsh = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  // tono de una hebra: cada columna es un mechón (más claro o más oscuro) con algún pelo suelto
  const hebra = (x, y, base, osc, luz, s) => { const col = hsh(x, 0, s), n = hsh(x, y, s + 1); let c = col < 0.3 ? mx(base, osc, 0.45) : col > 0.8 ? mx(base, luz, 0.4) : base; if (n < 0.1) c = osc; else if (n > 0.93) c = luz; return c; };

  // ---------- Lienzo de píxeles: fondo aparte, figura con máscara (para el contorno y el brillo de borde) ----------
  function lienzo() {
    const bg = new Array(N * N).fill(null), fg = new Array(N * N).fill(null);
    const ok = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
    return {
      bg, fg,
      fondo(x, y, c) { if (ok(x, y)) bg[y * N + x] = c; },
      p(x, y, c) { x = Math.round(x); y = Math.round(y); if (ok(x, y) && c) fg[y * N + x] = c; },
      g(x, y) { return ok(x, y) ? fg[y * N + x] : null; },
      r(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.p(x + i, y + j, c); },
      // oscurece/aclara lo que ya está (para sombras y luces sobre la cara)
      t(x, y, f) { const c = this.g(x, y); if (c) this.p(x, y, sh(c, f)); },
      m(x, y, c2, k) { const c = this.g(x, y); if (c) this.p(x, y, mx(c, c2, k)); },
    };
  }

  // ---------- Fondo con el motivo de la clase ----------
  function fondo(L, clase, col, rng) {
    const base = sh(col, 0.32), luz = sh(col, 0.62);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - CX, y - 15) / 22;
      let c = mx(luz, base, U.clamp(d, 0, 1));
      if ((x + y) % 2 === 0 && d > 0.8) c = sh(c, 0.94); // grano en las esquinas
      L.fondo(x, y, c);
    }
    const tinte = (x, y, c2, k) => { const i = y * N + x; if (x >= 0 && y >= 0 && x < N && y < N) L.bg[i] = mx(L.bg[i], c2, k); };
    if (clase === 'paladin') for (let a = 0; a < 12; a++) { const an = (a / 12) * Math.PI * 2; for (let k = 6; k < 26; k++) if (a % 2 === 0) tinte(Math.round(CX + Math.cos(an) * k), Math.round(15 + Math.sin(an) * k), [255, 226, 130], 0.18); }
    else if (clase === 'guarda') for (let i = 0; i < 26; i++) { const x = Math.floor(rng() * N), y = Math.floor(rng() * 26); tinte(x, y, [120, 200, 90], 0.3); tinte(x + 1, y, [60, 120, 50], 0.25); }
    else if (clase === 'clerigo') for (let a = 0; a < 64; a++) { const an = (a / 64) * Math.PI * 2; tinte(Math.round(CX + Math.cos(an) * 12.5), Math.round(13 + Math.sin(an) * 12.5), [255, 240, 170], 0.45); }
    else if (clase === 'ingeniera') for (const [gx, gy, gr] of [[5, 7, 4], [31, 26, 5], [29, 5, 3]]) for (let a = 0; a < 40; a++) { const an = (a / 40) * Math.PI * 2, rr = gr + (a % 5 < 2 ? 1 : 0); tinte(Math.round(gx + Math.cos(an) * rr), Math.round(gy + Math.sin(an) * rr), [255, 200, 120], 0.25); }
    else if (clase === 'hechicero') for (let i = 0; i < 14; i++) { const x = Math.floor(rng() * N), y = Math.floor(rng() * 24), k = rng() < 0.3; tinte(x, y, [255, 246, 200], 0.7); if (k) { tinte(x - 1, y, [220, 200, 255], 0.35); tinte(x + 1, y, [220, 200, 255], 0.35); tinte(x, y - 1, [220, 200, 255], 0.35); tinte(x, y + 1, [220, 200, 255], 0.35); } }
    else if (clase === 'juglar') for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((Math.floor((x + y) / 6) + Math.floor((x - y + 60) / 6)) % 2 === 0) tinte(x, y, [255, 210, 120], 0.1);
    else if (clase === 'corsaria') for (let x = 0; x < N; x++) for (const y0 of [22, 27, 32]) tinte(x, Math.round(y0 + Math.sin((x + y0) / 3) * 1.2), [180, 230, 255], 0.22);
  }

  // ---------- Elegir la cara ----------
  function elegir(h, rng) {
    const ra = h.rasgos || {}, ge = GESTO[h.rasgo] || {};
    // siempre se tira el dado (aunque el rasgo venga fijo): así fijar uno no cambia el resto de la cara
    const dado = list => pick(list, rng), da = () => rng();
    const fij = (k, v) => (ra[k] !== undefined ? ra[k] : v);
    const mujer = !!h.mujer, edadR = da();
    const edad = fij('edad', edadR < 0.32 ? 'joven' : edadR < 0.8 ? 'adulto' : 'viejo');
    const canas = dado(CANAS), color = dado(PELOS), canoso = da() < 0.7;
    const pelo = fij('pelo', edad === 'viejo' && canoso ? canas : color);
    const pz = dado(mujer ? ['largo', 'largo', 'trenzas', 'cola', 'moño', 'flequillo', 'raya', 'rizado'] : ['corto', 'corto', 'raya', 'punta', 'rizado', 'atras', 'largo', 'cresta', 'calvo']);
    const calvo = da() < 0.4;
    const peinado = fij('peinado', !mujer && edad === 'viejo' && calvo ? 'calvo' : pz);
    const bb = dado(['', '', 'rala', 'bigote', 'candado', 'barba', 'barba', 'larga']), rala = da() < 0.3;
    const barba = fij('barba', mujer ? '' : edad === 'joven' ? (rala ? 'rala' : '') : bb);
    const piel = dado(PIELES), cara = dado(mujer ? ['oval', 'oval', 'redonda', 'larga'] : ['oval', 'cuadrada', 'cuadrada', 'redonda', 'larga']), iris = dado(IRIS);
    const ojos = dado(['normal', 'normal', 'grande', 'entornado']), cejas = dado(['recta', 'recta', 'alzada', 'gruesa', 'enojada']);
    const nariz = dado(mujer ? ['chica', 'chica', 'larga'] : ['chica', 'larga', 'ancha', 'ganchuda']), boca = dado(['neutral', 'sonrisa', 'seria', 'mueca', 'sonrisa']);
    const pecas = da() < 0.18, lunar = da() < 0.12, cic = da() < 0.1, pend = da() < (mujer ? 0.4 : 0.12), casco = da() < 0.55;
    return {
      mujer, edad, pelo, peinado, barba,
      piel: ra.piel !== undefined ? PIELES[ra.piel] : piel,
      cara: ra.cara || ge.cara || cara,
      iris: ra.iris !== undefined ? IRIS[ra.iris] : iris,
      ojos: ra.ojos || ge.ojos || ojos,
      cejas: ra.cejas || ge.cejas || cejas,
      nariz: fij('nariz', nariz),
      boca: ra.boca || ge.boca || boca,
      pecas: fij('pecas', pecas), lunar, cicatriz: fij('cicatriz', cic), pendiente: fij('pendiente', pend),
      gafas: ra.gafas !== undefined ? ra.gafas : !!ge.gafas,
      parche: !!ra.parche, monoculo: !!ra.monoculo, corona: !!ra.corona, capucha: !!ra.capucha,
      casco: fij('casco', casco), sombrero: fij('sombrero', true),
      parpado: !!ra.parpado, // el cuadro del parpadeo
    };
  }

  // pk-80: lo que la cara del retrato eligió (piel, pelo, peinado, barba, casco, capucha, tricornio…), para que la
  // figura del héroe en el mapa y en la batalla se le parezca. Dibuja el retrato una vez (36x36, barato) porque algunas
  // decisiones (el tricornio de la Corsaria) salen de tiradas que se hacen mientras se dibuja.
  R.rasgos = function (h, cl) {
    if (typeof document === 'undefined') return null;
    R.ultimo = null; R.canvas(h, cl, null);
    return R.ultimo;
  };

  // ---------- Dibujo ----------
  R.canvas = function (h, cl, ao) {
    const rng = U.rng(h.semilla), clase = h.clase, col = cl.col;
    const L = lienzo(), f = elegir(h, rng);
    fondo(L, clase, col, U.rng(h.semilla + 17));
    const hw = CARAS[f.cara], CY = TY + hw.length - 1; // fila de la barbilla
    const anchoEn = y => (y < TY || y > CY ? -1 : hw[y - TY]);
    const enCara = (x, y) => { const w = anchoEn(y); return w > 0 && Math.abs(x + 0.5 - CX) <= w; };
    const piel = f.piel, pelo = f.pelo, peloOsc = sh(pelo, 0.6), peloLuz = mx(pelo, [255, 245, 220], 0.28);
    const tela = col, telaOsc = sh(col, 0.62), telaLuz = mx(col, [255, 255, 255], 0.25);
    const oro = [232, 190, 72], oroOsc = [160, 116, 36], acero = [178, 186, 200], aceroOsc = [104, 112, 128];

    // 1) pelo de atrás (largo, trenzas, cola) y lo que cae detrás de los hombros
    const largos = { largo: 1, trenzas: 1, cola: 1 };
    if (largos[f.peinado] && !f.capucha && clase !== 'guarda' && clase !== 'clerigo') { // con capucha o velo no asoma
      if (f.peinado === 'largo') for (let y = TY + 2; y <= 31; y++) { const w = Math.min(9, 6.5 + (y - TY) * 0.25) - Math.max(0, y - 27) * 0.8; for (let x = Math.floor(CX - w); x <= Math.ceil(CX + w); x++) L.p(x, y, x < CX - 4 ? mx(hebra(x, y, pelo, peloOsc, peloLuz, 13), peloLuz, 0.25) : x > CX + 4 ? mx(hebra(x, y, pelo, peloOsc, peloLuz, 13), peloOsc, 0.3) : hebra(x, y, pelo, peloOsc, peloLuz, 13)); }
      if (f.peinado === 'cola') for (let y = TY + 4; y <= 29; y++) { const x0 = Math.round(CX + 7 + Math.sin(y / 3) * 0.8); L.r(x0, y, 3, 1, y % 3 === 0 ? peloOsc : pelo); }
    }

    // 2) cuerpo y ropa (hasta abajo)
    for (let y = 25; y < N; y++) {
      const w = y < 28 ? 6 + (y - 25) * 2.4 : Math.min(15.5, 13 + (y - 28) * 0.8);
      for (let x = Math.floor(CX - w); x <= Math.ceil(CX + w); x++) {
        const d = (x + 0.5 - CX) / w;
        L.p(x, y, d < -0.7 ? telaLuz : d > 0.55 ? telaOsc : tela);
      }
    }
    // cuello
    for (let y = CY - 2; y <= 28; y++) for (let x = 15; x <= 20; x++) L.p(x, y, sh(piel, x >= 19 ? 0.7 : 0.82));
    ropa(L, clase, f, { tela, telaOsc, telaLuz, oro, oroOsc, acero, aceroOsc, piel, rng });

    // 3) orejas y cara
    const ey = TY + 8; // fila de los ojos
    for (const s of [-1, 1]) {
      const w = anchoEn(ey), xe = s < 0 ? Math.floor(CX - w) - 1 : Math.ceil(CX + w);
      L.r(xe, ey - 1, 1, 4, sh(piel, s < 0 ? 0.95 : 0.78)); L.p(xe, ey + 0, sh(piel, 0.7));
      if (f.pendiente) { L.p(xe, ey + 3, oro); L.p(xe, ey + 4, [255, 236, 150]); }
    }
    for (let y = TY; y <= CY; y++) for (let x = 0; x < N; x++) {
      if (!enCara(x, y)) continue;
      const d = (x + 0.5 - CX) / anchoEn(y);
      let k = d > 0.8 ? 0.74 : d > 0.5 ? 0.86 : d < -0.72 ? 1.06 : 1;
      if (y >= CY - 1) k *= 0.88;
      L.p(x, y, sh(piel, k));
    }
    // mejillas, sombra bajo la nariz y la barbilla
    for (const s of [-1, 1]) { L.m(Math.round(CX + s * 4.5 - 0.5), ey + 3, [230, 110, 100], f.mujer ? 0.28 : 0.14); L.m(Math.round(CX + s * 4.5 - 0.5 + s), ey + 3, [230, 110, 100], f.mujer ? 0.18 : 0.08); }

    // 4) ojos
    const ojo = (s) => {
      const xs = s < 0 ? [13, 14, 15] : [22, 21, 20]; // de afuera hacia adentro
      const pest = f.mujer ? [30, 20, 18] : sh(piel, 0.42), bl = [246, 244, 236];
      if (f.parpado) { L.r(Math.min(...xs), ey, 3, 1, pest); L.r(Math.min(...xs), ey - 1, 3, 1, sh(piel, 0.86)); return; } // parpadeo
      if (f.ojos === 'feliz') { L.p(xs[1], ey - 1, pest); L.p(xs[0], ey, pest); L.p(xs[2], ey, pest); return; }
      if (f.ojos === 'entornado') { L.r(Math.min(...xs), ey - 1, 3, 1, sh(piel, 0.8)); L.p(xs[0], ey, pest); L.p(xs[1], ey, f.iris); L.p(xs[2], ey, sh(f.iris, 0.7)); return; }
      L.r(Math.min(...xs), ey - 1, 3, 1, pest); // párpado
      L.p(xs[0], ey, bl); L.p(xs[1], ey, f.iris); L.p(xs[2], ey, sh(f.iris, 0.55));
      if (f.ojos === 'grande') { L.p(xs[0], ey + 1, sh(bl, 0.88)); L.p(xs[1], ey + 1, sh(f.iris, 0.8)); L.p(xs[2], ey + 1, bl); }
      if (f.mujer) L.p(s < 0 ? 12 : 23, ey - 1, pest);
      if (f.edad === 'viejo') L.r(Math.min(...xs), ey + (f.ojos === 'grande' ? 2 : 1), 3, 1, sh(piel, 0.86));
    };
    ojo(-1); ojo(1);
    // 5) cejas
    const cc = f.edad === 'viejo' ? mx(pelo, [230, 230, 230], 0.4) : sh(pelo, 0.8);
    for (const s of [-1, 1]) {
      const xs = s < 0 ? [13, 14, 15] : [22, 21, 20], b = ey - 3;
      if (f.cejas === 'enojada') { L.p(xs[0], b, cc); L.p(xs[1], b, cc); L.p(xs[2], b + 1, cc); }
      else if (f.cejas === 'alzada') { L.p(xs[0], b + 1, cc); L.p(xs[1], b, cc); L.p(xs[2], b, cc); }
      else if (f.cejas === 'gruesa') { L.r(Math.min(...xs), b, 3, 1, cc); L.p(xs[1], b + 1, cc); L.p(xs[2], b + 1, cc); }
      else L.r(Math.min(...xs), b + 1, 3, 1, cc);
    }
    // 6) nariz
    const nz = ey + 1;
    const lN = f.nariz === 'larga' ? 4 : 3;
    for (let j = 0; j < lN; j++) L.t(18, nz + j - (lN - 3), 0.84);
    L.t(16, nz + 2, 0.78); L.t(19, nz + 2, 0.72); L.m(17, nz + 1, [255, 255, 255], 0.12);
    if (f.nariz === 'ancha') { L.t(15, nz + 2, 0.84); L.t(20, nz + 2, 0.8); }
    if (f.nariz === 'ganchuda') { L.t(18, nz - 1, 0.8); L.t(19, nz, 0.86); }
    // 7) boca
    const by = ey + 5, lab = sh(piel, 0.5), labio = f.mujer ? [184, 70, 78] : sh(piel, 0.72);
    if (f.boca === 'sonrisa') { L.r(16, by, 4, 1, lab); L.p(15, by - 1, lab); L.p(20, by - 1, lab); L.r(17, by + 1, 2, 1, labio); }
    else if (f.boca === 'risa') { L.r(16, by - 1, 4, 1, lab); L.p(15, by - 1, lab); L.p(20, by - 1, lab); L.r(16, by, 4, 1, [250, 246, 238]); L.r(17, by + 1, 2, 1, [170, 60, 60]); }
    else if (f.boca === 'mueca') { L.r(16, by, 3, 1, lab); L.p(19, by - 1, lab); L.r(16, by + 1, 2, 1, labio); }
    else if (f.boca === 'seria') { L.r(16, by, 4, 1, lab); L.r(17, by + 1, 2, 1, sh(piel, 0.82)); }
    else if (f.boca === 'triste') { L.r(16, by - 1, 4, 1, lab); L.p(15, by, lab); L.p(20, by, lab); }
    else { L.r(16, by, 4, 1, lab); L.r(17, by + 1, 2, 1, labio); }
    // 8) edad, pecas, lunar, cicatriz
    if (f.edad === 'viejo') { for (const x of [15, 17, 19]) L.t(x, TY + 3, 0.88); L.t(12, ey, 0.84); L.t(23, ey, 0.84); L.t(15, by - 1, 0.86); L.t(20, by - 1, 0.86); }
    if (f.pecas) for (const [x, y] of [[13, ey + 2], [15, ey + 3], [14, ey + 3], [21, ey + 2], [20, ey + 3], [22, ey + 3]]) L.t(x, y, 0.8);
    if (f.lunar) L.p(rng() < 0.5 ? 14 : 21, by - 1, sh(piel, 0.45));
    if (f.cicatriz) for (let j = 0; j < 6; j++) { L.p(20 + Math.floor(j / 2), ey - 3 + j, mx(sh(piel, 0.7), [200, 90, 90], 0.3)); }

    // 9) barba y bigote
    if (f.barba) barba(L, f, enCara, anchoEn, CY, by, pelo, peloOsc, peloLuz);

    // 10) pelo de arriba (y el de los costados)
    if (!f.capucha) peloArriba(L, f, anchoEn, CY, pelo, peloOsc, peloLuz, rng);
    if (f.peinado === 'trenzas' && !f.capucha) for (const s of [-1, 1]) for (let y = TY + 8; y <= 31; y++) { const x0 = Math.round(CX + s * 7.5) - 1; L.r(x0, y, 2, 1, (y % 3 === 0) ? peloOsc : y % 3 === 1 ? peloLuz : pelo); if (y === 31) L.r(x0, y, 2, 1, [200, 60, 60]); }

    // 11) lo que lleva en la cara
    if (f.parche) { L.r(12, ey - 2, 5, 4, [30, 24, 22]); L.p(13, ey - 1, [60, 50, 46]); for (let i = 0; i < 12; i++) L.p(11 + i, ey - 3 - Math.round(i * 0.45), [40, 30, 26]); }
    if (f.gafas) for (const x0 of [12, 19]) { L.r(x0, ey - 1, 5, 1, [60, 50, 40]); L.r(x0, ey + 1, 5, 1, [60, 50, 40]); L.p(x0, ey, [60, 50, 40]); L.p(x0 + 4, ey, [60, 50, 40]); L.m(x0 + 1, ey, [220, 240, 255], 0.3); }
    if (f.gafas) L.p(17, ey, [60, 50, 40]), L.p(18, ey, [60, 50, 40]);
    if (f.monoculo) { L.r(19, ey - 2, 5, 1, oro); L.r(19, ey + 2, 5, 1, oro); L.r(19, ey - 1, 1, 3, oro); L.r(23, ey - 1, 1, 3, oro); L.m(21, ey, [230, 245, 255], 0.35); for (let j = 0; j < 8; j++) L.p(23 + Math.floor(j / 3), ey + 3 + j, j % 2 ? oroOsc : oro); }

    // 12) lo de la cabeza según la clase (y la corona de la historia)
    sombrero(L, clase, f, { tela, telaOsc, telaLuz, oro, oroOsc, acero, aceroOsc, pelo, peloOsc, anchoEn, rng });
    if (f.corona) { L.r(11, TY - 1, 14, 3, oro); L.r(11, TY + 1, 14, 1, oroOsc); for (const x of [11, 14, 17, 20, 23]) { L.r(x, TY - 3, 2, 2, oro); L.p(x, TY - 4, [255, 236, 150]); } L.p(17, TY, [200, 40, 50]); L.p(13, TY, [60, 120, 230]); L.p(22, TY, [60, 190, 90]); }

    // 13) accesorio del Pase (coordenadas de 24x24 → 36x36)
    if (ao) accesorio(L, ao, cl);

    // 14) contorno oscuro y brillo de borde a la izquierda; después, todo al canvas
    const out = new Array(N * N).fill(null);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (L.fg[i]) {
        const vacioIzq = x === 0 || !L.fg[i - 1], vacioArr = y === 0 || !L.fg[i - N];
        out[i] = (vacioIzq || vacioArr) && y < 30 ? mx(L.fg[i], [255, 250, 230], 0.22) : L.fg[i];
      } else {
        const vec = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < N && yy < N && L.fg[yy * N + xx]; });
        out[i] = vec ? mx(L.bg[i], [14, 8, 6], 0.75) : L.bg[i];
      }
    }
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { const c = out[i] || [0, 0, 0]; img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    // marco fino
    ctx.strokeStyle = ao ? '#f0c850' : 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, N - 1, N - 1);
    R.ultimo = f; // R.rasgos lo lee: la figura del mapa se viste con lo mismo que el retrato
    return cv;
  };

  function barba(L, f, enCara, anchoEn, CY, by, pelo, peloOsc, peloLuz) {
    const tex = (x, y) => { const c = hebra(x, y, pelo, peloOsc, peloLuz, 7); return x < CX - 3 ? mx(c, peloLuz, 0.2) : x > CX + 3 ? mx(c, peloOsc, 0.25) : c; };
    const bigote = () => { L.r(15, by - 1, 6, 1, pelo); L.p(15, by, peloOsc); L.p(20, by, peloOsc); L.p(16, by - 1, peloLuz); };
    if (f.barba === 'rala') { for (let y = by - 2; y <= CY; y++) for (let x = 9; x < 27; x++) { if (!enCara(x, y) || (y === by && x >= 16 && x <= 19)) continue; const d = Math.abs(x + 0.5 - CX) / anchoEn(y); if (y < by && d < 0.6) continue; if (hsh(x, y, 3) < 0.55) L.m(x, y, pelo, 0.3 + hsh(x, y, 4) * 0.25); } return; }
    if (f.barba === 'bigote') { bigote(); return; }
    if (f.barba === 'candado') { bigote(); for (let y = by + 1; y <= CY + 1; y++) for (let x = 16; x <= 19; x++) if (enCara(x, y) || y === CY + 1) L.p(x, y, tex(x, y)); return; }
    // barba completa (y larga): la mandíbula, las patillas y alrededor de la boca
    for (let y = by - 4; y <= CY; y++) for (let x = 9; x < 27; x++) {
      if (!enCara(x, y)) continue;
      const d = Math.abs(x + 0.5 - CX) / anchoEn(y);
      if (y < by - 1 && d < 0.72) continue;  // patillas solo en los bordes
      if (y === by && x >= 16 && x <= 19) continue; // la boca se ve
      L.p(x, y, tex(x, y));
    }
    bigote();
    L.r(16, by, 4, 1, sh(pelo, 0.35));
    const extra = f.barba === 'larga' ? 9 : 2;
    for (let j = 1; j <= extra; j++) { const w = Math.max(1, 4.5 - j * (f.barba === 'larga' ? 0.4 : 1.2)); for (let x = Math.floor(CX - w); x <= Math.ceil(CX + w) - 1; x++) L.p(x, CY + j, tex(x, CY + j)); }
  }

  function peloArriba(L, f, anchoEn, CY, pelo, peloOsc, peloLuz, rng) {
    const pz = f.peinado;
    if (pz === 'calvo') { // pelo a los costados, cabeza brillante
      for (const s of [-1, 1]) for (let y = TY + 6; y <= TY + 10; y++) { const w = anchoEn(y); const x = s < 0 ? Math.floor(CX - w) : Math.ceil(CX + w) - 1; L.p(x, y, pelo); L.p(x - s, y, peloOsc); }
      L.m(14, TY + 1, [255, 255, 255], 0.35); L.m(15, TY + 1, [255, 255, 255], 0.25);
      return;
    }
    // línea del nacimiento del pelo por columna
    const linea = x => {
      const d = (x + 0.5 - CX) / 6.5;
      if (pz === 'flequillo') return Math.abs(d) > 0.85 ? TY + 9 : TY + 5;
      if (pz === 'raya') return d < -0.1 ? TY + 4 + (Math.abs(d) > 0.8 ? 3 : 0) : TY + 2 + (d > 0.8 ? 4 : 0);
      if (pz === 'atras') return TY + 2 + (Math.abs(d) > 0.8 ? 3 : 0);
      if (pz === 'cresta') return TY + 1;
      if (pz === 'largo' || pz === 'trenzas' || pz === 'cola' || pz === 'moño') return TY + 3 + (Math.abs(d) > 0.75 ? 6 : 0);
      return TY + 3 + (Math.abs(d) > 0.8 ? 4 : 0); // corto, punta, rizado
    };
    const vol = pz === 'rizado' ? 3 : pz === 'punta' ? 2 : pz === 'atras' ? 0 : 1;
    for (let x = 6; x < 30; x++) {
      const yl = linea(x);
      for (let y = TY - vol - 1; y < yl; y++) {
        const w = y < TY ? anchoEn(TY) + 1 + (y - TY + vol + 1) * 0.6 : anchoEn(y) + 1;
        if (Math.abs(x + 0.5 - CX) > w) continue;
        if (pz === 'cresta' && Math.abs(x + 0.5 - CX) > 2 && y < TY + 1) continue;
        if (pz === 'punta' && y < TY - 1 && (x % 3 !== 0)) continue;
        if (pz === 'rizado' && y < TY - 1 && rng() < 0.35) continue;
        let c = hebra(x, y, pelo, peloOsc, peloLuz, 11);
        if (y <= TY && x < CX - 1 && hsh(x, y, 5) < 0.7) c = mx(c, peloLuz, 0.6); // la luz de arriba a la izquierda
        if (x > CX + 4) c = mx(c, peloOsc, 0.3);
        if (pz === 'rizado' && hsh(x, y, 6) < 0.3) c = peloLuz;
        L.p(x, y, c);
      }
    }
    if (pz === 'cresta') for (let y = TY - 5; y < TY; y++) L.r(16, y, 3, 1, y % 2 ? pelo : peloLuz);
    if (pz === 'punta') for (const x of [12, 15, 18, 21, 24]) { L.p(x, TY - 3, pelo); L.p(x, TY - 4, peloLuz); }
    if (pz === 'raya') L.p(16, TY, peloLuz);
    if (pz === 'moño') for (let y = TY - 5; y <= TY - 1; y++) { const w = 3 - Math.abs(y - (TY - 3)) * 0.7; for (let x = Math.floor(CX - w); x <= Math.ceil(CX + w) - 1; x++) L.p(x, y, x < CX ? peloLuz : pelo); }
    // mechones a los lados de la cara en los largos
    if (pz === 'largo') for (const s of [-1, 1]) for (let y = TY + 4; y <= TY + 15; y++) { const w = anchoEn(Math.min(y, CY)) || 4; const x = s < 0 ? Math.floor(CX - w) - 1 : Math.ceil(CX + w); L.p(x, y, y % 4 === 0 ? peloOsc : pelo); L.p(x + s, y, pelo); }
  }

  function ropa(L, clase, f, c) {
    const { tela, telaOsc, telaLuz, oro, oroOsc, acero, aceroOsc, piel } = c;
    const brillo = (x, y) => L.m(x, y, [255, 255, 255], 0.35);
    if (clase === 'paladin') {
      L.r(14, 25, 8, 3, acero); L.r(14, 25, 8, 1, mx(acero, [255, 255, 255], 0.4)); L.r(20, 25, 2, 3, aceroOsc); // gola
      for (const s of [-1, 1]) for (let y = 27; y <= 33; y++) { const w = 4.5 - Math.abs(y - 29.5) * 0.5; const cx = CX + s * 10; for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w) - 1; x++) L.p(x, y, y === 27 || x < cx - 2 ? mx(acero, [255, 255, 255], 0.3) : x > cx + 1 ? aceroOsc : acero); L.p(Math.round(cx), 30, oro); }
      L.r(12, 29, 12, 7, tela); L.r(12, 29, 12, 1, oro); L.r(12, 29, 1, 7, oro); L.r(23, 29, 1, 7, oro);
      L.r(17, 30, 2, 5, [250, 246, 236]); L.r(15, 32, 6, 1, [250, 246, 236]); // la cruz
    } else if (clase === 'guarda') {
      for (let y = 27; y < N; y++) for (let x = 13; x <= 22; x++) L.p(x, y, x > 20 ? [86, 58, 36] : [118, 82, 50]);
      for (let y = 25; y < N; y++) for (let x = 3; x < 33; x++) { const d = Math.abs(x + 0.5 - CX); if (d > 5 + (y - 25) * 0.4 && L.g(x, y)) L.p(x, y, x > CX + 6 ? telaOsc : x < CX - 8 ? telaLuz : tela); }
      for (let j = 0; j < 12; j++) L.p(9 + j, 27 + Math.round(j * 0.75), [70, 44, 26]); // correa del carcaj
      L.r(17, 27, 2, 2, [150, 210, 90]); L.p(17, 27, [210, 250, 160]); // broche de hoja
      L.r(25, 26, 2, 3, [90, 60, 36]); L.p(25, 25, [220, 220, 200]); L.p(26, 25, [200, 70, 60]); // plumas de las flechas
    } else if (clase === 'clerigo') {
      for (let y = 25; y < N; y++) for (let x = 2; x < 34; x++) if (L.g(x, y)) L.p(x, y, mx(L.g(x, y), [238, 232, 214], 0.85));
      for (let y = 26; y < N; y++) { L.p(Math.round(CX - 3 - (y - 26) * 0.4), y, oro); L.p(Math.round(CX + 2 + (y - 26) * 0.4), y, oro); }
      L.r(16, 30, 4, 4, oro); L.r(17, 29, 2, 6, oro); L.r(15, 31, 6, 2, oro); L.p(17, 31, [255, 250, 200]); L.p(18, 32, oroOsc); // el sol
    } else if (clase === 'ingeniera') {
      for (let y = 26; y < N; y++) for (let x = 3; x < 33; x++) if (L.g(x, y)) L.p(x, y, x > 25 ? [180, 160, 130] : [222, 204, 170]);
      L.r(12, 29, 12, 7, [128, 84, 46]); L.r(12, 29, 12, 1, [160, 110, 64]); L.r(14, 26, 2, 3, [110, 70, 40]); L.r(20, 26, 2, 3, [110, 70, 40]); // delantal
      L.r(15, 25, 6, 2, tela); L.r(15, 25, 6, 1, telaLuz); // pañuelo
      L.r(19, 31, 1, 4, acero); L.r(18, 30, 3, 1, acero); L.p(18, 34, aceroOsc); // llave
      L.r(14, 32, 2, 2, [200, 160, 90]);
    } else if (clase === 'hechicero') {
      for (let y = 26; y < N; y++) { const w = (y - 26) * 0.7 + 1; L.r(Math.round(CX - w), y, Math.round(w * 2), 1, telaOsc); L.p(Math.round(CX - w) - 1, y, oro); L.p(Math.round(CX + w), y, oro); }
      for (const [x, y] of [[8, 30], [27, 31], [11, 34], [25, 34]]) { L.p(x, y, [255, 236, 150]); L.m(x + 1, y, [255, 236, 150], 0.4); }
      L.p(17, 31, [140, 230, 255]); L.p(18, 31, [90, 180, 230]); // gema del broche
    } else if (clase === 'juglar') {
      for (let y = 27; y < N; y++) for (let x = 3; x < 33; x++) if (L.g(x, y)) { const franja = Math.floor((x + 1) / 3) % 2; L.p(x, y, franja ? (x > 24 ? oroOsc : oro) : (x > 24 ? telaOsc : tela)); }
      for (let x = 11; x <= 24; x++) { L.p(x, 26, x % 2 ? [250, 248, 240] : [220, 216, 206]); L.p(x, 27, x % 2 ? [220, 216, 206] : [250, 248, 240]); } // gorguera
      for (let j = 0; j < 10; j++) L.p(26 - Math.floor(j / 3), 26 + j, [140, 90, 50]); // mástil del laúd
      L.r(24, 25, 3, 2, [100, 60, 30]);
    } else if (clase === 'corsaria') {
      for (let y = 26; y < N; y++) { const w = Math.max(0, 3.5 - (y - 26) * 0.3); L.r(Math.round(CX - w), y, Math.round(w * 2), 1, [244, 240, 230]); }
      L.r(16, 27, 4, 2, sh(piel, 0.9));
      for (const y of [29, 32, 35]) { L.p(13, y, oro); L.p(22, y, oro); }
      for (let y = 26; y < N; y++) { L.p(Math.round(CX - 4 - (y - 26) * 0.5), y, oro); L.p(Math.round(CX + 3 + (y - 26) * 0.5), y, oro); }
    }
    brillo(6, 31);
  }

  function sombrero(L, clase, f, c) {
    const { tela, telaOsc, telaLuz, oro, oroOsc, acero, aceroOsc, anchoEn, rng } = c;
    if (f.corona) return;
    if (!f.sombrero && !f.capucha) return;
    if (clase === 'paladin') {
      if (!f.casco) { L.r(11, TY + 2, 14, 1, oro); L.p(17, TY + 2, [220, 40, 60]); L.p(18, TY + 2, [255, 120, 140]); return; }
      for (let y = TY - 3; y <= TY + 4; y++) { const w = y < TY ? 5 + (y - TY + 3) * 0.7 : anchoEn(TY) + 1.5; for (let x = Math.floor(CX - w); x <= Math.ceil(CX + w) - 1; x++) L.p(x, y, x < CX - 3 ? mx(acero, [255, 255, 255], 0.35) : x > CX + 3 ? aceroOsc : acero); }
      L.r(10, TY + 4, 16, 1, oro);
      for (const s of [-1, 1]) for (let y = TY + 5; y <= TY + 13; y++) { const w = anchoEn(y); const x = s < 0 ? Math.floor(CX - w) - 1 : Math.ceil(CX + w) - 1; L.r(s < 0 ? x : x - 1, y, 2, 1, s < 0 ? acero : aceroOsc); }
      for (let y = TY - 7; y < TY - 2; y++) L.r(16 + Math.floor((y - TY + 7) / 3), y, 3, 1, y % 2 ? [200, 40, 50] : [240, 80, 80]); // penacho
      return;
    }
    if (clase === 'guarda' || f.capucha) {
      const col = f.capucha && clase !== 'guarda' ? sh(tela, 0.7) : tela;
      for (let y = TY - 3; y <= 27; y++) for (let x = 4; x < 32; x++) {
        const w = y < TY ? 4.5 + (y - TY + 3) * 1.2 : y <= TY + 15 ? (anchoEn(Math.min(y, TY + 15)) || 5) + 2.5 : 9 + (y - TY - 15) * 1.2;
        const dx = Math.abs(x + 0.5 - CX);
        if (dx > w) continue;
        const cara = y >= TY + 2 && dx < (anchoEn(y) || 0) - 0.5 && y <= TY + 17;
        if (cara) continue;
        L.p(x, y, x < CX - 5 ? mx(col, [255, 255, 255], 0.2) : x > CX + 5 ? sh(col, 0.65) : col);
      }
      for (let x = 11; x < 25; x++) L.t(x, TY + 2, 0.7); // sombra del borde de la capucha
      if (f.capucha) for (let x = 12; x < 24; x++) L.t(x, TY + 3, 0.65);
      return;
    }
    if (clase === 'clerigo') {
      const bl = [244, 240, 228];
      for (let y = TY - 2; y <= 28; y++) for (let x = 4; x < 32; x++) {
        const w = y < TY ? 5 + (y - TY + 2) * 1.2 : y <= TY + 15 ? (anchoEn(Math.min(y, TY + 15)) || 5) + 2 : 9 + (y - TY - 15);
        const dx = Math.abs(x + 0.5 - CX);
        if (dx > w || (y >= TY + 2 && dx < (anchoEn(y) || 0) - 0.5 && y <= TY + 17)) continue;
        L.p(x, y, x > CX + 5 ? [206, 200, 186] : bl);
      }
      L.r(11, TY + 1, 14, 1, oro); L.p(17, TY + 1, [255, 250, 200]); L.p(18, TY, [255, 236, 120]);
      return;
    }
    if (clase === 'ingeniera') {
      L.r(10, TY + 3, 16, 1, [80, 54, 34]);
      for (const x0 of [12, 19]) { L.r(x0, TY + 1, 5, 4, [168, 124, 60]); L.r(x0 + 1, TY + 2, 3, 2, [110, 190, 220]); L.p(x0 + 1, TY + 2, [220, 250, 255]); }
      return;
    }
    if (clase === 'hechicero') {
      L.r(5, TY + 1, 26, 2, telaOsc); L.r(5, TY + 1, 26, 1, tela);
      for (let y = TY - 8; y <= TY; y++) { const w = Math.max(0.5, (y - TY + 8) * 0.75); const cx = CX + (TY - y) * 0.45; for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w) - 1; x++) L.p(x, y, x < cx - 1 ? telaLuz : x > cx + 1 ? telaOsc : tela); }
      L.r(11, TY - 1, 14, 1, oro);
      L.p(19, TY - 4, [255, 236, 150]); L.p(18, TY - 4, [255, 220, 120]); L.p(19, TY - 5, [255, 250, 210]); // estrella
      return;
    }
    if (clase === 'juglar') {
      for (let y = TY - 3; y <= TY + 2; y++) { const w = 8 - Math.abs(y - TY + 0.5) * 0.9; const cx = CX + 1.5; for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w) - 1; x++) L.p(x, y, x < cx - 4 ? telaLuz : x > cx + 4 ? telaOsc : tela); }
      L.r(10, TY + 2, 17, 1, oro);
      for (let j = 0; j < 9; j++) { L.p(26 + Math.floor(j / 3), TY - 1 - j, j < 3 ? [240, 240, 240] : [255, 255, 255]); L.p(25 + Math.floor(j / 3), TY - j, [220, 220, 220]); } // pluma
      return;
    }
    if (clase === 'corsaria') {
      f.tricornio = rng() < 0.5; // (la misma tirada de siempre: no cambia ningún retrato)
      if (f.tricornio) { // tricornio
        L.r(6, TY + 1, 24, 2, [40, 32, 28]); L.r(6, TY + 2, 24, 1, oro);
        for (let y = TY - 3; y <= TY + 1; y++) { const w = 7 - (TY + 1 - y) * 0.6; L.r(Math.round(CX - w), y, Math.round(w * 2), 1, y === TY - 3 ? [64, 54, 48] : [44, 36, 32]); }
        L.p(17, TY - 1, [240, 240, 240]); L.p(18, TY - 2, [240, 240, 240]);
      } else { // pañuelo
        for (let y = TY - 1; y <= TY + 3; y++) { const w = anchoEn(Math.max(TY, y)) + 1; L.r(Math.round(CX - w), y, Math.round(w * 2), 1, y % 2 ? [190, 40, 46] : [220, 60, 60]); }
        L.r(25, TY + 3, 3, 2, [190, 40, 46]); L.r(27, TY + 5, 2, 3, [170, 34, 40]);
        for (const x of [13, 17, 21]) L.p(x, TY + 1, [250, 240, 230]);
      }
    }
  }

  // Los accesorios del Pase del Reino: el dibujo de siempre (24x24), escalado a la cabeza nueva.
  function accesorio(L, ao, cl) {
    const A = ao.o.acc, oro = '#f0c850';
    const hex = s => { if (Array.isArray(s)) return s; const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s); if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]; const q = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s); return q ? [+q[1], +q[2], +q[3]] : [255, 255, 255]; };
    const css = (a, k) => sh(a, k === undefined ? 1 : k);
    const r = (a, b, w, h, col) => { const x0 = Math.round(a * 1.5 - 0.5), y0 = Math.round(b * 1.5 + 0.5), x1 = Math.round((a + w) * 1.5 - 0.5), y1 = Math.round((b + h) * 1.5 + 0.5); L.r(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0), hex(col)); };
    if (A === 'cuernos') { r(6, 1, 2, 4, '#e8dcc0'); r(16, 1, 2, 4, '#e8dcc0'); r(5, 0, 1, 2, '#e8dcc0'); r(18, 0, 1, 2, '#e8dcc0'); }
    else if (A === 'tricornio') { r(5, 3, 14, 3, '#2a2420'); r(8, 1, 8, 2, '#2a2420'); r(5, 5, 14, 1, oro); r(11, 2, 2, 1, '#e8e8e8'); }
    else if (A === 'tiara') { r(8, 4, 8, 1, '#dff4ff'); r(9, 2, 1, 2, '#bfe6ff'); r(12, 1, 1, 3, '#ffffff'); r(15, 2, 1, 2, '#bfe6ff'); }
    else if (A === 'capucha') { r(5, 3, 14, 5, css(cl.col, 0.6)); r(4, 6, 3, 12, css(cl.col, 0.55)); r(17, 6, 3, 12, css(cl.col, 0.55)); r(10, 9, 1, 1, '#7aff8a'); r(14, 9, 1, 1, '#7aff8a'); }
    else if (A === 'sombrero') { r(6, 3, 12, 3, css(cl.col)); r(4, 5, 16, 1, css(cl.col, 0.8)); r(14, 0, 4, 3, '#f0f0f0'); }
    else if (A === 'estrellas') { for (const [a, b] of [[4, 2], [19, 3], [2, 9], [21, 11], [12, 0]]) r(a, b, 1, 1, '#fff6c0'); }
    else if (A === 'paja') { r(5, 4, 14, 2, '#e8c870'); r(8, 2, 8, 2, '#d8b860'); r(8, 3, 8, 1, '#a05030'); }
    else if (A === 'hojas') { for (let i = 0; i < 6; i++) r(6 + i * 2, 3 + (i % 2), 2, 2, i % 2 ? '#5a9a40' : '#78b450'); }
    else if (A === 'flores') { for (const [a, b, c] of [[6, 4, '#ffb0d0'], [9, 3, '#fff0f6'], [12, 3, '#ff80b0'], [15, 4, '#ffd0e4'], [17, 6, '#ff9cc4']]) { r(a, b, 2, 2, c); r(a, b, 1, 1, '#ffe27a'); } }
    else if (A === 'conchas') { r(6, 4, 12, 1, '#e8f4f0'); for (const a of [7, 11, 15]) { r(a, 2, 2, 2, '#f0b8a8'); r(a, 2, 1, 1, '#fff0e8'); } }
    else if (A === 'diadema_sol') { r(7, 4, 10, 1, oro); for (const [a, b, h2] of [[8, 2, 2], [10, 1, 3], [12, 0, 4], [14, 1, 3], [16, 2, 2]]) r(a, b, 1, h2, '#ffd040'); }
    else if (A === 'luna') { r(15, 0, 3, 1, '#e8ecff'); r(17, 1, 2, 3, '#e8ecff'); r(15, 4, 3, 1, '#e8ecff'); r(16, 1, 1, 1, '#b8c0e8'); r(7, 4, 8, 1, '#c8d0f0'); }
    else if (A === 'llamas') { for (const [a, h2] of [[7, 3], [9, 5], [11, 4], [13, 6], [15, 3], [17, 4]]) { r(a, 6 - h2, 2, h2, '#ff7a30'); r(a, 6 - Math.ceil(h2 / 2), 1, Math.ceil(h2 / 2), '#ffd040'); } }
    else if (A === 'cuernos_ciervo') { r(6, 1, 1, 5, '#8a6440'); r(4, 2, 2, 1, '#8a6440'); r(5, 0, 1, 2, '#8a6440'); r(17, 1, 1, 5, '#8a6440'); r(18, 2, 2, 1, '#8a6440'); r(18, 0, 1, 2, '#8a6440'); }
    else if (A === 'turbante') { r(6, 3, 12, 4, '#f0e4c8'); r(6, 4, 12, 1, '#d8c8a0'); r(11, 4, 2, 2, '#c03040'); r(11, 3, 2, 1, '#ffe27a'); }
    else if (A === 'yelmo_alado') { r(7, 3, 10, 4, '#a8b0bc'); r(7, 6, 10, 1, '#7a8290'); r(3, 2, 4, 2, '#f4f0e4'); r(4, 1, 2, 1, '#f4f0e4'); r(17, 2, 4, 2, '#f4f0e4'); r(18, 1, 2, 1, '#f4f0e4'); }
    else if (A === 'antifaz') { r(7, 9, 10, 3, css(cl.col)); r(9, 10, 2, 1, '#1a1410'); r(13, 10, 2, 1, '#1a1410'); r(17, 7, 3, 1, '#ffe27a'); r(19, 5, 1, 3, '#ff60e0'); }
    else if (A === 'cristales') { for (const [a, h2] of [[8, 3], [11, 5], [14, 3]]) { r(a, 5 - h2, 2, h2, '#bfe6ff'); r(a, 5 - h2, 1, h2, '#ffffff'); } r(7, 5, 10, 1, '#88c8f0'); }
    else if (A === 'corona') { r(7, 3, 10, 2, oro); for (const a of [7, 10, 13, 16]) r(a, 1, 1, 2, oro); r(11, 3, 2, 1, '#c03040'); r(8, 3, 1, 1, '#4080ff'); r(15, 3, 1, 1, '#40c060'); }
    else if (A === 'kasa') { r(4, 4, 16, 2, '#d8b870'); r(7, 2, 10, 2, '#c8a860'); r(10, 1, 4, 1, '#b89850'); r(4, 5, 16, 1, '#8a6a30'); }
    else if (A === 'rayos') { for (const [a, b] of [[5, 1], [18, 2]]) { r(a, b, 2, 1, '#fff6a0'); r(a + 1, b + 1, 1, 2, '#fff6a0'); r(a, b + 3, 2, 1, '#fff6a0'); } r(7, 4, 10, 1, '#6a7aa8'); }
    else if (A === 'plumas') { r(6, 4, 12, 2, css(cl.col, 0.8)); r(15, 0, 1, 4, '#40c0a0'); r(16, 1, 1, 4, '#f0c040'); r(17, 0, 1, 3, '#e05050'); }
    else if (A === 'tentaculos') { r(5, 3, 14, 3, '#1e4050'); for (const a of [4, 7, 16, 19]) r(a, 5, 1, 6, '#2a6a78'); r(10, 2, 1, 1, '#7aff8a'); r(13, 2, 1, 1, '#7aff8a'); }
    else if (A === 'bufanda') { r(6, 4, 12, 3, css(cl.col)); r(6, 18, 12, 2, '#c05030'); r(15, 18, 2, 5, '#c05030'); r(6, 18, 12, 1, '#e08050'); }
    else if (A === 'casco_piedra') { r(6, 2, 12, 5, '#8a8478'); r(6, 2, 12, 1, '#a8a294'); r(8, 4, 1, 1, '#6a645a'); r(14, 3, 2, 1, '#6a645a'); r(11, 6, 2, 5, '#7a746a'); }
    else if (A === 'gorro') { r(7, 3, 10, 3, '#c83040'); r(13, 1, 4, 2, '#c83040'); r(17, 2, 2, 2, '#ffffff'); r(6, 5, 12, 2, '#f4f0ec'); }
  }
})();
