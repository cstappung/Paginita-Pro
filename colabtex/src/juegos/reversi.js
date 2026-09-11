/* Reversi — el cuarto juego, Othello con sus reglas de siempre.
 *
 * Está aquí por lo que los otros tres no son: el escondite es mirar, las
 * cartas son adivinar y cuadritos es contar cadenas; esto es leer el
 * tablero. Se pone ficha donde atrape una fila del otro entre la nueva y
 * una propia, y todas las atrapadas cambian de dueño. Gana quien tenga
 * más al final.
 *
 * Tres decisiones de esta pantalla:
 *
 * - **Las fichas son negras y blancas, no del color de cada jugador.**
 *   `colorForUid` reparte tonos por uid y dos pueden salir casi iguales;
 *   en un juego que consiste precisamente en leer de un vistazo quién
 *   domina el tablero, eso lo estropea. El color propio de cada uno
 *   aparece igualmente, como aro del marcador, para que nadie tenga que
 *   recordar de qué lado juega.
 * - **Las casillas jugables se marcan, y solo en tu turno.** El reductor
 *   ya calcula `legales` (casilla → fichas que voltearía) porque le hace
 *   falta para saber si hay que pasar, así que pintarlas no cuesta nada
 *   y quita la mitad de la frustración de aprender el juego. El número
 *   de fichas que se voltearían va dentro del punto.
 * - **Lo que acaba de pasar se ve.** La ficha recién puesta lleva aro y
 *   las volteadas giran una vez, que es lo único que explica un tablero
 *   que cambia de color a la mitad. La animación se puede confiar a la
 *   pintada porque el SVG se rehace solo cuando cambia la firma, y la
 *   firma lleva la última casilla dentro: una pintada por jugada.
 */
import { claveCasilla } from "./motor.js";
import { suena } from "./sonido.js";

/* Quién hizo la última jugada. El reductor no lo guarda —no le hace
   falta para dibujar— y el log sí, así que se lee de ahí: el sonido
   tiene que sonar distinto según sea tuya o suya. */
function ultimoAutor(partida) {
  const js = (partida && partida.jugadas) || {};
  const ks = Object.keys(js).sort();
  const u = ks.length ? js[ks[ks.length - 1]] : null;
  return u ? u.uid : "";
}

const S = 100;   // lado de la casilla, en unidades del viewBox
const M = 14;    // margen del tablero

const NEGRA = "#1b2028", BLANCA = "#f2f5f8";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function crearReversi(ctx) {
  const { uid, jugar, terminar } = ctx;

  let host = null, muerto = false;
  let p = null, est = null;
  let enviando = false;
  let vistas = -1;             // cuántas jugadas llevaba el log la última vez
  let sonoFin = false;
  const firmas = {};

  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-rev">
        <div class="jg-barra">
          <div class="jg-fase" id="rvFase"></div>
          <div class="jg-grow"></div>
          <div class="jg-marcador" id="rvMarcador"></div>
        </div>
        <div class="jg-tablero" id="rvTablero"></div>
        <div class="jg-pie" id="rvPie"></div>
      </div>`;
    host.addEventListener("click", alClic);
  }

  function destruir() {
    muerto = true;
    if (host) { host.removeEventListener("click", alClic); host.innerHTML = ""; }
    host = null;
  }

  /* El color de la ficha lo da el bando, no el jugador. */
  const fichaDe = u => (u === est.negras ? NEGRA : BLANCA);
  const bandoDe = u => (u === est.negras ? "negras" : "blancas");
  const jugadorDe = u => (est && est.jugadores.find(x => x.uid === u)) || null;
  const nombreDe = u => { const j = jugadorDe(u); return j ? j.nombre : "el rival"; };

  function set(id, firma, html) {
    if (firmas[id] === firma) return;
    firmas[id] = firma;
    const el = host && host.querySelector("#" + id);
    if (el) el.innerHTML = html;
  }

  /* ---------- el tablero ---------- */
  const px = i => M + i * S;

  function tablero() {
    const n = est.lado, W = M * 2 + n * S;
    const mio = est.fase === "jugando" && est.turno === uid;
    const volteadas = {};
    for (const [f, c] of (est.ultima && est.ultima.voltea) || []) volteadas[claveCasilla(f, c)] = true;

    const out = [`<svg viewBox="0 0 ${W} ${W}" class="jg-svg jg-rev-svg">`,
      `<rect class="jg-rev-fondo" x="0" y="0" width="${W}" height="${W}" rx="10"></rect>`];

    /* La cuadrícula, y los cuatro puntos de siempre en las esquinas de
       los cuadrantes: son la referencia con la que la gente habla de
       este tablero. */
    for (let f = 0; f < n; f++) for (let c = 0; c < n; c++)
      out.push(`<rect class="jg-rev-cas" x="${px(c)}" y="${px(f)}" width="${S}" height="${S}"></rect>`);
    if (n === 8) for (const [f, c] of [[2, 2], [2, 6], [6, 2], [6, 6]])
      out.push(`<circle class="jg-rev-hito" cx="${px(c)}" cy="${px(f)}" r="7"></circle>`);

    for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) {
      const k = claveCasilla(f, c), duena = est.tab[k];
      const cx = px(c) + S / 2, cy = px(f) + S / 2;
      if (duena) {
        const ult = est.ultima && est.ultima.casilla === k;
        out.push(`<circle class="jg-rev-f${volteadas[k] ? " jg-rev-gira" : ""}${ult ? " jg-rev-ult" : ""}"
          cx="${cx}" cy="${cy}" r="${S * 0.4}" fill="${fichaDe(duena)}"></circle>`);
        continue;
      }
      const caps = mio && est.legales[k];
      if (caps && caps.length) {
        /* La zona de clic es la casilla entera y no el punto: el punto
           mide un tercio de la casilla y acertarlo con el dedo en un
           móvil sería puntería, no juego. */
        out.push(`<g class="jg-rev-libre" data-f="${f}" data-c="${c}">
          <rect x="${px(c)}" y="${px(f)}" width="${S}" height="${S}" fill="transparent"></rect>
          <circle class="jg-rev-pista" cx="${cx}" cy="${cy}" r="${S * 0.28}"
            stroke="${fichaDe(uid)}"></circle>
          <text class="jg-rev-n" x="${cx}" y="${cy}" fill="${fichaDe(uid)}">${caps.length}</text>
        </g>`);
      }
    }

    out.push("</svg>");
    return out.join("");
  }

  function pinta() {
    if (!host || !est) return;

    let fase;
    if (est.fase === "espera") fase = "Esperando a que entre el otro…";
    else if (est.fase === "fin") {
      if (est.motivo === "empate") fase = "Empate: las mismas fichas.";
      else if (est.motivo === "abandono") fase = est.ganador === uid ? "¡Ganas! El otro se fue." : "Abandonaste la partida.";
      else fase = est.ganador === uid ? "🏆 Ganas la partida." : "Pierdes la partida.";
    } else fase = est.turno === uid
      ? `Te toca: pon una ficha ${bandoDe(uid) === "negras" ? "negra" : "blanca"}`
      : `Le toca a ${nombreDe(est.turno)}`;
    set("rvFase", fase, `<span class="jg-punto-t jg-rev-punto"
      style="background:${esc(est.turno ? fichaDe(est.turno) : "#8a97a3")}"></span>${esc(fase)}`);

    /* El marcador es el juego entero: en reversi la ventaja cambia de
       manos cada jugada y el número es lo primero que se mira. */
    const marca = j => {
      if (!j) return "";
      const n = (est.cuenta && est.cuenta[j.uid]) || 0;
      return `<span class="jg-m jg-rev-m" style="--c:${esc(j.color || "#888")}">
        <span class="jg-rev-chip" style="background:${esc(fichaDe(j.uid))}"></span>
        <b>${n}</b><span>${esc(j.uid === uid ? "tú" : j.nombre)}</span></span>`;
    };
    const orden = [jugadorDe(est.negras), jugadorDe(est.blancas)];
    set("rvMarcador",
      orden.map(j => (j ? j.uid + ":" + ((est.cuenta && est.cuenta[j.uid]) || 0) : "-")).join("/"),
      orden.map(marca).join(""));

    set("rvTablero",
      Object.keys(est.tab).length + "|" + est.turno + "|" + est.fase + "|" +
      (est.ultima ? est.ultima.casilla : "") + "|" + Object.keys(est.legales || {}).length,
      tablero());

    let pie;
    if (est.fase === "espera") pie = "Pásale el enlace de la sala a quien quieras y empezáis.";
    else if (est.fase === "fin") pie = "Partida terminada.";
    else if (est.pasa === uid) pie = "No te quedaba ninguna casilla: has pasado.";
    else if (est.pasa) pie = `${nombreDe(est.pasa)} no tenía jugada y ha pasado.`;
    else if (est.turno === uid) {
      const n = Object.keys(est.legales || {}).length;
      pie = `Puedes en ${n} casilla${n === 1 ? "" : "s"}; el número dice cuántas fichas te llevas.`;
    } else pie = `Quedan ${est.libres} casillas libres.`;
    set("rvPie", pie, `<span class="jg-nota">${esc(pie)}</span>`);
  }

  async function alClic(ev) {
    const g = ev.target.closest(".jg-rev-libre");
    if (!g || !est || enviando) return;
    if (est.fase !== "jugando" || est.turno !== uid) return;
    const f = Number(g.getAttribute("data-f")), c = Number(g.getAttribute("data-c"));
    const caps = est.legales[claveCasilla(f, c)];
    if (!caps || !caps.length) return;
    enviando = true;
    try { await jugar({ t: "p", uid, f, c }); }
    finally { if (!muerto) enviando = false; }
  }

  /* Una captura grande suena a jugada, no a ficha: cuatro vueltas de una
     tacada es lo que decide la partida y merece oírse desde el otro lado. */
  function suenaJugada(quien) {
    const v = (est.ultima && est.ultima.voltea) ? est.ultima.voltea.length : 0;
    if (v >= 4) suena(quien === uid ? "gana" : "pierde");
    else suena("ficha");
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    const n = Object.keys((partida && partida.jugadas) || {}).length;
    if (vistas >= 0 && n > vistas) suenaJugada(ultimoAutor(partida));
    vistas = n;
    pinta();
    if (est.fase === "fin" && !sonoFin) {
      sonoFin = true;
      setTimeout(() => suena(est.ganador === uid ? "victoria"
        : est.ganador === "" ? "empate" : "derrota"), 450);
    }
    if (est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) {
      terminar(est.ganador, est.motivo);
    }
  }

  return { montar, actualizar, destruir };
}
