/* Tetris Club: el pozo en solitario, sobre el mismo motor que la sala
   multijugador (TetrisMotor). Cuatro modos: Maratón (hasta que no quepa),
   Sprint (40 líneas contra el reloj), Ultra (dos minutos) y VS Bots (tú
   contra tres bots, todos contra todos, en tres dificultades; compite el
   tiempo en dejarlos fuera: TetrisVS, vs.js). */
(() => {
  'use strict';
  const TM = window.TetrisMotor, FX = window.TetrisFX, TV = window.TetrisVS;
  const $ = id => document.getElementById(id);
  const CLAVE = window.Club?.storageKey('tetris-club-v1') || 'tetris-club-v1';
  const SPRINT = TM.SPRINT, ULTRA_MS = TM.ULTRA_MS;
  /* La cuenta entra en la semilla de cada partida (TM.semillaDe): la
     prueba de un récord no le sirve a otra persona. */
  const CUENTA = new URLSearchParams(location.search).get('cuenta') || 'local';
  const NOMBRE = { maraton: 'Maratón', sprint: 'Sprint', ultra: 'Ultra', bots: 'VS Bots' };
  /* Los colores de los tres bots (miniatura, nombre y aviso de ataque). */
  const COLOR_BOT = ['#ff9f43', '#2fd3e8', '#ff4fa3'];
  /* El tuyo: tus misiles y la diana sobre tu objetivo. */
  const COLOR_TU = '#ffd23f';

  let guardado = {};
  try { guardado = JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}; } catch (_) { /* Storage es opcional. */ }
  let modo = NOMBRE[guardado.modo] ? guardado.modo : 'maraton';
  let dif = TV.DIFS.includes(guardado.dif) ? guardado.dif : 'facil';
  let sonido = guardado.sonido !== false;
  const records = guardado.records || {};
  const guarda = () => { try { localStorage.setItem(CLAVE, JSON.stringify({ modo, dif, sonido, records })); } catch (_) { /* nada */ } };
  /* La tabla en juego: en VS Bots, una por dificultad. */
  const tabla = () => modo === 'bots' ? `bots-${dif}` : modo;
  /* En Sprint y en VS Bots compite el tiempo (menos es mejor). */
  const porTiempo = () => modo === 'sprint' || modo === 'bots';

  /* `g` graba la partida (TM.grabadora); `resto` es el tiempo real que
     aún no llega a un paso entero; `pared` mide, con el reloj del
     sistema, cuánto se jugó de verdad (va en la prueba: un reloj del
     juego frenado a mano se nota contra él). */
  let s = null, g = null, estado = 'menu', ultimo = 0, resto = 0, pared = 0, paredAntes = 0;
  /* La largada: tres segundos de cuenta atrás (estado 'cuenta') antes de que
     corra nada. Durante la cuenta el pozo ya tiene su pieza pero no hay
     pasos, ni teclas, ni reloj de pared, ni registro de pulsaciones: la
     prueba empieza en el «¡YA!», igual que si la cuenta no existiera. */
  const LARGADA_MS = 3000;
  let cuentaIni = 0, cuentaVista = 0, porLargar = false;
  /* Las pulsaciones de la partida (TM.registroTeclas), para la capa
     anti-bot: instante, cuánto se mantuvo y de dónde vino cada una. */
  let pulsos = null;
  const hayMando = () => { try { return [...(navigator.getGamepads?.() || [])].some(p => p && p.connected); } catch (_) { return false; } };
  /* De dónde viene un evento: el teclado o el dedo de verdad (isTrusted),
     el mando (mando.js despacha teclas sintéticas marcadas `__mando`, y
     valen si hay un mando conectado) o nadie (un script). */
  const origen = (e, tactil) => e.__mando ? (hayMando() ? 'M' : 'X') : !e.isTrusted ? 'X' : tactil ? 'T' : '';
  const pozo = $('pozo'), cx = pozo.getContext('2d');
  const cxG = $('guarda').getContext('2d'), cxC = $('cola').getContext('2d');
  /* Los efectos (fx.js) se rehacen en cada partida: no hay nada que
     arrastrar de la anterior. */
  const nuevosEfectos = () => FX.crearEfectos({ TM, celda: pozo.width / TM.W });
  let fx = nuevosEfectos();
  const cartel = FX.cartelCuenta(pozo.parentElement);

  const reloj = ms => { const t = Math.max(0, ms) / 1000, f = porTiempo(); return `${Math.floor(t / 60)}:${(t % 60).toFixed(f ? 2 : 0).padStart(f ? 5 : 2, '0')}`; };
  const cat = () => `club-tetris-${tabla()}`;
  const mejor = r => porTiempo() ? (r?.tiempo ? reloj(r.tiempo) : '—') : (r?.puntos ? String(r.puntos) : '—');
  function mejora(r) {
    const a = records[tabla()];
    if (porTiempo()) return !a?.tiempo || r.tiempo < a.tiempo;
    return !a?.puntos || r.puntos > a.puntos;
  }
  window.addEventListener('club-record', e => {
    const d = e.detail; if (!d || d.categoria !== cat()) return;
    if (mejora(d)) { records[tabla()] = { puntos: d.puntos, tiempo: d.tiempo }; guarda(); pintaDatos(); }
  });

  /* ---------- sonido ---------- */
  let audio = null, sonando = false, fresco = true;
  function iniciaAudio() {
    if (!sonido) return;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!audio && A && window.Chip && window.Temas) {
        const c = new A(), m = c.createGain(), mu = c.createGain(), fx = c.createGain();
        m.gain.value = .6; mu.gain.value = .45; fx.gain.value = .75;
        mu.connect(m); fx.connect(m); m.connect(c.destination);
        audio = { ctx: c, fx, rep: new window.Chip.Reproductor(c, mu, window.Temas.temas.neon), son: FX.crearSonido(c, fx) };
      }
      if (audio?.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    } catch (_) { audio = null; }
  }
  function musica() {
    if (!audio) return;
    const r = audio.rep;
    if (!sonido || estado !== 'jugando' || audio.ctx.state !== 'running') {
      if (sonando || r.voces.size) r.detener();
      sonando = false; return;
    }
    if (fresco) { r.reinicia(); fresco = false; }
    sonando = true;
    const alto = altura();
    r.tempo = 1 + Math.min(.12, (s.nivel - 1) * .01) + (alto > 14 ? .06 : 0);
    try { r.tick(.2); } catch (_) { /* el sonido nunca bloquea */ }
  }
  /* Los efectos suenan con el motor de fx.js (el pozo como instrumento),
     no con el chip: ver la cabecera de fx.js. */
  function efecto(k, ...a) {
    if (!sonido || !audio || !audio.son[k]) return;
    audio.son[k](...a);
  }
  const altura = () => s ? FX.altura(s) : 0;
  /* El latido: con la pila a cinco filas del techo, un corazón que se
     acelera cuanto más cerca está. */
  let latidoT = 0;
  function latido(dt) {
    const a = altura();
    if (estado !== 'jugando' || a < 15) { latidoT = 0; return; }
    latidoT -= dt;
    if (latidoT <= 0) { const k = (a - 14) / 6; efecto('latido', k); latidoT = 900 - k * 380; }
  }

  /* ---------- partida ---------- */
  function empieza() {
    iniciaAudio();
    let sal = (Math.random() * 2 ** 32) >>> 0;
    try { sal = crypto.getRandomValues(new Uint32Array(1))[0]; } catch (_) { /* con Math.random basta */ }
    const alJugar = a => { if ((a === 'izq' || a === 'der') && s && s.p) efecto('mueve', s.p.x); };
    /* VS Bots graba igual, pero con el mundo de cuatro pozos de vs.js. */
    g = modo === 'bots' ? TV.grabadora({ cuenta: CUENTA, sal, dif, alJugar }) : TM.grabadora({ cuenta: CUENTA, sal, modo, alJugar });
    s = g.s;
    rivalesFirma = ''; batallaFirma = ''; feed = [];
    fx = nuevosEfectos();
    pulsos = null;
    mando.suelta();
    $('capa').hidden = true;
    bloqueaModos(true);
    cuenta();
    inmersivo(true);
    pozo.focus();
  }
  function cuenta() {
    estado = 'cuenta'; porLargar = false;
    // Un respiro antes del «3»: el audio recién despertado por el clic tarda unos ms en sonar.
    cuentaIni = performance.now() + 150; cuentaVista = 0;
  }
  // Cada número aparece y suena una vez; en el «¡YA!» empieza la partida de verdad.
  function cuentaPaso(t) {
    if (t < cuentaIni) return;
    const n = Math.max(0, 3 - Math.floor(Math.max(0, t - cuentaIni) / (LARGADA_MS / 3)));
    if (n === cuentaVista) return;
    cuentaVista = n;
    cartel.pon(n); efecto('cuenta', n);
    if (n === 0) largada();
  }
  function largada() {
    estado = 'jugando'; fresco = true; ultimo = 0; resto = 0; pared = 0; paredAntes = 0;
    pulsos = TM.registroTeclas(performance.now());
    mando.suelta();
  }
  function termina(gano) {
    estado = 'fin';
    inmersivo(false);
    bloqueaModos(false);
    mando.suelta();
    const bots = modo === 'bots';
    const r = { puntos: bots ? TV.RIVALES : s.puntos, tiempo: Math.max(1, Math.round(s.tiempo)) };
    const vale = modo === 'sprint' || bots ? gano : r.puntos >= 1;
    const nuevo = vale && mejora(r);
    if (nuevo) { antesDelRecord = { tabla: tabla(), cat: cat(), r: records[tabla()] }; records[tabla()] = r; guarda(); }
    if (vale) window.Club?.result({ categoria: cat(), puntos: modo === 'sprint' ? SPRINT : r.puntos, tiempo: r.tiempo },
      g.prueba({ w: Math.round(pared), k: pulsos.texto() }));
    efecto(nuevo ? 'record' : 'fin');
    pintaRivales();
    if (bots) {
      const caidos = TV.derrotados(g.m);
      capa(gano ? '¡Ganaste!' : 'Fuera',
        gano ? `Los tres bots (${TV.NOMBRE_DIF[dif]}) fuera en ${reloj(r.tiempo)}${nuevo ? ' · ¡récord!' : ''}`
          : `Dejaste fuera a ${caidos} de ${TV.RIVALES} · ${reloj(r.tiempo)}`,
        'Otra vez');
      pintaDatos();
      return;
    }
    capa(
      modo === 'sprint' ? (gano ? '¡40 líneas!' : 'Se llenó') : modo === 'ultra' && gano ? '¡Tiempo!' : 'Se acabó',
      modo === 'sprint' ? (gano ? `En ${reloj(r.tiempo)}${nuevo ? ' · ¡récord!' : ''}` : `${s.lineas} de ${SPRINT} líneas`)
        : `${r.puntos} puntos · ${s.lineas} líneas${nuevo ? ' · ¡récord!' : ''}`,
      'Otra vez');
    pintaDatos();
  }
  /* Si la página no acepta la partida, el récord local tampoco cuenta. */
  let antesDelRecord = null;
  window.addEventListener('club-rechazo', e => {
    const d = e.detail; if (!d) return;
    if (antesDelRecord && d.categoria === antesDelRecord.cat) {
      if (antesDelRecord.r) records[antesDelRecord.tabla] = antesDelRecord.r; else delete records[antesDelRecord.tabla];
      antesDelRecord = null; guarda(); pintaDatos();
    }
    if (estado === 'fin' && d.categoria === cat()) $('capaP').textContent = 'No se guardó: ' + (d.motivo || 'la partida no cuadra.');
  });
  function capa(t, p, b) {
    $('capaT').innerHTML = `${t}<span>.</span>`.replace(/([.!])<span>\.<\/span>$/, '$1');
    $('capaP').textContent = p; $('jugar').textContent = b; $('capa').hidden = false;
  }
  function pausa() {
    if (estado === 'cuenta') { estado = 'pausa'; porLargar = true; cartel.limpia(); mando.suelta(); inmersivo(false); capa('Pausa', `${nombreModo()} · aún no empieza`, 'Seguir'); }
    else if (estado === 'pausa' && porLargar) { $('capa').hidden = true; inmersivo(true); cuenta(); pozo.focus(); }
    else if (estado === 'jugando') { estado = 'pausa'; mando.suelta(); g.vacia(); inmersivo(false); capa('Pausa', `${nombreModo()} · nivel ${s.nivel}`, 'Seguir'); }
    else if (estado === 'pausa') { estado = 'jugando'; ultimo = 0; paredAntes = 0; $('capa').hidden = true; inmersivo(true); pozo.focus(); }
  }
  /* Modo celular (CLAUDE.md): mientras se juega, el pozo ocupa la pantalla
     con los datos encima y los botones abajo; en pausa y al terminar vuelve
     el menú. En PC Club.celular() es falso y no cambia nada. */
  function inmersivo(v) { window.Club?.inmersivo?.(v); }
  function bloqueaModos(b) { document.querySelectorAll('[data-modo],[data-dif]').forEach(x => { x.disabled = b; }); }
  const nombreModo = () => modo === 'bots' ? `VS Bots ${TV.NOMBRE_DIF[dif]}` : NOMBRE[modo];

  function acciones(a) {
    if (a === 'pausa') return pausa();
    if (estado !== 'jugando') return;
    /* No se aplica aquí: se deja para el comienzo del próximo paso, que
       es como la rehace el verificador. */
    g.pide(a);
  }
  const mando = TM.crearMando(acciones);
  let configurando = false;
  const pintaTeclas = () => { $('teclasTxt').textContent = TM.textoTeclas(); };
  // Mando de consola: mismas acciones que el teclado (ver TM.mandoTetris).
  const ponMando = t => window.Mando && window.Mando.configura(Object.assign(TM.mandoTetris(t), {
    menu: () => estado !== 'jugando' || configurando, inicio: '#jugar', zonas: [{ sel: '#teclasTxt' }]
  }));
  pintaTeclas(); ponMando();
  $('teclas').addEventListener('click', () => {
    if (estado === 'jugando' || estado === 'cuenta') pausa();
    configurando = true; mando.suelta();
    TM.panelTeclas(document, t => { mando.recarga(t); pintaTeclas(); ponMando(t); }, () => { configurando = false; });
  });
  document.addEventListener('keydown', e => {
    if (configurando) return;
    if (estado === 'cuenta') {
      if (mando.accionDe(e.code) === 'pausa' || e.code === 'Escape') { e.preventDefault(); pausa(); }
      else if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      return;
    }
    if (estado !== 'jugando' && estado !== 'pausa' && (e.code === 'Space' || e.code === 'Enter')) {
      if (e.target.closest?.('button') && e.code === 'Enter') return;
      e.preventDefault(); return estado === 'pausa' ? pausa() : empieza();
    }
    if (estado === 'pausa' && e.code !== 'KeyP' && e.code !== 'Escape') return;
    const a = mando.accionDe(e.code);
    if (estado === 'jugando' && a && a !== 'pausa' && !e.repeat) pulsos.baja(e.code, e.timeStamp, origen(e));
    mando.baja(e);
  });
  document.addEventListener('keyup', e => { if (pulsos) pulsos.sube(e.code, e.timeStamp); mando.sube(e); });
  window.addEventListener('blur', () => { mando.suelta(); if (estado === 'jugando' || estado === 'cuenta') pausa(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && (estado === 'jugando' || estado === 'cuenta')) pausa(); });

  /* Botones táctiles: ◀ ▶ se repiten al mantener, ▼ es bajada blanda. */
  const sueltas = [];
  document.querySelectorAll('.tt-tactil [data-a]').forEach(b => {
    const a = b.dataset.a;
    let rep = null;
    const suelta = e => {
      clearInterval(rep); clearTimeout(rep); rep = null; if (a === 'blando') mando.blando = false;
      if (pulsos) pulsos.sube('tactil-' + a, e && e.timeStamp || performance.now());
    };
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); iniciaAudio();
      try { b.setPointerCapture(e.pointerId); } catch (_) {}
      if (estado !== 'jugando') return;
      pulsos.baja('tactil-' + a, e.timeStamp, origen(e, true));
      if (a === 'blando') { mando.blando = true; return; }
      acciones(a);
      if (a === 'izq' || a === 'der') rep = setTimeout(() => { rep = setInterval(() => acciones(a), 50); }, 170);
    });
    ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture', 'touchend', 'touchcancel'].forEach(ev => b.addEventListener(ev, suelta));
    /* iOS: una pulsación larga seleccionaba el botón o abría el menú, que se
       quedaba con el dedo; el pointerup no llegaba y la pieza seguía corriendo. */
    b.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    b.addEventListener('contextmenu', e => e.preventDefault());
    b.addEventListener('selectstart', e => e.preventDefault());
    sueltas.push(suelta);
  });
  /* Red de seguridad: sin dedos en pantalla, ningún botón sigue apretado. */
  const sueltaTodo = () => sueltas.forEach(f => f());
  document.addEventListener('touchend', e => { if (!e.touches.length) sueltaTodo(); });
  document.addEventListener('touchcancel', e => { if (!e.touches.length) sueltaTodo(); });
  window.addEventListener('blur', sueltaTodo);
  document.addEventListener('visibilitychange', () => { if (document.hidden) sueltaTodo(); });

  $('jugar').addEventListener('click', () => estado === 'pausa' ? pausa() : empieza());
  $('hudPausa').addEventListener('click', () => pausa());
  $('sonido').addEventListener('click', () => {
    sonido = !sonido; guarda(); $('sonido').textContent = sonido ? '🔊' : '🔈';
    if (sonido) iniciaAudio(); else if (audio) { audio.rep.detener(); sonando = false; }
  });
  document.querySelectorAll('[data-modo]').forEach(b => b.addEventListener('click', () => {
    if (estado === 'jugando' || estado === 'pausa' || estado === 'cuenta') return;
    modo = b.dataset.modo; guarda(); ponModo();
  }));
  document.querySelectorAll('[data-dif]').forEach(b => b.addEventListener('click', () => {
    if (estado === 'jugando' || estado === 'pausa' || estado === 'cuenta') return;
    dif = b.dataset.dif; guarda(); ponModo();
  }));
  const LEMA = {
    sprint: 'Cuarenta líneas, lo más rápido que puedas.', ultra: 'Dos minutos: todos los puntos que quepan.',
    maraton: 'Completa filas. Que no llegue arriba.',
    bots: { facil: 'Tres bots tranquilos, que se equivocan seguido. Lo que limpias le cae a tu objetivo.',
      medio: 'Píxel caza al que va ganando, Turbo remata al que va perdiendo y Glitch no olvida quién le pegó. Elige a quién atacas.',
      dificil: 'Los tres, rápidos y casi sin errores, cada uno con su cabeza. Sobrevive y déjalos fuera.' }
  };
  function ponModo() {
    document.querySelectorAll('[data-modo]').forEach(x => x.classList.toggle('activo', x.dataset.modo === modo));
    document.querySelectorAll('[data-dif]').forEach(x => x.classList.toggle('activo', x.dataset.dif === dif));
    const vs = modo === 'bots';
    $('difs').hidden = !vs; $('rivales').hidden = !vs; $('tt').classList.toggle('vs', vs);
    $('batalla').hidden = true; pozo.parentElement.dataset.apuntan = 0;
    window.Club?.category(cat());
    s = null; g = null; estado = 'menu'; inmersivo(false); rivalesFirma = ''; batallaFirma = ''; feed = [];
    capa(nombreModo(), vs ? `${LEMA.bots[dif]} Gana el último en pie; compite el tiempo.` : LEMA[modo], 'Jugar');
    pintaDatos(); pinta(); pintaRivales();
  }

  /* ---------- dibujo ---------- */
  const avisa = (t, k) => { const a = $('aviso'); a.textContent = t; a.dataset.k = k || ''; a.classList.remove('ve'); void a.offsetWidth; a.classList.add('ve'); };
  let datosFirma = '';
  function pintaDatos() {
    const t = !s ? 0 : modo === 'ultra' ? ULTRA_MS - s.tiempo : s.tiempo;
    const bots = modo === 'bots';
    const enPie = bots ? (g?.m ? TV.RIVALES - TV.derrotados(g.m) : TV.RIVALES) : 0;
    const f = [tabla(), s?.puntos, enPie, s?.lineas, s?.nivel, reloj(t), mejor(records[tabla()])].join('|');
    if (f === datosFirma) return; datosFirma = f;
    $('etqA').textContent = bots ? 'Bots en pie' : 'Puntos';
    $('hudEtqA').textContent = bots ? 'Bots' : 'Pts';
    $('datoA').textContent = bots ? enPie : s ? s.puntos : 0;
    $('datoL').textContent = s ? (modo === 'sprint' ? `${s.lineas}/${SPRINT}` : s.lineas) : 0;
    $('datoN').textContent = s ? s.nivel : 1;
    $('etqT').textContent = modo === 'ultra' ? 'Queda' : 'Tiempo';
    $('datoT').textContent = reloj(s ? t : modo === 'ultra' ? ULTRA_MS : 0);
    $('record').textContent = mejor(records[tabla()]);
    $('hudA').textContent = $('datoA').textContent;
    $('hudL').textContent = $('datoL').textContent;
    $('hudN').textContent = $('datoN').textContent;
    $('hudT').textContent = $('datoT').textContent;
    $('hudR').textContent = $('record').textContent;
  }
  function pinta() {
    if (s) fx.pinta(cx, s, modo === 'bots' ? { pendiente: s.fin ? 0 : TM.pendiente(s) } : undefined);
    else { cx.fillStyle = '#0b0f1a'; cx.fillRect(0, 0, pozo.width, pozo.height); }
    fx.sacude(pozo);
    cxG.clearRect(0, 0, 100, 70);
    if (s?.guardada) FX.pintaPieza(cxG, TM, s.guardada, 50, 35, 18, s.puedeGuardar ? 1 : .35);
    cxC.clearRect(0, 0, 100, 320);
    if (s) s.cola.slice(0, 5).forEach((t, i) => FX.pintaPieza(cxC, TM, t, 50, 34 + i * 62, i ? 15 : 18));
  }

  function eventos() {
    let seco = false;
    for (const ev of s.eventos.splice(0)) {
      fx.evento(ev);
      if (ev.e === 'gira') efecto('gira', s.p?.t, s.p?.x);
      else if (ev.e === 'guarda') efecto('guarda');
      else if (ev.e === 'seco') { seco = true; efecto('seco', ev.a - ev.de, ev.celdas[0][0]); }
      else if (ev.e === 'nivel') { efecto('nivel'); avisa(`Nivel ${ev.n}`, 'nivel'); }
      else if (ev.e === 'basura') efecto('impacto', ev.n);
      else if (ev.e === 'fija') {
        if (ev.n || ev.ts) efecto('linea', ev.n, ev.combo, ev.ts, ev.pc, ev.b2b);
        else if (!seco) efecto('fija', Math.min(1, altura() / 20), ev.bloq?.[0]?.[0]);
        const txt = [ev.pc ? '¡Pozo limpio!' : '', ev.ts ? `T-spin${ev.n ? ' ' + ['', 'simple', 'doble', 'triple'][ev.n] : ''}` : '',
          ev.n === 4 ? '¡TETRIS!' : '', ev.b2b && (ev.n === 4 || ev.ts) ? 'B2B' : '', ev.combo > 0 ? `Combo ×${ev.combo}` : ''].filter(Boolean).join(' · ');
        if (txt) avisa(txt, ev.pc ? 'pc' : ev.n === 4 ? 'tetris' : ev.ts ? 'ts' : 'combo');
      }
    }
    s.salida = 0;
  }

  /* ---------- VS Bots: los rivales, a quién apunta cada uno y lo que se mandan ---------- */
  /* Nada de esto decide nada: el mundo (vs.js) ya repartió la basura, sabe
     a quién apunta cada pozo y anotó quién cayó; aquí solo se ve y se oye.
     Lo único que sale de aquí es tu cambio de objetivo, que va como una
     acción más (`g.pide('apunta2')`, `'objetivo'`) y queda en la prueba. */
  let rivalesFirma = '', alertaT = 0, batallaFirma = '', feed = [];
  const nombreBot = i => TV.NOMBRES[i - 1];
  /* Cada bot es alguien (vs.js, PERSONAS): su rol, el porqué de su
     objetivo y su ánimo, que es lo que hace que no se sienta un «si pasa
     esto, haz aquello». Solo se lee: nada de aquí decide nada. */
  const rolBot = i => TV.PERSONAS[i].rol;
  const PORQUE = { debil: 'huele sangre', amenaza: 'frena al peligroso', lider: 'va por el líder', rencor: 'venganza',
    devuelve: 'devuelve el golpe', monton: 'se suma al ataque', corazonada: 'corazonada' };
  /* La cara del ánimo: lo que más pesa de estrés, enojo y confianza. */
  function cara(a) {
    if (!a) return ['🙂', 'tranquilo'];
    if (a.enojo >= 600) return ['😡', 'furioso'];
    if (a.estres >= 600) return ['😰', 'apurado'];
    if (a.enojo >= 300) return ['😠', 'molesto'];
    if (a.confianza >= 750) return ['😎', 'confiado'];
    if (a.estres >= 300) return ['😬', 'tenso'];
    return ['🙂', 'tranquilo'];
  }
  const nombreDe = i => i === 0 ? 'Tú' : nombreBot(i);
  const colorDe = i => i === 0 ? COLOR_TU : COLOR_BOT[i - 1];
  const chip = i => `<b class="tt-chip" style="--c:${colorDe(i)}">${nombreDe(i)}</b>`;
  const teclaObjetivo = () => (TM.leeTeclas().objetivo || []).map(TM.nombreTecla).join(' / ') || '—';
  function pintaRivales() {
    const cont = $('rivales');
    if (modo !== 'bots') return;
    const m = g?.m;
    const firma = [dif, m ? m.fuera.map(k => k < 0 ? 1 : 0).join('') : '---'].join('|');
    if (firma !== rivalesFirma) {
      rivalesFirma = firma;
      cont.innerHTML = [1, 2, 3].map(i => `<div class="tt-rival${m && m.fuera[i] >= 0 ? ' fuera' : ''}" data-i="${i}" style="--c:${COLOR_BOT[i - 1]}" title="Atacar a ${nombreBot(i)}">` +
        `<em class="tt-sello">🎯 Objetivo</em><span class="tt-lienzo"><span class="tt-diana" aria-hidden="true"><i></i><i></i><i></i><i></i></span>` +
        `<canvas width="90" height="180" aria-label="Pozo de ${nombreBot(i)}"></canvas></span><span class="nom"><i class="cara" aria-hidden="true">🙂</i>${nombreBot(i)}<b class="kos"></b></span>` +
        `<small class="rol">${rolBot(i)}</small><small class="apunta"></small><small class="porque"></small><small class="dat"></small></div>`).join('');
    }
    for (let i = 1; i <= TV.RIVALES; i++) {
      const el = cont.querySelector(`[data-i="${i}"]`);
      if (!el) continue;
      const p = m?.pozos[i], vivo = !!(m && m.fuera[i] < 0);
      TM.pintaResumen(el.querySelector('canvas').getContext('2d'), p ? TM.resumen(p) : '', { celda: 9, muerto: !!(m && m.fuera[i] >= 0) });
      const txt = p ? `${p.lineas} lín · ${m.enviadas[i]} env` : TV.NOMBRE_DIF[dif];
      const d = el.querySelector('.dat');
      if (d.textContent !== txt) d.textContent = txt;
      const jugando = estado === 'jugando' || estado === 'pausa';
      el.classList.toggle('objetivo', !!(m && jugando && vivo && m.objetivo[0] === i));
      const o = m && vivo ? m.objetivo[i] : -1;
      el.classList.toggle('teapunta', jugando && o === 0);
      const ap = el.querySelector('.apunta'), apTxt = o < 0 || !jugando ? '' : o === 0 ? '→ TÚ' : '→ ' + nombreBot(o);
      if (ap.textContent !== apTxt) { ap.textContent = apTxt; ap.style.setProperty('--c', o > 0 ? COLOR_BOT[o - 1] : '#ff4a5e'); }
      const porque = o >= 0 && jugando ? PORQUE[m.motivo[i]] || '' : '';
      if (ap.title !== porque) ap.title = porque;
      const [emo, animo] = vivo && jugando ? cara(m.animo(i)) : ['🙂', ''];
      const ce = el.querySelector('.cara');
      if (ce.textContent !== emo) { ce.textContent = emo; ce.title = animo; }
      const pq = el.querySelector('.porque');
      if (pq.textContent !== porque) pq.textContent = porque;
      const k = el.querySelector('.kos'), kTxt = m && m.ko[i] ? ` 💀${m.ko[i]}` : '';
      if (k.textContent !== kTxt) k.textContent = kTxt;
    }
    pintaBatalla();
  }
  /* La barra de batalla, encima del pozo: a quién atacas, quién te tiene
     en la mira y lo último que pasó. En el celular no cabe: ahí lo dicen
     el HUD (🎯), las tarjetas de los rivales y el borde rojo del pozo. */
  function pintaBatalla() {
    const m = g?.m, jugando = !!m && (estado === 'jugando' || estado === 'pausa' || estado === 'fin');
    const obj = m && m.fuera[0] < 0 ? m.objetivo[0] : -1;
    const ap = m ? [1, 2, 3].filter(i => m.fuera[i] < 0 && m.objetivo[i] === 0) : [];
    $('pozo').parentElement.dataset.apuntan = jugando && estado !== 'fin' ? ap.length : 0;
    const f = [jugando, obj, ap.join(''), feed.map(x => x.id).join(','), m ? m.ko[0] : 0].join('|');
    if (f === batallaFirma) return; batallaFirma = f;
    $('batalla').hidden = !jugando;
    $('hudObj').textContent = obj > 0 ? nombreBot(obj) : '—';
    $('hudObj').style.color = obj > 0 ? COLOR_BOT[obj - 1] : '';
    $('batObj').innerHTML = obj > 0 ? `🎯 Atacas a ${chip(obj)} <small>cambia con ${teclaObjetivo()} o tocando un rival</small>` : '🎯 Sin objetivo';
    $('batAp').innerHTML = ap.length ? `👁 Te apunta${ap.length > 1 ? 'n' : ''} ${ap.map(chip).join(' ')}` : '<span class="tt-calma">👁 Nadie te apunta</span>';
    $('batAp').classList.toggle('peligro', ap.length > 0);
    $('feed').innerHTML = feed.map(x => `<p>${x.html}</p>`).join('');
  }
  let feedN = 0;
  function anotaFeed(html) {
    feed.unshift({ id: ++feedN, html });
    if (feed.length > 3) feed.length = 3;
  }
  /* Ancho: los rivales son una cuarta columna junto al pozo. Angosto: una
     fila debajo (dentro de la fila del pozo empujaban «Siguientes» fuera de
     la pantalla). En el modo celular vuelven a ser una columna fina. */
  const angosto = matchMedia('(max-width:760px)');
  function ubicaRivales() {
    const r = $('rivales'), main = document.querySelector('.tt-juego');
    const dentro = !angosto.matches || document.documentElement.classList.contains('club-inm');
    if (dentro && r.parentNode !== main) main.appendChild(r);
    else if (!dentro && r.parentNode === main) main.after(r);
  }
  angosto.addEventListener?.('change', ubicaRivales);
  new MutationObserver(ubicaRivales).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  ubicaRivales();
  /* Tocar un rival lo vuelve tu objetivo. Es una pulsación más para la
     capa anti-bot (origen «T»: puntero, no teclado). */
  $('rivales').addEventListener('pointerdown', e => {
    const el = e.target.closest('.tt-rival');
    if (!el || estado !== 'jugando' || !g?.m) return;
    e.preventDefault();
    const i = +el.dataset.i;
    if (g.m.fuera[i] >= 0 || g.m.objetivo[0] === i) return;
    pulsos.baja('rival-' + i, e.timeStamp, origen(e, true));
    acciones('apunta' + i);
  });
  $('rivales').addEventListener('pointerup', e => {
    const el = e.target.closest('.tt-rival');
    if (el && pulsos) pulsos.sube('rival-' + el.dataset.i, e.timeStamp);
  });
  const elDe = i => i === 0 ? pozo : $('rivales').querySelector(`[data-i="${i}"] canvas`);
  function golpe(i) {
    const el = $('rivales').querySelector(`[data-i="${i}"]`);
    if (!el) return;
    el.classList.remove('golpe'); void el.offsetWidth; el.classList.add('golpe');
  }
  function alerta(html, c, ms) {
    const el = $('alerta');
    el.innerHTML = `<span style="--c:${c}">${html}</span>`;
    el.classList.remove('ve'); void el.offsetWidth; el.classList.add('ve');
    clearTimeout(alertaT); alertaT = setTimeout(() => el.classList.remove('ve'), ms || 1700);
  }
  let alertaHasta = 0;
  function vsEventos() {
    const m = g.m;
    for (const c of m.cambios.splice(0)) {
      if (c.de === 0) { efecto('fijado'); continue; }
      /* Un bot te pone en la mira: aviso suave (si no hay uno de ataque en pantalla). */
      const porque = PORQUE[c.motivo] ? ` <small>(${PORQUE[c.motivo]})</small>` : '';
      if (c.a === 0) {
        efecto('teApuntan');
        anotaFeed(`${chip(c.de)} te apunta 👁${porque}`);
        if (performance.now() > alertaHasta) alerta(`👁 ${nombreBot(c.de)} te apunta${PORQUE[c.motivo] ? ': ' + PORQUE[c.motivo] : ''}`, COLOR_BOT[c.de - 1], 1500);
      } else anotaFeed(`${chip(c.de)} apunta a ${chip(c.a)}${porque}`);
    }
    for (const a of m.ataques.splice(0)) {
      anotaFeed(`${chip(a.de)} ➜ ${chip(a.a)} <b class="tt-n">${a.n}</b>`);
      const llega = () => {
        if (a.a === 0) { fx.amenaza(a.n); efecto('alarma', a.n); }
        else golpe(a.a);
      };
      if (a.a === 0) { alertaHasta = performance.now() + 1700; alerta(`⚠ ${nombreBot(a.de)} te manda ${a.n}`, COLOR_BOT[a.de - 1]); }
      if (a.de === 0) efecto('envia', a.n);
      FX.misil(elDe(a.de), elDe(a.a), { color: colorDe(a.de), n: a.n, clase: 'tt-misil', dura: 480, alLlegar: llega });
    }
    const kos = m.kos.splice(0), conKo = new Set(kos.map(k => k.a));
    for (const k of kos) {
      anotaFeed(`💀 ${chip(k.de)} deja fuera a ${chip(k.a)}`);
      if (k.de === 0) { avisa(`¡KO a ${nombreBot(k.a)}!`, 'ko'); efecto('record'); }
      else if (k.a !== 0) avisa(`¡${nombreBot(k.a)} fuera! KO de ${nombreBot(k.de)}`, 'ko');
    }
    for (const i of m.caidas.splice(0)) if (i > 0 && !conKo.has(i)) { anotaFeed(`💀 ${chip(i)} se ahogó solo`); avisa(`¡${nombreBot(i)} fuera!`, 'ko'); efecto('nivel'); }
  }

  function bucle(t) {
    requestAnimationFrame(bucle);
    const dt = ultimo ? Math.min(100, t - ultimo) : 0; ultimo = t;
    if (estado === 'cuenta') cuentaPaso(t);
    if (estado === 'jugando') {
      const ahora = Date.now();
      if (paredAntes) pared += Math.min(1000, Math.max(0, ahora - paredAntes));
      paredAntes = ahora;
      /* Pasos fijos de TM.PASO ms, los que quepan en este cuadro: lo que
         rehace el verificador es exactamente esta sucesión. */
      resto += dt;
      while (resto >= TM.PASO && estado === 'jugando') {
        resto -= TM.PASO;
        mando.paso(TM.PASO);
        const fin = g.paso(mando.blando);
        eventos();
        if (g.m) vsEventos();
        if (fin) { if (modo === 'ultra' && fin.gano) s.tiempo = ULTRA_MS; termina(fin.gano); }
      }
    }
    if (estado !== 'pausa') fx.paso(dt);
    latido(dt);
    musica();
    pinta(); pintaDatos();
    if (modo === 'bots' && estado !== 'menu') pintaRivales();
  }

  $('sonido').textContent = sonido ? '🔊' : '🔈';
  ponModo();
  requestAnimationFrame(bucle);
})();
