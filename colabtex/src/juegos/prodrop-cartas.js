/* PRODROP en la página de Juegos — lo que se dice de las cartas fuera del
   abridor: las que alguien exhibe en su perfil y las mejores que se han
   sacado (la caja del vestíbulo). El motor es el mismo del abridor
   (juegos/prodrop/motor.js), así que una carta se rehace aquí igual que
   allá: de su sobre, nunca de algo que alguien haya escrito a mano.

   Dos reglas que valen en las dos listas:
   - **Solo cuenta lo que existe en el libro de compras.** Una clave
     exhibida que no es un sobre de esa cuenta no se pinta.
   - **Una cuenta con saldo negativo no exhibe nada.** Lo ganado nunca
     baja, así que estar en negativo solo pasa comprando sin fondos (con
     un cliente modificado: la página no deja). Esas cartas existen para
     su dueño, pero no se presumen. */
import PM from "../../../juegos/prodrop/motor.js";
import { monedasDe } from "./monedas.js";

export const MOTOR = PM;
export const RAIZ = "juegos/prodrop/";
export const MAX_EXHIBIDAS = 4;
const CLAVE = /^[-_A-Za-z0-9]{8,24}$/;
const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ¿Puede exhibir? Hace falta la lectura completa: con la mitad de los
   nodos el saldo sale de una suma a medias. */
export function solvente(uid, datos) {
  if (!datos || !datos.completo) return false;
  return monedasDe(uid, datos).saldo >= 0;
}

/* Una copia: {uid, k, i, at, id, g, gr, dios} con lo del catálogo. */
function copia(uid, k, i, x, g) {
  if (!CLAVE.test(k) || !x || !Number.isFinite(x.at) || !(i >= 0 && i < 5)) return null;
  const so = PM.sobre(uid, k, x.at), c = so.cartas[i];
  return { uid, k, i, at: x.at, id: c.id, g: c.g, gr: !!(g && g[k] && g[k][i]), dios: so.dios, carta: PM.CARDS[c.id] };
}

/* Las que exhibe, en el orden que eligió. */
export function exhibidasDe(uid, perfil, datos) {
  const lista = perfil && perfil.cartas, cs = (datos && datos.cartas) || {};
  if (!lista || !solvente(uid, datos)) return [];
  const claves = Array.isArray(lista) ? lista : Object.values(lista);
  const s = (cs.s || {})[uid] || {}, g = (cs.g || {})[uid] || {}, out = [];
  for (const key of claves.slice(0, MAX_EXHIBIDAS)) {
    const m = /^([-_A-Za-z0-9]{8,24})\.([0-4])$/.exec(String(key));
    if (!m || !s[m[1]]) continue;
    const c = copia(uid, m[1], +m[2], s[m[1]], g);
    if (c) out.push(c);
  }
  return out;
}

/* Las mejores sacadas por todos: solo épicas y legendarias. Primero las
   legendarias, después las graduadas con mejor nota, después lo más
   reciente. */
export function mejoresDrops(datos, n = 8) {
  const cs = (datos && datos.cartas) || {}, out = [];
  for (const [uid, sobres] of Object.entries(cs.s || {})) {
    if (!solvente(uid, datos)) continue;
    const g = (cs.g || {})[uid] || {};
    for (const [k, x] of Object.entries(sobres || {})) {
      if (!CLAVE.test(k) || !x || !Number.isFinite(x.at)) continue;
      const so = PM.sobre(uid, k, x.at);
      so.cartas.forEach((c, i) => {
        if (PM.CARDS[c.id].tier >= 2) out.push(copia(uid, k, i, x, g));
      });
    }
  }
  const nota = c => (c.gr ? c.g : 0);
  return out.filter(Boolean)
    .sort((a, b) => b.carta.tier - a.carta.tier || nota(b) - nota(a) || b.at - a.at || (a.k < b.k ? -1 : 1))
    .slice(0, n);
}

/* Cuántos sobres se han abierto, en total y god packs. */
export function cifras(datos) {
  const cs = (datos && datos.cartas) || {};
  let sobres = 0, dioses = 0, leyendas = 0;
  for (const [uid, l] of Object.entries(cs.s || {})) for (const [k, x] of Object.entries(l || {})) {
    if (!CLAVE.test(k) || !x || !Number.isFinite(x.at)) continue;
    const so = PM.sobre(uid, k, x.at);
    sobres++; if (so.dios) dioses++;
    leyendas += so.cartas.filter(c => PM.CARDS[c.id].tier === 3).length;
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
