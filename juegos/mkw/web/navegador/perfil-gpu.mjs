// El perfil de la tarjeta de video: QUÉ parte del dibujo se come el tiempo — bitácora §115 (el informe del Oppo Find X9
// Pro: la tarjeta tardaba 31–35 ms por cuadro, el doble de lo que hay para 60 fps).
//
// Resumen: el juego no le habla a la tarjeta directo: aurora (el renderizador) llama a WebGPU desde JavaScript (las
// clases GPUCommandEncoder, GPURenderPassEncoder, GPUQueue… del navegador). Este módulo se pone «al lado» de esas
// llamadas, sin cambiar lo que hacen, y cuenta:
//   1. CONTEO (barato, con «Mostrar qué frena»): por cuadro, cuántas PASADAS de dibujo (render passes: cada vez que la
//      tarjeta empieza a dibujar en una imagen), cuántos DIBUJOS (draw calls), cuántos cambios de receta (setPipeline),
//      cuántas copias de imágenes y cuántos bytes se SUBEN a la tarjeta (writeBuffer/writeTexture).
//   2. TIEMPOS (un rato, a pedido: «🔬 Perfilar la tarjeta»): con las marcas de tiempo de la propia tarjeta
//      (timestamp-query: la tarjeta anota la hora al empezar y al terminar cada pasada), cuántos ms tarda CADA pasada,
//      con el tamaño de la imagen en que dibuja y sus dibujos. Así se ve, por ejemplo, «la pasada 2 (640×528, 300
//      dibujos) se lleva 20 ms» o «hay 40 pasadas chicas».
// Por qué importa en un teléfono: sus tarjetas dibujan por baldosas (tile-based) y cada pasada nueva obliga a leer y
// escribir la imagen entera en la memoria; muchas pasadas cuestan mucho más que en un PC. Como un electricista que mide
// con una pinza amperimétrica sin cortar el cable: se mide lo que pasa, no se cambia.
//
// Uso:  const p = instalarPerfilGpu({ tiempos: true });  p.foto() → conteo acumulado
//       p.tiempos() → [{ clave, ms, veces, dibujos, tam, etiqueta }] por pasada (promedio por vez)
//       p.medirTiempos(si) → prende o apaga las marcas (solo si el dispositivo se creó con timestamp-query)

const MAX_PASADAS = 128;                         // pasadas con marca de tiempo por envío (cada una usa 2 marcas)

export function instalarPerfilGpu({ raiz = globalThis, tiempos = false } = {}) {
  const P = n => raiz[n]?.prototype;
  const cuenta = { pasadas: 0, computo: 0, dibujos: 0, recetas: 0, grupos: 0, envios: 0, subidas: 0, bytes: 0, copias: 0 };
  const vistas = new WeakMap();                  // GPUTextureView → [ancho, alto] (para el tamaño de cada pasada)
  const pasadaDe = new WeakMap();                // GPURenderPassEncoder → el registro de su pasada (para sumarle dibujos)
  const porClave = new Map();                    // clave de pasada → { ms, veces, dibujos, tam, etiqueta }
  let dispositivo = null, conMarcas = false, medir = false, fallo = null;
  let grupoMarcas = null, resolver = null, libres = [], usadas = 0, enCurso = [];
  let interno = false;                           // (lo que hace este módulo —leer las marcas— no se cuenta como del juego)

  // envolver un método de una clase del navegador: `antes` (contar; puede devolver otros argumentos), el original tal
  // cual, y `despues` (con lo que devolvió). Un error nuestro nunca corta la llamada del juego
  const envolver = (clase, nombre, antes = null, despues = null) => {
    const pr = P(clase);
    if (!pr || typeof pr[nombre] !== 'function' || pr[nombre].__perfil) return;
    const original = pr[nombre];
    const nuevo = function (...a) {
      let args = a;
      if (antes) try { args = antes.call(this, a) || a; } catch (e) { fallo = fallo || String(e); args = a; }
      const r = original.apply(this, args);
      if (despues) try { despues.call(this, r, args); } catch (e) { fallo = fallo || String(e); }
      return r;
    };
    nuevo.__perfil = true;
    pr[nombre] = nuevo;
  };

  // ---- el tamaño de las imágenes (para saber en qué dibuja cada pasada) ----
  envolver('GPUTexture', 'createView', null, function (vista) { if (vista) vistas.set(vista, [this.width, this.height]); });
  const tamDe = desc => {
    const v = desc?.colorAttachments?.[0]?.view || desc?.depthStencilAttachment?.view;
    const t = v && vistas.get(v);
    return t ? `${t[0]}×${t[1]}` : '?';
  };

  // ---- el dispositivo: con «tiempos», se pide timestamp-query si la tarjeta lo tiene ----
  envolver('GPUAdapter', 'requestDevice', function (a) {
    if (!tiempos || !this.features?.has?.('timestamp-query')) return a;
    const d = { ...(a[0] || {}) };
    d.requiredFeatures = [...(d.requiredFeatures || []), 'timestamp-query'];
    conMarcas = true;
    return [d, ...a.slice(1)];
  }, function (promesa) {
    if (promesa && typeof promesa.then === 'function') promesa.then(d => { dispositivo = d; }, () => {});
  });

  // ---- las pasadas y los dibujos ----
  let numero = 0;                                // número de la pasada dentro del envío (la «posición» en el cuadro)
  envolver('GPUCommandEncoder', 'beginRenderPass', function (a) {
    cuenta.pasadas++;
    const desc = a[0] || {};
    const reg = { tam: tamDe(desc), etiqueta: desc.label || '', dibujos: 0, n: numero++ };
    this.__pasadaPendiente = reg;
    if (!medir || !grupoMarcas || desc.timestampWrites || usadas >= MAX_PASADAS) return a;
    reg.marca = usadas++;
    enCurso.push(reg);
    return [{ ...desc, timestampWrites: { querySet: grupoMarcas, beginningOfPassWriteIndex: 2 * reg.marca, endOfPassWriteIndex: 2 * reg.marca + 1 } }, ...a.slice(1)];
  }, function (pasada) {
    if (pasada && this.__pasadaPendiente) pasadaDe.set(pasada, this.__pasadaPendiente);
    this.__pasadaPendiente = null;
  });
  envolver('GPUCommandEncoder', 'beginComputePass', () => { cuenta.computo++; });
  for (const n of ['copyTextureToTexture', 'copyBufferToTexture', 'copyTextureToBuffer', 'copyBufferToBuffer']) envolver('GPUCommandEncoder', n, () => { if (!interno) cuenta.copias++; });
  for (const n of ['draw', 'drawIndexed', 'drawIndirect', 'drawIndexedIndirect']) {
    envolver('GPURenderPassEncoder', n, function () { cuenta.dibujos++; const r = pasadaDe.get(this); if (r) r.dibujos++; });
  }
  envolver('GPURenderPassEncoder', 'setPipeline', () => { cuenta.recetas++; });
  envolver('GPURenderPassEncoder', 'setBindGroup', () => { cuenta.grupos++; });

  // ---- lo que se sube a la tarjeta ----
  envolver('GPUQueue', 'writeBuffer', a => {
    cuenta.subidas++;
    const datos = a[2], desde = a[3] || 0;
    cuenta.bytes += Number.isFinite(a[4]) ? a[4] : Math.max(0, (datos?.byteLength || 0) - desde);
  });
  envolver('GPUQueue', 'writeTexture', a => {
    cuenta.subidas++;
    const capa = a[2] || {}, tam = a[3] || {};
    const alto = Array.isArray(tam) ? (tam[1] || 1) : (tam.height || 1);
    cuenta.bytes += capa.bytesPerRow ? capa.bytesPerRow * alto : Math.min(a[1]?.byteLength || 0, 64 << 20);
  });

  // ---- cada envío: con marcas, se piden los tiempos al final del mismo envío y se leen cuando la tarjeta termina ----
  envolver('GPUQueue', 'submit', function (a) {
    cuenta.envios++;
    numero = 0;
    if (!medir || !usadas || !dispositivo) { usadas = 0; enCurso = []; return a; }
    const n = usadas, regs = enCurso;
    usadas = 0; enCurso = [];
    const lectura = libres.pop() || dispositivo.createBuffer({ size: MAX_PASADAS * 16, usage: raiz.GPUBufferUsage.MAP_READ | raiz.GPUBufferUsage.COPY_DST });
    const enc = dispositivo.createCommandEncoder();
    interno = true;
    try { enc.resolveQuerySet(grupoMarcas, 0, 2 * n, resolver, 0); enc.copyBufferToBuffer(resolver, 0, lectura, 0, 16 * n); } finally { interno = false; }
    const listos = [...(a[0] || []), enc.finish()];
    // (se lee cuando la tarjeta terminó; los números son nanosegundos de la tarjeta)
    queueMicrotask(() => lectura.mapAsync(raiz.GPUMapMode.READ).then(() => {
      const t = new BigUint64Array(lectura.getMappedRange().slice(0, 16 * n));
      lectura.unmap(); libres.push(lectura);
      regs.forEach(r => {
        const ms = Number(t[2 * r.marca + 1] - t[2 * r.marca]) / 1e6;
        if (!(ms >= 0 && ms < 1000)) return;
        const clave = `${r.n}·${r.tam}${r.etiqueta ? '·' + r.etiqueta : ''}`;
        const e = porClave.get(clave) || { ms: 0, veces: 0, dibujos: 0, tam: r.tam, etiqueta: r.etiqueta, n: r.n };
        e.ms += ms; e.veces++; e.dibujos += r.dibujos;
        porClave.set(clave, e);
      });
    }, () => { libres.push(lectura); }));
    return [listos, ...a.slice(1)];
  });

  const preparar = () => {
    if (grupoMarcas || !dispositivo || !conMarcas) return !!grupoMarcas;
    try {
      grupoMarcas = dispositivo.createQuerySet({ type: 'timestamp', count: 2 * MAX_PASADAS });
      resolver = dispositivo.createBuffer({ size: 2 * MAX_PASADAS * 8, usage: raiz.GPUBufferUsage.QUERY_RESOLVE | raiz.GPUBufferUsage.COPY_SRC });
    } catch (e) { fallo = String(e); grupoMarcas = null; }
    return !!grupoMarcas;
  };

  return {
    foto: () => ({ ...cuenta }),
    // prende o apaga las marcas de tiempo (si el dispositivo las aceptó); devuelve si quedaron prendidas
    medirTiempos(si) { medir = !!si && preparar(); return medir; },
    get conMarcas() { return conMarcas; }, get midiendo() { return medir; }, get fallo() { return fallo; },
    // los tiempos por pasada, de la más cara a la más barata (ms y dibujos: promedio por vez)
    tiempos: () => [...porClave.entries()].map(([clave, e]) => ({ clave, n: e.n, tam: e.tam, etiqueta: e.etiqueta, veces: e.veces,
      ms: Math.round(e.ms / e.veces * 100) / 100, dibujos: Math.round(e.dibujos / e.veces) })).sort((x, y) => y.ms * y.veces - x.ms * x.veces),
  };
}
