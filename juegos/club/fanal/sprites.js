/* FANAL — el pixel art: paletas por acto, polillas, fanal, jefes e iconos.

   Qué hace, en general:
   - Guarda cada sprite chico como un dibujo en texto (una letra por
     píxel). Las letras no son colores sino PAPELES (ala, cuerpo, borde,
     mancha…), y cada acto les da su paleta. Así la misma forma puede
     vestirse de cobre en el enjambre y de violeta en lo oscuro.
   - Los jefes son demasiado grandes para escribirlos a mano: se dibujan
     con formas (elipses, polígonos) en un lienzo diminuto y después se
     CUANTIZAN: cada píxel se queda o se va según su opacidad y toma el
     color más cercano de la paleta. El resultado es pixel art de verdad,
     sin bordes suavizados, con el detalle de un dibujo.
   - Todo se pinta una vez en lienzos chicos y se guarda en un banco; el
     juego solo copia esos lienzos (drawImage), que es lo más barato que
     sabe hacer un canvas.

   Por qué así: sin archivos de imagen no hay nada que cargar ni que pueda
   llegar viejo del caché, y las paletas por acto (la prioridad visual del
   juego) salen gratis. Las polillas se dibujan cabeza ARRIBA, como se
   piensa una polilla, y el banco las voltea: en el juego miran hacia
   abajo, hacia la luz. UMD: `FanalSprites` en la página y en Node (para
   comprobar que los dibujos están bien formados). */
(function (raiz, fabrica) {
  // En Node (tests) se exporta como módulo CommonJS.
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  // En el navegador queda colgado de window.FanalSprites.
  else raiz.FanalSprites = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ================================================================
     Paletas por acto
     ================================================================
     Cada acto tiene su cielo, sus estrellas, su niebla, sus escamas y
     tres juegos de colores para sus tres tipos de polilla. Los papeles de
     una polilla son: a antenas, b ala, B ala en sombra, e mancha, f borde
     claro del ala, c cuerpo, d brillo del cuerpo. Ninguna paleta usa neón:
     el enjambre es sepia y vino, la niebla es jade y hueso, lo oscuro es
     violeta casi negro, el alba es nácar y oro. */
  const PALETAS = {
    1: {
      nombre: "enjambre",
      cielo: ["#0b0a1c", "#1a1230", "#2c1a3a"],          // de arriba hacia el horizonte
      estrella: ["#ffe8c2", "#ffc98a", "#e8b0a0"],       // tres temperaturas de estrella
      nube: ["#4a2546", "#7a3b45"],                      // polvo de nebulosa
      particula: "#c8a07a",                              // polen que flota cerca
      sombra: "#07050f",                                 // el color de la oscuridad
      escama: ["#ffd2a0", "#ff8a4a"],                    // núcleo y halo de las escamas
      naufragio: { m: "#5a4232", n: "#3a281d", k: "#7d5c40", h: "#a0784a", g: "#3a281d" },
      a: { a: "#7a665a", b: "#a8917a", B: "#6e5a4d", e: "#dcc6a2", f: "#c9b49a", c: "#4a3a33", d: "#8a6e5c" },
      b: { a: "#7a4a34", b: "#b8682f", B: "#7a3f22", e: "#f0b45a", f: "#e08a45", c: "#4d2a1c", d: "#9c5a33" },
      c: { a: "#7a4458", b: "#9a4a62", B: "#5e2a3e", e: "#e8a0a8", f: "#c2687e", c: "#3e1e2c", d: "#7a3a52" },
      acento: "#e0a85a"
    },
    2: {
      nombre: "niebla",
      cielo: ["#0a1416", "#15221f", "#22302c"],
      estrella: ["#d6e6dc", "#b8ccc2", "#9fb5aa"],
      nube: ["#5f7a74", "#9fb4ac"],                      // bancos de niebla
      particula: "#c8d8d0",                              // gotas en suspensión
      sombra: "#0a1214",
      escama: ["#e6f6dc", "#8fd6b0"],
      naufragio: { m: "#3e4a46", n: "#28322f", k: "#5d6e66", h: "#6f8a5a", g: "#90a89a" },
      a: { a: "#8fae96", b: "#a9d6a2", B: "#6e9e7c", e: "#eef6d0", f: "#d2ecc0", c: "#e8efe0", d: "#ffffff" },
      b: { a: "#8a9692", b: "#c9d3cf", B: "#8c9a96", e: "#b0c0bb", f: "#eef3f0", c: "#9aa8a4", d: "#dfe7e3" },
      c: { a: "#7a5a3e", b: "#c79a5a", B: "#7c5a34", e: "#f2dfb0", f: "#e3b978", c: "#5a3c26", d: "#a0764a" },
      acento: "#a9d6a2"
    },
    3: {
      nombre: "oscuro",
      cielo: ["#020206", "#07050e", "#0d0918"],
      estrella: ["#a89cc8", "#8a80a8", "#6a6088"],
      nube: ["#120d1e", "#1e1530"],                      // casi nada: el vacío
      particula: "#5a4a70",                              // ceniza que cae
      sombra: "#020104",
      escama: ["#e4d2ff", "#8a5cff"],
      naufragio: { m: "#1e1a26", n: "#120f18", k: "#2e2838", h: "#4a3a62", g: "#6a55a0" },
      a: { a: "#5a4a80", b: "#2e2540", B: "#1c1628", e: "#6a55a0", f: "#8a6fd0", c: "#241c30", d: "#4a3a62" },
      b: { a: "#6a6078", b: "#3a3440", B: "#24202a", e: "#7a7088", f: "#a49ab8", c: "#2a2430", d: "#5a5068" },
      c: { a: "#5a4a70", b: "#261c2e", B: "#150f1a", e: "#d8cdb8", f: "#9a86b8", c: "#1c1424", d: "#3e2e4e" },
      acento: "#9a86b8"
    },
    4: {
      nombre: "alba",
      cielo: ["#f6d8c0", "#a8687a", "#2a1a3a"],          // el alba viene de arriba
      estrella: ["#fff8ec", "#ffe2b8", "#ffd0c0"],
      nube: ["#f2b8a0", "#c87a8a"],
      particula: "#fff2d0",                              // motas de luz que suben
      sombra: "#1a1028",
      escama: ["#fff6d8", "#ffcf7a"],
      naufragio: { m: "#c8a0a8", n: "#8a6a7a", k: "#e8c8c0", h: "#fff0d8", g: "#fff0d8" },
      a: { a: "#ffdca0", b: "#ffe9b0", B: "#ffc56a", e: "#fff3d0", f: "#fffaf0", c: "#ffd27a", d: "#ffffff" },
      b: { a: "#4a3a5a", b: "#2a1e30", B: "#180f1e", e: "#5a4a6a", f: "#6a4a7a", c: "#1e1424", d: "#3a2a46" }, // sombras
      c: { a: "#ffdca0", b: "#ffe9b0", B: "#ffc56a", e: "#fff3d0", f: "#fffaf0", c: "#ffd27a", d: "#ffffff" },
      acento: "#ffd27a"
    },
    5: {
      nombre: "sinfin",
      cielo: ["#04070e", "#0a1220", "#121c2e"],
      estrella: ["#d8e4fa", "#a8bce0", "#8aa0c8"],
      nube: ["#1a2a44", "#2a3a5a"],
      particula: "#8fb0e0",
      sombra: "#030509",
      escama: ["#e0ecff", "#7aa6ff"],
      naufragio: { m: "#1e2836", n: "#121a24", k: "#2e3c50", h: "#5a7aa8", g: "#8fb0e0" },
      acento: "#8fb0e0"
      // las polillas del sin fin se tiñen a partir del acto que recorren (ver paletaPolilla)
    }
  };

  /* El fanal tiene su propia paleta, la misma en todos los actos: es lo
     único que no cambia en la travesía. El Alba es su gemelo en nácar. */
  const PALETA_FANAL = { j: "#6b4a32", k: "#4a3222", h: "#d9a85b", g: "#ffe6a8", l: "#2e2018", o: "#9a6a3e" };
  const PALETA_ALBA = { j: "#fff2dc", k: "#f0cfa8", h: "#ffffff", g: "#fffaf0", l: "#e8b890", o: "#ffe0b8" };

  /* ================================================================
     Dibujos en texto
     ================================================================
     Cada polilla tiene dos cuadros: alas abiertas y alas levantadas (vistas
     desde arriba, se ven más angostas). Todas las filas de un dibujo
     tienen el mismo largo; el test lo comprueba. */
  const POLILLAS = {
    /* Acto I · el enjambre. */
    1: {
      // a · polilla de ceniza: chica, peluda, alas triangulares.
      a: [[
        ".a.......a.",
        "..a.....a..",
        "...a.d.a...",
        ".bb.cdc.bb.",
        "bbbbcdcbbbb",
        "bebbcdcbbeb",
        "bbbBcccBbbb",
        ".BB.cdc.BB.",
        ".....c....."
      ], [
        ".a.......a.",
        "..a.....a..",
        "...a.d.a...",
        "....cdc....",
        "..bbcdcbb..",
        ".bebcdcbeb.",
        ".bbBcccBbb.",
        "..B.cdc.B..",
        ".....c....."
      ]],
      // b · polilla de cobre: alas redondas con una mancha clara.
      b: [[
        "..a.....a..",
        "...a...a...",
        ".bbbcdcbbb.",
        "bbebcdcbebb",
        "bbbbcdcbbbb",
        ".bbBcdcBbb.",
        ".bbfcccfbb.",
        "..bb.c.bb..",
        "...b...b..."
      ], [
        "..a.....a..",
        "...a...a...",
        "...bcdcb...",
        "..bbcdcbb..",
        ".bebcdcbeb.",
        ".bbBcdcBbb.",
        "..bfcccfb..",
        "...b.c.b...",
        "..........."
      ]],
      // c · esfinge menor: alas angostas barridas hacia atrás.
      c: [[
        "....a.a....",
        ".....d.....",
        "bb..cdc..bb",
        ".bbbcdcbbb.",
        "..bbcdcbb..",
        "..ebcdcbe..",
        "...BcdcB...",
        "....cdc....",
        ".....c....."
      ], [
        "....a.a....",
        ".....d.....",
        "....cdc....",
        "..bbcdcbb..",
        ".bbbcdcbbb.",
        "bbebcdcbebb",
        "b..BcdcB..b",
        "....cdc....",
        ".....c....."
      ]]
    },
    /* Acto II · la niebla. */
    2: {
      // a · luna: verde pálido, con dos colas largas.
      a: [[
        "..a.....a..",
        "...a...a...",
        ".ffbcdcbff.",
        "fbbbcdcbbbf",
        "fbebcdcbebf",
        ".bbbcdcbbb.",
        "..bbcccbb..",
        "..b..c..b..",
        "..b.....b..",
        ".b.......b."
      ], [
        "..a.....a..",
        "...a...a...",
        "...fcdcf...",
        "..fbcdcbf..",
        ".fbecdcebf.",
        ".bbbcdcbbb.",
        "..bbcccbb..",
        "...b.c.b...",
        "...b...b...",
        "..b.....b.."
      ]],
      // b · polilla de la niebla: ancha, casi transparente.
      b: [[
        ".a.......a.",
        "..a.....a..",
        "fbbbcdcbbbf",
        "bbbbcdcbbbb",
        "BbebcdcbebB",
        ".BbbcccbbB.",
        "..BB.c.BB..",
        "..........."
      ], [
        ".a.......a.",
        "..a.....a..",
        "..fbcdcbf..",
        ".bbbcdcbbb.",
        ".BbecdcebB.",
        "..BbcccbB..",
        "...B.c.B...",
        "..........."
      ]],
      // c · atlas: grande, alas con la punta en gancho. Aguanta dos golpes.
      c: [[
        "...a.....a...",
        "....a...a....",
        "ff...cdc...ff",
        "fbbb.cdc.bbbf",
        ".bbbbcdcbbbb.",
        ".bebbcdcbbeb.",
        ".bbbbcdcbbbb.",
        "..bBBcccBBb..",
        "..bb..c..bb..",
        "...b.....b..."
      ], [
        "...a.....a...",
        "....a...a....",
        ".....cdc.....",
        "..fbbcdcbbf..",
        "..bbbcdcbbb..",
        ".fbebcdcbebf.",
        ".bbbbcdcbbbb.",
        "..bBBcccBBb..",
        "...bb.c.bb...",
        "............."
      ]]
    },
    /* Acto III · lo oscuro. Casi del color del fondo: se ven por el borde
       claro (f) cuando las toca la luz. */
    3: {
      // a · noctua: chica y oscura, con el borde violeta.
      a: [[
        ".a.......a.",
        "..a.....a..",
        "...a.c.a...",
        ".ff.ccc.ff.",
        "fbbbcdcbbbf",
        "fbebcdcbebf",
        ".fbBcccBbf.",
        "..f.ccc.f..",
        ".....c....."
      ], [
        ".a.......a.",
        "..a.....a..",
        "...a.c.a...",
        "....ccc....",
        "..fbcdcbf..",
        ".fbecdcebf.",
        "..fBcccBf..",
        "...fcccf...",
        ".....c....."
      ]],
      // b · ceniza oscura: alas rotas, con agujeros.
      b: [[
        "..a.....a..",
        "...a...a...",
        "b.bbcdcbb.b",
        "bbf.cdc.fbb",
        ".bbecdcebb.",
        "bb.bcdcb.bb",
        ".b.BcccB.b.",
        "...b.c.b...",
        "..........."
      ], [
        "..a.....a..",
        "...a...a...",
        "...bcdcb...",
        "..bfcdcfb..",
        ".b.ecdce.b.",
        ".bb.cdc.bb.",
        "..bBcccBb..",
        "....bcb....",
        "..........."
      ]],
      // c · velo: grande, terciopelo negro con marcas de hueso. Dos golpes.
      c: [[
        "...a.....a...",
        "....a...a....",
        "bbb..cdc..bbb",
        "bebbbcdcbbbeb",
        "bbebbcdcbbebb",
        ".bfbbcdcbbfb.",
        "..bBBcccBBb..",
        "...bb.c.bb...",
        ".....c.c....."
      ], [
        "...a.....a...",
        "....a...a....",
        ".....cdc.....",
        "..bebcdcbeb..",
        ".bbebcdcbebb.",
        ".bfbbcdcbbfb.",
        "..bBBcccBBb..",
        "....b.c.b....",
        ".....c.c....."
      ]]
    },
    /* Acto IV · el alba. Las lumbres brillan solas; las sombras son lo que
       queda de lo oscuro y bajan por los costados. */
    4: {
      a: [[
        ".a.......a.",
        "..a.....a..",
        ".ff.cdc.ff.",
        "fbbfcdcfbbf",
        "fbebcdcbebf",
        ".fbbcdcbbf.",
        "..ff.c.ff..",
        "..........."
      ], [
        ".a.......a.",
        "..a.....a..",
        "...fcdcf...",
        "..fbcdcbf..",
        ".fbecdcebf.",
        "..fbcdcbf..",
        "...f.c.f...",
        "..........."
      ]],
      b: null, // la sombra usa la forma de la ceniza oscura (3b) con su paleta
      c: null
    }
  };
  POLILLAS[4].b = POLILLAS[3].b;   // sombras: la forma rota de lo oscuro
  POLILLAS[4].c = POLILLAS[4].a;   // por si una oleada del alba pidiera la c

  /* Una polilla chica (7×5) para las larvas de la Nodriza y las que cubren
     el Faro Ciego. */
  const MINI = [[
    "b.....b",
    "bb.c.bb",
    "bbbcbbb",
    ".b.c.b.",
    "...a..."
  ], [
    ".......",
    ".b.c.b.",
    ".bbcbb.",
    "..bcb..",
    "...a..."
  ]];

  /* La Mensajera: una polilla grande y pálida que lleva una carta (p). La
     carta va arriba en el dibujo porque, volteada, queda colgando debajo. */
  const MENSAJERA = [[
    ".......ppp.......",
    ".......pqp.......",
    "...a....c....a...",
    "....a..cdc..a....",
    ".fff..acdca..fff.",
    "fbbbf..cdc..fbbbf",
    "fbebbffcdcffbbebf",
    ".fbbbbbcdcbbbbbf.",
    "..fbbbbcccbbbbf..",
    "...ffbb.c.bbff...",
    ".....ff...ff....."
  ], [
    ".......ppp.......",
    ".......pqp.......",
    "...a....c....a...",
    "....a..cdc..a....",
    "......acdca......",
    "....ff.cdc.ff....",
    "...fbbfcdcfbbf...",
    "..fbebbcdcbbebf..",
    "..fbbbbcccbbbbf..",
    "...ffbb.c.bbff...",
    "......f...f......"
  ]];
  const PALETA_MENSAJERA = { a: "#d8d0c0", b: "#efe6d6", B: "#c8bca8", e: "#fffaf0", f: "#ffffff", c: "#bfb2a0", d: "#fff4e0", p: "#fff0c8", q: "#d9a85b" };

  /* El fanal: una barca chica con un farol encima. La llama no está en el
     dibujo: se pinta viva, encima, porque tiembla. */
  const FANAL = [
    ".......h.......",
    "......hhh......",
    ".....hgggh.....",
    ".....g...g.....",
    ".....g...g.....",
    ".....hhhhh.....",
    ".jjjjjjjjjjjjj.",
    "jjojjjjjjjjjojj",
    ".jjjjjjjjjjjjj.",
    "..kkkkkkkkkkk.."
  ];
  /* Dónde va la llama dentro del vidrio (columna central, filas 3 y 4). */
  const LLAMA = { x: 7, y: 4 };

  /* Los cascos hundidos que sirven de escudo: una barca dada vuelta. Su
     forma es el arco del búnker del original, con la quilla arriba. Cada
     acto les agrega lo suyo encima (decoracion). */
  const NAUFRAGIO = [
    "........kkkkkkkk........",
    "......kmmmmmmmmmmk......",
    "....kmmmmmmmmmmmmmmk....",
    "...mmmmmmmmmmmmmmmmmm...",
    "..mmmmmnmmmmmmmmnmmmmm..",
    ".mmmmmmmmmmmmmmmmmmmmmm.",
    ".mmmmnmmmmmmmmmmmmnmmmm.",
    "mmmmmmmmmmmmmmmmmmmmmmmm",
    "mmmmmmmmmmmmmmmmmmmmmmmm",
    "mmmmmmmm........mmmmmmmm",
    "mmmmmmm..........mmmmmmm",
    "mmmmmm............mmmmmm"
  ];
  /* Lo que cada acto pone sobre el casco (en las mismas coordenadas):
     I un mástil roto; II un farol cubierto de musgo; III el farol de un
     fanal idéntico al tuyo; el sin fin, lo mismo que el III. */
  const DECORACION = {
    1: [[5, 0, "k"], [5, 1, "k"], [6, 1, "k"], [4, 2, "k"], [17, 1, "h"], [18, 1, "h"]],
    2: [[10, 0, "h"], [11, 0, "g"], [12, 0, "g"], [13, 0, "h"], [9, 1, "h"], [14, 1, "h"], [6, 3, "h"], [16, 4, "h"], [3, 6, "h"]],
    3: [[11, 0, "h"], [12, 0, "h"], [10, 1, "g"], [13, 1, "g"], [10, 2, "g"], [13, 2, "g"], [11, 1, "g"], [12, 1, "g"]],
    4: [], 5: [[11, 0, "h"], [12, 0, "h"], [10, 1, "g"], [13, 1, "g"]]
  };

  /* Los iconos de los poderes, en un frasco de vidrio (r). */
  const PODERES = {
    // Pabilo doble: dos llamas.
    pabilo: [".rrrrr.", "r.o.o.r", "roYoYor", "rYyYyYr", "r.h.h.r", "r.h.h.r", ".rrrrr."],
    // Lente: un círculo con su brillo; el disparo atraviesa todo.
    lente: [".rrrrr.", "r.yyy.r", "ryo..yr", "ry...yr", "ry...yr", "r.yyy.r", ".rrrrr."],
    // Campana: el tubo de vidrio que protege la llama.
    campana: [".rrrrr.", "r..y..r", "r.yoy.r", "r.y.y.r", "ryy.yyr", "rhhhhhr", ".rrrrr."],
    // Aceite: una gota; devuelve una llama.
    aceite: [".rrrrr.", "r..y..r", "r.yyy.r", "ryyoyyr", "ryyyyyr", "r.yyy.r", ".rrrrr."],
    // Destello: un estallido; apaga la fila más baja y limpia las escamas.
    destello: [".rrrrr.", "ry.y.yr", "r.yyy.r", "ryyoyyr", "r.yyy.r", "ry.y.yr", ".rrrrr."]
  };
  const PALETA_PODER = { r: "#e8dcc4", o: "#ffffff", y: "#ffd27a", Y: "#ff9a3c", h: "#d9a85b" };

  /* La carta que suelta la Mensajera (y el icono de fragmentos). */
  const CARTA = ["ppppppp", "pq...qp", "p.q.q.p", "p..q..p", "ppppppp"];

  /* Cifras de 3×5 para los puntos que flotan sobre el lienzo. */
  const DIGITOS = {
    "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "###", "#..", "###"], "3": ["###", "..#", ".##", "..#", "###"],
    "4": ["#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", "###", "..#", "###"],
    "6": ["###", "#..", "###", "#.#", "###"], "7": ["###", "..#", ".#.", ".#.", ".#."],
    "8": ["###", "#.#", "###", "#.#", "###"], "9": ["###", "#.#", "###", "..#", "###"],
    "+": ["...", ".#.", "###", ".#.", "..."], "×": ["...", "#.#", ".#.", "#.#", "..."],
    "x": ["...", "#.#", ".#.", "#.#", "..."], " ": ["...", "...", "...", "...", "..."]
  };

  /* ================================================================
     Colores
     ================================================================ */

  /* "#rrggbb" → [r, g, b]. */
  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /* [r, g, b] → "#rrggbb". */
  function hex(c) {
    return "#" + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  }
  /* Mezcla dos colores: t = 0 da el primero, t = 1 el segundo. */
  function mezcla(a, b, t) {
    const x = rgb(a), y = rgb(b);
    return hex(x.map((v, i) => v + (y[i] - v) * t));
  }

  /* Los colores de un tipo de polilla en un acto. El sin fin no tiene
     polillas propias: tiñe de azul plata las del acto que recorre, como si
     la noche sin fin las hubiera desteñido. */
  function paletaPolilla(acto, tipo, actoBase) {
    if (acto !== 5) return PALETAS[acto][tipo];
    const base = PALETAS[actoBase || 1][tipo], out = {};
    for (const k in base) out[k] = mezcla(base[k], k === "f" || k === "e" ? "#cfe0ff" : "#3a4a6a", k === "f" || k === "e" ? 0.45 : 0.4);
    return out;
  }

  /* ================================================================
     Lienzos
     ================================================================ */

  /* Un lienzo de w×h. En el navegador, un <canvas>; fuera de él (Node), un
     objeto sin contexto, para que cargar el archivo nunca falle. */
  function lienzo(w, h) {
    if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      return c;
    }
    return { width: w, height: h, getContext: () => null };
  }

  /* Pinta un dibujo en texto: cada letra se busca en `mapa` (papel →
     color); el punto es transparente. `voltea` lo da vuelta de arriba
     abajo (las polillas, para que miren a la luz). */
  function pintaTexto(filas, mapa, voltea) {
    const h = filas.length, w = filas[0].length;
    const c = lienzo(w, h), x = c.getContext("2d");
    if (!x) return c;
    for (let fy = 0; fy < h; fy++) {
      const fila = filas[voltea ? h - 1 - fy : fy];          // la fila de origen, al revés si se voltea
      for (let fx = 0; fx < w; fx++) {
        const color = mapa[fila[fx]];                        // el color de ese papel
        if (!color) continue;                                // punto o papel sin color: transparente
        x.fillStyle = color;
        x.fillRect(fx, fy, 1, 1);                            // un píxel
      }
    }
    return c;
  }

  /* La silueta blanca de un lienzo: el destello de un golpe. */
  function silueta(c, color) {
    const s = lienzo(c.width, c.height), x = s.getContext("2d");
    if (!x) return s;
    x.drawImage(c, 0, 0);                                    // la forma…
    x.globalCompositeOperation = "source-in";                // …solo donde hay píxeles…
    x.fillStyle = color || "#ffffff";
    x.fillRect(0, 0, s.width, s.height);                     // …se pinta de un color liso
    return s;
  }

  /* Cuantiza un lienzo dibujado con formas: lo semitransparente se decide
     (se queda si es más de la mitad) y cada color se lleva al más cercano
     de `colores`. Es lo que convierte un dibujo suave en pixel art. */
  function cuantiza(c, colores) {
    const x = c.getContext("2d");
    if (!x) return c;
    const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
    const pal = colores.map(rgb);                            // la paleta en números
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 110) { d[i + 3] = 0; continue; }        // casi transparente: fuera
      let mejor = 0, dist = Infinity;
      for (let k = 0; k < pal.length; k++) {                 // el color de la paleta más cercano
        const dr = d[i] - pal[k][0], dg = d[i + 1] - pal[k][1], db = d[i + 2] - pal[k][2];
        const e = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11; // pesado como lo ve el ojo
        if (e < dist) { dist = e; mejor = k; }
      }
      d[i] = pal[mejor][0]; d[i + 1] = pal[mejor][1]; d[i + 2] = pal[mejor][2]; d[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  /* Ayudas de dibujo para los jefes (sobre un contexto 2D). */
  function elipse(x, cx, cy, rx, ry, color, rot) {
    x.fillStyle = color;
    x.beginPath(); x.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); x.fill();
  }
  function poligono(x, puntos, color) {
    x.fillStyle = color;
    x.beginPath(); x.moveTo(puntos[0][0], puntos[0][1]);
    for (let i = 1; i < puntos.length; i++) x.lineTo(puntos[i][0], puntos[i][1]);
    x.closePath(); x.fill();
  }
  function trazo(x, puntos, color, ancho) {
    x.strokeStyle = color; x.lineWidth = ancho || 1;
    x.beginPath(); x.moveTo(puntos[0][0], puntos[0][1]);
    for (let i = 1; i < puntos.length; i++) x.lineTo(puntos[i][0], puntos[i][1]);
    x.stroke();
  }
  /* Dibuja una forma y su reflejo (los jefes son simétricos): `fn(lado)`
     recibe +1 y −1 y devuelve puntos ya reflejados alrededor de `cx`. */
  function espejo(cx, fn) { fn(1, p => [cx + p[0], p[1]]); fn(-1, p => [cx - p[0], p[1]]); }

  /* ================================================================
     Jefes
     ================================================================
     Todos se dibujan ya mirando hacia abajo (la cabeza abajo, hacia el
     fanal) y en tres cuadros de aleteo: `k` es cuánto se abren las alas. */

  /* La Nodriza: polilla enorme y peluda, con un racimo de huevos en el
     abdomen (arriba). Alas de vino y ámbar con medialunas claras. */
  const COLORES_NODRIZA = { b: "#9a5a3c", B: "#5e3024", r: "#d9965a", e: "#f2d0a0", c: "#4a2c22", d: "#8a5a40", g: "#fff0c8", a: "#c8a07a", o: "#2a1810" };
  function nodriza(k, col) {
    const W = 58, H = 40, cx = 29, c = lienzo(W, H), x = c.getContext("2d");
    if (!x) return c;
    col = col || COLORES_NODRIZA;
    // Alas traseras: redondeadas, asoman detrás, hacia el abdomen (arriba).
    espejo(cx, (s, m) => { const p = m([11 * k + 1, 10]); elipse(x, p[0], p[1], 10 * k + 2, 7.5, col.r); elipse(x, p[0], p[1] + 0.5, 9 * k + 1.5, 6.5, col.B); });
    // Alas delanteras: anchas, con el borde claro.
    espejo(cx, (s, m) => {
      poligono(x, [m([3, 12]), m([25 * k, 8]), m([28.5 * k, 17]), m([23 * k, 29]), m([5, 25])], col.r);
      poligono(x, [m([3, 13]), m([24 * k, 9.2]), m([27.2 * k, 17]), m([22 * k, 27.8]), m([5, 24])], col.b);
      // Venas: líneas finas desde la base hacia el borde.
      for (const [vx, vy] of [[24, 10], [27, 16], [23, 26]]) trazo(x, [m([5, 18]), m([vx * k, vy])], col.B, 0.6);
      // Dos bandas en zigzag que cruzan el ala, como las de una polilla de verdad.
      trazo(x, [m([7 * k + 2, 11]), m([9 * k + 2, 15]), m([8 * k + 2, 19]), m([10 * k + 2, 23])], col.B, 1.4);
      trazo(x, [m([15 * k + 1, 9.5]), m([18 * k + 1, 14]), m([16 * k + 1, 19]), m([18 * k + 1, 25])], col.B, 1.4);
      // Una fila de puntos pálidos junto al margen.
      for (const [px, py] of [[23, 12], [25, 17], [21.5, 23]]) elipse(x, m([px * k, py])[0], py, 0.9 * k + 0.3, 0.9, col.e);
    });
    // Abdomen anillado arriba, con el racimo de huevos pálidos en la punta.
    elipse(x, cx, 11, 4.2, 8, col.c);
    for (let i = 0; i < 3; i++) elipse(x, cx, 6 + i * 4, 3.6, 0.9, col.d);
    for (const [ex, ey] of [[0, 2], [-2.5, 3.5], [2.5, 3.5], [-1.2, 5.5], [1.2, 5.5], [-3.6, 1.2], [3.6, 1.2]]) elipse(x, cx + ex, ey, 1.5, 1.4, col.g);
    // Tórax peludo con su collar claro, y la cabeza abajo.
    elipse(x, cx, 21, 5.2, 6, col.c);
    elipse(x, cx, 17.5, 4.6, 1.6, col.d);
    elipse(x, cx, 29, 3.2, 2.6, col.c);
    // Antenas plumosas que apuntan al fanal.
    espejo(cx, (s, m) => {
      trazo(x, [m([1.5, 31]), m([6, 35.5]), m([9, 38.5])], col.a, 1);
      for (let t = 0; t < 3; t++) trazo(x, [m([3 + t * 2, 32.5 + t * 1.7]), m([4.2 + t * 2, 34.6 + t * 1.7])], col.a, 0.8); // las plumas
    });
    return cuantiza(c, Object.values(col));
  }

  /* El Faro Ciego: un fanal enorme, varado, cubierto de polillas de la
     niebla. Arriba la cúpula de bronce, en medio la sala de vidrio con la
     lente (el haz se pinta vivo) y abajo el casco. */
  const COLORES_FARO = { h: "#b08a50", H: "#6e5430", g: "#2e4442", G: "#5d7a72", l: "#e6f2d8", m: "#3e4a46", n: "#28322f", k: "#5d6e66" };
  function faro(k, col) {
    const W = 44, H = 54, cx = 22, c = lienzo(W, H), x = c.getContext("2d");
    if (!x) return c;
    col = col || COLORES_FARO;
    // Casco de piedra y madera, arriba (el faro mira hacia abajo).
    poligono(x, [[6, 2], [38, 2], [34, 14], [10, 14]], col.m);
    for (let i = 0; i < 3; i++) trazo(x, [[8 + i, 5 + i * 3], [36 - i, 5 + i * 3]], col.n, 1);   // tablones
    // Galería de bronce.
    poligono(x, [[8, 14], [36, 14], [36, 17], [8, 17]], col.h);
    // Sala de vidrio con sus montantes.
    poligono(x, [[11, 17], [33, 17], [33, 38], [11, 38]], col.g);
    poligono(x, [[13, 19], [31, 19], [31, 36], [13, 36]], col.G);
    for (const mx of [11, 17, 22, 27, 33]) trazo(x, [[mx, 17], [mx, 38]], col.H, 1.2);
    // La lente, apagada en el dibujo (la luz se agrega viva).
    elipse(x, cx, 28, 5, 5, col.k); elipse(x, cx, 28, 3, 3, col.l);
    // Cúpula de bronce abajo, con su remate apuntando al fanal.
    poligono(x, [[9, 38], [35, 38], [31, 44], [13, 44]], col.h);
    elipse(x, cx, 45, 8, 4, col.H);
    trazo(x, [[cx, 47], [cx, 52]], col.h, 1.4);
    elipse(x, cx, 52, 1.6, 1.6, col.h);
    return cuantiza(c, Object.values(col));
  }

  /* La Esfinge: una esfinge de las polillas, alas largas y angostas
     barridas hacia atrás, terciopelo negro con marcas de hueso. Las marcas
     son las que se encienden antes de cada ataque. */
  const COLORES_ESFINGE = { b: "#241a2c", B: "#120c18", e: "#d8cdb8", E: "#8a7e6e", c: "#1a1222", d: "#3e2e4e", a: "#6a5a80", r: "#4a3a62" };
  function esfinge(k, col) {
    const W = 78, H = 44, cx = 39, c = lienzo(W, H), x = c.getContext("2d");
    if (!x) return c;
    col = col || COLORES_ESFINGE;
    // Alas traseras, chicas, pegadas al cuerpo.
    espejo(cx, (s, m) => { const p = m([9 * k + 2, 15]); elipse(x, p[0], p[1], 8 * k + 2, 6, col.B); });
    // Alas delanteras: largas, con la punta hacia atrás (arriba).
    espejo(cx, (s, m) => {
      poligono(x, [m([3, 24]), m([36 * k, 4]), m([37 * k, 8]), m([30 * k, 14]), m([12 * k, 22]), m([4, 28])], col.r);
      poligono(x, [m([3, 24]), m([34 * k, 6]), m([35 * k, 8.5]), m([29 * k, 13.5]), m([11 * k, 21.5]), m([4, 27])], col.b);
      // Marcas de hueso: dos galones y una línea al filo.
      trazo(x, [m([9 * k, 21]), m([16 * k, 15]), m([22 * k, 17])], col.e, 1.1);
      trazo(x, [m([18 * k, 13]), m([25 * k, 9]), m([30 * k, 11])], col.e, 1.1);
      trazo(x, [m([6, 25]), m([30 * k, 9.5])], col.E, 0.7);
    });
    // Abdomen largo y anillado (arriba), tórax y cabeza (abajo).
    poligono(x, [[cx - 4, 24], [cx - 3, 6], [cx, 1], [cx + 3, 6], [cx + 4, 24]], col.c);
    for (let i = 0; i < 5; i++) trazo(x, [[cx - 3.5, 7 + i * 3.4], [cx + 3.5, 7 + i * 3.4]], i % 2 ? col.E : col.d, 1);
    elipse(x, cx, 27, 5, 4.4, col.d);
    elipse(x, cx, 33, 3.2, 2.6, col.c);
    // La trompa enroscada y las antenas cortas.
    trazo(x, [[cx, 35], [cx, 39], [cx + 2, 41], [cx + 3.4, 39.5], [cx + 2, 38]], col.a, 0.9);
    espejo(cx, (s, m) => trazo(x, [m([2, 34]), m([6, 38])], col.a, 0.9));
    return cuantiza(c, Object.values(col));
  }
  /* Dónde están las marcas de la Esfinge (para encenderlas en el juego),
     relativo a su esquina, con las alas abiertas del todo. */
  const MARCAS_ESFINGE = [[39 - 16, 15], [39 + 16, 15], [39 - 25, 9], [39 + 25, 9], [39 - 9, 21], [39 + 9, 21]];

  /* ================================================================
     El banco: todo pintado una vez
     ================================================================ */
  function crearBanco() {
    const cache = new Map();                                  // clave → lienzo
    const toma = (clave, fn) => { if (!cache.has(clave)) cache.set(clave, fn()); return cache.get(clave); };
    return {
      /* Una polilla: forma del acto `forma`, colores del acto `acto` (el
         sin fin pide forma de su acto base y colores propios). */
      polilla(acto, tipo, cuadro, actoBase, blanco) {
        const forma = acto === 5 ? (actoBase || 1) : acto;
        const clave = "p" + acto + forma + tipo + (cuadro & 1) + (blanco ? "w" : "");
        return toma(clave, () => {
          const c = pintaTexto(POLILLAS[forma][tipo][cuadro & 1], paletaPolilla(acto, tipo, actoBase), true);
          return blanco ? silueta(c) : c;
        });
      },
      /* La polilla chica: larva (acto 1) o la que cubre el faro (acto 2). */
      mini(acto, cuadro, blanco) {
        return toma("m" + acto + (cuadro & 1) + (blanco ? "w" : ""), () => {
          const c = pintaTexto(MINI[cuadro & 1], paletaPolilla(acto === 5 ? 5 : acto, "a", 1), true);
          return blanco ? silueta(c) : c;
        });
      },
      mensajera(cuadro, blanco) {
        return toma("msj" + (cuadro & 1) + (blanco ? "w" : ""), () => {
          const c = pintaTexto(MENSAJERA[cuadro & 1], PALETA_MENSAJERA, true);
          return blanco ? silueta(c) : c;
        });
      },
      fanal(alba, blanco) {
        return toma("f" + (alba ? "a" : "") + (blanco ? "w" : ""), () => {
          const c = pintaTexto(FANAL, alba ? PALETA_ALBA : PALETA_FANAL, !!alba); // el Alba viene volteada: es tu reflejo
          return blanco ? silueta(c) : c;
        });
      },
      nodriza(cuadro, blanco) {
        return toma("jn" + cuadro + (blanco ? "w" : ""), () => { const c = nodriza([1, 0.86, 0.72][cuadro % 3]); return blanco ? silueta(c) : c; });
      },
      faro(blanco) {
        return toma("jf" + (blanco ? "w" : ""), () => { const c = faro(1); return blanco ? silueta(c) : c; });
      },
      esfinge(cuadro, blanco) {
        return toma("je" + cuadro + (blanco ? "w" : ""), () => { const c = esfinge([1, 0.9, 0.8][cuadro % 3]); return blanco ? silueta(c) : c; });
      },
      poder(nombre) {
        return toma("pw" + nombre, () => pintaTexto(PODERES[nombre], PALETA_PODER, false));
      },
      carta() {
        return toma("carta", () => pintaTexto(CARTA, { p: "#fff0c8", q: "#b08a50" }, false));
      },
      /* Un número (o texto corto de cifras) en la fuente de 3×5. */
      cifras(texto, color) {
        return toma("n" + texto + color, () => {
          const t = String(texto), c = lienzo(Math.max(1, t.length * 4 - 1), 5), x = c.getContext("2d");
          if (!x) return c;
          x.fillStyle = color;
          [...t].forEach((ch, i) => {
            const g = DIGITOS[ch] || DIGITOS[" "];
            for (let fy = 0; fy < 5; fy++) for (let fx = 0; fx < 3; fx++) if (g[fy][fx] === "#") x.fillRect(i * 4 + fx, fy, 1, 1);
          });
          return c;
        });
      }
    };
  }

  /* Los píxeles de un casco hundido de un acto: una lista de filas de
     colores (o null), que el juego copia para poder irla rompiendo. */
  function naufragio(acto) {
    const pal = PALETAS[acto].naufragio;
    const filas = NAUFRAGIO.map(f => [...f].map(ch => (ch === "." ? null : pal[ch] || pal.m)));
    for (const [x, y, papel] of DECORACION[acto] || []) if (filas[y] && x < filas[y].length) filas[y][x] = pal[papel];
    return filas;
  }

  return {
    PALETAS, PALETA_FANAL, PALETA_ALBA, POLILLAS, MINI, MENSAJERA, FANAL, LLAMA, NAUFRAGIO, DECORACION,
    PODERES, CARTA, DIGITOS, MARCAS_ESFINGE, COLORES_NODRIZA, COLORES_FARO, COLORES_ESFINGE,
    rgb, hex, mezcla, paletaPolilla, lienzo, pintaTexto, silueta, cuantiza, crearBanco, naufragio
  };
});
