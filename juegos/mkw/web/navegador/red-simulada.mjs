// La red de mentira completa del simulador de sala mixta (bitácora §281). SOLO para pruebas: sin ?redSim no existe.
//
// Resumen general: ?redMala (§70, §80) ya demoraba y perdía paquetes con una sola cifra para todo. Para que cada jugador
// del banco tenga OTRA red (como en la vida real: un PC con fibra, otro con 4G, otro con Wi-Fi que se corta), esto agrega
// a la malla (malla.mjs) un «enlace» por sentido —lo que BAJA a esta página y lo que SUBE de ella— con:
//   - la ida y vuelta base (ms) con variación (± ms) y pérdida (%) solo en «udp» (el canal «tcp» es confiable: ahí lo
//     que se «pierde» se reintenta, así que solo llega más tarde);
//   - un ancho de banda (kbit/s): cada paquete ocupa el cable bytes·8/kbit/s ms; si la cola de «udp» pasa de `cola` ms el
//     paquete se tira (como un router lleno); «tcp» espera su turno;
//   - picos de lag: cada `cada` s (± la mitad, con la semilla) la demora sube `ms` durante `dura` ms;
//   - un corte (cortar(ms)): mientras dura, «udp» no pasa y «tcp» queda retenido hasta que vuelve (así se ve un Wi-Fi
//     que se cae unos segundos: la conexión WebRTC sigue «abierta», pero no pasa nada);
//   - un cambio de red a mitad de carrera (cambiar({baja, sube})): desde ese momento, otros números.
// Todo con una semilla propia (azar de mentira repetible: la misma semilla, los mismos paquetes perdidos), así un
// escenario se repite igual. Como meter entre cada PC y el resto una caja de pruebas de línea telefónica: un rollo de
// cable (demora), un atenuador con ruido (pérdida), un fusible lento (ancho de banda) y un interruptor (el corte).
//
// Uso (la página): ?redSim=<JSON en encodeURIComponent>  p. ej. {"semilla":7,"baja":{"ms":40,"var":10,"perdida":1,
//        "kbps":2000},"sube":{"ms":60,"var":20,"perdida":2,"kbps":500},"picos":{"cada":12,"ms":200,"dura":800}}
//      (ms = la mitad de la ida y vuelta de este tramo: la ida y vuelta entre dos PCs = sube de uno + baja del otro, y vuelta)
//      window.mkwRedSim.cortar(5000) · .cambiar({baja:{…}, sube:{…}}) · .estado()
// Banco: node banco/correr.mjs sala-mixta (las cuentas de esto sin el juego, con un reloj de mentira).

// El azar de mentira con semilla (mulberry32): siempre los mismos números para la misma semilla
export function azarConSemilla(semilla = 1) {
  let a = (Number(semilla) >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// un tramo: { ms, var, perdida (0-100 %), kbps (0 = sin tope), cola (ms de cola de «udp» antes de tirar, 200) }
export function tramo(x = {}) {
  const n = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
  return { ms: Math.max(0, n(x.ms)), var: Math.max(0, n(x.var)), perdida: Math.min(100, Math.max(0, n(x.perdida))),
    kbps: Math.max(0, n(x.kbps)), cola: Math.max(1, n(x.cola, 200)) };
}

// ?redSim=… → { semilla, baja, sube, picos } o null
export function leerRedSim(busqueda = globalThis.location?.search || '') {
  try {
    const v = new URLSearchParams(busqueda).get('redSim');
    if (!v) return null;
    const x = JSON.parse(v);
    const picos = x.picos && Number(x.picos.cada) > 0 ? { cada: Number(x.picos.cada), ms: Math.max(0, Number(x.picos.ms) || 0), dura: Math.max(0, Number(x.picos.dura) || 0) } : null;
    return { semilla: Number(x.semilla) || 1, baja: tramo(x.baja), sube: tramo(x.sube), picos };
  } catch { return null; }
}

// Un sentido del enlace (bajada o subida). paso(u, bytes, canal, t) → null (se tira) o la demora en ms hasta que llega.
// Puro: el tiempo lo da quien llama (así el banco lo prueba con un reloj de mentira).
export function crearEnlace(t0 = tramo(), { azar = Math.random, picos = null, t0ms = 0 } = {}) {
  let tr = tramo(t0), libreEn = -Infinity, corteHasta = -Infinity;
  const ultimaTcp = new Map();
  const cuenta = { llegados: 0, perdidos: 0, tiradosCola: 0, tiradosCorte: 0, retenidos: 0, picos: 0, demoraMedia: 0, demoraMax: 0, bytes: 0 };
  // los picos: el siguiente empieza cada·(0,5 a 1,5) s después del anterior (con la semilla)
  let picoDesde = picos ? t0ms + picos.cada * 1000 * (0.5 + azar()) : Infinity, picoHasta = -Infinity;
  const pico = t => {
    if (!picos) return 0;
    while (t >= picoDesde) { picoHasta = picoDesde + picos.dura; cuenta.picos++; picoDesde += picos.cada * 1000 * (0.5 + azar()); }
    return t < picoHasta ? picos.ms : 0;
  };
  return {
    cuenta,
    tramo: () => ({ ...tr }),
    cambiar(nuevo) { tr = tramo(nuevo); },
    cortar(ms, t) { corteHasta = Math.max(corteHasta, t + ms); },
    cortado: t => t < corteHasta,
    paso(u, bytes, canal, t) {
      const largo = bytes?.byteLength ?? bytes?.length ?? 0;
      if (t < corteHasta && canal !== 'tcp') { cuenta.tiradosCorte++; return null; }
      if (canal !== 'tcp' && azar() * 100 < tr.perdida) { cuenta.perdidos++; return null; }
      const extra = pico(t);
      let sale = t < corteHasta ? corteHasta : t;            // («tcp» retenido hasta que vuelve la red)
      if (t < corteHasta) cuenta.retenidos++;
      if (tr.kbps > 0) {                                      // el cable ocupado: bytes·8 / (kbit/s) = ms
        const ocupa = largo * 8 / tr.kbps, empieza = Math.max(sale, libreEn);
        if (canal !== 'tcp' && empieza - t > tr.cola) { cuenta.tiradosCola++; return null; }
        libreEn = empieza + ocupa; sale = libreEn;
      }
      let llega = sale + Math.max(0, tr.ms + (azar() * 2 - 1) * tr.var + extra);
      if (canal === 'tcp') { llega = Math.max(llega, ultimaTcp.get(u) || 0); ultimaTcp.set(u, llega); }   // en orden
      const demora = llega - t;
      cuenta.llegados++; cuenta.bytes += largo;
      cuenta.demoraMedia += (demora - cuenta.demoraMedia) / cuenta.llegados;
      if (demora > cuenta.demoraMax) cuenta.demoraMax = demora;
      return demora;
    },
  };
}

// Envuelve una función (u, bytes, canal) con un enlace: lo que pasa llega `demora` ms después (una copia: quien manda
// reusa su búfer, como hace RTCDataChannel.send). Devuelve true (quien manda no sabe si la red lo perdió).
export function conEnlace(f, enlace, { reloj = (g, ms) => setTimeout(g, ms), ahora = () => performance.now() } = {}) {
  return (u, bytes, canal) => {
    const d = enlace.paso(u, bytes, canal, ahora());
    if (d === null) return true;
    const copia = bytes instanceof Uint8Array ? bytes.slice() : bytes;
    reloj(() => f(u, copia, canal), d);
    return true;
  };
}

// Los dos enlaces de esta página (bajada y subida) y el mando para las pruebas: window.mkwRedSim
export function crearRedSim(spec, { ahora = () => performance.now() } = {}) {
  if (!spec) return null;
  const azar = azarConSemilla(spec.semilla);
  const t = ahora();
  const baja = crearEnlace(spec.baja, { azar, picos: spec.picos, t0ms: t });
  const sube = crearEnlace(spec.sube, { azar: azarConSemilla(spec.semilla * 7919 + 1), picos: spec.picos, t0ms: t });
  const historia = [];
  return {
    spec, baja, sube,
    cortar(ms) { const t = ahora(); baja.cortar(ms, t); sube.cortar(ms, t); historia.push({ t: Math.round(t), que: 'corte', ms }); return true; },
    cambiar(x = {}) { if (x.baja) baja.cambiar(x.baja); if (x.sube) sube.cambiar(x.sube); historia.push({ t: Math.round(ahora()), que: 'cambio', x }); return true; },
    estado: () => ({ baja: { ...baja.tramo(), ...baja.cuenta, demoraMedia: Math.round(baja.cuenta.demoraMedia), demoraMax: Math.round(baja.cuenta.demoraMax) },
      sube: { ...sube.tramo(), ...sube.cuenta, demoraMedia: Math.round(sube.cuenta.demoraMedia), demoraMax: Math.round(sube.cuenta.demoraMax) },
      cortado: baja.cortado(ahora()), historia: historia.slice() }),
  };
}
