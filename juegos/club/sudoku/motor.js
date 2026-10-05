/* Sudoku Arcade — el motor, puro: reglas, resolvedor, generador,
   calificación por técnicas, fecha de Chile, puntos del arcade y racha.

   Qué hace, en general:
   - Guarda un tablero como un arreglo de 81 enteros (0 = vacío, 1..9 =
     dígito), leído fila a fila: la celda i está en la fila ⌊i/9⌋ y la
     columna i mod 9.
   - `resolver` cuenta soluciones con backtracking sobre máscaras de bits
     (un entero de 9 bits por fila, columna y caja) y la heurística MRV
     (probar primero la celda con menos candidatos). Se detiene al llegar
     al límite: para saber si la solución es única basta con ver si existe
     una segunda.
   - `califica` resuelve «como una persona»: aplica técnicas de la más
     fácil a la más difícil (únicos, intersecciones, pares, tríos, X-Wing,
     XY-Wing, Swordfish) y la dificultad es la de la técnica más difícil
     que hizo falta. No cuenta pistas: más pistas no siempre es más fácil.
   - `generar` llena una cuadrícula al azar, le quita pistas de a pares
     simétricos (rotación de 180°) sin perder la unicidad, la califica y,
     si salió más difícil de lo pedido, le devuelve pistas hasta bajar al
     nivel. Todo con un generador con semilla (mulberry32), nunca con
     Math.random, y con un tope de INTENTOS (no de tiempo): así el sudoku
     del día sale idéntico en todos los navegadores.

   Por qué así: igual que la Sopa (juegos/club/sopa/motor.js), sin DOM ni
   almacenamiento, para poder comprobarlo desde Node
   (colabtex/tests/sudoku.test.cjs). UMD: `SudokuMotor` en la página,
   `module.exports` en Node. */
(function (raiz, fabrica) {
  // En Node (tests) se exporta como módulo CommonJS.
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  // En el navegador queda colgado de window.SudokuMotor.
  else raiz.SudokuMotor = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ================================================================
     Dificultades
     ================================================================ */

  /* Las cuatro dificultades. `pistas` es un rango orientativo: el
     generador intenta quedar dentro, pero lo que manda es la técnica que
     exige el puzzle, no cuántas pistas trae. `nivel` las ordena. */
  const DIFICULTADES = {
    facil: { nombre: "Fácil", nivel: 0, pistas: [36, 40] },     // solo únicos
    medio: { nombre: "Medio", nivel: 1, pistas: [30, 35] },     // + intersecciones y pares desnudos
    dificil: { nombre: "Difícil", nivel: 2, pistas: [26, 31] }, // + pares ocultos y tríos
    experto: { nombre: "Experto", nivel: 3, pistas: [22, 28] }  // + X-Wing, XY-Wing, Swordfish
  };
  // Del número de nivel al nombre interno; el 4 es lo que el resolvedor humano no termina.
  const NOMBRES_NIVEL = ["facil", "medio", "dificil", "experto", "imposible"];

  /* Cuántos puzzles se prueban, como mucho, antes de quedarse con el más
     cercano. Es un tope de intentos y no de tiempo, para que el resultado
     no dependa de lo rápido que sea el equipo. Difícil es el nivel que
     menos sale al azar (lo que exige tríos casi siempre exige también un
     X-Wing), por eso lleva más intentos. Medido en Node: un intento cuesta
     ~1 ms, así que aun gastando los 400 queda bajo 0,5 s (el test exige
     < 1,5 s para experto). */
  const INTENTOS = { facil: 30, medio: 40, dificil: 400, experto: 400 };

  /* Las técnicas que conoce el resolvedor humano, en el orden en que las
     prueba (de la más fácil a la más difícil) y el nivel al que suben el
     puzzle. Los nombres son los que se muestran en pantalla. */
  const TECNICAS = [
    { id: "unico-oculto", nombre: "Único oculto", nivel: 0 },          // un dígito cabe en una sola celda de una unidad
    { id: "unico-desnudo", nombre: "Único desnudo", nivel: 0 },        // a una celda le queda un solo candidato
    { id: "apuntador", nombre: "Par apuntador", nivel: 1 },            // en una caja el dígito está en una sola línea
    { id: "reduccion", nombre: "Reducción caja/línea", nivel: 1 },     // en una línea el dígito está en una sola caja
    { id: "par-desnudo", nombre: "Par desnudo", nivel: 1 },            // dos celdas con los mismos dos candidatos
    { id: "par-oculto", nombre: "Par oculto", nivel: 2 },              // dos dígitos que solo caben en las mismas dos celdas
    { id: "trio-desnudo", nombre: "Trío desnudo", nivel: 2 },          // tres celdas que juntas tienen tres candidatos
    { id: "trio-oculto", nombre: "Trío oculto", nivel: 2 },            // tres dígitos encerrados en tres celdas
    { id: "x-wing", nombre: "X-Wing", nivel: 3 },                      // rectángulo de un dígito en dos filas/columnas
    { id: "xy-wing", nombre: "XY-Wing", nivel: 3 },                    // pivote y dos pinzas de dos candidatos
    { id: "swordfish", nombre: "Swordfish", nivel: 3 }                 // como X-Wing pero con tres líneas
  ];

  /* ================================================================
     Azar con semilla (copiado de la Sopa, mismas constantes)
     ================================================================ */

  /* mulberry32: un generador pseudoaleatorio de 32 bits. Con la misma
     semilla da la misma secuencia en todos los navegadores. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;                        // avanza el estado
      let t = Math.imul(a ^ (a >>> 15), 1 | a);                // mezcla
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;          // más mezcla
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;            // número en [0, 1)
    };
  }
  /* FNV-1a de 32 bits: convierte un texto en una semilla, igual en todo navegador. */
  function hashTexto(s) {
    let h = 0x811c9dc5;                                        // base de FNV
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } // primo de FNV
    return h >>> 0;                                            // sin signo
  }
  // Entero al azar en [0, n).
  const entero = (rng, n) => Math.floor(rng() * n);
  // Fisher-Yates: devuelve una copia barajada de la lista.
  function baraja(lista, rng) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = entero(rng, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ================================================================
     El día de Chile (igual que la Sopa)
     ================================================================ */

  /* Todos cambian de sudoku a la misma medianoche, la de Santiago, sin
     importar la hora del equipo. «en-CA» escribe la fecha AAAA-MM-DD. */
  const FORMATO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" });
  function diaChile(ahora) {
    const p = {};                                              // partes de la fecha
    for (const x of FORMATO.formatToParts(ahora == null ? new Date() : ahora)) p[x.type] = x.value;
    return `${p.year}-${p.month}-${p.day}`;
  }
  // Número de día desde 1970 de una fecha AAAA-MM-DD (en UTC, solo para contar días).
  const numeroDia = f => Math.round(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)) / 864e5);
  // De número de día a AAAA-MM-DD.
  const deNumero = n => new Date(n * 864e5).toISOString().slice(0, 10);
  // El día anterior a una fecha AAAA-MM-DD.
  const diaAnterior = f => deNumero(numeroDia(f) - 1);

  /* ================================================================
     Geometría del tablero (se calcula una vez)
     ================================================================ */

  const filaDe = i => (i / 9) | 0;                             // fila 0..8 de la celda i
  const colDe = i => i % 9;                                    // columna 0..8
  const cajaDe = i => ((filaDe(i) / 3) | 0) * 3 + ((colDe(i) / 3) | 0); // caja 0..8, en orden de lectura

  /* Las 27 unidades: 0-8 filas, 9-17 columnas, 18-26 cajas. Cada una es
     la lista de sus 9 celdas. */
  const UNIDADES = [];
  for (let f = 0; f < 9; f++) UNIDADES.push([0, 1, 2, 3, 4, 5, 6, 7, 8].map(c => f * 9 + c)); // filas
  for (let c = 0; c < 9; c++) UNIDADES.push([0, 1, 2, 3, 4, 5, 6, 7, 8].map(f => f * 9 + c)); // columnas
  for (let b = 0; b < 9; b++) {                                // cajas
    const f0 = ((b / 3) | 0) * 3, c0 = (b % 3) * 3;            // esquina superior izquierda
    const u = [];
    for (let k = 0; k < 9; k++) u.push((f0 + ((k / 3) | 0)) * 9 + c0 + (k % 3));
    UNIDADES.push(u);
  }

  /* Los 20 «pares» de cada celda: las que comparten con ella fila,
     columna o caja. Una celda no puede repetir el valor de ninguno. */
  const PARES = [];
  const VE = new Uint8Array(81 * 81);                          // VE[i*81+j] = 1 si i y j se ven
  for (let i = 0; i < 81; i++) {
    const s = new Set();
    for (const u of [UNIDADES[filaDe(i)], UNIDADES[9 + colDe(i)], UNIDADES[18 + cajaDe(i)]]) for (const j of u) if (j !== i) s.add(j);
    PARES.push([...s]);
    for (const j of s) VE[i * 81 + j] = 1;
  }

  /* Tablas de bits: un candidato d (1..9) es el bit 1 << (d-1). */
  const TODOS = 511;                                           // los 9 bits encendidos
  const CUENTA = new Uint8Array(512);                          // cuántos bits tiene cada máscara
  for (let m = 1; m < 512; m++) CUENTA[m] = CUENTA[m >> 1] + (m & 1);
  const DIGITOS = [];                                          // DIGITOS[m] = lista de dígitos de la máscara m
  for (let m = 0; m < 512; m++) { const l = []; for (let d = 1; d <= 9; d++) if (m & (1 << (d - 1))) l.push(d); DIGITOS.push(l); }

  /* Todas las combinaciones de k elementos de una lista (para buscar
     pares y tríos). Las listas son cortas (≤ 9), así que no hay apuro. */
  function combinaciones(lista, k) {
    const res = [], tmp = [];
    (function rec(desde) {
      if (tmp.length === k) { res.push(tmp.slice()); return; } // combinación completa
      for (let i = desde; i < lista.length; i++) { tmp.push(lista[i]); rec(i + 1); tmp.pop(); }
    })(0);
    return res;
  }

  /* ================================================================
     Utilidades de tablero
     ================================================================ */

  // ¿Es un arreglo de 81 enteros entre 0 y 9?
  const formaValida = t => Array.isArray(t) && t.length === 81 && t.every(v => Number.isInteger(v) && v >= 0 && v <= 9);

  /* Sin repetidos en filas, columnas ni cajas (las celdas vacías no
     cuentan). No dice si tiene solución: para eso está `resolver`. */
  function esValido(t) {
    if (!formaValida(t)) return false;                         // forma rara: no es un tablero
    for (const u of UNIDADES) {
      let vistos = 0;                                          // máscara de dígitos ya vistos en la unidad
      for (const i of u) {
        const v = t[i];
        if (!v) continue;                                      // vacía: no molesta
        const b = 1 << (v - 1);
        if (vistos & b) return false;                          // repetido
        vistos |= b;
      }
    }
    return true;
  }

  /* Los números que se pueden poner en la celda i sin repetir con sus
     pares. Una celda ya llena no tiene candidatos. */
  function candidatos(t, i) {
    if (t[i]) return [];                                       // ya tiene número
    let usados = 0;
    for (const j of PARES[i]) if (t[j]) usados |= 1 << (t[j] - 1); // lo que ya está en fila, columna o caja
    return DIGITOS[TODOS & ~usados].slice();                   // el resto
  }

  /* Índices de las celdas que repiten número con algún par. Sirve para
     pintar en rojo los choques en el modo con notas. Ordenados. */
  function conflictos(t) {
    const malas = new Set();
    for (let i = 0; i < 81; i++) {
      if (!t[i]) continue;                                     // vacía: no choca
      for (const j of PARES[i]) if (t[j] === t[i]) { malas.add(i); break; } // mismo número en un par
    }
    return [...malas].sort((a, b) => a - b);
  }

  /* ¿La fila, la columna y la caja de la celda i están completas (los 9
     dígitos, sin repetir)? El arcade da bonus al cerrar una unidad. */
  function unidadesCompletas(t, i) {
    const completa = u => {
      let m = 0;
      for (const j of u) { if (!t[j]) return false; m |= 1 << (t[j] - 1); } // una vacía: incompleta
      return m === TODOS;                                      // aparecen los nueve
    };
    return { fila: completa(UNIDADES[filaDe(i)]), columna: completa(UNIDADES[9 + colDe(i)]), caja: completa(UNIDADES[18 + cajaDe(i)]) };
  }

  // Tablero a cadena de 81 caracteres ('0' = vacío), para guardar.
  const aCadena = t => t.map(v => String(v | 0)).join("");
  // Cadena de 81 caracteres ('0' o '.' = vacío) a tablero; null si no sirve.
  function deCadena(s) {
    if (typeof s !== "string" || !/^[0-9.]{81}$/.test(s)) return null;
    return [...s].map(ch => (ch === "." ? 0 : +ch));
  }

  /* ================================================================
     Resolvedor por fuerza bruta (backtracking + bits + MRV)
     ================================================================ */

  /* Cuenta soluciones hasta `limite` (por omisión 2: con eso se sabe si
     la solución es única). Si `rng` viene, prueba los dígitos en orden
     barajado: así se llena una cuadrícula al azar. No toca el tablero
     que recibe. Devuelve {soluciones, solucion} con la primera hallada. */
  function resolver(tablero, limite, rng) {
    if (limite == null) limite = 2;                            // por omisión: ¿hay una segunda?
    if (!formaValida(tablero)) return { soluciones: 0, solucion: null };
    const g = tablero.slice();                                 // copia de trabajo
    const fila = new Int32Array(9), col = new Int32Array(9), caja = new Int32Array(9); // dígitos usados
    for (let i = 0; i < 81; i++) {
      const v = g[i];
      if (!v) continue;
      const b = 1 << (v - 1), f = filaDe(i), c = colDe(i), k = cajaDe(i);
      if ((fila[f] | col[c] | caja[k]) & b) return { soluciones: 0, solucion: null }; // ya trae repetidos
      fila[f] |= b; col[c] |= b; caja[k] |= b;
    }
    const vacias = [];                                         // las celdas por llenar
    for (let i = 0; i < 81; i++) if (!g[i]) vacias.push(i);
    let soluciones = 0, primera = null;

    (function rec() {
      // MRV: busca la celda vacía con menos candidatos.
      let mejor = -1, mascara = 0, menos = 10;
      for (const i of vacias) {
        if (g[i]) continue;                                    // ya llenada en esta rama
        const m = TODOS & ~(fila[filaDe(i)] | col[colDe(i)] | caja[cajaDe(i)]);
        const n = CUENTA[m];
        if (n === 0) return;                                   // callejón sin salida
        if (n < menos) { menos = n; mejor = i; mascara = m; if (n === 1) break; } // uno solo: no hay que seguir buscando
      }
      if (mejor < 0) {                                         // no quedan vacías: solución
        soluciones++;
        if (!primera) primera = g.slice();
        return;
      }
      const f = filaDe(mejor), c = colDe(mejor), k = cajaDe(mejor);
      const digs = rng ? baraja(DIGITOS[mascara], rng) : DIGITOS[mascara]; // orden de prueba
      for (const d of digs) {
        const b = 1 << (d - 1);
        g[mejor] = d; fila[f] |= b; col[c] |= b; caja[k] |= b;  // pone
        rec();
        g[mejor] = 0; fila[f] &= ~b; col[c] &= ~b; caja[k] &= ~b; // saca
        if (soluciones >= limite) return;                      // ya basta
      }
    })();

    return { soluciones, solucion: primera };
  }

  /* ================================================================
     Resolvedor «humano» y calificación
     ================================================================ */

  /* Resuelve aplicando técnicas en orden. Cada vez que una avanza, vuelve
     a empezar por la más fácil (así se usa siempre la técnica más simple
     posible, como haría una persona). Devuelve el nivel alcanzado (el de
     la técnica más difícil usada, o 4 si se atascó) y la lista de
     técnicas usadas, sin repetir, en orden de primera aparición. */
  function resuelveHumano(tablero) {
    const g = tablero.slice();                                 // valores
    const cand = new Int32Array(81);                           // candidatos por celda (máscara)
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      let usados = 0;
      for (const j of PARES[i]) if (g[j]) usados |= 1 << (g[j] - 1);
      cand[i] = TODOS & ~usados;
    }
    let malo = false;                                          // se encontró una contradicción
    let nivel = 0;
    const usadas = [];                                         // ids de técnicas usadas

    // Pone d en la celda i y lo borra de los candidatos de sus pares.
    function pon(i, d) {
      g[i] = d; cand[i] = 0;
      const b = ~(1 << (d - 1));
      for (const j of PARES[i]) cand[j] &= b;
    }
    // Quita los bits de `m` de los candidatos de i; true si cambió algo.
    function quita(i, m) {
      if (g[i] || !(cand[i] & m)) return false;
      cand[i] &= ~m;
      return true;
    }
    // ¿Ya no queda ninguna celda vacía?
    const resuelto = () => { for (let i = 0; i < 81; i++) if (!g[i]) return false; return true; };

    /* --- Técnica: único oculto. En una unidad, un dígito que solo cabe
       en una celda va ahí. --- */
    function unicoOculto() {
      for (const u of UNIDADES) {
        let puestos = 0;                                       // dígitos ya colocados en la unidad
        for (const i of u) if (g[i]) puestos |= 1 << (g[i] - 1);
        for (let d = 1; d <= 9; d++) {
          const b = 1 << (d - 1);
          if (puestos & b) continue;                           // ya está
          let donde = -1, n = 0;
          for (const i of u) if (cand[i] & b) { donde = i; n++; }
          if (n === 0) { malo = true; return false; }          // el dígito no cabe en ningún lado
          if (n === 1) { pon(donde, d); return true; }
        }
      }
      return false;
    }
    /* --- Técnica: único desnudo. Una celda con un solo candidato. --- */
    function unicoDesnudo() {
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        if (cand[i] === 0) { malo = true; return false; }      // celda sin opciones: contradicción
        if (CUENTA[cand[i]] === 1) { pon(i, DIGITOS[cand[i]][0]); return true; }
      }
      return false;
    }
    /* --- Técnica: apuntador. En una caja, si un dígito solo está en una
       fila (o columna), se borra de esa fila fuera de la caja. --- */
    function apuntador() {
      let cambio = false;
      for (let b = 0; b < 9; b++) {
        const caja = UNIDADES[18 + b];
        for (let d = 1; d <= 9; d++) {
          const bit = 1 << (d - 1);
          const celdas = caja.filter(i => cand[i] & bit);      // dónde puede ir d en la caja
          if (celdas.length < 2) continue;                     // 0 o 1: eso lo ven los únicos
          const f = filaDe(celdas[0]), c = colDe(celdas[0]);
          if (celdas.every(i => filaDe(i) === f)) for (const j of UNIDADES[f]) if (cajaDe(j) !== b) cambio = quita(j, bit) || cambio;
          if (celdas.every(i => colDe(i) === c)) for (const j of UNIDADES[9 + c]) if (cajaDe(j) !== b) cambio = quita(j, bit) || cambio;
          if (cambio) return true;
        }
      }
      return false;
    }
    /* --- Técnica: reducción caja/línea. En una fila (o columna), si un
       dígito solo está dentro de una caja, se borra del resto de la caja. --- */
    function reduccion() {
      let cambio = false;
      for (let u = 0; u < 18; u++) {                           // las 18 líneas
        const linea = UNIDADES[u];
        for (let d = 1; d <= 9; d++) {
          const bit = 1 << (d - 1);
          const celdas = linea.filter(i => cand[i] & bit);
          if (celdas.length < 2) continue;
          const b = cajaDe(celdas[0]);
          if (!celdas.every(i => cajaDe(i) === b)) continue;   // repartido en varias cajas
          for (const j of UNIDADES[18 + b]) if (!linea.includes(j)) cambio = quita(j, bit) || cambio;
          if (cambio) return true;
        }
      }
      return false;
    }
    /* --- Técnica: subconjunto desnudo de tamaño k (par o trío). k celdas
       de una unidad que entre todas tienen exactamente k candidatos: esos
       candidatos se borran del resto de la unidad. --- */
    function desnudo(k) {
      for (const u of UNIDADES) {
        const libres = u.filter(i => !g[i] && CUENTA[cand[i]] >= 2 && CUENTA[cand[i]] <= k);
        if (libres.length < k) continue;
        for (const combo of combinaciones(libres, k)) {
          let union = 0;
          for (const i of combo) union |= cand[i];
          if (CUENTA[union] !== k) continue;                   // no encierran k dígitos
          let cambio = false;
          for (const j of u) if (!combo.includes(j)) cambio = quita(j, union) || cambio;
          if (cambio) return true;
        }
      }
      return false;
    }
    /* --- Técnica: subconjunto oculto de tamaño k. k dígitos que en una
       unidad solo caben en las mismas k celdas: en esas celdas se borran
       los demás candidatos. --- */
    function oculto(k) {
      for (const u of UNIDADES) {
        const pos = [];                                        // pos[d] = máscara de posiciones (0..8) de d en la unidad
        const digs = [];
        for (let d = 1; d <= 9; d++) {
          const bit = 1 << (d - 1);
          let m = 0;
          u.forEach((i, p) => { if (cand[i] & bit) m |= 1 << p; });
          pos[d] = m;
          if (CUENTA[m] >= 2 && CUENTA[m] <= k) digs.push(d);  // candidato a formar parte
        }
        if (digs.length < k) continue;
        for (const combo of combinaciones(digs, k)) {
          let union = 0, mascaraDigs = 0;
          for (const d of combo) { union |= pos[d]; mascaraDigs |= 1 << (d - 1); }
          if (CUENTA[union] !== k) continue;                   // ocupan más de k celdas
          let cambio = false;
          u.forEach((i, p) => { if (union & (1 << p)) cambio = quita(i, TODOS & ~mascaraDigs) || cambio; });
          if (cambio) return true;
        }
      }
      return false;
    }
    /* --- Técnica: «pez» de tamaño n (X-Wing = 2, Swordfish = 3). Si en n
       filas un dígito solo está en las mismas n columnas, se borra de esas
       columnas en las demás filas. Y lo mismo cambiando filas por
       columnas. --- */
    function pez(n) {
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << (d - 1);
        for (const porFilas of [true, false]) {
          const lineas = [];                                   // [índice de línea, máscara de posiciones]
          for (let a = 0; a < 9; a++) {
            let m = 0;
            for (let b = 0; b < 9; b++) {
              const i = porFilas ? a * 9 + b : b * 9 + a;
              if (cand[i] & bit) m |= 1 << b;
            }
            if (CUENTA[m] >= 2 && CUENTA[m] <= n) lineas.push([a, m]);
          }
          if (lineas.length < n) continue;
          for (const combo of combinaciones(lineas, n)) {
            let union = 0;
            for (const [, m] of combo) union |= m;
            if (CUENTA[union] !== n) continue;                 // no cierran en n líneas cruzadas
            const base = combo.map(x => x[0]);
            let cambio = false;
            for (let a = 0; a < 9; a++) {
              if (base.includes(a)) continue;                  // las líneas del pez no se tocan
              for (const b of DIGITOS[union]) {                // b-1 = línea cruzada
                const i = porFilas ? a * 9 + (b - 1) : (b - 1) * 9 + a;
                cambio = quita(i, bit) || cambio;
              }
            }
            if (cambio) return true;
          }
        }
      }
      return false;
    }
    /* --- Técnica: XY-Wing. Un pivote con {a,b} ve a una pinza {a,c} y a
       otra {b,c}: pase lo que pase, una de las pinzas será c, así que c se
       borra de las celdas que ven a las dos pinzas. --- */
    function xyWing() {
      for (let p = 0; p < 81; p++) {
        if (g[p] || CUENTA[cand[p]] !== 2) continue;           // el pivote tiene dos candidatos
        const [a, b] = DIGITOS[cand[p]];
        const ma = 1 << (a - 1), mb = 1 << (b - 1);
        const pinzas = PARES[p].filter(q => !g[q] && CUENTA[cand[q]] === 2 && cand[q] !== cand[p] && CUENTA[cand[q] & cand[p]] === 1);
        for (const q of pinzas) {
          if (!(cand[q] & ma)) continue;                       // q = {a, c}
          const c = cand[q] & ~ma;                             // máscara de c
          for (const r of pinzas) {
            if (r === q || cand[r] !== (mb | c)) continue;     // r = {b, c}
            let cambio = false;
            for (let i = 0; i < 81; i++) if (i !== q && i !== r && VE[i * 81 + q] && VE[i * 81 + r]) cambio = quita(i, c) || cambio;
            if (cambio) return true;
          }
        }
      }
      return false;
    }

    // Las técnicas en el mismo orden que TECNICAS.
    const PASOS = [unicoOculto, unicoDesnudo, apuntador, reduccion, () => desnudo(2), () => oculto(2), () => desnudo(3), () => oculto(3), () => pez(2), xyWing, () => pez(3)];

    bucle: while (!resuelto()) {
      for (let k = 0; k < PASOS.length; k++) {
        if (PASOS[k]()) {                                      // esta técnica avanzó
          if (TECNICAS[k].nivel > nivel) nivel = TECNICAS[k].nivel;
          if (!usadas.includes(TECNICAS[k].id)) usadas.push(TECNICAS[k].id);
          continue bucle;                                      // vuelve a la más fácil
        }
        if (malo) return { nivel: 4, tecnicas: usadas, resuelto: false }; // contradicción: no tiene solución
      }
      return { nivel: 4, tecnicas: usadas, resuelto: false };  // atascado: hace falta algo más fuerte
    }
    return { nivel, tecnicas: usadas, resuelto: true };
  }

  /* La dificultad de un puzzle según las técnicas que exige. Si el
     resolvedor humano no lo termina (hace falta adivinar o técnicas que
     no conoce, o no tiene solución) dice "imposible". */
  function califica(tablero) {
    if (!esValido(tablero)) return { dificultad: "imposible", tecnicas: [] }; // repetidos: ni hablar
    const r = resuelveHumano(tablero);
    return { dificultad: NOMBRES_NIVEL[r.nivel], tecnicas: r.tecnicas };
  }
  // Atajo interno: solo el número de nivel.
  const nivelDe = t => resuelveHumano(t).nivel;
  // Cuántas pistas tiene un tablero.
  const cuentaPistas = t => t.reduce((n, v) => n + (v ? 1 : 0), 0);

  /* ================================================================
     Generador
     ================================================================ */

  /* Los pares simétricos por rotación de 180°: (i, 80-i). El centro (40)
     va solo. Quitar y devolver siempre de a par deja el dibujo simétrico. */
  const PARES_SIM = [];
  for (let i = 0; i < 40; i++) PARES_SIM.push([i, 80 - i]);
  PARES_SIM.push([40]);

  // ¿Tiene exactamente una solución?
  const unica = t => resolver(t, 2).soluciones === 1;

  /* Una cuadrícula completa al azar: resolver el tablero vacío probando
     los dígitos en orden barajado. */
  const llena = rng => resolver(new Array(81).fill(0), 1, rng).solucion;

  /* Quita pistas de a pares simétricos, en orden al azar, mientras la
     solución siga siendo única. Termina en un puzzle «mínimo» (simétrico):
     ya no se le puede quitar otro par. Devuelve el puzzle y los pares
     quitados (para poder devolverlos). */
  function vacia(sol, rng) {
    const t = sol.slice();
    const quitados = [];
    for (const par of baraja(PARES_SIM, rng)) {
      for (const i of par) t[i] = 0;                           // los quita
      if (unica(t)) quitados.push(par);                        // sigue única: se quedan fuera
      else for (const i of par) t[i] = sol[i];                 // dos soluciones: se devuelven
    }
    return { t, quitados };
  }

  /* El sudoku nuevo: {pistas, solucion, dificultad, calificacion, tecnicas}.
     - `dificultad` es la pedida (lo que la pantalla muestra).
     - `calificacion` es lo que de verdad dio `califica`. Es igual a la
       pedida salvo que en INTENTOS no haya salido ninguno exacto: entonces
       se entrega el más cercano (en caso de empate, el primero hallado).
     La solución es única siempre. */
  function generar(opciones) {
    const o = opciones || {};
    const dif = DIFICULTADES[o.dificultad] ? o.dificultad : "medio"; // dificultad desconocida: medio
    const rng = o.rng || mulberry32(hashTexto("sudoku"));      // sin rng: uno fijo (el motor nunca usa Math.random)
    const objetivo = DIFICULTADES[dif].nivel;
    const [minP, maxP] = DIFICULTADES[dif].pistas;
    let mejor = null, distMejor = Infinity;                    // el más cercano visto

    for (let intento = 0; intento < INTENTOS[dif]; intento++) {
      const sol = llena(rng);                                  // 1) cuadrícula completa
      const { t, quitados } = vacia(sol, rng);                 // 2) puzzle mínimo
      let nivel = nivelDe(t);                                  // 3) ¿qué tan difícil salió?
      const reserva = baraja(quitados, rng);                   // pares que se pueden devolver

      /* 4) Más difícil de lo pedido: devolver pistas de a par hasta bajar
         al nivel. Puede pasarse y quedar más fácil; entonces el intento
         solo sirve como candidato. */
      while (nivel > objetivo && reserva.length) {
        for (const i of reserva.pop()) t[i] = sol[i];
        nivel = nivelDe(t);
      }

      if (nivel === objetivo) {
        /* 5) Justo: si trae menos pistas que el rango, devolver pares
           mientras no se vuelva más fácil y no pase el máximo. */
        for (let k = reserva.length - 1; k >= 0 && cuentaPistas(t) < minP; k--) {
          const par = reserva[k];
          if (cuentaPistas(t) + par.length > maxP) continue;   // se pasaría del rango
          for (const i of par) t[i] = sol[i];
          if (nivelDe(t) !== objetivo) for (const i of par) t[i] = 0; // lo hizo más fácil: se deshace
        }
        return arma(t, sol, dif);
      }

      // No salió exacto: ¿es el más cercano hasta ahora?
      const dist = Math.abs(nivel - objetivo);
      if (dist < distMejor) { distMejor = dist; mejor = { t: t.slice(), sol }; }
    }
    return arma(mejor.t, mejor.sol, dif);                      // el más cercano
  }
  // Empaqueta el resultado de `generar`.
  function arma(t, sol, dif) {
    const c = califica(t);
    return { pistas: t.slice(), solucion: sol.slice(), dificultad: dif, calificacion: c.dificultad, tecnicas: c.tecnicas };
  }

  /* El sudoku del día: igual para todos, solo depende de la fecha de
     Chile. Siempre "medio". */
  function sudokuDiario(fecha) {
    const s = generar({ dificultad: "medio", rng: mulberry32(hashTexto("sudoku:" + fecha)) });
    return { fecha, pistas: s.pistas, solucion: s.solucion, dificultad: "medio", calificacion: s.calificacion, tecnicas: s.tecnicas };
  }

  /* ================================================================
     Puntos del arcade
     ================================================================ */

  /* Las tarifas, a la vista para que la pantalla pueda explicarlas. */
  const PUNTOS = {
    acierto: 50,         // cada número bien puesto
    pasoCombo: 0.25,     // cada acierto seguido suma un 25 % al multiplicador
    comboMax: 4,         // el multiplicador no pasa de ×4
    unidad: 150,         // completar una fila, columna o caja
    triple: 300,         // extra si una jugada cierra las tres a la vez
    porSegundo: 5,       // bono de tiempo por cada segundo bajo la referencia
    vida: 500            // (para la pantalla) lo que vale cada vida que sobra
  };
  /* Tiempo de referencia por dificultad, en segundos: terminar antes da
     bono; después, nada. */
  const REFERENCIA = { facil: 360, medio: 600, dificil: 900, experto: 1500 };

  /* El multiplicador del combo: ×1 con el primer acierto, +0,25 por cada
     acierto seguido, hasta ×4. */
  const multiplicador = combo => Math.min(PUNTOS.comboMax, 1 + PUNTOS.pasoCombo * Math.max(0, (combo | 0) - 1));

  /* Puntos de una jugada del arcade.
     - `combo`: aciertos seguidos contando este (1 = el primero).
     - `unidades`: cuántas unidades cerró la jugada (0..3), o el objeto de
       `unidadesCompletas` ({fila, columna, caja}).
     - `error`: si fue un error, no da puntos (la vida se resta aparte).
     Todo se multiplica por el combo; el resultado es entero. */
  function puntosArcade(j) {
    const x = j || {};
    if (x.error) return 0;                                     // un error no suma
    const u = x.unidades;
    const n = typeof u === "number" ? Math.max(0, Math.min(3, u | 0)) // ya viene contado
      : u && typeof u === "object" ? (u.fila ? 1 : 0) + (u.columna ? 1 : 0) + (u.caja ? 1 : 0) // objeto {fila,columna,caja}
      : 0;
    const base = PUNTOS.acierto + n * PUNTOS.unidad + (n === 3 ? PUNTOS.triple : 0);
    return Math.round(base * multiplicador(x.combo == null ? 1 : x.combo));
  }

  /* Bono por terminar rápido: PUNTOS.porSegundo por cada segundo bajo la
     referencia de la dificultad. Nunca negativo. */
  function bonoTiempo(ms, dificultad) {
    const ref = REFERENCIA[dificultad] || REFERENCIA.medio;
    const seg = Math.max(0, Number(ms) || 0) / 1000;
    return Math.max(0, Math.round((ref - seg) * PUNTOS.porSegundo));
  }

  /* ================================================================
     Racha del diario (como la Sopa)
     ================================================================ */

  /* `r` = {ult, n, mejor}: `ult` es la fecha del último diario completado,
     `n` los días seguidos y `mejor` el récord. Por compatibilidad con el
     código copiado de la Sopa, la racha también sale como `racha` (el
     mismo número que `n`), y al leer se acepta cualquiera de los dos. */
  const rachaVacia = () => ({ ult: "", n: 0, racha: 0, mejor: 0 });
  // Arma una racha con los dos nombres del campo.
  const conNombres = (ult, n, mejor) => ({ ult, n, racha: n, mejor });
  // Deja una racha leída de cualquier lado (localStorage, la nube) en forma segura.
  function limpiaRacha(r) {
    const ok = r && typeof r === "object" && /^\d{4}-\d{2}-\d{2}$/.test(r.ult || ""); // necesita una fecha
    const num = x => (Number.isSafeInteger(x) && x > 0 ? x : 0); // enteros positivos o 0
    if (!ok) return rachaVacia();
    const n = num(r.n) || num(r.racha);                        // el nuevo nombre o el de la Sopa
    return conNombres(r.ult, n, Math.max(num(r.mejor), n));
  }
  /* Lo que se muestra hoy: la racha sigue viva si el último diario fue hoy
     o ayer; si se saltó un día, 0. */
  function rachaVisible(r, hoy) {
    r = limpiaRacha(r);
    return r.ult === hoy || r.ult === diaAnterior(hoy) ? r.n : 0;
  }
  /* Completar el diario de `hoy`. Si el último fue ayer, suma uno; si no,
     vuelve a 1. Repetirlo el mismo día no suma. */
  function registraDiaria(r, hoy) {
    r = limpiaRacha(r);
    if (r.ult === hoy) return r;                               // ya contado hoy
    const n = r.ult === diaAnterior(hoy) ? r.n + 1 : 1;
    return conNombres(hoy, n, Math.max(r.mejor, n));
  }
  /* Dos copias (este navegador y la cuenta): manda la que completó más
     tarde, y el récord es el mayor de los dos. */
  function mezclaRacha(a, b) {
    a = limpiaRacha(a); b = limpiaRacha(b);
    const base = a.ult > b.ult || (a.ult === b.ult && a.n >= b.n) ? a : b;
    return conNombres(base.ult, base.n, Math.max(a.mejor, b.mejor, base.n));
  }

  /* ================================================================
     La prueba de una partida (docs/antitrampas/sudoku.md)
     ================================================================ */

  /* Lo que hace falta para rehacer una partida: qué sudoku era (`f`, la
     fecha del diario; `s`, la semilla del clásico o del arcade, y `d`, la
     dificultad del clásico) y `j`, las jugadas en un arreglo plano de
     quíntuplos [celda, valor, Δt, g, f]: Δt en ms de reloj de juego desde
     la anterior; `g`, los ms desde la entrada anterior (el clic en la
     celda, la flecha, otra tecla) hasta la que hizo esta jugada, y `f`,
     banderas (1 = evento sintético sin mando, 2 = mando conectado, 4 =
     pestaña oculta): la forma humana de la jugada, para la capa anti-bot
     del verificador. Las notas no van: no cambian el tablero.
     - Diario y clásico: cada cambio de una celda, con el valor que le
       quedó (0 = borrada; también lo que deshace un «deshacer»). Una pista
       es 10 + el dígito, y su Δt ya trae los 30 s que suma.
     - Arcade: cada número que se intentó poner, bien o mal: el motor sabe
       cuál era el bueno, y de ahí salen las vidas, el combo y los puntos.
     La pantalla la arma y el verificador la rehace con `rehace`, así que
     las dos cuentan con las mismas reglas. */
  const PRUEBA_V = 1;
  const PASO = 5;                                              // números por jugada en `j`
  const PENALIZA_PISTA = 30000;
  const VIDAS_ARCADE = 3;
  const MODOS_PRUEBA = { d: "diario", c: "clasico", a: "arcade" };

  /* El sudoku que dice la prueba: {pistas, solucion, dificultad} o null. */
  function sudokuDePrueba(p) {
    if (p.m === "d") return typeof p.f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.f) ? sudokuDiario(p.f) : null;
    if (!Number.isSafeInteger(p.s) || p.s < 0 || p.s > 0xFFFFFFFF) return null;
    if (p.m === "a") return generar({ dificultad: "medio", rng: mulberry32(p.s) });
    if (p.m === "c" && DIFICULTADES[p.d] && Object.prototype.hasOwnProperty.call(DIFICULTADES, p.d)) return generar({ dificultad: p.d, rng: mulberry32(p.s) });
    return null;
  }

  /* Rehace la partida. Devuelve {error} o:
     - `sudoku`: el puzzle; `resuelto`: si el tablero quedó igual a la
       solución; `fin`: ms del reloj en la última jugada;
     - `finales`: los instantes en que cada celda tomó su valor final
       (sin las puestas por pista): lo que se mira para el ritmo humano;
     - `acciones`: [{t, dt, g, f}] de cada jugada, en orden;
     - `pistas` (clásico);
     - arcade: `puntos` de las jugadas (sin los bonos del final), `vidas`,
       `gana` y `pierde`. */
  function rehace(p) {
    if (!p || typeof p !== "object" || p.v !== PRUEBA_V) return { error: "La prueba no es de esta versión del sudoku." };
    if (!MODOS_PRUEBA[p.m]) return { error: "La prueba no dice el modo de juego." };
    const s = sudokuDePrueba(p);
    if (!s) return { error: "La prueba no dice qué sudoku era." };
    return Object.assign({ sudoku: s }, repasa(s, p.m, p.j));
  }

  /* Las jugadas `j` sobre un sudoku ya conocido ({pistas, solucion}), en
     el modo `m` ("d", "c" o "a"). Es la mitad de `rehace` que no genera:
     la pantalla la usa para comprobar, al retomar una partida guardada,
     que sus jugadas den justo el tablero guardado. */
  function repasa(s, m, j) {
    if (!Array.isArray(j) || j.length % PASO || j.length > PASO * 20000) return { error: "Las jugadas de la prueba no se pueden leer." };
    const arcade = m === "a";
    const tab = s.pistas.slice(), cuando = new Array(81).fill(-1), ayuda = new Set();
    let t = 0, pistas = 0, vidas = VIDAS_ARCADE, combo = 0, puntos = 0, gana = false, pierde = false;
    const acciones = [];
    for (let k = 0; k < j.length; k += PASO) {
      const i = j[k], v = j[k + 1], dt = j[k + 2], g = j[k + 3], f = j[k + 4];
      if (!Number.isInteger(i) || i < 0 || i > 80 || !Number.isInteger(v) || ![dt, g].every(x => Number.isSafeInteger(x) && x >= 0) ||
        !Number.isInteger(f) || f < 0 || f > 7) return { error: "Las jugadas de la prueba no se pueden leer." };
      t += dt;
      acciones.push({ t, dt, g, f });
      if (gana || pierde) return { error: "Hay jugadas después del final de la partida." };
      if (s.pistas[i] || ayuda.has(i)) return { error: "Una jugada toca una celda fija." };
      if (arcade) {
        if (v < 1 || v > 9 || tab[i]) return { error: "Una jugada del arcade no se pudo hacer." };
        if (v === s.solucion[i]) {
          tab[i] = v; cuando[i] = t; combo++;
          const u = unidadesCompletas(tab, i);
          puntos += puntosArcade({ combo, unidades: u });
          if (tab.every((x, q) => x === s.solucion[q])) gana = true;
        } else {
          combo = 0;
          if (--vidas <= 0) pierde = true;
        }
      } else if (v >= 11 && v <= 19) {                         // una pista (solo el clásico)
        if (m !== "c" || v - 10 !== s.solucion[i]) return { error: "Una pista de la prueba no es la del sudoku." };
        if (dt < PENALIZA_PISTA) return { error: "Una pista no sumó sus 30 segundos." };
        tab[i] = v - 10; ayuda.add(i); pistas++;
      } else {
        if (v > 9 || tab[i] === v) return { error: "Una jugada del tablero no se pudo hacer." };
        tab[i] = v; cuando[i] = t;
      }
    }
    const resuelto = tab.every((x, q) => x === s.solucion[q]);
    const finales = [];
    for (let i = 0; i < 81; i++) if (!s.pistas[i] && !ayuda.has(i) && tab[i] && cuando[i] >= 0) finales.push(cuando[i]);
    finales.sort((a, b) => a - b);
    return { resuelto, tablero: tab, ayudas: [...ayuda], fin: t, finales, acciones, pistas, puntos, vidas, gana, pierde };
  }

  /* Los puntos del arcade al terminar: los de las jugadas y, si se ganó,
     el bono de tiempo (con el tiempo entero que va al ranking) y el de las
     vidas que sobran. La pantalla y el verificador usan esta misma. */
  function puntosFinalArcade(puntos, gana, vidas, tiempo) {
    const extra = gana ? bonoTiempo(tiempo, "medio") + Math.max(0, vidas) * PUNTOS.vida : 0;
    return Math.max(0, Math.min(1000000, Math.round(puntos + extra)));
  }

  /* ================================================================
     Lo que se exporta
     ================================================================ */
  return {
    // datos
    DIFICULTADES, TECNICAS, INTENTOS, PUNTOS, REFERENCIA, UNIDADES, PARES,
    // azar y fechas
    mulberry32, hashTexto, diaChile, diaAnterior, numeroDia,
    // tablero
    esValido, candidatos, conflictos, unidadesCompletas, aCadena, deCadena, cuentaPistas,
    // resolver, calificar, generar
    resolver, califica, generar, sudokuDiario,
    // arcade
    puntosArcade, bonoTiempo, multiplicador,
    // racha
    rachaVacia, limpiaRacha, rachaVisible, registraDiaria, mezclaRacha,
    // la prueba de la partida (antitrampas)
    PRUEBA_V, PASO, PENALIZA_PISTA, VIDAS_ARCADE, sudokuDePrueba, rehace, repasa, puntosFinalArcade
  };
});
