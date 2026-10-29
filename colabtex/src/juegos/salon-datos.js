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
 * - **El invitado juega todo lo de un jugador** (`bloqueado`,
 *   `CON_CUENTA_SOLO`): el club entero, la Frontera y las prácticas contra
 *   bots, menos PRO HERO (guarda canciones y estrellas en la cuenta) y
 *   Tenkaichi 3 (su disco es privado y pide la sesión). Lo multijugador
 *   pide cuenta. Antes eran solo ocho juegos y la dueña vio que pedir
 *   cuenta tan pronto hacía que los nuevos no jugaran a nada. Los cuatro
 *   destacados (`DESTACADOS_INVITADO`: BBTAN, ALETEO, FANAL y Trigon) son
 *   los que la bienvenida del celular ofrece y cuyo puntaje se guarda si
 *   inicia sesión después. Lo bloqueado se muestra
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
  /* `tipo: "sitio"`: no es un juego del club sino una pantalla de Juegos
     que se juega solo (sin manual propio ni clasificación del club): los
     desafíos de plantilla de PRODROP. Su ayuda vive en su pantalla. */
  { id: "desafios", tipo: "sitio", nombre: "Desafío de plantilla", genero: "Cartas de fútbol", icono: "🏆", alta: "2026-10-27",
    ruta: "#cartas/retos", codigo: "juegos/prodrop", ranking: true,
    lema: "Arma un once en 4-3-3 con tus cartas de fútbol de PRODROP para el reto de la semana, la mejor plantilla o el álbum de clubes, súbelo a su clasificación y gana monedas y sobres.",
    nota: "Un reto nuevo cada lunes y una plantilla por club. Cada plantilla tiene su clasificación y tres premios, de 50 monedas y un sobre a 250 y un sobre Plus.",
    modos: ["Reto de la semana", "Mejor plantilla", "Álbum de clubes", "Premios: monedas y sobres"] },
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
  { id: "integral", tipo: "club", nombre: "Integrodle", genero: "Cálculo", icono: "∫", alta: "2026-10-21",
    ruta: "#solo/integral", reglas: "integral", popular: "club-integral", ranking: true, diario: true,
    lema: "Una integral al día, la misma para todos: seis intentos, pistas y el teclado de una calculadora.",
    modos: ["Integral del día", "Práctica por técnica"] },
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
  { id: "pokelike", tipo: "club", nombre: "Pokelike", genero: "Roguelike", icono: "◓", alta: "2026-10-12",
    ruta: "#solo/pokelike", reglas: "pokelike", popular: "club-pokelike", ranking: true,
    lema: "Roguelike de Pokémon de Kanto: un mapa distinto cada vez, ocho gimnasios, la Liga y una Ruta Infinita. Versión de prueba.",
    modos: ["Tabla de puntaje", "Tabla de Pokédex"] },
  { id: "prodefender", tipo: "club", nombre: "PRO DEFENDER", genero: "Estrategia", icono: "🛡️", alta: "2026-10-18",
    ruta: "#solo/prodefender", reglas: "prodefender", popular: "club-prodefender", ranking: true,
    lema: "Tower defense: 15 reinos de 100 rondas, 27 defensores, diez héroes, pactos, eventos y más de 70 atacantes. Cada ronda nueva de tu récord paga monedas.",
    modos: ["Un récord por reino", "Hasta 10 000 🪙 por reino"] },
  { id: "propac", tipo: "club", nombre: "PRO PACMAN", genero: "Arcade", icono: "🟡", alta: "2026-10-20",
    ruta: "#solo/propac", reglas: "propac", popular: "club-propac", ranking: true,
    lema: "El laberinto de siempre, en neón: rachas que multiplican los puntos, turbo, un pulso que aturde, compuertas que se cierran y un fantasma que salta.",
    modos: ["Tabla de puntos", "3 laberintos"] },
  { id: "protiles", tipo: "club", nombre: "PRO TILES", genero: "Ritmo", icono: "🎹", alta: "2026-10-17",
    ruta: "#solo/protiles", reglas: "protiles", popular: "club-protiles", ranking: true,
    lema: "Toca las fichas negras al ritmo de 8 canciones adaptadas a piano que nunca terminan, con piano de cola real. Un error y se acaba.",
    modos: ["Un top por canción", "Mezcla de las 8"] },
  { id: "trigon", tipo: "club", nombre: "Trigon", genero: "Puzle", icono: "🔺", alta: "2026-10-10",
    ruta: "#solo/trigon", reglas: "trigon", popular: "club-trigon", ranking: true,
    lema: "Arrastra piezas de triángulos al hexágono y completa líneas en tres direcciones. Cinco temas, de Clásico a Espacio.",
    modos: ["Tabla de puntos", "5 temas"] },
  { id: "metrorush", tipo: "club", nombre: "Metro Rush", genero: "Runner", icono: "🚇", alta: "2026-10-05",
    ruta: "#solo/metrorush", reglas: "metrorush", popular: "club-metrorush", ranking: true,
    lema: "Corre por las vías esquivando trenes, junta monedas y llega a la Estación Fantasma. Siete estaciones y un inspector que no se cansa.",
    modos: ["Carrera sin fin", "Siete estaciones", "Tienda y retos"] },
  { id: "tulonesclub", tipo: "club", nombre: "Tulones Club", genero: "Física", icono: "🩲", alta: "2026-10-09",
    ruta: "#solo/tulones", reglas: "tulones", popular: "club-tulones", ranking: false,
    lema: "Trepa sobre un pudú y sobre tus amigos congelados en calzoncillos. La torre más alta gana. De 1 a 8 en el mismo teclado.",
    modos: ["1 a 8 jugadores", "Torre sin fin"] },
  { id: "heroclub", tipo: "club", nombre: "PRO HERO", genero: "Ritmo", icono: "🎸", alta: "2026-10-12",
    ruta: "#solo/hero", reglas: "hero", popular: "club-hero", ranking: true,
    lema: "Guitarra, bajo o batería en 333 canciones de Clone Hero. Estrellas doradas en Experto, top por canción y salas en línea.",
    modos: ["Clasificación por estrellas", "Top por canción"] },
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
  { id: "bots-boxhead", tipo: "bots", juego: "boxhead", nombre: "Pro BoxHead · práctica", genero: "Acción", icono: "▣", alta: "2026-10-05",
    url: "juegos/boxhead/index.html", reglas: "boxhead",
    lema: "Tú solo contra los zombis y los diablos, en cualquiera de los cinco mapas.",
    modos: ["Supervivencia"] },
  { id: "bots-haxball", tipo: "bots", juego: "haxball", nombre: "HaxBall · práctica", genero: "Deporte", icono: "⚽", alta: "2026-10-12",
    url: "juegos/haxball/index.html", reglas: "haxball",
    lema: "Fútbol de discos contra bots, o con alguien a tu lado en el mismo teclado.",
    modos: ["Contra bots", "2 en un teclado"] },
  { id: "bots-bt3", tipo: "bots", juego: "bt3", nombre: "Tenkaichi 3 · un jugador", genero: "Pelea", icono: "🐉", alta: "2026-10-14",
    url: "juegos/bt3/index.html", ruta: "#solo/bt3", reglas: "bt3",   // (se juega dentro de Juegos: la página del juego necesita la sesión para el disco privado)
    lema: "Entrenamiento o contra la CPU, directo desde el disco; y desde ahí mismo, una sala de duelo o de torneo con tus amigos.",
    modos: ["Entrenamiento", "Contra la CPU", "Duelo", "Torneo"] },
  { id: "bots-mkw", tipo: "bots", juego: "mkw", nombre: "Mario Kart Wii · un jugador", genero: "Carreras", icono: "🏁", alta: "2026-10-18",
    url: "juegos/mkw/web/navegador/index.html", ruta: "#solo/mkw", reglas: "mkw",   // (dentro de Juegos, como BT3: su programa y su menú de inicio salen del Worker de amigos)
    lema: "Grand Prix, Contrarreloj, VS y Batalla con Retro Rewind; o en este PC con 2 a 4 mandos. Y desde su menú, las salas con tus amigos.",
    modos: ["Grand Prix", "Contrarreloj", "VS", "Batalla", "Pantalla dividida"] },
  { id: "typeraceclub", tipo: "club", nombre: "Type Race", genero: "Teclado", icono: "⌨", alta: "2026-10-27",
    ruta: "#solo/typerace", reglas: "typerace", popular: "club-typerace", ranking: true,
    lema: "Escribe contra el reloj, como en Monkeytype: palabras al azar, refranes o cuentos, en español o en inglés. Las palabras en inglés clasifican.",
    modos: ["Palabras en inglés: 10 a 200", "Frases", "Cuentos", "Libre con reloj"] }
];

/* El género que lleva la miniatura de cada multijugador, junto al número
   de jugadores: con diecinueve juegos, «Cartas» o «Tablero» ayuda a
   elegir más que el nombre solo. */
export const GENERO = {
  orbita: "Física", escondite: "Búsqueda", cartas: "Cartas", cuadritos: "Tablero",
  worms: "Artillería", reversi: "Tablero", gato: "Tablero", cadena: "Estrategia", flip7: "Cartas",
  cacho: "Dados", uno: "Cartas", catan: "Tablero", presidente: "Cartas",
  spicy: "Faroleo", tetris: "Reflejos", yemas: "Acción", clue: "Deducción",
  ajedrez: "Tablero", pokemon: "Combate", boxhead: "Acción", haxball: "Deporte", bt3: "Pelea", mkw: "Carreras", tulones: "Física", hero: "Ritmo", memazo: "Fiesta", typerace: "Teclado", pool: "Deporte"
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
  desafios: "#3ccf6e",
  minas: "#f6bc64", snake: "#58f5c0", tetrisclub: "#2fd3e8", sortem: "#00f5ff", bbtan: "#c4f568",
  sopa: "#ffb070", electro: "#fbbf24", integral: "#2c5aa8", sudoku: "#ff2fb4", fanal: "#d9a85b", atasco: "#e8322f", aleteo: "#3fb6f5", dosmil: "#edc22e", trigon: "#f6d23c", typeraceclub: "#e2b714", protiles: "#ff5a36", pokelike: "#e3350d", metrorush: "#ff6a3d", tulonesclub: "#63b8ee", heroclub: "#ffb21e", prodefender: "#ffcf4d", propac: "#ffe14d", frontera: "#fb923c"
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

/* Los cuatro juegos que se le ofrecen al invitado (la bienvenida del
   celular, el principio del carrusel): se juegan sin cuenta y, si después
   inicia sesión, su puntaje y su partida pasan a la cuenta (DE_INVITADO en
   verifica.js, `subeDeInvitado` en juegos-main.js). Son ids del salón y,
   a la vez, de la ruta `#solo/<x>`. */
export const DESTACADOS_INVITADO = ["bbtan", "aleteo", "fanal", "trigon"];
/* Lo de un jugador que sigue pidiendo cuenta al invitado, por id del
   salón: PRO HERO (sus canciones viven en Storage y sus estrellas en la
   cuenta, por decisión de la dueña) y Tenkaichi 3 (el disco es privado).
   Todo lo demás de un jugador se juega sin cuenta y sin guardar nada. */
export const CON_CUENTA_SOLO = ["heroclub", "bots-bt3", "desafios"];
export const libreParaInvitado = id => SOLOS.some(s => s.id === id) && !CON_CUENTA_SOLO.includes(id);
/* Lo mismo para una ruta `#solo/<juego>` (la del Tetris es `tetris`, la
   de PRO HERO `hero`): se busca la entrada que la lleva. */
export const rutaLibre = juego => {
  const s = SOLOS.find(x => x.ruta === "#solo/" + juego);
  return !!s && libreParaInvitado(s.id);
};

/* Si el invitado puede abrirla. */
export const bloqueado = (entrada, invitado) => !!invitado && !(entrada.modo !== "multi" && libreParaInvitado(entrada.id));

/* El nombre del invitado: se le pide al empezar a jugar (la bienvenida
   del celular o el primer juego que abre) y se ve en el saludo, la barra
   del juego y la Frontera. Vive solo en la pestaña (`sessionStorage`):
   como todo lo del invitado, la próxima visita empieza de cero. Sin
   etiquetas ni controles, con los espacios juntos y a lo más 20
   caracteres; vacío vuelve al sugerido. */
export const NOMBRE_INVITADO_MAX = 20;
export function limpiaNombreInvitado(s) {
  return Array.from(String(s == null ? "" : s).replace(/\s+/g, " ").replace(/[\u0000-\u001f\u007f<>]/g, "").trim())
    .slice(0, NOMBRE_INVITADO_MAX).join("").trim();
}
const ANIMALES_INVITADO = ["Pudú", "Cóndor", "Huemul", "Zorro", "Puma", "Pingüino", "Chinchilla", "Llama", "Delfín", "Búho", "Colibrí", "Quirquincho"];
/* «Pudú 27»: uno sugerido, para que jugar siga a un toque. `azar` es
   inyectable (Math.random por defecto) para probarlo en Node. */
export function sugiereNombreInvitado(azar = Math.random) {
  const a = ANIMALES_INVITADO[Math.floor(azar() * ANIMALES_INVITADO.length) % ANIMALES_INVITADO.length];
  return a + " " + (10 + Math.floor(azar() * 90) % 90);
}

/* Lo primero que ve alguien nuevo tiene que poder jugarse ahí mismo. Al
   invitado, lo que pide cuenta va después; en el celular, lo que solo se
   juega en el PC (`soloPc`) también. Es un orden estable: dentro de cada
   grupo manda el de antes (el de la dueña en las novedades, la
   popularidad en el catálogo). Con cuenta y en el PC no cambia nada. Antes
   la primera diapositiva que veía un invitado en el teléfono era Pro
   BoxHead: multijugador, solo PC y con «Iniciar sesión y jugar». */
export const novedadPideCuenta = n => !!n.cuenta || !(n.ruta && n.ruta.startsWith("#solo/") && rutaLibre(n.ruta.slice(6)));
const idSoloPc = id => !!id && enPc(id) && !enMovil(id);
export const soloPc = e => !e.movil && !!e.pc;
const ordenEstable = (lista, peso) => lista.map((x, i) => ({ x, i, p: peso(x) })).sort((a, b) => a.p - b.p || a.i - b.i).map(o => o.x);
export function ordenaNovedades(lista, { invitado = false, celular = false } = {}) {
  return ordenEstable(lista, n => (invitado && novedadPideCuenta(n) ? 2 : 0) + (celular && idSoloPc(juegoDeNovedad(n)) ? 1 : 0));
}
export function ordenaEntradas(entradas, { invitado = false, celular = false } = {}) {
  return ordenEstable(entradas, e => (bloqueado(e, invitado) ? 2 : 0) + (celular && soloPc(e) ? 1 : 0));
}

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
  solo: { t: "Este juego necesita una cuenta", d: "Sin iniciar sesión puedes jugar a todos los demás juegos de un jugador. Este guarda tu avance en tu cuenta: inicia sesión con Google y se abre, con tus récords, logros y monedas guardados." },
  partida: { t: "Te invitaron a una partida", d: "Las partidas en línea son entre cuentas: así cada jugada queda firmada por quien la hizo. Inicia sesión y entras directo a esta sala." },
  ranks: { t: "La clasificación es para quien tiene cuenta", d: "Cada fila es una persona con sus victorias, y como invitado tus partidas no se guardan. Inicia sesión y empieza a sumar." },
  logros: { t: "Los logros se ganan con cuenta", d: "Se guardan en tu perfil y se ven en tu página pública. Como invitado juegas igual, pero no quedan registrados." },
  monedas: { t: "Las monedas viven en tu cuenta", d: "Se ganan jugando, con la recompensa diaria y con los récords, y se gastan en sobres de PRODROP. Sin cuenta no hay dónde guardarlas." },
  cartas: { t: "PRODROP necesita una cuenta", d: "Los sobres se pagan con monedas y las cartas quedan en tu colección. Inicia sesión para abrir el primero, que cada 6 horas es gratis." },
  mercado: { t: "El mercado es entre cuentas", d: "Aquí se compran, se venden y se intercambian cartas de PRODROP, mascotas y sus cosas, con las monedas que ganas jugando. Inicia sesión para entrar." },
  mascotas: { t: "Mascotas necesita una cuenta", d: "Tus mascotas, su ropa y sus muebles viven en tu cuenta, y se pagan con las monedas que ganas jugando. Inicia sesión y adopta la primera: es gratis." },
  casino: { t: "El casino juega con tus monedas", d: "Las apuestas se pagan con las monedas que ganas jugando y los premios vuelven a tu cuenta. Inicia sesión para subirte al avión o hacer saltar al pingüino." },
  perfil: { t: "Los perfiles son de quien tiene cuenta", d: "Inicia sesión para ver el perfil de los demás y armar el tuyo: foto, marco, fondo y vitrina." }
};

/* Salas «trabajando para usted» (el dueño, 2026-10-27: «el multiplayer
   está totalmente roto, ocúltalo por ahora y ponle trabajando para
   usted»). Un juego de esta lista no abre salas: su ficha muestra el
   cartel y, si lo tiene, el camino para jugar solo mientras tanto
   (`solo`); las salas que esperan no se ofrecen ni se puede entrar a
   ellas, y quien llega por un enlace ve el cartel. Para volver a
   abrirlas, se borra la línea del juego. */
export const SALAS_EN_OBRA = { mkw: { solo: "#solo/mkw" } };
