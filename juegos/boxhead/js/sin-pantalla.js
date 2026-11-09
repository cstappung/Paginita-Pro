/* Pro BoxHead sin pantalla: lo que necesita `juego.js` para correr donde no
   hay DOM (el trabajador del verificador del Club, `verificador.js`, y Node
   en los tests y en `scripts/auditar-club.cjs`), para rehacer una partida
   grabada con `__boxhead.rehace(prueba)`.

   El juego toca el DOM, el canvas, el audio y el mando por todos lados, pero
   nada de eso decide la partida. Aquí todo eso es un mismo objeto «comodín»
   que acepta cualquier propiedad, llamada o asignación y no hace nada; la
   simulación queda igual. Lo único real: `localStorage` vacío (el juego lee
   opciones de ahí y compara con null) y que el bucle de cuadros nunca
   arranca (`requestAnimationFrame` no hace nada): la partida la avanza
   `rehace`, paso a paso.

   Se carga ANTES que `datos.js` y `juego.js`. */
(function (raiz) {
  'use strict';
  function comodin() {
    const f = function () {};
    const p = new Proxy(f, {
      get: (t, k) => {
        if (k === Symbol.toPrimitive) return h => (h === 'string' ? '' : 0);
        if (k === Symbol.iterator) return function* () {};
        if (k === 'then') return undefined;           // que no parezca una promesa
        return p;
      },
      set: () => true,
      apply: () => p,
      construct: () => p,
      deleteProperty: () => true,
    });
    return p;
  }
  const nada = () => {};
  const c = comodin();
  const pon = (k, v) => { try { raiz[k] = v; } catch (e) { /* propiedad de solo lectura del entorno */ } };
  pon('window', raiz);
  pon('document', c);
  pon('localStorage', { getItem: () => null, setItem: nada, removeItem: nada });
  pon('matchMedia', () => ({ matches: false, addEventListener: nada }));
  pon('requestAnimationFrame', nada);
  pon('setInterval', () => 0);
  pon('setTimeout', () => 0);
  pon('clearTimeout', nada);
  if (typeof raiz.addEventListener !== 'function') pon('addEventListener', nada);
  if (!raiz.location) pon('location', { search: '', href: '' });
  if (!raiz.performance) pon('performance', { now: () => 0 });
  raiz.BoxheadGrafico = c;                            // los dibujos y efectos
  raiz.BoxheadAudio = { crear: () => c };             // los sonidos y la música
  raiz.Mando = undefined;
  raiz.__boxheadSinPantalla = true;
})(typeof self !== 'undefined' ? self : globalThis);
