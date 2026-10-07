/* ALETEO — la pantalla.
   Todo lo que decide un vuelo está en motor.js (ticks fijos de 1/60 s); aquí
   solo se dibuja, se suena y se lleva la cuenta. El cielo se oscurece con la
   corrupción de lore.js, que sale de los tubos pasados: nada lo anuncia, cada
   cosa se cuela por su cuenta en su propio tramo (`L.lento`). La prueba de un
   vuelo es la semilla y los ticks de cada aleteo; verifica/aleteo.js la rehace
   con el mismo motor. */
(() => {
  'use strict';
  const M = window.AleteoMotor, L = window.AleteoLore, Club = window.Club;
  const $ = id => document.getElementById(id);
  const W = M.W, H = M.H, SUELO = M.SUELO, PX = M.PX, R = M.R, TW = M.TW;
  const CATEGORIA = 'club-aleteo-vuelo';
  const lento = (c, a, b) => L.lento(c, a, b);
  const clamp = (n, a, b) => n < a ? a : n > b ? b : n;

  /* ---------- Guardado ---------- */
  const CUENTA = Club && Club.storageKey ? Club.storageKey('').replace(/^\.cuenta\./, '') : 'local';
  const clave = k => Club && Club.storageKey ? Club.storageKey(k) : k + '.cuenta.local';
  function lee(k) { try { return JSON.parse(localStorage.getItem(clave(k)) || 'null'); } catch (_) { return null; } }
  function guarda(k, v) { try { localStorage.setItem(clave(k), JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } }
  let prog = M.mezclaProgreso(lee('aleteo.progreso'), null);
  let ultimaSubida = '';
  function subeNube(forzar) {
    if (!Club || !Club.guardarPartida) return;
    const texto = JSON.stringify(prog);
    if (!forzar && texto === ultimaSubida) return;
    ultimaSubida = texto;
    Club.guardarPartida(texto);
  }

  /* ---------- Lienzo ---------- */
  const lienzo = $('lienzo'), ctx = lienzo.getContext('2d');
  let escala = 1;
  function mide() {
    const caja = lienzo.getBoundingClientRect(), dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const ancho = Math.max(1, Math.round(caja.width * dpr)), alto = Math.max(1, Math.round(caja.height * dpr));
    if (lienzo.width !== ancho || lienzo.height !== alto) { lienzo.width = ancho; lienzo.height = alto; }
    escala = ancho / W;
  }
  new ResizeObserver(mide).observe(lienzo);

  // Grano: una textura de ruido hecha una vez y estampada con desfase.
  const grano = document.createElement('canvas');
  grano.width = grano.height = 128;
  { const g = grano.getContext('2d'), img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0); }

  // Decorado fijo: sale de un generador con semilla para que no salte entre visitas.
  function rngDe(s) { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rd = rngDe(20261006);
  const ESTRELLAS = Array.from({ length: 80 }, () => ({ x: rd() * W, y: rd() * (SUELO - 120), r: .5 + rd() * 1.4, f: rd() * 6.28 }));
  const NUBES = Array.from({ length: 7 }, (_, i) => ({ x: i * 130 + rd() * 60, y: 50 + rd() * 230, s: .6 + rd() * .7 }));
  const EDIFICIOS = []; { let x = 0; while (x < 480) { const w = 28 + rd() * 36, h = 60 + rd() * 130; EDIFICIOS.push({ x, w, h, v: Array.from({ length: 24 }, () => rd()) }); x += w + 2 + rd() * 6; } }
  const ANCHO_CIUDAD = EDIFICIOS.reduce((m, e) => Math.max(m, e.x + e.w), 0) + 8;
  const OSARIO = Array.from({ length: 14 }, (_, i) => ({ x: i * 34 + rd() * 20, y: SUELO + 26 + rd() * 44, t: rd() < .45 ? 'hueso' : 'pluma', a: rd() * 6.28 }));
  const PALABRAS = ['QUÉDATE', 'CASA', 'NO SALGAS', 'AQUÍ', 'QUÉDATE', 'SIEMPRE'];
  const BANDADA = [{ dx: -46, dy: -38, c: '#7fd3ff', f: 0 }, { dx: -70, dy: 18, c: '#ff8fb1', f: 1.7 }, { dx: -28, dy: 52, c: '#b9f27c', f: 3.1 }, { dx: -96, dy: -12, c: '#ffffff', f: 4.4 }];

  /* ---------- Estado ---------- */
  let estado = 'listo';            // listo · jugando · muerte · fin
  let pausado = false;
  let E = null, aleteos = [], pendiente = null, fiable = true, tocado = false, t0 = 0, w0 = 0, pP = 0, pW = 0, pP0 = 0, pW0 = 0, nMuerte = 0;
  let prevY = M.Y0, acc = 0, ultimo = performance.now(), reloj = 0;
  let mundo = 0;                   // desplazamiento del suelo y del decorado, en px lógicos
  let cVista = 0, cMax = 0;
  const ave = { y: M.Y0, vy: 0, rot: 0, ala: 0, aleteoT: 9, aplasta: 0, enSuelo: false };
  let destello = 0, sacudida = 0, popPuntos = 0, finDesde = 0, muerteDesde = 0, choques = 0;
  const parts = [];

  /* ---------- Sonido ---------- */
  const musica = window.AleteoMusica ? window.AleteoMusica.crear() : null;
  let mudo = false; try { mudo = localStorage.getItem('aleteo.mudo') === '1'; } catch (_) { /* nada */ }
  if (musica) musica.mudo(mudo);
  function pintaSonido() {
    const b = $('sound-button'); if (!b) return;
    b.setAttribute('aria-pressed', mudo ? 'false' : 'true');
    b.setAttribute('aria-label', mudo ? 'Activar música y efectos' : 'Desactivar música y efectos');
  }
  pintaSonido();
  $('sound-button').addEventListener('click', () => {
    mudo = !mudo; if (musica) { musica.arranca(); musica.mudo(mudo); }
    try { localStorage.setItem('aleteo.mudo', mudo ? '1' : '0'); } catch (_) { /* nada */ }
    pintaSonido();
  });
  let sonando = false;
  function despierta() { if (!sonando && musica) { sonando = true; musica.arranca(); } }

  /* ---------- Entrada ---------- */
  const hayMando = () => { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(g => g && g.connected); } catch (_) { return false; } };
  const deVerdad = e => !!e && (e.isTrusted || (!!e.__mando && hayMando()));

  function pulsa(origen, e) {
    despierta();
    if (pausado) { sigue(); return; }
    if (estado === 'listo') return empieza(origen);
    if (estado === 'jugando') { if (!pendiente) pendiente = origen; if (!deVerdad(e)) fiable = false; return; }
    if (estado === 'fin' && performance.now() - finDesde > 450) otraVez();
  }
  lienzo.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    e.preventDefault();
    pulsa(!deVerdad(e) ? 'x' : e.pointerType === 'touch' ? 't' : 'r', e);
  });
  $('escenario').addEventListener('pointerdown', e => {
    if (e.target === lienzo || e.target.closest('button')) return;
    if (estado === 'listo' || estado === 'jugando') { e.preventDefault(); pulsa(!deVerdad(e) ? 'x' : e.pointerType === 'touch' ? 't' : 'r', e); }
  });
  // Un toque no debe seleccionar nada ni abrir el menú de la pulsación larga: en el celular
  // eso pintaba el escenario entero de azul a cada aleteo. Los botones conservan su toque, y
  // fuera del vuelo (en el cartel final) el dedo puede volver a desplazar la página.
  const escenario = $('escenario');
  escenario.addEventListener('touchstart', e => {
    if (estado !== 'fin' && !e.target.closest('button')) e.preventDefault();
  }, { passive: false });
  for (const t of ['selectstart', 'contextmenu', 'dragstart']) escenario.addEventListener(t, e => e.preventDefault());
  addEventListener('keydown', e => {
    const k = e.code;
    if (k === 'KeyP' || k === 'Escape') { if (estado === 'jugando') { e.preventDefault(); pausado ? sigue() : pausa(); } return; }
    if (k !== 'Space' && k !== 'ArrowUp' && k !== 'KeyW' && k !== 'Enter') return;
    // Un botón con foco se queda con su Espacio o su Intro.
    if (document.activeElement && document.activeElement.tagName === 'BUTTON' && document.activeElement !== document.body && !e.__mando) return;
    if (e.repeat) { e.preventDefault(); return; }
    e.preventDefault();
    pulsa(!deVerdad(e) ? 'x' : e.__mando ? 'm' : 'k', e);
  });
  $('btnOtra').addEventListener('click', () => { despierta(); otraVez(); });
  $('btnSeguir').addEventListener('click', () => { despierta(); sigue(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && estado === 'jugando') pausa(); });
  addEventListener('blur', () => { if (estado === 'jugando') pausa(); });

  /* ---------- Ciclo de un vuelo ---------- */
  function empieza(origen) {
    const s = new Uint32Array(1); crypto.getRandomValues(s);
    E = M.nueva(s[0], CUENTA);
    aleteos = []; pendiente = origen; fiable = origen !== 'x'; tocado = false;
    t0 = performance.now(); w0 = Date.now(); pP = pW = 0; acc = M.TICK; prevY = E.y; cMax = 0;
    estado = 'jugando'; $('listo').hidden = true;
    ave.enSuelo = false;
  }
  function pausa() { if (estado !== 'jugando' || pausado) return; pausado = true; pP0 = performance.now(); pW0 = Date.now(); $('pausa').hidden = false; $('btnSeguir').focus({ preventScroll: true }); }
  function sigue() { if (!pausado) return; pausado = false; pP += performance.now() - pP0; pW += Date.now() - pW0; $('pausa').hidden = true; ultimo = performance.now(); acc = 0; lienzo.focus({ preventScroll: true }); }
  function otraVez() {
    estado = 'listo'; E = null; $('fin').hidden = true; $('listo').hidden = false;
    ave.y = M.Y0; ave.vy = 0; ave.rot = 0; ave.enSuelo = false; popPuntos = 0;
    lienzo.focus({ preventScroll: true });
  }

  function tick() {
    const o = pendiente; pendiente = null;
    if (o) { aleteos.push([E.t, o]); if (o === 'x') fiable = false; }
    prevY = E.y;
    const ev = M.paso(E, !!o);
    if (o) { ave.aleteoT = 0; ave.aplasta = 1; if (musica) musica.aleteo(); soplo(); }
    if (!ev) return;
    if (ev.punto) { popPuntos = 1; if (musica) musica.punto(E.puntos); chispas(); }
    if (ev.muerte) muere(ev.golpe);
  }

  function muere(golpe) {
    nMuerte = E.t; estado = 'muerte'; muerteDesde = performance.now();
    destello = 1; sacudida = golpe === 'tubo' ? 10 : 7;
    ave.y = E.y; ave.vy = golpe === 'tubo' ? -2 : 0; ave.enSuelo = golpe === 'suelo';
    if (musica) musica.golpe(golpe);
    for (let i = 0; i < 16; i++) parts.push({ t: 'pluma', x: PX, y: E.y, vx: (Math.random() - .6) * 5, vy: (Math.random() - .7) * 5, v: 1.4 + Math.random(), a: Math.random() * 6, va: (Math.random() - .5) * .3 });
    const p = E.puntos, antes = prog.mejor;
    prog = M.mezclaProgreso(prog, { mejor: p, hondo: Math.floor(cMax * 10), vuelos: prog.vuelos + 1 });
    guarda('aleteo.progreso', prog); subeNube();
    choques++;
    reporta();
    preparaFin(p, antes);
  }

  function reporta() {
    if (!Club || !E || E.puntos < 1 || !fiable || tocado) return;
    const prueba = { v: 1, s: E.semilla, u: E.u, f: M.codifica(aleteos), n: nMuerte, r: Math.round(performance.now() - t0),
      // Lo jugado sin pausas en los dos relojes: un reloj trucado en uno solo
      // (para que el juego vaya más lento) los separa.
      a: Math.round(performance.now() - t0 - pP), w: Date.now() - w0 - pW };
    Club.result({ categoria: CATEGORIA, puntos: E.puntos, tiempo: M.msDe(nMuerte) }, prueba);
  }

  /* ---------- El cartel final ---------- */
  const NOMBRE_MEDALLA = { bronce: 'Bronce', plata: 'Plata', oro: 'Oro', platino: 'Platino' };
  let cuentaFin = null;
  function preparaFin(p, antes) {
    const c = cVista, med = M.medalla(p), nuevo = p > antes && p > 0;
    $('finTitulo').textContent = L.corrompe(c >= 3.5 ? 'DE VUELTA' : 'FIN DEL VUELO', c);
    $('finFrase').textContent = L.corrompe(L.choque(c, choques), c);
    $('finPuntos').textContent = '0';
    $('finMejor').textContent = String(prog.mejor);
    $('finNuevo').hidden = !nuevo;
    $('finMejorEt').textContent = L.etiqueta('mejor', c);
    $('finMedallaEt').textContent = L.etiqueta('medalla', c);
    const m = $('finMedalla'); m.className = 'medalla ' + (med || 'vacia');
    m.title = med ? NOMBRE_MEDALLA[med] : 'Sin medalla';
    m.querySelector('b').textContent = med ? NOMBRE_MEDALLA[med] : '—';
    cuentaFin = { p, med, nuevo, listo: false };
  }
  function muestraFin() {
    estado = 'fin'; finDesde = performance.now();
    $('fin').hidden = false;
    const { p, med, nuevo } = cuentaFin;
    const dur = Math.min(900, 120 + p * 22), desde = performance.now();
    const paso = () => {
      const f = clamp((performance.now() - desde) / dur, 0, 1);
      $('finPuntos').textContent = String(Math.round(p * f));
      if (f < 1 && estado === 'fin') requestAnimationFrame(paso);
      else if (estado === 'fin') {
        if (med) { $('finMedalla').classList.add('brilla'); if (musica) musica.medalla(med); }
        if (nuevo && musica) setTimeout(() => estado === 'fin' && musica.nuevoRecord(), 380);
      }
    };
    requestAnimationFrame(paso);
    setTimeout(() => { if (estado === 'fin') $('btnOtra').focus({ preventScroll: true }); }, 460);
    pintaMarcador(true);
  }

  /* ---------- Partículas ---------- */
  function soplo() { for (let i = 0; i < 3; i++) parts.push({ t: 'polvo', x: PX - 10, y: ave.y + 6, vx: -1 - Math.random() * 1.5, vy: Math.random() * 1.2, v: .45, r: 2 + Math.random() * 3 }); }
  function chispas() { for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28; parts.push({ t: 'chispa', x: PX + 16, y: ave.y, vx: Math.cos(a) * 2.4, vy: Math.sin(a) * 2.4, v: .5 }); } }
  function mueveParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.v -= dt;
      if (q.v <= 0) { parts.splice(i, 1); continue; }
      const f = dt * 60;
      q.x += q.vx * f; q.y += q.vy * f;
      if (q.t === 'pluma') { q.vy = Math.min(1.2, q.vy + .08 * f); q.vx *= .98; q.a += q.va * f; q.x += Math.sin(q.a) * .6 * f; }
      else if (q.t === 'chispa') { q.vx *= .93; q.vy *= .93; }
      else { q.vx *= .96; q.vy *= .96; }
    }
    if (parts.length > 160) parts.splice(0, parts.length - 160);
  }

  /* ---------- Marcador y textos ---------- */
  const textos = {};
  function pon(id, t) { if (textos[id] !== t) { textos[id] = t; $(id).textContent = t; } }
  function pintaMarcador() {
    const c = cVista;
    pon('etMejor', L.etiqueta('mejor', c)); pon('nMejor', String(prog.mejor));
    pon('etMedalla', L.etiqueta('medalla', c));
    const m = M.medalla(prog.mejor); pon('nMedalla', m ? NOMBRE_MEDALLA[m] : '—');
    pon('etVuelos', L.etiqueta('vuelos', c)); pon('nVuelos', String(prog.vuelos));
    pon('logoT', L.corrompe(L.etiqueta('logo', c), c));
    pon('lema', L.etiqueta('lema', c));
  }
  let ultimoPiensa = '';
  function pintaPiensa() {
    const el = $('piensa');
    const t = estado === 'jugando' && E ? L.corrompe(L.pensamiento(cVista, E.puntos), cVista) : '';
    if (t === ultimoPiensa) return;
    ultimoPiensa = t; el.textContent = t;
    el.classList.remove('nuevo'); void el.offsetWidth; if (t) el.classList.add('nuevo');
  }
  let ultimaPaleta = '';
  function pintaVariables(pal) {
    const k = pal.fondo + pal.tinta + pal.panel + pal.acento;
    if (k === ultimaPaleta) return; ultimaPaleta = k;
    const s = document.documentElement.style;
    s.setProperty('--fondo', pal.fondo); s.setProperty('--tinta', pal.tinta);
    s.setProperty('--panel', pal.panel); s.setProperty('--acento', pal.acento);
    s.setProperty('--tubo', pal.tubo); s.setProperty('--borde', pal.borde);
    document.documentElement.dataset.cielo = L.NOMBRES[L.etapa(cVista)];
  }

  /* ---------- Bucle ---------- */
  function frame(ahora) {
    const dt = Math.min(.1, (ahora - ultimo) / 1000); ultimo = ahora; reloj += dt;
    if (estado === 'jugando' && !pausado) {
      acc += dt;
      while (acc >= M.TICK && estado === 'jugando') { tick(); acc -= M.TICK; }
    } else acc = 0;
    actualiza(dt, ahora);
    dibuja(estado === 'jugando' && !pausado ? clamp(acc / M.TICK, 0, 1) : 0);
    requestAnimationFrame(frame);
  }

  function objetivoC() {
    if (!E || estado === 'listo') return 0;
    const tb = M.proximo(E);
    const f = tb ? clamp(1 - (tb.x + TW / 2 - PX) / M.SEP, 0, 1) : 0;
    return L.corrupcion(E.puntos + f);
  }
  function actualiza(dt, ahora) {
    if (pausado) return;
    // El suelo corre salvo cuando el pájaro cayó.
    if (estado === 'listo' || estado === 'jugando') mundo += M.VEL * dt * 60;
    const meta = objetivoC();
    if (estado === 'jugando') cVista += (meta - cVista) * Math.min(1, dt * 3);
    else if (estado === 'listo') cVista += (0 - cVista) * Math.min(1, dt * 1.1);
    if (cVista < .0005) cVista = 0;
    if (estado === 'jugando') cMax = Math.max(cMax, cVista);
    if (musica) musica.mood(cVista, estado === 'jugando');

    ave.aleteoT += dt; ave.aplasta = Math.max(0, ave.aplasta - dt * 6);
    if (estado === 'listo') {
      ave.y = M.Y0 + Math.sin(reloj * 4) * 7; ave.rot += (0 - ave.rot) * Math.min(1, dt * 8);
      ave.ala += dt * 9;
    } else if (estado === 'jugando') {
      const vy = E.vy, obj = vy < 0 ? -.42 : clamp(-.42 + (vy - 1) * .2, -.42, 1.45);
      ave.rot += (obj - ave.rot) * Math.min(1, dt * (vy < 0 ? 18 : 6));
      ave.ala += dt * (vy < 0 ? 26 : vy > 6 ? 0 : 12);
    } else if (estado === 'muerte' || estado === 'fin') {
      if (!ave.enSuelo) {
        ave.vy = Math.min(14, ave.vy + .7 * dt * 60); ave.y += ave.vy * dt * 60;
        ave.rot += (1.57 - ave.rot) * Math.min(1, dt * 7);
        if (ave.y + R >= SUELO) { ave.y = SUELO - R; ave.enSuelo = true; sacudida = Math.max(sacudida, 4); if (musica) musica.caida(); }
      }
      if (estado === 'muerte' && ave.enSuelo && ahora - muerteDesde > 650) muestraFin();
    }
    // Plumas que se caen solas, desde la noche.
    if (estado === 'jugando' && cVista > 3.5 && Math.random() < dt * (cVista - 3.5) * 1.6)
      parts.push({ t: 'pluma', x: PX - 4, y: ave.y, vx: -1.5 - Math.random(), vy: .3, v: 2.2, a: Math.random() * 6, va: (Math.random() - .5) * .2 });
    mueveParts(dt);
    destello = Math.max(0, destello - dt * 3.2);
    sacudida = Math.max(0, sacudida - dt * 30);
    popPuntos = Math.max(0, popPuntos - dt * 5);
    pintaMarcador(); pintaPiensa();
  }

  /* ---------- Dibujo ---------- */
  function dibuja(alfa) {
    const c = cVista, pal = L.paleta(c);
    pintaVariables(pal);
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (sacudida > 0) ctx.translate((Math.random() - .5) * sacudida, (Math.random() - .5) * sacudida);
    const t = E && estado === 'jugando' ? E.t + alfa : E ? E.t : 0;
    const desliz = estado === 'jugando' ? alfa * M.VEL : 0;
    const s = mundo + desliz;

    cielo(pal, c);
    astros(pal, c);
    nubes(pal, c, s);
    lejos(pal, c, s);
    palabras(c, s);
    cables(pal, c, s);
    cerca(pal, c, s);
    if (E) for (const tb of E.tubos) tubo(pal, c, M.X0 + tb.k * M.SEP - M.VEL * t, tb);
    suelo(pal, c, s);
    bandada(c);
    const y = estado === 'jugando' ? prevY + (E.y - prevY) * alfa : ave.y;
    for (const q of parts) if (q.t !== 'chispa') particula(pal, q);
    pajaro(pal, c, PX, y, ave.rot, true);
    for (const q of parts) if (q.t === 'chispa') particula(pal, q);
    marcadorLienzo(pal, c);
    efectos(c);
  }

  function cielo(pal, c) {
    const g = ctx.createLinearGradient(0, 0, 0, SUELO);
    g.addColorStop(0, pal.cieloA); g.addColorStop(1, pal.cieloB);
    ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, SUELO + 20);
  }

  function astros(pal, c) {
    // Estrellas: aparecen de noche y se apagan en el vacío.
    const ae = lento(c, 2.2, 3) * (1 - lento(c, 4.5, 5) * .85);
    if (ae > 0) {
      ctx.fillStyle = c > 3.8 ? '#ffd0d0' : '#ffffff';
      for (const e of ESTRELLAS) { ctx.globalAlpha = ae * (.5 + .5 * Math.sin(reloj * 2 + e.f)); ctx.fillRect(e.x, e.y, e.r, e.r); }
      ctx.globalAlpha = 1;
    }
    // El sol baja hasta esconderse detrás de los cerros.
    const sb = lento(c, 0, 2.3);
    if (sb < 1) {
      const sx = 268 - sb * 40, sy = 120 + sb * 400, r = 34 + sb * 10;
      halo(sx, sy, r * 2.8, pal.sol, .45);
      ctx.fillStyle = pal.sol; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.29); ctx.fill();
    }
    // La luna sube; desde la jaula tiene un ojo que sigue al pájaro.
    const lu = lento(c, 2.5, 3.4);
    if (lu > 0) {
      const lx = 250, ly = 520 - lu * 390, r = 30 + lento(c, 3.3, 5) * 14;
      halo(lx, ly, r * 3, pal.sol, .35 + lento(c, 4, 5) * .2);
      ctx.fillStyle = pal.sol; ctx.beginPath(); ctx.arc(lx, ly, r, 0, 6.29); ctx.fill();
      const cr = 1 - lento(c, 3.3, 4);
      if (cr > 0) { // cráteres, que se cierran como párpados
        ctx.fillStyle = 'rgba(0,0,0,.08)';
        for (const [dx, dy, rr] of [[-10, -8, 7], [9, 6, 5], [-4, 12, 4]]) { ctx.beginPath(); ctx.arc(lx + dx, ly + dy, rr * cr, 0, 6.29); ctx.fill(); }
      }
      const ojo = lento(c, 3.3, 4);
      if (ojo > 0) {
        const ab = ojo * (.75 + .25 * Math.abs(Math.sin(reloj * .7))) * (Math.sin(reloj * 1.3) > .985 ? .1 : 1);
        ctx.save(); ctx.beginPath(); ctx.ellipse(lx, ly, r * .82, r * .55 * ab, 0, 0, 6.29); ctx.clip();
        ctx.fillStyle = c > 4.6 ? '#f4f4f4' : '#f7e9d4'; ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
        const ang = Math.atan2(ave.y - ly, PX - lx), d = r * .25;
        const ix = lx + Math.cos(ang) * d, iy = ly + Math.sin(ang) * d;
        ctx.fillStyle = c > 4 ? '#c40d0d' : '#7b2c11'; ctx.beginPath(); ctx.arc(ix, iy, r * .36, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ix, iy, r * .1, r * .3, 0, 0, 6.29); ctx.fill();
        ctx.restore();
      }
    }
  }
  function halo(x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(color, a)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function hexA(h, a) { return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`; }

  function nubes(pal, c, s) {
    ctx.fillStyle = pal.nube;
    ctx.globalAlpha = .9 - lento(c, 3.4, 4.6) * .55;
    const vuelta = W + 260;
    for (const n of NUBES) {
      const x = ((n.x - s * .12) % vuelta + vuelta) % vuelta - 130, y = n.y;
      const k = n.s;
      ctx.beginPath();
      ctx.arc(x, y, 18 * k, 0, 6.29); ctx.arc(x + 22 * k, y - 10 * k, 22 * k, 0, 6.29);
      ctx.arc(x + 48 * k, y - 2 * k, 17 * k, 0, 6.29); ctx.arc(x + 26 * k, y + 6 * k, 18 * k, 0, 6.29);
      ctx.fill();
      // Desde el ocaso, algunas nubes sonríen; en el vacío ya no.
      const cara = lento(c, 3.6, 4.2) * (1 - lento(c, 4.6, 5));
      if (cara > 0 && k > .9) {
        ctx.save(); ctx.globalAlpha = cara * .5; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(x + 16 * k, y - 4 * k, 2.4 * k, 0, 6.29); ctx.arc(x + 32 * k, y - 4 * k, 2.4 * k, 0, 6.29); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + 24 * k, y + 2 * k, 8 * k, .2, 2.94); ctx.stroke(); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  function lejos(pal, c, s) {
    const cerros = 1 - lento(c, 1.6, 2.6), ciudad = lento(c, 1.6, 2.6);
    const base = SUELO - 20;
    if (cerros > 0) {
      ctx.globalAlpha = cerros; ctx.fillStyle = pal.lejos;
      ctx.beginPath(); ctx.moveTo(0, SUELO);
      for (let x = 0; x <= W; x += 6) { const u = x + s * .22; ctx.lineTo(x, base - 50 - Math.sin(u * .012) * 34 - Math.sin(u * .031 + 1) * 14); }
      ctx.lineTo(W, SUELO); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (ciudad > 0) {
      const off = ((s * .3) % ANCHO_CIUDAD + ANCHO_CIUDAD) % ANCHO_CIUDAD;
      const luces = lento(c, 1.2, 2.1) * (1 - lento(c, 3, 3.5)), ojos = lento(c, 3.6, 4.4);
      ctx.globalAlpha = ciudad;
      for (let rep = 0; rep < 2; rep++) for (const b of EDIFICIOS) {
        const x = b.x - off + rep * ANCHO_CIUDAD; if (x > W || x + b.w < 0) continue;
        const y = base - b.h; ctx.fillStyle = pal.lejos; ctx.fillRect(x, y, b.w, b.h + 20);
        if (luces <= 0 && ojos <= 0) continue;
        let i = 0;
        for (let wy = y + 10; wy < base - 8; wy += 16) for (let wx = x + 6; wx < x + b.w - 8; wx += 11) {
          const v = b.v[i++ % b.v.length];
          if (ojos > 0 && v > .82) { // ventanas que se vuelven ojos que parpadean
            const parp = Math.sin(reloj * 1.6 + v * 40) > .93 ? .15 : 1;
            ctx.fillStyle = hexA('#ff1e1e', ojos * .9); ctx.beginPath(); ctx.ellipse(wx + 2.5, wy + 3, 2.6, 1.6 * parp, 0, 0, 6.29); ctx.fill();
          } else if (luces > 0 && v > .55) { ctx.fillStyle = hexA('#ffd36b', luces * (.5 + v * .5)); ctx.fillRect(wx, wy, 5, 7); }
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function palabras(c, s) {
    const a = lento(c, 4.2, 4.9) * .13;
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = c > 4.6 ? '#ffffff' : '#ff3030';
    ctx.font = '400 30px "Lilita One", system-ui, sans-serif'; ctx.textAlign = 'center';
    const vuelta = 900;
    PALABRAS.forEach((p, i) => {
      const x = ((i * 160 - s * .3) % vuelta + vuelta) % vuelta - 120, y = 120 + (i * 97) % 300;
      ctx.fillText(p, x, y + Math.sin(reloj * .6 + i) * 4);
    });
    ctx.restore();
  }

  function cables(pal, c, s) {
    const a = lento(c, 1.3, 2.1) * (1 - lento(c, 3.1, 3.6));
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    const paso = 300, off = ((s * .5) % paso + paso) % paso;
    for (let i = -1; i < 3; i++) {
      const x = i * paso - off;
      ctx.fillStyle = '#1d120e'; ctx.fillRect(x - 3, 300, 6, SUELO - 300); ctx.fillRect(x - 16, 304, 32, 4);
      ctx.strokeStyle = '#1d120e'; ctx.lineWidth = 1.4;
      for (const dy of [0, 10]) { ctx.beginPath(); ctx.moveTo(x - 14, 308 + dy); ctx.quadraticCurveTo(x + paso / 2, 340 + dy, x + paso - 14, 308 + dy); ctx.stroke(); }
      // Pájaros quietos en el cable, mirando al que vuela.
      for (let j = 0; j < 5; j++) {
        const u = .2 + j * .14, bx = x - 14 + (paso) * u, by = 308 + 2 * u * (1 - u) * 32 * 2 - 7;
        ctx.fillStyle = '#1d120e'; ctx.beginPath(); ctx.ellipse(bx, by, 5, 6, 0, 0, 6.29); ctx.fill();
        ctx.beginPath(); ctx.arc(bx, by - 7, 3.6, 0, 6.29); ctx.fill();
        const dir = PX < bx ? -1 : 1;
        ctx.fillStyle = c > 2.5 ? '#ffb000' : '#e9e9e9'; ctx.fillRect(bx + dir * 1.6 - .8, by - 8.2, 1.6, 1.6);
      }
    }
    ctx.restore();
  }

  function cerca(pal, c, s) {
    const base = SUELO;
    ctx.fillStyle = pal.cerca;
    ctx.beginPath(); ctx.moveTo(0, base);
    for (let x = 0; x <= W + 8; x += 8) {
      const u = x + s * .5;
      const espina = lento(c, 3.4, 4.4) * ((u | 0) % 37 < 5 ? 14 : 0);
      ctx.lineTo(x, base - 28 - Math.abs(Math.sin(u * .045)) * 18 - espina);
    }
    ctx.lineTo(W, base); ctx.fill();
  }

  function tubo(pal, c, x, tb) {
    if (x > W + 10 || x + TW < -10) return;
    const arriba = tb.c - tb.g / 2, abajo = tb.c + tb.g / 2;
    const jaula = lento(c, 3.6, 4.4);
    for (const [y0, y1, labio] of [[-20, arriba, arriba], [abajo, SUELO, abajo]]) {
      const haciaArriba = labio === arriba;
      if (jaula < 1) {
        ctx.globalAlpha = 1 - jaula * .9;
        const g = ctx.createLinearGradient(x, 0, x + TW, 0);
        g.addColorStop(0, pal.tuboSombra); g.addColorStop(.22, pal.tubo); g.addColorStop(.38, pal.tuboLuz); g.addColorStop(.55, pal.tubo); g.addColorStop(1, pal.tuboSombra);
        ctx.fillStyle = g; ctx.fillRect(x + 3, y0, TW - 6, y1 - y0);
        ctx.strokeStyle = pal.borde; ctx.lineWidth = 3; ctx.strokeRect(x + 3, y0, TW - 6, y1 - y0);
        const ly = haciaArriba ? labio - 26 : labio;
        const g2 = ctx.createLinearGradient(x - 4, 0, x + TW + 4, 0);
        g2.addColorStop(0, pal.tuboSombra); g2.addColorStop(.2, pal.tubo); g2.addColorStop(.36, pal.tuboLuz); g2.addColorStop(.55, pal.tubo); g2.addColorStop(1, pal.tuboSombra);
        ctx.fillStyle = g2; ctx.fillRect(x - 4, ly, TW + 8, 26);
        ctx.strokeRect(x - 4, ly, TW + 8, 26);
        // Óxido: manchas fijas por tubo.
        const ox = lento(c, 1.8, 2.6);
        if (ox > 0) {
          ctx.fillStyle = hexA('#7a3a12', ox * .55);
          for (let i = 0; i < 4; i++) {
            const h = L.hashTexto('o' + tb.k + i + haciaArriba), px = x + 6 + (h % 50), py = haciaArriba ? labio - 40 - (h >>> 8) % 160 : labio + 32 + (h >>> 8) % 120;
            if (py < y0 || py > y1) continue;
            ctx.beginPath(); ctx.ellipse(px, py, 4 + (h % 7), 3 + (h >>> 4) % 6, 0, 0, 6.29); ctx.fill();
          }
          ctx.fillRect(x - 4, haciaArriba ? labio - 4 : labio + 22, TW + 8, 4 * ox);
        }
        ctx.globalAlpha = 1;
      }
      // Lo que gotea del borde del tubo de arriba.
      const go = lento(c, 2.8, 3.4) * (1 - jaula * .5);
      if (go > 0 && haciaArriba) {
        ctx.fillStyle = hexA('#5a0606', go * .9);
        for (let i = 0; i < 3; i++) {
          const h = L.hashTexto('g' + tb.k + i), gx = x + 6 + (h % (TW - 12)), ciclo = ((reloj * .35 + (h % 100) / 100) % 1);
          const largo = 6 + ciclo * 22;
          ctx.fillRect(gx, labio, 2.5, largo);
          ctx.beginPath(); ctx.arc(gx + 1.2, labio + largo, 2.4, 0, 6.29); ctx.fill();
        }
      }
      if (jaula > 0) barrotes(pal, x, y0, y1, labio, haciaArriba, jaula);
    }
  }
  function barrotes(pal, x, y0, y1, labio, haciaArriba, f) {
    ctx.save(); ctx.globalAlpha = f;
    const metal = ctx.createLinearGradient(0, 0, 6, 0);
    ctx.strokeStyle = pal.borde; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const bx = x + 3 + i * ((TW - 12) / 4);
      const g = ctx.createLinearGradient(bx, 0, bx + 6, 0);
      g.addColorStop(0, pal.tuboSombra); g.addColorStop(.4, pal.tuboLuz); g.addColorStop(1, pal.tuboSombra);
      ctx.fillStyle = g; ctx.fillRect(bx, y0, 6, y1 - y0); ctx.strokeRect(bx, y0, 6, y1 - y0);
    }
    void metal;
    ctx.fillStyle = pal.tubo;
    for (let y = haciaArriba ? labio - 70 : labio + 60; haciaArriba ? y > y0 : y < y1; y += haciaArriba ? -90 : 90) { ctx.fillRect(x - 2, y, TW + 4, 6); ctx.strokeRect(x - 2, y, TW + 4, 6); }
    const ly = haciaArriba ? labio - 12 : labio;
    ctx.fillStyle = pal.tuboLuz; ctx.fillRect(x - 6, ly, TW + 12, 12); ctx.strokeRect(x - 6, ly, TW + 12, 12);
    // Remaches.
    ctx.fillStyle = pal.borde;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + 2 + i * ((TW - 4) / 3), ly + 6, 1.8, 0, 6.29); ctx.fill(); }
    ctx.restore();
  }

  function suelo(pal, c, s) {
    ctx.fillStyle = pal.suelo; ctx.fillRect(-20, SUELO, W + 40, H - SUELO + 20);
    ctx.fillStyle = pal.sueloTop; ctx.fillRect(-20, SUELO, W + 40, 16);
    ctx.save(); ctx.beginPath(); ctx.rect(-20, SUELO, W + 40, 16); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    const off = s % 24;
    for (let x = -24 - off; x < W + 24; x += 24) { ctx.beginPath(); ctx.moveTo(x, SUELO + 16); ctx.lineTo(x + 12, SUELO); ctx.lineTo(x + 24, SUELO); ctx.lineTo(x + 12, SUELO + 16); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = pal.borde; ctx.fillRect(-20, SUELO - 2, W + 40, 3); ctx.fillRect(-20, SUELO + 16, W + 40, 2);
    // Tierra con piedritas; desde la jaula, huesos y plumas.
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    for (let i = 0; i < 18; i++) { const x = ((i * 47 - s) % 400 + 400) % 400 - 20; ctx.fillRect(x, SUELO + 30 + (i * 13) % 40, 6, 3); }
    const hu = lento(c, 3.8, 4.6);
    if (hu > 0) {
      ctx.save(); ctx.globalAlpha = hu;
      for (const o of OSARIO) {
        const x = ((o.x - s) % 480 + 480) % 480 - 40;
        ctx.save(); ctx.translate(x, o.y); ctx.rotate(o.a);
        if (o.t === 'hueso') {
          ctx.fillStyle = '#d9d2c3'; ctx.fillRect(-7, -1.5, 14, 3);
          for (const dx of [-7, 7]) { ctx.beginPath(); ctx.arc(dx, -1.6, 2.2, 0, 6.29); ctx.arc(dx, 1.6, 2.2, 0, 6.29); ctx.fill(); }
        } else plumaForma(pal.ala);
        ctx.restore();
      }
      ctx.restore();
    }
  }
  function plumaForma(color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, 7, 2.6, 0, 0, 6.29); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(7, 0); ctx.stroke();
  }

  // La bandada: vuela con el pájaro en la mañana y luego se le adelanta y se va.
  function bandada(c) {
    const ida = lento(c, .6, 1.5);
    if (ida >= 1 || estado === 'fin' || estado === 'muerte') return;
    for (const b of BANDADA) {
      const x = PX + b.dx + ida * 420, y = M.Y0 + b.dy + Math.sin(reloj * 3 + b.f) * 10 - ida * 60;
      const pal = { pajaro: b.c, ala: b.c, vientre: '#ffffff', pico: '#ff9d2b', ojo: '#1a1a1a', borde: '#24303d' };
      ctx.save(); ctx.globalAlpha = 1 - ida * .4; ctx.translate(x, y); ctx.scale(.62, .62);
      pajaroCuerpo(pal, 0, 0, -.1 + Math.sin(reloj * 3 + b.f) * .1, reloj * 14 + b.f, 0);
      ctx.restore();
    }
  }

  function pajaro(pal, c, x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const k = ave.aplasta * .18; ctx.scale(1 + k, 1 - k);
    pajaroCuerpo(pal, 0, 0, 0, ave.ala, c);
    ctx.restore();
  }
  // El pájaro, dibujado a mano: cuerpo, panza, ala en tres posiciones, ojo y pico.
  function pajaroCuerpo(pal, x, y, rot, ala, c) {
    const borde = pal.borde === '#000000' ? '#3a3a3a' : '#1b130b';
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    const flaco = lento(c, 4.4, 5) * .25;
    ctx.lineWidth = 2.2; ctx.strokeStyle = borde;
    // Cola.
    ctx.fillStyle = pal.ala; ctx.beginPath(); ctx.moveTo(-13, -2); ctx.lineTo(-22, -7); ctx.lineTo(-21, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Cuerpo.
    ctx.fillStyle = pal.pajaro; ctx.beginPath(); ctx.ellipse(0, 0, 15 * (1 - flaco * .3), 12 * (1 - flaco), 0, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.vientre; ctx.beginPath(); ctx.ellipse(3, 5, 9, 5.5 * (1 - flaco), .1, 0, 6.29); ctx.fill();
    // Costillas, cuando ya no queda casi nada.
    const hueso = lento(c, 4.5, 5);
    if (hueso > 0) {
      ctx.strokeStyle = hexA('#1a1a1a', hueso * .8); ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-6 + i * 4.5, 1, 6, .4, 2.4); ctx.stroke(); }
      ctx.lineWidth = 2.2; ctx.strokeStyle = borde;
    }
    // Ala: tres cuadros (arriba, medio, abajo) según la fase.
    const fase = Math.floor(((ala % 3) + 3) % 3);
    const ay = [-7, 0, 6][fase], ar = [-.6, 0, .55][fase];
    ctx.fillStyle = pal.ala; ctx.beginPath(); ctx.ellipse(-4, ay, 8, 5, ar, 0, 6.29); ctx.fill(); ctx.stroke();
    // Ojo.
    const rojo = lento(c, 3.6, 4.2);
    ctx.fillStyle = rojo > .5 ? '#2a0000' : '#ffffff'; ctx.beginPath(); ctx.arc(7, -5, 5.4, 0, 6.29); ctx.fill(); ctx.stroke();
    if (rojo > 0) halo(9, -5, 9, '#ff2020', rojo * .5);
    ctx.fillStyle = pal.ojo; ctx.beginPath(); ctx.arc(8.6, -5, 2.4 + rojo * .6, 0, 6.29); ctx.fill();
    if (rojo < .5) { ctx.fillStyle = '#ffffff'; ctx.fillRect(8.8, -6.6, 1.2, 1.2); }
    // Pico.
    ctx.fillStyle = pal.pico;
    ctx.beginPath(); ctx.moveTo(10, -1); ctx.lineTo(21, 1); ctx.lineTo(10, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 3.5); ctx.lineTo(18, 5); ctx.lineTo(10, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function particula(pal, q) {
    const a = clamp(q.v * 2, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    if (q.t === 'pluma') { ctx.translate(q.x, q.y); ctx.rotate(q.a); plumaForma(cVista > 4.4 ? '#9a9a9a' : pal.ala); }
    else if (q.t === 'chispa') { ctx.fillStyle = cVista > 3.6 ? '#ff4040' : '#fff6b0'; ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3); }
    else { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1.6 - a * .6), 0, 6.29); ctx.fill(); }
    ctx.restore();
  }

  function marcadorLienzo(pal, c) {
    if (estado === 'listo' || estado === 'fin' || !E) return;
    const p = String(E.puntos), k = 1 + popPuntos * .28;
    ctx.save(); ctx.translate(W / 2, 74); ctx.scale(k, k);
    ctx.font = '400 54px "Lilita One", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = c > 3.6 ? '#000000' : '#1b2a3d';
    ctx.strokeText(p, 0, 0);
    ctx.fillStyle = c > 4 ? L.mezclaHex('#ffffff', '#ff2a2a', lento(c, 4, 4.8)) : '#ffffff';
    ctx.fillText(p, 0, 0);
    ctx.restore();
  }

  function efectos(c) {
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    const vi = lento(c, 2.6, 4.2) * .7 + lento(c, 4.6, 5) * .2;
    if (vi > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * .22, W / 2, H / 2, H * .72);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(${c > 3.8 && c < 4.7 ? '40,0,0' : '0,0,0'},${vi})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    const gr = lento(c, 3.6, 4.6) * .1;
    if (gr > 0) {
      ctx.save(); ctx.globalAlpha = gr; ctx.globalCompositeOperation = 'overlay';
      const ox = Math.random() * 128, oy = Math.random() * 128;
      for (let x = -ox; x < W; x += 128) for (let y = -oy; y < H; y += 128) ctx.drawImage(grano, x, y);
      ctx.restore();
    }
    if (destello > 0) { ctx.fillStyle = `rgba(255,255,255,${destello * .85})`; ctx.fillRect(0, 0, W, H); }
  }

  /* ---------- Copia de la cuenta y récord de la tabla ---------- */
  if (Club && Club.pedirPartida) Club.pedirPartida(dato => {
    let nube = null;
    try { nube = dato && typeof dato.d === 'string' ? JSON.parse(dato.d) : null; } catch (_) { nube = null; }
    const junta = M.mezclaProgreso(prog, nube);
    const faltaAlla = JSON.stringify(junta) !== JSON.stringify(M.mezclaProgreso(nube, null));
    prog = junta; guarda('aleteo.progreso', prog);
    if (faltaAlla) subeNube(true);
  });

  /* ---------- Mando ---------- */
  if (window.Mando) {
    window.Mando.configura({
      botones: { a: 'Space', b: 'Space', rb: 'Space', start: 'KeyP' },
      objetivo: () => lienzo,
      menu: () => estado === 'fin' || pausado,
      inicio: () => pausado ? $('btnSeguir') : $('btnOtra'),
      pistas: [['a', 'aletear'], ['start', 'pausa']],
      zonas: [{ sel: '#nota' }]
    });
  }

  /* ---------- Ganchos para probar desde la consola ----------
     Cualquiera que cambie el vuelo lo marca: se juega, pero no se manda. */
  window.__aleteo = {
    estado: () => ({ estado, pausado, c: cVista, puntos: E ? E.puntos : 0, t: E ? E.t : 0, prog: { ...prog } }),
    corrupcion(c) { tocado = true; cVista = clamp(+c || 0, 0, 5); },
    salta(p) { if (!E) return; tocado = true; E.puntos = Math.max(0, p | 0); },
  };

  /* ---------- Arranque ---------- */
  const tactil = matchMedia('(pointer:coarse)').matches;
  $('nota').innerHTML = (tactil
    ? 'Toca la pantalla para aletear. Pasa entre los tubos sin tocarlos ni caer. '
    : 'Clic, <kbd>Espacio</kbd> o <kbd>↑</kbd> para aletear; <kbd>P</kbd> o <kbd>Esc</kbd> para pausar. Pasa entre los tubos sin tocarlos ni caer. ') +
    (document.documentElement.classList.contains('club-integrado')
      ? 'Tu mejor vuelo se guarda en tu cuenta.'
      : 'Tu mejor vuelo vive en este navegador; juega desde Juegos para entrar en la clasificación.');
  $('listoTecla').textContent = tactil ? 'Toca para aletear' : 'Clic o Espacio para aletear';

  function ajustaPantalla() {
    let w = innerWidth, h = innerHeight;
    try { w = window.top.innerWidth; h = window.top.innerHeight; } catch (_) { /* otra página */ }
    const raiz = document.documentElement;
    raiz.style.setProperty('--alto-pantalla', h + 'px');
    raiz.classList.toggle('apaisado', w > h && h < 560);
  }
  ajustaPantalla();
  addEventListener('resize', ajustaPantalla);
  addEventListener('orientationchange', ajustaPantalla);
  try { if (window.top !== window) window.top.addEventListener('resize', ajustaPantalla); } catch (_) { /* nada */ }

  let sincronizado = false;
  addEventListener('club-record', e => {
    if (sincronizado || !e.detail || e.detail.categoria !== CATEGORIA) return;
    sincronizado = true;
  });
  addEventListener('club-rechazo', e => { if (e.detail && e.detail.categoria === CATEGORIA) $('finFrase').textContent = 'Este vuelo no se guardó: ' + (e.detail.motivo || ''); });

  if (Club) Club.category(CATEGORIA);
  mide();
  pintaMarcador();
  requestAnimationFrame(t => { ultimo = t; frame(t); });
})();
