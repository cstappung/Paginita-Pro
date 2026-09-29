import * as fb from "../fb-juegos.js";

/* Yemas — el cartero entre la sala y el juego.

   El juego vive entero en `juegos/yemas/` como documento propio (Three.js,
   su física, sus bots de práctica) y entra aquí en un iframe, igual que
   Circuit Breakers. Este módulo no simula nada: traduce.

   - **Lo del marco hacia la base**: el `estado` de mi huevo va a
     `vivo/<pid>/y/<uid>` (unas doce veces por segundo, lo decide el marco),
     y cada `muere` es una jugada del registro, escrita por quien murió.
   - **Lo de la base hacia el marco**: los huevos de los demás tal como
     llegan de `vivo`, el marcador que sale del reductor (bajas, muertes,
     quién se fue, si ya hay ganador) y cada muerte del registro una sola
     vez, por su clave, para el feed. La primera tanda va marcada como
     `viejas`: son las de antes de abrir la pestaña y no se anuncian.
   - **La configuración espera a que la sala arranque**, como en Circuit
     Breakers: antes el marco no sabe quiénes van a estar.
   - **El directo se borra al acabar**, desde cualquiera de las pestañas de
     jugador que vean el `fin`. */
const PADRE = "yemas-padre", HIJO = "yemas-hijo";

export function crearYemas({ uid, pid, jugar, terminar, mirando }) {
  let host, frame, aviso, muerto = false, listo = false, configurado = false;
  let offVivo = null, partida = null, est = null, borrado = false, primeraTanda = true;
  const enviadas = new Set();

  const juego = () => !!est?.jugadores?.some(j => j.uid === uid) && !mirando;

  function enviar(tipo, datos = {}) {
    if (muerto || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({ canal: PADRE, tipo, ...datos }, location.origin);
  }
  function registro(p) {
    return Object.entries(p?.jugadas || {}).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }

  function reenvia() {
    if (!listo || !partida || !est) return;
    if (!configurado) {
      if (!est.listos) return;
      configurado = true;
      enviar("config", {
        yo: uid, mirando: !juego(), meta: est.meta,
        jugadores: est.jugadores.map((j, i) => ({ uid: j.uid, nombre: j.nombre || "Huevo", orden: i }))
      });
      offVivo = fb.watchYemasVivo(pid, v => enviar("vivo", { v }));
    }
    enviar("marcador", {
      bajas: est.bajas, muertes: est.muertes, meta: est.meta,
      fuera: Object.keys(est.fuera || {}),
      fin: est.fase === "fin" ? { ganador: est.ganador || "", motivo: est.motivo || "" } : null
    });
    const lista = [];
    for (const [idx, j] of registro(partida)) {
      if (enviadas.has(idx)) continue;
      enviadas.add(idx);
      if (j.t === "muere") lista.push({ v: j.uid, por: j.por || "", a: j.a | 0, cab: !!j.cab });
    }
    if (lista.length || primeraTanda) enviar("bajas", { lista, viejas: primeraTanda });
    primeraTanda = false;
  }

  function mensaje(e) {
    if (muerto || e.source !== frame?.contentWindow || e.origin !== location.origin || e.data?.canal !== HIJO) return;
    const d = e.data;
    if (d.tipo === "listo") { listo = true; reenvia(); return; }
    if (partida?.fin || !juego()) return;   // un mirón no escribe
    if (d.tipo === "estado" && d.e && typeof d.e === "object") {
      fb.yemasVivo(pid, uid, d.e);
    } else if (d.tipo === "muere") {
      const a = Number.isInteger(d.a) && d.a >= 0 && d.a <= 2 ? d.a : 0;
      jugar({ t: "muere", uid, por: typeof d.por === "string" ? d.por.slice(0, 64) : "", a, cab: !!d.cab })
        .catch(err => console.warn("[yemas] no se pudo anotar la muerte", err));
    }
  }

  function pintaAviso() {
    if (!aviso || !est) return;
    const n = est.jugadores.length, cupo = est.cupo || n;
    aviso.hidden = !!est.listos;
    aviso.textContent = est.listos ? "" : "Esperando huevos… " + n + " de " + cupo +
      (cupo > 2 && n >= 2 ? " · el anfitrión puede empezar ya" : "");
  }

  function montar(el) {
    host = el; host.innerHTML = "";
    aviso = document.createElement("p");
    aviso.className = "jg-yemas-aviso";
    aviso.setAttribute("role", "status");
    aviso.hidden = true;
    frame = document.createElement("iframe");
    frame.title = "Yemas — partida en línea";
    frame.className = "jg-yemas-marco";
    frame.allow = "fullscreen";
    frame.setAttribute("allowfullscreen", "");
    window.addEventListener("message", mensaje);
    frame.src = "juegos/yemas/index.html?modo=online&v=yemas-1";
    host.append(aviso, frame);
  }

  function actualizar(p, estado) {
    partida = p; est = estado;
    pintaAviso();
    reenvia();
    if (est.fase === "fin" && !p.fin && juego()) terminar(est.ganador, est.motivo);
    if (p.fin && !borrado && juego()) {
      borrado = true;
      fb.borraVivo(pid);
    }
  }

  function destruir() {
    muerto = true;
    if (offVivo) offVivo();
    window.removeEventListener("message", mensaje);
    frame?.remove();
    if (host) host.innerHTML = "";
  }

  return { montar, actualizar, destruir };
}
