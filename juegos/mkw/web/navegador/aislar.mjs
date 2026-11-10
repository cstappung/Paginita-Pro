// Paso 8 (P9, bitácora §187): las cabeceras que dejan una página aislada en su propio proceso, con memoria compartida.
// Las usan servidor.mjs (?aislar=… o MKW_AISLAR) y herramientas/worker-local.mjs; el banco `trabajador` las prueba.
//   'dip'      → Document-Isolation-Policy: isolate-and-require-corp. Aísla SOLO este documento (también dentro de un
//                marco): el sitio de afuera (Juegos en GitHub Pages, con su inicio de sesión de Firebase) no cambia.
//                Chrome 137 en el computador; en Android, por ver (banco aislamiento, H5).
//   'dip-cred' → lo mismo con «credentialless» (lo de otro origen llega sin cookies en vez de exigir CORP).
//   'coop'     → COOP + COEP, la manera vieja: solo sirve si la página es la de arriba (en un marco no alcanza).
//   otro       → nada (como siempre).
// Comparación eléctrica: es como pasar un circuito a su propio tablero con su propio interruptor general: lo que salte
// en el tablero del sitio ya no corta el del juego, y adentro se puede repartir la carga en varias fases (los núcleos).
export function cabecerasAislar(valor) {
  if (valor === 'dip') return { 'Document-Isolation-Policy': 'isolate-and-require-corp' };
  if (valor === 'dip-cred') return { 'Document-Isolation-Policy': 'isolate-and-credentialless' };
  if (valor === 'coop') return { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
  return {};
}
// Para un script de Worker (o lo que cargue) dentro de una página con COEP: sin COEP propio, Chrome no arranca el Worker
export function cabecerasScriptAislado(valor) {
  return valor === 'coop' ? { 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Resource-Policy': 'same-origin' } : {};
}
// H5 (§208): lo que dice este navegador sobre los hilos, para el informe de rendimiento: si la página quedó aislada
// (crossOriginIsolated), si hay memoria compartida de verdad (SharedArrayBuffer + Atomics, y aislada: sin aislar Chrome no
// deja mandarla a un Worker), la versión de Chrome y si es Android. Así el informe de un teléfono de verdad contesta solo
// la pregunta de H5 (¿Document-Isolation-Policy anda en Android 146?) el día que se sirva con la cabecera.
// g = el objeto global (window o self); se pasa para poder probarlo en el banco con uno de mentira.
export function estadoHilos(g = globalThis) {
  const ua = g.navigator?.userAgent || '';
  const chrome = Number((/Chrome\/(\d+)/.exec(ua) || [])[1]) || null;
  const aislada = g.crossOriginIsolated === true;
  return {
    aislada,
    memoriaCompartida: aislada && typeof g.SharedArrayBuffer === 'function' && typeof g.Atomics === 'object',
    chrome, android: /Android/.test(ua),
    // (DIP: Chrome 137 en el computador, 146 en Android según blink-dev; el plan B de las cajas anda siempre)
    dipEsperable: chrome !== null && chrome >= (/Android/.test(ua) ? 146 : 137),
  };
}
// Dónde corre el juego en trabajador.html: ?hilo=principal = en la página (como hoy); lo demás = en un Worker
export const hiloDe = parametros => (parametros.get('hilo') === 'principal' ? 'principal' : 'trabajador');
