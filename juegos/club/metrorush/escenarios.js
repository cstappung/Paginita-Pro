/* Metro Rush — los escenarios nuevos y la historia que se VE en la vía.

   QUÉ HACE, EN GLOBAL
   mundo.js arma cada estación con un «kit» (paleta, texturas, modelos).
   Este módulo le suma, sin reescribir nada de lo que ya había:
   1. Tres paletas nuevas (Mercado de Farolillos, Cocheras y Muelle) y la
      del Fin de la Línea con historia («fin», una copia del «alba», que
      queda limpia para el mundo City).
   2. La historia en cada paleta de la Línea 3: grafitis y letreros propios
      (MetroRushHistoria.LORE) y la marca `historia` que dice qué afiches
      lleva.
   3. Los AFICHES de la vereda: un atlas de 4 × 2 por paleta (una sola
      textura) con avisos de la empresa, «se busca» con retratos, publicidad
      del barrio y el plano de la línea con «usted está aquí». Cada afiche es
      UN plano con UNA textura: ocupa el lugar de un grafiti del muro (que
      también era un plano), así que no suma llamadas al GPU.
   4. La utilería de las estaciones nuevas (puestos, bidones, bitas…), que
      reemplaza a los árboles: va instanciada igual que ellos.
   5. El horizonte de las estaciones nuevas (tejados con guirnaldas, galpones
      con torres de focos, grúas y un faro): siluetas pintadas en el grupo
      del cielo, sin escribir profundidad, así que nunca tapan un obstáculo.
   6. Los sucesos del ambiente: farolillos que suben (Mercado), focos que
      parpadean (Cocheras), lluvia y relámpagos (Muelle) y el 317, el tren
      perdido, cruzando a lo lejos con las ventanas encendidas (Cocheras,
      Muelle y Óxido).

   POR QUÉ ASÍ
   - Los otros agentes tocan mundo.js al mismo tiempo: aquí vive todo lo
     nuevo y mundo.js solo tiene ganchos de una línea (cada uno con su
     comentario), para que los cambios no choquen.
   - Nada de esto mueve al corredor, ni cambia puntos ni metros: es solo
     dibujo. El antitrampas no lo ve y la pista de una semilla no cambia.
   - Las ayudas de mundo.js (Arma, geometrías compartidas, texturas…) llegan
     como parámetro (`h`) en vez de copiarse aquí: así una pieza nueva se
     arma y se libera igual que todas las demás.
   - La historia (afiches, 317) solo sale en la Línea 3 (`lore`): City y
     los otros mundos la apagan desde juego.js. */
import * as THREE from 'three';

const H = window.MetroRushHistoria || null;          // los textos de la historia (historia.js, cargado antes como script)
const MOTOR = window.MetroRushMotor;                 // el motor (para el plano de la línea)

/* ===================================================================
   1. LAS PALETAS NUEVAS
   =================================================================== */

/** Devuelve las paletas nuevas, armadas como `variante` de las bases de
    mundo.js (que no se tocan: se copian). `b` = {variante, BASE_JUGUETE,
    BASE_PIXEL, BASE_NEON, PALETAS}. Cada una dice qué `escenario` dibuja
    (horizonte y sucesos) y qué `props` pone en la vereda en vez de árboles. */
export function paletasNuevas(b) {
  const { variante, BASE_JUGUETE, BASE_PIXEL, BASE_NEON, PALETAS } = b;
  return {
    /* Mercado de Farolillos (juguete): un mercado nocturno de feria al
       final de la tarde, con toldos, guirnaldas y farolillos de papel. El
       cielo es de atardecer cálido; los trenes rojos pasan a verde agua para
       que se separen de tanto naranja, y la rampa queda de acero claro. */
    mercado: variante(BASE_JUGUETE, {
      cielo: { arriba: 0x3a3f8f, horizonte: 0xffa86a, sol: 0xffd9a0 }, niebla: [45, 160],
      sol: [0xffc690, 2.3, [-14, 12, -40]], hemi: [0xffd6b0, 0x5a4060, 0.8], exposicion: 0.95,
      c: {
        trenes: [0x2fa3a0, 0x2c7be0, 0xf0ad2e],                                // verde agua, azul y amarillo: ninguno se pierde en el naranja
        edificios: [0xe8a25a, 0xd9734a, 0x8fb8a0, 0xc98fb0, 0xf0d0a0], ladrillo: 0x9c4a34, probLadrillo: 0.35,
        vidrioEd: 0xffcf7a, vitrina: 0xffb860,                                   // ventanas y vitrinas encendidas: es de tarde
        toldos: [[0xe8463b, 0xfff1d4], [0xf2b233, 0x2f7a5a], [0x2f7fe0, 0xfff1d4], [0xc8402e, 0xffd23f]],
        arboles: [0x4f9a4a, 0x6aae55], tronco: 0x6a4630, madera: 0x9a6a3a, farolillos: [0xff5a3c, 0xffd23f, 0xff8ad8, 0x6ad0ff]
      },
      carteles: ['EMPANADAS', 'FRUTAS', 'PESCADO', 'TELAS', 'SOPAIPILLAS', 'ANTIGÜEDADES'],
      extras: { nubes: true },
      escenario: 'mercado', props: 'mercado'
    }),
    /* Cocheras (pixel): el patio de maniobras de noche, bajo focos de sodio.
       Galpones, bidones y rieles apilados; los trenes van en amarillo de
       obra, celeste y hueso, que se leen bajo la luz naranja. La luz es
       baja, así que los objetos del juego llevan un poco más de brillo
       propio que en Ocaso. */
    cocheras: variante(BASE_PIXEL, {
      cielo: { arriba: 0x141a33, horizonte: 0x6a4a5a, sol: 0xffc070 }, niebla: [30, 150],
      sol: [0xffb060, 2.0, [-16, 14, -40]], hemi: [0xffc890, 0x2a2238, 1.15],
      c: {
        grava: 0x6a564c, tierra: 0x524444, muro: 0x8a7a7a, acera: 0x7a6a66, bordillo: 0x5a4c4c, traviesa: 0x4a3428,
        edificios: [0x4a5068, 0x5a4a5a, 0x6a5040, 0x3f4a5f], cornisa: 0x2a2436, marco: 0x2a2436, vidrioEd: 0xffb040, vitrina: 0x6a4030,
        trenes: [0xe8b030, 0x5ab4d8, 0xece3cc], acentos: [0x2a2442, 0xfff1d4, 0x2a2442],
        arboles: [0x3f5a3a], tronco: 0x4a3428, bidones: [0x3a6aa0, 0xb04a30, 0x4a7a4a], oxido: 0x8a4a2a, senal: 0xff3a2a
      },
      carteles: ['TALLER', 'VÍA 7', 'TURNO NOCHE', 'CASINO', 'BODEGA'],
      extras: { nubes: false, disco: false },
      legible: { brillo: 0.12, niebla: 1.8 },
      escenario: 'cocheras', props: 'cocheras'
    }),
    /* Muelle (neón): la estación del puerto adonde la línea nunca llegó,
       de noche y con lluvia. La ciudad es azul (agua, grúas, faro); por eso
       los trenes y la rampa van en tonos cálidos, el único color caliente
       de la pantalla, y no se pierden en ella. */
    muelle: variante(BASE_NEON, {
      cielo: { arriba: 0x020814, horizonte: 0x0c3050, sol: 0x5ad8ff }, nieblaColor: 0x061626,
      hemi: [0x5a8ac8, 0x061018, 0.55],
      c: {
        trenes: [0xffe14d, 0xff8a3d, 0xff6ab4], acentos: [0xffffff, 0xffe14d, 0xffe14d], techoTren: 0xc96a35, vidrio: 0xffe9b0,
        riel: 0x5ad8ff, bordillo: 0x5ad8ff, traviesa: 0x1a3a5a, rejilla: 0x1a4a7a, muro: 0x14304a,
        edificios: [0x2a6df4, 0x22e5ff, 0x3a4aff], ventanas: [0x5ad8ff, 0xffe14d, 0x22e5ff, 0x0a1426, 0x0a1426, 0x0a1426],
        cornisa: 0x2a6df4, catenaria: 0x5ad8ff, farol: 0xffe9a0, tubo: 0xffc04d, toldos: [[0x22e5ff, 0x0a2a44]],
        rampa: 0xff9a3d, barrera: 0xff3d6e, barrera2: 0xffe14d, oro: 0xffe14d,
        cuerda: 0xe8c890, carga: [0xff5a3c, 0x22e5ff, 0xffe14d]
      },
      carteles: ['PESCADERÍA', 'FARO', 'CAPITANÍA', '24H', 'MARISCOS'],
      extras: { synth: null, estrellas: false },
      escenario: 'muelle', props: 'muelle'
    }),
    /* Fin de la Línea con historia: el mismo amanecer del «alba» (que queda
       sin tocar para City), con los grafitis y los afiches del final. */
    fin: variante(PALETAS.alba, {})
  };
}

/** Le suma a cada paleta de la Línea 3 su parte de la historia: grafitis
    (en `grafitisLore`, aparte de los de siempre, porque solo salen con la
    historia encendida), letreros de tienda y la marca `historia` (qué
    afiches lleva). No toca los objetos base: reemplaza cada entrada por una
    copia. Las paletas con `tren317` ven pasar el tren perdido a lo lejos. */
export function sumaHistoria(PALETAS, variante) {
  if (!H) return;                                                          // sin historia.js, todo queda como antes
  const CON_317 = { cocheras: true, muelle: true, oxido: true };           // donde se ve el 317 cruzando el horizonte
  for (const clave of Object.keys(H.LORE)) {
    const pal = PALETAS[clave];
    if (!pal) continue;
    const lore = H.LORE[clave];
    PALETAS[clave] = variante(pal, {
      grafitisLore: lore.grafitis,                                         // los grafitis de la historia
      carteles: [...pal.carteles, ...lore.carteles],                        // los letreros de siempre y los de la historia
      historia: clave,                                                     // qué afiches lleva (historia.js: AFICHES)
      tren317: !!CON_317[clave]
    });
  }
}

/* ===================================================================
   2. LOS AFICHES (un atlas de 4 × 2 por paleta)
   =================================================================== */

const CEL_W = 256, CEL_H = 512, COLS = 4, FILAS = 2;   // cada afiche: 256 × 512 px; el atlas, 1024 × 1024
const AFICHE_W = 1.4, AFICHE_H = 2.8;                  // en el mundo: 1,4 × 2,8 m (el panel y sus dos patas)

/** Corta un texto en renglones que quepan en `ancho` px con la fuente ya puesta. */
function renglones(x, texto, ancho) {
  const palabras = String(texto).split(' '), out = [];
  let linea = '';
  for (const p of palabras) {
    const prueba = linea ? linea + ' ' + p : p;
    if (x.measureText(prueba).width > ancho && linea) { out.push(linea); linea = p; } else linea = prueba;
  }
  if (linea) out.push(linea);
  return out;
}
/** Escribe `texto` centrado en (cx, y), con la fuente más grande (de `tam`
    hacia abajo) que lo deja en `max` renglones de `ancho` px. Devuelve el
    y donde terminó. Ejemplo: un titular de 4 palabras sale en 2 renglones de 34 px. */
function parrafo(x, texto, cx, y, ancho, tam, max, fuente, color) {
  let t = tam, ls;
  for (; t > 10; t -= 2) { x.font = fuente.replace('#', t); ls = renglones(x, texto, ancho); if (ls.length <= max) break; }
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'top';
  ls.forEach((l, i) => x.fillText(l, cx, y + i * t * 1.08));
  return y + ls.length * t * 1.08;
}
/** Un rectángulo de esquinas redondeadas (el camino; se rellena aparte). */
function rr(x, a, b, w, h, r) {
  x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
}

/* ---- los retratos (dibujados con trazos: ninguna imagen se descarga) ----
   Cada uno en un recuadro de `s` px de lado con centro (cx, cy). */
const RETRATOS = {
  /** Don Ramón: gorra azul con placa dorada, bigote blanco y chaqueta de inspector. */
  ramon(x, cx, cy, s) {
    const P = H.PERSONAJES.ramon, k = s / 170;
    x.fillStyle = P.gorra; rr(x, cx - 70 * k, cy + 38 * k, 140 * k, 60 * k, 26 * k); x.fill();             // los hombros (chaqueta)
    x.fillStyle = P.placa; x.fillRect(cx + 26 * k, cy + 56 * k, 16 * k, 12 * k);                          // la placa del pecho
    x.fillStyle = P.piel; x.beginPath(); x.ellipse(cx, cy, 42 * k, 50 * k, 0, 0, 7); x.fill();           // la cara
    x.fillStyle = P.bigote; x.beginPath(); x.ellipse(cx - 14 * k, cy + 16 * k, 18 * k, 8 * k, 0.2, 0, 7); x.ellipse(cx + 14 * k, cy + 16 * k, 18 * k, 8 * k, -0.2, 0, 7); x.fill();   // el bigote
    x.fillStyle = '#2a2a2a'; x.fillRect(cx - 20 * k, cy - 6 * k, 8 * k, 6 * k); x.fillRect(cx + 12 * k, cy - 6 * k, 8 * k, 6 * k);   // los ojos
    x.fillStyle = P.bigote; x.fillRect(cx - 44 * k, cy - 18 * k, 8 * k, 26 * k); x.fillRect(cx + 36 * k, cy - 18 * k, 8 * k, 26 * k);   // las canas de los lados
    x.fillStyle = P.gorra; rr(x, cx - 46 * k, cy - 66 * k, 92 * k, 40 * k, 10 * k); x.fill();             // la gorra
    x.fillStyle = '#10213a'; x.fillRect(cx - 52 * k, cy - 30 * k, 104 * k, 10 * k);                       // la visera
    x.fillStyle = P.placa; x.beginPath(); x.arc(cx, cy - 46 * k, 8 * k, 0, 7); x.fill();                  // la placa de la gorra
  },
  /** Marta Quiroga: gorra de maquinista a rayas, trenza gris y bufanda roja. */
  marta(x, cx, cy, s) {
    const P = H.PERSONAJES.marta, k = s / 170;
    x.fillStyle = '#3b4a5a'; rr(x, cx - 66 * k, cy + 40 * k, 132 * k, 58 * k, 24 * k); x.fill();          // los hombros (overol)
    x.fillStyle = P.bufanda; rr(x, cx - 40 * k, cy + 30 * k, 80 * k, 22 * k, 10 * k); x.fill();           // la bufanda
    x.fillRect(cx + 18 * k, cy + 44 * k, 14 * k, 34 * k);                                                 // la punta que cuelga
    x.fillStyle = P.trenza; x.beginPath(); x.ellipse(cx + 46 * k, cy + 30 * k, 11 * k, 36 * k, -0.3, 0, 7); x.fill();   // la trenza
    x.fillStyle = P.piel; x.beginPath(); x.ellipse(cx, cy, 38 * k, 48 * k, 0, 0, 7); x.fill();            // la cara
    x.fillStyle = P.trenza; x.beginPath(); x.ellipse(cx, cy - 30 * k, 40 * k, 20 * k, 0, Math.PI, 0); x.fill();   // el pelo bajo la gorra
    x.fillStyle = '#2a2a2a'; x.fillRect(cx - 18 * k, cy - 4 * k, 8 * k, 6 * k); x.fillRect(cx + 10 * k, cy - 4 * k, 8 * k, 6 * k);   // los ojos
    x.strokeStyle = '#7a4a3a'; x.lineWidth = 3 * k; x.beginPath(); x.arc(cx, cy + 14 * k, 12 * k, 0.2, Math.PI - 0.2); x.stroke();   // media sonrisa
    x.fillStyle = P.gorra; rr(x, cx - 44 * k, cy - 70 * k, 88 * k, 40 * k, 14 * k); x.fill();             // la gorra de maquinista…
    x.fillStyle = P.raya; for (let i = -3; i <= 3; i++) x.fillRect(cx + i * 12 * k - 2 * k, cy - 68 * k, 4 * k, 36 * k);   // …a rayas
    x.fillStyle = '#1f2f48'; x.fillRect(cx - 50 * k, cy - 34 * k, 100 * k, 9 * k);                        // la visera
  },
  /** Tornillo: perro café con las orejas oscuras, la lengua afuera y collar rojo. */
  tornillo(x, cx, cy, s) {
    const P = H.PERSONAJES.tornillo, k = s / 170;
    x.fillStyle = P.mancha; x.beginPath(); x.ellipse(cx - 46 * k, cy - 18 * k, 18 * k, 38 * k, 0.4, 0, 7); x.ellipse(cx + 46 * k, cy - 18 * k, 18 * k, 38 * k, -0.4, 0, 7); x.fill();   // las orejas
    x.fillStyle = P.pelo; x.beginPath(); x.ellipse(cx, cy, 46 * k, 52 * k, 0, 0, 7); x.fill();            // la cabeza
    x.fillStyle = '#f0dcc0'; x.beginPath(); x.ellipse(cx, cy + 24 * k, 28 * k, 22 * k, 0, 0, 7); x.fill();   // el hocico
    x.fillStyle = '#1a1a1a'; x.beginPath(); x.ellipse(cx, cy + 12 * k, 10 * k, 7 * k, 0, 0, 7); x.fill();    // la nariz
    x.beginPath(); x.arc(cx - 18 * k, cy - 12 * k, 6 * k, 0, 7); x.arc(cx + 18 * k, cy - 12 * k, 6 * k, 0, 7); x.fill();   // los ojos
    x.fillStyle = '#e86a7a'; rr(x, cx - 7 * k, cy + 34 * k, 14 * k, 20 * k, 6 * k); x.fill();             // la lengua
    x.fillStyle = P.collar; x.fillRect(cx - 40 * k, cy + 52 * k, 80 * k, 12 * k);                         // el collar
    x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(cx, cy + 70 * k, 8 * k, 0, 7); x.fill();               // la plaquita
  },
  /** Tú, en un «se busca»: sudadera, gorra y la cara dibujada de memoria (un signo). */
  corredor(x, cx, cy, s) {
    const P = H.PERSONAJES.corredor, k = s / 170;
    x.fillStyle = P.sudadera; rr(x, cx - 68 * k, cy + 36 * k, 136 * k, 62 * k, 28 * k); x.fill();         // la sudadera
    x.fillStyle = '#f1c19c'; x.beginPath(); x.ellipse(cx, cy, 40 * k, 48 * k, 0, 0, 7); x.fill();        // la cara
    x.fillStyle = P.gorra; rr(x, cx - 42 * k, cy - 62 * k, 84 * k, 34 * k, 14 * k); x.fill();             // la gorra
    x.fillRect(cx - 4 * k, cy - 34 * k, 62 * k, 9 * k);                                                    // la visera, de lado
    x.fillStyle = 'rgba(40,30,30,.75)'; x.font = `${Math.round(64 * k)}px "Lilita One", "Arial Black", sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', cx, cy + 6 * k);                   // nadie te vio la cara: corres demasiado rápido
  }
};

/** Dibuja un afiche en la celda que empieza en (ox, oy). `estilo` cambia el
    papel: en neón son cajas de luz (fondo oscuro, letras encendidas). */
function dibujaAfiche(x, af, ox, oy, estilo) {
  const neon = estilo === 'neon', pixel = estilo === 'pixel';
  const titulo = pixel ? '#px "Press Start 2P", monospace' : neon ? '700 #px Orbitron, "Arial Black", sans-serif' : '#px "Lilita One", "Arial Black", sans-serif';
  const texto = pixel ? '#px "Press Start 2P", monospace' : '700 #px Arial, sans-serif';
  const W = CEL_W, PH = 440;                                               // el panel ocupa 440 px de alto; abajo van las patas
  x.save(); x.translate(ox, oy);
  // las patas y el marco del mupi (oscuros, para que el afiche se recorte sobre cualquier fondo)
  x.fillStyle = neon ? '#1a1030' : '#2a2f38';
  x.fillRect(46, PH - 4, 18, CEL_H - PH + 4); x.fillRect(W - 64, PH - 4, 18, CEL_H - PH + 4);
  rr(x, 6, 6, W - 12, PH - 6, 14); x.fill();
  const a = 20, b = 20, w = W - 40, h = PH - 34;                             // el papel
  const papel = af.t === 'anuncio' ? af.fondo : af.t === 'mapa' ? '#16223a' : neon ? '#0c0a1c' : '#f4efe4';
  x.fillStyle = papel; x.fillRect(a, b, w, h);
  const tinta = neon ? '#e9fbff' : '#1d2233';
  if (af.t === 'aviso') {
    x.fillStyle = af.color; x.fillRect(a, b, w, 56);                           // la franja de color con la cabeza
    parrafo(x, af.cabeza, W / 2, b + 12, w - 16, 30, 1, titulo, neon ? '#0c0a1c' : '#ffffff');
    const fin = parrafo(x, af.titulo, W / 2, b + 84, w - 20, 40, 5, titulo, neon ? af.color : tinta);
    parrafo(x, af.pie, W / 2, Math.max(fin + 22, b + 290), w - 22, 18, 4, texto, neon ? '#b8c8e8' : '#4a5060');
    // el logo de la línea abajo: un 3 en un círculo
    x.fillStyle = af.color; x.beginPath(); x.arc(W / 2, b + h - 30, 20, 0, 7); x.fill();
    x.fillStyle = '#ffffff'; x.font = titulo.replace('#', 24); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('3', W / 2, b + h - 28);
  } else if (af.t === 'retrato') {
    const busca = /BUSCA|VISTO/.test(af.cabeza);                              // un «se busca» va en rojo; un homenaje, en azul
    parrafo(x, af.cabeza, W / 2, b + 12, w - 16, 34, 2, titulo, busca ? '#c8302a' : neon ? '#22e5ff' : '#1f3a5f');
    x.fillStyle = neon ? '#1a1638' : '#e2dccd'; x.fillRect(a + 18, b + 64, w - 36, 190);   // el recuadro de la foto
    x.save(); x.beginPath(); x.rect(a + 18, b + 64, w - 36, 190); x.clip();
    if (RETRATOS[af.quien]) RETRATOS[af.quien](x, W / 2, b + 160, 180);
    x.restore();
    const fin = parrafo(x, af.titulo, W / 2, b + 266, w - 16, 32, 2, titulo, tinta);
    parrafo(x, af.pie, W / 2, fin + 10, w - 20, 17, 3, texto, neon ? '#b8c8e8' : '#4a5060');
  } else if (af.t === 'anuncio') {
    // publicidad del barrio: rayas de fondo y el titular grande en su tinta
    x.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 9; i++) x.fillRect(a, b + i * 48, w, 20);
    x.fillStyle = af.tinta; x.globalAlpha = 0.9;
    for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(a + 24 + (i * 37) % (w - 40), b + 30 + (i * 71) % 90, 4, 0, 7); x.fill(); }   // estrellitas
    x.globalAlpha = 1;
    const fin = parrafo(x, af.titulo, W / 2, b + 130, w - 20, 44, 4, titulo, af.tinta);
    x.fillStyle = af.tinta; x.fillRect(a + 40, fin + 14, w - 80, 4);
    parrafo(x, af.pie, W / 2, fin + 30, w - 24, 20, 4, texto, af.tinta);
  } else if (af.t === 'mapa') {
    // el plano de la Línea 3: una raya con las estaciones en el orden de la vía y «usted está aquí»
    parrafo(x, 'LÍNEA 3', W / 2, b + 12, w - 16, 32, 1, titulo, '#ffd23f');
    const lista = MOTOR ? MOTOR.ESTACIONES : [];
    const y0 = b + 66, y1 = b + h - 22, xl = a + 34;
    x.strokeStyle = '#ff5a3c'; x.lineWidth = 8; x.beginPath(); x.moveTo(xl, y0); x.lineTo(xl, y1); x.stroke();
    lista.forEach((e, i) => {
      const y = y0 + (y1 - y0) * (lista.length > 1 ? i / (lista.length - 1) : 0), aqui = e.paleta === af.aqui || e.id === af.aqui;
      x.fillStyle = aqui ? '#ffd23f' : '#ffffff'; x.beginPath(); x.arc(xl, y, aqui ? 11 : 7, 0, 7); x.fill();
      x.strokeStyle = '#16223a'; x.lineWidth = 3; x.stroke();
      x.font = (aqui ? titulo : texto).replace('#', aqui ? (pixel ? 11 : 17) : (pixel ? 8 : 14)); x.textAlign = 'left'; x.textBaseline = 'middle';
      x.fillStyle = aqui ? '#ffd23f' : '#c8d4ea'; x.fillText(e.nombre.toUpperCase(), xl + 18, y);
      if (aqui) { x.font = texto.replace('#', pixel ? 7 : 12); x.fillStyle = '#ffffff'; x.fillText('◀ USTED ESTÁ AQUÍ', xl + 18, y + (pixel ? 14 : 17)); }
    });
  }
  // el papel se nota: un poco de luz arriba y sombra abajo (no en neón, donde es una caja de luz pareja)
  if (!neon) { const g = x.createLinearGradient(0, b, 0, b + h); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(0,0,0,.14)'); x.fillStyle = g; x.fillRect(a, b, w, h); }
  x.restore();
}

/** El atlas de afiches de una paleta: hasta ocho, en orden, de izquierda a
    derecha y de arriba abajo (si hay menos de ocho, las celdas sobrantes
    quedan vacías y no se usan). */
function atlasAfiches(kit, h) {
  const lista = H ? H.afichesDe(kit.pal.historia) : [];
  const [c, x] = h.lienzo(CEL_W * COLS, CEL_H * FILAS);
  lista.slice(0, COLS * FILAS).forEach((af, i) => dibujaAfiche(x, af, (i % COLS) * CEL_W, Math.floor(i / COLS) * CEL_H, kit.pal.estilo));
  return c;
}

/** Las texturas que mundo.js no conoce (su `Kit.tex` pregunta aquí antes de
    rendirse): el atlas de afiches y los grafitis de la historia. Los dos
    nombres empiezan con «graf» a propósito: así su material sale con
    transparencia recortada (ver Kit.mat), y las patas del mupi no traen un
    rectángulo de fondo. Devuelve null si el nombre no es de aquí. */
export function textura(kit, tipo, arg, h) {
  const px = kit.pixel;
  if (tipo === 'grafAfiches') return h.aTextura(atlasAfiches(kit, h), { repetir: false, pixel: px });
  if (tipo === 'grafL') {
    const lista = kit.pal.grafitisLore || [];
    if (!lista.length) return null;
    const g = lista[+arg[0] % lista.length];
    return h.aTextura(h.TEX.grafiti(kit.az, g[0], g[1], g[2], kit.neon ? 0.85 : 1), { repetir: false, pixel: px });
  }
  return null;
}

/** Cuántos afiches tiene la paleta de este kit (0 si no tiene historia). */
const nAfiches = kit => (H && kit.pal.historia ? Math.min(COLS * FILAS, H.afichesDe(kit.pal.historia).length) : 0);

/** Un afiche de pie en la vereda: un solo plano con la celda `i` del atlas,
    girado hacia la vía para que se lea al acercarse (en el lado derecho
    mira hacia la izquierda y hacia la cámara, y al revés en el otro). */
function afiche(kit, lado, i, h) {
  const geo = new THREE.PlaneGeometry(AFICHE_W, AFICHE_H);
  const uv = geo.attributes.uv, col = i % COLS, fila = Math.floor(i / COLS), m = 0.004;   // un margen chico: el filtrado no trae la celda vecina
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (col + m + uv.getX(k) * (1 - 2 * m)) / COLS, 1 - (fila + 1 - m - uv.getY(k) * (1 - 2 * m)) / FILAS);
  const a = new h.Arma(kit);
  // en neón el afiche es una caja de luz: sin sombreado, pero a un 75 % (a todo color encandilaba más que los obstáculos)
  a.pon(geo, (kit.neon ? 'texluz:' : 'tex:') + 'grafAfiches', kit.neon ? 0xbfbfbf : 0xffffff, [0, AFICHE_H / 2, 0], [0, -lado * 0.62, 0]);
  const g = a.hecho(false);                                                 // sin sombras: es un cartel delgado
  g.userData.afiche = i;                                                    // para encontrarlo al probar (no lo usa el juego)
  geo.dispose();
  return g;
}
/** Un grafiti de la historia en el muro (igual que los de siempre). */
function grafitiLore(kit, lado, i, h) {
  const a = new h.Arma(kit);
  a.pon(new THREE.PlaneGeometry(3.4, 1.0), (kit.neon ? 'texluz:grafL|' : 'tex:grafL|') + i, 0xffffff, [0, 0, 0], [0, -lado * Math.PI / 2, 0]);
  return a.hecho(false);
}

/** Pasos para llenar de antemano las reservas de afiches y grafitis de la
    historia (uno de cada por lado), con la misma función `pre` del kit. */
export function preparaKit(kit, pre, h) {
  const n = nAfiches(kit);
  for (const lado of [-1, 1]) {
    for (let i = 0; i < n; i++) pre('afiche' + lado + '|' + i, () => afiche(kit, lado, i, h), 1);
    const nl = (kit.pal.grafitisLore || []).length;
    for (let i = 0; i < nl; i++) pre('grafL' + lado + '|' + i, () => grafitiLore(kit, lado, i, h), 1);
  }
}

/** Decide qué va en un lugar de grafiti del muro cuando la historia está
    encendida: uno de cada tres es un afiche (en el orden de la lista, para
    que la historia se lea), uno de cada seis un grafiti de la historia, y
    el resto, null (el grafiti de siempre). Lleva su propia cuenta por lado,
    no usa el azar del kit: así la ciudad sale igual que antes en todo lo
    demás. Devuelve {obj, pos, largo} o null. */
export function decoraMuro(kit, lado, h) {
  const n = nAfiches(kit);
  if (!n) return null;
  kit.cuentaMuro = kit.cuentaMuro || { [-1]: 0, [1]: 0, afiche: 0, graf: 0 };
  const c = kit.cuentaMuro[lado]++;
  if (c % 3 === 0) {                                                        // un afiche: los dos lados comparten el orden
    const i = kit.cuentaMuro.afiche++ % n;
    const obj = kit.saca('afiche' + lado + '|' + i, () => afiche(kit, lado, i, h));
    return { obj, pos: [lado * 5.0, h.SUELO, 0], largo: 1 };
  }
  const nl = (kit.pal.grafitisLore || []).length;
  if (nl && c % 6 === 2) {                                                  // un grafiti de la historia
    const i = kit.cuentaMuro.graf++ % nl;
    const obj = kit.saca('grafL' + lado + '|' + i, () => grafitiLore(kit, lado, i, h));
    return { obj, pos: [lado * 3.56, 0.6, 0], largo: 1.8 };
  }
  return null;
}

/* ===================================================================
   3. LA UTILERÍA DE LA VEREDA (en vez de árboles)
   ===================================================================
   Cada estación nueva tiene tres piezas; el kit pide tres «árboles» y aquí
   se le da una de cada. Están armadas mirando hacia −x (la vía, en el lado
   derecho): en el izquierdo mundo.js las gira media vuelta (ver giroProp).
   Van instanciadas como los árboles: una llamada al GPU por material de
   cada pieza para todas las de un lado. Ninguna lleva bordes de neón (las
   líneas no se pueden instanciar): las luces son piezas 'luz'. */

/** Una pieza de utilería para el kit, o null si su paleta no tiene. */
export function prop(kit, h) {
  const tipo = kit.pal.props;
  if (!tipo || !PROPS[tipo]) return null;
  kit.cuentaProps = (kit.cuentaProps || 0) + 1;                            // la primera, la segunda y la tercera son distintas
  const g = PROPS[tipo][(kit.cuentaProps - 1) % PROPS[tipo].length](kit, h);
  g.userData.largo = g.userData.largo || 1.4;
  return g;
}
/** El giro de una pieza de utilería en la vereda: de frente a la vía, con
    un poco de azar (`az` entre 0 y 1) para que no salgan todas en fila. */
export function giroProp(lado, az) { return (lado > 0 ? 0 : Math.PI) + (az - 0.5) * 0.3; }

const PROPS = {
  mercado: [
    /** Un puesto de feria: mesón, cuatro palos, toldo a rayas, fruta y un farolillo. */
    (kit, h) => {
      const c = kit.c, a = new h.Arma(kit);
      a.pon(h.CAJA, 'plano', c.madera, [0, 0.55, 0], null, [0.9, 0.82, 1.9]);                         // el mesón
      a.pon(h.CAJA, 'plano', 0xfff1d4, [-0.46, 0.62, 0], null, [0.02, 0.5, 1.7]);                     // el mantel del frente
      for (const [px, pz] of [[-0.42, -0.9], [0.42, -0.9], [-0.42, 0.9], [0.42, 0.9]]) a.pon(h.CILINDRO_CHICO, 'plano', c.tronco, [px, 1.2, pz], null, [0.07, 2.4, 0.07]);
      a.pon(h.CAJA, 'tex:toldo|' + 1, 0xffffff, [-0.1, 2.45, 0], [0, 0, 0.22], [1.3, 0.06, 2.1]);     // el toldo, inclinado hacia la vía
      const frutas = [0xff7a2a, 0xe8463b, 0x8ad04a, 0xffd23f];
      for (let i = 0; i < 9; i++) a.pon(h.ESFERA, 'plano', frutas[i % 4], [-0.15 + (i % 3) * 0.16, 1.02, -0.6 + Math.floor(i / 3) * 0.6], null, 0.22);   // fruta en tres canastos
      a.pon(h.ESFERA, 'luz', c.farolillos[0], [-0.5, 2.0, 0.5], null, [0.3, 0.38, 0.3]);               // un farolillo colgando
      return a.hecho();
    },
    /** Un poste de farolillos: tres de papel colgados de un travesaño. */
    (kit, h) => {
      const c = kit.c, a = new h.Arma(kit);
      a.pon(h.CILINDRO_CHICO, 'plano', c.tronco, [0, 1.7, 0], null, [0.09, 3.4, 0.09]);
      a.pon(h.CAJA, 'plano', c.tronco, [-0.6, 3.3, 0], null, [1.3, 0.06, 0.06]);
      c.farolillos.slice(0, 3).forEach((col, i) => {
        const x = -0.2 - i * 0.42;
        a.pon(h.CAJA, 'plano', 0x2a2a2a, [x, 3.1, 0], null, [0.02, 0.4, 0.02]);                     // el hilo
        a.pon(h.ESFERA, 'luz', col, [x, 2.75, 0], null, [0.36, 0.46, 0.36]);                         // el farolillo encendido
        a.pon(h.CAJA, 'plano', 0x3a2a20, [x, 2.48, 0], null, [0.12, 0.05, 0.12]);                    // su base
      });
      return a.hecho();
    },
    /** Cajones de fruta apilados con un farolillo encima. */
    (kit, h) => {
      const c = kit.c, a = new h.Arma(kit);
      for (const [px, py, pz] of [[0, 0.25, -0.35], [0, 0.25, 0.35], [0.05, 0.75, 0]]) {
        a.pon(h.CAJA, 'plano', c.madera, [px, py, pz], null, [0.6, 0.48, 0.66]);
        a.pon(h.CAJA, 'plano', 0x6a4630, [px - 0.31, py, pz], null, [0.02, 0.1, 0.62]);               // la tabla oscura del frente
      }
      for (let i = 0; i < 4; i++) a.pon(h.ESFERA, 'plano', [0x8ad04a, 0xff7a2a][i % 2], [-0.05 + (i % 2) * 0.12, 1.05, -0.15 + i * 0.1], null, 0.2);
      a.pon(h.ESFERA, 'luz', c.farolillos[3], [0.05, 1.45, 0], null, [0.3, 0.38, 0.3]);
      return a.hecho();
    }
  ],
  cocheras: [
    /** Dos bidones de aceite, uno volcado. */
    (kit, h) => {
      const c = kit.c, a = new h.Arma(kit);
      a.pon(h.CILINDRO, 'plano', c.bidones[0], [0, 0.45, -0.35], null, [0.6, 0.9, 0.6]);
      a.pon(h.CILINDRO, 'plano', 0x2a2436, [0, 0.62, -0.35], null, [0.62, 0.05, 0.62]);              // los aros
      a.pon(h.CILINDRO, 'plano', c.bidones[1], [0, 0.3, 0.45], [Math.PI / 2, 0, 0.3], [0.6, 0.9, 0.6]);   // el volcado
      a.pon(h.CILINDRO, 'plano', c.oxido, [-0.2, 0.02, 0.9], null, [0.9, 0.02, 0.6]);                  // la mancha de aceite
      return a.hecho();
    },
    /** Rieles viejos apilados sobre dos durmientes. */
    (kit, h) => {
      const c = kit.c, a = new h.Arma(kit);
      for (const pz of [-1, 1]) a.pon(h.CAJA, 'plano', c.traviesa, [0, 0.08, pz], null, [0.9, 0.16, 0.22]);
      for (let i = 0; i < 5; i++) a.pon(h.CAJA, 'plano', i % 2 ? c.oxido : 0x6a6470, [-0.3 + (i % 3) * 0.3, 0.22 + Math.floor(i / 3) * 0.12, 0], null, [0.12, 0.12, 2.8]);
      return a.hecho();
    },
    /** Una señal de vía: poste, caja con tres luces (la roja encendida) y su escalerita. */
    (kit, h) => {
      const c = kit.c, a = new h.Arma(kit);
      a.pon(h.CAJA, 'plano', 0x2a2436, [0, 1.6, 0], null, [0.14, 3.2, 0.14]);
      a.pon(h.CAJA, 'plano', 0x1a1622, [-0.05, 3.25, 0], null, [0.3, 0.95, 0.4]);
      a.pon(h.CAJA, 'luz', c.senal, [-0.21, 3.52, 0], null, [0.04, 0.2, 0.2]);                       // la roja, encendida
      for (const py of [3.25, 2.98]) a.pon(h.CAJA, 'plano', 0x3a3448, [-0.21, py, 0], null, [0.04, 0.2, 0.2]);   // las otras dos, apagadas
      for (let i = 0; i < 6; i++) a.pon(h.CAJA, 'plano', 0x4a4458, [0.12, 0.3 + i * 0.42, 0], null, [0.04, 0.04, 0.3]);   // los peldaños
      return a.hecho();
    }
  ],
  muelle: [
    /** Una bita de amarre con su cuerda enrollada y una franja de luz. */
    (kit, h) => {
      const c = kit.c, a = new h.Arma(kit);
      a.pon(h.CILINDRO, 'plano', 0x1a2230, [0, 0.4, 0], null, [0.42, 0.8, 0.42]);
      a.pon(h.CILINDRO, 'plano', 0x1a2230, [0, 0.84, 0], null, [0.6, 0.1, 0.6]);
      a.pon(h.CILINDRO, 'luz', 0x7a6a28, [0, 0.62, 0], null, [0.44, 0.06, 0.44]);                     // la franja amarilla (tenue: no es un obstáculo)
      a.pon(new THREE.TorusGeometry(0.42, 0.07, 6, 16), 'plano', c.cuerda, [0, 0.12, 0.2], [Math.PI / 2, 0, 0]);   // la cuerda en el suelo
      return a.hecho();
    },
    /** Cajas de carga apiladas, con una franja de luz cada una. */
    (kit, h) => {
      const c = kit.c, a = new h.Arma(kit);
      [[0, 0.4, -0.5, 0], [0, 0.4, 0.5, 1], [0.05, 1.2, 0, 2]].forEach(([px, py, pz, i]) => {
        a.pon(h.CAJA, 'plano', 0x1a2a3a, [px, py, pz], null, [0.85, 0.8, 0.95]);
        a.pon(h.CAJA, 'luz', new THREE.Color(c.carga[i]).multiplyScalar(0.55).getHex(), [px - 0.43, py + 0.25, pz], null, [0.02, 0.08, 0.9]);
      });
      return a.hecho();
    },
    /** Un farol de pescador con un salvavidas colgado del poste. */
    (kit, h) => {
      const c = kit.c, a = new h.Arma(kit);
      a.pon(h.CILINDRO_CHICO, 'plano', 0x1a2230, [0, 1.3, 0], null, [0.1, 2.6, 0.1]);
      a.pon(h.ESFERA, 'luz', new THREE.Color(c.farol).multiplyScalar(0.8).getHex(), [0, 2.75, 0], null, [0.3, 0.38, 0.3]);
      a.pon(h.CAJA, 'plano', 0x1a2230, [0, 2.98, 0], null, [0.36, 0.06, 0.36]);
      a.pon(new THREE.TorusGeometry(0.28, 0.07, 6, 14), 'luz', 0xa04a2a, [-0.1, 1.4, 0], [0, Math.PI / 2, 0]);   // el salvavidas
      return a.hecho();
    }
  ]
};

/* ===================================================================
   4. EL HORIZONTE (pintado en el grupo del cielo)
   ===================================================================
   Lo que se pone aquí viaja con la cámara (como el domo del cielo) y queda
   entre 150 y 175 m: se ve al fondo del pasillo de la vía, entre los
   edificios. Para que NUNCA tape un obstáculo: no escribe profundidad, se
   dibuja antes que todo (renderOrder −1, después del domo) y no lleva
   niebla (su color ya viene mezclado con el del horizonte, que es lo que
   la niebla haría). Todo lo de una estación va fundido en dos o tres mallas. */

/** Un material de silueta: color por vértice, sin luz, sin niebla, sin profundidad. */
const matFondo = (aditivo = false) => new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false, transparent: aditivo, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending });
/** Una malla de fondo con las geometrías ya preparadas, dibujada en el orden `orden`. */
function fondo(h, lista, aditivo, orden) {
  const m = new THREE.Mesh(h.funde(lista), matFondo(aditivo));
  m.renderOrder = orden; m.frustumCulled = false;
  for (const g of lista) g.dispose();
  return m;
}

/** Agrega al cielo `g` del kit el horizonte de su estación (si tiene). */
export function cielo(kit, g, h) {
  const pal = kit.pal, esc = pal.escenario;
  if (!esc) return;
  const hz = new THREE.Color(pal.nieblaColor ?? pal.cielo.horizonte);
  const tono = (col, k) => new THREE.Color(col).lerp(hz, k).getHex();     // el color mezclado con el horizonte (lo que haría la niebla)
  const az = h.azarDe(0x5EA + esc.length);                                  // el horizonte sale igual en cada visita
  const P = (geo, col, pos, rot, e) => h.prepara(geo, col, h.matriz(pos, rot, e));
  const piezas = [], luces = [];
  g.userData.escenario = {};                                                // lo que anima `ambiente` (focos, haz del faro…)
  if (esc === 'mercado') {
    // tejados bajos de dos aguas a lo ancho, y guirnaldas de ampolletas colgando de techo a techo
    let x = -120;
    while (x < 120) {
      const w = 8 + az() * 10, alto = 4 + az() * 7, z = -160 - az() * 12, y0 = -5;
      piezas.push(P(h.CAJA, tono(0x5a3048, 0.35), [x + w / 2, y0 + alto / 2, z], null, [w, alto, 1]));
      const techo = new THREE.ConeGeometry(w * 0.62, 3 + az() * 2, 4, 1); techo.rotateY(Math.PI / 4);
      piezas.push(P(techo, tono(0x7a3a3a, 0.35), [x + w / 2, y0 + alto + 1.4, z], null, [1, 1, 0.12]));
      if (az() < 0.7) {                                                     // una guirnalda hasta el techo siguiente
        const n = 9, largo = 8 + az() * 6;
        for (let i = 0; i <= n; i++) {
          const t = i / n, yy = y0 + alto + 0.5 - Math.sin(t * Math.PI) * 2.2;
          const col = [0xffd27a, 0xff8a5a, 0xfff1b0, 0xff7ad0][i % 4];
          luces.push(P(h.CAJA, col, [x + w / 2 + t * largo, yy, z + 2], null, 0.55));
        }
      }
      x += w + 1 + az() * 3;
    }
    g.add(fondo(h, piezas, false, -1), fondo(h, luces, true, -0.5));
  } else if (esc === 'cocheras') {
    // galpones con techo de diente de sierra, un estanque de agua en patas y dos torres de focos
    let x = -130;
    while (x < 130) {
      const w = 14 + az() * 10, alto = 6 + az() * 5, z = -165 - az() * 8, y0 = -5;
      piezas.push(P(h.CAJA, tono(0x2a2840, 0.3), [x + w / 2, y0 + alto / 2, z], null, [w, alto, 1]));
      for (let k = 0; k < Math.floor(w / 4); k++) {                         // los dientes del techo
        const d = new THREE.ConeGeometry(2.4, 2.6, 3, 1);                    // un triángulo (aplastado en z) inclinado: un diente
        piezas.push(P(d, tono(0x2a2840, 0.3), [x + 2 + k * 4, y0 + alto + 1.2, z], [0, 0, 0.5], [1, 1, 0.1]));
        luces.push(P(h.CAJA, 0xffb040, [x + 2.6 + k * 4, y0 + alto - 1.2, z + 0.6], null, [1.6, 0.6, 0.1]));   // una ventana encendida bajo cada diente
      }
      x += w + 4 + az() * 6;
    }
    // el estanque de agua
    piezas.push(P(h.CILINDRO, tono(0x3a3048, 0.3), [38, 14, -158], null, [7, 6, 7]));
    for (const s of [-2.6, 2.6]) piezas.push(P(h.CAJA, tono(0x3a3048, 0.3), [38 + s, 3, -158], null, [0.5, 16, 0.5]));
    // las torres de focos: un mástil y un tablero de luces arriba (lo que parpadea es el halo, ver ambiente)
    const halos = [];
    for (const tx of [-48, 72]) {
      piezas.push(P(h.CAJA, tono(0x1a1828, 0.3), [tx, 10, -150], null, [0.7, 30, 0.7]));
      luces.push(P(h.CAJA, 0xffd890, [tx, 25, -149], null, [4, 1.6, 0.2]));
      const s = h.sprite(0xffb050, 26, [tx, 25, -148], 0.55); s.material.fog = false; s.renderOrder = -0.4; halos.push(s); g.add(s);
    }
    g.add(fondo(h, piezas, false, -1), fondo(h, luces, false, -0.5));
    g.userData.escenario.focos = halos;
  } else if (esc === 'muelle') {
    // el mar: una franja oscura al fondo; grúas de contenedores; y el faro con su haz que gira
    piezas.push(P(h.CAJA, tono(0x041a2a, 0.15), [0, -4.2, -170], null, [400, 1.6, 1]));
    for (const [gx, alto] of [[-70, 30], [-38, 26], [56, 34], [92, 28]]) {
      piezas.push(P(h.CAJA, tono(0x10304a, 0.25), [gx, -5 + alto / 2, -165], null, [1.2, alto, 1]));          // el mástil
      piezas.push(P(h.CAJA, tono(0x10304a, 0.25), [gx + 6, -5 + alto, -165], null, [22, 1.2, 1]));            // la pluma
      piezas.push(P(h.CAJA, tono(0x10304a, 0.25), [gx - 1, -5 + alto + 4, -165], [0, 0, 0.45], [0.5, 9, 0.5]));   // el tirante
      luces.push(P(h.CAJA, 0xff3a3a, [gx + 16, -5 + alto + 0.9, -164], null, 0.8));                         // la luz roja de la punta
    }
    for (let i = 0; i < 14; i++) {                                         // contenedores apilados al pie de las grúas
      const cx = -90 + az() * 190, ch = 2.6;
      piezas.push(P(h.CAJA, tono([0x7a2a2a, 0x2a5a7a, 0x7a6a2a][i % 3], 0.4), [cx, -5 + ch / 2 + (i % 2) * ch, -160], null, [6, ch, 1]));
    }
    // el faro: torre a rayas, linterna encendida
    for (let k = 0; k < 6; k++) piezas.push(P(h.CILINDRO, tono(k % 2 ? 0xd8e0e8 : 0xa03030, 0.35), [-22, -3 + k * 3.2, -168], null, [3.4 - k * 0.25, 3.2, 3.4 - k * 0.25]));
    luces.push(P(h.CAJA, 0xfff1b0, [-22, 17.4, -167], null, [2.2, 2, 0.4]));
    g.add(fondo(h, piezas, false, -1), fondo(h, luces, false, -0.5));
    // el haz del faro: un triángulo largo que se apaga hacia la punta, aditivo, que gira sobre la linterna
    const pos = [0, 0, 0, 60, -4, 0, 60, 4, 0], col = [0.5, 0.48, 0.36, 0, 0, 0, 0, 0, 0];
    const gh = new THREE.BufferGeometry();
    gh.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gh.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    gh.computeVertexNormals();                                              // la oclusión ambiental pide normales en todo (ver geoFaro en mundo.js)
    const haz = new THREE.Mesh(gh, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    haz.position.set(-22, 17.4, -166); haz.renderOrder = -0.4; haz.frustumCulled = false; g.add(haz);
    g.userData.escenario.haz = haz;
  }
}

/* ===================================================================
   5. LOS SUCESOS DEL AMBIENTE
   ===================================================================
   Pequeñas cosas que pasan mientras se corre, propias de cada estación.
   Todas están lejos de los carriles o en el cielo, ninguna se mueve hacia
   la cámara de golpe, y con «reducir movimiento» (`mov.quieto`) se
   apagan los destellos y lo que parpadea. */

/** Prepara el ambiente de la estación del `kit` en la `escena`. Devuelve
    {paso(e, dt, camara, mov), quita()} o null si la estación no tiene nada.
    `lore`: ¿se cuenta la historia? (el 317 solo pasa en la Línea 3). */
export function ambiente(kit, escena, h, lore) {
  const pal = kit.pal, esc = pal.escenario, objs = [], az = h.azarDe(0xA3B1 + (esc || '').length);
  const pon = o => { o.frustumCulled = false; escena.add(o); objs.push(o); return o; };
  let farolillos = null, lluvia = null, destello = null, tren = null;
  let tRelampago = 9 + az() * 8, relampago = 0, t317 = 10 + az() * 6, reloj = 0;
  if (esc === 'mercado') {
    // farolillos de papel que suben despacio por los costados, lejos de la vía (|x| > 9 m)
    farolillos = [];
    for (let i = 0; i < 16; i++) {
      const s = pon(h.sprite(pal.c.farolillos[i % pal.c.farolillos.length], 1.1, [0, -50, 0], 0.85));
      s.material.fog = false; s.renderOrder = 2;
      farolillos.push({ s, x: (az() < 0.5 ? -1 : 1) * (9 + az() * 22), y: 2 + az() * 18, z: -20 - az() * 120, v: 0.5 + az() * 0.6, f: az() * 6 });
    }
  }
  if (esc === 'muelle') {
    // la lluvia: rayitas finas que caen inclinadas (una sola malla de segmentos)
    const N = 420, pos = new Float32Array(N * 6);
    lluvia = { N, pos, gotas: [] };
    for (let i = 0; i < N; i++) lluvia.gotas.push({ x: (az() - 0.5) * 50, y: az() * 18, z: 6 - az() * 110 });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); h.normalesFijas(g);
    lluvia.malla = pon(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.3, fog: false, depthWrite: false })));
    lluvia.malla.renderOrder = 2;
    // el relámpago: un velo claro sobre el cielo, detrás de todo (no tapa nada: se dibuja antes y sin profundidad)
    const gv = new THREE.PlaneGeometry(600, 300);
    destello = new THREE.Mesh(gv, new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    destello.renderOrder = -0.3; destello.visible = false; pon(destello);
  }
  if (lore && pal.tren317) {
    // el 317: un tren de luz cálida que cruza el horizonte de vez en cuando, con sus ventanas encendidas
    tren = pon(new THREE.Mesh(h.geoTren(h.L_VAGON * 3), new THREE.MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    tren.renderOrder = -0.45; tren.visible = false; tren.rotation.y = Math.PI / 2;
  }
  const sinSuceso = !farolillos && !lluvia && !tren && !(kit.cielo && kit.cielo.userData.escenario && (kit.cielo.userData.escenario.focos || kit.cielo.userData.escenario.haz));
  if (sinSuceso) return null;
  return {
    paso(e, dt, camara, mov) {
      reloj += dt;
      const vz = (e.v || 15) * dt * (e.menu ? 0 : 1);                         // lo que avanzó el mundo en este cuadro (en el menú, nada)
      const datos = kit.cielo && kit.cielo.userData.escenario || {};
      if (farolillos) for (const f of farolillos) {
        f.y += f.v * dt; f.z += vz;                                          // suben y pasan con el mundo
        if (f.y > 24 || f.z > 4) { f.y = 1 + az() * 4; f.z = -60 - az() * 90; }   // vuelven a salir de abajo, lejos
        f.s.position.set(f.x + Math.sin(reloj * 0.7 + f.f) * 0.6, f.y, f.z);
        f.s.material.opacity = mov.quieto ? 0.8 : 0.7 + 0.2 * Math.sin(reloj * 5 + f.f);   // la vela titila (salvo con reducir movimiento)
      }
      if (lluvia) {
        const p = lluvia.pos;
        lluvia.gotas.forEach((g, i) => {
          g.y -= dt * 24; g.x += dt * 5; g.z += vz;
          if (g.y < 0 || g.z > 6) { g.y = 10 + az() * 10; g.z = 4 - az() * 110; g.x = camara.position.x + (az() - 0.5) * 50; }
          p[i * 6] = g.x; p[i * 6 + 1] = g.y; p[i * 6 + 2] = g.z;
          p[i * 6 + 3] = g.x - 0.12; p[i * 6 + 4] = g.y + 0.6; p[i * 6 + 5] = g.z;   // la raya: 60 cm, inclinada por el viento
        });
        lluvia.malla.geometry.attributes.position.needsUpdate = true;
        // el relámpago: cada 12 a 24 s, dos destellos seguidos, suaves (nunca con reducir movimiento)
        tRelampago -= dt;
        if (tRelampago <= 0) { tRelampago = 12 + az() * 12; if (!mov.quieto && !e.menu) relampago = 0.5; }
        if (relampago > 0) {
          relampago -= dt;
          const k = relampago > 0.38 ? 1 : relampago > 0.3 ? 0.2 : relampago > 0.18 ? 0.7 : Math.max(0, relampago / 0.18) * 0.4;
          destello.visible = true; destello.material.opacity = 0.22 * k;
          destello.position.set(camara.position.x, camara.position.y + 40, camara.position.z - 175);
        } else destello.visible = false;
      }
      if (datos.focos) for (const [i, s] of datos.focos.entries()) {     // los focos del patio: de vez en cuando uno parpadea, como una ampolleta de sodio vieja
        const falla = !mov.quieto && Math.sin(reloj * 0.9 + i * 2.1) > 0.93;
        s.material.opacity = falla ? (Math.sin(reloj * 40) > 0 ? 0.15 : 0.55) : 0.55;
      }
      if (datos.haz) datos.haz.rotation.y = mov.quieto ? 0.6 : Math.sin(reloj * 0.35) * 1.2 + 0.4;   // el haz barre el mar de un lado a otro
      if (tren) {
        t317 -= dt;
        if (t317 <= 0 && !tren.visible && !e.menu) { tren.visible = true; tren.userData.x = -120; t317 = 38 + az() * 14; }
        if (tren.visible) {
          tren.userData.x += dt * 26;                                        // cruza a 26 m/s: unos nueve segundos de lado a lado
          tren.position.set(camara.position.x + tren.userData.x, camara.position.y - 3.2, camara.position.z - 145);
          if (tren.userData.x > 120) tren.visible = false;
        }
      }
    },
    quita() {
      for (const o of objs) {
        escena.remove(o);
        if (o.isSprite) { o.material.dispose(); continue; }                   // la geometría de los sprites es de three.js, compartida
        if (o.geometry && o.geometry !== h.geoTren(h.L_VAGON * 3)) o.geometry.dispose();   // la del tren va en la caché de mundo.js
        o.material && o.material.dispose();
      }
      objs.length = 0;
    }
  };
}
