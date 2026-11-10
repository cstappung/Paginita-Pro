// Paso 8 (P9/H5, bitácora §187–§188): lo que se prueba DENTRO de un Worker (el lugar donde correría el juego).
// Mensajes: { t: 'probar' } → { t: 'sonda', … }; { t: 'sab', sab } → escribe 42 en la memoria compartida, avisa con
// Atomics.notify y contesta; { t: 'eco', b } → devuelve el búfer transferido (el plan B: «pasarse cajas»);
// { t: 'girar', n } → n vueltas de cálculo (para ver si de verdad corren a la vez en núcleos distintos).
import { probarJspi } from './jspi.mjs';

async function probar() {
  const r = { jspi: false, gpu: !!self.navigator?.gpu, adaptador: '', offscreenWebgpu: false, nucleos: navigator.hardwareConcurrency || 0,
              memoria: navigator.deviceMemory || 0, aislado: !!self.crossOriginIsolated, sab: typeof SharedArrayBuffer === 'function', atomicsWait: false };
  try { r.jspi = await probarJspi(); } catch (e) { r.jspiError = String(e); }
  try {
    const a = await navigator.gpu?.requestAdapter();
    if (a) { r.adaptador = (a.info && (a.info.description || a.info.vendor + ' ' + a.info.architecture)) || 'sí'; }
    if (a && typeof OffscreenCanvas === 'function') {
      const d = await a.requestDevice();
      const c = new OffscreenCanvas(64, 64), ctx = c.getContext('webgpu');
      if (ctx) { ctx.configure({ device: d, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'opaque' }); r.offscreenWebgpu = !!ctx.getCurrentTexture(); }
      d.destroy?.();
    }
  } catch (e) { r.gpuError = String(e); }
  if (r.sab) try { const s = new Int32Array(new SharedArrayBuffer(8)); r.atomicsWait = Atomics.wait(s, 0, 0, 1) === 'timed-out'; } catch (e) { r.atomicsError = String(e); }
  return r;
}

let x = 1;
onmessage = async e => {
  const m = e.data;
  if (m.t === 'probar') postMessage({ t: 'sonda', ...(await probar()) });
  else if (m.t === 'sab') { const s = new Int32Array(m.sab); Atomics.store(s, 0, 42); Atomics.notify(s, 0); postMessage({ t: 'sab', ok: true }); }
  else if (m.t === 'eco') postMessage({ t: 'eco', b: m.b }, [m.b]);
  else if (m.t === 'girar') {
    const t0 = performance.now();
    for (let i = 0; i < m.n; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; }
    postMessage({ t: 'girar', ms: performance.now() - t0, x });
  }
};
