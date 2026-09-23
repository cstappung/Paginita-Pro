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
 *   minas      Sol menor, 116 — staccato nervioso; las capas entran con el avance.
 *   snake      Do dórico, 150 — funk: bajo con octavas y caja a contratiempo.
 *   worms-menu / worms-combate  Mi mayor tranquilo y Si menor de batalla.
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

  const Temas = { temas: T, linea, arpegio, raiz };
  if (typeof module === "object" && module.exports) module.exports = Temas;
  else root.Temas = Temas;
})(typeof globalThis !== "undefined" ? globalThis : this);
