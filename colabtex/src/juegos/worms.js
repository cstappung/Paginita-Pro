import * as fb from "../fb-juegos.js";
import { jugadoresDe } from "./motor.js";
import { ambientar } from "./sonido.js";

/* Circuit Breakers (worms) — el cartero entre la sala y el juego.

   El juego vive entero en `juegos/worms/` como documento propio (su canvas,
   su audio, su física) y entra aquí en un iframe, igual que Mina Club. Este
   módulo no simula nada: traduce. Lo que el marco manda (`turno`, los trozos
   de lo que hace quien juega) va a la base, y lo que llega de la base se le
   reenvía al marco. Tres cosas son de aquí:

   - **Cada jugada se reenvía una vez**, por su clave del registro. Se lleva la
     cuenta con la clave y no con `jugadasDe`, porque ese helper pisa la clave
     con el `k` del turno que trae la propia jugada.
   - **La configuración espera a que la sala arranque.** Antes, el marco no
     sabe cuántas cuadrillas habrá, y un juego que empieza con dos y recibe a
     un tercero no tiene arreglo determinista.
   - **El canal en directo se borra al acabar**, desde cualquiera de las
     pestañas que vean el `fin`. No se necesita para rehacer nada: la partida
     queda contada en el registro, y dejarlo ahí solo ocupa. */
export function crearWorms({ uid, pid, jugar, terminar }) {
  let host, frame, aviso, muerto = false, listo = false, configurado = false;
  let offVivo = null, partida = null, est = null, borrado = false;
  const enviadas = new Set(), abandonos = new Set(), ocultos = [];

  function enviar(tipo, datos = {}) {
    if (muerto || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({ canal: "worms-parent", tipo, ...datos }, location.origin);
  }
  function registro(p) {
    return Object.entries(p?.jugadas || {}).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }
  function reenvia() {
    if (!listo || !partida) return;
    if (!configurado && est?.listos) {
      configurado = true;
      const js = jugadoresDe(partida);
      enviar("config", {
        yo: uid,
        jugadores: js.map((j, i) => ({ uid: j.uid, nombre: j.nombre || "Jugador", orden: i })),
        opciones: {
          mapa: partida.mapa || "substation", escuadra: +partida.escuadra || 4,
          tiempo: +partida.tiempo || 45, semilla: partida.semilla | 0
        }
      });
    }
    const turnos = [], fuera = [];
    for (const [idx, j] of registro(partida)) {
      if (enviadas.has(idx)) continue;
      if (j.t === "turno") { enviadas.add(idx); turnos.push({ idx, uid: j.uid, k: j.k, s: j.s, v: j.v, d: j.d, ti: j.ti }); }
      else if (j.t === "abandona") { enviadas.add(idx); if (!abandonos.has(j.uid)) { abandonos.add(j.uid); fuera.push({ uid: j.uid, idx }); } }
    }
    /* La primera tanda va aunque esté vacía: el marco no arranca hasta
       saber que no hay nada que ponerse al día. */
    if (turnos.length || !reenvia.primera) { reenvia.primera = true; enviar("turnos", { lista: turnos }); }
    if (fuera.length) enviar("abandonos", { lista: fuera });
  }

  async function alListo() {
    if (listo) return;
    listo = true;
    reenvia();
    const v = await fb.leerVivo(pid);
    if (muerto) return;
    enviar("vivo", { v });
    offVivo = fb.watchVivo(pid, h => enviar("vivo-h", { h }), (i, s) => enviar("vivo-c", { i, s }));
  }

  function mensaje(e) {
    if (muerto || e.source !== frame?.contentWindow || e.origin !== location.origin || e.data?.canal !== "worms-child") return;
    const d = e.data;
    if (d.tipo === "listo") { alListo(); return; }
    if (partida?.fin || !est?.jugadores?.some(j => j.uid === uid)) return;   // un mirón no escribe
    if (d.tipo === "turno" && d.k > 0 && typeof d.s === "string") {
      const v = (Array.isArray(d.v) ? d.v : []).filter(x => typeof x === "string");
      const dan = (Array.isArray(d.d) ? d.d : []).map(x => Math.round(+x || 0));
      jugar({ t: "turno", uid, k: d.k | 0, s: d.s, v, d: dan, ti: d.ti | 0 })
        .catch(err => console.warn("[worms] no se pudo publicar el turno", err));
    } else if (d.tipo === "vivo-cabecera" && d.k > 0) {
      fb.escribeVivo(pid, { k: d.k | 0, uid }).catch(() => {});
    } else if (d.tipo === "vivo-trozo" && typeof d.i === "string" && typeof d.s === "string") {
      fb.trozoVivo(pid, d.i, d.s).catch(() => {});
    }
  }

  function pintaAviso() {
    if (!aviso || !est) return;
    const n = est.jugadores.length, cupo = est.cupo || n;
    aviso.hidden = !!est.listos;
    aviso.textContent = est.listos ? "" : "Esperando cuadrillas… " + n + " de " + cupo +
      (cupo > 2 && n >= 2 ? " · el anfitrión puede empezar ya" : "");
  }

  function montar(el) {
    host = el; ambientar(""); host.innerHTML = "";
    for (const id of ["btnMusica", "volMusica", "btnSonido"]) {
      const b = document.getElementById(id);
      if (b) { ocultos.push([b, b.style.display]); b.style.display = "none"; }
    }
    aviso = document.createElement("p");
    aviso.className = "jg-worms-aviso";
    aviso.setAttribute("role", "status");
    aviso.hidden = true;
    frame = document.createElement("iframe");
    frame.title = "Circuit Breakers — partida en línea";
    frame.style.cssText = "display:block;width:100%;height:calc(100vh - 120px);min-height:560px;border:0;border-radius:18px;background:#0b1825";
    frame.allow = "fullscreen";
    frame.setAttribute("allowfullscreen", "");
    window.addEventListener("message", mensaje);
    frame.src = "juegos/worms/index.html?modo=online&v=worms-3";
    host.append(aviso, frame);
  }

  function actualizar(p, estado) {
    partida = p; est = estado;
    pintaAviso();
    reenvia();
    if (est.fase === "fin" && !p.fin && est.jugadores.some(j => j.uid === uid)) terminar(est.ganador, est.motivo);
    if (p.fin && !borrado && est.jugadores.some(j => j.uid === uid)) {
      borrado = true;
      fb.borraVivo(pid).catch(() => {});
    }
  }

  function destruir() {
    muerto = true;
    if (offVivo) offVivo();
    window.removeEventListener("message", mensaje);
    for (const [b, valor] of ocultos) b.style.display = valor;
    frame?.remove();
    if (host) host.innerHTML = "";
    ambientar("");
  }

  return { montar, actualizar, destruir };
}
