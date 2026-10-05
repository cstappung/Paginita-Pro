/* FANAL — la música: un motor procedural que compone mientras juegas.

   Qué hace, en general:
   - Cada acto tiene su ESCALA (pélog, frigia dominante, menor húngara,
     lidia aumentada; sléndro en el sin fin), su MÉTRICA irregular (7/8,
     5/4, 11/8, 9/8, 13/8) y su timbre. Las escalas se guardan en cents y
     no en semitonos: el pélog y el sléndro no caben en un piano, y las
     escalas «de piano» llevan además una desafinación microtonal leve
     por nota, como un instrumento de verdad.
   - Un TRANSPORTE cuenta corcheas en el reloj del juego (no en el del
     audio): así los pulsos existen aunque el sonido esté apagado, y el
     juego puede juzgar si un disparo cayó afinado, mover la formación al
     compás y hacer latir la llama con los mismos pulsos que suenan.
   - Las CAPAS se encienden y apagan solas según lo que pasa: el dron
     (siempre, es la soledad), el LATIDO (el bajo de cuatro notas que baja,
     como el del original, y que se acelera y se ensucia cuando quedan
     pocas polillas), las campanas en polirritmia (3 contra 7, 4 contra 11,
     4 contra 9), la percusión con su gong de ciclo, la melodía, el colchón
     de tensión cuando el peligro sube y el LEITMOTIV de cada jefe, que se
     transforma según su vida (se transpone, se fragmenta, se vuelve
     lamento).
   - Un golpe recibido DISTORSIONA la música medio segundo: la satura, le
     cierra el filtro y la dobla hacia abajo con un solo nodo de afinación
     que comparten todas las notas.
   - Los EFECTOS se afinan en la escala del acto: el disparo suena más
     agudo cuanto más a la derecha está el fanal (moverse es tocar una
     melodía) y cada polilla apagada en cadena sube un grado.

   Por qué así: la música de la página es chiptune (juegos/audio/chip.js);
   aquí se buscó lo contrario. Campanas FM con «ombak» (dos portadoras
   separadas unos hercios, el batido del gamelan), pulsos con ancho
   modulado y filtrados, ruido con forma, reverb larga. La teoría (escalas,
   compases, transformaciones del motivo, capas según intensidad) es pura
   y se comprueba en Node (colabtex/tests/fanal.test.cjs); el motor de
   audio solo existe en el navegador. UMD: `FanalMusica`. */
(function (raiz, fabrica) {
  // En Node (tests) se exporta como módulo CommonJS.
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  // En el navegador queda colgado de window.FanalMusica.
  else raiz.FanalMusica = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ================================================================
     Teoría (pura)
     ================================================================ */

  /* Las escalas, en cents desde la tónica. `grados` son los que usa la
     melodía generativa (el pélog «bem» deja fuera dos de los siete, como
     hace el gamelan); `tempera` dice si es de piano (y se desafina un poco
     a propósito) o si ya trae su propia afinación. */
  const ESCALAS = {
    pelog: { nombre: "pélog", cents: [0, 120, 258, 539, 675, 785, 943], grados: [0, 1, 2, 4, 5], tempera: false },
    slendro: { nombre: "sléndro", cents: [0, 231, 474, 717, 955], grados: [0, 1, 2, 3, 4], tempera: false },
    frigiaDom: { nombre: "frigia dominante", cents: [0, 100, 400, 500, 700, 800, 1000], grados: [0, 1, 2, 3, 4, 5, 6], tempera: true },
    hungara: { nombre: "menor húngara", cents: [0, 200, 300, 600, 700, 800, 1100], grados: [0, 1, 2, 3, 4, 5, 6], tempera: true },
    tonos: { nombre: "tonos enteros", cents: [0, 200, 400, 600, 800, 1000], grados: [0, 1, 2, 3, 4, 5], tempera: true },
    lidiaAum: { nombre: "lidia aumentada", cents: [0, 200, 400, 600, 800, 900, 1100], grados: [0, 1, 2, 3, 4, 5, 6], tempera: true }
  };

  /* Las métricas, como grupos de corcheas: cada grupo empieza en un PULSO
     (donde cae el latido y donde un disparo cuenta como afinado). El 5/4
     se cuenta en negras y se acentúa 3+2; el 7/4 es el compás lento de la
     portada. */
  const METRICAS = {
    "7/8": { grupos: [2, 2, 3] },
    "5/4": { grupos: [2, 2, 2, 2, 2], acentos: [0, 3] },
    "11/8": { grupos: [3, 3, 3, 2] },
    "9/8": { grupos: [2, 2, 2, 3] },
    "13/8": { grupos: [3, 2, 3, 2, 3] },
    "7/4": { grupos: [2, 2, 2, 2, 2, 2, 2], acentos: [0, 2, 4] }
  };

  /* El mapa de un compás: cuántas corcheas tiene, en cuáles empieza un
     pulso y qué tan fuerte es cada corchea (2 = la primera del compás,
     1 = comienzo de pulso acentuado, 0.5 = pulso sin acento, 0 = el resto). */
  function mapaCompas(nombre) {
    const m = METRICAS[nombre] || METRICAS["7/8"];
    const largo = m.grupos.reduce((s, g) => s + g, 0);
    const nivel = new Array(largo).fill(0), pulsos = [];
    let t = 0;
    m.grupos.forEach((g, i) => {
      pulsos.push(t);                                                   // aquí empieza un pulso
      const acento = m.acentos ? m.acentos.includes(i) : true;          // sin lista, todo pulso se acentúa
      nivel[t] = i === 0 ? 2 : acento ? 1 : 0.5;
      t += g;
    });
    return { nombre, largo, pulsos, nivel, grupos: m.grupos.slice() };
  }

  /* La frecuencia de un grado de la escala. Los grados negativos o más
     allá del largo bajan o suben de octava: el grado 7 de una escala de
     siete es la tónica una octava arriba. */
  function frecuencia(raizHz, escala, grado, octava, cents) {
    const c = (ESCALAS[escala] || ESCALAS.pelog).cents, n = c.length;
    const o = Math.floor(grado / n), i = ((grado % n) + n) % n;          // octava extra y grado dentro de ella
    return raizHz * Math.pow(2, (octava || 0) + o + (c[i] + (cents || 0)) / 1200);
  }

  /* El grado de la escala que mejor hace de quinta (para el dron): el más
     cercano a 702 cents. En la de tonos enteros cae en la aumentada. */
  function gradoQuinta(escala) {
    const c = ESCALAS[escala].cents;
    let mejor = 0;
    c.forEach((v, i) => { if (Math.abs(v - 702) < Math.abs(c[mejor] - 702)) mejor = i; });
    return mejor;
  }

  /* Las etapas de la música: una por acto, más la portada. `epm` son
     corcheas por minuto; `poli`, cada cuántas corcheas suenan las campanas
     (contra el largo del compás forma la polirritmia); `ratio` es la
     relación del modulador FM (lo que hace que una campana suene a bronce,
     a vidrio o a hierro); `reverb`, los segundos de cola. */
  const ETAPAS = {
    titulo: { escala: "pelog", raiz: 146.83, metrica: "7/4", epm: 150, poli: 4, ratio: 1.4, reverb: 3.4, ombak: 3.5 },
    1: { escala: "pelog", raiz: 146.83, metrica: "7/8", epm: 300, poli: 3, ratio: 1.4, reverb: 2.6, ombak: 4.5 },
    2: { escala: "frigiaDom", raiz: 164.81, metrica: "5/4", epm: 264, poli: 3, ratio: 2.76, reverb: 3.6, ombak: 2.5 },
    3: { escala: "hungara", raiz: 110.0, metrica: "11/8", epm: 288, poli: 4, ratio: 3.5, reverb: 5.0, ombak: 1.6 },
    4: { escala: "lidiaAum", raiz: 130.81, metrica: "9/8", epm: 240, poli: 4, ratio: 2.0, reverb: 3.2, ombak: 1.2 },
    5: { escala: "slendro", raiz: 98.0, metrica: "13/8", epm: 300, poli: 4, ratio: 1.4, reverb: 3.8, ombak: 5 }
  };
  /* El sin fin rota de escala y compás cada jornada, para que la travesía
     que no termina tampoco suene siempre igual. */
  const ROTACION_SINFIN = [
    { escala: "slendro", raiz: 98.0, metrica: "13/8", ratio: 1.4 },
    { escala: "pelog", raiz: 110.0, metrica: "7/8", ratio: 1.4 },
    { escala: "hungara", raiz: 123.47, metrica: "11/8", ratio: 3.5 },
    { escala: "frigiaDom", raiz: 92.5, metrica: "5/4", ratio: 2.76 },
    { escala: "tonos", raiz: 103.83, metrica: "9/8", ratio: 2.0 }
  ];
  function etapaSinFin(n) {
    const r = ROTACION_SINFIN[((n % ROTACION_SINFIN.length) + ROTACION_SINFIN.length) % ROTACION_SINFIN.length];
    return Object.assign({}, ETAPAS[5], r);
  }

  /* Los motivos: listas de [grado, corcheas]; un grado null es silencio.
     Cada uno ocupa dos compases exactos de la métrica de su acto. */
  const MOTIVOS = {
    // El tema del fanal (dos compases de 9/8): sube, duda y vuelve.
    fanal: [[0, 2], [2, 2], [4, 2], [3, 3], [1, 2], [2, 2], [0, 5]],
    // La Nodriza (dos de 7/8): la canción de una madre que cuenta sus crías.
    nodriza: [[0, 2], [2, 2], [3, 3], [4, 2], [3, 2], [2, 1], [0, 2]],
    // El Faro (dos de 5/4): un suspiro frigio, el semitono que no se resuelve.
    faro: [[0, 4], [1, 2], [2, 4], [1, 2], [0, 4], [-1, 2], [0, 2]],
    // La Esfinge (dos de 11/8): sube por la cuarta aumentada húngara.
    esfinge: [[0, 3], [3, 3], [4, 2], [3, 1], [5, 3], [4, 3], [6, 2], [7, 5]]
  };

  /* Cuántas corcheas dura un motivo. */
  const largoMotivo = m => m.reduce((s, n) => s + n[1], 0);
  /* Transformaciones clásicas de un motivo (las que usa el leitmotiv). */
  const transpone = (m, k) => m.map(([g, d]) => [g == null ? null : g + k, d]);
  const invierte = (m, eje) => m.map(([g, d]) => [g == null ? null : 2 * (eje || 0) - g, d]);   // espejo: lo que subía, baja
  const retrograda = m => m.slice().reverse();
  const aumenta = (m, f) => m.map(([g, d]) => [g, Math.max(1, Math.round(d * f))]);
  /* Fragmenta: repite el comienzo y deja el final colgando, como quien no
     termina la frase. Conserva el largo total para no romper el compás. */
  function fragmenta(m, n) {
    const total = largoMotivo(m), cabeza = m.slice(0, n || 3), out = [];
    let t = 0;
    while (t < total) {
      for (const [g, d] of cabeza) { if (t >= total) break; const dd = Math.min(d, total - t); out.push([g, dd]); t += dd; }
    }
    return out;
  }
  /* El Faro ciego tartamudea: cada nota se parte en golpes de una corchea
     con silencios entre medio. */
  const tartamudea = m => m.flatMap(([g, d]) => Array.from({ length: d }, (_, i) => [i % 2 === 0 ? g : null, 1]));

  /* La fase del leitmotiv según la vida del jefe (1 llena, 0 vacía). */
  function faseDeVida(v) {
    return v > 0.66 ? 0 : v > 0.33 ? 1 : 2;
  }

  /* El leitmotiv de un jefe en una fase: el mismo material contado tres
     veces. La Nodriza se acelera y se rompe; el Faro se dobla en cuartas y
     después tartamudea, ciego; la Esfinge, al final, se vuelve lamento: el
     doble de lento y una octava abajo. */
  function leitmotiv(jefe, fase) {
    if (jefe === "alba") return invierte(MOTIVOS.fanal, 0);   // el Alba canta tu tema al revés: es tu reflejo
    const m = MOTIVOS[jefe];
    if (!m) return [];
    if (jefe === "nodriza") return fase === 0 ? m : fase === 1 ? transpone(m, 1) : fragmenta(transpone(m, 2), 3);
    if (jefe === "faro") return fase === 0 ? m : fase === 1 ? m : tartamudea(m);
    if (jefe === "esfinge") return fase === 0 ? m : fase === 1 ? retrograda(m) : transpone(aumenta(m, 2), -7);
    return m;
  }

  /* Cuánto suena cada capa, según el estado del juego. Es la parte
     «adaptativa» y es pura: entra un estado, salen ganancias entre 0 y 1.
     - modo: titulo | juego | transito | revelacion | final | silencio | apagado
     - tension: 0 con la formación entera, 1 cuando queda la última polilla
     - peligro: 0 tranquilo, 1 con escamas encima o la formación abajo
     - jefe: nombre del jefe o null */
  function capas(est) {
    const modo = est.modo || "juego", t = clamp(est.tension || 0), p = clamp(est.peligro || 0), jefe = !!est.jefe;
    const c = { dron: 0, latido: 0, campanas: 0, percusion: 0, melodia: 0, tensionPad: 0, leitmotiv: 0, viento: 0 };
    if (modo === "silencio") return c;                                     // los silencios también se componen
    if (modo === "titulo") return Object.assign(c, { dron: 0.6, campanas: 0.35, viento: 0.5 });
    if (modo === "transito") return Object.assign(c, { dron: 0.7, campanas: 0.25, viento: 0.6 });
    if (modo === "revelacion") return Object.assign(c, { dron: 0.5, viento: 0.3 });
    if (modo === "final") return Object.assign(c, { dron: 0.8, campanas: 0.4, viento: 0.2 });
    if (modo === "apagado") return Object.assign(c, { dron: 0.4, viento: 0.7 });
    // En juego: el latido siempre; el resto crece con la tensión.
    c.dron = 0.25;
    c.viento = 0.15;
    c.latido = 0.75 + 0.25 * t;
    c.campanas = 0.45 + 0.4 * t;
    c.percusion = 0.35 + 0.65 * t;
    c.tensionPad = Math.max(0, p - 0.25) / 0.75;                           // solo cuando el peligro es real
    if (jefe) { c.leitmotiv = 1; c.melodia = 0; }                          // el jefe trae su propia melodía
    else c.melodia = t < 0.25 ? 0 : (t - 0.25) / 0.75;                     // la melodía entra a mitad de oleada
    return c;
  }
  const clamp = v => Math.max(0, Math.min(1, v));

  /* Un generador con semilla para las figuras de campana de cada etapa. */
  function azar(semilla) {
    let s = semilla >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  /* La figura de campanas de una etapa: ocho grados que se repiten, como un
     kotekan. Siempre la misma para la misma escala (semilla fija). */
  function figuraCampanas(escala) {
    const g = ESCALAS[escala].grados, n = ESCALAS[escala].cents.length, tope = g.length * 2 - 1;
    // Se prueban semillas seguidas hasta que la figura use al menos cuatro
    // grados distintos: una figura de dos notas no es una figura.
    for (let intento = 0; intento < 50; intento++) {
      const r = azar(escala.length * 7919 + escala.charCodeAt(0) * 31 + intento), out = [];
      let pos = g.length;                                          // empieza a media altura
      for (let i = 0; i < 8; i++) {
        // Pasos cortos (un grado arriba o abajo) con algún salto de dos.
        const paso = (r() < 0.25 ? 2 : 1) * (r() < 0.5 ? 1 : -1);
        pos += paso;
        if (pos < 0) pos = -pos;                                   // rebota en el piso…
        if (pos > tope) pos = 2 * tope - pos;                      // …y en el techo
        // El índice recorre dos octavas de los grados: la segunda vuelta suma una octava.
        out.push(g[pos % g.length] + (pos >= g.length ? n : 0));
      }
      if (new Set(out).size >= 4) return out;
    }
    return g.slice(0, 4).concat(g.slice(0, 4));                    // nunca debería llegar aquí
  }

  /* ================================================================
     El motor de audio (solo en el navegador)
     ================================================================ */
  const LOOKAHEAD = 0.14;   // cuánto se programa por adelantado (s de juego)

  function crearMotor() {
    let ctx = null;               // el AudioContext, que nace con el primer gesto
    let maestro, musica, efectos, limpio, sucio, filtro, compresor, curvaBend, envio, reverb, eco, ecoVuelta;
    let dron = null, viento = null, colchon = null;   // capas continuas (nodos que viven siempre)
    let ruido = null;             // un segundo de ruido blanco, compartido
    let silenciado = false, volMusica = 0.8, volEfectos = 0.9, medidor = null;
    let voces = 0;                // notas sonando (para no saturar)

    // --- Estado musical ---
    let etapa = Object.assign({}, ETAPAS.titulo), etapaPendiente = null;
    let mapa = mapaCompas(etapa.metrica), figura = figuraCampanas(etapa.escala);
    let est = { modo: "titulo", tension: 0, peligro: 0, jefe: null, vida: 1, latido: 1 };
    let ganancia = capas(est);    // ganancias objetivo de cada capa
    let g = Object.assign({}, ganancia); // ganancias suavizadas (lo que suena)

    // --- Transporte ---
    let tAhora = 0;               // el instante de juego de la última llamada a avanza()
    let tick = 0, tickSig = 0;    // corchea dentro del compás y el instante en que suena la siguiente
    let compas = 0, pulsoN = 0;   // compases y pulsos contados desde el arranque
    let pasoLatido = 0, pasoCampana = 0, pasoMotivo = 0, motivoT = 0; // posiciones de cada figura
    const pulsos = [];            // pulsos programados: {t, nivel, n}
    let callado = 0;              // compases de silencio que quedan (lo oscuro calla de a ratos)

    /* Crea el contexto y la cadena de mezcla. Se llama desde un gesto del
       jugador (un clic o una tecla), que es lo único que los navegadores
       aceptan para dejar sonar algo. */
    function iniciar() {
      if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
      const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      ctx = new AC();
      // Maestro: compresor suave para que nada reviente.
      compresor = ctx.createDynamicsCompressor();
      compresor.threshold.value = -16; compresor.knee.value = 12; compresor.ratio.value = 3.5;
      compresor.attack.value = 0.005; compresor.release.value = 0.25;
      maestro = ctx.createGain(); maestro.gain.value = silenciado ? 0 : 1.25;
      const corteBajo = ctx.createBiquadFilter(); corteBajo.type = "highpass"; corteBajo.frequency.value = 28; // fuera el DC de los pulsos
      compresor.connect(corteBajo); corteBajo.connect(maestro); maestro.connect(ctx.destination);
      // Un medidor a la salida (no suena): sirve para comprobar que nada sature.
      medidor = ctx.createAnalyser(); medidor.fftSize = 2048; maestro.connect(medidor);
      // Música: un camino limpio y uno saturado que se cruzan al recibir un golpe.
      musica = ctx.createGain(); musica.gain.value = volMusica;
      limpio = ctx.createGain(); limpio.gain.value = 1;
      sucio = ctx.createGain(); sucio.gain.value = 0;
      const saturador = ctx.createWaveShaper(); saturador.curve = curvaSaturacion(); saturador.oversample = "2x";
      filtro = ctx.createBiquadFilter(); filtro.type = "lowpass"; filtro.frequency.value = 18000; filtro.Q.value = 0.7;
      musica.connect(limpio); musica.connect(saturador); saturador.connect(sucio);
      limpio.connect(filtro); sucio.connect(filtro); filtro.connect(compresor);
      // Efectos: aparte, para que el golpe no los ensucie (lo que se distorsiona es la música).
      efectos = ctx.createGain(); efectos.gain.value = volEfectos; efectos.connect(compresor);
      // Reverb y eco, como envíos.
      envio = ctx.createGain(); envio.gain.value = 0.5;
      reverb = ctx.createConvolver(); reverb.buffer = respuesta(etapa.reverb);
      envio.connect(reverb); reverb.connect(musica);
      eco = ctx.createDelay(2); eco.delayTime.value = 0.4;
      ecoVuelta = ctx.createGain(); ecoVuelta.gain.value = 0.28;
      const ecoFiltro = ctx.createBiquadFilter(); ecoFiltro.type = "lowpass"; ecoFiltro.frequency.value = 2400;
      eco.connect(ecoFiltro); ecoFiltro.connect(ecoVuelta); ecoVuelta.connect(eco); ecoFiltro.connect(envio);
      // La afinación compartida: todas las notas cuelgan su detune de aquí.
      curvaBend = ctx.createConstantSource(); curvaBend.offset.value = 0; curvaBend.start();
      // Un segundo de ruido blanco para la percusión, el viento y los efectos.
      ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      crearContinuas();
      return true;
    }
    const listo = () => ctx && ctx.state === "running";

    /* La curva de saturación del camino sucio: un recorte duro con escalones
       (algo de «bitcrush»), que es como suena una música golpeada. */
    function curvaSaturacion() {
      const n = 2048, c = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        const y = Math.tanh(x * 6);                    // saturación fuerte
        c[i] = Math.round(y * 6) / 6;                  // y escalonada
      }
      return c;
    }

    /* La respuesta al impulso de la reverb: ruido estéreo que se apaga en
       `seg` segundos. Más larga en lo oscuro: el vacío devuelve tarde. */
    function respuesta(seg) {
      const sr = ctx.sampleRate, n = Math.floor(sr * seg), b = ctx.createBuffer(2, n, sr);
      for (let canal = 0; canal < 2; canal++) {
        const d = b.getChannelData(canal);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
      }
      return b;
    }

    /* Las capas que suenan siempre (dron, viento, colchón de tensión): se
       crean una vez y se reafinan al cambiar de etapa. */
    function crearContinuas() {
      // Dron: tónica y quinta en pulsos anchos que respiran, muy filtrados.
      dron = { salida: ctx.createGain(), filtro: ctx.createBiquadFilter(), voces: [] };
      dron.salida.gain.value = 0; dron.filtro.type = "lowpass"; dron.filtro.frequency.value = 420; dron.filtro.Q.value = 2;
      dron.filtro.connect(dron.salida); dron.salida.connect(musica); dron.salida.connect(envio);
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator(); o.type = i === 2 ? "sine" : "sawtooth";
        const v = ctx.createGain(); v.gain.value = i === 2 ? 0.28 : 0.16;
        o.connect(v); v.connect(dron.filtro); curvaBend.connect(o.detune); o.start();
        dron.voces.push(o);
      }
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;   // el filtro del dron respira despacio
      const lfoG = ctx.createGain(); lfoG.gain.value = 180; lfo.connect(lfoG); lfoG.connect(dron.filtro.frequency); lfo.start();
      // Viento: ruido por un pasabanda que se mueve solo.
      viento = { salida: ctx.createGain(), filtro: ctx.createBiquadFilter() };
      const src = ctx.createBufferSource(); src.buffer = ruido; src.loop = true;
      viento.filtro.type = "bandpass"; viento.filtro.frequency.value = 600; viento.filtro.Q.value = 1.4;
      viento.salida.gain.value = 0;
      src.connect(viento.filtro); viento.filtro.connect(viento.salida); viento.salida.connect(musica); viento.salida.connect(envio);
      const lfoV = ctx.createOscillator(); lfoV.frequency.value = 0.11;
      const lfoVG = ctx.createGain(); lfoVG.gain.value = 380; lfoV.connect(lfoVG); lfoVG.connect(viento.filtro.frequency); lfoV.start();
      src.start();
      // Colchón de tensión: un racimo (tónica, segunda menor, tritono) de sierras desafinadas.
      colchon = { salida: ctx.createGain(), filtro: ctx.createBiquadFilter(), voces: [] };
      colchon.salida.gain.value = 0; colchon.filtro.type = "lowpass"; colchon.filtro.frequency.value = 900; colchon.filtro.Q.value = 4;
      colchon.filtro.connect(colchon.salida); colchon.salida.connect(musica); colchon.salida.connect(envio);
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator(); o.type = "sawtooth"; o.detune.value = (i - 1) * 9;
        const v = ctx.createGain(); v.gain.value = 0.08;
        o.connect(v); v.connect(colchon.filtro); curvaBend.connect(o.detune); o.start();
        colchon.voces.push(o);
      }
      afinaContinuas(0);
    }

    /* Lleva las capas continuas a la tónica de la etapa, en `seg` segundos
       (un deslizamiento lento cuando cambia el acto). */
    function afinaContinuas(seg) {
      if (!dron) return;
      const t = ctx.currentTime, s = Math.max(0.01, seg);
      const raizBaja = etapa.raiz / 2, quinta = frecuencia(raizBaja, etapa.escala, gradoQuinta(etapa.escala));
      // Tónica, quinta y la tónica una octava arriba en seno (nada por debajo
      // de ~70 Hz: un subgrave que no se oye en un parlante chico solo roba volumen).
      [raizBaja, quinta, raizBaja * 2].forEach((f, i) => dron.voces[i].frequency.setTargetAtTime(f, t, s / 3));
      // El racimo de tensión: tónica, una segunda menor (100 cents) y un tritono (600) arriba.
      [0, 100, 600].forEach((c, i) => colchon.voces[i].frequency.setTargetAtTime(etapa.raiz * Math.pow(2, c / 1200), t, s / 3));
    }

    /* ---------- Las voces (una nota = unos pocos nodos efímeros) ---------- */

    /* Convierte un instante del juego en uno del audio. */
    const aAudio = tj => Math.max(ctx.currentTime + 0.005, ctx.currentTime + (tj - tAhora) + 0.03);

    /* Desafinación microtonal leve para las escalas de piano: cada nota
       queda unos cents corrida, como un instrumento que nadie afinó. */
    const humano = () => (ESCALAS[etapa.escala].tempera ? (Math.random() * 2 - 1) * 7 : 0);

    /* Una campana FM con ombak: dos portadoras separadas `ombak` Hz (el
       batido del gamelan), cada una con su modulador a `ratio`. */
    function campana(t, f, dur, vol, opc) {
      if (!listo() || voces > 56 || vol <= 0.001) return;
      opc = opc || {};
      const ratio = opc.ratio || etapa.ratio, ombak = opc.ombak != null ? opc.ombak : etapa.ombak;
      const indice = opc.indice || 2.4, destino = opc.destino || musica;
      const amp = ctx.createGain(), pan = ctx.createStereoPanner();
      pan.pan.value = opc.pan || 0;
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(vol, t + 0.004);
      amp.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      amp.connect(pan); pan.connect(destino);
      if (opc.envio !== false) { const s = ctx.createGain(); s.gain.value = opc.envio || 0.45; pan.connect(s); s.connect(envio); if (opc.eco) s.connect(eco); }
      const det = humano();
      for (const fc of [f - ombak / 2, f + ombak / 2]) {
        const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
        car.frequency.value = fc; mod.frequency.value = fc * ratio;
        car.detune.value = det; curvaBend.connect(car.detune);
        mg.gain.setValueAtTime(fc * indice, t);
        mg.gain.exponentialRampToValueAtTime(fc * indice * 0.04 + 0.01, t + Math.min(dur, opc.brillo || 0.35));
        mod.connect(mg); mg.connect(car.frequency);
        const media = ctx.createGain(); media.gain.value = 0.5;
        car.connect(media); media.connect(amp);
        car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
      }
      voces++; setTimeout(() => voces--, (t - ctx.currentTime + dur) * 1000 + 60);
    }

    /* Un pulso con ancho modulado: dos sierras, una restada a la otra con un
       retardo (el ancho). Moviendo el retardo con un LFO se mueve el ancho:
       eso es la PWM, y es lo que le da al bajo su pecho que respira. */
    function pulso(t, f, dur, vol, opc) {
      if (!listo() || voces > 56 || vol <= 0.001) return;
      opc = opc || {};
      const ancho = opc.ancho || 0.3, destino = opc.destino || musica;
      const s1 = ctx.createOscillator(), s2 = ctx.createOscillator();
      s1.type = s2.type = "sawtooth";
      s1.frequency.value = s2.frequency.value = f;
      const det = humano() + (opc.det || 0);
      s1.detune.value = s2.detune.value = det;
      curvaBend.connect(s1.detune); curvaBend.connect(s2.detune);
      if (opc.desliza) { s1.frequency.setValueAtTime(f * opc.desliza, t); s1.frequency.exponentialRampToValueAtTime(f, t + 0.08); s2.frequency.setValueAtTime(f * opc.desliza, t); s2.frequency.exponentialRampToValueAtTime(f, t + 0.08); }
      const ret = ctx.createDelay(0.05); ret.delayTime.value = ancho / f;
      const inv = ctx.createGain(); inv.gain.value = -1;
      const mezcla = ctx.createGain(); mezcla.gain.value = 0.5;
      s1.connect(mezcla); s2.connect(ret); ret.connect(inv); inv.connect(mezcla);
      let lfo = null;
      if (opc.pwm) {                                                    // el ancho que respira
        lfo = ctx.createOscillator(); lfo.frequency.value = opc.pwm;
        const lg = ctx.createGain(); lg.gain.value = (ancho * 0.6) / f;
        lfo.connect(lg); lg.connect(ret.delayTime); lfo.start(t); lfo.stop(t + dur + 0.1);
      }
      if (opc.vibrato) {                                                // vibrato que entra tarde, como el de una voz
        const vib = ctx.createOscillator(), vg = ctx.createGain();
        vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(opc.vibrato, t + 0.18);
        vib.connect(vg); vg.connect(s1.detune); vg.connect(s2.detune); vib.start(t); vib.stop(t + dur + 0.1);
      }
      const fil = ctx.createBiquadFilter(); fil.type = opc.tipoFiltro || "lowpass";
      fil.frequency.setValueAtTime(opc.corte || 1200, t); fil.Q.value = opc.q || 1;
      if (opc.barrido) fil.frequency.exponentialRampToValueAtTime(Math.max(60, (opc.corte || 1200) * opc.barrido), t + dur);
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(vol, t + (opc.ataque || 0.006));
      amp.gain.setTargetAtTime(vol * (opc.sostiene || 0.5), t + (opc.ataque || 0.006), dur * 0.3);
      amp.gain.setTargetAtTime(0.0001, t + dur * 0.8, dur * 0.12 + 0.02);
      mezcla.connect(fil); fil.connect(amp);
      const pan = ctx.createStereoPanner(); pan.pan.value = opc.pan || 0;
      amp.connect(pan); pan.connect(destino);
      if (opc.envio) { const s = ctx.createGain(); s.gain.value = opc.envio; pan.connect(s); s.connect(envio); if (opc.eco) s.connect(eco); }
      s1.start(t); s2.start(t); s1.stop(t + dur + 0.2); s2.stop(t + dur + 0.2);
      voces++; setTimeout(() => voces--, (t - ctx.currentTime + dur) * 1000 + 220);
    }

    /* Un seno simple con caída de tono: el parche grave (kendang) y los
       golpes graves de los efectos. */
    function golpeGrave(t, f0, f1, dur, vol, destino) {
      if (!listo() || vol <= 0.001) return;
      const o = ctx.createOscillator(), a = ctx.createGain();
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * 0.7);
      a.gain.setValueAtTime(vol, t); a.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(a); a.connect(destino || musica); o.start(t); o.stop(t + dur + 0.05);
    }

    /* Un soplo de ruido por un filtro: platillos, roce, polvo de ala. */
    function soplo(t, dur, vol, frec, q, tipo, destino, barrido) {
      if (!listo() || vol <= 0.001) return;
      const s = ctx.createBufferSource(); s.buffer = ruido;
      const f = ctx.createBiquadFilter(); f.type = tipo || "bandpass"; f.frequency.setValueAtTime(frec, t); f.Q.value = q || 1;
      if (barrido) f.frequency.exponentialRampToValueAtTime(Math.max(40, frec * barrido), t + dur);
      const a = ctx.createGain(); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur / 4));
      a.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f); f.connect(a); a.connect(destino || musica);
      s.start(t, Math.random() * 0.8, dur + 0.05);
    }

    /* ---------- El compositor: qué suena en cada corchea ---------- */

    /* Programa la corchea `k` del compás en el instante de juego `tj`. */
    function programaTick(tj, k) {
      const nivel = mapa.nivel[k], esPulso = nivel > 0;
      if (esPulso) {                                                     // el juego también quiere enterarse
        pulsos.push({ t: tj, nivel, n: pulsoN++ });
        if (pulsos.length > 24) pulsos.splice(0, pulsos.length - 24);
      }
      if (!listo()) return;                                              // sin audio, solo se cuenta
      const t = aAudio(tj), dt = 60 / epmEfectivo();
      const R = etapa.raiz, E = etapa.escala, n = ESCALAS[E].cents.length;
      const enSilencio = callado > 0;

      // LATIDO: el bajo de cuatro notas que baja, uno por pulso.
      if (esPulso && g.latido > 0.01 && !enSilencio) {
        const figuraBajo = [3, 2, 1, 0];
        const grado = figuraBajo[pasoLatido++ % 4];
        const f = frecuencia(R / 2, E, grado);
        const sucioL = Math.max(0, est.tension - 0.45) / 0.55;          // la tensión ensucia el latido
        pulso(t, f, dt * 1.6, 0.42 * g.latido * (nivel === 2 ? 1 : 0.85), {
          ancho: 0.22, pwm: 0.6 + est.tension * 2, corte: 360 + 1100 * est.tension, q: 4 + 6 * est.tension, barrido: 0.5, sostiene: 0.3
        });
        if (sucioL > 0) pulso(t, f * Math.pow(2, (est.tension > 0.8 ? 600 : 100) / 1200), dt * 1.2, 0.16 * sucioL * g.latido, { ancho: 0.12, corte: 900, q: 3, barrido: 0.6 });
      }

      // PERCUSIÓN: parche grave en el uno, golpes en los pulsos, roce en las corcheas.
      if (g.percusion > 0.01 && !enSilencio) {
        if (nivel === 2) golpeGrave(t, 150, 48, 0.32, 0.5 * g.percusion);
        else if (nivel >= 1 && est.tension > 0.2) golpeGrave(t, 120, 60, 0.18, 0.22 * g.percusion);
        const roce = etapa.metrica === "5/4" ? 2600 : 6500;               // en la niebla, un roce más opaco
        soplo(t, 0.03 + (nivel > 0 ? 0.02 : 0), (nivel > 0 ? 0.07 : 0.04) * g.percusion, roce, 0.8, "highpass");
        if (est.tension > 0.6) soplo(t + dt / 2, 0.025, 0.035 * g.percusion, roce * 1.2, 0.8, "highpass"); // semicorcheas cuando aprieta
        // El gong cierra el ciclo cada cuatro compases, como en un gongan.
        if (k === 0 && compas % 4 === 0) campana(t, R / 2, 4.5, 0.22 * Math.max(g.percusion, g.dron), { ratio: 1.4, indice: 1.2, ombak: 2, envio: 0.6 });
      }

      // CAMPANAS en polirritmia: cada `poli` corcheas, contra el largo del compás.
      const absoluto = compas * mapa.largo + k;                          // corchea contada desde el arranque
      if (g.campanas > 0.01 && absoluto % etapa.poli === 0 && !enSilencio) {
        const grado = figura[pasoCampana++ % figura.length];
        const lado = pasoCampana % 2 ? -0.45 : 0.45;                    // las dos voces del kotekan, a cada lado
        campana(t, frecuencia(R * 2, E, grado), 1.4 + (est.modo === "transito" ? 1.4 : 0), 0.26 * g.campanas, { pan: lado, eco: etapa.metrica !== "7/8" });
        // Con tensión, la segunda voz entrelaza una nota más arriba en la corchea siguiente.
        if (est.tension > 0.45 && est.modo === "juego") campana(t + dt, frecuencia(R * 2, E, grado + 2), 0.9, 0.15 * g.campanas, { pan: -lado });
      }
      // En el alba, unas campanitas de vidrio en 4 contra 9 (o lo que toque).
      if (est.modo === "juego" && etapa.escala === "lidiaAum" && absoluto % 2 === 1 && g.campanas > 0.01) {
        campana(t, frecuencia(R * 4, E, (absoluto * 3) % n), 0.6, 0.06 * g.campanas, { ratio: 3, indice: 0.8, pan: Math.sin(absoluto) * 0.7 });
      }

      // MELODÍA o LEITMOTIV: una frase por cada dos compases.
      if (k === 0 && compas % 2 === 0) { motivoT = 0; pasoMotivo = 0; }
      // La frase siempre dura dos compases de la métrica que suena (el jefe del
      // sin fin puede volver con un compás que no es el suyo).
      const linea = est.jefe ? ajusta(leitmotiv(est.jefe, faseDeVida(est.vida)), mapa.largo * 2) : melodiaDeEtapa();
      const gl = est.jefe ? g.leitmotiv : g.melodia;
      if (gl > 0.01 && linea.length && !enSilencio) {
        // ¿Empieza una nota de la frase en esta corchea?
        let acum = 0;
        for (let i = 0; i < linea.length; i++) {
          if (acum === motivoT && linea[i][0] != null) tocaNota(t, linea[i][0], linea[i][1] * dt, gl, i);
          acum += linea[i][1];
        }
        motivoT++;
      }

      // Lo oscuro calla de a ratos: un compás entero de silencio al azar.
      if (k === mapa.largo - 1) {
        if (callado > 0) callado--;
        else if (etapa.escala === "hungara" && est.modo === "juego" && !est.jefe && Math.random() < 0.12) callado = 1;
      }
    }

    /* La melodía generativa de cada acto (sin jefe): el tema del fanal
       transformado según el compás, para que todo el juego hable el mismo
       idioma aunque cambie de escala. */
    function melodiaDeEtapa() {
      const largo = mapa.largo * 2, base = MOTIVOS.fanal;
      // Se ajusta el motivo al largo de dos compases de esta métrica.
      const m = ajusta(compas % 8 < 4 ? base : compas % 8 < 6 ? transpone(base, 2) : retrograda(base), largo);
      return m;
    }
    /* Estira o recorta un motivo para que dure exactamente `largo` corcheas. */
    function ajusta(m, largo) {
      const total = largoMotivo(m);
      if (total === largo) return m;
      const out = []; let t = 0;
      for (const [gr, d] of m) {
        let dd = Math.max(1, Math.round(d * largo / total));
        if (t + dd > largo) dd = largo - t;
        if (dd <= 0) break;
        out.push([gr, dd]); t += dd;
      }
      if (t < largo && out.length) out[out.length - 1][1] += largo - t;
      return out;
    }

    /* Toca una nota de la melodía o del leitmotiv con el timbre que le toca. */
    function tocaNota(t, grado, dur, vol, i) {
      const R = etapa.raiz, E = etapa.escala, j = est.jefe;
      const f = frecuencia(R * 2, E, grado);
      if (j === "nodriza") {                                            // bronce de bonang, doblado una octava abajo
        campana(t, f, dur * 2.2, 0.28 * vol, { ratio: 1.4, indice: 3, ombak: 5, pan: 0.1 });
        pulso(t, f / 2, dur, 0.11 * vol, { ancho: 0.4, corte: 900, pwm: 1.2 });
        if (faseDeVida(est.vida) >= 1) campana(t, f * 2, dur, 0.06 * vol, { ratio: 2.76, indice: 1.5 }); // la cría chilla
      } else if (j === "faro") {                                        // caña nasal en la niebla, doblada en cuartas
        pulso(t, f, dur, 0.22 * vol, { ancho: 0.12, tipoFiltro: "bandpass", corte: 1300, q: 2.2, vibrato: 14, ataque: 0.04, sostiene: 0.8, envio: 0.5, eco: true });
        if (faseDeVida(est.vida) === 1) pulso(t, frecuencia(R * 2, E, grado + 3), dur, 0.08 * vol, { ancho: 0.12, tipoFiltro: "bandpass", corte: 1300, q: 2.2, ataque: 0.04, sostiene: 0.8 });
      } else if (j === "esfinge") {                                     // hierro grave y un seno debajo; al final, lamento
        const lamento = faseDeVida(est.vida) === 2;
        campana(t, f / (lamento ? 1 : 2), dur * 2.5, 0.3 * vol, { ratio: 3.5, indice: lamento ? 1.2 : 2.6, ombak: 1.2 });
        golpeGrave(t, f / 4, f / 4.2, dur * 1.5, 0.16 * vol);
        if (lamento && i % 2 === 0) pulso(t + dur * 0.5, f * Math.pow(2, -100 / 1200), dur * 0.5, 0.05 * vol, { ancho: 0.35, corte: 700, ataque: 0.05 }); // el suspiro
      } else if (j === "alba") {                                        // vidrio: FM armónica, pura
        campana(t, f, dur * 3, 0.22 * vol, { ratio: 2, indice: 1.1, ombak: 0.8, envio: 0.7 });
        if (est.cerca > 0.4) campana(t, frecuencia(R * 2, E, -grado), dur * 3, 0.1 * vol * est.cerca, { ratio: 2, indice: 1.1, ombak: 0.8, pan: -0.3 }); // tu tema, al derecho, se le suma
      } else {                                                          // melodía de etapa: una voz de pulso filtrada con vibrato
        const fil = etapa.escala === "lidiaAum" ? null : 1500;
        if (!fil) campana(t, f, dur * 2.5, 0.2 * vol, { ratio: 1, indice: 0.9, ombak: 0.6 });
        else pulso(t, f, dur, 0.16 * vol, { ancho: 0.33, pwm: 3, corte: fil, q: 1.5, vibrato: 10, ataque: 0.02, sostiene: 0.7, envio: 0.4, eco: etapa.metrica !== "7/8", desliza: 0.97 });
      }
    }

    /* Las corcheas por minuto que mandan ahora: las de la etapa por el
       latido (que trae el juego: más rápido con pocas polillas), más
       lentas en el tránsito y en la revelación. */
    function epmEfectivo() {
      const lento = est.modo === "transito" ? 0.62 : est.modo === "revelacion" || est.modo === "final" || est.modo === "apagado" ? 0.45 : est.modo === "titulo" ? 1 : 1;
      return etapa.epm * (est.modo === "juego" ? est.latido || 1 : 1) * lento;
    }

    /* Suaviza las ganancias hacia sus objetivos y las aplica a las capas
       continuas. Se llama en cada avance. */
    function suaviza(dt) {
      const k = 1 - Math.exp(-dt / 0.6);                                 // constante de 0,6 s
      for (const nombre in ganancia) g[nombre] += (ganancia[nombre] - g[nombre]) * k;
      if (!listo()) return;
      const t = ctx.currentTime;
      dron.salida.gain.setTargetAtTime(0.2 * g.dron, t, 0.1);
      viento.salida.gain.setTargetAtTime(0.08 * g.viento, t, 0.1);
      colchon.salida.gain.setTargetAtTime(0.24 * g.tensionPad, t, 0.1);
      colchon.filtro.frequency.setTargetAtTime(500 + 2600 * g.tensionPad, t, 0.2);
    }

    /* Avanza el transporte hasta el instante de juego `tj` (más el margen)
       y programa todo lo que caiga en ese tramo. */
    function avanza(tj, dt) {
      tAhora = tj;
      if (tickSig < tj - 1) tickSig = tj;                               // si el juego saltó, no se recupera el pasado
      suaviza(dt || 0.016);
      let guardia = 0;
      while (tickSig < tj + LOOKAHEAD && guardia++ < 64) {
        if (tick === 0 && etapaPendiente) aplicaEtapa();                // los cambios de etapa esperan al uno
        programaTick(tickSig, tick);
        tickSig += 60 / epmEfectivo();
        tick++;
        if (tick >= mapa.largo) { tick = 0; compas++; }
      }
    }

    /* Aplica una etapa nueva (al empezar un compás). */
    function aplicaEtapa() {
      const nueva = etapaPendiente; etapaPendiente = null;
      const cambiaReverb = !etapa || nueva.reverb !== etapa.reverb;
      etapa = nueva;
      mapa = mapaCompas(etapa.metrica);
      figura = figuraCampanas(etapa.escala);
      pasoLatido = 0; pasoCampana = 0; compas = 0;
      if (ctx) {
        afinaContinuas(2.5);
        if (cambiaReverb && reverb) reverb.buffer = respuesta(etapa.reverb);
        if (eco) eco.delayTime.setTargetAtTime((60 / etapa.epm) * 3, ctx.currentTime, 0.5); // eco de negra con puntillo
      }
    }

    /* ---------- Lo que el juego le dice a la música ---------- */

    /* Cambia de etapa: "titulo", 1..4, o {sinfin: n}. `ya` la aplica en el
       acto (después de un silencio no hace falta esperar al uno). */
    function ponEtapa(cual, ya) {
      const e = typeof cual === "object" && cual && cual.sinfin != null ? etapaSinFin(cual.sinfin) : Object.assign({}, ETAPAS[cual] || ETAPAS[1]);
      etapaPendiente = e;
      if (ya) { tick = 0; aplicaEtapa(); }
    }

    /* El estado del juego que mueve las capas. */
    function estado(nuevo) {
      Object.assign(est, nuevo);
      ganancia = capas(est);
    }

    /* El pulso anterior y el siguiente a un instante (para juzgar un
       disparo). El siguiente puede no estar programado todavía: se estima. */
    function pulsoCercano(tj) {
      let previo = null, siguiente = null;
      for (const p of pulsos) {
        if (p.t <= tj) previo = p.t;
        else if (siguiente == null) siguiente = p.t;
      }
      return { previo, siguiente };
    }
    /* Los pulsos programados después del número `n` (para la prueba de la
       partida, ver prueba.js: un tiro afinado tiene que caer cerca de uno
       de estos, y por eso se anotan todos). */
    const pulsosDesde = n => pulsos.filter(p => p.n > n).map(p => ({ t: p.t, n: p.n }));
    /* Los pulsos ya ocurridos desde la última vez (para el dibujo). */
    let ultimoEntregado = -1;
    function consumePulsos(tj) {
      const out = [];
      for (const p of pulsos) if (p.n > ultimoEntregado && p.t <= tj) { out.push(p); ultimoEntregado = p.n; }
      return out;
    }
    /* La fracción del camino entre el pulso anterior y el siguiente (0..1),
       para el metrónomo. */
    function fase(tj) {
      const { previo, siguiente } = pulsoCercano(tj);
      if (previo == null || siguiente == null) return 0;
      return (tj - previo) / Math.max(0.001, siguiente - previo);
    }
    /* El compás en curso, para dibujar el metrónomo: largo, pulsos y en qué
       corchea va. */
    const compasActual = () => ({ largo: mapa.largo, pulsos: mapa.pulsos, nivel: mapa.nivel, tick, metrica: etapa.metrica, escala: ESCALAS[etapa.escala].nombre });

    /* El golpe: la música se satura, se oscurece y se dobla hacia abajo. */
    function herida(fuerza) {
      if (!listo()) return;
      const t = ctx.currentTime, f = fuerza || 1;
      sucio.gain.cancelScheduledValues(t); limpio.gain.cancelScheduledValues(t); filtro.frequency.cancelScheduledValues(t); curvaBend.offset.cancelScheduledValues(t);
      sucio.gain.setValueAtTime(0.75 * f, t); sucio.gain.setTargetAtTime(0, t + 0.08, 0.18);
      limpio.gain.setValueAtTime(0.35, t); limpio.gain.setTargetAtTime(1, t + 0.1, 0.2);
      filtro.frequency.setValueAtTime(700, t); filtro.frequency.setTargetAtTime(18000, t + 0.12, 0.25);
      curvaBend.offset.setValueAtTime(-90 * f, t); curvaBend.offset.setTargetAtTime(0, t + 0.06, 0.22);
    }

    /* Silencio total por un rato (los momentos narrativos). */
    function enmudece(seg) {
      estado({ modo: "silencio" });
      if (!listo()) return;
      const t = ctx.currentTime;
      musica.gain.cancelScheduledValues(t);
      musica.gain.setTargetAtTime(0.0001, t, 0.25);
      musica.gain.setTargetAtTime(volMusica, t + seg, 0.6);
    }

    function silenciar(si) {
      silenciado = !!si;
      if (maestro) maestro.gain.setTargetAtTime(silenciado ? 0 : 1.25, ctx.currentTime, 0.05);
    }
    function volumenes(m, e) {
      if (m != null) volMusica = m; if (e != null) volEfectos = e;
      if (musica) musica.gain.setTargetAtTime(volMusica, ctx.currentTime, 0.05);
      if (efectos) efectos.gain.setTargetAtTime(volEfectos, ctx.currentTime, 0.05);
    }
    /* Baja la música mientras está en pausa (los efectos siguen). */
    function pausa(si) {
      if (!listo()) return;
      musica.gain.setTargetAtTime(si ? volMusica * 0.18 : volMusica, ctx.currentTime, 0.15);
    }

    /* ---------- Efectos afinados ---------- */
    const ahora = () => (ctx ? ctx.currentTime + 0.005 : 0);
    const efecto = (fn) => { if (listo()) fn(ahora()); };
    /* El grado que toca el fanal según dónde está: de la tónica, a la
       izquierda, a dos octavas arriba, a la derecha. */
    const gradoDeX = x => Math.round((Math.max(0, Math.min(240, x)) / 240) * (ESCALAS[etapa.escala].cents.length * 2 - 1));

    const sfx = {
      disparo(x, afinado) {
        efecto(t => {
          const f = frecuencia(etapa.raiz * 2, etapa.escala, gradoDeX(x));
          pulso(t, f, 0.07, afinado ? 0.1 : 0.07, { destino: efectos, ancho: 0.18, corte: 3200, barrido: 0.4, desliza: 1.12, pan: (x - 120) / 160 });
          if (afinado) campana(t, f * 2, 0.7, 0.11, { destino: efectos, ratio: 3, indice: 1.4, envio: 0.35, pan: (x - 120) / 160 });
        });
      },
      /* Una polilla apagada: una nota de campana que sube con la cadena. */
      muerte(x, cadena, grande) {
        efecto(t => {
          const n = ESCALAS[etapa.escala].cents.length;
          const f = frecuencia(etapa.raiz * 2, etapa.escala, (cadena || 0) % (n * 2));
          campana(t, f, grande ? 1.6 : 0.9, grande ? 0.22 : 0.15, { destino: efectos, indice: 2, envio: 0.4, pan: (x - 120) / 160 });
          soplo(t, 0.09, 0.09, 2800, 1.2, "bandpass", efectos, 0.4);     // el polvo de las alas
        });
      },
      roce(x) { efecto(t => soplo(t, 0.04, 0.06, 4200, 2, "bandpass", efectos)); },   // golpe que no apaga
      escudo() { efecto(t => soplo(t, 0.03, 0.025, 1800, 3, "bandpass", efectos)); },
      jefeGolpe() { efecto(t => campana(t, frecuencia(etapa.raiz * 4, etapa.escala, 0), 0.25, 0.08, { destino: efectos, ratio: 3.5, indice: 3, envio: 0.15 })); },
      danio() {
        herida(1);
        efecto(t => {
          campana(t, etapa.raiz / 2, 2.4, 0.3, { destino: efectos, ratio: 1.4, indice: 3.5, ombak: 6 });
          soplo(t, 0.35, 0.22, 900, 0.8, "lowpass", efectos, 0.3);
        });
      },
      /* El fanal se apaga: la escala entera cae, campana tras campana. */
      apagado() {
        efecto(t => {
          const n = ESCALAS[etapa.escala].cents.length;
          for (let i = 0; i < n * 2; i++) campana(t + i * 0.11, frecuencia(etapa.raiz * 2, etapa.escala, n * 2 - i), 1.4, 0.1 * (1 - i / (n * 2.5)), { destino: efectos, ratio: etapa.ratio, indice: 1.6 });
          soplo(t, 1.6, 0.12, 600, 0.7, "lowpass", efectos, 0.2);
        });
      },
      /* Un poder: dos voces que se entrelazan subiendo (kotekan). */
      poder() {
        efecto(t => {
          const gr = ESCALAS[etapa.escala].grados;
          for (let i = 0; i < 6; i++) campana(t + i * 0.055, frecuencia(etapa.raiz * 2, etapa.escala, gr[i % gr.length] + (i >= gr.length ? ESCALAS[etapa.escala].cents.length : 0)), 0.6, 0.08, { destino: efectos, ratio: 2, indice: 1.6, pan: i % 2 ? 0.4 : -0.4 });
        });
      },
      /* La Mensajera cruza: un silbido que se desliza entre dos notas. */
      mensajera(dur) {
        efecto(t => {
          const o = ctx.createOscillator(), a = ctx.createGain(), p = ctx.createStereoPanner();
          const f1 = frecuencia(etapa.raiz * 4, etapa.escala, 2), f2 = frecuencia(etapa.raiz * 4, etapa.escala, 4);
          o.type = "sine"; o.frequency.setValueAtTime(f1, t);
          for (let i = 1; i < dur / 0.6; i++) o.frequency.setTargetAtTime(i % 2 ? f2 : f1, t + i * 0.6, 0.12);
          a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.025, t + 0.5); a.gain.setValueAtTime(0.025, t + dur - 0.5); a.gain.linearRampToValueAtTime(0, t + dur);
          p.pan.setValueAtTime(-0.8, t); p.pan.linearRampToValueAtTime(0.8, t + dur);
          o.connect(a); a.connect(p); p.connect(efectos); const s = ctx.createGain(); s.gain.value = 0.6; p.connect(s); s.connect(envio);
          o.start(t); o.stop(t + dur + 0.1);
        });
      },
      /* Una carta recuperada: un acorde que se abre despacio. */
      carta() {
        efecto(t => { [0, 2, 4].forEach((gr, i) => campana(t + i * 0.09, frecuencia(etapa.raiz * 2, etapa.escala, gr), 2.6, 0.08, { destino: efectos, ratio: 2, indice: 0.9, envio: 0.7 })); });
      },
      /* El haz del Faro: un barrido de ruido resonante. */
      barrido(dur) { efecto(t => soplo(t, dur, 0.1, 400, 6, "bandpass", efectos, 6)); },
      /* La Esfinge cae en picada / el eclipse. */
      picada() { efecto(t => { soplo(t, 0.7, 0.14, 2400, 3, "bandpass", efectos, 0.15); golpeGrave(t + 0.5, 90, 30, 0.6, 0.3, efectos); }); },
      eclipse() { efecto(t => { golpeGrave(t, 60, 28, 2.2, 0.35, efectos); soplo(t, 2, 0.08, 200, 1, "lowpass", efectos); }); },
      aleteo() { efecto(t => { soplo(t, 0.5, 0.12, 300, 0.7, "lowpass", efectos, 2.5); }); },       // el viento de la Nodriza
      aviso() { efecto(t => campana(t, frecuencia(etapa.raiz * 4, etapa.escala, 1), 0.4, 0.05, { destino: efectos, ratio: 3, indice: 1 })); }, // un ataque se anuncia
      empuje() { efecto(t => { campana(t, frecuencia(etapa.raiz * 4, etapa.escala, 4), 0.8, 0.09, { destino: efectos, ratio: 2, indice: 1 }); campana(t + 0.08, frecuencia(etapa.raiz * 2, etapa.escala, 4), 0.8, 0.07, { destino: efectos, ratio: 2, indice: 1 }); }); },
      /* El cruce con el Alba: todas las notas de la escala a la vez. */
      cruce() {
        efecto(t => {
          const n = ESCALAS[etapa.escala].cents.length;
          for (let i = 0; i < n * 2; i++) campana(t + i * 0.04, frecuencia(etapa.raiz, etapa.escala, i), 7, 0.06, { destino: efectos, ratio: 2, indice: 0.8, ombak: 1, envio: 0.9, pan: (i % 2 ? 1 : -1) * 0.5 });
        });
      },
      /* Un toque de interfaz, afinado como todo lo demás. */
      ui(grado) { efecto(t => campana(t, frecuencia(etapa.raiz * 4, etapa.escala, grado || 0), 0.35, 0.05, { destino: efectos, ratio: 2, indice: 1, envio: 0.2 })); },
      /* Una campana suelta de la escala (para las revelaciones). */
      nota(grado, dur, vol) { efecto(t => campana(t, frecuencia(etapa.raiz * 2, etapa.escala, grado), dur || 3, vol || 0.09, { destino: efectos, ratio: etapa.ratio, indice: 1.2, envio: 0.8 })); }
    };

    /* Pico y RMS de la salida en este instante (para las pruebas). */
    function nivel() {
      if (!medidor) return { pico: 0, rms: 0 };
      const d = new Float32Array(medidor.fftSize); medidor.getFloatTimeDomainData(d);
      let pico = 0, suma = 0;
      for (const v of d) { pico = Math.max(pico, Math.abs(v)); suma += v * v; }
      return { pico, rms: Math.sqrt(suma / d.length), voces };
    }

    return {
      iniciar, listo, avanza, nivel, estado, ponEtapa, pulsoCercano, pulsosDesde, consumePulsos, fase, compasActual,
      herida, enmudece, silenciar, volumenes, pausa, sfx,
      get latencia() { return ctx ? (ctx.outputLatency || ctx.baseLatency || 0.02) : 0; },
      get silenciado() { return silenciado; },
      get etapa() { return etapa; }
    };
  }

  return {
    ESCALAS, METRICAS, ETAPAS, ROTACION_SINFIN, MOTIVOS,
    mapaCompas, frecuencia, gradoQuinta, etapaSinFin, largoMotivo,
    transpone, invierte, retrograda, aumenta, fragmenta, tartamudea, faseDeVida, leitmotiv,
    capas, figuraCampanas, crearMotor
  };
});
