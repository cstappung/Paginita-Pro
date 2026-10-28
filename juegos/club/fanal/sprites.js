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
    },
    /* La otra orilla. V · los cascos: agua negra, cobre verdoso y óxido. */
    6: {
      nombre: "cascos",
      cielo: ["#060c10", "#0c1a1e", "#16282a"],
      estrella: ["#cfe6e0", "#a8c8c0", "#8aa8a4"],
      nube: ["#1c3236", "#2e4a4c"],                      // agua quieta
      particula: "#7aa8a0",                              // burbujas que suben
      sombra: "#04080a",
      escama: ["#d0f0e8", "#5ab8a8"],
      naufragio: { m: "#3a3028", n: "#241c16", k: "#5a4a3a", h: "#8a6a3a", g: "#c89a52" },
      a: { a: "#6a5a4a", b: "#8a6a4a", B: "#5a4232", e: "#c8a070", f: "#a88a62", c: "#3a2a20", d: "#7a5a40" },   // carcoma
      b: { a: "#6a7a76", b: "#a8b8b0", B: "#6a7a74", e: "#d8e4dc", f: "#c8d6ce", c: "#4a5652", d: "#8a9a94" },   // polilla de vela
      c: { a: "#3a6a62", b: "#4a8a7a", B: "#2a5a50", e: "#a8e0c8", f: "#78c0a8", c: "#24403a", d: "#5a9a88" },   // polilla ancla
      acento: "#5ab8a8"
    },
    /* VI · la seda: lila y hueso, capullos y colas largas. */
    7: {
      nombre: "seda",
      cielo: ["#14101c", "#241a2e", "#3a2a40"],
      estrella: ["#fff0f6", "#f0d8e8", "#d8c0d8"],
      nube: ["#4a3850", "#7a6080"],
      particula: "#f0e0f0",                              // hebras sueltas
      sombra: "#0e0a14",
      escama: ["#fff4fa", "#e0a8d0"],
      naufragio: { m: "#5a4a58", n: "#3a2e3a", k: "#7a6a78", h: "#d8c8d8", g: "#f0e4f0" },
      a: { a: "#c8b8b0", b: "#f2ece2", B: "#d0c6b8", e: "#fffaf2", f: "#ffffff", c: "#b8a898", d: "#e8dccc" },   // polilla de la seda
      b: { a: "#c87aa0", b: "#f0a8c8", B: "#c07898", e: "#ffe0ee", f: "#ffd0e4", c: "#8a4a68", d: "#d890b0" },   // luna rosa
      c: { a: "#8a6a50", b: "#9a6aa8", B: "#6a4a7a", e: "#fff0d8", f: "#d8a8e0", c: "#5a3a48", d: "#b08a70" },   // atlas
      acento: "#e0a8d0"
    },
    /* VII · la hoguera: brasa, ceniza y oro. Por primera vez sobra luz. */
    8: {
      nombre: "hoguera",
      cielo: ["#140604", "#2a0c06", "#4a1a08"],
      estrella: ["#ffd8a0", "#ffb070", "#ff8a50"],
      nube: ["#3a1206", "#6a2a0a"],
      particula: "#ffb060",                              // chispas que suben
      sombra: "#0e0402",
      escama: ["#fff0b0", "#ff6a20"],
      naufragio: { m: "#3a2418", n: "#24140c", k: "#5a3a22", h: "#ff8a3a", g: "#ffd070" },
      a: { a: "#ffb060", b: "#ff8a2a", B: "#c8501a", e: "#fff0a0", f: "#ffd070", c: "#6a2a10", d: "#ff6a20" },   // chispa
      b: { a: "#6a5a50", b: "#3a3030", B: "#241c1c", e: "#ff9a40", f: "#ff6a20", c: "#2a2020", d: "#5a4a40" },   // ceniza encendida
      c: { a: "#ffd070", b: "#e84a1a", B: "#a02a10", e: "#ffe080", f: "#ffb040", c: "#5a1a0a", d: "#ff8a2a" },   // fénix menor
      acento: "#ff8a3a"
    },
    /* Lo alto. VIII · la marea: de noche otra vez, plata y tinta azul,
       con la luna encima del agua. */
    9: {
      nombre: "marea",
      cielo: ["#060a18", "#0e1830", "#1a2a48"],
      estrella: ["#eef4ff", "#c8d8f0", "#a8b8d8"],
      nube: ["#22304e", "#3a4a6e"],                      // el reflejo en el agua
      particula: "#a8c8f0",                              // espuma que sube
      sombra: "#04060e",
      escama: ["#eef4ff", "#8ab0e8"],
      naufragio: { m: "#2a3448", n: "#1a2232", k: "#3e4a62", h: "#8a9ab8", g: "#c8d6ee" },
      a: { a: "#9aa4b8", b: "#d0d8e6", B: "#a0aabc", e: "#ffffff", f: "#eef2f8", c: "#6a7488", d: "#c0c8d8" },   // polilla de plata
      b: { a: "#a8c890", b: "#c8e6b0", B: "#8ab890", e: "#f0fae0", f: "#e0f4d0", c: "#6a8a6a", d: "#b0d8a8" },   // polilla luna (la verde)
      c: { a: "#5a6a9a", b: "#3a4a7a", B: "#24305a", e: "#c8d6f0", f: "#8a9ad0", c: "#1e2848", d: "#4a5a8a" },   // de tinta
      acento: "#c8d8f0"
    },
    /* IX · el firmamento: negro, oro de estrella y violeta. */
    10: {
      nombre: "firmamento",
      cielo: ["#020208", "#06061a", "#0e0a2a"],
      estrella: ["#fff8e0", "#d8c8ff", "#a8b8ff"],
      nube: ["#120a2e", "#22164a"],                      // la vía láctea, apenas
      particula: "#d8c8ff",                              // polvo de estrellas
      sombra: "#010104",
      escama: ["#fff8e0", "#b08aff"],
      naufragio: { m: "#1a1630", n: "#0e0c1e", k: "#2a2448", h: "#6a5aa8", g: "#d8c8ff" },
      a: { a: "#c8a860", b: "#ffe6a0", B: "#d8b060", e: "#fffaf0", f: "#fff2c8", c: "#7a5a2a", d: "#ffd27a" },   // polilla de oro
      b: { a: "#6a5aa8", b: "#4a3a8a", B: "#2e2460", e: "#d8c8ff", f: "#9a86e0", c: "#1e1640", d: "#5a4a98" },   // violeta
      c: { a: "#3a4a8a", b: "#22306a", B: "#141c48", e: "#a8c0ff", f: "#6a80d0", c: "#0e1430", d: "#3a4a9a" },   // azul de medianoche
      acento: "#d8c8ff"
    },
    /* X · el cenit: mediodía. Cielo claro, y las polillas oscuras contra
       él (aquí lo que se ve es la sombra). Las escamas, rojas: en un cielo
       blanco, una escama blanca no se vería. */
    11: {
      nombre: "cenit",
      cielo: ["#8ac8f0", "#c8e6f8", "#fff4dc"],
      estrella: ["#ffffff", "#fff8e0", "#fff0c0"],
      nube: ["#ffffff", "#e8f4fc"],
      particula: "#fff8d0",                              // destellos en el aire
      sombra: "#2a3a4a",
      escama: ["#e8401a", "#a02a10"],
      naufragio: { m: "#a88858", n: "#806038", k: "#c8a878", h: "#fff0c8", g: "#ffffff" },
      a: { a: "#8a4a2a", b: "#c8682a", B: "#8a4018", e: "#ffe0a0", f: "#ffb050", c: "#4a1a0a", d: "#e8823a" },   // chispa de mediodía
      b: { a: "#7a2a4a", b: "#b8405a", B: "#7a1a38", e: "#ffc0b0", f: "#ff8a98", c: "#3a0a1a", d: "#d85070" },   // grana
      c: { a: "#1a3a7a", b: "#2a5aa8", B: "#1a3a78", e: "#c0e0ff", f: "#7aaae8", c: "#0a1a40", d: "#3a6ac8" },   // azul cobalto
      acento: "#ff9a3c"
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

  /* La otra orilla. Acto V · los cascos. */
  POLILLAS[6] = {
    // a · carcoma: rechoncha, de alas cortas, la que agujerea los cascos.
    a: [[
      "..a.....a..",
      "...a...a...",
      "..bbcdcbb..",
      ".bebcdcbeb.",
      "bbbBcdcBbbb",
      "bBbbcccbbBb",
      ".bBb.c.bBb.",
      "..b.....b..",
      "..........."
    ], [
      "..a.....a..",
      "...a...a...",
      "...bcdcb...",
      "..bbcdcbb..",
      ".bebcdcbeb.",
      ".bBbcccbBb.",
      "..bb.c.bb..",
      "...b...b...",
      "..........."
    ]],
    // b · polilla de vela: alas rotas como una vela vieja.
    b: [[
      ".a.......a.",
      "..a.....a..",
      "f.bbcdcbb.f",
      "fbbbcdcbbbf",
      "b.ebcdcbe.b",
      "bbbBcdcBbbb",
      "b.bBcccBb.b",
      "..b..c..b..",
      ".b.......b."
    ], [
      ".a.......a.",
      "..a.....a..",
      "...bcdcb...",
      "..fbcdcbf..",
      ".fbecdcebf.",
      ".bbBcdcBbb.",
      ".b.BcccB.b.",
      "..b..c..b..",
      "..........."
    ]],
    // c · polilla ancla: las alas de atrás caen como los brazos de un ancla.
    c: [[
      "....a.a....",
      ".....d.....",
      "....cdc....",
      "bb.bcdcb.bb",
      "bbbbcdcbbbb",
      ".beBcdcBeb.",
      "..bBcdcBb..",
      ".ff.ccc.ff.",
      "f.........f"
    ], [
      "....a.a....",
      ".....d.....",
      "....cdc....",
      "...bcdcb...",
      ".bbbcdcbbb.",
      "bbeBcdcBebb",
      "b.bBcdcBb.b",
      "..f.ccc.f..",
      ".f.......f."
    ]]
  };
  /* Acto VI · la seda. */
  POLILLAS[7] = {
    // a · polilla de la seda: blanca, peluda, de alas chicas.
    a: [[
      "..a.....a..",
      "..aa...aa..",
      "...bcccb...",
      ".bbbcdcbbb.",
      "bbebcdcbebb",
      "bbbbcdcbbbb",
      ".bBbcccbBb.",
      "..bb.c.bb..",
      "..........."
    ], [
      "..a.....a..",
      "..aa...aa..",
      "...bcccb...",
      "..bbcdcbb..",
      ".bebcdcbeb.",
      ".bbbcdcbbb.",
      "..bBcccBb..",
      "...b.c.b...",
      "..........."
    ]],
    // b · luna rosa: dos colas largas.
    b: [[
      "..a.....a..",
      "...a...a...",
      "ffbbcdcbbff",
      "fbebcdcbebf",
      ".bbbcdcbbb.",
      "..bBcdcBb..",
      "..fbcccbf..",
      "..f..c..f..",
      ".f.......f."
    ], [
      "..a.....a..",
      "...a...a...",
      "..fbcdcbf..",
      ".fbecdcebf.",
      "..bbcdcbb..",
      "..bBcdcBb..",
      "...bcccb...",
      "...f.c.f...",
      "..f.....f.."
    ]],
    // c · atlas: alas enormes con ventanas claras.
    c: [[
      "...a...a...",
      "....a.a....",
      "bbbbcdcbbbb",
      "bebbcdcbbeb",
      "bbebcdcbebb",
      "fbbBcdcBbbf",
      ".fbBcccBbf.",
      "..ff.c.ff..",
      "..........."
    ], [
      "...a...a...",
      "....a.a....",
      "..bbcdcbb..",
      ".bebcdcbeb.",
      ".bbecdcebb.",
      ".fbBcdcBbf.",
      "..fBcccBf..",
      "...f.c.f...",
      "..........."
    ]]
  };
  /* Acto VII · la hoguera. */
  POLILLAS[8] = {
    // a · chispa: chica, con alas como lenguas de fuego.
    a: [[
      "...a...a...",
      "....a.a....",
      "...bcdcb...",
      "..bbcdcbb..",
      ".bebcdcbeb.",
      ".bbBcdcBbb.",
      "..fBcccBf..",
      "..f..c..f..",
      ".f.......f."
    ], [
      "...a...a...",
      "....a.a....",
      "....cdc....",
      "...bcdcb...",
      "..bbcdcbb..",
      ".bebcdcbeb.",
      ".fbBcccBbf.",
      "f..f.c.f..f",
      "..........."
    ]],
    // b · ceniza encendida: alas negras con el borde ardiendo.
    b: [[
      ".a.......a.",
      "..a.....a..",
      ".fbbcdcbbf.",
      "fbbbcdcbbbf",
      "fbebcdcbebf",
      "fbbBcdcBbbf",
      ".fbBcccBbf.",
      "..ff.c.ff..",
      "..........."
    ], [
      ".a.......a.",
      "..a.....a..",
      "...fcdcf...",
      "..fbcdcbf..",
      ".fbecdcebf.",
      ".fbBcdcBbf.",
      "..fBcccBf..",
      "...f.c.f...",
      "..........."
    ]],
    // c · fénix menor: alas como llamas que suben.
    c: [[
      "....a.a....",
      ".....d.....",
      "b..bcdcb..b",
      "bb.bcdcb.bb",
      "bbbbcdcbbbb",
      ".bebcdcbeb.",
      "..fBcdcBf..",
      ".f.fcccf.f.",
      "f..f.c.f..f"
    ], [
      "....a.a....",
      ".....d.....",
      "...bcdcb...",
      "..bbcdcbb..",
      ".bbbcdcbbb.",
      "bbebcdcbebb",
      "b.fBcdcBf.b",
      "..f.ccc.f..",
      ".f..f.f..f."
    ]]
  };

  /* Lo alto no inventa formas nuevas: la marea trae las de la seda (la
     polilla luna es de ahí), el firmamento las de lo oscuro y el cenit las
     de la hoguera. Cambian los colores, que es lo que se ve de lejos. */
  POLILLAS[9] = POLILLAS[7];
  POLILLAS[10] = POLILLAS[3];
  POLILLAS[11] = POLILLAS[8];

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
  /* El fanal evoluciona (ver motor.js: nave y evolucion). Cada forma tiene
     el mismo tamaño y la llama en el mismo sitio, para que nada se mueva
     al cambiar: I bronce, II con su luciérnaga, III doble vidrio, IV faro
     errante, con su corona. */
  const FANAL_EVO = [
    FANAL,
    FANAL,
    [
      ".......h.......",
      "......hgh......",
      ".....hgggh.....",
      "....hg...gh....",
      "....hg...gh....",
      ".....hhhhh.....",
      "hjjjjjjjjjjjjjh",
      "jjojjhjjjhjjojj",
      ".jjjjjjjjjjjjj.",
      "..kkkkkkkkkkk.."
    ],
    [
      "......hhh......",
      ".....hgggh.....",
      "....hg...gh....",
      "....g.....g....",
      "....g.....g....",
      "....hhhhhhh....",
      "hjjjjjjjjjjjjjh",
      "jjojjhjjjhjjojj",
      ".jjjjjjjjjjjjj.",
      "..kkkkkkkkkkk.."
    ],
    [
      "...h...h...h...",
      "....h.hhh.h....",
      ".....hgggh.....",
      "....hg...gh....",
      "....g.....g....",
      "....hhhhhhh....",
      "hjjjjjjjjjjjjjh",
      "jjojjhjjjhjjojj",
      ".jjjjjjjjjjjjj.",
      "..kkkkkkkkkkk.."
    ]
  ];
  const PALETAS_FANAL = [
    PALETA_FANAL,
    { j: "#7a5434", k: "#4a3222", h: "#e8b868", g: "#fff0c0", l: "#2e2018", o: "#c8903e" },
    { j: "#7a5434", k: "#4a3222", h: "#e8b868", g: "#fff0c0", l: "#2e2018", o: "#c8903e" },
    { j: "#7a5a3a", k: "#4a3424", h: "#f0c878", g: "#dff4ff", l: "#2e2018", o: "#d8a050" },
    { j: "#8a6a44", k: "#5a4228", h: "#fff0c8", g: "#ffffff", l: "#2e2018", o: "#ffd27a" }
  ];
  /* Un fanal chico (7×7) para los que arden presos en la Hoguera. */
  const FANALITO = [
    "...h...",
    "..hgh..",
    ".hg.gh.",
    ".g...g.",
    ".hhhhh.",
    "jjjjjjj",
    ".kkkkk."
  ];

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
    4: [], 5: [[11, 0, "h"], [12, 0, "h"], [10, 1, "g"], [13, 1, "g"]],
    // V: percebes de cobre; VI: hebras de seda pegadas; VII: brasas en la quilla.
    6: [[3, 5, "g"], [7, 3, "g"], [15, 2, "h"], [19, 4, "g"], [11, 1, "h"], [21, 7, "h"]],
    7: [[6, 0, "g"], [6, 1, "h"], [17, 0, "g"], [17, 1, "h"], [17, 2, "g"], [11, 1, "g"]],
    8: [[9, 0, "h"], [14, 0, "g"], [10, 1, "g"], [5, 3, "h"], [18, 3, "h"], [12, 2, "h"]]
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
     fanal) y en tres cuadros de aleteo: `k` es cuánto se abren las alas.

     Cada jefe tiene cuatro MODELOS, uno por fase (`fase` 1 a 4). Después
     del Sol vuelven cambiados, y no es un tinte: es otro dibujo.
     - La fase 2 es «la herida»: lo que quedó de la primera vez. Rojo de
       brasa, grietas, y algo de más (un tercer par de alas, brazos con
       faroles, espinas, una calavera en el tórax).
     - La fase 3 es «la coronada»: el cuerpo casi negro y lo que arde en
       él, al blanco. Ahora son ellos los que parecen una luz.
     - La fase 4 es «la ascendida»: ya no vuelve el cuerpo, vuelve su
       figura en el cielo. El cuerpo es noche (calado: se ve a través), el
       borde es luz fría, y lo que tenía de señas ahora son estrellas
       unidas por líneas, como una constelación (ver `asciende`).
     - La fase 5 es «la del alba»: después de la noche, amanecen. El cuerpo
       se llena con el cielo del amanecer (del violeta al oro, hacia el
       fanal; ver `amanece`), el borde es blanco, lo frío se vuelve oro y
       rosa, y detrás llevan un abanico de rayos.
     - La fase 6 es «la de vidrio»: lo que vuelve después del día es un
       vitral. El cuerpo se llena de vidrios de colores separados por plomo
       (ver `vidria`), el borde es de luz, lo frío se vuelve joya y detrás
       llevan un rosetón (`roseton`); donde la fase 5 tenía un sol chico,
       aquí hay una roseta (`roseta`).
     - La fase 7 es «la de oro»: el vitral se rompió y lo unieron con oro,
       como se arregla una cerámica (kintsugi). El cuerpo es laca negra en
       pedazos, cruzada por vetas de oro (ver `dora`), el borde es de oro,
       lo frío se vuelve oro, y detrás llevan una aureola de pan de oro
       (el mismo `roseton`, que en la fase 7 se dora; la `roseta` también).
     Se dibujan ya a su tamaño (×1,2, ×1,35, ×1,4, ×1,45, ×1,5 y ×1,55) en vez de agrandar el dibujo
     de la primera fase: con formas el tamaño es gratis, y los píxeles
     quedan parejos en vez de estirados. */
  const ESCALA_FASE = { 1: 1, 2: 1.2, 3: 1.35, 4: 1.4, 5: 1.45, 6: 1.5, 7: 1.55 };
  /* El lienzo de un jefe en su fase: `W`×`H` es el tamaño de la primera;
     `margen`, los píxeles que las otras dos pueden ocupar de más por cada
     lado. El centro no se mueve (el juego dibuja al jefe centrado). */
  let faseLienzo = 1;                     // la fase del jefe que se está dibujando (la dora `roseton`)
  function lienzoJefe(W, H, fase, margen) {
    faseLienzo = fase || 1;
    const e = ESCALA_FASE[fase] || 1, p = fase > 1 ? margen || 0 : 0;
    const c = lienzo(Math.round((W + 2 * p) * e), Math.round((H + 2 * p) * e)), x = c.getContext("2d");
    if (x) { x.scale(e, e); x.translate(p, p); }
    return { c, x };
  }
  /* Recorta lo que `fn` dibuje (alas rotas, cascos partidos). */
  function corta(x, fn) { x.globalCompositeOperation = "destination-out"; fn(); x.globalCompositeOperation = "source-over"; }
  /* Una fila de puntos de `a` a `b` (cadenas, halos). */
  function puntos(x, a, b, n, color, r) {
    for (let i = 0; i <= n; i++) elipse(x, a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, r || 0.7, r || 0.7, color);
  }

  /* Una estrella de cuatro puntas: los nudos de las figuras de la fase 4. */
  function estrella(x, cx, cy, r, color, nucleo) {
    const q = Math.max(0.5, r * 0.26);
    poligono(x, [[cx, cy - r], [cx + q, cy - q], [cx + r, cy], [cx + q, cy + q], [cx, cy + r], [cx - q, cy + q], [cx - r, cy], [cx - q, cy - q]], color);
    if (nucleo) elipse(x, cx, cy, Math.max(0.6, r * 0.3), Math.max(0.6, r * 0.3), nucleo);
  }
  /* La fase 4: lo que era cuerpo se vuelve cielo. Los colores oscuros del
     dibujo (en las paletas de la fase 4, los del cuerpo) quedan calados, un
     píxel sí y uno no, para que la noche se vea a través; su borde se
     enciende con `luz`. Lo claro (ojos, marcas, estrellas) no se toca. Va
     después de `cuantiza`, que deja el alfa en todo o nada. */
  function asciende(c, luz) {
    const x = c.getContext("2d");
    if (!x) return c;
    const w = c.width, h = c.height, im = x.getImageData(0, 0, w, h), d = im.data, hay = new Uint8Array(w * h), [lr, lg, lb] = rgb(luz);
    for (let i = 0; i < w * h; i++) hay[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const i = py * w + px, q = i * 4;
      if (!hay[i] || d[q] * 0.3 + d[q + 1] * 0.59 + d[q + 2] * 0.11 >= 60) continue;
      const borde = px === 0 || py === 0 || px === w - 1 || py === h - 1 || !hay[i - 1] || !hay[i + 1] || !hay[i - w] || !hay[i + w];
      if (borde) { d[q] = lr; d[q + 1] = lg; d[q + 2] = lb; }
      else if ((px + py) & 1) d[q + 3] = 0;
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  /* La fase 5: lo que era cuerpo (los mismos colores oscuros que cala la
     fase 4) se llena con el cielo del amanecer: bandas del violeta, arriba,
     al oro, abajo (hacia el fanal), tramadas entre sí; el borde, blanco. */
  const ALBA = ["#4c2c7c", "#8c3c8c", "#d8508c", "#ff8c7c", "#ffc078", "#ffe6a0"].map(rgb);
  function amanece(c) {
    const x = c.getContext("2d");
    if (!x) return c;
    const w = c.width, h = c.height, im = x.getImageData(0, 0, w, h), d = im.data, hay = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) hay[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    const trama = [[0.2, 0.6], [0.8, 0.4]];
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const i = py * w + px, q = i * 4;
      if (!hay[i] || d[q] * 0.3 + d[q + 1] * 0.59 + d[q + 2] * 0.11 >= 60) continue;
      const borde = px === 0 || py === 0 || px === w - 1 || py === h - 1 || !hay[i - 1] || !hay[i + 1] || !hay[i - w] || !hay[i + w];
      const t = (py / Math.max(1, h - 1)) * (ALBA.length - 1), n = Math.floor(t);
      const [r, g, b] = borde ? [255, 250, 240] : ALBA[Math.min(ALBA.length - 1, n + (t - n > trama[py & 1][px & 1] ? 1 : 0))];
      d[q] = r; d[q + 1] = g; d[q + 2] = b;
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  /* Un abanico de rayos (fase 5), de `a0` a `a1` (la vuelta entera si no se dicen). */
  function rayos(x, cx, cy, r0, r1, n, colA, colB, a0, a1) {
    a0 = a0 == null ? 0 : a0; a1 = a1 == null ? Math.PI * 2 : a1;
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i + 0.5) / n, ab = ((a1 - a0) / n) * 0.24, r = i % 2 ? r0 + (r1 - r0) * 0.6 : r1;
      poligono(x, [[cx + Math.cos(a - ab) * r0, cy + Math.sin(a - ab) * r0], [cx + Math.cos(a) * r, cy + Math.sin(a) * r], [cx + Math.cos(a + ab) * r0, cy + Math.sin(a + ab) * r0]], i % 2 ? colB : colA);
    }
  }
  /* La paleta de la fase 5 sale de la de la 4: lo frío se vuelve oro y
     rosa; lo oscuro se queda (es lo que `amanece` llena de cielo). */
  const AL_ALBA = { "#8fd8ff": "#ffd070", "#c8f0ff": "#fff2c8", "#b48cff": "#ff8cb4", "#5a6ee0": "#e8a04c", "#3c50b4": "#a85c3c" };
  function alba(col) { const out = {}; for (const q in col) out[q] = AL_ALBA[col[q]] || col[q]; return out; }
  /* La fase 6: el vitral. Las joyas son los colores fríos de la fase 4
     vueltos vidrio (y los del rosetón); el plomo y el borde, los de siempre
     de un vitral. `vidria` llena lo oscuro del cuerpo (lo mismo que llenan
     las fases 4 y 5) con piezas de vidrio de unos 6 px: filas de ladrillos
     corridas, cada una partida en dos triángulos, con plomo entre pieza y
     pieza y un brillo en su borde de arriba. El plomo dibujado a propósito
     (pupilas, bocas) no se llena. */
  const JOYAS = ["#ff4c9c", "#5cf0d8", "#ffc83c", "#8c5cff"];
  const PLOMO = "#140c1c", BORDE_VITRAL = "#fff6d8";
  const VIDRIOS = ["#c8284c", "#2c4cc8", "#1c9c5c", "#e8a028", "#7c3cc8", "#28b4c0"].map(rgb);
  const A_VIDRIO = { "#8fd8ff": "#5cf0d8", "#c8f0ff": "#fff6d8", "#b48cff": "#ff4c9c", "#5a6ee0": "#ffc83c", "#3c50b4": "#8c5cff" };
  function vitral(col) { const out = {}; for (const q in col) out[q] = A_VIDRIO[col[q]] || col[q]; return out; }
  function vidria(c) {
    const x = c.getContext("2d");
    if (!x) return c;
    const w = c.width, h = c.height, im = x.getImageData(0, 0, w, h), d = im.data;
    const hay = new Uint8Array(w * h), cuerpo = new Uint8Array(w * h), pieza = new Int32Array(w * h), [pr, pg, pb] = rgb(PLOMO);
    const T = 6;
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const i = py * w + px, q = i * 4;
      hay[i] = d[q + 3] > 127 ? 1 : 0;
      const plomo = d[q] === pr && d[q + 1] === pg && d[q + 2] === pb;
      cuerpo[i] = hay[i] && !plomo && d[q] * 0.3 + d[q + 1] * 0.59 + d[q + 2] * 0.11 < 60 ? 1 : 0;
      const fila = Math.floor(py / T), corre = (fila & 1) * 3, col = Math.floor((px + corre) / T);
      const lx = px + corre - col * T, ly = py - fila * T;
      const mitad = (col + fila) & 1 ? (lx + ly >= T - 1 ? 1 : 0) : (lx >= ly ? 1 : 0);
      pieza[i] = (fila * 997 + col) * 2 + mitad;
    }
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const i = py * w + px, q = i * 4;
      if (!cuerpo[i]) continue;
      const borde = px === 0 || py === 0 || px === w - 1 || py === h - 1 || !hay[i - 1] || !hay[i + 1] || !hay[i - w] || !hay[i + w];
      let r, g, b;
      if (borde) [r, g, b] = rgb(BORDE_VITRAL);
      else if ((cuerpo[i + 1] && pieza[i + 1] !== pieza[i]) || (cuerpo[i + w] && pieza[i + w] !== pieza[i])) [r, g, b] = [pr, pg, pb];
      else {
        const v = VIDRIOS[((pieza[i] * 2654435761) >>> 0) % VIDRIOS.length];
        const brilla = cuerpo[i - w] && pieza[i - w] !== pieza[i];     // el canto de arriba de cada pieza
        [r, g, b] = brilla ? v.map(k => Math.min(255, k + 70)) : v;
      }
      d[q] = r; d[q + 1] = g; d[q + 2] = b;
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  /* Un rosetón (fase 6): pétalos de vidrio en punta, de `r0` a `r1`, con
     las joyas alternadas y una perla de luz en cada punta. Como `rayos`,
     de `a0` a `a1` (la vuelta entera si no se dicen). */
  function roseton(x, cx, cy, r0, r1, n, a0, a1) {
    a0 = a0 == null ? 0 : a0; a1 = a1 == null ? Math.PI * 2 : a1;
    if (faseLienzo >= 7) return aureola(x, cx, cy, r0, r1, n, a0, a1);
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i + 0.5) / n, ab = ((a1 - a0) / n) * 0.3, rm = r0 + (r1 - r0) * 0.45;
      const p = (rr, da) => [cx + Math.cos(a + da) * rr, cy + Math.sin(a + da) * rr];
      poligono(x, [p(r0, -ab * 0.6), p(rm, -ab), p(r1, 0), p(rm, ab), p(r0, ab * 0.6)], JOYAS[i % JOYAS.length]);
      const t = p(r1 + 1.4, 0);
      elipse(x, t[0], t[1], 0.9, 0.9, BORDE_VITRAL);
    }
  }
  /* Una roseta chica: seis pétalos alrededor de un ojo de luz. */
  function roseta(x, cx, cy, r) {
    if (faseLienzo >= 7) {   // fase 7: una flor de oro con el ojo de laca
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; elipse(x, cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.42, r * 0.42, OROS[i % 2 ? 0 : 1]); }
      elipse(x, cx, cy, r * 0.4, r * 0.4, LACA); elipse(x, cx, cy, r * 0.16, r * 0.16, BORDE_ORO);
      return;
    }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; elipse(x, cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.42, r * 0.42, JOYAS[i % 2 ? 1 : 0]); }
    elipse(x, cx, cy, r * 0.38, r * 0.38, BORDE_VITRAL);
  }
  /* La fase 7: el oro. Los colores fríos de la fase 4 se vuelven oro (del
     pálido al viejo); la laca es el negro de los pedazos, y lo dibujado
     exactamente en laca (pupilas, bocas) se queda así, sin vetas. */
  const OROS = ["#ffd070", "#e8a83c", "#fff0b0", "#b87828"];
  const LACA = "#120a0e", BORDE_ORO = "#ffe8a0", VETA = "#ffc83c";
  const LACAS = ["#1c1418", "#2a1c1c", "#171022"].map(rgb), LABIO = rgb("#4a3020");
  const A_ORO = { "#8fd8ff": "#ffd070", "#c8f0ff": "#fff0b0", "#b48cff": "#e8a83c", "#5a6ee0": "#b87828", "#3c50b4": "#7a4818" };
  function dorado(col) { const out = {}; for (const q in col) out[q] = A_ORO[col[q]] || col[q]; return out; }
  /* La aureola de la fase 7: hojas de pan de oro en punta (las de `roseton`),
     alternando dos oros, con un aro fino por dentro y una perla en cada punta. */
  function aureola(x, cx, cy, r0, r1, n, a0, a1) {
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i + 0.5) / n, ab = ((a1 - a0) / n) * 0.26, rm = r0 + (r1 - r0) * 0.5, largo = i % 2 ? r0 + (r1 - r0) * 0.78 : r1;
      const p = (rr, da) => [cx + Math.cos(a + da) * rr, cy + Math.sin(a + da) * rr];
      poligono(x, [p(r0, -ab * 0.5), p(rm, -ab), p(largo, 0), p(rm, ab), p(r0, ab * 0.5)], OROS[i % 2 ? 1 : 0]);
      trazo(x, [p(r0 + 1, 0), p(largo - 1.5, 0)], OROS[3], 0.6);              // el nervio de la hoja
      const t = p(largo + 1.4, 0);
      elipse(x, t[0], t[1], 0.8, 0.8, BORDE_ORO);
    }
    x.strokeStyle = OROS[0]; x.lineWidth = 0.8;
    x.beginPath(); x.arc(cx, cy, r0 + 0.5, a0, a1); x.stroke();
  }
  /* `dora` llena lo oscuro del cuerpo (lo mismo que llenan las fases 4, 5
     y 6) con laca en pedazos unidos por vetas de oro. Las vetas son grietas
     que caminan torciéndose y a veces se abren en dos; salen de un azar con
     semilla (el tamaño del lienzo), así cada cuadro de aleteo se quiebra
     igual. Cada pedazo entre vetas tiene su tono de laca, el píxel debajo
     de una veta brilla un poco (el labio del oro), alguna veta destella y el
     borde del cuerpo es de oro. */
  function dora(c, porVeta) {
    const x = c.getContext("2d");
    if (!x) return c;
    const w = c.width, h = c.height, im = x.getImageData(0, 0, w, h), d = im.data;
    const hay = new Uint8Array(w * h), cuerpo = new Uint8Array(w * h), [lr, lg, lb] = rgb(LACA), cuerpos = [];
    for (let i = 0; i < w * h; i++) {
      const q = i * 4;
      hay[i] = d[q + 3] > 127 ? 1 : 0;
      const laca = d[q] === lr && d[q + 1] === lg && d[q + 2] === lb;
      cuerpo[i] = hay[i] && !laca && d[q] * 0.3 + d[q + 1] * 0.59 + d[q + 2] * 0.11 < 60 ? 1 : 0;
      if (cuerpo[i]) cuerpos.push(i);
    }
    if (!cuerpos.length) return c;
    let semilla = (Math.imul(w, 73856093) ^ Math.imul(h, 19349663)) >>> 0;
    const azar = () => { semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0; return semilla / 4294967296; };
    // Las vetas.
    const vena = new Uint8Array(w * h), pila = [], n = Math.max(2, Math.round(cuerpos.length / (porVeta || 150)));
    for (let k = 0; k < n; k++) { const i0 = cuerpos[Math.floor(azar() * cuerpos.length)]; pila.push({ x: i0 % w, y: Math.floor(i0 / w), a: azar() * Math.PI * 2, largo: 8 + azar() * Math.max(w, h) * 0.7, rama: 2 }); }
    while (pila.length) {
      const g = pila.pop();
      let px = g.x, py = g.y, fuera = 0;
      for (let t = 0; t < g.largo; t++) {
        const ix = Math.round(px), iy = Math.round(py);
        if (ix < 0 || iy < 0 || ix >= w || iy >= h) break;
        const i = iy * w + ix;
        if (cuerpo[i]) { vena[i] = 1; fuera = 0; } else if (++fuera > 3) break;
        g.a += (azar() - 0.5) * 0.8; px += Math.cos(g.a); py += Math.sin(g.a);
        if (g.rama > 0 && azar() < 0.05) pila.push({ x: px, y: py, a: g.a + (azar() < 0.5 ? -1 : 1) * (0.7 + azar() * 0.6), largo: (g.largo - t) * 0.5, rama: g.rama - 1 });
      }
    }
    // Los pedazos: lo que queda entre vetas, cada uno con su tono.
    const pedazo = new Int32Array(w * h).fill(-1);
    let nPed = 0;
    for (const i0 of cuerpos) {
      if (vena[i0] || pedazo[i0] >= 0) continue;
      const cola = [i0]; pedazo[i0] = nPed;
      while (cola.length) {
        const i = cola.pop(), px = i % w;
        for (const j of [px > 0 ? i - 1 : -1, px < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < w * h && cuerpo[j] && !vena[j] && pedazo[j] < 0) { pedazo[j] = nPed; cola.push(j); }
      }
      nPed++;
    }
    for (const i of cuerpos) {
      const q = i * 4, px = i % w, py = Math.floor(i / w);
      const borde = px === 0 || py === 0 || px === w - 1 || py === h - 1 || !hay[i - 1] || !hay[i + 1] || !hay[i - w] || !hay[i + w];
      let col;
      if (borde) col = rgb(BORDE_ORO);
      else if (vena[i]) col = ((i * 2654435761) >>> 0) % 7 === 0 ? rgb(OROS[2]) : rgb(VETA);
      else if (vena[i - w]) col = LABIO;
      else col = LACAS[(((pedazo[i] + 1) * 2654435761) >>> 0) % LACAS.length];
      d[q] = col[0]; d[q + 1] = col[1]; d[q + 2] = col[2];
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  /* La paleta con que se cuantiza un jefe: la suya y, en la fase 6, las
     joyas y el plomo (en la 7, los oros y la laca). */
  const paletaDe = (col, fase) => (fase >= 7 ? Object.values(col).concat(OROS, [LACA, BORDE_ORO]) : fase >= 6 ? Object.values(col).concat(JOYAS, [PLOMO, BORDE_VITRAL]) : Object.values(col));
  /* El final de todo jefe: a la paleta y, en las fases 4 a 7, al cielo (o al vidrio, o al oro). */
  const acaba = (c, col, fase) => { const q = cuantiza(c, paletaDe(col, fase)); return fase >= 7 ? dora(q) : fase >= 6 ? vidria(q) : fase === 5 ? amanece(q) : fase === 4 ? asciende(q, "#8fd8ff") : q; };

  /* La Nodriza: polilla enorme y peluda, con un racimo de huevos en el
     abdomen (arriba). Alas de vino y ámbar con medialunas claras.
     Fase 2: un tercer par de alas en cola y un ocelo abierto en cada ala.
     Fase 3: las alas roídas, las venas encendidas y los huevos en corona.
     Fase 4: las alas son cielo; en cada una, una estrella donde estaba el
     ocelo, y sobre el abdomen un arco de siete (los huevos, ya astros). */
  const COLORES_NODRIZA = { b: "#9a5a3c", B: "#5e3024", r: "#d9965a", e: "#f2d0a0", c: "#4a2c22", d: "#8a5a40", g: "#fff0c8", a: "#c8a07a", o: "#2a1810" };
  const COLORES_NODRIZA_F = {
    2: { b: "#8e2a34", B: "#4c111e", r: "#e2733c", e: "#ffd884", c: "#2e1016", d: "#7c2c30", g: "#ffb468", a: "#e09a5a", o: "#150609", y: "#fff2c0" },
    3: { b: "#1e1622", B: "#0d0911", r: "#ff8c3c", e: "#fff2b4", c: "#0f0b13", d: "#5c2c22", g: "#fffaf0", a: "#ffc478", o: "#000000", y: "#ffffff" },
    4: { b: "#16225a", B: "#0c1434", r: "#8fd8ff", e: "#c8f0ff", c: "#0c1434", d: "#3c50b4", g: "#ffffff", a: "#b48cff", o: "#0c1434", y: "#ffffff" }
  };
  COLORES_NODRIZA_F[5] = alba(COLORES_NODRIZA_F[4]);
  COLORES_NODRIZA_F[6] = vitral(COLORES_NODRIZA_F[4]);
  COLORES_NODRIZA_F[7] = dorado(COLORES_NODRIZA_F[4]);
  function nodriza(k, fase) {
    fase = fase || 1;
    const W = 58, H = 40, cx = 29, { c, x } = lienzoJefe(W, H, fase, fase >= 5 ? 12 : 6);
    if (!x) return c;
    const col = COLORES_NODRIZA_F[fase] || COLORES_NODRIZA;
    // Fase 5: los rayos, detrás de todo (en la 6, el rosetón).
    if (fase === 5) rayos(x, cx, 19, 10, 31, 18, col.r, col.a);
    if (fase >= 6) roseton(x, cx, 19, 10, 31, 16);
    // Fases 2 y 3: un tercer par de alas, en cola, hacia el fanal.
    if (fase >= 2) espejo(cx, (s, m) => {
      poligono(x, [m([4, 24]), m([20 * k, 27]), m([16 * k + 2, 40]), m([10 * k + 1, 44]), m([6, 31])], col.r);
      poligono(x, [m([5, 25]), m([18.5 * k, 28]), m([15 * k + 2, 39]), m([10 * k + 1, 42]), m([7, 31])], col.B);
      trazo(x, [m([6, 27]), m([11 * k + 1, 40])], col.r, 0.7);
    });
    // Alas traseras: redondeadas, asoman detrás, hacia el abdomen (arriba).
    espejo(cx, (s, m) => { const p = m([11 * k + 1, 10]); elipse(x, p[0], p[1], 10 * k + 2, 7.5, col.r); elipse(x, p[0], p[1] + 0.5, 9 * k + 1.5, 6.5, col.B); });
    // Alas delanteras: anchas, con el borde claro.
    espejo(cx, (s, m) => {
      poligono(x, [m([3, 12]), m([25 * k, 8]), m([28.5 * k, 17]), m([23 * k, 29]), m([5, 25])], col.r);
      poligono(x, [m([3, 13]), m([24 * k, 9.2]), m([27.2 * k, 17]), m([22 * k, 27.8]), m([5, 24])], col.b);
      // Venas: líneas finas desde la base hacia el borde (en la fase 3, encendidas).
      for (const [vx, vy] of [[24, 10], [27, 16], [23, 26]]) trazo(x, [m([5, 18]), m([vx * k, vy])], fase >= 3 ? col.r : col.B, fase >= 3 ? 0.8 : 0.6);
      // Dos bandas en zigzag que cruzan el ala, como las de una polilla de verdad.
      trazo(x, [m([7 * k + 2, 11]), m([9 * k + 2, 15]), m([8 * k + 2, 19]), m([10 * k + 2, 23])], col.B, 1.4);
      if (fase < 2) trazo(x, [m([15 * k + 1, 9.5]), m([18 * k + 1, 14]), m([16 * k + 1, 19]), m([18 * k + 1, 25])], col.B, 1.4);
      // Una fila de puntos pálidos junto al margen.
      for (const [px, py] of [[23, 12], [25, 17], [21.5, 23]]) elipse(x, m([px * k, py])[0], py, 0.9 * k + 0.3, 0.9, col.e);
      // El ocelo: un ojo en cada ala, que en la fase 3 tiene la pupila rasgada.
      if (fase >= 6) roseta(x, m([15.5 * k, 18])[0], 18, 5.2);   // fase 6: el ocelo es una roseta
      else if (fase === 5) {
        // Fase 5: en el lugar del ocelo, un sol chico.
        const o = m([15.5 * k, 18]);
        rayos(x, o[0], o[1], 3, 7.5, 8, col.g, col.r);
        elipse(x, o[0], o[1], 3.8, 3.8, col.r); elipse(x, o[0], o[1], 2.2, 2.2, col.g);
      } else if (fase === 4) {
        // Fase 4: la figura. Los vértices del ala son estrellas, y en el lugar del ocelo, la mayor.
        trazo(x, [m([4, 19]), m([24.5 * k, 9]), m([27.8 * k, 17]), m([22.5 * k, 28]), m([4, 19])], col.a, 0.6);
        for (const [px, py, r] of [[24.5, 9, 2], [27.8, 17, 1.6], [22.5, 28, 2]]) estrella(x, m([px * k, py])[0], py, r, col.g);
        const o = m([15.5 * k, 18]);
        estrella(x, o[0], o[1], 5, col.r, col.g);
      } else if (fase >= 2) {
        const o = m([15.5 * k, 18]);
        elipse(x, o[0], o[1], 4.8 * k + 0.4, 4.8, col.e);
        elipse(x, o[0], o[1], 3.5 * k + 0.3, 3.5, col.o);
        if (fase >= 3) { elipse(x, o[0], o[1], 2.4 * k, 2.6, col.r); elipse(x, o[0], o[1], 0.8, 2.6, col.y); }
        else elipse(x, o[0], o[1] + 0.8, 1.6, 1.6, col.y);
      }
      // Fase 3: el margen roído.
      if (fase === 3) corta(x, () => { for (const [nx, ny] of [[27.6, 12.5], [28.6, 20], [25.4, 25.5]]) poligono(x, [m([nx * k + 2, ny - 1.8]), m([(nx - 4.5) * k, ny]), m([nx * k + 2, ny + 1.8])], "#000"); });
    });
    // Abdomen anillado arriba, con el racimo de huevos pálidos en la punta.
    elipse(x, cx, 11, 4.2, 8, col.c);
    for (let i = 0; i < 3; i++) elipse(x, cx, 6 + i * 4, 3.6, 0.9, fase >= 3 ? col.r : col.d);
    for (const [ex, ey] of [[0, 2], [-2.5, 3.5], [2.5, 3.5], [-1.2, 5.5], [1.2, 5.5], [-3.6, 1.2], [3.6, 1.2]]) elipse(x, cx + ex, ey, 1.5, 1.4, col.g);
    if (fase === 2) for (const [ex, ey] of [[-5.4, 3.2], [5.4, 3.2], [-1.6, -0.6], [1.6, -0.6], [-4, 6], [4, 6]]) elipse(x, cx + ex, ey, 1.5, 1.4, col.g);
    // Fase 3: los huevos, en corona.
    if (fase === 3) for (let i = 0; i < 7; i++) { const a = Math.PI * (1.1 + 0.8 * i / 6); elipse(x, cx + Math.cos(a) * 10.5, 5.5 + Math.sin(a) * 9.5, 1.4, 1.4, i % 2 ? col.r : col.g); }
    // Fase 5: los huevos, cinco soles chicos en arco.
    if (fase === 5) for (let i = 0; i < 5; i++) { const a = Math.PI * (1.15 + 0.7 * i / 4), ex = cx + Math.cos(a) * 13, ey = 7 + Math.sin(a) * 10; elipse(x, ex, ey, 2.2, 2.2, col.r); elipse(x, ex, ey, 1.1, 1.1, col.g); }
    // Fase 6: los huevos, siete gotas de vidrio en arco, de colores.
    if (fase >= 6) for (let i = 0; i < 7; i++) { const a = Math.PI * (1.1 + 0.8 * i / 6), ex = cx + Math.cos(a) * 14, ey = 7 + Math.sin(a) * 11; poligono(x, [[ex, ey - 2.8], [ex + 1.9, ey], [ex, ey + 2.8], [ex - 1.9, ey]], JOYAS[i % JOYAS.length]); elipse(x, ex - 0.5, ey - 0.8, 0.6, 0.6, BORDE_VITRAL); }
    // Fase 4: un arco de siete estrellas, unidas.
    if (fase === 4) {
      const arco = [];
      for (let i = 0; i < 7; i++) { const a = Math.PI * (1.08 + 0.84 * i / 6); arco.push([cx + Math.cos(a) * 15, 8 + Math.sin(a) * 12]); }
      trazo(x, arco, col.a, 0.6);
      arco.forEach((p, i) => estrella(x, p[0], p[1], i % 2 ? 1.5 : 2.4, col.g));
    }
    // Tórax peludo con su collar claro, y la cabeza abajo.
    elipse(x, cx, 21, 5.2, 6, col.c);
    elipse(x, cx, 17.5, 4.6, 1.6, col.d);
    elipse(x, cx, 29, 3.2, 2.6, col.c);
    if (fase >= 2) for (const s of [-1, 1]) elipse(x, cx + s * 1.6, 29.6, 0.8, 0.8, col.y);   // ahora mira
    // Antenas plumosas que apuntan al fanal.
    espejo(cx, (s, m) => {
      trazo(x, [m([1.5, 31]), m([6, 35.5]), m([9, 38.5])], col.a, 1);
      for (let t = 0; t < 3; t++) trazo(x, [m([3 + t * 2, 32.5 + t * 1.7]), m([4.2 + t * 2, 34.6 + t * 1.7])], col.a, 0.8); // las plumas
      if (fase >= 2) for (let t = 0; t < 3; t++) trazo(x, [m([3.4 + t * 2, 32 + t * 1.7]), m([6 + t * 2, 31.4 + t * 1.7])], col.a, 0.8);
    });
    return acaba(c, col, fase);
  }

  /* El Faro Ciego: un fanal enorme, varado, cubierto de polillas de la
     niebla. Arriba la cúpula de bronce, en medio la sala de vidrio con la
     lente (el haz se pinta vivo) y abajo el casco.
     Fase 2: rajado de arriba abajo, con dos brazos de los que cuelgan
     faroles. Fase 3: la sala abierta como un costillar y, adentro, la
     lente vuelta un ojo. Ya no es ciego. Fase 4: la torre es cielo y la
     lente, una estrella grande con sus cuatro rayos; arriba, una aureola. */
  const COLORES_FARO = { h: "#b08a50", H: "#6e5430", g: "#2e4442", G: "#5d7a72", l: "#e6f2d8", m: "#3e4a46", n: "#28322f", k: "#5d6e66" };
  const COLORES_FARO_F = {
    2: { h: "#b4542c", H: "#5e2618", g: "#2c1a20", G: "#6c2c2e", l: "#ffd884", m: "#3c2a2c", n: "#1f1316", k: "#8c3c2c", r: "#ff6c3c", o: "#0d0709" },
    3: { h: "#d8b070", H: "#3c2c1c", g: "#0d0d13", G: "#1f1f2b", l: "#fffaf0", m: "#17151d", n: "#09080d", k: "#ffb84c", r: "#ff5c3c", o: "#000000" },
    4: { h: "#5a6ee0", H: "#3c50b4", g: "#0c1434", G: "#16225a", l: "#ffffff", m: "#16225a", n: "#0c1434", k: "#b48cff", r: "#c8f0ff", o: "#0c1434" }
  };
  COLORES_FARO_F[5] = alba(COLORES_FARO_F[4]);
  COLORES_FARO_F[6] = vitral(COLORES_FARO_F[4]);
  COLORES_FARO_F[7] = dorado(COLORES_FARO_F[4]);
  function faro(fase) {
    fase = fase || 1;
    const W = 44, H = 54, cx = 22, { c, x } = lienzoJefe(W, H, fase, fase >= 5 ? 12 : 8);
    if (!x) return c;
    const col = COLORES_FARO_F[fase] || COLORES_FARO;
    // Fase 5: encendido de verdad: los rayos salen de la lente, por detrás de la torre.
    if (fase === 5) rayos(x, cx, 28, 12, 34, 16, col.r, col.k);
    // Fase 6: la lente se volvió vitral, y su luz, un rosetón.
    if (fase >= 6) roseton(x, cx, 28, 12, 34, 14);
    // Fase 3: una corona de púas sobre el casco.
    if (fase === 3) for (const sx of [9, 15.5, 22, 28.5, 35]) poligono(x, [[sx - 2.6, 3], [sx, sx === 22 ? -7 : -4.5], [sx + 2.6, 3]], col.h);
    // Fase 4: una aureola de estrellas chicas.
    if (fase === 4) for (let i = 0; i < 9; i++) { const a = Math.PI * (1 + i / 8); estrella(x, cx + Math.cos(a) * 15, 2 + Math.sin(a) * 7.5, i % 2 ? 1.2 : 1.9, i % 2 ? col.k : col.l); }
    // Casco de piedra y madera, arriba (el faro mira hacia abajo).
    poligono(x, [[6, 2], [38, 2], [34, 14], [10, 14]], col.m);
    for (let i = 0; i < 3; i++) trazo(x, [[8 + i, 5 + i * 3], [36 - i, 5 + i * 3]], col.n, 1);   // tablones
    // Galería de bronce.
    poligono(x, [[8, 14], [36, 14], [36, 17], [8, 17]], col.h);
    // Fases 2 y 3: dos brazos con un farol colgando de cada uno (en la 3, de una cadena).
    if (fase >= 2) espejo(cx, (s, m) => {
      const cae = fase >= 3 ? 6 : 0;
      trazo(x, [m([13, 15.5]), m([25, 15.5])], col.h, 1.8);
      if (cae) puntos(x, m([25, 17]), m([25, 17 + cae]), 3, col.h, 0.7); else trazo(x, [m([25, 15.5]), m([25, 19])], col.h, 1);
      poligono(x, [m([22, 19 + cae]), m([28, 19 + cae]), m([28, 26 + cae]), m([22, 26 + cae])], col.H);
      poligono(x, [m([23, 20 + cae]), m([27, 20 + cae]), m([27, 25 + cae]), m([23, 25 + cae])], col.r);
      elipse(x, m([25, 23 + cae])[0], 23 + cae, 0.9, 1.5, col.l);
      trazo(x, [m([25, 26 + cae]), m([25, 28.5 + cae])], col.h, 1);
    });
    if (fase === 3) {
      // La sala, abierta: un hueco oscuro y las costillas de bronce alrededor.
      elipse(x, cx, 27.5, 13.5, 11, col.g);
      elipse(x, cx, 27.5, 11.5, 9.4, col.G);
      espejo(cx, (s, m) => { for (let i = 0; i < 3; i++) trazo(x, [m([3, 17.5]), m([7.5 + i * 3.2, 22]), m([9 + i * 3.4, 27.5]), m([7.5 + i * 3.2, 33]), m([3, 37.5])], col.h, 1.1); });
      // El ojo: la lente, con iris y pupila rasgada.
      elipse(x, cx, 28, 8.4, 5.6, col.l);
      elipse(x, cx, 28, 4, 4.6, col.k);
      elipse(x, cx, 28, 2.6, 3.2, col.r);
      elipse(x, cx, 28, 0.9, 3.6, col.o);
      trazo(x, [[cx - 9, 28], [cx - 4, 22.6], [cx + 4, 22.6], [cx + 9, 28]], col.H, 1);   // el párpado
    } else {
      // Sala de vidrio con sus montantes.
      poligono(x, [[11, 17], [33, 17], [33, 38], [11, 38]], col.g);
      poligono(x, [[13, 19], [31, 19], [31, 36], [13, 36]], col.G);
      for (const mx of [11, 17, 22, 27, 33]) trazo(x, [[mx, 17], [mx, 38]], col.H, 1.2);
      // La lente, apagada en el dibujo (la luz se agrega viva). En la fase 2, más grande y roja.
      if (fase >= 6) {   // la lente: un rosetón chico, con plomo
        elipse(x, cx, 28, 8, 8, col.k); roseta(x, cx, 28, 7.4); elipse(x, cx, 28, 1.2, 1.2, PLOMO);
      } else if (fase === 5) {   // la lente: un sol
        elipse(x, cx, 28, 7.6, 7.6, col.k); elipse(x, cx, 28, 6.2, 6.2, col.h); elipse(x, cx, 28, 4.4, 4.4, col.r); elipse(x, cx, 28, 2.2, 2.2, col.l);
      } else if (fase === 4) {   // la lente: una estrella, con dos rayos más en diagonal
        for (const s of [-1, 1]) trazo(x, [[cx - 7.5, 28 - s * 7.5], [cx + 7.5, 28 + s * 7.5]], col.k, 0.8);
        estrella(x, cx, 28, 10, col.r, col.l);
      } else if (fase >= 2) { elipse(x, cx, 28, 7, 7, col.k); elipse(x, cx, 28, 5, 5, col.r); elipse(x, cx, 28, 2.6, 2.6, col.l); }
      else { elipse(x, cx, 28, 5, 5, col.k); elipse(x, cx, 28, 3, 3, col.l); }
    }
    // Cúpula de bronce abajo, con su remate apuntando al fanal.
    poligono(x, [[9, 38], [35, 38], [31, 44], [13, 44]], col.h);
    elipse(x, cx, 45, 8, 4, col.H);
    trazo(x, [[cx, 47], [cx, 52]], col.h, 1.4);
    elipse(x, cx, 52, 1.6, 1.6, col.h);
    // Fase 2: la raja que lo cruza, y un mordisco en la cúpula.
    if (fase === 2) {
      trazo(x, [[15, 2], [18.5, 9], [14.5, 15], [16, 19]], col.o, 1.2);
      trazo(x, [[28, 36], [30, 41], [27.5, 46]], col.o, 1.2);
      corta(x, () => poligono(x, [[31, 43], [36, 39], [36, 49], [29, 49]], "#000"));
    }
    return acaba(c, col, fase);
  }

  /* La Esfinge: una esfinge de las polillas, alas largas y angostas
     barridas hacia atrás, terciopelo negro con marcas de hueso. Las marcas
     son las que se encienden antes de cada ataque.
     Fase 2: la esfinge de la calavera (la lleva en el tórax), con el filo
     de las alas en sierra. Fase 3: dos pares de alas y cuernos; las marcas
     ya no son de hueso, son de luz. Fase 4: las alas de cielo, las marcas
     vueltas estrellas (su figura), y un aro detrás de la cabeza. */
  const COLORES_ESFINGE = { b: "#241a2c", B: "#120c18", e: "#d8cdb8", E: "#8a7e6e", c: "#1a1222", d: "#3e2e4e", a: "#6a5a80", r: "#4a3a62" };
  const COLORES_ESFINGE_F = {
    2: { b: "#2e1622", B: "#150910", e: "#f2dcbc", E: "#a4745c", c: "#1e0d16", d: "#5c2232", a: "#b4546c", r: "#8c2c3c", y: "#ff5c4c" },
    3: { b: "#12121a", B: "#07070b", e: "#fffaf0", E: "#ffc264", c: "#0b0b11", d: "#2c2c3c", a: "#ffd894", r: "#4c4c6c", y: "#ffffff" },
    4: { b: "#16225a", B: "#0c1434", e: "#ffffff", E: "#8fd8ff", c: "#0c1434", d: "#1e2e78", a: "#b48cff", r: "#8fd8ff", y: "#ffffff" }
  };
  COLORES_ESFINGE_F[5] = alba(COLORES_ESFINGE_F[4]);
  COLORES_ESFINGE_F[6] = vitral(COLORES_ESFINGE_F[4]);
  COLORES_ESFINGE_F[7] = dorado(COLORES_ESFINGE_F[4]);
  function esfinge(k, fase) {
    fase = fase || 1;
    const W = 78, H = 44, cx = 39, { c, x } = lienzoJefe(W, H, fase, fase >= 5 ? 12 : 6);
    if (!x) return c;
    const col = COLORES_ESFINGE_F[fase] || COLORES_ESFINGE;
    // Fase 5: los rayos, detrás (en la 6, el rosetón).
    if (fase === 5) rayos(x, cx, 22, 10, 34, 20, col.E, col.a);
    if (fase >= 6) roseton(x, cx, 22, 10, 34, 18);
    // Fase 4: el aro, detrás de la cabeza.
    if (fase === 4) { x.strokeStyle = col.a; x.lineWidth = 1; x.beginPath(); x.arc(cx, 31, 9.5, 0, Math.PI * 2); x.stroke(); }
    // Fase 3: un segundo par de alas largas, debajo de las primeras.
    if (fase >= 3) espejo(cx, (s, m) => {
      poligono(x, [m([3, 26]), m([34 * k, 17]), m([38 * k, 20.5]), m([30 * k, 26]), m([13 * k, 32.5]), m([4, 31])], col.r);
      poligono(x, [m([3, 26.8]), m([33 * k, 18.4]), m([36 * k, 20.6]), m([29 * k, 25.2]), m([12.5 * k, 31.4]), m([4, 30.2])], col.B);
      trazo(x, [m([8, 29]), m([32 * k, 20.8])], col.E, 0.8);
    });
    // Alas traseras, chicas, pegadas al cuerpo.
    espejo(cx, (s, m) => { const p = m([9 * k + 2, 15]); elipse(x, p[0], p[1], 8 * k + 2, 6, fase === 2 ? col.r : col.B); if (fase === 2) elipse(x, p[0], p[1], 6.6 * k + 1.6, 4.8, col.B); });
    // Alas delanteras: largas, con la punta hacia atrás (arriba).
    espejo(cx, (s, m) => {
      // Fases 2 y 3: el filo de atrás, en sierra.
      if (fase >= 2) for (const t of [0.12, 0.38, 0.64, 0.9]) { const px = (30 - 18 * t) * k, py = 14 + 8 * t; poligono(x, [m([px + 2.4, py - 1.2]), m([px - 0.4, py + 4.6]), m([px - 2.4, py + 1.2])], col.r); }
      poligono(x, [m([3, 24]), m([36 * k, 4]), m([37 * k, 8]), m([30 * k, 14]), m([12 * k, 22]), m([4, 28])], col.r);
      poligono(x, [m([3, 24]), m([34 * k, 6]), m([35 * k, 8.5]), m([29 * k, 13.5]), m([11 * k, 21.5]), m([4, 27])], col.b);
      // Marcas de hueso: dos galones y una línea al filo (un galón más desde la fase 2).
      trazo(x, [m([9 * k, 21]), m([16 * k, 15]), m([22 * k, 17])], col.e, 1.1);
      trazo(x, [m([18 * k, 13]), m([25 * k, 9]), m([30 * k, 11])], col.e, 1.1);
      if (fase >= 2) trazo(x, [m([27 * k, 8.6]), m([31.5 * k, 6.2]), m([34 * k, 7.6])], col.e, 1);
      trazo(x, [m([6, 25]), m([30 * k, 9.5])], col.E, 0.7);
      // Fase 4: en cada quiebre de las marcas, una estrella.
      if (fase === 4) for (const [px, py, r] of [[16, 15, 2.6], [25, 9, 2.6], [9, 21, 1.7], [22, 17, 1.5], [34, 7.6, 2]]) estrella(x, m([px * k, py])[0], py, r, col.e);
      // Fase 5: un sol chico en la punta de cada ala.
      if (fase === 5) { const p = m([33 * k, 8]); elipse(x, p[0], p[1], 2.6, 2.6, col.E); elipse(x, p[0], p[1], 1.3, 1.3, col.e); }
      // Fase 6: una roseta en la punta y el ala rajada, como un vidrio que se partió.
      // (En la 7, la misma raja, cosida con oro.)
      if (fase >= 6) { const p = m([33 * k, 8]); roseta(x, p[0], p[1], 3.2); trazo(x, [m([28 * k, 9]), m([22 * k, 15]), m([24 * k, 18]), m([16 * k, 20])], fase >= 7 ? VETA : PLOMO, 0.9); }
    });
    // Abdomen largo y anillado (arriba), tórax y cabeza (abajo).
    poligono(x, [[cx - 4, 24], [cx - 3, 6], [cx, 1], [cx + 3, 6], [cx + 4, 24]], col.c);
    for (let i = 0; i < 5; i++) trazo(x, [[cx - 3.5, 7 + i * 3.4], [cx + 3.5, 7 + i * 3.4]], i % 2 ? col.E : col.d, 1);
    // Fase 3: los cuernos, en la punta del abdomen.
    if (fase >= 3) { espejo(cx, (s, m) => trazo(x, [m([2, 5]), m([6.5, 0.5]), m([5.5, -4.5])], col.E, 1.4)); trazo(x, [[cx, 2], [cx, -4]], col.e, 1.2); }
    elipse(x, cx, 27, 5, 4.4, col.d);
    // Fases 2 y 3: la calavera en el tórax.
    if (fase >= 2) {
      elipse(x, cx, 26.4, 3.5, 3.2, col.e);
      poligono(x, [[cx - 1.8, 28.6], [cx + 1.8, 28.6], [cx + 1.3, 30.4], [cx - 1.3, 30.4]], col.e);
      for (const s of [-1, 1]) elipse(x, cx + s * 1.4, 26.2, 0.9, 1.1, col.c);
      trazo(x, [[cx, 28.8], [cx, 30.4]], col.c, 0.6);
    }
    elipse(x, cx, 33, 3.2, 2.6, col.c);
    if (fase >= 2) for (const s of [-1, 1]) elipse(x, cx + s * 1.5, 33.2, 0.8, 0.8, col.y);
    // La trompa enroscada y las antenas cortas.
    trazo(x, [[cx, 35], [cx, 39], [cx + 2, 41], [cx + 3.4, 39.5], [cx + 2, 38]], col.a, 0.9);
    espejo(cx, (s, m) => trazo(x, [m([2, 34]), m([6, 38])], col.a, 0.9));
    return acaba(c, col, fase);
  }
  /* Dónde están las marcas de la Esfinge (para encenderlas en el juego),
     relativo a su esquina en la fase 1, con las alas abiertas del todo. */
  const MARCAS_ESFINGE = [[39 - 16, 15], [39 + 16, 15], [39 - 25, 9], [39 + 25, 9], [39 - 9, 21], [39 + 9, 21]];

  /* El Casco: un fanal enorme hundido, con la quilla arriba (está dado
     vuelta) y su farol colgando abajo, todavía encendido. Cobre verde de
     tanto tiempo bajo el agua. La llama se pinta viva.
     Fase 2: partido en dos, con las cuadernas a la vista, coral rojo y una
     cadena cruzada. Fase 3: un barco fantasma: los ojos de buey encendidos
     y dientes en la borda, una vela en jirones y coral en corona.
     Fase 4: la Nave del cielo: el casco y las velas son noche, y sobre la
     quilla va su constelación, estrella por estrella. */
  const COLORES_CASCO = { m: "#3a3028", n: "#241c16", k: "#5a4a3a", h: "#8a6a3a", g: "#c89a52", v: "#2e5a52", V: "#5a9a88", o: "#120c08", G: "#2a3a38" };
  const COLORES_CASCO_F = {
    2: { m: "#3c2428", n: "#1f1116", k: "#6c3c36", h: "#a4542c", g: "#e28c3c", v: "#8c2c36", V: "#e2646c", o: "#0d0507", G: "#3c2429", y: "#ffd884", s: "#c8a090" },
    3: { m: "#15151d", n: "#09090f", k: "#2f2f3f", h: "#c8a264", g: "#ffd894", v: "#3c4c6c", V: "#a8c8ff", o: "#000000", G: "#1b2131", y: "#fffaf0", s: "#8c9aba" },
    4: { m: "#16225a", n: "#0c1434", k: "#3c50b4", h: "#5a6ee0", g: "#8fd8ff", v: "#1e2e78", V: "#b48cff", o: "#0c1434", G: "#0c1434", y: "#ffffff", s: "#c8f0ff" }
  };
  COLORES_CASCO_F[5] = alba(COLORES_CASCO_F[4]);
  COLORES_CASCO_F[6] = vitral(COLORES_CASCO_F[4]);
  COLORES_CASCO_F[7] = dorado(COLORES_CASCO_F[4]);
  function casco(k, fase) {
    fase = fase || 1;
    const W = 52, H = 40, cx = 26, { c, x } = lienzoJefe(W, H, fase, fase >= 5 ? 12 : 7);
    if (!x) return c;
    const col = COLORES_CASCO_F[fase] || COLORES_CASCO;
    // Fases 2 y 3: coral que le creció en la quilla (en la 3, en corona).
    // Fase 5: el sol saliendo por detrás de la quilla.
    if (fase === 5) { rayos(x, cx, 6, 9, 17, 9, col.g, col.V, Math.PI, Math.PI * 2); elipse(x, cx, 6, 9, 9, col.g); elipse(x, cx, 6, 6.4, 6.4, col.y); }
    // Fase 6: medio rosetón sobre la quilla, y botellas de colores colgando de la borda.
    if (fase >= 6) { roseton(x, cx, 6, 8, 18, 9, Math.PI, Math.PI * 2); roseta(x, cx, 6, 6); }
    // Fase 4: en vez de coral, la constelación de la Nave.
    if (fase === 4) {
      const nave = [[3, 1], [12, -3], [21, 0.5], [30, -4.5], [39, -1], [49, -5]];
      trazo(x, nave, col.V, 0.6);
      nave.forEach((p, i) => estrella(x, p[0], p[1], i % 2 ? 2.4 : 1.7, col.y));
    }
    if (fase === 2 || fase === 3) for (const [bx, alto] of fase >= 3 ? [[8, 5], [16, 7], [26, 9], [36, 7], [44, 5]] : [[9, 6], [40, 7], [45, 4]]) {
      trazo(x, [[bx, 5], [bx - 1, 5 - alto * 0.55], [bx + 0.6, 5 - alto]], col.V, 1.3);
      trazo(x, [[bx - 1, 5 - alto * 0.55], [bx - 3, 5 - alto * 0.9]], col.V, 1);
      trazo(x, [[bx - 0.4, 5 - alto * 0.3], [bx + 2.4, 5 - alto * 0.7]], col.v, 1);
    }
    // El casco: una barca dada vuelta, con la quilla arriba.
    poligono(x, [[3, 6], [49, 6], [44, 21], [8, 21]], col.m);
    trazo(x, [[5, 5], [47, 5]], col.k, 2);
    for (let i = 0; i < 4; i++) trazo(x, [[6 + i, 9 + i * 3], [46 - i, 9 + i * 3]], col.n, 1);   // tablones
    // Cobre verde y agujeros.
    for (const [vx, vy, r] of [[12, 10, 3], [34, 13, 2.5], [22, 17, 2], [41, 9, 2]]) elipse(x, vx, vy, r, r * 0.7, col.v);
    if (fase < 3) for (const [vx, vy] of [[18, 12], [30, 9], [38, 17]]) elipse(x, vx, vy, 1.4, 1.2, col.o);
    elipse(x, 13, 10, 1.4, 1, col.V); elipse(x, 35, 13, 1.2, 0.9, col.V);
    if (fase >= 2) {
      // Partido en dos: el tajo y, adentro, las cuadernas.
      corta(x, () => poligono(x, [[22.5, 3], [30.5, 3], [28.5, 12], [26.5, 22], [24, 12]], "#000"));
      for (let i = 0; i < 4; i++) trazo(x, [[24.2 + i * 0.3, 7 + i * 3.6], [28.8 - i * 0.5, 7 + i * 3.6]], col.s, 0.9);
    }
    if (fase === 2) puntos(x, [5, 11], [47, 18], 13, col.h, 0.8);   // la cadena cruzada
    if (fase >= 3) {
      // Los ojos de buey, encendidos, y los dientes de la borda.
      for (const ox of [14, 38]) { elipse(x, ox, 12.5, 4, 3.2, col.o); elipse(x, ox, 12.5, 3, 2.3, col.V); elipse(x, ox, 12.5, 1.5, 1.5, col.y); }
      for (let i = 0; i < 9; i++) { const tx = 10 + i * 4; if (Math.abs(tx - 26) < 3) continue; poligono(x, [[tx - 1.6, 21], [tx, 24.6], [tx + 1.6, 21]], col.s); }
    }
    // El mástil roto, colgando hacia abajo, y el farol al lado.
    trazo(x, [[cx - 9, 21], [cx - 11 - k, 33]], col.k, 1.6);
    if (fase === 2) {   // en su punta, un farol chico que también arde
      poligono(x, [[cx - 14 - k, 33], [cx - 9 - k, 33], [cx - 9 - k, 39], [cx - 14 - k, 39]], col.g);
      poligono(x, [[cx - 13 - k, 34], [cx - 10 - k, 34], [cx - 10 - k, 38], [cx - 13 - k, 38]], col.G);
      elipse(x, cx - 11.5 - k, 36.2, 0.9, 1.4, col.y);
    }
    if (fase >= 3) {    // la vela, en jirones (en la fase 4, de cielo)
      const vela = fase === 4 ? col.m : col.s;
      poligono(x, [[cx - 9, 22], [cx - 22 - k, 23], [cx - 24 - k, 30], [cx - 19, 28], [cx - 20 - k, 37], [cx - 14, 32], [cx - 11 - k, 36]], vela);
      trazo(x, [[cx - 12, 24], [cx - 20 - k, 26]], col.v, 0.8);
      trazo(x, [[cx + 9, 21], [cx + 13 + k, 31]], col.k, 1.4);
      poligono(x, [[cx + 9, 22], [cx + 20 + k, 23], [cx + 21 + k, 29], [cx + 16, 27], [cx + 15 + k, 34]], vela);
      if (fase === 4) { estrella(x, cx - 21 - k, 29, 1.8, col.y); estrella(x, cx + 18 + k, 27, 1.8, col.y); }
    }
    if (fase >= 6) for (const [bx, i] of [[cx - 17, 0], [cx + 17, 1], [cx + 11, 2]]) {   // las botellas
      trazo(x, [[bx, 21], [bx, 24]], col.k, 0.8);
      poligono(x, [[bx - 0.9, 24], [bx + 0.9, 24], [bx + 0.9, 25.5], [bx + 2.2, 27], [bx + 2.2, 32], [bx - 2.2, 32], [bx - 2.2, 27], [bx - 0.9, 25.5]], JOYAS[i]);
      elipse(x, bx - 0.9, 28.5, 0.5, 1.6, BORDE_VITRAL);
    }
    // El farol: soporte, vidrio y remate apuntando al fanal.
    trazo(x, [[cx, 21], [cx, 24]], col.h, 1.4);
    poligono(x, [[cx - 6, 24], [cx + 6, 24], [cx + 6, 26], [cx - 6, 26]], col.g);
    poligono(x, [[cx - 5, 26], [cx + 5, 26], [cx + 5, 34], [cx - 5, 34]], col.G);
    for (const mx of fase >= 3 ? [cx - 5, cx - 2.5, cx, cx + 2.5, cx + 5] : [cx - 5, cx, cx + 5]) trazo(x, [[mx, 26], [mx, 34]], col.h, fase >= 3 ? 0.8 : 1);
    poligono(x, [[cx - 6, 34], [cx + 6, 34], [cx + 3, 37], [cx - 3, 37]], col.g);
    elipse(x, cx, 38, 1.4, 1.2, col.h);
    return acaba(c, col, fase);
  }

  /* La Crisálida: un capullo enorme colgado de un hilo; en su última
     fase se abre y sale la imago, una polilla atlas pálida.
     Fase 2: el capullo, erizado de espinas y rajado, con algo que mira
     desde adentro; la imago, con colas. Fase 3: un capullo de vidrio negro
     con las venas encendidas y un halo de seda; la imago, de cuatro alas.
     Fase 4: un capullo de cielo con una estrella por corazón y un segundo
     halo, de astros; la imago, con las ventanas de las alas vueltas estrellas. */
  const COLORES_CRISALIDA = { s: "#f2ece2", S: "#c8bcb0", b: "#a8949e", B: "#6a5a68", p: "#f0a8c8", P: "#9a5a80", c: "#5a3a48", e: "#fff8ec", a: "#d8c0a8" };
  const COLORES_CRISALIDA_F = {
    2: { s: "#ecc8c8", S: "#ac6c7a", b: "#7c3c4c", B: "#3c1622", p: "#ff7c8c", P: "#8c2c4c", c: "#3c1622", e: "#ffe2d2", a: "#d89c8c", g: "#ff5c3c", o: "#150609" },
    3: { s: "#2c2636", S: "#13111b", b: "#ffd894", B: "#ff9c4c", p: "#fff2c8", P: "#c87c3c", c: "#0b0911", e: "#ffffff", a: "#ffe2a4", g: "#ffb84c", o: "#000000" },
    4: { s: "#16225a", S: "#0c1434", b: "#b48cff", B: "#5a6ee0", p: "#c8f0ff", P: "#3c50b4", c: "#0c1434", e: "#ffffff", a: "#8fd8ff", g: "#8fd8ff", o: "#0c1434" }
  };
  COLORES_CRISALIDA_F[5] = alba(COLORES_CRISALIDA_F[4]);
  COLORES_CRISALIDA_F[6] = vitral(COLORES_CRISALIDA_F[4]);
  COLORES_CRISALIDA_F[7] = dorado(COLORES_CRISALIDA_F[4]);
  /* La imago de la fase 4: las alas, que en las otras son lo claro, aquí son la noche. */
  const COLORES_IMAGO_4 = { s: "#0c1434", S: "#0c1434", b: "#b48cff", B: "#5a6ee0", p: "#16225a", P: "#8fd8ff", c: "#0c1434", e: "#ffffff", a: "#b48cff", g: "#b48cff", o: "#0c1434" };
  const COLORES_IMAGO_5 = alba(COLORES_IMAGO_4);
  const COLORES_IMAGO_6 = vitral(COLORES_IMAGO_4);
  const COLORES_IMAGO_7 = dorado(COLORES_IMAGO_4);
  function crisalida(k, fase) {
    fase = fase || 1;
    const W = 34, H = 48, cx = 17, { c, x } = lienzoJefe(W, H, fase, fase >= 5 ? 12 : 6);
    if (!x) return c;
    const col = COLORES_CRISALIDA_F[fase] || COLORES_CRISALIDA;
    // Fase 5: los rayos, detrás (en la 6, el rosetón).
    if (fase === 5) rayos(x, cx, 25, 14, 29, 16, col.a, col.b);
    if (fase >= 6) roseton(x, cx, 25, 14, 29, 14);
    // Fase 3: el halo de seda, una vuelta de puntos alrededor.
    if (fase >= 3) for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; if (Math.sin(a) < -0.93) continue; elipse(x, cx + Math.cos(a) * (17 + k), 25 + Math.sin(a) * 23, 0.8, 0.8, i % 2 ? col.b : col.B); }
    // Fase 4: un segundo halo, de estrellas.
    if (fase === 4) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.4; estrella(x, cx + Math.cos(a) * (21 + k), 25 + Math.sin(a) * 26.5, i % 2 ? 1.3 : 2, col.e); }
    // El hilo de arriba (tres desde la fase 2).
    trazo(x, [[cx, 0], [cx, 6]], col.S, 1);
    if (fase >= 2) for (const s of [-1, 1]) trazo(x, [[cx + s * 6, -5], [cx + s * 2.5, 8]], fase >= 3 ? col.P : col.S, 1);
    // Fase 2: las espinas, a los dos lados.
    if (fase === 2) espejo(cx, (s, m) => { for (let i = 0; i < 5; i++) { const y = 12 + i * 6; poligono(x, [m([10 + k, y]), m([16.5 + k, y + 1.2]), m([10 + k, y + 3.4])], col.P); } });
    // El capullo, con su latido (k lo infla un poco).
    elipse(x, cx, 25, 12 + k, 19, col.S);
    elipse(x, cx, 25, 10.5 + k, 17.5, col.s);
    // Las vueltas de seda.
    for (let i = 0; i < 6; i++) { const y = 12 + i * 5; trazo(x, [[cx - 10 - k, y + 2], [cx, y], [cx + 10 + k, y + 2]], col.S, 1); }
    // Por dentro, la forma de lo que va a nacer.
    elipse(x, cx, 27, 4, 9, col.b);
    elipse(x, cx, 20, 2.4, 3, col.B);
    elipse(x, cx - 5, 28, 1.6, 4, col.p); elipse(x, cx + 5, 28, 1.6, 4, col.p);
    if (fase >= 2) {
      // Las rajas (en la 3, venas de luz) y los ojos de lo que espera adentro.
      trazo(x, [[cx - 5, 11], [cx - 2, 17], [cx - 6.5, 24], [cx - 3, 31], [cx - 6, 37]], col.g, 1);
      trazo(x, [[cx + 6, 15], [cx + 3, 22], [cx + 7, 29], [cx + 4, 36]], col.g, 1);
      for (const s of [-1, 1]) elipse(x, cx + s * 1.3, 20, 0.8, 0.9, fase >= 3 ? col.e : col.g);
    }
    // Fase 3: ya se está abriendo por abajo.
    if (fase >= 3) { poligono(x, [[cx - 3.2, 33], [cx, 45], [cx + 3.2, 33], [cx, 36.5]], col.p); trazo(x, [[cx, 36.5], [cx, 44]], col.e, 0.8); }
    // Fase 4: lo que espera adentro ya es una estrella.
    if (fase === 4) estrella(x, cx, 25, 6.5 + k, col.p, col.e);
    // Fase 6: y es una roseta, con el plomo de las vueltas de seda.
    if (fase >= 6) { roseta(x, cx, 25, 6 + k); for (let i = 0; i < 6; i++) { const y = 12 + i * 5; if (Math.abs(y - 25) > 6) trazo(x, [[cx - 9 - k, y + 2], [cx, y], [cx + 9 + k, y + 2]], PLOMO, 0.8); } }
    return acaba(c, col, fase);
  }
  function imago(k, fase) {
    fase = fase || 1;
    const W = 64, H = 40, cx = 32, { c, x } = lienzoJefe(W, H, fase, 7);
    if (!x) return c;
    const col = fase >= 7 ? COLORES_IMAGO_7 : fase >= 6 ? COLORES_IMAGO_6 : fase === 5 ? COLORES_IMAGO_5 : fase === 4 ? COLORES_IMAGO_4 : COLORES_CRISALIDA_F[fase] || COLORES_CRISALIDA;
    // Fase 3: un segundo par de alas, más abajo.
    if (fase >= 3) espejo(cx, (s, m) => {
      poligono(x, [m([4, 21]), m([23 * k, 25]), m([27 * k, 34]), m([15 * k, 40]), m([6, 31])], col.P);
      poligono(x, [m([5, 22]), m([22 * k, 26]), m([25 * k, 33.4]), m([15 * k, 38.4]), m([7, 30.4])], col.s);
      elipse(x, m([16 * k, 31])[0], 31, 2 * k + 0.8, 1.8, col.e);
    });
    // Fases 2 y 3: las colas, hacia atrás (arriba).
    if (fase >= 2) espejo(cx, (s, m) => { trazo(x, [m([22 * k, 6]), m([25 * k, 0]), m([22.5 * k, -5.5])], col.P, 2.2); trazo(x, [m([22 * k, 6]), m([25 * k, 0]), m([22.8 * k, -4.5])], col.p, 0.9); });
    // Alas grandes, con las ventanas claras del atlas.
    espejo(cx, (s, m) => {
      poligono(x, [m([3, 10]), m([29 * k, 3]), m([31 * k, 14]), m([24 * k, 30]), m([6, 26])], col.P);
      poligono(x, [m([3, 11]), m([28 * k, 4.5]), m([29.5 * k, 14]), m([23 * k, 28.5]), m([6, 25])], col.p);
      if (fase >= 2) { elipse(x, m([17 * k, 13])[0], 13, 4.4 * k + 1.2, 3.6, col.c); elipse(x, m([16 * k, 23])[0], 23, 3.6 * k + 1, 3, col.c); }
      elipse(x, m([17 * k, 13])[0], 13, 3 * k + 1, 2.4, col.e);
      elipse(x, m([16 * k, 23])[0], 23, 2.4 * k + 0.8, 2, col.e);
      if (fase >= 2) elipse(x, m([17 * k, 13])[0], 13, 1.1, 1.1, col.g);
      if (fase >= 6) { roseta(x, m([17 * k, 13])[0], 13, 4.6); roseta(x, m([16 * k, 23])[0], 23, 3.4); }
      if (fase === 4) { estrella(x, m([17 * k, 13])[0], 13, 5.4, col.e, col.g); estrella(x, m([16 * k, 23])[0], 23, 3.8, col.e); estrella(x, m([29 * k, 4])[0], 4, 1.8, col.e); estrella(x, m([24 * k, 29.5])[0], 29.5, 1.6, col.e); }
      trazo(x, [m([5, 17]), m([30 * k, 9])], col.P, 0.8);
      trazo(x, [m([7, 24]), m([26 * k, 26])], col.s, 0.9);   // los restos del capullo, pegados
    });
    // Cuerpo y cabeza.
    elipse(x, cx, 15, 3.4, 10, col.c);
    elipse(x, cx, 28, 3, 2.6, col.c);
    if (fase >= 2) { for (const s of [-1, 1]) elipse(x, cx + s * 1.4, 28.4, 0.8, 0.8, col.g); for (let i = 0; i < 4; i++) trazo(x, [[cx - 2.6, 8 + i * 4], [cx + 2.6, 8 + i * 4]], col.g, 0.7); }
    espejo(cx, (s, m) => trazo(x, [m([1.5, 30]), m([6, 36])], col.a, 1));
    return acaba(c, col, fase);
  }

  /* La Hoguera: un montón de fanales apilados que arden juntos. Lo que
     arde (las llamas) se pinta vivo; aquí van los marcos y el carbón.
     Fase 2: la pila creció (cinco, cuatro y tres), encadenada, con dos
     vigas quemadas por cuernos. Fase 3: los fanales se fundieron en una
     sola masa, y la masa tiene cara. Fase 4: arde en frío: otra vez la
     pila, pero los marcos son cielo y en cada fanal quedó una estrella. */
  const COLORES_HOGUERA = { h: "#8a5a2a", H: "#5a3418", g: "#ffd070", G: "#c8902a", o: "#2a140a", r: "#c84a1a", k: "#3a2010" };
  const COLORES_HOGUERA_F = {
    2: { h: "#a43c1c", H: "#4c1612", g: "#ffd274", G: "#e2722c", o: "#1b0907", r: "#ff5c1c", k: "#5c1c12", y: "#fff2b4", c: "#0d0505" },
    3: { h: "#3c323a", H: "#19151d", g: "#fffaf0", G: "#ffb84c", o: "#070509", r: "#ff8c2c", k: "#251d25", y: "#ffe294", c: "#000000" },
    4: { h: "#5a6ee0", H: "#16225a", g: "#ffffff", G: "#8fd8ff", o: "#0c1434", r: "#0c1434", k: "#16225a", y: "#c8f0ff", c: "#0c1434", v: "#b48cff" }
  };
  COLORES_HOGUERA_F[5] = alba(COLORES_HOGUERA_F[4]);
  COLORES_HOGUERA_F[6] = vitral(COLORES_HOGUERA_F[4]);
  COLORES_HOGUERA_F[7] = dorado(COLORES_HOGUERA_F[4]);
  function hoguera(k, fase) {
    fase = fase || 1;
    const W = 60, H = 44, cx = 30, { c, x } = lienzoJefe(W, H, fase, fase >= 5 ? 12 : 8);
    if (!x) return c;
    const col = COLORES_HOGUERA_F[fase] || COLORES_HOGUERA;
    // Fase 5: los rayos, detrás (en la 6, el rosetón).
    if (fase === 5) rayos(x, cx, 20, 16, 40, 20, col.G, col.v);
    if (fase >= 6) roseton(x, cx, 20, 16, 40, 18);
    // Fases 2 y 3: vigas quemadas que salen del carbón (en la 3, cinco, en corona).
    if (fase >= 2) for (const [bx, px, py] of fase >= 3 ? [[-20, -27, -4], [-10, -13, -7], [0, 0, -8], [10, 13, -7], [20, 27, -4]] : [[-16, -29, -6], [16, 29, -6]]) {
      poligono(x, [[cx + bx - 2.2, 6], [cx + px - 0.8, py + 1], [cx + px + 1.2, py], [cx + bx + 2.2, 6]], col.H);
      if (fase === 4) estrella(x, cx + px, py + 0.6, 2.6, col.g); else elipse(x, cx + px, py + 0.6, 1.5, 1.5, fase >= 5 ? col.g : col.r);
    }
    // El carbón de abajo… que en la pantalla queda arriba: la Hoguera
    // está colgada del cielo y arde hacia el fanal.
    elipse(x, cx, 6, fase >= 2 ? 30 : 26, 6, col.o);
    elipse(x, cx, 7, fase >= 2 ? 25 : 22, 4, col.k);
    // Los fanales apilados, en pirámide (de tres, dos y uno).
    const marco = (fx, fy) => {
      poligono(x, [[fx - 5, fy], [fx + 5, fy], [fx + 5, fy + 10], [fx - 5, fy + 10]], col.H);
      poligono(x, [[fx - 4, fy + 1], [fx + 4, fy + 1], [fx + 4, fy + 9], [fx - 4, fy + 9]], col.r);
      trazo(x, [[fx, fy + 1], [fx, fy + 9]], col.h, 1);
      poligono(x, [[fx - 5, fy + 10], [fx + 5, fy + 10], [fx + 2, fy + 12], [fx - 2, fy + 12]], col.G);
      if (fase === 2) for (const s of [-1, 1]) elipse(x, fx + s * 2.2, fy + 5.6, 0.9, 2, col.y);   // adentro todavía hay llama
      if (fase === 4) estrella(x, fx, fy + 5, 3.2, (Math.round(fx + fy) & 1) ? col.y : col.v, col.g);   // adentro, una estrella
      if (fase >= 6) { const j = JOYAS[(Math.round(fx / 6) + Math.round(fy / 11)) & 3]; poligono(x, [[fx - 4, fy + 1], [fx + 4, fy + 1], [fx + 4, fy + 9], [fx - 4, fy + 9]], j); trazo(x, [[fx - 4, fy + 1], [fx + 4, fy + 9]], PLOMO, 0.7); elipse(x, fx - 1.6, fy + 3, 0.7, 1.3, BORDE_VITRAL); }   // cada fanal, un vidrio de color
      else if (fase === 5) { poligono(x, [[fx - 4, fy + 1], [fx + 4, fy + 1], [fx + 4, fy + 9], [fx - 4, fy + 9]], col.y); elipse(x, fx, fy + 5.6, 1.7, 3, col.G); elipse(x, fx, fy + 6.2, 0.9, 1.8, col.g); }   // todos encendidos, de día
    };
    if (fase >= 2) {
      for (const fx of [cx - 24, cx - 12, cx, cx + 12, cx + 24]) marco(fx, 8);
      for (const fx of [cx - 18, cx - 6, cx + 6, cx + 18]) marco(fx, 19);
      for (const fx of [cx - 12, cx, cx + 12]) marco(fx, 30);
    } else {
      for (const fx of [cx - 12, cx, cx + 12]) marco(fx, 8);
      for (const fx of [cx - 6, cx + 6]) marco(fx, 19);
      marco(cx, 30);
    }
    // Brasas entre los marcos.
    for (const [bx, by] of [[cx - 18, 12], [cx + 18, 12], [cx - 12, 22], [cx + 12, 22], [cx - 6, 33], [cx + 6, 33]]) elipse(x, bx, by, 1.6 + k * 0.4, 1.2, col.g);
    // Fase 2: las cadenas que la tienen junta.
    if (fase === 2) { puntos(x, [cx - 27, 10], [cx + 10, 40], 14, col.c, 0.8); puntos(x, [cx + 27, 10], [cx - 10, 40], 14, col.c, 0.8); }
    if (fase === 3) {
      // Fundida: una masa de escoria con dos cuencas caídas y una boca que
      // no se cierra, al blanco por dentro. No amenaza: llama.
      elipse(x, cx, 23, 24, 15.5, col.H);
      elipse(x, cx, 23, 22.4, 14, col.k);
      espejo(cx, (s, m) => {
        const o = m([10.5, 19]);
        elipse(x, o[0], o[1], 5.2, 3.6, col.r, s * 0.45);
        elipse(x, o[0], o[1] + 0.4, 3.8, 2.4, col.g, s * 0.45);
        poligono(x, [m([9.6, 21]), m([11.4, 21]), m([10.5, 27])], col.r);   // lo que le corre de las cuencas
      });
      elipse(x, cx, 31.5, 4.6, 5.8, col.r);
      elipse(x, cx, 31.9, 3.1, 4.2, col.g);
      elipse(x, cx, 32.6, 1.4, 2.2, col.y);
      // Lo que gotea.
      for (const [gx, largo] of [[-17, 7], [-9, 4], [9, 5], [17, 8]]) { poligono(x, [[cx + gx - 2, 36 - Math.abs(gx) * 0.25], [cx + gx + 2, 36 - Math.abs(gx) * 0.25], [cx + gx, 38 + largo]], col.k); elipse(x, cx + gx, 38 + largo, 1, 1.2 + k * 0.3, col.G); }
    }
    return acaba(c, col, fase);
  }

  /* La Luna: un disco de nácar en creciente (la parte en sombra tiene un
     ojo abierto) con alas de velo detrás, que se abren con `k`.
     Fase 2: luna de sangre, rajada, con los velos en jirones y los dos
     ojos abiertos. Fase 3: el eclipse: un disco negro con un anillo de luz
     y un solo ojo en el medio, y tres pares de velos.
     Fase 4: la luna nueva: un disco de cielo con el hilo de luz de un
     lado y una estrella-ojo en el hueco, y dos lunas chicas alrededor.
     `llena`: sin sombra (cuando hace de espejo, ver juego.js). */
  const COLORES_LUNA = { l: "#e8eef6", L: "#b8c4d6", s: "#7a88a0", S: "#3e4a62", o: "#1a2236", a: "#9ab0d8", A: "#5a6e98", e: "#fff8e8" };
  const COLORES_LUNA_F = {
    2: { l: "#f4b494", L: "#c45c4c", s: "#7c2c32", S: "#4c1622", o: "#1d070d", a: "#c85c5c", A: "#6c2232", e: "#ffea94", k: "#0d0307" },
    3: { l: "#fffaf0", L: "#ffd894", s: "#3c3c54", S: "#17172b", o: "#07070d", a: "#b8c8f0", A: "#4c5c8c", e: "#ffffff", k: "#000000", y: "#ffb84c" },
    4: { l: "#ffffff", L: "#8fd8ff", s: "#3c50b4", S: "#16225a", o: "#0c1434", a: "#16225a", A: "#0c1434", e: "#ffffff", k: "#0c1434", y: "#b48cff" }
  };
  COLORES_LUNA_F[5] = alba(COLORES_LUNA_F[4]);
  COLORES_LUNA_F[6] = vitral(COLORES_LUNA_F[4]);
  COLORES_LUNA_F[7] = dorado(COLORES_LUNA_F[4]);
  function luna(k, fase, llena) {
    fase = fase || 1;
    const W = 64, H = 50, cx = 32, cy = 24, { c, x } = lienzoJefe(W, H, fase, 8);
    if (!x) return c;
    const col = COLORES_LUNA_F[fase] || COLORES_LUNA, g = fase >= 2 ? 1.18 : 1;   // los velos, más grandes
    // Fase 3: un tercer par de velos, hacia arriba.
    if (fase >= 3) espejo(cx, s => {
      elipse(x, cx + s * (11 + 5 * k), cy - 17, 6 + 5 * k, 9, col.A, s * 1.05);
      elipse(x, cx + s * (10.5 + 5 * k), cy - 16, 4 + 4 * k, 6.4, col.a, s * 1.05);
    });
    // Las alas de velo, detrás del disco.
    espejo(cx, s => {
      elipse(x, cx + s * (15 + 6 * k) * g, cy - 2, (9 + 9 * k) * g, 11 * g, col.A, s * 0.55);
      elipse(x, cx + s * (14 + 6 * k) * g, cy - 1, (6 + 7 * k) * g, 8 * g, col.a, s * 0.55);
      elipse(x, cx + s * (12 + 3 * k) * g, cy + 13 * g, (5 + 3 * k) * g, 6 * g, col.A, -s * 0.4);
      // Fase 2: los velos, en jirones.
      if (fase === 2) corta(x, () => { for (const [dx, dy] of [[34, -9], [36, 0], [33, 8], [24, 21]]) poligono(x, [[cx + s * (dx * k + 4), cy + dy - 2.2], [cx + s * (dx - 9) * k, cy + dy], [cx + s * (dx * k + 4), cy + dy + 2.2]], "#000"); });
    });
    if (fase >= 6) {
      // La luna de vidrio: un rosetón entero detrás, el disco de piezas de
      // color (lo llena `vidria`), el creciente de luz y un ojo de plomo.
      roseton(x, cx, cy, 16, 27, 16);
      elipse(x, cx, cy, 17.2, 17.2, col.L);
      elipse(x, cx, cy, 16, 16, col.o);
      if (!llena) { x.save(); x.beginPath(); x.ellipse(cx, cy, 16, 16, 0, 0, Math.PI * 2); x.clip(); elipse(x, cx - 6, cy, 15.5, 16.5, col.l); elipse(x, cx + 2, cy, 15.5, 16.5, col.o); x.restore(); }
      else elipse(x, cx, cy, 15, 15, col.l);
      elipse(x, cx + 4, cy - 1, 4.2, 3, BORDE_VITRAL); elipse(x, cx + 4, cy - 1, 1.3, 2.6, PLOMO);
      for (const [dx, dy] of [[-12, -7], [-13, 6]]) roseta(x, cx + dx, cy + dy, 2.6);
      return acaba(c, col, fase);
    }
    if (fase === 5) {
      // La luna de día: pálida y entera, con el sol asomando por detrás (su
      // borde de oro y sus rayos) y un ojo abierto.
      rayos(x, cx - 4, cy - 4, 15, 26, 12, col.L, col.y, Math.PI * 0.75, Math.PI * 1.75);
      elipse(x, cx - 2.2, cy - 2.2, 17.4, 17.4, col.L);
      elipse(x, cx, cy, 16.4, 16.4, col.s);
      elipse(x, cx, cy, 15.4, 15.4, col.l);
      if (!llena) { x.save(); x.beginPath(); x.ellipse(cx, cy, 15.4, 15.4, 0, 0, Math.PI * 2); x.clip(); elipse(x, cx + 11, cy + 3, 13, 15, col.o); x.restore(); }
      for (const [dx, dy, r] of [[-8, -6, 2.6], [-4, 7, 2.8], [-11, 3, 1.6]]) elipse(x, cx + dx, cy + dy, r, r * 0.8, col.L);
      elipse(x, cx + 5, cy - 2, 3.4, 2.6, col.e); elipse(x, cx + 5, cy - 2, 1.2, 2.2, col.s);
      trazo(x, [[cx - 10, cy - 1], [cx - 7, cy + 1], [cx - 4, cy - 1]], col.s, 1);
      return acaba(c, col, fase);
    }
    if (fase === 4) {
      // La luna nueva: el aro, el disco de cielo y, de un lado, el hilo de luz.
      for (const [dx, dy, r] of [[-25, 15, 2.4], [26, -15, 1.7]]) { elipse(x, cx + dx, cy + dy, r + 0.9, r + 0.9, col.L); elipse(x, cx + dx, cy + dy, r, r, col.l); }
      elipse(x, cx, cy, 17.2, 17.2, col.L);
      elipse(x, cx, cy, 16, 16, llena ? col.l : col.o);
      if (!llena) {
        x.save(); x.beginPath(); x.ellipse(cx, cy, 16, 16, 0, 0, Math.PI * 2); x.clip();
        elipse(x, cx, cy, 16, 16, col.l);
        elipse(x, cx + 5.5, cy - 1, 15.5, 16, col.o);
        x.restore();
      }
      // La estrella que lleva en brazos, con su ojo.
      estrella(x, cx + 4, cy, 8.5, llena ? col.S : col.l, col.y);
      elipse(x, cx + 4, cy, 0.8, 2.3, col.k);
      return acaba(c, col, fase);
    }
    if (fase >= 3) {
      // El eclipse: la corona, el anillo y el disco negro, con un ojo solo.
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + 0.2, r1 = i % 2 ? 21.5 : 19.5; poligono(x, [[cx + Math.cos(a - 0.13) * 16, cy + Math.sin(a - 0.13) * 16], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], [cx + Math.cos(a + 0.13) * 16, cy + Math.sin(a + 0.13) * 16]], col.L); }
      elipse(x, cx, cy, 17.4, 17.4, col.L);
      elipse(x, cx, cy, 16.2, 16.2, col.l);
      elipse(x, cx, cy, 14.4, 14.4, llena ? col.l : col.o);
      if (!llena) elipse(x, cx - 3, cy - 3, 9, 9, col.S);
      elipse(x, cx, cy, 10, 5.6, llena ? col.S : col.l);
      elipse(x, cx, cy, 9, 4.6, col.e);
      elipse(x, cx, cy, 4.4, 4.5, col.y);
      elipse(x, cx, cy, 1.5, 4.2, col.k);
      elipse(x, cx - 1.6, cy - 1.8, 0.9, 0.9, col.e);
      return cuantiza(c, Object.values(col));
    }
    // El disco y su borde.
    elipse(x, cx, cy, 17, 17, col.L);
    elipse(x, cx, cy, 15.5, 15.5, col.l);
    // La sombra: un creciente (recortado dentro del disco).
    if (!llena) {
      x.save(); x.beginPath(); x.ellipse(cx, cy, 15.5, 15.5, 0, 0, Math.PI * 2); x.clip();
      elipse(x, cx + 10, cy - 3, 14, 15, col.S);
      elipse(x, cx + 12, cy - 4, 11, 12, col.o);
      x.restore();
    }
    // Cráteres en la parte iluminada.
    elipse(x, cx - 8, cy - 6, 2.6, 2.1, col.L);
    elipse(x, cx - 4, cy + 7, 3, 2.3, col.L);
    elipse(x, cx - 11, cy + 3, 1.7, 1.4, col.s);
    elipse(x, cx - 2, cy - 11, 1.4, 1.1, col.s);
    if (llena) { elipse(x, cx + 8, cy + 5, 2.8, 2.2, col.L); elipse(x, cx + 10, cy - 8, 1.8, 1.5, col.s); }
    if (fase >= 2) {
      // Rajada: dos grietas que bajan por lo iluminado.
      trazo(x, [[cx - 13, cy - 9], [cx - 8.5, cy - 3], [cx - 12, cy + 2], [cx - 6, cy + 6.5], [cx - 8, cy + 13]], col.S, 1);
      trazo(x, [[cx - 8.5, cy - 3], [cx - 3, cy - 5], [cx - 1, cy - 1]], col.S, 0.9);
      // Los dos ojos, abiertos: el de la sombra con la pupila rasgada.
      elipse(x, cx - 7, cy, 2.6, 1.8, col.S); elipse(x, cx - 7, cy, 1, 1, col.e);
      elipse(x, cx + 6, cy - 2, 3.4, 2.6, col.e); elipse(x, cx + 6, cy - 2, 0.9, 2.4, col.k);
    } else {
      // El ojo dormido del lado claro y el abierto del lado oscuro.
      trazo(x, [[cx - 10, cy - 1], [cx - 7, cy + 1], [cx - 4, cy - 1]], col.S, 1);
      elipse(x, cx + 6, cy - 2, 2, 1.5, llena ? col.S : col.e);
    }
    return acaba(c, col, fase);
  }

  /* Una de las Siete Hermanas: una estrella de cuatro puntas con su núcleo.
     Las veladas (que no reciben daño) se pintan apagadas.
     Fase 2: ocho puntas, de brasa. Fase 3: una estrella azul con el núcleo
     negro, dentro de un anillo. Fase 4: fría y fija, con dos rayos largos
     y cuatro astros chicos alrededor. */
  const COLORES_HERMANA = { w: "#fffaf0", y: "#ffe6a0", o: "#ffb84a", v: "#b08ae0", V: "#5a4a98" };
  const COLORES_VELADA = { w: "#8a80a8", y: "#5a5078", o: "#3a3058", v: "#2e2448", V: "#1a1430" };
  const COLORES_HERMANA_F = {
    2: { w: "#fff2d2", y: "#ffb264", o: "#ff5c3c", v: "#b42c3c", V: "#5c1222" },
    3: { w: "#ffffff", y: "#d8e8ff", o: "#111121", v: "#8cb2ff", V: "#3c4c9a" },
    4: { w: "#ffffff", y: "#c8f0ff", o: "#b48cff", v: "#8fd8ff", V: "#5a6ee0" }
  };
  COLORES_HERMANA_F[5] = alba(COLORES_HERMANA_F[4]);
  COLORES_HERMANA_F[6] = { w: "#ffffff", y: "#fff6d8", o: "#ff4c9c", v: "#5cf0d8", V: "#8c5cff", p: "#ffc83c" };
  COLORES_HERMANA_F[7] = { w: "#ffffff", y: "#fff0b0", o: "#120a0e", v: "#ffd070", V: "#7a4818", p: "#e8a83c" };
  /* Los colores de una hermana velada en las fases 2 y 3: los suyos, casi apagados. */
  function velo(col) { const out = {}; for (const q in col) out[q] = mezcla(col[q], "#1a1430", 0.68); return out; }
  function hermana(k, fase, velada) {
    fase = fase || 1;
    const W = 15, H = 15, cx = 7.5, { c, x } = lienzoJefe(W, H, fase, 3);
    if (!x) return c;
    const base = COLORES_HERMANA_F[fase] || COLORES_HERMANA, col = velada ? (fase >= 2 ? velo(base) : COLORES_VELADA) : base;
    const L = 6.8 - k, l = 1.6;
    // Fase 3: el anillo.
    if (fase === 3) { x.strokeStyle = col.v; x.lineWidth = 1.1; x.beginPath(); x.arc(cx, cx, 7.6 - k * 0.5, 0, Math.PI * 2); x.stroke(); }
    // Fase 4: dos rayos largos y finos, y cuatro astros chicos en diagonal.
    if (fase === 4) {
      trazo(x, [[cx - 9.5, cx], [cx + 9.5, cx]], col.V, 0.7); trazo(x, [[cx, cx - 9.5], [cx, cx + 9.5]], col.V, 0.7);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) elipse(x, cx + sx * (5.6 + k * 0.4), cx + sy * (5.6 + k * 0.4), 0.8, 0.8, col.o);
    }
    // Fase 6: una gema tallada detrás, de seis caras.
    if (fase >= 6) { const r = 6.4 - k * 0.3, hx = i => [cx + Math.cos(i * Math.PI / 3 + Math.PI / 6) * r, cx + Math.sin(i * Math.PI / 3 + Math.PI / 6) * r]; poligono(x, [0, 1, 2, 3, 4, 5].map(hx), col.V); for (let i = 0; i < 6; i += 2) poligono(x, [[cx, cx], hx(i), hx(i + 1)], col.p); }
    // Fase 2: cuatro puntas más, en diagonal (en la 5 vuelven, de oro).
    if (fase === 2 || fase === 5) { const d = (L + 1.6) * 0.62, q = 1.3; poligono(x, [[cx - d, cx - d], [cx, cx - q], [cx + d, cx - d], [cx + q, cx], [cx + d, cx + d], [cx, cx + q], [cx - d, cx + d], [cx - q, cx]], col.V); }
    poligono(x, [[cx, cx - L - 0.5], [cx + l, cx - l], [cx + L + 0.5, cx], [cx + l, cx + l], [cx, cx + L + 0.5], [cx - l, cx + l], [cx - L - 0.5, cx], [cx - l, cx - l]], col.v);
    poligono(x, [[cx, cx - L + 1], [cx + 1, cx - 1], [cx + L - 1, cx], [cx + 1, cx + 1], [cx, cx + L - 1], [cx - 1, cx + 1], [cx - L + 1, cx], [cx - 1, cx - 1]], col.y);
    elipse(x, cx, cx, 2.6, 2.6, col.o);
    elipse(x, cx, cx, fase >= 3 ? 1 : 1.6, fase >= 3 ? 1 : 1.6, col.w);
    return cuantiza(c, Object.values(col));
  }

  /* El Sol: un disco de fuego con cara, y una corona de lenguas cortas que
     cambia con `k` (los rayos largos se pintan vivos en el juego).
     Fase 2: una gigante roja, con manchas, las lenguas torcidas y la boca
     abierta. Fase 3: un sol negro con el borde al blanco, y alrededor los
     montantes y las tapas de un fanal: lo que siempre fue. Fase 4: lo que
     queda encendido: una estrella blanca y azul, de ocho agujas, con los
     ojos cerrados y el aro del fanal girándole alrededor. */
  const COLORES_SOL = { r: "#c84a1a", o: "#ff9a3c", y: "#ffd070", g: "#fff0b0", w: "#fffaf0", e: "#7a2a10" };
  const COLORES_SOL_F = {
    2: { r: "#8c1c16", o: "#e24c1e", y: "#ff9c3e", g: "#ffd274", w: "#fff2b4", e: "#3c0c0a", k: "#1b0505" },
    3: { r: "#ffd274", o: "#fff2b4", y: "#1b1521", g: "#0d0b13", w: "#07060b", e: "#fffaf0", k: "#000000", h: "#b08c52", H: "#5e4428" },
    4: { r: "#5a6ee0", o: "#8fd8ff", y: "#c8f0ff", g: "#ffffff", w: "#ffffff", e: "#3c50b4", k: "#16225a", h: "#b48cff", H: "#3c50b4" }
  };
  COLORES_SOL_F[5] = alba(COLORES_SOL_F[4]);
  function sol(k, fase) {
    fase = fase || 1;
    const W = 64, H = 64, cx = 32, cy = 32, { c, x } = lienzoJefe(W, H, fase, 9);
    if (!x) return c;
    const col = COLORES_SOL_F[fase] || COLORES_SOL;
    // La corona: doce lenguas, alternando largas y cortas (dieciséis torcidas
    // en la fase 2; veinticuatro agujas en la 3).
    if (fase >= 7) return solDeOro(k);
    if (fase >= 6) return solDeVidrio(k);
    const n = fase >= 5 ? 16 : fase === 4 ? 8 : fase === 3 ? 24 : fase === 2 ? 16 : 12;
    // Fase 4: el aro, por detrás.
    if (fase === 4) { x.strokeStyle = col.h; x.lineWidth = 1.3; x.beginPath(); x.ellipse(cx, cy, 31, 8.5, -0.32, 0, Math.PI * 2); x.stroke(); }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (fase === 4 ? 0 : (k % 2) * 0.13), ab = fase >= 5 ? 0.15 : fase === 4 ? 0.1 : fase === 3 ? 0.07 : fase === 2 ? 0.14 : 0.16;
      const largo = (fase >= 5 ? (i % 2 ? 29 : 38) : fase === 4 ? (i % 2 ? 28 : 37.5) : fase === 3 ? (i % 2 ? 27 : 37) : fase === 2 ? (i % 2 ? 27 : 34) : (i % 2 ? 26 : 29)) + k * 1.2, tuerce = fase === 2 ? 0.2 : 0;
      poligono(x, [[cx + Math.cos(a - ab) * 19, cy + Math.sin(a - ab) * 19], [cx + Math.cos(a + tuerce) * largo, cy + Math.sin(a + tuerce) * largo], [cx + Math.cos(a + ab) * 19, cy + Math.sin(a + ab) * 19]], i % 2 ? col.r : col.o);
    }
    // El disco en anillos.
    elipse(x, cx, cy, 21, 21, col.r);
    elipse(x, cx, cy, 19.5, 19.5, col.o);
    elipse(x, cx, cy, fase >= 3 ? 17.6 : 16, fase >= 3 ? 17.6 : 16, col.y);
    elipse(x, cx - 2, cy - 2, 11, 11, col.g);
    elipse(x, cx - 4, cy - 4, 5, 5, col.w);
    if (fase >= 5) {
      // Amaneció: los ojos bien abiertos, las mejillas encendidas y, por una vez, una sonrisa.
      for (const s of [-1, 1]) {
        elipse(x, cx + s * 7.5, cy - 3.5, 3.9, 3.3, col.e); elipse(x, cx + s * 7.5, cy - 3.5, 3, 2.4, col.w); elipse(x, cx + s * 7.5, cy - 3.2, 1.3, 1.5, col.e);
        elipse(x, cx + s * 12.5, cy + 4.5, 2.6, 1.7, col.h);
      }
      trazo(x, [[cx - 7, cy + 7], [cx - 3.5, cy + 10], [cx + 3.5, cy + 10], [cx + 7, cy + 7]], col.e, 1.6);
      return cuantiza(c, Object.values(col));
    }
    if (fase === 4) {
      // El aro, por delante (media vuelta), dos astros que lo recorren y los ojos cerrados.
      x.strokeStyle = col.h; x.lineWidth = 1.3; x.beginPath(); x.ellipse(cx, cy, 31, 8.5, -0.32, 0.1, Math.PI - 0.1); x.stroke();
      for (const s of [-1, 1]) { const a = k * 0.5 + (s > 0 ? 0.6 : 3.7), px = Math.cos(a) * 31, py = Math.sin(a) * 8.5; estrella(x, cx + px * Math.cos(-0.32) - py * Math.sin(-0.32), cy + px * Math.sin(-0.32) + py * Math.cos(-0.32), 2.2, col.g); }
      for (const s of [-1, 1]) trazo(x, [[cx + s * 10.5, cy - 4], [cx + s * 7.5, cy - 2.2], [cx + s * 4.5, cy - 4]], col.e, 1.3);
      trazo(x, [[cx - 3, cy + 8], [cx + 3, cy + 8]], col.e, 1.2);
      return cuantiza(c, Object.values(col));
    }
    if (fase >= 3) {
      // El fanal alrededor: tapa, montantes y remate. Adentro, la mecha.
      for (const s of [-1, 1]) trazo(x, [[cx + s * 6, cy - 21], [cx + s * 13, cy - 11], [cx + s * 15.5, cy], [cx + s * 13, cy + 11], [cx + s * 6, cy + 21]], col.H, 1.4);
      trazo(x, [[cx, cy - 21], [cx, cy - 8]], col.H, 1.2);
      poligono(x, [[cx - 9, cy - 26], [cx + 9, cy - 26], [cx + 6.5, cy - 21], [cx - 6.5, cy - 21]], col.h);
      poligono(x, [[cx - 6.5, cy + 21], [cx + 6.5, cy + 21], [cx + 9, cy + 26], [cx - 9, cy + 26]], col.h);
      x.strokeStyle = col.h; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy - 29.5, 3.4, 0, Math.PI * 2); x.stroke();
      trazo(x, [[cx, cy + 21], [cx, cy + 9]], col.h, 1.4);
      elipse(x, cx, cy + 6 - k * 0.5, 2.2, 3.6 + k * 0.4, col.r);
      elipse(x, cx, cy + 6.6 - k * 0.5, 1.1, 2.2, col.e);
      // Dos ojos, que ya no entorna.
      for (const s of [-1, 1]) { elipse(x, cx + s * 7.5, cy - 4, 3.2, 1.7, col.e); elipse(x, cx + s * 7.5, cy - 4, 0.8, 1.7, col.k); }
      return cuantiza(c, Object.values(col));
    }
    if (fase === 2) {
      // Manchas, el ceño y la boca abierta.
      for (const [mx, my, rx, ry] of [[9, 3, 3.2, 2.2], [-11, 8, 2.2, 1.7], [2, -12, 2.6, 1.6], [13, -7, 1.6, 1.3]]) { elipse(x, cx + mx, cy + my, rx, ry, col.e); elipse(x, cx + mx, cy + my, rx * 0.5, ry * 0.5, col.k); }
      for (const s of [-1, 1]) { trazo(x, [[cx + s * 11.5, cy - 8], [cx + s * 3.5, cy - 4.4]], col.e, 1.8); elipse(x, cx + s * 7, cy - 2.2, 2.4, 1.5, col.w); elipse(x, cx + s * 6.6, cy - 2.2, 0.9, 1.3, col.k); }
      elipse(x, cx, cy + 9, 5.6, 3.2 + k * 0.6, col.e);
      elipse(x, cx, cy + 9.4, 3.4, 1.6 + k * 0.4, col.k);
      return cuantiza(c, Object.values(col));
    }
    // La cara: dos ojos entornados y una boca que no sonríe.
    trazo(x, [[cx - 10, cy - 3], [cx - 7, cy - 5], [cx - 4, cy - 3]], col.e, 1.4);
    trazo(x, [[cx + 4, cy - 3], [cx + 7, cy - 5], [cx + 10, cy - 3]], col.e, 1.4);
    trazo(x, [[cx - 6, cy + 8], [cx, cy + 6 + k * 0.6], [cx + 6, cy + 8]], col.e, 1.4);
    return cuantiza(c, Object.values(col));
  }

  /* El Sol de la fase 6: una corona de vidrio (un rosetón de doce), el
     disco hecho vitral (lo llena `vidria`) y la cara: un ojo grande detrás
     de una lupa, con su mango. «Te mira a través de una lupa.» */
  const COLORES_SOL_6 = { r: "#c8284c", o: "#ffc83c", y: "#16225a", w: "#ffffff", e: PLOMO, h: "#5cf0d8", H: "#2c4cc8", g: BORDE_VITRAL };
  function solDeVidrio(k) {
    const W = 64, H = 64, cx = 32, cy = 32, { c, x } = lienzoJefe(W, H, 6, 9);
    if (!x) return c;
    const col = COLORES_SOL_6;
    roseton(x, cx, cy, 19, 37 + k * 1.2, 12, (k % 2) * 0.13, Math.PI * 2 + (k % 2) * 0.13);
    elipse(x, cx, cy, 21, 21, col.r);
    elipse(x, cx, cy, 19.5, 19.5, col.o);
    elipse(x, cx, cy, 17.6, 17.6, col.y);
    // Los ojos: el de la izquierda, chico; el de la derecha, grande detrás de la lupa.
    elipse(x, cx - 7.5, cy - 3.5, 3, 2.3, col.w); elipse(x, cx - 7.5, cy - 3.3, 1.1, 1.5, col.e);
    elipse(x, cx + 7, cy - 4, 6.8, 6.8, col.h); elipse(x, cx + 7, cy - 4, 5.6, 5.6, col.y);
    elipse(x, cx + 7, cy - 4, 4.6, 3.8, col.w); elipse(x, cx + 7, cy - 3.6, 2, 2.6, col.e); elipse(x, cx + 5.4, cy - 5.6, 0.9, 0.9, col.g);
    trazo(x, [[cx + 11.5, cy + 1], [cx + 17, cy + 8]], col.H, 2.2);
    trazo(x, [[cx - 6, cy + 8], [cx, cy + 10], [cx + 5, cy + 8.5]], col.e, 1.3);
    return acaba(c, col, 6);
  }

  /* El Sol de la fase 7: una aureola de pan de oro, el disco de laca rota
     y cosida con oro (lo llena `dora`) y la cara en paz: los ojos cerrados,
     dos medialunas de oro, y la costura más grande cruzándole la cara. */
  const COLORES_SOL_7 = { r: "#b87828", o: "#ffd070", y: "#16225a", w: "#fff0b0", e: LACA, h: VETA, g: BORDE_ORO };
  function solDeOro(k) {
    const W = 64, H = 64, cx = 32, cy = 32, { c, x } = lienzoJefe(W, H, 7, 9);
    if (!x) return c;
    const col = COLORES_SOL_7;
    roseton(x, cx, cy, 19, 37 + k * 1.2, 14, (k % 2) * 0.11, Math.PI * 2 + (k % 2) * 0.11);
    elipse(x, cx, cy, 21, 21, col.r);
    elipse(x, cx, cy, 19.5, 19.5, col.o);
    elipse(x, cx, cy, 17.6, 17.6, col.y);
    // Los ojos cerrados y, debajo, una lágrima de oro.
    for (const s of [-1, 1]) {
      trazo(x, [[cx + s * 11.5, cy - 4.5], [cx + s * 7.5, cy - 1.4], [cx + s * 3.5, cy - 4.5]], col.w, 2);
      elipse(x, cx + s * 7.5, cy + 2.6, 1.1, 1.6, col.w);
    }
    // La costura: de la frente a la barbilla, torcida.
    trazo(x, [[cx - 13, cy - 13], [cx - 6, cy - 7], [cx - 1, cy + 1], [cx + 5, cy + 5], [cx + 12, cy + 14]], col.h, 1.3);
    trazo(x, [[cx - 6, cy - 7], [cx - 9, cy + 2]], col.h, 0.9);
    trazo(x, [[cx - 4.5, cy + 9], [cx, cy + 11], [cx + 4.5, cy + 9]], col.w, 1.6);
    // Menos vetas que los demás: el disco es grande y la cara se perdía entre ellas.
    return dora(cuantiza(c, paletaDe(col, 7)), 600);
  }

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
      fanal(alba, blanco, evo) {
        const t = alba ? 0 : Math.max(0, Math.min(4, evo || 0));
        return toma("f" + (alba ? "a" : "") + (blanco ? "w" : "") + t, () => {
          const c = pintaTexto(FANAL_EVO[t], alba ? PALETA_ALBA : PALETAS_FANAL[t], !!alba); // el Alba viene volteada: es tu reflejo
          return blanco ? silueta(c) : c;
        });
      },
      /* Los fanales presos en la Hoguera (y los que suelta). */
      fanalito(blanco) {
        return toma("fi" + (blanco ? "w" : ""), () => { const c = pintaTexto(FANALITO, PALETAS_FANAL[1], false); return blanco ? silueta(c) : c; });
      },
      /* Los jefes. `fase` (1, 2 o 3) elige el modelo: ver «Jefes». */
      casco(cuadro, blanco, fase) {
        return toma("jc" + (cuadro & 1) + (fase || 1) + (blanco ? "w" : ""), () => { const c = casco(cuadro & 1 ? 1.5 : 0, fase); return blanco ? silueta(c) : c; });
      },
      crisalida(cuadro, blanco, fase) {
        return toma("jq" + (cuadro % 3) + (fase || 1) + (blanco ? "w" : ""), () => { const c = crisalida([0, 0.8, 1.4][cuadro % 3], fase); return blanco ? silueta(c) : c; });
      },
      imago(cuadro, blanco, fase) {
        return toma("ji" + (cuadro % 3) + (fase || 1) + (blanco ? "w" : ""), () => { const c = imago([1, 0.86, 0.72][cuadro % 3], fase); return blanco ? silueta(c) : c; });
      },
      hoguera(cuadro, blanco, fase) {
        return toma("jh" + (cuadro % 3) + (fase || 1) + (blanco ? "w" : ""), () => { const c = hoguera(cuadro % 3, fase); return blanco ? silueta(c) : c; });
      },
      nodriza(cuadro, blanco, fase) {
        return toma("jn" + (cuadro % 3) + (fase || 1) + (blanco ? "w" : ""), () => { const c = nodriza([1, 0.86, 0.72][cuadro % 3], fase); return blanco ? silueta(c) : c; });
      },
      /* `llena`: la Luna sin su sombra (cuando hace de espejo). */
      luna(cuadro, blanco, fase, llena) {
        return toma("jl" + (cuadro % 3) + (fase || 1) + (llena ? "L" : "") + (blanco ? "w" : ""), () => { const c = luna([1, 0.85, 0.7][cuadro % 3], fase, llena); return blanco ? silueta(c) : c; });
      },
      hermana(cuadro, velada, blanco, fase) {
        return toma("jk" + (cuadro & 1) + (fase || 1) + (velada ? "v" : "") + (blanco ? "w" : ""), () => { const c = hermana(cuadro & 1 ? 1.4 : 0, fase, velada); return blanco ? silueta(c) : c; });
      },
      sol(cuadro, blanco, fase) {
        return toma("js" + (cuadro % 3) + (fase || 1) + (blanco ? "w" : ""), () => { const c = sol(cuadro % 3, fase); return blanco ? silueta(c) : c; });
      },
      faro(blanco, fase) {
        return toma("jf" + (fase || 1) + (blanco ? "w" : ""), () => { const c = faro(fase); return blanco ? silueta(c) : c; });
      },
      esfinge(cuadro, blanco, fase) {
        return toma("je" + (cuadro % 3) + (fase || 1) + (blanco ? "w" : ""), () => { const c = esfinge([1, 0.9, 0.8][cuadro % 3], fase); return blanco ? silueta(c) : c; });
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
    FANAL_EVO, PALETAS_FANAL, FANALITO, COLORES_CASCO, COLORES_CRISALIDA, COLORES_HOGUERA, COLORES_LUNA, COLORES_HERMANA, COLORES_SOL, ESCALA_FASE,
    rgb, hex, mezcla, paletaPolilla, lienzo, pintaTexto, silueta, cuantiza, crearBanco, naufragio
  };
});
