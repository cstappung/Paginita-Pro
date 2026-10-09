/* Metro Rush — el fantasma: el rastro de una carrera y cómo se vuelve a ver.

   QUÉ HACE, EN GLOBAL
   En los modos «Fantasma» y «City fantasma» se corre contra la mejor
   carrera de la tabla (la n.º 1), en su MISMA pista. Para eso hacen falta
   tres cosas, y las tres viven aquí (todo puro: corre en Node y en la página):
     1. El RASTRO: mientras se corre se anota, cada décima de segundo de
        juego, dónde está el corredor de lado (x), a qué altura (y) y qué
        hace (corre, sube, baja, rueda, tropieza). Se guarda como un texto
        corto en la prueba de la carrera (`g`, ver prueba.js), así el que
        venga después puede verlo correr.
     2. Los PUNTOS del fantasma metro a metro: salen de los eventos de su
        prueba (estrellas, choque) con la misma cuenta del antitrampas: 10
        por metro × su multiplicador. Así se sabe en todo momento quién va
        ganando.
     3. PREPARAR el fantasma que manda la página: se comprueba con `rehace`
        (la misma prueba que pasó el antitrampas), se saca su semilla, los
        pedidos que le hizo al generador (túneles y boletos, para que la
        pista salga idéntica) y su rastro.

   POR QUÉ ASÍ
   - La velocidad solo depende del tiempo de juego, y en un modo es la misma
     para todos: a los 10 s todos van en el metro 155. Por eso el rastro NO
     guarda los metros (los da la curva) y el fantasma corre siempre a tu
     lado mientras los dos siguen en pie; la carrera de verdad es de PUNTOS
     (que dependen del multiplicador de cada uno) y de quién aguanta más.
   - El rastro no cuenta para los puntos: el antitrampas solo mira que se
     pueda leer y que no dure más que la carrera (prueba.js). Lo que se
     dibuja con él es solo para el ojo.

   EL FORMATO DEL RASTRO (versión 1)
   Un texto que empieza con "1" y sigue con fichas:
     · una MUESTRA: tres letras del alfabeto de 64 (0-9 A-Z a-z - _):
         x  = −3,2 + 0,1·i   (de −3,2 a 3,1 m: los carriles −2,2 / 0 / 2,2
                              caen justos en 10, 32 y 54)
         y  = 0,15·i         (de 0 a 9,45 m)
         s  = el estado: 0 corre, 1 sube, 2 baja, 3 rueda, 4 tropieza
     · "."   = la muestra anterior, una vez más;
     · "~c"  = la muestra anterior, (índice de c) + 2 veces más (2 a 65).
   Ejemplo: "1W00.~3" es W = 32 → x = −3,2 + 3,2 = 0 (el centro), 0 → en
   el suelo, 0 → corriendo; y repetido 1 + 5 veces más: 7 muestras, 0,7 s
   corriendo por el centro.
   Una carrera de 10 minutos ocupa de ~2 a 18 kB según cuánto se mueva (el
   peor caso, una muestra distinta cada décima, son 30 letras por segundo).

   UMD: `MetroRushFantasma` en la página, `module.exports` en Node. No
   depende de nadie: prueba.js lo usa para revisar el rastro. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.MetroRushFantasma = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------------------------------------------------------
     Las constantes del rastro
     --------------------------------------------------------------- */
  const VERSION = "1";                                   // la primera letra del rastro
  const PASO = 0.1;                                      // segundos de juego entre dos muestras
  const ALFA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";   // 64 letras que no hay que escapar en JSON
  const IDX = Object.create(null);                       // letra → su número (0 a 63)
  for (let i = 0; i < ALFA.length; i++) IDX[ALFA[i]] = i;
  const X0 = -3.2, QX = 0.1;                             // x = X0 + QX·i
  const QY = 0.15;                                       // y = QY·i
  const ESTADOS = ["corre", "sube", "baja", "rueda", "tropieza"];   // lo que dice la tercera letra
  const MAX_MUESTRAS = 36000;                            // una hora a 10 por segundo: más no se lee (un texto armado a mano no infla la memoria)
  const REPITE_MAX = 65;                                 // lo más que repite una ficha "~c"

  const limita = (v, a, b) => v < a ? a : v > b ? b : v;   // v entre a y b
  /** Las tres letras de una muestra. Ejemplo: (0, 0, 0) → "W00". */
  function letras(x, y, s) {
    const ix = limita(Math.round((x - X0) / QX), 0, 63);   // el carril, en décimas de metro desde −3,2
    const iy = limita(Math.round(y / QY), 0, 63);          // la altura, en quince centímetros
    const is = limita(s | 0, 0, ESTADOS.length - 1);       // el estado
    return ALFA[ix] + ALFA[iy] + ALFA[is];
  }

  /* ---------------------------------------------------------------
     1. Grabar: lo usa el juego mientras se corre
     --------------------------------------------------------------- */

  /** Un grabador de rastro. `muestra(x, y, s)` cada PASO segundos de juego;
      `texto()` devuelve el rastro hasta ahora (se puede pedir varias veces).
      Las muestras iguales seguidas se juntan en "." y "~c": correr derecho
      por el centro diez segundos son 100 muestras y ocupan 7 letras. */
  function crearGrabador() {
    let partes = [VERSION];                              // lo ya escrito (el número de versión primero)
    let ultima = null;                                   // las letras de la última muestra escrita
    let repite = 0;                                      // cuántas veces más se repitió y aún no se escribe
    let n = 0;                                           // cuántas muestras van
    /** Escribe las repeticiones pendientes con las fichas más cortas. */
    function vacia() {
      while (repite > 0) {
        if (repite === 1) { partes.push("."); repite = 0; }                 // una sola vez: un punto
        else { const k = Math.min(repite, REPITE_MAX); partes.push("~" + ALFA[k - 2]); repite -= k; }   // de 2 a 65 de una
      }
    }
    return {
      /** Anota una muestra: x (m), y (m), s (0 a 4, ver ESTADOS). */
      muestra(x, y, s) {
        const l = letras(x, y, s);
        n++;
        if (l === ultima) { repite++; return; }          // igual a la anterior: solo se cuenta
        vacia();                                         // lo pendiente primero, en orden
        partes.push(l); ultima = l;
      },
      /** El rastro como texto (con lo pendiente ya escrito). */
      texto() { vacia(); const t = partes.join(""); partes = [t]; return t; },
      /** Cuántas muestras van. */
      get n() { return n; }
    };
  }

  /** El rastro de una lista de muestras [[x, y, s], …] de una vez (para las pruebas). */
  function codifica(muestras) {
    const g = crearGrabador();
    for (const m of muestras) g.muestra(m[0], m[1], m[2]);
    return g.texto();
  }

  /* ---------------------------------------------------------------
     2. Leer: lo usa el que corre contra el fantasma (y el antitrampas)
     --------------------------------------------------------------- */

  /** Recorre las fichas de un rastro y llama `cada(ix, iy, is, veces)` por
      cada muestra (o grupo de muestras iguales). Devuelve cuántas muestras
      hay, o −1 si el texto no es un rastro (otra versión, una letra rara, una
      repetición sin muestra antes). Una ficha cortada al final (el rastro se
      recorta a su tope en prueba.js) se ignora: no es un error. */
  function recorre(texto, cada, max = MAX_MUESTRAS) {
    if (typeof texto !== "string" || texto[0] !== VERSION) return -1;
    let n = 0, ix = -1, iy = 0, is = 0;                  // ix −1: todavía no hay muestra que repetir
    for (let i = 1; i < texto.length && n < max;) {
      const ch = texto[i];
      if (ch === ".") {                                  // una repetición
        if (ix < 0) return -1;
        const v = Math.min(1, max - n); if (cada) cada(ix, iy, is, v); n += v; i += 1;
      } else if (ch === "~") {                           // varias repeticiones
        if (ix < 0) return -1;
        if (i + 1 >= texto.length) break;                // cortada al final
        const k = IDX[texto[i + 1]]; if (k === undefined) return -1;
        const v = Math.min(k + 2, max - n); if (cada) cada(ix, iy, is, v); n += v; i += 2;
      } else {                                           // una muestra nueva: tres letras
        if (i + 2 >= texto.length) { if (IDX[ch] === undefined || (i + 1 < texto.length && IDX[texto[i + 1]] === undefined)) return -1; break; }   // cortada al final (pero con letras válidas)
        const a = IDX[ch], b = IDX[texto[i + 1]], c = IDX[texto[i + 2]];
        if (a === undefined || b === undefined || c === undefined || c >= ESTADOS.length) return -1;
        ix = a; iy = b; is = c;
        if (cada) cada(ix, iy, is, 1);
        n += 1; i += 3;
      }
    }
    return n;
  }
  /** Cuántas muestras tiene un rastro (−1 si no es un rastro). */
  const cuenta = texto => recorre(texto, null);
  /** Cuántos segundos de carrera cubre un rastro (−1 si no es un rastro). */
  function duracion(texto) { const n = cuenta(texto); return n < 0 ? -1 : n * PASO; }

  /** Lee un rastro: {n, x, y, s} con un arreglo por campo (x e y en metros),
      o null si no es un rastro. */
  function decodifica(texto, max = MAX_MUESTRAS) {
    const n = cuenta(texto);
    if (n < 0) return null;
    const N = Math.min(n, max);
    const x = new Float32Array(N), y = new Float32Array(N), s = new Uint8Array(N);
    let k = 0;
    recorre(texto, (ix, iy, is, veces) => {
      for (let j = 0; j < veces && k < N; j++, k++) { x[k] = X0 + ix * QX; y[k] = iy * QY; s[k] = is; }
    }, N);
    return { n: N, x, y, s };
  }

  /** Dónde está el fantasma a los `t` segundos de juego: {x, y, s, fin}.
      x e y se interpolan entre las dos muestras que lo rodean (a 10 por
      segundo un salto se ve redondo); el estado es el de la muestra de
      antes. `fin` = el rastro ya terminó (el fantasma chocó): se queda en la
      última muestra. Ejemplo: muestras x 0 y 2,2 a los 0,1 y 0,2 s → a los
      0,15 s, x = 1,1 (va cambiando de carril). */
  function estadoEn(r, t) {
    if (!r || !r.n) return null;
    const k = Math.max(0, t / PASO), i = Math.floor(k);  // la muestra de antes
    if (i >= r.n - 1) { const u = r.n - 1; return { x: r.x[u], y: r.y[u], s: r.s[u], fin: k > r.n }; }
    const f = k - i;                                     // cuánto de camino a la siguiente
    return { x: r.x[i] + (r.x[i + 1] - r.x[i]) * f, y: r.y[i] + (r.y[i + 1] - r.y[i]) * f, s: r.s[i], fin: false };
  }
  /** Desde qué segundo viene el estado actual sin cortarse (para la vuelta de
      la rodada, que se dibuja según el tiempo que lleva rodando). */
  function desdeEn(r, t) {
    if (!r || !r.n) return 0;
    let i = Math.min(r.n - 1, Math.max(0, Math.floor(t / PASO)));
    const s = r.s[i];
    while (i > 0 && r.s[i - 1] === s && t - (i - 1) * PASO < 3) i--;   // como mucho 3 s hacia atrás: más no hace falta
    return i * PASO;
  }

  /* ---------------------------------------------------------------
     3. Los puntos del fantasma, metro a metro
     --------------------------------------------------------------- */

  /** Los tramos de puntos de una prueba: [{D, p, k}] donde desde el metro D
      lleva p puntos y suma k por metro (10 × el multiplicador; 0 caído). Es
      la misma cuenta que `rehace` (prueba.js), sin las comprobaciones: aquí
      la prueba ya pasó por rehace. `M` es el motor (multiplicador y puntos).
      Ejemplo: base ×3 sin nada → [{D: 0, p: 0, k: 30}]; con una estrella en
      el metro 100 → …, {D: 100, p: 3000, k: 40}. */
  function tramosPuntos(prueba, M) {
    const tramos = [];
    let estrellas = 0, doble = false, extra = 0, vivo = true, p = 0, D0 = 0;
    const k = () => vivo ? M.puntosPorTramo(1, M.multiplicador({ base: prueba.b, estrellas, doble, extra })) : 0;   // puntos por metro ahora
    tramos.push({ D: 0, p: 0, k: k() });
    for (const ev of prueba.e || []) {
      const [cod, , D] = ev;
      if (cod === "w") continue;                         // las muestras no cambian nada
      if (vivo) { p += tramos[tramos.length - 1].k * (D - D0); }   // lo corrido desde el último borde
      D0 = D;
      if (cod === "e") estrellas = Math.min(M.MAX_ESTRELLAS, estrellas + 1);
      else if (cod === "d") doble = true;
      else if (cod === "x") doble = false;
      else if (cod === "p") extra = M.POTENCIADORES.puntos.extra;
      else if (cod === "m") vivo = false;
      else if (cod === "s") vivo = true;
      tramos.push({ D, p, k: k() });
    }
    return tramos;
  }
  /** Los puntos del fantasma al llegar al metro D (los tramos van en orden). */
  function puntosEn(tramos, D) {
    let lo = 0, hi = tramos.length - 1;                  // búsqueda binaria del último tramo que empieza antes de D
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (tramos[m].D <= D) lo = m; else hi = m - 1; }
    const t = tramos[lo];
    return t.p + t.k * Math.max(0, D - t.D);
  }

  /* ---------------------------------------------------------------
     4. Preparar el fantasma que llega de la página
     --------------------------------------------------------------- */

  /** Arma el fantasma desde lo que mandó la página ({nombre, puntos, d, yo…}:
      `d` es la prueba como texto, tal como está en soloPruebas). `MP` es
      prueba.js y `M` el motor; `modo` el id del modo que se va a correr.
      Devuelve {motivo} si no sirve, o el fantasma:
        nombre, yo        quién es (yo: es tu propia carrera)
        semilla, pedidos  para correr su misma pista (solo túneles y boletos)
        rastro            sus muestras (null si su prueba no trae rastro)
        tramos            sus puntos metro a metro
        tm, Dm            cuándo y en qué metro chocó
        Df                en qué metro quedó (tras resbalar)
        puntos, metros    lo que hizo (lo que dice la tabla) */
  function prepara(dato, MP, M, modo) {
    const mal = m => ({ motivo: m });
    if (!dato || typeof dato.d !== "string" || !dato.d) return mal("su récord no trae la prueba de la carrera");
    let p;
    try { p = JSON.parse(dato.d); } catch (e) { return mal("su prueba no se puede leer"); }
    const r = MP.rehace(p);                              // la misma revisión del antitrampas
    if (r.motivo) return mal(/otra versión/.test(r.motivo) ? "su récord es de otra versión del juego" : "su prueba no cuadra (" + r.motivo + ")");
    if (r.modo !== modo) return mal("su récord no es de este modo");
    const fin = p.e[p.e.length - 1];                     // el evento «f»
    const m = p.e.find(ev => ev[0] === "m") || fin;      // el choque (en los fantasma no se sigue corriendo: hay uno)
    const rastro = typeof p.g === "string" ? decodifica(p.g) : null;
    return {
      nombre: String(dato.nombre || "Jugador").slice(0, 80), yo: !!dato.yo,
      semilla: p.s >>> 0,
      pedidos: p.i.filter(q => q[0] === "T" || q[0] === "B"),   // sin la cinta de la mochila: en estos modos no hay
      rastro: rastro && rastro.n ? rastro : null,
      tramos: tramosPuntos(p, M),
      tm: m[1], Dm: m[2], Df: fin[2],
      puntos: r.puntos, metros: r.metros
    };
  }

  return { VERSION, PASO, ALFA, ESTADOS, MAX_MUESTRAS, X0, QX, QY, crearGrabador, codifica, recorre, cuenta, duracion, decodifica, estadoEn, desdeEn, tramosPuntos, puntosEn, prepara };
});
