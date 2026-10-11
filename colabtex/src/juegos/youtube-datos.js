/* La parte pura del reproductor de YouTube: leer un enlace pegado y ordenar
   lo que devuelve la YouTube Data API. Sin `window` ni `fetch`, para que
   `tests/youtube.test.cjs` la ejerza desde Node. */
"use strict";

const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/;
const ID_LISTA = /^(?:PL|UU|LL|FL|RD|OL|LM|VL)?[A-Za-z0-9_-]{10,}$/;

/** Lo que se puede tocar a partir de un texto pegado: `{video, lista}` (uno
    de los dos o ambos) o `null`. Entiende youtube.com, music.youtube.com,
    m.youtube.com, youtu.be, /shorts/, /embed/, /live/ y un id suelto. */
export function analizaEnlace(texto) {
  const t = String(texto || "").trim();
  if (!t) return null;
  if (ID_VIDEO.test(t)) return { video: t, lista: "" };
  if (/^(PL|OL|RD|UU|LL|VL)[A-Za-z0-9_-]{10,}$/.test(t)) return { video: "", lista: t.replace(/^VL/, "") };
  let u;
  try { u = new URL(/^[a-z]+:\/\//i.test(t) ? t : "https://" + t); } catch (_) { return null; }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (!/(^|\.)youtube\.com$|^youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(host)) return null;
  let video = "";
  if (host === "youtu.be") video = u.pathname.split("/")[1] || "";
  else {
    const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
    video = m ? m[1] : (u.searchParams.get("v") || "");
  }
  let lista = (u.searchParams.get("list") || "").replace(/^VL/, "");
  if (!ID_VIDEO.test(video)) video = "";
  if (!ID_LISTA.test(lista)) lista = "";
  return video || lista ? { video, lista } : null;
}

/** Los ids que el reproductor puede tocar de una página de `playlistItems`:
    sin los borrados ni los privados, que la API devuelve como «Deleted video»
    / «Private video» y el reproductor rechaza uno por uno. */
export function idsDeItems(items) {
  const ids = [];
  for (const it of items || []) {
    const id = it && (it.contentDetails && it.contentDetails.videoId || it.snippet && it.snippet.resourceId && it.snippet.resourceId.videoId);
    const tit = it && it.snippet && it.snippet.title;
    const estado = it && it.status && it.status.privacyStatus;
    if (!id || !ID_VIDEO.test(id)) continue;
    if (estado === "private" || tit === "Private video" || tit === "Deleted video") continue;
    ids.push(id);
  }
  return ids;
}

/** Una playlist de la API, reducida a lo que pinta el panel. */
export function resumeLista(p) {
  const s = (p && p.snippet) || {};
  const mini = s.thumbnails && (s.thumbnails.default || s.thumbnails.medium || s.thumbnails.high);
  return {
    id: p && p.id || "",
    titulo: s.title || "Sin título",
    n: p && p.contentDetails && Number.isFinite(p.contentDetails.itemCount) ? p.contentDetails.itemCount : null,
    mini: mini && /^https:\/\//.test(mini.url) ? mini.url : ""
  };
}

/** El reproductor de YouTube acepta como mucho 200 ids en `loadPlaylist`. */
export const MAX_IDS = 200;
