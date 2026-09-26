"use strict";
/* ============================================================
   Juegos — el motor

   Todo lo que decide *qué pasa* en una partida vive aquí, y aquí no
   se toca ni el DOM ni Firebase: se puede ejecutar en Node con nada
   más que `global.crypto` (que Node ya trae desde la 20).

   La decisión de la que cuelga el resto: **el registro de jugadas es
   el estado**. En la base solo se guarda una lista de jugadas que
   nadie puede reescribir (las reglas exigen que la clave no exista
   todavía), y cada cliente la vuelve a pasar por `reducir()` para
   saber cómo está el tablero. Guardar el tablero ya calculado habría
   sido más cómodo de pintar y habría dejado que un cliente escribiera
   un tablero que no se deduce de ninguna jugada — es decir, que hiciera
   trampa sin que nada lo delatara. Así, además, las reglas del juego
   están en un solo sitio y se pueden comprobar sin abrir el navegador.

   Nada de lo que se genera al azar se guarda: de la partida se guarda
   una `semilla` y de ella salen el fondo del escondite y los mazos de
   las cartas, iguales en las dos máquinas. Un fondo son doscientas
   piezas; mandarlas por la red sería mandar un dibujo entero para algo
   que un número de 32 bits describe igual de bien.
   ============================================================ */

/* `minimo` es cuántos hacen falta para empezar y `cupo` cuántos caben
   como mucho. Cuadritos, Circuit Breakers, la reacción en cadena y Flip 7
   admiten más de dos; el resto son duelos por construcción — el
   escondite cruza *dos* paisajes, las cartas resuelven *un* choque y el reversi tiene *dos* colores.
   Los topes de grupo son lo que cada juego aguanta sin romperse: ocho
   cuadrillas es lo más que Circuit Breakers sabe colocar en los cuatro
   mapas con seis robots cada una, ocho colores es lo más que la reacción
   en cadena distingue de un vistazo, ocho asientos es lo que cabe en la
   media luna de Flip 7; cuadritos no tiene nada de eso y llega a diez.
   El cacho se queda en ocho: son cuarenta dados en la mesa, y con más
   una apuesta ya no se puede calcular a ojo, que es todo el juego.
   Catan llega a seis, que es lo que admite la ampliación: pasado eso
   la isla grande no tiene costa para todos. */
export const JUEGOS = {
  orbita: { nombre: "Órbita", lema: "Captura estrellas y decide el próximo movimiento de tu rival", color: "#8860ed", minimo: 2, cupo: 2 },
  escondite: {
    nombre: "Escondite",
    lema: "Esconde a tu persona en el paisaje y encuentra la del otro",
    color: "#e0653a",
    minimo: 2,
    cupo: 2
  },
  cartas: {
    nombre: "Cartas de los tres elementos",
    lema: "Fuego, agua y nieve — tres cartas de tres colores y ganas",
    color: "#d4356b",
    minimo: 2,
    cupo: 2
  },
  cuadritos: {
    nombre: "Cuadritos",
    lema: "Cierra más cajas que los demás, una raya por turno",
    color: "#0f62fe",
    minimo: 2,
    cupo: 10
  },
  worms: {
    nombre: "Circuit Breakers",
    lema: "Cuadrillas eléctricas, terreno destructible y un disparo por turno",
    color: "#f2a33a",
    minimo: 2,
    cupo: 8
  },
  reversi: {
    nombre: "Reversi",
    lema: "Atrapa las fichas del otro entre las tuyas y dales la vuelta",
    color: "#0d9488",
    minimo: 2,
    cupo: 2
  },
  cadena: {
    nombre: "Reacción en cadena",
    lema: "Carga una celda hasta que estalle y conquista a sus vecinas en cadena",
    color: "#ff3d7f",
    minimo: 2,
    cupo: 8
  },
  flip7: {
    nombre: "Flip 7",
    lema: "Pide carta o plántate: siete números distintos y te llevas el bono",
    color: "#e8a317",
    minimo: 2,
    cupo: 10
  },
  cacho: {
    nombre: "Cacho",
    lema: "Dudo o calzo: cinco dados en el vaso y gana el último que conserve alguno",
    color: "#b5462c",
    minimo: 2,
    cupo: 8
  },
  uno: {
    nombre: "UNO",
    lema: "Clásico, No Mercy, All Wild o Liar's: quédate sin cartas antes que nadie",
    color: "#e03a2f",
    minimo: 2,
    cupo: 10
  },
  catan: {
    nombre: "Catan",
    lema: "Coloniza la isla, comercia y construye: el primero en llegar a la meta gana",
    color: "#d9822b",
    minimo: 2,
    cupo: 6
  }
};

/* Cuánta gente cabe en *esta* sala: lo que eligió quien la abrió,
   recortado a lo que el juego admite. Una partida creada antes de que
   esto existiera no tiene `cupo` y se lee como dos, que es lo que era. */
export function cupoDe(p) {
  const j = JUEGOS[p && p.juego] || {};
  const tope = j.cupo || 2, min = j.minimo || 2;
  const n = Math.floor(Number(p && p.cupo)) || min;
  return Math.max(min, Math.min(tope, n));
}

/* ============================================================
   1. Azar reproducible
   ============================================================ */

/* mulberry32: un generador de 32 bits que cabe en cinco líneas y no
   depende de la implementación de Math.random, que no está definida y
   varía entre navegadores. Aquí eso no es una manía: las dos máquinas
   tienen que dibujar exactamente el mismo paisaje. */
export function rng(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function semillaAleatoria() {
  return (Math.floor(Math.random() * 0xFFFFFFFF) >>> 0) || 1;
}

/* Mezcla de Fisher-Yates con un generador dado: el mismo mazo en las
   dos pantallas. Devuelve una copia; el original no se toca. */
export function mezcla(lista, r) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

const ent = (r, min, max) => min + Math.floor(r() * (max - min + 1));

/* ============================================================
   2. Compromiso (hash) — para lo que hay que elegir a la vez

   Los dos juegos que tienen información oculta la resuelven igual:
   primero se publica el hash de la elección con una sal, y solo
   cuando los dos han publicado el suyo se revela. Sin esto, quien
   escribiera segundo vería la jugada del otro y elegiría a la vista.

   Lo que esto compra de verdad, dicho sin adornos: **nadie puede
   cambiar su elección después de ver la del otro**. Lo que no compra
   es que el escondite sea inviolable — el navegador que busca tiene
   que dibujar el personaje para que se pueda encontrar, así que las
   coordenadas están por fuerza en su memoria y quien abra las
   herramientas del navegador las verá. Es un juego entre amigos y
   esa es la frontera honesta.
   ============================================================ */

export function salAleatoria() {
  const b = new Uint8Array(12);
  (globalThis.crypto || {}).getRandomValues?.(b);
  return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}

export async function compromiso(valor, sal) {
  const datos = new TextEncoder().encode(JSON.stringify(valor) + "|" + sal);
  const h = await globalThis.crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(h), x => x.toString(16).padStart(2, "0")).join("");
}

export async function compromisoValido(valor, sal, hash) {
  try { return (await compromiso(valor, sal)) === hash; } catch (e) { return false; }
}

/* ============================================================
   3. Escondite — el paisaje

   Un fondo son piezas colocadas al azar sobre un degradado. Se generan
   aquí (números) y se pintan en `escondite.js` (trazos): así el paisaje
   se puede comprobar en Node y, sobre todo, las dos máquinas parten de
   la misma lista sin mandarse un solo píxel.

   El personaje se esconde en coordenadas normalizadas (0..1) para que
   el mismo escondite valga en una pantalla de portátil y en un móvil.
   ============================================================ */

export const TEMAS = {
  bosque:  { cielo: ["#bfe3a7", "#7cb964"], suelo: "#4a7a3a", piezas: ["arbol", "mata", "roca", "flor", "tronco", "seta"] },
  playa:   { cielo: ["#bfe8f5", "#7fc9e8"], suelo: "#e6d3a3", piezas: ["palmera", "sombrilla", "concha", "roca", "cangrejo", "mata"] },
  ciudad:  { cielo: ["#c9d2dc", "#8d9aa8"], suelo: "#6d737a", piezas: ["edificio", "farola", "coche", "banco", "arbusto", "senal"] },
  nieve:   { cielo: ["#dceaf5", "#a9c7de"], suelo: "#eef4f8", piezas: ["pino", "muneco", "roca", "tronco", "valla", "mata"] },
  espacio: { cielo: ["#171a33", "#2b2050"], suelo: "#3b2f4d", piezas: ["planeta", "estrella", "roca", "cohete", "cristal", "antena"] }
};

const NOMBRES_TEMA = Object.keys(TEMAS);

/* Cuántas piezas caben sin que deje de ser un paisaje y empiece a ser
   una sopa. Con menos de 140 el personaje canta a la primera; con más
   de 300 el canvas tarda y el juego deja de ser mirar y pasa a ser
   suerte. */
const PIEZAS = 330;

export function escena(semilla) {
  const r = rng(semilla >>> 0);
  const tema = NOMBRES_TEMA[Math.floor(r() * NOMBRES_TEMA.length)];
  const t = TEMAS[tema];
  const piezas = [];
  for (let i = 0; i < PIEZAS; i++) {
    const y = 0.18 + Math.pow(r(), 0.7) * 0.80;      // más densidad abajo, como en un paisaje real
    piezas.push({
      k: t.piezas[Math.floor(r() * t.piezas.length)],
      x: r(),
      y,
      s: 0.5 + r() * 1.3,
      g: r() * 0.5 - 0.25,                            // giro leve, en radianes
      c: Math.floor(r() * 6),                         // índice dentro de la paleta de la pieza
      v: r()                                          // variación libre (altura, número de hojas…)
    });
  }
  // Multitud reproducible: los mismos personajes en ambos dispositivos.
  for (let i = 0; i < 150; i++) piezas.push({k: "persona", x: .04 + r() * .92,
    y: .23 + r() * .71, s: 1, g: 0, c: Math.floor(r() * 6), v: r()});
  /* De cerca a lejos: lo que está más abajo se pinta encima, o los
     árboles del fondo taparían a los de delante. */
  piezas.sort((a, b) => a.y - b.y);
  return { tema, semilla: semilla >>> 0, piezas };
}

/* La escena de cada jugador sale de la semilla de la partida y de su
   turno de entrada, no de un número propio: así el que busca puede
   generar el paisaje del otro sin que nadie se lo mande. */
export const semillaEscena = (semilla, orden) => ((semilla >>> 0) ^ ((orden + 1) * 0x9E3779B1)) >>> 0;

/* El personaje se da por encontrado dentro de este radio (fracción del
   ancho). 0.035 son unos 30 px en un lienzo de 900: más o menos el
   tamaño del muñeco, que es lo justo — pedir el píxel exacto convierte
   el juego en una lotería de precisión del ratón. */
export const RADIO_ACIERTO = 0.035;

export function acierta(clic, sitio) {
  const dx = clic.x - sitio.x, dy = (clic.y - sitio.y) * 0.62;   // el lienzo es más ancho que alto
  return Math.sqrt(dx * dx + dy * dy) <= RADIO_ACIERTO;
}

/* Márgenes del escondite: pegado al borde no se ve entero y no habría
   forma de encontrarlo. */
export function sitioValido(p) {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0.03 && p.x <= 0.97 && p.y >= 0.20 && p.y <= 0.97;
}

/* Cada fallo cuesta dos segundos de espera. Sin penalización la
   estrategia ganadora es tapar la pantalla de clics, que no es un
   juego de observación sino de dedo rápido. */
export const CASTIGO_FALLO = 2000;

/* ============================================================
   4. Cartas de los tres elementos

   Las reglas del Card-Jitsu, que son de las pocas que un niño entiende
   en diez segundos y a la vez tienen fondo: fuego funde la nieve, la
   nieve congela el agua, el agua apaga el fuego. A igual elemento gana
   el número; empate exacto y la ronda no la gana nadie.
   ============================================================ */

export const ELEMENTOS = {
  fuego: { nombre: "Fuego", icono: "🔥", gana: "nieve", color: "#e8442a", claro: "#ffb4a2" },
  agua:  { nombre: "Agua",  icono: "💧", gana: "fuego", color: "#1a7fd4", claro: "#a8d8f5" },
  nieve: { nombre: "Nieve", icono: "❄", gana: "agua",  color: "#6c4bb6", claro: "#d4c4f0" }
};

export const COLORES_CARTA = ["rojo", "azul", "amarillo", "verde", "naranja", "morado"];
export const HEX_CARTA = {
  rojo: "#d6294a", azul: "#1f6fd0", amarillo: "#e0a90c",
  verde: "#1f9d55", naranja: "#e2701a", morado: "#7b3fbf"
};

export const MANO = 5;        // cartas a la vista
const VALOR_MAX = 12;

/* El mazo entero: 3 elementos × 6 colores × 12 valores = 216 cartas.
   Cada jugador baraja el suyo con su propia semilla — dos mazos
   independientes, como en la mesa, y ninguno de los dos se manda por
   la red. */
export function mazo(semilla, orden) {
  const todas = [];
  for (const e of Object.keys(ELEMENTOS))
    for (const c of COLORES_CARTA)
      for (let v = 1; v <= VALOR_MAX; v++) todas.push({ e, c, v });
  return mezcla(todas, rng(((semilla >>> 0) ^ ((orden + 1) * 0x85EBCA6B)) >>> 0));
}

/* El mazo de cada jugador se pide muchas veces (el reductor corre
   entero con cada cambio que llega de la base), y barajar 216 cartas
   para volver a obtener lo mismo es tirar trabajo. Se recuerda por
   semilla y orden, que es lo único de lo que depende. */
const mazosVistos = new Map();
export function mazoDe(semilla, orden) {
  const k = (semilla >>> 0) + ":" + orden;
  let m = mazosVistos.get(k);
  if (!m) { m = mazo(semilla, orden); mazosVistos.set(k, m); }
  return m;
}

/* La carta número `i` del mazo de un jugador.

   **El mazo se baraja con una semilla privada**, no con la de la
   partida. Vive en `misPartidas/<uid>/<pid>/sec`, que las reglas solo
   dejan leer a su dueño (ver `fb-juegos.js`), y esa es toda la
   diferencia: la mano del otro ya no se puede calcular. Antes la
   semilla era la de la partida, pública por fuerza, así que las dos
   manos se enseñaban boca arriba — fingir lo contrario habría sido un
   secreto que cualquiera destapa con la consola del navegador.

   El precio es que la carta ya no se deduce del índice: viaja escrita
   en la jugada revelada. Lo que impide entonces revelar una carta que
   no se tenía son dos candados, y hacen falta los dos:

   - **el compromiso de la ronda**, que ahora se hace sobre
     `[i, e, c, v]` — la carta entera, no solo su sitio —, así que
     nadie puede cambiarla después de ver la del otro;
   - **el compromiso del mazo**: al entrar se promete `hmazo` en la
     ficha (que las reglas dejan escribir una sola vez) y al acabar se
     revela la semilla. Con ella el otro navegador rehace el mazo y
     comprueba que cada carta jugada estuviera de verdad en el índice
     que dijo. Lo hace `auditaCartas`.

   La frontera honesta, igual que en el escondite: quien cierre la
   pestaña antes del final no revela su semilla, y esa partida se queda
   sin auditar. Nadie gana con ello — la victoria ya está escrita —,
   pero tampoco queda demostrado que se jugara limpio. */
export const cartaDe = (semilla, orden, i) => mazoDe(semilla, orden)[i] || null;

/* Una carta que llega escrita en una jugada solo es una carta si sus
   tres campos existen de verdad en el mazo. No prueba que sea *la
   suya* — eso es cosa de la auditoría —, pero evita que un `v: 99`
   inventado entre en el reductor y decida una ronda. */
export function cartaLegal(j) {
  if (!j) return null;
  const i = Math.floor(Number(j.i)), v = Math.floor(Number(j.v));
  if (!Number.isInteger(i) || i < 0) return null;
  if (!ELEMENTOS[j.e] || COLORES_CARTA.indexOf(j.c) < 0) return null;
  if (!Number.isInteger(v) || v < 1 || v > VALOR_MAX) return null;
  return { i, e: j.e, c: j.c, v };
}

/* Quién gana la ronda: 1 el primero, 2 el segundo, 0 nadie. */
export function resuelveRonda(a, b) {
  if (!a || !b) return 0;
  if (a.e === b.e) return a.v === b.v ? 0 : (a.v > b.v ? 1 : 2);
  if (ELEMENTOS[a.e].gana === b.e) return 1;
  if (ELEMENTOS[b.e].gana === a.e) return 2;
  return 0;
}

/* Se gana con tres cartas del mismo elemento en tres colores distintos,
   o con una de cada elemento en tres colores distintos. Devuelve las
   tres cartas que dan la victoria (para poder señalarlas en pantalla)
   o null. Los colores distintos son lo que impide ganar acumulando
   fuego rojo tres veces, que sería la única táctica del juego. */
export function victoriaCartas(ganadas) {
  const trios = (lista) => {
    for (let i = 0; i < lista.length; i++)
      for (let j = i + 1; j < lista.length; j++)
        for (let k = j + 1; k < lista.length; k++) {
          const t = [lista[i], lista[j], lista[k]];
          const cols = new Set(t.map(c => c.c));
          if (cols.size !== 3) continue;
          const els = new Set(t.map(c => c.e));
          if (els.size === 1 || els.size === 3) return t;
        }
    return null;
  };
  return trios(ganadas || []);
}

/* ============================================================
   5. Cuadritos (puntos y cajas)

   El tercero es el que yo elijo: se explica en una frase, cabe en un
   tablero pequeño y tiene una trampa preciosa — quien se ve obligado
   a abrir una cadena la regala entera. Es por turnos de verdad, así
   que la red apenas trabaja: una raya por jugada.

   El tablero es de N×N puntos, o sea (N-1)² cajas. Las rayas se
   nombran por orientación y por el punto del que salen: "h" es la que
   va hacia la derecha desde (f,c) y "v" la que baja.
   ============================================================ */

export const LADO = 6;        // 6×6 puntos = 25 cajas; una partida dura unos tres minutos

/* Los tres tamaños que ofrece la sala. El mediano es el de siempre,
   que es el que se mide en minutos; el grande con seis jugadores pasa
   de los diez, y por eso no hay un cuarto más grande. Se guarda el
   número de *puntos* del lado, que es lo que el resto del código pide,
   y la etiqueta habla de cajas, que es lo que se ve. */
export const TAMANOS = {
  pequeno: { nombre: "Pequeño", lado: 5 },
  mediano: { nombre: "Mediano", lado: 6 },
  grande:  { nombre: "Grande",  lado: 8 }
};
export const etiquetaTamano = k => {
  const t = TAMANOS[k];
  return t ? `${t.nombre} (${t.lado - 1}×${t.lado - 1})` : "";
};
/* Un `lado` que llega de la base se recorta a los tamaños ofrecidos:
   un número cualquiera dibujaría un tablero que nadie eligió. */
export function ladoDe(p) {
  const n = Math.floor(Number(p && p.lado)) || LADO;
  const validos = Object.values(TAMANOS).map(t => t.lado);
  return validos.includes(n) ? n : LADO;
}

export const claveRaya = (o, f, c) => `${o}${f}_${c}`;

export function rayaValida(o, f, c, lado = LADO) {
  if (o !== "h" && o !== "v") return false;
  if (!Number.isInteger(f) || !Number.isInteger(c) || f < 0 || c < 0) return false;
  if (o === "h") return f < lado && c < lado - 1;
  return f < lado - 1 && c < lado;
}

export const totalRayas = (lado = LADO) => 2 * lado * (lado - 1);

/* Cajas que cierra una raya recién puesta (0, 1 o 2). Una raya toca
   como mucho dos cajas — la de arriba y la de abajo, o la de cada
   lado — y solo cuenta la que ya tenía las otras tres. */
export function cajasQueCierra(rayas, o, f, c, lado = LADO) {
  const hay = (oo, ff, cc) => !!rayas[claveRaya(oo, ff, cc)];
  const caja = (ff, cc) =>
    ff >= 0 && cc >= 0 && ff < lado - 1 && cc < lado - 1 &&
    hay("h", ff, cc) && hay("h", ff + 1, cc) && hay("v", ff, cc) && hay("v", ff, cc + 1);
  const out = [];
  if (o === "h") { if (caja(f, c)) out.push([f, c]); if (caja(f - 1, c)) out.push([f - 1, c]); }
  else { if (caja(f, c)) out.push([f, c]); if (caja(f, c - 1)) out.push([f, c - 1]); }
  return out;
}

/* ============================================================
   5.4 Reversi

   El cuarto juego, y está aquí por lo mismo que cuadritos estaba: los
   otros tres son mirar, adivinar y contar cadenas, y este es leer el
   tablero. Es Othello con sus reglas de siempre: se pone ficha donde
   atrape una fila de fichas del otro entre la nueva y una propia, y
   todas las atrapadas cambian de color. Gana quien tenga más al final.

   Tres decisiones:

   - **El tablero se guarda como casilla → uid**, no como "n"/"b". El
     color lo da el orden de entrada (quien abre la sala juega negras y
     empieza, que es la regla del juego), pero contar fichas por
     jugador es lo que hace el marcador, y con el uid dentro eso es un
     recorrido y no una traducción.
   - **La captura se decide con una bandera explícita**, no deduciendo
     por qué salió el bucle: el rayo tiene que morir en una ficha
     propia *después* de al menos una del otro, y esas dos condiciones
     leídas del estado final del índice se confunden con el borde.
   - **Pasar no es una jugada.** Si al que le toca no le quedan
     casillas, el turno vuelve al otro sin que nadie escriba nada — el
     reductor lo calcula — y la partida acaba cuando ninguno de los dos
     puede. Una jugada «paso» habría sido una jugada que el otro no
     puede comprobar y que se podría escribir de más.
   ============================================================ */

export const REV_LADO = 8;
export const claveCasilla = (f, c) => `${f}_${c}`;

const REV_DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

/* Las cuatro del centro, como manda el juego: las negras en diagonal
   ascendente y las blancas en la otra. */
export function revInicial(negras, blancas, lado = REV_LADO) {
  const m = lado / 2 - 1;
  return {
    [claveCasilla(m, m)]: blancas,
    [claveCasilla(m, m + 1)]: negras,
    [claveCasilla(m + 1, m)]: negras,
    [claveCasilla(m + 1, m + 1)]: blancas
  };
}

/* Las fichas que se voltean al poner una en (f,c). Vacío significa
   «ahí no se puede», que es la única forma de saberlo. */
export function revCapturas(tab, f, c, mio, lado = REV_LADO) {
  if (!Number.isInteger(f) || !Number.isInteger(c)) return [];
  if (f < 0 || c < 0 || f >= lado || c >= lado) return [];
  if (tab[claveCasilla(f, c)]) return [];
  const out = [];
  for (const [df, dc] of REV_DIRS) {
    const tramo = [];
    let ff = f + df, cc = c + dc, cierra = false;
    while (ff >= 0 && cc >= 0 && ff < lado && cc < lado) {
      const q = tab[claveCasilla(ff, cc)];
      if (!q) break;                       // hueco: el rayo no cierra
      if (q === mio) { cierra = tramo.length > 0; break; }
      tramo.push([ff, cc]);
      ff += df; cc += dc;
    }
    if (cierra) for (const x of tramo) out.push(x);
  }
  return out;
}

/* Casilla → fichas que voltearía, para todas las jugables. El tablero
   son 64 casillas y ocho direcciones: recorrerlo entero cada vez es
   medio millar de comprobaciones, nada que se note. */
export function revJugadas(tab, mio, lado = REV_LADO) {
  const out = {};
  for (let f = 0; f < lado; f++) for (let c = 0; c < lado; c++) {
    const caps = revCapturas(tab, f, c, mio, lado);
    if (caps.length) out[claveCasilla(f, c)] = caps;
  }
  return out;
}

export function revCuenta(tab) {
  const out = {};
  for (const k in tab) out[tab[k]] = (out[tab[k]] || 0) + 1;
  return out;
}

/* ============================================================
   6. El reductor

   `reducir(partida)` toma lo que hay en la base y devuelve el estado
   que se pinta. Es la única forma de saber de quién es el turno, qué
   fase se juega y quién ha ganado; nadie escribe nada de eso.
   ============================================================ */

/* Los jugadores en su orden de entrada. Un objeto de RTDB no conserva
   el orden de inserción, así que el orden es un campo, no la posición. */
export function jugadoresDe(p) {
  const j = Object.entries(p.jugadores || {}).map(([uid, v]) => ({ uid, ...v }));
  j.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.uid.localeCompare(b.uid));
  return j;
}

/* Las jugadas en orden. Las claves son números con ceros delante
   (`0007`), así que ordenarlas como texto es ordenarlas como números
   hasta la jugada 9999 — que ninguna partida de estas alcanza. */
export function jugadasDe(p) {
  return Object.entries(p.jugadas || {})
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => ({ k, ...v }));
}

export const claveJugada = n => String(n).padStart(4, "0");

/* ---------- Expulsar por votación ----------
   Un voto es una jugada más, `{t:"voto", uid:<quien vota>, contra:<a
   quién>}`, y retirarlo es otra con `no:true`: el registro sigue siendo
   de solo añadir, y las reglas no necesitan saber que existe (una
   jugada solo ha de estar firmada por un jugador de la sala). Cuando
   los votos contra alguien alcanzan la mayoría de los *demás* que
   siguen en la sala, esa misma jugada se reescribe —aquí, al leerla,
   nunca en la base— como `{t:"abandona", uid:<expulsado>}`: para cada
   reductor el expulsado se ha ido por su pie, que es un caso que todos
   ya saben resolver. Los votos que no expulsan a nadie desaparecen del
   registro antes de llegar al reductor del juego, así que ninguno
   tiene que aprender a ignorarlos.

   El orden decide, como en todo lo demás: un voto cuenta con los que
   hay *en ese momento*, y uno posterior a la expulsión, del expulsado
   o contra él, no cuenta. Con dos en la sala «la mayoría de los demás»
   es uno, es decir, el otro: en un duelo expulsar es ganar, y por eso
   la pantalla solo ofrece el botón cuando el rival lleva un buen rato
   sin mover en su turno. El reductor no puede comprobar ese rato —las
   jugadas no llevan hora—, y es el mismo precio que ya se paga con
   abandonar: un cliente modificado podría escribir `fin` directamente.
   Quien el propio juego ha eliminado (sin orbes, sin cuadrilla) sigue
   contando para la mayoría; ahí la cuenta sale más exigente de lo
   necesario, nunca más laxa. */
export function mayoriaExpulsion(n) {
  const otros = n - 1;
  return otros <= 1 ? 1 : Math.floor(otros / 2) + 1;
}

export function votacion(p) {
  const js = jugadoresDe(p), ids = new Set(js.map(j => j.uid));
  const fuera = new Set(), votos = {}, expulsados = [], jugadas = {};
  let hay = false;
  /* Quien se va, por su pie o expulsado, se lleva los votos que tenía
     y los que había contra él. Los pendientes no se disparan solos
     porque la sala haya encogido: cuentan cuando alguien vuelve a
     votar, que es cuando alguien ha decidido algo con la sala nueva. */
  const olvida = u => {
    delete votos[u];
    for (const x in votos) votos[x] = votos[x].filter(y => y !== u);
  };
  for (const j of jugadasDe(p)) {
    const { k, ...v } = j;
    if (j.t !== "voto") {
      if (j.t === "abandona" && ids.has(j.uid)) { fuera.add(j.uid); olvida(j.uid); }
      jugadas[k] = v;
      continue;
    }
    hay = true;
    const de = j.uid, contra = j.contra;
    if (!ids.has(de) || !ids.has(contra) || de === contra || fuera.has(de) || fuera.has(contra)) continue;
    const s = votos[contra] || (votos[contra] = []);
    const i = s.indexOf(de);
    if (j.no) { if (i >= 0) s.splice(i, 1); }
    else if (i < 0) s.push(de);
    const activos = js.filter(x => !fuera.has(x.uid)).length;
    if (s.length >= mayoriaExpulsion(activos)) {
      jugadas[k] = { t: "abandona", uid: contra, expulsado: true, por: s.slice() };
      expulsados.push({ uid: contra, por: s.slice(), k });
      fuera.add(contra);
      olvida(contra);
    }
  }
  for (const u in votos) if (!votos[u].length) delete votos[u];
  return { p: hay ? { ...p, jugadas } : p, votos, expulsados };
}

/* `listos` es «la partida está en marcha». Con cupo de dos basta con
   que estén los dos; con cupo mayor hace falta además que la sala se
   haya cerrado — llena, o cerrada a mano por quien la abrió — porque
   si no, el tercero llegaría a un tablero empezado y sin turno. Ese
   cierre es justo el `estado`, que deja de ser «esperando». */
export function reducir(p) {
  const V = votacion(p);
  p = V.p;
  const js = jugadoresDe(p);
  const cupo = cupoDe(p);
  const min = (JUEGOS[p.juego] || {}).minimo || 2;
  const listos = js.length >= min && (cupo === min || p.estado !== "esperando");
  const base = { jugadores: js, cupo, listos, fin: p.fin || null, votos: V.votos, expulsados: V.expulsados };
  if (p.juego === "escondite") return { ...base, ...redEscondite(p, js) };
  if (p.juego === "cartas") return { ...base, ...redCartas(p, js) };
  if (p.juego === "cuadritos") return { ...base, ...redCuadritos(p, js, listos) };
  if (p.juego === "reversi") return { ...base, ...redReversi(p, js) };
  if (p.juego === "orbita") return { ...base, ...redOrbita(p, js) };
  if (p.juego === "worms") return { ...base, ...redWorms(p, js, listos) };
  if (p.juego === "cadena") return { ...base, ...redCadena(p, js, listos) };
  if (p.juego === "flip7") return { ...base, ...redFlip7(p, js, listos) };
  if (p.juego === "cacho") return { ...base, ...redCacho(p, js, listos) };
  if (p.juego === "uno") return { ...base, ...redUno(p, js, listos) };
  if (p.juego === "catan") return { ...base, ...redCatan(p, js, listos) };
  return base;
}

/* ¿La partida está esperando algo de `uid`? Es lo que enciende el «Tu
   turno» del título de la pestaña. Los juegos por turnos lo dicen con
   `turno`; cartas y escondite eligen a la vez, y ahí «te toca» es «los
   demás ya pueden haber elegido y tú todavía no». La búsqueda del
   escondite no cuenta: los dos buscan a la vez desde que empieza, así
   que no hay nada que avisar que no se esté viendo ya. */
export function meToca(est, uid) {
  if (!est || !uid || !est.listos || est.fin || est.fase === "fin" || est.fase === "espera") return false;
  if (!(est.jugadores || []).some(j => j.uid === uid)) return false;
  if (est.fase === "esconder") return !(est.compromisos || {})[uid];
  if (est.rev && est.comp) return est.fase === "jugando" && !est.comp[uid];
  /* El UNO dice a quién espera en `debe`: a veces a varios (las monedas,
     las cartas boca abajo del reto del Liar's). */
  if (Array.isArray(est.debe)) return est.debe.includes(uid);
  return !!est.turno && est.turno === uid;
}

/* Cuánto de la partida se ha jugado, de 0 a 1. Solo lo usa la música,
   que acelera en el último tramo como en una recreativa: el tablero ya
   dice cuánto queda, así que no hace falta llevar la cuenta aparte.
   Cartas no tiene tablero que se llene; ahí cuentan las rondas que
   lleva ganadas quien va delante, sobre cinco. No es exacto —cinco
   cartas del mismo color no hacen trío— pero con tres ya puede haberlo,
   así que a partir de ahí el duelo puede acabar en cualquier ronda. Los juegos que no se prestan
   —el escondite va a reloj, Circuit Breakers trae su propia música—
   dan 0. */
export function progreso(est, juego) {
  if (!est || est.fase !== "jugando") return 0;
  const c = x => Math.max(0, Math.min(1, x || 0));
  if (juego === "cuadritos" && est.rayas) {
    const hechas = Object.keys(est.rayas).length;
    return c(hechas / (hechas + (est.restantes || 0)));
  }
  if (juego === "reversi" && est.lado) {
    const casillas = est.lado * est.lado - 4;
    return c((casillas - (est.libres || 0)) / casillas);
  }
  if (juego === "orbita" && est.estrellas) return c(Object.keys(est.tomadas || {}).length / est.estrellas.length);
  /* En la reacción en cadena el tablero no se llena: se tiñe. Cuenta
     qué parte de lo ocupado es de quien va delante, y no antes de que
     todos hayan jugado dos veces — al principio uno solo ya es «todo». */
  if (juego === "cadena" && est.celdas) {
    if ((est.movs || 0) < 2 * (est.jugadores || []).length) return 0;
    const v = Object.values(est.celdas), tot = v.reduce((a, b) => a + b, 0);
    return tot ? c(Math.max(...v) / tot) : 0;
  }
  if (juego === "flip7" && est.puntos) return c(Math.max(0, ...Object.values(est.puntos)) / (est.meta || F7_META));
  /* En el cacho se van perdiendo dados: cuenta lo que ya no está en la mesa. */
  if (juego === "cacho" && est.inicial) return c(1 - (est.total || 0) / est.inicial);
  /* En el UNO cuenta lo cerca que está de quedarse sin cartas quien menos tiene. */
  if (juego === "uno" && est.cartas && est.etapa === "juego") {
    const q = (est.jugadores || []).map(j => j.uid).filter(u => !(est.fuera || {})[u] && !(est.elim || {})[u]);
    if (!q.length) return 0;
    return c((UNO_MANO - Math.min(...q.map(u => est.cartas[u]))) / (UNO_MANO - 1));
  }
  /* En Catan, lo cerca que está de la meta quien va primero. */
  if (juego === "catan" && est.vp) return c(Math.max(0, ...Object.values(est.vp)) / (est.meta || 10));
  if (juego === "cartas" && est.ganadas) return c(Math.max(0, ...Object.values(est.ganadas).map(g => g.length)) / 5);
  return 0;
}

/* ---------- Circuit Breakers ----------
   La física no pasa por aquí: la simula el propio juego (juegos/worms),
   que publica al final de cada turno una foto del estado como jugada
   `turno` con `k` (número de turno), `v` (los uid que siguen en pie),
   `d` (daño hecho por cada cuadrilla, en orden de asiento) y `ti` (qué
   cuadrilla jugó). Este reductor solo lee esas cabeceras, que es todo
   lo que la página necesita: quién juega, quién queda y quién ganó.

   Vale la *primera* foto de cada turno, igual que en el juego: si dos
   navegadores publican el mismo turno —el que jugó y el que lo releva
   porque se le cayó la red— el segundo llega tarde y no cuenta. */
const lista = x => Array.isArray(x) ? x : Object.values(x || {});

export function redWorms(p, js = jugadoresDe(p), listos = true) {
  const vistos = new Set(), fuera = {};
  let ultimo = null, turnos = 0, motivo = "";
  const ids = new Set(js.map(j => j.uid));
  for (const j of jugadasDe(p)) {
    if (j.t === "abandona") { if (ids.has(j.uid)) fuera[j.uid] = true; continue; }
    if (j.t !== "turno") continue;
    const k = +j.k;
    if (!(k > 0) || vistos.has(k)) continue;
    vistos.add(k); turnos++;
    if (!ultimo || k > +ultimo.k) ultimo = j;
  }
  const enPie = ultimo ? new Set(lista(ultimo.v).filter(u => ids.has(u))) : new Set(ids);
  const vivos = js.filter(j => enPie.has(j.uid) && !fuera[j.uid]);
  const d = ultimo ? lista(ultimo.d) : [];
  const puntos = {};
  js.forEach((j, i) => { puntos[j.uid] = Math.round(+d[i] || 0); });

  let ganador = null;
  if (listos && vivos.length <= 1) {
    ganador = vivos.length ? vivos[0].uid : "";
    /* Si alguien se fue y eso dejó la partida con uno, fue por abandono;
       si las cuadrillas cayeron combatiendo, es victoria (o apagón). */
    const sinAbandonos = js.filter(j => enPie.has(j.uid));
    motivo = sinAbandonos.length > 1 ? "abandono" : vivos.length ? "victoria" : "apagon";
  }
  let turno = "";
  if (vivos.length) {
    const ti = ultimo ? +ultimo.ti : -1;
    for (let n = 1; n <= js.length; n++) {
      const c = js[((ti + n) % js.length + js.length) % js.length];
      if (vivos.includes(c)) { turno = c.uid; break; }
    }
  }
  return {
    fase: !listos ? "espera" : ganador !== null ? "fin" : "jugando",
    turno, turnos, puntos, fuera,
    vivos: vivos.map(j => j.uid),
    ganador, motivo
  };
}

/* ---------- escondite ---------- */
function redEscondite(p, js) {
  const jug = jugadasDe(p);
  const comp = {}, sitios = {}, intentos = {};
  let ganador = null, motivo = "";
  for (const j of jug) {
    if (ganador || !js.some(x => x.uid === j.uid)) continue;
    if (j.t === "c" && !comp[j.uid]) comp[j.uid] = j.h;
    else if (j.t === "r" && comp[j.uid] && !sitios[j.uid] && sitioValido(j)) sitios[j.uid] = { x: j.x, y: j.y, traje: Number.isInteger(j.traje) && j.traje >= 0 && j.traje < 6 ? j.traje : 0, sal: j.sal, at: j.at || 0 };
    else if (j.t === "b" && js.every(x => sitios[x.uid])) {
      /* El acierto se recalcula aquí, no se cree lo que diga la jugada.
         En el momento de buscar el escondite del otro ya está revelado
         en el registro, así que los dos clientes pueden juzgar el clic
         igual — y uno que escribiera «ok: true» sobre un pinchazo en el
         cielo no engañaría a la pantalla del otro. */
      const dest = js.find(x => x.uid !== j.uid);
      const blanco = dest ? sitios[dest.uid] : null;
      const ok = !!blanco && acierta({ x: j.x, y: j.y }, blanco);
      (intentos[j.uid] = intentos[j.uid] || []).push({ x: j.x, y: j.y, ok, at: j.at || 0 });
      if (ok && !ganador) { ganador = j.uid; motivo = "encontrado"; }
    } else if (j.t === "abandona" && !ganador) {
      const otro = js.find(x => x.uid !== j.uid);
      if (otro) { ganador = otro.uid; motivo = "abandono"; }
    }
  }
  const todosComp = js.length >= 2 && js.every(j => comp[j.uid]);
  const todosRev = js.length >= 2 && js.every(j => sitios[j.uid]);
  let fase = "espera";
  if (js.length >= 2) fase = ganador ? "fin" : todosRev ? "buscar" : todosComp ? "revelar" : "esconder";
  const arranque = todosRev ? Math.max(...js.map(j => sitios[j.uid].at || 0)) : 0;
  return { fase, compromisos: comp, sitios, intentos, arranque, ganador, motivo };
}

/* ---------- cartas ---------- */
function redCartas(p, js) {
  const jug = jugadasDe(p);
  const ganadas = {}, usadas = {};
  for (const j of js) { ganadas[j.uid] = []; usadas[j.uid] = []; }
  const rondas = [];
  const semillas = {};
  let ronda = 0, comp = {}, rev = {};
  let ganador = null, motivo = "";

  const cierra = () => {
    const [a, b] = js;
    const ca = rev[a.uid], cb = rev[b.uid];
    const q = resuelveRonda(ca, cb);
    if (q === 1) ganadas[a.uid].push(ca);
    else if (q === 2) ganadas[b.uid].push(cb);
    rondas.push({ n: ronda, cartas: { [a.uid]: ca, [b.uid]: cb }, gana: q === 1 ? a.uid : q === 2 ? b.uid : "" });
    ronda++; comp = {}; rev = {};
    for (const j of js) {
      const t = victoriaCartas(ganadas[j.uid]);
      if (t && !ganador) { ganador = j.uid; motivo = "trio"; }
    }
  };

  for (const j of jug) {
    if (j.t === "s") {
      /* La semilla del mazo, revelada al acabar. Se lee **también con
         la partida ganada**, que es justo cuando llega: es lo que deja
         a la otra pantalla rehacer el mazo y auditar lo jugado. */
      if (!semillas[j.uid]) semillas[j.uid] = { sem: j.sem, sal: j.sal || "" };
      continue;
    }
    if (j.t === "abandona") {
      if (!ganador) { const o = js.find(x => x.uid !== j.uid); if (o) { ganador = o.uid; motivo = "abandono"; } }
      continue;
    }
    if (ganador) continue;
    if (j.t === "c" && !comp[j.uid]) comp[j.uid] = j.h;
    else if (j.t === "r" && !rev[j.uid] && comp[j.uid]) {
      /* La carta viene escrita en la jugada, porque el mazo del que
         sale es privado y la otra máquina no puede deducirla. Aquí solo
         se comprueba que sea una carta posible y que el índice no esté
         gastado; que sea la prometida lo comprueba `auditaCartas`, que
         necesita hash y por tanto no cabe en un reductor síncrono. */
      const carta = cartaLegal(j);
      if (!carta) continue;
      if (usadas[j.uid].indexOf(carta.i) >= 0) continue;
      rev[j.uid] = { i: carta.i, sal: j.sal || "", e: carta.e, c: carta.c, v: carta.v };
      usadas[j.uid].push(carta.i);
      if (js.length >= 2 && js.every(x => rev[x.uid])) cierra();
    }
  }
  const trio = ganador ? victoriaCartas(ganadas[ganador]) : null;
  return {
    fase: js.length < 2 ? "espera" : ganador ? "fin" : "jugando",
    ronda, comp, rev, ganadas, usadas, rondas, semillas, ganador, motivo, trio
  };
}

/* ---------- cuadritos ----------
   El único de los cuatro que admite más de dos. Con N jugadores hay
   dos cosas que dejan de ser lo que eran con dos:

   - **Abandonar no da la partida a nadie** mientras queden dos o más
     jugando. Quien se va deja de recibir turnos (`fuera`) y sus cajas
     se quedan donde están, porque el tablero las tiene pintadas y
     borrarlas cambiaría la partida de los demás a mitad. Solo cuando
     queda uno vivo gana él por abandono de los otros.
   - **El ganador es el máximo, y el empate es un empate a varios.**
     Con dos bastaba comparar; con seis hay que buscar el máximo y
     además comprobar que sea único, o el «ganador» sería el primero
     de la lista por casualidad. */
function redCuadritos(p, js, listos) {
  const lado = ladoDe(p);
  const jug = jugadasDe(p);
  const rayas = {};                     // clave → uid de quien la puso
  const cajas = {};                     // "f_c" → uid
  const puntos = {};
  const fuera = {};                     // uid → true si abandonó
  for (const j of js) puntos[j.uid] = 0;
  let turno = js.length ? js[0].uid : "";
  let ganador = null, motivo = "";
  const ultima = { clave: "", cajas: [] };

  const vivos = () => js.filter(x => !fuera[x.uid]);
  /* El siguiente que sigue en la partida. Se recorre la lista entera
     por si los de en medio se han ido; si no queda nadie más, el turno
     se queda quieto y el fin lo decide el bucle de fuera. */
  const siguiente = uid => {
    const i = js.findIndex(x => x.uid === uid);
    for (let k = 1; k <= js.length; k++) {
      const c = js[(i + k) % js.length];
      if (!fuera[c.uid]) return c.uid;
    }
    return uid;
  };

  for (const j of jug) {
    if (j.t === "abandona") {
      if (ganador !== null || fuera[j.uid]) continue;
      fuera[j.uid] = true;
      const quedan = vivos();
      if (quedan.length <= 1) {
        if (quedan.length === 1) { ganador = quedan[0].uid; motivo = "abandono"; }
        else { ganador = ""; motivo = "abandono"; }
      } else if (turno === j.uid) turno = siguiente(j.uid);
      continue;
    }
    if (j.t !== "l" || ganador !== null) continue;
    if (j.uid !== turno) continue;                       // fuera de turno: se ignora, no se cree
    const k = claveRaya(j.o, j.f, j.c);
    if (rayas[k] || !rayaValida(j.o, j.f, j.c, lado)) continue;
    rayas[k] = j.uid;
    const nuevas = cajasQueCierra(rayas, j.o, j.f, j.c, lado);
    for (const [f, c] of nuevas) { cajas[`${f}_${c}`] = j.uid; puntos[j.uid]++; }
    ultima.clave = k; ultima.cajas = nuevas;
    /* Cerrar caja da otro turno — es la regla que crea las cadenas y
       toda la estrategia del juego. */
    if (!nuevas.length) turno = siguiente(turno);
  }

  const llenas = Object.keys(cajas).length;
  const totales = (lado - 1) * (lado - 1);
  if (ganador === null && listos && llenas >= totales) {
    const candidatos = vivos().length ? vivos() : js;
    const tope = Math.max(...candidatos.map(x => puntos[x.uid] || 0));
    const mejores = candidatos.filter(x => (puntos[x.uid] || 0) === tope);
    if (mejores.length === 1) { ganador = mejores[0].uid; motivo = "puntos"; }
    else { ganador = ""; motivo = "empate"; }
  }
  return {
    fase: !listos ? "espera" : (ganador !== null ? "fin" : "jugando"),
    lado, rayas, cajas, puntos, fuera, turno, ultima, ganador, motivo,
    restantes: totalRayas(lado) - Object.keys(rayas).length
  };
}

/* ---------- reversi ---------- */
function redReversi(p, js) {
  const lado = REV_LADO;
  const jug = jugadasDe(p);
  const negras = js[0] ? js[0].uid : "";
  const blancas = js[1] ? js[1].uid : "";
  const listos = !!(negras && blancas);
  const otroDe = u => (u === negras ? blancas : negras);

  let tab = listos ? revInicial(negras, blancas, lado) : {};
  let turno = negras;                   // negras abren, como en el juego
  let pasa = "";                        // quién se ha quedado sin jugada
  let ganador = null, motivo = "";
  const ultima = { casilla: "", voltea: [] };

  /* A quién le toca después de mover. Si el otro no tiene casilla, el
     turno se queda donde estaba y se anota que ha pasado; si tampoco
     la tiene el que acaba de mover, la partida ha terminado y el turno
     se queda vacío, que es lo que lee el cierre de abajo. */
  const tras = (t, actual) => {
    const o = otroDe(actual);
    if (Object.keys(revJugadas(t, o, lado)).length) return { turno: o, pasa: "" };
    if (Object.keys(revJugadas(t, actual, lado)).length) return { turno: actual, pasa: o };
    return { turno: "", pasa: "" };
  };

  for (const j of jug) {
    if (j.t === "abandona") {
      if (ganador === null) {
        const o = otroDe(j.uid);
        if (o) { ganador = o; motivo = "abandono"; }
      }
      continue;
    }
    if (j.t !== "p" || ganador !== null || !listos || !turno) continue;
    if (j.uid !== turno) continue;                       // fuera de turno: no existe
    const caps = revCapturas(tab, j.f, j.c, j.uid, lado);
    if (!caps.length) continue;                          // ahí no se podía
    tab = Object.assign({}, tab, { [claveCasilla(j.f, j.c)]: j.uid });
    for (const [ff, cc] of caps) tab[claveCasilla(ff, cc)] = j.uid;
    ultima.casilla = claveCasilla(j.f, j.c);
    ultima.voltea = caps;
    const nx = tras(tab, j.uid);
    turno = nx.turno; pasa = nx.pasa;
  }

  const cuenta = revCuenta(tab);
  if (ganador === null && listos && !turno) {
    const a = cuenta[negras] || 0, b = cuenta[blancas] || 0;
    if (a > b) { ganador = negras; motivo = "fichas"; }
    else if (b > a) { ganador = blancas; motivo = "fichas"; }
    else { ganador = ""; motivo = "empate"; }
  }

  return {
    fase: !listos ? "espera" : (ganador !== null ? "fin" : "jugando"),
    lado, tab, turno, pasa, negras, blancas, cuenta,
    legales: turno ? revJugadas(tab, turno, lado) : {},
    ultima, ganador, motivo,
    libres: lado * lado - Object.keys(tab).length
  };
}

/* ---------- reacción en cadena ----------
   Cada celda aguanta tantos orbes como vecinas tiene menos uno: dos en
   una esquina, tres en un borde, cuatro en el centro. La que llega a su
   masa crítica estalla, manda un orbe a cada vecina y las hace suyas, y
   esas pueden estallar a su vez. Se pone en una celda vacía o propia.

   Tres cosas que sostienen el reductor:

   - **Las ondas son simultáneas.** En cada onda primero se vacían todas
     las celdas inestables y luego se reparten los orbes; hacerlo celda
     a celda daría un tablero distinto según el orden en que se
     recorran, y las dos pantallas tienen que llegar al mismo.
   - **Solo pueden ser inestables las celdas de quien mueve.** Antes de
     su jugada el tablero está quieto, y lo que estalla solo pinta del
     color de quien mueve. Así una onda nunca tiene dos dueños.
   - **La cadena se corta cuando no queda un orbe rival.** Con el
     tablero entero de un color, la reacción ya no tiene fin — cada
     onda alimenta a la siguiente —, y además ya no hace falta: ha
     ganado. `CR_TOPE` es solo una red por si acaso. En la primera
     vuelta no puede estallar nada (cada uno pone un único orbe en una
     celda vacía y la masa crítica mínima es dos), así que cuando algo
     estalla todos han jugado ya y «sin orbes rivales» es exactamente
     «sin rivales»: el corte nunca deja un tablero inestable a mitad de
     partida.

   Nadie queda fuera antes de haber jugado: al empezar todos tienen
   cero orbes, y eso no es haber perdido. Los orbes de quien abandona
   se quedan en el tablero —se pueden capturar— pero ya no cuentan como
   rivales. */
export const CR_MALLAS = {
  chica: { nombre: "Chica", filas: 7, cols: 5 },
  clasica: { nombre: "Clásica", filas: 9, cols: 6 },
  grande: { nombre: "Grande", filas: 12, cols: 8 }
};
export const CR_TOPE = 1000;

export function mallaDe(p) {
  const k = p && p.malla;
  return CR_MALLAS[k] ? k : "clasica";
}

export function crCritica(i, filas, cols) {
  const f = Math.floor(i / cols), c = i % cols;
  return (f > 0) + (f < filas - 1) + (c > 0) + (c < cols - 1);
}

export function crVecinas(i, filas, cols) {
  const f = Math.floor(i / cols), c = i % cols, v = [];
  if (f > 0) v.push(i - cols);
  if (f < filas - 1) v.push(i + cols);
  if (c > 0) v.push(i - 1);
  if (c < cols - 1) v.push(i + 1);
  return v;
}

/* Una onda: estallan a la vez las celdas de `estallan` y cada vecina
   recibe un orbe y pasa a ser de `uid`. Devuelve un tablero nuevo; la
   pantalla la usa también para animar la jugada paso a paso. */
export function crOnda(tab, estallan, uid, filas, cols) {
  const t = tab.slice();
  for (const i of estallan) {
    const n = t[i].n - crCritica(i, filas, cols);
    t[i] = n > 0 ? { u: t[i].u, n } : null;
  }
  for (const i of estallan) {
    for (const v of crVecinas(i, filas, cols)) t[v] = { u: uid, n: (t[v] ? t[v].n : 0) + 1 };
  }
  return t;
}

export const crInestables = (tab, filas, cols) => {
  const r = [];
  for (let i = 0; i < tab.length; i++) if (tab[i] && tab[i].n >= crCritica(i, filas, cols)) r.push(i);
  return r;
};

/* Pone un orbe de `uid` en `i` y deja correr la cadena. `rivales` es el
   conjunto de dueños cuyos orbes impiden dar la partida por acabada. */
export function crPon(tab, i, uid, filas, cols, rivales) {
  let t = tab.slice();
  t[i] = { u: uid, n: (t[i] ? t[i].n : 0) + 1 };
  const ondas = [];
  const hayRival = x => x.some(o => o && rivales.has(o.u));
  while (ondas.length < CR_TOPE) {
    const inest = crInestables(t, filas, cols);
    if (!inest.length || !hayRival(t)) break;
    ondas.push(inest);
    t = crOnda(t, inest, uid, filas, cols);
  }
  return { tab: t, ondas };
}

export function crCuenta(tab) {
  const orbes = {}, celdas = {};
  for (const o of tab) {
    if (!o) continue;
    orbes[o.u] = (orbes[o.u] || 0) + o.n;
    celdas[o.u] = (celdas[o.u] || 0) + 1;
  }
  return { orbes, celdas };
}

function redCadena(p, js, listos) {
  const malla = mallaDe(p);
  const { filas, cols } = CR_MALLAS[malla];
  let tab = new Array(filas * cols).fill(null);
  const fuera = {}, jugo = {}, caidos = {};
  let turno = js.length ? js[0].uid : "";
  let ganador = null, motivo = "", movs = 0, ultima = null;

  const vivo = uid => !fuera[uid] && !caidos[uid];
  const vivos = () => js.filter(x => vivo(x.uid));
  const siguiente = uid => {
    const k0 = js.findIndex(x => x.uid === uid);
    for (let k = 1; k <= js.length; k++) {
      const c = js[(k0 + k) % js.length];
      if (vivo(c.uid)) return c.uid;
    }
    return uid;
  };

  for (const j of jugadasDe(p)) {
    if (j.t === "abandona") {
      if (ganador !== null || fuera[j.uid] || !js.some(x => x.uid === j.uid)) continue;
      const tenia = turno === j.uid;
      fuera[j.uid] = true;
      const quedan = vivos();
      if (quedan.length <= 1) { ganador = quedan.length ? quedan[0].uid : ""; motivo = "abandono"; }
      else if (tenia) turno = siguiente(j.uid);
      continue;
    }
    if (j.t !== "p" || ganador !== null || !listos || j.uid !== turno) continue;
    const f = j.f, c = j.c;
    if (!Number.isInteger(f) || !Number.isInteger(c) || f < 0 || c < 0 || f >= filas || c >= cols) continue;
    const i = f * cols + c;
    if (tab[i] && tab[i].u !== j.uid) continue;          // celda ajena: no se puede
    const rivales = new Set(js.filter(x => x.uid !== j.uid && !fuera[x.uid]).map(x => x.uid));
    const antes = tab;
    const r = crPon(tab, i, j.uid, filas, cols, rivales);
    tab = r.tab;
    jugo[j.uid] = true;
    movs++;
    const { orbes } = crCuenta(tab);
    const caen = [];
    for (const x of js) {
      if (!vivo(x.uid) || !jugo[x.uid] || orbes[x.uid]) continue;
      caidos[x.uid] = true; caen.push(x.uid);
    }
    let capturadas = 0;
    for (let k = 0; k < tab.length; k++) if (tab[k] && tab[k].u === j.uid && antes[k] && antes[k].u !== j.uid) capturadas++;
    ultima = { uid: j.uid, i, f, c, antes, ondas: r.ondas, capturadas, caen, n: movs };
    const quedan = vivos();
    if (quedan.length <= 1) { ganador = quedan.length ? quedan[0].uid : j.uid; motivo = "reaccion"; }
    else turno = siguiente(j.uid);
  }

  const { orbes, celdas } = crCuenta(tab);
  /* Lo que se cuenta al final: los orbes de cada uno, y 0 a quien está
     fuera. El que abandona deja sus orbes en el tablero, y enseñarlos
     como suyos ponía en el cartel a un eliminado con su marca de antes. */
  const puntos = {};
  for (const x of js) puntos[x.uid] = fuera[x.uid] || caidos[x.uid] ? 0 : orbes[x.uid] || 0;
  return {
    fase: !listos ? "espera" : (ganador !== null ? "fin" : "jugando"),
    malla, filas, cols, tab, turno: ganador !== null ? "" : turno,
    fuera, caidos, jugo, cuenta: orbes, puntos, celdas, ultima, ganador, motivo, movs
  };
}

/* ============================================================
   7. Clasificación

   Tres puntos por victoria, uno por empate. Se suman en el cliente y
   cada uno escribe solo su propia fila — las reglas de la base no
   dejan otra cosa. Que las reglas comprueben además que `ultima`
   nombra una partida terminada en la que juega quien escribe, y que
   no es la misma que ya se contó, es lo que impide inventarse
   victorias sin necesidad de un servidor.
   ============================================================ */

/* Lo que el reductor no puede comprobar por sí mismo. Comprobarlo pide
   SHA-256, que es asíncrono, y el reductor es síncrono a propósito
   (corre en cada pintada). Así que se audita aparte, y las dos
   pantallas lo hacen: quien haga trampa no gana en silencio, sale su
   nombre en rojo en los dos navegadores.

   Con el mazo privado son **dos** candados, no uno:

   1. `ronda` — que la carta revelada sea la prometida al empezar la
      ronda. El compromiso se hace sobre `[i, e, c, v]`, la carta
      entera y no solo su índice: ahora la carta viaja escrita en la
      jugada, así que prometer un índice no dice nada de lo que se
      acabará enseñando.
   2. `mazo` — que esas cartas estuvieran de verdad en su mazo. Al
      entrar cada uno promete `hmazo` en su ficha (que las reglas
      dejan escribir una sola vez) y al acabar revela la semilla; con
      ella se rehace el mazo y se comprueba carta por carta. Es lo que
      impide inventarse un doce de fuego sin haberlo tenido nunca.

   La frontera honesta: quien cierre la pestaña antes del final no
   revela su semilla, y ese segundo candado se queda sin cerrar — el
   primero sigue en pie. Devuelve la lista de faltas; `ronda` es -1
   cuando la falta es del mazo entero y no de una ronda concreta. */
export async function auditaCartas(partida, estado) {
  const malas = [];
  const jug = jugadasDe(partida);
  const compHash = {};
  const semillas = {};
  const jugadas = {};               // uid -> cartas que ha enseñado
  let ronda = 0;
  const vistos = {};
  for (const j of jug) {
    if (j.t === "s") { if (!semillas[j.uid]) semillas[j.uid] = { sem: j.sem, sal: j.sal || "" }; continue; }
    if (j.t === "c" && compHash[j.uid + ":" + ronda] === undefined) compHash[j.uid + ":" + ronda] = j.h;
    else if (j.t === "r" && !vistos[j.uid + ":" + ronda]) {
      vistos[j.uid + ":" + ronda] = true;
      const carta = cartaLegal(j);
      const h = compHash[j.uid + ":" + ronda];
      if (!carta) malas.push({ uid: j.uid, ronda, que: "ronda" });
      else {
        if (h && !(await compromisoValido([carta.i, carta.e, carta.c, carta.v], j.sal || "", h)))
          malas.push({ uid: j.uid, ronda, que: "ronda" });
        (jugadas[j.uid] = jugadas[j.uid] || []).push(carta);
      }
      if (Object.keys(vistos).filter(k => k.endsWith(":" + ronda)).length >= (estado.jugadores || []).length) ronda++;
    }
  }

  /* Segunda pasada: el mazo. Solo de quien haya revelado su semilla,
     y solo si su ficha prometía una — una partida de antes de que
     esto existiera no tiene `hmazo` y no hay nada que comprobar. */
  for (const j of (estado.jugadores || [])) {
    const s = semillas[j.uid];
    if (!s || !j.hmazo) continue;
    let mal = !(await compromisoValido(s.sem, s.sal, j.hmazo));
    if (!mal) {
      const m = mazoDe(s.sem >>> 0, 0);
      for (const c of (jugadas[j.uid] || [])) {
        const real = m[c.i];
        if (!real || real.e !== c.e || real.c !== c.c || real.v !== c.v) { mal = true; break; }
      }
    }
    if (mal) malas.push({ uid: j.uid, ronda: -1, que: "mazo" });
  }
  return malas;
}

export const PUNTOS = { ganada: 3, empate: 1, perdida: 0 };

export function acumula(fila, resultado, partidaId, quien) {
  const f = Object.assign({
    nombre: "", foto: "", jugadas: 0, ganadas: 0, perdidas: 0, empates: 0,
    puntos: 0, racha: 0, mejorRacha: 0, ultima: "", at: 0
  }, fila || {});
  if (partidaId && f.ultima === partidaId) return null;      // ya contada
  f.jugadas++;
  if (resultado === "ganada") { f.ganadas++; f.racha++; }
  else if (resultado === "empate") { f.empates++; f.racha = 0; }
  else { f.perdidas++; f.racha = 0; }
  f.mejorRacha = Math.max(f.mejorRacha || 0, f.racha);
  f.puntos = (f.puntos || 0) + (PUNTOS[resultado] || 0);
  f.ultima = partidaId || "";
  f.at = Date.now();
  if (quien) { f.nombre = quien.nombre || f.nombre; f.foto = quien.foto || f.foto; }
  return f;
}

/* Orden de la tabla: puntos, luego victorias, luego menos partidas —
   quien gana lo mismo jugando menos, gana mejor. */
export function ordenaRanks(filas) {
  return (filas || []).slice().sort((a, b) =>
    (b.puntos || 0) - (a.puntos || 0) ||
    (b.ganadas || 0) - (a.ganadas || 0) ||
    (a.jugadas || 0) - (b.jugadas || 0) ||
    String(a.nombre || "").localeCompare(String(b.nombre || "")));
}

export function porcentaje(f) {
  const j = f.jugadas || 0;
  return j ? Math.round((f.ganadas || 0) * 100 / j) : 0;
}


/* Órbita: cada captura dirige al rival hacia su fila o columna.
   Si ese eje queda vacío, la órbita se abre a todo el tablero.
   La semilla y el registro producen el mismo resultado en ambos clientes. */
export function redOrbita(p, js = jugadoresDe(p)) {
  const r = rng(p.semilla || 1);
  const estrellas = Array.from({ length: 36 }, () => 1 + Math.floor(r() * 5));
  const tomadas = {}, puntos = Object.fromEntries(js.map(j => [j.uid, 0]));
  const listos = js.length === 2;
  let turno = js[0]?.uid || "", ultima = -1, eje = "fila", ganador = null, motivo = "";
  const disponibles = () => {
    const libres = estrellas.map((_, i) => i).filter(i => !tomadas[i]);
    const dirigidas = ultima < 0 ? libres : libres.filter(i => eje === "fila"
      ? Math.floor(i / 6) === Math.floor(ultima / 6) : i % 6 === ultima % 6);
    return dirigidas.length ? dirigidas : libres;
  };
  for (const j of jugadasDe(p)) {
    if (!listos || ganador !== null || !js.some(x => x.uid === j.uid)) continue;
    if (j.t === "abandona") {
      ganador = js.find(x => x.uid !== j.uid).uid; motivo = "abandono"; continue;
    }
    if (j.t !== "orbita" || j.uid !== turno || !Number.isInteger(j.casilla)
      || !["fila", "columna"].includes(j.eje) || !disponibles().includes(j.casilla)) continue;
    tomadas[j.casilla] = j.uid;
    puntos[j.uid] += estrellas[j.casilla];
    ultima = j.casilla; eje = j.eje;
    turno = js.find(x => x.uid !== j.uid).uid;
    if (Object.keys(tomadas).length === 36) {
      const [a, b] = js.map(x => x.uid);
      ganador = puntos[a] === puntos[b] ? "" : puntos[a] > puntos[b] ? a : b;
      motivo = ganador ? "estrellas" : "empate";
    }
  }
  const legales = listos && ganador === null ? disponibles() : [];
  return { fase: !listos ? "espera" : ganador !== null ? "fin" : "jugando",
    estrellas, tomadas, puntos, turno, ultima, eje, legales, ganador, motivo,
    libre: ultima < 0 || (legales.length > 0 && legales.some(i => eje === "fila"
      ? Math.floor(i / 6) !== Math.floor(ultima / 6) : i % 6 !== ultima % 6)) };
}

/* ============================================================
   8. Flip 7 — Normal, Vengeance y Super Vengeance

   Un juego de pedir carta o plantarse. Cada uno va poniendo números
   delante; si repite uno se pasa y se queda la ronda sin nada, y quien
   junta siete números distintos cierra la ronda de golpe con un bono
   de quince. Gana quien acaba una ronda con 200 o más, y más que nadie.

   **El mazo es compartido y aquí no hay un servidor que baraje.** En
   cartas cada uno roba de su propio mazo; aquí todos roban del mismo
   montón, así que nadie puede tener la baraja: el que la tuviera sabría
   qué sale antes de decidir si pide. Cada carta sale entonces de **dos
   aportes**, el de quien la recibe y el del siguiente asiento
   (`ayudante`), y cada aporte es un número que ya estaba decidido
   antes de empezar: los primeros 32 bits de SHA-256 de
   `semilla:sal:n`, con la semilla y la sal privadas que la ficha
   promete en `hmazo` y `n` el número de carta de la partida. Así:

   - **Nadie puede calcular la siguiente carta** antes de que el otro
     publique su aporte, porque no conoce su semilla. Quien pide carta
     manda el suyo dentro de la propia jugada (`pide`), y el ayudante
     lo manda solo, desde su navegador, en cuanto ve el robo pendiente.
   - **Nadie puede escoger la carta** publicando otro número: al acabar
     cada uno revela semilla y sal (`{t:"s"}`) y `auditaFlip7` rehace
     todos sus aportes. Quien mintió sale en rojo en todas las pantallas.
   - La frontera honesta: quien publica segundo *ve* la carta un
     instante antes que los demás (no puede cambiarla), y quien cierre
     la pestaña antes de revelar deja sus aportes sin comprobar — la
     pantalla lo dice en vez de darlos por buenos.
   - **Los suplentes** (`aportesDe`): si falta uno de los dos
     designados — una pestaña dormida, un móvil bloqueado — la mesa
     entera se quedaba esperando para siempre. Si los dos están, salen
     ellos; si no, la carta sale de los primeros K presentes en orden de
     preferencia (el receptor y luego los demás por distancia en la
     mesa), con K = max(2, min(3, sentados − 1)) y los valores
     combinados `[a0, a1 ^ a2]`. Con dos en la mesa no hay suplente. La
     pantalla de un suplente espera 6 s más 2 s por puesto antes de
     mandar el suyo, pero eso no lo puede exigir el reductor (las
     jugadas no llevan hora), así que el precio queda dicho: un ayudante
     con un cliente trucado puede callarse para que la carta la echen
     los suplentes — la vuelve a sortear, no la escoge — y con tres en
     la mesa un suplente con prisa puede adelantarse. Todo aporte sigue
     pasando por la auditoría.

   El montón es una lista de índices que empieza en el orden canónico;
   cada robo quita la posición `indiceF7(aportes) % largo`, y cuando se
   vacía se rellena con el descarte. Las cartas que están en la mesa al
   acabar una ronda van al descarte, como en la caja.

   **Las reglas se encadenan, y por eso el reductor lleva una pila de
   tareas**: una carta de acción repartida manda elegir objetivo, un
   «voltea tres» hace robar tres veces a otro, y las acciones que salen
   *durante* esas tres se apartan y se resuelven al final si quien las
   sacó sigue en pie. Cada tarea espera una de tres cosas — aportes para
   robar, una decisión (pedir o plantarse) o una elección (a quién, qué
   carta) — y `avanza()` las va sacando hasta dar con una que espera.
   ============================================================ */

export const F7_META = 200;
export const F7_BONO = 15;
export const F7_SIETE = 7;

/* Los tres modos, de menos a más malicia. `venganza` es la clave que ya
   está escrita en las salas y en las reglas de la base; lo que se lee en
   pantalla es la etiqueta. Super Vengeance es Vengeance con más cartas y
   dos reglas más (`golpeF7` y el bono del Flip 7 a elegir). */
export const MODOS_F7 = { normal: "Normal", venganza: "Vengeance", super: "Super Vengeance" };
export const modoF7 = p => (p && (p.modo === "venganza" || p.modo === "super")) ? p.modo : "normal";

/* Los dos mazos, carta a carta. El índice en la lista es la identidad
   de la carta, y es lo único que viaja: el reductor, la pantalla y la
   auditoría leen de aquí qué es. Normal: 94 cartas (un 0, n copias de
   cada n del 1 al 12, +2…+10 y ×2, y tres de cada acción). Con
   venganza: 108 (el Cero, n copias del 1 al 13 con un 7 gafe y un 13
   de la suerte entre ellas, −2…−10 y ÷2, y dos de cada acción). Super
   Vengeance: las 108 de Vengeance en el mismo orden y, detrás, 24 más —
   catorce 14 (uno vale −14 y otro 0, y dos cualesquiera de ellos pasan),
   tres segundas oportunidades, dos cambios de mano, dos fulminar y tres
   comodines —, 132 en total. */
function construyeMazoF7(modo) {
  const m = [];
  const pon = c => m.push(Object.freeze(Object.assign({ i: m.length }, c)));
  const venganza = modo !== "normal";
  const tope = venganza ? 13 : 12;
  pon(venganza ? { k: "n", v: 0, cero: true } : { k: "n", v: 0 });
  for (let v = 1; v <= tope; v++) for (let c = 0; c < v; c++) {
    const x = { k: "n", v };
    if (venganza && v === 7 && c === 0) x.gafe = true;
    if (venganza && v === 13 && c === 0) x.suerte = true;
    pon(x);
  }
  for (const v of [2, 4, 6, 8, 10]) pon({ k: "m", v: venganza ? -v : v });
  pon(venganza ? { k: "m", v: 0, mitad: true } : { k: "m", v: 0, doble: true });
  const acciones = venganza ? ["cuatro", "otra", "cambia", "roba", "tira"] : ["congela", "tres", "segunda"];
  for (const a of acciones) for (let c = 0; c < (venganza ? 2 : 3); c++) pon({ k: "a", a });
  if (modo === "super") {
    for (let c = 0; c < 14; c++) pon({ k: "n", v: c === 0 ? -14 : c === 1 ? 0 : 14, catorce: true });
    for (const [a, k] of [["segunda", 3], ["trueca", 2], ["mata", 2], ["comodin", 3]]) for (let c = 0; c < k; c++) pon({ k: "a", a });
  }
  return Object.freeze(m);
}
const mazosF7 = {};
export const mazoF7 = modo => mazosF7[modo] || (mazosF7[modo] = construyeMazoF7(modo));

/* El comodín no trae número: vale el que eligió quien lo jugó, y ese
   valor vive fuera de la carta (`com`, id → valor), porque la misma
   carta puede volver a salir y valer otra cosa. Como se busca por el id,
   viaja con la carta si alguien la roba o la cambia. */
export const valorCartaF7 = (c, com) => c.a === "comodin" ? Number((com || {})[c.i]) || 0 : c.v;
/* Con qué cuenta para repetir: su valor, salvo los catorce, que chocan
   entre sí valgan lo que valgan (−14, 0 o 14). Un comodín que vale 14
   cuenta como un catorce más. */
const claveF7 = (c, com) => c.catorce ? 14 : valorCartaF7(c, com);
/* Va en la fila de números y no con los modificadores: los números y el
   comodín, que una vez jugado es un número más. */
export const esNumeroF7 = c => c.k === "n" || c.a === "comodin";

/* ¿Esta fila de números se puede tener sin haberse pasado? Una sola
   copia de cada valor; con venganza, el 13 admite un segundo si uno de
   los dos es el de la suerte. */
export function lineaValidaF7(nums, modo, com) {
  const M = mazoF7(modo), cuenta = {};
  let suerte = false;
  for (const id of nums) {
    const c = M[id], k = claveF7(c, com);
    cuenta[k] = (cuenta[k] || 0) + 1;
    if (c.suerte) suerte = true;
  }
  for (const v in cuenta) {
    const tope = modo !== "normal" && Number(v) === 13 && suerte ? 2 : 1;
    if (cuenta[v] > tope) return false;
  }
  return true;
}

/* Lo que vale una fila si la ronda acabara ahora. Normal: números,
   ×2 (solo a los números), más los modificadores, más 15 por Flip 7.
   Con venganza: números, ÷2 redondeando hacia abajo, menos los
   negativos, nunca por debajo de cero, y 15 por Flip 7; quien tiene
   el Cero se queda en nada salvo que haga Flip 7. Super Vengeance igual,
   con tres diferencias: nada satura en cero (con el −14 y los «menos
   algo» la ronda puede quedar en negativo, y eso se le resta al total);
   si los números suman justo 0, los modificadores no se aplican aquí
   sino al total (`golpeF7`); y quien gastó su Flip 7 en quitarle 15 a
   otro (`l.bono`, el uid de ese otro) no se los suma. */
export function valorLineaF7(l, modo, com) {
  if (!l || l.estado === "pasa" || l.estado === "fuera") return 0;
  const M = mazoF7(modo);
  let s = numerosF7(l, modo, com);
  const mods = l.mods.map(id => M[id]);
  if (modo === "normal") {
    if (mods.some(c => c.doble)) s *= 2;
    s += mods.reduce((a, c) => a + c.v, 0);
  } else if (modo !== "super") {
    if (mods.some(c => c.mitad)) s = Math.floor(s / 2);
    s = Math.max(0, s + mods.reduce((a, c) => a + c.v, 0));
  } else if (s !== 0) {
    if (mods.some(c => c.mitad)) s = Math.floor(s / 2);
    s += mods.reduce((a, c) => a + c.v, 0);
  }
  return s + (l.f7 && !l.bono ? F7_BONO : 0);
}

/* Lo que suman los números de una fila, antes de modificadores y bono.
   Con venganza el Cero la deja en nada salvo con Flip 7. En Vengeance
   nunca baja de cero; en Super Vengeance sí (el 14 que vale −14, un
   comodín bajo), y esa ronda negativa se resta del total. */
function numerosF7(l, modo, com) {
  if (!l || l.estado === "pasa" || l.estado === "fuera") return 0;
  const M = mazoF7(modo);
  const s = l.nums.reduce((a, id) => a + valorCartaF7(M[id], com), 0);
  if (modo === "normal") return s;
  if (!l.f7 && l.nums.some(id => M[id].cero)) return 0;
  return modo === "super" ? s : Math.max(0, s);
}

/* Super Vengeance: los «menos algo» y el ÷2 pegan a la ronda, pero si en
   la ronda no sumaste nada —te pasaste, te fulminaron, tienes el Cero
   sin Flip 7, no tienes números— pegan al total acumulado. Devuelve lo
   que le toca al total (primero `mitad`, luego `resta`) o null; se
   aplica al cerrar la ronda (`aplicaGolpeF7`) y el total puede quedar
   en negativo. Una ronda que ya es negativa no pasa por aquí: los
   modificadores se le aplican a ella y todo baja al total igual. */
export function golpeF7(l, modo, com) {
  if (modo !== "super" || !l || l.estado === "fuera" || !l.mods.length) return null;
  const M = mazoF7(modo), mods = l.mods.map(id => M[id]);
  const mitad = mods.some(c => c.mitad), resta = mods.reduce((a, c) => a + c.v, 0);
  if (!mitad && !resta) return null;
  if (numerosF7(l, modo, com) !== 0) return null;
  return { mitad, resta };
}
export const aplicaGolpeF7 = (total, g) => (g.mitad ? Math.floor(total / 2) : total) + g.resta;

/* El aporte de un jugador a la carta número `n`. Lleva la sal además
   de la semilla porque la semilla son 32 bits: con solo ella, un aporte
   publicado se podría invertir por fuerza bruta y el resto de la
   partida quedaría a la vista. */
export async function aporteF7(sem, sal, n) {
  const d = new TextEncoder().encode(`${sem >>> 0}:${sal || ""}:${n}`);
  const h = await globalThis.crypto.subtle.digest("SHA-256", d);
  return new DataView(h).getUint32(0);
}

/* De dos aportes, una posición en el montón. Mezcla también `n` para
   que dos robos con los mismos aportes no caigan en el mismo sitio. */
export function indiceF7(va, vb, n, largo) {
  const s = ((va >>> 0) ^ Math.imul(((vb >>> 0) ^ Math.imul(n + 1, 0x85EBCA6B)) >>> 0, 0x9E3779B1)) >>> 0;
  return Math.floor(rng(s)() * largo);
}

function redFlip7(p, js, listos) {
  const modo = modoF7(p), M = mazoF7(modo), V = modo !== "normal", S = modo === "super";
  const fuera = {}, puntos = {}, semillas = {}, aportes = {};
  for (const j of js) puntos[j.uid] = 0;
  let lin = {}, pila = [], mazo = M.map(c => c.i), descarte = [];
  let com = {};                                  // comodines jugados esta ronda: id → valor
  let n = 0, ronda = 0, reparte = "", viva = false, cierra = false;
  let ganador = null, motivo = "", ultima = null, finRonda = null;
  const hist = [], rondas = [];

  const suceso = e => { hist.push(e); if (hist.length > 40) hist.shift(); };
  const esta = u => !fuera[u];
  const enPie = u => !!lin[u] && (lin[u].estado === "activo" || lin[u].estado === "planta");
  const activo = u => !!lin[u] && lin[u].estado === "activo";
  const tieneCero = u => V && !!lin[u] && lin[u].nums.some(id => M[id].cero);
  /* El primero después de `u` que cumple `ok`, dando la vuelta a la
     mesa; `u` mismo es el último candidato. */
  const tras = (u, ok) => {
    const k0 = js.findIndex(x => x.uid === u);
    for (let k = 1; k <= js.length; k++) {
      const c = js[(k0 + k + js.length) % js.length];
      if (ok(c.uid)) return c.uid;
    }
    return null;
  };
  const ayudante = u => tras(u, x => x !== u && esta(x));
  const aportantes = u => { const b = ayudante(u); return b ? [u, b] : [u]; };
  /* Quién puede aportar al robo de `u`, por orden de preferencia: él,
     su ayudante y, detrás, el resto de la mesa en el orden de los
     asientos. Los dos primeros son los de siempre; los demás son los
     suplentes, que sólo cuentan si falta uno de aquellos. */
  const preferencia = u => [u].concat(uids(x => x !== u && esta(x))
    .sort((x, y) => distancia(u, x) - distancia(u, y)));
  const distancia = (u, x) => {
    const a = js.findIndex(q => q.uid === u), b = js.findIndex(q => q.uid === x);
    return (b - a + js.length) % js.length;
  };
  /* Cuántos aportes hacen falta cuando no están los dos designados:
     dos con tres jugadores en la mesa, tres con cuatro o más. Con tres,
     un suplente que se adelante no puede forzar la carta que ya conoce:
     le falta el aporte de otro que no ve. */
  const cupoSuplencia = () => Math.max(2, Math.min(3, uids(esta).length - 1));
  /* Los dos aportes con los que sale la carta `nn` para `u`, o null si
     todavía no alcanzan. Primero los designados; si alguno no está (una
     pestaña dormida, un móvil bloqueado, alguien que cerró sin
     abandonar), los primeros que hayan llegado por orden de preferencia. */
  const aportesDe = (u, nn) => {
    const a = aportes[nn] || {}, quien = aportantes(u);
    if (quien.every(x => a[x] !== undefined)) return [a[quien[0]], quien[1] ? a[quien[1]] : 0];
    const k = cupoSuplencia(), hay = preferencia(u).filter(x => a[x] !== undefined).slice(0, k);
    if (hay.length < k) return null;
    return [a[hay[0]], (a[hay[1]] ^ (hay[2] ? a[hay[2]] : 0)) >>> 0];
  };
  const cartasDe = u => lin[u].nums.concat(lin[u].mods);
  const quita = (u, id) => {
    const l = lin[u];
    l.nums = l.nums.filter(x => x !== id);
    l.mods = l.mods.filter(x => x !== id);
  };
  const pon = (u, id) => { if (esNumeroF7(M[id])) lin[u].nums.push(id); else lin[u].mods.push(id); };
  const uids = ok => js.map(x => x.uid).filter(ok);

  /* Super Vengeance: quien hizo Flip 7 elige antes de cerrar la ronda
     entre sumarse los 15 o quitárselos a otro (`l.bono`: "" para sí, el
     uid del otro si castiga). Sin nadie más en la mesa no hay qué elegir. */
  const bonoPendiente = () => {
    if (!S || !cierra) return null;
    for (const j of js) {
      const l = lin[j.uid];
      if (!l || !l.f7 || l.bono != null || !esta(j.uid)) continue;
      if (!uids(x => x !== j.uid && esta(x)).length) { l.bono = ""; continue; }
      return j.uid;
    }
    return null;
  };

  /* Tras recibir un número por intercambio o robo: con un repetido se
     pasa, con siete se cierra la ronda. */
  const revisa = u => {
    const l = lin[u];
    if (!enPie(u)) return;
    if (!lineaValidaF7(l.nums, modo, com)) { l.estado = "pasa"; suceso({ e: "pasa", uid: u }); return; }
    if (l.nums.length >= F7_SIETE) { l.f7 = true; cierra = true; suceso({ e: "f7", uid: u }); }
  };

  /* A quién (o qué carta) se puede elegir con la carta `id` en la mano
     de `quien`. `a` es un jugador, `c` una carta, `2` dos cartas de
     dos jugadores distintos, `p2` dos jugadores distintos (el cambio de
     mano, que puede incluir a quien la juega) y `n` un jugador y un
     número de 0 a `max` (el comodín). */
  const opciones = (quien, id) => {
    const c = M[id];
    const conCartas = ok => {
      const o = {};
      for (const u of uids(ok)) { const cs = cartasDe(u); if (cs.length) o[u] = cs; }
      return o;
    };
    /* En Super Vengeance un «menos algo» o un ÷2 también se le puede
       poner a quien ya se pasó (o fulminaron): su ronda vale 0, así que
       le pega al total (`golpeF7`) — se le resta después de muerto. En
       Vengeance no tendría ningún efecto, y no se ofrece. */
    if (c.k === "m") return { tipo: "a", uids: uids(u => enPie(u) || (S && (c.v < 0 || c.mitad) && lin[u].estado === "pasa")) };
    switch (c.a) {
      case "congela": case "tres": return { tipo: "a", uids: uids(activo) };
      case "segunda": return { tipo: "a", uids: uids(u => u !== quien && activo(u) && lin[u].seg == null) };
      case "cuatro": case "otra": return { tipo: "a", uids: uids(enPie) };
      case "roba": return { tipo: "c", cartas: enPie(quien) ? conCartas(u => u !== quien && enPie(u)) : {} };
      case "tira": return { tipo: "c", cartas: conCartas(enPie) };
      case "cambia": return { tipo: "2", cartas: conCartas(enPie) };
      case "mata": return { tipo: "a", uids: uids(u => u !== quien && enPie(u)) };
      case "trueca": return { tipo: "p2", uids: uids(enPie) };
      /* El comodín sólo se lo juega quien lo saca: no sirve para
         hacer pasarse a otro poniéndole un número que ya tiene. */
      case "comodin": return { tipo: "n", uids: enPie(quien) ? [quien] : [], max: 14 };
    }
    return { tipo: "a", uids: [] };
  };
  const sinSalida = o => o.tipo === "a" || o.tipo === "n" ? !o.uids.length
    : o.tipo === "p2" ? o.uids.length < 2
    : o.tipo === "c" ? !Object.keys(o.cartas).length : Object.keys(o.cartas).length < 2;
  const valida = (o, j) => {
    const tiene = (u, id) => typeof u === "string" && Number.isInteger(id) && (o.cartas[u] || []).includes(id);
    if (o.tipo === "a") return o.uids.includes(j.a);
    if (o.tipo === "n") return o.uids.includes(j.a) && Number.isInteger(j.v) && j.v >= 0 && j.v <= o.max;
    if (o.tipo === "p2") return j.a !== j.b && o.uids.includes(j.a) && o.uids.includes(j.b);
    if (o.tipo === "c") return tiene(j.a, j.c);
    return j.a !== j.b && tiene(j.a, j.c) && tiene(j.b, j.d);
  };

  /* Con un único objetivo posible no se pregunta: congelar siendo el
     último en pie es congelarse, y esperar un clic para eso es ruido. */
  const pideEleccion = (quien, id) => {
    const o = opciones(quien, id);
    if (sinSalida(o)) { descarte.push(id); suceso({ e: "nada", uid: quien, id }); return; }
    if (o.tipo === "a" && o.uids.length === 1) { aplica(quien, id, { a: o.uids[0] }); return; }
    if (o.tipo === "p2" && o.uids.length === 2) { aplica(quien, id, { a: o.uids[0], b: o.uids[1] }); return; }
    pila.push({ k: "elige", quien, id });
  };

  const aplica = (quien, id, j) => {
    const c = M[id];
    if (c.k === "m") { lin[j.a].mods.push(id); suceso({ e: "da", uid: quien, a: j.a, id }); return; }
    if (c.a !== "segunda" && c.a !== "comodin") descarte.push(id);
    switch (c.a) {
      case "congela":
        lin[j.a].estado = "planta"; lin[j.a].congelado = true;
        suceso({ e: "congela", uid: quien, a: j.a }); break;
      case "tres": case "cuatro":
        pila.push({ k: "serie", para: j.a, quedan: c.a === "tres" ? 3 : 4, total: c.a === "tres" ? 3 : 4, apartadas: [] });
        suceso({ e: c.a, uid: quien, a: j.a }); break;
      case "segunda":
        lin[j.a].seg = id; suceso({ e: "regala", uid: quien, a: j.a }); break;
      case "otra":
        pila.push({ k: "quieto", para: j.a }, { k: "robar", para: j.a, de: "otra" });
        suceso({ e: "otra", uid: quien, a: j.a }); break;
      case "roba":
        quita(j.a, j.c); pon(quien, j.c);
        suceso({ e: "roba", uid: quien, a: j.a, id: j.c }); revisa(quien); break;
      case "tira":
        quita(j.a, j.c); descarte.push(j.c);
        suceso({ e: "tira", uid: quien, a: j.a, id: j.c }); break;
      case "cambia":
        quita(j.a, j.c); quita(j.b, j.d); pon(j.a, j.d); pon(j.b, j.c);
        suceso({ e: "cambia", uid: quien, a: j.a, b: j.b, c: j.c, d: j.d });
        revisa(j.a); revisa(j.b); break;
      case "mata":
        lin[j.a].estado = "pasa";
        suceso({ e: "mata", uid: quien, a: j.a }); break;
      case "trueca": {
        /* La mano entera: números, modificadores y la segunda oportunidad
           guardada. Lo que no es de la mano —plantado, congelado— se
           queda con quien estaba sentado ahí. */
        const A = lin[j.a], B = lin[j.b];
        for (const k of ["nums", "mods", "seg"]) [A[k], B[k]] = [B[k], A[k]];
        suceso({ e: "trueca", uid: quien, a: j.a, b: j.b });
        revisa(j.a); revisa(j.b); break;
      }
      case "comodin":
        com[id] = j.v;
        suceso({ e: "comodin", uid: quien, a: j.a, id, v: j.v });
        recibeNumero(j.a, id, true); break;
    }
  };

  const recibeNumero = (u, id, callado) => {
    const l = lin[u], c = M[id];
    if (c.gafe) {
      descarte.push(...l.nums, ...l.mods);
      l.nums = [id]; l.mods = [];
      suceso({ e: "gafe", uid: u, id }); return;
    }
    const prueba = l.nums.concat(id);
    if (!lineaValidaF7(prueba, modo, com)) {
      if (l.seg != null) {
        descarte.push(id, l.seg); l.seg = null;
        suceso({ e: "salva", uid: u, id }); return;
      }
      l.nums = prueba; l.estado = "pasa";
      suceso({ e: "pasa", uid: u, id }); return;
    }
    l.nums = prueba;
    if (!callado) suceso({ e: "carta", uid: u, id });
    if (l.nums.length >= F7_SIETE) { l.f7 = true; cierra = true; suceso({ e: "f7", uid: u }); }
  };

  const recibe = (u, id, serie) => {
    const c = M[id], l = lin[u];
    if (c.k === "n") { recibeNumero(u, id); return; }
    /* Durante una serie solo se quedan en el acto los números (y los
       modificadores en el modo normal) y la segunda oportunidad que se
       puede guardar; lo demás espera a que acabe la serie. */
    const guardable = c.a === "segunda" && l.seg == null;
    if (serie && !guardable && (c.k === "a" || V)) {
      serie.apartadas.push(id); suceso({ e: "aparta", uid: u, id }); return;
    }
    suceso({ e: "carta", uid: u, id });
    if (c.k === "m" && !V) { l.mods.push(id); return; }
    if (guardable) { l.seg = id; return; }
    pideEleccion(u, id);
  };

  const empiezaRonda = () => {
    ronda++;
    reparte = !reparte ? js[0].uid : (tras(reparte, esta) || reparte);
    lin = {}; com = {};
    for (const j of js) lin[j.uid] = { nums: [], mods: [], seg: null, estado: esta(j.uid) ? "activo" : "fuera", congelado: false, f7: false, bono: null };
    const orden = [];
    for (let u = tras(reparte, esta); u; u = tras(u, esta)) { orden.push(u); if (u === reparte) break; }
    pila = [{ k: "turnos", tras: reparte }, { k: "reparto", orden, i: 0 }];
    viva = true; cierra = false;
    suceso({ e: "ronda", r: ronda, uid: reparte });
  };

  const acabaRonda = () => {
    viva = false; cierra = false;
    const pts = {}, lineas = {}, aj = {};
    let f7 = "";
    for (const j of js) {
      const l = lin[j.uid];
      pts[j.uid] = esta(j.uid) ? valorLineaF7(l, modo, com) : 0;
      /* Super Vengeance: lo que la ronda no pudo absorber pega al total
         de antes, y después se suma lo de la ronda. `aj` es lo que el
         total perdió por fuera de la ronda, para el resumen. */
      const g = esta(j.uid) && golpeF7(l, modo, com);
      if (g) { const t = aplicaGolpeF7(puntos[j.uid], g); aj[j.uid] = t - puntos[j.uid]; puntos[j.uid] = t; }
      puntos[j.uid] += pts[j.uid];
      if (l.f7) f7 = j.uid;
      lineas[j.uid] = { nums: l.nums.slice(), mods: l.mods.slice(), estado: l.estado, f7: l.f7, bono: l.bono };
      descarte.push(...l.nums, ...l.mods);
      if (l.seg != null) descarte.push(l.seg);
    }
    for (const j of js) {
      const b = lin[j.uid].f7 && lin[j.uid].bono;
      if (!b || !esta(b) || puntos[b] === undefined) continue;
      const t = puntos[b] - F7_BONO;
      aj[b] = (aj[b] || 0) + t - puntos[b]; puntos[b] = t;
    }
    for (const t of pila) {
      if (t.apartadas) descarte.push(...t.apartadas);
      if (t.k === "elige" || t.k === "resuelve") descarte.push(t.id);
    }
    pila = [];
    finRonda = { r: ronda, pts, lineas, f7, aj, com: Object.assign({}, com), total: Object.assign({}, puntos) };
    rondas.push({ r: ronda, pts, f7, aj });
    suceso({ e: "cierra", r: ronda, f7 });
    const vivos = js.filter(x => esta(x.uid));
    const max = Math.max(...vivos.map(x => puntos[x.uid]));
    if (max >= F7_META) {
      const arriba = vivos.filter(x => puntos[x.uid] === max);
      if (arriba.length === 1) { ganador = arriba[0].uid; motivo = "flip7"; return; }
    }
    empiezaRonda();
  };

  /* Saca tareas hasta dar con una que espera algo de fuera. */
  const avanza = () => {
    for (let guarda = 0; guarda < 100000; guarda++) {
      if (ganador !== null || !viva) return;
      if (cierra || !pila.length) { if (bonoPendiente()) return; acabaRonda(); continue; }
      const t = pila[pila.length - 1];
      if (t.k === "reparto") {
        while (t.i < t.orden.length && !activo(t.orden[t.i])) t.i++;
        if (t.i >= t.orden.length) { pila.pop(); continue; }
        pila.push({ k: "robar", para: t.orden[t.i++], de: "reparto" });
        continue;
      }
      if (t.k === "turnos") {
        t.toca = tras(t.tras, activo);
        if (!t.toca) { pila.pop(); continue; }
        return;
      }
      if (t.k === "robar") {
        if (!enPie(t.para)) { pila.pop(); continue; }
        const par = aportesDe(t.para, n);
        if (!par) return;
        pila.pop();
        if (!mazo.length) { mazo = descarte; descarte = []; suceso({ e: "baraja" }); }
        if (!mazo.length) continue;              // todo está en la mesa: no hay carta que dar
        const id = mazo.splice(indiceF7(par[0], par[1], n, mazo.length), 1)[0];
        ultima = { n, id, para: t.para, de: t.de || (t.serie ? "serie" : "") };
        n++;
        recibe(t.para, id, t.serie || null);
        continue;
      }
      if (t.k === "serie") {
        if (!enPie(t.para)) { pila.pop(); descarte.push(...t.apartadas); continue; }
        if (t.quedan > 0) { t.quedan--; pila.push({ k: "robar", para: t.para, serie: t }); continue; }
        pila.pop();
        for (let i = t.apartadas.length - 1; i >= 0; i--) pila.push({ k: "resuelve", quien: t.para, id: t.apartadas[i] });
        continue;
      }
      if (t.k === "resuelve") {
        pila.pop();
        if (!enPie(t.quien)) { descarte.push(t.id); continue; }
        if (M[t.id].a === "segunda" && lin[t.quien].seg == null) { lin[t.quien].seg = t.id; continue; }
        pideEleccion(t.quien, t.id);
        continue;
      }
      if (t.k === "elige") {
        if (!esta(t.quien) || sinSalida(opciones(t.quien, t.id))) {
          pila.pop(); descarte.push(t.id); suceso({ e: "nada", uid: t.quien, id: t.id }); continue;
        }
        return;
      }
      if (t.k === "quieto") {
        pila.pop();
        if (activo(t.para)) { lin[t.para].estado = "planta"; suceso({ e: "planta", uid: t.para }); }
        continue;
      }
      pila.pop();
    }
  };

  const aporta = (j, nn) => {
    const a = aportes[nn] = aportes[nn] || {};
    if (a[j.uid] === undefined) a[j.uid] = j.v >>> 0;
  };

  if (listos && js.length) { empiezaRonda(); avanza(); }

  for (const j of jugadasDe(p)) {
    if (!js.some(x => x.uid === j.uid)) continue;
    if (j.t === "s") {
      if (!semillas[j.uid]) semillas[j.uid] = { sem: j.sem, sal: j.sal || "" };
      continue;
    }
    if (j.t === "abandona") {
      if (ganador !== null || fuera[j.uid]) continue;
      fuera[j.uid] = true;
      if (lin[j.uid]) lin[j.uid].estado = "fuera";
      suceso({ e: "abandona", uid: j.uid });
      const quedan = js.filter(x => esta(x.uid));
      if (quedan.length <= 1) { ganador = quedan.length ? quedan[0].uid : ""; motivo = "abandono"; continue; }
      avanza();
      continue;
    }
    if (ganador !== null || !listos || !viva) continue;
    const v = Number(j.v);
    if (j.t === "r") {
      if (Number.isInteger(j.n) && j.n >= 0 && Number.isFinite(v)) { aporta({ uid: j.uid, v }, j.n); avanza(); }
      continue;
    }
    if (j.t === "bono") {
      const u = bonoPendiente();
      if (u !== j.uid || !(j.a === u || (esta(j.a) && js.some(x => x.uid === j.a)))) continue;
      lin[u].bono = j.a === u ? "" : j.a;
      suceso({ e: "bono", uid: u, a: j.a });
      avanza();
      continue;
    }
    const t = pila[pila.length - 1];
    if (!t) continue;
    if (j.t === "pide" && t.k === "turnos" && t.toca === j.uid && j.n === n && Number.isFinite(v)) {
      aporta({ uid: j.uid, v }, n);
      t.tras = j.uid; t.toca = null;
      suceso({ e: "pide", uid: j.uid });
      pila.push({ k: "robar", para: j.uid, de: "pide" });
      avanza();
    } else if (j.t === "planta" && t.k === "turnos" && t.toca === j.uid && !(tieneCero(j.uid) && (mazo.length || descarte.length))) {
      lin[j.uid].estado = "planta";
      t.tras = j.uid; t.toca = null;
      suceso({ e: "planta", uid: j.uid });
      avanza();
    } else if (j.t === "apunta" && t.k === "elige" && t.quien === j.uid) {
      const eleccion = { a: j.a, b: j.b, c: Number(j.c), d: Number(j.d), v: Number(j.v) };
      if (!valida(opciones(t.quien, t.id), eleccion)) continue;
      pila.pop();
      aplica(t.quien, t.id, eleccion);
      avanza();
    }
  }

  const top = ganador === null && listos ? pila[pila.length - 1] : null;
  const bono = ganador === null && listos && viva ? bonoPendiente() : null;
  let espera = null, turno = "";
  if (bono) {
    espera = { k: "bono", quien: bono, uids: uids(x => x !== bono && esta(x)) };
    turno = bono;
  } else if (top && top.k === "turnos" && top.toca) {
    espera = { k: "decide", uid: top.toca, cero: tieneCero(top.toca) && !!(mazo.length || descarte.length) };
    turno = top.toca;
  } else if (top && top.k === "elige") {
    espera = { k: "elige", quien: top.quien, id: top.id, op: opciones(top.quien, top.id) };
    turno = top.quien;
  } else if (top && top.k === "robar") {
    const a = aportes[n] || {};
    const serie = top.serie ? { quedan: top.serie.quedan, total: top.serie.total } : null;
    espera = { k: "roba", n, para: top.para, de: top.de || (serie ? "serie" : ""), serie,
      faltan: aportantes(top.para).filter(u => a[u] === undefined),
      suplentes: preferencia(top.para).filter(u => !aportantes(top.para).includes(u) && a[u] === undefined) };
  }
  const valor = {}, golpe = {};
  for (const j of js) {
    valor[j.uid] = valorLineaF7(lin[j.uid], modo, com);
    const g = viva && golpeF7(lin[j.uid], modo, com);
    if (g) golpe[j.uid] = g;
  }
  return {
    fase: !listos ? "espera" : ganador !== null ? "fin" : "jugando",
    modo, meta: F7_META, puntos, lineas: lin, valor, golpe, com, ronda, reparte, turno, espera, n,
    monton: mazo.length, descarte: descarte.length, hist, ultima, rondas, finRonda,
    fuera, semillas, ganador, motivo
  };
}

/* La auditoría de Flip 7: con la semilla y la sal reveladas al final
   se rehace cada aporte que publicó cada uno y se compara. Tres faltas
   posibles: `semilla` (lo revelado no es lo que prometía su ficha),
   `carta` (un aporte no sale de su semilla: escogió una carta) y
   `oculta` (acabó la partida sin revelar, así que no se puede
   comprobar — puede ser una pestaña cerrada, y la pantalla lo dice
   con esas palabras y no como trampa). */
export async function auditaFlip7(partida, estado) {
  const malas = [], semillas = {}, aportes = {}, vistos = {};
  for (const j of jugadasDe(partida)) {
    if (j.t === "s") { if (!semillas[j.uid]) semillas[j.uid] = { sem: j.sem, sal: j.sal || "" }; continue; }
    if ((j.t === "r" || j.t === "pide") && Number.isInteger(j.n) && Number.isFinite(Number(j.v))) {
      const k = j.n + ":" + j.uid;
      if (vistos[k]) continue;
      vistos[k] = true;
      (aportes[j.uid] = aportes[j.uid] || []).push({ n: j.n, v: Number(j.v) >>> 0 });
    }
  }
  for (const x of (estado.jugadores || [])) {
    if (!aportes[x.uid]) continue;
    const s = semillas[x.uid];
    if (!s) { if (partida.fin) malas.push({ uid: x.uid, que: "oculta" }); continue; }
    if (x.hmazo && !(await compromisoValido(s.sem, s.sal, x.hmazo))) { malas.push({ uid: x.uid, que: "semilla" }); continue; }
    for (const a of aportes[x.uid]) {
      if ((await aporteF7(s.sem, s.sal, a.n)) !== a.v) { malas.push({ uid: x.uid, que: "carta", n: a.n }); break; }
    }
  }
  return malas;
}

/* ============================================================
   Cacho (modalidad de dudo)

   Cada uno tiene un vaso con cinco dados; se apuesta por turnos
   cuántos dados de una pinta hay *entre todos los vasos* —los ases son
   comodines— y el siguiente sube la apuesta, duda o calza. Al dudar o
   calzar se destapan los vasos y quien se equivocó pierde un dado
   (calzar justo lo recupera). Gana el último que conserve alguno. No
   hay dealer: cada uno agita su propio vaso.

   Lo difícil aquí no son las reglas sino los dados. Tienen que ser
   secretos —cada uno ve solo los suyos— y nadie puede elegirlos, y no
   hay un servidor que los tire. La solución es una **cadena de
   hashes** por jugador: al entrar en la sala cada navegador calcula,
   con su semilla privada (la misma de `misPartidas/<uid>/<pid>/sec`
   que usan cartas y Flip 7), e0 = H(semilla), e1 = H(e0) … eN, y
   publica en su ficha solo la punta eN (`hcad`). La llave de la ronda
   r es e(N−1−r): quien la tiene la conoce desde el principio, nadie
   más puede calcularla (habría que invertir SHA-256) y cualquiera
   puede *comprobarla* cuando se revela, porque su hash es la llave de
   la ronda anterior. Los dados de la ronda salen de esa llave y de la
   `mezcla`, las llaves que todos revelaron al destapar la ronda
   anterior — así que nadie conoce sus dados antes de que empiece la
   ronda, y los de los demás no los conoce nadie hasta el destape.

   Todo eso se comprueba **dentro del reductor**, a diferencia de la
   auditoría de Flip 7: por eso SHA-256 está escrito aquí a mano y es
   síncrono (`crypto.subtle` es asíncrono y el reductor no puede
   esperar). Una llave que no encaja con la cadena no cuenta: la mesa
   sigue esperando la buena, la pantalla dice en rojo quién mintió, y
   la votación puede echarlo. La primera ronda la precede un
   `arranque` en el que todos revelan la llave 0: de ahí salen la
   mezcla de la ronda 1 y quién abre, sin que nadie lo escoja.

   Partida siciliana: dudar la *primera* apuesta de la ronda es jugarse
   dos dados. Quien duda de entrada y se equivoca pierde dos; quien
   abrió con una apuesta que no estaba, también. Castiga el farol de
   salida y el dudo por costumbre, que son las dos cosas que alargan
   una partida de cacho sin que pase nada.

   El paso: con una apuesta en la mesa, uno por ronda puede pasar en
   vez de subir, y la apuesta sigue como estaba. Es legal con todos los
   dados iguales, todos distintos o un full (`pasoCacho`), pero se
   puede pasar sin tenerlo: el siguiente lo duda o sigue. Dudado, se
   destapa y pierde un dado quien se equivocó.

   Obligar: quien se queda con un dado, al abrir, puede obligar una vez
   por partida en uno de tres modos. En todos los ases dejan de ser
   comodín y los dados se tiran *después* de obligar — salen de la
   llave de cada uno y de la de todos los demás de esta ronda
   (`mezclaObligada`), así que nadie los conoce hasta que todos las
   revelan, ni siquiera los propios:
   - **abierto**: todos revelan la llave al empezar y cada uno ve los
     dados de los demás, no los suyos. El límite honesto es el del
     escondite: la pestaña de cada uno tiene los datos para calcular
     sus propios dados, y ocultarlos es cosa de la pantalla.
   - **cerrado**: nadie ve nada; se apuesta a «X de esta», la pinta del
     único dado de quien obligó, y solo se sube la cantidad.
   - **torbellino**: quien obliga elige una pinta, se tiran los dados y
     cada uno pierde los que salgan de esa pinta, él incluido. No hay
     apuestas.
   ============================================================ */

export const CC_DADOS = 5;
export const CC_CADENA = 300;
export const PINTAS_CACHO = ["", "As", "Tonto", "Tren", "Cuadra", "Quina", "Sexto"];
export const PINTAS_CACHO_PL = ["", "Ases", "Tontos", "Trenes", "Cuadras", "Quinas", "Sextos"];
export const MODOS_OBLIGA = { abierto: "Abierto", cerrado: "Cerrado", torbellino: "Torbellino" };
/* En ronda cerrada la pinta es la del dado de quien obligó, que nadie
   conoce: se guarda como 0 y se lee «de esta». */
export const textoApuesta = (c, p) => p === 0 ? `${c} de esta`
  : `${c} ${(c === 1 ? PINTAS_CACHO[p] : PINTAS_CACHO_PL[p] || "").toLowerCase()}`;

/* Si un vaso tiene paso, y cuál: todos iguales, todos distintos o un
   full (trío y par). Con las caras tal cual: aquí el as no es comodín. */
export function pasoCacho(ds) {
  if (!ds || !ds.length) return "";
  const n = {};
  for (const d of ds) n[d] = (n[d] || 0) + 1;
  const k = Object.values(n).sort((a, b) => a - b);
  if (k.length === 1) return "iguales";
  if (k.length === ds.length) return "distintos";
  if (ds.length === 5 && k.length === 2 && k[0] === 2) return "full";
  return "";
}

/* La mezcla de una ronda obligada: la de siempre más el modo y el hash
   de las llaves de *esta* ronda de todos los que tienen dados. Como
   esas llaves solo se conocen cuando se revelan, nadie —ni quien
   obligó— sabe qué salió hasta entonces. */
export function mezclaObligada(mezcla, modo, llavesRonda, enVaso) {
  const ks = Object.keys(enVaso || {}).filter(u => enVaso[u] > 0).sort()
    .map(u => u + ":" + ((llavesRonda || {})[u] || "")).join("|");
  return (mezcla || "") + "|" + modo + "|" + sha256hex(ks);
}

/* SHA-256 a mano. Las constantes van escritas y no calculadas con
   `Math.cbrt`: dos navegadores que redondearan distinto el último bit
   de una raíz cúbica verían dados distintos en la misma mesa. */
const SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];
const SHA_H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const shaMemo = new Map();

/* El reductor corre en cada repintado y rehace todas las rondas, así
   que el mismo hash se pide cientos de veces; se recuerda. */
export function sha256hex(texto) {
  const s = String(texto);
  const ya = shaMemo.get(s);
  if (ya) return ya;
  const b = new TextEncoder().encode(s);
  const largo = ((b.length + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(largo);
  m.set(b);
  m[b.length] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(largo - 8, Math.floor(b.length / 0x20000000));
  dv.setUint32(largo - 4, (b.length * 8) >>> 0);
  const h = SHA_H.slice(), w = new Int32Array(64);
  const ror = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < largo; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], c = w[i - 2];
      const s0 = ror(a, 7) ^ ror(a, 18) ^ (a >>> 3);
      const s1 = ror(c, 17) ^ ror(c, 19) ^ (c >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [A, B, C, D, E, F, G, H] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ror(E, 6) ^ ror(E, 11) ^ ror(E, 25);
      const ch = (E & F) ^ (~E & G);
      const t1 = (H + S1 + ch + SHA_K[i] + w[i]) | 0;
      const S0 = ror(A, 2) ^ ror(A, 13) ^ ror(A, 22);
      const may = (A & B) ^ (A & C) ^ (B & C);
      const t2 = (S0 + may) | 0;
      H = G; G = F; F = E; E = (D + t1) | 0;
      D = C; C = B; B = A; A = (t1 + t2) | 0;
    }
    h[0] = (h[0] + A) | 0; h[1] = (h[1] + B) | 0; h[2] = (h[2] + C) | 0; h[3] = (h[3] + D) | 0;
    h[4] = (h[4] + E) | 0; h[5] = (h[5] + F) | 0; h[6] = (h[6] + G) | 0; h[7] = (h[7] + H) | 0;
  }
  const out = h.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
  if (shaMemo.size > 20000) shaMemo.clear();
  shaMemo.set(s, out);
  return out;
}

/* La cadena entera de un jugador: `e[0]` sale de la semilla y `e[N]`
   es la punta que va en la ficha. Solo la calcula su dueño. */
const cadenas = new Map();
export function cadenaCacho(sem, sal) {
  const k = (sem >>> 0) + ":" + (sal || "");
  if (cadenas.has(k)) return cadenas.get(k);
  const e = [sha256hex("cacho:" + k)];
  for (let i = 0; i < CC_CADENA; i++) e.push(sha256hex(e[i]));
  cadenas.set(k, e);
  return e;
}
/* La llave de la ronda `r` (la 0 es la del arranque). */
export const llaveCacho = (cad, r) => cad[CC_CADENA - 1 - r];

/* Los `k` dados de un vaso: de la llave del dueño y la mezcla pública
   de la ronda. */
export function dadosCacho(llave, mezcla, k) {
  const r = rng(parseInt(sha256hex(llave + "|" + (mezcla || "")).slice(0, 8), 16));
  const d = [];
  for (let i = 0; i < k; i++) d.push(1 + Math.floor(r() * 6));
  return d;
}

/* Cuántos dados de la pinta `p` hay en la mesa. Los ases cuentan como
   cualquiera salvo cuando se apuesta a ases o la ronda está obligada. */
export const cuentaDado = (d, p, obligada) => d === p || (d === 1 && p !== 1 && !obligada);
export function cuentaCacho(vasos, p, obligada) {
  let n = 0;
  for (const u in vasos) for (const d of vasos[u]) if (cuentaDado(d, p, obligada)) n++;
  return n;
}

/* La cantidad mínima para apostar a la pinta `p` después de `ant`, o
   null si esa pinta no se puede. Las conversiones son las de siempre:
   de una pinta a otra mayor basta la misma cantidad, a una igual o
   menor hay que subir; de algo a ases se pide la mitad redondeada hacia
   arriba, y de ases a algo el doble más uno. En ronda obligada no se
   cambia de pinta, y en la cerrada la única pinta es «de esta» (0).
   Abrir con ases solo lo puede quien tiene un dado. */
export function minimoCacho(ant, p, { obligada = false, unDado = false } = {}) {
  if (obligada === "cerrado") return p === 0 ? (ant ? ant.c + 1 : 1) : null;
  if (p === 0) return null;
  if (!ant) return p === 1 && !unDado ? null : 1;
  if (obligada) return p === ant.p ? ant.c + 1 : null;
  if (ant.p !== 1 && p !== 1) return p > ant.p ? ant.c : ant.c + 1;
  if (ant.p !== 1) return Math.ceil(ant.c / 2);
  if (p === 1) return ant.c + 1;
  return 2 * ant.c + 1;
}

export function apuestaValidaCacho(ant, a, o = {}) {
  const c = Number(a && a.c), p = Number(a && a.p);
  if (!Number.isInteger(c) || !Number.isInteger(p) || p < 0 || p > 6 || c < 1) return false;
  if (o.total && c > o.total) return false;
  const m = minimoCacho(ant, p, o);
  return m !== null && c >= m;
}

function redCacho(p, js, listos) {
  const sicil = !!Number(p.sicil);
  const ids = js.map(j => j.uid), N = ids.length;
  const ficha = {};
  for (const j of js) ficha[j.uid] = j;
  const dados = {}, fuera = {}, obligo = {}, ultLlave = {}, llaves = [];
  for (const u of ids) dados[u] = CC_DADOS;
  let etapa = "arranque", ronda = 0, turno = "", sentido = 1, abre = "";
  /* `obligada` es el modo de la ronda ("" si es normal), `obliga` quién
     la obligó, `torb` la pinta de un torbellino y `paso` el paso de la
     ronda: quién pasó y cuántas apuestas había entonces. */
  let apuestas = [], obligada = "", obliga = "", torb = 0, paso = null, mezcla = "", enVaso = {};
  let destape = null, ultimo = null, ganador = null, motivo = "", ni = 0;
  const hist = [], falsas = [];

  const suceso = e => { e.i = ni++; hist.push(e); if (hist.length > 40) hist.shift(); };
  const esta = u => !fuera[u] && dados[u] > 0;
  const enRonda = u => !fuera[u] && (enVaso[u] || 0) > 0;
  const alrededor = (u, k) => ids[(((ids.indexOf(u) + sentido * k) % N) + N) % N];
  /* El siguiente que cumple `ok` en el sentido de la ronda; `u` mismo
     es el último candidato. */
  const sig = (u, ok) => {
    for (let k = 1; k <= N; k++) { const c = alrededor(u, k); if (ok(c)) return c; }
    return null;
  };
  const total = () => ids.reduce((s, u) => s + (esta(u) ? dados[u] : 0), 0);
  const enMesa = () => ids.reduce((s, u) => s + (enRonda(u) ? enVaso[u] : 0), 0);
  const inicial = N * CC_DADOS;
  /* Obligar: quien tiene un dado puede, al abrir, obligar la ronda en
     uno de los tres modos. Una vez por partida, y con dos en la mesa no
     tiene sentido. */
  const puedeObligar = u => etapa === "apuesta" && !apuestas.length && !obligada && turno === u
    && enVaso[u] === 1 && !obligo[u] && ids.filter(esta).length >= 3;
  /* Calzar: mientras quede en la mesa al menos la mitad de los dados
     con que empezó la partida. */
  const puedeCalzar = u => etapa === "apuesta" && turno === u && apuestas.length > 0 && total() * 2 >= inicial;
  /* Pasar: con una apuesta en la mesa, uno solo por ronda. En una
     obligada no, porque nadie sabe si tiene paso sin ver sus dados. */
  const puedePasar = u => etapa === "apuesta" && turno === u && apuestas.length > 0 && !obligada && !paso;
  /* El paso solo se le duda al que viene justo detrás: si sube, ya lo
     dejó pasar. */
  const puedeDudarPaso = u => etapa === "apuesta" && turno === u && !!paso
    && paso.tras === apuestas.length && paso.uid !== u;
  const faltan = r => (r === 0 ? ids.filter(u => !fuera[u]) : ids.filter(enRonda))
    .filter(u => !(llaves[r] && llaves[r][u]));

  /* Los vasos de la ronda con las llaves que ya se conocen. */
  const vasosRonda = () => {
    const L = llaves[ronda] || {};
    const m = obligada ? mezclaObligada(mezcla, obligada, L, enVaso) : mezcla;
    const v = {};
    for (const u of ids) if ((enVaso[u] || 0) > 0 && L[u]) v[u] = dadosCacho(L[u], m, enVaso[u]);
    return v;
  };

  /* Una llave es buena si, hasheada tantas veces como rondas separan a
     esta de la última que reveló, da aquella. La primera se compara con
     la punta de la ficha. */
  const llaveBuena = (u, r, c) => {
    const prev = ultLlave[u] || { r: -1, c: ficha[u].hcad };
    const d = r - prev.r;
    if (d < 1 || d > CC_CADENA) return false;
    let x = c;
    for (let i = 0; i < d; i++) x = sha256hex(x);
    return x === prev.c;
  };

  const empiezaRonda = quien => {
    ronda++;
    const prev = llaves[ronda - 1] || {};
    mezcla = ids.filter(u => prev[u]).map(u => u + ":" + prev[u]).join("|");
    enVaso = {};
    for (const u of ids) if (esta(u)) enVaso[u] = dados[u];
    etapa = "apuesta"; apuestas = []; destape = null;
    obligada = ""; obliga = ""; torb = 0; paso = null;
    abre = turno = quien;
    suceso({ e: "ronda", r: ronda, uid: quien });
  };

  const resuelve = () => {
    const d = destape;
    const vasos = vasosRonda();
    let orden = [];
    for (let k = 0; k < N; k++) { const c = alrededor(d.quien, k); if (vasos[c]) orden.push(c); }
    const antes = { ...dados };
    const quita = {};
    let cuenta = null, acierta = null, pierde = "", gana = "", n = 0, pinta = 0, tiene = "";
    if (d.tipo === "torbellino") {
      /* Cada uno pierde los dados que salieron de la pinta elegida. */
      pinta = torb; cuenta = 0;
      for (const u in vasos) {
        const k = vasos[u].filter(x => x === torb).length;
        if (k) { quita[u] = k; cuenta += k; }
      }
    } else if (d.tipo === "paso") {
      /* Solo importa el vaso de quien pasó. */
      orden = vasos[d.contra] ? [d.contra] : [];
      tiene = pasoCacho(vasos[d.contra]);
      acierta = !tiene;
      pierde = acierta ? d.contra : d.quien; n = 1;
    } else if (d.tipo !== "anula" && d.apuesta) {
      pinta = obligada === "cerrado" ? ((vasos[obliga] || [])[0] || 0) : d.apuesta.p;
      cuenta = cuentaCacho(vasos, pinta, obligada);
      if (d.tipo === "dudo") {
        acierta = cuenta < d.apuesta.c;
        pierde = acierta ? d.contra : d.quien;
        n = sicil && d.primera ? 2 : 1;
      } else {
        acierta = cuenta === d.apuesta.c;
        if (!acierta) { pierde = d.quien; n = 1; }
        else if (dados[d.quien] < CC_DADOS) { gana = d.quien; n = 1; }
      }
    }
    if (pierde) quita[pierde] = n;
    for (const u in quita) if (!fuera[u]) dados[u] = Math.max(0, dados[u] - quita[u]);
    if (gana && !fuera[gana]) dados[gana] += 1;
    ultimo = {
      r: ronda, tipo: d.tipo, quien: d.quien, contra: d.contra, apuesta: d.apuesta, obligada, obliga, sentido,
      orden, vasos, cuenta, acierta, pierde, gana, n, pinta, paso: tiene, quita,
      sicil: sicil && d.tipo === "dudo" && d.primera, antes, despues: { ...dados }
    };
    suceso({ e: "destape", r: ronda, tipo: d.tipo, uid: d.quien, a: d.contra, acierta, pierde, gana, n, p: pinta, q: quita });
    for (const u of ids) if (antes[u] > 0 && dados[u] === 0) suceso({ e: "sale", uid: u });
    const quedan = ids.filter(esta);
    if (quedan.length <= 1) { ganador = quedan[0] || ""; motivo = "cacho"; return; }
    if (ronda >= CC_CADENA - 1) {
      const max = Math.max(...quedan.map(u => dados[u])), arriba = quedan.filter(u => dados[u] === max);
      ganador = arriba.length === 1 ? arriba[0] : ""; motivo = "tope"; return;
    }
    /* Parte quien perdió el dado; tras un calzo, quien calzó; tras un
       torbellino, quien lo tiró; tras una ronda anulada, el mismo que la
       abrió. */
    let prox = d.tipo === "dudo" || d.tipo === "paso" ? pierde
      : d.tipo === "calzo" || d.tipo === "torbellino" ? d.quien : abre;
    if (!prox) prox = abre;
    if (!esta(prox)) prox = sig(prox, esta) || quedan[0];
    empiezaRonda(prox);
  };

  const avanza = () => {
    if (ganador !== null || !listos) return;
    if (etapa === "arranque") {
      if (faltan(0).length) return;
      const vivos = ids.filter(u => !fuera[u]);
      if (!vivos.length) return;
      const m0 = vivos.map(u => u + ":" + llaves[0][u]).join("|");
      empiezaRonda(vivos[parseInt(sha256hex(m0).slice(0, 8), 16) % vivos.length]);
      return;
    }
    /* Ronda abierta: con todas las llaves a la vista, parte quien obligó. */
    if (etapa === "muestra" && !faltan(ronda).length) { etapa = "apuesta"; turno = obliga; return; }
    if (etapa === "destape" && !faltan(ronda).length) resuelve();
  };

  const destapa = (tipo, quien, primera) => {
    const last = apuestas[apuestas.length - 1] || null;
    destape = { tipo, quien, contra: last ? last.uid : "", apuesta: last, primera };
    etapa = "destape"; turno = "";
  };

  for (const j of jugadasDe(p)) {
    const u = j.uid;
    if (!ficha[u]) continue;
    if (j.t === "abandona") {
      if (ganador !== null || fuera[u]) continue;
      const estaba = enRonda(u);
      fuera[u] = true;
      suceso({ e: "abandona", uid: u });
      const quedan = ids.filter(esta);
      if (quedan.length <= 1) { ganador = quedan[0] || ""; motivo = "abandono"; continue; }
      if (!listos) continue;
      /* Con sus dados en la mesa, la ronda ya no se puede resolver: se
         destapa igual —las llaves hacen falta para la mezcla siguiente—
         pero sin veredicto. */
      if ((etapa === "apuesta" || etapa === "muestra") && estaba) {
        destapa("anula", u, false);
        suceso({ e: "anula", uid: u });
      } else if (etapa === "destape" && estaba && !(llaves[ronda] && llaves[ronda][u])) {
        destape = { ...destape, tipo: "anula", quien: u };
        suceso({ e: "anula", uid: u });
      }
      avanza();
      continue;
    }
    if (ganador !== null || !listos || fuera[u]) continue;
    if (j.t === "k") {
      const r = Number(j.r), c = String(j.c || "");
      const vale = (etapa === "arranque" && r === 0)
        || ((etapa === "destape" || etapa === "muestra") && r === ronda && enRonda(u));
      if (!vale || (llaves[r] && llaves[r][u]) || !/^[0-9a-f]{64}$/.test(c) || !ficha[u].hcad) continue;
      if (!llaveBuena(u, r, c)) {
        if (!falsas.some(f => f.uid === u && f.r === r)) { falsas.push({ uid: u, r }); suceso({ e: "falsa", uid: u, r }); }
        continue;
      }
      (llaves[r] = llaves[r] || {})[u] = c;
      ultLlave[u] = { r, c };
      avanza();
      continue;
    }
    if (etapa !== "apuesta" || turno !== u) continue;
    if (j.t === "ap") {
      const ant = apuestas[apuestas.length - 1] || null;
      const a = { c: Number(j.c), p: Number(j.p) };
      if (!apuestaValidaCacho(ant, a, { obligada, unDado: enVaso[u] === 1, total: enMesa() })) continue;
      if (!ant && (Number(j.s) === -1 || Number(j.s) === 1)) sentido = Number(j.s);
      apuestas.push({ uid: u, c: a.c, p: a.p });
      suceso({ e: "ap", uid: u, c: a.c, p: a.p, s: !ant ? sentido : 0 });
      turno = sig(u, enRonda) || u;
    } else if (j.t === "dudo" && apuestas.length) {
      destapa("dudo", u, apuestas.length === 1);
      suceso({ e: "dudo", uid: u, a: destape.contra });
      avanza();
    } else if (j.t === "calzo" && puedeCalzar(u)) {
      destapa("calzo", u, apuestas.length === 1);
      suceso({ e: "calzo", uid: u, a: destape.contra });
      avanza();
    } else if (j.t === "paso" && puedePasar(u)) {
      paso = { uid: u, tras: apuestas.length };
      suceso({ e: "paso", uid: u });
      turno = sig(u, enRonda) || u;
    } else if (j.t === "dudapaso" && puedeDudarPaso(u)) {
      destapa("paso", u, false);
      destape.contra = paso.uid;
      suceso({ e: "dudapaso", uid: u, a: paso.uid });
      avanza();
    } else if (j.t === "obliga" && puedeObligar(u) && ["abierto", "cerrado", "torbellino"].includes(j.m)) {
      if (j.m === "torbellino") {
        const q = Number(j.p);
        if (!Number.isInteger(q) || q < 1 || q > 6) continue;
        torb = q;
      }
      obligada = j.m; obliga = u; obligo[u] = true;
      suceso({ e: "obliga", uid: u, m: j.m, p: torb });
      if (j.m === "abierto") { etapa = "muestra"; turno = ""; avanza(); }
      else if (j.m === "torbellino") { destapa("torbellino", u, false); avanza(); }
    }
  }

  let espera = null;
  if (listos && ganador === null) {
    if (etapa === "arranque") espera = { k: "llaves", r: 0, faltan: faltan(0) };
    else if (etapa === "muestra") espera = { k: "llaves", r: ronda, tipo: "muestra", faltan: faltan(ronda) };
    else if (etapa === "destape") espera = { k: "llaves", r: ronda, tipo: destape.tipo, faltan: faltan(ronda) };
    else espera = { k: "apuesta", uid: turno };
  }
  const puntos = {};
  for (const u of ids) puntos[u] = fuera[u] ? 0 : dados[u];
  const fin = ganador !== null;
  return {
    fase: !listos ? "espera" : fin ? "fin" : "jugando",
    sicil, dados, fuera, obligo, puntos, etapa, ronda, turno: fin ? "" : turno, sentido, abre,
    apuestas, obligada, obliga, torb, paso, mezcla, enVaso, total: total(), enMesa: enMesa(), inicial,
    /* En ronda abierta, los vasos de todos: la pantalla esconde el propio. */
    abiertos: !fin && obligada === "abierto" && etapa === "apuesta" ? vasosRonda() : null,
    destape, espera, ultimo, hist, falsas, ganador, motivo,
    calzo: !fin && puedeCalzar(turno), obligar: !fin && puedeObligar(turno),
    pasar: !fin && puedePasar(turno), dudaPaso: !fin && puedeDudarPaso(turno)
  };
}

/* ============================================================
   UNO — cinco versiones sobre el mismo reductor

   El problema es el de siempre aquí, sin servidor: cada mano es
   secreta, nadie puede elegir qué roba y nadie puede saber lo que
   tiene otro. Lo resuelven cuatro piezas:

   1. **Cada jugador roba de un mazo propio e infinito.** La carta
      número k que roba `u` es `mazo[H("uno:" + sem + ":" + sal + ":" +
      mezcla + ":" + k) mod largo]`: su semilla privada (la de
      `misPartidas/<uid>/<pid>/sec`, la misma de cartas, Flip 7 y el
      cacho) y una `mezcla` que nadie conoce hasta que empieza la
      partida. Es un muestreo con reposición del mazo de la versión,
      así que las proporciones son las de la caja; lo que se pierde es
      que el mazo se agote, que en el UNO real solo obliga a barajar el
      descarte. La mezcla sale de un arranque de compromiso y
      revelación: la ficha lleva `hcad = H(arr)`, cada pantalla manda
      `arr` sola al empezar, y la mezcla es el hash de todas. Así nadie
      puede buscarse una semilla con buena mano.
   2. **El reductor solo sabe cuántas cartas tiene cada uno.** Lleva
      además una lista `ops` de lo que le pasó a cada mano (roba n,
      juega tal carta, descarta el color tal…), que cada pantalla
      repasa con su secreto para saber qué tiene (`repasaUno`).
   3. **Lo que no se ve se promete con un hash**: las cartas boca abajo
      del Liar's se juegan como `H(carta + ":" + sal)`, y los cambios de
      mano (el 7 y el 0 del No Mercy, el Intercambio forzado del All
      Wild) viajan en un sobre cifrado con Diffie-Hellman entre los dos
      jugadores (`pk` en la ficha, grupo MODP de 2048 bits del RFC
      3526): solo el que lo recibe puede abrirlo.
   4. **Al acabar, todos revelan la semilla** `{t:"s"}` y `auditaUno`
      repite la partida entera con todas las manos a la vista: que cada
      carta jugada estuviera en la mano, que el robar-hasta-poder parara
      donde tocaba, que la respuesta al reto del +4 fuera verdad, que
      cada sobre llevara la mano de verdad… Quien mintió sale en rojo en
      todas las pantallas.

   El precio, dicho en voz alta: quien abra la consola puede calcular
   qué robaría *él mismo* si robara ahora — su mazo es suyo. No puede
   cambiarlo ni ver el de nadie.
   ============================================================ */

export const MODOS_UNO = {
  clasico: "Clásico", nomercy: "No Mercy", nomercyx: "No Mercy + expansión",
  allwild: "All Wild", liar: "Liar's"
};
export const modoUno = p => (p && Object.prototype.hasOwnProperty.call(MODOS_UNO, p.modo)) ? p.modo : "clasico";
export const esNoMercy = modo => modo === "nomercy" || modo === "nomercyx";
export const UNO_COLORES = ["R", "A", "V", "Z"];
export const UNO_NOMBRE_COLOR = { R: "rojo", A: "amarillo", V: "verde", Z: "azul" };
export const UNO_MANO = 7;
export const UNO_TOPE = 25;          // No Mercy: con 25 cartas o más, fuera
export const UNO_MUERTE = 24;        // Muerte súbita: todos roban hasta 24

/* Los códigos. Una carta de color es su color y su valor (`R7`, `AS`
   salta, `VI` invierte, `Z+2`, `R+4` el +4 de color del No Mercy, `AT`
   salta a todos, `VD` descarta todo, `R10`); un comodín empieza por N
   (`N`, `N+4`, `N+6`, `N+10`, `NI4` y `NI8` los que invierten, `NC` la
   ruleta, `ND` descarte total, `NF` ataque final, `NM` muerte súbita,
   y los del All Wild: `N+2`, `NS`, `NI`, `NS2`, `NT2` diana, `NW`
   intercambio; `NL` el reto del Liar's). La tilde delante marca una
   carta de mentiroso: `~R5` se juega boca abajo. */
function construyeMazoUno(modo) {
  const m = [];
  const pon = (c, n) => { for (let i = 0; i < n; i++) m.push(c); };
  if (modo === "allwild") {
    pon("N", 54); pon("N+2", 10); pon("NS", 14); pon("NI", 14);
    pon("NS2", 6); pon("NT2", 4); pon("N+4", 6); pon("NW", 4);
    return m;
  }
  if (modo === "liar") {
    for (const c of UNO_COLORES) {
      for (let v = 0; v <= 9; v++) { pon(c + v, 1); pon("~" + c + v, 1); }
      pon("~" + c + "S", 2); pon("~" + c + "I", 2); pon("~" + c + "+2", 2);
    }
    pon("~N+4", 2); pon("NL", 6);
    return m;
  }
  if (esNoMercy(modo)) {
    for (const c of UNO_COLORES) {
      for (let v = 0; v <= 9; v++) pon(c + v, 2);
      pon(c + "+2", 3); pon(c + "+4", 2); pon(c + "S", 3); pon(c + "T", 2);
      pon(c + "I", 3); pon(c + "D", 3);
      if (modo === "nomercyx") pon(c + "10", 2);
    }
    pon("NI4", 8); pon("N+6", 4); pon("N+10", 4); pon("NC", 8);
    if (modo === "nomercyx") { pon("ND", 8); pon("NI8", 4); pon("NF", 2); pon("NM", 2); }
    return m;
  }
  for (const c of UNO_COLORES) {
    pon(c + "0", 1);
    for (let v = 1; v <= 9; v++) pon(c + v, 2);
    pon(c + "S", 2); pon(c + "I", 2); pon(c + "+2", 2);
  }
  pon("N", 4); pon("N+4", 4);
  return m;
}
const mazosUno = {};
export const mazoUno = modo => mazosUno[modo] || (mazosUno[modo] = construyeMazoUno(modo));
const codigosUno = {};
/* Todo código que la versión conoce, con y sin tilde. */
export const codigosDeUno = modo => codigosUno[modo]
  || (codigosUno[modo] = new Set(mazoUno(modo).flatMap(c => [c, c.replace(/^~/, "")])));

export const sinTilde = c => (c && c[0] === "~") ? c.slice(1) : String(c || "");
export const esMentiraUno = c => !!c && c[0] === "~";
export const esComodinUno = c => sinTilde(c)[0] === "N";
export const colorUno = c => esComodinUno(c) ? "" : sinTilde(c)[0];
export const valorUno = c => esComodinUno(c) ? sinTilde(c) : sinTilde(c).slice(1);
export const esNumeroUno = c => !esComodinUno(c) && /^\d+$/.test(valorUno(c));
const ROBO_UNO = { "+2": 2, "+4": 4, "N+4": 4, "NI4": 4, "N+6": 6, "N+10": 10, "NI8": 8, "N+2": 2 };
/* Cuánto hace robar una carta: en el No Mercy es también lo que decide
   sobre qué se puede apilar. */
export const roboUno = c => ROBO_UNO[valorUno(c)] || 0;

/* ¿Se puede jugar `c` sobre la mesa? `e` = {modo, tope:{c, col}, pena}.
   Con una pena encima (No Mercy) solo vale otra carta de robar de valor
   igual o mayor, sin mirar el color. */
export function jugableUno(c, e) {
  if (!c) return false;
  if (e.modo === "allwild") return true;
  if (e.pena) return roboUno(c) > 0 && roboUno(c) >= e.pena.min;
  if (esComodinUno(c)) return true;
  const t = e.tope || {};
  if (colorUno(c) === t.col) return true;
  return !!t.c && !esComodinUno(t.c) && valorUno(c) === valorUno(t.c);
}

/* Lo que se puede anunciar al jugar boca abajo en el Liar's: cualquier
   cara de carta de mentiroso. */
export const anunciablesUno = () => [
  ...UNO_COLORES.flatMap(c => [...Array(10).keys()].map(v => c + v).concat([c + "S", c + "I", c + "+2"])),
  "N+4"
];

/* La primera carta del descarte: un número, de la mezcla. En el All
   Wild no hay números; la mesa empieza con un comodín sin color. */
export function topeInicialUno(modo, mezcla) {
  if (modo === "allwild") return { c: "N", col: "" };
  const h = parseInt(sha256hex("uno-tope:" + mezcla).slice(0, 8), 16);
  const col = UNO_COLORES[h % 4];
  return { c: col + ((h >>> 2) % 10), col };
}

/* ---------- los secretos derivados de la semilla ---------- */
export const arrUno = (sem, sal) => sha256hex("uno-arr:" + sem + ":" + sal);
export const salUno = (sem, sal, n) => sha256hex("uno-sal:" + sem + ":" + sal + ":" + n).slice(0, 16);
export const tapaUno = (c, s) => sha256hex(c + ":" + s);
export function cartaUno(modo, sem, sal, mezcla, k) {
  const m = mazoUno(modo);
  return m[parseInt(sha256hex("uno:" + sem + ":" + sal + ":" + mezcla + ":" + k).slice(0, 8), 16) % m.length];
}

/* Diffie-Hellman con el grupo 14 del RFC 3526 (2048 bits, g = 2). Lo
   bastante para que un sobre no se abra en la consola a mitad de
   partida; la privada sale de la semilla, así que al final se puede
   comprobar que la pública era suya. */
const DH_P = BigInt("0x" +
  "ffffffffffffffffc90fdaa22168c234c4c6628b80dc1cd129024e088a67cc74020bbea63b139b22514a08798e3404dd" +
  "ef9519b3cd3a431b302b0a6df25f14374fe1356d6d51c245e485b576625e7ec6f44c42e9a637ed6b0bff5cb6f406b7ed" +
  "ee386bfb5a899fa5ae9f24117c4b1fe649286651ece45b3dc2007cb8a163bf0598da48361c55d39a69163fa8fd24cf5f" +
  "83655d23dca3ad961c62f356208552bb9ed529077096966d670c354e4abc9804f1746c08ca18217c32905e462e36ce3b" +
  "e39e772c180e86039b2783a2ec07a28fb5c55df06f4c52c9de2bcbf6955817183995497cea956ae515d2261898fa0510" +
  "15728e5a8aacaa68ffffffffffffffff");
function potMod(b, e, m) {
  let r = 1n; b %= m;
  while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; }
  return r;
}
const dhPrivada = (sem, sal) => BigInt("0x" + sha256hex("uno-dh:" + sem + ":" + sal));
const dhMemo = new Map();
export function dhPublica(sem, sal) {
  const k = "p:" + sem + ":" + sal;
  if (!dhMemo.has(k)) dhMemo.set(k, potMod(2n, dhPrivada(sem, sal), DH_P).toString(16));
  return dhMemo.get(k);
}
/* La clave que comparten el dueño de (sem, sal) y el de `pkOtro`; null
   si la pública del otro no es un número. */
export function dhCompartida(sem, sal, pkOtro) {
  const k = sem + ":" + sal + ":" + pkOtro;
  if (dhMemo.has(k)) return dhMemo.get(k);
  let v = null;
  try {
    if (/^[0-9a-f]{1,600}$/.test(String(pkOtro))) {
      const x = BigInt("0x" + pkOtro);
      if (x > 1n && x < DH_P - 1n) v = sha256hex("uno-k:" + potMod(x, dhPrivada(sem, sal), DH_P).toString(16));
    }
  } catch (e) { v = null; }
  dhMemo.set(k, v);
  return v;
}
/* Un sobre: la mano como texto, XOR con un flujo de SHA-256 de la
   clave compartida. Cada sobre lleva su `id`, así que dos sobres entre
   los mismos dos no comparten flujo. */
function flujoUno(clave, id, largo) {
  const b = [];
  for (let i = 0; b.length < largo; i++) {
    const h = sha256hex(clave + ":" + id + ":" + i);
    for (let j = 0; j < 64 && b.length < largo; j += 2) b.push(parseInt(h.substr(j, 2), 16));
  }
  return b;
}
export function cierraSobreUno(clave, id, mano) {
  const t = mano.join(",");
  const f = flujoUno(clave, id, t.length);
  let s = "";
  for (let i = 0; i < t.length; i++) s += ((t.charCodeAt(i) & 0xff) ^ f[i]).toString(16).padStart(2, "0");
  return s;
}
/* La mano que había dentro, o null si no se deja leer como cartas de
   esta versión (sobre falso, o pública falsa). */
export function abreSobreUno(clave, id, hex, modo) {
  if (!clave || typeof hex !== "string" || hex.length % 2 || !/^[0-9a-f]*$/.test(hex)) return null;
  const f = flujoUno(clave, id, hex.length / 2);
  let t = "";
  for (let i = 0; i < hex.length / 2; i++) t += String.fromCharCode(parseInt(hex.substr(i * 2, 2), 16) ^ f[i]);
  const m = t ? t.split(",") : [];
  const ok = codigosDeUno(modo);
  return m.every(c => ok.has(c)) ? m : null;
}

const listaUno = x => Array.isArray(x) ? x : Object.values(x || {});

/* ---------- el reductor ---------- */
function redUno(p, js, listos) {
  const modo = modoUno(p), nm = esNoMercy(modo);
  const ids = js.map(j => j.uid), N = ids.length;
  const ficha = {};
  for (const j of js) ficha[j.uid] = j;
  const codigos = codigosDeUno(modo);
  const cartas = {}, fuera = {}, elim = {}, arr = {}, monedas = {}, ocultas = {}, semillas = {};
  for (const u of ids) { cartas[u] = 0; ocultas[u] = 0; }
  let etapa = "arranque", mezcla = "", tope = null, dir = 1, turno = "", pena = null, espera = null;
  let olvido = "", ganador = null, motivo = "", ni = 0, nsobre = 0, jugadas = 0;
  const ops = [], hist = [], falsas = [];

  const suceso = e => { e.i = ni++; hist.push(e); if (hist.length > 40) hist.shift(); };
  const activo = u => !!ficha[u] && !fuera[u] && !elim[u];
  const activos = () => ids.filter(activo);
  const alrededor = (u, k) => ids[(((ids.indexOf(u) + dir * k) % N) + N) % N];
  const sig1 = u => { for (let k = 1; k <= N; k++) { const c = alrededor(u, k); if (activo(c)) return c; } return u; };
  const sig = (u, pasos = 1) => { let c = u; for (let s = 0; s < pasos; s++) c = sig1(c); return c; };
  const vivoOSig = u => activo(u) ? u : sig1(u);
  const op = (u, ...o) => ops.push([u, ...o]);
  const roba = (u, n, por, ctx) => {
    if (!(n > 0) || !activo(u)) return;
    cartas[u] += n;
    op(u, "r", n, por || "", ctx === undefined ? null : ctx);
    if (por !== "mano") suceso({ e: "roba", uid: u, n, por: por || "" });
  };
  const gana = (u, m) => {
    if (ganador !== null) return;
    ganador = u; motivo = m;
    if (u) suceso({ e: "gana", uid: u });
  };
  /* No Mercy: 25 cartas o más y fuera. Si queda uno, ha ganado. */
  const revisaTope = () => {
    if (!nm || ganador !== null) return;
    for (const u of ids) if (activo(u) && cartas[u] >= UNO_TOPE) {
      suceso({ e: "elimina", uid: u, n: cartas[u] });
      elim[u] = true; cartas[u] = 0; op(u, "e");
      if (olvido === u) olvido = "";
    }
    const q = activos();
    if (q.length <= 1) gana(q[0] || "", "piedad");
  };

  const arranca = () => {
    const vivos = ids.filter(u => !fuera[u]);
    mezcla = sha256hex(vivos.map(u => u + ":" + arr[u]).join("|"));
    for (const u of vivos) roba(u, UNO_MANO, "mano");
    tope = topeInicialUno(modo, mezcla);
    turno = vivos[parseInt(mezcla.slice(8, 16), 16) % vivos.length];
    etapa = modo === "nomercyx" ? "monedas" : "juego";
    suceso({ e: "empieza", uid: turno });
  };

  /* Un cambio de manos: cada par [de, a] es «la mano de `de` pasa a
     `a`». Espera los sobres de todos y los aplica de golpe, que es lo
     que hace falta para la rueda del 0. */
  const intercambia = (pares, luego, por) => {
    espera = { k: "sobres", id: nsobre++, pares: pares.map(([de, a]) => ({ de, a })), hechos: {}, luego, por };
    turno = "";
  };
  const cierraSobres = () => {
    const e = espera;
    const antes = { ...cartas };
    const lista = e.pares.map(x => [x.de, x.a, e.hechos[x.de + ">" + x.a]]);
    for (const [de, a] of lista) cartas[a] = antes[de];
    ops.push(["", "X", e.id, lista]);
    suceso({ e: "cambio", por: e.por, pares: e.pares });
    espera = null;
    turno = vivoOSig(e.luego);
  };

  /* Lo que hace una carta al caer, ya jugada y descontada. `c` va sin
     tilde (una carta de mentiroso aceptada vale lo que anunció). */
  const efecto = (u, c, x) => {
    const v = valorUno(c);
    const col = modo === "allwild" ? "" : esComodinUno(c) ? x.col : colorUno(c);
    tope = { c, col };
    if (v === "D" || c === "ND") {
      cartas[u] -= x.n; op(u, "dc", col, x.n);
      suceso({ e: "descarta", uid: u, col, n: x.n });
    }
    if (c === "NF") op(u, "fa", x.mano);
    if (cartas[u] <= 0) { cartas[u] = 0; gana(u, "uno"); return; }
    const dos = activos().length === 2;
    let luego = sig(u);
    if (modo === "allwild") {
      if (c === "N+2" || c === "N+4") { const w = sig(u); roba(w, roboUno(c), "carta"); luego = sig(u, 2); }
      else if (c === "NS") luego = sig(u, 2);
      else if (c === "NS2") luego = sig(u, 3);
      else if (c === "NI") { dir = -dir; luego = dos ? u : sig(u); }
      else if (c === "NT2") roba(x.obj, 2, "diana");
      else if (c === "NW") return intercambia([[u, x.obj], [x.obj, u]], luego, "NW");
      turno = luego;
      return;
    }
    if (v === "S") luego = sig(u, 2);
    else if (v === "I") { dir = -dir; luego = dos ? u : sig(u); }
    else if (v === "T") luego = u;
    else if (nm && roboUno(c)) {
      if (c === "NI4" || c === "NI8") dir = -dir;
      const val = roboUno(c);
      let tot = (pena ? pena.n : 0) + val;
      if (x.moneda) tot *= 2;
      pena = { n: tot, min: val, de: u };
      turno = sig(u);
      return;
    }
    else if (v === "+2") { const w = sig(u); roba(w, 2, "carta"); luego = sig(u, 2); }
    else if (c === "N+4" && modo === "clasico") {
      espera = { k: "reto", uid: sig(u), de: u, prev: x.prev };
      turno = sig(u);
      return;
    }
    else if (c === "N+4") { const w = sig(u); roba(w, 4, "carta"); luego = sig(u, 2); }
    else if (nm && v === "7") return intercambia([[u, x.obj], [x.obj, u]], luego, "7");
    else if (nm && v === "0") return intercambia(activos().map(w => [w, sig1(w)]), luego, "0");
    else if (c === "NC") { espera = { k: "ruleta", uid: sig(u), de: u }; turno = sig(u); return; }
    else if (c === "NF") {
      const w = sig(u), n = x.mano.filter(y => !esNumeroUno(y)).length;
      if (n >= 7) {
        roba(w, UNO_TOPE, "final");
        for (const o of activos()) if (o !== u && o !== w) roba(o, 5, "final");
      } else roba(w, n, "final");
      suceso({ e: "final", uid: u, a: w, n, mano: x.mano });
      revisaTope();
      luego = sig1(w);
    }
    else if (c === "NM") { for (const o of activos()) if (cartas[o] < UNO_MUERTE) roba(o, UNO_MUERTE - cartas[o], "muerte"); }
    else if (c === "NL") {
      const faltan = activos().filter(o => o !== u && cartas[o] > 0);
      espera = { k: "tapas", de: u, col, faltan, tapas: {}, abiertas: {} };
      turno = "";
      if (!faltan.length) { espera = null; turno = luego; }
      return;
    }
    revisaTope();
    if (ganador === null) turno = vivoOSig(luego);
  };

  /* El reto del Liar's se cierra: las cartas que no se destaparon, y la
     verdadera que lo paró, se quedan en el descarte. */
  const cierraTapas = d => {
    espera = null;
    suceso({ e: "tapas", uid: d.de, abiertas: d.abiertas });
    const vacios = ids.filter(o => activo(o) && d.tapas[o] && cartas[o] === 0);
    if (vacios.length) {
      /* Si alguien se quedó sin cartas, gana el primero desde quien retó. */
      for (let k = 1; k <= N; k++) { const c = alrededor(d.de, k); if (vacios.includes(c)) { gana(c, "uno"); return; } }
    }
    turno = sig(d.de);
  };

  /* Alguien se va: lo que se le estaba esperando no puede quedarse
     esperando. */
  const repara = u => {
    const e = espera;
    if (olvido === u) olvido = "";
    if (e) {
      if (e.k === "sobres" && e.pares.some(x => x.de === u || x.a === u)) { espera = null; turno = vivoOSig(e.luego); }
      else if ((e.k === "tras" || e.k === "hasta") && e.uid === u) { espera = null; turno = sig1(u); }
      else if (e.k === "reto" && (e.uid === u || e.de === u)) { espera = null; turno = vivoOSig(e.uid); }
      else if (e.k === "resp" && (e.uid === u || e.reta === u)) { espera = null; turno = vivoOSig(e.reta); }
      else if (e.k === "ruleta" && e.uid === u) { espera = null; turno = sig1(u); }
      else if (e.k === "duda") {
        if (e.de === u) { tope = e.antes; espera = null; turno = sig1(u); }
        else if (e.sig === u) e.sig = sig1(e.de);
      } else if (e.k === "revela" && e.uid === u) {
        if (e.por === "duda") { tope = e.d.antes; espera = null; turno = sig1(u); }
        else { espera = e.d; if (!Object.keys(e.d.tapas).some(o => activo(o) && !e.d.abiertas[o])) cierraTapas(e.d); }
      } else if (e.k === "revela" && e.por === "tapa" && e.d.de === u) cierraTapas(e.d);
      else if (e.k === "tapas") {
        if (e.de === u) cierraTapas(e);
        else { e.faltan = e.faltan.filter(o => o !== u); if (e.faltan.every(o => e.tapas[o])) espera = { ...e, k: "destapa" }; }
      } else if (e.k === "destapa") {
        if (e.de === u || !Object.keys(e.tapas).some(o => o !== u && activo(o) && !e.abiertas[o])) cierraTapas(e);
      }
    }
    if (!espera && turno === u) turno = sig1(u);
    if (!espera && pena && turno && !activo(turno)) turno = sig1(turno);
  };

  const TURNO = new Set(["juega", "roba", "pasa", "carga", "reta", "ruleta", "miente", "merced"]);

  for (const j of jugadasDe(p)) {
    const u = j.uid;
    if (!ficha[u]) continue;
    if (j.t === "s") { if (ganador !== null) semillas[u] = true; continue; }
    if (j.t === "abandona") {
      if (ganador !== null || fuera[u]) continue;
      fuera[u] = true;
      suceso({ e: "abandona", uid: u });
      const quedan = ids.filter(o => !fuera[o] && !elim[o]);
      if (quedan.length <= 1) { gana(quedan[0] || "", "abandono"); continue; }
      if (!listos) continue;
      if (etapa === "arranque") { if (ids.every(o => fuera[o] || arr[o])) arranca(); continue; }
      if (etapa === "monedas") { if (activos().every(o => monedas[o])) etapa = "juego"; }
      repara(u);
      continue;
    }
    if (ganador !== null || !listos || !activo(u)) continue;

    if (j.t === "k") {
      const c = String(j.c || "");
      if (etapa !== "arranque" || arr[u]) continue;
      if (!/^[0-9a-f]{64}$/.test(c) || sha256hex(c) !== ficha[u].hcad) {
        if (!falsas.some(f => f.uid === u && f.que === "llave")) { falsas.push({ uid: u, que: "llave" }); suceso({ e: "falsa", uid: u }); }
        continue;
      }
      arr[u] = c;
      if (ids.every(o => fuera[o] || arr[o])) arranca();
      continue;
    }
    if (etapa === "monedas") {
      if (j.t === "moneda" && !monedas[u] && (j.lado === "mercy" || j.lado === "nomercy")) {
        monedas[u] = { lado: j.lado, usada: false };
        suceso({ e: "moneda", uid: u, lado: j.lado });
        if (activos().every(o => monedas[o])) etapa = "juego";
      }
      continue;
    }
    if (etapa !== "juego") continue;

    /* ¡UNO! y pillar al que se olvidó. */
    if (j.t === "uno") {
      if (olvido === u) { olvido = ""; suceso({ e: "uno", uid: u }); }
      continue;
    }
    if (j.t === "pilla") {
      const a = j.a;
      if (a !== u && olvido === a && activo(a) && cartas[a] === 1 && !(espera && espera.k === "sobres")) {
        olvido = "";
        suceso({ e: "pilla", uid: u, a });
        roba(a, 2, "uno");
      }
      continue;
    }
    if (TURNO.has(j.t) && olvido && olvido !== u) olvido = "";

    const e = espera;
    const miTurno = !e && turno === u;
    const tras = e && (e.k === "tras" || e.k === "hasta") && e.uid === u;

    if (j.t === "juega") {
      const c = String(j.c || "");
      if (!(miTurno || tras) || !codigos.has(c) || esMentiraUno(c)) continue;
      if (!jugableUno(c, { modo, tope, pena })) continue;
      if (esComodinUno(c) && modo !== "allwild" && !UNO_COLORES.includes(j.col)) continue;
      const quedan = cartas[u] - 1;
      const x = { col: j.col, prev: tope.col, obj: j.obj, n: 0, mano: null, moneda: false };
      if ((nm && valorUno(c) === "7") || c === "NW") {
        if (quedan > 0 && (!activo(j.obj) || j.obj === u)) continue;
      }
      if (c === "NT2" && !activo(j.obj)) continue;
      if (valorUno(c) === "D" || c === "ND") {
        const n = Number(j.n);
        if (!Number.isInteger(n) || n < 0 || n > quedan) continue;
        x.n = n;
      }
      if (c === "NF") {
        const m = listaUno(j.mano).map(String);
        if (m.length !== quedan || !m.every(y => codigos.has(y))) continue;
        x.mano = m;
      }
      if (j.moneda) {
        const mo = monedas[u];
        if (!mo || mo.lado !== "nomercy" || mo.usada || !roboUno(c)) continue;
        mo.usada = true; x.moneda = true;
        suceso({ e: "usamoneda", uid: u, lado: "nomercy" });
      }
      cartas[u] = quedan;
      op(u, "j", c, tras ? 1 : 0);
      espera = null;
      jugadas++;
      suceso({ e: "juega", uid: u, c, col: j.col || "", obj: j.obj || "", moneda: x.moneda || undefined });
      if (quedan - (x.n || 0) === 1) { if (j.uno) suceso({ e: "uno", uid: u }); else olvido = u; }
      efecto(u, c, x);
      continue;
    }
    if (j.t === "miente") {
      const di = String(j.di || ""), h = String(j.h || "");
      if (modo !== "liar" || !miTurno || !anunciablesUno().includes(di) || !/^[0-9a-f]{64}$/.test(h)) continue;
      if (!jugableUno(di, { modo, tope, pena })) continue;
      if (esComodinUno(di) && !UNO_COLORES.includes(j.col)) continue;
      cartas[u]--;
      const n = ocultas[u]++;
      op(u, "h", h, n, "m");
      const antes = tope;
      tope = { c: di, col: esComodinUno(di) ? j.col : colorUno(di), oculta: true };
      espera = { k: "duda", de: u, di, col: j.col || "", h, n, sig: sig(u), antes };
      jugadas++;
      suceso({ e: "miente", uid: u, di, col: j.col || "" });
      if (cartas[u] === 1) { if (j.uno) suceso({ e: "uno", uid: u }); else olvido = u; }
      continue;
    }
    if (j.t === "roba") {
      if (!miTurno || pena || modo === "allwild") continue;
      if (nm) {
        const n = Number(j.n);
        if (!Number.isInteger(n) || n < 1 || n > UNO_TOPE + 1) continue;
        roba(u, n, "hasta", { c: tope.c, col: tope.col });
        revisaTope();
        if (ganador !== null) continue;
        if (elim[u]) turno = sig1(u);
        else espera = { k: "hasta", uid: u };
      } else {
        roba(u, 1, "turno");
        espera = { k: "tras", uid: u };
      }
      continue;
    }
    /* Tras robar hasta poder, lo honrado es jugar la última; pasar se
       deja (una pantalla que contó mal no debe dejar la mesa parada)
       y lo juzga la auditoría. */
    if (j.t === "pasa") {
      if (!(e && (e.k === "tras" || e.k === "hasta") && e.uid === u)) continue;
      if (e.k === "hasta") op(u, "ph", { c: tope.c, col: tope.col });
      espera = null;
      suceso({ e: "pasa", uid: u });
      turno = sig(u);
      continue;
    }
    if (j.t === "carga") {
      if (miTurno && pena) {
        const n = pena.n;
        pena = null;
        roba(u, n, "pena");
        revisaTope();
        if (ganador === null) turno = sig1(u);
      } else if (e && e.k === "reto" && e.uid === u) {
        espera = null;
        roba(u, 4, "carta");
        turno = sig(u);
      }
      continue;
    }
    if (j.t === "reta") {
      if (!(e && e.k === "reto" && e.uid === u)) continue;
      espera = { k: "resp", uid: e.de, reta: u, prev: e.prev };
      turno = "";
      suceso({ e: "reta", uid: u, a: e.de });
      continue;
    }
    if (j.t === "resp") {
      if (!(e && e.k === "resp" && e.uid === u)) continue;
      const legal = !!j.ok;
      op(u, "w4", legal ? 1 : 0, e.prev);
      espera = null;
      suceso({ e: "resp", uid: u, a: e.reta, legal });
      if (legal) { roba(e.reta, 6, "reto"); turno = sig(e.reta); }
      else { roba(u, 4, "reto"); turno = e.reta; }
      continue;
    }
    if (j.t === "ruleta") {
      const n = Number(j.n);
      if (!(e && e.k === "ruleta" && e.uid === u) || !UNO_COLORES.includes(j.col)) continue;
      if (!Number.isInteger(n) || n < 1 || n > UNO_TOPE + 1) continue;
      espera = null;
      tope = { ...tope, col: j.col };
      suceso({ e: "ruleta", uid: u, col: j.col, n });
      roba(u, n, "ruleta", j.col);
      revisaTope();
      if (ganador === null) turno = sig1(u);
      continue;
    }
    if (j.t === "sobre") {
      if (!(e && e.k === "sobres")) continue;
      const clave = u + ">" + j.a;
      if (!e.pares.some(x => x.de === u && x.a === j.a) || e.hechos[clave] !== undefined || typeof j.enc !== "string") continue;
      e.hechos[clave] = j.enc;
      if (e.pares.every(x => e.hechos[x.de + ">" + x.a] !== undefined)) cierraSobres();
      continue;
    }
    if (j.t === "merced") {
      const mo = monedas[u];
      if (!miTurno || !mo || mo.lado !== "mercy" || mo.usada) continue;
      mo.usada = true;
      if (olvido === u) olvido = "";
      op(u, "v");
      cartas[u] = 0;
      pena = null;
      suceso({ e: "usamoneda", uid: u, lado: "mercy" });
      roba(u, UNO_MANO, "merced");
      continue;
    }
    if (j.t === "cree") {
      if (!(e && e.k === "duda" && e.sig === u)) continue;
      espera = null;
      suceso({ e: "cree", uid: u, a: e.de });
      efecto(e.de, e.di, { col: e.col });
      continue;
    }
    if (j.t === "duda") {
      if (!(e && e.k === "duda" && e.de !== u)) continue;
      espera = { k: "revela", uid: e.de, h: e.h, n: e.n, por: "duda", dudon: u, d: e };
      suceso({ e: "duda", uid: u, a: e.de });
      continue;
    }
    if (j.t === "revela") {
      if (!(e && e.k === "revela" && e.uid === u)) continue;
      const c = String(j.c || "");
      if (!codigos.has(c) || tapaUno(c, String(j.s || "")) !== e.h) {
        if (!falsas.some(f => f.uid === u && f.que === "revela" && f.n === e.n)) {
          falsas.push({ uid: u, que: "revela", n: e.n });
          suceso({ e: "falsa", uid: u });
        }
        continue;
      }
      if (e.por === "duda") {
        const d = e.d;
        if (esMentiraUno(c) && sinTilde(c) === d.di) {
          suceso({ e: "verdad", uid: u, a: e.dudon, c });
          espera = null;
          roba(e.dudon, 1, "duda");
          efecto(u, d.di, { col: d.col });
        } else {
          suceso({ e: "mentira", uid: u, a: e.dudon, c });
          espera = null;
          tope = d.antes;
          cartas[u] += 1; op(u, "b", c);
          if (olvido === u) olvido = "";
          roba(u, 1, "mentira");
          turno = sig(u);
        }
      } else {
        const d = e.d;
        const verdad = colorUno(c) === d.col;
        d.abiertas[u] = { c, v: verdad };
        suceso({ e: verdad ? "verdad" : "mentira", uid: u, a: d.de, c, tapa: true });
        if (verdad) cierraTapas(d);
        else {
          cartas[u] += 1; op(u, "b", c);
          roba(u, 1, "mentira");
          espera = d;
          if (!Object.keys(d.tapas).some(o => activo(o) && !d.abiertas[o])) cierraTapas(d);
        }
      }
      continue;
    }
    if (j.t === "tapa") {
      const h = String(j.h || "");
      if (!(e && e.k === "tapas" && e.faltan.includes(u)) || e.tapas[u] || !/^[0-9a-f]{64}$/.test(h)) continue;
      cartas[u]--;
      const n = ocultas[u]++;
      op(u, "h", h, n, "t");
      e.tapas[u] = { h, n };
      suceso({ e: "tapa", uid: u });
      if (e.faltan.every(o => e.tapas[o] || !activo(o))) espera = { ...e, k: "destapa" };
      continue;
    }
    if (j.t === "destapa") {
      if (!(e && e.k === "destapa" && e.de === u)) continue;
      const t = e.tapas[j.a];
      if (!t || e.abiertas[j.a] || !activo(j.a)) continue;
      espera = { k: "revela", uid: j.a, h: t.h, n: t.n, por: "tapa", d: e };
      suceso({ e: "destapa", uid: u, a: j.a });
      continue;
    }
    if (j.t === "basta") {
      if (!(e && e.k === "destapa" && e.de === u)) continue;
      cierraTapas(e);
      continue;
    }
  }

  /* Quién debe algo ahora mismo, y qué. Lo que las pantallas mandan
     solas (llaves, sobres, respuestas, revelaciones) no cuenta como
     «te toca». */
  let esp = null, debe = [];
  if (listos && ganador === null) {
    if (etapa === "arranque") esp = { k: "llaves", faltan: ids.filter(o => !fuera[o] && !arr[o]) };
    else if (etapa === "monedas") { esp = { k: "monedas", faltan: activos().filter(o => !monedas[o]) }; debe = esp.faltan; }
    else if (espera) {
      esp = espera;
      if (espera.k === "sobres") esp = { ...espera, faltan: espera.pares.filter(x => espera.hechos[x.de + ">" + x.a] === undefined) };
      if (espera.k === "tapas") esp = { ...espera, faltan: espera.faltan.filter(o => activo(o) && !espera.tapas[o]) };
      const k = esp.k;
      debe = k === "tras" || k === "hasta" || k === "reto" || k === "ruleta" ? [esp.uid]
        : k === "duda" ? [esp.sig] : k === "tapas" ? esp.faltan : k === "destapa" ? [esp.de] : [];
    } else { esp = { k: pena ? "pena" : "turno", uid: turno }; debe = [turno]; }
  }
  const fin = ganador !== null;
  return {
    fase: !listos ? "espera" : fin ? "fin" : "jugando",
    modo, nm, etapa, cartas, fuera, elim, monedas, mezcla, tope, dir, pena: fin ? null : pena,
    turno: fin ? "" : (espera ? "" : turno), espera: esp, debe: fin ? [] : debe,
    olvido: fin ? "" : olvido, ops, hist, falsas, ganador, motivo, semillas, jugadas
  };
}

/* ---------- repasar las manos ----------
   Lo que tiene cada uno sale de repetir `ops` con su semilla. Con un
   solo secreto (el propio) es lo que pinta la pantalla; con todos es la
   auditoría, y entonces `fallo(uid, que)` avisa de cada cosa que no
   cuadra. Una mano que no se puede saber (secreto sin revelar) es
   null y no se comprueba. */
export function repasaUno(est, secretos, fallo) {
  const modo = est.modo, mezcla = est.mezcla;
  const pk = {};
  for (const j of est.jugadores || []) pk[j.uid] = j.pk || "";
  const manos = {}, k = {}, ultima = {}, tapadas = {};
  for (const j of est.jugadores || []) { manos[j.uid] = secretos[j.uid] ? [] : null; k[j.uid] = 0; tapadas[j.uid] = {}; }
  const f = (u, que) => { if (fallo) fallo(u, que); };
  const quita = (m, c) => { const i = m.indexOf(c); if (i < 0) return false; m.splice(i, 1); return true; };
  const ilegibles = [];
  for (const o of est.ops || []) {
    const [u, t] = o;
    if (t === "X") {
      const [, , id, lista] = o;
      const antes = {};
      for (const [de] of lista) antes[de] = manos[de] ? manos[de].slice() : null;
      for (const [de, a, enc] of lista) {
        let dentro = null, visto = false;
        if (secretos[de]) {
          const m = abreSobreUno(dhCompartida(secretos[de].sem, secretos[de].sal, pk[a]), id, enc, modo);
          visto = true;
          if (!m || m.slice().sort().join() !== antes[de].slice().sort().join()) f(de, "sobre");
          dentro = antes[de].slice();
        }
        if (secretos[a] && !visto) {
          dentro = abreSobreUno(dhCompartida(secretos[a].sem, secretos[a].sal, pk[de]), id, enc, modo);
          if (!dentro) { ilegibles.push(de); dentro = null; }
        }
        if (manos[a] !== null || secretos[a]) manos[a] = dentro;
      }
      continue;
    }
    const s = secretos[u], m = manos[u];
    if (!s || !m) continue;
    if (t === "r") {
      const [, , n, por, ctx] = o;
      const nuevas = [];
      for (let i = 0; i < n; i++) nuevas.push(cartaUno(modo, s.sem, s.sal, mezcla, k[u]++));
      m.push(...nuevas);
      if (nuevas.length) ultima[u] = nuevas[nuevas.length - 1];
      if (fallo && por === "hasta") {
        const ok = c => jugableUno(c, { modo, tope: ctx });
        const lleno = m.length >= UNO_TOPE;
        if (nuevas.slice(0, -1).some(ok) || (!lleno && !ok(nuevas[nuevas.length - 1]))) f(u, "roba");
      }
      if (fallo && por === "ruleta") {
        const es = c => colorUno(c) === ctx;
        const lleno = m.length >= UNO_TOPE;
        if (nuevas.slice(0, -1).some(es) || (!lleno && !es(nuevas[nuevas.length - 1]))) f(u, "ruleta");
      }
    } else if (t === "j") {
      const [, , c, trasRobar] = o;
      if (trasRobar && c !== ultima[u]) f(u, "carta");
      if (!quita(m, c)) f(u, "carta");
    } else if (t === "h") {
      const [, , h, n, tipo] = o;
      const sal = salUno(s.sem, s.sal, n);
      const c = m.find(x => tapaUno(x, sal) === h);
      if (!c) f(u, "tapada");
      else { quita(m, c); tapadas[u][n] = c; if (tipo === "m" && !esMentiraUno(c)) f(u, "tapada"); }
    } else if (t === "ph") {
      if (fallo && m.length < UNO_TOPE && jugableUno(ultima[u], { modo, tope: o[2] })) f(u, "roba");
    } else if (t === "b") m.push(o[2]);
    else if (t === "dc") {
      const [, , col, n] = o;
      const antes = m.length;
      for (let i = m.length - 1; i >= 0; i--) if (colorUno(m[i]) === col) m.splice(i, 1);
      if (antes - m.length !== n) f(u, "descarte");
    } else if (t === "v" || t === "e") m.length = 0;
    else if (t === "w4") {
      const [, , legal, prev] = o;
      if (!!legal !== !m.some(c => colorUno(c) === prev)) f(u, "reto");
    } else if (t === "fa") {
      if (listaUno(o[2]).slice().sort().join() !== m.slice().sort().join()) f(u, "final");
    }
  }
  return { manos, ilegibles, tapadas };
}

/* La mano propia, para pintar, y las cartas que uno tiene boca abajo
   en la mesa (por su `n`), que son las que habrá que destapar. */
export function manoUno(est, uid, sec) {
  if (!sec || !est || !est.mezcla) return { mano: [], ilegibles: [], tapadas: {} };
  const r = repasaUno(est, { [uid]: sec }, null);
  return { mano: r.manos[uid] || [], ilegibles: r.ilegibles, tapadas: r.tapadas[uid] || {} };
}

/* Lo que la pantalla necesita para jugar su propia mano sin mirar la
   de nadie: cuántas cartas lleva robadas de su mazo (el `k` de la
   siguiente) y cuántas ha puesto boca abajo (el `n` de la sal de la
   siguiente). Salen de `ops`, igual que la mano. */
export function cuentaUno(est, uid) {
  let robadas = 0, ocultas = 0;
  for (const o of (est && est.ops) || []) {
    if (o[0] !== uid) continue;
    if (o[1] === "r") robadas += o[2];
    else if (o[1] === "h") ocultas++;
  }
  return { robadas, ocultas };
}

/* Robar hasta poder jugar (No Mercy), o hasta sacar el color de la
   ruleta: cuántas cartas son, calculado con el mazo propio. Para al
   llegar a 25 en la mano, que es quedar fuera. */
export function robaHastaUno(est, sec, uid, mano, vale) {
  const { robadas } = cuentaUno(est, uid);
  for (let i = 0; ; i++) {
    const c = cartaUno(est.modo, sec.sem, sec.sal, est.mezcla, robadas + i);
    if (vale(c) || mano.length + i + 1 >= UNO_TOPE) return i + 1;
  }
}

/* La auditoría de final de partida: con las semillas reveladas, la
   partida entera otra vez. Devuelve [{uid, que}], como la de Flip 7:
   `que` es "semilla" si no cuadra con lo prometido en la ficha, "oculta"
   si nunca se reveló (aviso suave: cerrar la pestaña no es hacer
   trampa), y el nombre de la comprobación que falló si no. */
export async function auditaUno(partida, estado) {
  const secretos = {}, fallos = [];
  const pon = (uid, que) => { if (!fallos.some(x => x.uid === uid && x.que === que)) fallos.push({ uid, que }); };
  for (const j of jugadasDe(partida)) {
    if (j.t !== "s" || secretos[j.uid]) continue;
    const f = (estado.jugadores || []).find(x => x.uid === j.uid);
    if (!f) continue;
    const sem = j.sem, sal = String(j.sal || "");
    const ok = await compromisoValido(sem, sal, f.hmazo)
      && sha256hex(arrUno(sem, sal)) === f.hcad && dhPublica(sem, sal) === f.pk;
    if (!ok) { pon(j.uid, "semilla"); continue; }
    secretos[j.uid] = { sem, sal };
  }
  if (estado.mezcla) repasaUno(estado, secretos, pon);
  for (const j of estado.jugadores || []) if (!secretos[j.uid] && !fallos.some(x => x.uid === j.uid)) pon(j.uid, "oculta");
  return fallos;
}

/* ============================================================
   Catan — colonos, comercio y un ladrón, sin nadie que tire los dados

   Las reglas son las de la caja: dos poblados y dos caminos por cabeza
   en serpiente, dados cada turno, producción de los hexágonos vecinos,
   el siete que obliga a descartar y trae al ladrón, comercio con la
   banca (4:1, 3:1 o 2:1 con puerto) y entre jugadores, cartas de
   desarrollo, ruta más larga y mayor ejército. Encima, lo que quien
   abre la sala elige:

   - **Ampliación 5–6** (sola, según cuántos se sienten): isla de 30
     hexágonos, más fichas y puertos, mazo de 34 cartas y la **fase
     especial de construcción** — al acabar cada turno, los demás, en
     orden, pueden construir o comprar sin comerciar. El reductor salta
     solo a quien no puede pagar nada, que es casi siempre casi todos:
     así la fase no convierte cada turno en seis esperas.
   - **Navegantes**: la isla principal más islotes separados por mar,
     barcos (madera + lana) que llevan la ruta por el agua, un barco
     abierto que se puede mover una vez por turno, el pirata que bloquea
     y roba a los barcos, ríos de oro que dan el recurso que uno elija y
     +2 puntos por el primer poblado en cada isla nueva. Se juega a 12.
   - **Baraja de eventos** (de Mercaderes y Bárbaros): los dados salen
     de un mazo de 36 cartas con la distribución exacta de dos dados,
     que se rebaraja cuando quedan cinco. Menos rachas, la misma media.
   - **Ladrón amistoso**: ni el ladrón ni el pirata pueden ir a donde
     perjudiquen a quien tiene dos puntos o menos.
   - **Maestro del puerto**: +2 puntos a quien sume más puntos de
     puerto (poblado en puerto 1, ciudad 2; al menos 3). Meta +1.
   - **Partida** corta o larga: la meta baja o sube dos puntos.

   Lo difícil vuelve a ser el azar sin servidor, y aquí hay de tres
   clases:

   1. **Los dados y los robos.** Cada jugador tiene una cadena de
      hashes como la del cacho (`cadenaCatan`, punta `hcad` en la
      ficha) y cada vez que hace falta azar se juntan **dos** llaves
      de dos personas distintas: la de quien tira (va dentro de la
      jugada `tira`, o de la del ladrón) y la del primero que conteste
      de los demás — el siguiente en la mesa si es una tirada, la
      víctima si es un robo. Ninguno de los dos conoce la llave del
      otro antes de publicar la suya, así que ninguno escoge el
      resultado. La llave k-ésima de cada uno es la k-ésima de su
      cadena, siempre la siguiente: `aceptaLlave` exige que su hash
      sea la anterior, así que nadie puede elegir entre varias.
      El precio, dicho como en Flip 7: quien ayuda ya ha visto la
      llave de quien tira cuando manda la suya, así que sabe qué va a
      salir y podría callarse; entonces responde otro (suplente, tras
      unos segundos) y sale otra cosa. Puede provocar una segunda
      tirada, no elegirla, y con dos en la mesa no hay suplente: la
      votación es el remedio, como con cualquier pestaña dormida.
   2. **Las cartas de desarrollo.** Cada uno roba de su propio mazo,
      como en el UNO: la carta k que compra `u` sale de su semilla
      privada y de la `mezcla` del arranque (`cartaCatan`), así que
      nadie más sabe qué tiene. Es un muestreo con reposición de las
      proporciones de la caja: lo que se pierde es que el mazo se
      agote. Al acabar se revelan las semillas y `auditaCatan`
      comprueba que cada carta jugada fuera la que tocaba.
   3. **El tablero** sale de la `semilla` pública de la sala, igual en
      todas las pantallas: no hay nada que ocultar en él. Quién empieza
      sale de la mezcla del arranque, en el que todos revelan su
      primera llave.

   Lo que no se esconde, y se dice: las manos de recursos están en el
   registro. La pantalla solo enseña cuántas cartas tiene cada rival,
   pero quien abra la consola puede contarlas — en la mesa de verdad
   también se pueden contar, solo que con más esfuerzo. La banca no se
   agota.
   ============================================================ */

export const CT_CADENA = 800;
export const CT_RECURSOS = ["madera", "arcilla", "lana", "trigo", "mineral"];
export const CT_PRODUCE = { bosque: "madera", colinas: "arcilla", pasto: "lana", campo: "trigo", montana: "mineral" };
export const CT_COSTE = {
  camino: { madera: 1, arcilla: 1 },
  barco: { madera: 1, lana: 1 },
  poblado: { madera: 1, arcilla: 1, lana: 1, trigo: 1 },
  ciudad: { trigo: 2, mineral: 3 },
  desarrollo: { lana: 1, trigo: 1, mineral: 1 }
};
export const CT_TOPE = { camino: 15, barco: 15, poblado: 5, ciudad: 4 };
export const CT_CARTAS = {
  caballero: "Caballero", punto: "Punto de victoria", carreteras: "Construcción de carreteras",
  abundancia: "Año de la abundancia", monopolio: "Monopolio"
};
export const CT_EXPANSIONES = { base: "Base", mar: "Navegantes" };
export const CT_LIMITE_MANO = 7;
export const CT_RESTO_BARAJA = 5;

const ctRepite = (o) => Object.entries(o).flatMap(([k, n]) => Array(n).fill(k));
const CT_MAZO = ctRepite({ caballero: 14, punto: 5, carreteras: 2, abundancia: 2, monopolio: 2 });
const CT_MAZO_GRANDE = ctRepite({ caballero: 20, punto: 5, carreteras: 3, abundancia: 3, monopolio: 3 });
/* Las 36 combinaciones de dos dados, una carta por combinación. */
export const CT_BARAJA = (() => {
  const b = [];
  for (let s = 2; s <= 12; s++) for (let k = 0; k < 6 - Math.abs(7 - s); k++) b.push(s);
  return b;
})();

/* Lo que eligió quien abrió la sala. Los campos llegan como números
   del `<select>`; lo que no se entiende vale lo de siempre. */
export function opcionesCatan(p) {
  const si = k => Number(p && p[k]) === 1;
  const largo = Number(p && p.largo);
  return {
    mar: !!p && p.exp === "mar",
    baraja: si("baraja"), amable: si("amable"), puerto: si("puerto"),
    largo: largo === -2 || largo === 2 ? largo : 0
  };
}
export const metaCatan = o => (o.mar ? 12 : 10) + (o.puerto ? 1 : 0) + (o.largo || 0);

/* ---------- El tablero ----------
   Hexágonos con la punta arriba, en coordenadas enteras: el centro de
   la fila f, columna c, está en x = 2c + (f impar), y = 3f, y sus
   esquinas en (x, y−2), (x+1, y−1), (x+1, y+1), (x, y+2)… Con enteros
   dos hexágonos vecinos encuentran la esquina compartida por su clave
   exacta, sin comparar decimales — y sin senos ni cosenos, que cada
   navegador redondea a su manera y aquí los dos tableros tienen que
   ser idénticos hasta el último vértice.

   Los planos: «L» tierra de la isla principal, un dígito tierra de un
   islote, «.» nada (el mar se añade alrededor). Las filas impares van
   desplazadas medio hexágono a la derecha. */
const CT_ESQ = [[0, -2], [1, -1], [1, 1], [0, 2], [-1, 1], [-1, -1]];
const CT_VECINOS = [[2, 0], [1, 1], [-1, 1], [-2, 0], [-1, -1], [1, -1]];
const CT_PLANOS = {
  base: [".LLL.", "LLLL", "LLLLL", "LLLL", ".LLL."],
  baseGrande: ["..LLL", ".LLLL", ".LLLLL", "LLLLLL", ".LLLLL", ".LLLL", "..LLL"],
  mar: [".LLL..11", "LLLL..1.44", "LLLLL", "LLLL...22", ".LLL....2", ".....33", "......3"],
  marGrande: ["..LLL..11.4", ".LLLL..1..4", ".LLLLL...2", "LLLLLL..22", ".LLLLL", ".LLLL..3..5", "..LLL..33.55"]
};
const CT_REPARTO = {
  base: {
    tierra: { bosque: 4, colinas: 3, pasto: 4, campo: 4, montana: 3, desierto: 1 },
    fichas: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
    puertos: ["3", "3", "3", "3", "madera", "arcilla", "lana", "trigo", "mineral"]
  },
  grande: {
    tierra: { bosque: 6, colinas: 5, pasto: 6, campo: 6, montana: 5, desierto: 2 },
    fichas: [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12],
    puertos: ["3", "3", "3", "3", "3", "madera", "arcilla", "lana", "lana", "trigo", "mineral"]
  },
  islas: {
    tierra: { oro: 2, bosque: 1, colinas: 2, pasto: 2, campo: 2, montana: 2 },
    fichas: [3, 4, 4, 5, 6, 8, 9, 10, 10, 11, 12]
  },
  islasGrande: {
    tierra: { oro: 3, bosque: 2, colinas: 2, pasto: 2, campo: 2, montana: 3 },
    fichas: [2, 3, 3, 4, 5, 5, 6, 8, 9, 9, 10, 11, 11, 12]
  }
};

const ctTableros = new Map();
export function tableroCatan(semilla, grande, mar) {
  const clave = (semilla >>> 0) + ":" + (grande ? "g" : "n") + (mar ? "m" : "t");
  const ya = ctTableros.get(clave);
  if (ya) return ya;
  const plano = CT_PLANOS[(mar ? "mar" : "base") + (grande ? "Grande" : "")];
  const celdas = [], ocupa = new Set();
  const pon = (x, f, isla) => {
    const k = x + "," + f;
    if (ocupa.has(k)) return;
    ocupa.add(k);
    celdas.push({ x, f, isla });
  };
  plano.forEach((fila, f) => {
    for (let c = 0; c < fila.length; c++)
      if (fila[c] !== ".") pon(2 * c + (f & 1), f, fila[c] === "L" ? 0 : Number(fila[c]));
  });
  const tierra = celdas.slice();
  if (mar) {
    /* Con islas el mar es el rectángulo entero: los canales entre la
       isla y los islotes tienen que existir para poder navegarlos. */
    const xs = tierra.map(c => c.x), fs = tierra.map(c => c.f);
    const x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 2, f0 = Math.min(...fs) - 1, f1 = Math.max(...fs) + 1;
    for (let f = f0; f <= f1; f++)
      for (let x = x0; x <= x1; x++) if ((((x - f) % 2) + 2) % 2 === 0) pon(x, f, -1);
  } else {
    for (const c of tierra) for (const [dx, df] of CT_VECINOS) pon(c.x + dx, c.f + df, -1);
  }
  celdas.sort((a, b) => a.f - b.f || a.x - b.x);

  const H = celdas.map((c, i) => ({ i, x: c.x, f: c.f, isla: c.isla, t: c.isla < 0 ? "mar" : "", n: 0, v: [], e: [] }));
  const V = [], E = [], vx = new Map(), ex = new Map();
  for (const h of H) {
    const cy = 3 * h.f;
    h.v = CT_ESQ.map(([dx, dy]) => {
      const k = (h.x + dx) + "," + (cy + dy);
      let id = vx.get(k);
      if (id == null) {
        id = V.length; vx.set(k, id);
        V.push({ i: id, x: h.x + dx, y: cy + dy, h: [], e: [], adj: [], tierra: false, puerto: "", isla: -1 });
      }
      V[id].h.push(h.i);
      return id;
    });
    for (let k = 0; k < 6; k++) {
      const a = Math.min(h.v[k], h.v[(k + 1) % 6]), b = Math.max(h.v[k], h.v[(k + 1) % 6]);
      const kk = a + "-" + b;
      let id = ex.get(kk);
      if (id == null) {
        id = E.length; ex.set(kk, id);
        E.push({ i: id, a, b, h: [], tierra: false, mar: false });
        V[a].e.push(id); V[b].e.push(id); V[a].adj.push(b); V[b].adj.push(a);
      }
      E[id].h.push(h.i);
      h.e.push(id);
    }
  }
  const vecinos = h => h.e.map(e => E[e].h.find(o => o !== h.i)).filter(o => o != null);

  /* Terrenos y fichas, barajados hasta que ningún 6 toque a un 8 ni a
     otro 6: dos números rojos juntos hacen una casilla que decide la
     partida antes de empezar. */
  const r = rng(((semilla >>> 0) ^ 0x5bd1e995) >>> 0);
  const regiones = [{ hs: H.filter(h => h.isla === 0), rep: CT_REPARTO[grande ? "grande" : "base"] }];
  if (mar) regiones.push({ hs: H.filter(h => h.isla > 0), rep: CT_REPARTO[grande ? "islasGrande" : "islas"] });
  const roja = n => n === 6 || n === 8;
  for (let intento = 0; intento < 600; intento++) {
    for (const { hs, rep } of regiones) {
      const ts = mezcla(ctRepite(rep.tierra), r), fs = mezcla(rep.fichas, r);
      let j = 0;
      hs.forEach((h, k) => { h.t = ts[k]; h.n = h.t === "desierto" ? 0 : fs[j++]; });
    }
    if (!H.some(h => roja(h.n) && vecinos(h).some(o => roja(H[o].n)))) break;
  }

  for (const v of V) {
    const t = v.h.filter(i => H[i].isla >= 0);
    v.tierra = t.length > 0;
    v.isla = t.length ? H[t[0]].isla : -1;
  }
  for (const e of E) {
    e.tierra = e.h.some(i => H[i].isla >= 0);
    e.mar = e.h.length === 2 && e.h.some(i => H[i].isla < 0);
  }

  /* Los puertos, repartidos a lo largo de la costa de la isla principal.
     La costa se recorre arista a arista (cada esquina de la costa toca
     exactamente dos) en vez de ordenarla por ángulo: `atan2` no está
     obligado a redondear igual en dos navegadores. */
  const costa = E.filter(e => e.h.length === 2 && e.h.some(i => H[i].isla === 0) && e.h.some(i => H[i].isla < 0));
  const porV = new Map();
  for (const e of costa) for (const w of [e.a, e.b]) { if (!porV.has(w)) porV.set(w, []); porV.get(w).push(e.i); }
  const peso = e => [V[e.a].y + V[e.b].y, V[e.a].x + V[e.b].x];
  let ini = costa[0];
  for (const e of costa) {
    const a = peso(e), b = peso(ini);
    if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) ini = e;
  }
  const orden = [], visto = new Set();
  let cur = ini ? ini.i : null, w = ini ? ini.a : -1;
  while (cur != null && !visto.has(cur)) {
    orden.push(cur); visto.add(cur);
    const e = E[cur], sig = e.a === w ? e.b : e.a;
    w = sig;
    const prox = (porV.get(sig) || []).find(x => !visto.has(x));
    cur = prox == null ? null : prox;
  }
  const tipos = mezcla(CT_REPARTO[grande ? "grande" : "base"].puertos, r);
  const L = orden.length, off = Math.floor(r() * L), paso = L / tipos.length;
  const puertos = tipos.map((tipo, k) => {
    const e = E[orden[(off + Math.round(k * paso)) % L]];
    V[e.a].puerto = V[e.b].puerto = tipo;
    return { e: e.i, tipo, h: e.h.find(i => H[i].isla < 0) };
  });

  const desierto = H.find(h => h.t === "desierto");
  let pirata = -1;
  if (mar) {
    /* El pirata empieza en alta mar, lo más cerca posible del centro. */
    const ts = H.filter(h => h.isla >= 0);
    const cx = ts.reduce((s, h) => s + h.x, 0) / ts.length, cy = ts.reduce((s, h) => s + 3 * h.f, 0) / ts.length;
    let mejor = Infinity;
    for (const h of H) {
      if (h.isla >= 0 || h.e.length !== 6 || vecinos(h).some(o => H[o].isla >= 0)) continue;
      const d = 3 * (h.x - cx) * (h.x - cx) + (3 * h.f - cy) * (3 * h.f - cy);
      if (d < mejor) { mejor = d; pirata = h.i; }
    }
  }
  const T = {
    H, V, E, puertos, pirata, grande: !!grande, mar: !!mar,
    ladron: desierto ? desierto.i : H.find(h => h.isla >= 0).i,
    islas: Math.max(0, ...H.map(h => h.isla))
  };
  if (ctTableros.size > 30) ctTableros.clear();
  ctTableros.set(clave, T);
  return T;
}

/* ---------- Manos ---------- */
const ctVacia = () => ({ madera: 0, arcilla: 0, lana: 0, trigo: 0, mineral: 0 });
export const cartasEnMano = m => CT_RECURSOS.reduce((s, r) => s + ((m && m[r]) | 0), 0);
export const alcanzaCatan = (m, c) => CT_RECURSOS.every(r => ((m && m[r]) | 0) >= ((c && c[r]) | 0));
const ctSuma = (m, c, s) => { for (const r of CT_RECURSOS) m[r] += s * ((c && c[r]) | 0); };
/* Un puñado de recursos que llega en una jugada: solo los cinco
   nombres, enteros y sin negativos; cualquier otra cosa lo invalida. */
function ctRecursos(o) {
  if (o != null && typeof o !== "object") return null;
  const r = ctVacia();
  for (const k in o || {}) {
    const n = Number(o[k]);
    if (!CT_RECURSOS.includes(k) || !Number.isInteger(n) || n < 0 || n > 99) return null;
    r[k] = n;
  }
  return r;
}
const ctNat = x => { const n = Number(x); return x !== "" && x != null && Number.isInteger(n) && n >= 0 ? n : -1; };

/* ---------- Dónde se puede construir ----------
   Todas reciben el estado reducido (o el que el reductor va armando,
   que tiene la misma forma), así la pantalla ilumina exactamente las
   casillas que el reductor va a aceptar. */
const ctLibre = (S, v) => !S.edif[v] && S.T.V[v].adj.every(w => !S.edif[w]);
export function puedePobladoCatan(S, u, v, inicial) {
  const V = S.T.V[v];
  if (!V || !V.tierra || !ctLibre(S, v)) return false;
  /* Con Navegantes se empieza en la isla principal: los islotes son
     para llegar a ellos. */
  /* Al colocar, además, tiene que caberle un camino (o un barco) al lado:
     si no, la colocación se quedaría esperando algo imposible. */
  if (inicial) return (!S.T.mar || V.h.some(i => S.T.H[i].isla === 0))
    && V.e.some(e => puedeCaminoCatan(S, u, e, v) || puedeBarcoCatan(S, u, e, v));
  return V.e.some(e => S.cam[e] === u || S.bar[e] === u);
}
/* Un camino enlaza con un camino propio, y un barco con un barco
   propio, por una esquina que no tenga un edificio ajeno; camino y
   barco solo se enlazan a través de un poblado o ciudad propios. */
function ctConecta(S, u, e, red, sin) {
  const E = S.T.E[e];
  for (const w of [E.a, E.b]) {
    const b = S.edif[w];
    if (b && b.u === u) return true;
    if (b) continue;
    if (S.T.V[w].e.some(x => x !== e && x !== sin && red[x] === u)) return true;
  }
  return false;
}
export function puedeCaminoCatan(S, u, e, desde) {
  const E = S.T.E[e];
  if (!E || !E.tierra || S.cam[e] != null || S.bar[e] != null) return false;
  if (desde != null && desde >= 0) return E.a === desde || E.b === desde;
  return ctConecta(S, u, e, S.cam, -1);
}
export function puedeBarcoCatan(S, u, e, desde, sin = -1) {
  const E = S.T.E[e];
  if (!S.T.mar || !E || !E.mar || e === sin || S.cam[e] != null || S.bar[e] != null || E.h.includes(S.pirata)) return false;
  if (desde != null && desde >= 0) return E.a === desde || E.b === desde;
  return ctConecta(S, u, e, S.bar, sin);
}
export function piezasCatan(S, u) {
  const n = { camino: 0, barco: 0, poblado: 0, ciudad: 0 };
  for (const k in S.cam) if (S.cam[k] === u) n.camino++;
  for (const k in S.bar) if (S.bar[k] === u) n.barco++;
  for (const k in S.edif) if (S.edif[k].u === u) n[S.edif[k].c === 2 ? "ciudad" : "poblado"]++;
  return n;
}
/* Las esquinas que toca la red de `u` (caminos, barcos y edificios):
   fuera de ellas no puede construir nada, así que no hace falta mirar
   el resto del mapa — que con Navegantes y seis jugadores son 180
   aristas por cada pregunta, y la fase especial pregunta mucho. */
function ctAlcance(S, u) {
  const vs = new Set(), T = S.T;
  for (const k in S.cam) if (S.cam[k] === u) { vs.add(T.E[k].a); vs.add(T.E[k].b); }
  for (const k in S.bar) if (S.bar[k] === u) { vs.add(T.E[k].a); vs.add(T.E[k].b); }
  for (const k in S.edif) if (S.edif[k].u === u) vs.add(+k);
  return vs;
}
function ctCandidatas(S, u, que, o) {
  const T = S.T;
  if (o.inicial) return T.V.map(v => v.i);
  if (o.desde != null && o.desde >= 0) return T.V[o.desde] ? T.V[o.desde].e : [];
  const vs = ctAlcance(S, u);
  if (que === "poblado") return [...vs];
  const es = new Set();
  for (const v of vs) for (const e of T.V[v].e) es.add(e);
  return [...es].sort((a, b) => a - b);
}
/* Sin piezas en la caja no hay sitio que valga: los topes van aquí
   para que la pantalla no ilumine casillas que el reductor rechazará. */
export function sitiosCatan(S, u, que, o = {}) {
  const out = [];
  if (CT_TOPE[que] && !o.inicial && o.desde == null && o.sin == null && (o.n || piezasCatan(S, u))[que] >= CT_TOPE[que]) return out;
  if (que === "ciudad") { for (const k in S.edif) if (S.edif[k].u === u && S.edif[k].c === 1) out.push(+k); return out; }
  const cs = ctCandidatas(S, u, que, o);
  if (que === "poblado") { for (const v of cs) if (puedePobladoCatan(S, u, v, o.inicial)) out.push(v); }
  else if (que === "camino") { for (const e of cs) if (puedeCaminoCatan(S, u, e, o.desde)) out.push(e); }
  else if (que === "barco") { for (const e of cs) if (puedeBarcoCatan(S, u, e, o.desde, o.sin)) out.push(e); }
  return out.sort((a, b) => a - b);
}

/* Un barco se puede mover si es el extremo abierto de su línea: en una
   de sus puntas no hay ni edificio propio ni otro barco propio. No uno
   botado este turno, no uno junto al pirata y solo uno por turno. */
export function barcosMoviblesCatan(S, u) {
  const T = S.T, out = [];
  if (!T.mar || S.movioBarco) return out;
  for (const k in S.bar) {
    const e = +k;
    if (S.bar[k] !== u || (S.nuevos || []).includes(e) || T.E[e].h.includes(S.pirata)) continue;
    const E = T.E[e];
    if ([E.a, E.b].some(w => !(S.edif[w] && S.edif[w].u === u) && !T.V[w].e.some(x => x !== e && S.bar[x] === u))) out.push(e);
  }
  return out;
}

/* Los puntos que se ven. Las cartas de punto solo cuentan reveladas. */
export function vpCatan(S, u) {
  let v = 0;
  for (const k in S.edif) if (S.edif[k].u === u) v += S.edif[k].c;
  if (S.largoDe === u) v += 2;
  if (S.ejercito === u) v += 2;
  if (S.puertoDe === u) v += 2;
  v += 2 * Object.keys((S.islas || {})[u] || {}).length;
  v += (((S.des || {})[u] || {}).puntos || []).length;
  return v;
}

/* El ladrón amistoso no pisa a quien tiene dos puntos o menos. Si eso
   dejara sin sitio al ladrón, puede ir a cualquier parte. */
const ctProtegido = (S, w) => S.O.amable && !S.fuera[w] && vpCatan(S, w) <= 2;
export function hexesLadronCatan(S, u) {
  const T = S.T, todos = [];
  for (const h of T.H) {
    if (h.isla >= 0) {
      if (h.i === S.ladron) continue;
      todos.push([h.i, h.v.some(v => S.edif[v] && S.edif[v].u !== u && ctProtegido(S, S.edif[v].u))]);
    } else if (T.mar && h.i !== S.pirata && h.e.some(e => T.E[e].mar)) {
      todos.push([h.i, h.e.some(e => S.bar[e] != null && S.bar[e] !== u && ctProtegido(S, S.bar[e]))]);
    }
  }
  const libres = todos.filter(x => !x[1]).map(x => x[0]);
  return libres.length ? libres : todos.map(x => x[0]);
}
export function victimasCatan(S, u, h) {
  const H = S.T.H[h];
  if (!H) return [];
  const vs = new Set();
  if (H.isla >= 0) { for (const v of H.v) if (S.edif[v]) vs.add(S.edif[v].u); }
  else for (const e of H.e) if (S.bar[e] != null) vs.add(S.bar[e]);
  return [...vs].filter(w => w !== u && !S.fuera[w] && cartasEnMano(S.mano[w]) > 0 && !ctProtegido(S, w)).sort();
}

/* Cuánto pide la banca por cada recurso: 4, o 3 con un puerto
   genérico, o 2 con el puerto de ese recurso. */
export function ratiosCatan(S, u) {
  const r = {};
  for (const k of CT_RECURSOS) r[k] = 4;
  for (const k in S.edif) {
    if (S.edif[k].u !== u) continue;
    const p = S.T.V[k].puerto;
    if (p === "3") for (const x of CT_RECURSOS) r[x] = Math.min(r[x], 3);
    else if (p) r[p] = 2;
  }
  return r;
}

/* La ruta comercial más larga: caminos y barcos seguidos, sin pasar por
   un edificio ajeno, y cambiando de camino a barco solo en un edificio
   propio. Búsqueda en profundidad desde cada tramo: con quince caminos
   y quince barcos como mucho, sale en nada. */
export function rutaCatan(S, u) {
  const T = S.T, tipo = new Map();
  for (const e in S.cam) if (S.cam[e] === u) tipo.set(+e, "c");
  for (const e in S.bar) if (S.bar[e] === u) tipo.set(+e, "b");
  if (!tipo.size) return 0;
  const usados = new Set();
  const dfs = (w, t) => {
    const b = S.edif[w];
    if (b && b.u !== u) return 0;
    let m = 0;
    for (const e of T.V[w].e) {
      if (usados.has(e) || !tipo.has(e)) continue;
      const te = tipo.get(e);
      if (te !== t && !(b && b.u === u)) continue;
      usados.add(e);
      const E = T.E[e];
      m = Math.max(m, 1 + dfs(E.a === w ? E.b : E.a, te));
      usados.delete(e);
    }
    return m;
  };
  let mejor = 0;
  for (const [e, t] of tipo) {
    const E = T.E[e];
    for (const o of [E.a, E.b]) { usados.add(e); mejor = Math.max(mejor, 1 + dfs(o, t)); usados.delete(e); }
  }
  return mejor;
}

/* ¿Tiene `u` algo que construir o comprar ahora mismo? Es lo que decide
   si la fase especial se detiene en él o lo salta. */
export function puedeAlgoCatan(S, u) {
  const m = S.mano[u], n = piezasCatan(S, u), T = S.T;
  if (alcanzaCatan(m, CT_COSTE.desarrollo)) return true;
  if (alcanzaCatan(m, CT_COSTE.ciudad) && n.ciudad < CT_TOPE.ciudad && n.poblado > 0) return true;
  if (alcanzaCatan(m, CT_COSTE.poblado) && n.poblado < CT_TOPE.poblado && sitiosCatan(S, u, "poblado", { n }).length) return true;
  if (alcanzaCatan(m, CT_COSTE.camino) && n.camino < CT_TOPE.camino && sitiosCatan(S, u, "camino", { n }).length) return true;
  if (T.mar && alcanzaCatan(m, CT_COSTE.barco) && n.barco < CT_TOPE.barco && sitiosCatan(S, u, "barco", { n }).length) return true;
  return false;
}

/* ---------- Las llaves y las cartas ---------- */
const ctCadenas = new Map();
export function cadenaCatan(sem, sal) {
  const k = (sem >>> 0) + ":" + (sal || "");
  if (ctCadenas.has(k)) return ctCadenas.get(k);
  const e = [sha256hex("catan:" + k)];
  for (let i = 0; i < CT_CADENA; i++) e.push(sha256hex(e[i]));
  ctCadenas.set(k, e);
  return e;
}
/* La llave número `n` que aporta un jugador (la 0 es la del arranque). */
export const llaveCatan = (cad, n) => cad[CT_CADENA - 1 - n];
/* La carta de desarrollo número `k` que compra quien tiene esa semilla. */
export function cartaCatan(sem, sal, mezclaCt, k, grande) {
  const m = grande ? CT_MAZO_GRANDE : CT_MAZO;
  const h = sha256hex("catan-des:" + (sem >>> 0) + ":" + (sal || "") + ":" + (mezclaCt || "") + ":" + k);
  return m[parseInt(h.slice(0, 8), 16) % m.length];
}

function redCatan(p, js, listos) {
  const O = opcionesCatan(p);
  const ids = js.map(j => j.uid), N = ids.length;
  const ficha = {};
  for (const j of js) ficha[j.uid] = j;
  const T = tableroCatan(Number(p.semilla) || 1, N >= 5, O.mar);
  const meta = metaCatan(O);
  const S = {
    T, O, meta, edif: {}, cam: {}, bar: {}, mano: {}, des: {}, caballeros: {}, islas: {}, fuera: {},
    ladron: T.ladron, pirata: T.pirata, largoDe: "", ejercito: "", puertoDe: "", rutas: {},
    movioBarco: false, nuevos: []
  };
  for (const u of ids) {
    S.mano[u] = ctVacia();
    S.des[u] = { n: 0, t: [], usadas: {}, puntos: [] };
    S.caballeros[u] = 0; S.islas[u] = {}; S.rutas[u] = 0;
  }
  let etapa = "arranque", turno = "", turnoN = 0, sub = "", ultPob = -1, primero = "";
  let seq = [], si = 0, azar = null, tras = "", oferta = null, propuestas = {}, esp = null;
  let descartar = {}, oroP = {}, gratis = 0, jugoDes = false, ultima = null;
  let ganador = null, motivo = "", ni = 0, tope = false, mezclaCt = "";
  let restantes = O.baraja ? CT_BARAJA.slice() : null;
  const llaves0 = {}, ult = {}, aportes = {}, usadasK = {}, semillas = {};
  const hist = [], falsas = [];
  for (const u of ids) { ult[u] = String(ficha[u].hcad || ""); aportes[u] = 0; usadasK[u] = new Set(); }

  const suceso = e => { e.i = ni++; hist.push(e); if (hist.length > 60) hist.shift(); };
  const activos = () => ids.filter(u => !S.fuera[u]);
  const sigActivo = u => {
    const i = ids.indexOf(u);
    for (let k = 1; k <= N; k++) { const c = ids[(i + k) % N]; if (!S.fuera[c]) return c; }
    return "";
  };

  /* Una llave vale si su hash es la última que aportó ese jugador (al
     principio, la punta de su ficha): la siguiente de su cadena y
     ninguna otra. Repetir una que ya entró es una carrera de la red y
     se ignora; una que no encaja es mentira y se dice. */
  const aceptaLlave = (u, c) => {
    c = String(c || "");
    if (!/^[0-9a-f]{64}$/.test(c) || !ult[u]) return false;
    if (usadasK[u].has(c)) return null;
    if (sha256hex(c) !== ult[u]) {
      if (!falsas.includes(u)) { falsas.push(u); suceso({ e: "falsa", uid: u }); }
      return false;
    }
    usadasK[u].add(c); ult[u] = c; aportes[u]++;
    if (aportes[u] >= CT_CADENA - 1) tope = true;
    return true;
  };

  /* Solo se recalcula la ruta de quien puede haber cambiado: el que
     construye, y — si es un poblado — los dueños de lo que pasa por
     esa esquina, que pueden haber quedado cortados. */
  const actualizaRutas = (quien = ids) => {
    for (const u of quien) S.rutas[u] = S.fuera[u] ? 0 : rutaCatan(S, u);
    const h = S.largoDe, max = Math.max(0, ...ids.map(u => S.rutas[u]));
    let nuevo = h;
    /* Quien la tiene la conserva en un empate; si la pierde y hay empate
       entre los demás, no la tiene nadie. */
    if (!(h && S.rutas[h] >= 5 && S.rutas[h] === max)) {
      const top = ids.filter(u => S.rutas[u] === max);
      nuevo = max >= 5 && top.length === 1 ? top[0] : "";
    }
    if (nuevo !== h) { S.largoDe = nuevo; suceso({ e: "largo", uid: nuevo, de: h, n: max }); }
  };
  const actualizaEjercito = u => {
    const h = S.ejercito;
    if (S.caballeros[u] >= 3 && u !== h && (!h || S.caballeros[u] > S.caballeros[h])) {
      S.ejercito = u; suceso({ e: "ejercito", uid: u, de: h, n: S.caballeros[u] });
    }
  };
  const puntosPuerto = w => {
    let n = 0;
    for (const k in S.edif) if (S.edif[k].u === w && T.V[k].puerto) n += S.edif[k].c;
    return n;
  };
  const actualizaPuerto = u => {
    if (!O.puerto) return;
    const h = S.puertoDe, n = puntosPuerto(u);
    if (n >= 3 && u !== h && (!h || n > puntosPuerto(h))) { S.puertoDe = u; suceso({ e: "puerto", uid: u, de: h }); }
  };

  /* Se gana en el propio turno, en cuanto se llega a la meta. */
  const compruebaFin = () => {
    if (ganador !== null || !turno || S.fuera[turno] || !["tirar", "accion", "ladron"].includes(etapa)) return;
    if (vpCatan(S, turno) >= meta) { ganador = turno; motivo = "catan"; suceso({ e: "gana", uid: turno, n: vpCatan(S, turno) }); }
  };
  const acabaTope = () => {
    const vs = activos(), pts = vs.map(u => vpCatan(S, u)), max = Math.max(...pts);
    const top = vs.filter((u, k) => pts[k] === max);
    ganador = top.length === 1 ? top[0] : ""; motivo = "agotado";
  };

  const empiezaTurno = u => {
    turno = u; turnoN++; etapa = "tirar"; tras = ""; azar = null; oferta = null; propuestas = {}; esp = null;
    descartar = {}; oroP = {}; gratis = 0; jugoDes = false; S.movioBarco = false; S.nuevos = [];
    suceso({ e: "turno", uid: u, n: turnoN });
    compruebaFin();
  };

  const avanzaColocacion = () => {
    while (si < seq.length && S.fuera[seq[si]]) si++;
    if (si >= seq.length) { sub = ""; ultPob = -1; empiezaTurno(S.fuera[primero] ? sigActivo(primero) : primero); return; }
    turno = seq[si]; sub = "poblado"; ultPob = -1;
  };

  /* Todos revelaron la primera llave: de la mezcla sale quién empieza
     y, con la semilla de cada uno, sus cartas de desarrollo. */
  const arranca = () => {
    const vs = activos();
    if (!vs.length) return;
    mezclaCt = vs.map(x => x + ":" + llaves0[x]).join("|");
    primero = vs[parseInt(sha256hex("catan-primero|" + mezclaCt).slice(0, 8), 16) % vs.length];
    const i0 = ids.indexOf(primero), orden = [];
    for (let k = 0; k < N; k++) { const x = ids[(i0 + k) % N]; if (!S.fuera[x]) orden.push(x); }
    seq = orden.concat(orden.slice().reverse()); si = 0;
    etapa = "colocacion";
    suceso({ e: "orden", uid: primero });
    avanzaColocacion();
  };

  const vuelve = () => { etapa = tras || "accion"; tras = ""; compruebaFin(); };

  const tirada = (u, d1, d2) => {
    const s = d1 + d2, prod = {}, oro = {}, hx = [];
    if (s !== 7) {
      for (const h of T.H) {
        if (h.n !== s || h.isla < 0 || h.i === S.ladron) continue;
        let alguno = false;
        for (const v of h.v) {
          const b = S.edif[v];
          if (!b || S.fuera[b.u]) continue;
          alguno = true;
          if (h.t === "oro") { oro[b.u] = (oro[b.u] || 0) + b.c; continue; }
          const r = CT_PRODUCE[h.t];
          if (!r) continue;
          const q = prod[b.u] || (prod[b.u] = {});
          q[r] = (q[r] || 0) + b.c;
          S.mano[b.u][r] += b.c;
        }
        if (alguno) hx.push(h.i);
      }
    }
    ultima = { uid: u, d1, d2, s, n: turnoN };
    suceso({ e: "tirada", uid: u, d1, d2, s, prod, oro, hx });
    if (s === 7) {
      descartar = {};
      for (const v of activos()) { const k = cartasEnMano(S.mano[v]); if (k > CT_LIMITE_MANO) descartar[v] = Math.floor(k / 2); }
      tras = "accion";
      etapa = Object.keys(descartar).length ? "descarte" : "ladron";
    } else if (Object.keys(oro).length) { oroP = oro; etapa = "oro"; }
    else etapa = "accion";
  };

  const roba = (u, v, n) => {
    const lista = [];
    for (const r of CT_RECURSOS) for (let k = 0; k < S.mano[v][r]; k++) lista.push(r);
    if (!lista.length) { suceso({ e: "roba", uid: u, v, r: "" }); return; }
    const r = lista[n % lista.length];
    S.mano[v][r]--; S.mano[u][r]++;
    suceso({ e: "roba", uid: u, v, r });
  };

  const resuelveAzar = c => {
    const a = azar;
    azar = null;
    const h = sha256hex(a.c + "|" + c + "|" + a.tipo + "|" + a.id);
    const n1 = parseInt(h.slice(0, 8), 16), n2 = parseInt(h.slice(8, 16), 16);
    if (a.tipo === "dados") {
      let d1 = 1 + n1 % 6, d2 = 1 + n2 % 6;
      if (restantes) {
        if (restantes.length <= CT_RESTO_BARAJA) { restantes = CT_BARAJA.slice(); suceso({ e: "baraja" }); }
        const s = restantes.splice(n1 % restantes.length, 1)[0];
        const lo = Math.max(1, s - 6), hi = Math.min(6, s - 1);
        d1 = lo + n2 % (hi - lo + 1); d2 = s - d1;
      }
      tirada(a.por, d1, d2);
    } else {
      roba(a.por, a.v, n1);
      vuelve();
    }
  };

  const llave = (u, j) => {
    const a = String(j.a == null ? "" : j.a);
    if (etapa === "arranque") {
      if (a !== "0" || llaves0[u] || aceptaLlave(u, j.c) !== true) return;
      llaves0[u] = String(j.c);
      if (activos().every(x => llaves0[x])) arranca();
      return;
    }
    if (!azar || a !== azar.id || u === azar.por) return;
    if (aceptaLlave(u, j.c) !== true) return;
    resuelveAzar(String(j.c));
  };

  const coloca = (u, j) => {
    if (u !== turno) return;
    if (sub === "poblado" && j.t === "poblado") {
      const v = ctNat(j.v);
      if (!puedePobladoCatan(S, u, v, true)) return;
      S.edif[v] = { u, c: 1 };
      ultPob = v; sub = "camino";
      /* El segundo poblado ya produce: una carta de cada terreno que toca. */
      let gana = null;
      if (si >= seq.length / 2) {
        gana = {};
        for (const h of T.V[v].h) {
          const r = CT_PRODUCE[T.H[h].t];
          if (r) { S.mano[u][r]++; gana[r] = (gana[r] || 0) + 1; }
        }
      }
      suceso({ e: "poblado", uid: u, v, ini: true, gana });
      actualizaPuerto(u);
      return;
    }
    if (sub === "camino" && (j.t === "camino" || j.t === "barco")) {
      const e = ctNat(j.e);
      if (!(j.t === "camino" ? puedeCaminoCatan(S, u, e, ultPob) : puedeBarcoCatan(S, u, e, ultPob))) return;
      (j.t === "camino" ? S.cam : S.bar)[e] = u;
      suceso({ e: j.t, uid: u, a: e, ini: true });
      si++;
      actualizaRutas([u]);
      avanzaColocacion();
    }
  };

  const construye = (u, j, deBalde) => {
    const tipo = j.t, n = piezasCatan(S, u), mano = S.mano[u];
    if (tipo === "camino" || tipo === "barco") {
      const e = ctNat(j.e);
      if (!(tipo === "camino" ? puedeCaminoCatan(S, u, e) : puedeBarcoCatan(S, u, e)) || n[tipo] >= CT_TOPE[tipo]) return false;
      if (deBalde) gratis--;
      else if (!alcanzaCatan(mano, CT_COSTE[tipo])) return false;
      else ctSuma(mano, CT_COSTE[tipo], -1);
      (tipo === "camino" ? S.cam : S.bar)[e] = u;
      if (tipo === "barco") S.nuevos.push(e);
      suceso({ e: tipo, uid: u, a: e, gratis: !!deBalde });
      actualizaRutas([u]);
      return true;
    }
    if (tipo === "poblado") {
      const v = ctNat(j.v);
      if (!puedePobladoCatan(S, u, v, false) || n.poblado >= CT_TOPE.poblado || !alcanzaCatan(mano, CT_COSTE.poblado)) return false;
      ctSuma(mano, CT_COSTE.poblado, -1);
      S.edif[v] = { u, c: 1 };
      suceso({ e: "poblado", uid: u, v });
      const isla = T.V[v].isla;
      if (T.mar && isla > 0 && !S.islas[u][isla]) { S.islas[u][isla] = true; suceso({ e: "isla", uid: u, isla }); }
      actualizaPuerto(u);
      /* Corta la ruta ajena que pasa por esa esquina, y la propia puede
         crecer: ahí un camino y un barco quedan enlazados. */
      const tocan = new Set();
      for (const e of T.V[v].e) { if (S.cam[e] != null) tocan.add(S.cam[e]); if (S.bar[e] != null) tocan.add(S.bar[e]); }
      if (tocan.size) actualizaRutas([...tocan]);
      return true;
    }
    if (tipo === "ciudad") {
      const v = ctNat(j.v), b = S.edif[v];
      if (!b || b.u !== u || b.c !== 1 || n.ciudad >= CT_TOPE.ciudad || !alcanzaCatan(mano, CT_COSTE.ciudad)) return false;
      ctSuma(mano, CT_COSTE.ciudad, -1);
      S.edif[v] = { u, c: 2 };
      suceso({ e: "ciudad", uid: u, v });
      actualizaPuerto(u);
      return true;
    }
    if (tipo === "compra") {
      if (!alcanzaCatan(mano, CT_COSTE.desarrollo)) return false;
      ctSuma(mano, CT_COSTE.desarrollo, -1);
      S.des[u].t.push(turnoN); S.des[u].n++;
      suceso({ e: "compra", uid: u });
      return true;
    }
    return false;
  };

  const juegaCarta = (u, j) => {
    const d = S.des[u], k = ctNat(j.k), c = String(j.c || "");
    /* Una por turno, nunca la comprada en este mismo turno, y nunca la
       misma dos veces. Qué carta era de verdad lo comprueba la auditoría. */
    if (jugoDes || k < 0 || k >= d.n || d.usadas[k] || d.puntos.includes(k) || !(d.t[k] < turnoN)) return;
    if (c === "caballero") {
      d.usadas[k] = c; jugoDes = true; S.caballeros[u]++;
      suceso({ e: "juega", uid: u, c });
      actualizaEjercito(u);
      tras = etapa; etapa = "ladron";
      compruebaFin();
    } else if (c === "carreteras") {
      const n = piezasCatan(S, u);
      d.usadas[k] = c; jugoDes = true;
      gratis = Math.min(2, (CT_TOPE.camino - n.camino) + (T.mar ? CT_TOPE.barco - n.barco : 0));
      suceso({ e: "juega", uid: u, c });
    } else if (c === "abundancia") {
      const r = ctRecursos(j.r);
      if (!r || cartasEnMano(r) !== 2) return;
      d.usadas[k] = c; jugoDes = true;
      ctSuma(S.mano[u], r, 1);
      suceso({ e: "juega", uid: u, c, r });
    } else if (c === "monopolio") {
      const res = String(j.res || "");
      if (!CT_RECURSOS.includes(res)) return;
      d.usadas[k] = c; jugoDes = true;
      let n = 0;
      for (const w of ids) if (w !== u && !S.fuera[w] && S.mano[w][res] > 0) { n += S.mano[w][res]; S.mano[w][res] = 0; }
      S.mano[u][res] += n;
      suceso({ e: "juega", uid: u, c, res, n });
    }
  };

  const revela = (u, j) => {
    const d = S.des[u];
    let n = 0;
    for (const x of lista(j.ks)) {
      const k = ctNat(x);
      if (k < 0 || k >= d.n || d.usadas[k] || d.puntos.includes(k)) continue;
      d.puntos.push(k); n++;
    }
    if (!n) return;
    suceso({ e: "revela", uid: u, n });
    compruebaFin();
  };

  const banco = (u, j) => {
    const da = ctRecursos(j.da), pide = ctRecursos(j.pide);
    if (!da || !pide) return;
    const rt = ratiosCatan(S, u);
    let cred = 0;
    for (const r of CT_RECURSOS) {
      if (da[r] % rt[r] || (da[r] && pide[r])) return;
      cred += da[r] / rt[r];
    }
    if (!cred || cartasEnMano(pide) !== cred || !alcanzaCatan(S.mano[u], da)) return;
    ctSuma(S.mano[u], da, -1); ctSuma(S.mano[u], pide, 1);
    suceso({ e: "banco", uid: u, da, pide });
  };
  const trato = (da, pide) => !!da && !!pide && cartasEnMano(da) > 0 && cartasEnMano(pide) > 0
    && CT_RECURSOS.every(r => !(da[r] && pide[r]));

  const mueveLadron = (u, j) => {
    const h = ctNat(j.x);
    if (!hexesLadronCatan(S, u).includes(h)) return;
    const vs = victimasCatan(S, u, h);
    const v = vs.length ? String(j.v || "") : "";
    if (vs.length && !vs.includes(v)) return;
    if (v && aceptaLlave(u, j.c) !== true) return;
    const pir = T.H[h].isla < 0;
    if (pir) S.pirata = h; else S.ladron = h;
    suceso({ e: "ladron", uid: u, x: h, pir, v });
    if (v) azar = { id: j.k, tipo: "robo", por: u, v, c: String(j.c), pref: v };
    else vuelve();
  };

  /* La fase especial (5–6): tras cada turno, los demás en orden pueden
     construir o comprar. Quien no puede pagar nada se salta solo. */
  const avanzaEsp = () => {
    while (esp && esp.i < esp.orden.length && (S.fuera[esp.orden[esp.i]] || !puedeAlgoCatan(S, esp.orden[esp.i]))) esp.i++;
    if (esp && esp.i >= esp.orden.length) { const de = esp.de; esp = null; empiezaTurno(sigActivo(de) || de); return; }
    if (esp) etapa = "especial";
  };
  const finTurno = u => {
    oferta = null; propuestas = {}; gratis = 0;
    if (T.grande) {
      esp = { de: u, i: 0, orden: [] };
      for (let k = 1; k < N; k++) { const c = ids[(ids.indexOf(u) + k) % N]; if (!S.fuera[c]) esp.orden.push(c); }
      suceso({ e: "especial", uid: u });
      avanzaEsp();
      return;
    }
    empiezaTurno(sigActivo(u));
  };
  const especial = (u, j) => {
    if (etapa !== "especial" || !esp) return;
    const cur = esp.orden[esp.i];
    if (j.t === "salta") {
      /* Cualquiera puede saltarse a quien se ha dormido: la pantalla solo
         lo ofrece pasado un rato, y lo que se pierde es opcional. */
      if (u === cur) return;
      suceso({ e: "salta", uid: cur, por: u });
      esp.i++; avanzaEsp();
      return;
    }
    if (u !== cur) return;
    if (j.t === "pasa") { esp.i++; avanzaEsp(); return; }
    if (["camino", "barco", "poblado", "ciudad", "compra"].includes(j.t) && construye(u, j, false) && !puedeAlgoCatan(S, u)) {
      esp.i++; avanzaEsp();
    }
  };

  const abandona = u => {
    if (ganador !== null || S.fuera[u]) return;
    S.fuera[u] = true;
    suceso({ e: "abandona", uid: u });
    if (!listos) return;
    const vs = activos();
    if (vs.length <= 1) { ganador = vs[0] || ""; motivo = "abandono"; return; }
    delete descartar[u]; delete oroP[u]; delete propuestas[u];
    if (oferta) { if (oferta.uid === u) oferta = null; else { delete oferta.si[u]; delete oferta.no[u]; } }
    if (etapa === "arranque") { if (vs.every(x => llaves0[x])) arranca(); return; }
    if (etapa === "colocacion") { if (turno === u) avanzaColocacion(); return; }
    actualizaRutas([u]);
    if (etapa === "especial" && esp) { if (esp.orden[esp.i] === u) { esp.i++; avanzaEsp(); } return; }
    if (turno === u) { empiezaTurno(sigActivo(u)); return; }
    if (etapa === "descarte" && !Object.keys(descartar).length) { etapa = "ladron"; tras = "accion"; }
    if (etapa === "oro" && !Object.keys(oroP).length) etapa = "accion";
  };

  for (const j of jugadasDe(p)) {
    const u = j.uid;
    if (!ficha[u]) continue;
    if (j.t === "s") { if (ganador !== null) semillas[u] = true; continue; }
    if (j.t === "abandona") { abandona(u); continue; }
    if (tope && ganador === null) acabaTope();
    if (ganador !== null || !listos || S.fuera[u]) continue;
    if (j.t === "k") { llave(u, j); continue; }
    if (etapa === "arranque") continue;
    if (etapa === "colocacion") { coloca(u, j); continue; }
    const esTurno = u === turno;

    if (j.t === "descarta") {
      if (etapa !== "descarte" || !descartar[u]) continue;
      const r = ctRecursos(j.r);
      if (!r || cartasEnMano(r) !== descartar[u] || !alcanzaCatan(S.mano[u], r)) continue;
      ctSuma(S.mano[u], r, -1);
      suceso({ e: "descarta", uid: u, n: descartar[u] });
      delete descartar[u];
      if (!Object.keys(descartar).length) etapa = "ladron";
      continue;
    }
    if (j.t === "oro") {
      if (etapa !== "oro" || !oroP[u]) continue;
      const r = ctRecursos(j.r);
      if (!r || cartasEnMano(r) !== oroP[u]) continue;
      ctSuma(S.mano[u], r, 1);
      suceso({ e: "oro", uid: u, r });
      delete oroP[u];
      if (!Object.keys(oroP).length) { etapa = "accion"; compruebaFin(); }
      continue;
    }
    if (j.t === "acepta" || j.t === "rechaza") {
      if (esTurno || etapa !== "accion" || azar || !oferta || String(j.o) !== oferta.id) continue;
      if (j.t === "acepta") {
        if (!alcanzaCatan(S.mano[u], oferta.pide)) continue;
        oferta.si[u] = true; delete oferta.no[u];
        suceso({ e: "acepta", uid: u });
      } else { oferta.no[u] = true; delete oferta.si[u]; }
      continue;
    }
    if (j.t === "contra") {
      if (esTurno || etapa !== "accion" || azar) continue;
      const da = ctRecursos(j.da), pide = ctRecursos(j.pide);
      if (!trato(da, pide) || !alcanzaCatan(S.mano[u], da)) continue;
      propuestas[u] = { id: j.k, da, pide };
      suceso({ e: "contra", uid: u });
      continue;
    }
    if (j.t === "retira" && !esTurno) { delete propuestas[u]; continue; }
    if (etapa === "especial") { especial(u, j); continue; }
    if (!esTurno || azar) continue;

    switch (j.t) {
      case "tira":
        if (etapa === "tirar" && aceptaLlave(u, j.c) === true) {
          azar = { id: j.k, tipo: "dados", por: u, c: String(j.c), pref: sigActivo(u) };
          suceso({ e: "agita", uid: u });
        }
        break;
      case "juega": if (etapa === "tirar" || etapa === "accion") juegaCarta(u, j); break;
      case "revela": if (etapa === "tirar" || etapa === "accion" || etapa === "ladron") revela(u, j); break;
      case "ladron": if (etapa === "ladron") mueveLadron(u, j); break;
      case "camino": case "barco":
        if (gratis > 0 && (etapa === "tirar" || etapa === "accion")) construye(u, j, true);
        else if (etapa === "accion") construye(u, j, false);
        compruebaFin();
        break;
      case "poblado": case "ciudad": case "compra":
        if (etapa === "accion") { construye(u, j, false); compruebaFin(); }
        break;
      case "banco": if (etapa === "accion") banco(u, j); break;
      case "oferta": {
        if (etapa !== "accion") break;
        const da = ctRecursos(j.da), pide = ctRecursos(j.pide);
        if (!trato(da, pide) || !alcanzaCatan(S.mano[u], da)) break;
        oferta = { id: j.k, uid: u, da, pide, si: {}, no: {} };
        suceso({ e: "oferta", uid: u });
        break;
      }
      case "retira": oferta = null; break;
      case "cierra": {
        if (etapa !== "accion") break;
        const con = String(j.con || ""), o = String(j.o || "");
        if (!ficha[con] || con === u || S.fuera[con]) break;
        let da, pide;
        if (oferta && o === oferta.id && oferta.si[con]) { da = oferta.da; pide = oferta.pide; }
        else if (propuestas[con] && propuestas[con].id === o) { da = propuestas[con].pide; pide = propuestas[con].da; }
        else break;
        if (!alcanzaCatan(S.mano[u], da) || !alcanzaCatan(S.mano[con], pide)) break;
        ctSuma(S.mano[u], da, -1); ctSuma(S.mano[con], da, 1);
        ctSuma(S.mano[con], pide, -1); ctSuma(S.mano[u], pide, 1);
        suceso({ e: "comercio", uid: u, con, da, pide });
        if (oferta && o === oferta.id) oferta = null;
        delete propuestas[con];
        break;
      }
      case "mueve": {
        if (etapa !== "accion" || !T.mar) break;
        const de = ctNat(j.de), a = ctNat(j.a);
        if (!barcosMoviblesCatan(S, u).includes(de) || !puedeBarcoCatan(S, u, a, -1, de)) break;
        delete S.bar[de]; S.bar[a] = u; S.movioBarco = true;
        suceso({ e: "mueve", uid: u, de, a });
        actualizaRutas([u]); compruebaFin();
        break;
      }
      case "fin": if (etapa === "accion") finTurno(u); break;
    }
    /* Un trato que ya no se puede pagar (un robo, otro cambio) deja de
       estar sobre la mesa: si no, la pantalla ofrecería cerrarlo. */
    if (oferta) {
      if (!alcanzaCatan(S.mano[oferta.uid], oferta.da)) oferta = null;
      else for (const w in oferta.si) if (!alcanzaCatan(S.mano[w], oferta.pide)) delete oferta.si[w];
    }
    for (const w in propuestas) if (!alcanzaCatan(S.mano[w], propuestas[w].da)) delete propuestas[w];
  }
  if (tope && ganador === null) acabaTope();

  let debe = [], espera = null;
  const fin = ganador !== null;
  if (listos && !fin) {
    if (etapa === "arranque") espera = { k: "llaves", faltan: activos().filter(x => !llaves0[x]) };
    else if (azar) espera = { k: "azar", id: azar.id, tipo: azar.tipo, por: azar.por, pref: azar.pref, v: azar.v || "" };
    else if (etapa === "descarte") { debe = Object.keys(descartar); espera = { k: "descarte" }; }
    else if (etapa === "oro") { debe = Object.keys(oroP); espera = { k: "oro" }; }
    else if (etapa === "especial" && esp) { debe = [esp.orden[esp.i]]; espera = { k: "especial", uid: debe[0] }; }
    else { debe = turno ? [turno] : []; espera = { k: etapa, uid: turno }; }
  }
  const vp = {}, cartas = {}, desN = {}, ppuerto = {};
  for (const u of ids) {
    vp[u] = vpCatan(S, u); cartas[u] = cartasEnMano(S.mano[u]); ppuerto[u] = puntosPuerto(u);
    desN[u] = S.des[u].n - Object.keys(S.des[u].usadas).length - S.des[u].puntos.length;
  }
  return Object.assign(S, {
    fase: !listos ? "espera" : fin ? "fin" : "jugando",
    etapa, turno: fin ? "" : turno, turnoN, sub, ultPob, primero,
    azar: azar ? { id: azar.id, tipo: azar.tipo, por: azar.por, pref: azar.pref, v: azar.v || "" } : null,
    espera, debe, descartar, oro: oroP, oferta, propuestas, gratis, jugoDes,
    esp: esp ? { de: esp.de, orden: esp.orden, i: esp.i, uid: esp.orden[esp.i] || "" } : null,
    ultima, hist, falsas, ganador, motivo, aportes, mezcla: mezclaCt, semillas,
    restantes: restantes ? restantes.length : null,
    vp, puntos: vp, cartas, desN, ppuerto
  });
}

/* Al acabar cada uno revela su semilla, y aquí se comprueba que la
   cadena de llaves y el mazo eran los prometidos en la ficha, y que
   cada carta jugada (y cada punto revelado) era la que tocaba. */
export async function auditaCatan(partida, estado) {
  const fallos = [], sec = {};
  const pon = (uid, que) => { if (!fallos.some(x => x.uid === uid && x.que === que)) fallos.push({ uid, que }); };
  for (const j of jugadasDe(partida)) {
    if (j.t !== "s" || sec[j.uid]) continue;
    const f = (estado.jugadores || []).find(x => x.uid === j.uid);
    if (!f) continue;
    const sem = j.sem, sal = String(j.sal || "");
    const ok = await compromisoValido(sem, sal, f.hmazo) && cadenaCatan(Number(sem) >>> 0, sal)[CT_CADENA] === f.hcad;
    if (!ok) { pon(j.uid, "semilla"); continue; }
    sec[j.uid] = { sem: Number(sem) >>> 0, sal };
  }
  const grande = !!(estado.T && estado.T.grande);
  for (const u in sec) {
    const d = (estado.des || {})[u];
    if (!d) continue;
    for (const k in d.usadas) if (cartaCatan(sec[u].sem, sec[u].sal, estado.mezcla, +k, grande) !== d.usadas[k]) pon(u, "carta");
    for (const k of d.puntos || []) if (cartaCatan(sec[u].sem, sec[u].sal, estado.mezcla, k, grande) !== "punto") pon(u, "carta");
  }
  for (const j of estado.jugadores || []) if (!sec[j.uid] && !fallos.some(x => x.uid === j.uid)) pon(j.uid, "oculta");
  return fallos;
}
