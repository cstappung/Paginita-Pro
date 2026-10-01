import * as fb from "../fb-juegos.js";
import { crearVoz } from "./voz.js";

/* Yemas — el cartero entre la sala y el juego.

   El juego vive entero en `juegos/yemas/` como documento propio (Three.js,
   su física, sus bots de práctica) y entra aquí en un iframe, igual que
   Circuit Breakers. Este módulo no simula nada: traduce.

   - **Lo del marco hacia la base**: el `estado` de mi huevo va a
     `vivo/<pid>/y/<uid>` (unas doce veces por segundo, lo decide el marco),
     y cada `muere`, `toma`, `devuelve` o `captura` es una jugada del
     registro, escrita por quien la hace.
   - **Lo de la base hacia el marco**: los huevos de los demás tal como
     llegan de `vivo`, el marcador que sale del reductor (bajas, muertes,
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
   suyo (`{t:"equipo", e}`); el reductor decide qué elección vale. */
const PADRE = "yemas-padre", HIJO = "yemas-hijo";
const SUCESOS = new Set(["muere", "toma", "devuelve", "captura"]);
const VOZ_RECUERDA = "yemas.voz";
const recuerdaVoz = pid => { try { if (pid) sessionStorage.setItem(VOZ_RECUERDA, pid); else sessionStorage.removeItem(VOZ_RECUERDA); } catch {} };
const vozRecordada = () => { try { return sessionStorage.getItem(VOZ_RECUERDA) || ""; } catch { return ""; } };

export function crearYemas({ uid, pid, jugar, terminar, mirando }) {
  let host, frame, aviso, barra, equiposEl, muerto = false, listo = false, configurado = false, autoVoz = false;
  let offVivo = null, partida = null, est = null, borrado = false, primeraTanda = true;
  let voz = null, vozEstado = null;
  const enviadas = new Set();

  const juego = () => !!est?.jugadores?.some(j => j.uid === uid) && !mirando;
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
        semilla: (partida.semilla >>> 0) || 1,
        jugadores: est.jugadores.map((j, i) => ({ uid: j.uid, nombre: j.nombre || "Huevo", orden: i }))
      });
      offVivo = fb.watchYemasVivo(pid, v => enviar("vivo", { v }));
    }
    enviar("marcador", {
      bajas: est.bajas, muertes: est.muertes, meta: est.meta, equipos: est.equipos || null,
      puntosEq: est.puntosEq || null, banderas: est.banderas || null, armas: est.armas || {},
      fuera: Object.keys(est.fuera || {}),
      fin: est.fase === "fin" ? { ganador: est.ganador || "", motivo: est.motivo || "" } : null
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
      fb.yemasVivo(pid, uid, d.e);
    } else if (d.tipo === "muere") {
      const a = Number.isInteger(d.a) && d.a >= 0 && d.a <= 7 ? d.a : 0;
      const j = { t: "muere", uid, por: typeof d.por === "string" ? d.por.slice(0, 64) : "", a, cab: !!d.cab };
      if (d.x !== undefined) { j.x = num(d.x); j.z = num(d.z); }
      anota(j);
    } else if (d.tipo === "recoge" && Number.isInteger(d.s) && Number.isInteger(d.g)) {
      anota({ t: "recoge", uid, s: d.s, g: d.g });
    } else if ((d.tipo === "toma" || d.tipo === "devuelve" || d.tipo === "captura") && bandera(d.b)) {
      const j = { t: d.tipo, uid, b: d.b };
      if (d.tipo === "devuelve" && d.auto) j.auto = true;
      anota(j);
    }
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
      (cupo > 2 && n >= 2 ? " · el anfitrión puede empezar ya" : "");
  }

  function montar(el) {
    host = el; host.innerHTML = "";
    aviso = document.createElement("p");
    aviso.className = "jg-yemas-aviso";
    aviso.setAttribute("role", "status");
    aviso.hidden = true;
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
    frame.src = "juegos/yemas/index.html?modo=online&v=yemas-5";
    host.append(aviso, equiposEl, barra, frame);
  }

  function actualizar(p, estado) {
    partida = p; est = estado;
    pintaAviso();
    pintaEquipos();
    pintaBarra();
    reenvia();
    // Estaba en la voz en esta misma sala (recargó) o en la que originó
    // esta revancha: vuelve a entrar solo, el permiso del micrófono ya está.
    if (!autoVoz && !voz && juego()) {
      const antes = vozRecordada();
      autoVoz = true;
      if (antes && (antes === pid || antes === p.origen)) entrarVoz();
    }
    if (est.fase === "fin" && !p.fin && juego()) terminar(est.ganador, est.motivo);
    if (p.fin && !borrado && juego()) {
      borrado = true;
      fb.borraYemasVivo(pid);
    }
  }

  function destruir() {
    muerto = true;
    voz?.salir();
    if (offVivo) offVivo();
    window.removeEventListener("message", mensaje);
    window.removeEventListener("keydown", abajo);
    window.removeEventListener("keyup", arriba);
    frame?.remove();
    if (host) host.innerHTML = "";
  }

  return { montar, actualizar, destruir, pantallaCompleta };
}
