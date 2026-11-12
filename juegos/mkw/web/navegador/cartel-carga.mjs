// cartel-carga.mjs — qué está haciendo el juego mientras carga, en vivo (§276b, el dueño: «haz que cuando arranque se
// muestre mensaje de que se está haciendo para que el usuario no crea que está pegado en preparando gráficos»).
//
// Resumen: la cortina dice la FASE con su avance («Bajando el juego… 34 MB de 80», «Compilando el programa…»,
// «Armando los archivos…», «Arrancando el juego…», «Preparando gráficos: 412 de 729 (te faltan ~6 s)», «Casi listo…»)
// y abajo una señal de vida: un puntito que gira (animación de CSS, la mueve el compositor aunque la página esté ocupada)
// y los segundos que lleva. Si una fase pasa 15 s sin avanzar, una línea tranquila: «Esto tarda más en algunos
// teléfonos, sigue cargando». Es como el piloto de un tablero que parpadea mientras la máquina trabaja: si se queda
// fijo, algo se trabó; si parpadea, sigue.
//   faseCarga(x)          puro: de las marcas de arranque.mjs, lo que mira descargas.mjs y los pipelines → {clave, texto, pct}
//   crearMedidorPipes()   cuántos pipelines llegan por segundo (los últimos ~4 s) → segundos que faltan
//   crearCartelCarga({pintar, puede})   el controlador: mostrar(fn) / parar(); cada 250 ms pinta solo si algo cambió
// Solo texto y una barra: sin filtros encima del juego. ?cartelCarga=0 = los textos fijos de antes.

export const CALMA_MS = 15000;     // una fase sin avanzar este rato → la línea tranquila
export const CALMA = 'Esto tarda más en algunos teléfonos, sigue cargando';
const MB = 1048576;
const mb = b => { const x = b / MB; return x >= 10 ? String(Math.round(x)) : x.toFixed(1).replace('.', ','); };

/**
 * x = { m: marcas de arranque.mjs, descarga: descargas.mirar() o null, pipes: {llegados, meta} o null,
 *       restante: segundos que faltan de los pipelines o null, soloGraficos: true = la espera de los menús (§133) }
 * → { clave (la fase), texto, pct (0..100 o null = barra que va y viene), avance (un número que crece si avanza) }
 */
export function faseCarga({ m = {}, descarga = null, pipes = null, restante = null, soloGraficos = false, sinLista = true } = {}) {
  const graficos = () => {
    // (todavía sin saber cuántos: aurora dice la lista ~30 cuadros después de arrancar; sinLista = no hay lista)
    if (!pipes && !sinLista) return { clave: 'graficos', texto: 'Preparando gráficos…', pct: null, avance: 0 };
    if (pipes && pipes.meta > 0 && pipes.llegados < pipes.meta) {
      const falta = restante != null && Number.isFinite(restante) && restante >= 1 ? ` (te faltan ~${Math.ceil(restante)} s)` : '';
      return { clave: 'graficos', texto: `Preparando gráficos: ${pipes.llegados} de ${pipes.meta}${falta}`,
        pct: Math.min(99, Math.round(100 * pipes.llegados / pipes.meta)), avance: pipes.llegados };
    }
    return { clave: 'casi', texto: 'Casi listo…', pct: 100, avance: 0 };
  };
  if (soloGraficos) return graficos();
  // bajando: lo que falta de los archivos chicos o del programa (la ráfaga de descargas.mjs dice cuánto)
  const bajando = descarga && descarga.bajando && descarga.esperado > 0.5 * MB;
  if (!m.chicos || (bajando && !m.compilado)) {
    if (bajando) return { clave: 'bajando', texto: `Bajando el juego… ${mb(descarga.recibido)} MB de ${mb(descarga.esperado)}`,
      pct: Math.round(descarga.pct ?? 0), avance: Math.round(descarga.recibido / 65536) };
    return { clave: 'bajando', texto: 'Bajando el juego…', pct: null, avance: 0 };
  }
  if (!m.compilado) return { clave: 'compilando', texto: 'Compilando el programa…', pct: null, avance: 0 };
  if (!m.armado) return { clave: 'armando', texto: 'Armando los archivos…', pct: null, avance: 0 };
  if (!m.pantalla) return { clave: 'arrancando', texto: 'Arrancando el juego…', pct: null, avance: 0 };
  return graficos();
}

/** Cuántos pipelines llegan por segundo, con lo de los últimos ~4 s; restante(meta) = segundos que faltan (o null). */
export function crearMedidorPipes({ ahora = () => performance.now(), ventanaMs = 4000 } = {}) {
  const muestras = [];   // [ms, llegados]
  return {
    agregar(llegados) {
      const t = ahora();
      if (!muestras.length || muestras[muestras.length - 1][1] !== llegados || t - muestras[muestras.length - 1][0] > 500) muestras.push([t, llegados]);
      while (muestras.length > 2 && t - muestras[0][0] > ventanaMs) muestras.shift();
    },
    porSegundo() {
      if (muestras.length < 2) return 0;
      const [t0, a] = muestras[0], [t1, b] = muestras[muestras.length - 1];
      return t1 - t0 >= 1000 && b > a ? (b - a) * 1000 / (t1 - t0) : 0;
    },
    restante(meta, llegados) { const v = this.porSegundo(); return v > 0 && meta > llegados ? (meta - llegados) / v : null; },
  };
}

/**
 * El controlador. pintar({texto, pct, segundos, calma}) escribe en la cortina; puede() = la cortina está puesta y no
 * es un error (si no, no pinta). mostrar(fn): fn() → lo de faseCarga; parar(): deja de pintar y borra la señal de vida.
 */
export function crearCartelCarga({ pintar, puede = () => true, ahora = () => performance.now(), intervaloMs = 250, reloj = true } = {}) {
  let fn = null, desde = 0, tAvance = 0, ultimaClave = '', ultimoAvance = -1, ultimo = '', timer = null, nombre = '';
  function tic() {
    if (!fn) return null;
    let f;
    try { f = fn(); } catch { return null; }
    if (!f) return null;
    const t = ahora();
    if (f.clave !== ultimaClave || f.avance !== ultimoAvance) { tAvance = t; ultimaClave = f.clave; ultimoAvance = f.avance; }
    const p = { texto: f.texto, pct: f.pct, segundos: Math.floor((t - desde) / 1000), calma: t - tAvance >= CALMA_MS ? CALMA : '' };
    const firma = JSON.stringify(p);
    if (firma !== ultimo && puede()) { ultimo = firma; pintar(p); }
    return p;
  }
  return {
    mostrar(f, cual = '') {
      fn = f; nombre = cual; desde = tAvance = ahora(); ultimaClave = ''; ultimoAvance = -1; ultimo = '';
      tic();
      if (reloj && !timer && typeof setInterval === 'function') timer = setInterval(tic, intervaloMs);
    },
    parar(cual) {
      if (cual && cual !== nombre) return;   // (solo quien la puso la saca)
      fn = null; nombre = '';
      if (timer) { clearInterval(timer); timer = null; }
      try { pintar(null); } catch {}
    },
    tic,
    get activo() { return !!fn; },
    get cual() { return nombre; },
  };
}
