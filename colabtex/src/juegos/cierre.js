/* ============================================================
   El cierre de la economía: calcularlo, decidir qué se archiva y
   comprobarlo (puro; lo usa el panel de administración, admin.js).
   El formato y por qué existe: cierre-datos.js.

   Las tres reglas que lo hacen exacto:

   1. **Un cierre en `T` es el estado tras todos los eventos con hora
      ≤ `T`**, y `economia()` rehace solo los de después. Un registro que
      siga vivo con hora ≤ `T` (una oferta activa, una ronda sin terminar,
      una adopción) no se cuenta dos veces: su evento viejo se salta.
   2. **No se cierra a nadie parado** (decisión de octubre de 2026). Una
      cuenta parada vuelve a valer cuando gana lo que le falta, porque el
      recorrido mide cada gasto contra lo ganado *hoy*; un cierre la
      dejaría parada para siempre. Así que `T` queda antes del primer
      gasto sin fondos de cualquier cuenta parada ahora. Para destrabarlo:
      un ajuste de monedas o un corte (cortes.js) a esa cuenta.
   3. **Antes de escribir se comprueba** (`verificaCierre`) que con el
      cierre y sin lo archivado sale la misma economía que con todo: cada
      saldo, cada dueño, cada carta graduada y cada oferta. Si algo no
      cuadra, no se escribe.

   Lo que se mide contra lo ganado *hoy* deja de moverse para lo cerrado:
   si un administrador borra récords y alguien queda debiendo algo de antes
   de `T`, con el cierre lo de antes vale igual. «Recalcular» (el panel)
   junta el archivo con lo vivo y rehace todo desde cero cuando haga falta.
   ============================================================ */
import { recorreEconomia, economia, monedasDe } from "./monedas.js";
import { empaquetaCierre, leeCierre } from "./cierre-datos.js";
import PM from "../../../juegos/prodrop/motor.js";

/* Lo que se cierra por omisión: hasta hace un día. Lo de las últimas
   horas sigue vivo (un super chat se ve hasta dos horas, un sobre se
   retoma, una ronda sigue en juego). */
export const MARGEN_CIERRE = 24 * 3600 * 1000;
/* Los nodos que se archivan: los grandes, los de escritura única cuyo
   evento ya pasó. Los demás son pequeños, o las reglas miran su historia
   (la primera adopción gratis, la tienda, los referidos, el sobre gratis). */
export const NODOS_ARCHIVO = ["casino", "cartas", "mercado"];
/* Pasados estos días desde la hora del último cierre, la página de un
   administrador cierra sola (juegos-main.js, `cierraSiToca`), con la misma
   comprobación. El primer cierre siempre es a mano, desde el panel. */
export const AUTO_CIERRE_DIAS = 2;
/* El primer cierre, a la hora que eligió el dueño: lunes 26-10-2026 a la
   1:30 de Chile. Lo hace la página del primer administrador que tenga
   Juegos abierto desde esa hora (también se puede hacer antes, a mano). */
export const PRIMER_CIERRE = Date.parse("2026-10-26T04:30:00Z");

/* Los totales de los sobres contados en el cierre (para cifras y tablas de
   PRODROP): los del cierre anterior más los sobres nuevos de este. */
function totales(res) {
  const est = JSON.parse(JSON.stringify((res.cierre && res.cierre.est) || {}));
  for (const so of Object.values(res.sobres)) {
    if (so.r || so.cierre) continue;
    const col = PM.coleccionDe(so.k), x = est[col] || (est[col] = { s: {}, n: 0, d: 0, l: 0 });
    const s = PM.sobre(so.u, so.k, so.at);
    x.s[so.u] = (x.s[so.u] || 0) + 1; x.n++;
    if (s.dios) x.d++;
    x.l += s.cartas.filter(c => PM.CARDS[c.id].tier === 3).length;
  }
  return est;
}

/* Las rutas que pasan al archivo con un cierre en `T`, con su valor: todo
   lo que ya no puede cambiar nada después de `T`. */
export function archivables(datos, res, T) {
  const out = [], hora = x => (x && Number.isFinite(x.at) ? x.at : null);
  const c = datos.cartas || {}, m = datos.mercado || {};
  for (const [u, l] of Object.entries(datos.casino || {})) for (const [k, x] of Object.entries(l || {})) {
    if (!x || !(x.at <= T)) continue;
    const r = res.rondas[u + "~" + k];
    if (!r || (Number.isFinite(r.fin) && r.fin <= T)) out.push(["casino/" + u + "/" + k, x]);
  }
  for (const n of ["s", "r"]) for (const [u, l] of Object.entries(c[n] || {})) for (const [k, x] of Object.entries(l || {}))
    if (hora(x) !== null && x.at <= T) out.push([`cartas/${n}/${u}/${k}`, x]);
  for (const [u, l] of Object.entries(c.g || {})) for (const [k, porI] of Object.entries(l || {})) for (const [i, x] of Object.entries(porI || {}))
    if (hora(x) !== null && x.at <= T) out.push([`cartas/g/${u}/${k}/${i}`, x]);
  for (const [id, o] of Object.entries(m.o || {})) {
    if (!o || !(o.at <= T)) continue;
    const fin = Number.isFinite(o.x) ? o.x : o.v && Number.isFinite(o.v.at) ? o.v.at : null;
    const cerrada = fin !== null ? fin <= T : !(res.ofertas[id] && res.ofertas[id].estado === "activa");
    if (cerrada) out.push(["mercado/o/" + id, o]);
  }
  for (const [id, t] of Object.entries(m.t || {}))
    if (t && ((Number.isFinite(t.ok) && t.ok <= T) || (Number.isFinite(t.x) && t.x <= T))) out.push(["mercado/t/" + id, t]);
  return out;
}

/* Los datos sin las rutas dadas (para comprobar el cierre antes de
   escribirlo): copias nuevas solo de los nodos que cambian. */
export function sinRutas(datos, rutas) {
  const d = Object.assign({}, datos), copiado = new Set();
  const rama = (obj, camino) => {
    let o = obj;
    for (let i = 0; i < camino.length; i++) {
      const k = camino[i], clave = camino.slice(0, i + 1).join("/");
      if (!o[k] || typeof o[k] !== "object") return null;
      if (!copiado.has(clave)) { o[k] = Array.isArray(o[k]) ? o[k].slice() : Object.assign({}, o[k]); copiado.add(clave); }
      o = o[k];
    }
    return o;
  };
  for (const [ruta] of rutas) {
    const p = ruta.split("/"), padre = rama(d, p.slice(0, -1));
    if (padre) delete padre[p[p.length - 1]];
  }
  return d;
}

/* De `rutas`, las que siguen vivas en `datos` (al rehacer el cierre desde
   cero, lo ya archivado no se vuelve a mover). */
export function enVivo(datos, rutas) {
  const n = { casino: "casino", cartas: "cartas", mercado: "mercado" };
  return rutas.filter(([ruta]) => {
    const p = ruta.split("/");
    let o = datos[n[p[0]]];
    for (const k of p.slice(1)) { if (!o || typeof o !== "object") return false; o = o[k]; }
    return o != null;
  });
}

/* Lo vivo más lo archivado (`archivo` como lo devuelve la base): la
   historia entera, sin cierre, para recalcular desde cero. */
export function conArchivo(datos, archivo) {
  const d = Object.assign({}, datos, { cierre: null });
  const junta = (a, b) => {
    if (!b || typeof b !== "object") return a;
    const o = Object.assign({}, a || {});
    for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === "object" && o[k] && typeof o[k] === "object" ? junta(o[k], v) : (k in o ? o[k] : v);
    return o;
  };
  for (const n of NODOS_ARCHIVO) d[n] = junta(datos[n], (archivo || {})[n]);
  return d;
}

/* Calcula un cierre en `hasta` (o antes, si una cuenta parada lo frena).
   Devuelve {T, nodo: {v, T, d}, archivar, frenos, bytes} o {nada, motivo}. */
export function hacerCierre(datos, hasta) {
  if (!datos || !datos.completo) return { nada: true, motivo: "Todavía no llegan todas las lecturas." };
  const ahora = recorreEconomia(datos), frenos = [];
  let T = Math.floor(hasta);
  for (const [u, x] of Object.entries(ahora.res.usuarios)) if (x.parada && Number.isFinite(ahora.paradaDesde[u])) {
    frenos.push({ uid: u, desde: ahora.paradaDesde[u], falta: x.falta });
    T = Math.min(T, ahora.paradaDesde[u] - 1);
  }
  const previo = datos.cierre ? leeCierre(datos.cierre) : null;
  if (previo && T <= previo.T) return { nada: true, motivo: "No hay nada nuevo que cerrar antes de las cuentas paradas.", frenos };
  const run = recorreEconomia(datos, T, true).res;
  const d = empaquetaCierre(run, T, totales(run)), archivar = archivables(datos, run, T);
  devuelveRondas(datos);
  return { T, nodo: { v: 1, T, d }, archivar, frenos, bytes: d.length };
}

/* Las rondas del casino son objetos compartidos entre economías (monedas.js,
   `memoRondas`), y cada recorrido les pone `valida`: uno hasta `T` o sobre
   otros datos las deja como estaban en ese recorrido, y el feed del casino
   de esta pestaña las leería así. Un recorrido entero de `datos` las
   devuelve a su estado. */
const devuelveRondas = datos => { recorreEconomia(datos); };

/* Con el cierre puesto y lo archivado fuera, ¿sale lo mismo? `datos` es la
   verdad (lo vivo, o la historia entera al rehacer desde cero) y `vivo` lo
   que hay hoy en la base, de lo que se quita `cierre.archivar`: lo que
   quedará de verdad. Devuelve la lista de diferencias (vacía: se puede
   escribir). */
export function verificaCierre(datos, cierre, vivo = datos) {
  const antes = Object.assign({}, datos), despues = Object.assign(sinRutas(vivo, cierre.archivar), { cierre: cierre.nodo });
  const A = economia(antes), B = economia(despues), dif = [];
  const cuentas = new Set([...Object.keys(A.usuarios), ...Object.keys(B.usuarios)]);
  for (const u of cuentas) {
    const a = monedasDe(u, antes), b = monedasDe(u, despues);
    for (const k of ["saldo", "gastadas", "cobradas", "premios", "parada", "falta"])
      if (a[k] !== b[k]) dif.push(`${u}: ${k} ${a[k]} → ${b[k]}`);
    const xa = A.usuarios[u] || {}, xb = B.usuarios[u] || {};
    for (const k of ["tienda", "tacos", "fondos", "superChats"])
      if (JSON.stringify(xa[k] || {}) !== JSON.stringify(xb[k] || {})) dif.push(`${u}: ${k} distinto`);
    if ((xa.comida || 0) !== (xb.comida || 0)) dif.push(`${u}: comida ${xa.comida} → ${xb.comida}`);
    if (Math.max(0, (xa.gratis || 0)) !== Math.max(0, (xb.gratis || 0))) dif.push(`${u}: sobre gratis ${xa.gratis} → ${xb.gratis}`);
    if (JSON.stringify(xa.casino || {}) !== JSON.stringify(xb.casino || {})) dif.push(`${u}: casino distinto`);
    if (JSON.stringify(xa.gasto || {}) !== JSON.stringify(xb.gasto || {})) dif.push(`${u}: gasto por categoría distinto`);
  }
  const igual = (n, a, b, f = x => x) => {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) dif.push(`${n}: ${ka.length} → ${kb.length}`);
    for (const k of ka) if (f(a[k]) !== f(b[k])) { dif.push(`${n} ${k}: ${f(a[k])} → ${f(b[k])}`); if (dif.length > 40) return; }
  };
  igual("dueño", A.dueno, B.dueno);
  igual("en venta", A.enVenta, B.enVenta);
  /* De lo que ya no existe (una carta que se fue en un re-roll, una mascota
     despedida) el cierre no guarda nada: se compara lo vivo. */
  const vivas = (e, mapa, f) => Object.fromEntries(Object.entries(mapa).filter(([cc]) => e.dueno[cc]).map(([cc, x]) => [cc, f(x)]));
  igual("graduada", vivas(A, A.graduada, x => !!x), vivas(B, B.graduada, x => !!x));
  igual("mascota", vivas(A, A.mascotas, x => x.at + x.e), vivas(B, B.mascotas, x => x.at + x.e));
  igual("congelada", vivas(A, A.congelada, x => !!x), vivas(B, B.congelada, x => !!x));
  igual("objeto", vivas(A, A.regalos, x => JSON.stringify(x.item)), vivas(B, B.regalos, x => JSON.stringify(x.item)));
  igual("pieza", vivas(A, A.rocas, x => JSON.stringify(x.item)), vivas(B, B.rocas, x => JSON.stringify(x.item)));
  igual("historial", vivas(A, A.historial, x => x.join()), vivas(B, B.historial, x => x.join()));
  const copia = (e, cc) => { const q = /^(.+)~(.+)\.([0-4])$/.exec(cc), so = q && e.sobres[q[1] + "~" + q[2]]; return so ? (so.r ? JSON.stringify(so.r) : so.at) : "?"; };
  for (const cc of Object.keys(A.dueno)) if (/\.[0-4]$/.test(cc) && copia(A, cc) !== copia(B, cc)) { dif.push(`carta ${cc} distinta`); if (dif.length > 40) break; }
  devuelveRondas(vivo);
  return dif;
}
