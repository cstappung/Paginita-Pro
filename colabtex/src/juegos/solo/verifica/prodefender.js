/* Verificador antitrampas de PRO DEFENDER (ver docs/antitrampas.md y
   docs/antitrampas/prodefender.md).

   Quince tablas, una por reino (los de la segunda y la tercera era desde
   el día en que se abren, levels.js `abre`): `club-prodefender-<reino>`, puntos = la
   ronda más alta superada en una partida (1–100), tiempo = los ms de juego
   que llevaba esa partida al superarla (los pasos del motor / 60).

   El juego manda `{v, ve, u, r, s, j, k}`: la cuenta, el reino, la semilla,
   cada jugada con el paso del motor en que se hizo y el último paso. Aquí se
   vuelve a jugar con el MISMO motor (juegos/club/prodefender/js/prueba.js:
   `rehace`) y la ronda y el tiempo tienen que salir exactos. Rehacer cien
   rondas son decenas de segundos de cálculo, así que en el navegador se hace
   en un Web Worker (js/verificador.js) que carga los archivos del juego y se
   acuerda de en qué quedó cada partida: la ronda siguiente solo simula lo
   nuevo. En Node se usa el motor ya cargado en `globalThis.PD` (lo cargan
   tests/prodefender.test.cjs y scripts/auditar-club.cjs).

   Un fallo del trabajador (no cargó, se cayó) lanza, y verificaClub lo
   convierte en «No se pudo comprobar…», que no castiga.

   El límite honesto: un programa que juegue de verdad saca una prueba
   válida, y la prueba no dice nada de quién estaba frente al teclado. */
export const PRUEBA = 1;

const CATEGORIA = /^club-prodefender-(prado|dunas|glaciar|caldera|vacio|pantano|cumbres|fosa|engranajes|eclipse|necropolis|esporas|espejos|archipielago|noche)$/;
const REINOS = ['prado', 'dunas', 'glaciar', 'caldera', 'vacio', 'pantano', 'cumbres', 'fosa', 'engranajes', 'eclipse',
  'necropolis', 'esporas', 'espejos', 'archipielago', 'noche'];
const RUTA = 'juegos/club/prodefender/js/verificador.js?v=pd-8';

let trabajador = null, serie = 0;
const espera = new Map();
const cacheLocal = new Map();

function enTrabajador(p, u) {
  if (!trabajador) {
    trabajador = new Worker(new URL(RUTA, location.href));
    trabajador.onmessage = e => { const d = e.data || {}, f = espera.get(d.id); if (f) { espera.delete(d.id); f.ok(d); } };
    trabajador.onerror = e => {
      const err = new Error('el verificador de PRO DEFENDER no cargó (' + (e && e.message || 'error') + ')');
      for (const f of espera.values()) f.mal(err);
      espera.clear(); trabajador = null;
    };
  }
  const id = ++serie;
  return new Promise((ok, mal) => { espera.set(id, { ok, mal }); trabajador.postMessage({ id, p, u }); });
}

/* {r, motivo}: r = {ronda, tiempo, perdida, ganada} si se pudo rehacer. */
async function rehaz(p, u) {
  const P = globalThis.PD && globalThis.PD.Prueba;
  if (P) { try { return { r: P.rehace(p, u, cacheLocal), motivo: null }; } catch (e) { return { r: null, motivo: String(e && e.message || e) }; } }
  if (typeof Worker === 'function' && typeof location !== 'undefined') return enTrabajador(p, u);
  throw new Error('no hay motor de PRO DEFENDER con qué rehacer la partida');
}

export async function verifica(dato, prueba, ctx = {}) {
  const m = dato && CATEGORIA.exec(dato.categoria);
  if (!m) return 'PRO DEFENDER no tiene esa tabla.';
  if (!Number.isInteger(dato.puntos) || dato.puntos < 1 || dato.puntos > 100) return 'Un reino tiene cien rondas.';
  if (!prueba || typeof prueba !== 'object' || prueba.v !== 1 || !Array.isArray(prueba.j)) return 'La prueba de PRO DEFENDER no tiene la forma esperada.';
  if (prueba.r !== REINOS.indexOf(m[1])) return 'La prueba es de otro reino.';
  const { r, motivo } = await rehaz(prueba, ctx.uid);
  if (motivo) return motivo;
  if (r.ronda !== dato.puntos) return `La partida rehecha llega a la ronda ${r.ronda}, no a la ${dato.puntos}.`;
  if (r.tiempo !== dato.tiempo) return 'El tiempo de la partida no cuadra con la prueba.';
  return null;
}

/* Una fila guardada, sin mirar su prueba: ¿es inverosímil? Ninguna ronda
   dura menos de unos segundos de juego (los enemigos tienen que salir y
   recorrer el camino). */
export function sospecha(categoria, fila) {
  if (!CATEGORIA.test(categoria) || !fila) return null;
  if (fila.puntos > 100) return 'Más rondas de las que tiene un reino.';
  if (fila.tiempo < fila.puntos * 5000) return 'Rondas más cortas de lo que el juego permite.';
  return null;
}
