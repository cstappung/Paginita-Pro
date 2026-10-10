import * as fb from "../fb-juegos.js";
import { crearMalla } from "./malla.js";
import { crearDirecto, OK_MS } from "./yemas-red.js";
import { votacion, jugadasDe } from "./motor.js";
import TM from "../../../juegos/club/tulones/motor.js";

/* El reductor de la sala (`redTulones` en motor.js) lo busca aquí. */
globalThis.TulonesMotor = globalThis.TulonesMotor || TM;

/* Tulones — el cartero entre la sala y el juego.

   El juego vive en `juegos/club/tulones/` (el mismo documento que el
   Club, con `?modo=online`) y entra aquí en un iframe. Este módulo no
   simula nada: traduce.

   - **Hacia el marco**: `config` (quién soy, los asientos, el tiempo y
     las rondas) cada vez que cambia quién está, también con la sala
     abierta, porque el menú enseña quién dio «Listo»; en cada cambio, el
     registro ya pasado por `votacion` y si la sala ya se cerró (`sala`),
     que el marco reduce con el mismo `reducirSala`; y
     cada segundo la hora del servidor (`hora`), porque el reloj del turno
     se cuenta con ella y no con el del equipo.
   - **Hacia la base**: `listo`, `sale` y `congela`, que el marco pide y
     aquí se firman con el uid y la hora del servidor. Nada más pasa.
   - **Todos listos, empieza**: con dos o más dentro y todos listos, el
     anfitrión cierra la sala (`estado = "jugando"`), así nadie tiene que
     apretar «Empezar» y el que llegue tarde ya no entra.
   - **El plazo lo vigila la sala, no el marco**: si el turno no tiene
     hora de inicio se escribe `reloj`, y pasado el plazo sin congela,
     `plazo`. Lo puede escribir cualquiera de la sala (el primero vale), así
     que un jugador que cerró la pestaña no deja la torre parada.
   - **El directo** (el cuerpo del que trepa, unas quince veces por
     segundo) va por la malla WebRTC de Yemas y Boxhead, nunca por la base. */
const PADRE = "tulones-padre", HIJO = "tulones-hijo";
const VIGILA_MS = 1000;

export function crearTulones({ uid, pid, jugar, terminar, mirando, ahora }) {
  let host, frame, aviso, redEl, muerto = false, listo = false, configurado = false;
  let partida = null, est = null, ultimo = "", borrado = false, cierra = false;
  let malla = null, relojRed = null, relojPlazo = null, pendiente = null, parado = false, rosterFirma = "", sinMalla = false;
  const pedidos = new Set();
  const hora = () => (typeof ahora === "function" ? ahora() : Date.now());
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
    const asientos = est.jugadores.map(j => j.uid + "=" + (j.nombre || "")).join("|") + "|" + juego();
    if (asientos !== configurado) {
      configurado = asientos;
      enviar("config", {
        yo: uid, mirando: !juego(), tiempo: partida.tiempo, rondas: partida.rondas,
        jugadores: est.jugadores.map(j => ({ uid: j.uid, nombre: j.nombre || "Jugador" }))
      });
      enviar("hora", { t: hora() });
      ultimo = "";
    }
    const lista = jugadasDe(votacion(partida).p);
    const firma = lista.length + ":" + (lista.length ? lista[lista.length - 1].k : "") + ":" + !!est.listos;
    if (firma === ultimo) return;
    ultimo = firma;
    enviar("jugadas", { lista, sala: !!est.listos });
  }

  const texto = (v, max) => typeof v === "string" && v.length <= max ? v : "";

  function mensaje(e) {
    if (muerto || e.source !== frame?.contentWindow || e.origin !== location.origin || e.data?.canal !== HIJO) return;
    const d = e.data;
    if (d.tipo === "listo") { listo = true; reenvia(); return; }
    if (partida?.fin || !juego()) return;
    if (d.tipo === "estado" && d.e && typeof d.e === "object") {
      malla?.envia(directo.sale(d.e));
      return;
    }
    if (d.tipo !== "jugar" || !d.j) return;
    const j = d.j;
    if (j.t === "listo") { anota({ t: "listo", on: !!j.on }); return; }
    if (!Number.isInteger(j.n) || j.n < 0) return;
    let fila = null;
    if (j.t === "sale") fila = { t: "sale", n: j.n, a: texto(j.a, 60) };
    else if (j.t === "congela") fila = { t: "congela", n: j.n, p: texto(j.p, 400), b: texto(j.b, 20), a: texto(j.a, 60) };
    if (!fila) return;
    anota(fila);
  }

  function anota(fila) {
    return Promise.resolve(jugar(Object.assign(fila, { uid, at: Math.round(hora()) })))
      .catch(err => console.warn("[tulones] no se pudo anotar", fila.t, err));
  }

  /* Cualquiera de la sala pone en marcha el reloj del turno y lo corta al
     vencer. Una sola vez por turno y pestaña; si dos lo escriben a la vez,
     el reductor se queda con el primero. */
  function vigila() {
    enviar("hora", { t: hora() });
    if (!juego() || !est || est.fase !== "jugando" || partida?.fin) return;
    const n = est.n;
    if (!est.inicio && !est.saleAt && !pedidos.has("r" + n)) { pedidos.add("r" + n); anota({ t: "reloj", n }); }
    if (est.plazo && hora() > est.plazo && !pedidos.has("p" + n)) { pedidos.add("p" + n); anota({ t: "plazo", n }); }
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
    if (sinMalla) txt = "No se pudo entrar al directo: verás cada cuerpo cuando se congele. Recarga la página para reintentar.";
    else if (configurado && !parado && est?.turno && est.turno !== uid) {
      const malos = directo.inalcanzables([est.turno]), estan = new Set(malla?.presentes() || []);
      if (malos.length && estan.has(est.turno)) txt = "Sin conexión directa con " + nombre(est.turno) +
        ": no lo verás trepar, pero su cuerpo aparecerá al congelarse.";
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
      err => { console.warn("[tulones] malla", err); sinMalla = true; pintaRed(); });
    relojRed = setInterval(() => { anuncia(); programa(); pintaRed(); }, OK_MS);
  }
  function paraDirecto() {
    parado = true;
    malla?.salir();
    clearInterval(relojRed);
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
    aviso.textContent = est.listos ? "" : "Esperando tulones… " + n + " de " + cupo +
      (n >= 2 ? " · empieza cuando todos den «Listo»" : "");
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
    frame.title = "Tulones — partida en línea";
    frame.className = "jg-yemas-marco jg-tulones-marco";
    frame.allow = "fullscreen";
    frame.setAttribute("allowfullscreen", "");
    window.addEventListener("message", mensaje);
    frame.src = "juegos/club/tulones/index.html?modo=online&v=tulones-20";
    host.append(aviso, redEl, frame);
    relojPlazo = setInterval(vigila, VIGILA_MS);
  }

  function empiezaSiTodos() {
    if (cierra || partida.estado !== "esperando" || partida.anfitrion !== uid || !juego()) return;
    const js = est.jugadores || [], pre = est.preparados || {};
    if (js.length < 2 || !js.every(j => pre[j.uid])) return;
    cierra = true;
    fb.setEstado(pid, "jugando").catch(err => { cierra = false; console.warn("[tulones] no se pudo empezar", err); });
  }

  function actualizar(p, estado) {
    partida = p; est = estado;
    pintaAviso();
    empiezaSiTodos();
    if (!p.fin && est.listos) {
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
    clearInterval(relojPlazo);
    window.removeEventListener("message", mensaje);
    frame?.remove();
    if (host) host.innerHTML = "";
  }

  return { montar, actualizar, destruir, pantallaCompleta };
}
