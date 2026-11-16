/* Ajedrez Club — la pantalla.
   Las reglas, el bot y la comprobación de los puzles están en motor.js; los
   puzles en puzles.js (generado). Aquí se dibuja el tablero, se mueve con el
   dedo o el ratón, se suena y se lleva la cuenta.

   Dos modos, con sus tablas:
   - **Contra bots** (`club-ajedrez-bot1` … `bot4`): puntos = 1 fijo, tiempo
     = lo que pensó el jugador en sus jugadas (el bot no cuenta). Solo se
     manda una victoria por mate. La prueba lleva la semilla, el nivel, el
     color y las jugadas del jugador con sus ms; las del bot se vuelven a
     calcular en el verificador (el bot es determinista).
   - **Puzles** (`club-ajedrez-puzles`): puntos = estrellas de todos los
     puzles, tiempo = la suma de los ms del intento que cuenta en cada uno.
     La prueba lleva el mejor intento de cada puzle; se manda solo cuando el
     total mejora (cada envío es una jugada del club que paga).

   El tablero es DOM: 64 casillas en una grilla y, encima, una capa de
   piezas (<img>) colocadas con translate(%) de su propio tamaño, así que
   una jugada es cambiar un transform y la transición de CSS la desliza. */
(() => {
  'use strict';
  const M = window.AjedrezMotor, PZ = window.AjedrezPuzles, Club = window.Club;
  const $ = id => document.getElementById(id);
  const CAT_BOT = n => 'club-ajedrez-bot' + n, CAT_PUZ = 'club-ajedrez-puzles';
  const TODOS = PZ.TODOS, POR_ID = new Map(TODOS.map((p, i) => [p.id, i]));
  const MAX_ESTRELLAS = TODOS.length * 3;
  const DESCRIPCION = {
    1: 'Mira una jugada y a veces mueve cualquier cosa. Para aprender.',
    2: 'Ve los cambios de piezas, pero se le escapan las combinaciones.',
    3: 'Calcula tres medias jugadas. Castiga las piezas sueltas.',
    4: 'Cuatro medias jugadas y todos los cambios. Hay que jugar bien.'
  };
  const AVATAR = { 1: '🐣', 2: '🦊', 3: '🦉', 4: '🐉' };

  /* ---------- Guardado ---------- */
  const CUENTA = Club && Club.storageKey ? Club.storageKey('').replace(/^\.cuenta\./, '') : 'local';
  const clave = k => Club && Club.storageKey ? Club.storageKey(k) : k + '.cuenta.local';
  const lee = (k, crudo) => { try { return JSON.parse(localStorage.getItem(crudo ? k : clave(k)) || 'null'); } catch (_) { return null; } };
  const guarda = (k, v, crudo) => { try { localStorage.setItem(crudo ? k : clave(k), JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } };
  const datos = Object.assign({ bots: {}, puz: {}, mandado: null }, lee('ajedrezclub.datos') || {});
  for (const n of [1, 2, 3, 4]) datos.bots[n] = Object.assign({ mejor: 0, ganadas: 0, jugadas: 0 }, datos.bots[n] || {});
  const pref = Object.assign({ modo: 'bots', nivel: 1, color: 'azar', mudo: false, piezas: '' }, lee('ajedrezclub.pref', true) || {});
  try { const g = localStorage.getItem('jg.ajPiezas'); if (!pref.piezas && g) pref.piezas = g; } catch (_) { /* nada */ }
  if (!['cburnett', 'chessnut', 'fantasy', 'celtic'].includes(pref.piezas)) pref.piezas = 'cburnett';
  const guardaDatos = () => guarda('ajedrezclub.datos', datos);
  const guardaPref = () => guarda('ajedrezclub.pref', pref, true);

  /* ---------- Sonido (WebAudio; volumen.js lo gobierna) ---------- */
  const Son = (() => {
    let ctx = null, ruido = null;
    function c() {
      if (pref.mudo) return null;
      if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return null; } }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!ruido) { ruido = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate); const d = ruido.getChannelData(0); let s = 7; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 1073741823 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012)); } }
      return ctx;
    }
    function golpe(frec, vol, cuando) {
      const x = c(); if (!x) return;
      const t = x.currentTime + (cuando || 0), s = x.createBufferSource(), f = x.createBiquadFilter(), g = x.createGain();
      s.buffer = ruido; f.type = 'bandpass'; f.frequency.value = frec; f.Q.value = 3;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      s.connect(f); f.connect(g); g.connect(x.destination); s.start(t); s.stop(t + 0.2);
    }
    function tono(frec, dur, vol, cuando, tipo) {
      const x = c(); if (!x) return;
      const t = x.currentTime + (cuando || 0), o = x.createOscillator(), g = x.createGain();
      o.type = tipo || 'triangle'; o.frequency.value = frec;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(x.destination); o.start(t); o.stop(t + dur + 0.05);
    }
    return {
      mover: () => golpe(900, 0.9),
      capturar: () => { golpe(600, 1.2); golpe(1400, 0.5, 0.03); },
      jaque: () => { tono(880, 0.18, 0.12); tono(1175, 0.22, 0.1, 0.09); },
      enroque: () => { golpe(900, 0.8); golpe(800, 0.8, 0.09); },
      error: () => { tono(196, 0.25, 0.14, 0, 'sawtooth'); tono(185, 0.3, 0.1, 0.08, 'sawtooth'); },
      bien: () => tono(1046, 0.14, 0.08),
      ganar: () => [523, 659, 784, 1046].forEach((f, i) => tono(f, 0.35, 0.12, i * 0.11)),
      perder: () => [392, 330, 262].forEach((f, i) => tono(f, 0.4, 0.1, i * 0.16)),
      tablas: () => [440, 440].forEach((f, i) => tono(f, 0.3, 0.09, i * 0.2))
    };
  })();
  const btnSonido = $('sound-button');
  function pintaSonido() { btnSonido.setAttribute('aria-pressed', String(!pref.mudo)); btnSonido.classList.toggle('apagado', pref.mudo); btnSonido.title = pref.mudo ? 'Activar efectos' : 'Silenciar efectos'; }
  btnSonido.addEventListener('click', () => { pref.mudo = !pref.mudo; guardaPref(); pintaSonido(); });
  pintaSonido();

  /* ---------- Utilidades ---------- */
  const reloj = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const relojFino = ms => { const s = ms / 1000; return s < 60 ? s.toFixed(1) + ' s' : reloj(ms); };
  const ahoraA = () => performance.now();
  const semillaNueva = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff; } catch (_) { return (Date.now() * 2654435761) & 0x7fffffff; } };
  const estrellasTxt = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  const LETRAS = ' PNBRQK';
  const srcPieza = pz => `../../ajedrez/piezas/${pref.piezas}/${pz > 0 ? 'w' : 'b'}${LETRAS[Math.abs(pz)]}.svg`;

  /* ---------- Estado ---------- */
  let modo = pref.modo === 'puzles' ? 'puzles' : 'bots';
  let P = M.inicial();          // la posición que se ve
  let orient = 1;               // 1: blancas abajo
  let G = null;                 // la partida contra el bot
  let Z = null;                 // el puzle abierto
  let sel = -1, destinos = [], ultima = null, pista = -1, errorEn = -1, cursor = -1, porTeclado = false;
  let pensando = false, alCoronar = null;
  let worker = null, pedido = 0;

  const escenario = $('escenario'), tablero = $('tablero'), capa = $('piezas');
  const casillas = new Map(), elems = new Map();

  /* ---------- Tablero ---------- */
  for (let f = 7; f >= 0; f--) for (let col = 0; col < 8; col++) {
    const c = f * 16 + col, d = document.createElement('div');
    d.className = 'casilla ' + ((f + col) % 2 ? 'clara' : 'oscura');
    d.dataset.c = c; d.setAttribute('role', 'gridcell');
    tablero.appendChild(d); casillas.set(c, d);
  }
  const vis = c => orient > 0 ? [c & 7, 7 - (c >> 4)] : [7 - (c & 7), c >> 4];
  function colocaCasillas() {
    for (const [c, d] of casillas) {
      const [x, y] = vis(c);
      d.style.gridColumn = x + 1; d.style.gridRow = y + 1;
      d.innerHTML = (y === 7 ? `<span class="coord col">${'abcdefgh'[c & 7]}</span>` : '') + (x === 0 ? `<span class="coord fila">${(c >> 4) + 1}</span>` : '');
    }
  }
  function ponEn(el, c) { const [x, y] = vis(c); el.style.transform = `translate(${x * 100}%,${y * 100}%)`; }
  function nuevaPieza(pz, c) {
    const el = document.createElement('img');
    el.className = 'pieza'; el.alt = ''; el.draggable = false; el.src = srcPieza(pz); el.dataset.pz = pz;
    ponEn(el, c); capa.appendChild(el); elems.set(c, el);
    return el;
  }
  /* Deja la capa de piezas igual que P, sin animar lo que ya está bien. */
  function sincroniza() {
    for (const [c, el] of elems) if (!P.t[c] || +el.dataset.pz !== P.t[c]) { el.remove(); elems.delete(c); }
    for (let c = 0; c < 128; c++) {
      if (c & 0x88) { c += 7; continue; }
      if (P.t[c] && !elems.has(c)) nuevaPieza(P.t[c], c);
      else if (elems.has(c)) ponEn(elems.get(c), c);
    }
  }
  function redibuja() { for (const el of elems.values()) el.remove(); elems.clear(); colocaCasillas(); sincroniza(); pintaMarcas(); }
  /* Juega `m` en P y lo anima: la pieza se desliza, la capturada se va. */
  function juegaVisual(m) {
    const de = M.DE(m), a = M.A(m), f = M.BANDERAS(m), lado = P.lado;
    const capturada = f & 2 ? a - 16 * lado : a;
    const sanTxt = M.san(P, m);
    const quita = elems.get(capturada);
    if (quita && capturada !== de) { quita.classList.add('sale'); elems.delete(capturada); setTimeout(() => quita.remove(), 220); }
    const el = elems.get(de);
    if (el) { elems.delete(de); elems.set(a, el); el.classList.remove('arrastrando'); ponEn(el, a); }
    if (f & 4) {
      const td = a > de ? de + 3 : de - 4, ta = a > de ? de + 1 : de - 1, t = elems.get(td);
      if (t) { elems.delete(td); elems.set(ta, t); ponEn(t, ta); }
    }
    M.hacer(P, m);
    if (M.CORONA(m) && el) { el.src = srcPieza(P.t[a]); el.dataset.pz = P.t[a]; }
    sincroniza();
    ultima = [de, a]; sel = -1; destinos = []; pista = -1;
    if (M.enJaque(P)) Son.jaque(); else if (f & 4) Son.enroque(); else if (f & 1) Son.capturar(); else Son.mover();
    pintaMarcas();
    return sanTxt;
  }
  function pintaMarcas() {
    const rey = M.enJaque(P) ? (P.lado > 0 ? P.reyB : P.reyN) : -1;
    const dest = new Set(destinos.map(M.A));
    for (const [c, d] of casillas) {
      d.classList.toggle('sel', c === sel);
      d.classList.toggle('ultima', !!ultima && (c === ultima[0] || c === ultima[1]));
      d.classList.toggle('jaque', c === rey);
      d.classList.toggle('destino', dest.has(c) && !P.t[c]);
      d.classList.toggle('captura', dest.has(c) && !!P.t[c]);
      d.classList.toggle('pista', c === pista);
      d.classList.toggle('error', c === errorEn);
      d.classList.toggle('cursor', porTeclado && c === cursor);
    }
    pintaMaterial();
  }
  function pintaMaterial() {
    const V = [0, 1, 3, 3, 5, 9, 0];
    let d = 0;
    for (let c = 0; c < 128; c++) { if (c & 0x88) { c += 7; continue; } const pz = P.t[c]; if (pz) d += Math.sign(pz) * V[Math.abs(pz)]; }
    const abajo = orient > 0 ? d : -d;
    $('perAbajo').textContent = abajo > 0 ? '+' + abajo : '';
    $('perArriba').textContent = abajo < 0 ? '+' + -abajo : '';
  }

  /* ---------- Turno e interacción ---------- */
  const ladoJugador = () => modo === 'bots' ? (G ? (G.color === 'n' ? -1 : 1) : 1) : (Z ? Z.lado : 1);
  function puedeMover() {
    if (alCoronar) return false;
    if (modo === 'bots') return !!G && !G.fin && !pensando && P.lado === ladoJugador();
    return !!Z && !Z.resuelto && !Z.ocupado && P.lado === Z.lado;
  }
  function selecciona(c) {
    sel = c;
    destinos = c >= 0 ? M.legales(P).filter(m => M.DE(m) === c) : [];
    pintaMarcas();
  }
  function intenta(de, a) {
    const ops = M.legales(P).filter(m => M.DE(m) === de && M.A(m) === a);
    if (!ops.length) return false;
    if (ops.length > 1) { pideCorona(ops, a); return true; }
    jugadorJuega(ops[0]);
    return true;
  }
  function pideCorona(ops, a) {
    const caja = $('corona'), lado = P.lado;
    alCoronar = m => { caja.hidden = true; alCoronar = null; jugadorJuega(m); };
    caja.innerHTML = [M.DA, M.TO, M.AL, M.CA].map(t => `<button type="button" data-t="${t}" title="${['', '', 'Caballo', 'Alfil', 'Torre', 'Dama'][t]}"><img src="${srcPieza(t * lado)}" alt=""></button>`).join('')
      + '<button type="button" class="cancela" data-t="0" title="Cancelar">✕</button>';
    const [x] = vis(a); caja.style.left = Math.min(x, 6) * 12.5 + '%';
    caja.hidden = false;
    caja.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      const t = +b.dataset.t;
      if (!t) { caja.hidden = true; alCoronar = null; selecciona(-1); sincroniza(); return; }
      alCoronar(ops.find(m => M.CORONA(m) === t));
    };
  }
  function casillaEn(ev) {
    const r = tablero.getBoundingClientRect();
    const x = Math.floor((ev.clientX - r.left) / r.width * 8), y = Math.floor((ev.clientY - r.top) / r.height * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
    return orient > 0 ? (7 - y) * 16 + x : y * 16 + (7 - x);
  }
  let arrastre = null;
  escenario.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 || ev.target.closest('.capa,.corona')) return;
    porTeclado = false;
    if (!puedeMover()) return;
    const c = casillaEn(ev); if (c < 0) return;
    const mia = P.t[c] && Math.sign(P.t[c]) === P.lado;
    if (sel >= 0 && !mia && destinos.some(m => M.A(m) === c)) { intenta(sel, c); ev.preventDefault(); return; }
    if (!mia) { selecciona(-1); return; }
    const yaEstaba = sel === c;
    selecciona(c);
    const el = elems.get(c);
    arrastre = { c, el, x: ev.clientX, y: ev.clientY, movio: false, yaEstaba, id: ev.pointerId };
    try { escenario.setPointerCapture(ev.pointerId); } catch (_) { /* nada */ }
    ev.preventDefault();
  });
  escenario.addEventListener('pointermove', ev => {
    if (!arrastre || ev.pointerId !== arrastre.id) return;
    if (!arrastre.movio && Math.hypot(ev.clientX - arrastre.x, ev.clientY - arrastre.y) < 5) return;
    arrastre.movio = true;
    const r = tablero.getBoundingClientRect(), el = arrastre.el; if (!el) return;
    el.classList.add('arrastrando');
    const x = (ev.clientX - r.left) / r.width * 8 - 0.5, y = (ev.clientY - r.top) / r.height * 8 - 0.5;
    el.style.transform = `translate(${x * 100}%,${y * 100}%)`;
  });
  function sueltaArrastre(ev) {
    if (!arrastre || ev.pointerId !== arrastre.id) return;
    const a = arrastre; arrastre = null;
    if (a.el) a.el.classList.remove('arrastrando');
    if (a.movio) {
      const c = casillaEn(ev);
      if (c >= 0 && c !== a.c && intenta(a.c, c)) return;
      if (a.el) ponEn(a.el, a.c);
    } else if (a.yaEstaba) selecciona(-1);
  }
  escenario.addEventListener('pointerup', sueltaArrastre);
  escenario.addEventListener('pointercancel', sueltaArrastre);
  escenario.addEventListener('contextmenu', ev => { ev.preventDefault(); selecciona(-1); sincroniza(); });

  /* Teclado (y mando, que manda flechas): un cursor sobre el tablero;
     Enter o Espacio hacen lo mismo que tocar esa casilla. */
  document.addEventListener('keydown', ev => {
    if (ev.target.closest && ev.target.closest('input,select,textarea')) return;
    if (ev.key === 'Escape') { if (!$('menu').hidden && (G || Z)) cierraMenu(); else abreMenu(); return; }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (!$('menu').hidden || !$('fin').hidden) return;
    if (dir) {
      ev.preventDefault(); porTeclado = true;
      if (cursor < 0) cursor = orient > 0 ? 0x14 : 0x63;
      let [x, y] = vis(cursor); x = Math.max(0, Math.min(7, x + dir[0])); y = Math.max(0, Math.min(7, y + dir[1]));
      cursor = orient > 0 ? (7 - y) * 16 + x : y * 16 + (7 - x);
      pintaMarcas(); return;
    }
    if ((ev.key === 'Enter' || ev.key === ' ') && porTeclado && cursor >= 0) {
      ev.preventDefault();
      if (!puedeMover()) return;
      const mia = P.t[cursor] && Math.sign(P.t[cursor]) === P.lado;
      if (sel >= 0 && !mia && destinos.some(m => M.A(m) === cursor)) intenta(sel, cursor);
      else selecciona(mia && sel !== cursor ? cursor : -1);
    }
  });

  function jugadorJuega(m) {
    if (modo === 'bots') juegaBot(m); else juegaPuzle(m);
  }

  /* ---------- Contra el bot ---------- */
  function guardaPartida() {
    if (!G || G.fin) { guarda('ajedrezclub.partida', null); return; }
    guarda('ajedrezclub.partida', { nivel: G.nivel, color: G.color, semilla: G.semilla, j: G.j, t: G.t, w: G.w, movs: G.movs, desde: G.desdeW });
  }
  function empiezaBot(nivel, color) {
    const c = color === 'azar' ? (semillaNueva() & 1 ? 'b' : 'n') : color;
    G = { nivel, color: c, semilla: semillaNueva(), j: [], t: [], w: 0, movs: [], san: [], fin: null };
    datos.bots[nivel].jugadas++; guardaDatos();
    montaBot();
  }
  function montaBot(retomada) {
    modo = 'bots'; Z = null;
    if (Club) Club.category(CAT_BOT(G.nivel));
    P = M.inicial(); G.san = [];
    for (const s of G.movs) { const m = M.deUci(P, s); if (!m) { G = null; return abreMenu(); } G.san.push(M.san(P, m)); M.hacer(P, m); }
    orient = G.color === 'n' ? -1 : 1;
    ultima = null; sel = -1; destinos = []; errorEn = -1; pista = -1;
    redibuja();
    $('nomArriba').textContent = 'Bot ' + M.NIVELES[G.nivel].nombre; $('avArriba').textContent = AVATAR[G.nivel];
    $('nomAbajo').textContent = 'Tú'; $('avAbajo').textContent = G.color === 'n' ? '♚' : '♔';
    ocultaFin(); cierraMenu(); pintaBotones(); pintaJugadas(); pintaMarcador();
    if (!retomada) { G.desdeA = ahoraA(); G.desdeW = Date.now(); }
    aviso(G.color === 'n' && !G.movs.length ? 'Juegas con negras: empieza el bot.' : '');
    sigueBot();
    guardaPartida();
  }
  function sigueBot() {
    if (!G || G.fin) return;
    const f = M.fin(P);
    if (f) return terminaBot(f);
    if (P.lado !== ladoJugador()) pideBot();
    else { G.desdeA = G.desdeA || ahoraA(); G.desdeW = G.desdeW || Date.now(); pintaBotones(); }
  }
  function juegaBot(m) {
    const dt = Math.max(0, Math.round(ahoraA() - G.desdeA)), dw = Math.max(0, Date.now() - G.desdeW);
    G.j.push(M.uci(m)); G.t.push(dt); G.w += dw; G.movs.push(M.uci(m));
    G.san.push(juegaVisual(m));
    G.desdeA = 0; G.desdeW = 0;
    pintaJugadas(); guardaPartida(); pintaMarcador();
    sigueBot();
  }
  function pideBot() {
    pensando = true; pintaBotones();
    aviso('El bot ' + M.NIVELES[G.nivel].nombre + ' piensa…');
    const id = ++pedido, desde = Date.now(), g = G;
    const espera = G.nivel === 1 ? 350 : 550;
    const responde = r => {
      if (id !== pedido || G !== g || G.fin) return;
      const m = r && r.uci ? M.deUci(P, r.uci) : 0;
      if (!m) { pensando = false; aviso('El bot no pudo pensar (' + (r && r.error || 'sin respuesta') + '). Recarga la página.'); return; }
      setTimeout(() => {
        if (id !== pedido || G !== g || G.fin) return;
        pensando = false;
        G.movs.push(M.uci(m)); G.san.push(juegaVisual(m));
        G.desdeA = ahoraA(); G.desdeW = Date.now();
        aviso(''); pintaJugadas(); guardaPartida(); pintaBotones();
        sigueBot();
      }, Math.max(0, espera - (Date.now() - desde)));
    };
    const datosPedido = { id, movs: G.movs.slice(), nivel: G.nivel, semilla: M.semillaCuenta(G.semilla, CUENTA) };
    if (!worker && window.Worker) {
      try { worker = new Worker('bot.js?v=ajedrez-1'); worker.onmessage = e => { const f = esperas.get(e.data.id); if (f) { esperas.delete(e.data.id); f(e.data); } }; worker.onerror = () => { worker = false; }; } catch (_) { worker = false; }
    }
    if (worker) { esperas.set(id, responde); worker.postMessage(datosPedido); setTimeout(() => { if (esperas.has(id) && worker === false) { esperas.delete(id); calculaAqui(datosPedido, responde); } }, 1500); }
    else calculaAqui(datosPedido, responde);
  }
  const esperas = new Map();
  /* Sin worker (navegador viejo, archivo abierto suelto): se piensa aquí. */
  function calculaAqui(d, responde) {
    setTimeout(() => {
      try {
        const p = M.inicial();
        for (const s of d.movs) M.hacer(p, M.deUci(p, s));
        const { m } = M.eligeBot(p, d.nivel, M.azarDe(d.semilla, d.movs.length));
        responde({ id: d.id, uci: M.uci(m) });
      } catch (err) { responde({ id: d.id, error: String(err && err.message || err) }); }
    }, 30);
  }
  function terminaBot(f, rendido) {
    if (!G || G.fin) return;
    pensando = false;
    G.fin = rendido ? 'rendido' : f;
    const gano = f === 'mate' && P.lado !== ladoJugador();
    const tiempo = G.t.reduce((s, x) => s + x, 0);
    const b = datos.bots[G.nivel];
    let nuevo = false;
    if (gano) {
      b.ganadas++;
      nuevo = !b.mejor || tiempo < b.mejor;
      if (nuevo) b.mejor = Math.max(1, tiempo);
      guardaDatos();
      if (Club) Club.result({ categoria: CAT_BOT(G.nivel), puntos: 1, tiempo: Math.max(1, tiempo) },
        { v: 1, u: CUENTA, s: G.semilla, n: G.nivel, c: G.color, j: G.j, t: G.t, a: Math.round(tiempo), w: Math.round(G.w) });
    }
    guardaPartida();
    pintaBotones(); pintaMarcador();
    if (gano) Son.ganar(); else if (f === 'mate' || rendido) Son.perder(); else Son.tablas();
    const MOTIVO = { ahogado: 'Rey ahogado', repeticion: 'Triple repetición', cincuenta: 'Regla de las 50 jugadas', material: 'Material insuficiente' };
    const titulo = gano ? '¡JAQUE MATE!' : rendido ? 'TE RENDISTE' : f === 'mate' ? 'TE DIERON MATE' : 'TABLAS';
    const tarjeta = `<small>BOT</small><strong>${AVATAR[G.nivel]} ${M.NIVELES[G.nivel].nombre}</strong>`
      + `<small>TU TIEMPO</small><strong translate="no">${relojFino(tiempo)}</strong>`
      + `<small>JUGADAS</small><strong translate="no">${Math.ceil(G.movs.length / 2)}</strong>`
      + (b.mejor ? `<small>TU MEJOR</small><strong translate="no">${relojFino(b.mejor)}</strong>` : '');
    const frase = gano ? (CUENTA === 'invitado' ? 'Como invitado no entra en la clasificación: inicia sesión en Juegos para competir.' : 'Tu tiempo va a la clasificación de esta dificultad.')
      : f === 'mate' || rendido ? 'Las derrotas no cuentan. ¡La revancha sí!' : MOTIVO[f] + ': las tablas no cuentan para la clasificación.';
    muestraFin({ titulo, tarjeta, frase, nuevo: gano && nuevo, estrellas: 0, siguiente: false });
  }

  /* ---------- Puzles ---------- */
  function resumenPuzles() {
    let s = 0, ms = 0, n = 0;
    for (const [id, v] of Object.entries(datos.puz)) if (POR_ID.has(id) && v && v.s) { s += v.s; ms += v.ms; n++; }
    return { s, ms, n };
  }
  function abrePuzle(i) {
    const pz = TODOS[i]; if (!pz) return;
    modo = 'puzles'; pref.modo = 'puzles'; pref.puzle = i; guardaPref();
    if (Club) Club.category(CAT_PUZ);
    P = M.desdeFEN(pz.fen);
    Z = { pz, i, k: 0, j: [], e: [], p: 0, t: [], lado: -P.lado, resuelto: false, ocupado: true, desde: 0, san: [] };
    orient = Z.lado; ultima = null; sel = -1; destinos = []; pista = -1; errorEn = -1;
    redibuja();
    const g = PZ.GRUPOS.find(x => x.id === pz.grupo);
    $('nomArriba').textContent = 'Rival'; $('avArriba').textContent = '🧩';
    $('nomAbajo').textContent = 'Tú · ' + (Z.lado > 0 ? 'blancas' : 'negras'); $('avAbajo').textContent = Z.lado > 0 ? '♔' : '♚';
    ocultaFin(); cierraMenu(); pintaJugadas(); pintaBotones(); pintaMarcador();
    aviso(g.nombre + ': mira la jugada del rival…');
    const z = Z;
    setTimeout(() => {
      if (Z !== z) return;
      Z.san.push(juegaVisual(M.deUci(P, pz.l[0])));
      Z.ocupado = false; Z.desde = ahoraA();
      pintaJugadas(); pintaBotones();
      aviso(enunciado(pz, g));
    }, 650);
  }
  function enunciado(pz, g) {
    const quien = Z.lado > 0 ? 'Blancas' : 'Negras';
    if (g.id === 'tactica') return `${quien} juegan y ganan material.`;
    const n = M.pasosPuzle(pz);
    return `${quien} juegan y dan mate en ${n}.`;
  }
  function juegaPuzle(m) {
    const z = Z, s = M.uci(m), v = M.paso(z.pz, z.k, s);
    if (v === 'ilegal') return;
    if (v === 'mal') {
      z.e.push([z.k, s]); z.ocupado = true;
      z.san.push(juegaVisual(m)); errorEn = M.A(m); pintaMarcas(); pintaJugadas();
      Son.error();
      aviso(`✗ No es esa (${z.e.length} ${z.e.length === 1 ? 'error' : 'errores'}). Prueba otra vez.`);
      pintaMarcador();
      setTimeout(() => {
        if (Z !== z) return;
        P = M.posPuzle(z.pz, z.k); z.san.pop(); errorEn = -1;
        ultima = null; sincroniza();
        // la última jugada que se ve es la del rival
        const l = z.pz.l[2 * z.k]; ultima = [M.casilla(l.slice(0, 2)), M.casilla(l.slice(2, 4))];
        z.ocupado = false; pintaMarcas(); pintaJugadas(); pintaBotones();
      }, 750);
      return;
    }
    z.t.push(Math.max(0, Math.round(ahoraA() - z.desde))); z.j.push(s);
    z.san.push(juegaVisual(m)); pintaJugadas();
    if (v === 'resuelto') return resuelvePuzle();
    z.k++; z.ocupado = true;
    Son.bien(); aviso('✓ ¡Bien! Sigue…');
    setTimeout(() => {
      if (Z !== z) return;
      z.san.push(juegaVisual(M.deUci(P, z.pz.l[2 * z.k])));
      z.ocupado = false; z.desde = ahoraA();
      pintaJugadas(); pintaBotones();
    }, 520);
  }
  function resuelvePuzle() {
    const z = Z; z.resuelto = true;
    const intento = { j: z.j, e: z.e, p: z.p, t: z.t };
    const r = M.rehacePuzle(z.pz, intento);
    const est = r.estrellas || 0, ms = r.ms || 0;
    const antes = datos.puz[z.pz.id];
    const nuevo = !r.error && (!antes || est > antes.s || (est === antes.s && ms < antes.ms));
    if (nuevo) { datos.puz[z.pz.id] = { s: est, ms, r: intento }; guardaDatos(); }
    pintaBotones(); pintaMarcador();
    setTimeout(() => {
      if (Z !== z) return;
      Son.ganar();
      const tarjeta = `<small>TIEMPO</small><strong translate="no">${relojFino(ms)}</strong>`
        + `<small>ERRORES</small><strong translate="no">${z.e.length}</strong>`
        + `<small>PISTA</small><strong>${z.p ? 'sí' : 'no'}</strong>`
        + (z.pz.m ? `<small>MOTIVO</small><strong>${z.pz.m}</strong>` : '');
      const tot = resumenPuzles();
      const frase = est === 3 ? `¡Perfecto! Llevas ${tot.s} de ${MAX_ESTRELLAS} ★.` : `Llevas ${tot.s} de ${MAX_ESTRELLAS} ★. Repítelo sin errores para sacar las tres.`;
      muestraFin({ titulo: '¡RESUELTO!', tarjeta, frase, nuevo: nuevo && !!antes, estrellas: est, siguiente: true });
    }, 450);
    mandaPuzles();
  }
  /* Manda el total de estrellas si mejora lo último que se mandó. */
  function mandaPuzles(forzar) {
    if (!Club || CUENTA === 'invitado' || CUENTA === 'local') return;
    const tot = resumenPuzles();
    if (!tot.s) return;
    const m = datos.mandado;
    if (!forzar && m && (m.s > tot.s || (m.s === tot.s && m.ms <= tot.ms))) return;
    const n = {};
    for (const [id, v] of Object.entries(datos.puz)) if (POR_ID.has(id) && v && v.s) n[id] = v.r;
    Club.result({ categoria: CAT_PUZ, puntos: tot.s, tiempo: Math.max(1, tot.ms) }, { v: 1, u: CUENTA, n });
    datos.mandado = { s: tot.s, ms: tot.ms }; guardaDatos();
  }
  /* Las partidas de tu fila (otro dispositivo, almacenamiento borrado): se
     rehacen y se juntan con las de aquí, quedándose con lo mejor. */
  let rescatando = false, forzado = '';
  function rescata(texto) {
    rescatando = false;
    let pr = null; try { pr = JSON.parse(texto || 'null'); } catch (_) { return; }
    if (!pr || !pr.n || typeof pr.n !== 'object') return;
    let cambio = false;
    for (const [id, r] of Object.entries(pr.n)) {
      const i = POR_ID.get(id); if (i === undefined) continue;
      const v = M.rehacePuzle(TODOS[i], r); if (v.error) continue;
      const a = datos.puz[id];
      if (!a || v.estrellas > a.s || (v.estrellas === a.s && v.ms < a.ms)) { datos.puz[id] = { s: v.estrellas, ms: v.ms, r }; cambio = true; }
    }
    if (cambio) { guardaDatos(); pintaMenu(); pintaMarcador(); }
  }
  addEventListener('club-tabla', e => {
    const d = e.detail || {};
    if (d.categoria !== CAT_PUZ) return;
    const tot = resumenPuzles(), f = d.propio;
    if (f && f.puntos > tot.s && !rescatando && Club && Club.pedirPruebaPropia) { rescatando = true; Club.pedirPruebaPropia(CAT_PUZ, rescata); return; }
    const firma = tot.s + ':' + tot.ms;
    if (tot.s && firma !== forzado && (!f || f.puntos < tot.s || (f.puntos === tot.s && f.tiempo > tot.ms))) { forzado = firma; mandaPuzles(true); }
  });
  addEventListener('club-reintentar', e => { if (e.detail && e.detail.categoria === CAT_PUZ) mandaPuzles(true); });
  addEventListener('club-record', e => {
    const d = e.detail || {}, m = /^club-ajedrez-bot([1-4])$/.exec(d.categoria || '');
    if (!m) return;
    const b = datos.bots[m[1]];
    if (d.tiempo > 0 && (!b.mejor || d.tiempo < b.mejor)) { b.mejor = d.tiempo; guardaDatos(); pintaMenu(); pintaMarcador(); }
  });
  addEventListener('club-rechazo', e => {
    if (e.detail && /^club-ajedrez-/.test(e.detail.categoria || '') && !$('fin').hidden) $('finFrase').textContent = 'Esto no se guardó: ' + (e.detail.motivo || '');
  });

  /* ---------- Pantalla ---------- */
  function aviso(t) { $('aviso').textContent = t; }
  function pintaJugadas() {
    const lista = $('jugadas'), san = modo === 'bots' ? (G ? G.san : []) : (Z ? Z.san : []);
    // En un puzle la numeración empieza donde empieza la posición.
    let n = modo === 'puzles' && Z ? parseInt(Z.pz.fen.split(' ')[5], 10) || 1 : 1;
    let negras = modo === 'puzles' && Z ? Z.pz.fen.split(' ')[1] === 'b' : false;
    let html = '', i = 0;
    if (negras && san.length) { html += `<li><span class="n">${n}.</span><span>…</span><span>${san[0]}</span></li>`; i = 1; n++; }
    for (; i < san.length; i += 2, n++) html += `<li><span class="n">${n}.</span><span>${san[i]}</span><span>${san[i + 1] || ''}</span></li>`;
    lista.innerHTML = html;
    lista.scrollTop = lista.scrollHeight;
  }
  function pintaBotones() {
    const enBot = modo === 'bots' && G && !G.fin, enPuz = modo === 'puzles' && Z;
    $('btnRendir').hidden = !enBot;
    $('btnPista').hidden = !(enPuz && !Z.resuelto);
    $('btnPista').disabled = !(enPuz && !Z.resuelto && !Z.ocupado && !Z.p);
    $('btnPista').classList.toggle('late', !!(enPuz && Z.e.length >= 2 && !Z.p));
    $('btnReintentar').hidden = !enPuz;
  }
  let tic = 0;
  function pintaMarcador() {
    // Con el menú abierto manda la pestaña que se mira (y su tabla al lado).
    const vista = !$('menu').hidden ? modoMenu : modo;
    if (vista === 'bots') {
      $('lModo').textContent = 'BOT';
      const enJuego = G && modo === 'bots' && $('menu').hidden;
      $('nModo').textContent = enJuego ? AVATAR[G.nivel] + ' ' + M.NIVELES[G.nivel].nombre : M.NIVELES[pref.nivel].nombre;
      const nivel = enJuego ? G.nivel : pref.nivel, b = datos.bots[nivel];
      $('lReloj').textContent = 'TU TIEMPO';
      let ms = enJuego ? G.t.reduce((s, x) => s + x, 0) : 0;
      if (enJuego && !G.fin && G.desdeA && !pensando && P.lado === ladoJugador()) ms += ahoraA() - G.desdeA;
      $('nReloj').textContent = reloj(ms);
      $('lMejor').textContent = 'TU MEJOR';
      $('nMejor').textContent = b.mejor ? relojFino(b.mejor) : '—';
    } else {
      const tot = resumenPuzles();
      $('lModo').textContent = 'PUZLE';
      if (Z && modo === 'puzles') { const g = PZ.GRUPOS.find(x => x.id === Z.pz.grupo); $('nModo').textContent = g.nombre + ' · ' + (g.puzles.findIndex(p => p.id === Z.pz.id) + 1); }
      else $('nModo').textContent = '—';
      $('lReloj').textContent = 'TIEMPO';
      let ms = Z ? Z.t.reduce((s, x) => s + x, 0) : 0;
      if (Z && !Z.resuelto && !Z.ocupado && Z.desde) ms += ahoraA() - Z.desde;
      $('nReloj').textContent = reloj(ms);
      $('lMejor').textContent = 'ESTRELLAS';
      $('nMejor').textContent = tot.s + ' ★';
    }
  }
  setInterval(() => { if (!document.hidden) pintaMarcador(); }, 250);

  function muestraFin({ titulo, tarjeta, frase, nuevo, estrellas, siguiente }) {
    $('finTitulo').textContent = titulo;
    $('finTarjeta').innerHTML = tarjeta;
    $('finFrase').textContent = frase;
    $('finNuevo').hidden = !nuevo;
    $('finEstrellas').hidden = !estrellas;
    $('finEstrellas').textContent = estrellas ? estrellasTxt(estrellas) : '';
    $('btnSiguiente').hidden = !siguiente;
    $('btnOtra').textContent = modo === 'puzles' ? '↺ Repetir' : '↻ Revancha';
    $('fin').hidden = false;
  }
  function ocultaFin() { $('fin').hidden = true; }

  /* ---------- Menú ---------- */
  function pintaMenu() {
    for (const b of document.querySelectorAll('.pestanas [data-modo]')) b.setAttribute('aria-selected', String(b.dataset.modo === modoMenu));
    $('panelBots').hidden = modoMenu !== 'bots'; $('panelPuzles').hidden = modoMenu !== 'puzles';
    $('niveles').innerHTML = [1, 2, 3, 4].map(n => {
      const b = datos.bots[n];
      return `<button type="button" role="radio" class="nivel" data-nivel="${n}" aria-checked="${n === pref.nivel}">`
        + `<span class="ava" aria-hidden="true">${AVATAR[n]}</span><b>${M.NIVELES[n].nombre}</b><small>${DESCRIPCION[n]}</small>`
        + `<span class="marca" translate="no">${b.mejor ? '🏆 ' + relojFino(b.mejor) : b.ganadas ? b.ganadas + ' ganadas' : 'Sin ganar todavía'}</span></button>`;
    }).join('');
    for (const b of document.querySelectorAll('.color [data-color]')) b.setAttribute('aria-pressed', String(b.dataset.color === pref.color));
    const enCurso = G && !G.fin;
    $('btnSeguir').hidden = !(enCurso && modo === 'bots');
    $('btnJugar').textContent = enCurso ? '▶ Nueva partida (abandona la actual)' : '▶ Jugar';
    const tot = resumenPuzles();
    $('totalEstrellas').textContent = tot.s; $('totalDe').textContent = '/ ' + MAX_ESTRELLAS + ' ★';
    $('grupos').innerHTML = PZ.GRUPOS.map(g => {
      const suma = g.puzles.reduce((s, p) => s + ((datos.puz[p.id] || {}).s || 0), 0);
      return `<section class="grupo"><h3>${g.nombre} <small translate="no">${suma}/${g.puzles.length * 3} ★</small></h3><div class="botones-puzle">`
        + g.puzles.map((p, k) => {
          const s = (datos.puz[p.id] || {}).s || 0, i = POR_ID.get(p.id);
          return `<button type="button" class="puzle${s ? ' hecho' : ''}${s === 3 ? ' pleno' : ''}" data-puzle="${i}" title="${g.nombre} ${k + 1} · rating ${p.r}"><b translate="no">${k + 1}</b><span translate="no">${estrellasTxt(s)}</span></button>`;
        }).join('') + '</div></section>';
    }).join('');
    $('btnSeguirPuzle').hidden = !(Z && !Z.resuelto && modo === 'puzles');
    $('selPiezas').value = pref.piezas;
  }
  let modoMenu = modo;
  function abreMenu() {
    modoMenu = modo; pintaMenu(); $('menu').hidden = false; document.body.classList.add('en-menu'); ocultaFin();
    if (Club) Club.category(modoMenu === 'bots' ? CAT_BOT(G && !G.fin ? G.nivel : pref.nivel) : CAT_PUZ);
  }
  function cierraMenu() { $('menu').hidden = true; document.body.classList.remove('en-menu'); }
  $('menu').addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.modo) { modoMenu = t.dataset.modo; pintaMenu(); pintaMarcador(); if (Club) Club.category(modoMenu === 'bots' ? CAT_BOT(pref.nivel) : CAT_PUZ); return; }
    if (t.dataset.nivel) { pref.nivel = +t.dataset.nivel; guardaPref(); pintaMenu(); pintaMarcador(); if (Club) Club.category(CAT_BOT(pref.nivel)); return; }
    if (t.dataset.color) { pref.color = t.dataset.color; guardaPref(); pintaMenu(); return; }
    if (t.dataset.puzle !== undefined) { abrePuzle(+t.dataset.puzle); return; }
  });
  $('btnJugar').addEventListener('click', () => { pref.modo = 'bots'; guardaPref(); empiezaBot(pref.nivel, pref.color); });
  $('btnSeguir').addEventListener('click', () => { modo = 'bots'; if (Club && G) Club.category(CAT_BOT(G.nivel)); cierraMenu(); pintaMarcador(); });
  $('btnSeguirPuzle').addEventListener('click', () => { if (Club) Club.category(CAT_PUZ); cierraMenu(); });
  function siguienteSinResolver(desde) {
    const n = TODOS.length;
    for (let k = 1; k <= n; k++) { const i = (desde + k) % n; if (((datos.puz[TODOS[i].id] || {}).s || 0) < 3) return i; }
    return (desde + 1) % n;
  }
  $('btnPuzleSig').addEventListener('click', () => {
    let i = TODOS.findIndex(p => !datos.puz[p.id]);
    if (i < 0) i = siguienteSinResolver(Z ? Z.i : -1);
    abrePuzle(i);
  });
  $('btnMenu').addEventListener('click', () => { if ($('menu').hidden) abreMenu(); else if (G || Z) cierraMenu(); });
  $('btnMenuFin').addEventListener('click', abreMenu);
  $('btnVerTablero').addEventListener('click', ocultaFin);
  $('btnOtra').addEventListener('click', () => {
    if (modo === 'puzles' && Z) abrePuzle(Z.i);
    else if (G) empiezaBot(G.nivel, pref.color);
  });
  $('btnSiguiente').addEventListener('click', () => { if (Z) abrePuzle(Z.i + 1 < TODOS.length ? Z.i + 1 : siguienteSinResolver(Z.i)); });
  $('btnRendir').addEventListener('click', () => {
    if (!G || G.fin) return;
    if (!confirm('¿Rendirte? La partida termina y no cuenta.')) return;
    pedido++; terminaBot('rendido', true);
  });
  $('btnPista').addEventListener('click', () => {
    if (!Z || Z.resuelto || Z.ocupado) return;
    Z.p = 1; pista = M.casilla(Z.pz.l[2 * Z.k + 1].slice(0, 2));
    aviso('💡 Mueve la pieza marcada (la pista cuesta una estrella).');
    pintaMarcas(); pintaBotones();
  });
  $('btnReintentar').addEventListener('click', () => { if (Z) abrePuzle(Z.i); });
  $('btnGirar').addEventListener('click', () => { orient = -orient; redibuja(); });
  $('selPiezas').addEventListener('change', e => {
    pref.piezas = e.target.value; guardaPref();
    for (const [c, el] of elems) el.src = srcPieza(P.t[c]);
  });
  $('btnComo').addEventListener('click', () => {
    const c = $('comoSeJuega'), abre = c.hidden; c.hidden = !abre; $('btnComo').setAttribute('aria-expanded', String(abre));
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pintaMarcador(); });

  /* ---------- Arranque ---------- */
  colocaCasillas(); sincroniza(); pintaMarcas();
  const guardada = lee('ajedrezclub.partida');
  if (guardada && [1, 2, 3, 4].includes(guardada.nivel) && Array.isArray(guardada.movs)) {
    G = { nivel: guardada.nivel, color: guardada.color === 'n' ? 'n' : 'b', semilla: guardada.semilla | 0, j: guardada.j || [], t: guardada.t || [], w: guardada.w || 0, movs: guardada.movs, san: [], fin: null };
    /* Lo que ya llevaba pensando antes de recargar sigue contando. */
    const llevaba = Number.isFinite(guardada.desde) && guardada.desde > 0 ? Math.max(0, Math.min(Date.now() - guardada.desde, 3600000)) : 0;
    G.desdeA = ahoraA() - llevaba; G.desdeW = Date.now() - llevaba;
    montaBot(true);
    if (modo === 'puzles') abreMenu();
  } else {
    if (Club) Club.category(modo === 'bots' ? CAT_BOT(pref.nivel) : CAT_PUZ);
    abreMenu();
  }
})();
