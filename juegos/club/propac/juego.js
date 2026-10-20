/* PRO PACMAN — la pantalla.
   Todo lo que decide una partida está en motor.js (tics enteros de 1/60 s);
   aquí solo se dibuja, se suena y se recogen las jugadas. Una jugada se
   aplica justo antes del tic siguiente y se anota como [Δtics, código,
   origen]: verifica/propac.js la rehace con el mismo motor, así que nada de
   lo que pasa aquí (interpolación, partículas, sonido) puede tocar el estado.

   En el celular (CLAUDE.md del Club, «Modo celular») la partida va a
   pantalla completa: marcador fino arriba, el laberinto ajustado al resto y
   la botonera abajo. Se juega deslizando el dedo en cualquier parte o con
   la cruceta; ⚡ y ◎ son turbo y pulso. */
(() => {
  'use strict';
  const M = window.PropacMotor, Club = window.Club;
  const $ = id => document.getElementById(id);
  const CATEGORIA = 'club-propac-puntos';
  const TS = 24, HUD = 34;                       // px lógicos por casilla y franjas del lienzo
  const LW = 19 * TS, LH = 21 * TS + 2 * HUD;
  const PASO_MS = 1000 / M.TPS;
  const COLORES = ['#ff3b5c', '#ff7ad9', '#3df5ff', '#ffb23d', '#b6ff3d'];
  const NOMBRES = ['Rayo', 'Eco', 'Rebote', 'Tímido', 'Glitch'];
  const RACHA_COL = ['#ffe14d', '#ffb02e', '#ff5fa2', '#c86bff', '#ffffff'];
  const clamp = (n, a, b) => n < a ? a : n > b ? b : n;
  // La letra pixelada no trae tildes: en el lienzo van sin ellas.
  const sinTilde = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

  /* ---------- Guardado ---------- */
  const CUENTA = Club && Club.storageKey ? Club.storageKey('').replace(/^\.cuenta\./, '') : 'local';
  const clave = k => Club && Club.storageKey ? Club.storageKey(k) : k + '.cuenta.local';
  function lee(k) { try { return JSON.parse(localStorage.getItem(clave(k)) || 'null'); } catch (_) { return null; } }
  function guarda(k, v) { try { localStorage.setItem(clave(k), JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } }
  const p0 = lee('propac.progreso') || {};
  const prog = { mejor: Math.max(0, p0.mejor | 0), partidas: Math.max(0, p0.partidas | 0), nivel: Math.max(0, p0.nivel | 0) };

  /* ---------- Lienzo ---------- */
  const lienzo = $('lienzo'), ctx = lienzo.getContext('2d'), escenario = $('escenario');
  let k = 1, ox = 0, oy = 0, dpr = 1;
  function mide() {
    const caja = lienzo.getBoundingClientRect();
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(caja.width * dpr)), h = Math.max(1, Math.round(caja.height * dpr));
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
    k = Math.min(w / LW, h / LH);
    ox = Math.round((w - LW * k) / 2); oy = Math.round((h - LH * k) / 2);
    paredes = null;
  }
  new ResizeObserver(mide).observe(lienzo);

  /* ---------- Sonido (WebAudio en vivo; volumen.js lo gobierna por debajo) ---------- */
  let ac = null, salida = null, sirena = null;
  let mudo = false; try { mudo = localStorage.getItem('propac.mudo') === '1'; } catch (_) { /* nada */ }
  function audio() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        salida = ac.createGain(); salida.gain.value = mudo ? 0 : 0.55; salida.connect(ac.destination);
      } catch (_) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  function tono(f, dur, o = {}) {
    if (!ac || mudo) return;
    const t = ac.currentTime + (o.en || 0), osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.tipo || 'square';
    osc.frequency.setValueAtTime(f, t);
    if (o.a) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.a), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.08, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(salida);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  let waka = 0;
  const SON = {
    punto() { waka ^= 1; tono(waka ? 560 : 420, 0.07, { tipo: 'triangle', a: waka ? 380 : 600, vol: 0.07 }); },
    poder() { tono(180, 0.35, { tipo: 'sawtooth', a: 900, vol: 0.07 }); tono(90, 0.4, { tipo: 'square', a: 300, vol: 0.05 }); },
    come(n) { const b = 400 + 120 * n; [0, 1, 2, 3].forEach(i => tono(b * Math.pow(1.26, i), 0.07, { en: i * 0.045, vol: 0.08 })); },
    muere() { tono(700, 1.1, { tipo: 'square', a: 60, vol: 0.09 }); tono(350, 1.1, { tipo: 'triangle', a: 40, vol: 0.06, en: 0.1 }); },
    turbo() { tono(200, 0.28, { tipo: 'sawtooth', a: 1400, vol: 0.06 }); },
    pulso() { tono(90, 0.6, { tipo: 'sine', a: 30, vol: 0.22 }); tono(1200, 0.3, { tipo: 'square', a: 200, vol: 0.04 }); },
    item() { tono(880, 0.08, { vol: 0.06 }); tono(1320, 0.1, { vol: 0.06, en: 0.08 }); },
    carga() { [660, 880, 1100].forEach((f, i) => tono(f, 0.09, { tipo: 'triangle', en: i * 0.06, vol: 0.09 })); },
    chip() { [520, 660, 780, 1040, 1320].forEach((f, i) => tono(f, 0.08, { en: i * 0.05, vol: 0.07 })); },
    vida() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tono(f, 0.1, { tipo: 'triangle', en: i * 0.09, vol: 0.09 })); },
    nivel() { [392, 523, 659, 784, 1047].forEach((f, i) => tono(f, 0.12, { tipo: 'square', en: i * 0.1, vol: 0.06 })); },
    limpio() { [1047, 784, 1047, 1319].forEach((f, i) => tono(f, 0.1, { tipo: 'triangle', en: i * 0.12, vol: 0.08 })); },
    compuerta(abre) { tono(abre ? 300 : 160, 0.12, { tipo: 'square', a: abre ? 600 : 80, vol: 0.05 }); },
    glitch() { for (let i = 0; i < 6; i++) tono(200 + Math.random() * 1600, 0.04, { en: i * 0.03, vol: 0.05 }); },
    aviso() { tono(1500, 0.05, { vol: 0.04 }); tono(1500, 0.05, { vol: 0.04, en: 0.12 }); }
  };
  /* La sirena de fondo: un oscilador que sube y baja; en miedo, otra ondulación. */
  function suenaSirena(t) {
    if (!ac || !salida) return;
    const quiere = estado === 'jugando' && !pausado && E && E.estado === 'jugando' && E.congelado === 0 && !mudo;
    if (!sirena && quiere) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; g.gain.value = 0; o.connect(g); g.connect(salida); o.start();
      sirena = { o, g };
    }
    if (!sirena) return;
    const ahora = ac.currentTime;
    if (!quiere) { sirena.g.gain.setTargetAtTime(0, ahora, 0.05); return; }
    const miedo = E.miedoT > 0, ritmo = miedo ? 9 : 3 + Math.min(4, E.nivel * 0.4);
    const base = miedo ? 260 : 330 + (1 - E.restantes / E.mapa.total) * 220;
    sirena.o.frequency.setTargetAtTime(base + Math.sin(t / 1000 * ritmo * Math.PI) * (miedo ? 40 : 70), ahora, 0.02);
    sirena.g.gain.setTargetAtTime(0.018, ahora, 0.1);
  }
  function pintaSonido() {
    const b = $('sound-button');
    b.setAttribute('aria-pressed', mudo ? 'false' : 'true');
    b.setAttribute('aria-label', mudo ? 'Activar música y efectos' : 'Desactivar música y efectos');
  }
  pintaSonido();
  $('sound-button').addEventListener('click', () => {
    mudo = !mudo; audio();
    if (salida) salida.gain.setTargetAtTime(mudo ? 0 : 0.55, ac.currentTime, 0.02);
    try { localStorage.setItem('propac.mudo', mudo ? '1' : '0'); } catch (_) { /* nada */ }
    pintaSonido();
  });

  /* ---------- Estado de la pantalla ---------- */
  let estado = 'menu';               // menu · jugando · fin
  let pausado = false;
  let E = null, jug = [], ult = 0, cola = [], fiable = true, tocado = false;
  let t0 = 0, w0 = 0, pP = 0, pW = 0, pP0 = 0, pW0 = 0, acc = 0, ultimo = performance.now();
  let antes = null;                  // posiciones del tic anterior, para interpolar
  let paredes = null, paredesDe = '';
  const parts = [], textos = [], ondas = [];
  let sacudida = 0, destello = 0, banner = null, rastro = [];

  /* ---------- Entrada ---------- */
  const hayMando = () => { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(g => g && g.connected); } catch (_) { return false; } };
  const deVerdad = e => !e || e.isTrusted || (!!e.__mando && hayMando());
  const origenDe = e => !deVerdad(e) ? 'x' : e.__mando ? 'm' : e.pointerType === 'touch' ? 't' : e.pointerType ? 'r' : 'k';

  /* Una jugada pedida: se encola y entra al motor antes del tic siguiente. */
  function pide(c, e) {
    audio();
    if (pausado) return;
    if (estado === 'menu') { if (c <= 3) { empieza(); cola.push({ c, o: origenDe(e) }); } return; }
    if (estado !== 'jugando') return;
    const o = origenDe(e);
    if (o === 'x') fiable = false;
    cola.push({ c, o });
  }

  const TECLAS = { ArrowUp: 0, KeyW: 0, ArrowLeft: 1, KeyA: 1, ArrowDown: 2, KeyS: 2, ArrowRight: 3, KeyD: 3, Space: 4, ShiftLeft: 4, ShiftRight: 4, KeyE: 5, KeyQ: 5, KeyX: 5 };
  addEventListener('keydown', e => {
    const c = e.code;
    if (c === 'KeyP' || c === 'Escape') { if (estado === 'jugando') { e.preventDefault(); pausado ? sigue() : pausa(); } return; }
    // Un botón con foco se queda con su Espacio o su Intro.
    const foco = document.activeElement;
    if ((c === 'Space' || c === 'Enter') && foco && foco.tagName === 'BUTTON' && !e.__mando) return;
    if (c === 'Enter') { if (estado === 'menu') { e.preventDefault(); empieza(); } else if (estado === 'fin') { e.preventDefault(); otraVez(); } return; }
    if (!(c in TECLAS)) return;
    e.preventDefault();
    if (e.repeat) return;
    pide(TECLAS[c], e);
  });

  /* Deslizar: en cuanto el dedo recorre `UMBRAL` px en un eje, esa es la
     dirección, y el origen se renueva para que un mismo gesto pueda girar
     dos veces (una L) sin levantar el dedo. */
  const UMBRAL = 18;
  let gesto = null;
  function empiezaGesto(e) {
    if (e.button > 0 || e.target.closest('button,a,input,.club-ranking,.club-vol-flota')) return;
    if (estado !== 'jugando' && !(estado === 'menu' && escenario.contains(e.target))) return;
    gesto = { id: e.pointerId, x: e.clientX, y: e.clientY, e };
    if (estado === 'jugando') e.preventDefault();
  }
  function mueveGesto(e) {
    if (!gesto || e.pointerId !== gesto.id) return;
    const dx = e.clientX - gesto.x, dy = e.clientY - gesto.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < UMBRAL) return;
    const c = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 3) : (dy < 0 ? 0 : 2);
    gesto.x = e.clientX; gesto.y = e.clientY;
    if (estado === 'jugando') e.preventDefault();
    pide(c, e);
  }
  const sueltaGesto = e => { if (gesto && e.pointerId === gesto.id) gesto = null; };
  document.addEventListener('pointerdown', empiezaGesto, { passive: false });
  document.addEventListener('pointermove', mueveGesto, { passive: false });
  document.addEventListener('pointerup', sueltaGesto);
  document.addEventListener('pointercancel', sueltaGesto);
  // Un dedo encima del juego no desplaza ni hace zoom ni selecciona.
  escenario.addEventListener('touchstart', e => { if (estado === 'jugando' && !e.target.closest('button')) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', e => { if (estado === 'jugando' && document.documentElement.classList.contains('club-inm')) e.preventDefault(); }, { passive: false });
  for (const t of ['selectstart', 'contextmenu', 'dragstart']) escenario.addEventListener(t, e => e.preventDefault());

  /* La botonera táctil: actúa al apoyar el dedo, sin esperar al clic. */
  for (const b of document.querySelectorAll('#mandos button')) {
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      b.classList.add('pulsado');
      pide(+b.dataset.c, e);
    });
    const suelta = () => b.classList.remove('pulsado');
    b.addEventListener('pointerup', suelta); b.addEventListener('pointercancel', suelta); b.addEventListener('pointerleave', suelta);
    b.addEventListener('contextmenu', e => e.preventDefault());
  }

  const inmersivo = v => { if (Club && Club.inmersivo) Club.inmersivo(v); };
  $('btnJugar').addEventListener('click', () => empieza());
  $('btnOtra').addEventListener('click', () => otraVez());
  $('btnSeguir').addEventListener('click', () => sigue());
  $('btnSalir').addEventListener('click', () => { if (!E) return; pausado = false; $('pausa').hidden = true; termina(true); });
  $('btnPausaM').addEventListener('click', () => { if (estado === 'jugando') pausado ? sigue() : pausa(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && estado === 'jugando') pausa(); });
  addEventListener('blur', () => { if (estado === 'jugando') pausa(); });

  /* ---------- Ciclo de una partida ---------- */
  function empieza() {
    if (estado === 'jugando') return;
    audio();
    const s = new Uint32Array(1); crypto.getRandomValues(s);
    E = M.nueva(s[0], CUENTA);
    jug = []; ult = 0; cola = []; fiable = true; tocado = false;
    t0 = performance.now(); w0 = Date.now(); pP = pW = 0; acc = 0; ultimo = performance.now();
    parts.length = textos.length = ondas.length = 0; rastro = []; sacudida = destello = 0; antes = null;
    estado = 'jugando'; pausado = false; banner = null;
    document.documentElement.classList.add('pp-juega');
    $('inicio').hidden = true; $('fin').hidden = true; $('pausa').hidden = true;
    inmersivo(true);
    eventos();
    lienzo.focus({ preventScroll: true });
    pintaMarcador();
  }
  function pausa() {
    if (estado !== 'jugando' || pausado) return;
    pausado = true; inmersivo(false);
    pP0 = performance.now(); pW0 = Date.now();
    $('pausa').hidden = false; $('btnSeguir').focus({ preventScroll: true });
  }
  function sigue() {
    if (!pausado) return;
    pausado = false; inmersivo(true);
    pP += performance.now() - pP0; pW += Date.now() - pW0;
    $('pausa').hidden = true; ultimo = performance.now(); acc = 0; cola = [];
    lienzo.focus({ preventScroll: true });
  }
  function otraVez() { estado = 'menu'; empieza(); }

  function termina(abandono) {
    estado = 'fin'; inmersivo(false); gesto = null;
    document.documentElement.classList.remove('pp-juega');
    const p = E.puntos, previo = prog.mejor;
    // Una partida tocada desde la consola o con jugadas sintéticas no cuenta como marca.
    if (fiable && !tocado) { prog.mejor = Math.max(prog.mejor, p); prog.nivel = Math.max(prog.nivel, E.nivel); }
    prog.partidas++;
    guarda('propac.progreso', prog);
    reporta();
    $('finTitulo').textContent = abandono ? 'FIN' : 'GAME OVER';
    $('finPuntos').textContent = p.toLocaleString('es-CL');
    $('finNivel').textContent = E.nivel + ' · ' + E.mapa.nombre;
    $('finRacha').textContent = String(E.mejorRacha);
    $('finMejor').textContent = prog.mejor.toLocaleString('es-CL');
    $('finNuevo').hidden = !(fiable && !tocado && p > previo && p > 0);
    $('finFrase').textContent = frase();
    $('fin').hidden = false;
    setTimeout(() => { if (estado === 'fin') $('btnOtra').focus({ preventScroll: true }); }, 350);
    pintaMarcador();
  }
  function frase() {
    if (!fiable) return 'Hubo jugadas que no hizo una mano: esta partida no entra en la clasificación.';
    if (tocado) return 'Partida de prueba: no entra en la clasificación.';
    if (E.fantasmasComidos >= 16) return `Te comiste ${E.fantasmasComidos} fantasmas. Ellos también te tienen miedo.`;
    if (E.mejorRacha >= 120) return `Racha de ${E.mejorRacha} puntos seguidos: el laberinto echaba chispas.`;
    if (E.nivel >= 4) return `Llegaste al nivel ${E.nivel}. Glitch ya te conoce.`;
    if (E.nivel >= 2) return 'Las compuertas se cierran justo cuando más las necesitas.';
    return 'Encadena puntos sin parar: la racha multiplica todo lo que comes.';
  }

  function reporta() {
    if (!Club || !E || E.puntos < 1 || !fiable || tocado) return;
    const j = M.codifica(jug);
    if (j.length > 180000) return;
    const ahora = performance.now();
    const prueba = { v: 1, s: E.s, u: E.u, j, n: E.tick, r: Math.round(ahora - t0),
      // Lo jugado sin pausas en los dos relojes: un reloj trucado en uno solo los separa.
      a: Math.round(ahora - t0 - pP), w: Date.now() - w0 - pW };
    Club.result({ categoria: CATEGORIA, puntos: E.puntos, tiempo: M.tiempoMs(E) }, prueba);
  }

  /* Un tic: primero las jugadas pedidas, después el motor. */
  function tic() {
    for (const q of cola) {
      // Pedir la dirección que ya se lleva no cambia nada: no se anota.
      if (q.c <= 3 && (E.pac.quiere === q.c || (E.pac.quiere < 0 && E.pac.dir === q.c))) continue;
      if (M.entrada(E, q.c)) { jug.push([E.tick - ult, q.c, q.o]); ult = E.tick; }
    }
    cola.length = 0;
    antes = { px: E.pac.x, py: E.pac.y, g: E.fantasmas.map(g => [g.x, g.y]) };
    M.paso(E);
    if (E.turboT > 0 && E.tick % 2 === 0) rastro.push({ x: E.pac.x, y: E.pac.y, v: 1 });
    eventos();
  }

  function eventos() {
    for (const ev of E.ev) {
      switch (ev.k) {
        case 'nivel': banner = { t: 'NIVEL ' + ev.n, s: E.mapa.nombre, hasta: E.tick + E.congelado }; paredes = null; if (ev.n > 1) SON.nivel(); break;
        case 'listo': banner = { t: '¡LISTO!', s: E.vidas === 1 ? 'Última vida' : E.vidas + ' vidas', hasta: E.tick + E.congelado }; break;
        case 'limpio': SON.limpio(); destello = 0.6; break;
        case 'punto': SON.punto(); break;
        case 'poder': SON.poder(); destello = 0.25; break;
        case 'come': SON.come(E.comidos); textos.push({ x: ev.x, y: ev.y, t: String(ev.v), c: '#7ff', v: 1 }); chispas(ev.x, ev.y, COLORES[ev.id], 14); break;
        case 'muere': SON.muere(); sacudida = 0.5; break;
        case 'turbo': SON.turbo(); break;
        case 'pulso': SON.pulso(); ondas.push({ x: ev.x, y: ev.y, v: 1 }); sacudida = 0.25;
          if (ev.n) textos.push({ x: ev.x, y: ev.y - 10, t: '+' + 100 * ev.n, c: '#9cf', v: 1 }); break;
        case 'item': SON.item(); break;
        case 'carga': SON.carga(); textos.push({ x: E.pac.x, y: E.pac.y, t: '+PULSO', c: '#8fd8ff', v: 1 }); break;
        case 'chip': SON.chip(); textos.push({ x: ev.x, y: ev.y, t: '+' + ev.v, c: '#ffe14d', v: 1.3 }); chispas(ev.x, ev.y, '#ffe14d', 18); break;
        case 'vida': SON.vida(); textos.push({ x: E.pac.x, y: E.pac.y - 12, t: '+1 VIDA', c: '#7dff9b', v: 1.5 }); break;
        case 'abre': SON.compuerta(true); break;
        case 'cierra': SON.compuerta(false); break;
        case 'glitch': SON.glitch(); chispas(ev.x0, ev.y0, COLORES[4], 10); chispas(ev.x, ev.y, COLORES[4], 10); break;
        case 'glitch-aviso': SON.aviso(); break;
        case 'fin': break;
      }
    }
    E.ev.length = 0;
  }
  function chispas(x, y, c, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 2.2;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c, v: 0.5 + Math.random() * 0.4 });
    }
  }

  /* ---------- Dibujo ---------- */
  // Del mundo del motor (8 unidades por casilla) al lienzo lógico.
  const X = u => u * TS / M.U, Y = u => HUD + u * TS / M.U;

  /* Las paredes, pintadas una vez por laberinto y tamaño: tubos de neón por el
     centro de las casillas de borde. Dos paredes vecinas se unen si dan al
     mismo pasillo; en un rincón hacia adentro, en diagonal. */
  function pintaParedes() {
    const m = E.mapa, firma = m.i + ':' + lienzo.width + 'x' + lienzo.height;
    if (paredes && paredesDe === firma) return;
    paredesDe = firma;
    const c = document.createElement('canvas');
    c.width = Math.ceil(LW * k); c.height = Math.ceil(21 * TS * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    const pared = (x, y) => x < 0 || y < 0 || x >= m.ancho || y >= m.alto ? true : m.tipo[y * m.ancho + x] === M.PARED;
    const abierto = (x, y) => x >= 0 && y >= 0 && x < m.ancho && y < m.alto && !pared(x, y);
    const segs = [];
    for (let y = 0; y < m.alto; y++) for (let x = 0; x < m.ancho; x++) {
      if (!pared(x, y)) continue;
      if (x + 1 < m.ancho && pared(x + 1, y) && ((abierto(x, y - 1) && abierto(x + 1, y - 1)) || (abierto(x, y + 1) && abierto(x + 1, y + 1)))) segs.push([x, y, x + 1, y]);
      if (y + 1 < m.alto && pared(x, y + 1) && ((abierto(x - 1, y) && abierto(x - 1, y + 1)) || (abierto(x + 1, y) && abierto(x + 1, y + 1)))) segs.push([x, y, x, y + 1]);
      // Rincones hacia adentro: la diagonal libre entre dos paredes.
      for (const [dx, dy] of [[1, 1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (ny >= m.alto || nx < 0 || nx >= m.ancho || !pared(nx, ny)) continue;
        if (pared(nx, y) && !pared(x, ny) && abierto(x, ny)) segs.push([x, y, nx, ny]);
        else if (pared(x, ny) && !pared(nx, y) && abierto(nx, y)) segs.push([x, y, nx, ny]);
      }
      // Una pared suelta: un nudo.
      if (abierto(x - 1, y) && abierto(x + 1, y) && abierto(x, y - 1) && abierto(x, y + 1)) segs.push([x, y, x, y]);
    }
    const traza = () => {
      g.beginPath();
      for (const [a, b, c2, d] of segs) { g.moveTo(a * TS + TS / 2, b * TS + TS / 2); g.lineTo(c2 * TS + TS / 2 + (a === c2 && b === d ? 0.01 : 0), d * TS + TS / 2); }
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = m.color; g.shadowBlur = 12;
    g.strokeStyle = m.color; g.globalAlpha = 0.55; g.lineWidth = 9; traza(); g.stroke();
    g.shadowBlur = 0; g.globalAlpha = 1; g.lineWidth = 4.5; traza(); g.stroke();
    g.strokeStyle = '#ffffffcc'; g.lineWidth = 1.4; traza(); g.stroke();
    paredes = c;
  }

  function dibuja(t, alfa) {
    const W = lienzo.width, H = lienzo.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04050d'; ctx.fillRect(0, 0, W, H);
    let sx = 0, sy = 0;
    if (sacudida > 0) { sx = (Math.random() - 0.5) * 10 * sacudida; sy = (Math.random() - 0.5) * 10 * sacudida; }
    ctx.setTransform(k, 0, 0, k, ox + sx * k, oy + sy * k);
    fondo(t);
    if (!E) { menuDecor(t); return; }
    const m = E.mapa;
    pintaParedes();
    const limpio = E.estado === 'nivel';
    ctx.save();
    if (limpio && Math.floor(t / 180) % 2) ctx.filter = 'brightness(2.2) saturate(0.2)';
    ctx.setTransform(1, 0, 0, 1, ox + sx * k, oy + (HUD + sy) * k);
    ctx.drawImage(paredes, 0, 0);
    ctx.restore();
    compuertas(t);
    puerta();
    comida(t);
    item(t);
    for (const o of ondas) { ctx.strokeStyle = `rgba(140,220,255,${o.v})`; ctx.lineWidth = 3 * o.v; ctx.beginPath(); ctx.arc(X(o.x), Y(o.y), (1 - o.v) * X(M.PULSO_RADIO) * 1.3 + 4, 0, Math.PI * 2); ctx.stroke(); }
    for (const r of rastro) { ctx.fillStyle = `rgba(120,240,255,${r.v * 0.35})`; ctx.beginPath(); ctx.arc(X(r.x), Y(r.y), 9 * r.v, 0, Math.PI * 2); ctx.fill(); }
    const pos = (x, y, ax, ay) => (antes && Math.abs(x - ax) < M.U && Math.abs(y - ay) < M.U) ? [ax + (x - ax) * alfa, ay + (y - ay) * alfa] : [x, y];
    E.fantasmas.forEach((g, i) => { const [x, y] = antes && antes.g[i] ? pos(g.x, g.y, antes.g[i][0], antes.g[i][1]) : [g.x, g.y]; fantasma(g, X(x), Y(y), t); });
    const [px, py] = antes ? pos(E.pac.x, E.pac.y, antes.px, antes.py) : [E.pac.x, E.pac.y];
    pac(X(px), Y(py), t);
    for (const q of parts) { ctx.globalAlpha = clamp(q.v * 2, 0, 1); ctx.fillStyle = q.c; ctx.fillRect(X(q.x) - 1.5, Y(q.y) - 1.5, 3, 3); }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const q of textos) {
      ctx.globalAlpha = clamp(q.v * 1.5, 0, 1); ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillStyle = '#000'; ctx.fillText(q.t, X(q.x) + 1, Y(q.y) - (1 - Math.min(1, q.v)) * 18 + 1);
      ctx.fillStyle = q.c; ctx.fillText(q.t, X(q.x), Y(q.y) - (1 - Math.min(1, q.v)) * 18);
    }
    ctx.globalAlpha = 1;
    // Las franjas del marcador van pegadas a los bordes del lienzo, no del laberinto:
    // en un celular alto así el espacio que sobra queda entre ellas y el juego.
    ctx.setTransform(k, 0, 0, k, ox, 0);
    hud(t, 'arriba');
    ctx.setTransform(k, 0, 0, k, ox, lienzo.height - LH * k);
    hud(t, 'abajo');
    ctx.setTransform(k, 0, 0, k, ox + sx * k, oy + sy * k);
    if (banner && E.estado === 'jugando' && E.tick < banner.hasta) cartel(banner.t, banner.s, t);
    else if (limpio) cartel('¡LIMPIO!', 'Nivel ' + E.nivel + ' superado', t);
    if (destello > 0) { ctx.fillStyle = `rgba(255,255,255,${destello * 0.5})`; ctx.fillRect(0, 0, LW, LH); }
  }

  function fondo(t) {
    ctx.fillStyle = '#060818'; ctx.fillRect(0, 0, LW, LH);
    ctx.strokeStyle = 'rgba(80,110,255,0.07)'; ctx.lineWidth = 1;
    ctx.beginPath();
    const d = (t / 60) % TS;
    for (let x = 0; x <= LW; x += TS) { ctx.moveTo(x, 0); ctx.lineTo(x, LH); }
    for (let y = -TS + d; y <= LH; y += TS) { ctx.moveTo(0, y); ctx.lineTo(LW, y); }
    ctx.stroke();
  }

  function comida(t) {
    const m = E.mapa;
    ctx.fillStyle = '#ffe9b8';
    for (let i = 0; i < m.comida.length; i++) {
      if (m.comida[i] !== 1) continue;
      const x = (i % m.ancho) * TS + TS / 2, y = HUD + Math.floor(i / m.ancho) * TS + TS / 2;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    const r = 6 + Math.sin(t / 140) * 1.6;
    for (let i = 0; i < m.comida.length; i++) {
      if (m.comida[i] !== 2) continue;
      const x = (i % m.ancho) * TS + TS / 2, y = HUD + Math.floor(i / m.ancho) * TS + TS / 2;
      const gr = ctx.createRadialGradient(x, y, 1, x, y, r * 2.2);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, m.brillo); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function compuertas(t) {
    const m = E.mapa;
    if (!m.compuertas) return;
    const abiertas = M.abiertas(E), aviso = M.avisoCompuertas(E) && Math.floor(t / 110) % 2 === 0;
    for (let i = 0; i < m.tipo.length; i++) {
      if (m.tipo[i] !== M.COMPUERTA) continue;
      const cx = (i % m.ancho) * TS, cy = HUD + Math.floor(i / m.ancho) * TS;
      const horiz = m.tipo[i - 1] === M.PARED || m.tipo[i + 1] === M.PARED;   // pared a los lados: la barra va de lado a lado
      ctx.strokeStyle = abiertas ? (aviso ? '#ff4d6d' : 'rgba(255,90,120,0.22)') : (aviso ? '#7dff9b' : '#ff4d6d');
      ctx.lineWidth = abiertas ? 2 : 4;
      ctx.setLineDash(abiertas ? [3, 4] : []);
      ctx.beginPath();
      if (horiz) { ctx.moveTo(cx, cy + TS / 2); ctx.lineTo(cx + TS, cy + TS / 2); }
      else { ctx.moveTo(cx + TS / 2, cy); ctx.lineTo(cx + TS / 2, cy + TS); }
      ctx.stroke();
      if (!abiertas) { ctx.globalAlpha = 0.25; ctx.lineWidth = 10; ctx.stroke(); ctx.globalAlpha = 1; }
    }
    ctx.setLineDash([]);
  }

  function puerta() {
    const [x, y] = E.mapa.puerta;
    ctx.fillStyle = '#ff9bd8';
    ctx.fillRect(x * TS + 2, HUD + y * TS + TS / 2 - 2, TS - 4, 4);
  }

  function item(t) {
    if (!E.item) return;
    const x = E.item.x * TS + TS / 2, y = HUD + E.item.y * TS + TS / 2;
    if (E.item.t < 120 && Math.floor(t / 90) % 2) return;
    ctx.save(); ctx.translate(x, y);
    if (E.item.tipo === 'pulso') {
      ctx.rotate(t / 400);
      ctx.strokeStyle = '#8fd8ff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = '#8fd8ff'; ctx.fillRect(9, -1.5, 4, 3); }
    } else {
      ctx.rotate(Math.sin(t / 300) * 0.2);
      ctx.fillStyle = '#ffe14d'; ctx.fillRect(-8, -6, 16, 12);
      ctx.fillStyle = '#7a5b00'; for (let i = -6; i <= 6; i += 4) { ctx.fillRect(i - 1, -9, 2, 3); ctx.fillRect(i - 1, 6, 2, 3); }
      ctx.fillStyle = '#fff6'; ctx.fillRect(-5, -3, 10, 6);
    }
    ctx.restore();
  }

  function pac(x, y, t) {
    const p = E.pac, mult = M.multiplicador(E), col = RACHA_COL[mult - 1];
    let boca = E.estado === 'jugando' ? 0.08 + Math.abs(Math.sin(E.tick / 3.2)) * 0.32 : 0.12;
    if (E.estado === 'muere') {
      // Se deshace en el último tramo del congelado.
      const f = 1 - E.congelado / 100;
      if (f > 0.25) {
        const g = clamp((f - 0.25) / 0.6, 0, 1);
        if (g >= 1) return;
        boca = 0.12 + g * 0.88;
      }
    }
    const ang = [-Math.PI / 2, Math.PI, Math.PI / 2, 0][p.dir];
    const r = 10;
    // El halo de la racha.
    const gr = ctx.createRadialGradient(x, y, 3, x, y, r * 2.4);
    gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = E.turboT > 0 ? '#bff8ff' : col;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.arc(x, y, r, ang + boca * Math.PI, ang + (2 - boca) * Math.PI);
    ctx.closePath(); ctx.fill();
    // Visor: una franja oscura, el toque «pro».
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#0b1030'; ctx.fillRect(-4, -7.5, 6, 3);
    ctx.fillStyle = '#7ff'; ctx.fillRect(-3, -7, 3, 1.4);
    ctx.restore();
    if (mult >= 5) for (let i = 0; i < 3; i++) { const a = t / 200 + i * 2.1; ctx.fillStyle = '#fff'; ctx.fillRect(x + Math.cos(a) * 15 - 1, y + Math.sin(a) * 15 - 1, 2, 2); }
  }

  function fantasma(g, x, y, t) {
    if (E.estado === 'muere' && E.congelado < 75) return;
    const r = 10, ojosSolo = g.estado === 'ojos';
    let col = COLORES[g.id];
    const asustado = g.estado === 'miedo';
    if (asustado) col = E.miedoT < 120 && Math.floor(t / 130) % 2 ? '#f4f4ff' : '#2a3cff';
    if (g.estado === 'aturdido') col = '#7d84a6';
    ctx.save();
    if (g.id === 4 && (g.aviso > 0 || Math.random() < 0.03)) {
      // Glitch: canales corridos y un parpadeo antes de saltar.
      ctx.globalAlpha = 0.6;
      cuerpo(x - 2, y, r, '#ff2bd6', t, g); cuerpo(x + 2, y, r, '#2bf6ff', t, g);
      ctx.globalAlpha = g.aviso > 0 && Math.floor(t / 60) % 2 ? 0.3 : 1;
    }
    if (g.estado === 'casa') y += Math.sin(t / 180 + g.id) * 2;
    if (!ojosSolo) {
      const gr = ctx.createRadialGradient(x, y, 2, x, y, r * 2.1);
      gr.addColorStop(0, col + '66'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, Math.PI * 2); ctx.fill();
      cuerpo(x, y, r, col, t, g);
    }
    // Ojos que miran hacia donde va.
    const [dx, dy] = M.DIRS[g.dir];
    if (asustado) {
      ctx.fillStyle = col === '#2a3cff' ? '#ffd0d8' : '#ff2a4a';
      ctx.fillRect(x - 5, y - 4, 3, 3); ctx.fillRect(x + 2, y - 4, 3, 3);
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let i = 0; i <= 4; i++) ctx.lineTo(x - 6 + i * 3, y + 3 + (i % 2 ? -2 : 0));
      ctx.stroke();
    } else {
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + s * 4, y - 2, 3.4, 4.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = g.estado === 'aturdido' ? '#444' : '#0b1a6a';
        ctx.beginPath(); ctx.arc(x + s * 4 + dx * 1.6, y - 2 + dy * 2, 1.9, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (g.estado === 'aturdido') {
      for (let i = 0; i < 3; i++) {
        const a = t / 220 + i * 2.09;
        ctx.fillStyle = '#ffe14d'; estrella(x + Math.cos(a) * 9, y - 13 + Math.sin(a) * 3, 2.4);
      }
    }
    ctx.restore();
  }
  function cuerpo(x, y, r, col, t, g) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y - 1, r, Math.PI, 0);
    const base = y + r - 1, fase = Math.floor(t / 120 + g.id) % 2;
    ctx.lineTo(x + r, base);
    for (let i = 0; i < 4; i++) {
      const x0 = x + r - (i + 0.5) * (r / 2);
      ctx.lineTo(x0, base - (i % 2 === fase ? 4 : 1));
      ctx.lineTo(x + r - (i + 1) * (r / 2), base);
    }
    ctx.closePath(); ctx.fill();
  }
  function estrella(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    ctx.closePath(); ctx.fill();
  }

  function hud(t, lado) {
    const top = 0, bot = LH - HUD;
    ctx.fillStyle = 'rgba(4,5,13,0.82)'; ctx.fillRect(-ox / k, lado === 'arriba' ? top : bot, lienzo.width / k, HUD);
    ctx.textBaseline = 'middle';
    if (lado === 'abajo') return hudAbajo(bot);
    // Arriba: la racha y su reloj, el laberinto, las compuertas.
    const mult = M.multiplicador(E), col = RACHA_COL[mult - 1];
    ctx.font = '14px "Press Start 2P", monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = col; ctx.fillText('×' + mult, 10, top + HUD / 2 - 3);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(10, top + HUD - 9, 70, 4);
    ctx.fillStyle = col; ctx.fillRect(10, top + HUD - 9, 70 * (E.rachaT / M.RACHA_TICS), 4);
    ctx.font = '8px "Press Start 2P", monospace'; ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('racha ' + E.racha, 52, top + HUD / 2 - 3);
    ctx.textAlign = 'center'; ctx.fillStyle = E.mapa.color;
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText(sinTilde(E.mapa.nombre) + ' · ' + E.nivel, LW / 2 + 30, top + HUD / 2);
    if (E.mapa.compuertas) {
      const ab = M.abiertas(E), aviso = M.avisoCompuertas(E);
      ctx.textAlign = 'right'; ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = aviso && Math.floor(t / 110) % 2 ? '#fff' : ab ? '#7dff9b' : '#ff4d6d';
      ctx.fillText(ab ? 'COMPUERTAS ▯' : 'COMPUERTAS ▮', LW - 10, top + HUD / 2);
    }
  }
  function hudAbajo(bot) {
    // Abajo: energía del turbo, cargas de pulso y vidas.
    ctx.textAlign = 'left'; ctx.font = '8px "Press Start 2P", monospace';
    const lista = E.energia >= M.TURBO_COSTO;
    ctx.fillStyle = lista ? '#7ff' : 'rgba(255,255,255,0.5)'; ctx.fillText('⚡TURBO', 10, bot + HUD / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(78, bot + HUD / 2 - 5, 90, 10);
    ctx.fillStyle = E.turboT > 0 ? '#fff' : lista ? '#3df5ff' : '#2a6f80';
    ctx.fillRect(78, bot + HUD / 2 - 5, 90 * E.energia / 100, 10);
    ctx.fillStyle = '#04050d'; ctx.fillRect(78 + 90 * M.TURBO_COSTO / 100, bot + HUD / 2 - 6, 1.5, 12);
    ctx.fillStyle = E.pulsos ? '#8fd8ff' : 'rgba(255,255,255,0.5)'; ctx.fillText('◎PULSO', 186, bot + HUD / 2);
    for (let i = 0; i < M.PULSOS_MAX; i++) {
      ctx.strokeStyle = '#8fd8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(256 + i * 16, bot + HUD / 2, 5, 0, Math.PI * 2); ctx.stroke();
      if (i < E.pulsos) { ctx.fillStyle = '#8fd8ff'; ctx.fill(); }
    }
    for (let i = 0; i < Math.min(5, E.vidas); i++) {
      const x = LW - 16 - i * 20, y = bot + HUD / 2;
      ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 7, Math.PI * 1.2, Math.PI * 2.8); ctx.closePath(); ctx.fill();
    }
  }

  function cartel(t1, t2, t) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const y = HUD + 12.5 * TS;
    ctx.fillStyle = 'rgba(4,5,13,0.7)'; ctx.fillRect(LW / 2 - 130, y - 26, 260, 52);
    ctx.font = '18px "Press Start 2P", monospace';
    t1 = sinTilde(t1);
    ctx.fillStyle = '#000'; ctx.fillText(t1, LW / 2 + 2, y - 6 + 2);
    ctx.fillStyle = Math.floor(t / 200) % 2 ? '#ffe14d' : '#ff5fa2'; ctx.fillText(t1, LW / 2, y - 6);
    if (t2) { ctx.font = '8px "Press Start 2P", monospace'; ctx.fillStyle = '#cfe8ff'; ctx.fillText(sinTilde(t2), LW / 2, y + 15); }
  }

  /* El menú: un pacman que cruza perseguido, como en la recreativa. */
  function menuDecor(t) {
    const y = LH - 70, x = ((t / 9) % (LW + 220)) - 60;
    ctx.fillStyle = '#ffe9b8';
    for (let i = 0; i < 20; i++) { const dx = i * TS; if (dx > x) ctx.fillRect(dx - 2, y - 2, 4, 4); }
    ctx.fillStyle = '#ffe14d';
    const b = 0.08 + Math.abs(Math.sin(t / 90)) * 0.3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 12, b * Math.PI, (2 - b) * Math.PI); ctx.closePath(); ctx.fill();
    COLORES.slice(0, 4).forEach((c, i) => cuerpo(x - 40 - i * 30, y, 11, c, t, { id: i }));
  }

  /* ---------- Marcador y botonera ---------- */
  let marcaPrevia = '';
  function pintaMarcador() {
    const p = E ? E.puntos : 0, firma = [p, prog.mejor, E ? E.nivel : 1, E ? E.vidas : 3, E ? E.pulsos : 0, E ? Math.floor(E.energia) : 0].join();
    if (firma === marcaPrevia) return;
    marcaPrevia = firma;
    $('nPuntos').textContent = p.toLocaleString('es-CL');
    $('nMejor').textContent = Math.max(prog.mejor, p).toLocaleString('es-CL');
    $('nNivel').textContent = String(E ? E.nivel : 1);
    $('nVidas').textContent = String(E ? E.vidas : 3);
    $('mPulsos').textContent = String(E ? E.pulsos : 0);
    $('mEnergia').style.setProperty('--e', (E ? E.energia : 0) / 100);
    document.querySelector('.m-turbo').classList.toggle('listo', !!E && E.energia >= M.TURBO_COSTO);
    document.querySelector('.m-pulso').classList.toggle('listo', !!E && E.pulsos > 0);
  }

  /* ---------- El bucle ---------- */
  function frame(t) {
    let dt = t - ultimo; ultimo = t;
    if (dt > 250) dt = 250;
    if (estado === 'jugando' && !pausado) {
      acc += dt;
      while (acc >= PASO_MS && estado === 'jugando') {
        acc -= PASO_MS;
        tic();
        if (E.estado === 'fin') { termina(false); break; }
      }
    }
    const s = dt / 1000;
    if (!pausado) {
      for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.x += q.vx; q.y += q.vy; q.vx *= 0.92; q.vy *= 0.92; if ((q.v -= s) <= 0) parts.splice(i, 1); }
      for (let i = textos.length - 1; i >= 0; i--) if ((textos[i].v -= s * 0.9) <= 0) textos.splice(i, 1);
      for (let i = ondas.length - 1; i >= 0; i--) if ((ondas[i].v -= s * 1.8) <= 0) ondas.splice(i, 1);
      for (let i = rastro.length - 1; i >= 0; i--) if ((rastro[i].v -= s * 3.5) <= 0) rastro.splice(i, 1);
      sacudida = Math.max(0, sacudida - s * 1.6); destello = Math.max(0, destello - s * 1.5);
    }
    dibuja(t, estado === 'jugando' && !pausado ? clamp(acc / PASO_MS, 0, 1) : 1);
    suenaSirena(t);
    pintaMarcador();
    requestAnimationFrame(frame);
  }

  /* ---------- Mando ---------- */
  if (window.Mando) {
    window.Mando.configura({
      botones: { a: 'Space', rb: 'Space', b: 'KeyE', x: 'KeyE', lb: 'KeyE', start: 'KeyP' },
      objetivo: () => lienzo,
      menu: () => estado !== 'jugando' || pausado,
      inicio: () => pausado ? $('btnSeguir') : estado === 'fin' ? $('btnOtra') : $('btnJugar'),
      pistas: [['dpad stickL', 'moverse'], ['a', 'turbo'], ['b', 'pulso'], ['start', 'pausa']],
      zonas: [{ sel: '#nota' }]
    });
  }

  /* ---------- Ganchos para probar desde la consola ----------
     Lo que cambie la partida la marca: se juega, pero no se manda. */
  window.__propac = {
    estado: () => ({ estado, pausado, puntos: E ? E.puntos : 0, nivel: E ? E.nivel : 0, vidas: E ? E.vidas : 0, tick: E ? E.tick : 0, jugadas: jug.length, inm: document.documentElement.classList.contains('club-inm') }),
    motor: () => E,
    salta(n) { if (!E) return; tocado = true; const m = E.mapa; m.comida.fill(0); E.restantes = 0; if (n) E.nivel = Math.max(1, (n | 0) - 1); },
    vidas(n) { if (!E) return; tocado = true; E.vidas = Math.max(1, n | 0); },
    carga() { if (!E) return; tocado = true; E.energia = 100; E.pulsos = M.PULSOS_MAX; }
  };

  /* ---------- Arranque ---------- */
  const tactil = matchMedia('(pointer:coarse)').matches;
  document.documentElement.classList.toggle('tactil', tactil);
  $('pista').textContent = tactil ? 'Desliza el dedo para moverte · ⚡ turbo · ◎ pulso' : 'Flechas o WASD · Espacio turbo · E pulso · P pausa';
  $('nota').innerHTML = (tactil
    ? 'Desliza en cualquier parte o usa la cruceta para moverte; ⚡ gasta energía en turbo y ◎ suelta un pulso. '
    : '<kbd>←↑↓→</kbd> o <kbd>WASD</kbd> para moverte, <kbd>Espacio</kbd> turbo, <kbd>E</kbd> pulso, <kbd>P</kbd> pausa. ') +
    (document.documentElement.classList.contains('club-integrado')
      ? 'Tu mejor partida se guarda en tu cuenta.'
      : 'Tu mejor partida vive en este navegador; juega desde Juegos para entrar en la clasificación.');

  addEventListener('club-record', e => {
    const d = e.detail;
    if (!d || d.categoria !== CATEGORIA || !(d.puntos > prog.mejor)) return;
    prog.mejor = d.puntos | 0; guarda('propac.progreso', prog); pintaMarcador();
  });
  addEventListener('club-rechazo', e => { if (e.detail && e.detail.categoria === CATEGORIA) $('finFrase').textContent = 'Esta partida no entró en la clasificación: ' + (e.detail.motivo || ''); });

  /* El alto que manda es el de la ventana de arriba: el iframe del Club crece
     con su contenido, y medirse a sí mismo daría vueltas. */
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

  if (Club) Club.category(CATEGORIA);
  mide();
  pintaMarcador();
  requestAnimationFrame(t => { ultimo = t; frame(t); });
})();
