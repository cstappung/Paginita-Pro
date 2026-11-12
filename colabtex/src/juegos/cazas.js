/* ============================================================
   Las cacerías de récords («Se busca»): lo puro, sin DOM ni Firebase.

   Cualquiera pone monedas sobre el n.º 1 de una tabla del Solo Club, y
   quien primero supere esa marca se las lleva.

   - `cazas/b/<id>` = {u: quién la puso, c: categoría, q: dueño del récord,
     p: monedas, mp, mt: la marca a superar (puntos y tiempo de la fila de
     `q` al publicarla; la regla comprueba que sean los de la tabla), at}.
     Se escribe una vez y nadie la borra ni la cambia: eso es la custodia y
     el «no se puede cancelar».
   - `cazas/g/<id>/<uid>` = {at}: «yo la superé». Uno por cuenta, también
     de escritura única; la regla pide que la fila de esa cuenta supere la
     marca en ese momento (o que la fila del dueño ya no exista). Gana el
     reclamo **válido más antiguo**, y lo decide el recorrido de la
     economía (monedas.js, eventos `cz` y `cg`), no quien escribe: un
     reclamo de un récord que un administrador borró deja de valer y pasa
     el siguiente.

   El reparto (`reparto`):
   - la supera otra persona → todo para ella;
   - la supera el propio dueño del récord → la mitad para él y la otra
     mitad vuelve a quien la puso;
   - la puso el dueño sobre su propio récord y lo rompe él → vuelve todo;
   - la fila del dueño ya no está (récord borrado) → vuelve todo.

   Lo que la regla no puede comprobar: que `q` fuera el n.º 1 (una regla no
   ordena una tabla) ni que alcanzaran las monedas. Lo segundo lo cobra el
   recorrido como cualquier gasto (una cacería sin fondos no vale y frena la
   cuenta); lo primero solo lo ofrece la pantalla. Dos cuentas de acuerdo
   pueden pasarse monedas con una cacería, igual que con el mercado.
   ============================================================ */

export const CAZA_MIN = 500, CAZA_MAX = 10000000;

/* Cuanto más grande el pozo, más imponente se ve (el cartel, el aviso del
   chat y la entrada del buscado) y más rato queda su aviso en el chat. */
export const NIVELES_CAZA = [
  { n: 1, desde: CAZA_MIN, id: "encargo", nombre: "Encargo", icono: "🎯", ms: 20 * 60 * 1000 },
  { n: 2, desde: 2000, id: "caceria", nombre: "Cacería", icono: "🏹", ms: 45 * 60 * 1000 },
  { n: 3, desde: 10000, id: "gran", nombre: "Gran cacería", icono: "💰", ms: 2 * 3600 * 1000 },
  { n: 4, desde: 50000, id: "epica", nombre: "Cacería épica", icono: "🔥", ms: 6 * 3600 * 1000 },
  { n: 5, desde: 200000, id: "legendaria", nombre: "Cacería legendaria", icono: "👑", ms: 24 * 3600 * 1000 }
];
export const nivelCaza = p => NIVELES_CAZA.filter(x => p >= x.desde).pop() || NIVELES_CAZA[0];

const CAT = /^club-[a-z0-9-]+$/, UID = /^[A-Za-z0-9]{6,40}$/;
export const categoriaCazable = c => typeof c === "string" && CAT.test(c);
export function cazaValida(b) {
  return !!(b && typeof b.u === "string" && UID.test(b.u) && typeof b.q === "string" && UID.test(b.q) && categoriaCazable(b.c) &&
    Number.isInteger(b.p) && b.p >= CAZA_MIN && b.p <= CAZA_MAX && Number.isFinite(b.mp) && Number.isFinite(b.mt) && Number.isFinite(b.at));
}

/* El orden de las tablas del club (discord.js, `ordenSolo`): más puntos y,
   a igual puntos, menos tiempo. La regla de `cazas/g` compara lo mismo. */
export const supera = (fila, b) => !!(fila && b && Number.isFinite(fila.puntos) && (fila.puntos > b.mp || (fila.puntos === b.mp && fila.tiempo < b.mt)));

/* El n.º 1 de una tabla (`filas`: uid → fila), o null. */
export function primero(filas) {
  let m = null;
  for (const [uid, f] of Object.entries(filas || {})) {
    if (!f || !Number.isFinite(f.puntos)) continue;
    if (!m || f.puntos > m.puntos || (f.puntos === m.puntos && (f.tiempo < m.tiempo || (f.tiempo === m.tiempo && uid < m.uid)))) m = Object.assign({ uid }, f);
  }
  return m;
}

/* A quién le toca cuánto si `w` supera la marca. */
export function reparto(b, w) {
  if (w !== b.q) return [{ u: w, p: b.p }];
  if (b.u === b.q) return [{ u: b.u, p: b.p }];
  const mitad = Math.floor(b.p / 2);
  return [{ u: b.q, p: mitad }, { u: b.u, p: b.p - mitad }];
}

/* Lo que hace el reclamo de `w` sobre la cacería `b`, con las tablas como
   están (`solo`: categoría → uid → fila): null si no vale. */
export function resuelveCaza(b, w, solo) {
  const t = (solo || {})[b.c] || {};
  if (supera(t[w], b)) return { tipo: w !== b.q ? "cobrada" : b.u === b.q ? "propia" : "defendida", pagos: reparto(b, w) };
  if (!t[b.q]) return { tipo: "anulada", pagos: [{ u: b.u, p: b.p }] };
  return null;
}

/* Las cacerías abiertas, juntadas por récord (un pozo por tabla y dueño),
   del pozo más grande al más chico. `eco` = `economia(datos)`. */
export function cazasAbiertas(d, eco) {
  const bs = ((d && d.cazas) || {}).b || {}, g = {};
  for (const [id, x] of Object.entries((eco && eco.cazas) || {})) {
    const b = bs[id];
    if (x.estado !== "abierta" || !cazaValida(b)) continue;
    const k = [b.c, b.q, b.mp, b.mt].join("|");
    const o = g[k] || (g[k] = { k, c: b.c, q: b.q, mp: b.mp, mt: b.mt, pozo: 0, n: 0, desde: Infinity, at: 0, aportes: [] });
    o.pozo += b.p; o.n++; o.desde = Math.min(o.desde, b.at); o.at = Math.max(o.at, b.at);
    o.aportes.push({ id, u: b.u, p: b.p, at: b.at });
  }
  const l = Object.values(g);
  for (const o of l) { o.nivel = nivelCaza(o.pozo); o.aportes.sort((a, b) => b.p - a.p || a.at - b.at); }
  return l.sort((a, b) => b.pozo - a.pozo || a.desde - b.desde || (a.k < b.k ? -1 : 1));
}

/* Lo que la pestaña de `uid` debe reclamar ya: las abiertas que su fila
   supera, y las suyas cuyo récord ya no existe (para que vuelvan). */
export function porReclamar(d, eco, uid) {
  const bs = ((d && d.cazas) || {}).b || {}, gs = ((d && d.cazas) || {}).g || {}, solo = (d && d.solo) || {}, out = [];
  for (const [id, x] of Object.entries((eco && eco.cazas) || {})) {
    const b = bs[id];
    if (x.estado !== "abierta" || !cazaValida(b) || (gs[id] || {})[uid]) continue;
    const t = solo[b.c] || {};
    if (supera(t[uid], b) || (b.u === uid && !t[b.q])) out.push(id);
  }
  return out;
}

/* Lo que pasó hace poco, para el chat general: cada cacería que se puso
   (`pone`) y cada una que se resolvió, mientras dure su aviso (más rato
   cuanto más grande). Las resueltas del mismo récord en el mismo instante
   salen juntas, con el pozo entero. */
export function avisosCaza(d, eco, ahora) {
  const bs = ((d && d.cazas) || {}).b || {}, out = [], juntas = {};
  for (const [id, x] of Object.entries((eco && eco.cazas) || {})) {
    const b = bs[id];
    if (!cazaValida(b)) continue;
    const nv = nivelCaza(b.p);
    if (ahora - b.at < nv.ms) out.push({ id: "cz-" + id, at: b.at, tipo: "pone", uid: b.u, q: b.q, c: b.c, p: b.p, mp: b.mp, mt: b.mt, nivel: nv });
    if (x.estado === "abierta" || x.estado === "anulada" || !Number.isFinite(x.fin)) continue;
    const k = [b.c, b.q, x.w, x.fin, x.estado].join("|");
    const o = juntas[k] || (juntas[k] = { id: "cg-" + id, at: x.fin, tipo: x.estado, uid: x.w, q: b.q, c: b.c, p: 0, mp: b.mp, mt: b.mt });
    o.p += b.p;
  }
  for (const o of Object.values(juntas)) {
    o.nivel = nivelCaza(o.p);
    if (ahora - o.at < o.nivel.ms) out.push(o);
  }
  return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

/* Lo que `uid` cobró o le volvió por cacerías resueltas después de
   `desde`, para avisarle: [{id, at, tipo, p, c, q, w, mio}] (`mio`: lo que
   le tocó a él). */
export function resultadosDe(d, eco, uid, desde) {
  const bs = ((d && d.cazas) || {}).b || {}, out = [];
  for (const [id, x] of Object.entries((eco && eco.cazas) || {})) {
    const b = bs[id];
    if (!cazaValida(b) || x.estado === "abierta" || !Number.isFinite(x.fin) || x.fin <= desde) continue;
    const mio = (x.pagos || []).filter(y => y.u === uid).reduce((a, y) => a + y.p, 0);
    if (mio || b.u === uid) out.push({ id, at: x.fin, tipo: x.estado, p: b.p, c: b.c, q: b.q, u: b.u, w: x.w, mio });
  }
  return out.sort((a, b) => a.at - b.at);
}
