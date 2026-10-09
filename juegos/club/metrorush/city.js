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
     · DRONES: flotan a la altura de la cabeza (1,15 a 1,95 m). Se pasan
       rodando, o se pisan desde arriba (desde un techo o una lona).
     · BARANDAS: un riel de 1 m de alto y de 16 a 30 m de largo. Saltando
       se cae encima y se desliza (grind): suelta monedas mientras dura. De
       frente, al nivel del suelo, chocan.
     · LONAS (y respiraderos de vapor en Bajo Vías): no chocan; pisarlas te
       lanza a 5,2 m, lo justo para caer sobre un tren sin rampa.
     · CHICLE: un poder (solo en los modos con poderes) que te envuelve en
       una burbuja: el próximo choque de frente la revienta y sigues.
     · ESTRELLAS SECRETAS: estrellas normales (+1 al multiplicador, la prueba
       las anota como cualquier estrella) puestas donde solo se llega por la
       ruta difícil: arriba del salto de una lona, al final de una baranda.
   Nada de esto cambia cómo se calculan los puntos: siguen siendo 10 por
   metro × el multiplicador, y el multiplicador solo cambia con estrellas,
   el 2× y el +5. Por eso la prueba (prueba.js) no necesitó eventos nuevos.

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
     Llega al tope a los ~273 s (4 min 33 s), a los ~8,5 km.
     La leen el juego, el generador (velocidadEn) y el antitrampas
     (metrosEntre) por M.velocidadDe(modo). Cambiarla cambia las pruebas de
     City: no hay pruebas de City guardadas de antes de esto (el modo era un
     armazón), así que no hizo falta subir VERSION en prueba.js. */
  const VELOCIDAD_CITY = { V0: 16, VMAX: 46, ACEL: 0.11 };

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
    nico: { id: "nico", nombre: "Nico", precio: 9000, ventaja: { salto: 1.12 }, texto: "Resortes: salta un 12 % más alto",
      apariencia: { piel: 0xf1c19c, pelo: 0xc9772e, peinado: "corto", falda: null, sudadera: 0xffb020, gorra: 0x2d6cdf, jeans: 0x3a3f58, mochila: 0x2d6cdf, mochila2: 0xffd23f, suela: 0x2d6cdf } },
    ambar: { id: "ambar", nombre: "Ámbar", precio: 12000, ventaja: { pisoton: 2 }, texto: "Pisotón de oro: el doble de monedas al romper cajones y drones",
      apariencia: { piel: 0x8d5a3b, pelo: 0x140c08, peinado: "trenzas", falda: 0x7b2ff7, sudadera: 0xffd23f, gorra: 0x7b2ff7, jeans: 0x1d1e2c, mochila: 0x00c2a8, mochila2: 0xff5a8a, suela: 0xffffff } },
    bruno: { id: "bruno", nombre: "Bruno", precio: 15000, ventaja: { grind: 2 }, texto: "Rielero: el doble de monedas deslizándose por las barandas",
      apariencia: { piel: 0xe0ac84, pelo: 0x3b2a20, peinado: "rapado", falda: null, sudadera: 0x3a4a3a, gorra: 0xe8463b, jeans: 0x1f2a44, mochila: 0xe8463b, mochila2: 0xf2f2f2, suela: 0xe8463b } },
    sol: { id: "sol", nombre: "Sol", precio: 20000, ventaja: { lona: 1.15 }, texto: "Acróbata: las lonas y el vapor la lanzan un 15 % más alto",
      apariencia: { piel: 0xf6d2b8, pelo: 0xe8c25a, peinado: "melena", falda: 0xff7a3d, sudadera: 0xff7a3d, gorra: 0x23304a, jeans: 0x23304a, mochila: 0x6ad1ff, mochila2: 0xffe14d, suela: 0x23304a } }
  };
  /** La ventaja del personaje `id` (o {} si no es de City): {iman, salto, pisoton, grind, lona}. */
  const ventajaDe = id => (id && PERSONAJES[id] ? PERSONAJES[id].ventaja : {}) || {};

  /* ---------- Los objetos nuevos de la pista ----------
     Las medidas que comparten el juego (choques, pisar, deslizarse) y
     mundo.js (el dibujo). Todo en metros sobre la vía. */
  const CAJON = { alto: 1.0, largo: 1.2, w: 0.9 };            // la pila de cajas: un poco más alta que la barrera baja (0,95), se salta igual
  const DRON = { y0: 1.15, y1: 1.95, largo: 0.9, w: 0.8 };     // el dron: rodando (0,8 m) pasas por debajo
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

  /** ¿Una caída del corredor rompe el objeto `o` (un cajón o un dron)? Sí
      si va bajando (vy ≤ 0) y en el cuadro anterior sus pies estaban
      encima del objeto (o casi, PISA metros por debajo de su borde de
      arriba). Ejemplo: cajón de 1 m, pies a 1,2 m y bajando → lo pisa; pies
      a 0,3 m (saltó tarde y se lo comió de frente) → choca. */
  function pisa(o, yAntes, vy) {
    if (!o || o.roto || (o.tipo !== "cajon" && o.tipo !== "dron") || vy > 0) return false;
    const arriba = o.tipo === "cajon" ? CAJON.alto : DRON.y1;           // el borde de arriba
    return yAntes >= arriba - PISA;
  }
  /** ¿El corredor (en x, D, a altura y) está pisando la lona `o`? Solo
      desde el suelo (no desde un techo ni volando). */
  function enLona(o, x, D, y) {
    return o.tipo === "lona" && !o.usada && y < 0.35 && Math.abs(o.d - D) < LONA.largo / 2 + 0.3 && Math.abs(x - CARRILES[o.carril]) < LONA.w;
  }
  /** La velocidad hacia arriba que da la lona (con la ventaja de Sol, si la tiene). */
  const impulsoLona = (k = 1) => impulso(LONA.altura * k);

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
  const PESOS = {                                              // qué bloque sale más en cada distrito
    sur: { cajones: 3, lonas: 2, baranda: 1.5, drones: 0.6 },
    muelles: { cajones: 3.5, lonas: 1.6, baranda: 1.2, drones: 0.6 },
    bulevar: { baranda: 3, lonas: 1.8, cajones: 1.2, drones: 1 },
    parque: { lonas: 3, baranda: 1.4, cajones: 1.5, drones: 0.6 },
    bajo: { drones: 3.4, lonas: 2.4, baranda: 1.5, cajones: 1 }
  };
  const generador = {
    bloque(api, dif, ctx) {
      const st = api._city || (api._city = { sig: 150, chicle: 700, secreta: 600 });
      if (api.dSig < st.sig) return false;                        // todavía no toca: un bloque de siempre
      const dr = api.dSig, est = M.estacionDe(dr, api.modo);      // el distrito donde cae el bloque
      const pesos = PESOS[est.distrito] || PESOS.sur;
      const tipo = api.elige(pesos);
      const hecho = BLOQUES[tipo](api, dif, ctx, st, est);
      st.sig = api.dSig + lerp(140, 60, dif) + api.azar() * 50;  // el próximo bloque de City
      return hecho;
    }
  };

  /** Lo que se gana a mitad de un bloque: un chicle si toca (solo con poderes),
      si no, los regalos de siempre (poder, estrella, caja, boleto). */
  function regalo(api, st, c, d, y) {
    if (api.conPoderes && d >= st.chicle) { api.emite({ tipo: "poder", clase: "chicle", carril: c, d, y: y || 1.2 }); st.chicle = d + 650 + api.azar() * 500; return; }
    api.regalos(c, d, y);
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
    api.libre[c] = fin + 4;
    return fin;
  }

  const BLOQUES = {
    /** Una fila de CAJONES: en el camino una pila que se salta o se pisa
        (con un arco de monedas encima, que enseña dónde saltar); los otros
        carriles, cerrados con trenes, drones o más cajones. */
    cajones(api, dif, ctx, st) {
      return fila(api, dif, ctx, st, "cajon");
    },
    /** Una fila de DRONES: en el camino un dron que se pasa rodando (con una
        fila de monedas bajita debajo, que enseña a rodar). */
    drones(api, dif, ctx, st) {
      return fila(api, dif, ctx, st, "dron");
    },
    /** Una BARANDA en el camino: 16 a 30 m de riel con monedas encima. Se
        salta y se desliza; o se cambia de carril (uno de los otros dos
        queda libre). Al final, a veces, una estrella secreta en el aire. */
    baranda(api, dif, ctx, st) {
      const dr = api.dSig, c = api.camino;
      if (api.libre[c] > dr) return false;                       // el camino está ocupado: mejor un bloque de siempre
      const largo = 16 + Math.floor(api.azar() * 15);
      api.emite({ tipo: "baranda", carril: c, d0: dr, largo, alto: BARANDA.alto });
      if (!api.peligro) api.filaMonedas(c, dr + 2, largo - 3, BARANDA.alto + 0.9, 2);   // monedas a lo largo del riel
      const otros = [0, 1, 2].filter(k => k !== c && api.libre[k] <= dr);
      if (otros.length === 2 && api.azar() < lerp(0.3, 0.7, dif)) {   // uno de los otros carriles, con un tren (el otro queda libre)
        const k = otros[Math.floor(api.azar() * 2)];
        trenes(api, k, dr + 2, 1 + (largo > 22 ? 1 : 0));
      }
      secreta(api, st, c, dr + largo + 3, BARANDA.alto + 2.3);    // saltando al final del riel se alcanza
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
         un convoy, quien baja de su techo (3,35 m, ~0,45 s en el aire) tiene
         que tocar el suelo antes de llegar a ella, o pasa volando por encima
         sin rebotar y se estrella contra los vagones que la siguen. */
      const aire = api.velocidadEn(dr) * 0.5;
      const op = [0, 1, 2].filter(k => k !== c && api.libre[k] <= dr - aire);
      if (!op.length || api.libre[c] > dr) return false;
      const L = op[Math.floor(api.azar() * op.length)];          // el carril de la lona
      const vapor = est.distrito === "bajo";
      api.emite({ tipo: "lona", carril: L, d: dr, variante: vapor ? "vapor" : "lona" });
      const n = 2 + (api.azar() < dif ? 1 : 0);
      /* Dónde empieza el tren: lo bastante lejos para que el salto ya vaya
         por encima de su techo al llegar a él. Subiendo a 5,2 m se pasa los
         3,55 m (techo y un margen) a los 0,24 s; a 46 m/s eso son 11 m, así
         que el hueco crece con la velocidad de ahí: 5,7 m a 16 m/s, 13,5 m
         a 46. Se cae encima hasta 0,86 s después del salto (14 m a 16 m/s,
         40 m a 46): con dos o tres vagones casi siempre aterrizas arriba. */
      const d0 = dr + Math.max(5, api.velocidadEn(dr) * 0.26 + 1.5);
      const fin = trenes(api, L, d0, n);
      if (!api.peligro) {
        for (let i = 1; i <= 4; i++) api.emite({ tipo: "moneda", carril: L, d: dr + i * 1.6, y: 1.2 + i * 0.9 });   // la subida
        api.filaMonedas(L, d0 + 2, fin - d0 - 4, ALTO_TECHO + 0.9);                               // los techos
        api.filaMonedas(c, dr - 2, Math.min(14, fin - dr - 4));                                   // y el camino
      }
      secreta(api, st, L, d0 + LARGO_VAGON * 0.6, ALTO_TECHO + 1.6);   // encima del primer vagón
      const tercero = [0, 1, 2].find(k => k !== c && k !== L && api.libre[k] <= dr);
      if (tercero != null && api.azar() < 0.5) api.emite({ tipo: api.azar() < 0.5 ? "cajon" : "dron", carril: tercero, d: dr + 8 });
      api.dSig = Math.max(dr + espacio(api, dif, dr), d0 + 10);
      regalo(api, st, c, dr + 10);
      return true;
    }
  };

  /** Una fila con `obst` (cajón o dron) en el camino. Los demás carriles: el
      de la fila siguiente (por donde pasará el camino) a lo más con otro
      obstáculo pasable, y el que queda cerrado de verdad con un tren, un
      tren que viene, o un obstáculo de City. Nunca una fila vacía. */
  function fila(api, dif, ctx, st, obst) {
    const dr = api.dSig, esp = espacio(api, dif, dr);
    if (api.libre[api.camino] > dr) return false;                // el camino está reservado: un bloque de siempre
    const sig = api.siguienteCamino(dr + esp, lerp(0.35, 0.6, dif));
    let cerrados = 0;
    for (let c = 0; c < 3; c++) {
      if (api.libre[c] > dr) { cerrados++; continue; }
      if (c === api.camino) {
        api.emite({ tipo: obst, carril: c, d: dr });
        if (!api.peligro) {
          if (obst === "cajon") api.arcoMonedas(c, dr);           // el arco: salta (o pisa) aquí
          else api.filaMonedas(c, dr - 3, 6, 0.5, 1.5);           // bajita: rueda aquí
        }
        continue;
      }
      if (c === sig) {                                           // por donde seguirá el camino: a lo más algo pasable
        if (api.azar() < 0.35) api.emite({ tipo: api.azar() < 0.5 ? "cajon" : "dron", carril: c, d: dr });
        continue;
      }
      const r = api.azar();                                      // el carril cerrado de verdad
      if (r < lerp(0.15, 0.35, dif) && ctx && ctx.V > 0) {
        const t = api.emite(api.trenEnMarcha(c, dr, api.velocidadEn(dr)));
        api.libre[c] = t.d0 + LARGO_VAGON + 6;
      } else if (r < lerp(0.6, 0.8, dif)) trenes(api, c, dr, api.azar() < lerp(0.3, 0.6, dif) ? 2 : 1);
      else api.emite({ tipo: api.azar() < 0.5 ? "cajon" : "dron", carril: c, d: dr });
      cerrados++;
    }
    if (!cerrados) {                                             // nunca una fila vacía
      const c = [0, 1, 2].find(x => x !== api.camino && x !== sig && api.libre[x] <= dr);
      if (c != null) trenes(api, c, dr, 1);
    }
    regalo(api, st, api.camino, dr + esp * 0.5);
    api.camino = sig;
    api.dSig = dr + esp;
    return true;
  }

  /* ---------- Instalar ----------
     Se llena el MUNDO city (el armazón de motor.js) y se exportan las
     piezas que usan juego.js, mundo.js y los tests en M.CITY. */
  const W = M.MUNDOS.city;
  Object.assign(W, { estaciones: DISTRITOS, vuelta: VUELTA, intro: INTRO, boletos: POSTALES, velocidad: VELOCIDAD_CITY,
    generador, personajes: PERSONAJES, tema: "city-sur" });
  M.ESTACIONES_CITY = DISTRITOS; M.INTRO_CITY = INTRO; M.BOLETOS_CITY = POSTALES;
  M.CITY = { DISTRITOS, VUELTA, VELOCIDAD: VELOCIDAD_CITY, INTRO, POSTALES, PERSONAJES, ventajaDe, CAJON, DRON, BARANDA, LONA, PISA, pisa, enLona, impulsoLona, PESOS };
  return M;
});
