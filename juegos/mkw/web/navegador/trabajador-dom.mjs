// Paso 8 (N3/P10, bitácora §186): un «DOM de mentira» para correr el juego dentro de un Worker.
//
// El programa del juego (mkw.js, el pegamento de Emscripten + SDL3 + emdawnwebgpu) se compiló para una página: al
// cargar arma `specialHTMLTargets = [0, document, window]`, SDL3 escucha teclas y ratón en `window`/`document`, mide el
// lienzo con getBoundingClientRect y le cambia `style`, y aurora pide el lienzo con document.querySelector('#canvas').
// En un Worker no hay `document` ni `window`. Esto pone lo justo para que ese código no se caiga, sin recompilar:
//   - `window` = el propio Worker (self): addEventListener/dispatchEvent ya existen ahí (es un EventTarget);
//   - `document` = un objeto con lo que el pegamento toca (querySelector, getElementById, body, visibilidad…);
//   - el lienzo = un OffscreenCanvas (el de la página, transferido) con lo que le falta a uno de verdad: style,
//     getBoundingClientRect (el recuadro que la página le dice), clientWidth/Height, focus…
// Comparación eléctrica: es una carga ficticia en los bornes que el equipo espera ver conectados (el equipo «cree»
// que hay pantalla y teclado), mientras la señal de verdad llega por otro cable (los mensajes de la página).
//
// Nada de esto lee ni escribe la memoria del juego. Los teclados y mandos NO llegan por aquí: la página los lee y los
// manda como un mando de GameCube (mkw_web_pad), como siempre.

// instalarDom({ lienzo, ancho, alto, dpr, global }) → { tam(ancho, alto, dpr), visible(oculto), documento, ventana }
//   lienzo: el OffscreenCanvas; ancho/alto: su recuadro en la página (px CSS); dpr: devicePixelRatio de la página.
//   global: dónde se instalan window/document (por omisión globalThis; el banco pasa un objeto propio).
export function instalarDom({ lienzo, ancho = 1280, alto = 720, dpr = 1, global = globalThis } = {}) {
  const caja = { ancho, alto, dpr, oculto: false };
  const nada = () => {};
  const estilo = () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : ''), set: (o, k, v) => { o[k] = v; return true; } });
  // un elemento de mentira (para lo que SDL3 crea o busca y no es el lienzo: el cuerpo, un <div> de texto…)
  const elemento = (etiqueta = 'div') => ({
    tagName: etiqueta.toUpperCase(), style: estilo(), children: [], childNodes: [],
    addEventListener: nada, removeEventListener: nada, appendChild(h) { this.children.push(h); return h; },
    removeChild(h) { this.children = this.children.filter(x => x !== h); return h; }, insertBefore(h) { return h; },
    setAttribute: nada, getAttribute: () => null, removeAttribute: nada, focus: nada, blur: nada, click: nada,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: caja.ancho, bottom: caja.alto, width: caja.ancho, height: caja.alto, x: 0, y: 0 }),
    classList: { add: nada, remove: nada, contains: () => false, toggle: nada },
    get clientWidth() { return caja.ancho; }, get clientHeight() { return caja.alto; },
  });

  // El lienzo: lo que el pegamento le pide a un <canvas> y un OffscreenCanvas no tiene
  if (lienzo) {
    const extra = {
      id: 'canvas', style: estilo(), tagName: 'CANVAS', nodeName: 'CANVAS', parentNode: null,
      getBoundingClientRect: () => ({ left: 0, top: 0, right: caja.ancho, bottom: caja.alto, width: caja.ancho, height: caja.alto, x: 0, y: 0 }),
      focus: nada, blur: nada, setAttribute: nada, getAttribute: () => null, removeAttribute: nada,
      requestPointerLock: nada, requestFullscreen: () => Promise.reject(new Error('sin pantalla completa en el Worker')),
      classList: { add: nada, remove: nada, contains: () => false, toggle: nada },
    };
    for (const [k, v] of Object.entries(extra)) if (!(k in lienzo)) Object.defineProperty(lienzo, k, { value: v, writable: true, configurable: true });
    for (const [k, f] of [['clientWidth', () => caja.ancho], ['clientHeight', () => caja.alto], ['offsetWidth', () => caja.ancho], ['offsetHeight', () => caja.alto]])
      if (!(k in lienzo)) Object.defineProperty(lienzo, k, { get: f, configurable: true });
  }

  const cuerpo = elemento('body');
  const documento = {
    nodeType: 9, body: cuerpo, head: elemento('head'), documentElement: elemento('html'), title: 'MKW',
    get hidden() { return caja.oculto; }, get visibilityState() { return caja.oculto ? 'hidden' : 'visible'; },
    activeElement: lienzo || cuerpo, fullscreenElement: null, fullscreenEnabled: false, webkitFullscreenElement: null,
    webkitFullscreenEnabled: false, pointerLockElement: null,
    hasFocus: () => !caja.oculto,
    exitFullscreen: () => Promise.resolve(), exitPointerLock: nada,
    // los oyentes de `document` (SDL3: teclas, visibilidad, pantalla completa) van al Worker mismo: la página reenvía
    // la visibilidad como un evento 'visibilitychange' (guardado.mjs y pipelines.mjs lo escuchan para guardar ya)
    addEventListener: (...a) => global.addEventListener?.(...a), removeEventListener: (...a) => global.removeEventListener?.(...a),
    createElement: etiqueta => (etiqueta === 'canvas' && typeof OffscreenCanvas !== 'undefined' ? Object.assign(new OffscreenCanvas(1, 1), { style: estilo() }) : elemento(etiqueta)),
    getElementById: id => (id === 'canvas' ? lienzo : null),
    querySelector: s => (s === '#canvas' || s === 'canvas' ? lienzo : s === 'body' ? cuerpo : null),
    querySelectorAll: s => (s === '#canvas' || s === 'canvas' ? [lienzo] : []),
    sdlEventHandlerLockKeysCheck: null,
  };
  const pantalla = { get width() { return caja.ancho; }, get height() { return caja.alto; }, orientation: { type: 'landscape-primary', angle: 0, addEventListener: nada } };
  const medios = q => ({ media: q, matches: false, addEventListener: nada, removeEventListener: nada, addListener: nada, removeListener: nada });

  if (!('document' in global)) global.document = documento;
  if (!('window' in global)) global.window = global;
  const props = {
    innerWidth: () => caja.ancho, innerHeight: () => caja.alto, outerWidth: () => caja.ancho, outerHeight: () => caja.alto,
    devicePixelRatio: () => caja.dpr, screen: () => pantalla, scrollX: () => 0, scrollY: () => 0, pageXOffset: () => 0, pageYOffset: () => 0,
  };
  for (const [k, f] of Object.entries(props)) if (!(k in global)) Object.defineProperty(global, k, { get: f, configurable: true });
  for (const [k, v] of [['matchMedia', medios], ['prompt', () => null], ['alert', nada], ['open', () => null], ['focus', nada], ['orientation', 0]])
    if (!(k in global)) global[k] = v;

  return {
    documento, caja,
    // la página cambió de tamaño: el recuadro nuevo y el evento 'resize' que SDL3 escucha (agranda el lienzo)
    tam(a, h, d = caja.dpr) {
      caja.ancho = a; caja.alto = h; caja.dpr = d;
      try { global.dispatchEvent?.(new Event('resize')); } catch {}
    },
    // la pestaña se ocultó o volvió a verse
    visible(oculto) {
      if (caja.oculto === !!oculto) return;
      caja.oculto = !!oculto;
      try { global.dispatchEvent?.(new Event('visibilitychange')); } catch {}
    },
  };
}
