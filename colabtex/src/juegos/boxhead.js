import * as fb from "../fb-juegos.js";
import { crearMalla } from "./malla.js";
import { crearDirecto, OK_MS } from "./yemas-red.js";
import { BX_ARMAS } from "./motor.js";

/* Boxhead — el cartero entre la sala y el juego, hermano del de Yemas.

   El juego vive entero en `juegos/boxhead/` (un canvas, sus enemigos, su
   práctica en solitario) y entra aquí en un iframe. Este módulo no simula
   nada: traduce.

   - **El directo va de navegador a navegador** por la misma malla WebRTC
     que Yemas (`malla.js` + `yemas-red.js`, buzón en `vivo/<pid>/rtc`): la
     posición de cada uno, sus disparos y, en el estado de quien dirige, los
     enemigos. Nada de eso pasa por la base.
   - **Al registro va solo lo que decide la partida**: `muere` (escrito por
     quien muere) y `nivel` (escrito por quien dirige al limpiar uno).
   - **La configuración espera a que la sala arranque**: antes el marco no
     sabe cuántos van a estar, y cuántos son decide cuántos enemigos salen. */
const PADRE = "boxhead-padre", HIJO = "boxhead-hijo";

export function crearBoxhead({ uid, pid, jugar, terminar, mirando }) {
  let host, frame, aviso, redEl, muerto = false, listo = false, configurado = false;
  let partida = null, est = null, borrado = false;
  let malla = null, reloj = null, pendiente = null, parado = false, rosterFirma = "", sinMalla = false;
  const directo = crearDirecto({
    uid,
    sano: u => !!malla?.sano(u),
    conectados: () => malla?.conectados() || [],
  });

  const juego = () => !!est?.jugadores?.some(j => j.uid === uid) && !mirando;
  const esJugador = u => !!est?.jugadores?.some(j => j.uid === u);
  const nombre = u => est?.jugadores?.find(j => j.uid === u)?.nombre || "Jugador";

  function enviar(tipo, datos = {}) {
    if (muerto || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({ canal: PADRE, tipo, ...datos }, location.origin);
  }

  function reenvia() {
    if (!listo || !partida || !est) return;
    if (!configurado) {
      if (!est.listos) return;
      configurado = true;
      enviar("config", {
        yo: uid, mirando: !juego(), variante: est.variante, mapa: est.mapa, meta: est.meta,
        semilla: (partida.semilla >>> 0) || 1,
        jugadores: est.jugadores.map((j, i) => ({ uid: j.uid, nombre: j.nombre || "Jugador", orden: i }))
      });
      programa();
    }
    enviar("marcador", {
      nivel: est.nivel || 1, caidos: est.caidos || [], bajas: est.bajas || {}, muertes: est.muertes || {},
      puntos: est.puntos || {}, fuera: Object.keys(est.fuera || {}), meta: est.meta,
      fin: est.fase === "fin" ? { ganador: est.ganador || "", motivo: est.motivo || "", nivel: est.nivel || 1 } : null
    });
  }

  const ent = (x, max) => Number.isInteger(x) && x >= 0 && x <= max ? x : 0;

  function mensaje(e) {
    if (muerto || e.source !== frame?.contentWindow || e.origin !== location.origin || e.data?.canal !== HIJO) return;
    const d = e.data;
    if (d.tipo === "listo") { listo = true; reenvia(); return; }
    if (partida?.fin || !juego()) return;   // un mirón no escribe
    const anota = j => jugar(j).catch(err => console.warn("[boxhead] no se pudo anotar", j.t, err));
    if (d.tipo === "estado" && d.e && typeof d.e === "object") {
      malla?.envia(directo.sale(d.e));
    } else if (d.tipo === "muere") {
      const j = { t: "muere", uid, por: typeof d.por === "string" ? d.por.slice(0, 64) : "", a: ent(d.w, BX_ARMAS + 1) };
      if (d.pts !== undefined) { j.pts = ent(d.pts, 1e9); j.k = ent(d.k, 1e7); j.n = ent(d.n, 1e4); }
      anota(j);
    } else if (d.tipo === "nivel" && Number.isInteger(d.n) && d.n > 1 && d.n < 1e4) {
      anota({ t: "nivel", uid, n: d.n });
    }
  }

  // ---------- el directo ----------
  const otros = () => (est?.jugadores || []).map(j => j.uid).filter(u => u !== uid && !est.fuera?.[u]);

  function programa() {
    if (pendiente || parado) return;
    pendiente = setTimeout(() => {
      pendiente = null;
      if (configurado && !parado) enviar("vivo", { v: directo.mapa(otros()) });
    }, 16);
  }
  const anuncia = () => malla?.envia(directo.anuncio());

  function pintaRed() {
    if (!redEl) return;
    let txt = "";
    if (sinMalla) txt = "No se pudo entrar al directo de la partida: recarga la página.";
    else if (configurado && !parado) {
      const malos = directo.inalcanzables(otros()), estan = new Set(malla?.presentes() || []);
      const idos = malos.filter(u => !estan.has(u)), red = malos.filter(u => estan.has(u));
      const lista = us => us.map(nombre).join(", ");
      const partes = [];
      if (idos.length) partes.push(lista(idos) + (idos.length > 1 ? " no están" : " no está") + " en la partida ahora (cerró la pestaña o se quedó sin internet).");
      if (red.length) partes.push("Sin conexión con " + lista(red) +
        ": sus redes no dejan una conexión directa y no hay nadie en común que la reenvíe. Prueben otra red (los datos del celular suelen bloquearla).");
      txt = partes.join(" ");
    }
    redEl.hidden = !txt;
    if (redEl.textContent !== txt) redEl.textContent = txt;
  }

  function arrancaDirecto() {
    if (malla || parado) return;
    malla = crearMalla({
      uid, senal: fb.senalMalla(pid, uid),
      quiere: u => juego() || esJugador(u),
      alDatos: (u, d) => {
        const r = directo.recibe(u, d);
        if (r.reenvia) malla.envia(r.reenvia.d, r.reenvia.a);
        if (r.cambio) programa();
      },
      alCambiar: () => { anuncia(); programa(); },
    });
    malla.entrar().then(ok => { if (!ok && !parado) { sinMalla = true; pintaRed(); } },
      err => { console.warn("[boxhead] malla", err); sinMalla = true; pintaRed(); });
    reloj = setInterval(() => { anuncia(); programa(); pintaRed(); }, OK_MS);
  }
  function paraDirecto() {
    parado = true;
    malla?.salir();
    clearInterval(reloj);
    clearTimeout(pendiente);
    pintaRed();
  }

  function pantallaCompleta() {
    const pide = frame?.requestFullscreen || frame?.webkitRequestFullscreen;
    if (!pide) return false;
    try {
      const r = pide.call(frame, { navigationUI: "hide" });
      r?.then?.(() => frame.contentWindow?.focus(), () => {});
    } catch { return false; }
    frame.contentWindow?.focus();
    return true;
  }

  function pintaAviso() {
    if (!aviso || !est) return;
    const n = est.jugadores.length, cupo = est.cupo || n;
    aviso.hidden = !!est.listos;
    aviso.textContent = est.listos ? "" : "Esperando jugadores… " + n + " de " + cupo +
      (n >= (est.variante === "versus" ? 2 : 1) ? " · el anfitrión puede empezar ya" : "");
  }

  function montar(el) {
    host = el; host.innerHTML = "";
    aviso = document.createElement("p");
    aviso.className = "jg-yemas-aviso";
    aviso.setAttribute("role", "status");
    aviso.hidden = true;
    redEl = document.createElement("p");
    redEl.className = "jg-yemas-aviso jg-yemas-red";
    redEl.setAttribute("role", "status");
    redEl.hidden = true;
    frame = document.createElement("iframe");
    frame.title = "Boxhead — partida en línea";
    frame.className = "jg-yemas-marco jg-boxhead-marco";
    frame.allow = "fullscreen";
    frame.setAttribute("allowfullscreen", "");
    window.addEventListener("message", mensaje);
    frame.src = "juegos/boxhead/index.html?modo=online&v=boxhead-2";
    host.append(aviso, redEl, frame);
  }

  function actualizar(p, estado) {
    partida = p; est = estado;
    pintaAviso();
    if (!p.fin) {
      arrancaDirecto();
      const firma = est.jugadores.map(j => j.uid).join() + "|" + Object.keys(est.fuera || {}).join();
      if (firma !== rosterFirma) { rosterFirma = firma; malla?.revisa(); }
    }
    reenvia();
    if (est.fase === "fin" && !p.fin && juego()) terminar(est.ganador, est.motivo);
    if (p.fin && !parado) paraDirecto();
    if (p.fin && !borrado && juego()) {
      borrado = true;
      fb.borraYemasVivo(pid);
    }
  }

  function destruir() {
    muerto = true;
    paraDirecto();
    window.removeEventListener("message", mensaje);
    frame?.remove();
    if (host) host.innerHTML = "";
  }

  return { montar, actualizar, destruir, pantallaCompleta };
}
