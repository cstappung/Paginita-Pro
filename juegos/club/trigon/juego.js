/* Trigon — la pantalla.
   Todo lo que decide una partida está en motor.js (el tablero, las piezas de
   cada tanda y las líneas que se borran); aquí solo se dibuja, se arrastra,
   se suena y se lleva la cuenta. El tablero es un SVG: cada triángulo es un
   <polygon> con su color, y la pieza que se arrastra es otro SVG fijo a la
   ventana, a la misma escala que el tablero, que se imanta a la posición
   válida más cercana. */
(() => {
  'use strict';
  const M = window.TrigonMotor, Club = window.Club;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  // El color de cada forma lo pone el tema (temas.css, --p1…--p8): aquí solo se apunta a la variable.
  const color = v => 'var(--p' + v + ')';
  const ENCOGE = 0.86;

  /* ---------- Guardado: por ahora solo el récord, en este navegador ---------- */
  const CUENTA = Club && Club.storageKey ? Club.storageKey('').replace(/^\.cuenta\./, '') : 'local';
  const clave = k => Club && Club.storageKey ? Club.storageKey(k) : k + '.cuenta.local';
  function lee(k) { try { return JSON.parse(localStorage.getItem(clave(k)) || 'null'); } catch (_) { return null; } }
  function guarda(k, v) { try { localStorage.setItem(clave(k), JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } }
  const prog = Object.assign({ mejor: 0, partidas: 0 }, lee('trigon.datos'));

  let E = null, terminada = false, kb = null;
  const CAT = 'club-trigon-puntos';
  const VIGENCIA = 24 * 3600 * 1000;

  /* ---------- Sonido ---------- */
  let ac = null, mudo = false;
  try { mudo = localStorage.getItem('trigon.mudo') === '1'; } catch (_) { /* nada */ }
  function audio() {
    if (mudo) return null;
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
    } catch (_) { return null; }
    return ac;
  }
  function tono(f, t0, dur, tipo, vol) {
    const c = audio(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const sonidos = {
    toma: () => tono(660, 0, 0.06, 'sine', 0.05),
    pone: () => { tono(220, 0, 0.09, 'triangle', 0.14); tono(440, 0.01, 0.05, 'sine', 0.04); },
    vuelve: () => tono(180, 0, 0.1, 'sine', 0.06),
    borra: n => [0, 4, 7, 12, 16, 19].slice(0, n + 2).forEach((s, i) => tono(523.25 * 2 ** (s / 12), i * 0.06, 0.3, 'triangle', 0.11)),
    fin: () => [7, 4, 0, -5].forEach((s, i) => tono(392 * 2 ** (s / 12), i * 0.12, 0.35, 'sine', 0.1)),
  };
  function pintaSonido() {
    const b = $('sound-button');
    b.setAttribute('aria-pressed', mudo ? 'false' : 'true');
    b.setAttribute('aria-label', mudo ? 'Activar efectos' : 'Desactivar efectos');
  }
  $('sound-button').addEventListener('click', () => {
    mudo = !mudo;
    try { localStorage.setItem('trigon.mudo', mudo ? '1' : '0'); } catch (_) { /* nada */ }
    pintaSonido(); if (!mudo) sonidos.pone();
  });
  pintaSonido();

  /* ---------- Geometría en pantalla ---------- */
  const PAD = 0.3;
  const VB = { x: -M.LADO - PAD, y: -M.LADO * M.H - PAD, w: 2 * (M.LADO + PAD), h: 2 * (M.LADO * M.H + PAD) };

  // Los puntos de un triángulo en el plano, encogidos hacia su centro para dejar la junta.
  function puntos(x, y, d, k) {
    const v = M.vertices(x, y, d).map(([a, b]) => M.plano(a, b));
    const cx = (v[0][0] + v[1][0] + v[2][0]) / 3, cy = (v[0][1] + v[1][1] + v[2][1]) / 3;
    return v.map(([a, b]) => (cx + (a - cx) * k).toFixed(4) + ',' + (cy + (b - cy) * k).toFixed(4)).join(' ');
  }
  function poligono(padre, x, y, d, clase) {
    const p = document.createElementNS(NS, 'polygon');
    p.setAttribute('points', puntos(x, y, d, ENCOGE));
    if (clase) p.setAttribute('class', clase);
    padre.appendChild(p);
    return p;
  }
  // La caja de una pieza en el plano, contando sus vértices.
  function caja(celdas) {
    const v = celdas.flatMap(([x, y, d]) => M.vertices(x, y, d).map(([a, b]) => M.plano(a, b)));
    const xs = v.map(p => p[0]), ys = v.map(p => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
  }
  function dibujaPieza(svg, p, margen) {
    svg.replaceChildren();
    const celdas = M.celdasDe(p), b = caja(celdas);
    svg.setAttribute('viewBox', [b.x - margen, b.y - margen, b.w + 2 * margen, b.h + 2 * margen].map(n => n.toFixed(4)).join(' '));
    svg.style.setProperty('--color', color(p.f + 1));
    for (const [x, y, d] of celdas) poligono(svg, x, y, d, 'pieza');
    return b;
  }

  /* ---------- El tablero ---------- */
  const tablero = $('tablero');
  tablero.setAttribute('viewBox', [VB.x, VB.y, VB.w, VB.h].map(n => n.toFixed(4)).join(' '));
  $('escenario').style.aspectRatio = (VB.w / VB.h).toFixed(4);
  const capaCeldas = document.createElementNS(NS, 'g'), capaEfectos = document.createElementNS(NS, 'g');
  tablero.append(capaCeldas, capaEfectos);
  const celdas = M.CELDAS.map(c => poligono(capaCeldas, c.x, c.y, c.d, 'celda'));

  function pintaTablero() {
    M.CELDAS.forEach((_, i) => {
      const v = E.t[i];
      celdas[i].classList.toggle('llena', !!v);
      celdas[i].style.setProperty('--color', v ? color(v) : '');
      celdas[i].classList.remove('fantasma', 'cierra', 'invalida');
    });
  }
  function estalla(casillas, valores) {
    const arcoiris = raiz.dataset.skin === 'gris';
    casillas.forEach((i, k) => {
      const c = M.CELDAS[i], p = poligono(capaEfectos, c.x, c.y, c.d, 'estalla');
      p.style.setProperty('--color', arcoiris ? 'hsl(' + (k * 47 % 360) + ' 85% 60%)' : valores[k] ? color(valores[k]) : 'var(--tinta)');
      p.style.animationDelay = (k % 12) * 12 + 'ms';
      setTimeout(() => p.remove(), 700);
    });
  }

  /* ---------- Celebraciones por tema ----------
     Al cerrar líneas, cada tema suelta lo suyo sobre el tablero, en una capa
     de DOM encima del SVG: Halloween, calabazas, murciélagos y vampiros;
     Espacio, un cohete por línea; Forest, luciérnagas; Gris, una onda (sus
     triángulos además estallan en arcoíris, en `estalla`). Clásico se queda
     con el estallido de siempre. */
  const efectos = $('efectos');
  const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)');
  const azar = (a, b) => a + Math.random() * (b - a);
  // El centro de una línea, en % del tablero.
  function centroDe(j) {
    let sx = 0, sy = 0;
    for (const i of M.LINEAS[j]) {
      const c = M.CELDAS[i];
      for (const [a, b] of M.vertices(c.x, c.y, c.d)) { const [px, py] = M.plano(a, b); sx += px; sy += py; }
    }
    const n = M.LINEAS[j].length * 3;
    return { x: (sx / n - VB.x) / VB.w * 100, y: (sy / n - VB.y) / VB.h * 100 };
  }
  function suelta_efecto(clase, x, y, texto, dura, props) {
    const el = document.createElement('span');
    el.className = 'fx ' + clase;
    el.style.left = x + '%'; el.style.top = y + '%';
    if (texto) el.textContent = texto;
    for (const [k, v] of Object.entries(props || {})) el.style.setProperty(k, v);
    efectos.appendChild(el);
    setTimeout(() => el.remove(), dura);
  }
  const CELEBRACIONES = {
    halloween(centros) {
      const caras = ['🎃', '🦇', '🧛', '🎃', '👻'];
      centros.forEach((c, k) => {
        for (let n = 0; n < 2; n++)
          suelta_efecto('fx-susto', c.x + azar(-14, 14), c.y, caras[Math.floor(Math.random() * caras.length)], 1500,
            { '--dx': azar(-40, 40) + 'px', 'animation-delay': (k * 120 + n * 160) + 'ms' });
      });
      if (centros.length >= 2)
        for (let n = 0; n < 5; n++) suelta_efecto('fx-bandada', -10, azar(10, 60), '🦇', 2200, { 'animation-delay': n * 90 + 'ms' });
    },
    espacio(centros) {
      centros.forEach((c, k) => {
        suelta_efecto('fx-cohete', c.x, c.y, '🚀', 1400, { 'animation-delay': k * 180 + 'ms' });
        for (let n = 0; n < 4; n++)
          suelta_efecto('fx-chispa', c.x + azar(-12, 12), c.y + azar(-6, 6), '✨', 900, { 'animation-delay': (k * 180 + n * 60) + 'ms' });
      });
    },
    forest(centros) {
      centros.forEach((c, k) => {
        for (let n = 0; n < 9; n++)
          suelta_efecto('fx-luciernaga', c.x + azar(-22, 22), c.y + azar(-6, 6), '', 2200,
            { '--dx': azar(-30, 30) + 'px', '--dy': azar(-90, -40) + 'px', 'animation-delay': (k * 100 + n * 70) + 'ms' });
      });
    },
    gris(centros) {
      centros.forEach((c, k) => suelta_efecto('fx-onda', c.x, c.y, '', 900, { 'animation-delay': k * 90 + 'ms' }));
    }
  };
  function celebra(lineas) {
    const f = CELEBRACIONES[raiz.dataset.skin];
    if (!f || sinMovimiento.matches || !lineas.length) return;
    f(lineas.slice(0, 4).map(centroDe));
  }

  /* ---------- La mano ---------- */
  const mano = $('mano');
  const ranuras = [];
  for (let s = 0; s < M.MANO; s++) {
    const r = document.createElement('div');
    r.className = 'ranura';
    const svg = document.createElementNS(NS, 'svg');
    r.appendChild(svg);
    mano.appendChild(r);
    r.addEventListener('pointerdown', e => toma(e, s));
    ranuras.push({ r, svg });
  }
  function pintaMano(llega) {
    E.mano.forEach((p, s) => {
      const { r, svg } = ranuras[s];
      r.classList.toggle('elegida', !!kb && kb.s === s);
      if (llega && p) { r.classList.remove('llega'); void r.offsetWidth; r.style.animationDelay = s * 70 + 'ms'; r.classList.add('llega'); }
      r.classList.toggle('vacia', !p);
      r.classList.toggle('no-cabe', !!p && !M.cabe(E, p));
      if (p) dibujaPieza(svg, p, 0.6); else svg.replaceChildren();
      // Todas a la misma escala: el viewBox fija cuántas unidades caben en la ranura.
      if (p) {
        const b = caja(M.celdasDe(p)), lado = 4.2;
        svg.setAttribute('viewBox', [b.x + b.w / 2 - lado / 2, b.y + b.h / 2 - lado / 2, lado, lado].map(n => n.toFixed(4)).join(' '));
      }
    });
  }

  function pintaMarcador() {
    $('nPuntos').textContent = String(E ? E.puntos : 0);
    $('nMejor').textContent = String(Math.max(prog.mejor, E ? E.puntos : 0));
    $('nLineas').textContent = String(E ? E.lineas : 0);
  }
  function popSuma(n) {
    const p = $('popSuma');
    p.textContent = '+' + n;
    p.classList.remove('sube'); void p.offsetWidth; p.classList.add('sube');
  }
  // El fantasma de una pieza en (dx, dy): con su color si cabe, en rojo si cae sobre fichas.
  function pintaFantasma(p, dx, dy) {
    pintaTablero();
    const libres = M.destino(E, p, dx, dy);
    if (libres) {
      for (const i of libres) { celdas[i].classList.add('fantasma'); celdas[i].style.setProperty('--color', color(p.f + 1)); }
      for (const j of M.lineasQueCierra(E, libres)) for (const i of M.LINEAS[j]) celdas[i].classList.add('cierra');
      return true;
    }
    for (const i of M.cubre(p, dx, dy) || []) celdas[i].classList.add('invalida');
    return false;
  }
  function muestraRacha(lineas, racha) {
    const b = $('racha');
    b.textContent = (lineas > 1 ? lineas + ' LÍNEAS' : '¡LÍNEA!') + (racha > 1 ? ' · BONO ×' + racha : '');
    b.classList.remove('sube'); void b.offsetWidth; b.classList.add('sube');
  }

  /* ---------- Arrastrar ---------- */
  const flota = $('arrastre');
  let arr = null, volviendo = false;
  const tactil = matchMedia('(pointer:coarse)').matches;
  const enMenu = () => !$('menu').hidden || !$('fin').hidden || !$('temas').hidden;

  function toma(e, s) {
    if (!E || terminada || arr || volviendo || enMenu() || e.button > 0) return;
    const p = E.mano[s];
    if (!p) return;
    e.preventDefault();
    suelta_teclado();
    const b = dibujaPieza(flota, p, 0.15);
    const px = tablero.getBoundingClientRect().width / VB.w;
    flota.style.width = (b.w + 0.3) * px + 'px';
    flota.style.height = (b.h + 0.3) * px + 'px';
    flota.style.transition = 'none';
    flota.removeAttribute('hidden');
    arr = { s, p, b, px, id: e.pointerId, dx: 0, dy: 0, valida: false, alzado: tactil || e.pointerType === 'touch' ? 1.6 : 0.4 };
    ranuras[s].r.classList.add('levantada');
    try { ranuras[s].r.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
    sonidos.toma();
    mueve(e);
  }

  function mueve(e) {
    if (!arr || e.pointerId !== arr.id) return;
    const { b, px } = arr;
    const ancho = (b.w + 0.3) * px, alto = (b.h + 0.3) * px;
    const izq = e.clientX - ancho / 2, arriba = e.clientY - alto / 2 - arr.alzado * px;
    flota.style.transform = 'translate(' + izq + 'px,' + arriba + 'px)';
    // Dónde cae, en el plano del tablero, el punto (0,0) de la red de la pieza.
    const rect = tablero.getBoundingClientRect();
    const ox = izq + (0.15 - b.x) * px, oy = arriba + (0.15 - b.y) * px;
    const bx = VB.x + (ox - rect.left) / px, by = VB.y + (oy - rect.top) / px;
    const fy = by / M.H, fx = bx - fy / 2;
    let mejor = null;
    for (let dy = Math.floor(fy) - 1; dy <= Math.ceil(fy) + 1; dy++)
      for (let dx = Math.floor(fx) - 1; dx <= Math.ceil(fx) + 1; dx++) {
        const [cx, cy] = M.plano(dx, dy), dist = Math.hypot(cx - bx, cy - by);
        if (dist > 0.9 || (mejor && dist >= mejor.dist)) continue;
        if (M.destino(E, arr.p, dx, dy)) mejor = { dx, dy, dist };
      }
    arr.valida = !!mejor;
    if (!mejor) { pintaTablero(); return; }
    arr.dx = mejor.dx; arr.dy = mejor.dy;
    pintaFantasma(arr.p, mejor.dx, mejor.dy);
  }

  // La pieza que no se pudo soltar vuela de vuelta a su ranura antes de desaparecer.
  function devuelve(s) {
    const r = ranuras[s].r.getBoundingClientRect();
    const w = parseFloat(flota.style.width), h = parseFloat(flota.style.height);
    volviendo = true;
    flota.style.transition = 'transform .2s ease-in, opacity .2s ease-in';
    flota.style.transform = 'translate(' + (r.left + r.width / 2 - w / 2) + 'px,' + (r.top + r.height / 2 - h / 2) + 'px) scale(.5)';
    setTimeout(() => {
      flota.setAttribute('hidden', ''); flota.replaceChildren(); flota.style.transition = 'none';
      ranuras[s].r.classList.remove('levantada');
      volviendo = false;
    }, 200);
  }

  function suelta(e) {
    if (!arr || e.pointerId !== arr.id) return;
    const { s, valida, dx, dy } = arr;
    arr = null;
    if (!valida) { pintaTablero(); sonidos.vuelve(); devuelve(s); return; }
    ranuras[s].r.classList.remove('levantada');
    flota.setAttribute('hidden', ''); flota.replaceChildren();
    juega(s, dx, dy, !e.isTrusted ? 'x' : e.pointerType === 'touch' ? 't' : 'r');
  }
  addEventListener('pointermove', mueve);
  addEventListener('pointerup', suelta);
  addEventListener('pointercancel', e => { if (arr && e.pointerId === arr.id) { arr.valida = false; suelta(e); } });
  for (const t of ['selectstart', 'contextmenu', 'dragstart']) document.addEventListener(t, e => { if (e.target.closest && e.target.closest('.escenario,.mano')) e.preventDefault(); });
  mano.addEventListener('touchstart', e => e.preventDefault(), { passive: false });

  /* ---------- Teclado ----------
     1, 2 y 3 eligen pieza y la ponen en la posición libre más cerca del
     centro; las flechas la mueven por la red (arriba y abajo alternan el
     paso para no derivar de lado, porque la red está inclinada 60°). */
  let alterna = false;
  function centroMasCercano(p) {
    const [x0, y0, d0] = M.celdasDe(p)[0];
    let mejor = null;
    for (const c of M.CELDAS) {
      if (c.d !== d0) continue;
      const dx = c.x - x0, dy = c.y - y0;
      if (!M.destino(E, p, dx, dy)) continue;
      const [cx, cy] = M.plano(c.x, c.y), dist = Math.hypot(cx, cy);
      if (!mejor || dist < mejor.dist) mejor = { dx, dy, dist };
    }
    return mejor;
  }
  function elige(s) {
    const p = E.mano[s];
    if (!p) return;
    const pos = centroMasCercano(p);
    if (!pos) { sonidos.vuelve(); return; }
    kb = { s, dx: pos.dx, dy: pos.dy };
    sonidos.toma();
    pintaMano(); pintaFantasma(p, kb.dx, kb.dy);
  }
  function suelta_teclado() {
    if (!kb) return;
    kb = null;
    pintaMano(); pintaTablero();
  }
  function mueveTeclado(ddx, ddy) {
    const p = E.mano[kb.s];
    if (!M.cubre(p, kb.dx + ddx, kb.dy + ddy)) return;
    kb.dx += ddx; kb.dy += ddy;
    pintaFantasma(p, kb.dx, kb.dy);
  }
  addEventListener('keydown', e => {
    if (!E || terminada || enMenu() || arr) return;
    if (/^Digit[1-3]$/.test(e.code) || /^Numpad[1-3]$/.test(e.code)) { e.preventDefault(); elige(+e.code.slice(-1) - 1); return; }
    if (!kb) return;
    const paso = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      ArrowUp: alterna ? [1, -1] : [0, -1], ArrowDown: alterna ? [-1, 1] : [0, 1]
    }[e.code];
    if (paso) {
      e.preventDefault();
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') alterna = !alterna;
      mueveTeclado(paso[0], paso[1]);
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      const { s, dx, dy } = kb;
      if (!M.destino(E, E.mano[s], dx, dy)) { sonidos.vuelve(); return; }
      kb = null;
      juega(s, dx, dy, e.isTrusted ? 'k' : 'x');
    } else if (e.code === 'Escape') { e.preventDefault(); suelta_teclado(); }
  });

  /* ---------- Relojes ----------
     Lo jugado se mide con dos relojes a la vez, el del navegador
     (performance.now) y el del sistema (Date.now), y los dos se paran con
     la pestaña oculta o sin foco. Viajan en la prueba: si alguien acelera
     el juego, se separan y el verificador lo nota. Cada jugada guarda los
     ms ENTEROS desde la anterior (resultadoClub pide enteros). */
  let accA = 0, accW = 0, corre = false, segA = 0, segW = 0, ultimaA = 0;
  function reloj() {
    let a = accA, w = accW;
    if (corre) { a += performance.now() - segA; w += Date.now() - segW; }
    return { a, w };
  }
  function arranca() {
    if (corre || terminada || document.hidden || !E) return;
    corre = true; segA = performance.now(); segW = Date.now();
  }
  function para() {
    if (!corre) return;
    accA += performance.now() - segA; accW += Date.now() - segW; corre = false;
  }
  function reiniciaRelojes(g) {
    corre = false;
    accA = Math.max(0, +(g && g.a) || 0); accW = Math.max(0, +(g && g.w) || 0);
    ultimaA = Math.min(accA, Math.max(0, +(g && g.ua) || 0));
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { para(); guardaPartida(); } else arranca(); });
  addEventListener('blur', para);
  addEventListener('focus', arranca);

  /* ---------- Guardado de la partida en curso ----------
     Solo en este navegador, nunca en la nube: la semilla y las jugadas,
     que el motor rehace. Si la última jugada fue hace más de VIGENCIA, se
     descarta y se empieza de cero. */
  function guardaPartida() {
    if (!E || terminada || !E.jugadas) { try { localStorage.removeItem(clave('trigon.partida')); } catch (_) { /* nada */ } return; }
    const r = reloj();
    guarda('trigon.partida', { s: E.semilla, u: E.u, j: E.registro, a: Math.round(r.a), w: Math.round(r.w), ua: Math.round(ultimaA), at: Date.now() });
  }
  function retoma() {
    const g = lee('trigon.partida');
    if (!g || g.u !== CUENTA || !(Date.now() - (+g.at || 0) < VIGENCIA)) return false;
    const r = M.rehace(g.s, g.u, g.j);
    if (r.error || r.E.fin) return false;
    E = r.E; terminada = false;
    reiniciaRelojes(g); arranca();
    pintaTablero(); pintaMano(true); pintaMarcador();
    return true;
  }

  /* ---------- Ciclo de una partida ---------- */
  function juega(s, dx, dy, origen) {
    arranca();
    const antes = E.t.slice(), propio = E.mano[s] ? E.mano[s].f + 1 : 0;
    const libres = E.mano[s] && M.destino(E, E.mano[s], dx, dy);
    const cerradas = libres ? M.lineasQueCierra(E, libres) : [];
    const ahora = reloj().a, dt = Math.max(0, Math.round(ahora - ultimaA));
    const r = M.coloca(E, s, dx, dy, [origen || 'x', dt]);
    if (!r) { pintaTablero(); return; }
    ultimaA += dt;
    pintaTablero();
    if (r.borradas.length) {
      estalla(r.borradas, r.borradas.map(i => antes[i] || propio));
      celebra(cerradas);
      sonidos.borra(r.lineas);
      muestraRacha(r.lineas, E.racha);
    } else sonidos.pone();
    popSuma(r.suma);
    pintaMano(r.reparte); pintaMarcador();
    if (E.fin) termina(); else guardaPartida();
  }

  /* Manda el puntaje a la clasificación de Juegos con su prueba: la semilla,
     la cuenta, las jugadas tal cual (con origen y ms) y los dos relojes. El
     verificador (solo/verifica/trigon.js) la rehace antes de guardar nada.
     Una partida con jugadas sintéticas se juega, pero no se manda. */
  function reporta(fin) {
    if (!Club || !E || !E.jugadas || E.puntos < 1) return;
    if (E.registro.some(j => j[3] === 'x' || j.length !== 5)) return;
    const ms = E.registro.reduce((t, j) => t + j[4], 0);
    if (ms < 1) return;
    const r = reloj();
    Club.result({ categoria: CAT, puntos: E.puntos, tiempo: ms },
      { v: 1, s: E.semilla, u: E.u, j: E.registro, a: Math.round(r.a), w: Math.round(r.w), fin: !!fin });
  }

  function termina() {
    terminada = true;
    para();
    reporta(true);
    const nuevo = E.puntos > prog.mejor && E.puntos > 0;
    prog.mejor = Math.max(prog.mejor, E.puntos); prog.partidas++;
    guarda('trigon.datos', prog);
    guardaPartida();
    sonidos.fin();
    $('finPuntos').textContent = String(E.puntos);
    $('finLineas').textContent = String(E.lineas);
    $('finRacha').textContent = E.mejorRacha ? '×' + E.mejorRacha : '—';
    $('finNuevo').hidden = !nuevo;
    $('finFrase').textContent = nuevo ? 'Tu mejor partida hasta ahora.' : 'Ninguna pieza cabe ya en el hexágono. Otra vuelta.';
    setTimeout(() => { $('fin').hidden = false; $('btnOtra').focus(); }, 500);
    pintaMarcador();
  }

  function nuevaPartida() {
    const s = new Uint32Array(1); crypto.getRandomValues(s);
    E = M.nueva(s[0], CUENTA);
    terminada = false; kb = null;
    reiniciaRelojes(null); arranca();
    $('fin').hidden = true; $('menu').hidden = true;
    pintaTablero(); pintaMano(true); pintaMarcador();
    guardaPartida();
  }

  // Abandonar a mitad: si la partida superaba el récord, el récord queda.
  function abandona() {
    if (!E || terminada) return;
    if (E.puntos > prog.mejor) { prog.mejor = E.puntos; guarda('trigon.datos', prog); }
    reporta(false);
  }

  /* ---------- Menú ---------- */
  function abreMenu() {
    suelta_teclado();
    $('menuMejor').textContent = String(Math.max(prog.mejor, E && !terminada ? E.puntos : 0));
    $('menuPartidas').textContent = prog.partidas === 1 ? '1 partida jugada' : prog.partidas + ' partidas jugadas';
    $('btnSeguirPartida').hidden = !(E && !terminada && E.jugadas > 0);
    $('fin').hidden = true; $('menu').hidden = false;
    $('btnJugar').focus({ preventScroll: true });
  }
  function cierraMenu() { $('menu').hidden = true; }

  $('btnMenu').addEventListener('click', () => $('menu').hidden ? abreMenu() : (E && !terminada ? cierraMenu() : null));
  $('btnJugar').addEventListener('click', () => {
    if (E && !terminada && E.jugadas > 5 && !confirm('¿Empezar una partida nueva? La actual se da por terminada.')) return;
    abandona(); nuevaPartida();
  });
  $('btnSeguirPartida').addEventListener('click', cierraMenu);
  $('btnComo').addEventListener('click', () => {
    const c = $('comoSeJuega'), abre = c.hidden;
    c.hidden = !abre; $('btnComo').setAttribute('aria-expanded', String(abre));
  });
  $('btnNueva').addEventListener('click', () => {
    if (E && !terminada && E.jugadas > 5 && !confirm('¿Empezar una partida nueva? Esta se da por terminada.')) return;
    abandona(); nuevaPartida();
  });
  $('btnOtra').addEventListener('click', nuevaPartida);
  $('btnMenuFin').addEventListener('click', abreMenu);

  /* ---------- Temas ----------
     El tema y el modo viven en <html data-skin data-modo> (el <head> los
     pone antes de pintar) y se recuerdan en este navegador, sin cuenta:
     son un gusto de la pantalla, no de la persona. Cambiarlo no toca la
     partida; el selector solo tapa la mesa mientras está abierto. */
  const TEMAS = [
    { id: 'clasico', nombre: 'Clásico' },
    { id: 'halloween', nombre: 'Halloween' },
    { id: 'gris', nombre: 'Gris' },
    { id: 'forest', nombre: 'Forest' },
    { id: 'espacio', nombre: 'Espacio' }
  ];
  const raiz = document.documentElement;
  function aplicaTema(skin, modo) {
    if (!TEMAS.some(t => t.id === skin)) skin = 'clasico';
    modo = modo === 'claro' ? 'claro' : 'oscuro';
    raiz.dataset.skin = skin; raiz.dataset.modo = modo;
    try { localStorage.setItem('trigon.tema', JSON.stringify({ skin, modo })); } catch (_) { /* nada */ }
    pintaTemas();
  }
  // Cada tarjeta lleva su propio data-skin y data-modo: temas.css la pinta con sus colores.
  function miniatura() {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-1.6 -1.5 3.2 3');
    svg.setAttribute('aria-hidden', 'true');
    const fondo = document.createElementNS(NS, 'rect');
    fondo.setAttribute('x', '-1.6'); fondo.setAttribute('y', '-1.5'); fondo.setAttribute('width', '3.2'); fondo.setAttribute('height', '3');
    fondo.setAttribute('class', 'mini-fondo');
    svg.appendChild(fondo);
    const hex = [[0, 0, 0], [-1, 0, 0], [0, -1, 0], [-1, 0, 1], [0, -1, 1], [-1, -1, 1]];
    hex.forEach(([x, y, d], k) => {
      const p = poligono(svg, x, y, d, 'mini-tri');
      p.style.setProperty('--color', k < 4 ? color(k + 1) : 'var(--celda)');
    });
    return svg;
  }
  const lista = $('temasLista');
  for (const t of TEMAS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tema'; b.dataset.tema = t.id;
    const nombre = document.createElement('span'); nombre.textContent = t.nombre;
    b.append(miniatura(), nombre);
    b.addEventListener('click', () => aplicaTema(t.id, raiz.dataset.modo));
    lista.appendChild(b);
  }
  function pintaTemas() {
    for (const b of lista.children) {
      b.dataset.skin = b.dataset.tema; b.dataset.modo = raiz.dataset.modo;
      b.setAttribute('aria-pressed', String(b.dataset.tema === raiz.dataset.skin));
    }
    for (const b of document.querySelectorAll('[data-modo-boton]')) b.setAttribute('aria-pressed', String(b.dataset.modoBoton === raiz.dataset.modo));
  }
  for (const b of document.querySelectorAll('[data-modo-boton]')) b.addEventListener('click', () => aplicaTema(raiz.dataset.skin, b.dataset.modoBoton));
  let volverAlMenu = false;
  function abreTemas() {
    suelta_teclado();
    pintaTemas();
    volverAlMenu = !$('menu').hidden;
    $('menu').hidden = true;
    $('temas').hidden = false;
    lista.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }
  function cierraTemas() {
    $('temas').hidden = true;
    if (volverAlMenu) abreMenu();
  }
  $('btnTema').addEventListener('click', () => $('temas').hidden ? abreTemas() : cierraTemas());
  $('btnTemasListo').addEventListener('click', cierraTemas);
  addEventListener('keydown', e => { if (e.code === 'Escape' && !$('temas').hidden) { e.preventDefault(); cierraTemas(); } });
  aplicaTema(raiz.dataset.skin, raiz.dataset.modo);

  /* ---------- Clasificación ----------
     La tabla llega de la página de Juegos con el mismo mensaje `ranking`
     que pinta el panel de conexion.js; aquí se escucha también para
     mostrarla en el menú. Fuera de Juegos no hay tabla. */
  const embebido = window.parent !== window;
  function pintaTabla(filas) {
    const ol = $('tabla');
    ol.replaceChildren();
    for (const f of (filas || []).slice(0, 10)) {
      const li = document.createElement('li');
      li.className = f.yo ? 'yo' : '';
      const n = document.createElement('span'); n.textContent = (f.nombre || 'Jugador') + (f.yo ? ' (tú)' : '');
      const p = document.createElement('b'); p.textContent = String(f.puntos); p.setAttribute('translate', 'no');
      li.append(n, p); ol.appendChild(li);
    }
    const top = filas && filas[0];
    $('tablaRecord').textContent = top ? 'Récord: ' + top.puntos + ' de ' + (top.nombre || 'Jugador') : '';
    $('tablaEstado').textContent = filas && filas.length ? '' : 'Todavía nadie tiene puntaje. ¡Sé el primero!';
  }
  $('tablaEstado').textContent = embebido ? 'Cargando clasificación…' : 'Abre Trigon desde Juegos para ver la clasificación de todos.';
  addEventListener('message', e => {
    if (!embebido || e.source !== parent || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.canal !== 'club-parent' || d.categoria !== CAT) return;
    if (d.tipo === 'ranking') pintaTabla(d.filas);
    else if (d.tipo === 'estado') $('tablaEstado').textContent = d.texto;
  });
  if (Club) Club.category(CAT);
  addEventListener('club-rechazo', e => {
    if (e.detail && e.detail.categoria === CAT) $('finFrase').textContent = 'Esta partida no entró en la clasificación: ' + (e.detail.motivo || '');
  });

  /* ---------- Arranque ---------- */
  $('nota').innerHTML = (tactil
    ? 'Arrastra con el dedo cada pieza hasta el hexágono. '
    : 'Arrastra cada pieza hasta el hexágono, o usa <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>, flechas y <kbd>Enter</kbd>. ') +
    'Completa una línea —horizontal o en cualquiera de las dos diagonales— para borrarla.';

  function ajustaPantalla() {
    let w = innerWidth, h = innerHeight;
    try { w = window.top.innerWidth; h = window.top.innerHeight; } catch (_) { /* otra página */ }
    const raiz = document.documentElement;
    raiz.style.setProperty('--alto-pantalla', h + 'px');
    raiz.classList.toggle('apaisado', w > h && h < 560);
  }
  ajustaPantalla();
  addEventListener('resize', ajustaPantalla);
  addEventListener('pagehide', guardaPartida);

  window.__trigon = { estado: () => E, motor: M };
  if (!retoma()) {
    const s = new Uint32Array(1); crypto.getRandomValues(s);
    E = M.nueva(s[0], CUENTA);
    pintaTablero(); pintaMano(); pintaMarcador();
    abreMenu();
  }
})();
