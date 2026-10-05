/* Metro Rush — el motor (todo lo que no dibuja).

   QUÉ HACE, EN GLOBAL
   Aquí vive la parte "pura" del juego: números y reglas, sin pantalla ni
   Three.js. La velocidad de la carrera, cuántos puntos vale cada metro, el
   multiplicador, en qué estación estás según tus puntos, el generador que
   decide dónde van los trenes, barreras, monedas y poderes, los retos, la
   tienda y cómo se guarda (y se mezcla) el progreso entre dos aparatos.

   POR QUÉ ESTÁ SEPARADO
   - Se puede probar en Node sin navegador (colabtex/tests/metrorush-motor.test.cjs):
     por ejemplo, que el generador NUNCA deja una fila imposible de pasar.
   - Es un UMD: en la página queda en `window.MetroRushMotor`; en Node, en
     `module.exports`. Así lo usan la pantalla y los tests sin copiar nada.
   - Todo lo aleatorio sale de un generador con semilla (mulberry32): la misma
     semilla da la misma pista, lo que permite comprobarla en los tests.

   CÓMO SE MIDE LA PISTA
   La pista se mide en metros desde la salida ("d"). El corredor va por el
   metro D; un objeto en el metro d está a (d − D) metros por delante. Hay
   tres carriles: 0 (izquierda), 1 (centro) y 2 (derecha). */
(function (raiz, fabrica) {
  const M = fabrica();                                                    // construye el motor una sola vez
  if (typeof module === "object" && module.exports) module.exports = M;   // Node (los tests)
  else raiz.MetroRushMotor = M;                                           // navegador (la pantalla)
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- Azar con semilla ---------- */

  /** mulberry32: un generador de números al azar pequeño y rápido.
      Con la misma semilla devuelve siempre la misma secuencia (0 ≤ x < 1). */
  function rng(semilla) {
    let s = semilla >>> 0;                                   // la semilla como entero sin signo
    return function () {
      s = (s + 0x6D2B79F5) | 0;                              // avanza el estado
      let t = Math.imul(s ^ (s >>> 15), 1 | s);              // mezcla los bits…
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;        // …dos veces
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;          // y lo lleva a [0, 1)
    };
  }
  const lerp = (a, b, k) => a + (b - a) * k;                 // mezcla lineal entre a y b
  const limita = (x, a, b) => Math.max(a, Math.min(b, x));   // encierra x entre a y b

  /* ---------- La pista y la física ---------- */

  const CARRILES = [-2.2, 0, 2.2];       // posición x (metros) del centro de cada carril
  const LARGO_VAGON = 11.3;              // largo de un vagón, con sus topes
  const ALTO_TECHO = 3.35;               // a qué altura queda el techo de un tren (sobre la vía)
  const LARGO_RAMPA = 5;                 // la rampa sube del suelo al techo en 5 m

  /* La física del corredor. Las alturas están en metros sobre la vía. */
  const FISICA = {
    gravedad: 34,          // m/s²: más fuerte que la real para que el salto se sienta ágil
    alturaSalto: 1.5,      // un salto normal pasa la barrera baja (que mide 0,95)
    alturaZapatillas: 4.1, // con zapatillas saltarinas se llega a los techos (3,35)
    tiempoRodar: 0.62,     // segundos que dura una rodada
    caidaRapida: 24,       // m/s hacia abajo si ruedas en el aire (el "golpe al suelo")
    cambioCarril: 0.17,    // segundos que tarda en pasar de un carril al de al lado
    alturaMochila: 8.5,    // la mochila cohete vuela a esta altura
    altoDePie: 1.7,        // lo que ocupa el corredor de pie…
    altoRodando: 0.8,      // …y rodando (pasa bajo la barrera alta, que empieza a 1,0)
    medioAncho: 0.35,      // medio ancho del corredor para los choques
    ventanaTropiezo: 8     // dos tropiezos en menos de 8 s y te atrapan
  };
  /** Velocidad inicial para subir hasta `altura` con esa gravedad: v = √(2·g·h). */
  const impulso = altura => Math.sqrt(2 * FISICA.gravedad * altura);

  /* ---------- Lo que pisa el corredor y lo que lo choca ----------
     Puro (sin pantalla) para poder probarlo en Node: `juego.js` lo llama en
     cada cuadro. D es la distancia del corredor en la pista (metros) e y su
     altura sobre la vía.

     La regla que importa: el techo de un vagón tiene que sostenerte en TODO
     el tramo en que el vagón ya te puede chocar. El choque cuenta desde
     MEDIO_LARGO (0,3 m) antes del vagón, porque el corredor ocupa 0,3 m
     hacia adelante. El techo sostenía recién desde 0,2 m antes, y en esos
     10 cm el corredor seguía en la rampa, un poco más bajo que el techo:
     el juego lo daba por chocado contra el frente del vagón. Pasaba entre
     un tercio y casi todas las veces según los cuadros por segundo, justo
     al subir de la rampa al vagón. Por eso MARGEN_TECHO es mayor que
     MEDIO_LARGO, adelante y atrás. Ejemplo: vagón desde D = 25. El choque
     cuenta desde D = 24,7 y el techo sostiene desde D = 24,6. */
  const MEDIO_LARGO = 0.3;               // cuánto ocupa el corredor hacia adelante (y hacia atrás) de D
  const MARGEN_TECHO = 0.4;              // desde cuánto antes (y hasta cuánto después) sostiene el techo de un vagón
  const MARGEN_RAMPA = 0.4;              // lo mismo para la rampa: su caja también choca hasta 0,3 m después de su final

  /** La altura de la rampa `o` en la distancia D (0 al pie, ALTO_TECHO arriba). */
  const alturaRampa = (o, D) => ALTO_TECHO * limita((D - o.d0) / o.largo, 0, 1);

  /** Lo que sostiene al corredor en (x, D, y): {h, tren}. `h` es la altura
      del suelo bajo sus pies (0, la rampa o el techo) y `tren`, el vagón que
      pisa (si pisa uno). `Dantes` es la D del cuadro anterior: un cuadro
      puede durar hasta 50 ms y a 30 m/s eso es 1,5 m de pista, así que la
      rampa se mira también donde estaba el corredor, no solo donde está. */
  function soporte(objs, x, D, y, Dantes = D) {
    let rampa = 0, subida = 0, h = 0, tren = null;
    // 1) las rampas primero: el techo de más abajo necesita saber si vienes subiendo por una
    for (const o of objs) {
      if (o.tipo !== 'rampa') continue;
      const fin = o.d0 + o.largo;
      // ni la pisas ni la acabas de pasar en este cuadro (un cuadro largo puede saltar su final entero)
      if (D < o.d0 - MARGEN_RAMPA || Dantes > fin + MARGEN_RAMPA) continue;
      if (Math.abs(x - CARRILES[o.carril]) > 1.05) continue;                      // no está en mi carril
      const hs = alturaRampa(o, D);                                               // pasado el final, queda en ALTO_TECHO
      // la sigues si ibas sobre ella: tu altura alcanza la de la rampa donde estabas en el cuadro anterior
      const antes = Math.min(hs, alturaRampa(o, Dantes));
      if (y < antes - 0.7) continue;                                              // vienes por debajo (de lado, o desde el suelo a media rampa)
      if (hs > subida) subida = hs;                                               // hasta dónde te subió en este cuadro
      if (D <= fin + MARGEN_RAMPA && hs > rampa) rampa = hs;                      // y si sigues sobre ella, te sostiene
    }
    h = rampa;
    // 2) los vagones: te sostienen si vas a la altura del techo, o si la rampa ya te subió a ella
    const yEf = Math.max(y, subida);
    for (const o of objs) {
      if (o.tipo !== 'tren') continue;
      if (D < o.d0 - MARGEN_TECHO || D > o.d0 + o.largo + MARGEN_TECHO) continue;
      if (Math.abs(x - CARRILES[o.carril]) > 1.05) continue;
      if (yEf >= ALTO_TECHO - 0.5 && ALTO_TECHO >= h) { h = ALTO_TECHO; tren = o; }
    }
    return { h, tren };
  }

  /** La caja que ocupa el obstáculo `o` cuando el corredor va en D:
      {z0, z1} en la pista, {y0, y1} en altura y `w`, su medio ancho. Null si
      no choca (monedas, poderes…). */
  function caja(o, D) {
    if (o.tipo === 'tren') return { z0: o.d0, z1: o.d0 + o.largo, y0: 0, y1: ALTO_TECHO, w: 0.98 };
    if (o.tipo === 'bajo') return { z0: o.d - 0.12, z1: o.d + 0.12, y0: 0, y1: 0.95, w: 0.95 };
    if (o.tipo === 'alto') return { z0: o.d - 0.12, z1: o.d + 0.12, y0: 1.0, y1: 2.35, w: 0.95 };
    // la rampa solo choca por debajo de su superficie (si te metes de lado bajo ella)
    if (o.tipo === 'rampa') return { z0: o.d0, z1: o.d0 + o.largo, y0: 0, y1: alturaRampa(o, D) - 0.6, w: 0.95 };
    return null;
  }

  /** La curva de velocidad de la carrera, en un solo lugar: la usan el
      juego (`velocidad`), el generador (`velocidadEn`) y el antitrampas
      (`metrosEntre`, que recalcula los metros de cada carrera). Parte en
      V0 y sube ACEL m/s cada segundo hasta VMAX, y ahí se queda.

      Por qué una rampa y no una curva que se acerca a un techo: con un
      techo de 50 m/s, esa curva tenía que ser muy rápida al principio para
      llegar alguna vez (31 m/s al minuto). La rampa deja el comienzo como
      estaba (21 m/s al minuto, 27 a los dos) y sigue subiendo: llega a
      50 m/s a los 350 s (5 min 50 s), a los 11,4 km. Es el premio de una
      buena carrera: la densidad de obstáculos ya llegó a su máximo a los
      ~7,7 km, y desde los 11,4 km la carrera es aguante a toda velocidad.
      Con aceleración constante los metros tienen fórmula exacta en el
      tiempo (d = V0·t + ACEL·t²/2) y en la distancia (v² = V0² + 2·ACEL·d). */
  const VELOCIDAD = { V0: 15, VMAX: 50, ACEL: 0.1 };      // m/s al empezar, m/s de tope y m/s² de aceleración
  const T_TOPE = (VELOCIDAD.VMAX - VELOCIDAD.V0) / VELOCIDAD.ACEL;   // a los 350 s llega al tope

  /** Velocidad de la carrera (m/s) a los `t` segundos. Ejemplo: a los 0 s,
      15; a los 60 s, 21; a los 120 s, 27; desde los 350 s, 50. */
  function velocidad(t) {
    const { V0, VMAX, ACEL } = VELOCIDAD;
    return Math.min(VMAX, V0 + ACEL * Math.max(0, t));      // sube parejo y se queda en el tope
  }

  /** Los metros corridos desde el comienzo hasta el segundo `t`: la integral
      de `velocidad`. Hasta el tope, V0·t + ACEL·t²/2; después, a VMAX. */
  function metrosHasta(t) {
    const { V0, VMAX, ACEL } = VELOCIDAD;
    const tt = Math.max(0, t), subiendo = Math.min(tt, T_TOPE);         // el tramo en que todavía acelera
    return V0 * subiendo + ACEL * subiendo * subiendo / 2 + VMAX * (tt - subiendo);
  }

  /** Los metros que se corren entre los tiempos de juego a y b. Ejemplo: de
      0 a 10 s, 155 m; de 0 a 60 s, 1 080 m. */
  const metrosEntre = (a, b) => metrosHasta(b) - metrosHasta(a);

  /** Cómo frena el corredor cuando el inspector lo atrapa (m/s²): a 50 m/s
      resbala 50² / (2·60) = 20,8 m. El antitrampas tolera eso, no más. */
  const FRENADA = 60;

  /* ---------- Puntos y multiplicador ---------- */

  const PUNTOS_POR_METRO = 10;   // cada metro vale 10 puntos × el multiplicador
  const MAX_BASE = 30;           // el multiplicador base (el de los retos) llega a ×30
  const MAX_ESTRELLAS = 29;      // las estrellas de una carrera suman hasta +29

  /** El multiplicador total: base de los retos + estrellas de la carrera +
      el potenciador (si se usó uno al empezar), y ×2 si el poder 2× está
      activo. Ejemplo: base 5, 3 estrellas, potenciador +5 y 2× → 26. */
  function multiplicador({ base = 1, estrellas = 0, doble = false, extra = 0 } = {}) {
    const m = limita(base, 1, MAX_BASE) + limita(estrellas, 0, MAX_ESTRELLAS) + limita(extra | 0, 0, 10);
    return m * (doble ? 2 : 1);
  }
  /** Puntos que da avanzar `metros` con ese multiplicador. */
  const puntosPorTramo = (metros, mult) => metros * PUNTOS_POR_METRO * mult;

  /* ---------- Estaciones (cambian con los puntos) ----------
     Cada estación tiene su estilo de dibujo (juguete, pixel o neón), su
     paleta de colores, su música y un boleto dorado con un trozo de la
     historia. Se entra a cada una por un túnel. Después de la última, las
     tres primeras vuelven a girar cada 2 millones ("vuelta 2", "vuelta 3"…). */
  const ESTACIONES = [
    { id: "barrio", nombre: "Barrio Estación", desde: 0, estilo: "juguete", paleta: "barrio", musica: "metrorush-barrio", lema: "Donde empieza la Línea 3", boleto: 1 },
    { id: "ocaso", nombre: "Ocaso", desde: 50000, estilo: "pixel", paleta: "ocaso", musica: "metrorush-ocaso", lema: "El sol se pone en píxeles", boleto: 2 },
    { id: "neon", nombre: "Línea Neón", desde: 200000, estilo: "neon", paleta: "neon", musica: "metrorush-neon", lema: "De noche la vía se enciende sola", boleto: 3 },
    { id: "fantasma", nombre: "Estación Fantasma", desde: 1000000, estilo: "neon", paleta: "fantasma", musica: "metrorush-fantasma", lema: "Nadie había corrido tanto", boleto: 4 },
    { id: "invierno", nombre: "Invierno", desde: 2500000, estilo: "juguete", paleta: "invierno", musica: "metrorush-invierno", lema: "Nieva sobre los rieles", boleto: 5 },
    { id: "oxido", nombre: "Óxido", desde: 5000000, estilo: "pixel", paleta: "oxido", musica: "metrorush-oxido", lema: "Más allá del mapa", boleto: 6 },
    { id: "fin", nombre: "Fin de la Línea", desde: 10000000, estilo: "juguete", paleta: "alba", musica: "metrorush-fin", lema: "Aquí se acaban las vías… ¿o no?", boleto: 7 }
  ];
  const VUELTA_DESDE = 12000000, VUELTA_CADA = 2000000;   // desde 12 M, una estación de las tres primeras cada 2 M

  /** La estación que corresponde a `puntos`. Devuelve una copia con `clave`
      (distinta en cada vuelta, para saber cuándo hay que cambiar). */
  function estacionDe(puntos) {
    const p = Math.max(0, puntos || 0);
    if (p < VUELTA_DESDE) {
      let e = ESTACIONES[0];
      for (const x of ESTACIONES) if (p >= x.desde) e = x;  // la última cuyo umbral ya pasaste
      return Object.assign({}, e, { clave: e.id, vuelta: 1 });
    }
    const k = Math.floor((p - VUELTA_DESDE) / VUELTA_CADA);  // cuántos giros van desde los 12 M
    const base = ESTACIONES[k % 3];                          // barrio, ocaso, neón, barrio…
    const vuelta = 2 + Math.floor(k / 3);                    // la vuelta en que vas
    return Object.assign({}, base, { nombre: `${base.nombre} · vuelta ${vuelta}`, clave: `${base.id}-${k}`, vuelta, boleto: null });
  }
  /** Los puntos a los que empieza la estación siguiente (para la barra del HUD). */
  function siguienteUmbral(puntos) {
    const p = Math.max(0, puntos || 0);
    for (const x of ESTACIONES) if (x.desde > p) return x.desde;
    if (p < VUELTA_DESDE) return VUELTA_DESDE;
    return VUELTA_DESDE + (Math.floor((p - VUELTA_DESDE) / VUELTA_CADA) + 1) * VUELTA_CADA;
  }

  /* ---------- La historia ----------
     Siete boletos dorados, uno por estación. Se leen en la Libreta. */
  const INTRO = "La Línea 3 cierra mañana. Esta noche, el último tren no para en ninguna estación… y tú vas a correr toda la vía antes de que apaguen las luces. Don Ramón, el inspector, y su perro Tornillo vienen detrás.";
  const BOLETOS = [
    null,  // (los boletos se cuentan desde el 1)
    { titulo: "Boleto n.º 1 · Barrio Estación", texto: "La Línea 3 cierra mañana. Dicen que el último tren no para en ninguna estación. Dicen muchas cosas." },
    { titulo: "Boleto n.º 2 · Ocaso", texto: "Don Ramón lleva cuarenta años de inspector y nunca ha atrapado a nadie. Tornillo tampoco. Pero no se rinden: es su última noche también." },
    { titulo: "Boleto n.º 3 · Línea Neón", texto: "De noche la vía se enciende sola. Nadie paga la luz. Nadie pregunta. Los letreros dicen tu nombre si corres lo bastante rápido." },
    { titulo: "Boleto n.º 4 · Estación Fantasma", texto: "Un millón. Aquí bajan los que corrieron demasiado y se quedaron a vivir en la vía. Saluda: te están aplaudiendo, aunque no los veas." },
    { titulo: "Boleto n.º 5 · Invierno", texto: "Nieva sobre los rieles. En el andén hay un termo de café con una nota: «Para el que corre. —R.». Don Ramón sabe que no lo vas a tomar. Lo deja igual." },
    { titulo: "Boleto n.º 6 · Óxido", texto: "La línea sigue más allá del mapa. Los rieles están tibios y oxidados, como si alguien los hubiera usado anoche. Alguien que corría como tú." },
    { titulo: "Boleto n.º 7 · Fin de la Línea", texto: "Amanece. Se acabaron las vías… y aun así tus pies siguen encontrando dónde pisar. La Línea 3 no cierra mientras alguien la corra. Gracias por correrla." }
  ];

  /* ---------- Poderes, tienda y aspectos ---------- */

  /** Los cuatro poderes con tiempo, su duración base (s) y su nombre. */
  const PODERES = {
    iman: { nombre: "Imán", base: 10, icono: "🧲" },
    mochila: { nombre: "Mochila cohete", base: 5, paso: 1, icono: "🚀" },   // corta y frenética, como en Subway Surfers
    zapatillas: { nombre: "Zapatillas saltarinas", base: 10, icono: "👟" },
    doble: { nombre: "2×", base: 12, icono: "✖2" }
  };
  const SEG_POR_NIVEL = 2.5;                         // cada mejora alarga el poder 2,5 s (la mochila, `paso`: 1 s)
  const MAX_MEJORA = 5;                              // cinco mejoras por poder
  const PRECIOS_MEJORA = [250, 600, 1200, 2500, 5000];   // lo que cuesta pasar al nivel 1, 2, 3, 4, 5
  const PRECIO_PATINETA = 300;                       // una patineta, en monedas del juego
  const DURACION_PATINETA = 30;                      // segundos que dura una patineta
  /** Duración (s) de un poder con `nivel` mejoras. Ejemplo: imán nivel 2 →
      15 s; mochila nivel 2 → 7 s (de 5 a 10 s con las cinco mejoras). */
  const duracionPoder = (clase, nivel) => {
    const p = PODERES[clase];                                       // el poder (o nada, si no existe)
    if (!p) return 0;
    return p.base + (p.paso != null ? p.paso : SEG_POR_NIVEL) * limita(nivel | 0, 0, MAX_MEJORA);
  };
  /** Cuánto cuesta la próxima mejora si vas en `nivel` (null si ya está al máximo). */
  const precioMejora = nivel => (nivel >= MAX_MEJORA ? null : PRECIOS_MEJORA[Math.max(0, nivel | 0)]);
  /* Los potenciadores, como los de Subway Surfers: se compran en la tienda,
     se guardan y se usan al empezar una carrera (aparecen dos botones los
     primeros segundos). Se gastan al usarlos. */
  const POTENCIADORES = {
    despegue: { nombre: "Despegue", precio: 1500, seg: 7, texto: "Empiezas la carrera volando con la mochila cohete, 7 s" },
    puntos: { nombre: "Potenciador +5", precio: 2500, extra: 5, texto: "+5 al multiplicador durante toda una carrera" }
  };
  /** Saltar una misión cuesta más mientras más alto el multiplicador. Ejemplo: en ×1, 550; en ×10, 1900. */
  const costoSaltar = nivel => 400 + 150 * limita(nivel | 0, 1, MAX_BASE);
  /** Lo que paga completar un set de tres misiones (además de subir el multiplicador). Ejemplo: el set de ×4 paga 450. */
  const premioSet = nivel => 250 + 50 * limita(nivel | 0, 1, MAX_BASE);
  /** Seguir después de chocar: 500, 1000, 2000… monedas (se duplica en cada carrera). */
  const costoSeguir = veces => 500 * Math.pow(2, Math.max(0, veces | 0));

  /* Los aspectos del corredor: colores de la ropa. Dos son secretos. */
  const ASPECTOS = {
    clasico: { nombre: "Clásico", precio: 0, sudadera: 0xff5a3c, gorra: 0x2a6df4, jeans: 0x3b5ba8, mochila: 0x1fb5a0, mochila2: 0xffd23f, suela: 0xe8463b },
    nocturno: { nombre: "Nocturno", precio: 1500, sudadera: 0x2b2d42, gorra: 0x8d99ae, jeans: 0x1d1e2c, mochila: 0xef233c, mochila2: 0xedf2f4, suela: 0xef233c },
    grafitero: { nombre: "Grafitero", precio: 3000, sudadera: 0x7b2ff7, gorra: 0x00f5d4, jeans: 0x22223b, mochila: 0xfee440, mochila2: 0xf15bb5, suela: 0x00f5d4 },
    dorado: { nombre: "Dorado", precio: null, secreto: "Teclea el código de siempre en la portada (↑ ↑ ↓ ↓ ← → ← → B A).", sudadera: 0xd4a017, gorra: 0xffe066, jeans: 0x8a6d1a, mochila: 0xffd23f, mochila2: 0xfff3b0, suela: 0xffe066 },
    inspector: { nombre: "Inspector", precio: null, secreto: "Encuentra los siete boletos dorados.", sudadera: 0x1f3a5f, gorra: 0x1f3a5f, jeans: 0x14213d, mochila: 0x8a5a35, mochila2: 0xfca311, suela: 0x111111 }
  };

  /** La caja misteriosa: casi siempre monedas, a veces una patineta y, muy rara vez, el premio gordo. */
  function cajaMisteriosa(azar) {
    const x = azar();                                                // un número al azar
    if (x < 0.05) return { monedas: 1000, gordo: true };             // 5 %: premio gordo
    if (x < 0.30) return { patineta: 1 };                            // 25 %: una patineta
    return { monedas: 100 + Math.floor(azar() * 9) * 50 };           // 70 %: de 100 a 500 monedas
  }

  /* ---------- Retos ----------
     Siempre hay tres. Algunos se cumplen en una sola carrera ("carrera") y
     otros se van sumando entre carreras ("total"). Cumplir los tres sube el
     multiplicador base en 1, hasta ×30. Las metas crecen con el nivel. */
  const RETOS = {
    monedas: { alcance: "carrera", meta: n => Math.min(1000, 150 + 25 * n), texto: m => `Junta ${m} monedas en una carrera` },
    monedasTotal: { alcance: "total", meta: n => 500 + 150 * n, texto: m => `Junta ${m} monedas en total` },
    saltos: { alcance: "carrera", meta: n => 20 + 3 * n, texto: m => `Salta ${m} veces en una carrera` },
    rodadas: { alcance: "carrera", meta: n => 10 + 2 * n, texto: m => `Rueda ${m} veces en una carrera` },
    distancia: { alcance: "carrera", meta: n => 800 + 250 * n, texto: m => `Corre ${m.toLocaleString("es-CL")} m en una carrera` },
    puntos: { alcance: "carrera", meta: n => 15000 * n, texto: m => `Haz ${m.toLocaleString("es-CL")} puntos en una carrera` },
    poderes: { alcance: "carrera", meta: n => 2 + Math.floor(n / 4), texto: m => `Recoge ${m} poderes en una carrera` },
    techos: { alcance: "carrera", meta: n => 3 + Math.floor(n / 2), texto: m => `Corre sobre ${m} trenes en una carrera` },
    estrellas: { alcance: "carrera", meta: n => 2 + Math.floor(n / 3), texto: m => `Junta ${m} estrellas en una carrera` },
    esquivar: { alcance: "carrera", meta: n => 5 + n, texto: m => `Esquiva ${m} trenes que vienen de frente en una carrera` },
    patinetas: { alcance: "total", meta: n => 1 + Math.floor(n / 10), texto: m => m === 1 ? "Usa una patineta" : `Usa ${m} patinetas en total` },
    mochilas: { alcance: "total", meta: n => 2 + Math.floor(n / 5), texto: m => `Recoge ${m} mochilas cohete en total` }
  };
  const TIPOS_RETO = Object.keys(RETOS);

  /** Los tres retos del nivel `nivel` (1 a 30). Salen de una semilla por nivel,
      así dos aparatos con el mismo nivel ven los mismos retos. */
  function retosDeNivel(nivel) {
    const n = limita(nivel | 0, 1, MAX_BASE);               // el nivel es el multiplicador base
    const azar = rng(0x7E70 + n * 977);                      // semilla fija por nivel
    const tipos = TIPOS_RETO.slice();                        // copia para ir sacando
    const elegidos = [];
    while (elegidos.length < 3) {
      const i = Math.floor(azar() * tipos.length);           // uno al azar de los que quedan
      elegidos.push(tipos.splice(i, 1)[0]);                  // y no se repite
    }
    return elegidos.map(tipo => {
      const R = RETOS[tipo], meta = R.meta(n);
      return { tipo, alcance: R.alcance, meta, texto: R.texto(meta) };
    });
  }

  /** Aplica una carrera terminada (o en curso) a los retos.
      `carrera` trae lo contado en esa carrera: {monedas, saltos, rodadas, distancia, puntos, poderes, techos, estrellas, esquivar, patinetas, mochilas}.
      `final` indica si la carrera terminó (entonces los de tipo "total" se suman).
      Devuelve {retos, cumplidos, subio}: el nuevo estado, los índices recién
      cumplidos y si subió el multiplicador base. No modifica lo que recibe. */
  function avanzaRetos(retosPrev, carrera, final) {
    const prev = retosPrev && retosPrev.nivel ? retosPrev : { nivel: 1, avance: [0, 0, 0] };
    const lista = retosDeNivel(prev.nivel);                  // los tres retos de este nivel
    const avance = prev.avance.slice(0, 3);
    while (avance.length < 3) avance.push(0);
    const cumplidos = [];
    lista.forEach((r, i) => {
      if (avance[i] >= r.meta) return;                       // ya estaba cumplido
      const v = (carrera && carrera[r.tipo === "monedasTotal" ? "monedas" : r.tipo]) || 0;   // lo hecho en esta carrera
      let nuevo = avance[i];
      if (r.alcance === "carrera") nuevo = Math.max(nuevo, v);          // en una carrera: se queda la mejor
      else if (final) nuevo = avance[i] + v;                            // en total: se suma al terminar
      else nuevo = Math.max(nuevo, Math.min(r.meta, avance[i] + v));    // en vivo: solo para mostrar si ya llegó
      avance[i] = Math.min(r.meta, nuevo);
      if (avance[i] >= r.meta) cumplidos.push(i);
    });
    const todos = lista.every((r, i) => avance[i] >= r.meta);
    if (final && todos && prev.nivel < MAX_BASE) return { retos: { nivel: prev.nivel + 1, avance: [0, 0, 0] }, cumplidos, subio: true };
    return { retos: { nivel: prev.nivel, avance }, cumplidos, subio: false };
  }

  /** Salta la misión `i` (la da por cumplida). Si con eso quedan las tres
      cumplidas, el set se completa en el acto: sube el multiplicador base.
      Devuelve {retos, subio}. No modifica lo que recibe. Ejemplo: en ×3
      con las misiones 0 y 2 cumplidas, saltar la 1 deja {nivel: 4, avance: [0,0,0]}. */
  function saltaReto(retosPrev, i) {
    const prev = retosPrev && retosPrev.nivel ? retosPrev : { nivel: 1, avance: [0, 0, 0] };
    const lista = retosDeNivel(prev.nivel);
    const avance = [0, 1, 2].map(k => prev.avance[k] || 0);
    if (!lista[i]) return { retos: { nivel: prev.nivel, avance }, subio: false };
    avance[i] = lista[i].meta;                                    // cumplida
    if (lista.every((r, k) => avance[k] >= r.meta) && prev.nivel < MAX_BASE) return { retos: { nivel: prev.nivel + 1, avance: [0, 0, 0] }, subio: true };
    return { retos: { nivel: prev.nivel, avance }, subio: false };
  }

  /* ---------- El progreso guardado ---------- */

  /** El progreso de alguien que nunca jugó. */
  function progresoNuevo() {
    return {
      v: 1, at: 0,                                           // versión y cuándo se guardó (ms)
      monedas: 0, patinetas: 1,                              // una patineta de regalo para probarla
      mejoras: { iman: 0, mochila: 0, zapatillas: 0, doble: 0 },
      potenciadores: { despegue: 1, puntos: 0 },             // un despegue de regalo para probarlo
      retos: { nivel: 1, avance: [0, 0, 0] },
      boletos: [],                                           // números de boleto encontrados
      aspectos: ["clasico"], aspecto: "clasico",             // los desbloqueados y el que lleva puesto
      records: { puntos: 0, distancia: 0, monedas: 0 },      // las mejores marcas locales
      totales: { carreras: 0, metros: 0, monedas: 0 },       // lo acumulado
      intro: false                                           // si ya vio la introducción
    };
  }
  const entero = (x, a = 0, b = 1e12) => limita(Math.floor(+x || 0), a, b);
  /** Limpia un progreso que vino de afuera (localStorage o la nube): deja solo
      campos conocidos y números razonables. Si algo no se entiende, se ignora. */
  function limpiaProgreso(x) {
    const p = progresoNuevo();
    if (!x || typeof x !== "object") return p;
    p.at = entero(x.at, 0, 1e15);
    p.monedas = entero(x.monedas, 0, 1e9);
    p.patinetas = entero(x.patinetas, 0, 999);
    if (x.potenciadores && typeof x.potenciadores === "object") for (const k of Object.keys(p.potenciadores)) p.potenciadores[k] = entero(x.potenciadores[k], 0, 999);
    for (const k of Object.keys(p.mejoras)) p.mejoras[k] = entero(x.mejoras && x.mejoras[k], 0, MAX_MEJORA);
    if (x.retos) p.retos = { nivel: entero(x.retos.nivel, 1, MAX_BASE), avance: [0, 1, 2].map(i => entero(x.retos.avance && x.retos.avance[i], 0, 1e9)) };
    p.boletos = Array.isArray(x.boletos) ? [...new Set(x.boletos.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 7))].sort((a, b) => a - b) : [];   // solo boletos que existen (1 a 7)
    p.aspectos = Array.isArray(x.aspectos) ? [...new Set(["clasico", ...x.aspectos.filter(a => ASPECTOS[a])])] : ["clasico"];
    p.aspecto = ASPECTOS[x.aspecto] && p.aspectos.includes(x.aspecto) ? x.aspecto : "clasico";
    for (const k of Object.keys(p.records)) p.records[k] = entero(x.records && x.records[k], 0, 1e12);
    for (const k of Object.keys(p.totales)) p.totales[k] = entero(x.totales && x.totales[k], 0, 1e12);
    p.intro = !!x.intro;
    return p;
  }
  /** Mezcla dos progresos (el del aparato y el de la nube).
      - Lo que se gasta (monedas, patinetas, potenciadores, aspecto puesto) viene del más reciente.
      - Lo que solo crece (mejoras, nivel de retos, boletos, aspectos, récords) se queda con lo mayor.
      Ejemplo: en el celular tienes el boleto 2 y en el PC el 1 → quedan los dos. */
  function mezclaProgreso(a, b) {
    const A = limpiaProgreso(a), B = limpiaProgreso(b);
    const nuevo = B.at > A.at ? B : A, viejo = nuevo === A ? B : A;   // el más reciente manda en lo gastable
    const m = limpiaProgreso(nuevo);
    for (const k of Object.keys(m.mejoras)) m.mejoras[k] = Math.max(A.mejoras[k], B.mejoras[k]);
    if (viejo.retos.nivel > m.retos.nivel) m.retos = viejo.retos;      // el nivel de retos nunca baja
    else if (viejo.retos.nivel === m.retos.nivel) m.retos.avance = m.retos.avance.map((v, i) => Math.max(v, viejo.retos.avance[i]));
    m.boletos = [...new Set([...A.boletos, ...B.boletos])].sort((x, y) => x - y);
    m.aspectos = [...new Set([...A.aspectos, ...B.aspectos])];
    for (const k of Object.keys(m.records)) m.records[k] = Math.max(A.records[k], B.records[k]);
    for (const k of Object.keys(m.totales)) m.totales[k] = Math.max(A.totales[k], B.totales[k]);
    m.intro = A.intro || B.intro;
    return m;
  }

  /* ---------- El generador de pista ----------
     Produce los objetos de la pista por bloques, siempre por delante del
     corredor. La idea que garantiza que todo se puede pasar es el CAMINO:
     un carril seguro que cambia como mucho de a un carril por fila. En el
     camino solo puede haber cosas que se saltan, se ruedan o se suben (una
     barrera baja, una alta, o una rampa con trenes). Los trenes que no se
     pueden pasar van en los otros carriles. Además, un carril ocupado por un
     tren largo o por un tren en marcha queda "reservado" hasta que se vacía,
     y el camino nunca se mete en un carril reservado.

     Tipos de objeto que salen de aquí:
       {tipo:"tren", carril, d0, largo, vel, dArribo}   d0 = el frente (lo más cercano); vel > 0 si viene hacia ti (m/s)
                                         y entonces dArribo = el metro donde se cruza contigo
       {tipo:"rampa", carril, d0, largo, alto}
       {tipo:"bajo", carril, d}  barrera que se salta
       {tipo:"alto", carril, d}  barrera que se pasa rodando
       {tipo:"moneda", carril, d, y}
       {tipo:"poder", clase, carril, d, y}   clase: iman | mochila | zapatillas | doble | caja
       {tipo:"estrella", carril, d, y}
       {tipo:"boleto", n, carril, d, y}
       {tipo:"tunel", d0, largo, estacion} */
  const VEL_TREN = 11;  // m/s a la que vienen los trenes en marcha (además de lo que corres tú)
  /* Un tren en marcha espera quieto hasta que el corredor está a APARECE
     metros del punto de cruce; ahí arranca. Tiene que esperar FUERA de la
     vista (se dibuja hasta 195 m por delante): con 120 m, a toda velocidad
     esperaba a 156 m, se veía quieto y parecía un tren estacionado más, así
     que nadie notaba que venían trenes de frente. Con 170 m espera a 295 m
     al empezar (15 m/s) y a 225 m a toda velocidad (34 m/s). Si arrancara
     desde que se genera, nacería a más de 300 m y reservaría su carril
     demasiado tiempo. */
  const APARECE = 170;
  /** Un tren que viene de frente y se cruza contigo en el metro `dArribo`,
      sabiendo que corres a `V` m/s: nace VEL_TREN·(APARECE/V) metros más allá. */
  function trenEnMarcha(carril, dArribo, V) {
    const d0 = dArribo + VEL_TREN * APARECE / Math.max(8, V || 13);
    return { tipo: "tren", carril, d0, largo: LARGO_VAGON, vel: VEL_TREN, dArribo };
  }

  /** La velocidad con que el corredor llega al metro `d` (sin contar choques),
      para poner los trenes que vienen de frente. Sale de la distancia y no
      de cuándo se genera la pista: así la pista depende solo de la semilla
      (el antitrampas la vuelve a generar igual, objeto por objeto). Antes se
      usaba la velocidad del cuadro en que se generaba el bloque, y eso movía
      un tren, el carril que dejaba libre y todo lo que venía después. Va
      redondeada a medio m/s para que ningún navegador la calcule distinta.
      Con la aceleración pareja es la de verdad (solo el redondeo la
      separa): a 1 080 m (1 min) da 21 m/s, y desde los 11,4 km, 50. Un tren
      que llega 1 m/s más lento de lo calculado se cruza ~2 m después de su
      fila: no se nota. */
  const velocidadEn = d => {
    const { V0, VMAX, ACEL } = VELOCIDAD;
    const v = Math.sqrt(V0 * V0 + 2 * ACEL * Math.max(0, d));   // con aceleración pareja: v² = V0² + 2·a·d
    return Math.round(2 * Math.min(VMAX, v)) / 2;               // con su tope, y redondeada a medio m/s
  };

  /* El tiempo mínimo entre dos filas de obstáculos. A 50 m/s, filas a 18 m
     llegaban cada 0,36 s: menos de lo que tarda una persona en reaccionar y
     cambiar de carril (el cambio solo ya son 0,17 s). Con 0,55 s el espacio
     crece con la velocidad, pero solo por encima de ~33 m/s; más abajo
     manda la distancia de siempre. Ejemplo: a 50 m/s, 27,5 m entre filas. */
  const FILA_MIN_S = 0.55;

  /** La dificultad entre 0 y 1 según los metros: llega al máximo a los
      ~7,7 km (antes a los ~9,3: el juego se sentía fácil). */
  const dificultad = d => limita((d - 250) / 7500, 0, 1);

  function crearGenerador(semilla) {
    const azar = rng(semilla >>> 0 || 1);        // el azar de esta pista
    let dSig = 60;                               // dónde empieza el próximo bloque (los primeros 60 m, libres)
    let camino = 1;                              // el carril seguro (empieza al centro, donde está el corredor)
    let mantener = 0;                            // filas en que el camino no debe cambiar (después de un convoy)
    const libre = [0, 0, 0];                     // desde qué metro cada carril vuelve a quedar libre
    let tunel = null;                            // {desde, estacion} si hay que poner un túnel
    let boleto = null;                           // {n, desde} si hay que poner un boleto
    let sigPoder = 320, sigEstrella = 420, sigCaja = 900;   // metros de los próximos regalos
    let nId = 0;                                 // contador para dar un id único a cada objeto
    let salida = [];                             // lo que devuelve el llamado en curso

    const emite = o => { o.id = ++nId; salida.push(o); return o; };   // agrega un objeto a la salida
    const elige = pesos => {                     // elige una clave según sus pesos {a: 2, b: 1}
      let t = azar() * Object.values(pesos).reduce((s, x) => s + x, 0);
      for (const [k, w] of Object.entries(pesos)) { if ((t -= w) < 0) return k; }
      return Object.keys(pesos)[0];
    };

    /** Una fila de monedas en el carril c, de d a d+largo, cada `paso` metros. */
    function filaMonedas(c, d, largo, y = 0.9, paso = 2.2) {
      for (let x = 0; x <= largo; x += paso) emite({ tipo: "moneda", carril: c, d: d + x, y });
    }
    /** Un arco de 5 monedas sobre una barrera baja en d (enseña dónde saltar). */
    function arcoMonedas(c, d) {
      for (let i = 0; i < 5; i++) { const dz = (i - 2) * 1.5; emite({ tipo: "moneda", carril: c, d: d + dz, y: 0.9 + 1.2 * (1 - (dz / 3.6) ** 2) }); }
    }
    /** Pone los regalos que tocan (poder, estrella, caja, boleto) en el carril c, metro d. */
    function regalos(c, d, y = 1.2) {
      if (boleto && d >= boleto.desde) { emite({ tipo: "boleto", n: boleto.n, carril: c, d, y: y + 0.3 }); boleto = null; return; }
      if (d >= sigCaja) { emite({ tipo: "poder", clase: "caja", carril: c, d, y }); sigCaja = d + 900 + azar() * 600; return; }
      if (d >= sigEstrella) { emite({ tipo: "estrella", carril: c, d, y }); sigEstrella = d + 420 + azar() * 160; return; }
      if (d >= sigPoder) {
        const clase = elige({ iman: 3, mochila: 2, zapatillas: 2.5, doble: 2.5 });
        emite({ tipo: "poder", clase, carril: c, d, y }); sigPoder = d + 300 + azar() * 220;
      }
    }
    /** El próximo camino: igual o uno al lado, nunca un carril reservado. */
    function siguienteCamino(dFila, prob) {
      if (mantener > 0) { mantener--; return camino; }
      const opciones = [camino - 1, camino + 1].filter(c => c >= 0 && c <= 2 && libre[c] <= dFila);
      if (opciones.length && azar() < prob) return opciones[Math.floor(azar() * opciones.length)];
      return camino;
    }

    /** Un bloque "fila": obstáculos en los carriles que no son el camino. */
    function bloqueFila(dif, ctx) {
      const esp = Math.max(lerp(30, 18, dif), velocidadEn(dSig) * FILA_MIN_S) + azar() * 5;   // distancia hasta la próxima fila (dSig es donde va esta fila)
      const dr = dSig;                                          // la fila va en este metro
      const sig = siguienteCamino(dr + esp, lerp(0.35, 0.6, dif));   // el camino de la fila siguiente
      let bloqueados = 0;                                       // cuántos carriles quedaron cerrados
      for (let c = 0; c < 3; c++) {
        if (libre[c] > dr) { bloqueados++; continue; }          // reservado: ya hay algo ahí (un tren largo o en marcha)
        if (c === camino) {                                     // el camino: barrera saltable/rodable o nada
          const r = azar();
          if (r < lerp(0.18, 0.42, dif)) { emite({ tipo: "bajo", carril: c, d: dr }); arcoMonedas(c, dr); }
          else if (r < lerp(0.3, 0.7, dif)) { emite({ tipo: "alto", carril: c, d: dr }); filaMonedas(c, dr - 3, 6, 0.5, 1.5); }
          else filaMonedas(c, dr - 4, Math.min(12, esp - 6));
          continue;
        }
        if (c === sig) {                                        // por donde pasará el camino: a lo más una barrera
          if (azar() < 0.3) emite({ tipo: azar() < 0.5 ? "bajo" : "alto", carril: c, d: dr });
          continue;
        }
        const r = azar();                                       // un carril cerrado de verdad
        if (r < lerp(0.16, 0.4, dif) && ctx && ctx.V > 0) {     // un tren que viene de frente
          const t = emite(trenEnMarcha(c, dr, velocidadEn(dr))); // se cruza contigo justo en la fila
          libre[c] = t.d0 + LARGO_VAGON + 6;                    // su carril queda reservado mientras pasa
          bloqueados++;
        } else if (r < lerp(0.55, 0.8, dif)) {                  // trenes detenidos, uno o dos vagones
          const n = azar() < lerp(0.3, 0.6, dif) ? 2 : 1;
          const conRampa = azar() < 0.35;                       // a veces con rampa (un atajo para subir)
          const d0 = dr + (conRampa ? LARGO_RAMPA : 0);
          if (conRampa) emite({ tipo: "rampa", carril: c, d0: dr, largo: LARGO_RAMPA, alto: ALTO_TECHO });
          for (let k = 0; k < n; k++) emite({ tipo: "tren", carril: c, d0: d0 + k * (LARGO_VAGON + 0.4), largo: LARGO_VAGON, vel: 0 });
          libre[c] = d0 + n * (LARGO_VAGON + 0.4) + 4;
          bloqueados++;
        } else if (r < 0.92) {                                  // una barrera (también cierra el carril si no saltas)
          emite({ tipo: azar() < 0.55 ? "bajo" : "alto", carril: c, d: dr });
          bloqueados++;
        }
      }
      if (!bloqueados) {                                        // nunca una fila vacía: al menos un tren
        const c = [0, 1, 2].find(x => x !== camino && x !== sig && libre[x] <= dr);
        if (c != null) { emite({ tipo: "tren", carril: c, d0: dr, largo: LARGO_VAGON, vel: 0 }); libre[c] = dr + LARGO_VAGON + 4; }
      }
      regalos(camino, dr + esp * 0.5);                          // un regalo a mitad de camino, si toca
      camino = sig;                                             // la fila siguiente usa el camino nuevo
      dSig = dr + esp;
    }

    /** Un convoy: rampa y dos o tres vagones en el camino, con monedas en los techos. */
    function bloqueConvoy(dif, ctx) {
      const dr = dSig, c = camino;
      const n = 2 + (azar() < dif ? 1 : 0) + (azar() < dif * 0.5 ? 1 : 0);   // de 2 a 4 vagones
      emite({ tipo: "rampa", carril: c, d0: dr, largo: LARGO_RAMPA, alto: ALTO_TECHO });
      const d0 = dr + LARGO_RAMPA;
      for (let k = 0; k < n; k++) emite({ tipo: "tren", carril: c, d0: d0 + k * (LARGO_VAGON + 0.4), largo: LARGO_VAGON, vel: 0 });
      const fin = d0 + n * (LARGO_VAGON + 0.4);
      for (let i = 1; i <= 3; i++) emite({ tipo: "moneda", carril: c, d: dr + i * 1.4, y: 0.75 + ALTO_TECHO * (i * 1.4 / LARGO_RAMPA) });   // monedas subiendo la rampa
      filaMonedas(c, d0 + 1, fin - d0 - 3, ALTO_TECHO + 0.9);  // monedas por los techos
      regalos(c, d0 + (fin - d0) * 0.55, ALTO_TECHO + 1.2);    // un regalo arriba, si toca
      libre[c] = fin + 2;
      for (let o = 0; o < 3; o++) {                             // los otros carriles
        if (o === c || libre[o] > dr) continue;
        const r = azar();
        if (r < lerp(0.16, 0.38, dif) && ctx && ctx.V > 0) {   // un tren que viene, al lado del convoy
          const t = emite(trenEnMarcha(o, dr + 10, velocidadEn(dr + 10))); libre[o] = t.d0 + LARGO_VAGON + 6;
        } else if (r < 0.7) {
          const m = 1 + Math.floor(azar() * 3);
          for (let k = 0; k < m; k++) emite({ tipo: "tren", carril: o, d0: dr + 6 + k * (LARGO_VAGON + 0.4), largo: LARGO_VAGON, vel: 0 });
          libre[o] = dr + 6 + m * (LARGO_VAGON + 0.4) + 4;
        }
      }
      mantener = 1;                                             // al bajar del convoy sigues en el mismo carril
      dSig = fin + Math.max(lerp(26, 18, dif), velocidadEn(fin) * FILA_MIN_S);
    }

    /** Un respiro: sin obstáculos, una cinta de monedas que zigzaguea entre carriles. */
    function bloqueRespiro() {
      const dr = dSig, largo = 60;
      let c = camino;
      for (let x = 0; x <= largo; x += 2.4) {
        if (x > 0 && Math.round(x / 2.4) % 8 === 0) {          // cada 8 monedas cambia de carril
          const op = [c - 1, c + 1].filter(k => k >= 0 && k <= 2 && libre[k] <= dr + x);
          if (op.length) c = op[Math.floor(azar() * op.length)];
        }
        if (libre[c] <= dr + x) emite({ tipo: "moneda", carril: c, d: dr + x, y: 0.9 });
      }
      if (libre[c] <= dr + largo) camino = c;
      regalos(camino, dr + largo + 4);
      dSig = dr + largo + 14;
    }

    /** El túnel que lleva a la próxima estación: nada que esquivar, solo monedas. */
    function bloqueTunel() {
      const d0 = Math.max(dSig, Math.max(...libre)) + 12;      // empieza cuando todos los carriles están libres
      const largo = 150;
      emite({ tipo: "tunel", d0, largo, estacion: tunel.estacion });
      filaMonedas(camino, d0 + 8, largo - 30);
      tunel = null;
      for (let c = 0; c < 3; c++) libre[c] = d0 + largo + 10;  // nada adentro ni a la salida
      dSig = d0 + largo + 22;
    }

    return {
      /** Genera bloques hasta pasar el metro `dLimite`. `ctx` = {V}: sin él
          (o con V 0) no hay trenes que vengan de frente, para las pruebas; la
          velocidad con que se ponen sale de la distancia (velocidadEn), no de
          ctx.V, para que la pista sea siempre la misma. Devuelve los objetos nuevos. */
      generarHasta(dLimite, ctx) {
        salida = [];
        while (dSig < dLimite) {
          const dif = dificultad(dSig);
          if (tunel && dSig >= tunel.desde) { bloqueTunel(); continue; }
          if (dSig < 140) { bloqueFila(0, ctx); continue; }     // el comienzo, suave
          const r = azar();
          if (r < lerp(0.08, 0.2, dif) && libre[camino] <= dSig) bloqueConvoy(dif, ctx);
          else if (r < lerp(0.08, 0.2, dif) + 0.07) bloqueRespiro();
          else bloqueFila(dif, ctx);
        }
        return salida;
      },
      /** Pide un túnel (cambio de estación) a partir del metro `desde`. */
      pedirTunel(desde, estacion) { tunel = { desde, estacion }; },
      /** Pide un boleto dorado a partir del metro `desde`. */
      pedirBoleto(n, desde) { boleto = { n, desde }; },
      /** Monedas en el aire para la mochila cohete: una cinta a 8,5 m que cambia
          de carril cada tanto, de `desde` a `hasta`. */
      monedasCielo(desde, hasta, carril) {
        salida = [];
        let c = carril == null ? 1 : carril;
        for (let d = desde, k = 0; d <= hasta; d += 2.6, k++) {
          if (k > 0 && k % 14 === 0) c = limita(c + (azar() < 0.5 ? -1 : 1), 0, 2);
          emite({ tipo: "moneda", carril: c, d, y: FISICA.alturaMochila + 0.6 });
        }
        return salida;
      },
      /** Para los tests y la pantalla: dónde va el próximo bloque y el camino actual. */
      estado() { return { dSig, camino, libre: libre.slice() }; }
    };
  }

  /* ---------- Lo que se exporta ---------- */
  return {
    rng, lerp, limita,
    CARRILES, LARGO_VAGON, ALTO_TECHO, LARGO_RAMPA, FISICA, impulso, VELOCIDAD, T_TOPE, velocidad, metrosEntre, FRENADA, velocidadEn, FILA_MIN_S, VEL_TREN, APARECE, dificultad,
    MEDIO_LARGO, MARGEN_TECHO, MARGEN_RAMPA, alturaRampa, soporte, caja,
    PUNTOS_POR_METRO, MAX_BASE, MAX_ESTRELLAS, multiplicador, puntosPorTramo,
    ESTACIONES, estacionDe, siguienteUmbral, VUELTA_DESDE, VUELTA_CADA, INTRO, BOLETOS,
    PODERES, SEG_POR_NIVEL, MAX_MEJORA, PRECIOS_MEJORA, PRECIO_PATINETA, DURACION_PATINETA, duracionPoder, precioMejora, costoSeguir,
    POTENCIADORES, costoSaltar, premioSet, saltaReto,
    ASPECTOS, cajaMisteriosa,
    RETOS, retosDeNivel, avanzaRetos,
    progresoNuevo, limpiaProgreso, mezclaProgreso,
    crearGenerador
  };
});
