/* Pro Kingdoms — el cartero entre Juegos y el juego (un iframe en
   juegos/prokingdoms/). Abierto a todos los que tienen cuenta desde el
   2026-11-11 (antes, solo a los beta testers).

   El juego nunca escribe en Firebase: o corre en **modo local** (`?local`,
   los demás reinos, el mercado y el gremio simulados en el navegador) o
   habla con **su servidor**, la Cloud Function `prokingdoms` (functions/),
   cuya URL está en juegos/prokingdoms/servidor.json (vacía = modo local).
   Con servidor, lo único que este cartero hace por el juego es darle el
   token de Firebase de la sesión cuando lo pide (`token`): el servidor lo
   verifica. La partida local va por cuenta
   (`?perfil=<uid>`) y las monedas son del reino, no las de Juegos
   (juegos/prokingdoms/sitio.js).

   El botón «🐞 Reportes» de la barra del juego (`reportes`) abre aquí la
   ventana de errores y sugerencias (pk-reportes.js): la pinta la página
   porque el marco no toca Firebase. */
import { ambientar } from "./sonido.js";
import { escapeHtml } from "../util.js";
import { navegador, descargar } from "../reports.js";
import { readFeedbackDe, sendFeedback, deleteFeedback, setFeedbackState } from "../fb-reports.js";
import { APP_PK, LARGO, TIPOS_PK, limpiaReporte, ordenaReportes, fechaReporte, nombreTxt, aTxt } from "./pk-reportes.js";
import { auth } from "../firebase.js";
import { PRECIO_PASE, periodoPase, inicioPase } from "./pase-pk.js";
import { MONEDA } from "./monedas-vista.js";

/* El ?v= de la página del juego: súbelo junto con los `?v=pk-N` de
   juegos/prokingdoms/index.html cada vez que cambie un archivo del juego. */
export const PK_VER = "pk-39";

/* La URL del servidor, leída una vez por pestaña y sin caché (cambiarla no
   pide compilar). Solo https, o localhost con el emulador de Functions. */
let servidor = null;
function urlServidor() {
  if (!servidor) servidor = fetch("juegos/prokingdoms/servidor.json?v=" + Date.now(), { cache: "no-store" })
    .then(r => r.ok ? r.json() : {}).then(c => String((c && c.url) || "").trim()).catch(() => "")
    .then(u => /^https:\/\/[\w.-]+(\/[\w./-]*)?$/.test(u) || (/^http:\/\/(localhost|127\.0\.0\.1):\d+/.test(u) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) ? u : "");
  return servidor;
}

/* El Pase del Reino (Fase 8, juegos/pase-pk.js): el juego pide comprar (`pkPase`) y esta página confirma con su
   propia ventana, con el saldo real, en dos pasos (como la tienda de Halloween). Así el marco no puede fingir una
   compra ni gastar sin que el jugador lo vea. Comprar escribe `pkPase/<uid>/<período>` (escritura única, la
   regla pide el precio y el período de ahora) y monedas.js lo cobra; el juego avisa a su servidor, que lo lee. */
const miles = n => Math.round(n).toLocaleString("es-CL");
function confirmaPase({ saldo, yaTiene, comprar }, periodo) {
  return new Promise(res => {
    const capa = document.createElement("div");
    capa.className = "jg-modal-capa jg-pkp-capa";
    const fin = ok => { capa.remove(); document.removeEventListener("keydown", tecla); res(ok); };
    const tecla = e => { if (e.key === "Escape") fin(false); };
    document.addEventListener("keydown", tecla);
    const ahora = periodoPase(Date.now());
    const pinta = paso => {
      const s = saldo(), alcanza = s !== null && s >= PRECIO_PASE, tiene = yaTiene(ahora);
      const dias = Math.max(1, Math.ceil((inicioPase(ahora + 1) - Date.now()) / 86400000));
      capa.innerHTML = `<div class="jg-pkp" role="dialog" aria-modal="true" aria-labelledby="jgPkpT">
        <h2 id="jgPkpT">👑 Pase del Reino · pista dorada</h2>
        <p>Pro Kingdoms te pide desbloquear la pista dorada de este pase (quedan ${dias} ${dias === 1 ? "día" : "días"}). Da mejores premios, aspectos del tema y comodidades de tiempo. <b>No da puntos ni niveles</b>: eso se gana jugando.</p>
        <p class="jg-pkp-precio">${MONEDA} <b>${miles(PRECIO_PASE)}</b> monedas de la página · tienes ${s === null ? "…" : MONEDA + " " + miles(s)}</p>
        ${tiene ? `<p class="jg-pkp-ya">Ya tienes la pista dorada de este pase.</p>` : periodo !== ahora ? `<p class="jg-pkp-ya">Ese pase ya terminó: vuelve a abrir la ventana del pase en el juego.</p>` : !alcanza && s !== null ? `<p class="jg-pkp-ya">No te alcanza el saldo.</p>` : ""}
        <div class="jg-pkp-btns">
          <button type="button" class="btn2" data-no>${paso === 2 ? "No, mejor no" : "Cancelar"}</button>
          ${tiene || periodo !== ahora ? "" : `<button type="button" class="btn" data-si ${alcanza ? "" : "disabled"}>${paso === 2 ? `Sí, gastar ${miles(PRECIO_PASE)}` : "Comprar"}</button>`}
        </div>
        ${paso === 2 ? `<p class="jg-pkp-nota">Es para siempre en este pase y no se devuelve.</p>` : ""}
      </div>`;
      capa.querySelector("[data-no]").onclick = () => fin(false);
      const si = capa.querySelector("[data-si]");
      if (si) si.onclick = () => {
        if (paso === 1) { pinta(2); return; }
        si.disabled = true; si.textContent = "Comprando…";
        comprar(ahora).then(() => fin(true), e => { console.warn("pkPase", e); fin(false); });
      };
    };
    capa.addEventListener("pointerdown", e => { if (e.target === capa) fin(false); });
    pinta(1);
    document.body.appendChild(capa);
    const b = capa.querySelector("[data-si], [data-no]"); if (b) b.focus();
  });
}

/* Reportes de errores y sugerencias (pk-reportes.js). Todos leen los de
   todos y escriben los suyos; quien es administrador ve además «Descargar
   todo (.txt)», ✓ y 🗑. Los botones solo se esconden: quien manda son las
   reglas de `feedback`, que no dejan borrar lo ajeno sin estar en `admins`.
   Una lectura al abrir y otra tras cada cambio, sin escucha en vivo.
   Devuelve una función que la cierra. */
function abreReportes({ usuario, esAdmin, alCerrar }) {
  const capa = document.createElement("div");
  capa.className = "jg-modal-capa jg-pkr-capa";
  let lista = null, error = "", admin = false, filtro = "", borrando = "", aviso = "", cerrada = false;
  const cierra = () => {
    if (cerrada) return;
    cerrada = true; capa.remove(); document.removeEventListener("keydown", tecla, true);
    if (alCerrar) alCerrar();
  };
  const tecla = e => { if (e.key === "Escape") { e.stopPropagation(); cierra(); } };
  document.addEventListener("keydown", tecla, true);
  capa.innerHTML = `<div class="jg-pkr" role="dialog" aria-modal="true" aria-labelledby="jgPkrT">
    <header><h2 id="jgPkrT">🐞 Reportes de Pro Kingdoms</h2><button type="button" class="jg-pkr-x" data-cerrar aria-label="Cerrar">✕</button></header>
    <p class="jg-pkr-intro">¿Algo falló o se te ocurrió una mejora? Cuéntalo aquí. Todos ven los reportes de todos: antes de escribir, mira si ya está.</p>
    <form class="jg-pkr-form">
      <div class="jg-pkr-tipos" role="radiogroup" aria-label="Qué es">
        <label><input type="radio" name="pkrTipo" value="bug" checked> 🐞 Error</label>
        <label><input type="radio" name="pkrTipo" value="idea"> 💡 Sugerencia</label>
      </div>
      <input type="text" name="titulo" maxlength="${LARGO.titulo}" placeholder="En una línea: qué pasó o qué propones" aria-label="Título" autocomplete="off" required>
      <textarea name="cuerpo" maxlength="${LARGO.cuerpo}" rows="3" placeholder="Detalles (opcional): qué estabas haciendo, qué esperabas, en qué era vas…" aria-label="Detalles"></textarea>
      <div class="jg-pkr-envia"><span class="jg-pkr-aviso" role="status"></span><button type="submit" class="btn">Enviar</button></div>
    </form>
    <div class="jg-pkr-barra"></div>
    <div class="jg-pkr-lista" aria-live="polite"></div>
  </div>`;
  const form = capa.querySelector("form"), elBarra = capa.querySelector(".jg-pkr-barra"), elLista = capa.querySelector(".jg-pkr-lista"), elAviso = capa.querySelector(".jg-pkr-aviso");

  function pinta() {
    elAviso.textContent = aviso;
    const todos = ordenaReportes(lista || []), ves = ordenaReportes(lista || [], filtro);
    const cuenta = t => todos.filter(r => (r.tipo === "idea" ? "idea" : "bug") === t).length;
    elBarra.innerHTML = `<div class="jg-pkr-filtros">${[["", `Todos (${todos.length})`], ["bug", `🐞 Errores (${cuenta("bug")})`], ["idea", `💡 Sugerencias (${cuenta("idea")})`]]
      .map(([k, t]) => `<button type="button" class="jg-pkr-chip${filtro === k ? " on" : ""}" data-filtro="${k}" aria-pressed="${filtro === k}">${t}</button>`).join("")}</div>
      ${admin ? `<button type="button" class="btn2" data-txt ${todos.length ? "" : "disabled"} title="Solo administradores">⬇ Descargar todo (.txt)</button>` : ""}`;
    if (error) { elLista.innerHTML = `<p class="jg-pkr-nada">${escapeHtml(error)}</p>`; return; }
    if (!lista) { elLista.innerHTML = `<p class="jg-pkr-nada">Cargando reportes…</p>`; return; }
    if (!ves.length) { elLista.innerHTML = `<p class="jg-pkr-nada">${todos.length ? "No hay nada de ese tipo." : "Todavía no hay reportes. El primero puede ser el tuyo."}</p>`; return; }
    elLista.innerHTML = ves.map(r => {
      const tipo = r.tipo === "idea" ? "idea" : "bug", hecho = r.estado === "hecho";
      return `<article class="jg-pkr-item${hecho ? " hecho" : ""}">
        <div class="jg-pkr-cab"><span class="jg-pkr-pill ${tipo}">${tipo === "idea" ? "💡" : "🐞"} ${TIPOS_PK[tipo]}</span>${hecho ? `<span class="jg-pkr-pill ok">✓ ${tipo === "idea" ? "Hecho" : "Arreglado"}</span>` : ""}
          <b translate="no">${escapeHtml(r.titulo || "")}</b></div>
        ${r.cuerpo ? `<p class="jg-pkr-cuerpo" translate="no">${escapeHtml(r.cuerpo)}</p>` : ""}
        <div class="jg-pkr-pie"><span><span translate="no">${escapeHtml(r.userName || "Alguien")}</span>${r.uid === usuario.uid ? " (tú)" : ""} · ${fechaReporte(r.at)}${r.ver ? " · " + escapeHtml(r.ver) : ""}</span>
          ${admin ? `<span class="jg-pkr-adm">
            <button type="button" class="btn2" data-hecho="${escapeHtml(r.id)}" data-a="${hecho ? "abierto" : "hecho"}">${hecho ? "↩ Reabrir" : "✓ Marcar arreglado"}</button>
            ${borrando === r.id ? `<button type="button" class="btn2 jg-pkr-rojo" data-borra-si="${escapeHtml(r.id)}">¿Seguro? Eliminar</button><button type="button" class="btn2" data-borra-no>No</button>`
              : `<button type="button" class="btn2" data-borra="${escapeHtml(r.id)}" aria-label="Eliminar este reporte">🗑 Eliminar</button>`}
          </span>` : ""}</div>
      </article>`;
    }).join("");
  }
  const falla = e => /permission/i.test(String((e && (e.code || e.message)) || "")) ? "La base de datos no lo permitió (¿sesión vencida?). Recarga la página y prueba otra vez." : "No se pudo: revisa tu conexión y prueba otra vez.";
  function carga() {
    return readFeedbackDe(APP_PK).then(l => { lista = l; error = ""; }, e => { console.warn("pkReportes", e); if (!lista) error = falla(e); }).then(() => { if (!cerrada) pinta(); });
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const r = limpiaReporte({ tipo: form.pkrTipo.value, titulo: form.titulo.value, cuerpo: form.cuerpo.value });
    if (!r) { aviso = "Escribe un título."; pinta(); form.titulo.focus(); return; }
    const u = auth.currentUser;
    if (!u || u.uid !== usuario.uid) { aviso = "Tu sesión se cerró: recarga la página."; pinta(); return; }
    const b = form.querySelector("[type=submit]");
    b.disabled = true; aviso = "Enviando…"; pinta();
    sendFeedback(Object.assign(r, { app: APP_PK, ver: PK_VER, nav: navegador(navigator.userAgent).slice(0, 80) }), { uid: usuario.uid, userName: String(usuario.name || "Alguien").slice(0, 120) })
      .then(() => { form.titulo.value = ""; form.cuerpo.value = ""; aviso = "¡Gracias! Tu reporte quedó guardado."; filtro = ""; return carga(); },
        er => { console.warn("pkReportes", er); aviso = falla(er); pinta(); })
      .then(() => { b.disabled = false; });
  });
  capa.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b || !capa.contains(b)) return;
    if (b.hasAttribute("data-cerrar")) { cierra(); return; }
    if (b.hasAttribute("data-filtro")) { filtro = b.getAttribute("data-filtro"); borrando = ""; pinta(); return; }
    if (!admin) return;
    if (b.hasAttribute("data-txt")) {
      /* Se vuelve a leer para que el archivo traiga lo último, no lo que había al abrir. */
      b.disabled = true;
      readFeedbackDe(APP_PK).then(l => { lista = l; }, () => {}).then(() => { if (lista) descargar(aTxt(lista, Date.now()), nombreTxt(Date.now()), "text/plain;charset=utf-8"); if (!cerrada) pinta(); });
      return;
    }
    if (b.hasAttribute("data-borra")) { borrando = b.getAttribute("data-borra"); pinta(); return; }
    if (b.hasAttribute("data-borra-no")) { borrando = ""; pinta(); return; }
    const id = b.getAttribute("data-borra-si") || b.getAttribute("data-hecho");
    if (!id) return;
    b.disabled = true;
    (b.hasAttribute("data-borra-si") ? deleteFeedback(id) : setFeedbackState(id, b.getAttribute("data-a")))
      .then(() => { aviso = ""; }, er => { console.warn("pkReportes", er); aviso = falla(er); })
      .then(() => { borrando = ""; return carga(); });
  });
  capa.addEventListener("pointerdown", e => { if (e.target === capa) cierra(); });

  /* A pantalla completa el marco tapa la página: se sale para que la ventana se vea. */
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  document.body.appendChild(capa);
  pinta();
  form.titulo.focus();
  carga();
  Promise.resolve(esAdmin ? esAdmin() : false).then(a => { admin = a === true; if (!cerrada) pinta(); }, () => {});
  return cierra;
}

export function crearProKingdoms({ usuario, volver, saldo = () => null, yaTiene = () => false, comprarPase = null, esAdmin = null }) {
  let host = null, frame = null, muerto = false, cierraReportes = null;

  function mensaje(e) {
    if (muerto || !frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    const x = e.data;
    if (!x || x.canal !== "prokingdoms-child") return;
    if (x.tipo === "volver") volver();
    if (x.tipo === "reportes" && !cierraReportes) {
      cierraReportes = abreReportes({ usuario, esAdmin, alCerrar: () => { cierraReportes = null; if (!muerto && frame) frame.focus(); } });
    }
    if (x.tipo === "pkPase") {
      const responde = ok => { if (!muerto && frame) frame.contentWindow.postMessage({ canal: "prokingdoms-parent", tipo: "pkPaseOk", id: x.id, ok }, location.origin); };
      if (!comprarPase || !auth.currentUser || auth.currentUser.uid !== usuario.uid) { responde(false); return; }
      confirmaPase({ saldo, yaTiene, comprar: n => comprarPase(n, PRECIO_PASE) }, +x.periodo).then(responde);
    }
    if (x.tipo === "token") {
      const responde = token => { if (!muerto && frame) frame.contentWindow.postMessage({ canal: "prokingdoms-parent", tipo: "token", id: x.id, token }, location.origin); };
      const u = auth.currentUser;
      if (!u || u.uid !== usuario.uid) { responde(null); return; }
      u.getIdToken().then(responde, () => responde(null));
    }
  }

  return {
    montar(el) {
      host = el; ambientar(null); host.innerHTML = "";
      frame = document.createElement("iframe");
      frame.className = "jg-prokingdoms-frame";
      frame.title = "Pro Kingdoms — construye tu reino";
      frame.allow = "fullscreen";
      window.addEventListener("message", mensaje);
      host.appendChild(frame);
      frame.addEventListener("load", () => frame && frame.focus());
      urlServidor().then(api => {
        if (muerto || !frame) return;
        const q = new URLSearchParams({ perfil: usuario.uid, nombre: String(usuario.name || "").slice(0, 24), v: PK_VER });
        if (api) q.set("api", api);
        frame.src = "juegos/prokingdoms/index.html?" + (api ? "" : "local&") + q.toString();
      });
    },
    destruir() {
      muerto = true;
      if (cierraReportes) cierraReportes();
      window.removeEventListener("message", mensaje);
      if (frame) frame.remove(); frame = null;
      if (host) host.innerHTML = ""; host = null;
      ambientar("");
    }
  };
}
