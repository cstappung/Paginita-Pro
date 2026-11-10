// El censo de las llamadas a WebGPU — bitácora §224 (W22 de la etapa E4b del plan de rendimiento v4).
//
// Resumen: en la gama baja el dibujo cuesta ~10 de ~20 ms por cuadro y los modelos son solo 0,6–0,7 ms (§222): ~9 ms
// son «el esqueleto del cuadro». La sospecha de W22 es que buena parte son las órdenes que aurora le manda a WebGPU
// (cada una cruza wasm → JavaScript → Chrome) y que se repiten casi iguales cuadro a cuadro: si fuera así, el «dibujo
// retenido» (render bundles: grabar las órdenes una vez y repetirlas con una sola llamada) las ahorraría. Antes de
// construir nada, este módulo MIDE, sin cambiar lo que el juego dibuja, en tres fases seguidas dentro de la carrera:
//   1. TIEMPO (sin contar nada): cuánto tarda, por imagen, desde la primera orden de codificar (createCommandEncoder)
//      hasta el último envío (queue.submit) — la ráfaga en que aurora pasa su lista de órdenes a WebGPU.
//   2. CONTEO: cuántas llamadas de CADA método de las clases de WebGPU hay por imagen (todas, no solo las de dibujo).
//   3. GRABACIÓN (pocas imágenes): cada orden de cada pasada con sus objetos y números, para ver cuántas son
//      exactamente iguales a la del cuadro anterior en el mismo lugar, cuántas cambian solo el desplazamiento del
//      búfer de constantes (setBindGroup con desplazamiento dinámico) y cuántas cambian de verdad.
//   Al final, el ENSAYO: la última imagen grabada se vuelve a codificar muchas veces (sin enviarla a la tarjeta, con
//   una textura de descarte en lugar del lienzo) para medir el costo puro de sus llamadas, y otra vez en variantes:
//   sin las llamadas de constantes (lo que ahorraría poner las constantes en un búfer indexado) y como render bundles
//   ya grabados (lo que costaría repetirlas retenidas). Así se sabe cuántos ms del esqueleto SON llamadas y cuánto
//   bajarían.
// Comparación eléctrica: antes de cambiar el cableado de un tablero, se pone un analizador en cada circuito para ver
// cuánta corriente se va en cada uno; si casi toda se va en las pérdidas de los conectores (las llamadas), vale la pena
// rehacer el cableado (retenerlo); si no, no.
//
// Uso (la página, mkw.mjs, con ?censoGpu=1): instalarCensoGpu({ empezar: () => bool, cuadros: () => imágenes })
//   → { estado, resultado } (resultado = null hasta terminar). Las envolturas se ponen solo en cada fase y se sacan al
//   terminar: fuera de las fases los métodos del navegador quedan los originales. Es un instrumento: solo para medir.

const CLASES = ['GPUDevice', 'GPUQueue', 'GPUCommandEncoder', 'GPURenderPassEncoder', 'GPUComputePassEncoder',
  'GPURenderBundleEncoder', 'GPUBuffer', 'GPUTexture', 'GPUCanvasContext'];
// las órdenes de una pasada que un render bundle puede llevar (las demás —viewport, tijera, color de mezcla,
// referencia de stencil— quedan en la pasada y cortan el bundle)
const EN_BUNDLE = new Set(['setPipeline', 'setBindGroup', 'setVertexBuffer', 'setIndexBuffer', 'draw', 'drawIndexed',
  'drawIndirect', 'drawIndexedIndirect']);

export function instalarCensoGpu({ raiz = globalThis, empezar, cuadros, imagenesTiempo = 240, imagenesConteo = 120,
  imagenesGrabadas = 4, repeticiones = 40, alTerminar = null } = {}) {
  const ahora = () => raiz.performance.now();
  const estado = { fase: 'esperando', fallo: null };
  const r = { resultado: null, estado };
  const puestos = [];
  const sacarTodo = () => { for (const x of puestos.splice(0)) if (x.pr[x.n] === x.nuevo) x.pr[x.n] = x.original; };
  const poner = (clase, n, hacer) => {
    const pr = raiz[clase]?.prototype;
    if (!pr) return;
    const d = Object.getOwnPropertyDescriptor(pr, n);
    if (!d || typeof d.value !== 'function') return;
    const original = d.value, nuevo = hacer(original, `${clase}.${n}`);
    puestos.push({ pr, n, original, nuevo });
    pr[n] = nuevo;
  };
  const nombres = (clase) => { const pr = raiz[clase]?.prototype; return pr ? Object.getOwnPropertyNames(pr).filter(n => n !== 'constructor' &&
    typeof Object.getOwnPropertyDescriptor(pr, n)?.value === 'function') : []; };

  // ---- fase 1: el tiempo de la ráfaga (solo tres envolturas, las mínimas) ----
  let imagen = 0, t0 = null, tUlt = null, enviosImagen = 0;
  const rafagas = [], envios = [];
  function faseTiempo() {
    estado.fase = 'tiempo';
    const cerrar = () => { if (t0 != null && tUlt != null) { rafagas.push(tUlt - t0); envios.push(enviosImagen); } t0 = tUlt = null; enviosImagen = 0; };
    poner('GPUCanvasContext', 'getCurrentTexture', (o) => function () { cerrar(); imagen++; return o.call(this); });
    poner('GPUDevice', 'createCommandEncoder', (o) => function (a) { if (t0 == null) t0 = ahora(); return arguments.length ? o.call(this, a) : o.call(this); });
    poner('GPUQueue', 'submit', (o) => function (a) { const x = o.call(this, a); tUlt = ahora(); enviosImagen++; return x; });
    const i0 = imagen;
    const mirar = setInterval(() => {
      if (imagen - i0 < imagenesTiempo) return;
      clearInterval(mirar); sacarTodo(); faseConteo();
    }, 20);
  }

  // ---- fase 2: el conteo de todos los métodos ----
  const conteo = new Map();
  let imagenesContadas = 0;
  function faseConteo() {
    estado.fase = 'conteo';
    for (const c of CLASES) for (const n of nombres(c)) {
      if (c === 'GPUCanvasContext' && n === 'getCurrentTexture') continue;
      poner(c, n, (o, clave) => function (a, b, c2, d, e, f) {
        conteo.set(clave, (conteo.get(clave) || 0) + 1);
        return o.apply(this, arguments);
      });
    }
    let i0 = null;
    poner('GPUCanvasContext', 'getCurrentTexture', (o) => function () { imagenesContadas = i0 == null ? 0 : imagenesContadas + 1; if (i0 == null) { i0 = 0; conteo.clear(); } return o.call(this); });
    const mirar = setInterval(() => {
      if (imagenesContadas < imagenesConteo) return;
      clearInterval(mirar); sacarTodo(); faseGrabar();
    }, 20);
  }

  // ---- fase 3: la grabación de las órdenes de unas pocas imágenes ----
  const ids = new WeakMap(); let proximoId = 1;
  const id = (o) => { if (o == null || typeof o !== 'object') return String(o); let v = ids.get(o); if (!v) { v = proximoId++; ids.set(o, v); } return '#' + v; };
  const texturaDeVista = new WeakMap(), lienzos = new WeakSet();
  const grabadas = [];        // por imagen: { pasadas: [{ desc, ordenes: [[metodo, ...args]] }], subidas: [bytes...] }
  let grabando = null, pasadaG = null;
  const copiaArg = (x) => {
    if (x == null || typeof x !== 'object') return x;
    if (ArrayBuffer.isView(x)) return x.length <= 64 ? Array.from(x) : x;   // (una vista grande es la memoria: no se copia)
    if (Array.isArray(x)) return x.slice();
    return x;                  // objetos de WebGPU: la misma referencia (para el ensayo)
  };
  function faseGrabar() {
    estado.fase = 'grabar';
    poner('GPUTexture', 'createView', (o) => function (a) { const v = arguments.length ? o.call(this, a) : o.call(this); texturaDeVista.set(v, this); return v; });
    poner('GPUCanvasContext', 'getCurrentTexture', (o) => function () {
      if (grabando) grabadas.push(grabando);
      grabando = grabadas.length < imagenesGrabadas ? { pasadas: [], subidas: [], otras: 0 } : null;
      const t = o.call(this); lienzos.add(t); return t;
    });
    poner('GPUCommandEncoder', 'beginRenderPass', (o) => function (desc) {
      const p = o.call(this, desc);
      if (grabando) { pasadaG = { desc, ordenes: [], encoder: p }; grabando.pasadas.push(pasadaG); }
      return p;
    });
    for (const n of nombres('GPURenderPassEncoder')) {
      if (n === 'end') continue;
      poner('GPURenderPassEncoder', n, (o) => function (a, b, c, d, e) {
        if (grabando && pasadaG && pasadaG.encoder === this) try {   // (un error del censo nunca corta la llamada del juego)
          let args;
          // setBindGroup(i, g, Uint32Array, inicio, largo): el arreglo es la memoria ENTERA del programa (HEAPU32):
          // copiar solo los desplazamientos que de verdad usa (copiarla entera daba «Invalid array length» y el
          // juego se quedaba quieto, la primera corrida de §224)
          if (n === 'setBindGroup' && arguments.length === 5 && ArrayBuffer.isView(arguments[2])) args = [a, b, Array.from(c.subarray(d, d + e))];
          else { args = []; for (let i = 0; i < arguments.length; i++) args.push(copiaArg(arguments[i])); }
          pasadaG.ordenes.push([n, ...args]);
        } catch (x) { estado.fallo = estado.fallo || String(x); }
        return o.apply(this, arguments);
      });
    }
    poner('GPUQueue', 'writeBuffer', (o) => function (buf, desde, datos, dDesde, tam) {
      if (grabando) try { grabando.subidas.push(Number.isFinite(tam) ? tam * (datos?.BYTES_PER_ELEMENT || 1) : Math.max(0, (datos?.byteLength || 0) - (dDesde || 0) * (datos?.BYTES_PER_ELEMENT || 1))); } catch {}
      return o.apply(this, arguments);
    });
    poner('GPUCommandEncoder', 'beginComputePass', (o) => function () { if (grabando) grabando.otras++; return o.apply(this, arguments); });
    let dispositivo = null;
    poner('GPUDevice', 'createCommandEncoder', (o) => function () { dispositivo = this; return o.apply(this, arguments); });
    const mirar = setInterval(() => {
      if (grabadas.length < imagenesGrabadas || !dispositivo) return;
      clearInterval(mirar); sacarTodo();
      try { analizar(dispositivo); } catch (x) { estado.fallo = String(x?.stack || x); terminar(); }
    }, 20);
  }

  // ---- el análisis y el ensayo ----
  const firma = (orden) => orden.map(x => (x && typeof x === 'object' && !Array.isArray(x)) ? id(x) : Array.isArray(x) ? '[' + x.join(',') + ']' : String(x)).join('|');
  const firmaSinDesp = (orden) => orden[0] === 'setBindGroup' ? `setBindGroup|${orden[1]}|${id(orden[2])}|[…]` :
    (orden[0] === 'drawIndexed' || orden[0] === 'draw') ? orden[0] + '|' + orden.slice(1, 3).join('|') + '|…' : firma(orden);
  function comparar(a, b) {       // b contra a (la imagen anterior), pasada por pasada y orden por orden en el mismo lugar
    let iguales = 0, soloDesp = 0, distintas = 0, total = 0, pasadasIguales = 0, pasadasMismaForma = 0;
    for (let k = 0; k < b.pasadas.length; k++) {
      const pb = b.pasadas[k].ordenes, pa = a.pasadas[k]?.ordenes || [];
      let todas = pa.length === pb.length, forma = todas;
      for (let i = 0; i < pb.length; i++) {
        total++;
        const fb = firma(pb[i]), fa = pa[i] ? firma(pa[i]) : null;
        if (fa === fb) iguales++;
        else { todas = false; if (pa[i] && firmaSinDesp(pa[i]) === firmaSinDesp(pb[i])) soloDesp++; else { distintas++; forma = false; } }
      }
      if (todas) pasadasIguales++;
      if (forma) pasadasMismaForma++;
    }
    return { ordenes: total, iguales, soloDesplazamiento: soloDesp, distintas, pasadas: b.pasadas.length, pasadasIguales, pasadasMismaForma };
  }
  function tiposDe(img) {
    const t = {};
    for (const p of img.pasadas) for (const o of p.ordenes) t[o[0]] = (t[o[0]] || 0) + 1;
    return t;
  }

  function analizar(dev) {
    estado.fase = 'ensayo';
    const img = grabadas[grabadas.length - 1];
    const comparaciones = [];
    for (let k = 1; k < grabadas.length; k++) comparaciones.push(comparar(grabadas[k - 1], grabadas[k]));
    // texturas de descarte en lugar del lienzo (ya presentado: su vista no vale)
    const descartes = new Map();
    const vistaPara = (v) => {
      const t = texturaDeVista.get(v);
      if (!t || !lienzos.has(t)) return v;
      const clave = `${t.format}:${t.width}x${t.height}`;
      if (!descartes.has(clave)) descartes.set(clave, dev.createTexture({ size: [t.width, t.height], format: t.format, usage: raiz.GPUTextureUsage.RENDER_ATTACHMENT }).createView());
      return descartes.get(clave);
    };
    const descDe = (desc) => ({ ...desc, timestampWrites: undefined, occlusionQuerySet: undefined,
      colorAttachments: (desc.colorAttachments || []).map(c => c ? { ...c, view: vistaPara(c.view), resolveTarget: c.resolveTarget ? vistaPara(c.resolveTarget) : undefined } : c) });
    const pasadas = img.pasadas.map(p => ({ desc: descDe(p.desc), ordenes: p.ordenes }));
    // (las de constantes: setBindGroup del grupo 1 con desplazamiento dinámico; la primera de cada pasada se queda)
    const esUniforme = (o) => o[0] === 'setBindGroup' && o[1] === 1 && Array.isArray(o[3]) && o[3].length > 0;
    // formatos de cada pasada (para los bundles)
    const formatoDe = (v) => texturaDeVista.get(v)?.format;
    const muestras = (p) => texturaDeVista.get(p.desc.colorAttachments?.[0]?.view || p.desc.depthStencilAttachment?.view)?.sampleCount || 1;
    // los bundles: cada tramo seguido de órdenes que caben en un bundle, grabado una vez
    let bundlesHechos = null, bundlesFallo = null;
    const armarBundles = () => {
      const res = [];
      for (const p of img.pasadas) {
        const colores = (p.desc.colorAttachments || []).map(c => c ? formatoDe(c.view) : null);
        const prof = p.desc.depthStencilAttachment ? formatoDe(p.desc.depthStencilAttachment.view) : undefined;
        const piezas = []; let actual = null, inicio = [];
        // lo que la pasada ya tenía puesto (bind groups 0 y 2 al empezar) hay que repetirlo dentro de cada bundle
        const estadoBG = new Map(); let pipe = null, indice = null;
        for (const o of p.ordenes) {
          if (EN_BUNDLE.has(o[0])) {
            if (!actual) {
              actual = dev.createRenderBundleEncoder({ colorFormats: colores, depthStencilFormat: prof, sampleCount: muestras(p) });
              if (pipe) actual.setPipeline(pipe);
              for (const [i, [g, d]] of estadoBG) d ? actual.setBindGroup(i, g, d) : actual.setBindGroup(i, g);
              if (indice) actual.setIndexBuffer(...indice);
            }
            if (o[0] === 'setPipeline') pipe = o[1];
            if (o[0] === 'setBindGroup') estadoBG.set(o[1], [o[2], o[3]]);
            if (o[0] === 'setIndexBuffer') indice = o.slice(1);
            actual[o[0]](...o.slice(1));
          } else {
            if (actual) { piezas.push({ b: actual.finish() }); actual = null; }
            piezas.push({ o });
          }
        }
        if (actual) piezas.push({ b: actual.finish() });
        res.push({ desc: descDe(p.desc), piezas });
      }
      return res;
    };
    // el ensayo: codificar la imagen grabada `repeticiones` veces de cada forma, sin enviarla
    const correr = (variante) => {
      const enc = dev.createCommandEncoder();
      if (variante === 'bundles') {
        for (const p of bundlesHechos) {
          const pe = enc.beginRenderPass(p.desc);
          for (const x of p.piezas) x.b ? pe.executeBundles([x.b]) : pe[x.o[0]](...x.o.slice(1));
          pe.end();
        }
      } else {
        for (const p of pasadas) {
          const pe = enc.beginRenderPass(p.desc);
          let primera = true;
          for (const o of p.ordenes) {
            if (variante === 'sinUniformes' && esUniforme(o)) { if (!primera) continue; primera = false; }
            pe[o[0]](...o.slice(1));
          }
          pe.end();
        }
      }
      enc.finish();
    };
    const medir = (variante) => {
      dev.pushErrorScope('validation');
      correr(variante);             // (una de calentamiento)
      const t = ahora();
      for (let k = 0; k < repeticiones; k++) correr(variante);
      const ms = (ahora() - t) / repeticiones;
      return dev.popErrorScope().then(e => ({ ms: Math.round(ms * 1000) / 1000, error: e ? String(e.message).slice(0, 200) : null }));
    };
    const subidas = img.subidas;
    const medirSubidas = () => {     // las mismas subidas (cantidad y tamaño) a un búfer de descarte
      const tot = subidas.reduce((a, x) => a + Math.ceil(x / 4) * 4, 0);
      if (!subidas.length) return { ms: 0 };
      const buf = dev.createBuffer({ size: Math.max(4, Math.ceil(tot / 4) * 4), usage: raiz.GPUBufferUsage.COPY_DST });
      const datos = new Uint8Array(Math.max(...subidas) + 4);
      const t = ahora();
      for (let k = 0; k < repeticiones; k++) { let off = 0; for (const s of subidas) { const n = Math.ceil(s / 4) * 4; dev.queue.writeBuffer(buf, off, datos, 0, n); off += n; } }
      const ms = (ahora() - t) / repeticiones;
      buf.destroy();
      return { ms: Math.round(ms * 1000) / 1000, bytes: tot };
    };
    (async () => {
      const completo = await medir('completo');
      const sinUniformes = await medir('sinUniformes');
      let bundles = null;
      try { dev.pushErrorScope('validation'); bundlesHechos = armarBundles(); const e = await dev.popErrorScope(); if (e) bundlesFallo = String(e.message).slice(0, 200); bundles = await medir('bundles'); }
      catch (x) { bundlesFallo = String(x?.message || x); }
      const subir = medirSubidas();
      const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? Math.round(b[b.length >> 1] * 1000) / 1000 : null; };
      const prom = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 1000) / 1000 : null;
      const porImagen = {};
      for (const [k, v] of [...conteo].sort((a, b) => b[1] - a[1])) porImagen[k] = Math.round(v / Math.max(1, imagenesContadas) * 10) / 10;
      const totalLlamadas = Object.values(porImagen).reduce((a, x) => a + x, 0);
      const piezasBundles = bundlesHechos ? bundlesHechos.reduce((a, p) => a + p.piezas.length, 0) : null;
      const bundlesN = bundlesHechos ? bundlesHechos.reduce((a, p) => a + p.piezas.filter(x => x.b).length, 0) : null;
      r.resultado = {
        rafagaMs: { mediana: med(rafagas), promedio: prom(rafagas), imagenes: rafagas.length, enviosPorImagen: prom(envios) },
        llamadasPorImagen: Math.round(totalLlamadas), porMetodo: porImagen, imagenesContadas,
        grabada: { pasadas: img.pasadas.length, ordenes: img.pasadas.reduce((a, p) => a + p.ordenes.length, 0), tipos: tiposDe(img),
          subidas: subidas.length, bytesSubidos: subidas.reduce((a, x) => a + x, 0), computo: img.otras,
          ordenesPorPasada: img.pasadas.map(p => p.ordenes.length) },
        repeticion: comparaciones,
        ensayo: { repeticiones, completo, sinUniformes, bundles, bundlesFallo, bundlesN, piezasBundles, subidas: subir },
      };
      for (const d of descartes.values()) try { d.texture?.destroy?.(); } catch {}
      terminar();
    })().catch(x => { estado.fallo = String(x?.stack || x); terminar(); });
  }
  function terminar() { sacarTodo(); estado.fase = 'listo'; try { alTerminar?.(r.resultado, estado.fallo); } catch {} }

  // esperar la señal de empezar (la carrera, o el tramo fijo andando)
  const espera = setInterval(() => {
    let si = false; try { si = !!empezar?.(); } catch {}
    if (!si) return;
    clearInterval(espera);
    try { faseTiempo(); } catch (x) { estado.fallo = String(x); terminar(); }
  }, 50);
  return r;
}
