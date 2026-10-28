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
/* El `?v=` del abridor (prodrop.js): el visor del mercado lo usa para
   compartir la caché. */
export const PD_V = "pd-60";
export const MAX_EXHIBIDAS = 4;
const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- la Serie 01 (Profes): solo para quien habilita el admin ----------
   `prodropSerie1/<uid>` (lo escribe el panel de administración). Para quien
   no está en la lista esa colección no existe en ninguna pantalla: ni su
   sobre, ni sus cartas en la colección, el perfil propio o el ajeno, el
   mercado, los intercambios, las tablas o los drops. **Es solo de vista**:
   la economía no lee la lista, así que quien sale de ella no pierde nada
   (sus cartas, su saldo y sus gastos siguen igual) y al volver a entrar
   las ve otra vez. La colección de una copia sale de la clave de su sobre
   (`coleccionDe`: «c…» componentes, «f…» fútbol, «e…» Premier, lo demás profes), sin rehacerlo.
   Hasta que llega la lista (o sin reglas publicadas) no se ve. */
export const SERIE1 = "profes";
let serie1 = {}, yo = "";
/* La lista y quién mira. Devuelve si cambió lo que ve alguien. */
export function fijaSerie1(lista, uid) {
  const l = lista && typeof lista === "object" ? lista : {}, u = uid || "";
  const antes = JSON.stringify([Object.keys(serie1).sort(), yo]);
  serie1 = l; yo = u;
  return antes !== JSON.stringify([Object.keys(serie1).sort(), yo]);
}
/* ¿Ve la serie esta cuenta? Sin uid, la de quien mira. */
export const veSerie1 = (u = yo) => !!(u && serie1[u]);
export const colVisible = (col, u) => col !== SERIE1 || veSerie1(u);
/* Una copia («o~k.i», «ob:…», «ma:…») que esa cuenta puede ver. */
export function copiaVisible(cc, u) {
  const q = leeCopia(cc);
  return !q || q.tipo !== "carta" || colVisible(PM.coleccionDe(q.k), u);
}
/* Cuántas cartas tiene la colección que ve quien mira. */
export const totalVisible = () => PM.COLECCIONES.reduce((s, c) => s + (colVisible(c.key) ? PM.POR_COL[c.key].length : 0), 0);

/* La economía, solo con la lectura completa: con la mitad de los nodos
   lo ganado sale de una suma a medias. */
export const ecoDe = datos => (datos && datos.completo ? economia(datos) : null);

/* Una copia resuelta: {uid (quien la sacó), o, k, i, at, id, g, gr, dios,
   carta}. `uid` es el origen: los drops hablan de quien abrió el sobre. */
function copia(e, o, k, i) {
  const so = e.sobres[o + "~" + k];
  if (!so || !colVisible(PM.coleccionDe(k))) return null;
  /* Un re-roll es un «sobre» de una sola carta (la 0), sin god pack. */
  const s = so.r ? null : PM.sobre(o, k, so.at), c = so.r ? (i === 0 ? so.r : null) : s.cartas[i], cc = claveCopia(o, k, i);
  if (!c) return null;
  return { uid: o, o, k, i, at: so.at, c: cc, id: c.id, g: c.g, gr: !!e.graduada[cc], dios: !!(s && s.dios), rr: !!so.r, w: c.w, carta: PM.CARDS[c.id], dueno: e.dueno[cc] };
}
export const copiaDe = (cc, datos) => { const e = ecoDe(datos), q = leeCopia(cc); return e && q && q.tipo === "carta" ? copia(e, q.o, q.k, q.i) : null; };

/* Las que exhibe, en el orden que eligió, si todavía son suyas. Acepta la
   clave vieja `<sobre>.<i>` (de antes del mercado: el origen es el dueño). */
export function exhibidasDe(uid, perfil, datos) {
  const l = perfil && perfil.cartas, e = ecoDe(datos);
  if (!l || !e) return [];
  const out = [];
  for (const key of (Array.isArray(l) ? l : Object.values(l)).slice(0, MAX_EXHIBIDAS)) {
    const vieja = /^([-_A-Za-z0-9]{8,24})\.([0-4])$/.exec(String(key));
    const q = vieja ? { o: uid, k: vieja[1], i: +vieja[2], tipo: "carta" } : leeCopia(key);
    if (!q || q.tipo !== "carta") continue;
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
    if (!colVisible(PM.coleccionDe(so.k))) continue;
    if (so.r) { if (PM.CARDS[so.r.id].tier >= 2) out.push(copia(e, so.u, so.k, 0)); continue; }
    const s = PM.sobre(so.u, so.k, so.at);
    s.cartas.forEach((c, i) => { if (PM.CARDS[c.id].tier >= 2) out.push(copia(e, so.u, so.k, i)); });
  }
  return out.filter(Boolean).sort((a, b) => b.at - a.at || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0) || b.i - a.i).slice(0, n);
}

/* Para las dos tablas de cartas de la Clasificación: cada copia que
   existe ahora, con su dueño de *ahora* (la compró, la recibió o la sacó
   del sobre). Una por `datos`, que es lo que invalida la economía. */
const memoCopias = new WeakMap();
function copiasVivas(datos) {
  const e = ecoDe(datos);
  if (!e) return null;
  // lo que se ve depende de la Serie 01: la memoria también
  const m = memoCopias.get(e), v = veSerie1();
  if (m && m.v === v) return m.out;
  const out = [];
  for (const [cc, u] of Object.entries(e.dueno)) {
    const q = leeCopia(cc), c = q && q.tipo === "carta" && copia(e, q.o, q.k, q.i);
    if (c && u) out.push(c);
  }
  memoCopias.set(e, { v, out });
  return out;
}

/* Top de colección: cuántas cartas distintas de las que ve quien mira
   (todas, o sin la Serie 01) tiene cada cuenta ahora (graduadas o no;
   repetidas cuentan una vez). Con `col`, solo las de esa colección. En
   empate, más legendarias, luego más copias. */
export function rankingColeccion(datos, n = 10, col = "") {
  const l = copiasVivas(datos);
  if (!l) return null;
  const total = col ? PM.POR_COL[col].length : totalVisible(), por = {};
  for (const c of l) {
    if (col && c.carta.col !== col) continue;
    const a = por[c.dueno] || (por[c.dueno] = { uid: c.dueno, ids: new Set(), copias: 0, leyendas: new Set() });
    a.ids.add(c.id); a.copias++;
    if (c.carta.tier === 3) a.leyendas.add(c.id);
  }
  return Object.values(por)
    .map(a => ({ uid: a.uid, tiene: a.ids.size, total, copias: a.copias, leyendas: a.leyendas.size }))
    .sort((a, b) => b.tiene - a.tiene || b.leyendas - a.leyendas || b.copias - a.copias || (a.uid < b.uid ? -1 : 1))
    .slice(0, n);
}

/* Lo que vale una carta graduada en el top de colecciones raras, en
   décimas de punto: su rareza por su nota. Una legendaria con 10 son
   20 puntos y con 9, 18; una común con 10, 1 punto. */
export const PUNTOS_RAREZA = [1, 4, 10, 20];
export const puntosGraduada = (tier, g) => PUNTOS_RAREZA[tier] * g;

/* Top de colecciones más raras, una tabla por colección: de cada cuenta,
   solo sus graduadas de esa colección y solo la mejor copia de cada carta
   (dos legendarias iguales con 10 cuentan una vez). Cada fila trae esas
   cartas (`cartas`, de más a menos puntos), la suma (`puntos`, en
   décimas) y cuántos sobres de la colección ha abierto (`sobres`: los que
   compró y valen; un re-roll no es un sobre). Solo quien suma algo. */
const memoTop = new WeakMap();
export function topColecciones(datos, col) {
  const e = ecoDe(datos), l = copiasVivas(datos);
  if (!e || !l) return null;
  const m = memoTop.get(e) || {}, v = veSerie1();
  if (m.v !== v) { m.v = v; m.por = {}; memoTop.set(e, m); }
  if (m.por[col]) return m.por[col];
  /* Los sobres de antes del cierre de la economía vienen contados en él
     (`e.cierre.est`); en `e.sobres` solo quedan los que aún tienen cartas. */
  const previo = e.cierre && e.cierre.est[col], sobres = Object.assign({}, previo ? previo.s : {});
  for (const so of Object.values(e.sobres)) if (!so.r && !so.cierre && PM.coleccionDe(so.k) === col) sobres[so.u] = (sobres[so.u] || 0) + 1;
  const por = {};
  for (const c of l) {
    if (!c.gr || c.carta.col !== col) continue;
    const a = por[c.dueno] || (por[c.dueno] = {}), b = a[c.id];
    if (!b || c.g > b.g || (c.g === b.g && c.at < b.at)) a[c.id] = c;
  }
  const out = Object.entries(por).map(([uid, a]) => {
    const cartas = Object.values(a).map(c => Object.assign({}, c, { pts: puntosGraduada(c.carta.tier, c.g) }))
      .sort((x, y) => y.pts - x.pts || y.carta.tier - x.carta.tier || x.carta.num - y.carta.num);
    return { uid, puntos: cartas.reduce((s, c) => s + c.pts, 0), cartas, sobres: sobres[uid] || 0, total: PM.POR_COL[col].length };
  }).sort((a, b) => b.puntos - a.puntos || b.cartas.length - a.cartas.length || (a.uid < b.uid ? -1 : 1));
  return (m.por[col] = out);
}

/* Cuántos sobres se han abierto, en total y god packs. */
export function cifras(datos) {
  const e = ecoDe(datos);
  let sobres = 0, dioses = 0, leyendas = 0;
  // los de antes del cierre de la economía, ya contados (cierre.js)
  for (const [col, x] of Object.entries((e && e.cierre && e.cierre.est) || {}))
    if (colVisible(col)) { sobres += x.n; dioses += x.d; leyendas += x.l; }
  for (const so of Object.values((e && e.sobres) || {})) {
    if (so.r || so.cierre || !colVisible(PM.coleccionDe(so.k))) continue;   // un re-roll no es un sobre abierto
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
  const nota = c.gr ? `<span class="jg-pdc-nota" style="--gc:${PM.colorNota(c.g)}" title="${esc(PM.GRADE_WORD[c.g])}">${c.g}</span>` : "";
  return `<figure class="jg-pdc t${cc.tier}" style="--cc:${PM.acento(cc)}" title="${esc(cc.name + " · " + PM.subtitulo(cc) + " · " + t.label + (c.gr ? " · nota " + c.g : ""))}">
    <img src="${RAIZ}${esc(cc.img)}" alt="${esc(cc.name + ", " + PM.subtitulo(cc))}" loading="lazy" draggable="false">
    ${PM.esFutbol(cc.col) ? `<span class="jg-pdc-media" title="Media ${cc.media} (EA SPORTS FC)">${cc.media}</span>` : ""}${nota}${c.dios ? `<span class="jg-pdc-dios" title="Salió de un god pack">GOD</span>` : ""}
    <figcaption><b>${esc(cc.name)}</b><small>${esc(t.sym)} ${esc(PM.subtitulo(cc))}</small></figcaption>${extra}
  </figure>`;
}
