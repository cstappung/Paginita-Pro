/* YouTube en el reproductor ♪: un enlace pegado (público o no listado) suena
   sin cuenta; «Conectar con Google» pide un token de solo lectura
   (youtube.readonly) con Google Identity Services y lista las playlists de la
   persona y sus «Me gusta».

   Esto no es el inicio de sesión del sitio (Firebase): es un token aparte,
   del cliente OAuth de abajo, que vive solo en `sessionStorage` y dura una
   hora. Mientras YouTube suena, `cederMusica(true)` calla la música de la
   casa y el volumen de YouTube sigue al de la música.

   El video se ve siempre: las normas de YouTube piden un reproductor visible
   de al menos 200 × 200 px, así que es una caja flotante que se arrastra y se
   cierra, nunca un audio escondido. Un video que no deja insertarse (errores
   101/150, típico de los sellos discográficos) se salta. */
"use strict";
import { analizaEnlace, idsDeItems, resumeLista, MAX_IDS } from "./youtube-datos.js";
import { cederMusica, estadoMusica, alCambiarMusica, configurarMusica } from "./sonido.js";

const CLIENTE = "947244697252-l1aqclumvkthar4reifa58h8343qdetv.apps.googleusercontent.com";
const ALCANCE = "https://www.googleapis.com/auth/youtube.readonly";
const API = "https://www.googleapis.com/youtube/v3/";

const st = {
  activo: false, estado: -1, titulo: "", autor: "", origen: "", origenId: "", error: "",
  cuenta: null, listas: null, conectando: false, cargando: "", mezcla: false
};
let token = "", expira = 0;
let promApi = null, promGis = null, jugador = null, listo = null, caja = null, saltos = 0, esLista = false;
const oyentes = new Set();

const lee = (k, s = localStorage) => { try { return s.getItem(k); } catch (_) { return null; } };
const guarda = (k, v, s = localStorage) => { try { v == null ? s.removeItem(k) : s.setItem(k, v); } catch (_) {} };
try { const c = JSON.parse(lee("jg.yt.cuenta") || "null"); if (c && c.nombre) st.cuenta = { nombre: String(c.nombre), foto: String(c.foto || "") }; } catch (_) {}
try {
  const t = JSON.parse(lee("jg.yt.token", sessionStorage) || "null");
  if (t && t.t && t.e > Date.now() + 60e3) { token = t.t; expira = t.e; }
} catch (_) {}

function avisa() { const e = estadoYT(); for (const f of oyentes) { try { f(e); } catch (_) {} } }
export const estadoYT = () => Object.assign({}, st, { sonando: st.activo && st.estado === 1, conToken: !!token && expira > Date.now() });
export function alCambiarYT(f) { oyentes.add(f); return () => oyentes.delete(f); }

function script(src) {
  return new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = ok; s.onerror = () => mal(new Error("No se pudo cargar " + src.replace(/^https:\/\//, "").split("/")[0]));
    document.head.appendChild(s);
  });
}
function cargaApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (!promApi) promApi = new Promise((ok, mal) => {
    const antes = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (typeof antes === "function") try { antes(); } catch (_) {} ok(window.YT); };
    script("https://www.youtube.com/iframe_api").catch(e => { promApi = null; mal(e); });
  });
  return promApi;
}
function cargaGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  if (!promGis) promGis = script("https://accounts.google.com/gsi/client").catch(e => { promGis = null; throw e; });
  return promGis;
}
/** El panel lo llama al abrir la pestaña YouTube: así el clic en «Conectar»
    abre la ventana de Google al instante y el navegador no la bloquea. */
export function preparaYT() { cargaGis().catch(() => {}); }

/* ---------- Cuenta ---------- */

class ErrorYT extends Error { constructor(m, cod) { super(m); this.cod = cod; } }

function pideToken(prompt) {
  return cargaGis().then(() => new Promise((ok, mal) => {
    const cli = google.accounts.oauth2.initTokenClient({
      client_id: CLIENTE, scope: ALCANCE, prompt,
      callback: r => {
        if (!r || r.error) return mal(new ErrorYT(r && r.error === "access_denied" ? "No se dio el permiso para leer tu YouTube." : "Google no entregó el permiso (" + (r && r.error || "sin respuesta") + ").", "permiso"));
        if (!google.accounts.oauth2.hasGrantedAllScopes(r, ALCANCE)) return mal(new ErrorYT("Falta marcar el permiso de YouTube en la ventana de Google.", "permiso"));
        token = r.access_token; expira = Date.now() + (Number(r.expires_in) || 3600) * 1000;
        guarda("jg.yt.token", JSON.stringify({ t: token, e: expira }), sessionStorage);
        ok();
      },
      error_callback: e => mal(new ErrorYT(e && e.type === "popup_closed" ? "Se cerró la ventana de Google." : e && e.type === "popup_failed_to_open" ? "El navegador bloqueó la ventana de Google; permite las ventanas emergentes de esta página." : "No se pudo abrir la ventana de Google.", "ventana"))
    });
    cli.requestAccessToken();
  }));
}
function aseguraToken() {
  if (token && expira > Date.now() + 30e3) return Promise.resolve();
  return pideToken(st.cuenta ? "" : "consent");
}
async function api(ruta, params) {
  const q = new URLSearchParams(params).toString();
  let r;
  try { r = await fetch(API + ruta + "?" + q, { headers: { Authorization: "Bearer " + token } }); }
  catch (_) { throw new ErrorYT("Sin conexión con YouTube.", "red"); }
  if (r.ok) return r.json();
  let razon = "";
  try { const j = await r.json(); razon = j.error && (j.error.errors && j.error.errors[0] && j.error.errors[0].reason || j.error.status) || ""; } catch (_) {}
  if (r.status === 401) { olvidaToken(); throw new ErrorYT("El permiso de YouTube venció; vuelve a conectar.", "vencido"); }
  if (/accessNotConfigured|SERVICE_DISABLED/.test(razon)) throw new ErrorYT("La YouTube Data API v3 no está activada en el proyecto de Google Cloud.", "api");
  if (/quotaExceeded|dailyLimitExceeded/.test(razon)) throw new ErrorYT("Se acabó la cuota diaria de YouTube del sitio; vuelve mañana.", "cuota");
  if (/insufficient|PERMISSION_DENIED/i.test(razon)) throw new ErrorYT("Google no dio permiso para leer YouTube.", "permiso");
  if (r.status === 404) throw new ErrorYT("Esa lista no existe o es privada.", "nada");
  throw new ErrorYT("YouTube respondió " + r.status + (razon ? " (" + razon + ")" : "") + ".", "otro");
}
function olvidaToken() { token = ""; expira = 0; guarda("jg.yt.token", null, sessionStorage); }

async function cargaCuenta() {
  const yo = await api("channels", { part: "snippet,contentDetails", mine: "true" });
  const c = yo.items && yo.items[0];
  const listas = [];
  if (c) {
    const s = c.snippet || {}, f = s.thumbnails && (s.thumbnails.default || s.thumbnails.medium);
    st.cuenta = { nombre: s.title || "Tu cuenta", foto: f && /^https:\/\//.test(f.url) ? f.url : "" };
    const likes = c.contentDetails && c.contentDetails.relatedPlaylists && c.contentDetails.relatedPlaylists.likes;
    if (likes) listas.push({ id: likes, titulo: "Me gusta", n: null, mini: "", especial: true });
    let pag = "";
    for (let i = 0; i < 4; i++) {
      const r = await api("playlists", Object.assign({ part: "snippet,contentDetails", mine: "true", maxResults: "50" }, pag ? { pageToken: pag } : {}));
      for (const p of r.items || []) listas.push(resumeLista(p));
      pag = r.nextPageToken || "";
      if (!pag) break;
    }
  } else st.cuenta = { nombre: "Cuenta sin canal de YouTube", foto: "" };
  st.listas = listas;
  guarda("jg.yt.cuenta", JSON.stringify(st.cuenta));
}

/** Tiene que llamarse desde el clic: abre la ventana de Google. */
export async function conectarYT() {
  if (st.conectando) return;
  st.error = ""; st.conectando = true; avisa();
  try { await aseguraToken(); await cargaCuenta(); }
  catch (e) { st.error = e.message || "No se pudo conectar con Google."; }
  st.conectando = false; avisa();
}
export function desconectarYT() {
  const t = token;
  olvidaToken();
  if (t && window.google && google.accounts && google.accounts.oauth2) try { google.accounts.oauth2.revoke(t, () => {}); } catch (_) {}
  st.cuenta = null; st.listas = null; st.error = "";
  guarda("jg.yt.cuenta", null);
  avisa();
}

/* ---------- Reproducción ---------- */

/** Un texto pegado. Devuelve el error para el panel, o "" si va a sonar. */
export function tocaEnlace(texto) {
  const e = analizaEnlace(texto);
  if (!e) return "Eso no parece un enlace de YouTube o YouTube Music.";
  reproduce(e, e.lista ? "Playlist pegada" : "Video pegado", "");
  return "";
}
export async function tocaListaYT(id, titulo) {
  if (st.cargando) return;
  st.error = ""; st.cargando = id; avisa();
  try {
    await aseguraToken();
    const ids = [];
    let pag = "";
    while (ids.length < MAX_IDS) {
      const r = await api("playlistItems", Object.assign({ part: "snippet,contentDetails,status", playlistId: id, maxResults: "50" }, pag ? { pageToken: pag } : {}));
      ids.push(...idsDeItems(r.items));
      pag = r.nextPageToken || "";
      if (!pag) break;
    }
    if (!ids.length) throw new ErrorYT("Esa lista está vacía o solo tiene videos privados.", "nada");
    reproduce({ ids: ids.slice(0, MAX_IDS) }, titulo, id);
  } catch (e) { st.error = e.message || "No se pudo leer la lista."; }
  st.cargando = ""; avisa();
}

function volumenYT() { return Math.round(estadoMusica().volumen * 100); }

async function reproduce(que, origen, origenId) {
  st.activo = true; st.error = ""; st.origen = origen; st.origenId = origenId; st.titulo = ""; st.autor = ""; st.estado = 3;
  saltos = 0; esLista = !!(que.ids && que.ids.length > 1 || que.lista);
  cederMusica(true);
  montaCaja();
  avisa();
  let j;
  try { j = await creaJugador(); }
  catch (e) { st.error = e.message || "No se pudo cargar YouTube."; cierraYT(); st.error = e.message || st.error; avisa(); return; }
  if (!st.activo) return;
  j.setVolume(volumenYT());
  if (que.ids) j.loadPlaylist(que.ids, 0);
  else if (que.lista) j.loadPlaylist({ list: que.lista, listType: "playlist", index: 0 });
  else j.loadVideoById(que.video);
  j.setLoop(esLista);
  if (esLista && st.mezcla) setTimeout(() => { try { j.setShuffle(true); } catch (_) {} }, 800);
}

function creaJugador() {
  if (listo) return listo;
  listo = cargaApi().then(YT => new Promise(ok => {
    const div = caja.querySelector(".jg-yt-video > div");
    jugador = new YT.Player(div, {
      width: "100%", height: "100%",
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
      events: {
        onReady: () => ok(jugador),
        onStateChange: ev => {
          st.estado = ev.data;
          if (ev.data === 1) saltos = 0;
          try { const d = jugador.getVideoData() || {}; if (d.title) { st.titulo = d.title; st.autor = d.author || ""; } } catch (_) {}
          if (ev.data === 0 && !esLista) st.estado = 2;
          avisa();
        },
        onError: ev => {
          const bloqueado = ev.data === 101 || ev.data === 150;
          if (esLista && ++saltos <= 15) { try { jugador.nextVideo(); } catch (_) {} return; }
          st.error = bloqueado ? "Quien subió este video no deja tocarlo fuera de YouTube." : ev.data === 100 ? "Ese video no existe o es privado." : "YouTube no pudo tocar esto (error " + ev.data + ").";
          if (esLista) st.error = "Ninguna canción de esta lista deja tocarse fuera de YouTube.";
          st.estado = 2; avisa();
        }
      }
    });
  }));
  listo.catch(() => { listo = null; });
  return listo;
}

export function alternaYT() {
  if (!jugador || !st.activo) return;
  try { st.estado === 1 || st.estado === 3 ? jugador.pauseVideo() : jugador.playVideo(); } catch (_) {}
}
export function siguienteYT(dir = 1) {
  if (!jugador || !st.activo) return;
  try {
    if (!esLista) { jugador.seekTo(0, true); jugador.playVideo(); }
    else if (dir > 0) jugador.nextVideo(); else jugador.previousVideo();
  } catch (_) {}
}
export function mezclaYT() {
  st.mezcla = !st.mezcla;
  if (jugador && esLista) try { jugador.setShuffle(st.mezcla); } catch (_) {}
  avisa();
}
/** Cierra la caja y devuelve la música a la casa. */
export function cierraYT() {
  st.activo = false; st.estado = -1; st.titulo = ""; st.autor = ""; st.origen = ""; st.origenId = "";
  if (jugador) { try { jugador.destroy(); } catch (_) {} }
  jugador = null; listo = null;
  if (caja) { caja.remove(); caja = null; }
  cederMusica(false);
  avisa();
}

/* ---------- La caja flotante ---------- */

const ANCHO = 320;
function montaCaja() {
  if (caja) return;
  caja = document.createElement("div");
  caja.className = "jg-yt";
  caja.setAttribute("role", "region");
  caja.setAttribute("aria-label", "Reproductor de YouTube");
  caja.innerHTML = `
    <div class="jg-yt-barra" title="Arrastra para moverlo">
      <span class="jg-yt-logo" aria-hidden="true"></span>
      <div class="jg-yt-txt"><b translate="no"></b><small translate="no"></small></div>
      <button class="jg-yt-x" data-yt="cerrar" title="Cerrar YouTube" aria-label="Cerrar YouTube">✕</button>
    </div>
    <div class="jg-yt-video"><div></div></div>
    <div class="jg-yt-ctrl">
      <button data-yt="ant" title="Anterior" aria-label="Anterior">⏮</button>
      <button data-yt="pp" class="pp" title="Reproducir o pausar" aria-label="Reproducir o pausar">⏸</button>
      <button data-yt="sig" title="Siguiente" aria-label="Siguiente">⏭</button>
      <button data-yt="mezcla" title="Aleatorio" aria-label="Aleatorio" aria-pressed="false">🔀</button>
      <label class="jg-yt-vol"><span aria-hidden="true">🔉</span><input type="range" min="0" max="100" data-yt="vol" aria-label="Volumen de YouTube"></label>
    </div>`;
  document.body.appendChild(caja);
  caja.querySelector('[data-yt="vol"]').value = volumenYT();
  caja.querySelector('[data-yt="vol"]').addEventListener("input", ev => configurarMusica(estadoMusica().on, Number(ev.target.value) / 100));
  caja.addEventListener("click", ev => {
    const b = ev.target.closest("[data-yt]");
    if (!b) return;
    const a = b.dataset.yt;
    if (a === "cerrar") cierraYT();
    else if (a === "pp") alternaYT();
    else if (a === "sig") siguienteYT(1);
    else if (a === "ant") siguienteYT(-1);
    else if (a === "mezcla") mezclaYT();
  });
  arrastre(caja.querySelector(".jg-yt-barra"));
  let pos = null;
  try { pos = JSON.parse(lee("jg.yt.pos") || "null"); } catch (_) {}
  coloca(pos && Number.isFinite(pos.x) ? pos.x : Infinity, pos && Number.isFinite(pos.y) ? pos.y : Infinity);
  pintaCaja(estadoYT());
}
/** Deja la caja dentro de la ventana; Infinity = la esquina de abajo a la izquierda
    (la de la derecha es del chat y del ⚑ de informes). */
function coloca(x, y) {
  if (!caja) return;
  const w = Math.min(ANCHO, window.innerWidth - 16), h = caja.offsetHeight || 290;
  caja.style.width = w + "px";
  const nx = Math.max(8, Math.min(window.innerWidth - w - 8, x === Infinity ? 16 : x));
  const ny = Math.max(8, Math.min(window.innerHeight - h - 8, y === Infinity ? window.innerHeight - h - 16 : y));
  caja.style.left = nx + "px"; caja.style.top = ny + "px";
}
function arrastre(barra) {
  let ini = null;
  barra.addEventListener("pointerdown", ev => {
    if (ev.button !== 0 || ev.target.closest("button")) return;
    const r = caja.getBoundingClientRect();
    ini = { dx: ev.clientX - r.left, dy: ev.clientY - r.top, id: ev.pointerId };
    barra.setPointerCapture(ev.pointerId);
    caja.classList.add("moviendo");
    ev.preventDefault();
  });
  barra.addEventListener("pointermove", ev => { if (ini && ev.pointerId === ini.id) coloca(ev.clientX - ini.dx, ev.clientY - ini.dy); });
  const suelta = ev => {
    if (!ini || ev.pointerId !== ini.id) return;
    ini = null; caja.classList.remove("moviendo");
    guarda("jg.yt.pos", JSON.stringify({ x: parseFloat(caja.style.left), y: parseFloat(caja.style.top) }));
  };
  barra.addEventListener("pointerup", suelta);
  barra.addEventListener("pointercancel", suelta);
}
function pintaCaja(e) {
  if (!caja) return;
  caja.querySelector(".jg-yt-txt b").textContent = e.titulo || (e.error ? "No se puede tocar" : "Cargando…");
  caja.querySelector(".jg-yt-txt small").textContent = e.error || [e.autor, e.origen].filter(Boolean).join(" · ");
  caja.querySelector('[data-yt="pp"]').textContent = e.estado === 1 || e.estado === 3 ? "⏸" : "▶";
  const m = caja.querySelector('[data-yt="mezcla"]');
  m.classList.toggle("on", e.mezcla); m.setAttribute("aria-pressed", String(e.mezcla));
  caja.classList.toggle("sonando", e.sonando);
}
alCambiarYT(pintaCaja);
alCambiarMusica(e => {
  if (jugador && st.activo) try { jugador.setVolume(Math.round(e.volumen * 100)); } catch (_) {}
  const v = caja && caja.querySelector('[data-yt="vol"]');
  if (v && document.activeElement !== v) v.value = Math.round(e.volumen * 100);
});
window.addEventListener("resize", () => { if (caja) coloca(parseFloat(caja.style.left), parseFloat(caja.style.top)); });
