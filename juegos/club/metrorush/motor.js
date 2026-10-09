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
  /* CITY: el mundo City (city.js) se instala sobre el motor recién armado,
     aquí y no en cada lugar que lo usa: así el juego, la prueba del
     antitrampas, el verificador del club y los tests ven el mismo City. En
     la página city.js se carga antes que este archivo (index.html). */
  const ciudad = typeof module === "object" && module.exports ? require("./city.js") : raiz.MetroRushCity;
  if (typeof ciudad === "function") ciudad(M);
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
  /* EL SALTO, COMO EN SUBWAY SURFERS (ronda 2)
     Antes el salto subía 1,5 m con gravedad 34 y duraba 0,59 s: se sentía
     bajo y apurado al lado del de Subway Surfers. Ahora sube 2,1 m y dura
     0,80 s en el suelo: el tiempo en el aire es 2·√(2h/g), así que con
     h = 2,1 y g = 26 da 2·√(4,2/26) = 0,804 s. Lo que NO cambia, a propósito:
       · la barrera alta (empieza a 1,0 m y termina a 2,35) sigue sin poder
         saltarse: 2,1 < 2,35, así que hay que rodar como siempre;
       · la barrera baja (0,95) se pasa con más margen: el corredor va por
         encima de ella 0,59 s (antes 0,36 s), el salto perdona más;
       · un salto normal no llega a un techo (2,1 < 3,35 − 0,5): para subir
         a los trenes siguen haciendo falta la rampa o las zapatillas;
       · desde un techo sube a 3,35 + 2,1 = 5,45 m: la cabeza queda a ~7,4 m,
         bajo los cables de la catenaria (ver ALTO_CABLE en mundo.js).
     Ni los metros ni los puntos dependen de la altura del salto, así que la
     prueba del antitrampas no cambia (no sube su VERSION). */
  const FISICA = {
    gravedad: 26,          // m/s²: más fuerte que la real (9,8) para que el salto se sienta ágil, pero menos que antes (34): flota más
    alturaSalto: 2.1,      // un salto normal: 2,1 m y 0,80 s en el aire (pasa la barrera baja, que mide 0,95; no la alta, que llega a 2,35)
    alturaZapatillas: 4.4, // con zapatillas saltarinas se llega holgado a los techos (3,35): 1,16 s en el aire
    tiempoRodar: 0.62,     // segundos que dura una rodada
    caidaRapida: 24,       // m/s hacia abajo si ruedas en el aire (el "golpe al suelo": de 2,1 m baja en menos de 0,1 s)
    cambioCarril: 0.17,    // segundos que tarda en pasar de un carril al de al lado
    alturaMochila: 8.5,    // la mochila cohete vuela a esta altura
    alturaPogo: 8.3,       // el pogo saltarín sube hasta aquí (muy por encima de los techos, 3,35)…
    subidaPogo: 3,         // …y nunca sube menos que esto, aunque se lance desde un techo
    gravedadPogo: 0.4,     // …y cae con el 40 % de la gravedad: ~2,5 s en el aire desde el suelo, como el de Subway Surfers
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
  const MARGEN_RAMPA = 0.4;
  /* Lo mismo de costado: un techo (o una rampa) te sostiene mientras su caja
     te pueda chocar, o sea hasta su medio ancho más el del corredor (0,98 +
     0,35 = 1,33 m del centro de su carril). Sostenía solo hasta 1,05 m, y los
     carriles están a 2,2: a mitad de un cambio de carril entre dos vagones
     quedabas a 1,1 m de cada uno, ninguno te sostenía, empezabas a caer y los
     dos te chocaban. Por eso un zigzag rápido de techo en techo mataba. */
  const ANCHO_TECHO = 0.98 + FISICA.medioAncho;
  const ANCHO_RAMPA = 0.95 + FISICA.medioAncho;              // lo mismo para la rampa: su caja también choca hasta 0,3 m después de su final

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
      if (Math.abs(x - CARRILES[o.carril]) >= ANCHO_RAMPA) continue;               // no está en mi carril
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
      if (Math.abs(x - CARRILES[o.carril]) >= ANCHO_TECHO) continue;
      if (yEf >= ALTO_TECHO - 0.5 && ALTO_TECHO >= h) { h = ALTO_TECHO; tren = o; }
    }
    /* CITY: los tipos nuevos que sostienen (la baranda de City, registrada
       con `soporte` en registraTipo) dicen su altura; gana la más alta. Los
       objetos de la Línea 3 no tienen tipo registrado, así que el clásico no
       pasa por aquí. `apoyo` es el objeto que te sostiene (para el grind). */
    let apoyo = null;
    for (const o of objs) {
      const t = TIPOS[o.tipo];
      if (!t || !t.soporte) continue;
      const hs = t.soporte(o, x, D, yEf);
      if (hs != null && hs > h) { h = hs; apoyo = o; tren = null; }
    }
    return { h, tren, apoyo };
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
    const t = TIPOS[o.tipo];                                 // un tipo nuevo de algún mundo (registraTipo)
    return t && t.caja ? t.caja(o, D) : null;
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

  /** Arma una CURVA de velocidad a partir de {V0, VMAX, ACEL}: todo lo que
      sale de ella en un solo objeto, para que el juego, el generador y el
      antitrampas la lean del mismo lugar. Así un mundo o un modo (ver MODOS
      y MUNDOS más abajo) puede tener su propia curva sin copiar fórmulas.
      La clásica (CURVA) es exactamente la de siempre: las mismas cuentas,
      en el mismo orden, para que la pista y las pruebas viejas no cambien
      ni en un bit. Los números se leen de V en cada llamada (no se copian),
      igual que antes se leía VELOCIDAD.
      Ejemplo: hazCurva({V0: 15, VMAX: 50, ACEL: 0.1}).velocidad(60) → 21. */
  function hazCurva(V) {
    const T_TOPE = (V.VMAX - V.V0) / V.ACEL;                 // cuándo llega al tope (la clásica, a los 350 s)
    /** Velocidad de la carrera (m/s) a los `t` segundos. Ejemplo: a los 0 s,
        15; a los 60 s, 21; a los 120 s, 27; desde los 350 s, 50. */
    function velocidad(t) {
      const { V0, VMAX, ACEL } = V;
      return Math.min(VMAX, V0 + ACEL * Math.max(0, t));    // sube parejo y se queda en el tope
    }
    /** Los metros corridos desde el comienzo hasta el segundo `t`: la integral
        de `velocidad`. Hasta el tope, V0·t + ACEL·t²/2; después, a VMAX. */
    function metrosHasta(t) {
      const { V0, VMAX, ACEL } = V;
      const tope = (VMAX - V0) / ACEL;                       // se recalcula: la curva se lee viva
      const tt = Math.max(0, t), subiendo = Math.min(tt, tope);         // el tramo en que todavía acelera
      return V0 * subiendo + ACEL * subiendo * subiendo / 2 + VMAX * (tt - subiendo);
    }
    /** Los metros que se corren entre los tiempos de juego a y b. Ejemplo: de
        0 a 10 s, 155 m; de 0 a 60 s, 1 080 m. */
    const metrosEntre = (a, b) => metrosHasta(b) - metrosHasta(a);
    /** La velocidad con que el corredor llega al metro `d` (sin choques),
        redondeada a medio m/s: la usa el generador (ver velocidadEn abajo). */
    const velocidadEn = d => {
      const { V0, VMAX, ACEL } = V;
      const v = Math.sqrt(V0 * V0 + 2 * ACEL * Math.max(0, d));   // con aceleración pareja: v² = V0² + 2·a·d
      return Math.round(2 * Math.min(VMAX, v)) / 2;               // con su tope, y redondeada a medio m/s
    };
    return { VELOCIDAD: V, T_TOPE, velocidad, metrosHasta, metrosEntre, velocidadEn };
  }
  const CURVA = hazCurva(VELOCIDAD);                         // la curva clásica (la de la Línea 3)
  const T_TOPE = CURVA.T_TOPE;                               // a los 350 s llega al tope
  const velocidad = CURVA.velocidad;                         // los nombres de siempre, para quien ya los usa
  const metrosHasta = CURVA.metrosHasta;
  const metrosEntre = CURVA.metrosEntre;

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

  /* ---------- Estaciones (cambian con la distancia) ----------
     Cada estación tiene su estilo de dibujo (juguete, pixel o neón), su
     paleta de colores, su música y un boleto dorado con un trozo de la
     historia. Se entra a cada una por un túnel. `desde` son METROS de la
     carrera: antes eran puntos, y como los puntos van × el multiplicador,
     quien tenía ×30 pasaba por todas las estaciones treinta veces más
     rápido que quien empezaba. Por distancia, todos las ven en el mismo
     punto de la vía.

     SON DIEZ (eran siete: se sumaron Mercado de Farolillos, Cocheras y
     Muelle). Con diez, los umbrales se repartieron de nuevo para que todas
     quepan con el mismo ritmo: con la velocidad de la carrera (ver
     VELOCIDAD) cada una llega ~55 s después de la anterior y la primera
     pasado el minuto (Ocaso a 1 min 06 s, Mercado a 2:01, Línea Neón a
     2:57, Estación Fantasma a 3:52, Cocheras a 4:47, Invierno a 5:42,
     Muelle a 6:37, Óxido a 7:32 y el Fin de la Línea a 8:27). El test de
     motor exige al menos 50 s entre una y otra. Los túneles los pide el
     juego y quedan en la prueba, así que mover los umbrales no cambia la
     pista de una semilla (los hashes del clásico sin pedidos siguen igual)
     ni invalida pruebas viejas: cada una trae sus pedidos.

     El número del boleto es su NOMBRE, no su orden: los 1 a 7 son los de
     siempre (los que ya tiene guardados cada jugador) y los de las
     estaciones nuevas son 8, 9 y 10. El orden en la historia es el de la
     vía, y es el que muestra la Libreta («Boleto 3 de 10»).

     Después de la última, giran Barrio, Ocaso y Línea Neón cada 4 km
     ("vuelta 2", "vuelta 3"…), como antes: `vuelta.ids` las nombra para
     que no dependan de su lugar en la lista. */
  const ESTACIONES = [
    { id: "barrio", nombre: "Barrio Estación", desde: 0, estilo: "juguete", paleta: "barrio", musica: "metrorush-barrio", lema: "Donde empieza la Línea 3", boleto: 1 },
    { id: "ocaso", nombre: "Ocaso", desde: 1200, estilo: "pixel", paleta: "ocaso", musica: "metrorush-ocaso", lema: "El sol se pone entre los rieles", boleto: 2 },
    { id: "mercado", nombre: "Mercado de Farolillos", desde: 2550, estilo: "juguete", paleta: "mercado", musica: "metrorush-mercado", lema: "Los puestos no cierran esta noche", boleto: 8 },
    { id: "neon", nombre: "Línea Neón", desde: 4200, estilo: "neon", paleta: "neon", musica: "metrorush-neon", lema: "De noche la vía se enciende sola", boleto: 3 },
    { id: "fantasma", nombre: "Estación Fantasma", desde: 6150, estilo: "neon", paleta: "fantasma", musica: "metrorush-fantasma", lema: "Aquí no para un tren desde 2006", boleto: 4 },
    { id: "cocheras", nombre: "Cocheras", desde: 8400, estilo: "pixel", paleta: "cocheras", musica: "metrorush-cocheras", lema: "Donde duermen los trenes viejos", boleto: 9 },
    { id: "invierno", nombre: "Invierno", desde: 10950, estilo: "juguete", paleta: "invierno", musica: "metrorush-invierno", lema: "Nieva sobre los rieles", boleto: 5 },
    { id: "muelle", nombre: "Muelle", desde: 13700, estilo: "neon", paleta: "muelle", musica: "metrorush-muelle", lema: "La línea que iba a llegar al mar", boleto: 10 },
    { id: "oxido", nombre: "Óxido", desde: 16450, estilo: "pixel", paleta: "oxido", musica: "metrorush-oxido", lema: "Más allá del mapa", boleto: 6 },
    // la paleta "fin" es la del alba con la historia (afiches, grafitis): "alba" queda limpia para City, que la reusa
    { id: "fin", nombre: "Fin de la Línea", desde: 19200, estilo: "juguete", paleta: "fin", musica: "metrorush-fin", lema: "Aquí se acaban las vías… ¿o no?", boleto: 7 }
  ];
  const VUELTA_DESDE = 23200, VUELTA_CADA = 4000;   // desde los 23,2 km (80 s después del Fin), una de las tres primeras cada 4 km
  const VUELTA_IDS = ["barrio", "ocaso", "neon"];    // las que giran: una de cada estilo, como siempre

  /** La estación que corresponde a los `metros` corridos, en el mundo del
      `modo` (sin modo, la Línea 3 de siempre). Devuelve una copia con
      `clave` (distinta en cada vuelta, para saber cuándo hay que cambiar).
      Un mundo sin `vuelta` se queda en su última estación para siempre. */
  function estacionDe(metros, modo) {
    const W = mundoDe(modo), lista = W.estaciones, V = W.vuelta;   // el mundo, sus estaciones y cómo giran
    const p = Math.max(0, metros || 0);
    if (!V || p < V.desde) {
      let e = lista[0];
      for (const x of lista) if (p >= x.desde) e = x;        // la última cuyo umbral ya pasaste
      return Object.assign({}, e, { clave: e.id, vuelta: 1 });
    }
    const k = Math.floor((p - V.desde) / V.cada);            // cuántos giros van desde el comienzo de las vueltas
    // barrio, ocaso, neón, barrio… (con `ids`, por su nombre; sin ellos, las n primeras de la lista, como en City)
    const base = V.ids ? lista.find(x => x.id === V.ids[k % V.ids.length]) || lista[0] : lista[k % V.n];
    const vuelta = 2 + Math.floor(k / V.n);                  // la vuelta en que vas
    return Object.assign({}, base, { nombre: `${base.nombre} · vuelta ${vuelta}`, clave: `${base.id}-${k}`, vuelta, boleto: null });
  }
  /** Los metros a los que empieza la estación siguiente (para la barra del
      HUD). Infinity si el mundo ya no tiene otra (un mundo sin vueltas). */
  function siguienteUmbral(metros, modo) {
    const W = mundoDe(modo), V = W.vuelta;
    const p = Math.max(0, metros || 0);
    for (const x of W.estaciones) if (x.desde > p) return x.desde;
    if (!V) return Infinity;
    if (p < V.desde) return V.desde;
    return V.desde + (Math.floor((p - V.desde) / V.cada) + 1) * V.cada;
  }

  /* ---------- La historia ----------
     Diez boletos dorados, uno por estación, que juntos cuentan la última
     noche de la Línea 3 de principio a fin: el cierre (Barrio, Ocaso), las
     pistas de quién maneja el último tren (Mercado, Neón, Fantasma), la
     revelación en las Cocheras, el porqué (Invierno, Muelle, Óxido) y el
     final al amanecer. Se leen en la Libreta en el orden de la vía. En la
     carrera, la historia también se ve y se oye (afiches, grafitis y el
     altavoz del andén): eso vive en historia.js, que no decide nada.

     `titulo` es el nombre del capítulo; el número que se muestra («Boleto
     3 de 10») sale del orden de ESTACIONES (ver capituloDe). Los personajes:
     tú (sin nombre), Don Ramón Ibarra (el inspector), su perro Tornillo y
     Marta Quiroga, la maquinista del 317, el primer tren de la línea. */
  const INTRO = "La Línea 3 cierra mañana. Esta noche, el último tren no para en ninguna estación… y tú vas a correr toda la vía antes de que apaguen las luces. Don Ramón, el inspector, y su perro Tornillo vienen detrás. Nadie sabe quién maneja ese último tren.";
  const BOLETOS = [
    null,  // (los boletos se cuentan desde el 1; el número es su nombre, no su orden: ver ESTACIONES)
    { titulo: "El letrero de la boletería", texto: "En la boletería hay un letrero escrito a mano: «Último servicio, 23:59. No se detiene en ninguna estación». Abajo, con otra letra: «Ni lo intenten. —M.». En el barrio nadie sabe quién es M. Don Ramón dice que él sí sabe, pero se hace el leso." },
    { titulo: "Cero multas", texto: "Don Ramón lleva cuarenta años de inspector y nunca ha multado a nadie. Tornillo nunca ha mordido a nadie. Hoy es su último turno, y aun así te persigue. Quizás no quiere atraparte. Quizás solo no quiere quedarse quieto mientras le cierran la línea." },
    { titulo: "Alguien enciende la vía", texto: "De noche la vía se enciende sola, letrero por letrero, un poco antes de que llegues. En la vitrina de un bar se refleja la cabina del último tren: alguien con una trenza gris va apretando interruptores, y lleva puesta una gorra de maquinista." },
    { titulo: "Se busca: Marta Quiroga", texto: "Le dicen Estación Fantasma porque aquí no para ningún tren desde 2006. Ese año la empresa mandó a desguace el 317, el primer tren de la línea. Esa noche el 317 desapareció de las cocheras, y su maquinista, Marta Quiroga, también. Los carteles de «SE BUSCA» siguen aquí. Alguien les dibujó un bigote. Alguien más se lo borró." },
    { titulo: "Dos termos", texto: "Nieva sobre los rieles. En el andén hay un termo con una nota: «Para la que maneja de noche. —R.». Al lado hay otro, más abollado: «Para el que inspecciona. —M.». Los dos siguen calientes. Hace veinte años que se dejan café en este andén y nunca coinciden." },
    { titulo: "Rieles tibios", texto: "La línea sigue más allá del mapa. Los rieles están tibios: el 317 acaba de pasar. Durante veinte años Marta manejó de noche por las vías que nadie usa, para que no se oxidaran del todo. Esta noche es la última vez, y por primera vez en veinte años va a frenar." },
    { titulo: "Válido", texto: "Amanece. El 317 espera en el último andén, con la puerta abierta. Marta baja con su gorra de vuelta y dos cafés. Don Ramón llega sin aire; ella le pasa uno: «Te lo debía desde 1986». Y él, por fin, atrapa a alguien: a ti. Te pica el boleto. «Válido», dice, «para todos los viajes que queden». Tornillo mueve la cola." },
    { titulo: "Objetos perdidos", texto: "En el mercado, el puesto de objetos perdidos vende lo que nadie reclamó en cuarenta años: paraguas, un acordeón, una dentadura. Lo único que no está a la venta es una gorra de maquinista con un nombre bordado: M. QUIROGA. «Esa la vienen a buscar», dice la señora. «Esta noche.»" },
    { titulo: "La pizarra de 1986", texto: "En las cocheras duermen los trenes viejos, cada uno en su vía. La 7 está vacía. En la pizarra del turno sigue escrito con tiza, de 1986: «Viaje inaugural, 317. Maquinista: M. Quiroga. Inspector en práctica: R. Ibarra, 19 años». Tornillo olfatea la vía vacía y mueve la cola." },
    { titulo: "Hasta el mar", texto: "La Línea 3 iba a llegar al mar. Lo dicen los planos de 1986 que se mojan en la caseta del muelle: la vía seguía derecho hasta el agua. Nunca la terminaron. Pero estos rieles brillan bajo la lluvia, sin una mancha de óxido, como si alguien los limpiara cada noche." }
  ];
  /** El lugar de un boleto en la historia (1 = el primero de la vía) y cuántos hay en el mundo. Ejemplo: el boleto 8 (Mercado) es el capítulo 3 de 10. */
  function capituloDe(n, modo) {
    const lista = mundoDe(modo).estaciones.filter(e => e.boleto);
    return { n: lista.findIndex(e => e.boleto === n) + 1, de: lista.length };
  }

  /* ---------- Los mundos (dónde se corre) ----------
     Un MUNDO es el lugar de la carrera: sus estaciones, cómo giran después
     de la última, su historia (intro y boletos), su curva de velocidad y,
     si quiere, sus propios bloques de pista. Hoy hay dos:
       · metro: la Línea 3 de siempre (ESTACIONES, BOLETOS, VELOCIDAD);
       · city: la ciudad de los modos City. Aquí queda un ARMAZÓN (una
         estación, sin boletos, la curva clásica) que city.js llena al
         instalarse: cinco distritos con vuelta, su curva, sus postales, sus
         personajes y su propio bloque de pista (ver city.js).

     CÓMO SE LLENA CITY (para quien venga después)
       - Estaciones: agregar filas a ESTACIONES_CITY ({id, nombre, desde (m),
         estilo, paleta, musica, lema, boleto}). La paleta es una clave de
         PALETAS en mundo.js (una paleta nueva se agrega allá). Si se quiere
         que giren como en la Línea 3, poner `vuelta: {desde, cada, n}` en
         MUNDOS.city.
       - Historia: INTRO_CITY y BOLETOS_CITY (el índice 0 vacío, como
         BOLETOS). Un boleto pedido con un número que no está aquí lo
         rechaza el antitrampas.
       - Velocidad: cambiar MUNDOS.city.velocidad ({V0, VMAX, ACEL}). La leen
         el juego, el generador (velocidadEn) y el antitrampas (metrosEntre)
         por velocidadDe(modo): no hay que tocar nada más. Ojo: cambiarla
         invalida las pruebas City ya guardadas.
       - Pista: MUNDOS.city.generador = { bloque(api, dif) {...} } (ver
         crearGenerador). Devuelve true si puso un bloque.
       - Objetos nuevos: registraTipo("autobus", { caja: (o, D) => ({...}) })
         para que choquen (M.caja los conoce); mundo.js tiene que saber
         dibujarlos (nuevo/suelta/paso) y juego.js, si se recogen, en recoge().
       - Personajes: MUNDOS.city.personajes (null = los ASPECTOS de siempre). */
  const ESTACIONES_CITY = [
    { id: "city-centro", nombre: "City · Centro", desde: 0, estilo: "juguete", paleta: "alba", musica: "metrorush-barrio", lema: "La ciudad no duerme: corre entre sus calles", boleto: null }
  ];
  const INTRO_CITY = "La Línea 3 llegó a la ciudad. Aquí las vías cruzan las calles, y Don Ramón conoce cada esquina… o eso cree.";
  const BOLETOS_CITY = [null];                              // los boletos de City (todavía ninguno)
  const MUNDOS = {
    metro: { id: "metro", nombre: "Línea 3", estaciones: ESTACIONES, vuelta: { desde: VUELTA_DESDE, cada: VUELTA_CADA, n: 3, ids: VUELTA_IDS },
      intro: INTRO, boletos: BOLETOS, velocidad: VELOCIDAD, generador: null, personajes: null, tema: "metrorush-barrio" },
    city: { id: "city", nombre: "City", estaciones: ESTACIONES_CITY, vuelta: null,
      intro: INTRO_CITY, boletos: BOLETOS_CITY, velocidad: VELOCIDAD, generador: null, personajes: null, tema: "metrorush-barrio" }
  };

  /* ---------- Los modos de juego ----------
     Un MODO es un juego de reglas sobre un mundo. Cada uno tiene su tabla en
     la clasificación (`categoria`) y dice qué se permite:
       items          poderes y cajas misteriosas en la pista
       potenciadores  Despegue y +5 al empezar
       patineta       usar patinetas
       revivir        «¿Seguir corriendo?» después de un choque
       monedasMatan   tocar una moneda termina la carrera (como un choque de frente)
       mundo          la clave de MUNDOS
       fantasma       se corre contra el fantasma del n.º 1 de su propia tabla
                      (con su misma semilla, para que la pista sea la misma; ver
                      `semillaSiguiente` en juego.js y el campo `g` de la prueba)
     El clásico es el juego de siempre: su pista y sus pruebas son las de
     antes de que hubiera modos (una prueba sin `m` es del clásico), y es el
     único con tabla de distancia (`distancia: true`). `corto` va en la
     insignia del marcador; `desc`, en la portada. */
  const MODOS = {
    clasico: { id: "clasico", nombre: "Clásico", corto: "Clásico", desc: "El de siempre: poderes, patineta, potenciadores y seguir corriendo.",
      categoria: "club-metrorush-carrera", items: true, potenciadores: true, patineta: true, revivir: true, monedasMatan: false, mundo: "metro", distancia: true },
    puro: { id: "puro", nombre: "Sin ayudas", corto: "Sin ayudas", desc: "Sin poderes, cajas, patineta ni potenciadores, y sin segunda oportunidad. Solo monedas y estrellas.",
      categoria: "club-metrorush-puro", items: false, potenciadores: false, patineta: false, revivir: false, monedasMatan: false, mundo: "metro" },
    sinmonedas: { id: "sinmonedas", nombre: "Sin monedas", corto: "Sin monedas", desc: "Las monedas queman: tocar una termina la carrera. Sin poderes ni ayudas.",
      categoria: "club-metrorush-sinmonedas", items: false, potenciadores: false, patineta: false, revivir: false, monedasMatan: true, mundo: "metro" },
    city: { id: "city", nombre: "City", corto: "City", desc: "La ciudad, con todos los poderes y ayudas.",
      categoria: "club-metrorush-city", items: true, potenciadores: true, patineta: true, revivir: true, monedasMatan: false, mundo: "city" },
    citypuro: { id: "citypuro", nombre: "City sin ayudas", corto: "City puro", desc: "La ciudad sin poderes, cajas, patineta ni potenciadores, y sin segunda oportunidad.",
      categoria: "club-metrorush-citypuro", items: false, potenciadores: false, patineta: false, revivir: false, monedasMatan: false, mundo: "city" },
    /* Los dos «Fantasma»: las reglas de Sin ayudas, y además se corre contra
       el fantasma de la mejor carrera de su propia tabla. El fantasma (traerlo,
       dibujarlo, anotarlo) lo hace otro trabajo; aquí quedan los ganchos: la
       semilla elegible al empezar y el campo `g` de la prueba. */
    fantasma: { id: "fantasma", nombre: "Fantasma", corto: "Fantasma", desc: "Sin ayudas, contra el fantasma de la mejor carrera de esta tabla, en su misma pista.",
      categoria: "club-metrorush-fantasma", items: false, potenciadores: false, patineta: false, revivir: false, monedasMatan: false, mundo: "metro", fantasma: true },
    cityfantasma: { id: "cityfantasma", nombre: "City fantasma", corto: "City fantasma", desc: "La ciudad sin ayudas, contra el fantasma de la mejor carrera de esta tabla.",
      categoria: "club-metrorush-cityfantasma", items: false, potenciadores: false, patineta: false, revivir: false, monedasMatan: false, mundo: "city", fantasma: true }
  };
  const ORDEN_MODOS = ["clasico", "puro", "sinmonedas", "fantasma", "city", "citypuro", "cityfantasma"];   // el orden en que se muestran
  /** El modo de una clave. Sin clave (null, undefined o "") es el clásico,
      que es lo que dice una prueba vieja sin `m`; una clave que no existe da
      null (el antitrampas la rechaza). También acepta el objeto del modo. */
  function modoDe(id) {
    if (id && typeof id === "object") return MODOS[id.id] === id ? id : null;
    if (id == null || id === "") return MODOS.clasico;
    return Object.prototype.hasOwnProperty.call(MODOS, id) ? MODOS[id] : null;
  }
  /** El modo cuya tabla es `categoria` (null si ninguno; la distancia es del clásico). */
  function modoDeCategoria(categoria) {
    if (categoria === "club-metrorush-distancia") return MODOS.clasico;
    return ORDEN_MODOS.map(k => MODOS[k]).find(m => m.categoria === categoria) || null;
  }
  /** El mundo de un modo (o de una clave de modo). Sin modo, la Línea 3. */
  const mundoDe = modo => MUNDOS[(modoDe(modo) || MODOS.clasico).mundo] || MUNDOS.metro;
  /** La historia de un modo: la intro, los boletos y las estaciones de su mundo. */
  const historiaDe = modo => { const W = mundoDe(modo); return { intro: W.intro, boletos: W.boletos, estaciones: W.estaciones }; };
  /** La curva de velocidad de un modo: la de su modo (si trae `velocidad`)
      o la de su mundo. Se arma una vez por objeto {V0, VMAX, ACEL} y se
      guarda: la clásica es CURVA, la misma de siempre. */
  const curvas = new Map([[VELOCIDAD, CURVA]]);
  function velocidadDe(modo) {
    const m = modoDe(modo) || MODOS.clasico;
    const V = m.velocidad || mundoDe(m).velocidad || VELOCIDAD;
    if (!curvas.has(V)) curvas.set(V, hazCurva(V));
    return curvas.get(V);
  }

  /* Tipos de objeto de pista nuevos (los que agregue un mundo): `caja(o, D)`
     dice qué espacio ocupan para los choques, con la misma forma que M.caja.
     Los tipos de siempre (tren, rampa, bajo, alto) no pasan por aquí. */
  const TIPOS = {};
  /** Registra un tipo de objeto nuevo. Ejemplo: registraTipo("valla", { caja: o => ({ z0: o.d - .2, z1: o.d + .2, y0: 0, y1: 1, w: .95 }) }). */
  function registraTipo(tipo, def) { if (tipo && def) TIPOS[tipo] = def; return TIPOS[tipo]; }

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
  /* Los precios de la tienda subieron ×10 (las mejoras eran de 250 a 5 000 y
     la patineta 300): con lo que se junta en unas pocas carreras se compraba
     todo, y una tienda que se vacía en una tarde deja de ser una meta. */
  const PRECIOS_MEJORA = [2500, 6000, 12000, 25000, 50000];   // lo que cuesta pasar al nivel 1, 2, 3, 4, 5
  const PRECIO_PATINETA = 3000;                      // una patineta, en monedas del juego
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
    despegue: { nombre: "Despegue", precio: 15000, seg: 7, texto: "Empiezas la carrera volando con la mochila cohete, 7 s" },
    puntos: { nombre: "Potenciador +5", precio: 25000, extra: 5, texto: "+5 al multiplicador durante toda una carrera" }
  };
  /** Saltar una misión cuesta más mientras más alto el multiplicador. Ejemplo:
      en ×1, 2 750; en ×10, 9 500 (subió ×5: saltarse las misiones salía más
      barato que cumplirlas). */
  const costoSaltar = nivel => 2000 + 750 * limita(nivel | 0, 1, MAX_BASE);
  /** Lo que paga completar un set de tres misiones (además de subir el multiplicador). Ejemplo: el set de ×4 paga 450. */
  const premioSet = nivel => 250 + 50 * limita(nivel | 0, 1, MAX_BASE);
  /** Seguir después de chocar: 500, 1000, 2000… monedas (se duplica en cada carrera). */
  const costoSeguir = veces => 500 * Math.pow(2, Math.max(0, veces | 0));

  /* Los aspectos del corredor: colores de la ropa. Dos son secretos. */
  const ASPECTOS = {
    clasico: { nombre: "Clásico", precio: 0, sudadera: 0xff5a3c, gorra: 0x2a6df4, jeans: 0x3b5ba8, mochila: 0x1fb5a0, mochila2: 0xffd23f, suela: 0xe8463b },
    nocturno: { nombre: "Nocturno", precio: 15000, sudadera: 0x2b2d42, gorra: 0x8d99ae, jeans: 0x1d1e2c, mochila: 0xef233c, mochila2: 0xedf2f4, suela: 0xef233c },
    grafitero: { nombre: "Grafitero", precio: 30000, sudadera: 0x7b2ff7, gorra: 0x00f5d4, jeans: 0x22223b, mochila: 0xfee440, mochila2: 0xf15bb5, suela: 0x00f5d4 },
    /* --- Las corredoras (ronda 2) ---
       Cuatro personajes nuevos con silueta propia: `rasgos` (peinado,
       tocado, falda, lentes, aros; mundo.js, «Los rasgos») cambia el
       muñeco, no solo los colores. Sin gorra: `gorra` es el color del
       tocado y de los elásticos. `jeans` pinta las piernas (calzas o
       medias). Precios entre los de siempre y un poco más arriba, para
       que haya algo nuevo que juntar en cada tramo. */
    paloma: { nombre: "Paloma", precio: 20000, sudadera: 0x16c2b0, gorra: 0xff4f9a, jeans: 0x1d1e2c, mochila: 0xff4f9a, mochila2: 0xfff3b0, suela: 0xff4f9a,
      rasgos: { pelo: 0x4a2a18, peinado: "coleta", tocado: "cintillo" } },                       // cola de caballo alta, cintillo y calzas: la deportista
    trini: { nombre: "Trini", precio: 25000, sudadera: 0xe8463b, gorra: 0x2b2d42, jeans: 0x2b2d42, mochila: 0xffd23f, mochila2: 0x2b2d42, suela: 0x2b2d42,
      rasgos: { pelo: 0xc8742c, peinado: "trenzas", tocado: "boina", falda: 0xe8463b } },     // dos trenzas, boina y vestido rojo
    luz: { nombre: "Luz", precio: 35000, sudadera: 0xf5f1e6, gorra: 0x7b5cd6, jeans: 0x3a3f55, mochila: 0x7b5cd6, mochila2: 0xf5f1e6, suela: 0x7b5cd6,
      rasgos: { pelo: 0x1d1a22, peinado: "larga", lentes: true, falda: 0x5b3fa8 } },          // melena larga, lentes redondos y falda morada
    maite: { nombre: "Maite", precio: 45000, sudadera: 0xffb703, gorra: 0x3a86ff, jeans: 0x3a86ff, mochila: 0x3a86ff, mochila2: 0xffb703, suela: 0xffffff,
      rasgos: { pelo: 0x2a1610, peinado: "monos", aros: true, falda: 0x3a86ff } },            // dos moños, aros dorados y falda azul
    dorado: { nombre: "Dorado", precio: null, secreto: "Teclea el código de siempre en la portada (↑ ↑ ↓ ↓ ← → ← → B A).", sudadera: 0xd4a017, gorra: 0xffe066, jeans: 0x8a6d1a, mochila: 0xffd23f, mochila2: 0xfff3b0, suela: 0xffe066 },
    inspector: { nombre: "Inspector", precio: null, secreto: "Encuentra todos los boletos dorados de la Línea 3.", sudadera: 0x1f3a5f, gorra: 0x1f3a5f, jeans: 0x14213d, mochila: 0x8a5a35, mochila2: 0xfca311, suela: 0x111111 }
  };

  /** La caja misteriosa: casi siempre monedas, a veces una patineta o un
      pogo saltarín y, muy rara vez, el premio gordo. El pogo sale solo de
      aquí (no lo pone el generador de pista), así la pista sigue dependiendo
      solo de la semilla y las pruebas del antitrampas no cambian. */
  function cajaMisteriosa(azar) {
    const x = azar();                                                // un número al azar
    if (x < 0.05) return { monedas: 1000, gordo: true };             // 5 %: premio gordo
    if (x < 0.25) return { patineta: 1 };                            // 20 %: una patineta
    if (x < 0.45) return { pogo: true };                             // 20 %: el pogo saltarín, de una
    return { monedas: 100 + Math.floor(azar() * 9) * 50 };           // 55 %: de 100 a 500 monedas
  }
  /* La súper caja misteriosa, como la de Subway Surfers: se compra en la
     tienda y se abre en el menú. Siempre da algo bueno; lo que da en monedas
     sueltas vale en promedio ~3 500, menos que su precio, así que no sirve
     para fabricar monedas: lo que la hace valer son los potenciadores y las
     patinetas. */
  const PRECIO_SUPERCAJA = 9000;
  function cajaSuper(azar) {
    const x = azar();
    if (x < 0.05) return { monedas: 50000, gordo: true };                 // 5 %: el premio gordo de verdad
    if (x < 0.15) return { potenciador: "puntos" };                       // 10 %: un Potenciador +5
    if (x < 0.35) return { potenciador: "despegue" };                     // 20 %: un Despegue
    if (x < 0.60) return { patinetas: 3 };                                // 25 %: tres patinetas
    return { monedas: 2500 + Math.floor(azar() * 16) * 500 };             // 40 %: de 2 500 a 10 000 monedas
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

  /** El récord local de la mejor carrera en `modo`: el del clásico vive en
      records.puntos (como siempre); los demás, en recordsModo. */
  const claveRecord = modo => { const m = modoDe(modo) || MODOS.clasico; return m.id === "clasico" ? null : m.id; };
  function recordDe(prog, modo) { const k = claveRecord(modo); return k ? (prog.recordsModo && prog.recordsModo[k]) || 0 : (prog.records && prog.records.puntos) || 0; }
  /** Anota un récord de `modo` si es mayor (modifica `prog`). Devuelve el récord que había. */
  function anotaRecord(prog, modo, puntos) {
    const k = claveRecord(modo), antes = recordDe(prog, modo);
    if (k) prog.recordsModo[k] = Math.max(antes, puntos); else prog.records.puntos = Math.max(antes, puntos);
    return antes;
  }

  /** El progreso de alguien que nunca jugó. */
  function progresoNuevo() {
    return {
      v: 1, at: 0,                                           // versión y cuándo se guardó (ms)
      monedas: 0, patinetas: 1,                              // una patineta de regalo para probarla
      mejoras: { iman: 0, mochila: 0, zapatillas: 0, doble: 0 },
      potenciadores: { despegue: 1, puntos: 0 },             // un despegue de regalo para probarlo
      retos: { nivel: 1, avance: [0, 0, 0] },
      boletos: [],                                           // números de boleto encontrados
      boletosCity: [], personajesCity: [], personajeCity: null,   // CITY: las postales de City, sus personajes comprados y el que lleva en City (null = su aspecto de siempre)
      aspectos: ["clasico"], aspecto: "clasico",             // los desbloqueados y el que lleva puesto
      records: { puntos: 0, distancia: 0, monedas: 0 },      // las mejores marcas locales (los puntos y la distancia, del clásico)
      recordsModo: { puro: 0, sinmonedas: 0, fantasma: 0, city: 0, citypuro: 0, cityfantasma: 0 },   // la mejor carrera de cada uno de los otros modos
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
    // solo boletos que existen en la Línea 3 (hoy 1 a 10; los 1 a 7 guardados antes siguen valiendo, con su mismo número)
    p.boletos = Array.isArray(x.boletos) ? [...new Set(x.boletos.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n < BOLETOS.length && BOLETOS[n]))].sort((a, b) => a - b) : [];
    p.aspectos = Array.isArray(x.aspectos) ? [...new Set(["clasico", ...x.aspectos.filter(a => ASPECTOS[a])])] : ["clasico"];
    p.aspecto = ASPECTOS[x.aspecto] && p.aspectos.includes(x.aspecto) ? x.aspecto : "clasico";
    for (const k of Object.keys(p.records)) p.records[k] = entero(x.records && x.records[k], 0, 1e12);
    for (const k of Object.keys(p.recordsModo)) p.recordsModo[k] = entero(x.recordsModo && x.recordsModo[k], 0, 1e12);
    for (const k of Object.keys(p.totales)) p.totales[k] = entero(x.totales && x.totales[k], 0, 1e12);
    p.intro = !!x.intro;
    /* CITY: las postales (1 a 5, las que tiene BOLETOS_CITY) y los
       personajes de City (solo los que existen; el puesto, solo si es suyo). */
    const nPost = (MUNDOS.city.boletos || []).length - 1, PC = MUNDOS.city.personajes || {};
    p.boletosCity = Array.isArray(x.boletosCity) ? [...new Set(x.boletosCity.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= nPost))].sort((a, b) => a - b) : [];
    p.personajesCity = Array.isArray(x.personajesCity) ? [...new Set(x.personajesCity.filter(k => typeof k === "string" && Object.prototype.hasOwnProperty.call(PC, k)))] : [];
    p.personajeCity = p.personajesCity.includes(x.personajeCity) ? x.personajeCity : null;
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
    m.boletosCity = [...new Set([...A.boletosCity, ...B.boletosCity])].sort((x, y) => x - y);   // CITY: las postales y los personajes solo se suman
    m.personajesCity = [...new Set([...A.personajesCity, ...B.personajesCity])];
    for (const k of Object.keys(m.records)) m.records[k] = Math.max(A.records[k], B.records[k]);
    for (const k of Object.keys(m.recordsModo)) m.recordsModo[k] = Math.max(A.recordsModo[k], B.recordsModo[k]);
    for (const k of Object.keys(m.totales)) m.totales[k] = Math.max(A.totales[k], B.totales[k]);
    m.intro = A.intro || B.intro;
    /* ¿El más reciente empezó de cero sin ver al otro? Los totales (carreras,
       metros, monedas juntadas) solo crecen, así que una copia que siguió
       jugando desde la otra los tiene todos iguales o mayores. Si el más
       viejo los tiene todos ≥ y alguno mayor, el nuevo es un comienzo aparte
       (otro navegador que nunca leyó la cuenta) y su saldo no puede pisar el
       del viejo: se queda con lo mayor de cada cosa gastable.
       Ejemplo: PC con 52.000 monedas y 40 carreras; navegador nuevo con 300
       monedas y 2 carreras, guardado después → quedan 52.000, no 300. */
    const tk = Object.keys(m.totales);
    const empezoDeCero = tk.every(k => viejo.totales[k] >= nuevo.totales[k]) && tk.some(k => viejo.totales[k] > nuevo.totales[k]);
    if (empezoDeCero) {
      m.monedas = Math.max(A.monedas, B.monedas);                   // el saldo grande no se pierde
      m.patinetas = Math.max(A.patinetas, B.patinetas);
      for (const k of Object.keys(m.potenciadores)) m.potenciadores[k] = Math.max(A.potenciadores[k], B.potenciadores[k]);
      if (viejo.aspecto !== "clasico") m.aspecto = viejo.aspecto;   // el traje que llevaba de verdad
    }
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
  const velocidadEn = CURVA.velocidadEn;                   // la clásica (cada generador usa la de su modo)

  /* El tiempo mínimo entre dos filas de obstáculos. A 50 m/s, filas a 18 m
     llegaban cada 0,36 s: menos de lo que tarda una persona en reaccionar y
     cambiar de carril (el cambio solo ya son 0,17 s). Con 0,55 s el espacio
     crece con la velocidad, pero solo por encima de ~33 m/s; más abajo
     manda la distancia de siempre. Ejemplo: a 50 m/s, 27,5 m entre filas. */
  const FILA_MIN_S = 0.55;

  /** La dificultad entre 0 y 1 según los metros: llega al máximo a los
      ~7,7 km (antes a los ~9,3: el juego se sentía fácil). */
  const dificultad = d => limita((d - 250) / 7500, 0, 1);

  /* EL GENERADOR Y LOS MODOS
     `crearGenerador(semilla, {modo})`: sin modo (o con el clásico) la pista
     es exactamente la de siempre, objeto por objeto: el antitrampas de las
     carreras ya guardadas depende de eso (lo fija un test con su huella).
     Lo que cambia con el modo, y solo cuando el modo lo pide:
       - sin `items` (Sin ayudas, Sin monedas, City sin ayudas): no salen
         poderes ni cajas misteriosas; las estrellas y los boletos, sí;
       - con `monedasMatan` (Sin monedas): las monedas son un obstáculo, así
         que nunca van en el camino seguro (ni en el arco sobre una barrera
         baja ni en los techos de un convoy): cierran carriles que ya estaban
         cerrados, y en los respiros y túneles van fuera del camino;
       - la velocidad con que se ponen los trenes de frente es la de la curva
         del modo (velocidadDe), para que la pista dependa solo de la semilla;
       - el mundo (o el modo) puede traer `generador.bloque(api, dif)`: se
         llama en cada vuelta, después del túnel y del comienzo, y si
         devuelve true es que puso un bloque propio (y avanzó api.dSig). En
         `api` están el azar, `emite`, los bloques de siempre y el estado del
         camino, para mezclar bloques nuevos con los clásicos. El clásico no
         tiene gancho, así que no gasta ni un número del azar en esto. */
  function crearGenerador(semilla, opciones) {
    const modo = modoDe(opciones && opciones.modo) || MODOS.clasico;   // una clave que no existe se juega como el clásico
    const conPoderes = modo.items !== false;     // ¿salen poderes y cajas?
    const peligro = !!modo.monedasMatan;         // ¿las monedas matan? (entonces nunca van en el camino)
    const curva = velocidadDe(modo);             // la curva de velocidad del modo
    const velocidadEn = curva.velocidadEn;       // con la que se ponen los trenes de frente (la clásica, en el clásico)
    const ext = modo.generador || mundoDe(modo).generador || null;   // los bloques propios del mundo, si tiene
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
      if (conPoderes && d >= sigCaja) { emite({ tipo: "poder", clase: "caja", carril: c, d, y }); sigCaja = d + 900 + azar() * 600; return; }
      if (d >= sigEstrella) { emite({ tipo: "estrella", carril: c, d, y }); sigEstrella = d + 420 + azar() * 160; return; }
      if (conPoderes && d >= sigPoder) {
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
          if (r < lerp(0.18, 0.42, dif)) { emite({ tipo: "bajo", carril: c, d: dr }); if (!peligro) arcoMonedas(c, dr); }
          else if (r < lerp(0.3, 0.7, dif)) { emite({ tipo: "alto", carril: c, d: dr }); if (!peligro) filaMonedas(c, dr - 3, 6, 0.5, 1.5); }
          else if (!peligro) filaMonedas(c, dr - 4, Math.min(12, esp - 6));   // en «sin monedas», el camino va limpio
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
          if (peligro && azar() < 0.5) filaMonedas(c, dr - 3, 6);   // en «sin monedas», a veces una fila de monedas: cierra el carril (no se salta)
          else emite({ tipo: azar() < 0.55 ? "bajo" : "alto", carril: c, d: dr });
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
      if (!peligro) {                                           // en «sin monedas» el convoy es el camino: va sin monedas
        for (let i = 1; i <= 3; i++) emite({ tipo: "moneda", carril: c, d: dr + i * 1.4, y: 0.75 + ALTO_TECHO * (i * 1.4 / LARGO_RAMPA) });   // monedas subiendo la rampa
        filaMonedas(c, d0 + 1, fin - d0 - 3, ALTO_TECHO + 0.9);  // monedas por los techos
      }
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
      if (peligro) { respiroPeligro(); return; }
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

    /** El respiro de «sin monedas»: la cinta de monedas es lo que hay que
        esquivar, así que va por los dos carriles que NO son el camino (salta
        de uno al otro cada 8 monedas) y el camino sigue limpio y donde estaba. */
    function respiroPeligro() {
      const dr = dSig, largo = 60;
      const otros = [0, 1, 2].filter(k => k !== camino);          // los dos carriles fuera del camino
      let i = Math.floor(azar() * 2);                             // por cuál empieza
      for (let x = 0; x <= largo; x += 2.4) {
        if (x > 0 && Math.round(x / 2.4) % 8 === 0) i = 1 - i;     // cada 8 monedas, al otro carril
        const c = otros[i];
        if (libre[c] <= dr + x) emite({ tipo: "moneda", carril: c, d: dr + x, y: 0.9 });
      }
      regalos(camino, dr + largo + 4);
      dSig = dr + largo + 14;
    }

    /** El túnel que lleva a la próxima estación: nada que esquivar, solo monedas. */
    function bloqueTunel() {
      const d0 = Math.max(dSig, Math.max(...libre)) + 12;      // empieza cuando todos los carriles están libres
      const largo = 150;
      emite({ tipo: "tunel", d0, largo, estacion: tunel.estacion });
      filaMonedas(peligro ? (camino + 1) % 3 : camino, d0 + 8, largo - 30);   // en «sin monedas», fuera del camino
      tunel = null;
      for (let c = 0; c < 3; c++) libre[c] = d0 + largo + 10;  // nada adentro ni a la salida
      dSig = d0 + largo + 22;
    }

    /* Lo que ve el gancho `generador.bloque` de un mundo (ver arriba). Las
       propiedades con get/set leen y escriben el estado vivo del generador. */
    const api = {
      azar, emite, elige, filaMonedas, arcoMonedas, regalos, siguienteCamino,   // las piezas de siempre
      bloqueFila, bloqueConvoy, bloqueRespiro,                                   // los bloques de siempre, para mezclarlos
      trenEnMarcha, velocidadEn, dificultad, lerp, limita, modo, curva, conPoderes, peligro,
      LARGO_VAGON, LARGO_RAMPA, ALTO_TECHO, FILA_MIN_S, libre,                   // `libre` es el arreglo vivo (se puede escribir)
      get dSig() { return dSig; }, set dSig(v) { dSig = v; },
      get camino() { return camino; }, set camino(v) { camino = v; },
      get mantener() { return mantener; }, set mantener(v) { mantener = v; }
    };

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
          if (ext && ext.bloque && ext.bloque(api, dif, ctx)) continue;   // un bloque propio del mundo (el clásico no tiene)
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
      estado() { return { dSig, camino, libre: libre.slice() }; },
      /** El modo con que se generó esta pista. */
      modo: modo.id
    };
  }

  /* ---------- El vuelo del pogo saltarín (ronda 2) ----------
     El pogo de Subway Surfers es UN lanzamiento enorme (invencible al subir y sobre los techos), que cae
     despacio, con un arco de monedas en los tres carriles mientras vuela.
     Aquí está la cuenta, pura, para que el juego y los tests usen la misma:
       · sube hasta alturaPogo (8,3 m) desde donde esté, pero nunca menos de
         subidaPogo (3 m): desde un techo (3,35) también es un gran salto;
       · cae con gravedadPogo × gravedad (10,4 m/s²): desde el suelo pasa
         ~2,5 s en el aire.
     Las monedas del arco NO salen del generador de la pista: no gastan su
     azar (la pista depende solo de la semilla y de los pedidos que anota la
     prueba), y las monedas no dan puntos, así que la prueba del antitrampas
     no necesita saber de ellas. Por eso tampoco tienen nada al azar: dónde
     van se calcula solo con la trayectoria. */
  /** La trayectoria del pogo lanzado desde la altura y0: {v0, gp, cima,
      alto(t), duracion}. `alto(t)` es la altura a los t segundos y
      `duracion`, cuánto tarda en volver al suelo (y = 0). Ejemplo: desde el
      suelo, v0 ≈ 13,1 m/s, cima 8,3 m y duracion ≈ 2,53 s. */
  function vueloPogo(y0) {
    const y = Math.max(0, y0 || 0);                                        // desde dónde se lanza (el suelo o un techo)
    const sube = Math.max(FISICA.subidaPogo, FISICA.alturaPogo - y);        // cuánto sube: hasta 8,3 m, y al menos 3 m
    const gp = FISICA.gravedad * FISICA.gravedadPogo;                       // la gravedad del pogo (flota)
    const v0 = Math.sqrt(2 * gp * sube);                                    // la velocidad para llegar justo a la cima: v = √(2·g·h)
    const alto = t => y + v0 * t - gp * t * t / 2;                          // la parábola de siempre
    const duracion = (v0 + Math.sqrt(v0 * v0 + 2 * gp * y)) / gp;           // cuándo alto(t) = 0 (de vuelta en el suelo)
    return { v0, gp, cima: y + sube, alto, duracion };
  }
  /* Las monedas van solo en el tramo del vuelo que pasa por encima de los
     techos (PISO_MONEDA_POGO): así ninguna queda metida dentro de un vagón,
     y si el corredor aterriza sobre un techo no deja monedas debajo. */
  const PISO_MONEDA_POGO = ALTO_TECHO + 0.25;                              // 3,6 m: el arco empieza y termina sobre los techos
  const N_MONEDAS_POGO = 15;                                               // quince por carril, como en Subway Surfers (45 en total)
  /** El arco de monedas del pogo lanzado en el metro D, a V m/s, desde la
      altura y0: 15 por carril en los tres carriles, cada una donde va a
      pasar el corredor (a la altura de su pecho) en ese momento del vuelo.
      Devuelve objetos {tipo:"moneda", carril, d, y, pogo:true} sin id (el
      juego les pone uno). Ejemplo: desde el suelo a 20 m/s, de ~6 a ~44 m
      por delante. */
  function monedasPogo(D, V, y0) {
    const v = vueloPogo(y0), sale = [];
    const disc = v.v0 * v.v0 - 2 * v.gp * (PISO_MONEDA_POGO - Math.max(0, y0 || 0));   // ¿llega a pasar sobre los techos? (siempre: la cima es ≥ 3,35 + 3)
    if (disc <= 0) return sale;
    const t0 = Math.max(0, (v.v0 - Math.sqrt(disc)) / v.gp);                // cuándo sube por encima de los techos (0 si ya estaba)
    const t1 = (v.v0 + Math.sqrt(disc)) / v.gp;                             // cuándo vuelve a bajar a esa altura
    for (let i = 0; i < N_MONEDAS_POGO; i++) {
      const t = t0 + (t1 - t0) * (i + 0.5) / N_MONEDAS_POGO;                // repartidas parejo en ese tramo
      for (let carril = 0; carril < 3; carril++) sale.push({ tipo: "moneda", carril, d: D + V * t, y: v.alto(t) + 1.0, pogo: true });
    }
    return sale;
  }

  /* ---------- Lo que se exporta ---------- */
  return {
    rng, lerp, limita,
    CARRILES, LARGO_VAGON, ALTO_TECHO, LARGO_RAMPA, FISICA, impulso, VELOCIDAD, T_TOPE, velocidad, metrosEntre, FRENADA, velocidadEn, FILA_MIN_S, VEL_TREN, APARECE, dificultad,
    hazCurva, CURVA, velocidadDe,
    MODOS, ORDEN_MODOS, modoDe, modoDeCategoria, MUNDOS, mundoDe, historiaDe, ESTACIONES_CITY, INTRO_CITY, BOLETOS_CITY, TIPOS, registraTipo,
    recordDe, anotaRecord,
    MEDIO_LARGO, MARGEN_TECHO, MARGEN_RAMPA, ANCHO_TECHO, alturaRampa, soporte, caja,
    PUNTOS_POR_METRO, MAX_BASE, MAX_ESTRELLAS, multiplicador, puntosPorTramo,
    ESTACIONES, estacionDe, siguienteUmbral, VUELTA_DESDE, VUELTA_CADA, VUELTA_IDS, INTRO, BOLETOS, capituloDe,
    PODERES, SEG_POR_NIVEL, MAX_MEJORA, PRECIOS_MEJORA, PRECIO_PATINETA, DURACION_PATINETA, duracionPoder, precioMejora, costoSeguir,
    POTENCIADORES, costoSaltar, premioSet, saltaReto,
    ASPECTOS, cajaMisteriosa, cajaSuper, PRECIO_SUPERCAJA,
    RETOS, retosDeNivel, avanzaRetos,
    progresoNuevo, limpiaProgreso, mezclaProgreso,
    crearGenerador,
    vueloPogo, monedasPogo, PISO_MONEDA_POGO, N_MONEDAS_POGO
  };
});
