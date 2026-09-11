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
 */
import { JUEGOS, ordenaRanks, porcentaje } from "./motor.js";
import { mezcla } from "./perfil.js";

const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const MEDALLA = ["🥇", "🥈", "🥉"];

export function crearRanks(ctx) {
  const { uid, watchRanks } = ctx;
  /* La fila de la clasificación guarda el nombre y la foto del día
     en que se apuntó la partida — y su `foto` no puede pasar de 400
     caracteres, así que una foto subida no cabe ahí de ninguna
     manera. El perfil vivo se pone encima al pintar; sin resolutor
     se pinta la fila tal cual, que es lo que había. */
  const perfil = ctx.perfil || (() => null);

  let host = null, muerto = false;
  let juego = Object.keys(JUEGOS)[0];
  let filas = [];
  let cargando = true;
  let fallo = "";
  let parar = null;

  function montar(donde) {
    host = donde;
    host.innerHTML = `
      <div class="jg-ranks">
        <div class="jg-bar-juegos" id="rkJuegos"></div>
        <div id="rkAviso"></div>
        <div class="jg-tabla-caja"><table class="jg-tabla" id="rkTabla"></table></div>
        <p class="jg-nota-larga">
          Se suman 3 puntos por partida ganada y 1 por empate. Cada jugador apunta su propia
          fila desde su navegador cuando la partida acaba, así que una partida que se abandona
          cerrando la pestaña no llega a contarse.
        </p>
      </div>`;
    host.addEventListener("click", alClic);
    pintaBarra();
    escucha();
  }

  function destruir() {
    muerto = true;
    if (parar) { try { parar(); } catch (e) {} parar = null; }
    if (host) { host.removeEventListener("click", alClic); host.innerHTML = ""; }
    host = null;
  }

  function escucha() {
    if (parar) { try { parar(); } catch (e) {} parar = null; }
    cargando = true; fallo = ""; filas = []; pinta();
    parar = watchRanks(juego, (lista, err) => {
      if (muerto) return;
      cargando = false;
      fallo = err ? String(err.code || err.message || err) : "";
      filas = lista || [];
      pinta();
    });
  }

  function pintaBarra() {
    const el = host && host.querySelector("#rkJuegos");
    if (!el) return;
    el.innerHTML = Object.entries(JUEGOS).map(([k, j]) =>
      `<button class="jg-tab${k === juego ? " on" : ""}" data-juego="${k}"
         style="--c:${j.color}">${esc(j.nombre)}</button>`).join("");
  }

  function pinta() {
    if (!host) return;
    const av = host.querySelector("#rkAviso");
    if (av) av.innerHTML = fallo
      ? `<div class="jg-aviso">No se puede leer la clasificación (<code>${esc(fallo)}</code>).
         Si pone <code>PERMISSION_DENIED</code> es que las reglas de <code>ranks</code> todavía
         no están publicadas en la consola de Firebase.</div>`
      : "";

    const t = host.querySelector("#rkTabla");
    if (!t) return;
    const orden = ordenaRanks(filas);
    if (!orden.length) {
      t.innerHTML = `<tr><td class="jg-vacio">${cargando ? "Cargando…"
        : "Todavía no ha terminado ninguna partida de este juego. Sé el primero."}</td></tr>`;
      return;
    }
    t.innerHTML = `
      <thead><tr>
        <th class="jg-th-n">#</th><th>Jugador</th>
        <th class="jg-num">Jugadas</th><th class="jg-num">Ganadas</th>
        <th class="jg-num">Perdidas</th><th class="jg-num">Empates</th>
        <th class="jg-num">%</th><th class="jg-num">Mejor racha</th>
        <th class="jg-num jg-pts">Puntos</th>
      </tr></thead><tbody>${orden.map((f, i) => fila(f, i)).join("")}</tbody>`;
  }

  function fila(fx, i) {
    const f = mezcla(fx, perfil(fx.uid));
    const yo = f.uid === uid;
    const pc = porcentaje(f);
    return `<tr class="${yo ? "jg-yo" : ""}">
      <td class="jg-th-n">${MEDALLA[i] || i + 1}</td>
      <td class="jg-jug">
        ${f.foto ? `<img class="jg-foto" src="${esc(f.foto)}" alt="" referrerpolicy="no-referrer">`
                 : `<span class="jg-foto jg-sin">${esc((f.nombre || "?").slice(0, 1).toUpperCase())}</span>`}
        <span>${esc(f.nombre || "Sin nombre")}${yo ? " <b>(tú)</b>" : ""}</span>
      </td>
      <td class="jg-num">${f.jugadas || 0}</td>
      <td class="jg-num jg-gan">${f.ganadas || 0}</td>
      <td class="jg-num">${f.perdidas || 0}</td>
      <td class="jg-num">${f.empates || 0}</td>
      <td class="jg-num"><span class="jg-barra-pc"><i style="width:${pc}%"></i></span>${pc}%</td>
      <td class="jg-num">${f.mejorRacha || 0}</td>
      <td class="jg-num jg-pts">${f.puntos || 0}</td>
    </tr>`;
  }

  function alClic(ev) {
    const b = ev.target.closest("[data-juego]");
    if (!b) return;
    const k = b.getAttribute("data-juego");
    if (k === juego) return;
    juego = k;
    pintaBarra();
    escucha();
  }

  /* Un perfil que llega después de la tabla no trae fila nueva que
     escuchar, así que hay que decirle desde fuera que se repinte. */
  function refresca() { pinta(); }

  return { montar, destruir, refresca };
}
