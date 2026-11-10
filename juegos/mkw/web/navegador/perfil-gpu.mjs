// El perfil de la tarjeta de video: QUÉ parte del dibujo se come el tiempo — bitácora §115 (el informe del Oppo Find X9
// Pro: la tarjeta tardaba 31–35 ms por cuadro, el doble de lo que hay para 60 fps).
//
// Resumen: el juego no le habla a la tarjeta directo: aurora (el renderizador) llama a WebGPU desde JavaScript (las
// clases GPUCommandEncoder, GPURenderPassEncoder, GPUQueue… del navegador). Este módulo se pone «al lado» de esas
// llamadas, sin cambiar lo que hacen, y cuenta:
//   1. CONTEO (con «Mostrar qué frena»): por cuadro, cuántas PASADAS de dibujo (render passes: cada vez que la
//      tarjeta empieza a dibujar en una imagen), cuántos DIBUJOS (draw calls), cuántas copias de imágenes y cuántos
//      bytes se SUBEN a la tarjeta (writeBuffer/writeTexture).
//   2. TIEMPOS (un rato, a pedido: «🔬 Perfilar la tarjeta»): con las marcas de tiempo de la propia tarjeta
//      (timestamp-query: la tarjeta anota la hora al empezar y al terminar cada pasada), cuántos ms tarda CADA pasada,
//      con el tamaño de la imagen en que dibuja, sus dibujos y los cambios de receta (setPipeline). Así se ve, por
//      ejemplo, «la pasada 2 (640×528, 300 dibujos) se lleva 20 ms» o «hay 40 pasadas chicas».
// Por qué importa en un teléfono: sus tarjetas dibujan por baldosas (tile-based) y cada pasada nueva obliga a leer y
// escribir la imagen entera en la memoria; muchas pasadas cuestan mucho más que en un PC. Como un electricista que mide
// con una pinza amperimétrica sin cortar el cable: se mide lo que pasa, no se cambia.
//
// §123 (G8): contar NO es gratis (1.000–2.000 llamadas por cuadro envueltas: 0,2–1 ms por cuadro en un PC, más en un
// teléfono), y eso inflaba justo lo que se quería medir. Por eso el conteo va por VENTANAS: se pone `ventana.durMs` de
// cada `ventana.cadaMs` (en la página, 2 s de cada 10) y entre ventanas los métodos del navegador quedan los originales,
// sin nada encima. Las envolturas llevan argumentos fijos (sin `...a` ni `apply`, que arman un arreglo por llamada), la
// pasada abierta va en una variable (no en un WeakMap consultado en cada dibujo), y setPipeline/setBindGroup y el tamaño
// de las imágenes solo se envuelven para medir tiempos. `cuadros` (una función que dice el cuadro del juego) permite
// repartir lo contado por los cuadros que de verdad se contaron (foto().cuadros).
//
// Uso:  const p = instalarPerfilGpu({ tiempos: true });  p.foto() → conteo acumulado
//       instalarPerfilGpu({ ventana: { cadaMs: 10000, durMs: 2000 }, cuadros: () => M._mkw_web_cuadros() })
//       p.tiempos() → [{ clave, ms, veces, dibujos, tam, etiqueta }] por pasada (promedio por vez)
//       p.medirTiempos(si) → prende o apaga las marcas (solo si el dispositivo se creó con timestamp-query)
//       p.desinstalar() → deja los métodos originales del navegador

const MAX_PASADAS = 128;                         // pasadas con marca de tiempo por envío (cada una usa 2 marcas)

// ventana: { cadaMs, durMs } = contar durMs de cada cadaMs (null = siempre, como antes de §123)
// cuadros: () → el número de cuadro del juego (para foto().cuadros)
export function instalarPerfilGpu({ raiz = globalThis, tiempos = false, ventana = null, cuadros = null } = {}) {
  const P = n => raiz[n]?.prototype;
  const cuenta = { pasadas: 0, computo: 0, dibujos: 0, recetas: 0, grupos: 0, envios: 0, subidas: 0, bytes: 0, copias: 0,
                   cuadros: 0, ventanas: 0 };
  const vistas = new WeakMap();                  // GPUTextureView → [ancho, alto] (para el tamaño de cada pasada)
  const porClave = new Map();                    // clave de pasada → { ms, veces, dibujos, tam, etiqueta }
  let dispositivo = null, conMarcas = false, medir = false, fallo = null;
  let grupoMarcas = null, resolver = null, libres = [], usadas = 0, enCurso = [];
  let interno = false;                           // (lo que hace este módulo —leer las marcas— no se cuenta como del juego)
  let pasadaActual = null;                       // el registro de la pasada abierta (para sumarle dibujos)

  // Envolver un método de una clase del navegador. Dos formas:
  //   contar(clase, nombre, f): f() antes del original, nada más (lo más barato: lo que se usa en cada dibujo);
  //   envolver(clase, nombre, antes, despues): antes([a…f]) puede devolver otros argumentos (un arreglo; null = los
  //     mismos) y despues(r) mira lo que devolvió el original.
  // Argumentos fijos (hasta 6: los métodos de WebGPU no llevan más), pasados al original con la cantidad que llegó (§158).
  // Un error nuestro nunca corta la llamada del juego. Cada envoltura queda anotada en `puestos` con su grupo: 'conteo'
  // (se pone y se saca con las ventanas) o 'fijo' (el dispositivo y las vistas: tienen que estar desde el principio).
  const puestos = [];
  const poner1 = (clase, nombre, hacer, grupo) => {
    const pr = P(clase);
    if (!pr || typeof pr[nombre] !== 'function' || pr[nombre].__perfil) return;
    const original = pr[nombre], nuevo = hacer(original);
    nuevo.__perfil = true;
    puestos.push({ pr, nombre, original, nuevo, grupo });
    if (grupo === 'fijo' || !ventana) pr[nombre] = nuevo;
  };
  // §158: el original se llama con TANTOS argumentos como llegaron, no siempre 6. WebGPU elige la forma del método por la
  // cantidad: setBindGroup(i, grupo, [desplazamientos]) contra setBindGroup(i, grupo, Uint32Array, inicio, largo); con
  // undefined de relleno Chrome tomaba la de 5 y lanzaba «parameter 3 is not of type 'TypedArray'» (con ?perfilGpu=1 el
  // juego quedaba en el cuadro 0). Un switch y no ...args: sin arreglos nuevos en cada dibujo (§123).
  const llamar = (original, self, n, a, b, c, d, e, g) => {
    switch (n) {
      case 0: return original.call(self);
      case 1: return original.call(self, a);
      case 2: return original.call(self, a, b);
      case 3: return original.call(self, a, b, c);
      case 4: return original.call(self, a, b, c, d);
      case 5: return original.call(self, a, b, c, d, e);
      default: return original.call(self, a, b, c, d, e, g);
    }
  };
  const contar = (clase, nombre, f) => poner1(clase, nombre, original => function (a, b, c, d, e, g) {
    try { f(a, b, c, d, e); } catch (x) { fallo = fallo || String(x); }
    return llamar(original, this, arguments.length, a, b, c, d, e, g);
  }, 'conteo');
  const envolver = (clase, nombre, antes = null, despues = null, grupo = 'conteo') => poner1(clase, nombre, original => function (a, b, c, d, e, g) {
    let args = null;
    if (antes) try { args = antes.call(this, a, b, c, d, e); } catch (x) { fallo = fallo || String(x); }
    const r = args ? original.apply(this, args) : llamar(original, this, arguments.length, a, b, c, d, e, g);
    if (despues) try { despues.call(this, r); } catch (x) { fallo = fallo || String(x); }
    return r;
  }, grupo);

  // poner o sacar las envolturas de conteo (con ventanas); al sacar, los métodos vuelven a ser los del navegador
  let puesto = !ventana, c0 = 0;
  const cuadroAhora = () => { try { return cuadros ? cuadros() : 0; } catch { return 0; } };
  if (puesto) c0 = cuadroAhora();
  function poner(si) {
    if (si === puesto) return;
    puesto = si;
    for (const x of puestos) if (x.grupo === 'conteo') x.pr[x.nombre] = si ? x.nuevo : x.original;
    if (si) { c0 = cuadroAhora(); cuenta.ventanas++; } else { cuenta.cuadros += cuadroAhora() - c0; pasadaActual = null; }
  }

  // ---- el tamaño de las imágenes (para saber en qué dibuja cada pasada: solo con tiempos) ----
  if (tiempos) envolver('GPUTexture', 'createView', null, function (vista) { if (vista) vistas.set(vista, [this.width, this.height]); }, 'fijo');
  const tamDe = desc => {
    const v = desc?.colorAttachments?.[0]?.view || desc?.depthStencilAttachment?.view;
    const t = v && vistas.get(v);
    return t ? `${t[0]}×${t[1]}` : '?';
  };

  // ---- el dispositivo: con «tiempos», se pide timestamp-query si la tarjeta lo tiene ----
  if (tiempos) envolver('GPUAdapter', 'requestDevice', function (a, b) {
    if (!this.features?.has?.('timestamp-query')) return null;
    const d = { ...(a || {}) };
    d.requiredFeatures = [...(d.requiredFeatures || []), 'timestamp-query'];
    conMarcas = true;
    return [d, b];
  }, function (promesa) {
    if (promesa && typeof promesa.then === 'function') promesa.then(d => { dispositivo = d; }, () => {});
  }, 'fijo');

  // ---- las pasadas y los dibujos ----
  let numero = 0;                                // número de la pasada dentro del envío (la «posición» en el cuadro)
  if (tiempos) envolver('GPUCommandEncoder', 'beginRenderPass', function (desc0, b) {
    cuenta.pasadas++;
    const desc = desc0 || {};
    const reg = { tam: tamDe(desc), etiqueta: desc.label || '', dibujos: 0, n: numero++ };
    pasadaActual = reg;
    if (!medir || !grupoMarcas || desc.timestampWrites || usadas >= MAX_PASADAS) return null;
    reg.marca = usadas++;
    enCurso.push(reg);
    return [{ ...desc, timestampWrites: { querySet: grupoMarcas, beginningOfPassWriteIndex: 2 * reg.marca, endOfPassWriteIndex: 2 * reg.marca + 1 } }, b];
  });
  else contar('GPUCommandEncoder', 'beginRenderPass', () => { cuenta.pasadas++; });
  contar('GPUCommandEncoder', 'beginComputePass', () => { cuenta.computo++; });
  for (const n of ['copyTextureToTexture', 'copyBufferToTexture', 'copyTextureToBuffer', 'copyBufferToBuffer']) contar('GPUCommandEncoder', n, () => { if (!interno) cuenta.copias++; });
  for (const n of ['draw', 'drawIndexed', 'drawIndirect', 'drawIndexedIndirect'])
    contar('GPURenderPassEncoder', n, tiempos ? () => { cuenta.dibujos++; if (pasadaActual) pasadaActual.dibujos++; } : () => { cuenta.dibujos++; });
  if (tiempos) {
    contar('GPURenderPassEncoder', 'setPipeline', () => { cuenta.recetas++; });
    contar('GPURenderPassEncoder', 'setBindGroup', () => { cuenta.grupos++; });
  }

  // ---- lo que se sube a la tarjeta ----
  contar('GPUQueue', 'writeBuffer', (buffer, offset, datos, desde = 0, tam) => {
    cuenta.subidas++;
    cuenta.bytes += Number.isFinite(tam) ? tam : Math.max(0, (datos?.byteLength || 0) - desde);
  });
  contar('GPUQueue', 'writeTexture', (destino, datos, capa = {}, tam = {}) => {
    cuenta.subidas++;
    const alto = Array.isArray(tam) ? (tam[1] || 1) : (tam?.height || 1);
    cuenta.bytes += capa?.bytesPerRow ? capa.bytesPerRow * alto : Math.min(datos?.byteLength || 0, 64 << 20);
  });

  // ---- cada envío: con marcas, se piden los tiempos al final del mismo envío y se leen cuando la tarjeta termina ----
  envolver('GPUQueue', 'submit', function (lista) {
    cuenta.envios++;
    numero = 0;
    if (!medir || !usadas || !dispositivo) { usadas = 0; enCurso = []; return null; }
    const n = usadas, regs = enCurso;
    const deCuadro = cuadros ? cuadroAhora() : cuenta.envios;     // (§173: el cuadro de este envío; sin cuadros, cada envío)
    usadas = 0; enCurso = [];
    const lectura = libres.pop() || dispositivo.createBuffer({ size: MAX_PASADAS * 16, usage: raiz.GPUBufferUsage.MAP_READ | raiz.GPUBufferUsage.COPY_DST });
    const enc = dispositivo.createCommandEncoder();
    interno = true;
    try { enc.resolveQuerySet(grupoMarcas, 0, 2 * n, resolver, 0); enc.copyBufferToBuffer(resolver, 0, lectura, 0, 16 * n); } finally { interno = false; }
    const listos = [...(lista || []), enc.finish()];
    // (se lee cuando la tarjeta terminó; los números son nanosegundos de la tarjeta)
    queueMicrotask(() => lectura.mapAsync(raiz.GPUMapMode.READ).then(() => {
      const t = new BigUint64Array(lectura.getMappedRange().slice(0, 16 * n));
      lectura.unmap(); libres.push(lectura);
      // §173: el TRAMO de la tarjeta en este cuadro = el último fin menos el primer comienzo, y la SUMA de las pasadas.
      // En una tarjeta por mosaicos (Mali, Adreno…) el comienzo de cada pasada se anota cuando entra a la fila, no cuando
      // la tarjeta la empieza: las pasadas se pisan y su suma cuenta lo mismo varias veces (en el Oppo, la #24 marcaba
      // 3,1 ms sin dibujar nada). El tramo no se pisa: es lo que la tarjeta tardó de verdad en el cuadro.
      const c = deCuadro;
      let t0 = null, t1 = null, suma = 0;
      for (const r of regs) {
        const a = t[2 * r.marca], b = t[2 * r.marca + 1];
        if (!(b >= a) || a === 0n) continue;
        if (t0 === null || a < t0) t0 = a;
        if (t1 === null || b > t1) t1 = b;
        suma += Number(b - a) / 1e6;
      }
      if (t0 !== null) {
        const v = porCuadroTramo.get(c) || { t0, t1, suma: 0 };
        if (t0 < v.t0) v.t0 = t0;
        if (t1 > v.t1) v.t1 = t1;
        v.suma += suma;
        porCuadroTramo.set(c, v);
        while (porCuadroTramo.size > 600) porCuadroTramo.delete(porCuadroTramo.keys().next().value);
      }
      regs.forEach(r => {
        const ms = Number(t[2 * r.marca + 1] - t[2 * r.marca]) / 1e6;
        if (!(ms >= 0 && ms < 1000)) return;
        const clave = `${r.n}·${r.tam}${r.etiqueta ? '·' + r.etiqueta : ''}`;
        const e = porClave.get(clave) || { ms: 0, veces: 0, dibujos: 0, tam: r.tam, etiqueta: r.etiqueta, n: r.n };
        e.ms += ms; e.veces++; e.dibujos += r.dibujos;
        porClave.set(clave, e);
      });
    }, () => { libres.push(lectura); }));
    return [listos];
  });

  const porCuadroTramo = new Map();              // §173: cuadro → { t0, t1, suma } (los últimos 600 cuadros medidos)
  const preparar = () => {
    if (grupoMarcas || !dispositivo || !conMarcas) return !!grupoMarcas;
    try {
      grupoMarcas = dispositivo.createQuerySet({ type: 'timestamp', count: 2 * MAX_PASADAS });
      resolver = dispositivo.createBuffer({ size: 2 * MAX_PASADAS * 8, usage: raiz.GPUBufferUsage.QUERY_RESOLVE | raiz.GPUBufferUsage.COPY_SRC });
    } catch (e) { fallo = String(e); grupoMarcas = null; }
    return !!grupoMarcas;
  };

  // las ventanas: contar durMs, descansar el resto de cadaMs (empieza contando)
  let relojVentana = null;
  if (ventana) {
    const ciclo = () => {
      poner(true);
      relojVentana = setTimeout(() => { poner(false); relojVentana = setTimeout(ciclo, Math.max(0, ventana.cadaMs - ventana.durMs)); }, ventana.durMs);
    };
    ciclo();
  }

  return {
    // conteo acumulado; cuadros = cuadros del juego que pasaron mientras se contaba (con ventanas: solo dentro de ellas)
    foto: () => ({ ...cuenta, cuadros: cuenta.cuadros + (puesto ? cuadroAhora() - c0 : 0), contando: puesto }),
    // prende o apaga las marcas de tiempo (si el dispositivo las aceptó); devuelve si quedaron prendidas
    medirTiempos(si) { medir = !!si && preparar(); return medir; },
    // sacar todo y dejar los métodos originales del navegador
    desinstalar() {
      clearTimeout(relojVentana); poner(false);
      for (const x of puestos) if (x.pr[x.nombre] === x.nuevo) x.pr[x.nombre] = x.original;
      puestos.length = 0;
    },
    get conMarcas() { return conMarcas; }, get midiendo() { return medir; }, get fallo() { return fallo; },
    // §173: la mediana por cuadro del tramo (último fin − primer comienzo) y de la suma de las pasadas, en ms; mosaicos =
    // la suma pasa 1,5 veces el tramo (las pasadas se pisan: hay que mirar el tramo, no la suma ni cada pasada)
    tramo() {
      const v = [...porCuadroTramo.values()];
      if (!v.length) return null;
      const med = a => { a.sort((x, y) => x - y); return Math.round(a[a.length >> 1] * 100) / 100; };
      const tramoMs = med(v.map(x => Number(x.t1 - x.t0) / 1e6)), sumaMs = med(v.map(x => x.suma));
      return { tramoMs, sumaMs, cuadros: v.length, mosaicos: sumaMs > 1.5 * tramoMs };
    },
    // los tiempos por pasada, de la más cara a la más barata (ms y dibujos: promedio por vez)
    tiempos: () => [...porClave.entries()].map(([clave, e]) => ({ clave, n: e.n, tam: e.tam, etiqueta: e.etiqueta, veces: e.veces,
      ms: Math.round(e.ms / e.veces * 100) / 100, dibujos: Math.round(e.dibujos / e.veces) })).sort((x, y) => y.ms * y.veces - x.ms * x.veces),
  };
}
