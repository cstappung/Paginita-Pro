/* Pro Kingdoms — el cartero entre Juegos y el juego (un iframe en
   juegos/prokingdoms/). Solo para beta testers (`betaTesters/<uid>`, la
   pestaña «Beta testers» del panel de admin): juegos-main.js no monta esta
   vista si la cuenta no está en la lista.

   Es el cartero más corto del sitio porque, durante la beta, el juego no
   escribe nada en Firebase: corre en **modo local** (`?local`, los demás
   reinos, el mercado y el gremio simulados en el navegador), guarda la
   partida en `localStorage` con el uid como perfil (`?perfil=`), y sus
   monedas son del reino, no las de Juegos (juegos/prokingdoms/sitio.js).
   Lo único que cruza es `listo` y `volver`. Cuando llegue el mundo
   compartido (el servidor, ver juegos/prokingdoms/CLAUDE.md), la cuenta
   viajará como token de Firebase al servidor, no por aquí. */
import { ambientar } from "./sonido.js";

/* El ?v= de la página del juego: súbelo junto con los `?v=pk-N` de
   juegos/prokingdoms/index.html cada vez que cambie un archivo del juego. */
export const PK_VER = "pk-1";

export function crearProKingdoms({ usuario, volver }) {
  let host = null, frame = null, muerto = false;

  function mensaje(e) {
    if (muerto || !frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    const x = e.data;
    if (!x || x.canal !== "prokingdoms-child") return;
    if (x.tipo === "volver") volver();
  }

  return {
    montar(el) {
      host = el; ambientar(null); host.innerHTML = "";
      frame = document.createElement("iframe");
      frame.className = "jg-prokingdoms-frame";
      frame.title = "Pro Kingdoms — construye tu reino";
      frame.allow = "fullscreen";
      window.addEventListener("message", mensaje);
      const q = new URLSearchParams({ perfil: usuario.uid, nombre: String(usuario.name || "").slice(0, 24), v: PK_VER });
      frame.src = "juegos/prokingdoms/index.html?local&" + q.toString();
      host.appendChild(frame);
      frame.addEventListener("load", () => frame && frame.focus());
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
