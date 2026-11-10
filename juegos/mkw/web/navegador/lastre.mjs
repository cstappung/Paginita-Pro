// El aparato de mentira: la gama media simulada en este PC (H1 del plan de rendimiento) — bitácora §155.
//
// Resumen: este PC (Ryzen 7 9800X3D) y el Oppo son de lo más rápido que existe; lo que en ellos entra holgado puede no
// entrar en un teléfono de gama media. Como no hay otros aparatos para probar, se FRENA este con un lastre calibrado,
// igual que una carga ficticia con que se prueba una fuente de poder:
//   1. lastre de CPU (?lastre=K): el hilo del juego trabaja t ms entre una espera y la siguiente; antes de entrar a la
//      espera se queda girando (K−1)·t ms más. Así cada trozo de trabajo dura K veces lo que duraba: es un núcleo K
//      veces más lento. Lo girado NO cuenta como espera (el medidor de «juego ms» lo ve como trabajo).
//   2. lastre de los hilos de ayuda (?lastreAyuda=K): el del sonido (el AudioWorklet), el único hilo aparte que tiene
//      la página (el programa del juego es de un solo hilo: el sitio no tiene COOP/COEP). Se hace dentro del worklet
//      (sonido-worklet.js, opción lastreAyuda), aquí solo se lee el número.
//   3. el ladrón de caché (?ladron=64): un Worker que recorre 64 MB sin parar, una lectura cada 64 bytes (una línea de
//      caché), así la caché grande del procesador (96 MB en el 9800X3D, 2–4 MB en un teléfono medio) se llena de otra
//      cosa y el juego pelea la memoria como en un aparato chico.
//   4. lastre de la tarjeta (?lastreGpu=K): cada pasada de dibujo (render pass) se repite K−1 veces más en imágenes de
//      descarte del mismo tamaño y formato, con los mismos dibujos: la tarjeta hace K veces el trabajo de esas pasadas.
//      La imagen que se ve no cambia (las repeticiones dibujan en el descarte).
// Con K = 1 nada cambia (ni se instala). La comprobación: banco `lastre` (K = 1, 2, 4 → el cuadro 1×, 2×, 4× ±10 %).
//
// Uso:  const cpu = crearLastreCpu({ k: 3.5 });  const espera = cpu.envolver(esperaOriginal);  cpu.estado → { ms, … }
//       const ladron = crearLadron({ mb: 64 });  ladron.estado() → { vueltas, mbs }   ladron.parar()
//       const gpu = instalarLastreGpu({ k: 6 });  gpu.estado → { pasadas, repetidas, fallo }   gpu.desinstalar()

// ---- 1. el lastre de CPU ----
// k: cuántas veces más lento (1 = nada). tope: lo más que se gira de una vez (ms): un trozo de «trabajo» enorme suele ser
// otra cosa (el arranque, una suspensión del disco que no pasó por una espera envuelta) y no hay que congelar la página.
// Lo trabajado (t) es el reloj entre la vuelta de una espera y la llamada a la siguiente: CPU pura del hilo. OJO: el
// «juego ms» del medidor NO es eso: incluye lo que aurora espera a que el navegador tome la imagen (esperaToma, que el
// runtime no cuenta como espera; §155.3: en la carrera, ~5 de sus 9,6 ms). Por eso con K = 2 el medidor no se duplica,
// pero la CPU pura sí. Con k = 1 no gira nada y solo mide (?lastre=1: la CPU pura por cuadro en el informe).
export function crearLastreCpu({ k = 1, tope = 250, ahora = () => performance.now() } = {}) {
  const estado = { k, ms: 0, trabajoMs: 0, veces: 0, topes: 0 };
  let vuelta = null;                             // cuándo volvió la última espera (null = todavía no hubo ninguna)
  const girar = ms => { const fin = ahora() + ms; while (ahora() < fin) { /* el lastre: girar sin soltar el hilo */ } };
  // antes de cada espera: lo trabajado desde la última vuelta, por (k − 1)
  const antes = () => {
    if (vuelta === null) return;
    const t = ahora() - vuelta;
    estado.trabajoMs += t; estado.veces++;
    let extra = (estado.k - 1) * t;   // (§241: estado.k se puede cambiar con el juego andando: el «calor» de mentira)
    if (extra > tope) { extra = tope; estado.topes++; }
    if (extra > 0) { const t0 = ahora(); girar(extra); estado.ms += ahora() - t0; }
  };
  const despues = () => { vuelta = ahora(); };
  return {
    estado,
    // envolver una espera del juego (función que devuelve una promesa o un valor): el lastre va antes de esperar
    envolver: f => function (a, b, c) {
      antes();
      const r = f.call(this, a, b, c);
      if (r && typeof r.then === 'function') return r.then(v => { despues(); return v; });
      despues(); return r;
    },
  };
}

// ---- 3. el ladrón de caché ----
// Un Worker que recorre mb megabytes sin parar (una lectura y una escritura por línea de 64 bytes, para que la línea
// quede «sucia» y la caché tenga que devolverla a la memoria). Cuenta las vueltas: estado() → MB por segundo recorridos.
export function crearLadron({ mb = 64 } = {}) {
  const codigo = `
    const a = new Int32Array(${Math.max(1, mb | 0)} * 262144);   // mb × 1 MiB / 4 bytes
    let vueltas = 0, s = 0;
    const paso = () => {
      const fin = Date.now() + 50;                               // de a 50 ms, para poder contestar y parar
      while (Date.now() < fin) { for (let i = 0; i < a.length; i += 16) { s += a[i]; a[i] = s; } vueltas++; }
      postMessage(vueltas); setTimeout(paso, 0);
    };
    paso();`;
  const w = new Worker(URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' })));
  const t0 = performance.now();
  let vueltas = 0;
  w.onmessage = e => { vueltas = e.data; };
  return {
    estado: () => ({ mb, vueltas, mbs: Math.round(vueltas * mb / Math.max(0.001, (performance.now() - t0) / 1000)) }),
    parar: () => w.terminate(),
  };
}

// ---- 4. el lastre de la tarjeta ----
// Envuelve las clases de WebGPU del navegador (como perfil-gpu.mjs): cada pasada que abre el juego anota lo que manda
// (receta, grupos, búferes, dibujos…) y, al cerrarla, la repite k − 1 veces en imágenes de descarte. Las imágenes de
// descarte: mismo ancho, alto, formato y muestras que las de la pasada; se limpian al empezar y se guardan al terminar
// (store, como una pasada de verdad: en un teléfono guardar la baldosa es parte del costo). Se crean una vez por forma.
// Las consultas de oclusión y las marcas de tiempo no se repiten (son del juego y del perfil).
const GRABAR = ['setPipeline', 'setBindGroup', 'setVertexBuffer', 'setIndexBuffer', 'setViewport', 'setScissorRect',
                'setBlendConstant', 'setStencilReference', 'draw', 'drawIndexed', 'drawIndirect', 'drawIndexedIndirect',
                'executeBundles'];
export function instalarLastreGpu({ k = 1, raiz = globalThis } = {}) {
  const estado = { k, pasadas: 0, repetidas: 0, descartes: 0, fallo: null };
  const P = n => raiz[n]?.prototype;
  const puestos = [];
  const poner = (clase, nombre, hacer) => {
    const pr = P(clase);
    if (!pr || typeof pr[nombre] !== 'function') return null;
    const original = pr[nombre];
    pr[nombre] = hacer(original);
    puestos.push([pr, nombre, original]);
    return original;
  };
  if (k <= 1 || !P('GPUCommandEncoder')) return { estado, desinstalar() {} };
  const reps = Math.max(1, Math.round(k) - 1);   // (k entero: 2 = una repetición más)
  const vistas = new WeakMap();                  // GPUTextureView → { w, h, formato, muestras }
  const encDev = new WeakMap();                  // GPUCommandEncoder → GPUDevice
  const descartes = new Map();                   // "w×h:formato:muestras" → la vista de descarte
  const originales = {};

  // el tamaño y el formato de cada vista (para armar su descarte)
  poner('GPUTexture', 'createView', o => function (...x) {
    const v = o.apply(this, x), d = x[0];
    try {
      const mip = d?.baseMipLevel || 0;
      vistas.set(v, { w: Math.max(1, this.width >> mip), h: Math.max(1, this.height >> mip), formato: d?.format || this.format, muestras: this.sampleCount || 1 });
    } catch {}
    return v;
  });
  poner('GPUDevice', 'createCommandEncoder', o => function (...x) { const e = o.apply(this, x); encDev.set(e, this); return e; });

  const descarte = (dev, f) => {
    const clave = `${f.w}×${f.h}:${f.formato}:${f.muestras}`;
    let v = descartes.get(clave);
    if (!v) {
      v = dev.createTexture({ size: [f.w, f.h], format: f.formato, sampleCount: f.muestras, usage: raiz.GPUTextureUsage.RENDER_ATTACHMENT }).createView();
      descartes.set(clave, v); estado.descartes++;
    }
    return v;
  };
  const conStencil = formato => /stencil/.test(formato);
  const conDepth = formato => /depth/.test(formato);
  // el descriptor de la pasada repetida: cada imagen cambiada por su descarte
  const armar = (dev, desc) => {
    const colores = (desc.colorAttachments || []).map(c => {
      if (!c) return c;
      const f = vistas.get(c.view); if (!f) throw new Error('vista sin forma');
      const r = { view: descarte(dev, f), loadOp: 'clear', storeOp: 'store', clearValue: c.clearValue || [0, 0, 0, 0] };
      if (c.resolveTarget) { const fr = vistas.get(c.resolveTarget); if (!fr) throw new Error('resolve sin forma'); r.resolveTarget = descarte(dev, fr); }
      return r;
    });
    const out = { colorAttachments: colores };
    const ds = desc.depthStencilAttachment;
    if (ds) {
      const f = vistas.get(ds.view); if (!f) throw new Error('profundidad sin forma');
      const d = { view: descarte(dev, f) };
      if (conDepth(f.formato)) {
        if (ds.depthReadOnly) d.depthReadOnly = true;
        else { d.depthLoadOp = 'clear'; d.depthStoreOp = 'store'; d.depthClearValue = ds.depthClearValue ?? 1; }
      }
      if (conStencil(f.formato)) {
        if (ds.stencilReadOnly) d.stencilReadOnly = true;
        else { d.stencilLoadOp = 'clear'; d.stencilStoreOp = 'store'; d.stencilClearValue = ds.stencilClearValue ?? 0; }
      }
      out.depthStencilAttachment = d;
    }
    return out;
  };

  const abiertas = new WeakMap();                // GPURenderPassEncoder → { enc, desc, cmds }
  // Si la pasada trae marcas de tiempo (el perfil de la tarjeta, perfil-gpu.mjs, que va por fuera), la de inicio queda
  // en la original y la de fin pasa a la última repetición: así el tiempo de esa pasada incluye el lastre
  const beginOrig = poner('GPUCommandEncoder', 'beginRenderPass', o => function (desc, ...x) {
    let fin = null, d = desc;
    const tw = desc?.timestampWrites;
    if (tw && tw.endOfPassWriteIndex !== undefined) {
      fin = { querySet: tw.querySet, endOfPassWriteIndex: tw.endOfPassWriteIndex };
      d = { ...desc };
      if (tw.beginningOfPassWriteIndex !== undefined) d.timestampWrites = { querySet: tw.querySet, beginningOfPassWriteIndex: tw.beginningOfPassWriteIndex };
      else delete d.timestampWrites;               // (una marca sin ninguno de los dos no vale)
    }
    const p = o.call(this, d, ...x);
    if (desc) { abiertas.set(p, { enc: this, desc, cmds: [], fin }); estado.pasadas++; }
    return p;
  });
  // (con los argumentos tal cual llegaron, ni uno de más: setBindGroup con 5 argumentos es otra variante que con 3)
  for (const n of GRABAR) {
    originales[n] = poner('GPURenderPassEncoder', n, o => function (...x) {
      const reg = abiertas.get(this);
      if (reg) {
        // setBindGroup con desplazamientos en un pedazo de la memoria del programa (Dawn pasa la vista entera del heap):
        // se copia ese pedazo ahora, porque al repetir la memoria ya puede ser otra
        if (n === 'setBindGroup' && x.length === 5 && ArrayBuffer.isView(x[2])) reg.cmds.push([n, [x[0], x[1], x[2].slice(x[3], x[3] + x[4]), 0, x[4]]]);
        else if (n === 'executeBundles') reg.cmds.push([n, [Array.from(x[0] || [])]]);
        else reg.cmds.push([n, x]);
      }
      return o.apply(this, x);
    });
  }
  const endOrig = poner('GPURenderPassEncoder', 'end', o => function () {
    const r = o.call(this);
    const reg = abiertas.get(this);
    if (!reg) return r;
    abiertas.delete(this);
    try {
      const dev = encDev.get(reg.enc);
      if (!dev) throw new Error('codificador sin dispositivo');
      const desc = armar(dev, reg.desc);
      for (let i = 0; i < reps; i++) {
        const p = beginOrig.call(reg.enc, i === reps - 1 && reg.fin ? { ...desc, timestampWrites: reg.fin } : desc);
        for (const [n, x] of reg.cmds) originales[n].apply(p, x);
        endOrig.call(p);
        estado.repetidas++;
      }
    } catch (x) { estado.fallo = estado.fallo || String(x?.message || x); }
    return r;
  });

  return {
    estado,
    desinstalar() { for (const [pr, n, o] of puestos.reverse()) pr[n] = o; puestos.length = 0; },
  };
}

// Lo que dice la dirección de la página: ?lastre=K, ?lastreAyuda=K, ?ladron=MB, ?lastreGpu=K (números; 1 o nada = sin;
// medir: true si vino ?lastre, aunque sea 1: el de CPU se pone solo a medir)
export function lastreDeParametros(parametros) {
  const num = (n, min, max) => { const v = Number(parametros.get(n)); return Number.isFinite(v) && v > 0 ? Math.min(max, Math.max(min, v)) : null; };
  return { medir: parametros.has('lastre'), cpu: num('lastre', 1, 20) ?? 1, ayuda: num('lastreAyuda', 1, 20) ?? 1, ladron: num('ladron', 1, 1024) ?? 0, gpu: num('lastreGpu', 1, 16) ?? 1 };
}
