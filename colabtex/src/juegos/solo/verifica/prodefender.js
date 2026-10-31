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
/* Una sola prueba por cuenta y reino: cada ronda del récord es una partida
   nueva (la prueba entera hasta esa ronda), así que al guardarse la fila
   nueva la página borra la prueba de la anterior (juegos-main.js:
   guardaClub). Sin esto quedaban hasta cien copias crecientes de la misma
   partida en `soloPruebas`, y la consola, las exportaciones y la auditoría
   las bajaban todas. */
export const UNA_PRUEBA = true;

const CATEGORIA = /^club-prodefender-(prado|dunas|glaciar|caldera|vacio|pantano|cumbres|fosa|engranajes|eclipse|necropolis|esporas|espejos|archipielago|noche|jade|circo|biblioteca|estelar|tiempo)$/;
const REINOS = ['prado', 'dunas', 'glaciar', 'caldera', 'vacio', 'pantano', 'cumbres', 'fosa', 'engranajes', 'eclipse',
  'necropolis', 'esporas', 'espejos', 'archipielago', 'noche', 'jade', 'circo', 'biblioteca', 'estelar', 'tiempo'];
const RUTA = 'juegos/club/prodefender/js/verificador.js?v=pd-12';
const DESBLOQUEO = 50;   // levels.js: PD.UNLOCK_ROUND

/* La prueba tal como se guarda (v: 2). El juego manda la de siempre (v: 1,
   cada jugada un arreglo [paso, código, …], prueba.js) y la página la guarda
   compacta: todas las jugadas en un solo texto, cada una con una letra por
   código (A colocar, B mejorar, C vender, D objetivo, E ronda, F recargar,
   G pinchos; la tercera era suma H pacto e I Poder del Reino) seguida de sus números en base 36 separados por comas. El paso
   va como lo que avanzó desde la jugada anterior del mismo tramo (tras una
   recarga el tramo nuevo empieza en 0), que casi siempre son dos o tres
   letras en vez de seis cifras.
     [[95,0,3,300,170],[140,1,1,0],[300,4]]  →  "A2n,3,8c,4qB19,1,0E4g"
   Pesa menos de la mitad y `expande` la devuelve exacta a la v: 1 antes de
   rehacerla. El juego y su trabajador no cambian: un iframe o un
   trabajador viejo en caché nunca ven la v: 2 (no hay castigo por caché). */
const LETRAS = 'ABCDEFGHI';
function aTexto(p) {
  let base = 0, t = '';
  for (const j of p.j) {
    if (!Array.isArray(j) || j.length < 2 || j.length > 5 || !j.every(Number.isSafeInteger) || j[1] < 0 || j[1] >= LETRAS.length || j[0] < base) return null;
    t += LETRAS[j[1]] + [j[0] - base, ...j.slice(2)].map(n => n.toString(36)).join(',');
    base = j[1] === 5 ? 0 : j[0];
  }
  return t;
}
/* La v: 1 → la v: 2. Lo que no tiene la forma de siempre (o no vuelve
   idéntico al expandirlo) se deja como vino: se guarda tal cual. */
export function compacta(p) {
  if (!p || typeof p !== 'object' || p.v !== 1 || !Array.isArray(p.j)) return p;
  const t = aTexto(p);
  if (t === null) return p;
  const c = { v: 2, ve: p.ve, u: p.u, r: p.r, s: p.s, k: p.k, j: t };
  return JSON.stringify(expande(c)) === JSON.stringify(p) ? c : p;
}
/* La v: 2 → la v: 1 (cualquier otra cosa pasa igual). null si el texto no
   se puede leer. */
export function expande(p) {
  if (!p || typeof p !== 'object' || p.v !== 2) return p;
  if (typeof p.j !== 'string') return null;
  const partes = p.j.match(/[A-I][-0-9a-z,]*/g) || [];
  if (partes.join('').length !== p.j.length) return null;
  const j = [];
  let base = 0;
  for (const x of partes) {
    const c = LETRAS.indexOf(x[0]);
    const n = x.slice(1).split(',').map(d => /^-?[0-9a-z]+$/.test(d) ? parseInt(d, 36) : NaN);
    if (!n.every(Number.isSafeInteger)) return null;
    const k = base + n[0];
    j.push([k, c, ...n.slice(1)]);
    base = c === 5 ? 0 : k;
  }
  return { v: 1, ve: p.ve, u: p.u, r: p.r, s: p.s, j, k: p.k };
}
/* Lo que la página guarda en `soloPruebas` (verifica.js: pruebaGuardable). */
export const guardable = compacta;

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
  prueba = expande(prueba);   // la guardada viene compacta (v: 2)
  if (!prueba || typeof prueba !== 'object' || prueba.v !== 1 || !Array.isArray(prueba.j)) return 'La prueba de PRO DEFENDER no tiene la forma esperada.';
  if (prueba.r !== REINOS.indexOf(m[1])) return 'La prueba es de otro reino.';
  // Cada reino se desbloquea llegando a la ronda 50 del anterior. La página lo comprueba con tu
  // fila de la tabla anterior (`ctx.filaEn`; sin ella, en las auditorías, no se mira). Este
  // rechazo no castiga (castigo.js: «sin desbloquear»): puede ser un récord anterior sin subir.
  const li = prueba.r;
  if (li > 0 && typeof ctx.filaEn === 'function') {
    let f;
    try { f = await ctx.filaEn('club-prodefender-' + REINOS[li - 1]); } catch (e) { return 'No se pudo comprobar el reino anterior.'; }
    if (!f || !(f.puntos >= DESBLOQUEO)) return `Reino sin desbloquear: primero llega a la ronda ${DESBLOQUEO} del reino anterior.`;
  }
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
