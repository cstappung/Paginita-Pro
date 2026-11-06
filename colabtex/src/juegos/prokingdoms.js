/* Pro Kingdoms — el cartero entre Juegos y el juego (un iframe en
   juegos/prokingdoms/). Solo para beta testers (`betaTesters/<uid>`, la
   pestaña «Beta testers» del panel de admin): juegos-main.js no monta esta
   vista si la cuenta no está en la lista.

   El juego nunca escribe en Firebase: o corre en **modo local** (`?local`,
   los demás reinos, el mercado y el gremio simulados en el navegador) o
   habla con **su servidor**, la Cloud Function `prokingdoms` (functions/),
   cuya URL está en juegos/prokingdoms/servidor.json (vacía = modo local).
   Con servidor, lo único que este cartero hace por el juego es darle el
   token de Firebase de la sesión cuando lo pide (`token`): el servidor lo
   verifica y mira `betaTesters/<uid>`. La partida local va por cuenta
   (`?perfil=<uid>`) y las monedas son del reino, no las de Juegos
   (juegos/prokingdoms/sitio.js). */
import { ambientar } from "./sonido.js";
import { auth } from "../firebase.js";
import { PRECIO_PASE, periodoPase, inicioPase } from "./pase-pk.js";
import { MONEDA } from "./monedas-vista.js";

/* El ?v= de la página del juego: súbelo junto con los `?v=pk-N` de
   juegos/prokingdoms/index.html cada vez que cambie un archivo del juego. */
export const PK_VER = "pk-35";

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

export function crearProKingdoms({ usuario, volver, saldo = () => null, yaTiene = () => false, comprarPase = null }) {
  let host = null, frame = null, muerto = false;

  function mensaje(e) {
    if (muerto || !frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    const x = e.data;
    if (!x || x.canal !== "prokingdoms-child") return;
    if (x.tipo === "volver") volver();
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
      window.removeEventListener("message", mensaje);
      if (frame) frame.remove(); frame = null;
      if (host) host.innerHTML = ""; host = null;
      ambientar("");
    }
  };
}
