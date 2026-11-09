/* Verificador antitrampas de Pro BoxHead en el Solo Club (ver
   docs/antitrampas.md y docs/antitrampas/boxhead.md).

   Una tabla por mapa: `club-boxhead-<mapa>` (los nueve de `ORDEN_MAPAS`);
   puntos = el nivel al que se llegó en una práctica (el de la muerte), tiempo =
   los ms de juego que tardó en llegar a ese nivel (los pasos del motor, 1/60 s
   cada uno): con el mismo nivel gana quien llegó antes.

   El juego manda `{v, ve, u, m, s, j, k}` (juegos/boxhead/js/juego.js, «la
   grabadora»): la cuenta, el mapa, la semilla, cada jugada con su paso y el
   paso en que terminó. Aquí se rehace con el MISMO juego, sin pantalla: en el
   navegador en un Web Worker (js/verificador.js), en Node con lo que haya
   dejado tests/boxhead.test.cjs o scripts/auditar-club.cjs en
   globalThis.BoxheadRehace (js/rehace-node.cjs). El nivel, el paso final y el
   tiempo tienen que salir exactos. La cuenta entra en la semilla del azar, así
   que una prueba copiada a otra cuenta no llega al mismo final.

   El límite honesto: un programa que juegue de verdad saca una prueba válida. */
export const PRUEBA = 1;

const MAPAS = ['patio', 'sotano', 'cruce', 'fortaleza', 'laberinto'];
const CATEGORIA = /^club-boxhead-(patio|sotano|cruce|fortaleza|laberinto|planta|hangar|fabrica|apagon)$/;
const RUTA = 'juegos/boxhead/js/verificador.js?v=boxhead-19';
export const MAX_NIVEL = 999;

let trabajador = null, serie = 0;
const espera = new Map();
function enTrabajador(p) {
  if (!trabajador) {
    trabajador = new Worker(new URL(RUTA, location.href));
    trabajador.onmessage = e => { const d = e.data || {}, f = espera.get(d.id); if (f) { espera.delete(d.id); f.ok(d); } };
    trabajador.onerror = e => {
      const err = new Error('el verificador de Pro BoxHead no cargó (' + (e && e.message || 'error') + ')');
      for (const f of espera.values()) f.mal(err);
      espera.clear(); trabajador = null;
    };
  }
  const id = ++serie;
  return new Promise((ok, mal) => { espera.set(id, { ok, mal }); trabajador.postMessage({ id, p }); });
}
async function rehaz(p) {
  const R = globalThis.BoxheadRehace;
  if (typeof R === 'function') { try { return { r: R(p), motivo: null }; } catch (e) { return { r: null, motivo: String(e && e.message || e) }; } }
  if (typeof Worker === 'function' && typeof location !== 'undefined') return enTrabajador(p);
  throw new Error('no hay motor de Pro BoxHead con qué rehacer la partida');
}

export const tiempoDe = pasos => Math.round((pasos + 1) * 1000 / 60);

export async function verifica(dato, prueba, ctx = {}) {
  const m = dato && CATEGORIA.exec(dato.categoria);
  if (!m) return 'Pro BoxHead no tiene esa tabla.';
  if (!Number.isInteger(dato.puntos) || dato.puntos < 1 || dato.puntos > MAX_NIVEL) return 'Ese nivel no es posible.';
  if (!prueba || typeof prueba !== 'object' || prueba.v !== 1 || !Array.isArray(prueba.j) || !Number.isSafeInteger(prueba.k)) return 'La prueba de Pro BoxHead no tiene la forma esperada.';
  const uid = (ctx && ctx.uid) || dato.uid;
  if (typeof prueba.u !== 'string') return 'La prueba no dice de qué cuenta es.';
  if (uid && prueba.u !== uid) return 'La prueba es de una partida de otra cuenta.';
  if (prueba.m !== MAPAS.indexOf(m[1])) return 'La prueba es de otro mapa.';
  if (!Number.isSafeInteger(prueba.s) || prueba.s < 0 || prueba.s > 0xFFFFFFFF) return 'La semilla de la partida no es válida.';
  const { r, motivo } = await rehaz(prueba);
  if (motivo) return motivo;
  if (!r || !r.terminada) return 'La partida rehecha no termina donde dice la prueba.';
  if (r.pasos !== prueba.k) return 'La partida rehecha termina en otro momento.';
  if (r.nivel !== dato.puntos) return `La partida rehecha llega al nivel ${r.nivel}, no al ${dato.puntos}.`;
  if (tiempoDe(r.pasoNivel) !== dato.tiempo) return 'El tiempo de la partida no cuadra con la prueba.';
  return null;
}

/* Una fila guardada, sin mirar su prueba: ¿es inverosímil? Cada nivel pide
   que salga y caiga toda su horda (más un respiro de 2,5 s): ninguno dura
   menos de unos segundos. */
export function sospecha(categoria, fila) {
  if (!CATEGORIA.test(categoria) || !fila) return null;
  if (fila.puntos > MAX_NIVEL) return 'Un nivel que el juego no alcanza.';
  if (fila.puntos > 1 && fila.tiempo < (fila.puntos - 1) * 4000) return 'Niveles más cortos de lo que el juego permite.';
  return null;
}
