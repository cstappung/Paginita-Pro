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
   media luna de Flip 7; cuadritos no tiene nada de eso y llega a diez. */
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
    cupo: 8
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
   8. Flip 7 — normal y «con venganza»

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

export const modoF7 = p => (p && p.modo === "venganza") ? "venganza" : "normal";

/* Los dos mazos, carta a carta. El índice en la lista es la identidad
   de la carta, y es lo único que viaja: el reductor, la pantalla y la
   auditoría leen de aquí qué es. Normal: 94 cartas (un 0, n copias de
   cada n del 1 al 12, +2…+10 y ×2, y tres de cada acción). Con
   venganza: 108 (el Cero, n copias del 1 al 13 con un 7 gafe y un 13
   de la suerte entre ellas, −2…−10 y ÷2, y dos de cada acción). */
function construyeMazoF7(modo) {
  const m = [];
  const pon = c => m.push(Object.freeze(Object.assign({ i: m.length }, c)));
  const venganza = modo === "venganza";
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
  return Object.freeze(m);
}
const mazosF7 = {};
export const mazoF7 = modo => mazosF7[modo] || (mazosF7[modo] = construyeMazoF7(modo));

/* ¿Esta fila de números se puede tener sin haberse pasado? Una sola
   copia de cada valor; con venganza, el 13 admite un segundo si uno de
   los dos es el de la suerte. */
export function lineaValidaF7(nums, modo) {
  const M = mazoF7(modo), cuenta = {};
  let suerte = false;
  for (const id of nums) {
    const c = M[id];
    cuenta[c.v] = (cuenta[c.v] || 0) + 1;
    if (c.suerte) suerte = true;
  }
  for (const v in cuenta) {
    const tope = modo === "venganza" && Number(v) === 13 && suerte ? 2 : 1;
    if (cuenta[v] > tope) return false;
  }
  return true;
}

/* Lo que vale una fila si la ronda acabara ahora. Normal: números,
   ×2 (solo a los números), más los modificadores, más 15 por Flip 7.
   Con venganza: números, ÷2 redondeando hacia abajo, menos los
   negativos, nunca por debajo de cero, y 15 por Flip 7; quien tiene
   el Cero se queda en nada salvo que haga Flip 7. */
export function valorLineaF7(l, modo) {
  if (!l || l.estado === "pasa" || l.estado === "fuera") return 0;
  const M = mazoF7(modo);
  let s = l.nums.reduce((a, id) => a + M[id].v, 0);
  const mods = l.mods.map(id => M[id]);
  if (modo === "venganza") {
    if (!l.f7 && l.nums.some(id => M[id].cero)) return 0;
    if (mods.some(c => c.mitad)) s = Math.floor(s / 2);
    s = Math.max(0, s + mods.reduce((a, c) => a + c.v, 0));
  } else {
    if (mods.some(c => c.doble)) s *= 2;
    s += mods.reduce((a, c) => a + c.v, 0);
  }
  return s + (l.f7 ? F7_BONO : 0);
}

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
  const modo = modoF7(p), M = mazoF7(modo), V = modo === "venganza";
  const fuera = {}, puntos = {}, semillas = {}, aportes = {};
  for (const j of js) puntos[j.uid] = 0;
  let lin = {}, pila = [], mazo = M.map(c => c.i), descarte = [];
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
  const pon = (u, id) => { if (M[id].k === "n") lin[u].nums.push(id); else lin[u].mods.push(id); };
  const uids = ok => js.map(x => x.uid).filter(ok);

  /* Tras recibir un número por intercambio o robo: con un repetido se
     pasa, con siete se cierra la ronda. */
  const revisa = u => {
    const l = lin[u];
    if (!enPie(u)) return;
    if (!lineaValidaF7(l.nums, modo)) { l.estado = "pasa"; suceso({ e: "pasa", uid: u }); return; }
    if (l.nums.length >= F7_SIETE) { l.f7 = true; cierra = true; suceso({ e: "f7", uid: u }); }
  };

  /* A quién (o qué carta) se puede elegir con la carta `id` en la mano
     de `quien`. `a` es un jugador, `c` una carta y `2` dos cartas de
     dos jugadores distintos. */
  const opciones = (quien, id) => {
    const c = M[id];
    const conCartas = ok => {
      const o = {};
      for (const u of uids(ok)) { const cs = cartasDe(u); if (cs.length) o[u] = cs; }
      return o;
    };
    if (c.k === "m") return { tipo: "a", uids: uids(enPie) };
    switch (c.a) {
      case "congela": case "tres": return { tipo: "a", uids: uids(activo) };
      case "segunda": return { tipo: "a", uids: uids(u => u !== quien && activo(u) && lin[u].seg == null) };
      case "cuatro": case "otra": return { tipo: "a", uids: uids(enPie) };
      case "roba": return { tipo: "c", cartas: enPie(quien) ? conCartas(u => u !== quien && enPie(u)) : {} };
      case "tira": return { tipo: "c", cartas: conCartas(enPie) };
      case "cambia": return { tipo: "2", cartas: conCartas(enPie) };
    }
    return { tipo: "a", uids: [] };
  };
  const sinSalida = o => o.tipo === "a" ? !o.uids.length
    : o.tipo === "c" ? !Object.keys(o.cartas).length : Object.keys(o.cartas).length < 2;
  const valida = (o, j) => {
    const tiene = (u, id) => typeof u === "string" && Number.isInteger(id) && (o.cartas[u] || []).includes(id);
    if (o.tipo === "a") return o.uids.includes(j.a);
    if (o.tipo === "c") return tiene(j.a, j.c);
    return j.a !== j.b && tiene(j.a, j.c) && tiene(j.b, j.d);
  };

  /* Con un único objetivo posible no se pregunta: congelar siendo el
     último en pie es congelarse, y esperar un clic para eso es ruido. */
  const pideEleccion = (quien, id) => {
    const o = opciones(quien, id);
    if (sinSalida(o)) { descarte.push(id); suceso({ e: "nada", uid: quien, id }); return; }
    if (o.tipo === "a" && o.uids.length === 1) { aplica(quien, id, { a: o.uids[0] }); return; }
    pila.push({ k: "elige", quien, id });
  };

  const aplica = (quien, id, j) => {
    const c = M[id];
    if (c.k === "m") { lin[j.a].mods.push(id); suceso({ e: "da", uid: quien, a: j.a, id }); return; }
    if (c.a !== "segunda") descarte.push(id);
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
    }
  };

  const recibeNumero = (u, id) => {
    const l = lin[u], c = M[id];
    if (c.gafe) {
      descarte.push(...l.nums, ...l.mods);
      l.nums = [id]; l.mods = [];
      suceso({ e: "gafe", uid: u, id }); return;
    }
    const prueba = l.nums.concat(id);
    if (!lineaValidaF7(prueba, modo)) {
      if (l.seg != null) {
        descarte.push(id, l.seg); l.seg = null;
        suceso({ e: "salva", uid: u, id }); return;
      }
      l.nums = prueba; l.estado = "pasa";
      suceso({ e: "pasa", uid: u, id }); return;
    }
    l.nums = prueba;
    suceso({ e: "carta", uid: u, id });
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
    lin = {};
    for (const j of js) lin[j.uid] = { nums: [], mods: [], seg: null, estado: esta(j.uid) ? "activo" : "fuera", congelado: false, f7: false };
    const orden = [];
    for (let u = tras(reparte, esta); u; u = tras(u, esta)) { orden.push(u); if (u === reparte) break; }
    pila = [{ k: "turnos", tras: reparte }, { k: "reparto", orden, i: 0 }];
    viva = true; cierra = false;
    suceso({ e: "ronda", r: ronda, uid: reparte });
  };

  const acabaRonda = () => {
    viva = false; cierra = false;
    const pts = {}, lineas = {};
    let f7 = "";
    for (const j of js) {
      const l = lin[j.uid];
      pts[j.uid] = esta(j.uid) ? valorLineaF7(l, modo) : 0;
      puntos[j.uid] += pts[j.uid];
      if (l.f7) f7 = j.uid;
      lineas[j.uid] = { nums: l.nums.slice(), mods: l.mods.slice(), estado: l.estado, f7: l.f7 };
      descarte.push(...l.nums, ...l.mods);
      if (l.seg != null) descarte.push(l.seg);
    }
    for (const t of pila) {
      if (t.apartadas) descarte.push(...t.apartadas);
      if (t.k === "elige" || t.k === "resuelve") descarte.push(t.id);
    }
    pila = [];
    finRonda = { r: ronda, pts, lineas, f7, total: Object.assign({}, puntos) };
    rondas.push({ r: ronda, pts, f7 });
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
      if (cierra || !pila.length) { acabaRonda(); continue; }
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
      const eleccion = { a: j.a, b: j.b, c: Number(j.c), d: Number(j.d) };
      if (!valida(opciones(t.quien, t.id), eleccion)) continue;
      pila.pop();
      aplica(t.quien, t.id, eleccion);
      avanza();
    }
  }

  const top = ganador === null && listos ? pila[pila.length - 1] : null;
  let espera = null, turno = "";
  if (top && top.k === "turnos" && top.toca) {
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
  const valor = {};
  for (const j of js) valor[j.uid] = valorLineaF7(lin[j.uid], modo);
  return {
    fase: !listos ? "espera" : ganador !== null ? "fin" : "jugando",
    modo, meta: F7_META, puntos, lineas: lin, valor, ronda, reparte, turno, espera, n,
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
