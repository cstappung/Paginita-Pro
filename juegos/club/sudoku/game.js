/* ====================================================================
   Sudoku Arcade — la pantalla.

   Qué hace: dibuja el tablero 9×9, recibe ratón, dedo y teclado, lleva
   el reloj, las vidas, el combo y los puntos, toca la música y los
   efectos, y guarda el progreso. NO decide nada del sudoku en sí: el
   puzzle, su solución, los conflictos, la racha y las puntuaciones las
   da el motor puro (motor.js → window.SudokuMotor), que también se
   prueba desde Node.

   Tres modos:
   - Diario: un sudoku «medio» que sale solo de la fecha de Chile, el
     mismo para todo el mundo. Completarlo suma un día a la racha.
   - Clásico: un sudoku al azar en la dificultad elegida, con notas,
     deshacer y pistas (cada pista suma 30 s). Clasifica por tiempo.
   - Arcade: tres vidas; un número equivocado no se pone y quita una
     vida, los aciertos seguidos suben el combo, completar fila,
     columna o caja da un bonus y terminar rápido da otro.

   Por qué está hecho así:
   - Copia el patrón de la Sopa de letras (juegos/club/sopa/game.js):
     claves de localStorage por cuenta con Club.storageKey, racha también
     en la cuenta con Club.guardarPartida/pedirPartida mezclada con
     mezclaRacha, y Club.category/Club.result para el ranking.
   - La música es el tema «sudoku» del cancionero compartido de la sala
     (juegos/audio/temas.js) tocado con Chip.Reproductor, como en Mina
     Club: así todo el Club suena a la misma consola.
   - Todo lo que puede fallar (almacenamiento, audio) se envuelve en
     try/catch: sin ellos el juego se juega igual.
   ==================================================================== */
(() => {
  "use strict";

  /* ---------- Dependencias y utilidades pequeñas ---------- */
  const M = window.SudokuMotor;                       // el motor puro
  const Club = window.Club || null;                   // el puente con Juegos (conexion.js)
  const $ = id => document.getElementById(id);        // atajo para getElementById
  if (!M) {                                           // sin motor no hay juego: se avisa y se sale
    $("info").textContent = "No se pudo cargar el motor del sudoku. Recarga la página.";
    return;
  }
  const clave = k => (Club ? Club.storageKey(k) : k); // cada cuenta guarda lo suyo
  const lee = (k, def) => {                           // lee JSON de localStorage sin romperse
    try { const v = JSON.parse(localStorage.getItem(clave(k))); return v == null ? def : v; } catch (e) { return def; }
  };
  const guarda = (k, v) => {                          // escribe JSON; si no hay almacenamiento, se ignora
    try { localStorage.setItem(clave(k), JSON.stringify(v)); } catch (e) { /* sin almacenamiento: se juega igual */ }
  };
  const borra = k => { try { localStorage.removeItem(clave(k)); } catch (e) { /* nada */ } };
  const reloj = ms => {                               // 83 000 ms → "1:23" (y "1:02:03" si pasa de una hora)
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
  };
  const dias = n => `${n} ${n === 1 ? "día" : "días"}`;            // 1 día / 2 días
  const cuentaRacha = r => (r && (r.racha != null ? r.racha : r.n)) || 0; // el motor puede llamar al campo «racha» o «n»
  const reducido = matchMedia("(prefers-reduced-motion: reduce)");  // quien pide menos movimiento
  const entero = (x, min, max) => Math.max(min, Math.min(max, Math.round(Number(x) || 0))); // acota a un entero

  /* ---------- Constantes del juego ---------- */
  const ORDEN_DIF = ["facil", "medio", "dificil", "experto"];      // orden de las dificultades en el selector
  const DIFS = ORDEN_DIF.filter(d => M.DIFICULTADES && M.DIFICULTADES[d]); // solo las que el motor conoce
  const VIDAS = 3;                                    // vidas del Arcade
  const PENALIZA_PISTA = 30000;                       // una pista suma 30 s al reloj
  const TIEMPO_MAX = 604800000;                       // una semana: el tope que acepta el ranking
  const ESCALA = [76, 78, 80, 81, 83, 85, 87, 88, 90]; // Mi mayor: cada número suena a una nota distinta

  /* ---------- Geometría del tablero (precalculada una vez) ---------- */
  const fila = i => Math.floor(i / 9);                // fila 0..8 de la celda i
  const col = i => i % 9;                             // columna 0..8
  const caja = i => Math.floor(fila(i) / 3) * 3 + Math.floor(col(i) / 3); // caja 0..8
  const FILAS = [], COLS = [], CAJAS = [];            // las 27 unidades, como listas de índices
  for (let k = 0; k < 9; k++) { FILAS.push([]); COLS.push([]); CAJAS.push([]); }
  for (let i = 0; i < 81; i++) { FILAS[fila(i)].push(i); COLS[col(i)].push(i); CAJAS[caja(i)].push(i); }
  const PARES = [];                                   // las 20 vecinas de cada celda (misma fila, columna o caja)
  for (let i = 0; i < 81; i++) {
    const s = new Set([...FILAS[fila(i)], ...COLS[col(i)], ...CAJAS[caja(i)]]);
    s.delete(i);                                      // una celda no es vecina de sí misma
    PARES.push([...s]);
  }

  /* ---------- Estado ---------- */
  let hoy = M.diaChile();                             // la fecha de Chile, "AAAA-MM-DD"
  let racha = M.limpiaRacha(lee("sudoku.racha", null)); // racha local, saneada por el motor
  let modo = ["diario", "clasico", "arcade"].includes(lee("sudoku.modo", "diario")) ? lee("sudoku.modo", "diario") : "diario";
  let dif = DIFS.includes(lee("sudoku.dif", "medio")) ? lee("sudoku.dif", "medio") : (DIFS[1] || DIFS[0]);
  let juego = null;                                   // {modo, dif, pistas, solucion, fecha?} o null mientras se genera
  let tab = new Array(81).fill(0);                    // lo que hay escrito en cada celda (0 = vacía)
  let notas = new Array(81).fill(0);                  // notas a lápiz: 9 bits por celda
  let ayudas = new Set();                             // celdas puestas con una pista (Clásico)
  let sel = 40;                                       // celda elegida (empieza en el centro)
  let notasOn = false;                                // modo lápiz encendido
  let historial = [];                                 // pila para deshacer: cada entrada es [[i, valor, notas], ...]
  let ms = 0, corriendo = false, marca = performance.now(); // reloj del juego
  let terminada = false;                              // la partida ya acabó (ganada, perdida o ya hecha hoy)
  let vidas = VIDAS, combo = 0, mejorCombo = 0, puntos = 0; // marcador del Arcade
  let pistasUsadas = 0;                               // cuántas pistas se pidieron (Clásico)
  let fallo = null;                                   // {i, v}: el número equivocado que se ve un instante
  let vaciasAlEmpezar = 81;                           // para medir el progreso de la música
  let generacion = 0;                                 // invalida una generación que llega tarde
  let records = lee("sudoku.records", {});            // mejores marcas locales por categoría
  let ultimaSubida = "";                              // lo último que se mandó a la cuenta (evita repetir)
  /* La prueba de la partida (motor.js, `rehace`; docs/antitrampas/sudoku.md):
     qué sudoku es y cada cambio del tablero (o, en Arcade, cada número
     intentado) como [celda, valor, Δt]. `sombra` es el tablero tal como
     quedó apuntado, para anotar solo lo que cambió. Una partida retomada
     de una versión anterior, que no guardaba sus jugadas, no se puede
     probar (`sinPrueba`): se termina igual, pero no va al ranking. */
  let jugadas = [], tUlt = 0, sombra = null, sinPrueba = false;
  /* La forma humana de cada jugada, para la capa anti-bot: `ent` es la
     última entrada (clic, tecla, botón del mando) con los ms desde la
     anterior (`g`) y si fue de confianza (`f`: 1 = evento sintético, que
     es lo que despacha un script; 2 = de juegos/audio/mando.js con un mando
     conectado, que también es sintético pero legítimo). */
  let ent = { t: performance.now(), g: 0, f: 0 };
  const mandoConectado = () => { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(g => g && g.connected); } catch (e) { return false; } };
  function entrada(e) {                               // e = el evento; null = un botón del mando sin evento
    const ahora = performance.now();
    const f = e ? (e.isTrusted ? 0 : e.__mando && mandoConectado() ? 2 : 1) : (mandoConectado() ? 2 : 1);
    ent = { t: ahora, g: ahora - ent.t, f };
  }
  const forma = () => [Math.max(0, Math.round(ent.g)), ent.f | (document.hidden ? 4 : 0)];

  /** Lleva el reloj hasta este instante (el intervalo solo lo hace cada 250 ms). */
  function actualiza() {
    const ahora = performance.now();
    if (corriendo && juego && !document.hidden) ms += ahora - marca;
    marca = ahora;
  }
  /** Anota en la prueba lo que cambió en el tablero desde la última vez. */
  function apunta(esPista) {
    if (!sombra) return;
    actualiza();
    const t = Math.round(ms);
    for (let i = 0; i < 81; i++) if (tab[i] !== sombra[i]) {
      jugadas.push(i, esPista ? 10 + tab[i] : tab[i], Math.max(0, t - tUlt), ...forma());
      tUlt = Math.max(tUlt, t);
    }
    sombra = tab.slice();
  }
  /** Arcade: cada número intentado, bien o mal, va a la prueba. */
  function apuntaIntento(i, n) {
    actualiza();
    const t = Math.round(ms);
    jugadas.push(i, n, Math.max(0, t - tUlt), ...forma());
    tUlt = Math.max(tUlt, t);
  }
  /** La prueba tal como la manda Club.result. */
  function prueba() {
    const p = { v: M.PRUEBA_V, m: { diario: "d", clasico: "c", arcade: "a" }[juego.modo], j: jugadas };
    if (juego.modo === "diario") p.f = juego.fecha; else p.s = juego.semilla;
    if (juego.modo === "clasico") p.d = juego.dif;
    return p;
  }

  /* ---------- Construcción del DOM: 81 celdas y 9 teclas ---------- */
  const tablero = $("tablero"), teclado = $("teclado"), marco = $("marco");
  const celdas = [];                                  // los 81 botones del tablero
  const cache = [];                                   // lo último pintado en cada celda (para no repintar igual)
  for (let i = 0; i < 81; i++) {
    const b = document.createElement("button");       // cada celda es un botón: accesible y enfocable
    b.type = "button";
    b.dataset.i = i;                                  // su índice, para el clic
    b.tabIndex = -1;                                  // «tabindex itinerante»: solo la elegida entra en el Tab
    b.className = `celda c${col(i)} f${fila(i)}`;     // c2/c5/f2/f5 dibujan las líneas gruesas de las cajas
    tablero.appendChild(b);
    celdas.push(b);
    cache.push({ cls: "", html: null, label: "" });
  }
  const teclas = [];                                  // los botones 1..9 del teclado en pantalla
  for (let n = 1; n <= 9; n++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tecla";
    b.dataset.n = n;                                  // qué número escribe
    b.innerHTML = `${n}<small></small>`;              // el <small> dirá cuántos faltan
    teclado.appendChild(b);
    teclas.push(b);
  }
  // Selector de dificultad, con los nombres que da el motor.
  $("selDif").innerHTML = DIFS.map(d => `<option value="${d}">${M.DIFICULTADES[d].nombre || d}</option>`).join("");
  $("selDif").value = dif;

  /* ---------- Efectos visuales efímeros (pon, falla, brilla) ----------
     Una clase de animación se mantiene en el mapa mientras dura, así el
     repintado no la borra a mitad. Para relanzarla en la misma celda se
     quita, se fuerza un reflow y se vuelve a poner. */
  const efimeras = new Map();                         // i → Map(clase → id del temporizador)
  function anima(i, cls, dur, retraso = 0) {
    if (reducido.matches) return;                     // sin animaciones si se pidió menos movimiento
    let m = efimeras.get(i);
    if (!m) { m = new Map(); efimeras.set(i, m); }
    if (m.has(cls)) clearTimeout(m.get(cls));         // si ya estaba, se reinicia
    celdas[i].classList.remove(cls);                  // quitarla…
    void celdas[i].offsetWidth;                       // …forzar el reflow…
    celdas[i].style.setProperty("--d", `${retraso}ms`); // …el retraso de la ola…
    m.set(cls, setTimeout(() => { m.delete(cls); pinta(); }, dur + retraso)); // …y se va sola al terminar
    celdas[i].classList.add(cls);                     // …y volver a ponerla relanza la animación
  }
  function flota(i, texto) {                          // un «+120» que sube desde la celda y se desvanece
    if (reducido.matches) return;
    const d = document.createElement("div");
    d.className = "flota";
    d.textContent = texto;
    d.style.left = `calc(6px + (100% - 12px) * ${(col(i) + .5) / 9})`;  // centro de la celda, dentro del marco
    d.style.top = `calc(6px + (100% - 12px) * ${(fila(i) + .5) / 9})`;
    marco.appendChild(d);
    setTimeout(() => d.remove(), 950);                // se borra al acabar la animación
  }
  const avisa = t => { $("aviso").textContent = t; }; // texto para lectores de pantalla

  /* ====================================================================
     SONIDO — música del cancionero y efectos sintetizados con el chip.
     El AudioContext se crea en el primer gesto (los navegadores no dejan
     antes). La música acelera en Arcade con una vida o pocas celdas.
     ==================================================================== */
  class Sonido {
    constructor() {
      this.on = lee("sudoku.sonido", true) !== false; // el silencio se recuerda
      this.ctx = null; this.master = null;            // contexto de audio y volumen general
      this.rep = null; this.loop = null;              // reproductor del tema y su temporizador
      this.voces = new Set();                         // efectos en curso (para poder callarlos)
      this.progreso = 0; this.prisa = false;          // cuánto se ha llenado el tablero / modo «¡rápido!»
    }
    desbloquea() {                                    // crea o reanuda el contexto (solo en un gesto)
      if (!this.on) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx || !window.Chip) return;               // sin Web Audio o sin chip: silencio
      try {
        if (!this.ctx) {
          this.ctx = new Ctx();
          this.master = this.ctx.createGain();        // un solo volumen para música y efectos
          this.master.gain.value = .5;
          this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      } catch (e) { this.ctx = null; }
    }
    listo() { return this.on && this.ctx && this.ctx.state === "running"; }
    arranca() {                                       // empieza (o reinicia) la música del tema «sudoku»
      if (!this.on || document.hidden) return;
      if (!this.ctx) return;                          // sin gesto previo no hay contexto: lo crea primerGesto
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); // reanudar no crea nada nuevo
      const tema = window.Temas && window.Temas.temas && window.Temas.temas.sudoku; // el tema propio del juego
      if (!tema || !window.Chip.Reproductor) return;  // si aún no existe el tema, solo efectos
      try {
        if (!this.rep) this.rep = new window.Chip.Reproductor(this.ctx, this.master, tema);
        if (this.loop) return;                        // ya está sonando: no se duplica
        this.rep.reinicia();                          // desde el principio de la canción
        this.loop = setInterval(() => this.agenda(), 75); // agenda notas por delante cada 75 ms
        this.agenda();
      } catch (e) { this.rep = null; }
    }
    agenda() {                                        // ajusta capas y tempo, y agenda lo que falte
      if (!this.rep || !this.ctx || this.ctx.state !== "running") return;
      const r = this.rep, p = this.progreso;
      r.capas.arp = p > .25 || this.prisa ? 1 : 0;    // el arpegio entra pasado un cuarto del tablero
      r.capas.bat = p > .55 || this.prisa ? 1 : 0;    // la batería, pasada la mitad (o con prisa)
      r.tempo = this.prisa ? 1.14 : 1 + p * .05;      // con prisa, un 14 % más rápido; si no, sube un poco
      r.tick(.2);                                     // agenda 0,2 s por delante del reloj de audio
    }
    para() {                                          // calla la música (los efectos terminan solos)
      clearInterval(this.loop); this.loop = null;
      if (this.rep) { try { this.rep.detener(); } catch (e) { /* nada */ } }
    }
    callaTodo() {                                     // música y efectos, también lo ya agendado
      this.para();
      for (const v of this.voces) {
        try { v.fuente.stop(0); } catch (e) { /* ya parado */ }
        for (const n of v.nodos) { try { n.disconnect(); } catch (e) { /* nada */ } }
      }
      this.voces.clear();
    }
    alterna() {                                       // el botón de sonido
      this.on = !this.on;
      guarda("sudoku.sonido", this.on);
      if (!this.on) this.callaTodo();
      else { this.desbloquea(); if (juego && !terminada) this.arranca(); this.efecto("pon", 5); }
      this.boton();
    }
    boton() {                                         // refleja el estado en el botón
      const b = $("sound-button");
      b.setAttribute("aria-pressed", String(this.on));
      b.setAttribute("aria-label", this.on ? "Desactivar música y efectos" : "Activar música y efectos");
    }
    nota(midi, t, dur, vol, onda = "p25", extra = {}) { // una nota del chip, guardada en this.voces
      if (!this.listo()) return;
      try {
        window.Chip.voz(this.ctx, this.master, Object.assign({ t: Math.max(t, this.ctx.currentTime), f: window.Chip.hz(midi), dur, vol, onda, sus: .7 }, extra), this.voces);
      } catch (e) { /* audio roto: se juega igual */ }
    }
    efecto(tipo, x = 0) {                             // los efectos cortos del juego
      this.desbloquea();
      if (!this.listo()) return;
      const t = this.ctx.currentTime, hz = window.Chip.hz;
      switch (tipo) {
        case "pon":                                   // colocar: un «blip» en la nota del número
          this.nota(ESCALA[(x || 1) - 1], t, .08, .07, "p12", { f1: hz(ESCALA[(x || 1) - 1] + 2) });
          break;
        case "nota":                                  // nota a lápiz: un tic muy suave
          this.nota(96, t, .03, .035, "p12");
          break;
        case "borra":                                 // borrar: un blip que baja
          this.nota(72, t, .07, .05, "p50", { f1: hz(64) });
          break;
        case "error":                                 // error: zumbido grave que cae y un golpe de ruido
          this.nota(52, t, .24, .11, "p50", { f1: hz(40), sus: .9 });
          this.nota(53, t, .24, .06, "p50", { f1: hz(41), sus: .9 });
          try { window.Chip.ruido(this.ctx, this.master, { t, dur: .1, vol: .08, tono: .7 }, this.voces); } catch (e) { /* nada */ }
          break;
        case "unidad":                                // fila/columna/caja completa: arpegio ascendente en Mi
          [76, 80, 83, 88, 92, 95].slice(0, 3 + Math.min(3, x)).forEach((n, k) => this.nota(n, t + .05 + k * .055, .12, .07, "p25"));
          break;
        case "combo": {                               // combo: un acorde que sube con el combo
          const base = 71 + Math.min(12, x);
          this.nota(base, t + .02, .2, .06, "p12", { arp: [hz(base), hz(base + 4), hz(base + 7), hz(base + 12)], paso: .03 });
          break;
        }
        case "pista":                                 // pista: destellos de triángulo
          [88, 95, 100].forEach((n, k) => this.nota(n, t + k * .07, .14, .06, "tri"));
          break;
        case "victoria":                              // fanfarria en Mi mayor
          [64, 68, 71, 76, 80, 83, 88].forEach((n, k) => this.nota(n, t + k * .1, .16, .09, "p25"));
          this.nota(92, t + .75, 1.1, .09, "p25", { vib: .008 });
          [64, 71, 76, 80].forEach(n => this.nota(n, t + .75, 1.2, .05, "p12", { sus: .5 }));
          this.nota(40, t + .75, 1.2, .18, "tri", { sus: 1 });
          break;
        case "derrota":                               // derrota: bajada en Si menor y un grave final
          [[71, 0], [69, .2], [67, .4], [66, .6], [62, .85]].forEach(([n, d]) => this.nota(n, t + d, .3, .09, "p25", { vib: .006 }));
          this.nota(35, t + .85, 1.2, .2, "tri", { f1: hz(28), sus: 1 });
          break;
      }
    }
  }
  const sonido = new Sonido();
  sonido.boton();
  /* El primer gesto en la página desbloquea el audio y arranca la música. */
  function primerGesto() {
    sonido.desbloquea();
    if (juego && !terminada) sonido.arranca();
  }
  document.addEventListener("pointerdown", primerGesto, true);
  document.addEventListener("keydown", primerGesto, true);

  /* ====================================================================
     PINTADO — un solo repintado que deja todo como dice el estado.
     ==================================================================== */
  /** Los índices en conflicto según el motor (acepta Set o array). */
  function enConflicto() {
    if (modo === "arcade") return new Set();          // en Arcade nunca entra un número malo
    const c = M.conflictos(tab);
    return c instanceof Set ? c : new Set(c || []);
  }
  /** Cuántas veces aparece cada número 1..9 en el tablero. */
  function cuentas() {
    const n = new Array(10).fill(0);
    for (const v of tab) if (v) n[v]++;
    return n;
  }
  const vacias = () => tab.reduce((s, v) => s + (v ? 0 : 1), 0); // celdas sin número
  const esFija = i => !!(juego && juego.pistas[i]);   // pista del puzzle original

  function pinta() {
    const confl = enConflicto();
    const vSel = tab[sel] || 0;                       // el número de la celda elegida (para resaltar iguales)
    for (let i = 0; i < 81; i++) {
      const el = celdas[i], c = cache[i];
      // --- clases ---
      let cls = `celda c${col(i)} f${fila(i)}`;
      if (esFija(i)) cls += " fija";
      else if (ayudas.has(i)) cls += " ayuda";
      if (i === sel) cls += " sel";
      else if (vSel && tab[i] === vSel) cls += " igual";
      else if (fila(i) === fila(sel) || col(i) === col(sel) || caja(i) === caja(sel)) cls += " zona";
      if (confl.has(i)) cls += " mal";
      const ef = efimeras.get(i);                     // las animaciones en curso se conservan
      if (ef) for (const k of ef.keys()) cls += " " + k;
      if (cls !== c.cls) { el.className = cls; c.cls = cls; }
      // --- contenido: número, número fallido o notas ---
      let html, desc;
      if (fallo && fallo.i === i) { html = String(fallo.v); desc = `${fallo.v}, incorrecto`; }
      else if (tab[i]) { html = String(tab[i]); desc = `${tab[i]}${esFija(i) ? ", pista" : ""}${confl.has(i) ? ", en conflicto" : ""}`; }
      else if (notas[i]) {
        let s = "", lista = [];
        for (let n = 1; n <= 9; n++) {
          const tiene = notas[i] & (1 << (n - 1));
          if (tiene) lista.push(n);
          s += `<span${tiene && n === vSel ? ' class="igual"' : ""}>${tiene ? n : ""}</span>`;
        }
        html = `<span class="notas">${s}</span>`;
        desc = `vacía, notas ${lista.join(" ")}`;
      } else { html = ""; desc = "vacía"; }
      if (html !== c.html) { el.innerHTML = html; c.html = html; }
      const label = `Fila ${fila(i) + 1}, columna ${col(i) + 1}: ${desc}`;
      if (label !== c.label) { el.setAttribute("aria-label", label); c.label = label; }
      el.tabIndex = i === sel ? 0 : -1;               // solo la elegida es parada de Tab
    }
    // --- teclado: cuántos faltan de cada número ---
    const n = cuentas();
    teclas.forEach((b, k) => {
      const num = k + 1, faltan = Math.max(0, 9 - n[num]);
      b.querySelector("small").textContent = faltan || "";
      b.classList.toggle("agotada", faltan === 0);
      b.classList.toggle("igual", num === vSel);
      b.setAttribute("aria-label", `${num}: faltan ${faltan}`);
    });
    teclado.classList.toggle("notas-on", notasOn);
    // --- marcador ---
    const quedan = vacias();
    $("reloj").textContent = reloj(ms);
    $("faltan").textContent = String(quedan);
    $("vidas").textContent = "♥".repeat(Math.max(0, vidas)) + "♡".repeat(Math.max(0, VIDAS - vidas));
    $("vidas").setAttribute("aria-label", `${vidas} ${vidas === 1 ? "vida" : "vidas"}`);
    // El marcador muestra el multiplicador real (×1 a ×4, el tope del motor),
    // no la racha cruda de aciertos, que puede llegar a 50 y engañaba.
    const mult = M.multiplicador ? M.multiplicador(Math.max(1, combo)) : 1; // lo que multiplica el motor
    $("combo").textContent = `×${mult}`;                  // p. ej. ×1.25
    $("combo").title = `${combo} ${combo === 1 ? "acierto seguido" : "aciertos seguidos"}`; // la racha, al pasar el ratón
    $("puntos").textContent = String(puntos);
    // --- herramientas ---
    $("btnNotas").setAttribute("aria-pressed", String(notasOn));
    $("btnDeshacer").disabled = !historial.length || terminada || !juego;
    $("btnBorrar").disabled = terminada || !juego;
    $("btnPista").disabled = terminada || !juego;
    // --- música: progreso y prisa ---
    sonido.progreso = vaciasAlEmpezar ? 1 - quedan / vaciasAlEmpezar : 0;
    sonido.prisa = modo === "arcade" && !terminada && !!juego && (vidas === 1 || quedan <= 8);
  }

  /* ====================================================================
     JUGADAS
     ==================================================================== */
  /** Elige una celda (y la enfoca si se llegó con el teclado). */
  function elige(i, enfocar = false) {
    sel = entero(i, 0, 80);
    pinta();
    if (enfocar) celdas[sel].focus({ preventScroll: true });
  }

  /** Las unidades (fila/columna/caja) de i que quedaron completas Y correctas. */
  function unidadesHechas(i) {
    const u = M.unidadesCompletas(tab, i) || {};      // el motor dice cuáles están llenas
    const listas = [];
    if (u.fila) listas.push(FILAS[fila(i)]);
    if (u.columna) listas.push(COLS[col(i)]);
    if (u.caja) listas.push(CAJAS[caja(i)]);
    return listas.filter(l => l.every(j => tab[j] === juego.solucion[j])); // solo si además están bien
  }
  /** Una ola de luz que sale de la celda i y recorre cada unidad completada. */
  function olaDeLuz(i, listas) {
    for (const l of listas) for (const j of l) {
      const d = (Math.abs(fila(j) - fila(i)) + Math.abs(col(j) - col(i))) * 45; // más lejos, más tarde
      anima(j, "brilla", 700, d);
    }
  }
  /** Quita el número n de las notas de las vecinas de i (y anota los cambios para deshacer). */
  function limpiaNotasVecinas(i, n, cambios) {
    const bit = 1 << (n - 1);
    for (const j of PARES[i]) if (notas[j] & bit) {
      if (cambios) cambios.push([j, tab[j], notas[j]]);
      notas[j] &= ~bit;
    }
  }
  const resuelto = () => tab.every((v, i) => v === juego.solucion[i]); // tablero igual a la solución

  /** Escribe el número n en la celda elegida (o lo anota, en modo notas). */
  function escribe(n) {
    if (!juego || terminada || fallo) return;        // nada mientras se genera, al final o durante un fallo
    const i = sel;
    if (esFija(i) || ayudas.has(i)) return;           // las pistas no se tocan
    if (notasOn) {                                    // --- modo lápiz ---
      if (tab[i]) return;                             // en una celda con número no hay notas
      historial.push([[i, tab[i], notas[i]]]);        // se puede deshacer
      notas[i] ^= 1 << (n - 1);                       // enciende o apaga esa nota
      sonido.efecto("nota");
      pinta(); guardaProgreso();
      return;
    }
    if (modo === "arcade") { escribeArcade(i, n); return; }
    // --- Diario y Clásico: se pone cualquier número; los choques se ven en rojo ---
    const cambios = [[i, tab[i], notas[i]]];
    if (tab[i] === n) {                               // repetir el mismo número lo borra
      tab[i] = 0;
      sonido.efecto("borra");
    } else {
      tab[i] = n; notas[i] = 0;                       // se pone el número y se van sus notas
      limpiaNotasVecinas(i, n, cambios);              // y ese número sale de las notas vecinas
      sonido.efecto("pon", n);
      anima(i, "pon", 230);
      const hechas = unidadesHechas(i);               // ¿cerró fila, columna o caja?
      if (hechas.length) { olaDeLuz(i, hechas); sonido.efecto("unidad", hechas.length); avisa(textoUnidades(hechas.length)); }
    }
    historial.push(cambios);
    apunta(false);
    pinta();
    if (resuelto()) termina(true); else guardaProgreso();
  }

  /** Arcade: un acierto suma (con combo), un error quita una vida. */
  function escribeArcade(i, n) {
    if (tab[i]) return;                               // lo puesto en Arcade ya es correcto y queda fijo
    apuntaIntento(i, n);
    if (n === juego.solucion[i]) {                    // --- acierto ---
      tab[i] = n; notas[i] = 0;
      limpiaNotasVecinas(i, n, null);                 // limpia notas vecinas (sin deshacer)
      historial = [];                                 // en Arcade deshacer solo vale para notas recientes
      combo++; mejorCombo = Math.max(mejorCombo, combo);
      const hechas = unidadesHechas(i);
      const p = puntosDe(combo, hechas.length);       // puntos de esta jugada (los decide el motor)
      puntos = entero(puntos + p, 0, 1000000);
      anima(i, "pon", 230);
      flota(i, `+${p}`);
      sonido.efecto("pon", n);
      if (hechas.length) { olaDeLuz(i, hechas); sonido.efecto("unidad", hechas.length); avisa(`${textoUnidades(hechas.length)} +${p}`); }
      if (combo >= 3) {                               // a partir de x3 el combo suena y salta
        sonido.efecto("combo", combo);
        const cb = $("combo"); cb.classList.remove("sube"); void cb.offsetWidth; cb.classList.add("sube");
      }
      pinta();
      if (resuelto()) termina(true);
    } else {                                          // --- error ---
      vidas--; combo = 0;
      fallo = { i, v: n };                            // el número malo se ve un instante en rojo
      anima(i, "falla", 420);
      sonido.efecto("error");
      const v = $("vidas"); v.classList.remove("pierde"); void v.offsetWidth; v.classList.add("pierde");
      avisa(vidas > 0 ? `Incorrecto. Te ${vidas === 1 ? "queda 1 vida" : `quedan ${vidas} vidas`}.` : "Incorrecto. Sin vidas.");
      pinta();
      setTimeout(() => {                              // pasado el destello, se quita y se mira si se acabó
        fallo = null; pinta();
        if (vidas <= 0 && !terminada) termina(false);
      }, 430);
    }
  }
  /** Puntos de una jugada de Arcade: los da el motor; si algo falla, una cuenta de reserva. */
  function puntosDe(c, unidades) {
    let p = NaN;
    try { p = M.puntosArcade({ combo: c, unidades, dificultad: "medio" }); } catch (e) { p = NaN; }
    if (!Number.isFinite(p) || p < 0) p = 10 * Math.min(c, 10) + 100 * unidades; // reserva por si el motor no responde
    return Math.round(p);
  }
  const textoUnidades = k => (k === 1 ? "¡Unidad completa!" : `¡${k} unidades completas!`);

  /** Borra la celda elegida. */
  function borraCelda() {
    if (!juego || terminada) return;
    const i = sel;
    if (esFija(i) || ayudas.has(i)) return;           // las pistas no se borran
    if (modo === "arcade" && tab[i]) return;          // en Arcade lo acertado queda
    if (!tab[i] && !notas[i]) return;                 // nada que borrar
    historial.push([[i, tab[i], notas[i]]]);
    tab[i] = 0; notas[i] = 0;
    apunta(false);
    sonido.efecto("borra");
    pinta(); guardaProgreso();
  }

  /** Deshace el último cambio (en Arcade, solo notas). */
  function deshacer() {
    if (!juego || terminada || !historial.length) return;
    const cambios = historial.pop();
    for (let k = cambios.length - 1; k >= 0; k--) {   // al revés de como se hicieron
      const [j, v, nt] = cambios[k];
      tab[j] = v; notas[j] = nt;
    }
    apunta(false);
    sonido.efecto("borra");
    pinta(); guardaProgreso();
  }

  /** Pista (solo Clásico): pone un número correcto y suma 30 s. */
  function pista() {
    if (!juego || terminada || modo !== "clasico") return;
    let i = sel;
    if (esFija(i) || ayudas.has(i) || tab[i] === juego.solucion[i]) {
      // La elegida ya está bien: se busca la celda pendiente con menos candidatos (la más «lógica»).
      const limpio = tab.map((v, j) => (v === juego.solucion[j] ? v : 0)); // tablero sin los errores
      let mejor = -1, menos = 10;
      for (let j = 0; j < 81; j++) {
        if (tab[j] === juego.solucion[j]) continue;   // ya está bien
        const k = (M.candidatos(limpio, j) || []).length;
        if (k < menos) { menos = k; mejor = j; }
      }
      if (mejor < 0) return;                          // no queda nada que ayudar
      i = mejor;
    }
    // La pista no se deshace: se quita del historial todo lo que tocaba esa celda.
    historial = historial.map(c => c.filter(([j]) => j !== i)).filter(c => c.length);
    const n = juego.solucion[i];
    tab[i] = n; notas[i] = 0; ayudas.add(i);
    limpiaNotasVecinas(i, n, null);
    actualiza();                                      // el reloj al día antes de sumar
    ms += PENALIZA_PISTA; pistasUsadas++;             // la penalización: 30 s más
    apunta(true);                                     // la pista va a la prueba con sus 30 s
    sel = i;
    sonido.efecto("pista");
    anima(i, "pon", 230);
    flota(i, "+30 s");
    avisa(`Pista: ${n} en fila ${fila(i) + 1}, columna ${col(i) + 1}. +30 segundos.`);
    const hechas = unidadesHechas(i);
    if (hechas.length) olaDeLuz(i, hechas);
    pinta();
    if (resuelto()) termina(true); else guardaProgreso();
  }

  function alternaNotas() {                           // enciende/apaga el lápiz
    notasOn = !notasOn;
    avisa(notasOn ? "Modo notas activado." : "Modo notas desactivado.");
    pinta();
  }

  /* ====================================================================
     PARTIDAS — empezar, cargar, generar, terminar
     ==================================================================== */
  const aTexto = a => a.join("");                     // [5,3,0,…] → "530…" (81 caracteres)
  const deTexto = s => {                              // "530…" → [5,3,0,…], o null si no es válido
    if (typeof s !== "string" || !/^[0-9]{81}$/.test(s)) return null;
    return [...s].map(Number);
  };
  /** ¿El tablero guardado respeta las pistas del puzzle? (si no, está corrupto o es de otro). */
  const encaja = (t, pistas) => t && t.every((v, i) => !pistas[i] || v === pistas[i]);
  const notasValidas = x => (Array.isArray(x) && x.length === 81 ? x.map(v => entero(v, 0, 511)) : new Array(81).fill(0));

  /** Prepara una partida nueva o reanudada. */
  function empieza(p, estado) {
    juego = p;                                        // {modo, dif, pistas, solucion, fecha?}
    tab = estado && estado.tab ? estado.tab.slice() : p.pistas.slice();
    notas = estado && estado.notas ? estado.notas.slice() : new Array(81).fill(0);
    ayudas = new Set(estado && estado.ayudas ? estado.ayudas.filter(i => Number.isInteger(i) && i >= 0 && i < 81) : []);
    ms = estado && Number.isFinite(estado.ms) ? Math.max(0, estado.ms) : 0;
    pistasUsadas = ayudas.size;
    /* Las jugadas guardadas tienen que rehacer justo el tablero (y las
       pistas) guardados; si no cuadran, o la partida no trae su semilla,
       esta ya no se puede probar. */
    jugadas = []; tUlt = 0; sinPrueba = false;
    if (estado && !estado.hecha) {
      const r = M.repasa(p, { diario: "d", clasico: "c", arcade: "a" }[p.modo], Array.isArray(estado.j) ? estado.j : []);
      const cuadra = !r.error && r.tablero.every((v, i) => v === tab[i]) && r.ayudas.length === ayudas.size && r.ayudas.every(i => ayudas.has(i));
      if (cuadra && (p.modo === "diario" || Number.isSafeInteger(p.semilla))) { jugadas = estado.j.slice(); tUlt = r.fin; }
      else sinPrueba = true;
    }
    sombra = tab.slice();
    ent = { t: performance.now(), g: 0, f: 0 };       // la primera jugada se mide desde que aparece el tablero
    historial = []; fallo = null; notasOn = false;
    vidas = VIDAS; combo = 0; mejorCombo = 0; puntos = 0;
    terminada = !!(estado && estado.hecha);
    corriendo = !terminada; marca = performance.now();
    vaciasAlEmpezar = p.pistas.filter(v => !v).length || 1;
    sel = tab.findIndex(v => !v); if (sel < 0) sel = 40; // empieza en la primera celda vacía
    $("final").hidden = true;
    tablero.removeAttribute("aria-busy");
    pinta();
    if (!terminada) sonido.arranca(); else sonido.para();
  }

  /** Genera un sudoku al azar sin congelar el dibujo de «Generando…». */
  function genera(d, listo) {
    const mia = ++generacion;                         // si se pide otra antes de acabar, esta se descarta
    juego = null; corriendo = false;
    tablero.setAttribute("aria-busy", "true");
    $("info").innerHTML = "<b>Generando sudoku…</b>";
    pinta();
    setTimeout(() => {                                // deja pintar el aviso antes del cálculo
      if (mia !== generacion) return;
      const semilla = crypto.getRandomValues(new Uint32Array(1))[0]; // semilla al azar (no Math.random)
      const p = M.generar({ dificultad: d, rng: M.mulberry32(semilla) });
      if (mia !== generacion) return;
      p.semilla = semilla;                            // va a la prueba: el verificador lo regenera
      listo(p);
    }, 40);
  }

  /** Diario: el de hoy, retomado si se dejó a medias, o resuelto si ya se hizo. */
  function cargaDiario() {
    generacion++;                                     // cancela cualquier generación en curso
    hoy = M.diaChile();
    const s = M.sudokuDiario(hoy);                    // el mismo para todos: sale de la fecha
    const p = { modo: "diario", dif: "medio", fecha: s.fecha || hoy, pistas: s.pistas, solucion: s.solucion };
    const hecha = racha.ult === p.fecha;              // ¿ya se completó hoy (aquí u en otro dispositivo)?
    const prog = lee("sudoku.diario", null);
    let estado = null;
    if (hecha) estado = { tab: p.solucion, hecha: true, ms: prog && prog.fecha === p.fecha ? prog.ms : 0 };
    else if (prog && prog.fecha === p.fecha) {
      const t = deTexto(prog.tab);
      if (encaja(t, p.pistas)) estado = { tab: t, notas: notasValidas(prog.notas), ms: prog.ms, j: prog.j };
    }
    empieza(p, estado);
    pintaInfo();
    if (hecha) muestraFinal("hecho");                 // aviso de «vuelve mañana»
  }

  /** Clásico: retoma la partida guardada de esa dificultad o genera una nueva. */
  function cargaClasico(nueva) {
    const g = lee("sudoku.clasico", null);
    if (!nueva && g && g.dif === dif) {
      const pistas = deTexto(g.pistas), sol = deTexto(g.sol), t = deTexto(g.tab);
      if (pistas && sol && t && encaja(t, pistas) && sol.every(v => v >= 1)) {
        empieza({ modo: "clasico", dif, pistas, solucion: sol, semilla: g.s }, { tab: t, notas: notasValidas(g.notas), ms: g.ms, ayudas: g.ayudas, j: g.j });
        pintaInfo();
        return;
      }
    }
    genera(dif, p => {                                // no había nada que retomar: una nueva
      empieza({ modo: "clasico", dif, pistas: p.pistas, solucion: p.solucion, semilla: p.semilla });
      pintaInfo();
      guardaProgreso();
    });
  }

  /** Arcade: siempre una partida nueva en dificultad media. */
  function nuevaArcade() {
    genera("medio", p => {
      empieza({ modo: "arcade", dif: "medio", pistas: p.pistas, solucion: p.solucion, semilla: p.semilla });
      pintaInfo();
    });
  }

  /** Guarda la partida a medias (Diario y Clásico; el Arcade se juega de una vez). */
  function guardaProgreso() {
    if (!juego || terminada) return;
    const j = sinPrueba ? [] : jugadas;               // sin prueba no tiene sentido guardar jugadas
    if (juego.modo === "diario") guarda("sudoku.diario", { fecha: juego.fecha, tab: aTexto(tab), notas, ms: Math.round(ms), j });
    else if (juego.modo === "clasico") guarda("sudoku.clasico", { dif: juego.dif, pistas: aTexto(juego.pistas), sol: aTexto(juego.solucion), tab: aTexto(tab), notas, ms: Math.round(ms), ayudas: [...ayudas], s: juego.semilla, j });
  }

  /** Fin de partida: ranking, racha, récords, sonido y pantalla final. */
  function termina(gana) {
    if (terminada) return;
    terminada = true; corriendo = false;
    const tiempo = entero(ms, 1, TIEMPO_MAX);         // el ranking quiere un entero entre 1 ms y una semana
    sonido.para();
    sonido.efecto(gana ? "victoria" : "derrota");
    if (juego.modo === "diario") {
      const antes = racha.ult;
      racha = M.registraDiaria(racha, juego.fecha);   // suma el día (si es nuevo) y actualiza la mejor
      guarda("sudoku.racha", racha);
      guarda("sudoku.diario", { fecha: juego.fecha, tab: aTexto(tab), notas, ms: tiempo });
      pintaRacha();
      if (racha.ult !== antes) {                      // solo la primera vez del día cuenta para el ranking
        subeNube(true);
        if (Club && !sinPrueba) Club.result({ categoria: "club-sudoku-racha", puntos: entero(cuentaRacha(racha), 1, 1000), tiempo }, prueba());
      }
      muestraFinal("diario", { tiempo });
    } else if (juego.modo === "clasico") {
      borra("sudoku.clasico");                        // ya no hay nada que retomar
      const cat = `club-sudoku-${juego.dif}`;
      const nuevo = anotaRecord(cat, { puntos: 1, tiempo }); // ¿mejor tiempo local?
      if (Club && !sinPrueba) Club.result({ categoria: cat, puntos: 1, tiempo }, prueba()); // en Clásico manda el tiempo
      muestraFinal("clasico", { tiempo, nuevo });
    } else {
      let bono = 0;
      if (gana) {                                     // el bonus de tiempo solo si se completa
        // Con el tiempo entero que va al ranking: el verificador cuenta con ese.
        try { bono = Math.round(M.bonoTiempo(tiempo, "medio")) || 0; } catch (e) { bono = 0; }
        bono = Math.max(0, bono);
      }
      // Cada vida que sobra también suma (la tarifa la da el motor: M.PUNTOS.vida).
      const bonoVidas = gana ? Math.max(0, vidas) * ((M.PUNTOS && M.PUNTOS.vida) || 0) : 0;
      puntos = entero(puntos + bono + bonoVidas, 0, 1000000);
      const nuevo = puntos >= 1 && anotaRecord("club-sudoku-arcade", { puntos, tiempo });
      if (Club && puntos >= 1) Club.result({ categoria: "club-sudoku-arcade", puntos, tiempo }, prueba()); // aunque pierdas, si sumaste
      muestraFinal(gana ? "arcade" : "pierde", { tiempo, bono, bonoVidas, nuevo });
    }
    pinta();
  }

  /* ---------- Récords locales (y los de la nube, que llegan por conexion.js) ---------- */
  const porTiempo = cat => /^club-sudoku-(facil|medio|dificil|experto)$/.test(cat); // gana el menor tiempo
  /** Guarda la marca si mejora la local; devuelve true si fue récord. */
  function anotaRecord(cat, m) {
    const v = records[cat];
    const mejora = !v || (porTiempo(cat) ? m.tiempo < v.tiempo : m.puntos > v.puntos || (m.puntos === v.puntos && m.tiempo < v.tiempo));
    if (mejora) { records[cat] = { puntos: m.puntos, tiempo: m.tiempo }; guarda("sudoku.records", records); }
    return mejora;
  }
  window.addEventListener("club-record", e => {       // el récord de la cuenta: si es mejor, se adopta
    const d = e.detail || {};
    if (!/^club-sudoku-(arcade|facil|medio|dificil|experto)$/.test(d.categoria || "")) return;
    const m = { puntos: entero(d.puntos, 0, 1000000), tiempo: entero(d.tiempo, 1, TIEMPO_MAX) };
    const v = records[d.categoria];
    if (!v || (porTiempo(d.categoria) ? m.tiempo < v.tiempo : m.puntos > v.puntos)) {
      records[d.categoria] = m; guarda("sudoku.records", records); pintaInfo();
    }
  });

  /* ---------- Pantalla final (victoria, derrota, ya hecho) ---------- */
  function muestraFinal(tipo, d = {}) {
    const f = $("final");
    const cifra = (k, v) => `${k} <b>${v}</b>`;       // «TIEMPO 3:21»
    let titulo, texto, cifras = [], botones;
    if (tipo === "hecho") {                           // el diario de hoy ya estaba completo
      titulo = "¡YA LO HICISTE!";
      texto = `Vuelve mañana para mantener la racha: 🔥 ${dias(M.rachaVisible(racha, hoy))}.`;
      botones = `<button type="button" class="boton primario" data-accion="arcade">Jugar Arcade</button><button type="button" class="boton" data-accion="ver">Ver tablero</button>`;
    } else if (tipo === "diario") {
      titulo = "¡NIVEL SUPERADO!";
      texto = "Completaste el sudoku del día.";
      cifras = [cifra("TIEMPO", reloj(d.tiempo)), cifra("RACHA", dias(cuentaRacha(racha))), cifra("MEJOR", racha.mejor || 0)];
      botones = `<button type="button" class="boton primario" data-accion="arcade">Jugar Arcade</button><button type="button" class="boton" data-accion="ver">Ver tablero</button>`;
    } else if (tipo === "clasico") {
      titulo = d.nuevo ? "¡NUEVO RÉCORD!" : "¡NIVEL SUPERADO!";
      texto = `Sudoku ${String((M.DIFICULTADES[juego.dif] || {}).nombre || juego.dif).toLowerCase()} resuelto.`; // «Sudoku difícil resuelto.»
      cifras = [cifra("TIEMPO", reloj(d.tiempo)), cifra("PISTAS", pistasUsadas)];
      botones = `<button type="button" class="boton primario" data-accion="otra">Otra vez</button><button type="button" class="boton" data-accion="ver">Ver tablero</button>`;
    } else {                                          // arcade, ganado o perdido
      const gana = tipo === "arcade";
      titulo = gana ? (d.nuevo ? "¡NUEVO RÉCORD!" : "¡NIVEL SUPERADO!") : "GAME OVER";
      texto = gana ? "Tablero completo." : "Te quedaste sin vidas.";
      cifras = [cifra("PUNTOS", puntos), cifra("MÁX. SEGUIDOS", String(mejorCombo)) /* la racha de aciertos más larga */, cifra("TIEMPO", reloj(d.tiempo))];
      if (gana && d.bono) cifras.push(cifra("BONUS TIEMPO", `+${d.bono}`));
      if (gana && d.bonoVidas) cifras.push(cifra("BONUS VIDAS", `+${d.bonoVidas}`));
      botones = `<button type="button" class="boton primario" data-accion="otra">Otra vez</button><button type="button" class="boton" data-accion="ver">Ver tablero</button>`;
    }
    if (sinPrueba && Club && (tipo === "diario" || tipo === "clasico"))
      texto += " Esta partida se empezó con una versión anterior del juego: no entra en la clasificación" + (tipo === "diario" ? ", pero suma a tu racha." : ".");
    f.className = "final" + (tipo === "pierde" ? " pierde" : "");
    f.innerHTML = `<div><h2 id="finalTitulo">${titulo}</h2><p>${texto}</p>${cifras.length ? `<p class="cifras">${cifras.join(" · ")}</p>` : ""}<div class="botones">${botones}</div></div>`;
    f.hidden = false;
    const primero = f.querySelector(".primario");     // el foco va al botón principal
    if (primero) setTimeout(() => primero.focus({ preventScroll: true }), 60);
    avisa(`${titulo} ${texto}`);
  }
  $("final").addEventListener("click", e => {         // los botones de la pantalla final
    const b = e.target.closest("[data-accion]");
    if (!b) return;
    const a = b.dataset.accion;
    if (a === "ver") { $("final").hidden = true; celdas[sel].focus({ preventScroll: true }); }
    else if (a === "otra") otraPartida();
    else if (a === "arcade") ponModo("arcade");
  });
  function otraPartida() {                            // «Otra vez» / «↻ Otra»
    if (modo === "clasico") { borra("sudoku.clasico"); cargaClasico(true); }
    else if (modo === "arcade") nuevaArcade();
    else cargaDiario();
  }

  /* ---------- Racha y textos ---------- */
  function pintaRacha() {
    const n = M.rachaVisible(racha, hoy), b = $("racha");
    b.innerHTML = `🔥 ${dias(n)}${racha.mejor ? ` <small>· mejor ${racha.mejor}</small>` : ""}`;
    b.classList.toggle("cero", !n);
  }
  function pintaInfo() {
    if (!juego) return;
    const n = juego.pistas.filter(Boolean).length;   // cuántas pistas trae el puzzle
    const r = records[categoria()];
    if (modo === "diario") {
      const hecha = racha.ult === juego.fecha;
      $("info").innerHTML = `Hoy (${juego.fecha}): <b>sudoku medio</b>, el mismo para todos · ${n} pistas${hecha ? " · <b>Ya lo completaste ✓</b>" : ""}`;
    } else if (modo === "clasico") {
      const nombre = (M.DIFICULTADES[juego.dif] || {}).nombre || juego.dif; // «Difícil»
      $("info").innerHTML = `Sudoku al azar · <b>${nombre}</b> · ${n} pistas${r ? ` · Récord: <b>${reloj(r.tiempo)}</b>` : ""}`;
    } else {
      $("info").innerHTML = `<b>3 vidas</b>, combos y bonus por fila, columna y caja · ${n} pistas${r ? ` · Récord: <b>${r.puntos} pts</b>` : ""}`;
    }
  }
  function categoria() {                              // la clasificación del modo actual
    if (modo === "diario") return "club-sudoku-racha";
    if (modo === "clasico") return `club-sudoku-${dif}`;
    return "club-sudoku-arcade";
  }

  /* ---------- Modos ---------- */
  function ponModo(m) {
    if (juego && !terminada) guardaProgreso();       // lo que estaba a medias queda guardado
    modo = m; guarda("sudoku.modo", m);
    for (const b of document.querySelectorAll("[data-modo]")) {
      const si = b.dataset.modo === m;
      b.setAttribute("aria-selected", String(si));
      b.tabIndex = si ? 0 : -1;                       // tabs: solo la activa en el Tab
    }
    $("selectores").hidden = m !== "clasico";         // la dificultad solo en Clásico
    for (const id of ["datoVidas", "datoCombo", "datoPuntos"]) $(id).hidden = m !== "arcade"; // marcador de Arcade
    $("btnPista").hidden = m !== "clasico";           // pistas solo en Clásico
    $("btnOtra").hidden = m === "diario";             // el diario es uno por día
    if (Club) Club.category(categoria());             // el ranking lateral escucha esta categoría
    if (m === "diario") cargaDiario();
    else if (m === "clasico") cargaClasico(false);
    else nuevaArcade();
  }

  /* ---------- Racha en la cuenta (Club.guardarPartida / pedirPartida) ----------
     Se manda un solo texto JSON con la racha y el diario a medias. Al
     llegar lo de la cuenta se mezcla con lo de aquí (manda quien
     completó más tarde, y la mejor racha es el máximo de las dos). */
  function subeNube(forzar) {
    if (!Club || !Club.guardarPartida) return;
    const texto = JSON.stringify({ v: 1, racha, diario: lee("sudoku.diario", null) });
    if (!forzar && texto === ultimaSubida) return;    // nada nuevo: no se escribe otra vez
    ultimaSubida = texto;
    Club.guardarPartida(texto);
  }
  if (Club && Club.pedirPartida) Club.pedirPartida(dato => {
    let nube = null;
    try { nube = dato && typeof dato.d === "string" ? JSON.parse(dato.d) : null; } catch (e) { nube = null; }
    const rNube = nube && typeof nube === "object" && "racha" in nube && typeof nube.racha === "object" ? nube.racha : nube; // compatible con una racha suelta
    const junta = M.mezclaRacha(racha, rNube);
    const cambio = JSON.stringify(junta) !== JSON.stringify(racha);
    racha = junta; guarda("sudoku.racha", racha); pintaRacha();
    // El diario a medias de otro dispositivo se adopta si es de hoy y va más avanzado.
    const dn = nube && nube.diario, dl = lee("sudoku.diario", null);
    let adopta = false;
    if (dn && dn.fecha === hoy && deTexto(dn.tab) && (!dl || dl.fecha !== hoy || (dn.ms || 0) > (dl.ms || 0))) {
      guarda("sudoku.diario", dn); adopta = true;
    }
    // Si aquí había algo que la cuenta no tenía, se sube.
    if (JSON.stringify(junta) !== JSON.stringify(M.limpiaRacha(rNube)) || (dl && !adopta && dl.fecha === hoy)) subeNube(false);
    // Hecho hoy en otro dispositivo, o diario adoptado: se recarga si no se está a mitad de algo propio.
    if (modo === "diario" && juego && !terminada && (adopta || (cambio && racha.ult === juego.fecha))) cargaDiario();
  });

  /* ---------- Reloj y relevo de día ----------
     El reloj solo corre con la pestaña a la vista. Cada medio minuto se
     mira si en Chile ya es otro día: si el diario estaba terminado o sin
     tocar, llega el nuevo. */
  setInterval(() => { actualiza(); if (corriendo && juego) $("reloj").textContent = reloj(ms); }, 250);
  setInterval(guardaProgreso, 5000);                  // guardado periódico por si se cierra de golpe
  document.addEventListener("visibilitychange", () => {
    marca = performance.now();
    if (document.hidden) {                            // al irse: guardar, subir el diario y callar la música
      guardaProgreso();
      if (modo === "diario") subeNube(false);
      sonido.para();
    } else if (juego && !terminada) sonido.arranca(); // al volver, la música sigue
  });
  setInterval(() => {
    const f = M.diaChile();
    if (f === hoy) return;
    hoy = f; pintaRacha();
    if (modo === "diario" && (terminada || tab.every((v, i) => v === juego?.pistas[i]))) cargaDiario();
  }, 30000);

  /* ====================================================================
     ENTRADA — ratón/dedo y teclado físico
     ==================================================================== */
  tablero.addEventListener("click", e => {           // tocar una celda la elige
    const b = e.target.closest(".celda");
    if (b) { entrada(e); elige(+b.dataset.i); }
  });
  teclado.addEventListener("click", e => {           // el teclado en pantalla escribe
    const b = e.target.closest(".tecla");
    if (b) { entrada(e); escribe(+b.dataset.n); }
  });
  $("btnNotas").onclick = e => { entrada(e); alternaNotas(); };
  $("btnBorrar").onclick = e => { entrada(e); borraCelda(); };
  $("btnDeshacer").onclick = e => { entrada(e); deshacer(); };
  $("btnPista").onclick = e => { entrada(e); pista(); };
  $("btnOtra").onclick = otraPartida;
  $("nueva").onclick = otraPartida;
  $("selDif").onchange = () => {                      // otra dificultad: otra categoría y otra partida
    if (juego && !terminada) guardaProgreso();
    dif = $("selDif").value; guarda("sudoku.dif", dif);
    if (Club) Club.category(categoria());
    cargaClasico(false);
  };
  $("sound-button").onclick = () => sonido.alterna();
  for (const b of document.querySelectorAll("[data-modo]")) b.onclick = () => { if (b.dataset.modo !== modo) ponModo(b.dataset.modo); };
  // Flechas entre pestañas (patrón de tablist accesible).
  document.querySelector(".modos").addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const tabs = [...document.querySelectorAll("[data-modo]")];
    const k = (tabs.indexOf(document.activeElement) + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    e.preventDefault(); tabs[k].focus(); ponModo(tabs[k].dataset.modo);
  });

  /* El teclado físico: 1-9 escriben, flechas mueven, Supr/Retroceso
     borran, N notas, H pista, Ctrl+Z (o U) deshace. */
  document.addEventListener("keydown", e => {
    if (e.defaultPrevented || e.altKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.tagName === "SELECT" || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return; // no robar teclas a los campos
    if (t && t.closest && (t.closest(".modos") || t.closest("#final") || t.closest(".club-ranking"))) return; // ahí mandan sus propios botones
    entrada(e);                                       // cada tecla cuenta para la forma de la jugada
    if (e.ctrlKey) {                                  // Ctrl+Z deshace
      if (e.key === "z" || e.key === "Z") { e.preventDefault(); deshacer(); }
      return;
    }
    const num = /^(?:Digit|Numpad)([1-9])$/.exec(e.code); // la fila de números y el teclado numérico
    if (num || /^[1-9]$/.test(e.key)) { e.preventDefault(); escribe(num ? +num[1] : +e.key); return; }
    switch (e.key) {
      case "Backspace": case "Delete": case "0": e.preventDefault(); borraCelda(); return;
      case "n": case "N": e.preventDefault(); alternaNotas(); return;
      case "h": case "H": if (modo === "clasico") { e.preventDefault(); pista(); } return;
      case "u": case "U": e.preventDefault(); deshacer(); return;
    }
    const mov = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (mov === undefined) return;
    const dentro = t === document.body || t === document.documentElement || (t.closest && t.closest("#tablero, #teclado, .acciones, .scorebar"));
    if (!dentro) return;                              // las flechas en otros controles hacen lo suyo
    e.preventDefault();
    let f = fila(sel), c = col(sel);                  // se mueve dando la vuelta por los bordes
    if (mov === -9) f = (f + 8) % 9; else if (mov === 9) f = (f + 1) % 9;
    else if (mov === -1) c = (c + 8) % 9; else c = (c + 1) % 9;
    elige(f * 9 + c, true);
  });

  /* Mando de consola (juegos/audio/mando.js). No hay diez botones para diez
     cifras, así que LB/RB eligen la cifra (se ilumina en el teclado de
     pantalla) y A la escribe en la celda: la cruceta o el stick mueven. */
  let cifraMando = 1;
  const marcaCifra = () => teclas.forEach((b, k) => b.classList.toggle("mando-cifra", window.Mando && window.Mando.conectado() && k + 1 === cifraMando));
  const cambiaCifra = d => { cifraMando = (cifraMando + d + 8) % 9 + 1; marcaCifra(); };
  if (window.Mando) {
    window.Mando.configura({
      botones: {
        arriba: { tecla: "ArrowUp", rep: 120 }, abajo: { tecla: "ArrowDown", rep: 120 },
        izq: { tecla: "ArrowLeft", rep: 120 }, der: { tecla: "ArrowRight", rep: 120 },
        lb: () => { entrada(null); cambiaCifra(-1); }, rb: () => { entrada(null); cambiaCifra(1); },
        a: () => { entrada(null); escribe(cifraMando); }, x: "Backspace", y: "KeyN", b: "KeyU", rt: "KeyH"
      },
      menu: () => !$("final").hidden,
      pistas: [["dpad stickL", "moverte"], ["lb rb", "elegir cifra"], ["a", "escribir"], ["x", "borrar"], ["y", "notas"], ["b", "deshacer"], ["rt", "pista"]],
      zonas: [{ sel: "#nota" }]
    });
    window.Mando.alCambiar(marcaCifra);
    const st = document.createElement("style");
    st.textContent = ".tecla.mando-cifra{outline:3px solid var(--cian);outline-offset:2px;background:var(--line)}";
    document.head.appendChild(st);
  }

  /* ---------- Arranque ---------- */
  $("nota").innerHTML = "Teclas: <kbd>1</kbd>–<kbd>9</kbd> escriben, flechas para moverte, <kbd>Supr</kbd> borra, <kbd>N</kbd> notas, <kbd>Ctrl</kbd>+<kbd>Z</kbd> deshace, <kbd>H</kbd> pista (Clásico). " +
    (Club && document.documentElement.classList.contains("club-integrado")
      ? "La racha del diario se guarda en este navegador y en tu cuenta."
      : "La racha del diario vive en este navegador; juega desde Juegos para que te siga a otros dispositivos.");
  pintaRacha();
  ponModo(modo);
})();
