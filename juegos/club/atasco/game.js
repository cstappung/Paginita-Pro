/* Atasco — la pantalla.

   Resumen de lo que hace y por qué:
   - Dos vistas en la misma página: el edificio (pisos y niveles, con sus
     estrellas y candados) y el estacionamiento de un nivel. No hay
     recarga entre una y otra, así la música no se corta.
   - Las reglas son todas de motor.js (qué se puede mover, cuándo se gana,
     cuántas estrellas da cada cantidad de movidas). Aquí solo se dibuja,
     se escucha al jugador y se guarda.
   - Un vehículo se arrastra con el dedo o el ratón por su carril y al
     soltarlo cae en la casilla más cercana: una movida es un arrastre que
     lo dejó en otra casilla, aunque haya avanzado varias. Con el teclado:
     flechas para elegir, Espacio para tomar, flechas para moverlo, Espacio
     para soltar (lo mismo que agarrar y soltar). Con un mando, igual.
   - El progreso (estrellas, menos movidas y mejor tiempo de cada nivel)
     vive en este navegador y, dentro de Juegos, también en la cuenta
     (Club.guardarPartida); al llegar la copia de la cuenta se juntan
     quedándose con lo mejor de cada una (motor.mezclaProgreso).
   - A la clasificación va el total de estrellas, y solo cuando sube:
     cada resultado cuenta como una partida del club y paga monedas, así
     que repetir un nivel ya ganado no manda nada.
   - Antitrampas: cada movida se anota (vehículo, destino, instante) y la
     partida que ganó cada nivel se guarda con el progreso (`prog.p`). A la
     clasificación solo van las estrellas que esas partidas respaldan, y la
     prueba viaja con el resultado para que la página la vuelva a jugar
     (motor.juegaPrueba). Las estrellas de antes de esta versión, sin
     partida, se siguen viendo y abren pisos aquí, pero no cuentan en la
     tabla hasta volver a ganar ese nivel (docs/antitrampas/atasco.md).
   - Los vehículos se colocan con `transform: translate(%)`. El porcentaje
     de translate es del tamaño del propio vehículo, así que un auto de dos
     casillas avanza una casilla con 50 %: el tablero puede cambiar de
     tamaño sin recalcular nada. */
(() => {
  "use strict";
  const M = window.AtascoMotor, N = window.AtascoNiveles, D = window.AtascoDibujo;
  const Club = window.Club || null;                                   // fuera de Juegos no hay Club
  const $ = id => document.getElementById(id);

  /* ---------- Guardar en este navegador (una copia por cuenta) ---------- */
  const clave = k => (Club ? Club.storageKey(k) : k);
  const lee = (k, def) => { try { const v = localStorage.getItem(clave(k)); return v == null ? def : JSON.parse(v); } catch (e) { return def; } };
  const guarda = (k, v) => { try { localStorage.setItem(clave(k), JSON.stringify(v)); } catch (e) { /* sin almacenamiento: se juega igual */ } };

  /* ---------- Los niveles, en una lista plana ---------- */
  const PISOS = N.pisos;
  const NIVELES = [];                                                  // [{texto, optimo, piso, k}]
  PISOS.forEach((p, j) => p.niveles.forEach(([texto, optimo], k) => NIVELES.push({ texto, optimo, piso: j, k })));
  const TOTAL = NIVELES.length, MAX_ESTRELLAS = TOTAL * 3;
  const CATEGORIA = "club-atasco-estrellas";                           // la única tabla del juego
  const primeroDe = j => PISOS.slice(0, j).reduce((s, p) => s + p.niveles.length, 0); // índice del primer nivel de un piso

  let prog = M.limpiaProgreso(lee("atasco.progreso", null), TOTAL);    // lo ganado hasta ahora
  /* Cuánto vale la prueba de un nivel: [estrellas, ms], o null si no se
     puede volver a jugar. Con esto se elige qué intento guardar. */
  const leidos = [];
  const nivelLeido = i => leidos[i] || (leidos[i] = M.lee(NIVELES[i].texto));
  const califica = (i, t) => {
    if (!NIVELES[i]) return null;
    const r = M.juegaPrueba(nivelLeido(i), NIVELES[i].optimo, t);
    return r.error ? null : [r.estrellas, r.ms];
  };
  /* Lo que la clasificación puede contar. Vuelve a jugar todas las
     pruebas (unos milisegundos), así que se recuerda mientras `prog.p` sea
     el mismo objeto: cada cambio del progreso arma uno nuevo. */
  let resumenDe = null, resumen = null;
  const respaldadas = () => (resumenDe === prog.p ? resumen : (resumenDe = prog.p, resumen = M.resumenPruebas(prog.p, PISOS)));
  let pisoVisto = Math.min(PISOS.length - 1, Math.max(0, lee("atasco.piso", 0) | 0)); // la pestaña abierta
  let ultimaSubida = "";                                               // lo último mandado a la cuenta

  /* ---------- Estado de la partida ---------- */
  let J = null;           // el nivel en juego: {i, nivel, pos, movs, hist, jugadas, ganado, acum, desde, tocado}
  let elems = [];         // un elemento por vehículo, en el orden del motor
  let sel = 0;            // vehículo elegido con el teclado
  let tomado = false;     // ¿el vehículo elegido está agarrado (teclado/mando)?
  let tomadoDesde = 0;    // dónde estaba al agarrarlo
  let tomadoGesto = null; // para la prueba: cuándo se tomó, cuántas flechas, si fue de verdad
  let arrastre = null;    // el arrastre con el dedo o el ratón en curso
  let reloj = 0;          // intervalo que repinta el tiempo
  let porTeclado = false; // ¿se está jugando con teclado o mando? (con el dedo no se pinta la selección)
  const tactil = matchMedia("(pointer: coarse)").matches;          // teléfono o tableta
  const avisa = t => { $("aviso").textContent = t; };                 // lectores de pantalla

  /* ====================================================================
     SONIDO — el tema propio del cancionero y efectos hechos con el chip.
     El AudioContext se crea en el primer gesto (antes el navegador no
     deja). Con pocas movidas de margen la música apura un poco el paso.
     ==================================================================== */
  class Sonido {
    constructor() {
      this.on = lee("atasco.sonido", true) !== false;                 // el silencio se recuerda
      this.ctx = null; this.master = null;                           // contexto y volumen general
      this.rep = null; this.loop = null;                             // el reproductor del tema y su temporizador
      this.voces = new Set();                                        // efectos en curso
      this.tension = 0;                                              // 0 tranquilo, 1 sin margen para ★★★, 2 sin margen para ★★
    }
    desbloquea() {                                                   // crea o reanuda el contexto (solo en un gesto)
      if (!this.on) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx || !window.Chip) return;
      try {
        if (!this.ctx) {
          this.ctx = new Ctx();
          this.master = this.ctx.createGain();                       // un solo volumen para música y efectos
          this.master.gain.value = .5;
          this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      } catch (e) { this.ctx = null; }
    }
    listo() { return this.on && this.ctx && this.ctx.state === "running"; }
    arranca() {                                                      // la música del tema «atasco»
      if (!this.on || document.hidden || !this.ctx) return;
      const tema = window.Temas && window.Temas.temas && window.Temas.temas.atasco;
      if (!tema || !window.Chip.Reproductor) return;
      try {
        if (!this.rep) this.rep = new window.Chip.Reproductor(this.ctx, this.master, tema);
        if (this.loop) return;                                       // ya suena
        this.rep.reinicia();
        this.loop = setInterval(() => this.agenda(), 75);            // agenda notas por delante cada 75 ms
        this.agenda();
      } catch (e) { this.rep = null; }
    }
    agenda() {
      if (!this.rep || !this.ctx || this.ctx.state !== "running") return;
      const r = this.rep, jugando = !!J && !J.ganado;
      r.capas.arp = jugando ? 1 : .5;                                // en el edificio, el arpegio más suave
      r.capas.bat = jugando || !J ? 1 : .6;
      r.tempo = 1 + this.tension * .04;                              // hasta un 8 % más rápido sin margen
      r.tick(.2);
    }
    para() {
      clearInterval(this.loop); this.loop = null;
      if (this.rep) { try { this.rep.detener(); } catch (e) { /* nada */ } }
    }
    callaTodo() {                                                    // música y efectos, también lo agendado
      this.para();
      for (const v of this.voces) {
        try { v.fuente.stop(0); } catch (e) { /* ya parado */ }
        for (const n of v.nodos) { try { n.disconnect(); } catch (e) { /* nada */ } }
      }
      this.voces.clear();
    }
    alterna() {                                                      // el botón de sonido
      this.on = !this.on;
      guarda("atasco.sonido", this.on);
      if (!this.on) this.callaTodo();
      else { this.desbloquea(); this.arranca(); this.efecto("toma"); }
      this.boton();
    }
    boton() {
      const b = $("sound-button");
      b.setAttribute("aria-pressed", String(this.on));
      b.setAttribute("aria-label", this.on ? "Desactivar música y efectos" : "Activar música y efectos");
    }
    nota(o) {                                                        // una nota del chip
      if (!this.listo()) return;
      try { window.Chip.voz(this.ctx, this.master, Object.assign({ sus: .7 }, o, { t: Math.max(o.t, this.ctx.currentTime) }), this.voces); } catch (e) { /* audio roto: se juega igual */ }
    }
    ruido(o) {
      if (!this.listo()) return;
      try { window.Chip.ruido(this.ctx, this.master, Object.assign({}, o, { t: Math.max(o.t, this.ctx.currentTime) }), this.voces); } catch (e) { /* nada */ }
    }
    efecto(tipo, x = 0) {                                            // los efectos cortos del juego
      this.desbloquea();
      if (!this.listo()) return;
      const t = this.ctx.currentTime, hz = window.Chip.hz;
      switch (tipo) {
        case "toma":                                                 // agarrar: un clic agudo
          this.nota({ t, f: 1800, f1: 1200, dur: .035, vol: .05, onda: "p12" });
          break;
        case "desliza":                                              // deslizar: soplido de neumáticos que sube con la distancia
          this.ruido({ t, dur: .09 + .04 * x, vol: .05, tono: .55 + .1 * x, tono1: .3 });
          this.nota({ t, f: 110 + 18 * x, f1: 150 + 22 * x, dur: .08 + .03 * x, vol: .05, onda: "p50", sus: .5 });
          break;
        case "choca":                                                // contra otro vehículo o el cordón: un golpe sordo
          this.nota({ t, f: 140, f1: 45, dur: .13, vol: .12, onda: "tri", sus: .5 });
          this.ruido({ t, dur: .05, vol: .06, tono: .4, corto: true });
          break;
        case "deshace":                                              // deshacer: un blip que baja
          this.nota({ t, f: hz(76), f1: hz(64), dur: .07, vol: .05, onda: "p25" });
          break;
        case "bocina": {                                             // la bocina del auto rojo: dos tonos a la vez, dos veces
          for (const k of [0, .2]) {
            this.nota({ t: t + k, f: 370, dur: .14, vol: .06, onda: "p50", sus: .9 });
            this.nota({ t: t + k, f: 466, dur: .14, vol: .05, onda: "p50", sus: .9 });
          }
          break;
        }
        case "motor":                                                // el auto rojo acelera hacia la salida
          this.nota({ t, f: 62, f1: 190, dur: .8, vol: .1, onda: "p25", sus: .9 });
          this.nota({ t, f: 124, f1: 380, dur: .8, vol: .035, onda: "p12", sus: .9 });
          this.ruido({ t, dur: .8, vol: .04, tono: .35, tono1: 1.1 });
          break;
        case "barrera":                                              // la barrera se levanta: zumbido mecánico y tope
          this.nota({ t, f: 300, f1: 520, dur: .3, vol: .035, onda: "p12", sus: .8 });
          this.nota({ t: t + .3, f: 900, f1: 500, dur: .05, vol: .05, onda: "tri" });
          break;
        case "estrella":                                             // una estrella: campanita que sube con cada una
          this.nota({ t, f: hz(79 + x * 5), dur: .22, vol: .07, onda: "p25", sus: .6 });
          this.nota({ t: t + .05, f: hz(91 + x * 5), dur: .18, vol: .04, onda: "tri" });
          break;
        case "victoria":                                             // fanfarria en Si bemol, la tonalidad del tema
          [70, 74, 77, 82, 86, 89, 94].forEach((n, k) => this.nota({ t: t + k * .08, f: hz(n), dur: .16, vol: .07, onda: "p25" }));
          break;
        case "abre":                                                 // se abre un piso: arpegio largo
          [58, 65, 70, 74, 77, 82, 86].forEach((n, k) => this.nota({ t: t + k * .07, f: hz(n), dur: .3, vol: .05, onda: "p12" }));
          break;
        case "no":                                                   // un nivel cerrado
          this.nota({ t, f: hz(58), dur: .12, vol: .06, onda: "p50", sus: .8 });
          this.nota({ t: t + .13, f: hz(53), dur: .18, vol: .06, onda: "p50", sus: .8 });
          break;
      }
    }
  }
  const sonido = new Sonido();
  sonido.boton();
  const primerGesto = () => { sonido.desbloquea(); sonido.arranca(); };
  document.addEventListener("pointerdown", primerGesto, { capture: true });
  document.addEventListener("keydown", primerGesto, { capture: true });
  document.addEventListener("visibilitychange", () => {               // pestaña oculta: silencio y reloj quieto
    if (document.hidden) { sonido.para(); pausaReloj(); }
    else { sonido.arranca(); siguaReloj(); }
  });
  $("sound-button").onclick = () => sonido.alterna();

  /* ====================================================================
     EL EDIFICIO — pisos y niveles
     ==================================================================== */
  const estrellasDe = i => (prog.n[i] ? prog.n[i][0] : 0);
  const estrellasPiso = j => { let s = 0; for (let i = primeroDe(j); i < primeroDe(j) + PISOS[j].niveles.length; i++) s += estrellasDe(i); return s; };
  const faltanPara = j => Math.max(0, Math.ceil(PISOS[j - 1].niveles.length * 3 / 2) - estrellasPiso(j - 1)); // estrellas que faltan para abrir el piso j
  const textoEstrellas = n => "★".repeat(n) + "☆".repeat(3 - n);

  function pintaTotal() {
    const t = M.totales(prog), r = respaldadas().estrellas, b = $("totalEstrellas");
    b.textContent = `★ ${t.estrellas} / ${MAX_ESTRELLAS}`;
    // Estrellas de antes de las pruebas: se ven, pero la tabla aún no las cuenta.
    b.title = r < t.estrellas
      ? `Estrellas juntadas en todos los niveles. En la clasificación cuentan ${r}: los niveles ganados con una versión anterior del juego cuentan al volver a ganarlos.`
      : "Estrellas juntadas en todos los niveles";
  }

  function pintaPisos() {
    pintaTotal();
    const cont = $("pisos");
    cont.replaceChildren();
    PISOS.forEach((p, j) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "piso"; b.setAttribute("role", "tab");
      const abierto = M.pisoAbierto(prog, PISOS, j);
      b.classList.toggle("cerrado", !abierto);
      b.setAttribute("aria-selected", String(j === pisoVisto));
      b.innerHTML = `<b>${p.nombre}</b><small translate="no">★ ${estrellasPiso(j)} / ${p.niveles.length * 3}</small>`;
      b.onclick = () => { pisoVisto = j; guarda("atasco.piso", j); pintaPisos(); };
      cont.appendChild(b);
    });
    // En el teléfono los pisos son una fila que se desliza: el elegido, a la vista.
    const activo = cont.querySelector("[aria-selected=true]");
    if (activo && cont.scrollWidth > cont.clientWidth) cont.scrollLeft = Math.max(0, activo.offsetLeft - cont.offsetLeft - 16);
    const p = PISOS[pisoVisto], abierto = M.pisoAbierto(prog, PISOS, pisoVisto);
    $("pisoDesc").textContent = abierto ? p.desc
      : `Cerrado: junta ${faltanPara(pisoVisto)} estrellas más en ${PISOS[pisoVisto - 1].nombre} para abrirlo.`;
    const lista = $("niveles");
    lista.replaceChildren();
    const ini = primeroDe(pisoVisto);
    let siguienteMarcado = false;
    p.niveles.forEach((_, k) => {
      const i = ini + k, e = estrellasDe(i), puede = M.nivelAbierto(prog, PISOS, i);
      const b = document.createElement("button");
      b.type = "button"; b.className = "puesto"; b.setAttribute("role", "listitem");
      b.disabled = !puede;
      if (e) b.classList.add(e === 3 ? "perfecto" : "hecho");
      if (puede && !e && !siguienteMarcado) { b.classList.add("siguiente"); siguienteMarcado = true; } // el próximo por jugar
      b.innerHTML = `<b>${i + 1}</b><span class="est">${"<i>★</i>".repeat(e)}${"★".repeat(3 - e)}</span>`;
      b.setAttribute("aria-label", `Nivel ${i + 1}: ${puede ? (e ? e + (e === 1 ? " estrella" : " estrellas") : "sin jugar") : "cerrado"}`);
      b.onclick = () => abreNivel(i);
      lista.appendChild(b);
    });
  }

  function muestraPisos() {
    paraReloj();
    J = null; tomado = false; arrastre = null;
    sonido.tension = 0;
    $("vistaJuego").hidden = true;
    $("vistaPisos").hidden = false;
    pintaPisos();
    const sig = document.querySelector(".puesto.siguiente") || document.querySelector(".puesto:not(:disabled)");
    if (sig && document.activeElement && document.activeElement !== document.body) sig.focus();
  }

  /* ====================================================================
     EL ESTACIONAMIENTO
     ==================================================================== */
  function abreNivel(i) {
    if (i < 0 || i >= TOTAL || !M.nivelAbierto(prog, PISOS, i)) { sonido.efecto("no"); return; }
    const n = NIVELES[i];
    const nivel = M.lee(n.texto);
    J = { i, nivel, pos: nivel.pos.slice(), movs: 0, hist: [], jugadas: [], ganado: false, acum: 0, desde: 0, tocado: false,
          abiertoEn: performance.now(), reaccion: 0 };
    sel = 0; tomado = false; arrastre = null;
    if (pisoVisto !== n.piso) { pisoVisto = n.piso; guarda("atasco.piso", n.piso); }
    $("vistaPisos").hidden = true;
    $("vistaJuego").hidden = false;
    $("final").hidden = true;
    $("barrera").classList.remove("abierta");
    armaVehiculos();
    pintaMarcador();
    paraReloj();
    $("lote").focus({ preventScroll: true });
    if (tactil) $("vistaJuego").scrollIntoView({ block: "nearest" });   // en el teléfono, el tablero a la vista
    avisa(`Nivel ${i + 1}. Mínimo ${n.optimo} movidas.`);
  }

  /* Un elemento por vehículo, con su dibujo; la posición la pone colocaUno. */
  function armaVehiculos() {
    const cont = $("vehiculos");
    cont.replaceChildren();
    elems = J.nivel.vehiculos.map((v, i) => {
      const el = document.createElement("div");
      el.className = "veh";
      el.dataset.i = i;
      el.style.width = `calc(100% / 6 * ${v.h ? v.largo : 1})`;     // el tamaño en casillas
      el.style.height = `calc(100% / 6 * ${v.h ? 1 : v.largo})`;
      el.innerHTML = D.svg(v);
      el.addEventListener("pointerdown", e => empiezaArrastre(e, i));
      cont.appendChild(el);
      return el;
    });
    // Los conos son parte del piso: se dibujan una vez y no se mueven.
    for (const k of J.nivel.conos) {
      const c = document.createElement("div");
      c.className = "veh cono";
      c.style.width = c.style.height = "calc(100% / 6)";
      c.style.transform = `translate(${(k % 6) * 100}%, ${Math.floor(k / 6) * 100}%)`;
      c.style.cursor = "default";
      c.innerHTML = CONO;
      cont.appendChild(c);
    }
    colocaTodos(true);
  }
  const CONO = `<svg viewBox="0 0 100 100" role="img" aria-label="cono"><g stroke="#1d2330" stroke-width="5" stroke-linejoin="round">
    <rect x="14" y="14" width="72" height="72" rx="12" fill="#2b2f36"/><circle cx="50" cy="50" r="30" fill="#ff8a1e"/>
    <circle cx="50" cy="50" r="18" fill="#fff" stroke="none"/><circle cx="50" cy="50" r="10" fill="#ff8a1e"/></g></svg>`;

  /* translate(%) de un vehículo en la posición p (ver el resumen de arriba). */
  function traslado(v, p, extraPx = 0) {
    const fijo = v.carril * 100;                                       // la otra coordenada no cambia nunca
    const mov = v.h ? p * 100 / v.largo : p * 100 / v.largo;           // en % del propio largo
    const extra = extraPx ? ` + ${extraPx}px` : "";
    return v.h ? `translate(calc(${mov}%${extra}), ${fijo}%)` : `translate(${fijo}%, calc(${mov}%${extra}))`;
  }
  function colocaUno(i, sinAnimar) {
    const v = J.nivel.vehiculos[i], el = elems[i];
    if (sinAnimar) el.style.transition = "none";
    el.style.transform = traslado(v, J.pos[i]);
    if (sinAnimar) { void el.offsetWidth; el.style.transition = ""; }  // fuerza el estilo antes de devolver la animación
  }
  function colocaTodos(sinAnimar) { for (let i = 0; i < elems.length; i++) colocaUno(i, sinAnimar); pintaSeleccion(); }
  /* La selección amarilla es del teclado y del mando: con el dedo o el
     ratón no hace falta, y en un teléfono quedaba encendida sobre el auto
     rojo sin que nadie la hubiera pedido. */
  function pintaSeleccion() {
    const conMando = !!(window.Mando && window.Mando.conectado && window.Mando.conectado());
    const teclado = (porTeclado || conMando) && document.activeElement === $("lote") && !J?.ganado;
    elems.forEach((el, i) => {
      el.classList.toggle("sel", teclado && i === sel && !tomado);
      el.classList.toggle("tomado", teclado && i === sel && tomado);
    });
  }

  function pintaMarcador() {
    if (!J) return;
    const n = NIVELES[J.i], l = M.limites(n.optimo);
    $("nNivel").textContent = `${J.i + 1}`;
    $("nMovs").textContent = J.movs;
    $("nMovs").classList.toggle("pasado", J.movs > l.tres);
    $("nMin").textContent = n.optimo;
    $("nMetas").textContent = J.movs <= l.tres ? `★★★ ≤ ${l.tres}` : J.movs <= l.dos ? `★★ ≤ ${l.dos}` : "★";
    $("btnDeshacer").disabled = !J.hist.length || J.ganado;
    $("btnReiniciar").disabled = !J.movs || J.ganado;
    sonido.tension = J.movs >= l.dos ? 2 : J.movs >= l.tres ? 1 : 0;
    pintaTiempo();
  }

  /* ---------- El reloj del nivel: empieza con la primera movida ----------
     Las movidas se fechan con el instante de su evento (`e.timeStamp`, el
     mismo reloj que performance.now), no con el de cuando se atienden: si
     el teléfono se traba, dos sueltas en cola se atenderían juntas y la
     prueba diría que fueron a la vez. */
  const msJugados = ahora => (J ? J.acum + (J.desde ? (ahora || performance.now()) - J.desde : 0) : 0);
  const instanteDe = e => (e && e.timeStamp > 0 && e.timeStamp <= performance.now() + 1000 ? e.timeStamp : performance.now());
  /* ¿Lo hizo una mano? Un evento despachado por un guion (dispatchEvent)
     llega con isTrusted falso. El mando (juegos/audio/mando.js) también
     despacha teclas sintéticas, marcadas `__mando`: esas valen mientras
     haya un mando conectado de verdad. */
  const hayMando = () => { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(g => g && g.connected); } catch (_) { return false; } };
  const deVerdad = e => !!e && (e.isTrusted || (!!e.__mando && hayMando()));
  const formato = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  function pintaTiempo() { if (J) $("nTiempo").textContent = formato(msJugados()); }
  function arrancaReloj(ahora) {
    if (!J || J.desde || J.ganado) return;
    J.desde = Math.min(ahora || performance.now(), performance.now());
    clearInterval(reloj); reloj = setInterval(pintaTiempo, 250);
  }
  function pausaReloj() { if (J && J.desde) { J.acum += performance.now() - J.desde; J.desde = 0; } }
  function siguaReloj() { if (J && !J.ganado && J.movs > 0 && !J.desde) J.desde = performance.now(); }
  function paraReloj() { clearInterval(reloj); reloj = 0; }

  /* ---------- Una movida ---------- */
  function mueve(i, d, ahora, gesto) {
    if (!J || J.ganado || !M.puede(J.nivel, J.pos, i, d)) return false;
    J.hist.push(J.pos.slice());                                        // para deshacer
    J.pos = M.aplica(J.pos, i, d);
    J.movs++;
    arrancaReloj(ahora);
    // La prueba: vehículo, dónde quedó y en qué instante del reloj del nivel (nunca hacia atrás).
    // Y cómo fue el gesto (duración, pasos, puntero/teclado/mando, si fue de verdad): ver motor.codificaPrueba.
    const previo = J.jugadas.length ? J.jugadas[J.jugadas.length - 1][2] : 0;
    if (!J.jugadas.length) J.reaccion = Math.max(0, Math.round((ahora || performance.now()) - J.abiertoEn)); // desde que se abrió el nivel
    J.jugadas.push([i, J.pos[i], Math.max(previo, Math.round(msJugados(ahora))), gesto]);
    colocaUno(i);
    sonido.efecto("desliza", Math.abs(d));
    vibra(8);
    pintaMarcador();
    avisa(`${D.nombre(J.nivel.vehiculos[i])}: ${Math.abs(d)} ${Math.abs(d) === 1 ? "casilla" : "casillas"}. Movida ${J.movs}.`);
    if (M.resuelto(J.pos)) gana();
    return true;
  }
  function deshace() {
    if (!J || J.ganado || !J.hist.length) return;
    tomado = false;
    J.pos = J.hist.pop();
    J.movs--;
    J.jugadas.pop();                                                   // lo deshecho no está en la partida
    colocaTodos();
    sonido.efecto("deshace");
    pintaMarcador();
    avisa(`Deshecho. Movida ${J.movs}.`);
  }
  function reinicia() {
    if (!J || J.ganado || !J.movs) return;
    tomado = false;
    J.pos = J.nivel.pos.slice(); J.movs = 0; J.hist = []; J.jugadas = []; J.acum = 0; J.desde = 0;
    colocaTodos();
    sonido.efecto("deshace");
    pintaMarcador();
    avisa("Nivel desde el principio.");
  }

  /* ---------- Arrastrar con el dedo o el ratón ---------- */
  function empiezaArrastre(e, i) {
    if (!J || J.ganado || arrastre || e.button > 0) return;
    e.preventDefault();
    const v = J.nivel.vehiculos[i];
    const [atras, adelante] = M.alcance(J.nivel, J.pos, i);            // el hueco no cambia mientras se arrastra
    const cs = $("lote").getBoundingClientRect().width / 6;            // una casilla en píxeles
    arrastre = { i, v, x0: e.clientX, y0: e.clientY, atras, adelante, cs, px: 0, choco: false, id: e.pointerId,
                 t0: instanteDe(e), pasos: 0, fiable: deVerdad(e) };                // para la prueba: cuánto duró y cuántos pasos tuvo
    sel = i; tomado = false;
    elems[i].classList.add("arrastra");
    try { elems[i].setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
    porTeclado = false;
    sonido.efecto("toma");
    pintaSeleccion();
    if (i === 0 && !atras && !adelante) sonido.efecto("bocina");       // el rojo encerrado toca la bocina
  }
  window.addEventListener("pointermove", e => {
    const a = arrastre;
    if (!a || e.pointerId !== a.id) return;
    a.pasos++;
    if (!deVerdad(e)) a.fiable = false;
    const bruto = a.v.h ? e.clientX - a.x0 : e.clientY - a.y0;        // solo cuenta el eje de su carril
    const min = -a.atras * a.cs, max = a.adelante * a.cs;
    a.px = Math.max(min, Math.min(max, bruto));
    if ((bruto < min - a.cs * .3 || bruto > max + a.cs * .3) && !a.choco) { a.choco = true; sonido.efecto("choca"); vibra(25); } // empuja contra algo
    if (bruto >= min && bruto <= max) a.choco = false;
    elems[a.i].style.transform = traslado(a.v, J.pos[a.i], Math.round(a.px));
  });
  const sueltaArrastre = e => {
    const a = arrastre;
    if (!a || e.pointerId !== a.id) return;
    arrastre = null;
    elems[a.i].classList.remove("arrastra");
    const d = Math.round(a.px / a.cs);                                // la casilla más cercana
    const t = instanteDe(e), gesto = { d: t - a.t0, n: a.pasos, k: ".", f: a.fiable && deVerdad(e) };
    if (!d || !mueve(a.i, d, t, gesto)) colocaUno(a.i);                // no se movió: vuelve a su sitio
  };
  window.addEventListener("pointerup", sueltaArrastre);
  window.addEventListener("pointercancel", sueltaArrastre);
  /* Si el navegador quita la captura sin mandar pointerup (en iPhone pasaba
     con el menú de la pulsación larga), el auto no puede quedarse pegado al
     dedo: se suelta igual. */
  $("vehiculos").addEventListener("lostpointercapture", sueltaArrastre);
  $("lote").addEventListener("contextmenu", e => e.preventDefault()); // sin menú al mantener apretado

  /* Una vibración corta en los teléfonos que la tienen (Android): al mover
     y al chocar. iPhone no la ofrece a las páginas, y ahí no pasa nada. */
  function vibra(ms) {
    if (!tactil || !sonido.on || !navigator.vibrate) return;
    try { navigator.vibrate(ms); } catch (_) { /* nada */ }
  }

  /* ---------- Teclado (y mando, que llega como teclas) ---------- */
  /* Elige el vehículo siguiente en esa dirección. Primero los que están
     «en la línea» del elegido (comparten alguna fila si se va de lado,
     alguna columna si se va arriba o abajo), el más cercano; si no hay
     ninguno, el más cercano en esa dirección aunque esté de costado.
     Mirando solo los centros, dos autos podían mandarse la selección el
     uno al otro y un tercero quedaba imposible de alcanzar. */
  function eligeHacia(dx, dy) {
    const caja = i => {                                                // [x0, x1, y0, y1] en casillas
      const v = J.nivel.vehiculos[i], p = J.pos[i];
      return v.h ? [p, p + v.largo, v.carril, v.carril + 1] : [v.carril, v.carril + 1, p, p + v.largo];
    };
    const centro = c => [(c[0] + c[1]) / 2, (c[2] + c[3]) / 2];
    const a = caja(sel), [x0, y0] = centro(a);
    let mejor = -1, puntaje = Infinity;
    for (let i = 0; i < elems.length; i++) {
      if (i === sel) continue;
      const b = caja(i), [x, y] = centro(b), ex = x - x0, ey = y - y0;
      const avance = ex * dx + ey * dy;                                // cuánto va en la dirección pedida
      if (avance <= .1) continue;
      const enLinea = dx ? b[2] < a[3] && b[3] > a[2] : b[0] < a[1] && b[1] > a[0]; // ¿comparten fila o columna?
      const lado = Math.abs(ex * dy) + Math.abs(ey * dx);              // cuánto se desvía
      const s = (enLinea ? 0 : 100) + avance + lado * 2;               // los de la línea, siempre antes
      if (s < puntaje) { puntaje = s; mejor = i; }
    }
    if (mejor >= 0) { sel = mejor; sonido.efecto("toma"); avisa(D.nombre(J.nivel.vehiculos[sel])); }
    pintaSeleccion();
  }
  /* Q y E (LB y RB en un mando) recorren los vehículos uno por uno: con
     las flechas se llega rápido, con esto se llega seguro a cualquiera. */
  function eligeSiguiente(paso, e) {
    if (tomado) soltarTeclado(e);
    sel = (sel + paso + elems.length) % elems.length;
    sonido.efecto("toma");
    avisa(D.nombre(J.nivel.vehiculos[sel]));
    pintaSeleccion();
  }
  $("lote").addEventListener("keydown", e => {
    if (!J || J.ganado) return;
    if (!porTeclado) { porTeclado = true; pintaSeleccion(); }        // desde ahora se ve qué está elegido
    if ((e.key === "q" || e.key === "e" || e.key === "Q" || e.key === "E") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      eligeSiguiente(e.key.toLowerCase() === "e" ? 1 : -1, e);
      return;
    }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (dir) {
      e.preventDefault();
      if (!tomado) return eligeHacia(dir[0], dir[1]);
      const v = J.nivel.vehiculos[sel];
      const d = v.h ? dir[0] : dir[1];                                 // la flecha de través no hace nada
      if (!d) { sonido.efecto("choca"); return; }
      if (!M.puede(J.nivel, J.pos, sel, d)) { sonido.efecto("choca"); return; }
      // Mientras está tomado se mueve casilla a casilla sin contar; la movida se cuenta al soltar.
      J.pos = M.aplica(J.pos, sel, d);
      tomadoGesto.n++;
      if (!deVerdad(e)) tomadoGesto.f = false;
      if (e.__mando) tomadoGesto.k = "!";
      colocaUno(sel);
      sonido.efecto("desliza", 1);
      return;
    }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!tomado) {                                                   // agarrar
        tomado = true; tomadoDesde = J.pos[sel];
        tomadoGesto = { t0: instanteDe(e), n: 0, k: e.__mando ? "!" : ":", f: deVerdad(e) };
        sonido.efecto("toma");
        avisa(`${D.nombre(J.nivel.vehiculos[sel])} tomado. Flechas para moverlo, Espacio para soltar.`);
        if (sel === 0) { const [a, b] = M.alcance(J.nivel, J.pos, 0); if (!a && !b) sonido.efecto("bocina"); }
      } else soltarTeclado(e);
      pintaSeleccion();
    }
  });
  /* Soltar lo agarrado con el teclado: vuelve al punto de partida y hace
     la movida de una vez, así cuenta igual que un arrastre. */
  function soltarTeclado(e) {
    if (!tomado) return;
    tomado = false;
    const d = J.pos[sel] - tomadoDesde;
    J.pos[sel] = tomadoDesde;
    // Al perder el foco no hay tecla: cuenta lo que tuvo el gesto hasta ahí.
    const t = e && e.type === "keydown" ? instanteDe(e) : performance.now(), g = tomadoGesto || { t0: t, n: 0, k: ":", f: true };
    if (e && e.type === "keydown") { if (!deVerdad(e)) g.f = false; if (e.__mando) g.k = "!"; }
    if (!d || !mueve(sel, d, t, { d: t - g.t0, n: g.n, k: g.k, f: g.f })) colocaUno(sel);
    pintaSeleccion();
  }
  $("lote").addEventListener("focus", pintaSeleccion);
  $("lote").addEventListener("blur", () => { if (tomado) soltarTeclado(); pintaSeleccion(); });

  /* Atajos de toda la página. */
  document.addEventListener("keydown", e => {
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (!J) return;
    const k = e.key.toLowerCase();
    if (!$("final").hidden) {                                          // en la pantalla final
      if (k === "enter" && e.target === document.body) { e.preventDefault(); $("final").querySelector(".primario")?.click(); }
      if (k === "escape") muestraPisos();
      if (k === "enter" && e.target === $("lote")) { e.preventDefault(); $("final").querySelector(".primario")?.click(); }
      return;
    }
    if (k === "z" && !e.altKey) { e.preventDefault(); if (tomado) soltarTeclado(e); deshace(); }   // Z o Ctrl+Z
    else if (k === "r" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); reinicia(); }
    else if (k === "escape") { if (tomado) { soltarTeclado(e); } else muestraPisos(); }
  });

  /* Tras un botón el foco vuelve al estacionamiento: así las flechas siguen
     moviendo autos y Espacio no vuelve a pulsar el botón. */
  const yAlLote = f => () => { f(); if (J && !J.ganado) $("lote").focus({ preventScroll: true }); };
  $("btnNiveles").onclick = () => muestraPisos();
  $("btnDeshacer").onclick = yAlLote(deshace);
  $("btnReiniciar").onclick = yAlLote(reinicia);

  /* ====================================================================
     GANAR
     ==================================================================== */
  function gana() {
    J.ganado = true;
    pausaReloj(); paraReloj();
    // El tiempo del nivel es el instante de la última movida: así cuadra al ms con la prueba.
    const ms = Math.max(1, J.jugadas.length ? J.jugadas[J.jugadas.length - 1][2] : Math.round(J.acum));
    const n = NIVELES[J.i];
    const antes = respaldadas().estrellas;
    const pisosAntes = PISOS.map((_, j) => M.pisoAbierto(prog, PISOS, j));
    const r = M.anota(prog, J.i, J.movs, ms, n.optimo);
    prog = r.prog;
    // La partida que lo ganó, si es el mejor intento de este nivel. Una
    // partida movida desde la consola (__atasco.mueve) no deja prueba.
    const prueba = J.tocado ? "" : M.codificaPrueba(J.nivel, J.jugadas, J.reaccion);
    if (prueba) prog = M.anotaPrueba(prog, J.i, prueba, califica);
    guarda("atasco.progreso", prog);
    subeNube();
    // Una partida que no parece de una persona (eventos sintéticos, ritmo de
    // guion) no suma, pero se manda igual con su prueba: la página la
    // rechaza y deja el aviso para los administradores.
    const sinMano = !!prueba && prog.p[J.i] === prueba && !!respaldadas().bots[J.i];
    if (respaldadas().estrellas > antes || sinMano) mandaResultado(sinMano ? J.i : -1); // solo si subió el total que cuenta
    const abrio = PISOS.findIndex((_, j) => !pisosAntes[j] && M.pisoAbierto(prog, PISOS, j));
    pintaTotal();                                                      // el ★ de la cabecera ya cuenta este nivel
    pintaMarcador();
    pintaSeleccion();
    // La salida: bocina, la barrera arriba y el auto rojo afuera.
    sonido.efecto("bocina");
    setTimeout(() => { $("barrera").classList.add("abierta"); sonido.efecto("barrera"); }, 120);
    const rojo = elems[0], v = J.nivel.vehiculos[0];
    setTimeout(() => {
      rojo.classList.add("sale");
      rojo.style.transform = traslado(v, M.TAM + 1.5);                 // más allá del cordón
      sonido.efecto("motor");
    }, 380);
    setTimeout(() => muestraFinal(r, ms, abrio), matchMedia("(prefers-reduced-motion: reduce)").matches ? 200 : 1150);
  }

  function muestraFinal(r, ms, abrio) {
    if (!J) return;
    const n = NIVELES[J.i], l = M.limites(n.optimo), e = r.estrellas;
    const sig = J.i + 1 < TOTAL && M.nivelAbierto(prog, PISOS, J.i + 1) ? J.i + 1 : -1;
    const titulos = ["", "¡Afuera!", "¡Bien manejado!", "¡Perfecto!"];
    const fin = $("final");
    fin.innerHTML = `<div class="tarjeta">
      <h2 id="finalTitulo">${titulos[e]}</h2>
      <div class="estrellas" aria-label="${e} ${e === 1 ? "estrella" : "estrellas"}">${[1, 2, 3].map(k => `<span class="${k <= e ? "on" : ""}">★</span>`).join("")}</div>
      <p translate="no"><b>${J.movs}</b> movidas · mínimo <b>${n.optimo}</b> · ${formato(ms)}</p>
      ${e < 3 ? `<p>Para ★★★ hay que sacarlo en <b>${l.tres}</b> movidas${e < 2 ? `, y para ★★ en <b>${l.dos}</b>` : ""}.</p>` : `<p>Con el mínimo de movidas posible.</p>`}
      ${r.mejora && estrellasDe(J.i) === e && e > 1 ? `<p class="record">¡Récord en este nivel!</p>` : ""}
      ${abrio >= 0 ? `<p class="record">🔓 Se abrió ${PISOS[abrio].nombre}.</p>` : ""}
      <div class="botones">
        ${sig >= 0 ? `<button type="button" class="boton primario" data-ir="sig">Siguiente ▶</button>` : ""}
        <button type="button" class="boton${sig < 0 ? " primario" : ""}" data-ir="otra">↺ Repetir</button>
        <button type="button" class="boton" data-ir="pisos">▦ Niveles</button>
      </div></div>`;
    fin.hidden = false;
    fin.querySelector("[data-ir=sig]")?.addEventListener("click", () => abreNivel(sig));
    fin.querySelector("[data-ir=otra]").addEventListener("click", () => abreNivel(J.i));
    fin.querySelector("[data-ir=pisos]").addEventListener("click", () => muestraPisos());
    // Con teclado o mando el foco salta al botón principal (Intro sigue); con el dedo no, o queda un anillo azul que nadie pidió.
    if (porTeclado || (window.Mando && window.Mando.conectado && window.Mando.conectado())) fin.querySelector(".primario").focus({ preventScroll: true });
    for (let k = 0; k < e; k++) setTimeout(() => sonido.efecto("estrella", k), 120 + k * 250); // una campanita por estrella, con la animación
    setTimeout(() => sonido.efecto(abrio >= 0 ? "abre" : "victoria"), 120 + e * 250);
    avisa(`Nivel superado con ${e} ${e === 1 ? "estrella" : "estrellas"}, en ${J.movs} movidas.`);
  }

  /* ====================================================================
     LA CUENTA — clasificación y progreso en la nube
     ==================================================================== */
  /* Manda el total respaldado y, como prueba, la partida de cada nivel
     que cuenta: la página las vuelve a jugar antes de guardar nada. */
  function mandaResultado(conBot = -1) {
    if (!Club) return;
    const r = respaldadas();
    const n = {};
    let puntos = r.estrellas, tiempo = r.tiempo;
    for (const k of Object.keys(r.contados)) n[k] = prog.p[k];
    const b = r.bots[conBot];
    if (b) { n[conBot] = prog.p[conBot]; puntos += b[0]; tiempo = Math.min(604800000, tiempo + b[2]); } // lo que diría haber ganado
    if (puntos < 1) return;
    Club.result({ categoria: CATEGORIA, puntos, tiempo }, { v: M.PRUEBA_VERSION, n });
  }
  function subeNube(forzar) {
    if (!Club || !Club.guardarPartida) return;
    const texto = JSON.stringify(prog);
    if (!forzar && texto === ultimaSubida) return;                     // nada nuevo
    ultimaSubida = texto;
    Club.guardarPartida(texto);
  }
  /* La copia de la cuenta: se junta con la de aquí y, si aquí había algo
     que la cuenta no tenía, se sube. */
  if (Club && Club.pedirPartida) Club.pedirPartida(dato => {
    let nube = null;
    try { nube = dato && typeof dato.d === "string" ? JSON.parse(dato.d) : null; } catch (e) { nube = null; }
    const junta = M.mezclaProgreso(prog, nube, TOTAL, califica);
    const cambioAqui = JSON.stringify(junta) !== JSON.stringify(prog);
    const faltaAlla = JSON.stringify(junta) !== JSON.stringify(M.limpiaProgreso(nube, TOTAL));
    prog = junta;
    guarda("atasco.progreso", prog);
    if (cambioAqui && !J) pintaPisos(); else pintaTotal();
    if (faltaAlla) subeNube(true);
  });
  /* El récord de la tabla: si aquí hay más estrellas que las que la tabla
     conoce (se jugó como invitado o sin conexión), se manda una vez. */
  let sincronizado = false;
  window.addEventListener("club-record", e => {
    if (sincronizado || !e.detail || e.detail.categoria !== CATEGORIA) return;
    sincronizado = true;
    if (respaldadas().estrellas > (e.detail.puntos || 0)) mandaResultado();
  });

  /* ---------- Mando de consola (juegos/audio/mando.js) ----------
     La cruceta y el stick son las flechas, A agarra y suelta (Espacio),
     B deshace, X reinicia y LB/RB cambian de vehículo. En el edificio y en la
     pantalla final el mando mueve el cursor de siempre. */
  if (window.Mando) {
    window.Mando.configura({
      botones: {
        arriba: { tecla: "ArrowUp", rep: 160 }, abajo: { tecla: "ArrowDown", rep: 160 },
        izq: { tecla: "ArrowLeft", rep: 160 }, der: { tecla: "ArrowRight", rep: 160 },
        a: "Space", b: "KeyZ", x: "KeyR", lb: "KeyQ", rb: "KeyE"
      },
      stick: "flechas",
      objetivo: () => $("lote"),
      menu: () => !J || !$("final").hidden,
      pistas: [["dpad stickL", "elegir / mover"], ["lb rb", "otro vehículo"], ["a", "tomar y soltar"], ["b", "deshacer"], ["x", "reiniciar"]],
      zonas: [{ sel: "#nota" }]
    });
  }

  /* ---------- Arranque ---------- */
  $("nota").innerHTML = (tactil
      ? "Arrastra cada vehículo con el dedo, por su carril, hasta abrirle paso al auto rojo. ↶ deshace la última movida y ↺ empieza el nivel de nuevo. "
      : "Arrastra cada vehículo por su carril hasta abrirle paso al auto rojo. Teclado: flechas (o <kbd>Q</kbd>/<kbd>E</kbd>) para elegir, <kbd>Espacio</kbd> para tomar y soltar, <kbd>Z</kbd> deshace, <kbd>R</kbd> reinicia, <kbd>Esc</kbd> vuelve a los pisos. ") +
    (Club && document.documentElement.classList.contains("club-integrado")
      ? "Tus estrellas se guardan en este navegador y en tu cuenta."
      : "Tus estrellas viven en este navegador; juega desde Juegos para que te sigan a otros dispositivos.");
  /* El tamaño de la pantalla de verdad. Dentro de Juegos este documento es
     un iframe que crece con su contenido, así que su propio alto no dice
     nada: se mira el de la página de arriba (mismo origen), como Mina Club.
     Con eso el tablero cabe a lo alto y, con el teléfono acostado, el
     marcador y los botones pasan a una columna al lado del tablero. */
  function ajustaPantalla() {
    let w = innerWidth, h = innerHeight;
    try { w = window.top.innerWidth; h = window.top.innerHeight; } catch (_) { /* otra página: la propia */ }
    const raiz = document.documentElement;
    raiz.style.setProperty("--alto-pantalla", h + "px");
    raiz.classList.toggle("apaisado", w > h && h < 560);
  }
  ajustaPantalla();
  addEventListener("resize", ajustaPantalla);
  addEventListener("orientationchange", ajustaPantalla);
  try { if (window.top !== window) window.top.addEventListener("resize", ajustaPantalla); } catch (_) { /* nada */ }
  addEventListener("keydown", () => { if (window.Mando) pintaSeleccion(); });   // el mando llega como teclas

  if (Club) Club.category(CATEGORIA);                                  // el ranking lateral escucha esta tabla
  muestraPisos();

  /* Ganchos para probar desde la consola o un script (como __fanal). */
  window.__atasco = {
    estado: () => J && { nivel: J.i, pos: J.pos.slice(), movs: J.movs, ganado: J.ganado },
    abre: i => abreNivel(i),
    mueve: (i, d) => { if (J) J.tocado = true; return mueve(i, d); },   // sirve para probar, pero ese nivel no deja prueba
    resuelve: () => J && M.resuelve(J.nivel, J.pos),
    progreso: () => JSON.parse(JSON.stringify(prog)),
    pisos: () => muestraPisos()
  };
})();
