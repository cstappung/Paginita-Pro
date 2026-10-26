/* ============================================================
   El cierre de la economía: el formato (puro, sin Firebase).

   `economia()` (monedas.js) rehace la historia entera de gastos del sitio
   en cada pestaña, y para eso cada pestaña bajaba los nodos enteros:
   ~3,8 MB por visita en octubre de 2026, casi todo `cartas` (los re-roll
   llevan diez claves de copia cada uno) y `casino` (una marca por cada
   aviso del avión). El cupo diario de descarga del plan gratuito es de
   360 MB para todo el sitio.

   Un cierre es el estado de esa historia hasta una hora `T`, calculado
   por un administrador (cierre.js) y guardado en `economiaCierre` = {v, T,
   at, por, d}, con `d` este texto. Lo viejo de `casino`, `cartas` y
   `mercado` pasa a `archivo/`, que solo leen los administradores, y cada
   pestaña rehace solo lo que vino después de `T` partiendo de aquí.

   Lo que lleva es lo que un evento posterior puede mirar, y nada más:
   - por cuenta, su estado del recorrido (gastadas, cobradas, premios sin
     redondear, gratis, tienda, tacos, mascotas, casino, categorías…), con
     solo los últimos `MOVS_CIERRE` movimientos, solo las cajas de rock que
     se enseñan y sin `sobres` (ese mapa solo lo usa PRODROP para retomar
     un sobre recién comprado, que es posterior);
   - cada copia que existe todavía, agrupada por sobre de origen: la hora
     del sobre (de ahí salen sus cartas), qué copias quedan y cuáles están
     graduadas, y aparte (`aj`) las que cambiaron de dueño;
   - las mascotas, objetos y piezas de rock vivas, con lo que hace falta
     para rehacerlas; las ofertas activas; las rondas del casino apostadas
     antes de `T` que no habían terminado (si la apuesta valió);
   - los totales de los sobres ya contados (`est`, por colección), para
     las cifras y las tablas de PRODROP, que cuentan sobres abiertos.

   Las cuentas van por índice (`us`) y las horas en base 36: con la
   exportación de octubre, ~0,3 MB en vez de los ~3,3 MB de los nodos.
   ============================================================ */

export const VERSION_CIERRE = 1;
/* Los movimientos que se guardan por cuenta (la lista de la pestaña de
   monedas solo enseña los recientes). */
export const MOVS_CIERRE = 30;
/* De las cajas de rock abiertas se guardan las legendarias (la tira del
   salón, `dropsRock`) y las últimas `CAJAS_CIERRE` (PRO HERO enseña las
   diez últimas); las demás quedan contadas en `cajasPrevias`. */
export const CAJAS_CIERRE = 10;

const b36 = n => Math.round(n).toString(36);
const de36 = s => parseInt(s, 36);
const mascara = l => l.reduce((m, si, i) => (si ? m | (1 << i) : m), 0);

/* `e` = lo que devuelve el recorrido hasta `T` sin redondear (monedas.js,
   `recorreEconomia`); `est` = los totales de sobres. Devuelve el texto. */
export function empaquetaCierre(e, T, est) {
  const us = [], idx = {};
  const i = u => (u in idx ? idx[u] : (idx[u] = us.push(u) - 1));
  const leeCc = cc => {
    const m = /^(?:(ob|ma|rk):)?([A-Za-z0-9]{6,40})~([-_A-Za-z0-9]{8,24})(?:\.([0-4]))?$/.exec(cc);
    return m ? { o: m[2], k: m[3] } : null;
  };
  const u = {};
  for (const [w, x] of Object.entries(e.usuarios)) {
    const y = Object.assign({}, x, { sobres: {}, movs: x.movs.slice(-MOVS_CIERRE) });
    const cajas = x.cajasRock || [], desde = cajas.length - CAJAS_CIERRE;
    y.cajasRock = cajas.filter((z, j) => j >= desde || (z.v && z.v.leg));
    if (cajas.length > y.cajasRock.length) y.cajasPrevias = (x.cajasPrevias || 0) + cajas.length - y.cajasRock.length;
    u[i(w)] = y;
  }
  const s = {}, r = {}, aj = {};
  const pon = (mapa, o, txt) => { const k = i(o); mapa[k] = mapa[k] ? mapa[k] + "|" + txt : txt; };
  for (const so of Object.values(e.sobres)) {
    if (so.r) {
      const cc = so.u + "~" + so.k + ".0";
      if (!e.dueno[cc]) continue;
      pon(r, so.u, [so.k, b36(so.at), so.r.id, so.r.g, b36(so.r.w), so.tier, e.graduada[cc] ? 1 : 0].join(","));
      continue;
    }
    const vivas = [], grad = [];
    for (let j = 0; j < 5; j++) { const cc = so.u + "~" + so.k + "." + j; vivas.push(!!e.dueno[cc]); grad.push(!!(e.dueno[cc] && e.graduada[cc])); }
    if (!vivas.some(Boolean)) continue;
    pon(s, so.u, [so.k, b36(so.at), mascara(vivas), mascara(grad)].join(","));
  }
  const ma = {}, re = {}, rk = {}, co = {}, hi = {};
  for (const [cc, w] of Object.entries(e.dueno)) {
    const q = leeCc(cc);
    if (q && q.o !== w) aj[cc] = i(w);
    if (e.mascotas[cc]) {
      ma[cc] = [b36(e.mascotas[cc].at), e.mascotas[cc].e];
      if (e.congelada[cc]) co[cc] = b36(e.congelada[cc]);
      if (e.historial[cc] && e.historial[cc].length) hi[cc] = e.historial[cc].map(i);
    } else if (e.regalos[cc]) re[cc] = b36(e.regalos[cc].at);
    else if (e.rocas[cc]) rk[cc] = [b36(e.rocas[cc].at), e.rocas[cc].b];
  }
  const of = {};
  for (const o of Object.values(e.ofertas)) if (o.estado === "activa") of[o.id] = [i(o.u), o.c, o.p, b36(o.at)];
  const ro = {};
  for (const [id, x] of Object.entries(e.rondas)) {
    if (!(x.at <= T) || (Number.isFinite(x.fin) && x.fin <= T)) continue;
    const p = id.indexOf("~");
    ro[i(id.slice(0, p)) + "~" + id.slice(p + 1)] = x.valida ? 1 : 0;
  }
  const es = {};
  for (const [col, v] of Object.entries(est || {})) {
    const sx = {};
    for (const [w, n] of Object.entries(v.s || {})) sx[i(w)] = n;
    es[col] = { s: sx, n: v.n || 0, d: v.d || 0, l: v.l || 0 };
  }
  return JSON.stringify({ v: VERSION_CIERRE, T, us, u, s, r, aj, ma, re, rk, co, hi, of, ro, est: es });
}

/* El texto, de vuelta a algo que monedas.js puede usar para empezar el
   recorrido. Se lee una vez por cierre (el nodo cambia solo al cerrar). */
const memo = new Map();
export function leeCierre(nodo) {
  if (!nodo || typeof nodo.d !== "string" || nodo.v !== VERSION_CIERRE) return null;
  if (memo.has(nodo.d)) return memo.get(nodo.d);
  let x;
  try { x = JSON.parse(nodo.d); } catch (e) { return null; }
  if (!x || x.v !== VERSION_CIERRE || !Number.isFinite(x.T) || !Array.isArray(x.us)) return null;
  const us = x.us, U = n => us[n];
  const out = { T: x.T, usuarios: {}, sobres: [], rerolls: [], ajenas: {}, mascotas: {}, regalos: {}, rocas: {}, congelada: {}, historial: {}, ofertas: {}, rondas: {}, est: {} };
  for (const [n, y] of Object.entries(x.u || {})) out.usuarios[U(n)] = y;
  for (const [n, txt] of Object.entries(x.s || {})) for (const t of txt.split("|")) {
    const [k, at, v, g] = t.split(",");
    out.sobres.push({ u: U(n), k, at: de36(at), vivas: +v, grad: +g });
  }
  for (const [n, txt] of Object.entries(x.r || {})) for (const t of txt.split("|")) {
    const [k, at, id, g, w, tier, gr] = t.split(",");
    out.rerolls.push({ u: U(n), k, at: de36(at), r: { id: +id, g: +g, w: de36(w) }, tier: +tier, grad: gr === "1" });
  }
  for (const [cc, n] of Object.entries(x.aj || {})) out.ajenas[cc] = U(n);
  for (const [cc, [at, e]] of Object.entries(x.ma || {})) out.mascotas[cc] = { at: de36(at), e };
  for (const [cc, at] of Object.entries(x.re || {})) out.regalos[cc] = de36(at);
  for (const [cc, [at, b]] of Object.entries(x.rk || {})) out.rocas[cc] = { at: de36(at), b };
  for (const [cc, at] of Object.entries(x.co || {})) out.congelada[cc] = de36(at);
  for (const [cc, l] of Object.entries(x.hi || {})) out.historial[cc] = l.map(U);
  for (const [id, [n, c, p, at]] of Object.entries(x.of || {})) out.ofertas[id] = { u: U(n), c, p, at: de36(at) };
  for (const [k, v] of Object.entries(x.ro || {})) { const p = k.indexOf("~"); out.rondas[U(k.slice(0, p)) + "~" + k.slice(p + 1)] = v === 1; }
  for (const [col, v] of Object.entries(x.est || {})) {
    const sx = {};
    for (const [n, c] of Object.entries(v.s || {})) sx[U(n)] = c;
    out.est[col] = { s: sx, n: v.n, d: v.d, l: v.l };
  }
  if (memo.size > 4) memo.clear();
  memo.set(nodo.d, out);
  return out;
}
