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
     una estrella por haber jugado en otro dispositivo. */
  function limpiaProgreso(p, cuantos) {
    const out = {};                                                 // lo que queda limpio
    const n = p && typeof p === "object" && p.n && typeof p.n === "object" ? p.n : {};
    for (const [k, v] of Object.entries(n)) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0 || (cuantos && i >= cuantos)) continue; // nivel que no existe
      if (!Array.isArray(v)) continue;
      const e = Math.round(Number(v[0])), m = Math.round(Number(v[1])), t = Math.round(Number(v[2]));
      if (!(e >= 1 && e <= 3) || !(m >= 1 && m < 100000)) continue;  // estrellas 1–3 y movimientos razonables
      out[i] = [e, m, t > 0 && t < 864e5 ? t : 0];                  // el tiempo es opcional
    }
    return { v: 1, n: out };
  }
  function mezclaProgreso(a, b, cuantos) {
    const x = limpiaProgreso(a, cuantos), y = limpiaProgreso(b, cuantos), n = {};
    for (const k of new Set([...Object.keys(x.n), ...Object.keys(y.n)])) {
      const p = x.n[k], q = y.n[k];
      if (!p || !q) { n[k] = (p || q).slice(); continue; }          // solo una copia lo tiene
      const t = p[2] && q[2] ? Math.min(p[2], q[2]) : p[2] || q[2]; // el mejor tiempo conocido
      n[k] = [Math.max(p[0], q[0]), Math.min(p[1], q[1]), t];
    }
    return { v: 1, n };
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
  /* Estrellas totales y tiempo total (suma de los mejores tiempos de cada
     nivel con estrellas): lo que va a la clasificación. */
  function totales(prog) {
    const p = limpiaProgreso(prog);
    let estrellasT = 0, tiempo = 0, niveles = 0;
    for (const v of Object.values(p.n)) { estrellasT += v[0]; tiempo += v[2] || 0; niveles++; }
    return { estrellas: estrellasT, tiempo, niveles };
  }

  /* Un piso se abre cuando el anterior junta suficientes estrellas: la
     mitad de las que tiene. Así hay que terminar casi todo el piso, pero no
     hace falta sacarle las tres estrellas a cada nivel. */
  function pisoAbierto(prog, paquetes, j) {
    if (j <= 0) return true;                                        // el primero siempre
    const p = limpiaProgreso(prog);
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
    const p = limpiaProgreso(prog);
    let ini = 0;
    for (let j = 0; j < paquetes.length; j++) {
      const n = paquetes[j].niveles.length;
      if (i < ini + n) return pisoAbierto(p, paquetes, j) && (i === ini || !!p.n[i - 1]);
      ini += n;
    }
    return false;
  }

  return {
    TAM, FILA_SALIDA, ROJO, LIBRE, CONO, META,
    lee, texto, casilla, ocupacion, alcance, puede, aplica, movimientos, resuelto, clave,
    resuelve, limites, estrellas,
    limpiaProgreso, mezclaProgreso, anota, totales, pisoAbierto, nivelAbierto
  };
});
