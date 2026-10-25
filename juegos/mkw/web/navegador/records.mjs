// Récords de tiempo por pista y cilindrada: se leen del juego al terminar y se guardan aquí y en Firebase — bitácora §57.
//
// Resumen:
//   1. RELOJ (vigilarCarreras): mientras hay una carrera, mira la memoria del juego cada ½ s. Cuando el jugador 1
//      termina, lee su TIEMPO FINAL de Raceinfo (el juego lo calcula al cruzar la meta: minutos, segundos, milésimas),
//      la pista (CupsConfig de Pulsar) y la cilindrada y el modo (Racedata). Eso arma la "categoría": modo + cc
//      (p. ej. «tt150» = contrarreloj 150cc, «vs200» = carrera 200cc). Cada pista tiene su tabla por categoría.
//   2. LOCAL: el mejor tiempo de cada pista y categoría queda en este navegador (localStorage), con o sin cuenta.
//   3. NUBE (Firebase Realtime Database, si la persona inició sesión en el sitio): mkw/records/{pista}-{cat}/{uid},
//      uno por persona con SU mejor tiempo; solo se escribe si mejora (las reglas también lo exigen: docs/firebase-mkw.md).
//      La tabla = los 10 mejores de esa colección (ordenados por ms).
// Firebase entra por un "almacén" de tres funciones (mio, guardar, top): almacenRtdb() lo arma con el SDK del
// sitio; el banco usa uno falso que imita las reglas (banco/pruebas/records). Igual que nube.mjs.
//
// Direcciones (PAL, del código abierto de Pulsar/mkw-decomp):
//   Raceinfo* en 0x809BD730 → +0xC lista de jugadores (puntero a punteros) → jugador: +0x20 puesto, +0x38 estado,
//   +0x40 puntero al tiempo final → Timer: minutos u16 +4, segundos u8 +6, milésimas u16 +8, activo u8 +0xA.
//   Racedata* en 0x809BD728 → copia de la carrera +0xB68: cilindrada +0x4, modo +0x8, banderas +0x28.
//
// Uso:  const records = crearRecords({ almacen, uid, nombre });  vigilarCarreras({ lector, alTerminar: r => records.registrar(r) })

export const DIR = { raceinfo: 0x809BD730, racedata: 0x809BD728, cups: 0x8043319C };
const CARRERA = 0xB68;                                   // Racedata: la configuración de la carrera que se está corriendo
const SECCIONES_CARRERA = new Set([0x1E, 0x1F, 0x20]);   // Gran Premio, Contrarreloj, Carrera
const MODO = { 0: 'gp', 1: 'vs', 2: 'tt' };

// ms → "1:07.873"
export const textoTiempo = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;

// «tt150» → «Contrarreloj 150cc», «vsespejo» → «Carrera 150cc espejo»
export function nombreCategoria(cat) {
  const modo = cat.startsWith('tt') ? 'Contrarreloj' : 'Carrera', cc = cat.slice(2);
  return `${modo} ${cc === 'espejo' ? '150cc espejo' : cc + 'cc'}`;
}

// La cilindrada como la usa Retro Rewind: el juego guarda una "clase de motor" (0, 1, 2) y Pulsar la reinterpreta.
// clase 2 = 150cc (con la bandera 1 = espejo); clase 1 = 200cc (con la bandera 1 del menú = 100cc); clase 0 = 500cc.
export function cilindrada(clase, banderas, banderasMenu) {
  if (clase === 2) return banderas & 1 ? 'espejo' : '150';
  if (clase === 1) return banderasMenu & 1 ? '100' : '200';
  if (clase === 0) return '500';
  return '';
}

// Lo que dice el juego ahora mismo del jugador 1 (o null si no hay carrera). En la carrera sincronizada de la sala
// (§61) "yo" es mi puesto (window.mkwMiPuesto), no el puesto 0
export function leerCarrera(L) {
  const e = L.estado();
  if (!SECCIONES_CARRERA.has(e.seccion)) return null;
  const ri = L.u32(DIR.raceinfo), rd = L.u32(DIR.racedata);
  if (!ri || !rd) return null;
  const yo = window.mkwSincro && window.mkwMiPuesto >= 0 ? window.mkwMiPuesto : 0;
  const lista = L.u32(ri + 0xC), j = lista && L.u32(lista + 4 * yo);
  if (!j) return null;
  const t = L.u32(j + 0x40);
  const final = t ? { min: L.u16(t + 4), seg: L.u8(t + 6), mil: L.u16(t + 8), activo: L.u8(t + 0xA) } : null;
  const ms = final ? final.min * 60000 + final.seg * 1000 + final.mil : 0;
  // terminado = el tiempo final tiene un valor de verdad (sin terminar el juego lo deja en 99:99.999 o en 0)
  const terminado = !!final && ms > 5000 && final.min < 60 && final.seg < 60 && final.mil < 1000;
  const modo = MODO[L.u32(rd + CARRERA + 0x8)] || '';
  const cc = modo === 'tt' ? (L.u32(rd + CARRERA + 0x4) === 1 ? '200' : '150')
                           : cilindrada(L.u32(rd + CARRERA + 0x4), L.u32(rd + CARRERA + 0x28), L.u32(rd + 0x1780));
  return { seccion: e.seccion, terminado, ms, puesto: L.u8(j + 0x20), pista: L.u32(DIR.cups + 0x10), modo, cc,
           cat: (modo === 'gp' ? 'vs' : modo) + cc };
}

// Mira las carreras y avisa una vez por carrera terminada: alTerminar({ pista, cat, ms, puesto, modo, cc })
export function vigilarCarreras({ lector, alTerminar, cadaMs = 500 }) {
  let avisada = false, parado = false;
  const paso = () => {
    if (parado) return;
    try {
      const c = leerCarrera(lector);
      if (!c) avisada = false;                                 // fuera de carrera: la próxima vale de nuevo
      else if (c.terminado && !avisada && c.pista >= 0x100 && c.cat.length > 2) { avisada = true; alTerminar(c); }
      else if (!c.terminado) avisada = false;                  // empezó otra carrera (siguiente de la copa)
    } catch { /* memoria a medio armar: el próximo paso */ }
    setTimeout(paso, cadaMs);
  };
  paso();
  return { parar() { parado = true; } };
}

// ---- récords: local + nube ----
const clave = (pista, cat) => `${pista.toString(16)}-${cat}`;
export function crearRecords({ almacen = null, uid = '', nombre = '', recuerdo = globalThis.localStorage } = {}) {
  const leerLocal = () => { try { return JSON.parse(recuerdo.getItem('mkw.records')) || {}; } catch { return {}; } };
  const guardarLocal = m => { try { recuerdo.setItem('mkw.records', JSON.stringify(m)); } catch {} };
  return {
    // el mejor de este navegador para esa pista y categoría (ms o 0)
    mejorLocal: (pista, cat) => leerLocal()[clave(pista, cat)]?.ms || 0,
    // todos los mejores de este navegador para una pista: [{ cat, ms }] (para la vista previa al elegir)
    mejoresDe: pista => Object.entries(leerLocal()).filter(([k]) => k.startsWith(pista.toString(16) + '-'))
      .map(([k, v]) => ({ cat: k.split('-')[1], ms: v.ms })).sort((a, b) => a.cat.localeCompare(b.cat)),
    // conectar la nube después (cuando la persona inicia sesión en el sitio)
    conectar(o) { ({ almacen, uid, nombre } = { almacen, uid, nombre, ...o }); },
    get conNube() { return !!(almacen && uid); },
    // registrar un tiempo: → { ms, mejoraLocal, anterior, nube: 'subido'|'no mejora'|'sin sesión'|'error: …' }
    async registrar({ pista, cat, ms, personaje = -1, kart = -1 }) {
      const k = clave(pista, cat), local = leerLocal(), anterior = local[k]?.ms || 0;
      const mejoraLocal = !anterior || ms < anterior;
      if (mejoraLocal) { local[k] = { ms, cuando: Date.now() }; guardarLocal(local); }
      let nube = 'sin sesión';
      if (almacen && uid) {
        try {
          const mio = await almacen.mio(k, uid);
          if (mio && mio.ms <= ms) nube = 'no mejora';
          else { await almacen.guardar(k, uid, { uid, nombre: String(nombre || 'Piloto').slice(0, 20), ms, pista: pista.toString(16), cat, personaje, kart, version: 1 }); nube = 'subido'; }
        } catch (e) { nube = 'error: ' + (e.code || e.message); }
      }
      return { ms, mejoraLocal, anterior, nube };
    },
    // la tabla: los n mejores (de la nube; sin nube, solo el local)
    async tabla(pista, cat, n = 10) {
      const k = clave(pista, cat);
      if (!almacen) { const m = leerLocal()[k]; return m ? [{ nombre: nombre || 'Tú', ms: m.ms, uid, tuyo: true }] : []; }
      const filas = await almacen.top(k, n);
      return filas.map(f => ({ ...f, tuyo: f.uid === uid }));
    },
  };
}

// El almacén de verdad: Realtime Database (la base que ya usa el sitio), en mkw/records/{pista}-{cat}/{uid}.
// rtdb = las funciones de firebase/database que trae el sitio { ref, get, set, query, orderByChild, limitToFirst,
// serverTimestamp }; db = getDatabase(app). Las reglas: docs/firebase-mkw.md §4.
export function almacenRtdb({ rtdb, db }) {
  const ref = (k, uid) => rtdb.ref(db, `mkw/records/${k}/${uid}`);
  return {
    async mio(k, uid) { const s = await rtdb.get(ref(k, uid)); return s.exists() ? s.val() : null; },
    async guardar(k, uid, dato) { await rtdb.set(ref(k, uid), { ...dato, at: rtdb.serverTimestamp() }); },
    async top(k, n) {
      const s = await rtdb.get(rtdb.query(rtdb.ref(db, `mkw/records/${k}`), rtdb.orderByChild('ms'), rtdb.limitToFirst(n)));
      const filas = []; s.forEach(h => { filas.push(h.val()); });
      return filas;
    },
  };
}
