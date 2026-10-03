import * as fb from "../fb-juegos.js";
import { crearVoz } from "./voz.js";
import { crearMalla } from "./malla.js";
import { crearDirecto, OK_MS } from "./yemas-red.js";
import { YM_ARMAS, mapaYemas } from "./motor.js";

/* Yemas — el cartero entre la sala y el juego.

   El juego vive entero en `juegos/yemas/` como documento propio (Three.js,
   su física, sus bots de práctica) y entra aquí en un iframe, igual que
   Circuit Breakers. Este módulo no simula nada: traduce.

   - **El directo no pasa por la base, nunca**: el `estado` de mi huevo
     (unas doce veces por segundo, lo decide el marco) va de navegador a
     navegador por una malla WebRTC (`malla.js`). El par que no logra canal
     directo se sirve por un tercero que tenga canal con los dos; si no hay
     ninguno, la pantalla avisa con quién no hay conexión. Qué se reenvía y
     qué ve el marco lo decide `yemas-red.js`.
   - **Lo del marco hacia el registro**: cada `muere`, `toma`, `devuelve` o
     `captura` es una jugada, escrita por quien la hace.
   - **Lo de la sala hacia el marco**: los huevos de los demás (el estado
     más nuevo de cada uno, directo o reenviado), el marcador que sale del reductor (bajas, muertes,
     equipos, banderas, quién se fue, si ya hay ganador) y cada suceso del
     registro una sola vez, por su clave, para el feed. La primera tanda va
     marcada como `viejas`: son las de antes de abrir la pestaña y no se
     anuncian.
   - **La configuración espera a que la sala arranque**, como en Circuit
     Breakers: antes el marco no sabe quiénes van a estar ni en qué equipo.
   - **El directo se borra al acabar**, desde cualquiera de las pestañas de
     jugador que vean el `fin`.

   La barra de voz vive aquí y no en el marco: el micrófono y las
   conexiones son de la sala, y el marco solo avisa cuándo se aprieta la V
   (`hablar`) y recibe quién está hablando (`voces`) para pintarlo. La voz
   dura lo que dura la sala abierta, no la partida: al acabar se borran los
   huevos (`borraYemasVivo`) pero no la voz, y solo se corta al salir de la
   sala. Quien estaba en la voz vuelve a entrar solo en la revancha
   (`sessionStorage`, por el `origen` de la sala nueva) y al recargar.

   En las variantes por equipo, mientras la sala espera, cada uno elige el
   suyo (`{t:"equipo", e}`); el reductor decide qué elección vale.

   En zombis el marco que dirige escribe `{t:"ronda", r}` al limpiar una, y
   cada `muere` lleva los puntos, los zombis fritos y la ronda; el marcador
   le devuelve al marco la ronda vigente y quiénes están caídos. */
const PADRE = "yemas-padre", HIJO = "yemas-hijo";
const SUCESOS = new Set(["muere", "toma", "devuelve", "captura"]);
const VOZ_RECUERDA = "yemas.voz";
const recuerdaVoz = pid => { try { if (pid) sessionStorage.setItem(VOZ_RECUERDA, pid); else sessionStorage.removeItem(VOZ_RECUERDA); } catch {} };
const vozRecordada = () => { try { return sessionStorage.getItem(VOZ_RECUERDA) || ""; } catch { return ""; } };

export function crearYemas({ uid, pid, jugar, terminar, mirando }) {
  let host, frame, aviso, redEl, barra, equiposEl, muerto = false, listo = false, configurado = false, autoVoz = false;
  let partida = null, est = null, borrado = false, primeraTanda = true;
  let voz = null, vozEstado = null;
  const enviadas = new Set();
  // El directo: la malla y lo que decide qué se reenvía y qué ve el marco.
  let malla = null, reloj = null, pendiente = null, parado = false, rosterFirma = "", sinMalla = false;
  const directo = crearDirecto({
    uid,
    sano: u => !!malla?.sano(u),
    conectados: () => malla?.conectados() || [],
  });

  const juego = () => !!est?.jugadores?.some(j => j.uid === uid) && !mirando;
  const esJugador = u => !!est?.jugadores?.some(j => j.uid === u);
  const nombre = u => est?.jugadores?.find(j => j.uid === u)?.nombre || "Huevo";

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
        yo: uid, mirando: !juego(), meta: est.meta, variante: est.variante, equipos: est.equipos || null,
        mapa: mapaYemas(partida),
        semilla: (partida.semilla >>> 0) || 1,
        jugadores: est.jugadores.map((j, i) => ({ uid: j.uid, nombre: j.nombre || "Huevo", orden: i }))
      });
      programa();
    }
    enviar("marcador", {
      bajas: est.bajas, muertes: est.muertes, meta: est.meta, equipos: est.equipos || null,
      puntosEq: est.puntosEq || null, banderas: est.banderas || null, armas: est.armas || {},
      fuera: Object.keys(est.fuera || {}),
      ronda: est.ronda || 0, caidos: est.caidos || [], puntos: est.variante === "zombis" ? est.puntos || {} : {},
      fin: est.fase === "fin" ? { ganador: est.ganador || "", motivo: est.motivo || "", ronda: est.ronda || 0, puntos: est.puntos || {} } : null
    });
    const lista = [];
    for (const [idx, j] of registro(partida)) {
      if (enviadas.has(idx)) continue;
      enviadas.add(idx);
      if (SUCESOS.has(j.t)) lista.push({ t: j.t, uid: j.uid, por: j.por || "", b: j.b || "", a: j.a | 0, cab: !!j.cab, auto: !!j.auto });
    }
    if (lista.length || primeraTanda) enviar("bajas", { lista, viejas: primeraTanda });
    primeraTanda = false;
  }

  const num = x => Number.isFinite(+x) ? Math.round(+x * 100) / 100 : 0;
  const bandera = b => b === "rojo" || b === "azul" ? b : "";

  function mensaje(e) {
    if (muerto || e.source !== frame?.contentWindow || e.origin !== location.origin || e.data?.canal !== HIJO) return;
    const d = e.data;
    if (d.tipo === "listo") { listo = true; reenvia(); return; }
    if (d.tipo === "hablar") { voz?.hablar(!!d.on); return; }
    if (d.tipo === "voz") { if (juego() && !vozEstado?.activo) entrarVoz(); return; }
    if (partida?.fin || !juego()) return;   // un mirón no escribe
    const anota = j => jugar(j).catch(err => console.warn("[yemas] no se pudo anotar", j.t, err));
    if (d.tipo === "estado" && d.e && typeof d.e === "object") {
      malla?.envia(directo.sale(d.e));
    } else if (d.tipo === "muere") {
      const a = Number.isInteger(d.a) && d.a >= 0 && d.a < YM_ARMAS ? d.a : 0;
      const j = { t: "muere", uid, por: typeof d.por === "string" ? d.por.slice(0, 64) : "", a, cab: !!d.cab };
      if (d.x !== undefined) { j.x = num(d.x); j.z = num(d.z); }
      const ent = (x, max) => Number.isInteger(x) && x >= 0 && x <= max ? x : 0;
      if (d.pts !== undefined) { j.pts = ent(d.pts, 1e8); j.zk = ent(d.zk, 1e6); j.r = ent(d.r, 1e4); }
      anota(j);
    } else if (d.tipo === "ronda" && Number.isInteger(d.r) && d.r > 1 && d.r < 1e4) {
      anota({ t: "ronda", uid, r: d.r });
    } else if (d.tipo === "recoge" && Number.isInteger(d.s) && Number.isInteger(d.g)) {
      anota({ t: "recoge", uid, s: d.s, g: d.g });
    } else if ((d.tipo === "toma" || d.tipo === "devuelve" || d.tipo === "captura") && bandera(d.b)) {
      const j = { t: d.tipo, uid, b: d.b };
      if (d.tipo === "devuelve" && d.auto) j.auto = true;
      anota(j);
    }
  }

  // ---------- el directo ----------
  // Los jugadores que me importan: todos menos yo y los que se fueron.
  const otros = () => (est?.jugadores || []).map(j => j.uid).filter(u => u !== uid && !est.fuera?.[u]);

  // Varios estados que llegan juntos van al marco en un solo mensaje.
  function programa() {
    if (pendiente || parado) return;
    pendiente = setTimeout(() => {
      pendiente = null;
      if (configurado && !parado) enviar("vivo", { v: directo.mapa(otros()) });
    }, 16);
  }
  const anuncia = () => malla?.envia(directo.anuncio());

  // Con quién no hay forma de verse: dicho, en vez de un huevo que no aparece.
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
      // Un mirón se conecta a los jugadores, no a los otros mirones.
      quiere: u => juego() || esJugador(u),
      alDatos: (u, d) => {
        const r = directo.recibe(u, d);
        if (r.reenvia) malla.envia(r.reenvia.d, r.reenvia.a);
        if (r.cambio) programa();
      },
      // Un canal que abre o se cae cambia con quién tengo camino: se anuncia ya.
      alCambiar: () => { anuncia(); programa(); },
    });
    malla.entrar().then(ok => { if (!ok && !parado) { sinMalla = true; pintaRed(); } },
      err => { console.warn("[yemas] malla", err); sinMalla = true; pintaRed(); });
    reloj = setInterval(() => { anuncia(); programa(); pintaRed(); }, OK_MS);
  }
  function paraDirecto() {
    parado = true;
    malla?.salir();
    clearInterval(reloj);
    clearTimeout(pendiente);
    pintaRed();
  }

  // ---------- la barra de voz ----------
  // Dos partes que se repintan por separado: los controles solo cuando
  // cambia el modo (repintarlos cada vez que alguien habla cerraba el
  // desplegable en la mano), y la gente con su luz de «está hablando».
  function pintaBarra() {
    if (!barra) return;
    const s = vozEstado;
    const puede = juego() && typeof RTCPeerConnection !== "undefined" && !!navigator.mediaDevices;
    barra.hidden = !puede;
    if (!puede) return;
    const firma = JSON.stringify([!!s?.activo, s?.modo, s?.silencio]);
    if (barra.dataset.firma !== firma) {
      barra.dataset.firma = firma;
      barra.innerHTML = !s?.activo
        ? `<button class="btn2" data-v="entrar">🎙 Entrar a la voz</button><span class="jg-voz-nota">Habla con la sala mientras juegas.</span>`
        : `<button class="btn2" data-v="salir">🎙 Salir de la voz</button>
           <select data-v="modo" title="Cómo se abre tu micrófono">
             <option value="ptt"${s.modo === "ptt" ? " selected" : ""}>Pulsar V para hablar</option>
             <option value="abierto"${s.modo === "abierto" ? " selected" : ""}>Micrófono abierto</option>
           </select>
           <button class="btn2" data-v="silencio" title="Dejar de oír a los demás">${s.silencio ? "🔇 Sin sonido" : "🔈 Oyendo"}</button>
           <span class="jg-voz-gente"></span>`;
      barra.querySelector('[data-v="entrar"]')?.addEventListener("click", entrarVoz);
      barra.querySelector('[data-v="salir"]')?.addEventListener("click", () => { recuerdaVoz(""); voz?.salir(); });
      barra.querySelector('[data-v="modo"]')?.addEventListener("change", ev => voz?.ponModo(ev.target.value));
      barra.querySelector('[data-v="silencio"]')?.addEventListener("click", () => voz?.silenciar(!vozEstado?.silencio));
    }
    const gente = barra.querySelector(".jg-voz-gente");
    if (!gente || !s?.activo) return;
    const chips = s.pares.map(x => {
      const mal = x.estado === "failed" ? " mal" : x.estado === "connected" ? "" : " espera";
      const habla = s.hablan.includes(x.uid) ? " habla" : "";
      const tip = x.estado === "failed" ? "No se pudo conectar: sus redes no dejan una conexión directa"
        : x.estado === "connected" ? "Conectado" : "Conectando…";
      return `<span class="jg-voz-chip${mal}${habla}" title="${tip}">${esc(nombre(x.uid))}</span>`;
    }).join("");
    const html = `<span class="jg-voz-yo${s.hablando ? " habla" : ""}">${s.hablando ? "● Hablando" : "○ Callado"}</span>` +
      (chips || '<span class="jg-voz-nota">Nadie más en la voz todavía.</span>');
    if (gente.innerHTML !== html) gente.innerHTML = html;
  }
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  async function entrarVoz() {
    if (!voz) voz = crearVoz({
      uid, senal: fb.senalVoz(pid, uid),
      alCambiar: s => {
        vozEstado = s;
        pintaBarra();
        enviar("voces", { en: s.activo ? [uid, ...s.pares.map(x => x.uid)] : [], hablan: s.hablan });
      }
    });
    try { await voz.entrar(); recuerdaVoz(pid); }
    catch (err) {
      console.warn("[yemas] voz", err);
      barra.dataset.firma = "";
      barra.innerHTML = `<button class="btn2" data-v="entrar">🎙 Entrar a la voz</button><span class="jg-voz-nota mal">No hay micrófono: ${
        err && err.name === "NotAllowedError" ? "el navegador no dio permiso." : "no se pudo abrir."}</span>`;
      barra.querySelector('[data-v="entrar"]').onclick = entrarVoz;
    }
  }
  // Con el foco fuera del juego (la barra, el chat), la V también sirve.
  const teclaV = on => e => {
    if (e.code !== "KeyV" || e.repeat || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "")) return;
    voz?.hablar(on);
  };
  const abajo = teclaV(true), arriba = teclaV(false);

  // ---------- elegir equipo ----------
  function pintaEquipos() {
    if (!equiposEl || !est) return;
    const ver = !!est.equipos && !est.listos;
    equiposEl.hidden = !ver;
    if (!ver) return;
    const mio = est.equipos[uid], puedo = juego();
    const col = e => {
      const gente = est.jugadores.filter(j => est.equipos[j.uid] === e);
      const nombre = e === "rojo" ? "Rojo" : "Azul";
      return `<div class="jg-ym-eq ${e}${mio === e ? " mio" : ""}">
        <b>${e === "rojo" ? "🔴" : "🔵"} Equipo ${nombre} · ${gente.length}</b>
        <span>${gente.map(j => esc(j.uid === uid ? "Tú" : j.nombre || "Huevo")).join(", ") || "Nadie todavía"}</span>
        ${puedo && mio !== e ? `<button class="btn2" data-e="${e}">Cambiarme al ${nombre}</button>` : ""}
      </div>`;
    };
    const html = `<p>Elige tu equipo antes de empezar. Si nadie elige, se reparten alternados.</p>${col("rojo")}${col("azul")}`;
    if (equiposEl.dataset.html === html) return;
    equiposEl.dataset.html = html;
    equiposEl.innerHTML = html;
    for (const b of equiposEl.querySelectorAll("[data-e]")) {
      b.onclick = () => {
        b.disabled = true;
        jugar({ t: "equipo", uid, e: b.dataset.e }).catch(err => console.warn("[yemas] equipo", err));
      };
    }
  }

  /* La pantalla completa de Yemas es la del marco, no la de la página: así
     en la pantalla queda solo el juego, sin la barra ni el chat alrededor
     donde el mouse se escapaba. `juegos-main.js` la pide por aquí cuando
     se aprieta ⛶ en la cabecera de la sala. */
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
    aviso.textContent = est.listos ? "" : "Esperando huevos… " + n + " de " + cupo +
      (n >= (est.variante === "zombis" ? 1 : 2) ? " · el anfitrión puede empezar ya" : "");
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
    barra = document.createElement("div");
    barra.className = "jg-voz";
    barra.hidden = true;
    equiposEl = document.createElement("div");
    equiposEl.className = "jg-ym-equipos";
    equiposEl.hidden = true;
    frame = document.createElement("iframe");
    frame.title = "Yemas — partida en línea";
    frame.className = "jg-yemas-marco";
    frame.allow = "fullscreen";
    frame.setAttribute("allowfullscreen", "");
    window.addEventListener("message", mensaje);
    window.addEventListener("keydown", abajo);
    window.addEventListener("keyup", arriba);
    frame.src = "juegos/yemas/index.html?modo=online&v=yemas-12";
    host.append(aviso, redEl, equiposEl, barra, frame);
  }

  function actualizar(p, estado) {
    partida = p; est = estado;
    pintaAviso();
    pintaEquipos();
    pintaBarra();
    if (!p.fin) {
      arrancaDirecto();
      const firma = est.jugadores.map(j => j.uid).join() + "|" + Object.keys(est.fuera || {}).join();
      if (firma !== rosterFirma) { rosterFirma = firma; malla?.revisa(); }
    }
    reenvia();
    // Estaba en la voz en esta misma sala (recargó) o en la que originó
    // esta revancha: vuelve a entrar solo, el permiso del micrófono ya está.
    if (!autoVoz && !voz && juego()) {
      const antes = vozRecordada();
      autoVoz = true;
      if (antes && (antes === pid || antes === p.origen)) entrarVoz();
    }
    if (est.fase === "fin" && !p.fin && juego()) terminar(est.ganador, est.motivo);
    if (p.fin && !parado) paraDirecto();
    if (p.fin && !borrado && juego()) {
      borrado = true;
      fb.borraYemasVivo(pid);
    }
  }

  function destruir() {
    muerto = true;
    voz?.salir();
    paraDirecto();
    window.removeEventListener("message", mensaje);
    window.removeEventListener("keydown", abajo);
    window.removeEventListener("keyup", arriba);
    frame?.remove();
    if (host) host.innerHTML = "";
  }

  return { montar, actualizar, destruir, pantallaCompleta };
}
