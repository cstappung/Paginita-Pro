/*
 * El salón de juegos, en datos: qué hay para jugar solo, qué es
 * multijugador, qué es nuevo y qué puede abrir un invitado.
 *
 * Es la mitad pura del vestíbulo (la otra, `salon.js`, pinta). Solo
 * importa la tabla generada de controles —los juegos multijugador llegan
 * como parámetro, desde la tabla `JUEGOS` de `motor.js`— y así
 * `tests/salon.test.cjs` lo carga en Node sin navegador, igual que a
 * `motor.js`.
 *
 * Tres decisiones:
 *
 * - **Una sola forma de entrada para los dos modos.** Un juego de un
 *   jugador y uno multijugador se describen con los mismos campos
 *   (`entradasSalon`), porque la miniatura es la misma pieza: lo que
 *   cambia es la insignia de modo, no la tarjeta entera. Antes eran dos
 *   componentes distintos y los de un jugador quedaban como un apéndice.
 * - **«Nuevo» es una regla, no una lista a mano** (`nuevos`): los cuatro
 *   que llegaron últimos, si llegaron hace menos de dos semanas. Con un
 *   juego nuevo cada pocos días, «todo lo de este mes» habría puesto la
 *   etiqueta a media tienda, y una etiqueta que lo marca todo no marca nada.
 * - **El invitado ve todo y juega solo cuatro juegos** (`bloqueado`,
 *   `LIBRES_INVITADO`): Snake, Mina Club, Tetris Club y sortEm. El resto
 *   (los multijugador, los demás del club y las prácticas contra bots) pide
 *   cuenta, por decisión de la dueña del sitio. Lo bloqueado se muestra
 *   con candado en vez de esconderse: esconderlo le escondería al invitado
 *   también la razón para crearse una cuenta.
 */
import { CONTROLES } from "./controles-datos.js";

/* Los juegos de un jugador. `tipo: "club"` es un juego del Solo Club, con
   su clasificación por modalidad; `tipo: "bots"` es la práctica suelta de
   un juego multijugador (su propia página, contra la máquina), que no
   puntúa en ninguna tabla. `popular` es la clave con la que la
   popularidad del vestíbulo cuenta sus partidas; `reglas` la del manual. */
export const SOLOS = [
  { id: "minas", tipo: "club", nombre: "Mina Club", genero: "Estrategia", icono: "✦", alta: "2026-09-20",
    ruta: "#solo/minas", reglas: "minas", popular: "club-minas", ranking: true,
    lema: "Buscaminas en tres dificultades, con variante táctica y música que crece contigo.",
    modos: ["Explorador", "Veterano", "Leyenda"] },
  { id: "snake", tipo: "club", nombre: "Snake Club", genero: "Reflejos", icono: "ϟ", alta: "2026-09-20",
    ruta: "#solo/snake", reglas: "snake", popular: "club-snake", ranking: true,
    lema: "Siete modos —contrarreloj, espejo, laberinto…— y cuatro tamaños de mapa.",
    modos: ["Clásico", "Portales", "Ruinas", "Zen"] },
  { id: "tetrisclub", tipo: "club", nombre: "Tetris Club", genero: "Reflejos", icono: "▤", alta: "2026-09-28",
    ruta: "#solo/tetris", reglas: "tetrisclub", popular: "club-tetris", ranking: true,
    lema: "Maratón, Sprint de 40 líneas y Ultra de dos minutos.",
    modos: ["Maratón", "Sprint 40", "Ultra 2 min"] },
  { id: "sortem", tipo: "club", nombre: "sortEm", genero: "Puzzle", icono: "↔", alta: "2026-09-29",
    ruta: "#solo/sortem", reglas: "sortem", popular: "club-sortem", ranking: true,
    lema: "Mueve y fusiona los bloques hasta ordenarlos del 1 al 10 o al 20, contra el reloj.",
    modos: ["10 bloques", "20 bloques"] },
  { id: "bbtan", tipo: "club", nombre: "BBTAN", genero: "Arcade", icono: "●", alta: "2026-09-30",
    ruta: "#solo/bbtan", reglas: "bbtan", popular: "club-bbtan", ranking: true,
    lema: "Apunta, rebota y rompe los bloques antes de que toquen el suelo. Y no te quedes mucho rato.",
    modos: ["Ranking por ronda máxima"] },
  { id: "sopa", tipo: "club", nombre: "Sopa de letras", genero: "Palabras", icono: "🔤", alta: "2026-10-01",
    ruta: "#solo/sopa", reglas: "sopa", popular: "club-sopa", ranking: true, diario: true,
    lema: "Una sopa diaria igual para todos, con racha de días seguidos, y sopas libres por temática.",
    modos: ["Sopa del día", "Libre"] },
  { id: "electro", tipo: "club", nombre: "Electrodle", genero: "Adivinanza", icono: "⚡", alta: "2026-10-01",
    ruta: "#solo/electro", reglas: "electro", popular: "club-electro", ranking: true, diario: true,
    lema: "Adivina el componente, la fórmula y el símbolo eléctrico del día. Puntos, racha y podio.",
    modos: ["Componente", "Fórmula", "Símbolo", "Retos"] },
  { id: "sudoku", tipo: "club", nombre: "Sudoku Arcade", genero: "Lógica", icono: "🔢", alta: "2026-10-04",
    ruta: "#solo/sudoku", reglas: "sudoku", popular: "club-sudoku", ranking: true, diario: true,
    lema: "Diario con racha, clásico en cuatro dificultades y arcade con vidas y combos.",
    modos: ["Diario", "Clásico", "Arcade"] },
  { id: "fanal", tipo: "club", nombre: "FANAL", genero: "Arcade", icono: "🪔", alta: "2026-10-04",
    ruta: "#solo/fanal", reglas: "fanal", popular: "club-fanal", ranking: true,
    lema: "Llevas la última luz a través de la noche, hacia el Alba y más allá. Mejora el arma y el fanal con las brasas de cada jornada.",
    modos: ["Travesía", "Sin fin"] },
  { id: "atasco", tipo: "club", nombre: "Atasco", genero: "Puzzle", icono: "🚗", alta: "2026-10-05",
    ruta: "#solo/atasco", reglas: "atasco", popular: "club-atasco", ranking: true,
    lema: "Desliza autos, camiones y buses hasta abrirle paso al auto rojo. 240 niveles en seis pisos.",
    modos: ["240 niveles", "1, 2 o 3 estrellas"] },
  { id: "aleteo", tipo: "club", nombre: "ALETEO", genero: "Arcade", icono: "🐦", alta: "2026-10-06",
    ruta: "#solo/aleteo", reglas: "aleteo", popular: "club-aleteo", ranking: true,
    lema: "Toca para aletear entre los tubos y vuelve al nido. Seis cielos, cada uno más oscuro que el anterior.",
    modos: ["Un toque, un aleteo", "Seis cielos"] },
  { id: "dosmil", tipo: "club", nombre: "2048", genero: "Puzle", icono: "🟨", alta: "2026-10-07",
    ruta: "#solo/dosmil", reglas: "dosmil", popular: "club-dosmil", ranking: true,
    lema: "Desliza las fichas, junta dos iguales y llega al 2048. Y después, más allá.",
    modos: ["Tabla de puntos", "Tabla de ficha"] },
  { id: "metrorush", tipo: "club", nombre: "Metro Rush", genero: "Runner", icono: "🚇", alta: "2026-10-05",
    ruta: "#solo/metrorush", reglas: "metrorush", popular: "club-metrorush", ranking: true,
    lema: "Corre por las vías esquivando trenes, junta monedas y llega a la Estación Fantasma. Siete estaciones y un inspector que no se cansa.",
    modos: ["Carrera sin fin", "Siete estaciones", "Tienda y retos"] },
  { id: "tulones", tipo: "club", nombre: "Tulones", genero: "Física", icono: "🩲", alta: "2026-10-09",
    ruta: "#solo/tulones", reglas: "tulones", popular: "club-tulones", ranking: false,
    lema: "Trepa sobre una cabra y sobre tus amigos congelados en calzoncillos. La torre más alta gana. De 1 a 8 en el mismo teclado.",
    modos: ["1 a 8 jugadores", "Torre sin fin"] },
  { id: "frontera", tipo: "club", nombre: "Frontera Batalla", genero: "Pokémon", icono: "🏰", alta: "2026-10-02",
    ruta: "#solo/frontera", reglas: "frontera", popular: "club-frontera", ranking: true,
    lema: "Torre, Palacio y Fábrica de Esmeralda: rachas de siete combates contra entrenadores cada vez más duros.",
    modos: ["Torre", "Palacio", "Fábrica"] },
  { id: "bots-worms", tipo: "bots", juego: "worms", nombre: "Circuit Breakers", genero: "Artillería", icono: "💥", alta: "2026-09-23",
    url: "juegos/worms/index.html?v=worms-4", reglas: "worms",
    lema: "Tu cuadrilla contra bots, o contra amigos turnándose en el mismo equipo.",
    modos: ["Contra bots", "Mismo equipo"] },
  { id: "bots-yemas", tipo: "bots", juego: "yemas", nombre: "Yemas · práctica", genero: "Acción", icono: "🥚", alta: "2026-09-28",
    url: "juegos/yemas/index.html", reglas: "yemas",
    lema: "El shooter de huevos contra cuatro bots, o las oleadas de zombis en cinco mapas.",
    modos: ["Todos contra todos", "Zombis"] },
  { id: "bots-clue", tipo: "bots", juego: "clue", nombre: "Clue · práctica", genero: "Deducción", icono: "🕵️", alta: "2026-09-29",
    url: "juegos/clue/index.html", reglas: "clue",
    lema: "Resuelve el crimen del edificio contra detectives automáticos.",
    modos: ["Contra bots"] },
  { id: "bots-boxhead", tipo: "bots", juego: "boxhead", nombre: "Boxhead · práctica", genero: "Acción", icono: "▣", alta: "2026-10-05",
    url: "juegos/boxhead/index.html", reglas: "boxhead",
    lema: "Tú solo contra los zombis y los diablos, en cualquiera de los cinco mapas.",
    modos: ["Supervivencia"] }
];

/* El género que lleva la miniatura de cada multijugador, junto al número
   de jugadores: con diecinueve juegos, «Cartas» o «Tablero» ayuda a
   elegir más que el nombre solo. */
export const GENERO = {
  orbita: "Física", escondite: "Búsqueda", cartas: "Cartas", cuadritos: "Tablero",
  worms: "Artillería", reversi: "Tablero", gato: "Tablero", cadena: "Estrategia", flip7: "Cartas",
  cacho: "Dados", uno: "Cartas", catan: "Tablero", presidente: "Cartas",
  spicy: "Faroleo", tetris: "Reflejos", yemas: "Acción", clue: "Deducción",
  ajedrez: "Tablero", pokemon: "Combate", boxhead: "Acción"
};

/* La práctica contra bots de un multijugador, si la tiene: la ficha la
   ofrece al lado de «Abrir sala», y al invitado como salida cuando el
   juego le pide cuenta. */
export const practicaDe = juego => SOLOS.find(s => s.tipo === "bots" && s.juego === juego) || null;

const DIA = 86400000;
/* Días desde una fecha `AAAA-MM-DD` (mediodía, para que el huso no la
   corra al día anterior). Una fecha ilegible cuenta como muy vieja. */
export function diasDesde(alta, ahora) {
  const t = Date.parse(alta + "T12:00:00");
  return Number.isFinite(t) ? Math.floor((ahora - t) / DIA) : Infinity;
}

/* Qué entradas llevan la etiqueta «Nuevo»: las `max` más recientes que
   llegaron hace `dias` o menos. Los empates (dos juegos del mismo día)
   los resuelve el orden de la lista, así que el resultado no cambia de
   una visita a otra. */
export function nuevos(entradas, ahora, { max = 4, dias = 14 } = {}) {
  return new Set(entradas
    .map((e, i) => ({ id: e.id, i, d: diasDesde(e.alta, ahora) }))
    .filter(x => x.d >= 0 && x.d <= dias)
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, max)
    .map(x => x.id));
}

/* «2», «2–10» o «1–8»: cuántos caben en una sala de ese juego. */
export const cupoTexto = j => (j.minimo || 2) === j.cupo ? String(j.cupo) : `${j.minimo || 2}–${j.cupo}`;

/* Todas las entradas del salón con la misma forma. `modo` es lo que
   distingue la miniatura: "solo" (juego del club), "bots" (práctica de un
   multijugador) o "multi" (sala en línea). `orden` es la lista de claves
   multijugador ya ordenada por popularidad (la decide `juegos-main.js`). */
export function entradasSalon(juegos, orden = Object.keys(juegos)) {
  const multi = orden.filter(k => juegos[k]).map(k => {
    const j = juegos[k];
    return {
      id: k, modo: "multi", nombre: j.nombre, lema: j.lema, color: j.color, alta: j.alta,
      genero: GENERO[k] || "", cupo: cupoTexto(j), grupo: j.cupo > 2, reglas: k,
      practica: practicaDe(k) ? practicaDe(k).id : "", movil: enMovil(k), pc: enPc(k), pide: pideEnVez(k)
    };
  });
  const solos = SOLOS.map(s => Object.assign({}, s, {
    modo: s.tipo === "bots" ? "bots" : "solo", movil: enMovil(s.id), pc: enPc(s.id), pide: pideEnVez(s.id),
    color: s.juego && juegos[s.juego] ? juegos[s.juego].color : COLOR_SOLO[s.id] || "#f6bc64"
  }));
  return { solos, multi };
}

/* El acento de cada juego del club, el mismo de su portada. */
export const COLOR_SOLO = {
  minas: "#f6bc64", snake: "#58f5c0", tetrisclub: "#2fd3e8", sortem: "#00f5ff", bbtan: "#c4f568",
  sopa: "#ffb070", electro: "#fbbf24", sudoku: "#ff2fb4", fanal: "#d9a85b", atasco: "#e8322f", aleteo: "#3fb6f5", dosmil: "#edc22e", metrorush: "#ff6a3d", tulones: "#63b8ee", frontera: "#fb923c"
};

/* Dónde se juega cada entrada: en el celular (con el dedo), en el PC
   (teclado o ratón) o en los dos. No es una lista a mano: la escribe
   `scripts/build-controles.js` en cada `npm run build`, leyendo con qué
   escucha el código de cada juego (toques, puntero, clics, flechas, ratón
   de mira), así que un juego nuevo trae sus etiquetas sin que nadie se
   acuerde de ponérselas. Cuando la lectura se equivoca, el juego lo corrige
   con un comentario `@controles:` en su propio código (sortEm lo hace).
   Una clave que no está en la tabla no se promete: ni etiqueta ni aviso. */
const plataforma = id => (typeof CONTROLES !== "undefined" && CONTROLES[id]) || null;
export const enMovil = id => !!(plataforma(id) && plataforma(id).movil);
export const enPc = id => !!(plataforma(id) && plataforma(id).pc);
/* Lo que pide en lugar del dedo («teclado», «teclado y ratón»), solo para
   lo que no va en el celular. */
export const pideEnVez = id => plataforma(id) && !plataforma(id).movil ? plataforma(id).pide : "";

/* A qué juego del salón se refiere una novedad, para ponerle las mismas
   etiquetas: el que nombra (`juego`), el de la sala que abre (`sala.k`) o
   el de un jugador cuya ruta lleva (`#solo/atasco`). PRODROP no es un
   juego del salón y se queda sin ellas. */
export function juegoDeNovedad(n) {
  if (n.juego) return n.juego;
  if (n.sala && n.sala.k) return n.sala.k;
  const s = n.ruta ? SOLOS.find(x => x.ruta === n.ruta) : null;
  return s ? s.id : "";
}

/* Lo único que un invitado puede jugar: cuatro juegos del club, por id
   del salón. Lo demás (multijugador, el resto del club y las prácticas
   contra bots) pide iniciar sesión. */
export const LIBRES_INVITADO = ["snake", "minas", "tetrisclub", "sortem"];
export const libreParaInvitado = id => LIBRES_INVITADO.includes(id);
/* Lo mismo para una ruta `#solo/<juego>` (la del Tetris es `tetris`). */
export const rutaLibre = juego => libreParaInvitado(juego === "tetris" ? "tetrisclub" : juego);

/* Si el invitado puede abrirla. */
export const bloqueado = (entrada, invitado) => !!invitado && !(entrada.modo === "solo" && libreParaInvitado(entrada.id));

/* El modo de juego que elige la barra del salón. `todos` muestra las dos
   secciones; los otros dos esconden la que sobra (las novedades se
   quedan siempre: son el escaparate). Lo guardado que no sea uno de los
   tres vuelve a `todos`. */
export const MODOS_SALON = ["todos", "solo", "multi"];
export const modoSalon = m => MODOS_SALON.includes(m) ? m : "todos";

/* Lo que un invitado deja en `localStorage` y hay que borrar al empezar
   otra visita, porque «como invitado no se guarda nada» tiene que ser
   verdad también en este navegador: los juegos del club guardan por
   cuenta (`Club.storageKey`, sufijo `.cuenta.invitado`), la Frontera su
   racha (`frontera.invitado`) y los equipos de Pokémon su copia local. */
export const UID_INVITADO = "invitado";
export const esClaveInvitado = k => typeof k === "string" && (
  k.endsWith(".cuenta." + UID_INVITADO) || k === "frontera." + UID_INVITADO ||
  k === "pk.equipos." + UID_INVITADO || k.startsWith("jg.club.pendientes." + UID_INVITADO + "."));

/* Las vistas que un invitado no puede ver y por qué: el texto del
   aviso que las sustituye. Todas leen o escriben en la base de datos. */
export const MOTIVO_CUENTA = {
  solo: { t: "Este juego necesita una cuenta", d: "Sin iniciar sesión puedes jugar a Snake, Buscaminas, Tetris y sortEm. Inicia sesión con Google y se abren todos los demás, con tus récords, logros y monedas guardados." },
  partida: { t: "Te invitaron a una partida", d: "Las partidas en línea son entre cuentas: así cada jugada queda firmada por quien la hizo. Inicia sesión y entras directo a esta sala." },
  ranks: { t: "La clasificación es para quien tiene cuenta", d: "Cada fila es una persona con sus victorias, y como invitado tus partidas no se guardan. Inicia sesión y empieza a sumar." },
  logros: { t: "Los logros se ganan con cuenta", d: "Se guardan en tu perfil y se ven en tu página pública. Como invitado juegas igual, pero no quedan registrados." },
  monedas: { t: "Las monedas viven en tu cuenta", d: "Se ganan jugando, con la recompensa diaria y con los récords, y se gastan en sobres de PRODROP. Sin cuenta no hay dónde guardarlas." },
  cartas: { t: "PRODROP necesita una cuenta", d: "Los sobres se pagan con monedas y las cartas quedan en tu colección. Inicia sesión para abrir el primero, que cada 6 horas es gratis." },
  perfil: { t: "Los perfiles son de quien tiene cuenta", d: "Inicia sesión para ver el perfil de los demás y armar el tuyo: foto, marco, fondo y vitrina." }
};
