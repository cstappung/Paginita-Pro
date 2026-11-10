// El almacenamiento persistente (plan de rendimiento D6, bitácora §118).
// Sin «persistencia», cuando al disco le falta espacio Chrome borra el origen entero empezando por el menos usado:
// todo lo bajado del juego (cientos de MB) y las partidas. Con ella, solo lo borra la persona a mano.
// Chrome no pregunta nada: concede o niega según cuánto se usa el sitio (marcadores, visitas, rato jugando). Por eso
// pedirlo una sola vez al abrir (lo de antes) casi siempre da «no» la primera vez: aquí se vuelve a pedir al terminar
// cada carrera (como mucho cada 5 min), hasta que lo concede. Pedirlo no cuesta nada ni muestra carteles.
//
//   const p = crearPersistencia();          // opciones: storage (navigator.storage), almacen (localStorage), ahora()
//   await p.pedir('arranque');              // → true/false (persistido o no)
//   await p.pedir('carrera');               // lo mismo, salvo que ya se pidió hace menos de ESPACIO_MS
//   p.estado                                // { persistido, intentos, ultimo, motivo, usado, cuota, soporta }
//   textoPersistencia(p.estado)             // «protegido · 1,2 GB» para el panel «Partida»

export const ESPACIO_MS = 5 * 60 * 1000;     // entre dos pedidos que no sean al arrancar
const CLAVE = 'mkw.persistencia';            // { intentos, concedido } en este navegador (para el informe)

export function crearPersistencia({ storage = globalThis.navigator?.storage, almacen = globalThis.localStorage, ahora = () => Date.now() } = {}) {
  const soporta = !!(storage && storage.persist && storage.persisted);
  let guardado = {};
  try { guardado = JSON.parse(almacen?.getItem(CLAVE) || '{}') || {}; } catch {}
  const estado = { soporta, persistido: null, intentos: guardado.intentos || 0, concedido: guardado.concedido || 0,
                   ultimo: 0, motivo: '', usado: null, cuota: null };
  const anotar = () => { try { almacen?.setItem(CLAVE, JSON.stringify({ intentos: estado.intentos, concedido: estado.concedido })); } catch {} };

  // Mira sin pedir: ¿ya está persistido?, ¿cuánto ocupa el origen?
  async function revisar() {
    if (!soporta) return false;
    try { estado.persistido = await storage.persisted(); } catch { estado.persistido = false; }
    try { if (storage.estimate) { const e = await storage.estimate(); estado.usado = e.usage ?? null; estado.cuota = e.quota ?? null; } } catch {}
    return estado.persistido;
  }

  // Pide (si hace falta). 'arranque' siempre pide; lo demás, como mucho una vez cada ESPACIO_MS.
  async function pedir(motivo = 'arranque') {
    if (!soporta) return false;
    if (await revisar()) return true;                          // ya concedido: nada que pedir
    if (motivo !== 'arranque' && estado.ultimo && ahora() - estado.ultimo < ESPACIO_MS) return false;
    estado.ultimo = ahora(); estado.motivo = motivo; estado.intentos++;
    let si = false;
    try { si = await storage.persist(); } catch {}
    estado.persistido = !!si;
    if (si && !estado.concedido) estado.concedido = estado.intentos;   // en qué intento lo dio (para saber si sirve insistir)
    anotar();
    await revisar();
    return estado.persistido;
  }

  return { estado, revisar, pedir };
}

const tam = b => b >= 1e9 ? `${(b / 1e9).toFixed(1).replace('.', ',')} GB` : `${Math.round(b / 1e6)} MB`;
// Una línea para el panel «Partida»
export function textoPersistencia(e) {
  if (!e.soporta) return 'este navegador no deja proteger lo guardado';
  const uso = e.usado != null ? ` · ${tam(e.usado)} usados` : '';
  if (e.persistido) return `guardado protegido: el navegador no lo borra solo${uso}`;
  if (e.persistido === null) return `revisando si lo guardado está protegido…${uso}`;
  return `guardado sin proteger todavía (con el disco lleno el navegador podría borrarlo; se vuelve a pedir al terminar cada carrera)${uso}`;
}
