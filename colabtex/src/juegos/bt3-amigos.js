import { auth } from "../firebase.js";
import { ponOculto } from "./ocultos.js";

/* ¿Ve BT3 quien inició sesión? Solo los amigos de la lista del disco privado.

   La lista vive en un solo lugar, el Worker del disco (`AMIGOS`, juegos/bt3/fuente/disco/worker.js): aquí se
   le pregunta `/soy` con el token de Firebase de la sesión, una vez por sesión. Mientras no contesta, o sin
   sesión, o si el sitio no tiene disco privado (`juegos/bt3/disco-privado.json` vacío), BT3 no se muestra.
   Esto esconde el juego de las listas; no es una cerradura: la página del juego es pública como todo el sitio
   (no trae nada del juego), y el disco sí lo protege el Worker. */
let visible = false, pidiendo = null, deQuien = "";

/* La versión del programa del juego (la misma del ?v= de juegos/bt3/: fuente/construir.sh la cambia aquí). */
export const BT3_VER = "bt3-36";
const oyentes = new Set();

export const bt3Visible = () => visible;
export const alCambiarBt3 = cb => { oyentes.add(cb); };

function pone(v) {
  if (v === visible) return;
  visible = v;
  ponOculto("bt3", !v);   // (las vistas que nombran juegos: tienda del perfil, monedas)
  ponOculto("mkw", !v);   // Mario Kart Wii: la misma lista de amigos (su programa sale del mismo tipo de Worker)
  for (const cb of oyentes) { try { cb(v); } catch (e) {} }
}

/* El relevo de Cloudflare (TURN) para mirar una pelea en vivo, cuando el anfitrión lo activó en la sala: las mismas
   credenciales que piden los marcos de los que pelean (Worker del disco, /turn, solo amigos). [] si no hay. */
export async function relevoBt3() {
  const u = auth.currentUser;
  if (!u) return [];
  try {
    const cfg = await (await fetch("juegos/bt3/disco-privado.json", { cache: "no-store" })).json();
    const base = String(cfg.url || "").replace(/\/+$/, "");
    if (!base) return [];
    const ctl = new AbortController(), reloj = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(base + "/turn", { headers: { Authorization: "Bearer " + await u.getIdToken() }, signal: ctl.signal });
    clearTimeout(reloj);
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.iceServers) ? d.iceServers.filter(x => x && x.urls) : [];
  } catch (e) {
    return [];
  }
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

/* La lista de amigos que llevan los administradores del sitio (panel de administración → «Juegos privados»). El
   Worker del disco vuelve a comprobar que quien llama está en `admins/<uid>`: esto es solo el recado.
   `listaAmigosBt3()` → {amigos: [{uid, por, at}], fijos: [uid…], correos: n}; `cambiaAmigoBt3(uid, true|false)`
   agrega o quita. Las dos lanzan un Error con `estado` (el número HTTP; 0 si no hay disco privado o no hay red): un
   Worker de antes de la lista contesta 404, y a quien no es administrador, 403. */
async function pideAmigos(metodo, uid) {
  const falla = (estado, texto) => Object.assign(new Error(texto), { estado });
  const u = auth.currentUser;                                        // la sesión de Google de esta pestaña
  if (!u) throw falla(401, "sin sesión");
  let base = "";
  try { base = String((await (await fetch("juegos/bt3/disco-privado.json", { cache: "no-store" })).json()).url || "").replace(/\/+$/, ""); } catch (e) {}
  if (!base) throw falla(0, "el sitio no tiene disco privado");      // (disco-privado.json vacío)
  let r;
  try {
    r = await fetch(base + "/amigos", {
      method: metodo,
      headers: { Authorization: "Bearer " + await u.getIdToken(), ...(uid ? { "Content-Type": "application/json" } : {}) },
      body: uid ? JSON.stringify({ uid }) : undefined                // GET no lleva cuerpo
    });
  } catch (e) { throw falla(0, "no se pudo llegar al Worker"); }
  if (!r.ok) throw falla(r.status, await r.text().catch(() => ""));
  return r.json();
}
export const listaAmigosBt3 = () => pideAmigos("GET");
export const cambiaAmigoBt3 = (uid, poner) => pideAmigos(poner ? "PUT" : "DELETE", uid);
