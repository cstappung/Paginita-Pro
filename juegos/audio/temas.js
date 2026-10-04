/* El cancionero de los juegos — texto que `Chip.Reproductor` sabe tocar.
 *
 * Está aparte del motor por lo mismo que una partitura está aparte del piano:
 * lo carga el vestíbulo (dentro del paquete), Mina Club, Snake Club y
 * Circuit Breakers (con un <script> cada uno), y los cuatro tienen que tocar
 * la misma música. Un tema por juego, cada uno en su tonalidad, su tempo y su
 * timbre, para que al cambiar de juego se note que se ha cambiado de sitio:
 *
 *   orbita     Mi menor, 112 — pulso 25 % con eco, espacial.
 *   cartas     La hirajoshi, 144 — escala japonesa sobre tambores taiko.
 *   cuadritos  Do mayor, 132 con swing — el tema de cuadernillo alegre.
 *   reversi    Re menor, 120 — pulso fino (12 %), casi de clavecín.
 *   cadena     Fa# menor, 138 — arpegios que suben como la cadena, con eco.
 *   minas      Sol menor, 116 — staccato nervioso; las capas entran con el avance.
 *   catan      Re mayor, 116 con swing — tonada de puerto, el bajo como tambor de marcha.
 *   snake      Do dórico, 150 — funk: bajo con octavas y caja a contratiempo.
 *   bbtan      Do mayor, 142 — arcade saltarín: bajo que rebota en octavas.
 *   sudoku     Mi mayor, 134 — arcade de cuadrícula: la melodía va en grupos
 *              de tres notas, como las cajas de 3×3; el clímax sube un tono.
 *   worms-menu / worms-combate  Mi mayor tranquilo y Si menor de batalla.
 *
 * Y los que no son de ningún juego, para el reproductor de la cabecera:
 *
 *   lofi        Fa menor, 86 con swing — lo-fi con 808, estilo Schedule I.
 *   sobrecarga  Mi menor, 172 — drum'n'bass de consola.
 *   tormenta    Re menor, 152 — combate final con tambores y sierra doble.
 *   neon        La menor, 104 — synthwave, arpegio de sierra filtrada.
 *   pulso       Sol menor, 126 — techno con bombeo.
 *   cumbia      La menor, 100 — cumbia de 8 bits con güiro.
 *   laboratorio Sol menor, 140 — hip-hop de medio tiempo, estilo Schedule I.
 *   reparto     Re menor, 122 — deep house con bombeo, estilo Schedule I.
 *   bossa, surf, oeste, mazmorra, celta, turbo, reggae, aurora — ocho estilos más.
 *
 * Y los homenajes a Pokémon Rojo Fuego / Verde Hoja (`pk-*`), con melodías
 * propias al estilo de la GBA: pueblo, ruta, centro, bosque, bici, salvaje,
 * entrenador y gimnasio.
 *
 * Los bajos y los arpegios no se escriben nota a nota: salen de la lista de
 * acordes con `linea` y `arpegio`, así que cambiar la armonía de un compás es
 * cambiar una palabra y no dieciséis fichas.
 */
(function (root) {
  "use strict";

  const TONOS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  /** Nota MIDI de la fundamental de un acorde («C#m7» → Do#), en la octava dada. */
  function raiz(nombre, oct) {
    const m = /^([A-G])([#b]?)/.exec(nombre);
    if (!m) return null;
    return 12 * (oct + 1) + TONOS[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  }

  /* Un compás puede llevar dos acordes separados por coma («Cmaj7,B7»):
     cada uno se queda con su parte del compás. */
  function trozos(compas, figura) {
    const partes = compas.split(","), n = figura.length / partes.length;
    return partes.map((a, i) => [a, figura.slice(i * n, (i + 1) * n)]);
  }
  const fichas = s => String(s).trim().split(/\s+/);

  /**
   * Una línea de bajo a partir de los acordes y de una figura de 16 fichas:
   * R fundamental, O su octava, F la quinta, Q la cuarta por debajo (la
   * quinta de abajo), - mantener y . silencio. Devuelve midi numérico.
   */
  function linea(acordes, figura, oct) {
    const fig = fichas(figura), out = [];
    for (const compas of fichas(acordes))
      for (const [a, trozo] of trozos(compas, fig)) {
        const r = raiz(a, oct == null ? 2 : oct);
        for (const f of trozo)
          out.push(f === "R" ? r : f === "O" ? r + 12 : f === "F" ? r + 7 : f === "Q" ? r - 5 : f);
      }
    return out.join(" ");
  }

  /** Arpegios: el acorde de cada compás repetido cada `cada` pasos. */
  function arpegio(acordes, cada) {
    const out = [];
    for (const compas of fichas(acordes)) {
      const partes = compas.split(","), n = 16 / partes.length;
      for (const a of partes) for (let i = 0; i < n; i += cada) out.push(a + "*" + Math.min(cada, n - i));
    }
    return out.join(" ");
  }

  /** Una sección: acordes + melodía + figura de bajo + batería de un compás. */
  function sec(acordes, lead, bajo, bat, arpCada) {
    return { lead, bajo: linea(acordes, bajo), arp: arpegio(acordes, arpCada || 4), bat };
  }

  const T = {};

  T.orbita = {
    bpm: 112,
    lead: { onda: "p25", vol: .15, vib: .008, eco: { fb: .38, mezcla: .32 } },
    bajo: { onda: "tri" }, arp: { onda: "p12", vol: .06, oct: 4, paso: .05 }, bat: { vol: .3 },
    secciones: {
      I: sec("Em Cmaj7", "", "R - - - . . R - F - - - O - F -", "k.......k.......", 2),
      A: sec("Em Cmaj7 Am7 B7",
        "B4*4 E5*2 F#5*2 G5*6 F#5*2 E5*4 D5*2 E5*2 B4*8 C5*2 D5*2 E5*4 G5*2 A5*2 G5*4 F#5*6 D#5*2 B4*8",
        "R - - - . . R - F - - - O - F -", "k...h...s...h..h", 2),
      B: sec("G D Em Cmaj7,B7",
        "D5*2 G5*2 B5*4 A5*2 G5*2 D5*4 F#5*4 E5*2 D5*2 A5*8 G5*2 F#5*2 E5*2 B4*2 E5*4 G5*4 E5*4 D#5*4 F#5*8",
        "R - . R F - . F O - . O F - R -", "k.h.s.h.k.h.s.hx", 2)
    },
    orden: "I A A B B A"
  };

  T.cartas = {
    bpm: 144,
    lead: { onda: "p25", vol: .15, vib: .012 },
    bajo: { onda: "tri", vol: .22 }, arp: { onda: "p12", vol: .05, oct: 4, paso: .035 }, bat: { vol: .4 },
    secciones: {
      A: sec("Am F E Am",
        "A5*2 E5 F5 E5*2 C5*2 B4*2 C5 B4 A4*4 F4*2 A4*2 C5*2 E5*2 F5*6 E5*2 E5*2 F5 E5 B4*2 C5*2 B4*4 G#4*4 A4*2 B4*2 C5*2 E5*2 A5*8",
        "R . . R . . R . F . . F . . R .", "t..t..T.t.t.T.s.", 8),
      B: sec("Dm Am Dm E",
        "D5*2 F5*2 A5*4 F5*2 E5*2 D5*4 C5*2 E5*2 A5*2 B5*2 C6*4 B5*4 A5*2 F5*2 D5*2 F5*2 E5*2 D5*2 C5*2 B4*2 B4*2 C5*2 B4*2 G#4*2 E4*8",
        "R . R . F . R . O . F . R . F .", "T..t..T.t.T.T.sx", 4)
    },
    orden: "A A B A"
  };

  T.cuadritos = {
    bpm: 132, swing: .16,
    lead: { onda: "p50", vol: .13, vib: .005 },
    bajo: { onda: "tri" }, arp: { onda: "p25", vol: .05, oct: 4, paso: .04 }, bat: { vol: .32 },
    secciones: {
      A: sec("C Am F G",
        "E5*2 G5*2 C6*2 G5*2 A5*2 G5*2 E5*4 C5*2 E5*2 A5*4 G5*2 E5*2 C5*4 F5*2 A5*2 C6*2 A5*2 G5*2 F5*2 D5*4 D5*2 E5*2 F5*2 G5*2 B5*4 G5*4",
        "R . F . O . F . R . F . O . F .", "k.h.s.h.k.k.s.hh", 4),
      B: sec("F G Em Dm,G7",
        "A5*3 G5 F5*2 E5*2 F5*4 C5*4 B4*3 C5 D5*2 E5*2 D5*8 E5*3 F5 G5*2 B5*2 A5*4 G5*4 F5*2 E5*2 D5*4 G5*2 A5*2 B5*4",
        "R . F . O . F . R . F . O . F .", "k.h.s.h.k.h.s.h.", 4)
    },
    orden: "A A B A"
  };

  T.reversi = {
    bpm: 120,
    lead: { onda: "p12", vol: .15, vib: .004 },
    bajo: { onda: "tri", vol: .19 }, arp: { onda: "p25", vol: .055, oct: 4, paso: .06 }, bat: { vol: .22 },
    secciones: {
      A: sec("Dm Bb Gm A7",
        "D5*4 F5*2 A5*2 G5*4 F5*2 E5*2 D5*6 C5*2 Bb4*8 G4*2 Bb4*2 D5*2 G5*2 F5*2 E5*2 D5*2 E5*2 C#5*4 E5*4 A5*6 G5*2",
        "R - - - F - - - O - - - F - - -", "k.......s.......", 4),
      B: sec("Dm C Bb A F C Gm A7",
        "F5*4 E5*2 D5*2 A5*8 G5*4 F5*2 E5*2 C5*8 F5*4 D5*2 Bb4*2 D5*4 F5*4 E5*4 C#5*4 A4*8 A4*2 C5*2 F5*2 A5*2 G5*4 F5*4 E5*2 G5*2 C6*4 Bb5*4 A5*4 Bb5*4 A5*2 G5*2 D5*4 G5*4 A5*4 G5*2 F5*2 E5*4 C#5*4",
        "R - . R F - . F O - . O F - . F", "k...h...s...h...", 2)
    },
    orden: "A A B"
  };

  T.cadena = {
    bpm: 138,
    lead: { onda: "p50", vol: .13, vib: .006, eco: { fb: .3, mezcla: .25 } },
    bajo: { onda: "tri", vol: .21 }, arp: { onda: "p12", vol: .06, oct: 4, paso: .03 }, bat: { vol: .34 },
    secciones: {
      I: sec("F#m D", "", "R . R . R . R . R . R . O . F .", "k...h...k...h..h", 2),
      A: sec("F#m D A E",
        "C#5*2 F#5*2 A5*2 F#5*2 C#6*4 B5*2 A5*2 A5*2 F#5*2 D5*4 F#5*2 A5*2 D6*4 C#6*2 A5*2 E5*2 A5*2 C#6*4 E6*4 B5*2 G#5*2 E5*4 G#5*2 B5*2 E5*4",
        "R . R . F . R . O . R . F . R .", "k.h.s.hkk.h.s.hh", 2),
      B: sec("Bm D F#m E",
        "B4*2 D5*2 F#5*2 B5*2 A5*2 F#5*2 D5*4 D5*2 F#5*2 A5*2 D6*2 C#6*2 A5*2 F#5*4 F#5*2 A5*2 C#6*2 F#6*2 E6*2 C#6*2 A5*4 G#5*2 B5*2 E6*4 D#6*2 C#6*2 B5*4",
        "R . R R F . R . O . R R F . O .", "k.hks.hkk.hks.hx", 2)
    },
    orden: "I A A B A B"
  };

  /* Catan: Re mayor con un poco de swing, una tonada de puerto que sube
     en la segunda parte. El bajo salta a la quinta como un tambor de
     marcha y el arpegio hace de gaita. */
  T.catan = {
    bpm: 116, swing: .1,
    lead: { onda: "p25", vol: .14, vib: .01 },
    bajo: { onda: "tri", vol: .2 }, arp: { onda: "p12", vol: .05, oct: 4, paso: .05 }, bat: { vol: .3 },
    secciones: {
      I: sec("D A", "", "R . F . O . F . R . F . O . F .", "k..hs.h.k.hks.h.", 4),
      A: sec("D G A D",
        "D5*2 F#5*2 A5*4 F#5*2 E5*2 D5*4 B4*2 D5*2 G5*4 F#5*2 E5*2 D5*4 C#5*2 E5*2 A5*4 G5*2 F#5*2 E5*4 F#5*4 E5*2 C#5*2 D5*8",
        "R . F . O . F . R . F . O . F .", "k..hs.h.k.hks.h.", 4),
      B: sec("Bm G D A",
        "B4*2 D5*2 F#5*4 B5*4 A5*4 G5*4 F#5*2 E5*2 D5*4 B4*4 A4*2 D5*2 F#5*2 A5*2 D6*4 C#6*4 B5*2 A5*2 G5*2 E5*2 A5*8",
        "R . R F . R O . R . R F . R O .", "k.hhs.h.k.hks.hx", 2)
    },
    orden: "I A A B A"
  };

  T.minas = {
    bpm: 116,
    lead: { onda: "p25", vol: .14, vib: 0 },
    bajo: { onda: "tri" }, arp: { onda: "p12", vol: .055, oct: 4, paso: .03 }, bat: { vol: .3 },
    secciones: {
      A: sec("Gm Eb F D7",
        "G5 . D5 . Bb4 . D5 . G5 . A5 . Bb5*2 A5*2 G5 . Eb5 . Bb4 . Eb5 . G5*2 F5*2 Eb5*4 F5 . C5 . A4 . C5 . F5 . G5 . A5*2 C6*2 A5*4 F#5*4 D5*4 C5*2 A4*2",
        "R . R . F . R . R . R . O . F .", "k.h.s.h.k.h.s.hh", 2),
      B: sec("Cm Gm Eb D",
        "Eb5*2 G5*2 C6*4 Bb5*2 G5*2 Eb5*4 D5*2 G5*2 Bb5*4 A5*2 G5*2 D5*4 Eb5*2 F5*2 G5*2 Bb5*2 C6*2 Bb5*2 G5*4 F#5*4 A5*4 D6*8",
        "R . R . F . R . R . R . O . F .", "k.hks.h.k.hks.hx", 2)
    },
    orden: "A A B A"
  };

  T.snake = {
    bpm: 150,
    lead: { onda: "p25", vol: .14, vib: .006 },
    bajo: { onda: "p50", vol: .13 }, arp: { onda: "p12", vol: .05, oct: 4, paso: .03 }, bat: { vol: .34 },
    secciones: {
      A: sec("Cm7 F7 Cm7 F7",
        "C5 . Eb5 . F5 G5 . Bb5 . G5 F5 . Eb5 . C5 . A4 . C5 . Eb5 . F5 . A5*2 G5 F5 Eb5*2 C5*2 C6 . Bb5 . G5 . Bb5 G5 F5 . Eb5 . F5*2 G5*2 A5*2 G5*2 F5*2 Eb5*2 D5*2 Eb5 D5 C5*4",
        "R . O R . R O . R . O . F . O .", "k..sh.k.s..kh.s.", 2),
      B: sec("Ab Bb G7 G7",
        "C6*4 Eb6*4 C6*2 Ab5*2 Eb5*4 D6*4 F6*4 D6*2 Bb5*2 F5*4 B5*2 G5*2 D5*2 F5*2 B5*2 D6*2 F6*4 G6*2 F6*2 D6*2 B5*2 G5*8",
        "R . O R . R O . R . O . F . O .", "k.hsh.k.s.hkh.sx", 2)
    },
    orden: "A A B A"
  };

  /* BBTAN: Do mayor a 142, de sala de máquinas. La melodía sube y baja
     por arpegios como una bola que rebota de pared en pared, el bajo salta
     de la fundamental a su octava en cada corchea y el eco corto del pulso
     le da la gota de burbuja que tienen los choques. La vuelta a B sube un
     tono (B+2), para que la ronda cuarenta no suene igual que la primera. */
  T.bbtan = {
    bpm: 142,
    lead: { onda: "p25", vol: .14, vib: .004, sus: .6, eco: { t: .11, fb: .22, mezcla: .22 } },
    bajo: { onda: "tri", vol: .2 }, arp: { onda: "p12", vol: .045, oct: 5, paso: .028 }, bat: { vol: .28 },
    secciones: {
      I: sec("C G", "", "R . O . R . O . F . O . R . O .", "k...h...s...h.hh", 2),
      A: sec("C Am F G",
        "C5 . E5 . G5 . C6*2 B5 . G5 . E5*4 A5 . E5 . C5 . E5 A5 . G5 . E5 . C5*3 F5 . A5 . C6 . A5 . F5 . A5 C6 D6*2 C6*2 B5*2 G5*2 D5*2 G5*2 B5 . D6 . G6*4",
        "R . O . R . O . F . O . R . O .", "k.h.s.hkk.h.s.hh", 2),
      B: sec("Dm G Em F,G",
        "D6*3 C6 A5*2 F5*2 D5*4 F5*2 A5*2 B5*3 A5 G5*2 D5*2 B4*4 D5*2 G5*2 E6*3 D6 B5*2 G5*2 E5*4 G5*2 B5*2 A5*2 C6*2 F6*4 G6*2 F6 E6 D6*4",
        "R . O . R . O . F . O . R . O .", "k.hks.h.k.hks.hx", 2)
    },
    orden: "I A A B A B+2 A"
  };

  /* Sudoku Arcade: Mi mayor a 134, tonalidad y tempo que no usa ningún otro
     tema del cancionero (Mi mayor solo lo tiene el menú de Circuit Breakers,
     y a 100). Melodía original. La idea musical es la cuadrícula: en A los
     compases se cuentan 3+3+3 (tres notas repetidas tres veces, como las tres
     celdas de una fila dentro de una caja) y luego se resuelven en 7 pasos.
     B baja al relativo menor (Do# menor) para que respire, y C es el clímax
     de ocho compases que trepa por las octavas como una racha de aciertos.
     La segunda vuelta de C sube un tono (C+2) para que la partida larga no
     suene igual que al principio. Las capas (arp, bat) las abre game.js con
     el avance del tablero, igual que hace Mina Club. */
  T.sudoku = {
    bpm: 134, // tempo propio: ningún otro tema va a 134
    // Pulso 25 % con un eco corto: brillante y de máquina recreativa.
    lead: { onda: "p25", vol: .14, vib: .005, sus: .55, eco: { t: .1, fb: .2, mezcla: .18 } },
    // Bajo de triángulo que rebota fundamental-octava-quinta.
    bajo: { onda: "tri", vol: .21 },
    // Arpegio fino de 12 % una octava arriba: el «tintineo» de las celdas.
    arp: { onda: "p12", vol: .045, oct: 5, paso: .03 },
    bat: { vol: .3 },
    secciones: {
      // Intro de dos compases: solo bajo, arpegio y batería, sin melodía.
      I: sec("E B", "", "R . O . F . O . R . O . F . O .", "k.h.k.h.s.h.k.hh", 2),
      // A: el motivo de tres notas (grupos de 3, como las cajas de 3×3).
      A: sec("E C#m A B",
        "E5 G#5 B5 E5 G#5 B5 E5 G#5 B5*2 C#6 B5 G#5*2 E5*2 " +
        "C#5 E5 G#5 C#5 E5 G#5 C#5 E5 G#5*2 B5 A5 G#5*4 " +
        "A4 C#5 E5 A4 C#5 E5 A4 C#5 E5*2 F#5 G#5 A5*4 " +
        "B5*2 A5*2 G#5*2 F#5*2 D#5*4 F#5*2 B4*2",
        "R . O . F . O . R . O . F . O .", "k.h.s.hkk.h.s.hh", 2),
      // B: al relativo menor, frases más largas para «pensar la jugada».
      B: sec("C#m A F#m B",
        "G#5*4 C#6*4 B5*2 A5*2 G#5*4 " +
        "A5*6 G#5*2 E5*4 C#5*4 " +
        "F#5*2 A5*2 C#6*4 B5*2 A5*2 F#5*4 " +
        "D#5*2 F#5*2 B5*4 A5*2 G#5*2 F#5*4",
        "R . R F . R O . R . R F . R O .", "k.h.s.h.k.hks.h.", 2),
      // C: clímax de ocho compases que sube por las octavas, como un combo.
      C: sec("A B G#m C#m F#m B E E",
        "C#6 . E6 . C#6 . A5 . E6*2 C#6*2 A5*4 " +
        "D#6 . F#6 . D#6 . B5 . F#6*2 D#6*2 B5*4 " +
        "B5 . D#6 . G#6*4 F#6*2 D#6*2 B5*4 " +
        "C#6*2 E6*2 G#6*4 E6*2 C#6*2 G#5*4 " +
        "A5*2 C#6*2 F#6*4 E6*2 C#6*2 A5*4 " +
        "B5*2 D#6*2 F#6*4 A6*4 F#6*4 " +
        "G#6*4 E6*2 B5*2 G#5*2 B5*2 E6*4 " +
        "E6*8 B5*4 .*4",
        "R . O . F . O . R . O . F . O .", "k.hks.hkk.hks.hx", 2)
    },
    // Intro, el motivo dos veces, el respiro, el motivo, el clímax y, de
    // vuelta, el respiro y el clímax un tono más arriba.
    orden: "I A A B A C A B C+2"
  };

  T["worms-menu"] = {
    bpm: 100,
    lead: { onda: "p50", vol: .13, vib: .008, eco: { fb: .3, mezcla: .28 } },
    bajo: { onda: "tri" }, arp: { onda: "p12", vol: .05, oct: 4, paso: .06 }, bat: { vol: .24 },
    secciones: {
      A: sec("E C#m A B",
        "B4*2 E5*2 G#5*4 F#5*2 E5*2 B4*4 C#5*2 E5*2 G#5*4 B5*4 G#5*4 A5*4 G#5*2 F#5*2 E5*4 C#5*4 D#5*2 E5*2 F#5*2 G#5*2 F#5*8",
        "R - - - . . R - F - - - R - . -", "k.......s.......", 2)
    },
    orden: "A"
  };

  T["worms-combate"] = {
    bpm: 140,
    lead: { onda: "p25", vol: .15, vib: .007 },
    bajo: { onda: "p50", vol: .12 }, arp: { onda: "p12", vol: .05, oct: 4, paso: .03 }, bat: { vol: .36 },
    secciones: {
      A: sec("Bm G A F#7",
        "B4 B4 D5 . F#5 . B5 . A5 . F#5 . D5 E5 F#5 . G5*2 F#5*2 E5*2 D5*2 E5*4 B4*4 A4 A4 C#5 . E5 . A5 . G5 . E5 . C#5 D5 E5 . F#5*4 E5*2 A#4*2 C#5*4 F#5*4",
        "R R . R O . R R . R O . F . R .", "k.h.s.h.k.hks.hs", 2),
      B: sec("G A Bm F#",
        "D6*4 B5*4 G5*4 B5*4 C#6*4 A5*4 E5*4 A5*4 B5*2 A5*2 F#5*2 D5*2 E5*2 F#5*2 A5*4 A#5*4 C#6*4 F#6*8",
        "R R . R O . R R . R O . F . R .", "k.hks.hkk.hks.hx", 2)
    },
    orden: "A A B A"
  };

  /* ---------- El repertorio: temas que no son de ningún juego ----------
     Se eligen desde el reproductor de la cabecera. Usan lo que el motor
     tiene de sintetizador además de chip (sierras desafinadas, filtros,
     bombo 808, palmas, bombeo), porque «más electrónico» era exactamente
     lo que se pedía. */

  /* Turno de noche: lo-fi con 808, a la manera de la radio del garaje en
     Schedule I. Acordes de séptima que ruedan despacio como un Rhodes, un bajo
     senoidal que entra resbalando y una melodía suelta con mucho eco. */
  T.lofi = {
    bpm: 86, swing: .14,
    lead: { onda: "sine", vol: .17, vib: .004, sus: .6, eco: { fb: .42, mezcla: .36 } },
    bajo: { onda: "sine", vol: .3, desliza: 1 },
    arp: { onda: "tri", vol: .075, oct: 4, paso: .11, sus: .45, filtro: 1800 },
    bat: { vol: .32 },
    secciones: {
      I: sec("Fm7 Dbmaj7", "", "R - - - - - - R - - - . F - - -", "..h...h...h...hh", 8),
      A: sec("Fm7 Dbmaj7 Bbm7 C7",
        "C5*3 Eb5 F5*6 .*2 Ab5*2 G5*2 F5*8 .*4 Eb5*2 F5*2 Db5*3 C5 Bb4*4 .*2 Db5*2 F5*2 Ab5*2 G5*6 E5*2 C5*8",
        "R - - - - - - R - - - . F - - -", "K.h.c.hKh.K.c.hh", 8),
      B: sec("Bbm7 Eb7 Abmaj7 Dbmaj7,C7",
        "Db6*2 C6*2 Ab5*4 .*2 F5*2 Ab5*2 Bb5*2 G5*8 .*2 Eb5*2 G5*2 Bb5*2 C6*6 Bb5*2 Ab5*4 Eb5*4 F5*4 Db5*4 E5*4 G5*4",
        "R - - - - - . R - - R - F - - -", "K.hhc.hKh.K.c.hK", 8)
    },
    orden: "I A A B A B"
  };

  /* Sobrecarga: drum'n'bass de consola a 172. Mi menor, bajo de sierra
     filtrado que no para y un ritmo roto que empuja hacia delante. */
  T.sobrecarga = {
    bpm: 172,
    lead: { onda: "p25", vol: .14, vib: .006, eco: { fb: .22, mezcla: .18 } },
    bajo: { onda: "saw", vol: .11, filtro: 700, q: 5 },
    arp: { onda: "p12", vol: .05, oct: 4, paso: .03 }, bat: { vol: .38 },
    secciones: {
      I: sec("Em Em", "", "R . R . R . R . R . R . O . R .", "k...s...k.k.s..x", 4),
      A: sec("Em C D B7",
        "E5 . G5 . B5 . E6*2 D6 . B5 . G5*2 A5*2 G5*4 E5*2 C5*2 E5 . G5 . C6*4 F#5 . A5 . D6*2 C6 . A5 . F#5*2 D5*2 E5*2 D#5*4 F#5*4 A5*4 B5*4",
        "R R O R R . R O . R R O R . F O", "k.h.s.hk.hkhs.hs", 4),
      B: sec("Am Em C,D B",
        "C6*2 B5*2 A5*4 E5*2 A5*2 C6*4 B5*6 G5*2 E5*4 G5*4 E6*4 D6*2 C6*2 D6*4 F#6*4 D#6*8 B5*4 F#5*4",
        "R R O R R . R O . R R O R . F O", "x.hks.hk.hkhs.ss", 4)
    },
    orden: "I A A B A B"
  };

  /* Tormenta: combate final. Re menor, tambores graves, una sierra doble
     desafinada al frente y platillos al cambiar de frase. */
  T.tormenta = {
    bpm: 152,
    lead: { onda: "saw", vol: .1, vib: .007, desafina: 10, filtro: 3200, eco: { fb: .25, mezcla: .2 } },
    bajo: { onda: "p50", vol: .12 }, arp: { onda: "p12", vol: .05, oct: 4, paso: .03 }, bat: { vol: .38 },
    secciones: {
      I: sec("Dm Dm", "", "R . . . R . . . R . R . R R R R", "t...t...t...T.TT", 4),
      A: sec("Dm Bb C A",
        "D5*2 D5 . F5*2 A5*2 D6*4 C6*2 A5*2 Bb5*4 A5*2 F5*2 D5*4 F5*4 E5*2 G5*2 C6*4 Bb5*2 A5*2 G5*4 A5*4 C#6*4 E6*4 A5*4",
        "R R O R R O R R R R O R F F O F", "k.k.s.T.kkk.s.tT", 2),
      B: sec("Gm A Dm,Bb A7",
        "G5*2 Bb5*2 D6*4 C6*2 Bb5*2 A5*4 C#6*4 A5*4 E5*4 A5*4 F6*4 E6*2 D6*2 D6*4 F6*4 E6*8 C#6*4 A5*4",
        "R R O R R O R R R R O R F F O F", "x.k.s.T.kkk.s.TT", 2)
    },
    orden: "I A A B A B"
  };

  /* Neón 84: synthwave. La menor, arpegio de semicorcheas en sierra
     filtrada, bajo que salta de octava y una melodía ancha con mucho eco. */
  T.neon = {
    bpm: 104,
    lead: { onda: "saw", vol: .1, vib: .006, desafina: 12, filtro: 2400, eco: { fb: .45, mezcla: .38 } },
    bajo: { onda: "saw", vol: .12, filtro: 520, q: 3 },
    arp: { onda: "saw", vol: .05, oct: 4, paso: .144, desafina: 8, filtro: 1600, sus: .5 },
    bat: { vol: .34 },
    secciones: {
      I: sec("Am F", "", "R O R O R O R O R O R O R O R O", "k.......k.......", 16),
      A: sec("Am F C G",
        "E5*6 D5*2 C5*4 B4*2 C5*2 A4*8 C5*4 F5*4 E5*6 G5*2 C6*4 B5*2 A5*2 G5*8 B4*4 D5*4",
        "R O R O R O R O R O R O R O R O", "k.h.s.h.k.h.s.hh", 16),
      B: sec("F G Em Am",
        "A5*4 C6*4 A5*4 F5*4 G5*4 B5*4 D6*4 B5*4 B5*6 G5*2 E5*8 A5*12 .*4",
        "R O R O R O R O R O R O R O R O", "k.h.s.h.k.h.s.hx", 16)
    },
    orden: "I A A B B A"
  };

  /* Pulso de datos: techno a 126. Bombo en negras que hunde todo lo demás
     (el bombeo), bajo a contratiempo y acordes cortos como un stab. */
  T.pulso = {
    bpm: 126, bombeo: .55,
    lead: { onda: "p50", vol: .12, vib: 0, sus: .5, filtro: 2000, eco: { fb: .35, mezcla: .3 } },
    bajo: { onda: "saw", vol: .13, filtro: 600, q: 4 },
    arp: { onda: "saw", vol: .06, oct: 4, paso: .06, filtro: 1100, q: 6, sus: .4 },
    bat: { vol: .36 },
    secciones: {
      I: sec("Gm Gm", "", ". . R . . . R . . . R . . . O .", "k...k...k...k...", 2),
      A: sec("Gm Gm Eb F",
        "D5 . . D5 . . G5 . . . Bb5 . A5*2 G5*2 D5 . . D5 . . G5 . . . F5 . G5*4 Eb5 . . Eb5 . . G5 . . . Bb5 . C6*2 Bb5*2 F5 . . F5 . . A5 . . . C6 . D6*4",
        ". . R . . . R . . . R . . . O .", "k.o.k.o.k.o.k.oh", 2),
      B: sec("Cm Eb F Gm",
        "G5*16 Bb5*16 A5*16 D6*16",
        ". . R . . . R . . . R . . . O .", "khohkhohkhohkhoc", 2)
    },
    orden: "I A A B A"
  };

  /* Cumbia de la mesa: 8 bits con güiro. La menor, el bajo que pisa
     fundamental y quinta, y una melodía de acordeón que se contesta sola. */
  T.cumbia = {
    bpm: 100,
    lead: { onda: "p25", vol: .14, vib: .012, eco: { fb: .2, mezcla: .18 } },
    bajo: { onda: "tri", vol: .22 }, arp: { onda: "p12", vol: .05, oct: 4, paso: .05 }, bat: { vol: .3 },
    secciones: {
      A: sec("Am G Am E",
        "E5 . A5 . C6 . B5 A5 B5*2 A5*2 E5*4 D5 . G5 . B5 . A5 G5 A5*2 G5*2 D5*4 C5 . E5 . A5 . G5 E5 F5*2 E5*2 C5*4 B4*2 D5*2 G#5*4 B5*2 G#5*2 E5*4",
        "R . . . F . . F R . . . F . O .", "k.hhs.hhk.hhs.hh", 4),
      B: sec("Dm G C E",
        "F5*2 A5*2 D6*4 C6*2 A5*2 F5*4 D5*2 G5*2 B5*4 A5*2 G5*2 D5*4 E5*2 G5*2 C6*4 B5*2 G5*2 E5*4 G#5*4 B5*4 E6*4 D6*2 B5*2",
        "R . . . F . . F R . . . F . O .", "k.hhs.hhk.hhs.hx", 4)
    },
    orden: "A A B A"
  };

  /* ---------- Pokémon: homenajes a Rojo Fuego / Verde Hoja ----------
     Un tema por cada momento que cualquiera que jugó reconoce: el pueblo
     donde empieza todo, la ruta, el Centro, el bosque, la bici, el combate
     salvaje, el duelo contra un entrenador y el gimnasio. **Las melodías son
     originales**, escritas para aquí: lo que evocan es el sonido de la GBA
     (pulso con vibrato y eco de sala, triangular de bajo, ruido de batería) y
     el carácter de cada lugar, no las partituras de Game Freak. Transcribir
     las de verdad —aunque estén en una decompilación pública— sería publicar
     composiciones de Nintendo en un sitio abierto, así que no se hace. */

  /* Pueblo de partida: Fa mayor, 96. Tranquilo, de mañana de verano. */
  T["pk-pueblo"] = {
    bpm: 96,
    lead: { onda: "p50", vol: .13, vib: .01, sus: .7, eco: { fb: .3, mezcla: .25 } },
    bajo: { onda: "tri", vol: .19 }, arp: { onda: "p12", vol: .045, oct: 4, paso: .06 }, bat: { vol: .2 },
    secciones: {
      I: sec("Fmaj7 Bbmaj7", "", "R - - - F - - - O - - - F - - -", "k.......h.......", 8),
      A: sec("F Dm Bb C",
        "A4*2 C5*2 F5*4 E5*2 F5*2 G5*4  A5*6 G5*2 F5*4 D5*4  D5*2 F5*2 Bb5*4 A5*2 G5*2 F5*4  G5*8 E5*4 C5*4",
        "R - - - F - - - O - - - F - R -", "k...h...s...h...", 4),
      B: sec("Bb C Am Dm",
        "F5*3 G5 A5*4 Bb5*4 A5*2 G5*2  G5*4 E5*4 C5*4 E5*4  E5*3 F5 G5*4 A5*2 C6*2 A5*4  F5*12 .*4",
        "R - - - F - - - O - - - F - R -", "k...h...s...h...", 4),
      C: sec("Gm7 C7 F F",
        "Bb4*2 D5*2 F5*4 A5*4 G5*4  E5*2 G5*2 Bb5*4 A5*2 G5*2 E5*4  F5*8 A5*4 C6*4  F5*12 .*4",
        "R - - - F - - - O - - - F - R -", "k...h...s...h..h", 4)
    },
    orden: "I A A B C A"
  };

  /* Hierba alta: Re mayor, 140. La ruta: se sale a caminar con ganas. */
  T["pk-ruta"] = {
    bpm: 140,
    lead: { onda: "p25", vol: .14, vib: .008, eco: { fb: .22, mezcla: .18 } },
    bajo: { onda: "tri", vol: .21 }, arp: { onda: "p12", vol: .05, oct: 4, paso: .045 }, bat: { vol: .3 },
    secciones: {
      I: sec("D A", "", "R . R F O . F . R . R F O . F .", "k.h.s.h.k.h.s.hh", 4),
      A: sec("D G A D",
        "F#5*2 A5*2 D6*3 C#6 B5*2 A5*2 F#5*4  G5*2 B5*2 D6*2 B5*2 A5*4 G5*4  E5*2 A5*2 C#6*2 E6*2 D6*2 C#6*2 B5*4  A5*6 F#5*2 D5*8",
        "R . R F O . F . R . R F O . F .", "k.h.s.h.k.h.s.hh", 4),
      B: sec("D G Em A",
        "F#5*2 A5*2 D6*3 C#6 B5*2 A5*2 F#5*4  B5*2 D6*2 G6*4 F#6*2 E6*2 D6*4  E6*3 D6 B5*4 G5*2 E5*2 G5*4  A5*8 C#6*4 E6*4",
        "R . R F O . F . R . R F O . F .", "k.h.s.h.k.h.s.hs", 4),
      C: sec("Bm G D A",
        "D6*2 C#6*2 B5*4 F#5*4 B5*4  B5*2 A5*2 G5*4 D5*4 G5*4  A5*2 G5*2 F#5*2 A5*2 D6*4 F#6*4  E6*8 C#6*4 A5*4",
        "R . R . F . R . O . R . F . O .", "k.hhs.h.k.hhs.hx", 4)
    },
    orden: "I A B C A B"
  };

  /* Centro de curación: Do mayor, 116 con un poco de swing. Mullido. */
  T["pk-centro"] = {
    bpm: 116, swing: .08,
    lead: { onda: "p50", vol: .12, vib: .006, sus: .6, eco: { fb: .25, mezcla: .2 } },
    bajo: { onda: "tri", vol: .19 }, arp: { onda: "p25", vol: .045, oct: 4, paso: .05 }, bat: { vol: .2 },
    secciones: {
      A: sec("C Am Dm7 G7",
        "E5*2 G5*2 C6*2 G5*2 E5*4 C5*4  A5*2 C6*2 E6*4 D6*2 C6*2 A5*4  F5*2 A5*2 C6*2 A5*2 F5*2 D5*2 F5*4  G5*6 B5*2 D6*4 .*4",
        "R . F . O . F . R . F . O . F .", "k.h.s.h.k.h.s.h.", 4),
      B: sec("F G Em Am",
        "A5*3 G5 F5*2 A5*2 C6*8  B5*3 A5 G5*2 B5*2 D6*8  E6*2 D6*2 B5*2 G5*2 E5*2 G5*2 B5*4  A5*12 .*4",
        "R . F . O . F . R . F . O . F .", "k.h.s.h.k.h.s.h.", 4),
      C: sec("Dm7 G7 C C",
        "D5*2 F5*2 A5*2 C6*2 B5*4 A5*4  G5*2 B5*2 D6*2 F6*2 E6*4 D6*4  C6*8 G5*4 E5*4  C5*12 .*4",
        "R . F . O . F . R . F . O . F .", "k.h.s.h.k.h.s.hh", 4)
    },
    orden: "A A B C"
  };

  /* Bosque espeso: Mi menor, 112. Staccato y eco: no se ve la salida. */
  T["pk-bosque"] = {
    bpm: 112,
    lead: { onda: "p25", vol: .14, vib: .004, sus: .6, eco: { fb: .4, mezcla: .32 } },
    bajo: { onda: "tri", vol: .2 }, arp: { onda: "p12", vol: .05, oct: 4, paso: .05 }, bat: { vol: .26 },
    secciones: {
      I: sec("Em Em", "", "R . . R . . F . R . . R . . O .", "k..h..h.k..h..h.", 2),
      A: sec("Em D C D",
        "E5 . G5 . B5 . A5 G5 F#5*2 G5*2 E5*4  D5 . F#5 . A5 . G5 F#5 E5*2 F#5*2 D5*4  C5 . E5 . G5 . B5 . C6*2 B5*2 G5*4  A5*2 F#5*2 D5*2 E5*2 F#5*8",
        "R . . R . . F . R . . R . . O .", "k..h..h.k..h.sh.", 2),
      B: sec("Am Em C B7",
        "A5*4 C6*2 B5*2 A5*4 E5*4  G5*4 B5*2 A5*2 G5*4 E5*4  E5*2 G5*2 C6*2 E6*2 D6*4 C6*4  B5*4 A5*4 F#5*4 D#5*4",
        "R . . R . . F . R . . R . . O .", "k..h..h.k..h.shx", 2)
    },
    orden: "I A A B A B"
  };

  /* Cuesta abajo en bici: Sol mayor, 150 con swing. Viento en la cara. */
  T["pk-bici"] = {
    bpm: 150, swing: .12,
    lead: { onda: "p50", vol: .13, vib: .006, eco: { fb: .2, mezcla: .16 } },
    bajo: { onda: "tri", vol: .21 }, arp: { onda: "p25", vol: .045, oct: 4, paso: .04 }, bat: { vol: .3 },
    secciones: {
      A: sec("G Em C D",
        "D5*2 G5*2 B5*2 D6*2 B5*2 G5*2 A5*2 B5*2  G5*4 E5*2 G5*2 B5*8  C6*2 B5*2 A5*2 G5*2 E5*2 G5*2 C6*4  D6*4 C6*2 B5*2 A5*8",
        "R . F . R . F . O . F . R . F .", "k.hhs.hhk.hhs.hh", 4),
      B: sec("G Em C,D G",
        "D5*2 G5*2 B5*2 D6*2 B5*2 G5*2 A5*2 B5*2  G5*4 E5*2 G5*2 E6*8  E6*2 D6*2 C6*4 C6*2 B5*2 A5*4  G5*12 .*4",
        "R . F . R . F . O . F . R . F .", "k.hhs.hhk.hhs.hx", 4),
      C: sec("C D Bm Em Am D G D",
        "E6*6 D6*2 C6*4 G5*4  F#6*6 E6*2 D6*4 A5*4  D6*4 B5*4 F#5*4 B5*4  G5*2 A5*2 B5*4 E6*8  C6*2 B5*2 A5*4 E5*4 A5*4  F#5*2 G5*2 A5*4 D6*8  B5*2 A5*2 G5*2 B5*2 D6*4 G6*4  F#6*8 D6*4 A5*4",
        "R . F . R . F . O . F . R . F .", "k.hhs.hhk.hhs.hh", 4)
    },
    orden: "A B C A B"
  };

  /* ¡Apareció uno salvaje!: La menor, 168. Escala que sube y a pelear. */
  T["pk-salvaje"] = {
    bpm: 168,
    lead: { onda: "p25", vol: .15, vib: .006, eco: { fb: .18, mezcla: .14 } },
    bajo: { onda: "p50", vol: .12 }, arp: { onda: "p12", vol: .05, oct: 4, paso: .035 }, bat: { vol: .34 },
    secciones: {
      I: sec("Am E",
        "A4 B4 C5 D5 E5 F5 G#5 A5 B5 C6 D6 E6*4 .  B5 . B5 . B5 . G#5 . E5*8",
        "R R R R R R R R O O O O O O O O", "k.k.k.k.k.k.s.ss", 4),
      A: sec("Am F G E",
        "A5*2 . A5 C6*2 E6*2 D6*2 C6*2 B5*2 C6*2  A5*4 F5*4 C5*4 F5*4  G5*2 . G5 B5*2 D6*2 C6*2 B5*2 A5*2 B5*2  G#5*4 B5*4 E6*8",
        "R . R O . R O . R . R O . R F O", "k.h.s.hkk.h.s.hh", 2),
      B: sec("Dm Am Bb E",
        "F5*2 E5*2 D5*2 F5*2 A5*4 D6*4  C6*2 B5*2 A5*2 E5*2 A5*4 C6*4  D6*2 C6*2 Bb5*2 F5*2 Bb5*4 D6*4  E6*4 D6*4 B5*4 G#5*4",
        "R . R O . R O . R . R O . R F O", "k.hks.hkk.hks.hx", 2)
    },
    orden: "I A A B A B"
  };

  /* Duelo de entrenadores: Si menor, 176. El que más aprieta de todos. */
  T["pk-entrenador"] = {
    bpm: 176,
    lead: { onda: "p25", vol: .15, vib: .006, eco: { fb: .18, mezcla: .14 } },
    bajo: { onda: "p50", vol: .12 }, arp: { onda: "p12", vol: .05, oct: 4, paso: .03 }, bat: { vol: .36 },
    secciones: {
      I: sec("Bm F#",
        "B4 D5 F#5 B5 D6 F#6*2 . F#6 . F#6 . E6 D6 C#6 A#5  B5*4 . . F#5 . B5 . . F#5 B5*4",
        "R . . R . . R . R . . R . R R R", "k..k..s.k..k.sss", 2),
      A: sec("Bm G A F#",
        "F#5*2 B5*2 D6*4 C#6*2 B5*2 A5*2 B5*2  G5*2 B5*2 D6*2 G6*2 F#6*4 E6*4  E6*2 C#6*2 A5*2 C#6*2 E6*4 A6*4  F#6*8 E6*2 C#6*2 A#5*4",
        "R . R O R . R O R . R O F . O F", "k.h.s.hkk.hks.hh", 2),
      B: sec("Em F#m G A",
        "G5*3 F#5 E5*4 B5*4 E6*4  A5*3 G5 F#5*4 C#6*4 F#6*4  B5*2 D6*2 G6*4 F#6*2 E6*2 D6*4  C#6*2 D6*2 E6*4 F#6*8",
        "R . R O R . R O R . R O F . O F", "k.h.s.hkk.hks.hs", 2),
      C: sec("Bm G Em F#",
        "B5*8 D6*8  D6*4 C#6*4 B5*8  G5*8 B5*8  A#5*8 C#6*4 F#6*4",
        "R . R O R . R O R . R O F . O F", "k...s...k.k.s..x", 4)
    },
    orden: "I A A B C A B"
  };

  /* Líder de gimnasio: Do menor, 156, que se abre a Mi bemol mayor. */
  T["pk-gimnasio"] = {
    bpm: 156,
    lead: { onda: "p25", vol: .15, vib: .007, eco: { fb: .2, mezcla: .16 } },
    bajo: { onda: "p50", vol: .12 }, arp: { onda: "p12", vol: .05, oct: 4, paso: .035 }, bat: { vol: .34 },
    secciones: {
      I: sec("Cm G",
        "C5 C5 . C5 Eb5 . G5 . C6*8  B4 B4 . B4 D5 . G5 . B5*8",
        "R R . R R . R . R R . R O . F .", "k.k.s...k.k.s.ss", 4),
      A: sec("Cm Ab Bb G",
        "C5*2 Eb5*2 G5*2 C6*2 Bb5*4 G5*4  Ab5*2 C6*2 Eb6*4 D6*2 C6*2 Ab5*4  Bb5*2 D6*2 F6*4 Eb6*2 D6*2 Bb5*4  B5*8 D6*4 G6*4",
        "R R . R R . R . R R . R O . F .", "k.h.s.h.k.hks.hs", 4),
      B: sec("Fm Cm Ab G",
        "F5*3 G5 Ab5*4 C6*4 F6*4  Eb6*3 D6 C6*4 G5*4 Eb5*4  Ab5*2 Bb5*2 C6*4 Eb6*4 Ab6*4  G6*8 F6*2 D6*2 B5*4",
        "R R . R R . R . R R . R O . F .", "k.h.s.h.k.hks.hs", 4),
      C: sec("Eb Bb Ab Bb",
        "G5*4 Bb5*4 Eb6*8  D6*4 F6*4 Bb5*8  C6*4 Eb6*4 Ab6*8  G6*4 F6*4 D6*4 Bb5*4",
        "R . F . O . F . R . F . O . F .", "k.hhs.h.k.hhs.hx", 4)
    },
    orden: "I A A B C A"
  };


  /* ---------- Diez más para el reproductor ----------
     Dos a la manera de Schedule I (el laboratorio y el reparto de noche),
     y ocho que no se parecen a nada de lo que ya había: bossa, surf, western,
     mazmorra, celta, eurobeat, reggae y un ambiente lento. */

  /* Laboratorio casero: Schedule I, el hip-hop del cuarto de atrás. Sol
     menor a 140 en medio tiempo: 808 en el uno, palmas en el tres, hi-hats
     en semicorcheas y una campanita senoidal con mucho eco. */
  T.laboratorio = {
    bpm: 140, swing: .1,
    lead: { onda: "sine", vol: .16, vib: .003, sus: .35, eco: { fb: .45, mezcla: .4 } },
    bajo: { onda: "sine", vol: .32, desliza: 1 },
    arp: { onda: "tri", vol: .06, oct: 4, paso: .09, sus: .4, filtro: 1600 },
    bat: { vol: .34 },
    secciones: {
      I: sec("Gm7 Ebmaj7", "", "R - - - - - - . R - . R - - F -", "..h.h.h...h.h.hh", 8),
      A: sec("Gm7 Ebmaj7 Cm7 D7",
        "D5*2 .*2 Bb4*2 G4*2 .*4 A4*2 Bb4*2  D5*3 Eb5 D5*4 .*4 G5*2 F5*2  Eb5*2 .*2 C5*2 G4*2 .*2 C5*2 Eb5*2 G5*2  F#5*6 D5*2 A4*4 .*4",
        "R - - - - - - . R - . R - - F -", "K.h.h.hhc.h.hKhh", 8),
      B: sec("Cm7 Gm7 Ebmaj7 D7",
        "G5*2 Eb5*2 C5*4 .*2 Bb4*2 C5*2 Eb5*2  D5*8 .*2 F5*2 G5*2 Bb5*2  G5*3 F5 Eb5*4 D5*2 Bb4*2 G4*4  A4*2 C5*2 F#5*4 D5*8",
        "R - - - - - - . R - . R - - F -", "K.hhh.hhc.h.hKhK", 8)
    },
    orden: "I A A B A B"
  };

  /* Reparto nocturno: Schedule I, la furgoneta a las tres de la mañana.
     Deep house a 122 en Re menor, bombo a negras que hunde lo demás, bajo a
     contratiempo y acordes cortos de órgano. */
  T.reparto = {
    bpm: 122, bombeo: .5,
    lead: { onda: "p25", vol: .11, vib: .004, sus: .6, filtro: 1900, eco: { fb: .4, mezcla: .32 } },
    bajo: { onda: "saw", vol: .12, filtro: 480, q: 4 },
    arp: { onda: "saw", vol: .055, oct: 4, paso: .05, filtro: 1200, q: 5, sus: .3 },
    bat: { vol: .36 },
    secciones: {
      I: sec("Dm7 Am7", "", ". . R . . . R O . . R . . . R O", "k.o.k.o.k.o.k.o.", 2),
      A: sec("Dm7 Am7 Bbmaj7 C",
        ".*4 A5*2 C6*2 D6*4 C6*2 A5*2  G5*6 E5*2 .*4 C5*2 E5*2  F5*4 A5*4 D6*2 C6*2 A5*4  G5*8 E5*4 .*4",
        ". . R . . . R O . . R . . . R O", "k.o.k.ohk.o.k.oh", 2),
      B: sec("Gm7 Dm7 Bbmaj7 A7",
        "Bb5*2 A5*2 G5*4 D6*4 C6*2 Bb5*2  A5*8 F5*4 D5*4  D6*2 F6*2 D6*2 Bb5*2 A5*4 F5*4  E5*4 G5*4 C#6*4 E6*4",
        ". . R . . . R O . . R . . . R O", "k.o.k.ohk.o.k.ox", 2)
    },
    orden: "I A A B A B"
  };

  /* Bossa de ascensor: Do mayor, 118 con un poco de swing. Séptimas
     mayores, el bajo que pisa fundamental y quinta, la guitarra en corto. */
  T.bossa = {
    bpm: 118, swing: .06,
    lead: { onda: "p50", vol: .12, vib: .01, sus: .7, eco: { fb: .2, mezcla: .15 } },
    bajo: { onda: "tri", vol: .2 },
    arp: { onda: "tri", vol: .07, oct: 4, paso: .02, sus: .3 },
    bat: { vol: .22 },
    secciones: {
      A: sec("Cmaj7 Am7 Dm7 G7",
        "E5*3 G5 B5*4 A5*2 G5*2 E5*4  C5*2 E5*2 G5*2 C6*2 B5*6 .*2  A5*3 F5 D5*4 C5*2 D5*2 F5*4  E5*6 D5*2 B4*4 G4*4",
        "R - - F R - - F R - - F R - F -", "k.hsh.k.hsh.k.hs", 2),
      B: sec("Em7 A7 Dm7 G7",
        "G5*2 B5*2 D6*4 C6*2 B5*2 G5*4  C#6*6 A5*2 G5*4 E5*4  F5*2 A5*2 C6*4 A5*2 F5*2 D5*4  B4*4 D5*4 F5*4 G5*4",
        "R - - F R - - F R - - F R - F -", "k.hsh.k.hsh.k.hs", 2),
      C: sec("Cmaj7 Fmaj7 Cmaj7 Cmaj7",
        "E5*8 G5*8  A5*8 C6*8  B5*16  .*16",
        "R - - F R - - F R - - F R - F -", "k.hsh.k.hsh.k.hs", 2)
    },
    orden: "A A B A C"
  };

  /* Ola de 8 bits: surf a 168 en Mi. Pulso fino con mucho vibrato (el
     trémolo de la guitarra de muelle), bajo que corre y caja seca. */
  T.surf = {
    bpm: 168,
    lead: { onda: "p25", vol: .14, vib: .02, eco: { fb: .3, mezcla: .25 } },
    bajo: { onda: "tri", vol: .22 }, arp: { onda: "p12", vol: .05, oct: 4, paso: .03 }, bat: { vol: .34 },
    secciones: {
      I: sec("E E", "", "R . R . O . R . F . F . O . F .", "k.h.s.hkk.h.s.hx", 4),
      A: sec("E G A B",
        "E5 E5 G5 E5 B5*4 A5*2 G5*2 E5*4  D5 D5 G5 D5 B5*4 A5*2 G5*2 D5*4  E5 E5 A5 E5 C#6*4 B5*2 A5*2 E5*4  F#5*2 A5*2 B5*4 D#6*4 F#6*4",
        "R . R . O . R . F . F . O . F .", "k.h.s.hkk.h.s.hh", 4),
      B: sec("C D E E",
        "G5*2 E5*2 C5*4 E5*2 G5*2 C6*4  A5*2 F#5*2 D5*4 F#5*2 A5*2 D6*4  B5 A5 G5 F#5 E5*4 G5 A5 B5 D6 E6*4  E6*8 .*4 B5*2 G#5*2",
        "R . R . O . R . F . F . O . F .", "k.h.s.hkk.h.s.hx", 4)
    },
    orden: "I A A B A B"
  };

  /* Duelo al sol: western de los sesenta, La menor a 92. Un silbido con
     eco de cañón, el galope del bajo y un tambor que marca el paso. */
  T.oeste = {
    bpm: 92,
    lead: { onda: "p12", vol: .15, vib: .015, sus: .8, eco: { fb: .5, mezcla: .4 } },
    bajo: { onda: "tri", vol: .21 }, arp: { onda: "p25", vol: .045, oct: 4, paso: .07 }, bat: { vol: .28 },
    secciones: {
      I: sec("Am Am", "", "R . . R F . . F R . . R F . . F", "t.......t.......", 4),
      A: sec("Am G F E",
        "A4*2 E5*2 A5*8 G5*2 A5*2  B5*4 G5*4 D5*8  C6*2 A5*2 F5*4 E5*2 F5*2 A5*4  G#5*12 .*4",
        "R . . R F . . F R . . R F . . F", "k.hhk.hhk.hhk.hh", 4),
      B: sec("Dm Am E Am",
        "D5*2 F5*2 A5*4 D6*8  C6*2 B5*2 A5*4 E5*8  E5*2 G#5*2 B5*4 D6*4 B5*4  A5*16",
        "R . . R F . . F R . . R F . . F", "k.hhk.hhk.hhT.TT", 4)
    },
    orden: "I A A B A B"
  };

  /* Mazmorra: Do menor armónica a 88. Pasos que resuenan, un triángulo
     grave que no se va y una segunda menor (Reb) que da frío. */
  T.mazmorra = {
    bpm: 88,
    lead: { onda: "p12", vol: .13, vib: .012, sus: .85, eco: { fb: .52, mezcla: .42 } },
    bajo: { onda: "tri", vol: .23 },
    arp: { onda: "p25", vol: .045, oct: 4, paso: .12, filtro: 1200, sus: .6 },
    bat: { vol: .3 },
    secciones: {
      I: sec("Cm Cm", "", "R - - - - - - - F - - - - - - -", "T...............", 8),
      A: sec("Cm Ab Fm G",
        "G5*4 Ab5*2 G5*2 Eb5*4 C5*4  C5*2 Eb5*2 Ab5*4 G5*8  F5*4 Ab5*2 C6*2 B5*4 Ab5*4  G5*8 D5*4 B4*4",
        "R - - - - - - - F - - - - - - -", "T.......t...t...", 8),
      B: sec("Cm Db Cm G",
        "C6*4 Eb6*4 D6*4 C6*4  Db6*8 Ab5*4 F5*4  Eb5*2 G5*2 C6*4 G5*4 Eb5*4  D5*4 F5*4 B5*8",
        "R - - - - - - - F - - - - - - -", "T...t...T...t.TT", 8)
    },
    orden: "I A A B A B"
  };

  /* Galope celta: Re mixolidio a 150 con swing de giga. La flauta de pulso
     corre en tresillos fingidos y el Do natural le quita lo de himno. */
  T.celta = {
    bpm: 150, swing: .2,
    lead: { onda: "p25", vol: .14, vib: .01, eco: { fb: .15, mezcla: .12 } },
    bajo: { onda: "tri", vol: .2 }, arp: { onda: "p12", vol: .05, oct: 4, paso: .04 }, bat: { vol: .3 },
    secciones: {
      A: sec("D C D G",
        "A5 F#5 D5 F#5 A5*2 D6*2 C6*2 A5*2 F#5*4  G5 E5 C5 E5 G5*2 C6*2 B5*2 G5*2 E5*4  F#5 A5 D6 A5 F#5*2 A5*2 D6*4 C6*4  B5*2 G5*2 D5*4 G5*8",
        "R . F . O . F . R . F . O . F .", "k.h.s.htk.h.s.hh", 4),
      B: sec("Em C D D",
        "E6*4 D6*2 B5*2 G5*4 B5*4  C6*4 G5*2 E5*2 C5*4 E5*4  D5 E5 F#5 G5 A5*4 C6*4 A5*4  D6*12 .*4",
        "R . F . O . F . R . F . O . F .", "k.h.s.htk.h.s.hx", 4)
    },
    orden: "A A B A B"
  };

  /* Carrera turbo: eurobeat a 156 en Fa# menor. Bajo de octavas que no
     respira, sierra doble al frente y un estribillo que sube de golpe. */
  T.turbo = {
    bpm: 156,
    lead: { onda: "saw", vol: .1, vib: .006, desafina: 10, filtro: 3000, eco: { fb: .25, mezcla: .2 } },
    bajo: { onda: "saw", vol: .11, filtro: 650, q: 4 },
    arp: { onda: "saw", vol: .05, oct: 4, paso: .03, desafina: 6, filtro: 1800, sus: .4 },
    bat: { vol: .36 },
    secciones: {
      I: sec("F#m F#m", "", "R O R O R O R O R O R O R O R O", "k...k...k...k.hh", 2),
      A: sec("F#m D E C#",
        "C#6*2 A5*2 F#5*2 A5*2 C#6*4 E6*4  D6*4 F#6*4 E6*2 D6*2 A5*4  B5*2 G#5*2 E5*2 G#5*2 B5*4 E6*4  C#6*4 F6*4 G#6*8",
        "R O R O R O R O R O R O R O R O", "k.o.s.o.k.o.s.oh", 2),
      B: sec("D E F#m F#m",
        "F#6*4 E6*4 D6*4 A5*4  G#6*4 F#6*4 E6*4 B5*4  A6*6 G#6*2 F#6*4 C#6*4  F#6*12 .*4",
        "R O R O R O R O R O R O R O R O", "k.o.s.o.k.o.s.ox", 2)
    },
    orden: "I A A B A B"
  };

  /* Reggae de bits: Sol mayor a 78, one drop (el bombo solo en el tres),
     acordes picados y una melodía con eco de dub. */
  T.reggae = {
    bpm: 78,
    lead: { onda: "p50", vol: .13, vib: .01, sus: .7, eco: { fb: .48, mezcla: .38 } },
    bajo: { onda: "tri", vol: .24 },
    arp: { onda: "p25", vol: .055, oct: 4, paso: .01, sus: .18 },
    bat: { vol: .3 },
    secciones: {
      A: sec("G C D C",
        ".*4 B5*2 D6*2 B5*4 G5*4  E5*6 G5*2 C6*4 .*4  D6*2 C6*2 A5*4 F#5*4 D5*4  E5*8 .*8",
        "R - - . F - R . . . R - O - F .", "..h...h.k.h...h.", 4),
      B: sec("Em C G D",
        "G5*2 B5*2 E6*4 D6*4 B5*4  C6*8 .*4 E5*4  D5*2 G5*2 B5*4 D6*8  C6*4 A5*4 F#5*8",
        "R - - . F - R . . . R - O - F .", "..h...h.k.h.s.hs", 4)
    },
    orden: "A A B A B"
  };

  /* Aurora: Mi bemol mayor a 72, para no hacer nada. Notas largas con eco
     de catedral, arpegio de triángulo que brilla y casi nada de batería. */
  T.aurora = {
    bpm: 72,
    lead: { onda: "sine", vol: .14, vib: .006, sus: .9, eco: { fb: .55, mezcla: .45 } },
    bajo: { onda: "sine", vol: .22 },
    arp: { onda: "tri", vol: .07, oct: 4, paso: .2, sus: .7, filtro: 1400 },
    bat: { vol: .16 },
    secciones: {
      A: sec("Ebmaj7 Cm7 Abmaj7 Bb",
        "G5*8 Bb5*8  Eb6*12 D6*4  C6*8 G5*8  F5*16",
        "R - - - - - - - - - - - F - - -", "h.......h.......", 2),
      B: sec("Abmaj7 Bb Gm7 Cm7",
        "Eb6*4 C6*4 G5*8  F5*4 D6*12  Bb5*8 D6*4 F6*4  Eb6*16",
        "R - - - - - - - - - - - F - - -", "h.......h...h...", 2)
    },
    orden: "A B A B"
  };

  const Temas = { temas: T, linea, arpegio, raiz };
  if (typeof module === "object" && module.exports) module.exports = Temas;
  else root.Temas = Temas;
})(typeof globalThis !== "undefined" ? globalThis : this);
