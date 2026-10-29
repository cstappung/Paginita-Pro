/* Ranks — la clasificación de cada juego.
 *
 * Cada uno escribe solo su propia fila (`ranks/<juego>/<uid>`, y las
 * reglas no dejan tocar la de nadie más), así que la tabla es la suma de
 * lo que cada navegador ha ido apuntando de sí mismo. Eso tiene un precio
 * que conviene decir en voz alta y que la propia página dice: quien cierra
 * la pestaña antes de que la partida termine no se apunta esa partida. La
 * alternativa —un servidor que arbitre— es exactamente lo que este sitio
 * no tiene, y falsear la fila del rival sigue sin poderse, que es lo que
 * de verdad importa.
 *
 * Se ordena por puntos y no por victorias porque con victorias a secas
 * gana quien más juega; con 3/1/0 gana quien mejor juega. Y se enseña
 * también el porcentaje, que es lo que de verdad se compara cuando uno
 * lleva 200 partidas y otro 6.
 *
 * Encima de la tabla va el podio, y no es adorno: una tabla dice quién va
 * primero, pero no da ganas de ser el primero. El podio pone al #1 más alto
 * que nadie, con corona y la peana de oro, y deja a la vista los puestos
 * libres («¿tú?»), que es la invitación más directa que hay. Debajo, la
 * tarjeta de «tu posición» convierte la distancia en algo que se puede
 * hacer: no «vas quinto», sino «dos victorias y entras al podio».
 */
import { JUEGOS, ordenaRanks, porcentaje } from "./motor.js";
import { mezcla } from "./perfil.js";
import { rankingColeccion, topColecciones, colVisible, PUNTOS_RAREZA, miniCarta, MOTOR } from "./prodrop-cartas.js";
import { avatarMarco, marcoDeUid } from "./perfil-vista.js";
import { nombreHtml } from "./tintas.js";
import { podiosGeneral, MIN_PODIO } from "./perfil-tarjeta.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Los tres metales, en el orden del puesto. */
const METAL = ["oro", "plata", "bronce"];
const TITULO = ["Campeón", "Subcampeón", "Tercer puesto"];
const EXTRA = { yzombis: { nombre: "Yemas zombis", color: "#7bd34a", sala: true }, minas: { nombre: "Mina Club", color: "#eeb765" }, snake: { nombre: "Snake Club", color: "#4be9bc" }, tetrisclub: { nombre: "Tetris Club", color: "#b04ee8" }, sortem: { nombre: "sortEm", color: "#ff006e" }, bbtan: { nombre: "BBTAN", color: "#c4f568" }, sopa: { nombre: "Sopa de letras", color: "#5b8cff" }, electro: { nombre: "Electrodle", color: "#f5a524" }, integral: { nombre: "Integrodle", color: "#2c5aa8" }, frontera: { nombre: "Frontera Batalla", color: "#e0743a" }, sudoku: { nombre: "Sudoku Arcade", color: "#ff2fb4" }, fanal: { nombre: "FANAL", color: "#d9a85b" }, atasco: { nombre: "Atasco", color: "#e8322f" }, aleteo: { nombre: "ALETEO", color: "#3fb6f5" }, dosmil: { nombre: "2048", color: "#edc22e" }, trigon: { nombre: "Trigon", color: "#f6d23c" }, typeraceclub: { nombre: "Type Race", color: "#e2b714" }, protiles: { nombre: "PRO TILES", color: "#ff5a36" }, pokelike: { nombre: "Pokelike", color: "#e3350d" }, metrorush: { nombre: "Metro Rush", color: "#ff6a3d" } , hero: { nombre: "PRO HERO", color: "#ffb21e" }, prodefender: { nombre: "PRO DEFENDER", color: "#ffcf4d" }, propac: { nombre: "PRO PACMAN", color: "#ffe14d" }};

/* Las categorías de los juegos individuales, como botones y no como un
   desplegable: son pocas, se leen de un vistazo y cambiar de una a otra
   es un toque. Solo las que existen hoy — las del archivo viejo eran de
   juegos que ya no están. Snake tiene dos filas (modo y mapa) porque su
   récord es de la pareja; Zen no puntúa y no sale. */
const SOLO = {
  /* Yemas zombis se juega en sala pero clasifica como un récord: la ronda
     a la que llegó la sala, una tabla por mapa. */
  yzombis: { filas: [{ k: "n", t: "Mapa", ops: [["nacht", "Nacht der Untoten"], ["kino", "Kino der Toten"], ["nuketown", "Nuketown"], ["riese", "Der Riese"], ["pueblo", "Pueblo"]] }],
    cat: s => `yemas-zombis-${s.n}` },
  minas: { filas: [{ k: "n", t: "Dificultad", ops: [["easy", "Fácil"], ["medium", "Medio"], ["hard", "Difícil"]] }],
    cat: s => `club-minas-${s.n}` },
  tetrisclub: { filas: [{ k: "n", t: "Modo", ops: [["maraton", "Maratón"], ["sprint", "Sprint 40"], ["ultra", "Ultra 2 min"]] }],
    cat: s => `club-tetris-${s.n}` },
  sortem: { filas: [{ k: "n", t: "Números", ops: [["10", "Del 1 al 10"], ["20", "Del 1 al 20"]] }],
    cat: s => `club-sortem-${s.n}` },
  bbtan: { filas: [{ k: "n", t: "Récord", ops: [["rondas", "Ronda máxima"]] }],
    cat: s => `club-bbtan-${s.n}` },
  /* La racha diaria es una tabla sola; las libres van por dificultad y
     tamaño, y con «Racha diaria» elegida el tamaño no cuenta. */
  sopa: { filas: [
      { k: "m", t: "Tabla", ops: [["racha", "Racha diaria"], ["facil", "Libre · Fácil"], ["medio", "Libre · Medio"], ["dificil", "Libre · Difícil"]] },
      { k: "t", t: "Tamaño", ops: [["8", "8×8"], ["12", "12×12"], ["15", "15×15"]], si: e => e.m !== "racha" }],
    cat: s => s.m === "racha" ? "club-sopa-racha" : `club-sopa-${s.m}-${s.t}`, def: { t: "12" } },
  /* Electrodle: los puntos que se acumulan día a día, o la racha. */
  electro: { filas: [{ k: "n", t: "Tabla", ops: [["puntos", "Puntos totales"], ["racha", "Racha diaria"]] }],
    cat: s => `club-electro-${s.n}` },
  integral: { filas: [{ k: "n", t: "Tabla", ops: [["puntos", "Puntos totales"], ["racha", "Racha diaria"]] }],
    cat: s => `club-integral-${s.n}` },
  /* Frontera Batalla: la mejor racha por instalación y nivel, o el total
     de combates ganados (que no tiene nivel). */
  frontera: { filas: [
      { k: "i", t: "Instalación", ops: [["torre", "Torre Batalla"], ["palacio", "Palacio Batalla"], ["fabrica", "Fábrica Batalla"], ["victorias", "Victorias totales"]] },
      { k: "n", t: "Nivel", ops: [["50", "Nivel 50"], ["abierto", "Nivel Abierto"]], si: e => e.i !== "victorias" }],
    cat: s => s.i === "victorias" ? "club-frontera-victorias" : `club-frontera-${s.i}-${s.n}`, def: { n: "50" } },
  /* Sudoku Arcade: la racha del diario (días), el arcade (puntos) y el
     clásico por dificultad (tiempo). Una sola fila: cada opción ya es
     una tabla. */
  sudoku: { filas: [{ k: "m", t: "Tabla", ops: [["racha", "Racha diaria"], ["arcade", "Arcade"], ["facil", "Clásico · Fácil"], ["medio", "Clásico · Medio"], ["dificil", "Clásico · Difícil"], ["experto", "Clásico · Experto"]] }],
    cat: s => `club-sudoku-${s.m}` },
  /* FANAL: la travesía y el sin fin por puntos; la jornada más lejana por
     jornadas (la historia termina en la 13, el sin fin sigue). */
  fanal: { filas: [{ k: "m", t: "Tabla", ops: [["jornadas", "Jornada más lejana"], ["travesia", "Travesía"], ["sinfin", "Sin fin (hasta oct. 2026)"]] }],
    cat: s => `club-fanal-${s.m}` },
  /* Atasco: una sola tabla, las estrellas de todos los niveles. */
  atasco: { filas: [{ k: "n", t: "Tabla", ops: [["estrellas", "Estrellas"]] }],
    cat: s => `club-atasco-${s.n}` },
  aleteo: { filas: [{ k: "n", t: "Tabla", ops: [["vuelo", "Vuelo"]] }],
    cat: s => `club-aleteo-${s.n}` },
  dosmil: { filas: [{ k: "n", t: "Tabla", ops: [["puntos", "Puntos"], ["ficha", "Ficha"]] }],
    cat: s => `club-dosmil-${s.n}` },
  trigon: { filas: [{ k: "n", t: "Modo", ops: [["puntos", "Fácil"], ["normal", "Normal"]] }],
    cat: s => `club-trigon-${s.n}` },
  /* Type Race: una tabla por largo, solo palabras al azar en inglés (ppm); la de 50 es la estándar. */
  typeraceclub: { filas: [{ k: "n", t: "Palabras", ops: [["10", "10"], ["25", "25"], ["50", "50"], ["100", "100"], ["200", "200"]] }],
    def: { n: "50" }, cat: s => `club-typerace-en-${s.n}` },
  /* PRO TILES: un top por canción y otro para la mezcla de las ocho. */
  protiles: { filas: [{ k: "n", t: "Canción", ops: [["cristal", "Cristal"], ["medianoche", "Medianoche"], ["calle", "Calle"], ["verano", "Verano"], ["neon", "Neón"], ["latido", "Latido"], ["estrellas", "Estrellas"], ["despegue", "Despegue"], ["mezcla", "Todas (mezcla)"]] }],
    cat: s => `club-protiles-${s.n}` },
  /* Pokelike: el puntaje de la run y las especies distintas atrapadas en ella. */
  pokelike: { filas: [{ k: "n", t: "Tabla", ops: [["puntos", "Puntaje"], ["pokedex", "Pokédex"]] }],
    cat: s => `club-pokelike-${s.n}` },
  /* PRO HERO: una sola tabla, la general por estrellas doradas (hero.js). */
  hero: { filas: [{ k: "n", t: "Tabla", ops: [["estrellas", "Estrellas doradas"]] }],
    cat: s => `club-hero-${s.n}` },
  /* PRO DEFENDER: la ronda récord de cada reino. */
  prodefender: { filas: [{ k: "n", t: "Reino", ops: [["prado", "Prado Esmeralda"], ["dunas", "Dunas de Ámbar"], ["glaciar", "Glaciar Cristal"], ["caldera", "Caldera Volcánica"], ["vacio", "Nexo del Vacío"], ["pantano", "Pantano Sombrío"], ["cumbres", "Cumbres Tormentosas"], ["fosa", "Fosa Abisal"], ["engranajes", "Ciudadela de Engranajes"], ["eclipse", "Trono del Eclipse"], ["necropolis", "Necrópolis Olvidada"], ["esporas", "Jardín de Esporas"], ["espejos", "Laberinto de Espejos"], ["archipielago", "Archipiélago Celeste"], ["noche", "La Noche Eterna"]] }],
    cat: s => `club-prodefender-${s.n}` },
  /* PRO PACMAN: una sola tabla, el puntaje de la partida. */
  propac: { filas: [{ k: "n", t: "Tabla", ops: [["puntos", "Puntos"]] }],
    cat: s => `club-propac-${s.n}` },
  /* Metro Rush: una fila «Modo» con la mejor carrera de cada modo normal
     (carrera es el clásico) y la carrera más larga de cada mundo, en metros
     (Distancia la Línea 3, City distancia City: ahí corren también los modos
     fantasma, que no tienen tabla propia). */
  metrorush: { filas: [{ k: "m", t: "Modo", ops: [["carrera", "Clásico"], ["distancia", "Distancia"], ["puro", "Sin ayudas"], ["sinmonedas", "Sin monedas"], ["city", "City"], ["citydistancia", "City distancia"], ["citypuro", "City sin ayudas"]] }],
    cat: s => `club-metrorush-${s.m}` },
  snake: { filas: [
      { k: "m", t: "Modo", ops: [["classic", "Clásico"], ["arcade", "Arcade"], ["portals", "Portales"], ["reloj", "Contrarreloj"], ["espejo", "Espejo"], ["laberinto", "Laberinto"]] },
      { k: "t", t: "Mapa", ops: [["chico", "Chico"], ["mediano", "Mediano"], ["grande", "Grande"], ["gigante", "Gigante"]] }],
    cat: s => `club-snake-${s.m}-${s.t}`, def: { t: "grande" } }
};
const esSolo = k => !!SOLO[k];

/* Las categorías del club que existen hoy: todas las combinaciones de las
   filas de SOLO. Las de versiones viejas (el Snake de antes, el buscaminas
   de antes) siguen en la base, pero ya no salen en la general ni en el
   perfil (juegos-main.js lo pasa a los datos como `vigente`). */
const VIGENTES = (() => {
  const s = new Set();
  for (const d of Object.values(SOLO)) {
    let combos = [Object.assign({}, d.def || {})];
    for (const f of d.filas) combos = combos.flatMap(e => f.ops.map(([v]) => Object.assign({}, e, { [f.k]: v })));
    for (const e of combos) s.add(d.cat(e));
  }
  return s;
})();
export const categoriaVigente = c => VIGENTES.has(String(c));

/* La corona es SVG dibujado, no un emoji: cada sistema pinta 👑 a su
   tamaño y su color, y aquí tiene que brillar en el oro del podio. */
const CORONA = `<svg class="jg-rk-corona" viewBox="0 0 64 44" aria-hidden="true">
  <defs><linearGradient id="rkOro" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff6c4"/><stop offset=".45" stop-color="#f4c542"/><stop offset="1" stop-color="#a86f10"/></linearGradient></defs>
  <path d="M4 14 L18 26 L32 4 L46 26 L60 14 L54 40 H10 Z" fill="url(#rkOro)" stroke="#7a4f08" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="4" cy="14" r="3.6" fill="#fff0a0" stroke="#7a4f08" stroke-width="1.5"/>
  <circle cx="32" cy="4" r="3.6" fill="#fff0a0" stroke="#7a4f08" stroke-width="1.5"/>
  <circle cx="60" cy="14" r="3.6" fill="#fff0a0" stroke="#7a4f08" stroke-width="1.5"/>
  <circle cx="32" cy="30" r="4.4" fill="#e0245e" stroke="#7a1030" stroke-width="1.2"/>
  <circle cx="18" cy="32" r="2.8" fill="#2f7cf6"/><circle cx="46" cy="32" r="2.8" fill="#2f7cf6"/>
</svg>`;

/* Cuántas victorias son `n` puntos: cada una vale 3. */
const victorias = n => Math.max(1, Math.ceil(n / 3));
/* No «cartas»: esa clave ya es la de Cartas de los tres elementos. */
const CARTAS = "prodrop";
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function crearRanks(ctx) {
  const { uid, watchRanks } = ctx;
  /* La fila de la clasificación guarda el nombre y la foto del día
     en que se apuntó la partida — y su `foto` no puede pasar de 400
     caracteres, así que una foto subida no cabe ahí de ninguna
     manera. El perfil vivo se pone encima al pintar; sin resolutor
     se pinta la fila tal cual, que es lo que había. */
  const perfil = ctx.perfil || (() => null);

  let host = null, muerto = false;
  /* Se abre en lo último que se miró —o en lo que pidió el vestíbulo al
     tocar el podio de su tarjeta—, y si no, en la general: la pregunta
     de quien entra aquí es «¿quién va ganando?», no «¿quién va ganando
     a Órbita?», que era lo que contestaba por ser el primero del objeto. */
  let juego = "general";
  try { const g = localStorage.getItem("jg.rankJuego"); if (g && (g === "general" || g === CARTAS || JUEGOS[g] || EXTRA[g])) juego = g; } catch (e) { /* sin almacenamiento */ }
  const icono = ctx.icono || {};
  let categoriaSolo = "";
  const eleccion = {};
  let filas = [];
  let cargando = true;
  let fallo = "";
  let parar = null;
  /* La entrada del podio (peanas que suben, corona que cae) se anima una
     vez por juego, no en cada repintado: llegan perfiles después de la
     tabla y cada uno repinta, y el podio no puede estar subiendo sin fin. */
  let animado = "";
  let firma = "";
  /* La pestaña de cartas no lee `ranks`: sale de la economía de PRODROP
     (`ctx.datos`, la misma lectura que usa el vestíbulo). */
  let datosC = null, pararC = null, firmaC = "";
  /* La colección elegida en esa pestaña, y de quién se está mirando la
     colección completa («Ver colección», una a la vez). */
  let colC = "", verC = "";
  try { colC = localStorage.getItem("jg.rankCol") || ""; } catch (e) { /* sin almacenamiento */ }

  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-ranks">
        <div class="jg-bar-juegos" id="rkJuegos"></div>
        <div id="rkSolo"></div><div id="rkAviso"></div>
        <div id="rkCartas" hidden></div>
        <section class="jg-rk" id="rkEscena"></section>
        <div class="jg-tabla-caja"><table class="jg-tabla" id="rkTabla"></table></div>
        <p class="jg-nota-larga">
          Se suman 3 puntos por partida ganada y 1 por empate. Cada jugador apunta su propia
          fila desde su navegador cuando la partida acaba, así que una partida que se abandona
          cerrando la pestaña no llega a contarse.
        </p>
      </div>`;
    host.addEventListener("click", alClic);
    if (esSolo(juego)) elige(juego);
    pintaBarra();
    pintaCategorias();
    escucha();
  }

  function destruir() {
    muerto = true;
    if (parar) { try { parar(); } catch (e) {} parar = null; }
    if (pararC) { try { pararC(); } catch (e) {} pararC = null; }
    if (host) { host.removeEventListener("click", alClic); host.innerHTML = ""; }
    host = null;
  }

  function escucha() {
    if (parar) { try { parar(); } catch (e) {} parar = null; }
    cargando = true; fallo = ""; filas = [];
    /* Los datos de todo (los mismos del vestíbulo) hacen falta en
       cualquier tabla: con ellos se comprueba el marco de cada foto. */
    if (!pararC && ctx.datos) pararC = ctx.datos(d => { if (!muerto) { datosC = d; pinta(); } });
    if (juego === CARTAS) {
      pinta();
      return;
    }
    pinta();
    const individual = esSolo(juego);
    const oye = juego === "general" ? oyeGeneral
      : individual ? ctx.watchSolo : watchRanks;
    parar = oye(individual ? categoriaSolo : juego, (lista, err) => {
      if (muerto) return;
      cargando = false;
      fallo = err ? String(err.code || err.message || err) : "";
      filas = lista || [];
      pinta();
    });
  }

  /* La general: los podios de todas las tablas que se ven aquí (las de
     sala y las del club), 3 puntos por cada primer puesto, 2 por cada
     segundo y 1 por cada tercero (`podiosGeneral`). Sale de los mismos
     datos del vestíbulo (ranks + soloRanks); sin ellos, solo de las salas. */
  const salasVisibles = () => (ctx.orden ? ctx.orden().filter(k => JUEGOS[k]) : Object.keys(JUEGOS)).filter(k => !EXTRA[k]);
  function oyeGeneral(_, cb) {
    const op = () => ({ salas: salasVisibles(), vigente: categoriaVigente, vetado: ctx.vetado });
    if (!ctx.datos) return ctx.watchTodos((todo, err) => cb(podiosGeneral({ ranks: todo }, op()), err));
    let d = null;
    const emite = () => { if (d) cb(podiosGeneral(d, op()), null); };
    const offD = ctx.datos(x => { d = x; emite(); });
    const offV = ctx.watchVetados ? ctx.watchVetados(emite) : null;
    return () => { if (offD) offD(); if (offV) offV(); };
  }

  /* 22 pastillas iguales, sin icono y en el orden del objeto, eran tres
     filas de botones que no se distinguían. Ahora van en tres grupos
     (general, en sala, de un jugador), cada uno con su icono y su color,
     y los de sala por popularidad, como el catálogo. En el móvil es una
     tira que se desliza en vez de medio metro de botones. */
  function pintaBarra() {
    const el = host && host.querySelector("#rkJuegos");
    if (!el) return;
    // PRO HERO tiene sala pero clasifica por estrellas, con los de un jugador
    const orden = (ctx.orden ? ctx.orden().filter(k => JUEGOS[k]) : Object.keys(JUEGOS)).filter(k => !EXTRA[k]);
    const boton = (k, j) => `<button class="jg-rk-sel${k === juego ? " on" : ""}" data-juego="${k}" style="--c:${j.color}"
         ${k === juego ? 'aria-current="true"' : ""}><i aria-hidden="true">${esc(icono[k] || "●")}</i>${esc(j.nombre)}</button>`;
    el.innerHTML = boton("general", { nombre: "General", color: "#7c5cff" }) +
      `<span class="jg-rk-sep">En sala</span>` + orden.map(k => boton(k, JUEGOS[k]) + (k === "yemas" ? boton("yzombis", EXTRA.yzombis) : "")).join("") +
      `<span class="jg-rk-sep">Un jugador</span>` + Object.entries(EXTRA).filter(([, j]) => !j.sala).map(([k, j]) => boton(k, j)).join("") +
      (ctx.datos ? `<span class="jg-rk-sep">PRODROP</span>` + boton(CARTAS, { nombre: "Cartas", color: "#c084fc" }) : "");
    const on = el.querySelector(".on");
    if (on && el.scrollWidth > el.clientWidth) el.scrollLeft = on.offsetLeft - el.clientWidth / 2 + on.offsetWidth / 2;
  }

  function pinta() {
    if (!host) return;
    const deCartas = juego === CARTAS;
    for (const sel of ["#rkEscena", ".jg-tabla-caja", ".jg-nota-larga"]) { const x = host.querySelector(sel); if (x) x.hidden = deCartas; }
    const caja = host.querySelector("#rkCartas");
    if (caja) caja.hidden = !deCartas;
    if (deCartas) { const av = host.querySelector("#rkAviso"); if (av) av.innerHTML = ""; pintaCartas(caja); return; }
    const av = host.querySelector("#rkAviso");
    if (av) av.innerHTML = fallo
      ? `<div class="jg-aviso">No se puede leer la clasificación (<code>${esc(fallo)}</code>).
         Si pone <code>PERMISSION_DENIED</code> es que las reglas de <code>ranks</code> todavía
         no están publicadas en la consola de Firebase.</div>`
      : "";

    const t = host.querySelector("#rkTabla");
    if (!t) return;
    const solo = esSolo(juego);
    const general = juego === "general";
    const orden = solo ? [...filas].sort((a,b)=>b.puntos-a.puntos||a.tiempo-b.tiempo||a.uid.localeCompare(b.uid)).map(f => mezcla(f, perfil(f.uid)))
      : general ? filas : ordenaRanks(filas);
    host.querySelector('.jg-nota-larga').textContent = solo ? 'Mejor récord por jugador y categoría. En empate, menor tiempo. Las puntuaciones se calculan en el navegador.'
      : general ? `La general cuenta los podios de todas las clasificaciones (de sala y del club, con al menos ${MIN_PODIO} personas): cada primer puesto da 3 puntos, cada segundo 2 y cada tercero 1.`
      : 'Se suman 3 puntos por victoria y 1 por empate.';
    pintaEscena(solo ? orden : orden.map(f => mezcla(f, perfil(f.uid))), solo);
    if (!orden.length) {
      t.innerHTML = `<tr><td class="jg-vacio">${cargando ? "Cargando…"
        : general ? "Todavía nadie tiene un podio." : "Todavía no ha terminado ninguna partida de este juego. Sé el primero."}</td></tr>`;
      return;
    }
    if (general) {
      t.innerHTML = `
      <thead><tr>
        <th class="jg-th-n">#</th><th>Jugador</th>
        <th class="jg-num jg-opc" title="Primeros puestos">🥇</th><th class="jg-num jg-opc" title="Segundos puestos">🥈</th>
        <th class="jg-num jg-opc" title="Terceros puestos">🥉</th><th class="jg-num jg-opc">Podios</th>
        <th class="jg-num jg-pts">Puntos</th>
      </tr></thead><tbody>${orden.map((f, i) => filaGeneral(f, i)).join("")}</tbody>`;
      return;
    }
    const adm = solo && ctx.esAdmin && ctx.esAdmin() && ctx.borraRecord;
    if (solo) {t.innerHTML = `<thead><tr><th>#</th><th>Jugador</th><th>Récord</th><th>${categoriaSolo==='club-hero-estrellas'?'Además':'Tiempo'}</th>${adm?'<th class="jg-rk-adm" title="Solo administradores">🛡️</th>':''}</tr></thead><tbody>${orden.map((f,i)=>`<tr class="${f.uid===uid?'jg-yo':''}${i<3?' jg-rk-top':''}"><td class="jg-th-n">${puesto(i)}</td><td class="jg-jug" data-perfil="${esc(f.uid)}" data-nombre="${esc(f.nombre)}">${foto(f, 26)}<span>${esc(f.nombre)}</span></td><td>${categoriaSolo.startsWith('club-minas-')?'Completado':categoriaSolo==='club-tetris-sprint'?'40 líneas':categoriaSolo.startsWith('club-sortem-')?f.puntos+' números':categoriaSolo.startsWith('club-bbtan-')||categoriaSolo.startsWith('yemas-zombis-')||categoriaSolo.startsWith('club-prodefender-')?'Ronda '+f.puntos:categoriaSolo.startsWith('club-frontera-')?f.puntos+(f.puntos===1?' victoria':' victorias'):/-racha$/.test(categoriaSolo)?f.puntos+(f.puntos===1?' día':' días'):categoriaSolo==='club-hero-estrellas'?Math.floor(f.puntos/10000)+' ★ doradas':f.puntos}</td><td>${categoriaSolo==='club-hero-estrellas'?Math.max(0,f.puntos%10000-Math.floor(f.puntos/10000))+' azules · '+(f.h||0)+' canciones':categoriaSolo.startsWith('club-prodefender-')?Math.max(1,Math.round(f.tiempo/60000))+' min de juego':(f.tiempo/1000).toFixed(2)+' s'}</td>${adm?`<td class="jg-rk-adm"><button type="button" class="btn2 jg-rk-borra" title="Eliminar este récord (administración)" data-borra="${esc(f.uid)}" data-partida="${esc(f.partida||'')}" data-nombre="${esc(f.nombre||'')}">🗑</button></td>`:''}</tr>`).join('')}</tbody>`;return;}
    t.innerHTML = `
      <thead><tr>
        <th class="jg-th-n">#</th><th>Jugador</th>
        <th class="jg-num jg-opc">Jugadas</th><th class="jg-num jg-opc">Ganadas</th>
        <th class="jg-num jg-opc">Perdidas</th><th class="jg-num jg-opc">Empates</th>
        <th class="jg-num jg-opc">%</th><th class="jg-num jg-opc">Racha</th>
        <th class="jg-num jg-pts">Puntos</th>
      </tr></thead><tbody>${orden.map((f, i) => fila(f, i)).join("")}</tbody>`;
  }

  function fila(fx, i) {
    const f = mezcla(fx, perfil(fx.uid));
    const yo = f.uid === uid;
    const pc = porcentaje(f);
    return `<tr class="${yo ? "jg-yo" : ""}${i < 3 ? " jg-rk-top" : ""}">
      <td class="jg-th-n">${puesto(i)}</td>
      <td class="jg-jug" data-perfil="${esc(f.uid)}" data-nombre="${esc(f.nombre || "")}">
        ${foto(f, 26)}
        <span translate="no">${nombreHtml(f.uid, esc(f.nombre || "Sin nombre"))}${yo ? " <b>(tú)</b>" : ""}<small class="jg-jug-sub">${f.jugadas || 0} jugadas · ${f.ganadas || 0} ganadas</small></span>
      </td>
      <td class="jg-num jg-opc">${f.jugadas || 0}</td>
      <td class="jg-num jg-gan jg-opc">${f.ganadas || 0}</td>
      <td class="jg-num jg-opc">${f.perdidas || 0}</td>
      <td class="jg-num jg-opc">${f.empates || 0}</td>
      <td class="jg-num jg-opc"><span class="jg-barra-pc"><i style="width:${pc}%"></i></span>${pc}%</td>
      <td class="jg-num jg-opc">${f.mejorRacha || 0}</td>
      <td class="jg-num jg-pts">${f.puntos || 0}</td>
    </tr>`;
  }

  function filaGeneral(fx, i) {
    const f = mezcla(fx, perfil(fx.uid));
    const yo = f.uid === uid;
    return `<tr class="${yo ? "jg-yo" : ""}${i < 3 ? " jg-rk-top" : ""}">
      <td class="jg-th-n">${puesto(i)}</td>
      <td class="jg-jug" data-perfil="${esc(f.uid)}" data-nombre="${esc(f.nombre || "")}">
        ${foto(f, 26)}
        <span translate="no">${nombreHtml(f.uid, esc(f.nombre || "Sin nombre"))}${yo ? " <b>(tú)</b>" : ""}<small class="jg-jug-sub">${medallas(f)}</small></span>
      </td>
      <td class="jg-num jg-opc">${f.oro}</td>
      <td class="jg-num jg-opc">${f.plata}</td>
      <td class="jg-num jg-opc">${f.bronce}</td>
      <td class="jg-num jg-opc">${f.podios}</td>
      <td class="jg-num jg-pts">${f.puntos}</td>
    </tr>`;
  }
  const medallas = f => `${f.oro} 🥇 · ${f.plata} 🥈 · ${f.bronce} 🥉`;

  /* ---- PRODROP: por colección, las colecciones más raras y la más completa ---- */
  function nombreDe(u) {
    const q = ctx.quien ? ctx.quien(u) : mezcla({ uid: u, nombre: "" }, perfil(u));
    return { nombre: (q && q.nombre) || "Sin nombre", foto: (q && q.foto) || "", color: q && q.color };
  }
  function quienHtml(u) {
    const q = nombreDe(u);
    return `<span class="jg-jug jg-rkc-quien" data-perfil="${esc(u)}" data-nombre="${esc(q.nombre)}">
      ${foto({ uid: u, nombre: q.nombre, foto: q.foto, color: q.color }, 26)}
      <span translate="no">${nombreHtml(u, esc(q.nombre))}${u === uid ? " <b>(tú)</b>" : ""}</span></span>`;
  }
  /* Décimas de punto → «18» o «0,9». */
  const pts = d => (d / 10).toLocaleString("es-CL", { maximumFractionDigits: 1 });
  function filaTop(f, i) {
    const abierta = verC === f.uid;
    return `<li class="${f.uid === uid ? "jg-yo" : ""}">
        <span class="jg-rkc-n">${puesto(i)}</span>${quienHtml(f.uid)}
        <b class="jg-rkc-cuenta">${pts(f.puntos)} pts</b>
        <button type="button" class="btn2 jg-rkc-ver" data-rkc-ver="${esc(f.uid)}" aria-expanded="${abierta}">${abierta ? "Ocultar" : "Ver colección"}</button>
        <small class="jg-rkc-extra">${plural(f.cartas.length, "carta graduada", "cartas graduadas")} de ${f.total} · ${plural(f.sobres, "sobre abierto", "sobres abiertos")}</small>
        ${abierta ? `<div class="jg-rkc-album">${f.cartas.map(c => miniCarta(c, `<span class="jg-rkc-vale">${pts(c.pts)} pts</span>`)).join("")}</div>` : ""}
      </li>`;
  }
  function pintaCartas(el) {
    if (!el) return;
    const cols = MOTOR.COLECCIONES.filter(c => colVisible(c.key));
    if (!cols.some(c => c.key === colC)) colC = cols[0].key;
    const k = colC, info = MOTOR.COL[k];
    const top = topColecciones(datosC, k), col = rankingColeccion(datosC, 10, k);
    if (!top || !col) { el.innerHTML = `<p class="jg-vacio">Cargando las cartas…</p>`; return; }
    const mia = top.findIndex(f => f.uid === uid);
    const valen = MOTOR.TIERS.map((t, i) => ({ t, i })).filter(({ i }) => MOTOR.POR_COL[k].some(c => c.tier === i)).reverse()
      .map(({ t, i }) => `${esc(t.sym)} ${esc(t.label.toLowerCase())} ${pts(PUNTOS_RAREZA[i] * 10)}`).join(" · ");
    const html = `
      ${cols.length > 1 ? `<div class="jg-rk-cats" style="--c:#c084fc"><div class="jg-rk-fila"><span>Colección</span><div class="jg-rk-seg" role="group" aria-label="Colección">${cols.map(c =>
        `<button type="button" class="${c.key === k ? "on" : ""}" aria-pressed="${c.key === k}" data-rkc-col="${c.key}">${esc(c.label)}</button>`).join("")}</div></div></div>` : ""}
      <section class="jg-rkc">
        <h2>Colecciones más raras · ${esc(info.label)}</h2>
        <p class="jg-rkc-sub">Solo cartas graduadas, y de cada carta solo la mejor copia (las repetidas cuentan una vez). Cada carta vale según su rareza con nota 10 (${valen}) y menos con menos nota: una legendaria con 9 son 18.</p>
        ${top.length ? `<ol class="jg-rkc-lista jg-rkc-top">${top.slice(0, 3).map(filaTop).join("")}</ol>
          ${mia >= 3 ? `<p class="jg-rkc-sub jg-rkc-tuya">Tu colección va #${mia + 1}.</p><ol class="jg-rkc-lista jg-rkc-top" start="${mia + 1}">${filaTop(top[mia], mia)}</ol>` : ""}`
          : `<p class="jg-vacio">Todavía nadie ha graduado una carta de ${esc(info.label)}.</p>`}
      </section>
      <section class="jg-rkc">
        <h2>Colección más completa · ${esc(info.label)}</h2>
        <p class="jg-rkc-sub">Cartas distintas que cada uno tiene ahora, de ${MOTOR.POR_COL[k].length} en total. Las repetidas cuentan una vez.</p>
        ${col.length ? `<ol class="jg-rkc-lista">${col.map((f, i) => `
          <li class="${f.uid === uid ? "jg-yo" : ""}">
            <span class="jg-rkc-n">${puesto(i)}</span>${quienHtml(f.uid)}
            <span class="jg-rkc-barra" title="${f.tiene} de ${f.total}"><i style="width:${(100 * f.tiene / f.total).toFixed(1)}%"></i></span>
            <b class="jg-rkc-cuenta">${f.tiene}/${f.total}</b>
            <small class="jg-rkc-extra">${f.leyendas ? `${esc(MOTOR.TIERS[3].sym)} ${f.leyendas} ${f.leyendas === 1 ? "legendaria" : "legendarias"} · ` : ""}${f.copias} ${f.copias === 1 ? "copia" : "copias"}</small>
          </li>`).join("")}</ol>` : `<p class="jg-vacio">Nadie tiene cartas de ${esc(info.label)} todavía. <a href="#cartas">Abrir un sobre →</a></p>`}
      </section>`;
    /* Por firma: llegan perfiles uno a uno y cada uno repinta. */
    if (html !== firmaC) { firmaC = html; el.innerHTML = html; }
  }

  function puesto(i) {
    return i < 3 ? `<span class="jg-rk-med jg-rk-${METAL[i]}">${i + 1}</span>` : i + 1;
  }

  /* ---- El podio ---- */

  /* Lo que se compara en esta tabla, y cómo se dice. Las del club de
     buscaminas se ganan por tiempo (menos es mejor); el resto, por puntos. */
  function medida(solo) {
    if (solo && (categoriaSolo.startsWith("club-minas-") || categoriaSolo.startsWith("club-sortem-") || categoriaSolo === "club-tetris-sprint" ||
        (categoriaSolo.startsWith("club-sopa-") && categoriaSolo !== "club-sopa-racha") ||
        /^club-sudoku-(facil|medio|dificil|experto)$/.test(categoriaSolo)))
      return { valor: f => (f.tiempo || 0) / 1000, txt: v => `${v.toFixed(2)} s`, unidad: "", menor: true };
    /* BBTAN se mide en rondas alcanzadas, no en puntos. */
    if (solo && (categoriaSolo.startsWith("club-bbtan-") || categoriaSolo.startsWith("yemas-zombis-") || categoriaSolo.startsWith("club-prodefender-")))
      return { valor: f => f.puntos || 0, txt: v => `ronda ${v}`, unidad: "", menor: false };
    /* PRO HERO: puntos = doradas·10 000 + todas; se dicen las doradas. */
    if (solo && categoriaSolo === "club-hero-estrellas")
      return { valor: f => Math.floor((f.puntos || 0) / 10000), txt: v => `${v} ★`, unidad: "", menor: false };
    if (solo && categoriaSolo === "club-atasco-estrellas")
      return { valor: f => f.puntos || 0, txt: v => `${v} ★`, unidad: "", menor: false };
    if (solo && categoriaSolo === "club-fanal-jornadas")
      return { valor: f => f.puntos || 0, txt: v => `jornada ${v}`, unidad: "", menor: false };
    /* La distancia de Metro Rush se dice en metros, con separador de miles. */
    if (solo && /^club-metrorush-(city)?distancia$/.test(categoriaSolo))
      return { valor: f => f.puntos || 0, txt: v => `${v.toLocaleString("es-CL")} m`, unidad: "", menor: false };
    if (solo && categoriaSolo.startsWith("club-frontera-"))
      return { valor: f => f.puntos || 0, txt: v => `${v} ${v === 1 ? "victoria" : "victorias"}`, unidad: "", menor: false };
    if (solo && (categoriaSolo === "club-sopa-racha" || categoriaSolo === "club-electro-racha" || categoriaSolo === "club-integral-racha" || categoriaSolo === "club-sudoku-racha"))
      return { valor: f => f.puntos || 0, txt: v => `${v} ${v === 1 ? "día" : "días"}`, unidad: "", menor: false };
    return { valor: f => f.puntos || 0, txt: v => String(v), unidad: "pts", menor: false };
  }

  /* La foto de una fila, con el marco que esa persona lleva (comprobado
     contra lo que tiene ganado: un marco de campeón escrito a mano se ve
     como el anillo de siempre). El `data-perfil` va en la celda. */
  const marcoDe = u => marcoDeUid(u, perfil(u), datosC);
  function foto(f, tam) {
    return avatarMarco(f.foto, f.nombre, f.color || (ctx.colorDe ? ctx.colorDe(f.uid) : ""), marcoDe(f.uid), tam);
  }
  /* En el podio el anillo de metal ya es el marco; quien lleva otro lo
     luce encima en lugar del metal. */
  const conMarco = f => !["anillo", "nada"].includes(marcoDe(f.uid));
  function avatar(f) {
    if (conMarco(f)) return foto(f, 58);
    return f.foto
      ? `<img src="${esc(f.foto)}" alt="" referrerpolicy="no-referrer">`
      : `<span>${esc((f.nombre || "?").slice(0, 1).toUpperCase())}</span>`;
  }

  function peana(f, i, m, solo) {
    const cls = `jg-rk-p jg-rk-${METAL[i]}${f && f.uid === uid ? " yo" : ""}${f ? "" : " libre"}`;
    const bloque = `<div class="jg-rk-bloque"><b>${i + 1}</b></div>`;
    if (!f) return `<div class="${cls}">
        <div class="jg-rk-av"><span>?</span></div>
        <b class="jg-rk-nom">Puesto libre</b>
        <span class="jg-rk-tit">¿Tú?</span>
        <div class="jg-rk-pts">&nbsp;</div>
        ${bloque}</div>`;
    const detalle = solo && categoriaSolo === "club-hero-estrellas" ? `${plural(f.h || 0, "canción", "canciones")} · ${Math.max(0, (f.puntos || 0) % 10000 - Math.floor((f.puntos || 0) / 10000))} azules`
      : solo ? (m.menor ? "mejor tiempo" : `${((f.tiempo || 0) / 1000).toFixed(1)} s`)
      : juego === "general" ? medallas(f)
      : `${f.ganadas || 0} G · ${porcentaje(f)} %${f.mejorRacha > 1 ? ` · racha ${f.mejorRacha}` : ""}`;
    return `<div class="${cls}">
        ${i === 0 ? CORONA : ""}
        <div class="jg-rk-av${conMarco(f) ? " con-marco" : ""}" data-perfil="${esc(f.uid)}" data-nombre="${esc(f.nombre || "")}">${avatar(f)}</div>
        <b class="jg-rk-nom" title="${esc(f.nombre || "")}" translate="no">${nombreHtml(f.uid, esc(f.nombre || "Sin nombre"))}${f.uid === uid ? " <em>(tú)</em>" : ""}</b>
        <span class="jg-rk-tit">${TITULO[i]}</span>
        <div class="jg-rk-pts"><b>${m.txt(m.valor(f))}</b>${m.unidad ? ` ${m.unidad}` : ""}</div>
        <small>${detalle}</small>
        ${bloque}</div>`;
  }

  /* «Tu posición»: la distancia al siguiente escalón, dicha en algo que se
     puede hacer. Para superar a alguien hace falta un punto más que él —
     a puntos iguales desempatan las victorias, y eso no se promete. */
  function tuPosicion(orden, m, solo) {
    const i = orden.findIndex(f => f.uid === uid);
    const falta = (a, b) => m.menor ? m.valor(a) - m.valor(b) : m.valor(b) - m.valor(a);
    const cuanto = (yo, otro) => {
      const d = falta(yo, otro);
      if (m.menor) return `${Math.max(0.01, d + 0.01).toFixed(2)} s menos`;
      const n = d + 1;
      if (solo && categoriaSolo === "club-hero-estrellas") return plural(n, "estrella dorada", "estrellas doradas");
      return solo || juego === "general" ? plural(n, "punto", "puntos") : `${plural(n, "punto", "puntos")} (${plural(victorias(n), "victoria", "victorias")})`;
    };
    let icono = "⚔", tit, txt;
    if (!orden.length) {
      icono = "♛"; tit = "El trono está vacío";
      txt = solo ? "El primer récord que se apunte se sienta en él." : juego === "general" ? "El primer podio que se gane se sienta en él." : "La primera victoria que se apunte se sienta en él.";
    } else if (i < 0) {
      tit = "Todavía no estás en la tabla";
      txt = juego === "general" ? (orden.length < 3 ? "Hay un puesto libre en el podio: sube al podio de cualquier clasificación y es tuyo."
          : `El podio empieza en ${plural(orden[2].puntos, "punto", "puntos")}: sube al podio de cualquier clasificación y entras.`)
        : orden.length < 3 ? "Hay un puesto libre en el podio: termina una partida y es tuyo."
        : `El podio empieza en ${m.txt(m.valor(orden[2]))}${m.unidad ? " " + m.unidad : ""}. Juega y entra.`;
    } else if (i === 0) {
      icono = "♛"; tit = "Llevas la corona";
      const r = orden[1];
      txt = !r ? "Nadie te la disputa todavía."
        : falta(orden[0], r) === 0 ? `${esc(r.nombre)} está empatado contigo. Defiéndela.`
        : `${esc(r.nombre)} está a ${m.menor ? `${(m.valor(r) - m.valor(orden[0])).toFixed(2)} s` : plural(falta(r, orden[0]), "punto", "puntos")}. Que no te alcance.`;
    } else if (i < 3) {
      icono = "♛"; tit = `#${i + 1} — a un paso del trono`;
      txt = `Te faltan ${cuanto(orden[i], orden[0])} para quitarle la corona a ${esc(orden[0].nombre)}.`;
    } else {
      tit = `Vas #${i + 1}`;
      txt = `Te faltan ${cuanto(orden[i], orden[2])} para subir al podio` +
        (i > 3 ? `, y ${cuanto(orden[i], orden[i - 1])} para adelantar a ${esc(orden[i - 1].nombre)}.` : ".");
    }
    return `<div class="jg-rk-tu${i >= 0 && i < 3 ? " podio" : ""}"><i>${icono}</i><div><b>${tit}</b><span>${txt}</span></div></div>`;
  }

  function pintaEscena(orden, solo) {
    const el = host && host.querySelector("#rkEscena");
    if (!el) return;
    if (fallo || (cargando && !orden.length)) { el.innerHTML = ""; el.hidden = true; firma = ""; return; }
    el.hidden = false;
    const m = medida(solo);
    const clave = solo ? categoriaSolo : juego;
    const entra = animado !== clave;
    animado = clave;
    const j = JUEGOS[juego] || EXTRA[juego] || { nombre: juego === "general" ? "Todos los juegos" : juego };
    const sub = solo ? subtitulo() : "";
    const html = `
      <div class="jg-rk-rayos"></div>
      <header class="jg-rk-cab"><span>Salón de la fama</span><h2>${esc(j.nombre)}</h2>${sub ? `<small>${esc(sub)}</small>` : ""}</header>
      <div class="jg-rk-podio">${[1, 0, 2].map(i => peana(orden[i], i, m, solo)).join("")}</div>
      ${tuPosicion(orden, m, solo)}`;
    /* Por firma, como el resto de pantallas: reescribir lo mismo reinicia
       los rayos, el halo y la corona, y se ve como un parpadeo. */
    if (!entra && html === firma) return;
    firma = html;
    el.classList.toggle("entra", entra);
    el.innerHTML = html;
  }

  function elige(k) {
    const d = SOLO[k];
    const e = eleccion[k] || (eleccion[k] = Object.assign(
      Object.fromEntries(d.filas.map(f => [f.k, f.ops[0][0]])), d.def || {}));
    categoriaSolo = d.cat(e);
    return e;
  }

  /* Una fila con `si` solo aparece cuando tiene sentido (el tamaño de la
     sopa no cuenta en la tabla de la racha). */
  const visibles = (d, e) => d.filas.filter(f => !f.si || f.si(e));

  function subtitulo() {
    const d = SOLO[juego], e = eleccion[juego];
    return d && e ? visibles(d, e).map(f => (f.ops.find(o => o[0] === e[f.k]) || [])[1]).join(" · ") : "";
  }

  function pintaCategorias() {
    const el = host && host.querySelector("#rkSolo");
    if (!el) return;
    if (!esSolo(juego)) { el.innerHTML = ""; return; }
    const d = SOLO[juego], e = elige(juego);
    el.innerHTML = `<div class="jg-rk-cats" style="--c:${EXTRA[juego].color}">${visibles(d, e).map(f =>
      `<div class="jg-rk-fila"><span>${f.t}</span><div class="jg-rk-seg" role="group" aria-label="${f.t}">${f.ops.map(([v, t]) =>
        `<button type="button" class="${e[f.k] === v ? "on" : ""}" aria-pressed="${e[f.k] === v}" data-cat-k="${f.k}" data-cat-v="${v}">${t}</button>`).join("")}</div></div>`).join("")}</div>`;
  }

  function alClic(ev) {
    const rc = juego === CARTAS && ev.target.closest("[data-rkc-col],[data-rkc-ver]");
    if (rc) {
      if (rc.hasAttribute("data-rkc-col")) {
        colC = rc.getAttribute("data-rkc-col"); verC = "";
        try { localStorage.setItem("jg.rankCol", colC); } catch (e) { /* nada */ }
      } else {
        const u = rc.getAttribute("data-rkc-ver");
        verC = verC === u ? "" : u;
      }
      pinta();
      return;
    }
    const del = ev.target.closest("[data-borra]");
    if (del && esSolo(juego) && ctx.esAdmin && ctx.esAdmin() && ctx.borraRecord) {
      ev.stopPropagation();
      const u = del.getAttribute("data-borra"), p = del.getAttribute("data-partida") || "", c = categoriaSolo;
      const n = del.getAttribute("data-nombre") || u;
      if (!c || !confirm(`¿Eliminar el récord de ${n} en ${c}?\n\nSe borran la fila, su prueba, su revisión y su repetición. No se puede deshacer.`)) return;
      del.disabled = true;
      Promise.resolve(ctx.borraRecord(c, u, p)).catch(e => {
        del.disabled = false;
        alert("No se pudo eliminar: " + (e && e.message || e));
      });
      return;
    }
    const c = ev.target.closest("[data-cat-k]");
    if (c && esSolo(juego)) {
      const e = elige(juego), k = c.getAttribute("data-cat-k"), v = c.getAttribute("data-cat-v");
      if (e[k] === v) return;
      e[k] = v; elige(juego);
      pintaCategorias();
      escucha();
      return;
    }
    const b = ev.target.closest("[data-juego]");
    if (!b) return;
    const k = b.getAttribute("data-juego");
    if (k === juego) return;
    juego = k;
    try { localStorage.setItem("jg.rankJuego", k); } catch (e) { /* nada */ }
    if (esSolo(k)) elige(k);
    pintaCategorias();
    pintaBarra();
    escucha();
  }

  /* Un perfil que llega después de la tabla no trae fila nueva que
     escuchar, así que hay que decirle desde fuera que se repinte. */
  function refresca() { pinta(); }

  return { montar, destruir, refresca };
}
