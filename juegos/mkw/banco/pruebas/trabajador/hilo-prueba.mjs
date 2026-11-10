// Paso 8 (bitácora §186): el Worker del banco `trabajador`. Instala el DOM de mentira sobre el OffscreenCanvas que le
// pasa la página y hace lo mismo que el pegamento del juego: buscar el lienzo con '#canvas', medirlo, pedirle un
// contexto webgpu y dibujar (limpiar de verde), escuchar 'resize' y 'visibilitychange'. Sin nada del juego.
import { instalarDom } from '/web/navegador/trabajador-dom.mjs';
import { puenteSonido } from '/web/navegador/trabajador-sonido.mjs';

let dom = null, eventos = { resize: 0, visibilidad: 0 }, sonido = null;
onmessage = async e => {
  const m = e.data;
  if (m.t === 'iniciar') {
    dom = instalarDom({ lienzo: m.lienzo, ancho: 320, alto: 180, dpr: 2 });
    addEventListener('resize', () => eventos.resize++);
    document.addEventListener('visibilitychange', () => eventos.visibilidad++);
    // lo que hace emscripten: specialHTMLTargets = [0, document, window]; findEventTarget('#canvas')
    const especiales = [0, document, window];
    const lienzo = especiales['#canvas'] || document.querySelector('#canvas');
    const r = { mismo: lienzo === m.lienzo, rect: lienzo.getBoundingClientRect(), estilo: (lienzo.style.width = '10px', lienzo.style.width),
                ancho: innerWidth, dpr: devicePixelRatio, oculto: document.hidden, cuerpo: !!document.body.appendChild(document.createElement('div')),
                medios: matchMedia('(pointer: coarse)').matches, jspi: 'Suspending' in WebAssembly, webgpu: false };
    try {
      const a = await navigator.gpu?.requestAdapter(), d = a && await a.requestDevice();
      if (d) {
        const ctx = lienzo.getContext('webgpu');
        ctx.configure({ device: d, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'opaque' });
        const enc = d.createCommandEncoder();
        enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 1, b: 0, a: 1 } }] }).end();
        d.queue.submit([enc.finish()]);
        await d.queue.onSubmittedWorkDone();
        r.webgpu = true;
      }
    } catch (x) { r.gpuError = String(x); }
    postMessage({ t: 'iniciado', r });
  } else if (m.t === 'tam') { dom.tam(m.ancho, m.alto); postMessage({ t: 'tam', ancho: innerWidth, alto: innerHeight, rect: document.querySelector('#canvas').getBoundingClientRect(), eventos }); }
  else if (m.t === 'visible') { dom.visible(m.oculto); postMessage({ t: 'visible', oculto: document.hidden, estado: document.visibilityState, eventos }); }
  else if (m.t === 'sonido') { sonido = puenteSonido(m.sonido); sonido.corriendo = true; postMessage({ t: 'sonido', tasa: sonido.abrir() }); }
  else if (m.t === 'entregar') {
    // n entregas de 128 muestras estéreo (como el runtime: una vista de la memoria; el puente la copia)
    const memoria = new Float32Array(4096);
    for (let i = 0; i < m.n; i++) { memoria.fill(0.1 * (i % 3), 0, 256); sonido.entregar(memoria.subarray(0, 256)); }
    setTimeout(() => postMessage({ t: 'entregado', estado: sonido.estado, nivel: sonido.nivelMs(), objetivo: sonido.objetivoMs() }), m.esperaMs || 300);
  } else if (m.t === 'pad') postMessage({ t: 'pad', id: m.id, t0: m.t0 });
};
