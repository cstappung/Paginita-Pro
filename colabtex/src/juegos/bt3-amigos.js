import { auth } from "../firebase.js";

/* ¿Ve BT3 quien inició sesión? Solo los amigos de la lista del disco privado.

   La lista vive en un solo lugar, el Worker del disco (`AMIGOS`, juegos/bt3/fuente/disco/worker.js): aquí se
   le pregunta `/soy` con el token de Firebase de la sesión, una vez por sesión. Mientras no contesta, o sin
   sesión, o si el sitio no tiene disco privado (`juegos/bt3/disco-privado.json` vacío), BT3 no se muestra.
   Esto esconde el juego de las listas; no es una cerradura: la página del juego es pública como todo el sitio
   (no trae nada del juego), y el disco sí lo protege el Worker. */
let visible = false, pidiendo = null, deQuien = "";

/* La versión del programa del juego (la misma del ?v= de juegos/bt3/: fuente/construir.sh la cambia aquí). */
export const BT3_VER = "bt3-11";

/* Para un amigo, el programa del juego (3,6 MB) se baja en cuanto se sabe que es amigo, sin apuro y una vez:
   cuando abra BT3 sale de la caché del navegador y arranca enseguida. En un computador, nunca en el celular
   (BT3 no se juega ahí). */
let prebajado = false;
function prebaja() {
  if (prebajado || typeof window === "undefined" || !window.matchMedia || window.matchMedia("(pointer: coarse)").matches) return;
  prebajado = true;
  const ve = () => {
    for (const f of ["bt3-jspi.wasm", "bt3-jspi.js", "pagina.js", "red.js", "index.html"]) {
      fetch("juegos/bt3/" + f + (f === "index.html" ? "?modo=online&v=" : "?v=") + BT3_VER, { priority: "low" }).catch(() => {});
    }
  };
  (window.requestIdleCallback || (f => setTimeout(f, 3000)))(ve, { timeout: 8000 });
}
const oyentes = new Set();

export const bt3Visible = () => visible;
export const alCambiarBt3 = cb => { oyentes.add(cb); };

function pone(v) {
  if (v === visible) return;
  visible = v;
  if (v) prebaja();
  for (const cb of oyentes) { try { cb(v); } catch (e) {} }
}

/* Pregunta de nuevo si cambió la sesión; si no, devuelve lo que ya sabe (o la pregunta en curso). */
export function revisaBt3() {
  const u = auth.currentUser;
  if (!u) { deQuien = ""; pone(false); return Promise.resolve(false); }
  if (pidiendo && deQuien === u.uid) return pidiendo;
  if (deQuien === u.uid && !pidiendo) return Promise.resolve(visible);
  deQuien = u.uid;
  pidiendo = (async () => {
    try {
      const cfg = await (await fetch("juegos/bt3/disco-privado.json", { cache: "no-store" })).json();
      const base = String(cfg.url || "").replace(/\/+$/, "");
      if (!base) return false;
      const r = await fetch(base + "/soy", { headers: { Authorization: "Bearer " + await u.getIdToken() } });
      return r.ok;
    } catch (e) {
      return false;
    }
  })().then(v => { pidiendo = null; if (auth.currentUser && auth.currentUser.uid === deQuien) pone(v); return v; });
  return pidiendo;
}
