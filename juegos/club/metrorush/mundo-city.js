/* Metro Rush — el dibujo del mundo City.

   QUÉ HACE, EN GLOBAL
   Todo lo que City agrega a la escena 3D, en un módulo aparte de mundo.js:
     · las paletas de los cinco distritos (y sus versiones con otro estilo,
       cuando el jugador fija uno en las Opciones);
     · la escenografía de los costados de cada distrito: las casas con techo
       a dos aguas del Barrio Sur, las bodegas, contenedores, grúas, barcos
       y el mar de Los Muelles, las torres de vidrio y las palmeras del
       Bulevar Aurora, el pasto, los lagos y los patos del Parque de los
       Lagos y el muro de la zanja de Bajo Vías;
     · los objetos nuevos de la pista: cajones (que en Los Muelles caen
       colgados de una grúa), drones, barandas, lonas, respiraderos de
       vapor, el chicle y la estrella secreta; y lo de Subway Surfers City:
       las celdas de energía de la tabla, la batería, las monedas ×2, las
       rejillas del pisotón y el tramo de burbujas de baja gravedad;
     · los rasgos de los personajes de City (peinado y falda), en el bloque
       «CITY: rasgos de los personajes»;
     · los efectos: la burbuja del chicle y los trozos de lo que se pisa.

   CÓMO SE ENGANCHA
   mundo.js exporta GANCHOS (unas pocas preguntas que hace en su código,
   marcadas «CITY:») y `piezas` (sus herramientas internas). Este módulo se
   importa una vez desde juego.js, ANTES de crear el mundo: al cargarse
   agrega sus paletas a PALETAS, sus métodos al Kit y llena GANCHOS. La
   dirección del import es la misma que usa juego.js para mundo.js (con su
   ?v=), así los dos ven la MISMA instancia del módulo.

   EL PRESUPUESTO DEL GPU
   Igual que la Línea 3: cada cuadra es UN objeto armado con Arma, que funde
   sus piezas por material (una cuadra entera son 4 a 6 llamadas al GPU, lo
   que un edificio clásico); las palmeras van en instancias (Serie, desde
   Kit.arbol); los objetos de la pista salen de reservas (kit.saca/guarda) y
   se preparan de a poco (pasosCity). El agua, el pasto y el muro de cada
   cuadra son una caja más larga que la cuadra (1,6 m por lado), que tapa el
   callejón con la vecina sin pedir una pieza aparte.

   LEGIBILIDAD
   Lo que se esquiva o se toma (cajón, dron, baranda, lona, vapor, chicle,
   estrella secreta) usa materiales con «!»: se dibuja como objeto del juego
   (ver `legible` y `realza` en mundo.js) y se lee de lejos en todos los
   estilos. La escenografía no lleva «!». */
import * as THREE from 'three';
import { PALETAS, GANCHOS, piezas } from './mundo.js?v=metrorush-9';

const MOTOR = window.MetroRushMotor;                    // el motor (con City instalado por city.js)
const CITY = MOTOR && MOTOR.CITY;                       // las medidas y los datos de City (city.js)
const {
  Kit, Arma, CAJA, CILINDRO, CILINDRO_CHICO, ESFERA, redonda, uvMundo, franja, sprite, texBrillo,
  variante, BASE_JUGUETE, BASE_PIXEL, BASE_NEON, SUELO, CARRILES
} = piezas;

/* ===================================================================
   1. LAS PALETAS DE LOS DISTRITOS
   ===================================================================
   Cada una es una variante de una base (juguete, pixel o neón), como las
   estaciones de la Línea 3, más `distrito` (qué escenografía va a los
   costados) y los colores propios de City en `c` (tejas, pasto, agua,
   contenedores, grúa, palmeras). Los trenes cambian de colores en cada
   distrito, pero siempre en tonos que no tiene su escenografía (por ejemplo
   en Bajo Vías todo es ámbar de obra, así que los trenes son cian, rosa y
   blanco). */
const COLORES_CITY = ['tejas', 'cesped', 'cerca', 'agua', 'contenedores', 'grua', 'palma', 'seto'];   // las claves de `c` que solo usa City
const PALETAS_CITY = {
  /* Barrio Sur: mediodía de juguete, casas bajas de colores pastel. */
  citysur: variante(BASE_JUGUETE, {
    distrito: 'sur',
    cielo: { arriba: 0x3f9cf5, horizonte: 0xdcf1ff, sol: 0xfff3d0 },
    c: {
      edificios: [0xffe0a3, 0xffc4b0, 0xc8f0d0, 0xd8d0ff, 0xfff4e0, 0xffd1e8], tejas: [0xd0583a, 0x9a4b3a, 0x4a6fa5, 0x3f8f6a],
      cesped: 0x7cc96a, cerca: 0xffffff, seto: 0x3f9a4a, trenes: [0xff7a3d, 0x2fb5a8, 0x7b5cff]
    },
    carteles: ['KIOSCO', 'DOMINÓ', 'EMPANADAS', 'BARBERÍA', 'VERDURAS'],
    grafitis: [['¡CORRE!', 0xff5a8a, 0xffd23f], ['CITY', 0x3fd0ff, 0x7a5cff], ['SUR', 0x8aff6a, 0x19b37a]]
  }),
  /* Los Muelles: atardecer pixelado sobre el mar, grúas y contenedores. */
  muelles: variante(BASE_PIXEL, {
    distrito: 'muelles',
    cielo: { arriba: 0x2a3a78, horizonte: 0xff9a6a, sol: 0xffe0a0 },
    c: {
      edificios: [0x6a7f9a, 0x9a6a5a, 0x5f8a7a, 0x8a7a9a], contenedores: [0xd8452f, 0x2f7fd8, 0x2fb56a, 0xf0b030, 0x8a4ab0],
      grua: 0xffb020, agua: 0x2f6aa0, muro: 0x9a8f88, trenes: [0x3fa0d8, 0xe2463a, 0xf0e0c0]
    },
    carteles: ['LONJA', 'ADUANA', 'MUELLE 3', 'REDES', 'FARO']
  }),
  /* Bulevar Aurora: neón al amanecer (cielo rosado, no negro), torres de
     vidrio y palmeras que brillan. `arbolesNeon`: en neón no hay árboles,
     salvo aquí (las palmeras son la gracia del bulevar). */
  bulevar: variante(BASE_NEON, {
    distrito: 'bulevar', arbolesNeon: true,
    cielo: { arriba: 0x2a1050, horizonte: 0xff8a6a, sol: 0xffe0a0 }, nieblaColor: 0x4a1a48,
    hemi: [0xff9ac8, 0x1a0a28, 0.6],
    c: {
      edificios: [0xff7ab0, 0x7ad8ff, 0xffd07a, 0xb07aff], ventanas: [0xffd07a, 0xff7ab0, 0x7ad8ff, 0xfff1d4, 0x1a0f30, 0x1a0f30],
      palma: 0x2bd68a, tronco: 0xffb07a, arboles: [0x2bd68a], trenes: [0x22e5ff, 0xffe14d, 0xff2bd6], cornisa: 0xff7ab0
    },
    carteles: ['HOTEL', 'AURORA', '24H', 'JUGOS', 'SURF'],
    grafitis: [['AURORA', 0xff7ab0, 0xffd07a], ['CITY', 0x22e5ff, 0x7b5cff]],
    extras: { synth: ['#fff1a8', '#ffb38a', '#ff5f9e'], estrellas: false }
  }),
  /* Parque de los Lagos: de juguete, verde y con agua. */
  parque: variante(BASE_JUGUETE, {
    distrito: 'parque',
    cielo: { arriba: 0x52a8f7, horizonte: 0xe4f6ff, sol: 0xfff6dc },
    c: {
      cesped: 0x63bf55, agua: 0x48a8e0, arboles: [0x3fa34d, 0x5bbd5c, 0x2f8c45, 0x9fd65a], cerca: 0x8a5a3a, seto: 0x2f8c45,
      edificios: [0xffd23f, 0xff8fa3, 0x7fd6ff], trenes: [0xffc63a, 0xe2443a, 0x2c7be0]
    },
    carteles: ['HELADOS', 'BOTES', 'JUEGOS', 'KIOSCO']
  }),
  /* Bajo Vías: neón de obra, bajo tierra. Todo ámbar, polvo en el aire, un
     muro alto a cada lado y vigas cruzando arriba. */
  bajo: variante(BASE_NEON, {
    distrito: 'bajo',
    cielo: { arriba: 0x050507, horizonte: 0x1a1408, sol: 0xffb020 }, nieblaColor: 0x0e0b06,
    hemi: [0xffc070, 0x0a0806, 0.55],
    c: {
      muro: 0x3a3a42, riel: 0xffb020, bordillo: 0xffb020, catenaria: 0xffb020, tubo: 0xffb020, farol: 0xffd070, rejilla: 0x5a3a08,
      edificios: [0xffb020, 0xff6a20, 0x22e5ff], trenes: [0x22e5ff, 0xff4f8a, 0xe8f0ff], rampa: 0x22e5ff, traviesa: 0x4a3010,
      ventanas: [0xffb020, 0xffd070, 0x22e5ff, 0x1a120a, 0x1a120a, 0x1a120a]
    },
    carteles: ['ANDÉN 0', 'OBRAS', 'SALIDA', 'PELIGRO'],
    grafitis: [['BAJO VÍAS', 0xffb020, 0xff6a20], ['3', 0x22e5ff, 0xffb020]],
    extras: { synth: null, estrellas: false, polvo: true }
  })
};
if (CITY) Object.assign(PALETAS, PALETAS_CITY);

/** La paleta de un distrito con OTRO estilo (el jugador fijó uno en las
    Opciones): 'muelles@neon' es la base de neón con la escenografía de Los
    Muelles y sus colores propios (agua, grúa, contenedores). Se arma una
    vez y queda en PALETAS. Devuelve null si la clave no es de City. */
function paletaCity(clave) {
  const [base, estilo] = String(clave).split('@');                // 'muelles@neon' → 'muelles', 'neon'
  const orig = PALETAS_CITY[base], B = { juguete: BASE_JUGUETE, pixel: BASE_PIXEL, neon: BASE_NEON }[estilo];
  if (!orig || !B) return null;                                   // no es una paleta de City
  if (orig.estilo === estilo) return orig;                        // el estilo es el suyo: la de siempre
  const extra = {};
  for (const k of COLORES_CITY) if (orig.c[k] != null) extra[k] = orig.c[k];   // sus colores propios viajan con la escenografía
  const p = variante(B, { distrito: orig.distrito, carteles: orig.carteles, arbolesNeon: true, c: extra });
  PALETAS[clave] = p;                                             // queda guardada: la próxima vez sale directo de PALETAS
  return p;
}

/* ===================================================================
   2. LA ESCENOGRAFÍA DE LOS COSTADOS (una cuadra por distrito)
   ===================================================================
   Kit.edificio(lado) le pregunta a cuadraCity cuando la paleta tiene
   `distrito`. Cada cuadra se arma en un marco propio: la fachada que mira
   a la vía en x = 0, y lo de más atrás hacia afuera (u ≥ 0 → x = lado·u),
   a lo largo de la vía z de −L/2 a L/2. mundo.js la pone en x = lado·6,5,
   justo pasada la vereda, igual que una cuadra clásica. */

/** Un prisma triangular de 1 de alto (punta arriba en y = 1, base en
    y = −0,5, medio ancho de la base 0,866) a lo largo de z: el techo a dos
    aguas. Sin índice y con normales planas (cada cara con su luz). */
const TEJADO = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1).rotateX(-Math.PI / 2);   // tres lados; el eje queda a lo largo de z y una arista arriba
  const n = g.toNonIndexed(); n.computeVertexNormals(); g.dispose();          // normales planas: las caras del techo no se ven redondeadas
  return n;
})();
/** Pone un techo a dos aguas de `ancho` (de canto a canto), `alto` y `largo`, con la base en y0. */
function techo(a, clave, col, x, y0, z, ancho, alto, largo) {
  const sx = ancho / (2 * 0.866), sy = alto / 1.5;                   // la base del prisma mide 2·0,866·sx de ancho y 1,5·sy de alto
  a.pon(TEJADO, clave, col, [x, y0 + 0.5 * sy, z], null, [sx, sy, largo]);
}
/** Un color al azar de una lista, con el azar del kit. */
const deLista = (az, lista) => lista[Math.floor(az() * lista.length)];
/** Un rayo (la forma del ícono de energía) de alto `h`, centrado en 0, para ShapeGeometry. */
function rayo(h) {
  const k = h / 26, sh = new THREE.Shape();
  [[2.5, 13], [-9, -2], [-1.5, -2], [-3.5, -13], [8, 2], [0.5, 2]].forEach(([x, y], i) => (i ? sh.lineTo(x * k, y * k) : sh.moveTo(x * k, y * k)));
  sh.closePath();
  return sh;
}

Object.assign(Kit.prototype, {
  /** La cuadra de City del costado `lado`: la que pida el distrito. */
  cuadraCity(lado) {
    const d = this.pal.distrito, a = new Arma(this);
    const arma = { sur: this.casasSur, muelles: lado > 0 ? this.muelleAgua : this.galpones, bulevar: this.torres, parque: this.parcela, bajo: this.muroBajo }[d] || this.casasSur;
    const L = arma.call(this, a, lado, u => lado * u);              // cada una devuelve su largo; X(u) pasa de «hacia afuera» a x
    const g = a.hecho();
    g.userData.largo = L / 2; g.userData.ancho = 0;                  // como Kit.edificio: medio largo, y la fachada en el borde
    return g;
  },

  /** BARRIO SUR: dos o tres casas de uno o dos pisos, con techo a dos aguas,
      chimenea, antejardín con pasto, cerca de palos y un caminito a la puerta. */
  casasSur(a, lado, X) {
    const az = this.az, c = this.c, n = az() < 0.5 ? 3 : 2;
    const lotes = []; let z = 0;
    for (let i = 0; i < n; i++) { const d = 7 + az() * 3; lotes.push({ z0: z, d }); z += d; }   // el frente de cada lote, a lo largo de la vía
    const L = z;
    const pared = this.juguete ? 'tex:ruido' : 'plano', teja = this.pixel ? 'plano' : 'pintura';
    a.pon(CAJA, 'plano', c.cesped ?? 0x7cc96a, [X(7), 0.06, 0], null, [14, 0.12, L + 3.2]);   // el pasto de toda la cuadra (tapa el callejón con la vecina)
    for (const { z0, d } of lotes) {
      const zc = -L / 2 + z0 + d / 2, dc = d - 1.6;                // el centro del lote y el frente de la casa
      const w = 4.5 + az() * 2, u0 = 2 + az() * 0.8;               // la profundidad de la casa y su antejardín
      const pisos = az() < 0.4 ? 2 : 1, h = pisos * 2.7 + 0.2;     // uno o dos pisos
      const col = deLista(az, c.edificios);
      const cuerpo = uvMundo(new THREE.BoxGeometry(w, h, dc), 6, h / 2);
      a.pon(cuerpo, pared, col, [X(u0 + w / 2), h / 2, zc], null, 1, this.neon ? col : null);   // la casa
      techo(a, teja, deLista(az, c.tejas || [0xd0583a]), X(u0 + w / 2), h, zc, w + 0.7, 1.3 + az() * 0.7, dc + 0.5);   // el techo
      a.pon(CAJA, 'plano', 0x9a5a44, [X(u0 + w * 0.7), h + 0.9, zc + dc * 0.25], null, [0.45, 1.5, 0.45]);   // la chimenea
      for (let p = 0; p < pisos; p++) for (const s of [-1, 1]) {   // dos ventanas por piso, a los lados de la puerta
        const y = 1.45 + p * 2.7, zv = zc + s * dc * 0.28;
        a.pon(CAJA, 'plano', c.marco, [X(u0 - 0.02), y, zv], null, [0.06, 1.25, 1.35]);
        a.pon(CAJA, this.vid, this.neon ? deLista(az, c.ventanas || [0xffe14d]) : c.vidrioEd, [X(u0 - 0.05), y, zv], null, [0.06, 1.0, 1.1]);
      }
      a.pon(CAJA, this.neon ? 'luz' : 'plano', this.neon ? 0x22e5ff : 0x7a4a2a, [X(u0 - 0.04), 1.05, zc], null, [0.08, 2.1, 0.95]);   // la puerta
      a.pon(CAJA, 'plano', c.acera, [X(u0 / 2), 0.08, zc], null, [u0, 0.16, 1.0]);   // el caminito de la vereda a la puerta
      // la cerca: palos cada 0,9 m y dos travesaños, con el hueco del caminito
      const cerca = c.cerca ?? 0xffffff;
      for (const s of [-1, 1]) {
        const za = zc + s * 0.75, zb = zc + s * d / 2, largo = Math.abs(zb - za), mz = (za + zb) / 2;
        for (const yt of [0.32, 0.62]) a.pon(CAJA, 'plano', cerca, [X(0.35), yt, mz], null, [0.05, 0.07, largo]);
        for (let k = 0; k <= Math.floor(largo / 0.9); k++) a.pon(CAJA, 'plano', cerca, [X(0.35), 0.42, za + s * k * 0.9], null, [0.07, 0.8, 0.07]);
      }
      if (az() < 0.5) {                                            // un buzón junto al caminito
        a.pon(CAJA, 'plano', 0x48525e, [X(0.7), 0.55, zc + 0.9], null, [0.06, 1.1, 0.06]);
        a.pon(redonda(0.28, 0.24, 0.42, 0.08), 'pintura', 0xe8463b, [X(0.7), 1.15, zc + 0.9]);
      }
    }
    return L;
  },

  /** LOS MUELLES, lado de tierra: una bodega con portón y letrero, y pilas de
      contenedores de colores (de uno a tres de alto). */
  galpones(a, lado, X) {
    const az = this.az, c = this.c, L = 24 + az() * 14;
    const lb = L * (0.45 + az() * 0.2), zb = -L / 2 + lb / 2;      // el largo de la bodega y su centro (al principio de la cuadra)
    const w = 9 + az() * 5, h = 6 + az() * 3, col = deLista(az, c.edificios);
    a.pon(CAJA, 'plano', c.tierra, [X(9), 0.05, 0], null, [18, 0.1, L + 3.2]);   // el patio de asfalto
    a.pon(uvMundo(new THREE.BoxGeometry(w, h, lb), 6, h / 2), this.juguete ? 'tex:ruido' : 'plano', col, [X(w / 2 + 0.6), h / 2, zb], null, 1, this.neon ? col : null);
    techo(a, this.pixel ? 'plano' : 'metal', 0x8a96a4, X(w / 2 + 0.6), h, zb, w + 0.4, 1.4, lb + 0.3);   // el techo, de lata
    for (const s of [-1, 1]) a.pon(CAJA, 'plano', 0x55606c, [X(0.58), 2.2, zb + s * lb * 0.22], null, [0.06, 4.2, lb * 0.32]);   // dos portones
    const nc = this.pal.carteles.length;
    a.pon(franja(new THREE.PlaneGeometry(Math.min(lb * 0.6, 6), 1.1), Math.floor(az() * nc), nc), this.neon ? 'texluz:carteles' : 'tex:carteles', 0xffffff,
      [X(0.5), h - 1.1, zb], [0, -lado * Math.PI / 2, 0]);          // el letrero, mirando a la vía
    // los contenedores: dos filas a lo largo de la vía, apilados
    const z0 = -L / 2 + lb + 1, cont = c.contenedores || [0xd8452f, 0x2f7fd8];
    for (let z = z0; z + 6 <= L / 2 + 0.5; z += 6.4) for (const u of [1.9, 4.6]) {
      const pila = 1 + Math.floor(az() * 3);
      for (let k = 0; k < pila; k++) {
        const cc = deLista(az, cont);
        a.pon(CAJA, this.pixel ? 'plano' : 'pintura', cc, [X(u), 1.3 + k * 2.6, z + 3], null, [2.4, 2.55, 6]);
        a.pon(CAJA, 'plano', new THREE.Color(cc).multiplyScalar(0.7).getHex(), [X(u - 1.21), 1.3 + k * 2.6, z + 3], null, [0.04, 2.1, 5.4]);   // las nervaduras del costado, más oscuras
      }
    }
    return L;
  },

  /** LOS MUELLES, lado del mar: el borde de concreto con su franja amarilla
      y sus bitas, el agua hasta el horizonte y, una cuadra sí y otra a
      veces, una grúa de pórtico o un barco amarrado. */
  muelleAgua(a, lado, X) {
    const az = this.az, c = this.c, L = 26 + az() * 12, LL = L + 3.2;
    a.pon(CAJA, 'plano', c.muro, [X(2.2), 0.05, 0], null, [4.4, 0.3, LL]);              // el muelle de concreto (arriba en 0,2)
    a.pon(CAJA, 'plano', 0xffd23f, [X(4.25), 0.26, 0], null, [0.25, 0.12, LL]);        // la franja amarilla del borde
    for (let z = -L / 2 + 2; z < L / 2; z += 6) a.pon(CILINDRO_CHICO, 'plano', 0x2a2d33, [X(3.8), 0.45, z], null, [0.35, 0.5, 0.35]);   // las bitas
    const agua = this.juguete ? 'vidrio' : this.neon ? 'luz' : 'plano';
    const colAgua = this.neon ? new THREE.Color(c.agua ?? 0x2f6aa0).multiplyScalar(0.35).getHex() : (c.agua ?? 0x2f6aa0);
    a.pon(CAJA, agua, colAgua, [X(34.4), -0.35, 0], null, [60, 0.2, LL]);              // el mar
    for (let k = 0; k < 3; k++) a.pon(CAJA, this.neon ? 'luz' : 'plano', this.neon ? 0x22e5ff : 0xcfe9ff, [X(7 + az() * 30), -0.24, (az() - 0.5) * L], null, [0.15, 0.02, 2 + az() * 4]);   // brillos de olas
    if (az() < 0.55) {                                             // la grúa de pórtico: cuatro patas, la viga hacia el mar y la cabina
      const g = c.grua ?? 0xffb020, gm = this.pixel ? 'plano' : 'pintura';
      for (const u of [1.2, 7.5]) for (const s of [-1, 1]) a.pon(CAJA, gm, g, [X(u), 7, s * 2.2], null, [0.45, 14, 0.45], this.neon ? g : null);
      for (const s of [-1, 1]) a.pon(CAJA, gm, g, [X(4.35), 9, s * 2.2], null, [6.8, 0.35, 0.35]);   // los travesaños
      a.pon(CAJA, gm, g, [X(13), 14.2, 0], null, [27, 0.9, 1.0], this.neon ? g : null);              // la viga (sobre el mar, nunca sobre la vía)
      a.pon(CAJA, 'plano', 0x2a2d33, [X(9), 12.9, 0], null, [2.2, 1.6, 1.8]);                         // la cabina
      a.pon(CAJA, this.vid, c.vidrioEd, [X(9), 12.9, 0.92], null, [1.8, 0.8, 0.04]);
      a.pon(CAJA, 'metal', 0x55606c, [X(14), 10.5, 0], null, [0.06, 7.2, 0.06]);                      // el cable y el contenedor colgando
      a.pon(CAJA, 'pintura', deLista(az, c.contenedores || [0xd8452f]), [X(14), 5.6, 0], null, [2.4, 2.4, 5]);
    } else {                                                       // un barco amarrado: casco, cubierta, puente y su carga
      const lb = Math.min(L * 0.8, 26), casco = deLista(az, [0x8a2a2a, 0x23304a, 0x2f5a3a]);
      a.pon(CAJA, this.pixel ? 'plano' : 'pintura', casco, [X(10.5), 0.6, 0], null, [8, 3.2, lb], this.neon ? 0xff4f8a : null);
      a.pon(CAJA, 'plano', 0xe8e0d0, [X(10.5), 2.25, 0], null, [8.1, 0.25, lb + 0.1]);              // la línea de la cubierta
      a.pon(CAJA, 'plano', 0xf2f2f2, [X(11), 4.2, lb / 2 - 3], null, [5, 3.6, 4]);                  // el puente
      a.pon(CAJA, this.vid, c.vidrioEd, [X(8.45), 5.1, lb / 2 - 3], null, [0.06, 0.7, 3.4]);
      for (let k = 0; k < 3; k++) a.pon(CAJA, 'pintura', deLista(az, c.contenedores || [0x2f7fd8]), [X(10.5), 3.6, lb / 2 - 9 - k * 6.3], null, [2.4, 2.5, 6]);
    }
    return L;
  },

  /** BULEVAR AURORA: dos torres de vidrio con franjas de luz por piso (en
      neón; de día, vidrio), un vestíbulo encendido y un letrero en lo alto. */
  torres(a, lado, X) {
    const az = this.az, c = this.c, lotes = []; let z = 0;
    for (let i = 0; i < 2; i++) { const d = 9 + az() * 5; lotes.push({ z0: z, d }); z += d + 2; }
    const L = z - 2, nc = this.pal.carteles.length;
    a.pon(CAJA, 'plano', c.acera, [X(8), 0.06, 0], null, [16, 0.12, L + 3.2]);           // la explanada
    for (const { z0, d } of lotes) {
      const zc = -L / 2 + z0 + d / 2, w = 8 + az() * 6, h = 16 + az() * 22, u0 = 1.2, col = deLista(az, c.edificios);
      a.pon(uvMundo(new THREE.BoxGeometry(w, h, d), 6, h / 2), this.juguete ? 'tex:ruido' : 'plano', col, [X(u0 + w / 2), h / 2, zc], null, 1, this.neon ? col : null);
      a.pon(CAJA, this.vid, this.neon ? 0x2a1a50 : c.vidrioEd, [X(u0 - 0.04), h / 2 + 2, zc], null, [0.06, h - 4.2, d * 0.86]);   // la piel de vidrio
      const vent = c.ventanas || [c.vidrioEd];
      for (let y = 4.6; y < h - 1; y += 3.2) if (az() < 0.7)        // franjas de piso (algunos pisos apagados)
        a.pon(CAJA, this.neon ? 'luz' : 'plano', this.neon ? deLista(az, vent) : c.marco, [X(u0 - 0.08), y, zc], null, [0.05, this.neon ? 0.3 : 0.18, d * 0.88]);
      a.pon(CAJA, this.neon ? 'luz' : this.vid, this.neon ? 0xfff1d4 : c.vitrina, [X(u0 - 0.06), 1.7, zc], null, [0.06, 3.0, d * 0.7]);   // el vestíbulo
      a.pon(CAJA, this.neon ? 'luz' : 'plano', c.cornisa, [X(u0 + w / 2), h + 0.2, zc], null, [w + 0.3, 0.4, d + 0.3]);        // la cornisa
      if (az() < 0.6) a.pon(franja(new THREE.PlaneGeometry(Math.min(d * 0.8, 7), 1.6), Math.floor(az() * nc), nc),
        this.neon ? 'texluz:carteles' : 'tex:carteles', 0xffffff, [X(u0 - 0.12), h - 1.6, zc], [0, -lado * Math.PI / 2, 0]);   // el letrero de arriba
    }
    return L;
  },

  /** PARQUE DE LOS LAGOS: pasto hasta lejos, un seto o una cerca baja, un
      lago con su borde de arena y tres patos, bancas mirando a la vía,
      arbustos y árboles grandes al fondo. */
  parcela(a, lado, X) {
    const az = this.az, c = this.c, L = 24 + az() * 16, LL = L + 3.2;
    const verde = this.c.arboles || [0x3fa34d];
    a.pon(CAJA, 'plano', c.cesped ?? 0x63bf55, [X(20), 0.06, 0], null, [40, 0.12, LL]);   // el pasto
    if (az() < 0.6) a.pon(CAJA, 'plano', c.seto ?? 0x2f8c45, [X(0.45), 0.45, 0], null, [0.7, 0.9, LL]);   // el seto…
    else for (const yt of [0.3, 0.55]) a.pon(CAJA, 'plano', c.cerca ?? 0x8a5a3a, [X(0.35), yt, 0], null, [0.06, 0.08, LL]);   // …o una cerca baja
    if (az() < 0.7) {                                              // el lago
      const R = 3 + az() * 2.5, uc = 4 + R + az() * 3, zc = (az() - 0.5) * Math.max(0, L - 2 * R) * 0.5;
      a.pon(CILINDRO, 'plano', 0xe8d8a8, [X(uc), 0.12, zc], null, [2 * R + 0.6, 0.06, 2 * R * 0.8 + 0.6]);   // el borde de arena
      a.pon(CILINDRO, this.juguete ? 'vidrio' : this.neon ? 'luz' : 'plano', this.neon ? 0x0a3a5a : (c.agua ?? 0x48a8e0), [X(uc), 0.15, zc], null, [2 * R, 0.06, 2 * R * 0.8]);
      for (let k = 0; k < 3; k++) {                                // los patos
        const pu = uc + (az() - 0.5) * R, pz = zc + (az() - 0.5) * R;
        a.pon(ESFERA, 'plano', k ? 0xffffff : 0xffd23f, [X(pu), 0.28, pz], null, [0.32, 0.22, 0.42]);
        a.pon(ESFERA, 'plano', k ? 0xffffff : 0xffd23f, [X(pu), 0.45, pz + 0.16], null, 0.18);
        a.pon(CAJA, 'plano', 0xff8a2a, [X(pu), 0.44, pz + 0.27], null, [0.08, 0.04, 0.1]);
      }
    }
    for (let k = 0; k < 2; k++) {                                  // las bancas, mirando a la vía
      const zb = (k - 0.5) * L * 0.5;
      a.pon(CAJA, 'plano', 0x9a6a3a, [X(1.5), 0.48, zb], null, [0.5, 0.08, 1.7]);
      a.pon(CAJA, 'plano', 0x9a6a3a, [X(1.75), 0.8, zb], null, [0.06, 0.45, 1.7]);
      for (const s of [-1, 1]) a.pon(CAJA, 'plano', 0x2a2d33, [X(1.55), 0.24, zb + s * 0.7], null, [0.45, 0.48, 0.06]);
    }
    const copa = new THREE.IcosahedronGeometry(1, this.pixel ? 0 : 1);
    for (let k = 0; k < 5; k++) a.pon(copa, 'plano', deLista(az, verde), [X(2.5 + az() * 12), 0.4, (az() - 0.5) * L], null, 0.5 + az() * 0.45);   // arbustos
    for (let k = 0; k < 3; k++) {                                  // árboles grandes al fondo
      const u = 14 + az() * 12, z = (az() - 0.5) * L, e = 1.3 + az() * 0.6;
      a.pon(CILINDRO_CHICO, 'plano', c.tronco, [X(u), 1.3 * e, z], null, [0.4 * e, 2.6 * e, 0.4 * e]);
      a.pon(copa, 'plano', deLista(az, verde), [X(u), 3.4 * e, z], null, 1.8 * e);
    }
    copa.dispose();
    if (az() < 0.35) {                                             // un carrito de helados con su toldo
      a.pon(redonda(1.2, 0.9, 1.6, 0.1), 'pintura', deLista(az, c.edificios), [X(2.6), 0.75, 0]);
      a.pon(uvMundo(new THREE.BoxGeometry(1.5, 0.06, 1.9), 1), this.neon ? 'texluz:toldo|0' : 'tex:toldo|0', 0xffffff, [X(2.6), 1.9, 0]);
      a.pon(CAJA, 'plano', 0x48525e, [X(2.6), 1.45, 0], null, [0.05, 0.9, 0.05]);
    }
    return L;
  },

  /** BAJO VÍAS: el muro de la zanja, alto (9 m), con pilastras, dos caños a
      lo largo, focos de obra, una franja de peligro y, cada tanto, una viga
      que cruza por arriba hasta el borde de la vía (nunca sobre los
      carriles: arriba de ellos vuela la mochila cohete). */
  muroBajo(a, lado, X) {
    const az = this.az, c = this.c, L = 20 + az() * 6, LL = L + 3.2;
    a.pon(uvMundo(new THREE.BoxGeometry(1.2, 9, LL), 4), this.juguete ? 'tex:muro' : 'plano', c.muro, [X(0.6), 4.5, 0], null, 1);   // el muro
    for (let z = -L / 2 + 1.5; z < L / 2; z += 5.5) {
      a.pon(CAJA, 'plano', new THREE.Color(c.muro).multiplyScalar(1.25).getHex(), [X(-0.2), 4.5, z], null, [0.5, 9, 0.8]);   // la pilastra
      a.pon(CAJA, 'luz', c.farol ?? 0xffd070, [X(-0.5), 6.6, z], null, [0.18, 0.28, 1.1]);        // el foco de obra
    }
    for (const [y, col] of [[3.1, 0x5a6a7a], [3.8, 0x8a4a2a]]) a.pon(CILINDRO_CHICO, 'metal', col, [X(-0.3), y, 0], [Math.PI / 2, 0, 0], [0.32, LL, 0.32]);   // los caños
    a.pon(uvMundo(new THREE.BoxGeometry(0.05, 0.5, LL), 1), this.neon ? 'texluz:rayasNA' : 'tex:rayasNA', 0xffffff, [X(-0.03), 1.7, 0], null, 1);   // la franja de peligro
    if (az() < 0.8) {                                              // la viga de arriba, con su tira de luz debajo
      const zv = (az() - 0.5) * L * 0.6;
      a.pon(CAJA, 'metal', 0x4a4a52, [X(-1.4), 9.6, zv], null, [3.8, 0.6, 0.6], this.neon ? (c.tubo ?? 0xffb020) : null);
      a.pon(CAJA, 'luz', c.farol ?? 0xffd070, [X(-1.4), 9.27, zv], null, [3.2, 0.06, 0.18]);
    }
    if (az() < 0.5) {                                              // un letrero pintado en el muro
      const nc = this.pal.carteles.length;
      a.pon(franja(new THREE.PlaneGeometry(3.6, 0.8), Math.floor(az() * nc), nc), this.neon ? 'texluz:carteles' : 'tex:carteles', 0xffffff, [X(-0.03), 5.2, (az() - 0.5) * L * 0.5], [0, -lado * Math.PI / 2, 0]);
    }
    return L;
  },

  /** El árbol de la vereda en el Bulevar: una palmera (tronco curvo en cinco
      tramos y siete hojas caídas que brillan en neón). En los demás
      distritos, null: árbol de siempre. Va en instancias (Serie), así que
      no lleva bordes. */
  arbolCity() {
    if (this.pal.distrito !== 'bulevar') return null;
    const c = this.c, az = this.az, a = new Arma(this), hoja = this.neon ? 'luz' : 'plano';
    let x = 0, y = 0;
    for (let k = 0; k < 5; k++) {                                  // el tronco, cada tramo un poco más inclinado hacia la vía
      a.pon(CILINDRO_CHICO, 'plano', c.tronco, [x, y + 0.6, 0], [0, 0, k * 0.04], [0.26 - k * 0.02, 1.25, 0.26 - k * 0.02]);
      x -= 0.05 * k; y += 1.2;
    }
    for (let k = 0; k < 7; k++) {                                  // las hojas: tablas finas que cuelgan desde la copa
      const ang = k / 7 * Math.PI * 2;
      a.pon(CAJA, hoja, c.palma ?? 0x2bd68a, [x + Math.cos(ang) * 0.9, y - 0.15, Math.sin(ang) * 0.9], [0, -ang, -0.45], [1.9, 0.06, 0.36]);
    }
    a.pon(ESFERA, 'plano', 0x6a4a2a, [x, y, 0], null, 0.42);        // los cocos
    const g = a.hecho();
    const e = 0.9 + az() * 0.3; g.scale.setScalar(e);
    g.userData.largo = 1.4 * e;
    return g;
  },

  /* ===================================================================
     3. LOS OBJETOS DE LA PISTA DE CITY
     ===================================================================
     Todos llevan «!» (objetos del juego). Su origen y cómo los coloca
     `userData.colocar(o, D, t)` (lo llama mundo.js en cada cuadro):
       · cajón: centro de la base, en o.d;
       · dron: centro del cuerpo, flotando a 2,15 m; su cartel cuelga hasta
         1,2 m (todo junto, lo que su caja de choque: de 1,15 a 2,45);
       · baranda: la punta de adelante (o.d0), y se estira hasta o.largo;
       · lona / vapor: el centro, en o.d. */

  /** Una pila de cajones: dos cajas de madera abajo y una arriba, con
      flejes oscuros. Mide lo que su caja de choque: 1,8 × 1 × 1,2 m. */
  cajonCity() {
    const a = new Arma(this), mad = this.pixel ? 'plano!' : 'pintura!', col = this.neon ? 0xffb020 : 0xc8873a;
    for (const s of [-1, 1]) a.pon(CAJA, mad, col, [s * 0.45, 0.32, 0], null, [0.86, 0.62, 1.1], 0xffe14d);
    a.pon(CAJA, mad, new THREE.Color(col).multiplyScalar(1.12).getHex(), [0.12, 0.81, 0.05], null, [0.8, 0.38, 0.95], 0xffe14d);
    for (const s of [-1, 1]) for (const yf of [0.12, 0.52]) a.pon(CAJA, 'plano!', 0x3a2a1a, [s * 0.45, yf, 0.56], null, [0.88, 0.06, 0.02]);   // los flejes, del lado que se ve
    a.pon(CAJA, this.neon ? 'texluz:rayasNA!' : 'tex:rayasNA!', 0xffffff, [0.12, 0.81, 0.53], null, [0.6, 0.12, 0.02]);   // la etiqueta de «frágil»
    const g = a.hecho();
    /* El contenedor que cae (Los Muelles, `o.cae`): cuelga de un cable y
       baja mientras te acercas (CITY.alturaCae); su sombra en el suelo
       crece y se oscurece, así se sabe en qué carril va a caer. El cable y
       la sombra son dos piezas aparte (no van en el Arma) para poder
       mostrarlas solo mientras cae; un cajón quieto no las muestra. */
    const cable = new THREE.Mesh(CAJA, new THREE.MeshBasicMaterial({ color: 0x1d1f26 }));
    cable.scale.set(0.05, 14, 0.05); cable.visible = false; g.add(cable);
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2; sombra.visible = false; sombra.userData.sinAO = true; g.add(sombra);
    g.userData.colocar = (o, D) => {
      const h = o.cae ? CITY.alturaCae(o.d - D) : 0;             // la altura del contenedor sobre su lugar en el suelo
      g.position.set(CARRILES[o.carril], SUELO + h, -(o.d - D));
      cable.visible = sombra.visible = h > 0.01;
      if (h > 0.01) {
        cable.position.y = 1.0 + 7;                                // desde la tapa hacia arriba
        sombra.position.y = -h + 0.03;                             // en el suelo, bajo el contenedor
        const k = 1 - h / 9; sombra.scale.setScalar(0.6 + k * 0.6); sombra.material.opacity = 0.15 + 0.4 * k;
      }
    };
    return g;
  },
  /** Un dron de vigilancia: cuerpo redondeado, cuatro brazos con su anillo
      de hélice, un ojo rojo hacia el corredor y una franja de peligro. Lleva
      colgando un cartel a rayas a la altura de la cabeza: así se ve que
      ocupa de 1,15 a 2,45 m, que se pasa por debajo rodando y que saltando
      no (el salto llega a 2,1 m: el dron solo, arriba, parecería saltable). */
  dronCity() {
    const a = new Arma(this), col = this.neon ? 0x22e5ff : 0x3a4a5a;
    a.pon(redonda(0.95, 0.34, 0.75, 0.12), 'pintura!', col, [0, 0, 0], null, 1, 0xffffff);
    a.pon(CAJA, this.neon ? 'texluz:rayasNA!' : 'tex:rayasNA!', 0xffffff, [0, 0, 0.38], null, [0.9, 0.1, 0.02]);
    a.pon(ESFERA, 'luz!', 0xff3030, [0, -0.05, 0.37], null, [0.2, 0.2, 0.1]);   // el ojo
    a.pon(CILINDRO_CHICO, 'plano!', 0x1d1f26, [0, -0.25, 0], null, [0.18, 0.2, 0.18]);   // la cámara de abajo
    for (const sx of [-1, 1]) a.pon(CILINDRO_CHICO, 'plano!', 0x1d1f26, [sx * 0.36, -0.31, 0.05], null, [0.025, 0.28, 0.025]);   // los dos cables del cartel
    a.pon(CAJA, 'plano!', 0x1d1f26, [0, -0.7, 0.03], null, [0.98, 0.56, 0.04]);   // el marco del cartel (de 1,17 a 1,73 m sobre el suelo)
    a.pon(CAJA, this.neon ? 'texluz:rayasNA!' : 'tex:rayasNA!', 0xffffff, [0, -0.7, 0.06], null, [0.9, 0.48, 0.02]);   // su cara a rayas, hacia el corredor
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      a.pon(CAJA, 'plano!', 0x2a2d33, [sx * 0.5, 0.12, sz * 0.32], [0, sx * sz * 0.6, 0], [0.5, 0.06, 0.08]);   // el brazo
      a.pon(new THREE.TorusGeometry(0.22, 0.025, 6, 18), 'luz!', this.neon ? 0xff2bd6 : 0xdfe6ee, [sx * 0.72, 0.2, sz * 0.46], [Math.PI / 2, 0, 0]);   // la hélice girando (un anillo)
    }
    const g = a.hecho();
    if (this.neon) g.add(sprite(0xff3030, 1.1, [0, -0.05, 0.42], 0.8));
    g.userData.colocar = (o, D, t) => g.position.set(CARRILES[o.carril], SUELO + 2.15 + Math.sin(t * 4 + (o.id || 0)) * 0.035, -(o.d - D));   // flota apenas (solo el dibujo)
    return g;
  },
  /** Una baranda de 20 m (se estira al largo de cada una): un bordillo de
      concreto hasta 0,55 m con su franja de peligro y, encima, el riel de
      metal sobre postes, arriba en 1 m. Empieza en z = 0 y sigue hacia −z. */
  barandaCity() {
    const a = new Arma(this), c = this.c, B = CITY.BARANDA, alto = B.alto;
    a.pon(CAJA, this.pixel ? 'plano!' : 'pintura!', this.neon ? 0x6a35c9 : 0xb8bcc4, [0, 0.275, -10], null, [0.9, 0.55, 20], 0xffffff);   // el bordillo
    for (const s of [-1, 1]) a.pon(uvMundo(new THREE.BoxGeometry(0.02, 0.14, 20), 1), this.neon ? 'texluz:rayasNA!' : 'tex:rayasNA!', 0xffffff, [s * 0.46, 0.45, -10], null, 1);
    a.pon(CILINDRO, this.neon ? 'luz!' : 'metal!', this.neon ? 0x22e5ff : (c.cromo ?? 0xf2f5f8), [0, alto - 0.07, -10], [Math.PI / 2, 0, 0], [0.14, 20, 0.14]);   // el riel
    for (let z = -0.6; z > -20; z -= 3.8) a.pon(CAJA, 'metal!', 0x55606c, [0, (0.55 + alto) / 2 - 0.05, z], null, [0.08, alto - 0.55, 0.08]);   // los postes
    const g = a.hecho();
    g.userData.colocar = (o, D) => { g.position.set(CARRILES[o.carril], SUELO, -(o.d0 - D)); g.scale.z = o.largo / 20; };
    return g;
  },
  /** Una lona de feria (cama elástica): marco, lona a rayas, resortes y un
      letrero con una flecha hacia arriba («aquí se salta»). */
  lonaCity() {
    const a = new Arma(this), col = this.neon ? 0xff2bd6 : 0x2f7fe0;
    a.pon(new THREE.TorusGeometry(0.85, 0.08, 8, 28), 'pintura!', col, [0, 0.32, 0], [Math.PI / 2, 0, 0], [1, 1, 1], 0xffffff);   // el marco
    a.pon(CILINDRO, this.neon ? 'texluz:toldo|0!' : 'tex:toldo|0!', 0xffffff, [0, 0.3, 0], null, [1.55, 0.04, 1.55]);   // la lona
    for (let k = 0; k < 4; k++) { const t = k / 4 * Math.PI * 2 + 0.4; a.pon(CILINDRO_CHICO, 'plano!', 0x2a2d33, [Math.cos(t) * 0.75, 0.15, Math.sin(t) * 0.75], null, [0.07, 0.3, 0.07]); }   // las patas
    a.pon(CAJA, 'plano!', 0x2a2d33, [0, 0.65, -0.95], null, [0.06, 1.1, 0.06]);                      // el letrero, detrás
    a.pon(new THREE.CircleGeometry(0.3, 24), this.neon ? 'texluz:flecha!' : 'tex:flecha!', 0xffffff, [0, 1.2, -0.92], [0, 0, Math.PI]);   // la flecha hacia arriba
    const g = a.hecho();
    if (this.neon) g.add(sprite(col, 2.6, [0, 0.4, 0], 0.5));
    g.userData.colocar = (o, D, t) => {
      g.position.set(CARRILES[o.carril], SUELO, -(o.d - D));
      const k = o.usadaT != null ? Math.max(0, 1 - (t - o.usadaT) * 3) : 0;   // al pisarla se hunde y vuelve (solo el dibujo)
      g.scale.y = 1 - 0.45 * k * Math.abs(Math.sin((t - (o.usadaT || 0)) * 18));
    };
    return g;
  },
  /** Un respiradero de vapor (Bajo Vías): una rejilla con su marco de
      peligro y tres bocanadas de vapor que suben sin parar. */
  vaporCity() {
    const a = new Arma(this);
    a.pon(CAJA, this.neon ? 'texluz:rejillaNeon!' : 'tex:rejilla!', this.neon ? 0xffb020 : 0xdfe4ea, [0, 0.06, 0], null, [1.7, 0.12, 1.7]);
    for (const s of [-1, 1]) {
      a.pon(uvMundo(new THREE.BoxGeometry(1.9, 0.18, 0.1), 0.5), this.neon ? 'texluz:rayasNA!' : 'tex:rayasNA!', 0xffffff, [0, 0.09, s * 0.9], null, 1);
      a.pon(uvMundo(new THREE.BoxGeometry(0.1, 0.18, 1.9), 0.5), this.neon ? 'texluz:rayasNA!' : 'tex:rayasNA!', 0xffffff, [s * 0.9, 0.09, 0], null, 1);
    }
    const g = a.hecho(), nubes = [];
    for (let k = 0; k < 3; k++) {                                   // el vapor: manchas suaves (no suman luz de día; de noche sí)
      const m = new THREE.SpriteMaterial({ map: texBrillo(), color: this.neon ? 0xffd9a0 : 0xf2f4f8, transparent: true, opacity: 0.6, depthWrite: false,
        blending: this.neon ? THREE.AdditiveBlending : THREE.NormalBlending });
      const s = new THREE.Sprite(m); g.add(s); nubes.push(s);
    }
    g.userData.colocar = (o, D, t) => {
      g.position.set(CARRILES[o.carril], SUELO, -(o.d - D));
      nubes.forEach((s, k) => {                                     // cada bocanada sube 3 m en 0,7 s, crece y se apaga
        const f = (t * 1.4 + k / 3) % 1;
        s.position.set(Math.sin(k * 2.1 + t) * 0.15, 0.4 + f * 3, 0); s.scale.setScalar(0.9 + f * 2.2); s.material.opacity = 0.65 * (1 - f);
      });
    };
    return g;
  },
  /** La estrella secreta: la estrella de siempre (+1 al multiplicador) en
      violeta, con un anillo; así se nota que estaba escondida. */
  estrellaSecreta() {
    const g = this.estrella(), col = 0xc77dff;
    g.traverse(m => {                                               // la misma forma, otro color: se le cambia el color de los vértices
      if (!m.isMesh || !m.geometry.attributes.color) return;
      const cv = m.geometry.attributes.color, cc = new THREE.Color(col);
      for (let i = 0; i < cv.count; i++) cv.setXYZ(i, cc.r, cc.g, cc.b);
      cv.needsUpdate = true;
    });
    const a = new Arma(this);
    a.pon(new THREE.TorusGeometry(0.66, 0.035, 8, 36), 'luz!', 0xe8c8ff, [0, 0, 0]);
    const aro = a.hecho(false); aro.name = 'cuerpo2'; g.getObjectByName('cuerpo').add(aro);   // el aro gira con la estrella
    if (!this.neon) g.add(sprite(col, 1.8, [0, 0, 0], 0.55));
    return g;
  },
  /** El chicle (un poder de City): una bola rosada envuelta, con su aro de
      luz debajo, como los demás poderes. */
  chicle() {
    const a = new Arma(this), g0 = new THREE.Group();
    a.pon(ESFERA, 'pintura!', 0xff6ec7, [0, 0, 0], null, 0.62);
    a.pon(ESFERA, 'luz!', 0xffd0ee, [-0.12, 0.14, 0.22], null, 0.12);   // el brillo
    for (const s of [-1, 1]) a.pon(new THREE.ConeGeometry(0.16, 0.3, 10), 'pintura!', 0xffffff, [s * 0.42, 0, 0], [0, 0, -s * Math.PI / 2]);   // el envoltorio
    const cuerpo = a.hecho(false); cuerpo.name = 'cuerpo'; g0.add(cuerpo);
    const b = new Arma(this);
    b.pon(new THREE.TorusGeometry(0.62, 0.025, 8, 40), 'luz!', 0xff6ec7, [0, -0.9, 0], [Math.PI / 2, 0, 0]);
    g0.add(b.hecho(false));
    if (this.neon) g0.add(sprite(0xff6ec7, 2.4, [0, 0, 0], 0.7));
    return g0;
  },
  /** Los poderes de City: el chicle, la batería y las monedas ×2 (null si es otro). */
  poderCity(clase) {
    if (clase === 'chicle' && this.chicle) return this.chicle();
    if (clase === 'bateria') return this.bateria();
    if (clase === 'monedas2') return this.monedas2();
    return null;
  },
  /** La batería (llena la energía de la tabla): una pila amarilla con su
      polo, una franja negra y el rayo, con el aro de luz de los poderes. */
  bateria() {
    const a = new Arma(this), g0 = new THREE.Group();
    a.pon(CILINDRO, 'pintura!', 0xffd23f, [0, 0.1, 0], null, [0.5, 0.62, 0.5], 0xffffff);   // el cuerpo
    a.pon(CILINDRO, 'pintura!', 0x22262e, [0, -0.32, 0], null, [0.5, 0.22, 0.5]);           // el fondo negro
    a.pon(CILINDRO_CHICO, 'metal!', 0xdfe4ea, [0, 0.5, 0], null, [0.18, 0.14, 0.18]);      // el polo
    a.pon(new THREE.ShapeGeometry(rayo(0.32)), 'luz!', 0x22c6ff, [0, 0.08, 0.255]);       // el rayo, hacia el corredor
    const cuerpo = a.hecho(false); cuerpo.name = 'cuerpo'; g0.add(cuerpo);
    const b = new Arma(this);
    b.pon(new THREE.TorusGeometry(0.62, 0.025, 8, 40), 'luz!', 0x22c6ff, [0, -0.9, 0], [Math.PI / 2, 0, 0]);
    g0.add(b.hecho(false));
    if (this.neon) g0.add(sprite(0x22c6ff, 2.4, [0, 0, 0], 0.7));
    return g0;
  },
  /** Monedas ×2: dos monedas de oro una delante de la otra y un aro verde. */
  monedas2() {
    const a = new Arma(this), g0 = new THREE.Group();
    for (const [x, y, z] of [[-0.16, 0.12, -0.08], [0.16, -0.1, 0.08]]) a.pon(CILINDRO, 'metal!', 0xffc81e, [x, y, z], [Math.PI / 2, 0, 0], [0.62, 0.12, 0.62], 0xffffff);
    a.pon(new THREE.TorusGeometry(0.2, 0.035, 6, 18), 'luz!', 0xfff3a6, [0.16, -0.1, 0.15]);   // el borde brillante de la de adelante
    const cuerpo = a.hecho(false); cuerpo.name = 'cuerpo'; g0.add(cuerpo);
    const b = new Arma(this);
    b.pon(new THREE.TorusGeometry(0.62, 0.025, 8, 40), 'luz!', 0x6aff8a, [0, -0.9, 0], [Math.PI / 2, 0, 0]);
    g0.add(b.hecho(false));
    if (this.neon) g0.add(sprite(0x6aff8a, 2.4, [0, 0, 0], 0.7));
    return g0;
  },
  /** Una celda de energía de la tabla: un cilindro cian de luz con tapas
      oscuras, que gira y flota. Es más chica que un poder y más grande que
      una moneda: se lee como «otra cosa que se junta». */
  celdaEnergia() {
    const a = new Arma(this);
    a.pon(CILINDRO, 'luz!', 0x5ff6ff, [0, 0, 0], null, [0.32, 0.46, 0.32]);
    for (const s of [-1, 1]) a.pon(CILINDRO, 'pintura!', 0x1d2a3a, [0, s * 0.27, 0], null, [0.36, 0.1, 0.36], 0x5ff6ff);
    a.pon(new THREE.ShapeGeometry(rayo(0.18)), 'luz!', 0xffffff, [0, 0, 0.17]);
    const g = a.hecho();
    g.add(sprite(0x22c6ff, 1.1, [0, 0, 0], this.neon ? 0.8 : 0.45));
    g.userData.colocar = (o, D, t) => {
      g.position.set(CARRILES[o.carril], SUELO + o.y + Math.sin(t * 3 + (o.id || 0)) * 0.08, -(o.d - D));
      g.rotation.y = t * 2.6;
    };
    return g;
  },
  /** La rejilla del pisotón: una tapa de rejilla con su marco de peligro.
      Tiembla cuando te acercas (hay algo abajo); abierta, la tapa queda
      levantada sobre su bisagra y se ve el hueco oscuro. */
  rejillaCity() {
    const g = new THREE.Group();
    const marco = new Arma(this);
    for (const s of [-1, 1]) {
      marco.pon(uvMundo(new THREE.BoxGeometry(1.9, 0.08, 0.12), 0.5), this.neon ? 'texluz:rayasNA!' : 'tex:rayasNA!', 0xffffff, [0, 0.04, s * 0.92], null, 1);
      marco.pon(uvMundo(new THREE.BoxGeometry(0.12, 0.08, 1.9), 0.5), this.neon ? 'texluz:rayasNA!' : 'tex:rayasNA!', 0xffffff, [s * 0.92, 0.04, 0], null, 1);
    }
    marco.pon(CAJA, 'plano!', 0x07080b, [0, 0.01, 0], null, [1.72, 0.02, 1.72]);   // el hueco oscuro (se ve al abrirla)
    g.add(marco.hecho());
    const tapaA = new Arma(this);
    tapaA.pon(CAJA, this.neon ? 'texluz:rejillaNeon!' : 'tex:rejilla!', this.neon ? 0xffb020 : 0xdfe4ea, [0, 0, -0.86], null, [1.72, 0.06, 1.72]);   // la tapa, colgada de su bisagra (la de atrás)
    const tapa = tapaA.hecho(); tapa.position.set(0, 0.07, 0.86); g.add(tapa);
    g.userData.colocar = (o, D, t) => {
      g.position.set(CARRILES[o.carril], SUELO, -(o.d - D));
      if (o.abierta) {                                              // abierta: la tapa sube sobre la bisagra (en 0,2 s) y se queda
        const k = Math.min(1, (t - (o.abiertaT || t)) / 0.2);
        tapa.rotation.x = -1.9 * k; tapa.position.y = 0.07;
      } else {                                                      // cerrada: tiembla cuando la tienes cerca (a menos de 30 m)
        const cerca = o.d - D < 30 && o.d - D > -2;
        tapa.rotation.x = 0; tapa.position.y = 0.07 + (cerca ? Math.abs(Math.sin(t * 38 + (o.id || 0))) * 0.05 : 0);
      }
    };
    return g;
  },
  /** El tramo de burbujas (baja gravedad, Parque de los Lagos): un arco de
      entrada con su cartel redondo y burbujas grandes que flotan sobre los
      tres carriles a lo largo del tramo. Las burbujas son una sola malla
      instanciada (una llamada al GPU); son translúcidas, así que la
      oclusión ambiental no las dibuja (`sinAO`). */
  burbujasCity() {
    const g = new THREE.Group();
    const arco = new Arma(this), col = this.neon ? 0xff2bd6 : 0x6ad1ff;
    for (const s of [-1, 1]) arco.pon(CILINDRO, 'pintura!', col, [s * 3.6, 3, 0], null, [0.22, 6, 0.22], 0xffffff);   // los postes, fuera de la vía
    arco.pon(new THREE.TorusGeometry(3.6, 0.13, 8, 40, Math.PI), 'pintura!', col, [0, 6, 0], null, 1, 0xffffff);   // el arco
    arco.pon(new THREE.CircleGeometry(0.75, 24), 'luz!', 0xffffff, [0, 9.6, 0.02]);                            // el cartel: una burbuja
    arco.pon(new THREE.TorusGeometry(0.75, 0.08, 8, 30), 'luz!', col, [0, 9.6, 0.03]);
    g.add(arco.hecho());
    const N = 18, geo = new THREE.SphereGeometry(1, 18, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0xbfefff, emissive: this.neon ? 0x6a2bff : 0x3fb0ff, emissiveIntensity: this.neon ? 0.6 : 0.25,
      roughness: 0.1, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false });
    const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; im.userData.sinAO = true; im.renderOrder = 3; g.add(im);
    const az = (k => () => ((k = (k * 1664525 + 1013904223) >>> 0) / 4294967296))(77);   // siempre las mismas burbujas
    const B = Array.from({ length: N }, () => ({ f: az(), x: (az() - 0.5) * 7, y: 1.6 + az() * 5.5, r: 0.35 + az() * 0.7, w: az() * 6 }));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    g.userData.colocar = (o, D, t) => {
      g.position.set(0, SUELO, -(o.d0 - D));
      B.forEach((b, k) => {                                       // a lo largo del tramo, subiendo y bajando despacio
        p.set(b.x + Math.sin(t * 0.7 + b.w) * 0.3, b.y + Math.sin(t * 1.1 + b.w) * 0.4, -b.f * o.largo);
        im.setMatrixAt(k, m4.compose(p, q, sc.setScalar(b.r * (1 + Math.sin(t * 2 + b.w) * 0.05))));
      });
      im.instanceMatrix.needsUpdate = true;
    };
    return g;
  },
  /** Las reservas de City, preparadas de a poco con la ciudad (solo en los kits de City). */
  pasosCity(pre) {
    if (!this.pal.distrito || !CITY) return;
    pre('cajon', () => this.cajonCity(), 4); pre('dron', () => this.dronCity(), 3);
    pre('baranda', () => this.barandaCity(), 2); pre('lona', () => this.lonaCity(), 2);
    if (this.pal.distrito === 'bajo') pre('vapor', () => this.vaporCity(), 2);
    pre('estrellaS', () => this.estrellaSecreta(), 1); pre('poder-chicle', () => this.chicle(), 1);
    pre('energia', () => this.celdaEnergia(), 4); pre('rejilla', () => this.rejillaCity(), 1);
    pre('poder-bateria', () => this.bateria(), 1); pre('poder-monedas2', () => this.monedas2(), 1);
    if (this.pal.distrito === 'parque') pre('burbujas', () => this.burbujasCity(), 1);
  }
});

/** El dibujo de un objeto de la pista de City (GANCHOS.objeto), o null si
    no es de City. La estrella secreta no trae `colocar`: flota y gira como
    toda estrella (lo hace mundo.js). */
function objetoCity(kit, o) {
  if (!CITY) return null;
  let obj = null;
  if (o.tipo === 'cajon') obj = kit.saca('cajon', () => kit.cajonCity());
  else if (o.tipo === 'dron') obj = kit.saca('dron', () => kit.dronCity());
  else if (o.tipo === 'baranda') obj = kit.saca('baranda', () => kit.barandaCity());
  else if (o.tipo === 'lona') obj = o.variante === 'vapor' ? kit.saca('vapor', () => kit.vaporCity()) : kit.saca('lona', () => kit.lonaCity());
  else if (o.tipo === 'energia') obj = kit.saca('energia', () => kit.celdaEnergia());
  else if (o.tipo === 'rejilla') obj = kit.saca('rejilla', () => kit.rejillaCity());
  else if (o.tipo === 'burbujas') obj = kit.saca('burbujas', () => kit.burbujasCity());
  else if (o.tipo === 'estrella' && o.secreta) { obj = kit.saca('estrellaS', () => kit.estrellaSecreta()); obj.position.x = CARRILES[o.carril]; }
  return obj;
}

/* ===================================================================
   4. CITY: rasgos de los personajes
   ===================================================================
   Los personajes de City (city.js, PERSONAJES) traen en su `apariencia`,
   además de los colores de siempre, `piel`, `pelo`, `peinado` y `falda`.
   armaCorredor (mundo.js) ya usa la piel y el pelo, y llama aquí para lo
   que el corredor clásico no tiene. La cabeza mide 0,2 m de radio, la cara
   mira a −z y la gorra tapa la coronilla: el pelo nuevo va atrás y abajo.
     · coleta: un moño y una cola que cuelga;
     · melena: el pelo largo hasta los hombros;
     · trenzas: dos trenzas de bolitas a los lados;
     · corto y rapado: solo el pelo de siempre (o nada, bajo la gorra);
     · falda: un tronco de cono en la cadera, sobre las piernas. */
function vistePersonaje(p, kit, asp, pelo) {
  const parte = (padre, construir) => { const a = new Arma(kit); construir(a); padre.add(a.hecho()); };
  if (asp.peinado === 'coleta') parte(p.cab, a => {
    a.pon(ESFERA, 'personaje', pelo, [0, 0.06, 0.2], null, 0.14);                                        // el moño
    a.pon(new THREE.CapsuleGeometry(0.065, 0.26, 4, 10), 'personaje', pelo, [0, -0.12, 0.28], [0.45, 0, 0]);   // la cola
    a.pon(new THREE.TorusGeometry(0.05, 0.018, 6, 12), 'personaje', asp.mochila ?? 0xff5a8a, [0, 0.03, 0.24], [0.4, 0, 0]);   // el elástico
  });
  else if (asp.peinado === 'melena') parte(p.cab, a => {
    a.pon(new THREE.SphereGeometry(0.218, 22, 14, Math.PI * 11 / 6, Math.PI * 4 / 3, Math.PI * 0.3, Math.PI * 0.5), 'personaje', pelo, [0, 0, 0.01]);   // el pelo de los lados, más abajo
    a.pon(redonda(0.4, 0.42, 0.12, 0.05), 'personaje', pelo, [0, -0.2, 0.13]);                             // la caída hasta los hombros
  });
  else if (asp.peinado === 'trenzas') parte(p.cab, a => {
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) a.pon(ESFERA, 'personaje', pelo, [s * 0.16, -0.08 - k * 0.085, 0.1 + k * 0.012], null, 0.095 - k * 0.008);
    for (const s of [-1, 1]) a.pon(ESFERA, 'personaje', asp.mochila2 ?? 0xffffff, [s * 0.16, -0.43, 0.15], null, 0.06);   // las colitas de las puntas
  });
  if (asp.falda != null) parte(p.pelvis, a => {
    a.pon(new THREE.CylinderGeometry(0.19, 0.28, 0.3, 16), 'personaje', asp.falda, [0, -0.1, 0]);
  });
}

/* ===================================================================
   5. LOS EFECTOS DE CITY EN LA ESCENA
   ===================================================================
   GANCHOS.crea los arma una vez por mundo:
     · la burbuja del chicle alrededor del corredor (una esfera rosada
       transparente que tiembla) y su reventón al salvarte de un choque;
     · los trozos de un cajón o un dron pisado: una sola InstancedMesh de 36
       cubitos (una llamada al GPU) que salen volando y caen.
   Todo es dibujo: nada de esto cambia la carrera. */
function creaEfectos({ escena }) {
  const burbuja = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshStandardMaterial({
    color: 0xff7ad9, emissive: 0xff3fb0, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.26, depthWrite: false
  }));
  burbuja.visible = false; burbuja.renderOrder = 3; escena.add(burbuja);
  let chicle = false, revienta = -1;                                // ¿hay burbuja?, y el tiempo del reventón (−1: ninguno)
  const MAX = 36, trozos = [];                                      // {p, v, r, w, t, e}
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
  im.count = 0; im.frustumCulled = false; escena.add(im);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  return {
    /** Muestra u oculta la burbuja; con `pum` la revienta (se agranda y se apaga). */
    chicle(si, pum) { if (pum && chicle) revienta = 0; chicle = !!si; },
    /** Los trozos de un objeto pisado `o` (cajón: madera; dron: gris y cian), donde está ahora (z = 0, el corredor). */
    rompe(o) {
      const col = o.tipo === 'dron' ? [0x3a4a5a, 0x22e5ff, 0xff3030] : [0xc8873a, 0xa86a2a, 0x3a2a1a];
      const y0 = o.tipo === 'dron' ? 1.8 : 0.6;
      for (let k = 0; k < 12; k++) {
        if (trozos.length >= MAX) trozos.shift();
        trozos.push({ p: new THREE.Vector3(CARRILES[o.carril] + (Math.random() - 0.5) * 0.8, y0 + SUELO, (Math.random() - 0.5) * 0.6),
          v: new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 4, -2 - Math.random() * 4), r: Math.random() * 6, w: (Math.random() - 0.5) * 14,
          t: 0, e: 0.12 + Math.random() * 0.14, c: col[k % col.length] });
      }
    },
    /** El escondite de una rejilla abierta: un chorro de monedas que salta del hueco (solo dibujo). */
    geiser(o) {
      for (let k = 0; k < 16; k++) {
        if (trozos.length >= MAX) trozos.shift();
        trozos.push({ p: new THREE.Vector3(CARRILES[o.carril] + (Math.random() - 0.5) * 0.6, SUELO + 0.1, (Math.random() - 0.5) * 0.4),
          v: new THREE.Vector3((Math.random() - 0.5) * 3, 7 + Math.random() * 4, -1 - Math.random() * 2), r: Math.random() * 6, w: (Math.random() - 0.5) * 18,
          t: 0, e: 0.16 + Math.random() * 0.06, c: k % 3 ? 0xffc81e : 0xfff3a6 });
      }
    },
    /** Cada cuadro: la burbuja sigue al corredor y los trozos vuelan con el mundo. */
    paso(e, corredor) {
      const dt = e.dt || 0;
      burbuja.visible = (chicle || revienta >= 0) && !e.menu;
      if (burbuja.visible) {
        const y = (corredor ? corredor.raiz.position.y : e.y + SUELO) + 0.95;
        burbuja.position.set(e.x, y, 0);
        if (revienta >= 0) {                                        // el reventón: 0,25 s
          revienta += dt; const f = Math.min(1, revienta / 0.25);
          burbuja.scale.setScalar(1.15 + f * 0.9); burbuja.material.opacity = 0.35 * (1 - f);
          if (f >= 1) { revienta = -1; burbuja.material.opacity = 0.26; }
        } else {                                                    // tiembla como una pompa
          const t = e.t || 0;
          burbuja.scale.set(1.12 + Math.sin(t * 7) * 0.04, 1.18 + Math.sin(t * 5.3) * 0.05, 1.12 + Math.cos(t * 6.1) * 0.04);
        }
      }
      let n = 0;
      for (let i = trozos.length - 1; i >= 0; i--) {
        const q = trozos[i]; q.t += dt;
        if (q.t > 0.9 || q.p.y < 0) { trozos.splice(i, 1); continue; }
        q.v.y -= 22 * dt; q.p.addScaledVector(q.v, dt); q.p.z += (e.v || 0) * dt; q.r += q.w * dt;   // caen y se quedan atrás con el mundo
      }
      for (const q of trozos) {
        _m.compose(_p.copy(q.p), _q.setFromEuler(_e.set(q.r, q.r * 0.7, 0)), _s.setScalar(q.e));
        im.setMatrixAt(n, _m); im.setColorAt(n, _c.setHex(q.c)); n++;
      }
      im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  };
}

/* ---- se engancha a mundo.js (solo si city.js instaló City en el motor) ---- */
if (CITY) Object.assign(GANCHOS, { paleta: paletaCity, objeto: objetoCity, viste: vistePersonaje, crea: creaEfectos });

export { PALETAS_CITY, paletaCity };
