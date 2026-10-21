/* El mercado de Juegos, puro y sin DOM: lo que se vende de PRODROP (cartas)
   y de Mascotas (objetos, bailes y mascotas), sacado de la economía
   (juegos/monedas.js). Lo pinta juegos/mercado.js.

   Un mismo nodo para todo: `mercado/o` (ofertas) y `mercado/t`
   (intercambios), con las mismas garantías de siempre (`x` y `v` una sola
   vez y excluyentes; el replay solo acepta ofertas de quien es dueño; una
   compra sin fondos queda `impaga`). Lo único nuevo es qué es cada copia:
   `leeCopia` dice si es una carta, un objeto (`ob:`) o una mascota (`ma:`).

   Las cartas de la Serie 01 (Profes) solo existen para quien la ve
   (`veSerie1`, prodrop-cartas.js): `fichaCopia` no las resuelve para los
   demás, así que no salen en las ofertas, las ventas ni los intercambios,
   y solo se cambian entre dos cuentas que la ven.

   Las piezas de Batalla de Rock (`rk:`, rock-datos.js) están a prueba:
   solo las ve quien `veRock()` (los administradores). */
import { economia, monedasDe, copiasDe, mascotasDe, objetosDe, rocasDe, leeCopia } from "./monedas.js";
import { veRock, fichaRock } from "./rock-datos.js";
import { copiaDe, MOTOR, copiaVisible } from "./prodrop-cartas.js";
import { fichaObjeto, fichaMascota } from "./mascotas-datos.js";
import MM from "../../../juegos/mascotas/motor.js";

export const MAX_PRECIO = 100000;
const JUEGOS_BASE = [["todo", "Todo"], ["prodrop", "PRODROP"], ["mascotas", "Mascotas"]];
export const JUEGOS_MERCADO = JUEGOS_BASE;
/* Los juegos que ve quien mira (Batalla de Rock, solo a prueba). */
export const juegosMercado = () => (veRock() ? [...JUEGOS_BASE, ["rock", "Batalla de Rock"]] : JUEGOS_BASE);
export const TIPOS_MASCOTAS = [["todo", "Todo"], ["objeto", "Objetos"], ["baile", "Bailes"], ["mascota", "Mascotas"]];
export const FILTROS_INICIALES = { juego: "todo", tipoM: "todo", col: "", rareza: -1, grad: "todas", nota: 0, leg: "todos", espacio: "", especie: "", etapa: "", q: "", orden: "barato" };

const claveEstado = c => String(c).replace(/^ma:/, "");

/* Qué es una copia, con lo que hace falta para pintarla y filtrarla.
   `estados` = {clave de mascota: estado guardado} (se leen por clave). */
export function fichaCopia(c, datos, estados) {
  const e = economia(datos), q = leeCopia(c);
  if (!q) return null;
  if (q.tipo === "carta") {
    const cp = copiaDe(c, datos);
    if (!cp) return null;
    return { c, tipo: "carta", juego: "prodrop", cp, nombre: cp.carta.name, sub: MOTOR.subtitulo(cp.carta), tier: cp.carta.tier, col: cp.carta.col, gr: cp.gr, g: cp.g, leg: cp.carta.tier === 3 };
  }
  if (q.tipo === "rock") {
    const r = veRock() && e.rocas[c];
    if (!r) return null;
    const f = fichaRock(r.item);
    return { c, tipo: "rock", juego: "rock", item: r.item, nombre: f.nombre, emoji: f.emoji, colores: f.colores, leg: r.item.leg, sub: `${f.cat} · ${f.cuerpo}${r.item.leg ? " · Legendario" : ""}` };
  }
  if (q.tipo === "objeto") {
    const r = e.regalos[c];
    if (!r) return null;
    const f = fichaObjeto(r.item.kind, r.item.id);
    return { c, tipo: r.item.kind === "dance" ? "baile" : "objeto", juego: "mascotas", item: r.item, nombre: f.nombre, emoji: f.emoji, leg: r.item.leg, espacio: r.item.kind, sub: r.item.kind === "dance" ? "Baile" : f.leg ? "Legendario" : "" };
  }
  const m = e.mascotas[c];
  if (!m) return null;
  const est = (estados || {})[claveEstado(c)] || null, f = fichaMascota(m.e, est && est.e);
  return { c, tipo: "mascota", juego: "mascotas", m, estado: est, nombre: (est && est.n) || f.especie, sub: `${f.especie} · ${f.etapaId === "adult" ? "adulto" : f.etapa.toLowerCase()}`, emoji: f.emoji, especie: m.e, etapa: f.etapaId, frozen: !!e.congelada[c], leg: false };
}

/* Las ofertas activas, con su ficha. Las de cuentas paradas no se le
   ofrecen a nadie (salvo a su dueño, que tiene que verlas para retirarlas). */
export function ofertasMercado(datos, uid, estados) {
  if (!datos || !datos.completo) return [];
  const e = economia(datos), out = [];
  for (const o of Object.values(e.ofertas)) {
    if (o.estado !== "activa") continue;
    if (o.u !== uid && e.usuarios[o.u] && e.usuarios[o.u].parada) continue;
    const f = fichaCopia(o.c, datos, estados);
    if (f) out.push(Object.assign(f, { id: o.id, u: o.u, p: o.p, at: o.at, propia: o.u === uid }));
  }
  return out;
}

/* Los filtros: los de cartas y los de mascotas cambian según lo elegido;
   el orden y la búsqueda son comunes. */
export function filtra(filas, f) {
  const x = Object.assign({}, FILTROS_INICIALES, f || {}), q = x.q.trim().toLowerCase();
  const l = filas.filter(r => {
    if (x.juego !== "todo" && r.juego !== x.juego) return false;
    if (r.juego === "prodrop" && x.juego === "prodrop") {
      if (x.col && r.col !== x.col) return false;
      if (x.rareza >= 0 && r.tier !== x.rareza) return false;
      if (x.grad === "si" && !r.gr) return false;
      if (x.grad === "no" && r.gr) return false;
      if (x.grad === "si" && x.nota && r.g < x.nota) return false;
    }
    if (r.juego === "mascotas" && x.juego === "mascotas") {
      if (x.tipoM !== "todo" && r.tipo !== x.tipoM) return false;
      if (r.tipo !== "mascota" && x.leg === "leg" && !r.leg) return false;
      if (r.tipo !== "mascota" && x.leg === "comun" && r.leg) return false;
      if (x.espacio && r.tipo === "objeto" && r.espacio !== x.espacio) return false;
      if (x.especie && r.tipo === "mascota" && r.especie !== x.especie) return false;
      if (x.etapa && r.tipo === "mascota" && r.etapa !== x.etapa) return false;
    }
    if (q && !(r.nombre + " " + (r.sub || "")).toLowerCase().includes(q)) return false;
    return true;
  });
  const ord = {
    barato: (a, b) => a.p - b.p || b.at - a.at,
    caro: (a, b) => b.p - a.p || b.at - a.at,
    nuevo: (a, b) => b.at - a.at || a.p - b.p
  };
  return l.sort(ord[x.orden] || ord.barato);
}

/* Mis ventas y mis compras, de la más reciente a la más vieja. */
export function misVentas(datos, uid, estados) {
  if (!datos || !datos.completo) return [];
  const e = economia(datos), out = [];
  for (const o of Object.values(e.ofertas)) {
    const mia = o.u === uid && o.estado !== "nula", compra = o.comprador === uid && o.estado === "vendida";
    if (!mia && !compra) continue;
    const f = fichaCopia(o.c, datos, estados);
    if (f) out.push(Object.assign(f, { id: o.id, u: o.u, p: o.p, at: o.at, estado: o.estado, fin: o.fin || 0, comprador: o.comprador || "", compra: compra && o.u !== uid }));
  }
  return out.sort((a, b) => (b.fin || b.at) - (a.fin || a.at));
}

/* Lo que una cuenta puede ofrecer en un intercambio o vender: sus copias
   que no están a la venta (lo inicial no tiene copia y no aparece). */
export function intercambiables(datos, uid, estados) {
  if (!datos || !datos.completo) return [];
  const cs = [
    ...copiasDe(uid, datos).filter(x => !x.venta).map(x => x.c),
    ...objetosDe(uid, datos).filter(x => !x.venta).map(x => x.c),
    ...mascotasDe(uid, datos).filter(x => !x.venta).map(x => x.c),
    ...(veRock() ? rocasDe(uid, datos).filter(x => !x.venta).map(x => x.c) : [])
  ];
  return cs.map(c => fichaCopia(c, datos, estados)).filter(Boolean);
}

/* Con quién se puede cambiar: todo el que tenga algo y no esté parado.
   Una carta de la Serie 01 solo cuenta si la ven los dos. */
export function gente(datos, uid) {
  if (!datos || !datos.completo) return {};
  const e = economia(datos), out = {};
  for (const [c, u] of Object.entries(e.dueno)) {
    if (u === uid || e.enVenta[c] || (e.usuarios[u] && e.usuarios[u].parada)) continue;
    if (!copiaVisible(c) || !copiaVisible(c, u) || (!veRock() && leeCopia(c).tipo === "rock")) continue;
    (out[u] = out[u] || []).push(c);
  }
  return out;
}

/* Los intercambios que me tocan, con su estado y si todavía son posibles. */
export function misCambios(datos, uid, estados) {
  if (!datos || !datos.completo) return [];
  const e = economia(datos), out = [];
  const lista = x => (Array.isArray(x) ? x : Object.values(x || {})).map(String);
  const parada = u => !!(e.usuarios[u] && e.usuarios[u].parada);
  for (const [id, t] of Object.entries((datos.mercado && datos.mercado.t) || {})) {
    if (!t || (t.de !== uid && t.para !== uid)) continue;
    const hecho = e.cambios[id], dar = lista(t.dar), pedir = lista(t.pedir);
    // uno con una carta de una serie que no ve no existe para quien mira
    if (![...dar, ...pedir].every(c => copiaVisible(c) && (veRock() || leeCopia(c).tipo !== "rock"))) continue;
    const estado = Number.isFinite(t.x) ? "cerrado" : hecho ? hecho.estado : "pendiente";
    const posible = dar.every(c => e.dueno[c] === t.de && !e.enVenta[c]) && pedir.every(c => e.dueno[c] === t.para && !e.enVenta[c]) && !parada(t.de) && !parada(t.para);
    out.push({ id, de: t.de, para: t.para, at: t.at, fin: t.ok || t.x || 0, estado, posible,
      dar: dar.map(c => fichaCopia(c, datos, estados)).filter(Boolean), pedir: pedir.map(c => fichaCopia(c, datos, estados)).filter(Boolean) });
  }
  return out.sort((a, b) => (b.fin || b.at) - (a.fin || a.at));
}
export const pendientesDe = (datos, uid) => misCambios(datos, uid).filter(t => t.estado === "pendiente" && t.para === uid).length;

/* Las comprobaciones antes de escribir (las mismas que hará la economía al
   rehacerlo: el que pinta puede estar mirando algo viejo). Devuelven el
   motivo para no hacerlo, o "" si se puede. */
export function puedeComprar(datos, uid, id) {
  const e = economia(datos), o = e.ofertas[id];
  if (!o || o.estado !== "activa" || !copiaVisible(o.c)) return "Alguien se te adelantó: eso ya no está a la venta.";
  if (o.u === uid) return "Es tu propia oferta.";
  if (e.usuarios[o.u] && e.usuarios[o.u].parada) return "Esa cuenta no puede vender ahora.";
  const m = monedasDe(uid, datos);
  if (m.parada) return "Tu cuenta tiene una compra sin fondos: hasta que ganes lo que falta, no puedes gastar.";
  if (m.saldo < o.p) return `Cuesta ${o.p.toLocaleString("es-CL")}: te faltan ${(o.p - m.saldo).toLocaleString("es-CL")} monedas.`;
  if (leeCopia(o.c).tipo === "mascota" && mascotasDe(uid, datos).length >= MM.MAX_MASCOTAS) return `Tu corral está lleno (${MM.MAX_MASCOTAS} mascotas): vende o despide a una antes.`;
  return "";
}
export function puedeProponer(datos, uid, para, dar, pedir) {
  const e = economia(datos);
  if (!para || para === uid) return "Elige con quién cambiar.";
  if (!dar.length || dar.length > 3 || pedir.length > 3) return "Ofrece de 1 a 3 cosas y pide hasta 3.";
  if (!dar.every(c => leeCopia(c) && e.dueno[c] === uid && !e.enVenta[c])) return "Algo de lo tuyo ya no es tuyo o está a la venta.";
  if (!pedir.every(c => leeCopia(c) && e.dueno[c] === para && !e.enVenta[c])) return "Algo de lo que pides ya no es suyo o está a la venta.";
  if (![...dar, ...pedir].every(c => copiaVisible(c) && copiaVisible(c, para))) return "Esa carta no se puede cambiar con esa persona.";
  if (monedasDe(uid, datos).parada || (e.usuarios[para] && e.usuarios[para].parada)) return "Ahora no se puede proponer ese intercambio.";
  const n = l => l.filter(c => leeCopia(c).tipo === "mascota").length;
  if (mascotasDe(uid, datos).length - n(dar) + n(pedir) > MM.MAX_MASCOTAS) return `Quedarías con más de ${MM.MAX_MASCOTAS} mascotas.`;
  if (mascotasDe(para, datos).length - n(pedir) + n(dar) > MM.MAX_MASCOTAS) return `Esa persona quedaría con más de ${MM.MAX_MASCOTAS} mascotas.`;
  return "";
}
