/* PRODROP en la página de Juegos — lo que se dice de las cartas fuera del
   abridor: las que alguien exhibe en su perfil y las mejores que se han
   sacado (la caja del vestíbulo). El motor es el mismo del abridor
   (juegos/prodrop/motor.js), así que una carta se rehace aquí igual que
   allá: de su sobre, nunca de algo que alguien haya escrito a mano.

   **Solo cuenta lo que vale en la economía** (`economia`, en monedas.js):
   un sobre comprado sin fondos no existe para nadie, y una carta se muestra
   en el perfil de quien la tiene *ahora* (puede haberla comprado en el
   mercado o recibido en un intercambio). */
import PM from "../../../juegos/prodrop/motor.js";
import { economia, leeCopia, claveCopia } from "./monedas.js";

export const MOTOR = PM;
export const RAIZ = "juegos/prodrop/";
export const MAX_EXHIBIDAS = 4;
const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* La economía, solo con la lectura completa: con la mitad de los nodos
   lo ganado sale de una suma a medias. */
export const ecoDe = datos => (datos && datos.completo ? economia(datos) : null);

/* Una copia resuelta: {uid (quien la sacó), o, k, i, at, id, g, gr, dios,
   carta}. `uid` es el origen: los drops hablan de quien abrió el sobre. */
function copia(e, o, k, i) {
  const so = e.sobres[o + "~" + k];
  if (!so) return null;
  /* Un re-roll es un «sobre» de una sola carta (la 0), sin god pack. */
  const s = so.r ? null : PM.sobre(o, k, so.at), c = so.r ? (i === 0 ? so.r : null) : s.cartas[i], cc = claveCopia(o, k, i);
  if (!c) return null;
  return { uid: o, o, k, i, at: so.at, c: cc, id: c.id, g: c.g, gr: !!e.graduada[cc], dios: !!(s && s.dios), rr: !!so.r, carta: PM.CARDS[c.id], dueno: e.dueno[cc] };
}
export const copiaDe = (cc, datos) => { const e = ecoDe(datos), q = leeCopia(cc); return e && q ? copia(e, q.o, q.k, q.i) : null; };

/* Las que exhibe, en el orden que eligió, si todavía son suyas. Acepta la
   clave vieja `<sobre>.<i>` (de antes del mercado: el origen es el dueño). */
export function exhibidasDe(uid, perfil, datos) {
  const l = perfil && perfil.cartas, e = ecoDe(datos);
  if (!l || !e) return [];
  const out = [];
  for (const key of (Array.isArray(l) ? l : Object.values(l)).slice(0, MAX_EXHIBIDAS)) {
    const vieja = /^([-_A-Za-z0-9]{8,24})\.([0-4])$/.exec(String(key));
    const q = vieja ? { o: uid, k: vieja[1], i: +vieja[2] } : leeCopia(key);
    if (!q) continue;
    const c = copia(e, q.o, q.k, q.i);
    if (c && c.dueno === uid) out.push(c);
  }
  return out;
}

/* Lo que han sacado todos al abrir sobres, solo épicas y legendarias, en
   orden de salida: la más reciente primero (a igual sobre, la mejor carta
   primero). */
export function mejoresDrops(datos, n = 8) {
  const e = ecoDe(datos), out = [];
  if (!e) return out;
  for (const so of Object.values(e.sobres)) {
    if (so.r) { if (PM.CARDS[so.r.id].tier >= 2) out.push(copia(e, so.u, so.k, 0)); continue; }
    const s = PM.sobre(so.u, so.k, so.at);
    s.cartas.forEach((c, i) => { if (PM.CARDS[c.id].tier >= 2) out.push(copia(e, so.u, so.k, i)); });
  }
  return out.filter(Boolean).sort((a, b) => b.at - a.at || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0) || b.i - a.i).slice(0, n);
}

/* Cuántos sobres se han abierto, en total y god packs. */
export function cifras(datos) {
  const e = ecoDe(datos);
  let sobres = 0, dioses = 0, leyendas = 0;
  for (const so of Object.values((e && e.sobres) || {})) {
    if (so.r) continue;   // un re-roll no es un sobre abierto
    const s = PM.sobre(so.u, so.k, so.at);
    sobres++; if (s.dios) dioses++;
    leyendas += s.cartas.filter(c => PM.CARDS[c.id].tier === 3).length;
  }
  return { sobres, dioses, leyendas };
}

/* Una carta pequeña, para el vestíbulo y el perfil: la imagen, la
   rareza en el borde y, si está graduada, su nota en una etiqueta. */
export function miniCarta(c, extra = "") {
  const t = PM.TIERS[c.carta.tier], cc = c.carta;
  const nota = c.gr ? `<span class="jg-cc-nota" style="--gc:${PM.colorNota(c.g)}" title="${esc(PM.GRADE_WORD[c.g])}">${c.g}</span>` : "";
  return `<figure class="jg-cc t${cc.tier}" style="--cc:${PM.acento(cc)}" title="${esc(cc.name + " · " + PM.subtitulo(cc) + " · " + t.label + (c.gr ? " · nota " + c.g : ""))}">
    <img src="${RAIZ}${esc(cc.img)}" alt="${esc(cc.name + ", " + PM.subtitulo(cc))}" loading="lazy" draggable="false">
    ${nota}${c.dios ? `<span class="jg-cc-dios" title="Salió de un god pack">GOD</span>` : ""}
    <figcaption><b>${esc(cc.name)}</b><small>${esc(t.sym)} ${esc(PM.subtitulo(cc))}</small></figcaption>${extra}
  </figure>`;
}
