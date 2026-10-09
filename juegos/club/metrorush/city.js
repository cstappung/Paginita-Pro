/* Metro Rush — el mundo City (todo lo que no dibuja).

   QUÉ HACE, EN GLOBAL
   Llena el armazón que motor.js deja para City (MUNDOS.city): los cinco
   distritos con sus metros, la vuelta, la curva de velocidad propia, la
   historia (INTRO_CITY y las cinco postales de BOLETOS_CITY), los
   personajes de City con su ventaja chica, los tipos de objeto nuevos de la
   pista y el bloque de pista propio (`generador.bloque`). Es puro: no
   dibuja ni toca la página, así se prueba en Node igual que el motor
   (colabtex/tests/metrorush-city.test.cjs).

   POR QUÉ UN ARCHIVO APARTE
   - motor.js es de todos los modos; City crecería ahí adentro hasta tapar
     lo demás. Aquí queda junto y con su propio test.
   - Se instala UNA vez sobre el motor: motor.js lo llama al terminar de
     armarse (en Node con require, en la página con window.MetroRushCity,
     que por eso se carga ANTES que motor.js en index.html). Así cualquiera
     que cargue el motor (el juego, la prueba del antitrampas, el
     verificador del club, los tests) ve el mismo City, sin pasos extra.

   LAS MECÁNICAS DE CITY (todas salen de la pista, así que dependen solo de
   la semilla y el antitrampas las regenera igual):
     · CAJONES: pilas de cajas de 1 m en un carril. Se saltan, o se PISAN:
       caer encima (mejor con «rodar en el aire», el pisotón) las rompe y
       sueltan monedas. De frente, chocan como una barrera baja.
     · DRONES: un dron con un cartel colgando a la altura de la cabeza
       (todo junto ocupa de 1,15 a 2,45 m: más que un salto normal, 2,1 m).
       Se pasan rodando, o se pisan desde arriba (desde un techo o una lona).
     · BARANDAS: un riel de 1 m de alto, más largo a más velocidad (22 a 56 m). Saltando
       se cae encima y se desliza (grind): suelta monedas mientras dura. De
       frente, al nivel del suelo, chocan.
     · LONAS (y respiraderos de vapor en Bajo Vías): no chocan; pisarlas te
       lanza a 5,2 m, lo justo para caer sobre un tren sin rampa.
     · CHICLE: un poder (solo en los modos con poderes) que te envuelve en
       una burbuja: el próximo choque de frente la revienta y sigues.
     · ESTRELLAS SECRETAS: estrellas normales (+1 al multiplicador, la prueba
       las anota como cualquier estrella) puestas donde solo se llega por la
       ruta difícil: arriba del salto de una lona, al final de una baranda.
   Y lo que trae Subway Surfers City (2026) sobre el original:
     · ENERGÍA DE TABLA: celdas de energía en la pista (más escasas que las
       monedas). Con ENERGIA_LLENA juntas, la tabla se enciende gratis con
       H o dos toques y dura TABLA_SEG. Solo en los modos con patineta.
     · BATERÍA: un poder que llena la energía de una.
     · MONEDAS ×2: un poder que cuenta doble cada moneda (no los puntos).
     · CHICLE, como el Bubble Gum de City (15 s): además de salvarte, salta
       un 15 % más; «rodar» en el aire es un pisotón (baja de golpe, abre
       rejillas y pisa cajones y drones) y al caer de él la burbuja rebota
       3,6 m (lo que pide un techo de vagón); volando atrae las monedas.
     · DRON IMPULSOR: pisar un dron (desde un techo o una lona) te lanza
       alto, como en City, donde los drones te suben a los andamios.
     · REJILLAS: rejillas en el suelo que tiemblan. Caerles encima de golpe
       (el pisotón: rodar en el aire) las abre: abajo hay un escondite de
       monedas, como los pasajes secretos del pisotón de City.
     · CONTENEDORES QUE CAEN (Los Muelles): los cajones de los muelles caen
       desde las grúas mientras te acercas, con su sombra marcando el carril.
       Caen siempre antes de que llegues (a 12 m ya están en el suelo), así
       que se esquivan igual que un cajón quieto.
     · BURBUJAS (Parque de los Lagos): un tramo de baja gravedad, como las
       burbujas de DeLorean Park: los saltos flotan y en el aire se puede
       saltar una vez más (el doble salto).
   Y lo que hace que cada distrito se JUEGUE distinto (no solo que se vea
   distinto): cada uno tiene un objeto propio que pide otro verbo.
     · BARRIO SUR · COBERTIZOS: un techito de 2 m pegado a dos o tres
       vagones sin rampa. Se sube con DOS saltos: al techito y, desde ahí,
       al techo del vagón (la ruta de arriba, con sus monedas).
     · LOS MUELLES · VIGAS DE GRÚA: una viga que cuelga de la grúa, empieza
       a 1,9 m y sube a 4,2 m por encima de los contenedores. Se salta a
       ella y te sube; al final te deja sobre los vagones.
     · BULEVAR AURORA · RIELES EN ZIGZAG: dos o tres barandas que se
       solapan cruzando los carriles. Deslizándote, te cambias al riel de
       al lado sin tocar el suelo; cada transbordo multiplica las monedas.
     · PARQUE DE LOS LAGOS · SETOS: setos de 2,8 m, más altos que un salto
       normal (2,1 m), solo dentro de las burbujas, donde el salto flota
       (3,8 m). Las burbujas dejan de ser un adorno: son la manera de pasar.
     · BAJO VÍAS · CONDUCTOS: un ducto de 1 a 3,35 m sobre el carril, más
       largo que una rodada. Se entra rodando y hay que VOLVER a rodar en el
       anillo de luz antes de salir.
   Nada de esto cambia cómo se calculan los puntos: siguen siendo 10 por
   metro × el multiplicador, y el multiplicador solo cambia con estrellas,
   el 2× y el +5. Por eso la prueba (prueba.js) no necesitó eventos nuevos.
   (Los «speed pads» de City no están a propósito: la velocidad sale de los
   metros recorridos y el antitrampas la recalcula; un acelerón la rompería.)

   UMD: `window.MetroRushCity` en la página (una función), `module.exports`
   en Node. La función recibe el motor ya armado y le instala City. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica;   // Node: motor.js la llama con require
  else raiz.MetroRushCity = fabrica;                                            // página: motor.js la busca en window
})(typeof self !== "undefined" ? self : this, function instalaCity(M) {
  "use strict";
  if (!M || !M.MUNDOS || !M.MUNDOS.city) return M;                // sin armazón de City no hay dónde instalar
  if (M.CITY) return M;                                           // ya instalado (motor.js llamado dos veces)
  const { CARRILES, ALTO_TECHO, LARGO_VAGON, LARGO_RAMPA, FISICA, impulso, limita, lerp } = M;

  /* ---------- Los cinco distritos ----------
     Como las estaciones de la Línea 3: `desde` en metros (no en puntos), un
     estilo de dibujo, una paleta de mundo.js, su música (los temas `city-*`
     de audio.js), un lema para el cartel de entrada y su postal (`boleto`).
     `distrito` le dice a mundo.js qué escenografía poner a los costados
     (casas, muelles, torres con palmeras, parque, la zanja de Bajo Vías),
     también cuando el jugador fija otro estilo en las opciones.
     Los umbrales siguen el ritmo de la Línea 3 (1,5 / 3,5 / 6 / 9 km) para
     que cada distrito dure lo mismo que una estación: con la curva de City
     se llega a Los Muelles al minuto y medio, al bulevar a los ~2:40, al
     parque a los ~3:50 y a Bajo Vías a los ~5 min. */
  const DISTRITOS = [
    { id: "city-sur", nombre: "Barrio Sur", desde: 0, estilo: "juguete", paleta: "citysur", distrito: "sur", musica: "city-sur", lema: "Casas bajas, patios y la vía cruzando la calle", boleto: 1 },
    { id: "city-muelles", nombre: "Los Muelles", desde: 1500, estilo: "pixel", paleta: "muelles", distrito: "muelles", musica: "city-muelles", lema: "Grúas, contenedores y el mar al lado de la vía", boleto: 2 },
    { id: "city-bulevar", nombre: "Bulevar Aurora", desde: 3500, estilo: "neon", paleta: "bulevar", distrito: "bulevar", musica: "city-bulevar", lema: "Palmeras y letreros que no se apagan ni al amanecer", boleto: 3 },
    { id: "city-parque", nombre: "Parque de los Lagos", desde: 6000, estilo: "juguete", paleta: "parque", distrito: "parque", musica: "city-parque", lema: "Pasto, patos y lonas que te mandan a las nubes", boleto: 4 },
    { id: "city-bajo", nombre: "Bajo Vías", desde: 9000, estilo: "neon", paleta: "bajo", distrito: "bajo", musica: "city-bajo", lema: "La ciudad de abajo: vapor, drones y luces de obra", boleto: 5 }
  ];
  /* Después del último distrito la ciudad da la vuelta: desde los 13 km,
     cada 3 km un distrito de los cinco, en orden (Barrio Sur, Los Muelles…),
     con «· vuelta 2» en el nombre y sin postal (las postales son de la
     primera pasada). */
  const VUELTA = { desde: 13000, cada: 3000, n: 5 };

  /* ---------- La velocidad de City ----------
     La ciudad arranca un poco más rápido que la Línea 3 (16 m/s contra 15) y
     acelera un poco más (0,11 contra 0,1 m/s²), pero su tope es más bajo
     (46 contra 50): las calles están más llenas (cajones, drones, barandas)
     y a 50 m/s no se alcanza a leer una baranda antes de tenerla encima.
     Llegaba al tope a los ~273 s (4 min 33 s), a los ~8,5 km. Desde la
     versión 3 de la prueba el tope es 60 m/s, como en la Línea 3 (se pidió
     así): la rampa es la misma, así que hasta los 8,5 km nada cambia, y
     sigue subiendo hasta los 400 s (~13,6 km). Las pruebas v2 se rehacen
     con VELOCIDAD_CITY_V2 (M.velocidadDe(modo, 2)).
     La leen el juego, el generador (velocidadEn) y el antitrampas
     (metrosEntre) por M.velocidadDe(modo). Cambiarla cambia las pruebas de
     City: no hay pruebas de City guardadas de antes de esto (el modo era un
     armazón), así que no hizo falta subir VERSION en prueba.js. */
  const VELOCIDAD_CITY = { V0: 16, VMAX: 60, ACEL: 0.11 };     // versión 3 de la prueba: el tope subió a 60 (llega a los 400 s, ~13,6 km)
  const VELOCIDAD_CITY_V2 = { V0: 16, VMAX: 46, ACEL: 0.11 };  // la de la versión 2 (tope 46), para rehacer carreras City guardadas antes

  /* ---------- La historia de City ----------
     La intro (se lee en la Libreta y en el relato) y cinco postales, una por
     distrito, que se guardan aparte de los boletos de la Línea 3
     (`progreso.boletosCity`): son otra colección, de otro mundo. */
  const INTRO = "Cuando la Línea 3 cerró, sus vagones no fueron a parar a un museo: los repartieron por la ciudad. Ahora duermen en los patios del Barrio Sur, junto al mar en Los Muelles, bajo las palmeras del Bulevar Aurora, entre los lagos del parque y en los túneles de Bajo Vías. Don Ramón se jubiló… y lo contrataron de guardia de patios. Tornillo vino con él. Tú vienes a correr la ciudad entera.";
  const POSTALES = [
    null,  // (las postales se cuentan desde el 1, como los boletos)
    { titulo: "Postal n.º 1 · Barrio Sur", texto: "Aquí los vagones viejos son parte del barrio: uno es kiosco, otro es la sede del club de dominó. Los vecinos te saludan desde las ventanas. Don Ramón también saluda, pero corriendo." },
    { titulo: "Postal n.º 2 · Los Muelles", texto: "Los contenedores llegan de todas partes y nadie sabe qué traen. Uno dice «FRÁGIL» en nueve idiomas. Si lo pisas, mejor que no lo sepas." },
    { titulo: "Postal n.º 3 · Bulevar Aurora", texto: "En el bulevar los letreros no se apagan nunca, ni cuando sale el sol. Alguien escribió tu nombre en uno, con luces rosadas. Todavía no sabes quién." },
    { titulo: "Postal n.º 4 · Parque de los Lagos", texto: "Las lonas eran de la feria de verano. La feria se fue; las lonas se quedaron. Los patos ya no se asustan cuando pasas volando." },
    { titulo: "Postal n.º 5 · Bajo Vías", texto: "Debajo de la ciudad corre otra ciudad: vapor, cables y drones que vigilan andenes que nadie usa. Al fondo hay una puerta con un 3 pintado. Está abierta." }
  ];

  /* ---------- Los personajes de City ----------
     Se eligen en la tienda solo cuando el modo elegido es de City (llevan la
     insignia «City»), y en City se ponen en vez del aspecto de la Línea 3.
     Cada uno trae UNA ventaja chica que no toca los puntos (los puntos salen
     de los metros y del multiplicador, y ninguna ventaja cambia ninguno de
     los dos): más imán, un salto un poco más alto, el doble de monedas al
     pisar o al deslizarse. La clasificación queda pareja.
     `apariencia` usa los mismos campos que los ASPECTOS (sudadera, gorra,
     jeans, mochila, mochila2, suela) y agrega los rasgos de City que dibuja
     mundo.js (bloque «CITY: rasgos de los personajes»): `piel`, `pelo`,
     `peinado` ('corto', 'coleta', 'melena', 'trenzas', 'rapado') y `falda`
     (un color, o null para pantalón). Hay chicas y chicos. */
  const PERSONAJES = {
    lia: { id: "lia", nombre: "Lía", precio: 6000, ventaja: { iman: 3 }, texto: "Imán: dura 3 s más",
      apariencia: { piel: 0xc98e62, pelo: 0x24150e, peinado: "coleta", falda: null, sudadera: 0x2fb5a8, gorra: 0xffd23f, jeans: 0x283a5c, mochila: 0xff5a8a, mochila2: 0xffffff, suela: 0xff5a8a } },
    nico: { id: "nico", nombre: "Nico", precio: 9000, ventaja: { salto: 1.08 }, texto: "Resortes: salta un 8 % más alto",
      apariencia: { piel: 0xf1c19c, pelo: 0xc9772e, peinado: "corto", falda: null, sudadera: 0xffb020, gorra: 0x2d6cdf, jeans: 0x3a3f58, mochila: 0x2d6cdf, mochila2: 0xffd23f, suela: 0x2d6cdf } },
    ambar: { id: "ambar", nombre: "Ámbar", precio: 12000, ventaja: { pisoton: 2 }, texto: "Pisotón de oro: el doble de monedas al romper cajones y drones",
      apariencia: { piel: 0x8d5a3b, pelo: 0x140c08, peinado: "trenzas", falda: 0x7b2ff7, sudadera: 0xffd23f, gorra: 0x7b2ff7, jeans: 0x1d1e2c, mochila: 0x00c2a8, mochila2: 0xff5a8a, suela: 0xffffff } },
    bruno: { id: "bruno", nombre: "Bruno", precio: 15000, ventaja: { grind: 2 }, texto: "Rielero: el doble de monedas deslizándose por las barandas",
      apariencia: { piel: 0xe0ac84, pelo: 0x3b2a20, peinado: "rapado", falda: null, sudadera: 0x3a4a3a, gorra: 0xe8463b, jeans: 0x1f2a44, mochila: 0xe8463b, mochila2: 0xf2f2f2, suela: 0xe8463b } },
    sol: { id: "sol", nombre: "Sol", precio: 20000, ventaja: { lona: 1.15 }, texto: "Acróbata: las lonas y el vapor la lanzan un 15 % más alto",
      apariencia: { piel: 0xf6d2b8, pelo: 0xe8c25a, peinado: "melena", falda: 0xff7a3d, sudadera: 0xff7a3d, gorra: 0x23304a, jeans: 0x23304a, mochila: 0x6ad1ff, mochila2: 0xffe14d, suela: 0x23304a } },
    /* Dante llegó para que haya tres chicas y tres chicos. Su ventaja es la
       de la tabla eléctrica: cada celda de energía le vale por dos, así que
       la enciende con la mitad. No toca puntos ni metros, como las demás. */
    dante: { id: "dante", nombre: "Dante", precio: 24000, ventaja: { energia: 2 }, texto: "Electricista: cada celda de energía vale por dos",
      apariencia: { piel: 0x6b4128, pelo: 0x0f0a07, peinado: "corto", falda: null, sudadera: 0x23304a, gorra: 0x6ad1ff, jeans: 0x8a8f9c, mochila: 0xffe14d, mochila2: 0x23304a, suela: 0x6ad1ff } }
  };
  /** La ventaja del personaje `id` (o {} si no es de City): {iman, salto, pisoton, grind, lona, energia}. */
  const ventajaDe = id => (id && PERSONAJES[id] ? PERSONAJES[id].ventaja : {}) || {};

  /* ---------- Los objetos nuevos de la pista ----------
     Las medidas que comparten el juego (choques, pisar, deslizarse) y
     mundo.js (el dibujo). Todo en metros sobre la vía. */
  const CAJON = { alto: 1.0, largo: 1.2, w: 0.9 };            // la pila de cajas: un poco más alta que la barrera baja (0,95), se salta igual
  /* El dron y su cartel: rodando (0,8 m) se pasa por debajo; arriba llega a
     2,45 m, más que el salto normal (2,1 m) y que el de Nico (2,27 m), así
     que saltando se choca igual que con la barrera alta (que llega a 2,35). */
  const DRON = { y0: 1.15, y1: 2.45, largo: 0.9, w: 0.8 };
  const PISA_DRON = 0.15;                                      // el dron solo se pisa cayendo de más alto que cualquier salto (2,3 m)
  const BARANDA = { alto: 1.0, w: 0.45 };                      // el riel: se desliza encima, a 1 m
  const LONA = { altura: 5.2, largo: 1.8, w: 0.9 };            // la lona: te lanza a 5,2 m (el techo de un tren está a 3,35)
  const PISA = 0.35;                                           // margen para contar una caída como «encima» (el cuadro anterior)

  /* Cómo choca cada uno (M.caja los conoce por registraTipo). Un cajón o un
     dron ROTO (pisado) ya no choca: `o.roto` lo pone el juego al pisarlo.
     La baranda choca solo por debajo de su riel (como la rampa): estando
     encima, a 1 m, ya no te toca. */
  M.registraTipo("cajon", { caja: o => (o.roto ? null : { z0: o.d - CAJON.largo / 2, z1: o.d + CAJON.largo / 2, y0: 0, y1: CAJON.alto, w: CAJON.w }) });
  M.registraTipo("dron", { caja: o => (o.roto ? null : { z0: o.d - DRON.largo / 2, z1: o.d + DRON.largo / 2, y0: DRON.y0, y1: DRON.y1, w: DRON.w }) });
  M.registraTipo("baranda", {
    caja: o => ({ z0: o.d0, z1: o.d0 + o.largo, y0: 0, y1: o.alto - 0.45, w: BARANDA.w }),
    /* Lo que sostiene (M.soporte lo pregunta): estando en su carril, a lo
       largo del riel, y ya a la altura del riel o casi (desde 0,47 m bajo
       él), te deja parado a `alto`. Ese casi es un imán chico: un salto que
       pasa rozando el riel cae encima en vez de atravesarlo. El umbral es el
       borde de la caja que choca (alto − 0,45) menos los 0,02 de los pies:
       así no queda una franja en que ni choca ni sostiene. */
    soporte: (o, x, D, y) => {
      if (D < o.d0 - 0.2 || D > o.d0 + o.largo + 0.2) return null;                     // antes o después del riel
      if (Math.abs(x - CARRILES[o.carril]) >= BARANDA.w + FISICA.medioAncho) return null;   // en otro carril
      return y >= o.alto - 0.47 ? o.alto : null;                                       // a su altura (o casi): encima
    }
  });
  M.registraTipo("lona", { caja: () => null });                // la lona no choca: se pisa
  // lo de Subway Surfers City: nada de esto choca (se toma, se pisa o se atraviesa)
  M.registraTipo("energia", { caja: () => null });             // la celda de energía de la tabla
  M.registraTipo("rejilla", { caja: () => null });             // la rejilla del pisotón
  M.registraTipo("burbujas", { caja: () => null });            // el tramo de baja gravedad

  /* ---------- Lo propio de cada distrito ----------
     Las medidas que comparten el generador (abajo), el juego (choques y lo
     que sostiene, por M.caja y M.soporte) y el dibujo (mundo-city.js). */
  const ANCHO_PISO = 0.95 + FISICA.medioAncho;                 // hasta dónde de su carril sostiene algo de 0,95 m de medio ancho (lo mismo que choca)
  /* El COBERTIZO (Barrio Sur): choca hasta 1,55 m y sostiene a 2 m. Un
     salto desde el suelo pasa de 1,55 m entre los 0,20 y los 0,61 s; desde
     el techito, un salto pasa de 2,85 m (lo que pide el techo del vagón)
     entre los 0,09 y los 0,71 s: los dos saltos tienen ventana de sobra. */
  const COBERTIZO = { alto: 2.0, choca: 1.55, w: 0.95 };
  /* El CONDUCTO (Bajo Vías): de 1 m (rodando ocupas 0,8) a 3,35 m, el alto
     de un vagón: arriba es un techo más, que se camina desde los trenes. */
  const CONDUCTO = { y0: 1.0, alto: ALTO_TECHO, w: 0.95 };
  /* El SETO (el parque): 2,8 m. Un salto normal llega a 2,1 m (Nico, 2,27);
     en las burbujas, a 3,82 m, y pasa de 2,8 m entre los 0,35 y los 1,11 s
     después de saltar: casi un segundo de ventana. */
  const SETO = { alto: 2.8, largo: 1.2, w: 0.95 };
  /* La VIGA de la grúa (Los Muelles): sus pies van a 1,9 m al comienzo y a
     4,2 m pasada la subida (`o.sube` m). Se agarra desde 0,6 m por debajo:
     un salto normal (2,1 m) la toma al comienzo. Nada de ella choca: cuelga. */
  const VIGA = { y0: 1.9, y1: 4.2, agarra: 0.6, w: 0.95 };
  /** La altura de la viga `o` en D (lo que pisan los pies). Ejemplo: con sube 12, a 6 m del comienzo va a 3,05 m. */
  const alturaViga = (o, D) => VIGA.y0 + (VIGA.y1 - VIGA.y0) * limita((D - o.d0) / o.sube, 0, 1);

  M.registraTipo("cobertizo", {
    caja: o => ({ z0: o.d0, z1: o.d0 + o.largo, y0: 0, y1: COBERTIZO.choca, w: COBERTIZO.w }),
    /* Sostiene a 2 m desde 0,02 m bajo el borde que choca (los pies van
       0,02 m sobre su altura): así no queda franja en que ni choca ni sostiene. */
    soporte: (o, x, D, y) => (D >= o.d0 - 0.4 && D <= o.d0 + o.largo + 0.4 && Math.abs(x - CARRILES[o.carril]) < ANCHO_PISO && y >= COBERTIZO.choca - 0.02 ? COBERTIZO.alto : null)
  });
  M.registraTipo("conducto", {
    caja: o => ({ z0: o.d0, z1: o.d0 + o.largo, y0: CONDUCTO.y0, y1: CONDUCTO.alto, w: CONDUCTO.w }),
    // arriba es como el techo de un vagón: sostiene a 3,35 m si ya vas casi a esa altura
    soporte: (o, x, D, y) => (D >= o.d0 - 0.4 && D <= o.d0 + o.largo + 0.4 && Math.abs(x - CARRILES[o.carril]) < ANCHO_PISO && y >= CONDUCTO.alto - 0.5 ? CONDUCTO.alto : null)
  });
  M.registraTipo("seto", {
    caja: o => ({ z0: o.d - SETO.largo / 2, z1: o.d + SETO.largo / 2, y0: 0, y1: SETO.alto, w: SETO.w }),
    /* Arriba se puede pisar: un salto flotante que baja un poco antes de
       pasarlo cae sobre el seto y sigue (antes se moría «enredado» aunque
       los pies ya estuvieran casi arriba). Sostiene desde 0,35 m bajo su
       borde: lo que cae en ese margen sube al borde y no choca. */
    soporte: (o, x, D, y) => (Math.abs(D - o.d) <= SETO.largo / 2 + 0.3 && Math.abs(x - CARRILES[o.carril]) < ANCHO_PISO && y >= SETO.alto - 0.35 ? SETO.alto : null)
  });
  M.registraTipo("viga", {
    caja: () => null,                                          // cuelga de cables: por debajo se pasa (y en su carril vienen vagones)
    soporte: (o, x, D, y) => {
      if (D < o.d0 - 0.3 || D > o.d0 + o.largo) return null;   // antes o después de la viga
      if (Math.abs(x - CARRILES[o.carril]) >= VIGA.w) return null;   // un poco más angosta: cambiarse de carril te suelta
      const h = alturaViga(o, D);
      return y >= h - VIGA.agarra ? h : null;                  // a su altura, o casi: te agarras (y te sube con ella)
    }
  });

  /* Las medidas de lo nuevo de City (las usan ciudad.js y mundo-city.js). */
  const ENERGIA_LLENA = 10;                                    // celdas para encender la tabla (como en City)
  const TABLA_SEG = 15;                                        // lo que dura la tabla encendida con energía
  const MONEDAS2_SEG = 15;                                     // lo que dura el poder «monedas ×2»
  /* El chicle: dura `seg`; el salto sube `salto` veces más; caer de un
     pisotón rebota `rebote` m sobre donde cayó (del suelo, 3,6 m: pasa el
     frente de un vagón, 3,35, y cae en su techo), pero nunca más arriba de
     `tope` m sobre la vía (de un techo, 2,65 m más: los pies a 6 m). */
  const CHICLE = { seg: 15, salto: 1.15, rebote: 3.6, tope: 6 };
  const DRON_IMPULSO = 3.0;                                    // pisar un dron te lanza 3 m sobre donde estabas (~5,3 m del suelo)
  const REJILLA = { largo: 1.8, w: 0.9, monedas: 15 };         // la rejilla y lo que suelta su escondite (el doble con Ámbar)
  const BURBUJAS = { gravedad: 0.55 };                         // dentro del tramo, la gravedad es el 55 %: un salto sube 3,8 m
  const PASO_BURBUJA = 0.12;                                   // el arco de monedas del salto flotante: entre moneda y moneda, esta fracción de medio salto (ver setos)
  const ALTO_BURBUJA = 0.5;                                    // …y cada moneda, 0,5 m sobre los pies del salto ideal
  /* El contenedor que cae: dónde está según cuánto falta para llegar a él.
     A más de 34 m todavía cuelga a 9 m; de 34 a 12 m baja (acelerando,
     como algo que cae); a menos de 12 m ya está en el suelo. Solo es el
     dibujo: choca igual que un cajón quieto, y para cuando lo tienes al
     alcance (1 m) hace rato que tocó el suelo. Ejemplo: a 23 m va a 2,25 m. */
  function alturaCae(dist) {
    if (dist <= 12) return 0;
    if (dist >= 34) return 9;
    const f = (dist - 12) / 22;                                // 0 en el suelo, 1 arriba
    return 9 * f * f;
  }

  /** ¿Una caída del corredor rompe el objeto `o` (un cajón o un dron)? Sí
      si va bajando (vy ≤ 0) y en el cuadro anterior sus pies estaban
      encima del objeto (o casi, PISA metros por debajo de su borde de
      arriba). Ejemplo: cajón de 1 m, pies a 1,2 m y bajando → lo pisa; pies
      a 0,3 m (saltó tarde y se lo comió de frente) → choca. */
  function pisa(o, yAntes, vy) {
    if (!o || o.roto || (o.tipo !== "cajon" && o.tipo !== "dron") || vy > 0) return false;
    if (o.tipo === "cajon") return yAntes >= CAJON.alto - PISA;          // el cajón: casi a su altura basta
    return yAntes >= DRON.y1 - PISA_DRON;                               // el dron: solo desde un techo o una lona, nunca con un salto (su tope son 2,27 m)
  }
  /** ¿El corredor (en x, a altura y, que avanzó de Dantes a D en este
      cuadro, con velocidad vertical vy) está sobre la lona `o`?
      - La LONA de verdad: solo desde el suelo (no desde un techo ni volando).
      - El VAPOR empuja en toda su columna (hasta 2,5 m): quien salta
        delante de él, que es lo que hace cualquiera al verlo, también sube.
        Antes solo lanzaba con los pies en el suelo, así que saltarlo te
        pasaba por encima del vapor y te estrellaba contra los vagones de
        detrás. No empuja a quien ya sube más rápido de lo que él daría.
      - Barrido: se mira todo lo que se avanzó en el cuadro, no solo dónde
        terminó. A 20 fps y 60 m/s un cuadro son 3 m y la lona mide 2,4: el
        vapor se saltaba solo uno de cada cinco cuadros.
      Ejemplo: vapor en d 100, cuadro de 98,6 a 101,6 m, pies a 1,2 m subiendo
      a 4 m/s → empuja (antes: no, ni por altura ni por barrido). */
  function enLona(o, x, D, y, Dantes = D, vy = 0) {
    if (o.tipo !== "lona" || o.usada) return false;
    const vapor = o.variante === "vapor";
    if (y >= (vapor ? 2.5 : 0.35)) return false;                          // el vapor empuja en toda su columna; la lona, solo pisada
    if (vapor && vy >= impulso(Math.max(0.6, LONA.altura - y))) return false;   // ya sube más que lo que él daría
    const m = LONA.largo / 2 + 0.3;                                        // su medio largo, con un poco de margen
    if (Math.min(D, Dantes) - m >= o.d || Math.max(D, Dantes) + m <= o.d) return false;   // no la cruzó en este cuadro
    return Math.abs(x - CARRILES[o.carril]) < LONA.w + (vapor ? FISICA.medioAncho : 0);   // en su carril (el vapor, un poco más ancho)
  }
  /** La velocidad hacia arriba que da la lona (con la ventaja de Sol, si la tiene). */
  const impulsoLona = (k = 1) => impulso(LONA.altura * k);
  /* El vuelo de la lona, en metros de pista: desde que te lanza hasta que
     vuelves a caer a la altura de un techo (3,35 m). Sube a 5,2 m y baja,
     así que a 26 m/s² de gravedad son ~1 s: 16 m a 16 m/s, 47 m a 46. */
  function vueloLona(V) {
    const g = FISICA.gravedad, v0 = impulsoLona(1);                        // la gravedad del juego y el impulso de la lona
    return V * (v0 + Math.sqrt(v0 * v0 - 2 * g * ALTO_TECHO)) / g;           // subida y bajada hasta el techo, por la velocidad
  }
  /* Dónde empieza el primer vagón detrás de una lona: lo bastante lejos
     para que el salto ya vaya por encima de su techo (3,55 m con margen,
     a los ~0,28 s de subir) al llegar a él: 5,7 m a 16 m/s, 13,5 m a 46. */
  const huecoLona = V => Math.max(5, V * 0.26 + 1.5);
  /* Cuántos vagones van detrás: los justos para que el vuelo caiga sobre
     los techos con 6 m de techo por delante (de 2 a 6: con 4 de tope, a
     60 m/s el vuelo caía a 3 m del final), así a toda velocidad no se pasa
     de largo y aterriza en el suelo detrás. */
  const vagonesLona = V => limita(Math.ceil((vueloLona(V) + 6 - huecoLona(V)) / (LARGO_VAGON + 0.4)), 2, 6);

  /* ---------- El bloque de pista de City ----------
     Se llama en cada vuelta del generador (ver crearGenerador en motor.js),
     después del túnel y del comienzo. Cada tanto (cada 60 a 140 m, más
     seguido mientras más difícil) pone un bloque propio; si no, devuelve
     false y sale un bloque de siempre (fila, convoy o respiro). Así la
     ciudad mezcla lo suyo con lo de la Línea 3.

     La regla del CAMINO se respeta igual que en el clásico: el carril seguro
     solo tiene cosas que se saltan, se ruedan o se suben (un cajón, un dron,
     una baranda) y nunca un tren que no se pueda pasar; los trenes van en
     los otros carriles y los reservan en `libre`. El test de City recorre
     muchas semillas con un jugador simulado para comprobarlo.

     El estado propio (cuándo toca el próximo bloque, el próximo chicle, la
     próxima estrella secreta) vive en `api._city`: el `api` es de cada
     generador, así dos pistas nunca se pisan el estado. */
  /* ---------- Cada distrito, su propia pista ----------
     En City el gancho arma TODOS los bloques (después de los primeros 140 m
     ya no sale ni una fila, ni un convoy clásico): sin barreras bajas ni
     altas, sin rampas. Cada distrito tiene un PERFIL, que dice:
     - `camino`: qué hay en el carril seguro de sus filas (y con qué peso);
       «nada» es una fila de monedas;
     - `sig`: qué puede haber en el carril por donde seguirá el camino (solo
       cosas pasables);
     - `cerrado`: con qué se cierra de verdad un carril: vagones detenidos
       (de `vagones` en `vagones`), una `subida` (lona o vapor con vagones
       detrás: la ruta de arriba), un `seto` (el muro del parque) o un
       obstáculo de City;
     - `marcha`: la probabilidad de un tren que viene de frente (de fácil a
       difícil);
     - `firma` y `cada`: su bloque propio y cada cuántos metros (de fácil a
       difícil, más un poco sin tocar el azar);
     - `extra`: otros bloques, con su peso contra el de la fila (`fila`);
     - `rejilla`: cada cuántos metros, como mínimo, una rejilla del pisotón.
     Ejemplo: en Bajo Vías el camino es casi siempre un dron (se rueda), los
     carriles cerrados son paredes de dos o tres vagones y cada 60 a 90 m hay
     un conducto; en el Bulevar casi todo son rieles y trenes de frente. Así
     un distrito se juega distinto, no es otra pintura. */
  const PERFIL = {
    sur: {                                                     // vertical: cajones al ras y la subida de dos pasos al techo
      camino: { dron: 32, cajon: 26, nada: 42 }, sig: { dron: 1, cajon: 1 },
      cerrado: { vagones: 6, dron: 1.5, cajon: 1 }, vagones: [1, 2], marcha: [0.06, 0.18],
      firma: "cobertizo", cada: [100, 60], extra: { fila: 1, lonas: 0.08, baranda: 0.06 }, rejilla: [150, 100]
    },
    muelles: {                                                 // ritmo de saltos y pisotones, y arriba por las grúas
      camino: { cajon: 62, dron: 4, nada: 34 }, sig: { cajon: 1 },
      cerrado: { vagones: 5, cajon: 5 }, vagones: [1, 3], marcha: [0.10, 0.25],
      firma: "viga", cada: [130, 90], extra: { fila: 1, escalera: 0.3, lonas: 0.04 }, rejilla: [250, 200]
    },
    bulevar: {                                                 // de lado: de riel en riel, con tráfico de frente
      camino: { dron: 30, cajon: 12, nada: 58 }, sig: { dron: 1 },
      cerrado: { vagones: 3, dron: 2 }, vagones: [1, 1], marcha: [0.30, 0.50],
      firma: "zigzag", cada: [110, 70], extra: { fila: 1, baranda: 0.45, lonas: 0.05 }, rejilla: [250, 200]
    },
    parque: {                                                  // flotar, rebotar, ir alto
      camino: { cajon: 45, nada: 55 }, sig: { cajon: 1 },
      cerrado: { seto: 5, subida: 3, vagones: 2 }, vagones: [1, 2], marcha: [0.05, 0.15],
      firma: null, cada: [160, 90], extra: { fila: 1, lonas: 0.2 }, rejilla: [250, 200]
    },
    bajo: {                                                    // bajo y rodando, a oscuras, con trenes de frente
      camino: { dron: 55, cajon: 10, nada: 35 }, sig: { dron: 1 },
      cerrado: { vagones: 6, subida: 1.5, dron: 1 }, vagones: [2, 3], marcha: [0.25, 0.45],
      firma: "conducto", cada: [90, 60], extra: { fila: 1, lonas: 0.1 }, rejilla: [200, 60]
    }
  };
  /** Lo propio de cada distrito, el mismo nombre que en PERFIL (para los tests y el manual). */
  const PROPIO = { sur: "cobertizo", muelles: "viga", bulevar: "zigzag", bajo: "conducto" };
  const generador = {
    bloque(api, dif, ctx) {
      let st = api._city;
      if (!st) {
        st = api._city = { chicle: 700, secreta: 600, bateria: 900, monedas2: 1200, rejilla: 300, burbujas: 0, propio: 220, obst: [-1e9, -1e9, -1e9] };
        /* Cada cosa que se salta o se rueda queda anotada por carril (`obst`):
           así una lona o un cobertizo nunca caen justo detrás de una (ver
           `despejado`). Se envuelve `emite` una sola vez, en este generador. */
        const emite = api.emite;
        api.emite = o => {
          if ((o.tipo === "cajon" || o.tipo === "dron" || o.tipo === "seto") && o.d > st.obst[o.carril]) st.obst[o.carril] = o.d;
          return emite(o);
        };
      }
      const dr = api.dSig, est = M.estacionDe(dr, api.modo);     // el distrito donde cae el bloque
      const P = PERFIL[est.distrito] || PERFIL.sur;
      /* El comienzo (los primeros 140 m): filas del distrito, suaves. */
      if (dr < 140) return filaDistrito(api, 0, ctx, st, est, P);
      /* En el parque, cada 90 a 160 m, un tramo de burbujas (baja gravedad)
         con su carrera de SETOS, lo que solo se pasa flotando. Siempre con
         sus setos: un tramo de burbujas suelto, encima de filas de siempre,
         hacía flotar ~60 m un salto cualquiera y caer justo encima de la
         barrera siguiente. Si los carriles todavía están ocupados, se
         vuelve a probar en la vuelta siguiente (después de una fila). */
      if (est.distrito === "parque" && dr >= st.burbujas && setos(api, dif, st, P)) return true;
      /* El bloque propio del distrito, cuando le toca. Si no cabe (el camino
         o los carriles todavía ocupados), sigue tocándole: se vuelve a
         probar en la vuelta siguiente. */
      if (P.firma && dr >= st.propio && BLOQUES[P.firma](api, dif, ctx, st, est)) {
        st.propio = api.dSig + lerp(P.cada[0], P.cada[1], dif) + hashD(dr, 15) * 40;   // el próximo (sin tocar el azar de la pista)
        return true;
      }
      /* Si no, un respiro de monedas a veces, o el sorteo del distrito: su
         fila (lo más común) o uno de sus bloques extra. */
      if (api.azar() < 0.06) { api.bloqueRespiro(); return true; }
      const k = api.elige(P.extra);
      if (k !== "fila" && BLOQUES[k](api, dif, ctx, st, est)) return true;
      return filaDistrito(api, dif, ctx, st, est, P);         // nunca falla: City no deja pasar un bloque clásico
    }
  };

  /** ¿Se puede poner, en el carril c y el metro d, algo que se toma desde el
      suelo (una lona, el vapor, un cobertizo, una viga)? Solo si ese carril
      quedó libre hace rato: quien baja de un techo (~0,55 s en el aire) o
      salta un cajón o un dron (~0,9 s) tiene que tocar el suelo antes de
      llegar, o pasa volando por encima y se estrella contra los vagones que
      siguen. Ejemplo: un cajón a 27 m de una lona, a 46 m/s, no deja
      (el salto cae 37 m después). `st.obst` lo lleva `generador.bloque`. */
  function despejado(api, st, c, d) {
    const V = api.velocidadEn(d);
    return api.libre[c] <= d - V * 0.55 && st.obst[c] <= d - V * 0.9 - 2;
  }
  /** Al final de una ruta por los techos (lona, vapor, cobertizo, viga), su
      carril queda libre lo que tarda en bajar quien venía arriba (~0,5 s de
      un techo al suelo) y en cambiarse de carril: 0,9·V m. Sin esto, la fila
      siguiente podía cerrar ese carril con un vagón justo donde se cae, y
      quien eligió la ruta difícil quedaba encerrado. Devuelve `fin`. */
  function bajada(api, c, fin) {
    api.libre[c] = Math.max(api.libre[c], fin + api.velocidadEn(fin) * 0.9);
    return fin;
  }
  /** Lo que se gana a mitad de un bloque: un chicle si toca (solo con poderes),
      si no, los regalos de siempre (poder, estrella, caja, boleto). */
  function regalo(api, st, c, d, y) {
    if (api.conPoderes && d >= st.chicle) { api.emite({ tipo: "poder", clase: "chicle", carril: c, d, y: y || 1.2 }); st.chicle = d + 650 + api.azar() * 500; return; }
    // la batería (llena la energía de la tabla: solo donde hay tabla) y las monedas ×2, los dos poderes de City
    if (api.conPoderes && api.modo.patineta && d >= st.bateria) { api.emite({ tipo: "poder", clase: "bateria", carril: c, d, y: y || 1.2 }); st.bateria = d + 900 + hashD(d, 4) * 600; return; }
    if (api.conPoderes && d >= st.monedas2) { api.emite({ tipo: "poder", clase: "monedas2", carril: c, d, y: y || 1.2 }); st.monedas2 = d + 800 + hashD(d, 5) * 600; return; }
    api.regalos(c, d, y);
  }
  /** Las celdas de energía de un bloque: dos o tres en fila, 3 m entre sí,
      desde (c, d0) hacia adelante, a la altura y. Cada bloque las pone
      donde sabe que no hay nada (detrás de la fila, encima del riel, sobre
      los techos). Solo con patineta (sin tabla no hay qué cargar). No
      consumen azar: no cambian el resto de la pista. */
  function energia(api, c, d0, y) {
    if (!api.conPoderes || !api.modo.patineta) return;
    const n = 2 + (Math.floor(d0) % 2);                          // dos o tres, según el metro (sin azar)
    for (let i = 0; i < n; i++) api.emite({ tipo: "energia", carril: c, d: d0 + i * 3, y });
  }
  /** Un número de 0 a 1 que sale del metro `d` (y de `k`), sin tocar el
      azar de la pista: lo nuevo de City (rejillas, burbujas) no cambia en
      nada dónde caen los trenes y las barreras, así una pista de antes
      sigue siendo la misma con estas cosas encima. Ejemplo: hashD(812.4, 3)
      da siempre el mismo número, en Node y en cualquier navegador. */
  function hashD(d, k) {
    let h = (Math.floor(d * 16) ^ (k * 0x9e3779b1)) >>> 0;     // el metro en dieciseisavos y la sal
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;           // la mezcla de murmur3 (solo enteros: igual en todas partes)
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  /** Una rejilla del pisotón en el carril c, en d, si ya toca otra (una cada 250 a 450 m). */
  function rejilla(api, st, c, d, P) {
    if (d < st.rejilla) return;
    api.emite({ tipo: "rejilla", carril: c, d });
    const [a, b] = (P && P.rejilla) || [250, 200];               // el Barrio Sur las enseña seguido; Bajo Vías está lleno
    st.rejilla = d + a + hashD(d, 3) * b;
  }
  /** Una estrella secreta en (c, d, y), si ya toca otra (una cada 500 a 800 m). */
  function secreta(api, st, c, d, y) {
    if (d < st.secreta) return;
    api.emite({ tipo: "estrella", secreta: true, carril: c, d, y });
    st.secreta = d + 500 + api.azar() * 300;
  }
  /** La distancia hasta la fila siguiente (como bloqueFila: más corta mientras
      más difícil, y nunca menos de FILA_MIN_S segundos a la velocidad de ahí). */
  const espacio = (api, dif, d) => Math.max(lerp(28, 18, dif), api.velocidadEn(d) * api.FILA_MIN_S) + api.azar() * 4;
  /** Tren(es) detenidos en el carril c desde d0 (n vagones), reservando el carril. */
  function trenes(api, c, d0, n) {
    for (let k = 0; k < n; k++) api.emite({ tipo: "tren", carril: c, d0: d0 + k * (LARGO_VAGON + 0.4), largo: LARGO_VAGON, vel: 0 });
    const fin = d0 + n * (LARGO_VAGON + 0.4);
    /* El carril queda reservado un poco más allá del último vagón: si el
       camino se pasa a él justo ahí, cambiarse (0,17 s) y prepararse para
       lo que venga (rodar, saltar) pide ~0,4 s. Con 4 m fijos, a 31 m/s el
       robot del test no alcanzaba a entrar antes de un dron. */
    api.libre[c] = fin + Math.max(4, api.velocidadEn(fin) * 0.4);
    return fin;
  }

  const BLOQUES = {
    /** LOS MUELLES · la ESCALERA de cajones: tres o cuatro pilas que caen de
        las grúas en el camino, una tras otra, a V + 3 m (~1 s): se cae de un
        salto y se vuelve a saltar, o se pisa cada una y el rebote lleva a la
        siguiente. Los otros carriles, cerrados con vagones mientras dura (un
        pasillo entre trenes): no hay cómo esquivarla de lado. */
    escalera(api, dif, ctx, st, est) {
      const dr = api.dSig, c = api.camino, V = api.velocidadEn(dr);
      if (api.libre[c] > dr) return false;
      const n = 3 + (hashD(dr, 16) < dif ? 1 : 0), paso = Math.ceil(V) + 3;
      const largo = (n - 1) * paso;                               // de la primera pila a la última
      if (dr + largo > M.siguienteUmbral(dr, api.modo) - 240) return false;   // tiene que terminar en Los Muelles, antes del túnel
      for (let i = 0; i < n; i++) {
        api.emite({ tipo: "cajon", carril: c, d: dr + i * paso, cae: true });
        if (!api.peligro) api.arcoMonedas(c, dr + i * paso);
      }
      const nv = Math.ceil((largo + 6) / (LARGO_VAGON + 0.4));    // los vagones del pasillo, de punta a punta
      for (const k of [0, 1, 2]) if (k !== c && api.libre[k] <= dr) trenes(api, k, dr - 2, nv);
      secreta(api, st, c, dr + largo + paso * 0.5, CAJON.alto + 2.6);   // pasada la última pila, en el aire: solo pisándola (el rebote lleva más alto)
      api.libre[c] = dr + largo + 2;
      api.mantener = 1;                                            // al salir sigues en el mismo carril
      api.dSig = dr + largo + espacio(api, dif, dr + largo);
      regalo(api, st, c, dr + largo + 8);
      return true;
    },
    /** Una BARANDA en el camino: 22 a 56 m de riel con monedas encima. Se
        salta y se desliza; o se cambia de carril (uno de los otros dos
        queda libre). Al final, a veces, una estrella secreta en el aire. */
    baranda(api, dif, ctx, st) {
      const dr = api.dSig, c = api.camino;
      if (api.libre[c] > dr) return false;                       // el camino está ocupado: mejor un bloque de siempre
      /* El largo crece con la velocidad: un salto (0,8 s en el aire) cae sobre
         el riel ~0,75·V m después de su comienzo, y siempre tienen que quedar
         de 10 a 21 m de riel por delante para deslizarse (de 22 a 33 m a
         16 m/s, de 45 a 56 m a 46). */
      const largo = Math.ceil(api.velocidadEn(dr) * 0.75) + 10 + Math.floor(api.azar() * 12);
      api.emite({ tipo: "baranda", carril: c, d0: dr, largo, alto: BARANDA.alto });
      if (!api.peligro) api.filaMonedas(c, dr + 2, largo - 3, BARANDA.alto + 0.9, 2);   // monedas a lo largo del riel
      const otros = [0, 1, 2].filter(k => k !== c && api.libre[k] <= dr);
      if (otros.length === 2 && api.azar() < lerp(0.3, 0.7, dif)) {   // uno de los otros carriles, con un tren (el otro queda libre)
        const k = otros[Math.floor(api.azar() * 2)];
        trenes(api, k, dr + 2, 1 + (largo > 22 ? 1 : 0));
      }
      energia(api, c, dr + Math.floor(largo / 2), BARANDA.alto + 1.9);   // las celdas, arriba del riel: hay que saltar deslizándose
      secreta(api, st, c, dr + largo + 3, BARANDA.alto + 2.0);    // saltando al final del riel se alcanza (el salto llega a 2,1 m sobre el riel)
      api.libre[c] = dr + largo + 2;                             // nadie más se mete en el riel
      api.mantener = 1;                                          // al bajar sigues en el mismo carril
      api.dSig = dr + largo + espacio(api, dif, dr + largo);
      regalo(api, st, c, dr + largo + 6);
      return true;
    },
    /** Una LONA (o un respiradero de vapor, en Bajo Vías) al pie de dos o
        tres vagones sin rampa: pisarla te deja arriba de los techos. Va en
        un carril que NO es el camino (es la ruta difícil, con las monedas
        de los techos y a veces una estrella secreta); el camino sigue libre,
        con su fila de monedas. */
    lonas(api, dif, ctx, st, est) {
      const dr = api.dSig, c = api.camino;
      /* La lona va en un carril que quedó libre hace rato: si ahí terminaba
         un convoy, quien baja de su techo (3,35 m, ~0,5 s en el aire) tiene
         que tocar el suelo antes de llegar a ella, o pasa volando por encima
         sin rebotar y se estrella contra los vagones que la siguen. */
      const op = [0, 1, 2].filter(k => k !== c && despejado(api, st, k, dr));
      if (!op.length || api.libre[c] > dr) return false;
      const L = op[Math.floor(api.azar() * op.length)];          // el carril de la lona
      const vapor = est.distrito === "bajo";
      api.emite({ tipo: "lona", carril: L, d: dr, variante: vapor ? "vapor" : "lona" });
      const Vl = api.velocidadEn(dr);                            // la velocidad al llegar a la lona
      const n = Math.min(4, vagonesLona(Vl) + (api.azar() < dif ? 1 : 0));   // los vagones justos para caer arriba (uno más, a veces, si es difícil)
      const d0 = dr + huecoLona(Vl);                             // el primer vagón, a la distancia en que el vuelo ya lo pasa por arriba
      const fin = bajada(api, L, trenes(api, L, d0, n));
      if (!api.peligro) {
        for (let i = 1; i <= 4; i++) api.emite({ tipo: "moneda", carril: L, d: dr + i * 1.6, y: 1.2 + i * 0.9 });   // la subida
        api.filaMonedas(L, d0 + 2, fin - d0 - 4, ALTO_TECHO + 0.9);                               // los techos
        api.filaMonedas(c, dr - 2, Math.min(14, fin - dr - 4));                                   // y el camino
      }
      secreta(api, st, L, d0 + LARGO_VAGON * 0.6, ALTO_TECHO + 1.6);   // encima del primer vagón
      if (n >= 2) energia(api, L, d0 + LARGO_VAGON + 3, ALTO_TECHO + 1.9);   // las celdas, sobre el segundo vagón (la ruta difícil paga)
      const tercero = [0, 1, 2].find(k => k !== c && k !== L && api.libre[k] <= dr);
      if (tercero != null && api.azar() < 0.5) api.emite({ tipo: api.azar() < 0.5 ? "cajon" : "dron", carril: tercero, d: dr + 8 });
      api.dSig = Math.max(dr + espacio(api, dif, dr), d0 + 10);
      regalo(api, st, c, dr + 10);
      return true;
    },
    /** BARRIO SUR · un COBERTIZO al pie de dos o tres vagones sin rampa, en
        un carril que no es el camino (la ruta de arriba). Dos saltos: al
        techito (2 m) y de ahí al techo del vagón. El camino sigue libre. */
    cobertizo(api, dif, ctx, st) {
      const dr = api.dSig, c = api.camino, V = api.velocidadEn(dr);
      // como la lona: un carril libre hace rato (quien baja de un techo toca el suelo antes de llegar)
      const op = [0, 1, 2].filter(k => k !== c && despejado(api, st, k, dr));
      if (!op.length || api.libre[c] > dr) return false;
      const L = op[Math.floor(hashD(dr, 6) * op.length)];       // el carril del cobertizo (sin tocar el azar de la pista)
      const largo = Math.ceil(V * 0.8) + 4;                      // ~0,8 s sobre el techito: aterrizar tarde y aun así saltar a tiempo
      api.emite({ tipo: "cobertizo", carril: L, d0: dr, largo, alto: COBERTIZO.alto });
      rejilla(api, st, c, dr + 4);                               // el camino, abajo: a veces una rejilla del pisotón
      const n = 2 + (hashD(dr, 7) < dif ? 1 : 0);                // dos vagones (tres, si es difícil), pegados al techito
      const fin = bajada(api, L, trenes(api, L, dr + largo, n));
      if (!api.peligro) {
        for (let i = 1; i <= 3; i++) api.emite({ tipo: "moneda", carril: L, d: dr - 6 + i * 1.6, y: 0.9 + i * 0.5 });   // la subida al techito
        api.filaMonedas(L, dr + 2, largo - 4, COBERTIZO.alto + 0.9);                                               // el techito
        api.filaMonedas(L, dr + largo + 2, fin - dr - largo - 4, ALTO_TECHO + 0.9);                                 // los techos
        api.filaMonedas(c, dr - 2, Math.min(14, fin - dr - 4));                                                     // y el camino
      }
      secreta(api, st, L, fin - LARGO_VAGON * 0.5, ALTO_TECHO + 1.6);   // sobre el último vagón: solo por arriba
      energia(api, L, dr + largo + 3, ALTO_TECHO + 1.9);
      const tercero = [0, 1, 2].find(k => k !== c && k !== L && api.libre[k] <= dr);
      if (tercero != null && hashD(dr, 8) < 0.5) api.emite({ tipo: "cajon", carril: tercero, d: dr + 8 });
      api.dSig = Math.max(dr + espacio(api, dif, dr), dr + largo + 10);
      regalo(api, st, c, dr + 10);
      return true;
    },
    /** LOS MUELLES · una VIGA de grúa sobre un carril con vagones (no el
        camino): se salta a ella al comienzo (1,9 m), sube a 4,2 m y te
        deja caer sobre los techos al final. El camino sigue libre. */
    viga(api, dif, ctx, st) {
      const dr = api.dSig, c = api.camino, V = api.velocidadEn(dr);
      const op = [0, 1, 2].filter(k => k !== c && despejado(api, st, k, dr));
      if (!op.length || api.libre[c] > dr) return false;
      const L = op[Math.floor(hashD(dr, 9) * op.length)];
      const sube = Math.ceil(V * 0.35) + 4;                      // la subida: a 20 cuadros/s sube a lo más 0,33 m por cuadro (se agarra con 0,6)
      const largo = sube + Math.ceil(V * 1.2);                   // y ~1,2 s arriba
      api.emite({ tipo: "viga", carril: L, d0: dr, sube, largo });
      rejilla(api, st, c, dr + 4);
      /* Los vagones, debajo desde donde la viga ya va arriba, y hasta
         0,3·V + 6 m pasado su final: soltarse de 4,2 m tarda 0,26 s en
         bajar a la altura de un techo, y tiene que caer encima. */
      const w0 = dr + sube + 2;
      const n = Math.ceil((dr + largo + V * 0.3 + 6 - w0) / (LARGO_VAGON + 0.4));
      const fin = bajada(api, L, trenes(api, L, w0, n));
      if (!api.peligro) {
        /* El arco del salto que agarra la viga: se salta ~0,35 s antes de
           su comienzo (así se llega arriba justo cuando empieza; la viga
           sube más rápido que un salto que llega tarde). */
        const v0 = Math.sqrt(2 * FISICA.gravedad * FISICA.alturaSalto);
        for (let i = 1; i <= 3; i++) { const t = 0.35 * i / 3; api.emite({ tipo: "moneda", carril: L, d: dr - V * 0.35 + V * t, y: 0.9 + v0 * t - FISICA.gravedad * t * t / 2 }); }
        for (let d = dr + 2; d < dr + largo - 1; d += 2.5) api.emite({ tipo: "moneda", carril: L, d, y: alturaViga({ d0: dr, sube }, d) + 0.9 });   // a lo largo de la viga
        api.filaMonedas(L, dr + largo + 4, fin - dr - largo - 6, ALTO_TECHO + 0.9);                                // los techos al soltarse
        api.filaMonedas(c, dr - 2, Math.min(14, fin - dr - 4));
      }
      secreta(api, st, L, dr + largo - 4, VIGA.y1 + 2.0);        // saltando desde la viga (el salto sube 2,1 m más)
      energia(api, L, dr + sube + 4, VIGA.y1 + 1.0);
      const tercero = [0, 1, 2].find(k => k !== c && k !== L && api.libre[k] <= dr);
      if (tercero != null && hashD(dr, 10) < 0.5) api.emite({ tipo: "cajon", carril: tercero, d: dr + 8, cae: true });
      api.dSig = Math.max(dr + espacio(api, dif, dr), dr + 12);
      regalo(api, st, c, dr + 10);
      return true;
    },
    /** BULEVAR AURORA · RIELES EN ZIGZAG: dos o tres barandas que cruzan
        los carriles, cada una empezando 0,35·V + 4 m antes de que termine la
        anterior (~0,35 s de solape: cambiarse de carril tarda 0,17). Se
        hacen enteras sin tocar el suelo. Cada carril lleva un solo riel (dos
        en el mismo carril dejarían un hueco traicionero entre ellos). El
        camino sigue siendo el carril del primero: quien no se cambia baja
        al final de ese riel y sigue. */
    zigzag(api, dif, ctx, st) {
      const dr = api.dSig, c = api.camino, V = api.velocidadEn(dr);
      const orden = c === 0 ? [0, 1, 2] : c === 2 ? [2, 1, 0] : [1, hashD(dr, 11) < 0.5 ? 0 : 2];   // de un lado al otro
      if (orden.some(k => api.libre[k] > dr)) return false;
      const solape = Math.ceil(V * 0.35) + 4;
      let d0 = dr, fin = dr;
      orden.forEach((k, i) => {
        const largo = i === 0 ? Math.ceil(V * 0.75) + 10 : Math.ceil(V * 0.9) + 10;   // el primero, como una baranda; los otros, más largos que el doble solape
        if (i > 0) d0 = fin - solape;
        api.emite({ tipo: "baranda", carril: k, d0, largo, alto: BARANDA.alto, zigzag: i + 1 });
        if (!api.peligro) api.filaMonedas(k, d0 + 2, largo - 3, BARANDA.alto + 0.9, 2);
        if (i > 0) energia(api, k, d0 + 2, BARANDA.alto + 1.1);   // las celdas, al comienzo de cada riel nuevo: premian el transbordo
        fin = d0 + largo;
        api.libre[k] = fin + 2;
      });
      const ult = orden[orden.length - 1];
      secreta(api, st, ult, fin + 3, BARANDA.alto + 2.0);        // al final del último riel, en el aire: solo llega quien hizo el zigzag
      api.mantener = 1;
      api.dSig = fin + espacio(api, dif, fin);
      regalo(api, st, c, api.libre[c] + 4);
      return true;
    },
    /** BAJO VÍAS · un CONDUCTO en el camino: se pasa rodando, y como es más
        largo que una rodada (≈0,85 s dentro contra 0,62), hay que volver a
        rodar adentro, en el anillo de luz. Los otros carriles, cerrados con
        vagones (uno siempre, el otro casi siempre): por arriba de ellos se
        puede caminar el techo del conducto. */
    conducto(api, dif, ctx, st) {
      const dr = api.dSig, c = api.camino, V = api.velocidadEn(dr);
      if (api.libre[c] > dr) return false;
      /* Más largo que una rodada (0,62 s) y más corto que dos: 0,85·V + 2 m.
         El ANILLO va a medio camino entre dos puntos: desde dónde una rodada
         nueva (~0,6·V m, contando lo que se come un cuadro lento) ya alcanza
         la salida, largo + 0,3 − 0,6·V, y dónde se acaba la primera rodada
         empezada en la boca, ~0,5·V − 0,6. Así vale a 16 m/s y a 46, a 20
         cuadros/s y a 144. Apretar «abajo» antes también sirve: cada vez
         reinicia la rodada. */
      const largo = Math.ceil(V * 0.85) + 2;
      const anillo = dr + Math.round((largo - 0.1 * V - 0.3) / 2);
      api.emite({ tipo: "conducto", carril: c, d0: dr, largo, anillo });   // el anillo: dónde volver a rodar
      if (!api.peligro) api.filaMonedas(c, dr + 1, largo - 2, 0.5, 1.5);   // bajitas, adentro: rueda
      const n = Math.ceil(largo / (LARGO_VAGON + 0.4));
      const otros = [0, 1, 2].filter(k => k !== c && api.libre[k] <= dr);
      otros.forEach((k, i) => {
        if (i === 0 || hashD(dr, 12) < lerp(0.4, 0.8, dif)) {
          /* La ruta de arriba: un respiradero de vapor antes de los vagones
             (a la distancia justa de una lona) te deja en sus techos, y de
             ahí se ve el conducto desde arriba. Solo si ese carril está
             libre desde antes (como toda lona). */
          const dl = dr - 2 - huecoLona(V);
          if (i === 0 && despejado(api, st, k, dl)) {
            api.emite({ tipo: "lona", carril: k, d: dl, variante: "vapor" });
            if (!api.peligro) api.filaMonedas(k, dr + 1, n * (LARGO_VAGON + 0.4) - 4, ALTO_TECHO + 0.9);   // los techos pagan
            bajada(api, k, trenes(api, k, dr - 2, n));
          } else trenes(api, k, dr - 2, n);
        } else api.emite({ tipo: "dron", carril: k, d: dr + 4 });
      });
      api.libre[c] = dr + largo + 2;
      api.mantener = 1;
      /* Al salir, un poco más de aire que entre filas: quien no entró al
         conducto (por un carril que quedó libre, el de un tren que venía)
         puede tener que cruzar dos carriles para volver al camino. */
      api.dSig = dr + largo + espacio(api, dif, dr + largo) + Math.ceil(V * 0.3);
      regalo(api, st, c, dr + largo + 6);
      return true;
    },
  };

  /** PARQUE · un tramo de burbujas con SETOS: muros de setos de 2,8 m que
      solo se pasan con el salto que flota (en las burbujas llega a 3,82 m).
      Tres o cuatro muros, separados 2·V + 6 m: un salto flotante dura ~1,5 s,
      así que entre muro y muro se aterriza y se vuelve a saltar. El primero
      va a 0,7·V + 4 m de la entrada (el salto se da ya dentro del tramo) y
      el tramo sigue 1,3·V + 8 m pasado el último (se aterriza flotando). Un
      carril que no es el camino lleva, a veces, un vagón en vez de seto.
      Devuelve false si el camino está ocupado (se prueba de nuevo luego). */
  function setos(api, dif, st, P) {
    const dr = api.dSig, V = api.velocidadEn(dr), c = api.camino;
    /* El camino tiene que estar libre ya; los otros carriles pueden tener
       todavía un tren que termina (hasta 80 m más allá): la carrera empieza
       cuando todos están libres (`base`), y entre medio solo hay burbujas. */
    const ocupado = Math.max(api.libre[0], api.libre[1], api.libre[2]);
    if (api.libre[c] > dr || ocupado > dr + 80) return false;
    const base = Math.max(dr, ocupado);
    const n = 3 + (hashD(dr, 13) < 0.3 + dif * 0.5 ? 1 : 0);
    const primero = base + Math.ceil(V * 0.7) + 4, paso = Math.ceil(V * 2) + 6;
    const ultimo = primero + (n - 1) * paso, largo = ultimo + Math.ceil(V * 1.3) + 8 - dr;
    // todo dentro del parque: termina antes de que se pida el túnel al distrito siguiente (220 m antes)
    if (dr + largo > M.siguienteUmbral(dr, api.modo) - 260) { st.burbujas = M.siguienteUmbral(dr, api.modo); return false; }   // (el próximo, en la próxima vuelta al parque)
    api.emite({ tipo: "burbujas", carril: 1, d0: dr, largo, setos: n });
    for (let i = 0; i < n; i++) {
      const d = primero + i * paso;
      for (let k = 0; k < 3; k++) {
        if (k !== c && hashD(d, 14 + k) < 0.3) { trenes(api, k, d - 4, 1); continue; }   // un vagón: ese carril, cerrado en este muro
        api.emite({ tipo: "seto", carril: k, d });
        api.libre[k] = Math.max(api.libre[k], d + 2);
      }
      /* El arco del salto flotante sobre el muro, dibujado con ese salto de
         verdad (como arcoMonedas en motor.js para la barrera baja). Antes era
         un arco fijo de 13 m, pero el salto flotante dura 1,46 s: a 30 m/s
         vuela 44 m y pasaba más de un metro por encima de las monedas de las
         puntas. Ahora las siete siguen su parábola (gravedad × 0,55, cima a
         3,82 m) a la velocidad de ese metro, con la cima sobre el seto, cada
         una ALTO_BURBUJA sobre los pies y separadas PASO_BURBUJA de medio
         salto. Son más juntas y más bajas que las de la barrera (0,18 y 0,7):
         un salto que dura el doble se aleja más del ideal, y a 20 fps este
         sube solo 3,53 m, así que con los números de la barrera se perdía la
         última si se saltaba un poco antes. Así aguanta saltar 0,16 s antes o
         después a cualquier fps (colabtex/tests/metrorush-arco.test.cjs). */
      if (!api.peligro) {
        const g = FISICA.gravedad * BURBUJAS.gravedad;           // la gravedad dentro de las burbujas
        const v0 = impulso(FISICA.alturaSalto);                  // el mismo impulso del salto de siempre…
        const cima = v0 * v0 / (2 * g), medio = v0 / g;          // …que aquí sube a 3,82 m y tarda 0,73 s en llegar arriba
        for (let j = 0; j < 7; j++) {
          const t = (j - 3) * PASO_BURBUJA * medio;              // segundos antes (−) o después (+) de la cima
          const pies = cima - g * t * t / 2;                     // la altura de los pies en ese instante
          api.emite({ tipo: "moneda", carril: c, d: d + V * t, y: pies + ALTO_BURBUJA });
        }
      }
    }
    secreta(api, st, c, ultimo, 6.5);                             // arriba del último muro: con el doble salto (~7,6 m)
    api.dSig = dr + largo + Math.ceil(V * 0.4) + 4;             // la fila siguiente, ya fuera de las burbujas (un seto en el borde no sería ni muro ni salto)
    st.burbujas = dr + largo + lerp(P.cada[0], P.cada[1], dif) + hashD(dr, 2) * 70;   // el próximo tramo: el parque es sobre todo esto
    return true;
  }

  /** La FILA de un distrito (su perfil P): en el camino lo que diga
      `P.camino` (un cajón que se salta o se pisa, un dron que se rueda, o
      nada y una fila de monedas); en el carril por donde seguirá el camino,
      a veces algo pasable (`P.sig`); y el otro carril, cerrado de verdad:
      un tren que viene, vagones, una subida (lona o vapor con vagones), un
      seto o un obstáculo. Nunca una fila vacía, y nunca falla: si el camino
      todavía está reservado, se salta hasta donde se libera. */
  function filaDistrito(api, dif, ctx, st, est, P) {
    const dr = api.dSig, esp = espacio(api, dif, dr), V = api.velocidadEn(dr);
    if (api.libre[api.camino] > dr) { api.dSig = api.libre[api.camino]; return true; }   // el camino está reservado (un riel, un conducto): se sigue después
    const cae = est.distrito === "muelles";                      // en Los Muelles los cajones caen desde las grúas
    const pon = (t, c) => api.emite({ tipo: t, carril: c, d: dr, cae: cae && t === "cajon" });
    rejilla(api, st, api.camino, dr - esp * 0.45, P);            // a veces una rejilla del pisotón en el camino, antes de la fila
    const sig = api.siguienteCamino(dr + esp, lerp(0.35, 0.6, dif));
    let cerrados = 0;
    for (let c = 0; c < 3; c++) {
      if (api.libre[c] > dr) { cerrados++; continue; }
      if (c === api.camino) {
        const t = api.elige(P.camino);
        if (t !== "nada") pon(t, c);
        if (!api.peligro) {
          if (t === "cajon") api.arcoMonedas(c, dr);             // el arco: salta (o pisa) aquí
          else if (t === "dron") api.filaMonedas(c, dr - 3, 6, 0.5, 1.5);   // bajita: rueda aquí
          else api.filaMonedas(c, dr - 4, Math.min(12, esp - 6));
        }
        continue;
      }
      if (c === sig) {                                           // por donde seguirá el camino: a lo más algo pasable
        if (api.azar() < 0.3) pon(api.elige(P.sig), c);
        continue;
      }
      cerrados++;                                                // el carril cerrado de verdad
      if (api.azar() < lerp(P.marcha[0], P.marcha[1], dif) && ctx && ctx.V > 0) {   // un tren que viene de frente
        const t = api.emite(api.trenEnMarcha(c, dr, V));
        api.libre[c] = t.d0 + LARGO_VAGON + 6;
        continue;
      }
      const k = api.elige(P.cerrado);
      if (k === "seto") { api.emite({ tipo: "seto", carril: c, d: dr }); api.libre[c] = dr + SETO.largo; }
      else if (k === "subida" && despejado(api, st, c, dr)) {   // la ruta de arriba: libre desde antes (quien baja de un techo toca el suelo antes)
        api.emite({ tipo: "lona", carril: c, d: dr, variante: est.distrito === "bajo" ? "vapor" : "lona" });
        const d0 = dr + huecoLona(V), fin = bajada(api, c, trenes(api, c, d0, vagonesLona(V)));
        if (!api.peligro) api.filaMonedas(c, d0 + 2, fin - d0 - 4, ALTO_TECHO + 0.9);   // los techos pagan
      }
      else if (k === "vagones" || k === "subida") {
        const [a, b] = P.vagones;
        trenes(api, c, dr, a + Math.floor(api.azar() * (b - a + 1)));   // de `a` a `b` vagones (Bajo Vías: paredes largas)
      }
      else pon(k, c);                                            // un cajón o un dron: también cierra el carril si no se pasa a tiempo
    }
    if (!cerrados) {                                             // nunca una fila vacía
      const c = [0, 1, 2].find(x => x !== api.camino && x !== sig && api.libre[x] <= dr);
      if (c != null) trenes(api, c, dr, 1);
    }
    /* Las celdas, en el carril de la fila justo después del obstáculo (de
       dr + 6 a dr + 12): ese carril queda vacío hasta la fila siguiente,
       que está a 18 m o más. */
    if (hashD(dr, 17) < 0.4) energia(api, api.camino, dr + 6, 1.0);   // (no en todas: en City casi todo son filas, y la tabla se llenaba sola)
    regalo(api, st, api.camino, dr + esp * 0.5);
    api.camino = sig;
    api.dSig = dr + esp;
    return true;
  }

  /* ---------- Instalar ----------
     Se llena el MUNDO city (el armazón de motor.js) y se exportan las
     piezas que usan juego.js, mundo.js y los tests en M.CITY. */
  const W = M.MUNDOS.city;
  Object.assign(W, { estaciones: DISTRITOS, vuelta: VUELTA, intro: INTRO, boletos: POSTALES, velocidad: VELOCIDAD_CITY, velocidadV2: VELOCIDAD_CITY_V2,
    generador, personajes: PERSONAJES, tema: "city-sur" });
  M.ESTACIONES_CITY = DISTRITOS; M.INTRO_CITY = INTRO; M.BOLETOS_CITY = POSTALES;
  M.CITY = { DISTRITOS, VUELTA, VELOCIDAD: VELOCIDAD_CITY, INTRO, POSTALES, PERSONAJES, ventajaDe, CAJON, DRON, BARANDA, LONA, PISA, PISA_DRON, pisa, enLona, impulsoLona, vueloLona, huecoLona, vagonesLona, PERFIL, PROPIO,
    ENERGIA_LLENA, TABLA_SEG, MONEDAS2_SEG, CHICLE, DRON_IMPULSO, REJILLA, BURBUJAS, alturaCae,
    COBERTIZO, CONDUCTO, SETO, VIGA, alturaViga };
  return M;
});
