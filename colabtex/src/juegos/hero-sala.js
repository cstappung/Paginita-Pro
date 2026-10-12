import * as fb from "../fb-juegos.js";
import { crearMalla } from "./malla.js";
import { crearDirecto, OK_MS } from "./yemas-red.js";
import { atiendeHero, mandaCuenta } from "./hero.js";

/* PRO HERO en línea — el cartero de la sala, hermano del de Boxhead.

   El juego (`juegos/hero/index.html?modo=online`) habla el mismo protocolo
   que tenía con su servidor WebSocket (`juegos/hero/js/net/net.js`), y este
   módulo hace de servidor:

   - **Lo que hay que acordar va al registro** de la sala como jugadas
     (`redHero` en motor.js): la canción, la parte de cada uno, «listo»,
     empezar, «ya descargué», el arranque (`go`, con la hora del servidor) y
     el resultado de cada uno. Son unas pocas escrituras por canción.
   - **El directo va de navegador a navegador** por la malla WebRTC de Yemas
     (`malla.js` + `yemas-red.js`, buzón en `vivo/<pid>/rtc`): el puntaje,
     el combo, el Star Power y los últimos aciertos de cada uno, unas diez
     veces por segundo. Nada de eso pasa por la base de datos.
   - **Arrancan todos a la vez**: quien dirige escribe `go` cuando todos
     terminaron de descargar la canción, y cada pantalla la empieza
     `HR_DEMORA` ms después de esa hora del servidor (`fb.ahora`).
   - Cada canción terminada se verifica y se guarda (estrellas, top, monedas)
     igual que tocando solo (`hero.js`, `atiendeHero`). */
const PADRE = "hero-padre", HIJO = "hero-hijo";

export function crearHeroSala({ uid, pid, jugar, terminar, mirando }) {
  let host, frame, temaObs, redEl, muerto = false, listo = false, hola = false;
  let partida = null, est = null, borrado = false, firmaSala = "";
  let malla = null, reloj = null, parado = false, rosterFirma = "", sinMalla = false;
  let cargaRonda = 0, goRonda = 0, goEscrito = 0, resRonda = -1, parteEnviada = "";
  const directo = crearDirecto({ uid, sano: u => !!malla?.sano(u), conectados: () => malla?.conectados() || [] });

  const juego = () => !!est?.jugadores?.some(j => j.uid === uid) && !mirando;
  const esJugador = u => !!est?.jugadores?.some(j => j.uid === u);
  const nombre = u => est?.jugadores?.find(j => j.uid === u)?.nombre || "Jugador";
  const otros = () => (est?.jugadores || []).map(j => j.uid).filter(u => u !== uid && !est.fuera?.[u]);

  const enviar = (tipo, datos = {}) => {
    if (!muerto) frame?.contentWindow?.postMessage({ canal: PADRE, tipo, ...datos }, location.origin);
  };
  const red = m => enviar("red", { m });
  const tema = () => enviar("tema", { oscuro: document.documentElement.dataset.tema === "oscuro" });

  const statsDe = f => f && {
    score: f.s, stars: f.e, hits: f.h, total: f.n, misses: f.x, accuracy: f.n ? f.h / f.n : 0, bestCombo: f.c,
    spPhrases: f.sp, spTotal: f.st, overhits: f.o, fc: !!f.fc, quit: !!f.q
  };

  // La sala con la forma que esperaba el juego de su servidor
  function sala() {
    if (!est) return null;
    const fase = est.etapa === "sala" ? "lobby" : est.etapa === "cargando" ? "loading" : "playing";
    const fines = est.etapa === "tocando" ? est.fines : est.ultima?.fines || {};
    return {
      code: "", host: est.director, phase: fase, songId: est.cancion || null, cupo: est.cupo, ronda: est.ronda,
      players: est.jugadores.filter(j => !est.fuera?.[j.uid]).map(j => {
        const pt = est.partes[j.uid] || {};
        return {
          id: j.uid, name: j.nombre || "Jugador", part: pt.p || "guitar", diff: pt.d || "expert", mode: pt.m || "",
          ready: !!est.preparados[j.uid], inGame: est.etapa !== "sala" && est.enJuego.includes(j.uid),
          stats: statsDe(fines[j.uid]) || null
        };
      })
    };
  }

  function reenvia() {
    if (!listo || !hola || !est) return;
    const room = sala();
    const firma = JSON.stringify(room);
    if (firma !== firmaSala) { firmaSala = firma; red({ t: "room", room }); }
    const yoEnRonda = juego() && est.enJuego.includes(uid);
    if (est.etapa === "cargando" && yoEnRonda && cargaRonda !== est.ronda) {
      cargaRonda = est.ronda;
      red({ t: "load", songId: est.cancion, room });
    }
    // quien dirige da la salida cuando todos descargaron
    if (est.etapa === "cargando" && juego() && est.director === uid && goEscrito !== est.ronda &&
      est.enJuego.every(u => est.fuera?.[u] || est.cargados[u])) {
      goEscrito = est.ronda;
      anota({ t: "go", at: Math.round(fb.ahora()) });
    }
    if (est.etapa === "tocando" && yoEnRonda && goRonda !== est.ronda && est.go) {
      goRonda = est.ronda;
      red({ t: "reloj", off: fb.ahora() - Date.now() });
      red({ t: "go", at: est.go, room });
    }
    if (est.ultima && est.ultima.ronda !== resRonda) {
      const primera = resRonda < 0;
      resRonda = est.ultima.ronda;
      if (!primera) red({ t: "results", room });
    }
  }

  const anota = j => jugar(j).catch(err => console.warn("[hero] no se pudo anotar", j.t, err));
  const ent = (x, max) => Number.isFinite(x) ? Math.max(0, Math.min(max, Math.round(x))) : 0;

  function deRed(m) {
    if (!m || typeof m !== "object") return;
    if (m.t === "hello") {
      hola = true;
      red({ t: "welcome", id: uid });
      red({ t: "reloj", off: fb.ahora() - Date.now() });
      firmaSala = "";
      reenvia();
      return;
    }
    if (partida?.fin || !juego() || !est) return;   // quien mira no escribe
    if (m.t === "state") { malla?.envia(directo.sale(m)); return; }
    if (m.t === "song" && typeof m.songId === "string" && m.songId.length <= 300) anota({ t: "cancion", id: m.songId });
    else if (m.t === "part") {
      const a = est.partes[uid] || {}, quiere = [m.part, m.diff, m.mode].join("|");
      // el juego la vuelve a pedir en cada repintado hasta que llega: una vez basta
      if ((a.p !== m.part || a.d !== m.diff || a.m !== m.mode) && quiere !== parteEnviada) {
        parteEnviada = quiere;
        anota({ t: "parte", p: String(m.part || ""), d: String(m.diff || ""), m: String(m.mode || "") });
      }
    } else if (m.t === "ready") anota({ t: "listo", on: !!m.ready });
    else if (m.t === "start") anota({ t: "empieza" });
    else if (m.t === "loaded") anota({ t: "cargado" });
    else if (m.t === "noload") anota({ t: "nocarga" });
    else if (m.t === "done" && est.etapa === "tocando" && est.enJuego.includes(uid) && !est.fines[uid]) {
      const s = m.stats || {};
      anota({ t: "fin", r: est.ronda, s: ent(s.score, 1e8), e: ent(s.stars, 6), h: ent(s.hits, 1e5), n: ent(s.total, 1e5),
        x: ent(s.misses, 1e5), c: ent(s.bestCombo, 1e5), sp: ent(s.spPhrases, 1e4), st: ent(s.spTotal, 1e4), o: ent(s.overhits, 1e5),
        fc: s.fc ? 1 : 0, q: s.quit ? 1 : 0 });
    }
  }

  function mensaje(e) {
    if (muerto || e.source !== frame?.contentWindow || e.origin !== location.origin || e.data?.canal !== HIJO) return;
    const d = e.data;
    if (d.tipo === "listo") { listo = true; tema(); mandaCuenta(enviar); return; }
    if (d.tipo === "red") { deRed(d.m); return; }
    if (d.tipo === "resultado" && !juego()) return;
    atiendeHero(d.tipo, d, enviar);
  }

  // ---------- el directo ----------
  function alDatos(u, d) {
    const r = directo.recibe(u, d);
    if (r.reenvia) malla.envia(r.reenvia.d, r.reenvia.a);
    if (!r.cambio) return;
    const o = d.y === "e" ? d.o : u;
    const e = directo.mapa([o])[o];
    if (e && esJugador(o)) red({ ...e, t: "pstate", id: o });
  }
  const anuncia = () => malla?.envia(directo.anuncio());

  function pintaRed() {
    if (!redEl) return;
    let txt = "";
    if (sinMalla) txt = "No se pudo entrar al directo de la sala: recarga la página.";
    else if (est?.etapa === "tocando" && !parado) {
      const malos = directo.inalcanzables(otros()), estan = new Set(malla?.presentes() || []);
      const idos = malos.filter(u => !estan.has(u)), sinCanal = malos.filter(u => estan.has(u));
      const lista = us => us.map(nombre).join(", ");
      const partes = [];
      if (idos.length) partes.push(lista(idos) + (idos.length > 1 ? " no están" : " no está") + " en la sala ahora (cerró la pestaña o se quedó sin internet).");
      if (sinCanal.length) partes.push("Sin conexión directa con " + lista(sinCanal) + ": no ves su autopista, pero su resultado llega igual al terminar.");
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
      alDatos,
      alCambiar: () => anuncia(),
    });
    malla.entrar().then(ok => { if (!ok && !parado) { sinMalla = true; pintaRed(); } },
      err => { console.warn("[hero] malla", err); sinMalla = true; pintaRed(); });
    reloj = setInterval(() => { anuncia(); pintaRed(); }, OK_MS);
  }
  function paraDirecto() {
    parado = true;
    malla?.salir();
    clearInterval(reloj);
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

  function montar(el) {
    host = el; host.innerHTML = "";
    redEl = document.createElement("p");
    redEl.className = "jg-yemas-aviso jg-yemas-red";
    redEl.setAttribute("role", "status");
    redEl.hidden = true;
    frame = document.createElement("iframe");
    frame.title = "PRO HERO — sala en línea";
    frame.className = "jg-yemas-marco jg-hero-marco";
    frame.allow = "autoplay; gamepad; fullscreen";
    frame.setAttribute("allowfullscreen", "");
    window.addEventListener("message", mensaje);
    temaObs = new MutationObserver(tema);
    temaObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    frame.src = "juegos/hero/index.html?modo=online&v=hero-1";
    host.append(redEl, frame);
  }

  function actualizar(p, estado) {
    partida = p; est = estado;
    if (!p.fin) {
      arrancaDirecto();
      const firma = est.jugadores.map(j => j.uid).join() + "|" + Object.keys(est.fuera || {}).join();
      if (firma !== rosterFirma) { rosterFirma = firma; malla?.revisa(); }
    }
    reenvia();
    if (est.fase === "fin" && !p.fin && juego()) terminar(est.ganador, est.motivo);
    if (p.fin && !parado) paraDirecto();
    if (p.fin && !borrado && juego()) { borrado = true; fb.borraYemasVivo(pid); }
  }

  function destruir() {
    muerto = true;
    paraDirecto();
    temaObs?.disconnect();
    window.removeEventListener("message", mensaje);
    frame?.remove();
    if (host) host.innerHTML = "";
  }

  return { montar, actualizar, destruir, pantallaCompleta };
}
