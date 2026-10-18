// VR y BR de cada jugador (el puntaje en línea): se guardan en Firebase para que sigan ahí en cualquier aparato — §59.
//
// Resumen: Retro Rewind calcula el VR él mismo (en cada consola, al terminar una carrera en línea) y lo guarda en su
// archivo RRRating.pul. Además habla con el servidor de dos maneras (lo vimos en su código traducido, §59):
//   1. INFORMA: después de cada carrera manda por GPCM  \wl:report\\wl:mkw_vrbr\vr=5123|br=5000\final\
//   2. PREGUNTA: al entrar en línea pide  GET /api/mkw_rr_ratings?pid=<perfil>  y espera un JSON
//      {"found": 1, "vr": 5123, "br": 5000}. OJO: "found" es un NÚMERO (su lector de JSON lee "found" con la misma
//      función que los números: con true no lo toma). El juego divide el VR por 100 y lo guarda así en RRRating.pul
//      (5123 VR → 51,23). Con "found": 0 (o sin respuesta) se queda con el de su archivo.
// Nosotros:
//   - la página de cada jugador ESCUCHA lo que su juego informa (1) en su propia pila de red y lo guarda: aquí
//     (localStorage) y en Firebase, mkw/vr/{uid} de Realtime Database (solo la persona escribe el suyo:
//     docs/firebase-mkw.md §5);
//   - al entrar, la página lee su VR de Firebase y se lo PRESENTA al WFC de la sala con un paquetito UDP propio
//     (puerto 27999 del WFC, ver wfc.mjs) que se repite hasta que el WFC contesta "ok". Así, cuando su juego pregunta
//     (2), el WFC contesta con el VR de Firebase: el VR sigue a la cuenta, no al navegador.
// Como un medidor con memoria en la nube: la consola mide, la página anota la lectura, y en otro aparato la lectura
// anotada se vuelve a cargar antes de empezar.
//
// Firebase entra por un "almacén" de tres funciones (mio, guardar, top), igual que records.mjs; el banco usa uno falso.
//
// Uso:  const vr = crearVr({ almacen, uid, nombre });  await vr.cargar();  … vr.informar({ vr: 5123, br: 5000 })

export const PUERTO_VR = 27999;                 // el "buzón" del WFC para que cada página le presente su VR
export const VR_INICIAL = 5000;                 // el VR y BR con que empieza todo el mundo en Retro Rewind
const MAXIMO = 1000000;                         // tope de sensatez (las reglas de Firebase exigen lo mismo)

// "…\wl:mkw_vrbr\vr=5123|br=5000\final\" → { vr: 5123, br: 5000 } (o null si el texto no lo trae)
export function extraerVrbr(texto) {
  const m = /\\wl:mkw_vrbr\\vr=(\d+)\|br=(\d+)/.exec(texto);
  return m ? { vr: +m[1], br: +m[2] } : null;
}

// un VR o BR razonable: entero entre 1 y el tope
export const valido = n => Number.isInteger(n) && n >= 1 && n <= MAXIMO;

// la respuesta para /api/mkw_rr_ratings; sin dato → found: 0 (el juego usa el de su archivo)
export function respuestaRatings(rec) {
  if (!rec || !valido(rec.vr) || !valido(rec.br)) return { found: 0 };
  return { found: 1, vr: rec.vr, br: rec.br };
}

export function crearVr({ almacen = null, uid = '', nombre = '', recuerdo = globalThis.localStorage } = {}) {
  const leerLocal = () => { try { return JSON.parse(recuerdo.getItem('mkw.vr')) || null; } catch { return null; } };
  const guardarLocal = r => { try { recuerdo.setItem('mkw.vr', JSON.stringify(r)); } catch {} };
  let actual = leerLocal();                     // { vr, br, cuando } o null (nunca jugó en línea en este navegador)
  const oyentes = new Set();
  const avisar = () => { for (const f of oyentes) try { f(actual); } catch {} };
  return {
    get actual() { return actual; },
    get conNube() { return !!(almacen && uid); },
    conectar(o) { ({ almacen, uid, nombre } = { almacen, uid, nombre, ...o }); },
    alCambiar(f) { oyentes.add(f); return () => oyentes.delete(f); },
    // al entrar: lo de la nube manda (es lo de la cuenta); sin nube, lo de este navegador. → { vr, br } o null
    async cargar() {
      if (almacen && uid) {
        try {
          const n = await almacen.mio(uid);
          if (n && valido(n.vr) && valido(n.br)) { actual = { vr: n.vr, br: n.br, cuando: Date.now() }; guardarLocal(actual); avisar(); return actual; }
          // nada en la nube pero sí aquí (jugó antes de iniciar sesión): subirlo
          if (actual && !n) await almacen.guardar(uid, { uid, nombre: String(nombre || 'Piloto').slice(0, 20), vr: actual.vr, br: actual.br, version: 1 });
        } catch (e) { console.warn('[vr] no pude leer la nube:', e.code || e.message); }
      }
      return actual;
    },
    // el juego informó un VR nuevo → { cambio, nube: 'subido'|'igual'|'sin sesión'|'error: …'|'no válido' }
    async informar({ vr, br }) {
      if (!valido(vr) || !valido(br)) return { cambio: false, nube: 'no válido' };
      const cambio = !actual || actual.vr !== vr || actual.br !== br;
      if (!cambio) return { cambio, nube: 'igual' };
      const antes = actual;
      actual = { vr, br, cuando: Date.now() }; guardarLocal(actual); avisar();
      let nube = 'sin sesión';
      if (almacen && uid) {
        try { await almacen.guardar(uid, { uid, nombre: String(nombre || 'Piloto').slice(0, 20), vr, br, version: 1 }); nube = 'subido'; }
        catch (e) { nube = 'error: ' + (e.code || e.message); }
      }
      return { cambio, antes, nube };
    },
    // la tabla de los n mejores VR (de la nube; sin nube, solo el propio)
    async tabla(n = 10) {
      if (!almacen) return actual ? [{ nombre: nombre || 'Tú', vr: actual.vr, br: actual.br, uid, tuyo: true }] : [];
      return (await almacen.top(n)).map(f => ({ ...f, tuyo: f.uid === uid }));
    },
  };
}

// Presentarle el VR al WFC de la sala: un paquete UDP {"vr":…,"br":…} al puerto PUERTO_VR de 10.77.0.1, repetido
// cada `cadaMs` hasta que el WFC conteste "ok" (UDP se puede perder; y el WFC puede no estar todavía). Si el VR cambia,
// se vuelve a presentar. → { presentar(rec), detener(), presentado }
export function presentarVr({ pila, wfcIp = '10.77.0.1', cadaMs = 2000 }) {
  let rec = null, presentado = false, reloj = 0, socket = null;
  const tx = new TextEncoder(), rx = new TextDecoder();
  const mandar = () => { if (rec && !presentado) socket.enviar(tx.encode(JSON.stringify(rec)), wfcIp, PUERTO_VR); };
  socket = pila.udp(0, d => { if (rx.decode(d) === 'ok') { presentado = true; clearInterval(reloj); reloj = 0; } });
  return {
    presentar(r) {
      if (!r || !valido(r.vr) || !valido(r.br)) return;
      rec = { vr: r.vr, br: r.br }; presentado = false;
      mandar(); if (!reloj) reloj = setInterval(mandar, cadaMs);
    },
    detener() { clearInterval(reloj); reloj = 0; socket.cerrar(); },
    get presentado() { return presentado; },
  };
}

// El almacén de verdad: Realtime Database (la base que ya usa el sitio para las salas y los logros), en mkw/vr/{uid}.
// rtdb = las funciones de firebase/database que trae el sitio { ref, get, set, query, orderByChild, limitToLast,
// serverTimestamp }; db = getDatabase(app). Las reglas: docs/firebase-mkw.md §5.
export function almacenRtdbVr({ rtdb, db }) {
  const ref = uid => rtdb.ref(db, `mkw/vr/${uid}`);
  return {
    async mio(uid) { const s = await rtdb.get(ref(uid)); return s.exists() ? s.val() : null; },
    async guardar(uid, dato) { await rtdb.set(ref(uid), { ...dato, at: rtdb.serverTimestamp() }); },
    async top(n) {
      const s = await rtdb.get(rtdb.query(rtdb.ref(db, 'mkw/vr'), rtdb.orderByChild('vr'), rtdb.limitToLast(n)));
      const filas = []; s.forEach(h => { filas.push(h.val()); });
      return filas.reverse();                     // limitToLast trae de menor a mayor: el mejor primero
    },
  };
}
