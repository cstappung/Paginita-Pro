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
   como mucho. Solo cuadritos admite más de dos: los otros tres son
   duelos por construcción — el escondite cruza *dos* paisajes, las
   cartas resuelven *un* choque y el reversi tiene *dos* colores. */
export const JUEGOS = {
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
    cupo: 6
  },
  reversi: {
    nombre: "Reversi",
    lema: "Atrapa las fichas del otro entre las tuyas y dales la vuelta",
    color: "#0d9488",
    minimo: 2,
    cupo: 2
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
const PIEZAS = 210;

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
  return !!p && p.x >= 0.03 && p.x <= 0.97 && p.y >= 0.20 && p.y <= 0.97;
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

/* La carta número `i` del mazo de un jugador. Que la carta se deduzca
   del índice, y no venga escrita en la jugada, es lo que impide
   revelar una carta que no se tenía: el mazo sale de la semilla de la
   partida, que está a la vista de los dos.

   La consecuencia, dicha claro porque manda sobre cómo se pinta: si
   los dos pueden calcular el mazo del otro, **las dos manos están a la
   vista**. Fingir lo contrario sería un secreto que cualquiera destapa
   con la consola del navegador. Así que se enseñan, y el juego pasa a
   ser adivinar cuál de las cinco cartas que le ves va a echar —
   que con el compromiso de por medio (nadie puede elegir después de
   ver la del otro) es un juego mejor, no peor. */
export const cartaDe = (semilla, orden, i) => mazoDe(semilla, orden)[i] || null;

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

/* `listos` es «la partida está en marcha». Con cupo de dos basta con
   que estén los dos; con cupo mayor hace falta además que la sala se
   haya cerrado — llena, o cerrada a mano por quien la abrió — porque
   si no, el tercero llegaría a un tablero empezado y sin turno. Ese
   cierre es justo el `estado`, que deja de ser «esperando». */
export function reducir(p) {
  const js = jugadoresDe(p);
  const cupo = cupoDe(p);
  const min = (JUEGOS[p.juego] || {}).minimo || 2;
  const listos = js.length >= min && (cupo === min || p.estado !== "esperando");
  const base = { jugadores: js, cupo, listos, fin: p.fin || null };
  if (p.juego === "escondite") return { ...base, ...redEscondite(p, js) };
  if (p.juego === "cartas") return { ...base, ...redCartas(p, js) };
  if (p.juego === "cuadritos") return { ...base, ...redCuadritos(p, js, listos) };
  if (p.juego === "reversi") return { ...base, ...redReversi(p, js) };
  return base;
}

/* ---------- escondite ---------- */
function redEscondite(p, js) {
  const jug = jugadasDe(p);
  const comp = {}, sitios = {}, intentos = {};
  let ganador = null, motivo = "";
  for (const j of jug) {
    if (j.t === "c" && !comp[j.uid]) comp[j.uid] = j.h;
    else if (j.t === "r" && !sitios[j.uid]) sitios[j.uid] = { x: j.x, y: j.y, sal: j.sal, at: j.at || 0 };
    else if (j.t === "b") {
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
    if (j.t === "abandona") {
      if (!ganador) { const o = js.find(x => x.uid !== j.uid); if (o) { ganador = o.uid; motivo = "abandono"; } }
      continue;
    }
    if (ganador) continue;
    if (j.t === "c" && !comp[j.uid]) comp[j.uid] = j.h;
    else if (j.t === "r" && !rev[j.uid] && comp[j.uid]) {
      /* La carta no viene en la jugada: se saca del mazo, que las dos
         máquinas calculan igual. Escribirla habría dejado revelar una
         carta que no se tenía. */
      const quien = js.find(x => x.uid === j.uid);
      const carta = quien ? cartaDe(p.semilla, quien.orden || 0, j.i) : null;
      if (!carta) continue;
      rev[j.uid] = Object.assign({ i: j.i, sal: j.sal || "" }, carta);
      usadas[j.uid].push(j.i);
      if (js.length >= 2 && js.every(x => rev[x.uid])) cierra();
    }
  }
  const trio = ganador ? victoriaCartas(ganadas[ganador]) : null;
  return {
    fase: js.length < 2 ? "espera" : ganador ? "fin" : "jugando",
    ronda, comp, rev, ganadas, usadas, rondas, ganador, motivo, trio
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

/* ============================================================
   7. Clasificación

   Tres puntos por victoria, uno por empate. Se suman en el cliente y
   cada uno escribe solo su propia fila — las reglas de la base no
   dejan otra cosa. Que las reglas comprueben además que `ultima`
   nombra una partida terminada en la que juega quien escribe, y que
   no es la misma que ya se contó, es lo que impide inventarse
   victorias sin necesidad de un servidor.
   ============================================================ */

/* Lo único que el reductor no puede comprobar por sí mismo: que la
   carta revelada sea la que se prometió en el compromiso. Comprobarlo
   pide SHA-256, que es asíncrono, y el reductor es síncrono a propósito
   (corre en cada pintada). Así que se audita aparte, y las dos
   pantallas lo hacen: quien cambie de carta después de ver la del otro
   no gana en silencio, sale su nombre en rojo en los dos navegadores.
   Devuelve la lista de rondas donde algo no cuadra. */
export async function auditaCartas(partida, estado) {
  const malas = [];
  const jug = jugadasDe(partida);
  const compHash = {};
  let ronda = 0;
  const vistos = {};
  for (const j of jug) {
    if (j.t === "c" && compHash[j.uid + ":" + ronda] === undefined) compHash[j.uid + ":" + ronda] = j.h;
    else if (j.t === "r" && !vistos[j.uid + ":" + ronda]) {
      vistos[j.uid + ":" + ronda] = true;
      const h = compHash[j.uid + ":" + ronda];
      if (h && !(await compromisoValido(j.i, j.sal || "", h))) malas.push({ uid: j.uid, ronda });
      if (Object.keys(vistos).filter(k => k.endsWith(":" + ronda)).length >= (estado.jugadores || []).length) ronda++;
    }
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
