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

/* El ?v= de la página del juego: súbelo junto con los `?v=pk-N` de
   juegos/prokingdoms/index.html cada vez que cambie un archivo del juego. */
export const PK_VER = "pk-15";

/* La URL del servidor, leída una vez por pestaña y sin caché (cambiarla no
   pide compilar). Solo https, o localhost con el emulador de Functions. */
let servidor = null;
function urlServidor() {
  if (!servidor) servidor = fetch("juegos/prokingdoms/servidor.json?v=" + Date.now(), { cache: "no-store" })
    .then(r => r.ok ? r.json() : {}).then(c => String((c && c.url) || "").trim()).catch(() => "")
    .then(u => /^https:\/\/[\w.-]+(\/[\w./-]*)?$/.test(u) || (/^http:\/\/(localhost|127\.0\.0\.1):\d+/.test(u) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) ? u : "");
  return servidor;
}

export function crearProKingdoms({ usuario, volver }) {
  let host = null, frame = null, muerto = false;

  function mensaje(e) {
    if (muerto || !frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    const x = e.data;
    if (!x || x.canal !== "prokingdoms-child") return;
    if (x.tipo === "volver") volver();
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
