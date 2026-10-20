/*
 * El buscador del salón: qué juego se parece más a lo que alguien
 * escribió, en orden.
 *
 * No busca el texto literal en el nombre. Cada juego tiene varios campos
 * con su peso —el nombre, sus apodos («buscaminas», «flappy», «tres en
 * raya»), el género, unas etiquetas que salen de la propia entrada (un
 * jugador, multijugador, duelo, celular, reto diario…), sus modalidades y
 * su lema— y cada palabra de la consulta suma lo que valga su mejor
 * coincidencia: igual, el principio de la palabra (se va escribiendo),
 * con una letra cambiada (tipeo) o metida dentro de otra. Así «piano»
 * trae PRO TILES, «zombis» Boxhead y Yemas, «cartas celular» los de
 * cartas que se juegan con el dedo, y «tetirs» el Tetris.
 *
 * El texto decide; la popularidad (`popular`) y lo nuevo solo desempatan,
 * con un tope de 2.5 puntos, menos que lo que separa un acierto en el
 * nombre de uno en el lema. Con «cartas», que es el género de cinco
 * juegos, salen primero los que más se juegan.
 *
 * Puro, sin DOM: `tests/buscador.test.cjs` lo carga en Node. El índice se
 * arma con las mismas entradas que pinta el salón (`entradasSalon`), así
 * que un juego nuevo se busca solo; sus apodos van en `APODOS`.
 */

/* Minúsculas, sin tildes ni signos: «Órbita», «orbita» y «ÓRBITA!» son
   la misma palabra. La ñ se queda (los apodos no la usan para otra cosa). */
export function normaliza(t) {
  return String(t == null ? "" : t).toLowerCase()
    .replace(/ñ/g, "\u0001").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\u0001/g, "ñ")
    .replace(/[^a-z0-9ñ]+/g, " ").trim();
}
const palabras = t => normaliza(t).split(" ").filter(Boolean);

/* Lo que no dice nada de qué juego se busca. «juego» sobra en un
   buscador de juegos; «un» sobra en «un jugador» (queda «jugador»). */
const VACIAS = new Set(("de del la las el los lo un una unos unas y o u a al en con sin para por que " +
  "juego juegos jugar juega quiero busco algo me mi se es como game games").split(" "));

/* Los otros nombres con que se conoce cada juego (el original en que se
   inspira, cómo le dice la gente) y de qué va, en palabras que alguien
   escribiría. La clave es el id del salón; las prácticas contra bots
   usan las de su juego. */
export const APODOS = {
  minas: "buscaminas minesweeper minas bombas banderas",
  snake: "culebra serpiente viborita gusano",
  tetrisclub: "tetris bloques piezas lineas maraton sprint",
  sortem: "ordenar numeros bloques fusionar",
  bbtan: "pelotas bolas ladrillos rebote breakout",
  sopa: "palabras letras buscar diccionario",
  electro: "wordle adivinar electronica componentes formulas simbolos",
  sudoku: "numeros logica",
  fanal: "luz farol disparos shooter bullet hell polillas",
  atasco: "rush hour autos estacionamiento trafico deslizar",
  aleteo: "flappy bird pajaro pajarito volar tubos",
  dosmil: "2048 numeros fichas deslizar",
  pokelike: "pokemon roguelike kanto medallas gimnasios",
  protiles: "piano tiles musica canciones teclas",
  trigon: "triangulos hexagono block blast piezas",
  metrorush: "subway surfers tren trenes correr runner monedas",
  tulonesclub: "tulones escalar trepar torre fisica calzoncillos pudu",
  heroclub: "guitar hero clone hero guitarra bajo bateria musica canciones",
  prodefender: "tower defense torres defensa bloons td estrategia reinos oleadas",
  propac: "pacman pac-man laberinto fantasmas arcade neon puntos comecocos",
  frontera: "pokemon batalla torre palacio fabrica esmeralda",
  orbita: "gravedad espacio planetas sondas estrellas satelites",
  escondite: "esconder buscar escondidas paisaje",
  cartas: "card jitsu fuego agua nieve elementos club penguin",
  cuadritos: "timbiriche puntos cajas dots boxes rayas",
  worms: "worms artilleria gusanos explosiones bazuca",
  reversi: "othello fichas",
  gato: "tres en raya tic tac toe tateti super gato",
  memazo: "make it meme memes plantillas humor risa chistes fiesta party votar",
  cadena: "chain reaction reaccion atomos explosiones",
  flip7: "flip seven cartas numeros suerte",
  cacho: "dados dudo calzo perudo cachito",
  uno: "uno no mercy cartas colores",
  catan: "colonos colonizar isla recursos comercio",
  presidente: "culo cartas presidente",
  spicy: "faroleo mentir picante bluff",
  tetris: "tetris versus bloques",
  yemas: "huevos shooter disparos primera persona zombis fps",
  clue: "cluedo detective misterio asesinato crimen",
  ajedrez: "chess jaque mate",
  pool: "billar pool ocho bolas 8 ball bola ocho mesa taco lisas rayadas",
  pokemon: "pokemon showdown combates equipos entrenador",
  boxhead: "box head zombis demonios disparos armas",
  haxball: "futbol soccer pelota arco goles",
  bt3: "dragon ball budokai tenkaichi goku pelea ps2",
  tulones: "escalar trepar torre fisica calzoncillos pudu",
  hero: "guitar hero clone hero guitarra bajo bateria musica canciones",
  mascotas: "tamagotchi crianza criar mascota gallina gato 3d adoptar",
  prodrop: "sobres cartas coleccionables coleccion stickers album"
};

/* Peso de cada campo. El nombre manda; el lema apenas empuja. */
export const PESOS = { nombre: 10, apodo: 8, genero: 6, etiqueta: 4, modo: 3, lema: 2 };

/* Las etiquetas salen de la entrada, no de una lista a mano: así
   «celular» o «duelo» siguen siendo verdad cuando un juego cambia. */
function etiquetas(e) {
  const t = [];
  if (e.modo === "solo") t.push("solo un jugador individual");
  if (e.modo === "bots") t.push("solo un jugador practica bots maquina cpu");
  if (e.modo === "multi") t.push("multijugador jugadores amigos online linea sala", e.grupo ? "grupo fiesta varios" : "duelo dos 2 contra");
  if (e.movil) t.push("celular movil telefono tactil");
  if (e.pc) t.push("pc computador computadora teclado");
  if (e.diario) t.push("diario reto dia");
  if (e.ranking) t.push("ranking record clasificacion");
  if (e.sitio) t.push(e.sitio);
  return t.join(" ");
}

/* Un campo indexado: sus palabras y, si tiene varias, también todas
   juntas («pro tiles» → «protiles», «flip 7» → «flip7»). */
function campo(texto) {
  const ps = palabras(texto);
  return ps.length > 1 ? ps.concat(ps.join("")) : ps;
}

/* El índice: una fila por entrada con sus campos ya partidos. `entradas`
   tiene la forma de `entradasSalon` (más las de sitio, si las hay). */
export function indiceBusqueda(entradas) {
  return entradas.map(e => ({
    e,
    nombreN: palabras(e.nombre).join(""),
    campos: {
      nombre: campo(e.nombre),
      apodo: palabras(APODOS[e.id] || (e.juego && APODOS[e.juego]) || ""),
      genero: palabras(e.genero),
      etiqueta: palabras(etiquetas(e)),
      modo: palabras((e.modos || []).join(" ")),
      lema: palabras(typeof e.lema === "string" ? e.lema : "")
    }
  }));
}

/* Distancia de edición con transposiciones (Damerau, la de «alineación
   óptima»): «tetirs» está a uno de «tetris», como cualquier tipeo de dos
   letras cruzadas. Con tope: pasado `max` da max+1, que es todo lo que
   hace falta saber. */
export function distancia(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let ant2 = null, ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    let menor = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(ant[j] + 1, fila[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (ant2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, ant2[j - 2] + 1);
      fila[j] = v;
      if (v < menor) menor = v;
    }
    if (menor > max) return max + 1;
    ant2 = ant; ant = fila;
  }
  return ant[b.length];
}

/* Cuánto se parece la palabra buscada `t` a la palabra del índice `w`,
   de 0 a 1. `corta` deja que una sola letra cuente como principio (solo
   en el nombre: «u» → UNO, pero no cualquier lema con «u»). */
export function parecido(t, w, corta = false) {
  if (t === w) return 1;
  if (w.startsWith(t) && (t.length >= 2 || corta)) return 0.85;
  /* Lo difuso pide palabras de cinco letras o más y la misma primera
     letra: con menos, «tren» se parecía a «tres» y «solo» a «colores». */
  if (t.length >= 5 && w.length >= 4 && t[0] === w[0]) {
    if (distancia(t, w, 1) <= 1) return 0.65;
    if (t.length >= 8 && distancia(t, w, 2) <= 2) return 0.5;
    /* Un tipeo mientras todavía se escribe: «tetir» → «tetris». */
    if (w.length > t.length && distancia(t, w.slice(0, t.length), 1) <= 1) return 0.55;
  }
  /* Metida dentro de otra («jugador» en «multijugador»): apenas suma. */
  if (t.length >= 3 && w.includes(t)) return 0.3;
  return 0;
}

/* Busca. Devuelve las entradas que se parecen a algo de la consulta, de
   más a menos, cada una con su puntaje y el motivo (la palabra de un
   apodo o una modalidad que coincidió, para decir por qué salió).
   `popular(e)` da cuánto se juega cada entrada (cualquier escala) y
   `nuevo(e)` si lleva la etiqueta de nuevo. */
export function buscaJuegos(indice, consulta, { popular = () => 0, nuevo = () => false, max = 12 } = {}) {
  const todas = palabras(consulta);
  const ts = todas.filter(t => !VACIAS.has(t));
  /* Una sola palabra vacía puede ser el principio de un nombre que se
     está escribiendo («u» → UNO); varias, no dicen nada. */
  const q = ts.length ? ts : todas.length === 1 ? todas : [];
  if (!q.length) return [];
  const juntas = q.join("");
  const pops = indice.map(f => Math.max(0, Number(popular(f.e)) || 0));
  const tope = Math.log2(1 + Math.max(0, ...pops)) || 1;
  const salida = [];
  indice.forEach((f, i) => {
    let suma = 0, hallados = 0, motivo = "", mejorMotivo = 0;
    for (const t of q) {
      let mejor = 0, donde = "", palabra = "";
      for (const [nombre, ws] of Object.entries(f.campos)) {
        const peso = PESOS[nombre];
        if (peso <= mejor) continue;
        for (const w of ws) {
          const v = peso * parecido(t, w, nombre === "nombre");
          if (v > mejor) { mejor = v; donde = nombre; palabra = w; }
        }
      }
      if (mejor > 0) {
        suma += mejor; hallados++;
        /* Se cuenta el motivo solo si no está ya a la vista en la fila
           (el nombre, el género y el modo se ven igual). */
        const visto = f.campos.genero.includes(palabra) || f.campos.nombre.includes(palabra);
        if ((donde === "apodo" || donde === "modo" || donde === "lema") && !visto && mejor > mejorMotivo) { mejorMotivo = mejor; motivo = palabra; }
      }
    }
    if (!hallados) return;
    /* Lo que no encontró ninguna palabra resta en proporción: con dos
       palabras, el juego que tiene las dos va antes que el que tiene una. */
    let texto = suma * (hallados / q.length);
    if (f.nombreN === juntas) texto += 15;
    else if (f.nombreN.startsWith(juntas)) texto += juntas.length >= 2 ? 6 : 3;
    /* La práctica contra bots es la versión chica de un multijugador: a
       igual texto, va después de su juego. */
    const extra = 2 * Math.log2(1 + pops[i]) / tope + (nuevo(f.e) ? 0.5 : 0) - (f.e.modo === "bots" ? 0.6 : 0);
    salida.push({ e: f.e, puntos: texto + extra, texto, motivo });
  });
  /* Lo que apenas roza (una palabra metida dentro de otra en el lema)
     no es un resultado, y lo que queda muy por debajo del mejor tampoco:
     con «piano» no hace falta la lista entera. */
  const mejor = Math.max(0, ...salida.map(r => r.texto));
  /* Empate exacto: el orden del índice (el del salón), estable. */
  return salida.filter(r => r.texto >= 1 && r.texto >= mejor * 0.25)
    .sort((a, b) => b.puntos - a.puntos).slice(0, max);
}
