/* FANAL — la prueba de una partida: lo que se anota mientras se juega y
   cómo se rehace (docs/antitrampas/fanal.md).

   Qué hace, en general:
   - Mientras se juega, `juego.js` anota cada jornada como un REGISTRO: los
     tiros (afinados o no), cada cosa que un tiro toca (con qué tiro fue),
     los golpes al fanal, los poderes, la muerte de un jefe, el cruce con el
     Alba, y los pulsos de la música. Todo con su instante, en centésimas
     del reloj de juego, desde que empezó la jornada.
   - Al cerrar la jornada el registro se encadena con un hash al anterior y
     se guarda con los puntos y las llamas que el juego tiene en ese
     momento, y con las mejoras que se compraron en el taller antes de
     empezarla (el campo `u`: una letra por brasa gastada).
   - `rehace(prueba)` repite la partida a partir de esos eventos con el
     motor (motor.js): recalcula los puntos con la Resonancia, el bonus de
     cada jornada, las llamas extra; y comprueba que cada jornada pudo
     pasar así (todas las polillas de la formación, la vida del jefe, el
     Alba que tarda un minuto en llegar, los tiros afinados sobre un pulso,
     el reloj de juego contra el reloj real…).

   Por qué así y no una repetición cuadro a cuadro: FANAL es un juego en
   tiempo real cuya música lleva el compás, con azar en cada escama y cada
   picada, y la física mezclada con el dibujo. Rehacerlo exacto obligaría a
   separar dos mil líneas de pantalla y a llevar el reloj de la música
   cuadro a cuadro. En cambio, los puntos no salen del azar: salen de los
   eventos. Con los eventos se recalcula el puntaje exacto y se acota lo que
   un humano pudo hacer; lo que no se puede probar (que la polilla estaba
   de verdad donde dice el tiro) queda escrito como límite en la doc.

   UMD: `FanalPrueba` en la página, `module.exports` en Node y en el
   verificador del club (colabtex/src/juegos/solo/verifica/fanal.js). */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica(require("./motor.js"));
  else raiz.FanalPrueba = fabrica(raiz.FanalMotor);
})(typeof self !== "undefined" ? self : this, function (M) {
  "use strict";

  /* La 2 trae las mejoras (el campo `u` de cada jornada) y la segunda parte
     de la travesía: una prueba de la 1 se jugó con otras reglas. La 3 da
     las brasas solo por jefe vencido: una de la 2 compraba con las de
     cada jornada, y se rechaza como de otra versión (caché, no trampa).
     La 4 es la travesía de veinte jornadas (una oleada por jefe, la Luna,
     las Siete Hermanas y el Sol) con un solo modo: siempre desde la
     jornada 1, sin puntos de control ni sin fin aparte. */
  const VERSION = 4;

  /* El alfabeto de los eventos. Cada evento es una letra seguida de las
     centésimas que pasaron desde el anterior (en decimal, nada si fue en el
     mismo instante). Los que vienen de un tiro llevan, entre la letra y las
     centésimas, UN carácter en base 36: cuántos tiros atrás salió la bala
     (0 = el último). `z` es la excepción: sus cifras son la latencia del
     audio en milisegundos, y no mueven el reloj.

       S T      tiro (T = afinado, al pulso)
       A B C    polilla apagada por una bala (tipo a, b, c)
       N        bala que toca una polilla de dos vidas sin apagarla
       G H I    polilla apagada por el destello (tipo a, b, c)
       J K L    polilla en picada que se quema en la llama (tipo a, b, c)
       O        larva de la Nodriza o de la Crisálida, llamarada del Sol
       Q        lumbre apagada (las del Alba)
       R        sombra (el Alba)
       V        polilla que orbita al Faro o a la Hoguera, espina de un
                jefe en su fase 3
       X        golpe al jefe                 Z  tiro que empuja al Alba
       M        la Mensajera alcanzada
       g        el fanal pierde una llama     j  el jefe muere
       f        el cruce con el Alba          q  una lumbre llega a la llama
       p l c a d   poderes: pabilo, lente, campana, aceite, destello
       z        la latencia del audio (ms) */
  const DE_BALA = "ABCNOQRVXZM";
  const TIPO = { A: "a", B: "b", C: "c", G: "a", H: "b", I: "c", J: "a", K: "b", L: "c" };
  const VALIDOS = new Set("STABCNGHIJKLOQRVXZMgjfqplcadz".split(""));

  /* ---------------------------------------------------------------
     Lo que anota el juego
     --------------------------------------------------------------- */

  /* Una prueba nueva. `id`: la semilla de la partida (la eligen el juego
     o quien juega: da igual, igual hay que jugarla); `u`: la cuenta. `m`
     queda en "t" (la travesía): es el único modo, y forma parte del hash. */
  function nueva(id, u) {
    return { v: VERSION, m: "t", id: String(id), u: String(u || ""), k: 0, J: [] };
  }
  /* Abre el registro de la jornada `n`. `t` es el reloj de juego (el de la
     música, en segundos), `r` el reloj real (performance.now, en ms), `g`
     el tiempo de juego acumulado de la partida (en segundos), `lat` la
     latencia del audio en ms y `u` las mejoras compradas en el taller justo
     antes (sus códigos, ver motor.js: MEJORAS y CODIGO_LLAMA). */
  function abre(n, t, r, g, lat, u) {
    const reg = { n, t0: t, r0: r, g0: Math.round(g * 1000), ev: [], ult: 0, disp: 0, pul: [], pn: -1, lat: null, latT: -1e9, msj: 0, u: String(u || "") };
    latencia(reg, t, lat, true);
    return reg;
  }
  const centesimas = (reg, t) => Math.max(reg.ult, Math.round((t - reg.t0) * 100));
  /* Un evento en el instante de juego `t`. `ref`, si viene de una bala: el
     número de tiro (1, 2…) que la disparó. */
  function evento(reg, letra, t, tiro) {
    const abs = centesimas(reg, t), d = abs - reg.ult;
    reg.ult = abs;
    let ref = "";
    if (DE_BALA.includes(letra)) ref = Math.max(0, Math.min(35, reg.disp - (tiro || 0))).toString(36);
    reg.ev.push(letra + ref + (d ? d : ""));
  }
  /* La latencia del audio: se anota al abrir y cuando cambia 10 ms o más,
     no más de una vez cada cinco segundos (salvo cuando el audio recién
     arranca, que pasa de 0 a lo que sea). */
  function latencia(reg, t, ms, forzar) {
    const v = Math.max(0, Math.min(1500, Math.round(ms || 0)));
    if (!forzar && (reg.lat === v || Math.abs(v - reg.lat) < 10 || (reg.lat !== 0 && t - reg.latT < 5))) return;
    reg.lat = v; reg.latT = t;
    reg.ev.push("z" + v);
  }
  /* Un tiro: devuelve su número dentro de la jornada, que la bala recuerda. */
  function disparo(reg, afinado, t, lat) {
    latencia(reg, t, lat, false);
    evento(reg, afinado ? "T" : "S", t);
    return ++reg.disp;
  }
  /* Un pulso de la música (en el reloj de juego). Los que caen más de un
     segundo antes de abrir la jornada no hacen falta. */
  function pulso(reg, t) {
    const abs = Math.round((t - reg.t0) * 100);
    if (abs < -100) return;
    const prev = reg.pul.length ? reg.pul[reg.pul.length - 1] : -100;
    reg.pul.push(Math.max(prev, abs));
  }
  /* Cierra la jornada y la encadena a la prueba. `fin`: "c" completada,
     "m" el fanal se apagó, "a" abandonada (el cruce con el Alba ya no cierra
     la partida: su jornada termina "c" y la travesía sigue). `s` y
     `v` son los puntos y las llamas que el juego tiene ahora; `ent`, las
     entradas de la jornada: {b: sintéticas (isTrusted falso y sin mando
     conectado), d: del mando}. */
  function cierra(prueba, reg, fin, t, r, g, s, v, ent) {
    let p = "", prev = -100;
    for (const x of reg.pul) { p += (p ? "," : "") + (x - prev).toString(36); prev = x; }
    const rec = {
      n: reg.n, t: centesimas(reg, t), r: Math.max(0, Math.round((r - reg.r0) / 10)), g: Math.round(g * 1000) - reg.g0,
      e: reg.ev.join(""), p, f: fin, s: Math.round(s), v, u: reg.u,
      b: Math.max(0, (ent && ent.b) | 0), d: Math.max(0, (ent && ent.d) | 0)
    };
    rec.h = hashRegistro(ultimoHash(prueba), rec);
    prueba.J.push(rec);
    return rec;
  }
  const hashRegistro = (prev, x) => M.hashTexto(prev + "|" + [x.n, x.t, x.r, x.g, x.e, x.p == null ? "" : x.p, x.f, x.s, x.v, x.b, x.d, x.u == null ? "" : x.u].join("|"));
  const ultimoHash = prueba => (prueba.J.length ? prueba.J[prueba.J.length - 1].h : M.hashTexto("fanal|" + prueba.id + "|" + prueba.m));

  /* Si la prueba no cabe en lo que se guarda (200 000 caracteres), se le
     quitan los pulsos a las jornadas más viejas: es lo que más ocupa
     después de los eventos, y solo pasa en un sin fin de varias horas. */
  const PRUEBA_MAX = 190000;
  function ajusta(prueba) {
    let largo = JSON.stringify(prueba).length;
    for (const rec of prueba.J) {
      if (largo <= PRUEBA_MAX) break;
      if (rec.p == null) continue;
      largo -= rec.p.length; rec.p = null;
    }
    return prueba;
  }

  /* ---------------------------------------------------------------
     Rehacer y comprobar
     --------------------------------------------------------------- */

  /* Los márgenes, todos generosos: un falso positivo (rechazar a quien
     jugó de verdad) es peor que dejar pasar una trampa rara. */
  const LIM = {
    enfriar: 2,           // cs de redondeo sobre la espera entre dos tiros (0,16 s sin mejoras: ver M.armas)
    vuelo: 300,           // cs que una bala puede tardar en tocar algo: 1 s de pantalla, más la cámara lenta
    ventana: M.VENTANA_PULSO * 1000 + 30, // ms: la ventana del pulso, más redondeos y la latencia anotada
    entrada: 100,         // cs: ninguna polilla se puede tocar antes de 1,1 s (la entrada más corta)
    jefeEntra: 250,       // cs: el jefe no recibe golpes mientras se presenta (2,6 s)
    alba: 5900,           // cs: el Alba parte a 600 brazas y cierra 10 por segundo: un minuto
    trasJefe: 130,        // cs entre la muerte del jefe y el cierre (1,4 s o más)
    trasOleada: 100,      // cs entre la última polilla y el cierre (1,1 s)
    realHolgura: 1.1,     // el reloj de juego no corre más que el real (dt viene de requestAnimationFrame)
    realExtra: 200,       // cs de holgura sobre eso
    latCambio: 490,       // cs entre dos anotaciones de latencia (el juego espera 5 s)
    pulsosMax: 10,        // pulsos por segundo como mucho (la música hace de 2 a 4)
    pulsosMin: 0.25,      // y como poco (el compás más lento da uno cada 1,7 s)
    pulsosJuntos: 3,      // intervalos de menos de 0,2 s permitidos por jornada (cambios de etapa)
    sinPulsos: 100000,    // caracteres de eventos a partir de los cuales se aceptan jornadas viejas sin pulsos
    /* Ritmo humano. Lo de arriba es lo que la mecánica permite; esto es lo
       que una persona puede. Una travesía honesta hasta el Alba (ocho
       jornadas) tarda entre 300 y 500 s de juego (40–60 s por jornada, una polilla por
       segundo); los mínimos de aquí son de dos a cuatro veces más cortos,
       para que ni la mejor partida imaginable roce el límite, y dejan fuera
       lo que se vio en la tabla (26 jornadas del sin fin en 56 s) y también
       a un bot que dispara cada 0,17 s y no falla nunca (unas 4,5 polillas
       por segundo, 260 s la travesía entera). */
    porPolilla: 25,       // cs por polilla apagada a balazos en una oleada completa (4 por segundo)…
    porRoce: 15,          // …y por cada roce a una que aguanta más (los augurios endurecen la formación:
                          // sin esto, un bot que no falla pasaba por apagar cada una en dos tiros)…
    oleadaBase: 300,      // …más 3 s (la entrada de la formación y el cierre). Con el pabilo
                          // (dos balas por tiro) cuenta la mitad; con la lente, que atraviesa
                          // columnas enteras, solo la base.
    jefeMin: 400,         // cs: ningún jefe cae en menos de 4 s, ni antes de lo que permiten sus golpes y el arma
    lumbreMin: 500,       // cs: veinticuatro lumbres, aunque se apaguen a tiros
    travesiaMin: 18000,   // cs de juego hasta el Alba, la jornada 8 (3 min; la honesta, 5–8)
    /* Y en promedio: con cuatro jornadas completas o más (sin contar el
       Alba, que ya tiene su minuto), no menos de 7 s cada una. Las
       honestas promedian 30–60 s sin mejoras y 10–25 s con el arma llena. */
    mediaMin: 700,        // (con el arma llena una oleada cae en 7–10 s: un bot de Chromium promedió 11,5)
    mediaDesde: 4
  };

  /* Lee los eventos de un registro. Devuelve la lista o un motivo. */
  function leeEventos(e) {
    if (typeof e !== "string" || e.length > 400000) return "eventos ilegibles";
    const out = [];
    let i = 0, abs = 0;
    while (i < e.length) {
      const c = e[i++];
      if (!VALIDOS.has(c)) return "evento desconocido «" + c + "»";
      let ref = null;
      if (DE_BALA.includes(c)) {
        if (i >= e.length) return "evento cortado";
        ref = parseInt(e[i++], 36);
        if (!(ref >= 0)) return "referencia de tiro ilegible";
      }
      let d = "";
      while (i < e.length && e[i] >= "0" && e[i] <= "9") d += e[i++];
      if (d.length > 7) return "instante ilegible";
      const num = d ? parseInt(d, 10) : 0;
      if (c === "z") { out.push({ c, abs, val: num }); continue; }
      abs += num;
      out.push({ c, abs, ref, d: num });
    }
    return out;
  }
  function leePulsos(p) {
    if (p == null) return null;
    if (typeof p !== "string" || p.length > 200000) return "pulsos ilegibles";
    if (!p) return [];
    const out = [];
    let prev = -100;
    for (const x of p.split(",")) {
      if (!/^[0-9a-z]{1,4}$/.test(x)) return "pulsos ilegibles";
      prev += parseInt(x, 36);
      out.push(prev);
    }
    return out;
  }
  /* ¿Hay un pulso a menos de `ms` de este instante (en ms)? Búsqueda
     binaria: los pulsos vienen ordenados. */
  function cercaDePulso(pulsos, t, ms) {
    let a = 0, b = pulsos.length - 1;
    while (a <= b) {
      const m = (a + b) >> 1, v = pulsos[m] * 10;
      if (Math.abs(v - t) <= ms) return true;
      if (v < t) a = m + 1; else b = m - 1;
    }
    return false;
  }

  const entero = (x, min, max) => Number.isSafeInteger(x) && x >= min && x <= max;

  /* Rehace una prueba. Devuelve {puntos, completadas, completa, tiempo,
     muerto, jornadas, llamas, mej, brasas, notas} si cuadra, o {motivo} si
     no. Lo último es el estado con que sigue la travesía: el juego lo usa
     para retomar una partida guardada a medias sin creerle al guardado. */
  function rehace(prueba) {
    const mal = motivo => ({ motivo });
    if (!prueba || typeof prueba !== "object") return mal("sin prueba");
    if (prueba.v !== VERSION) return mal("prueba de otra versión del juego");
    if (prueba.x) return mal("partida tocada desde la consola (__fanal): no entra en la clasificación");
    if (prueba.m !== "t") return mal("modo desconocido");
    if (typeof prueba.id !== "string" || !/^[A-Za-z0-9_-]{6,40}$/.test(prueba.id)) return mal("semilla ilegible");
    const J = prueba.J;
    if (!Array.isArray(J) || J.length > 3000) return mal("jornadas ilegibles");
    // Ya no hay puntos de control: toda travesía empieza en la jornada 1.
    if (prueba.k !== 0) return mal("la travesía no sigue de un punto de control");
    const base = 1;
    // Jornadas sin pulsos: solo si la prueba es enorme (ver ajusta) y solo las primeras.
    const totalEventos = J.reduce((s, x) => s + (x && typeof x.e === "string" ? x.e.length : 0), 0);

    const est = { puntos: 0, llamas: M.LLAMAS_INICIO, notas: 0, muerto: false };
    // El taller: las mejoras y las brasas que quedan. Se compran con
    // M.compra, lo mismo que el juego.
    const taller = { mej: M.mejorasVacias(), brasas: 0, llamas: 0 };
    const suma = n => {
      const antes = est.puntos;
      est.puntos += n;
      const extra = M.llamasGanadas(antes, est.puntos);
      if (extra) est.llamas = Math.min(M.llamasMax(taller.mej), est.llamas + extra);
    };
    const mult = () => M.resonancia(est.notas);
    let hashPrev = M.hashTexto("fanal|" + prueba.id + "|" + prueba.m), completadas = 0, completa = false, tiempo = 0, sinPulsosAun = true;
    const poderesRecientes = [];                                        // por jornada: {p, l}

    for (let i = 0; i < J.length; i++) {
      const x = J[i], donde = "jornada " + (x && x.n);
      if (!x || typeof x !== "object") return mal("jornada ilegible");
      if (x.n !== base + i) return mal("las jornadas no siguen en orden desde la " + base + " (" + donde + ")");
      if (!entero(x.t, 0, 1e9) || !entero(x.r, 0, 1e10) || !entero(x.g, 0, 1e10) || !Number.isSafeInteger(x.s) || !entero(x.v, 0, M.LLAMAS_TOPE)) return mal("números ilegibles en la " + donde);
      if (!["c", "m", "a"].includes(x.f)) return mal("fin ilegible en la " + donde);
      if (typeof x.u !== "string" || !/^[a-z]{0,80}$/.test(x.u)) return mal("compras ilegibles en la " + donde);
      if (hashRegistro(hashPrev, x) !== x.h) return mal("la cadena de la prueba no cuadra en la " + donde);
      hashPrev = x.h;
      const ultima = i === J.length - 1;
      if (!ultima && x.f !== "c") return mal("una jornada que no terminó no puede tener otra detrás (" + donde + ")");
      const j = M.jornada(x.n), alba = j.jefe === "alba";
      // Lo que se compró en el taller antes de esta jornada, en orden.
      taller.llamas = est.llamas;
      for (const cod of x.u) {
        const no = M.compra(taller, cod);
        if (no) return mal("una compra imposible en el taller antes de la " + donde + " (" + no + ")");
      }
      est.llamas = taller.llamas;
      const arm = M.armas(taller.mej), topeLlamas = M.llamasMax(taller.mej);
      const enfriar = Math.round(arm.cool * 100) - LIM.enfriar;

      // El reloj: el de juego no corre más que el real, y el tiempo en juego
      // no supera el de la jornada.
      if (x.t > x.r * LIM.realHolgura + LIM.realExtra) return mal("el reloj de juego corrió más rápido que el real en la " + donde);
      if (x.g > x.t * 10 + 50) return mal("más tiempo en juego que tiempo de jornada en la " + donde);
      tiempo += x.g;
      // Las entradas: un script que despacha teclas o toques da isTrusted
      // falso. Las del mando (mando.js) también, pero esas el juego las
      // cuenta aparte, y solo si había un mando conectado.
      if (!entero(x.b, 0, 1e7) || !entero(x.d, 0, 1e7)) return mal("entradas ilegibles en la " + donde);
      if (x.b > 0) return mal(x.b + " entradas sintéticas (no las hizo una persona) en la " + donde);

      const ev = leeEventos(x.e);
      if (typeof ev === "string") return mal(ev + " en la " + donde);
      const pulsos = leePulsos(x.p);
      if (typeof pulsos === "string") return mal(pulsos + " en la " + donde);
      if (pulsos === null) {
        if (!sinPulsosAun || totalEventos < LIM.sinPulsos) return mal("faltan los pulsos de la " + donde);
      } else {
        sinPulsosAun = false;
        const seg = x.t / 100;
        if (pulsos.length > LIM.pulsosMax * seg + 10) return mal("demasiados pulsos en la " + donde);
        if (pulsos.length < LIM.pulsosMin * seg - 5) return mal("faltan pulsos en la " + donde);
        let juntos = 0;
        for (let k = 1; k < pulsos.length; k++) if (pulsos[k] - pulsos[k - 1] < 20) juntos++;
        if (juntos > LIM.pulsosJuntos) return mal("pulsos demasiado juntos en la " + donde);
      }

      // Lo que la jornada admite.
      const oleada = j.tipo === "oleada", lumbre = j.tipo === "lumbre", jefe = j.tipo === "jefe" ? j.jefe : null;
      const form = oleada || lumbre ? M.formacion(j) : null;
      const cupo = { a: 0, b: 0, c: 0 };
      if (oleada) for (const p of form.lista) cupo[p.tipo]++;
      const vida = t => (j.vida && j.vida[t]) || 1;
      // El daño de un tiro: el más alto y el más bajo que pudo hacer una de
      // sus balas (las chispas de la Antorcha pegan como un tiro sin afinar).
      const danoMax = af => (af ? arm.danoA : arm.danoN);
      const danoMin = af => (af ? (arm.chispas ? arm.danoN : arm.danoA) : arm.danoN);
      const vidaMax = oleada ? Math.max(0, ...["a", "b", "c"].filter(t => cupo[t]).map(vida)) : 0;
      const acto = j.acto, vuelta = j.vuelta || 0, fase = j.fase || 1;
      poderesRecientes.push({ p: false, l: false });
      const ultimas = poderesRecientes.slice(-3);
      const tiros = [];
      const c = { kills: { a: 0, b: 0, c: 0 }, aBala: 0, falta: 0, danoN: 0, N: 0, disparos: 0, aciertos: 0, golpes: 0, msj: 0, Q: 0, q: 0, Z: 0, dano: 0, jefeMuere: -1, cruce: -1, ultimaKill: -1 };
      let lat = 0, latT = null, latPrev = null, zPend = null, hubo = false, previo = null, ultimoTiro = null, fin = false;
      const tipoMal = l => mal("«" + l + "» no puede pasar en la " + donde);

      for (const e of ev) {
        const l = e.c;
        if (fin) return mal("hay eventos después del cruce en la " + donde);
        if (e.abs > x.t + 5) return mal("un evento después del cierre de la " + donde);
        if (l === "z") {
          // La latencia vale desde ya; su instante es el del evento que
          // sigue (el tiro que la notó), o 0 si la jornada recién abre.
          if (e.val > 1500) return mal("latencia imposible en la " + donde);
          if (zPend) return mal("dos latencias seguidas en la " + donde);
          if (latT === null && !hubo) latT = 0;                         // la que se anota al abrir
          else zPend = { val: latPrev, t: latT };
          latPrev = lat = e.val;
          continue;
        }
        if (zPend) {
          if (zPend.t !== null && zPend.val !== 0 && e.abs - zPend.t < LIM.latCambio) return mal("la latencia cambia demasiado seguido en la " + donde);
          latT = e.abs; zPend = null;
        }
        hubo = true;
        let tiro = null;
        if (e.ref !== null) {
          tiro = tiros[tiros.length - 1 - e.ref];
          if (!tiro) return mal("una bala sin tiro en la " + donde);
          const vuelo = e.abs - tiro.t;
          if (vuelo < 0 || vuelo > LIM.vuelo) return mal("una bala que tardó " + vuelo + " cs en la " + donde);
          tiro.usos++;
          c.aciertos++;
        }
        const af = !!(tiro && tiro.af);
        switch (l) {
          case "S": case "T": {
            if (est.muerto) return mal("un tiro con el fanal apagado en la " + donde);
            if (ultimoTiro !== null && e.abs - ultimoTiro < enfriar) return mal("dos tiros a " + (e.abs - ultimoTiro) + " cs en la " + donde + " (el fanal espera " + Math.round(arm.cool * 100) + ")");
            ultimoTiro = e.abs;
            c.disparos++;
            if (l === "T") {
              if (pulsos && !cercaDePulso(pulsos, e.abs * 10 - lat, LIM.ventana)) return mal("un tiro afinado lejos de todo pulso en la " + donde);
            } else est.notas = Math.floor(est.notas / 4) * 4;
            tiros.push({ t: e.abs, af: l === "T", usos: 0 });
            break;
          }
          case "A": case "B": case "C": {
            if (!oleada) return tipoMal(l);
            const t = TIPO[l];
            if (e.abs < LIM.entrada) return mal("una polilla apagada antes de llegar a la formación en la " + donde);
            c.kills[t]++; c.aBala++; c.ultimaKill = e.abs;
            if (af) est.notas++;
            c.falta += Math.max(0, vida(t) - danoMax(af));             // lo que tuvieron que quitarle los roces de antes
            suma(M.puntosPolilla(acto, t, mult(), af, vuelta));
            break;
          }
          case "N":
            if (!(vidaMax > danoMin(af))) return tipoMal(l);
            c.N++; c.danoN += danoMax(af);
            break;
          case "G": case "H": case "I": case "J": case "K": case "L": {
            if (!oleada || est.muerto) return tipoMal(l);
            const t = TIPO[l], destello = "GHI".includes(l);
            if (e.abs < LIM.entrada) return mal("una polilla apagada antes de llegar a la formación en la " + donde);
            if (destello && !(previo && e.d === 0 && "dGHI".includes(previo.c))) return mal("polillas apagadas sin destello en la " + donde);
            if (!destello && (!(j.picada > 0) || (t === "a" && acto < 2))) return mal("una picada que esta jornada no tiene en la " + donde);
            c.kills[t]++; c.ultimaKill = e.abs;
            suma(M.puntosPolilla(acto, t, mult(), false, vuelta));
            break;
          }
          case "O":
            if (jefe !== "nodriza" && jefe !== "crisalida" && jefe !== "sol") return tipoMal(l);
            if (af) est.notas++;
            suma(10 * mult());
            break;
          case "Q":
            if (!lumbre) return tipoMal(l);
            c.Q++; suma(5);
            break;
          case "R":
            if (!alba) return tipoMal(l);
            if (af) est.notas++;
            suma(25 * mult());
            break;
          case "V":
            // Las espinas de la fase 3 las tiene cualquier jefe menos el Alba.
            if (jefe !== "faro" && jefe !== "hoguera" && !(jefe && !alba && fase >= 3)) return tipoMal(l);
            if (af) est.notas++;
            suma(15 * mult());
            break;
          case "X":
            if (!jefe || alba || c.jefeMuere >= 0) return tipoMal(l);
            if (e.abs < LIM.jefeEntra) return mal("un golpe al jefe mientras se presentaba en la " + donde);
            if (af) est.notas++;
            c.dano += danoMax(af);
            suma(5 * mult());
            break;
          case "Z":
            if (!alba) return tipoMal(l);
            c.Z++;
            break;
          case "M":
            if (!(oleada || lumbre) || c.msj >= (j.mensajeras || 0)) return tipoMal(l);
            suma(M.valorMensajera(prueba.id, x.n, c.msj++));
            break;
          case "g":
            if (est.muerto) return tipoMal(l);
            est.llamas--; est.notas = 0; c.golpes++;
            if (est.llamas <= 0) est.muerto = true;
            break;
          case "j":
            if (!jefe || alba || c.jefeMuere >= 0) return tipoMal(l);
            if (c.dano < M.vidaJefe(j)) return mal("el jefe murió con " + c.dano + " de " + M.vidaJefe(j) + " de daño en la " + donde);
            c.jefeMuere = e.abs;
            suma(M.PUNTOS_JEFE[j.jefe] * (vuelta ? 1 + 0.25 * vuelta : 1));
            break;
          case "f":
            if (!alba || est.muerto || c.cruce >= 0) return tipoMal(l);
            if (e.abs < LIM.alba) return mal("el Alba llegó en " + (e.abs / 100).toFixed(1) + " s (tarda un minuto)");
            c.cruce = e.abs; fin = true;                                // después del cruce ya no pasa nada en esta jornada
            suma(M.PUNTOS_JEFE.alba + (c.Z === 0 ? 5000 : 0));
            break;
          case "q":
            if (!lumbre) return tipoMal(l);
            c.q++;
            break;
          default:                                                      // los poderes
            if (!(oleada || lumbre) || est.muerto) return tipoMal(l);
            if (l === "p") ultimas[ultimas.length - 1].p = true;
            if (l === "l") ultimas[ultimas.length - 1].l = true;
            if (l === "a") est.llamas = Math.min(topeLlamas, est.llamas + 1);
        }
        previo = e;
      }

      // Lo que un tiro puede tocar: cada bala, una cosa más las que atraviesa
      // (y, si atraviesa, la Mensajera de paso). El patrón del arma dice
      // cuántas balas salen, el pabilo suma una y la Antorcha dos chispas a
      // los tiros afinados. Con la lente, o afinado con el Faro, atraviesa
      // todo y no se cuenta.
      const pabilo = ultimas.some(u => u.p), lente = ultimas.some(u => u.l);
      const balasTiro = af => arm.patron.length + (pabilo ? 1 : 0) + (af && arm.chispas ? 2 : 0);
      const toques = af => { const p = af ? arm.perfA : arm.perfN; return 1 + p + (p > 0 ? 1 : 0); };
      if (!lente) for (const t of tiros) if (!(t.af && arm.rayo) && t.usos > balasTiro(t.af) * toques(t.af)) return mal("una bala tocó " + t.usos + " cosas en la " + donde);
      for (const t of ["a", "b", "c"]) if (c.kills[t] > cupo[t]) return mal("más polillas " + t + " que las de la formación en la " + donde);
      if (c.falta > c.danoN) return mal("polillas que aguantan más de un golpe apagadas sin los golpes de antes en la " + donde);
      if (c.Q + c.q > 24) return mal("más de 24 lumbres en la " + donde);
      if ((x.f === "m") !== est.muerto) return mal(est.muerto ? "el fanal se apagó pero la jornada no terminó ahí (" + donde + ")" : "la " + donde + " dice que el fanal se apagó y no");
      if (alba && x.f === "c" && c.cruce < 0) return mal("el Alba no se completa sino cruzándola");
      if (x.f === "c") {
        if (oleada) {
          for (const t of ["a", "b", "c"]) if (c.kills[t] !== cupo[t]) return mal("la " + donde + " terminó sin apagar toda la formación");
          const entra = (j.cols - 1) * 6 + (j.filas.length - 1) * 12 + 110 - 10;
          if (c.ultimaKill < entra) return mal("la formación de la " + donde + " cayó antes de terminar de entrar");
          if (x.t < c.ultimaKill + LIM.trasOleada) return mal("la " + donde + " se cerró antes de tiempo");
        }
        if (jefe && !alba && c.jefeMuere < 0) return mal("la " + donde + " terminó con el jefe vivo");
        if (jefe && !alba && x.t < c.jefeMuere + LIM.trasJefe) return mal("la " + donde + " se cerró antes de tiempo");
        // El ritmo humano (ver LIM). Un arma más grande apaga más por tiro:
        // la cuenta por polilla se divide por lo que puede tocar un tiro sin
        // afinar. El jefe, además, no cae antes de lo que permiten sus golpes.
        // Sin mejoras cuenta lo que toca un tiro sin afinar (lo de siempre);
        // con mejoras, lo más que toca cualquier tiro: un abanico afinado que
        // atraviesa una columna apilada apaga varias de un golpe, y una
        // persona con el arma crecida lo hace de verdad (un bot de Chromium
        // jugando el juego real lo mostró: 48 polillas en 3,5 s).
        const sinMejoras = M.LISTA_MEJORAS.every(k => !taller.mej[k]);
        const potencia = sinMejoras ? balasTiro(false) * (1 + arm.perfN) : Math.max(balasTiro(false) * (1 + arm.perfN), balasTiro(true) * (1 + (arm.rayo ? 4 : arm.perfA)));
        const vidaJ = jefe && !alba ? M.vidaJefe(j) : 0;
        const golpesJ = Math.ceil(vidaJ / Math.max(1, balasTiro(true) * arm.danoA));
        const minimo = oleada ? LIM.oleadaBase + (lente ? 0 : (Math.max(3, LIM.porPolilla / potencia) * c.aBala + Math.max(2, LIM.porRoce / potencia) * c.N))
          : jefe ? (alba ? 0 : Math.max(LIM.jefeMin, LIM.jefeEntra + golpesJ * enfriar)) : LIM.lumbreMin;
        if (x.t < minimo) return mal("la " + donde + " duró " + (x.t / 100).toFixed(1) + " s: ninguna persona la termina en menos de " + (minimo / 100).toFixed(0) + " s");
        if (lumbre && c.Q + c.q !== 24) return mal("la " + donde + " terminó con lumbres en el aire");
        if (!lumbre && !alba) suma(M.bonusJornada({ acto: j.acto, sinDanio: c.golpes === 0, disparos: c.disparos, aciertos: c.aciertos }).total);
        completadas = Math.max(completadas, x.n);
        if (x.n >= M.JORNADA_ALBA) completa = true;
        if (jefe) taller.brasas++;                                      // solo vencer a un jefe da una brasa
      }
      if (Math.round(est.puntos) !== x.s) return mal("los puntos de la " + donde + " no salen de sus eventos (dice " + x.s + ", dan " + Math.round(est.puntos) + ")");
      if (est.llamas !== x.v) return mal("las llamas de la " + donde + " no salen de sus eventos");
    }
    const hechas = J.filter(x => x.f === "c" && M.jornada(x.n).jefe !== "alba");
    if (hechas.length >= LIM.mediaDesde) {
      const media = hechas.reduce((s, x) => s + x.t, 0) / hechas.length;
      if (media < LIM.mediaMin) return mal(hechas.length + " jornadas a " + (media / 100).toFixed(1) + " s cada una: ninguna persona juega a ese ritmo");
    }
    // La primera parte entera (hasta el Alba) no baja de tres minutos de juego.
    if (completa) {
      const total = J.filter(x => x.n <= M.JORNADA_ALBA).reduce((s, x) => s + x.t, 0);
      if (total < LIM.travesiaMin) return mal("una travesía entera en " + (total / 100).toFixed(0) + " s (la más rápida posible pasa de " + LIM.travesiaMin / 100 + ")");
    }
    return { puntos: Math.round(est.puntos), completadas, completa, tiempo, muerto: est.muerto, jornadas: J.length, llamas: est.llamas, mej: taller.mej, brasas: taller.brasas, notas: est.notas };
  }

  return { VERSION, LIM, PRUEBA_MAX, nueva, abre, evento, disparo, latencia, pulso, cierra, ajusta, rehace, leeEventos, leePulsos };
});
