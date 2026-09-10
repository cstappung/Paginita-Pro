/* Cuadritos — el de las rayas y las cajas de toda la vida.
 *
 * Por turnos se une un punto con el de al lado; quien cierra una caja se
 * la queda y vuelve a jugar. Ese «vuelve a jugar» es el juego entero: es
 * lo que hace que al final del tablero uno le regale al otro una cadena
 * de ocho cajas seguidas porque no le queda otra raya que poner.
 *
 * Es el tercer juego, y está aquí por lo que los otros dos no son: el
 * escondite es mirar y las cartas son adivinar, y esto es pensar. No hace
 * falta nada oculto, así que no hay compromisos ni sales — el registro de
 * jugadas basta, y quien juegue fuera de turno se encuentra con que su
 * raya sencillamente no existe para nadie.
 *
 * El tablero es SVG y no canvas porque lo que hay que acertar con el
 * ratón es una raya de dos milímetros: en SVG cada hueco lleva detrás su
 * propia zona de clic ancha y el navegador hace la puntería solo.
 *
 * Se juega **de dos a seis**, y el tamaño del tablero lo elige quien abre
 * la sala. Nada de eso está aquí: el cupo y el lado viven en la partida
 * (`cupoDe`, `ladoDe`) y el reductor ya reparte los turnos en círculo y
 * salta a quien se haya ido. Esta pantalla solo tiene que dejar de dar
 * por hecho que enfrente hay exactamente una persona — que era lo que
 * hacía el marcador de dos huecos, y lo que decía cada frase del pie.
 * El marcador va en **orden de asiento**, no de puntos: así se lee de
 * corrido quién viene después, que es la mitad de la estrategia cuando
 * son cinco y hay que decidir a quién se le regala la cadena.
 */
import { claveRaya, rayaValida, cajasQueCierra } from "./motor.js";

const S = 100;   // separación entre puntos, en unidades del viewBox
const M = 46;    // margen

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function crearCuadritos(ctx) {
  const { uid, jugar, terminar } = ctx;

  let host = null, muerto = false;
  let p = null, est = null;
  let enviando = false;
  const firmas = {};

  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-cuad">
        <div class="jg-barra">
          <div class="jg-fase" id="cuFase"></div>
          <div class="jg-grow"></div>
          <div class="jg-marcador" id="cuMarcador"></div>
        </div>
        <div class="jg-tablero" id="cuTablero"></div>
        <div class="jg-pie" id="cuPie"></div>
      </div>`;
    host.addEventListener("click", alClic);
  }

  function destruir() {
    muerto = true;
    if (host) { host.removeEventListener("click", alClic); host.innerHTML = ""; }
    host = null;
  }

  const colorDe = u => {
    const j = est && est.jugadores.find(x => x.uid === u);
    return (j && j.color) || "#8a97a3";
  };
  const nombreDe = u => {
    const j = est && est.jugadores.find(x => x.uid === u);
    return j ? j.nombre : "alguien";
  };
  /* Quién va ganando, para la frase del final. Devuelve la lista de
     empatados arriba, que con más de dos jugadores es lo normal. */
  const cabeza = () => {
    const vivos = (est.jugadores || []).filter(j => !(est.fuera || {})[j.uid]);
    const cs = vivos.length ? vivos : (est.jugadores || []);
    if (!cs.length) return [];
    const tope = Math.max(...cs.map(j => (est.puntos || {})[j.uid] || 0));
    return cs.filter(j => ((est.puntos || {})[j.uid] || 0) === tope);
  };

  function set(id, firma, html) {
    if (firmas[id] === firma) return;
    firmas[id] = firma;
    const el = host && host.querySelector("#" + id);
    if (el) el.innerHTML = html;
  }

  /* ---------- el tablero ---------- */
  const px = i => M + i * S;

  function tablero() {
    const n = est.lado, W = M * 2 + (n - 1) * S;
    const mio = est.turno === uid && est.fase === "jugando";
    const out = [`<svg viewBox="0 0 ${W} ${W}" class="jg-svg" style="--turno:${colorDe(est.turno)}">`];

    /* Las cajas cerradas van primero: son el fondo sobre el que se
       pintan las rayas, no un adorno encima. */
    for (const k in est.cajas) {
      const [f, c] = k.split("_").map(Number);
      const col = colorDe(est.cajas[k]);
      out.push(`<rect class="jg-caja" x="${px(c)}" y="${px(f)}" width="${S}" height="${S}"
        fill="${col}" rx="6"></rect>`);
      out.push(`<text class="jg-caja-l" x="${px(c) + S / 2}" y="${px(f) + S / 2}"
        fill="${col}">${esc((nombreDe(est.cajas[k]) || "?").slice(0, 1).toUpperCase())}</text>`);
    }

    /* Rayas puestas, y detrás de cada hueco una zona de clic gorda. */
    const raya = (o, f, c) => o === "h"
      ? { x1: px(c), y1: px(f), x2: px(c + 1), y2: px(f) }
      : { x1: px(c), y1: px(f), x2: px(c), y2: px(f + 1) };

    for (const o of ["h", "v"]) {
      for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) {
        if (!rayaValida(o, f, c, n)) continue;
        const k = claveRaya(o, f, c), r = raya(o, f, c), duena = est.rayas[k];
        if (duena) {
          const ult = est.ultima && est.ultima.clave === k;
          out.push(`<line class="jg-raya${ult ? " jg-ult" : ""}" x1="${r.x1}" y1="${r.y1}"
            x2="${r.x2}" y2="${r.y2}" stroke="${colorDe(duena)}"></line>`);
        } else {
          /* Si cerrar aquí regala la caja, el hueco se marca en la
             pasada del ratón — no es una ayuda, es lo que se ve solo
             cuando el tablero está delante en una mesa. */
          const cierra = cajasQueCierra(
            Object.assign({}, est.rayas, { [k]: uid }), o, f, c, n).length;
          out.push(`<line class="jg-hueco${mio ? " jg-libre" : ""}${cierra ? " jg-cierra" : ""}"
            data-o="${o}" data-f="${f}" data-c="${c}"
            x1="${r.x1}" y1="${r.y1}" x2="${r.x2}" y2="${r.y2}"></line>`);
        }
      }
    }

    for (let f = 0; f < n; f++) for (let c = 0; c < n; c++)
      out.push(`<circle class="jg-punto" cx="${px(c)}" cy="${px(f)}" r="7"></circle>`);

    out.push("</svg>");
    return out.join("");
  }

  function pinta() {
    if (!host || !est) return;
    const dentro = (est.jugadores || []).length, cupo = est.cupo || 2;
    const fuera = est.fuera || {};

    let fase;
    if (est.fase === "espera") {
      const faltan = Math.max(0, cupo - dentro);
      fase = faltan
        ? `Esperando a ${faltan} ${faltan === 1 ? "jugador" : "jugadores"}…`
        : "Listos: que empiece quien abrió la sala.";
    } else if (est.fase === "fin") {
      if (est.motivo === "empate") {
        const arriba = cabeza();
        fase = arriba.length > 1
          ? `Empate entre ${arriba.map(j => (j.uid === uid ? "tú" : j.nombre)).join(", ")}.`
          : "Empate: mismas cajas.";
      } else if (est.motivo === "abandono") {
        fase = est.ganador === uid
          ? "🏆 Ganas: los demás se fueron."
          : fuera[uid] ? "Abandonaste la partida."
          : est.ganador ? `Gana ${nombreDe(est.ganador)}: los demás se fueron.`
          : "La partida se quedó sin jugadores.";
      } else {
        fase = est.ganador === uid
          ? "🏆 Ganas la partida."
          : `Gana ${nombreDe(est.ganador)} con ${(est.puntos || {})[est.ganador] || 0} cajas.`;
      }
    } else fase = est.turno === uid ? "Te toca: pon una raya" : `Le toca a ${nombreDe(est.turno)}`;
    set("cuFase", fase, `<span class="jg-punto-t" style="background:${esc(colorDe(est.turno))}"></span>${esc(fase)}`);

    /* Un hueco por jugador, en orden de asiento, con quien tiene el
       turno marcado y quien se fue en gris: con seis nombres ahí, sin
       esas dos marcas el marcador no dice de quién se espera nada. */
    const marca = j => {
      const cl = "jg-m"
        + (j.uid === est.turno && est.fase === "jugando" ? " jg-m-turno" : "")
        + (fuera[j.uid] ? " jg-m-fuera" : "");
      return `<span class="${cl}" style="--c:${esc(j.color || "#888")}"
          title="${esc(fuera[j.uid] ? j.nombre + " abandonó" : j.nombre)}">
           <b>${(est.puntos && est.puntos[j.uid]) || 0}</b>
           <span>${esc(j.uid === uid ? "tú" : j.nombre)}</span></span>`;
    };
    set("cuMarcador",
      (est.jugadores || []).map(j =>
        j.uid + ":" + ((est.puntos || {})[j.uid] || 0) + (fuera[j.uid] ? "x" : "")).join("/")
        + "|" + est.turno + "|" + est.fase,
      (est.jugadores || []).map(marca).join(""));

    set("cuTablero",
      Object.keys(est.rayas).length + "|" + est.turno + "|" + est.fase + "|" + Object.keys(est.cajas).length,
      tablero());

    const pie = est.fase === "espera"
      ? `Pásale el enlace de la sala a quien quieras: caben ${cupo} y estáis ${dentro}.`
      : est.fase === "fin" ? "Partida terminada."
      : `Quedan ${est.restantes} rayas. Cerrar una caja te da otro turno.`;
    set("cuPie", pie, `<span class="jg-nota">${esc(pie)}</span>`);
  }

  async function alClic(ev) {
    const l = ev.target.closest(".jg-hueco");
    if (!l || !est || enviando) return;
    if (est.fase !== "jugando" || est.turno !== uid) return;
    const o = l.getAttribute("data-o"), f = Number(l.getAttribute("data-f")), c = Number(l.getAttribute("data-c"));
    if (!rayaValida(o, f, c, est.lado) || est.rayas[claveRaya(o, f, c)]) return;
    enviando = true;
    try { await jugar({ t: "l", uid, o, f, c }); }
    finally { if (!muerto) enviando = false; }
  }

  function actualizar(partida, estado) {
    p = partida; est = estado;
    pinta();
    if (est.ganador !== null && est.ganador !== undefined && !(p.fin && p.fin.at)) {
      terminar(est.ganador, est.motivo);
    }
  }

  return { montar, actualizar, destruir };
}
