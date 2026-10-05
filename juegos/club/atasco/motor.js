/* Atasco — el motor, puro: el estacionamiento, los movimientos, el
   solucionador y las estrellas. Sin DOM ni almacenamiento, para que cada
   nivel se pueda comprobar desde Node (tests/atasco.test.cjs) y el
   generador (colabtex/scripts/atasco-niveles.js) use exactamente las mismas
   reglas que la pantalla.
   UMD: `AtascoMotor` en la página, `module.exports` en Node.

   Resumen de lo que hace y por qué:
   - Un nivel es un texto de 36 letras, una por casilla del estacionamiento
     de 6×6 leído fila a fila: «o» es una casilla libre, «x» un cono (no se
     mueve nunca) y cada otra letra es un vehículo; la «A» es siempre el auto
     rojo. Texto y no objeto porque así 240 niveles caben en unos 10 KB y se
     pueden leer a ojo en el archivo.
   - El auto rojo va en la fila de la salida (la 3.ª, índice 2) y gana
     cuando su parte delantera toca el borde derecho: ahí está la barrera.
   - Un movimiento es deslizar UN vehículo por su carril, la distancia que
     sea: dos casillas de golpe cuentan como uno. Es la misma cuenta que usa
     el solucionador, así que «el mínimo» que dice la pantalla es de verdad
     el mínimo que el jugador puede hacer.
   - El solucionador es una búsqueda en anchura: visita los estados por
     orden de distancia, así que el primero resuelto que encuentra está a la
     menor cantidad de movimientos posible. En 6×6 los estados alcanzables
     son a lo más unos cientos de miles y se recorren en milisegundos. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();   // Node: lo devuelve a quien lo pide
  else raiz.AtascoMotor = fabrica();                                              // navegador: queda en window.AtascoMotor
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TAM = 6;            // el estacionamiento es de 6×6 casillas
  const FILA_SALIDA = 2;    // la salida está en la 3.ª fila (contando desde 0)
  const ROJO = "A";         // la letra del auto rojo
  const LIBRE = "o";        // casilla vacía
  const CONO = "x";         // cono: ocupa una casilla y no se mueve
  const META = TAM - 2;     // columna en la que el auto rojo (largo 2) toca la salida

  /* ---------- Leer un nivel ----------
     Devuelve los vehículos (con su carril fijo) y la posición inicial de
     cada uno por separado: el carril no cambia nunca, la posición sí. Así
     un «estado» de la partida es solo una lista de números, uno por
     vehículo (la columna si va de lado, la fila si va de pie). */
  function lee(texto) {
    const t = String(texto || "");                                  // por si llega algo raro
    if (t.length !== TAM * TAM) throw new Error("Un nivel tiene 36 casillas, no " + t.length); // forma fija
    const vistos = new Map();                                       // letra → casillas donde aparece
    const conos = [];                                               // casillas con cono
    for (let k = 0; k < t.length; k++) {                            // recorre las 36 casillas
      const ch = t[k];                                              // la letra de esta casilla
      if (ch === LIBRE) continue;                                   // vacía: nada que anotar
      if (ch === CONO) { conos.push(k); continue; }                  // cono: se anota aparte
      if (!/^[A-Z]$/.test(ch)) throw new Error("Letra inválida: " + ch); // solo mayúsculas
      if (!vistos.has(ch)) vistos.set(ch, []);                      // primera vez que aparece
      vistos.get(ch).push(k);                                       // guarda la casilla
    }
    if (!vistos.has(ROJO)) throw new Error("Falta el auto rojo (A)");   // sin auto rojo no hay juego
    const vehiculos = [];                                           // la lista final
    const pos = [];                                                 // posición inicial de cada uno
    // El rojo primero, el resto en orden alfabético: el índice 0 es siempre el rojo.
    const letras = [...vistos.keys()].sort((a, b) => (a === ROJO ? -1 : b === ROJO ? 1 : a < b ? -1 : 1));
    for (const l of letras) {
      const cs = vistos.get(l);                                     // casillas de este vehículo (en orden)
      const largo = cs.length;                                      // 2 = auto, 3 = camión o bus
      if (largo < 2 || largo > 3) throw new Error("El vehículo " + l + " mide " + largo); // tamaños válidos
      const f0 = Math.floor(cs[0] / TAM), c0 = cs[0] % TAM;         // su primera casilla
      const h = cs[1] - cs[0] === 1;                                // contiguas en la fila → va de lado
      for (let i = 1; i < largo; i++)                               // comprueba que sea una pieza recta
        if (cs[i] - cs[i - 1] !== (h ? 1 : TAM) || (h && Math.floor(cs[i] / TAM) !== f0))
          throw new Error("El vehículo " + l + " no es recto");
      if (l === ROJO && (!h || f0 !== FILA_SALIDA || largo !== 2))  // el rojo: de lado, largo 2, en la salida
        throw new Error("El auto rojo debe ir de lado en la fila de la salida");
      vehiculos.push({ l, h, largo, carril: h ? f0 : c0 });         // carril = fila (de lado) o columna (de pie)
      pos.push(h ? c0 : f0);                                        // posición = columna o fila de su cola
    }
    return { vehiculos, conos, pos };
  }

  /* El texto de 36 letras de un estado: lo usan el generador (para
     escribir el nivel) y los tests (para comparar). */
  function texto(nivel, pos) {
    const a = new Array(TAM * TAM).fill(LIBRE);                     // todo libre
    for (const k of nivel.conos) a[k] = CONO;                       // los conos
    nivel.vehiculos.forEach((v, i) => {                             // cada vehículo en su sitio
      for (let j = 0; j < v.largo; j++) a[casilla(v, pos[i], j)] = v.l;
    });
    return a.join("");
  }

  /* La casilla (0..35) del trozo j de un vehículo en la posición p. */
  function casilla(v, p, j) {
    return v.h ? v.carril * TAM + p + j : (p + j) * TAM + v.carril;
  }

  /* La ocupación del estacionamiento: para cada casilla, el índice del
     vehículo que la pisa, -2 si es un cono o -1 si está libre. */
  function ocupacion(nivel, pos) {
    const o = new Int8Array(TAM * TAM).fill(-1);                    // todo libre
    for (const k of nivel.conos) o[k] = -2;                         // conos
    nivel.vehiculos.forEach((v, i) => {
      for (let j = 0; j < v.largo; j++) o[casilla(v, pos[i], j)] = i; // marca cada trozo
    });
    return o;
  }

  /* Hasta dónde puede ir un vehículo en cada sentido: [atrás, adelante],
     en casillas. «Atrás» es hacia la izquierda o hacia arriba. */
  function alcance(nivel, pos, i, occ) {
    const v = nivel.vehiculos[i], p = pos[i];                       // el vehículo y dónde está
    const o = occ || ocupacion(nivel, pos);                         // reutiliza la ocupación si ya existe
    let atras = 0, adelante = 0;
    while (p - atras - 1 >= 0 && o[casilla(v, p - atras - 1, 0)] === -1) atras++;            // retrocede mientras haya hueco
    while (p + v.largo + adelante < TAM && o[casilla(v, p + adelante + 1, v.largo - 1)] === -1) adelante++; // avanza mientras haya hueco
    return [atras, adelante];
  }

  /* ¿Es legal deslizar el vehículo i d casillas (negativo = atrás)? */
  function puede(nivel, pos, i, d) {
    if (!Number.isInteger(i) || i < 0 || i >= nivel.vehiculos.length) return false; // vehículo que no existe
    if (!Number.isInteger(d) || d === 0) return false;              // quedarse quieto no es un movimiento
    const [a, b] = alcance(nivel, pos, i);                          // hasta dónde llega
    return d < 0 ? -d <= a : d <= b;                                // dentro del hueco libre
  }

  /* El estado tras mover (no toca el original: devuelve uno nuevo). */
  function aplica(pos, i, d) {
    const n = pos.slice();                                          // copia
    n[i] += d;                                                      // solo cambia ese vehículo
    return n;
  }

  /* Todos los movimientos legales desde un estado, como [vehículo, d]. */
  function movimientos(nivel, pos) {
    const occ = ocupacion(nivel, pos), lista = [];
    for (let i = 0; i < nivel.vehiculos.length; i++) {
      const [a, b] = alcance(nivel, pos, i, occ);                   // hueco hacia cada lado
      for (let d = 1; d <= a; d++) lista.push([i, -d]);             // cada distancia hacia atrás
      for (let d = 1; d <= b; d++) lista.push([i, d]);              // cada distancia hacia adelante
    }
    return lista;
  }

  /* Ganado: el auto rojo toca la salida con su parte delantera. */
  const resuelto = pos => pos[0] === META;

  /* Un número único por estado (base 6: cada posición va de 0 a 5). Más
     rápido de guardar en un Map que un texto. 6^16 cabe de sobra en los
     enteros exactos de JavaScript, y no hay sitio para más de 16 vehículos. */
  function clave(pos) {
    let k = 0;
    for (let i = 0; i < pos.length; i++) k = k * TAM + pos[i];
    return k;
  }

  /* ---------- El solucionador ----------
     Búsqueda en anchura desde `pos`: devuelve la lista más corta de
     movimientos [vehículo, d] que saca al rojo, [] si ya está fuera, o null
     si no hay salida. `tope` corta la búsqueda si el nivel fuera absurdo. */
  function resuelve(nivel, pos, tope) {
    pos = pos || nivel.pos;                                         // por omisión, desde el principio
    if (resuelto(pos)) return [];                                   // ya está en la salida
    const max = tope || 2000000;                                    // estados como mucho
    const inicio = clave(pos);
    const padre = new Map([[inicio, null]]);                        // de qué estado se llegó y con qué movimiento
    let frente = [pos];                                             // los estados a distancia actual
    while (frente.length) {
      const sig = [];                                               // los de la distancia siguiente
      for (const p of frente) {
        for (const [i, d] of movimientos(nivel, p)) {
          const n = aplica(p, i, d), k = clave(n);
          if (padre.has(k)) continue;                               // ya visitado: más cerca o igual
          padre.set(k, [clave(p), i, d]);                           // recuerda el camino
          if (resuelto(n)) return camino(padre, k);                 // ¡el primero resuelto es el más corto!
          if (padre.size > max) return null;                        // demasiado grande: se rinde
          sig.push(n);
        }
      }
      frente = sig;                                                 // avanza una capa
    }
    return null;                                                    // sin salida
  }
  /* Rehace la lista de movimientos siguiendo los padres hacia atrás. */
  function camino(padre, k) {
    const out = [];
    for (let e = padre.get(k); e; e = padre.get(e[0])) out.push([e[1], e[2]]);
    return out.reverse();
  }

  /* ---------- Estrellas ----------
     3 estrellas: con el mínimo exacto (o menos, que no se puede).
     2 estrellas: hasta un tercio más (y al menos dos de margen, para que
     en los niveles cortos un solo ir y volver no cueste la segunda).
     1 estrella: sacar el auto como sea. */
  function limites(optimo) {
    const o = Math.max(1, optimo | 0);                              // nunca menos de 1
    return { tres: o, dos: o + Math.max(2, Math.ceil(o / 3)) };
  }
  function estrellas(movs, optimo) {
    const l = limites(optimo);
    return movs <= l.tres ? 3 : movs <= l.dos ? 2 : 1;
  }

  /* ---------- El progreso ----------
     Por nivel (su número, desde 0): [estrellas, menos movimientos, mejor
     tiempo en ms]. Dos copias (este navegador y la cuenta) se juntan
     quedándose con lo mejor de cada una, campo a campo: así nunca se pierde
     una estrella por haber jugado en otro dispositivo.
     Junto a eso, `p`: la prueba del mejor intento de cada nivel (ver «La
     prueba», más abajo). `n` es lo que se ve en el edificio; a la
     clasificación solo va lo que `p` puede respaldar. */
  function limpiaN(n0, cuantos) {
    const out = {};                                                 // lo que queda limpio
    const n = n0 && typeof n0 === "object" ? n0 : {};
    for (const [k, v] of Object.entries(n)) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0 || (cuantos && i >= cuantos)) continue; // nivel que no existe
      if (!Array.isArray(v)) continue;
      const e = Math.round(Number(v[0])), m = Math.round(Number(v[1])), t = Math.round(Number(v[2]));
      if (!(e >= 1 && e <= 3) || !(m >= 1 && m < 100000)) continue;  // estrellas 1–3 y movimientos razonables
      out[i] = [e, m, t > 0 && t < 864e5 ? t : 0];                  // el tiempo es opcional
    }
    return out;
  }
  /* Las pruebas guardadas: solo textos con la forma de una prueba y de
     niveles que existen. Si entre todas pasaran de PRUEBAS_MAX_LETRAS se
     sueltan las de los niveles más altos (nunca pasa jugando: los 240
     niveles con ★★★ ocupan unos 55 000), porque el progreso entero viaja
     a la cuenta en un texto de menos de 200 000 y pasarse lo perdería. */
  function limpiaP(p0, cuantos) {
    const p = p0 && typeof p0 === "object" ? p0 : {};
    const ks = [];
    for (const [k, v] of Object.entries(p)) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0 || (cuantos && i >= cuantos) || String(i) !== k) continue;
      if (typeof v !== "string" || !FORMA_PRUEBA.test(v) || cuentaMovidas(v) > PRUEBA_MAX_MOVS) continue;
      ks.push(i);
    }
    ks.sort((a, b) => a - b);
    const out = {};
    let letras = 0;
    for (const i of ks) {
      letras += p[i].length + 12;                                   // + lo que ocupa la clave en el JSON
      if (letras > PRUEBAS_MAX_LETRAS) break;                       // de aquí en adelante no cabe
      out[i] = p[i];
    }
    return out;
  }
  function limpiaProgreso(p, cuantos) {
    const o = p && typeof p === "object" ? p : {};
    return { v: 1, n: limpiaN(o.n, cuantos), p: limpiaP(o.p, cuantos) };
  }
  /* ¿Cuál de dos pruebas del mismo nivel vale más? `califica(i, texto)`
     devuelve [estrellas, ms] o null si no vale; sin ella se mira solo la
     forma (menos movidas, y después menos tiempo), que es lo que se puede
     saber sin el nivel a mano. Gana más estrellas y, a igualdad, menos
     tiempo: lo mismo que ordena la clasificación. */
  const calificaForma = (i, t) => [-cuentaMovidas(t), instanteFinal(t)];
  function mejorDe(i, a, b, califica) {
    if (!a) return b; if (!b || a === b) return a;
    const f = califica || calificaForma;
    const x = f(i, a), y = f(i, b);
    if (!x) return y ? b : a;
    if (!y) return a;
    return y[0] > x[0] || (y[0] === x[0] && y[1] < x[1]) ? b : a;
  }
  function mezclaProgreso(a, b, cuantos, califica) {
    const x = limpiaProgreso(a, cuantos), y = limpiaProgreso(b, cuantos), n = {}, p = {};
    for (const k of new Set([...Object.keys(x.n), ...Object.keys(y.n)])) {
      const u = x.n[k], w = y.n[k];
      if (!u || !w) { n[k] = (u || w).slice(); continue; }          // solo una copia lo tiene
      const t = u[2] && w[2] ? Math.min(u[2], w[2]) : u[2] || w[2]; // el mejor tiempo conocido
      n[k] = [Math.max(u[0], w[0]), Math.min(u[1], w[1]), t];
    }
    for (const k of new Set([...Object.keys(x.p), ...Object.keys(y.p)])) p[k] = mejorDe(Number(k), x.p[k], y.p[k], califica);
    return { v: 1, n, p: limpiaP(p, cuantos) };
  }
  /* Anota un nivel terminado y dice si fue un récord de estrellas. */
  function anota(prog, i, movs, ms, optimo) {
    const p = limpiaProgreso(prog);
    const e = estrellas(movs, optimo), antes = p.n[i];
    const mejora = !antes || e > antes[0];                          // ¿más estrellas que antes?
    const t = Math.max(1, Math.round(ms));
    p.n[i] = antes
      ? [Math.max(antes[0], e), Math.min(antes[1], movs), antes[2] ? Math.min(antes[2], t) : t]
      : [e, movs, t];
    return { prog: p, estrellas: e, mejora };
  }
  /* Guarda la prueba de un intento si es mejor que la que había. */
  function anotaPrueba(prog, i, texto, califica) {
    const p = limpiaProgreso(prog);
    const nueva = mejorDe(i, p.p[i], texto, califica);
    if (nueva === texto && limpiaP({ [i]: texto })[i] === texto) p.p[i] = texto;
    p.p = limpiaP(p.p);
    return p;
  }
  /* Estrellas totales y tiempo total (suma de los mejores tiempos de cada
     nivel con estrellas): lo que se ve en la cabecera. */
  function totales(prog) {
    const n = limpiaN(prog && prog.n);
    let estrellasT = 0, tiempo = 0, niveles = 0;
    for (const v of Object.values(n)) { estrellasT += v[0]; tiempo += v[2] || 0; niveles++; }
    return { estrellas: estrellasT, tiempo, niveles };
  }

  /* Un piso se abre cuando el anterior junta suficientes estrellas: la
     mitad de las que tiene. Así hay que terminar casi todo el piso, pero no
     hace falta sacarle las tres estrellas a cada nivel. */
  function pisoAbierto(prog, paquetes, j) {
    if (j <= 0) return true;                                        // el primero siempre
    const p = { n: limpiaN(prog && prog.n) };
    let ini = 0;
    for (let k = 0; k < j - 1; k++) ini += paquetes[k].niveles.length; // dónde empieza el piso anterior
    const ant = paquetes[j - 1].niveles.length;
    let e = 0;
    for (let k = ini; k < ini + ant; k++) e += p.n[k] ? p.n[k][0] : 0;
    return e >= Math.ceil(ant * 3 / 2) && pisoAbierto(prog, paquetes, j - 1);
  }
  /* Un nivel se puede jugar si es el primero de su piso abierto o si el
     anterior ya salió (con cualquier cantidad de estrellas). */
  function nivelAbierto(prog, paquetes, i) {
    const p = { n: limpiaN(prog && prog.n) };
    let ini = 0;
    for (let j = 0; j < paquetes.length; j++) {
      const n = paquetes[j].niveles.length;
      if (i < ini + n) return pisoAbierto(p, paquetes, j) && (i === ini || !!p.n[i - 1]);
      ini += n;
    }
    return false;
  }

  /* ---------- La prueba (antitrampas) ----------
     El progreso vive en este navegador y en la cuenta, y los dos se pueden
     editar a mano: un número de estrellas suelto no prueba nada. Por eso,
     junto a cada nivel ganado se guarda la partida que lo ganó, y la
     clasificación solo cuenta lo que esa partida respalda: el verificador
     (colabtex/src/juegos/solo/verifica/atasco.js) la vuelve a jugar con
     ESTAS funciones, así que pantalla y verificador nunca discrepan.

     Una prueba es un texto: la reacción y después una ficha por movida.
       «r~» — los ms desde que se abrió el nivel hasta que se soltó la
              primera movida de la partida, en base 36;
       cada movida:
         letra del vehículo (la del nivel: «A» el rojo, «B»…) +
         casilla de destino (0–5: la columna de su cola si va de lado, la
         fila si va de pie) +
         los ms desde la movida anterior, en base 36 (vacío = 0) +
         «.» + lo que duró el gesto en ms (de apretar a soltar; con
         teclado o mando, de tomar a soltar), en base 36 +
         la forma del gesto: «.» puntero (ratón o dedo), «:» teclado, «!»
         mando + cuántos pasos tuvo (pointermove entre apretar y soltar;
         con teclado o mando, las flechas), en base 36 +
         «*» si algún evento del gesto no fue de verdad (isTrusted falso y
         no venía de un mando conectado).
     «5k~K3.2a.6A4k9.1z.4» son dos movidas con el ratón. La primera movida
     cuenta desde que arrancó el reloj del nivel, que arranca con ella:
     casi siempre es 0. Destino y no distancia porque así una ficha dice
     dónde quedó el vehículo, y el instante es el del reloj del juego, que
     se para con la pestaña oculta: el tiempo del nivel es el instante de
     la última. Unas 10 letras por movida: los 240 niveles con ★★★ ocupan
     ~55 000. */
  const PRUEBA_VERSION = 1;
  const PRUEBA_MAX_MOVS = 250;        // más que esto en un nivel no se guarda (es ★, y vuelve a jugarse)
  const PRUEBAS_MAX_LETRAS = 180000;  // todas juntas, con margen bajo los 200 000 de la cuenta y la prueba
  const TIEMPO_MAX = 604800000;       // una semana: el tope del tiempo de la tabla
  /* ---- Lo que una mano puede y no puede hacer (umbrales con margen) ----
     Un falso positivo (rechazar a alguien honesto) es peor que dejar pasar
     una trampa rara: cada umbral está muy por fuera de lo humano, y las
     señales débiles solo cuentan juntas.
     - Entre dos movidas, 40 ms. Una movida es apretar un vehículo,
       arrastrarlo media casilla y soltarlo (o tomar, flecha, soltar), y la
       siguiente no empieza antes de soltar la anterior: un arrastre a la
       vez. Con el instante del evento (no el de cuando se atiende, que con
       un tirón juntaría dos) nadie baja de 80–100 ms.
     - Sostenido: diez movidas seguidas no bajan de 1,2 s (8 por segundo,
       el ritmo de los récords del cubo de Rubik, con dedos entrenados y
       sin tener que apuntar a otra pieza cada vez).
     - Reacción: la primera movida no se suelta antes de 150 ms desde que
       se abrió el nivel. El tiempo de reacción simple ronda 200–250 ms, y
       aquí además hay que llegar al vehículo y arrastrarlo.
     - Gesto instantáneo: menos de 20 ms de apretar a soltar. Solo el clic
       de un ratón ya dura 50–100 ms apretado (lo mismo una tecla: 70–120
       ms en los estudios de dinámica de tecleo). Con tres o más en un
       nivel y siendo la mitad de sus gestos, es un guion.
     - Eventos no verdaderos (isTrusted falso) sin un mando conectado: es
       dispatchEvent desde la consola. El mando (juegos/audio/mando.js)
       despacha teclas sintéticas marcadas `__mando`, y esas valen.
     - Regularidad, con 15 movidas o más: los intervalos de una persona
       varían mucho (pensar, buscar el auto); su coeficiente de variación
       pasa holgado de 0,3 incluso jugando una solución sabida (quien
       marca un compás a propósito con el dedo anda por 0,03–0,05: más
       parejo que eso solo un temporizador). Menos de 0,03 es un
       metrónomo y basta; menos de 0,15 solo cuenta si además
       hay gestos instantáneos o casi todos los arrastres (80 %, con 8 o
       más) llegaron sin pasos intermedios (≤ 1 pointermove). */
  const GAP_MIN = 40;
  const VENTANA = 10, RITMO_MIN = 120;
  const REACCION_MIN = 150;
  const GESTO_MIN = 20;
  const CV_MIN_REGULAR = 15, CV_METRONOMO = 0.03, CV_SOSPECHOSO = 0.15;
  const MAX_DUR = 36 ** 4 - 1, MAX_PASOS = 36 ** 3 - 1;
  const FICHA = "[A-Z][0-5][0-9a-z]{0,6}\\.[0-9a-z]{0,4}[.:!][0-9a-z]{0,3}\\*?";
  const FORMA_PRUEBA = new RegExp("^[0-9a-z]{0,7}~(?:" + FICHA + ")*$");
  const cuentaMovidas = t => { let c = 0; for (let k = 0; k < t.length; k++) { const x = t.charCodeAt(k); if (x >= 65 && x <= 90) c++; } return c; };
  const b36 = s => (s ? parseInt(s, 36) : 0);
  /* {reaccion, fichas: [[letra, destino, instante, duración, forma, pasos, fiable]]} o null */
  function fichas(texto) {
    const cab = /^([0-9a-z]{0,7})~/.exec(texto);
    if (!cab) return null;
    const out = [], re = /([A-Z])([0-5])([0-9a-z]{0,6})\.([0-9a-z]{0,4})([.:!])([0-9a-z]{0,3})(\*?)/y;
    let t = 0, m;
    re.lastIndex = cab[0].length;
    while (re.lastIndex < texto.length && (m = re.exec(texto))) {
      t += b36(m[3]);
      out.push([m[1], +m[2], t, b36(m[4]), m[5], b36(m[6]), !m[7]]);
    }
    return re.lastIndex === texto.length || cab[0].length === texto.length ? { reaccion: b36(cab[1]), fichas: out } : null;
  }
  const instanteFinal = t => { const f = fichas(t); return f && f.fichas.length ? f.fichas[f.fichas.length - 1][2] : 0; };

  /* Escribe la prueba de una partida. `jugadas` es [[vehículo, destino,
     instante en ms, gesto]], en el orden en que quedaron (lo deshecho ya
     fuera); gesto = {d: ms que duró, n: pasos, k: "." | ":" | "!",
     f: false si no fue de verdad}. `reaccion`: ms desde que se abrió el
     nivel hasta soltar la primera. */
  function codificaPrueba(nivel, jugadas, reaccion) {
    let s = Math.max(0, Math.min(36 ** 7 - 1, Math.round(reaccion || 0))).toString(36) + "~", antes = 0;
    for (const [i, dest, t, g0] of jugadas) {
      const g = g0 || {};
      const dt = Math.max(0, Math.round(t) - antes);
      antes += dt;
      const d = Math.max(0, Math.min(MAX_DUR, Math.round(g.d || 0))), n = Math.max(0, Math.min(MAX_PASOS, g.n | 0));
      s += nivel.vehiculos[i].l + dest + (dt ? dt.toString(36) : "") + "." + (d ? d.toString(36) : "") +
        (g.k === ":" || g.k === "!" ? g.k : ".") + (n ? n.toString(36) : "") + (g.f === false ? "*" : "");
    }
    return s;
  }

  /* Vuelve a jugar una prueba: {estrellas, movs, ms} si es una partida
     que de verdad saca al auto rojo a ritmo de mano, o {error} si no.
     `bot: true` marca lo que la partida sí hizo pero no como una persona
     (ritmo, gestos, eventos sintéticos): la pantalla manda igual esas
     pruebas, para que el verificador las rechace y quede el aviso. */
  function juegaPrueba(nivel, optimo, texto) {
    if (typeof texto !== "string" || !texto) return { error: "la prueba está vacía" };
    if (texto.length > 8 + PRUEBA_MAX_MOVS * 20) return { error: "la prueba es demasiado larga" };
    const pr = fichas(texto);
    if (!pr) return { error: "la prueba no se entiende" };
    const fs = pr.fichas;
    if (!fs.length) return { error: "la prueba no tiene movidas" };
    if (fs.length > PRUEBA_MAX_MOVS) return { error: "demasiadas movidas" };
    const indice = new Map(nivel.vehiculos.map((v, i) => [v.l, i]));
    let pos = nivel.pos.slice();
    for (let k = 0; k < fs.length; k++) {
      const [l, dest] = fs[k];
      if (resuelto(pos)) return { error: "sigue moviendo después de salir" };
      const i = indice.get(l);
      if (i === undefined) return { error: "mueve un vehículo que no está en el nivel" };
      if (!puede(nivel, pos, i, dest - pos[i])) return { error: "la movida " + (k + 1) + " es imposible" };
      pos = aplica(pos, i, dest - pos[i]);
    }
    if (!resuelto(pos)) return { error: "el auto rojo no sale" };
    const ms = Math.max(1, fs[fs.length - 1][2]);
    if (ms > TIEMPO_MAX) return { error: "el nivel duró más de una semana" };
    const r = { estrellas: estrellas(fs.length, optimo), movs: fs.length, ms };
    const bot = humano(pr);
    return bot ? Object.assign(r, { error: bot, bot: true }) : r;
  }

  /* null si la partida pudo hacerla una mano; si no, por qué. */
  function humano(pr) {
    const fs = pr.fichas;
    const falsas = fs.filter(f => !f[6]).length;
    if (falsas) return falsas + (falsas === 1 ? " movida hecha" : " movidas hechas") + " con eventos sintéticos, no con la mano";
    if (pr.reaccion < REACCION_MIN) return "la primera movida llegó " + pr.reaccion + " ms después de abrir el nivel";
    for (let k = 1; k < fs.length; k++) {
      const g = fs[k][2] - fs[k - 1][2];
      if (g < GAP_MIN) return "dos movidas a " + g + " ms, más rápido que una mano";
      if (k >= VENTANA && fs[k][2] - fs[k - VENTANA][2] < VENTANA * RITMO_MIN)
        return VENTANA + " movidas en " + (fs[k][2] - fs[k - VENTANA][2]) + " ms, más rápido que una mano";
    }
    const instantaneos = fs.filter(f => f[3] < GESTO_MIN).length;
    if (instantaneos >= 3 && instantaneos * 2 >= fs.length) return instantaneos + " gestos de menos de " + GESTO_MIN + " ms: nadie aprieta y suelta tan rápido";
    if (fs.length >= CV_MIN_REGULAR) {
      const gaps = [];
      for (let k = 1; k < fs.length; k++) gaps.push(fs[k][2] - fs[k - 1][2]);
      const media = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      const cv = media > 0 ? Math.sqrt(gaps.reduce((s, g) => s + (g - media) ** 2, 0) / gaps.length) / media : 0;
      if (cv < CV_METRONOMO) return "movidas a ritmo de metrónomo (variación " + cv.toFixed(3) + ")";
      const punteros = fs.filter(f => f[4] === ".");
      const secos = punteros.filter(f => f[5] <= 1).length;
      if (cv < CV_SOSPECHOSO && (instantaneos > 0 || (punteros.length >= 8 && secos * 5 >= punteros.length * 4)))
        return "ritmo demasiado parejo (variación " + cv.toFixed(3) + ") y arrastres sin recorrido";
    }
    return null;
  }

  /* Lo que las pruebas respaldan: cada una se vuelve a jugar y cuenta solo
     si su nivel estaba abierto según las otras pruebas (nunca según las
     estrellas sin prueba, que son justo las que se pueden escribir a
     mano). Se repite hasta que no cambia: sacar un nivel puede cerrar el
     siguiente, o un piso. Devuelve las estrellas y el tiempo (la suma de
     los ms de cada nivel contado, con los topes de la tabla) y, aparte,
     qué niveles contaron, qué pruebas no valían y por qué (`errores`), y
     cuáles de esas fallaron por no parecer de una persona (`bots`:
     [estrellas, movidas, ms, motivo]). */
  function resumenPruebas(pruebas, paquetes) {
    const lista = [];
    paquetes.forEach(p => p.niveles.forEach(n => lista.push(n)));
    const validas = {}, errores = {}, bots = {};
    const pr = pruebas && typeof pruebas === "object" && !Array.isArray(pruebas) ? pruebas : {};
    for (const [k, t] of Object.entries(pr)) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0 || i >= lista.length || String(i) !== k) { errores[k] = "ese nivel no existe"; continue; }
      let r;
      try { r = juegaPrueba(lee(lista[i][0]), lista[i][1], t); } catch (e) { r = { error: String(e && e.message || e) }; }
      if (r.error) { errores[k] = r.error; if (r.bot) bots[k] = [r.estrellas, r.movs, r.ms, r.error]; } else validas[k] = [r.estrellas, r.movs, r.ms];
    }
    // Lo mismo que nivelAbierto/pisoAbierto, pero contando las estrellas de
    // cada piso una vez por vuelta: con 240 niveles, llamarlas nivel por
    // nivel costaba ~100 ms y esto corre en el teléfono al ganar.
    const piso = [], inicio = [];
    paquetes.forEach((p, j) => { inicio.push(piso.length); p.niveles.forEach(() => piso.push(j)); });
    let cuenta = validas;
    for (;;) {
      const est = paquetes.map(() => 0);
      for (const [k, v] of Object.entries(cuenta)) est[piso[k]] += v[0];
      const pisoOk = [];
      paquetes.forEach((p, j) => { pisoOk[j] = j === 0 || (pisoOk[j - 1] && est[j - 1] >= Math.ceil(paquetes[j - 1].niveles.length * 3 / 2)); });
      const sig = {};
      for (const k of Object.keys(cuenta)) {
        const i = Number(k), j = piso[i];
        if (pisoOk[j] && (i === inicio[j] || cuenta[i - 1])) sig[k] = cuenta[k];
      }
      if (Object.keys(sig).length === Object.keys(cuenta).length) break;
      cuenta = sig;
    }
    let e = 0, t = 0;
    for (const v of Object.values(cuenta)) { e += v[0]; t += v[2]; }
    return { estrellas: e, tiempo: Math.min(TIEMPO_MAX, Math.max(1, t)), contados: cuenta, errores, bots };
  }

  return {
    TAM, FILA_SALIDA, ROJO, LIBRE, CONO, META,
    lee, texto, casilla, ocupacion, alcance, puede, aplica, movimientos, resuelto, clave,
    resuelve, limites, estrellas,
    limpiaProgreso, mezclaProgreso, anota, anotaPrueba, totales, pisoAbierto, nivelAbierto,
    PRUEBA_VERSION, PRUEBA_MAX_MOVS, PRUEBAS_MAX_LETRAS, GAP_MIN, VENTANA, RITMO_MIN, REACCION_MIN, GESTO_MIN,
    codificaPrueba, juegaPrueba, resumenPruebas, cuentaMovidas
  };
});
