// arranque.mjs — la línea de tiempo del arranque (§276): cuándo terminó cada tramo, desde que el navegador empezó a
// abrir la página (performance.now() = 0) hasta que se puede jugar.
//
// Resumen: es un instrumento que solo mira (como un osciloscopio con varias puntas: cada «marca» es el instante en que
// una señal cambió). mkw.mjs llama a marcar('nombre') en cada paso del arranque; además, un vigía cada 50 ms mira lo que
// no tiene aviso propio (el primer cuadro del juego, su primera pantalla, la cortina, el menú de inicio, los pipelines)
// y, al final, se suman los tiempos de red del navegador (Resource Timing) de los archivos grandes: el programa
// (mkw.wasm), su cargador (mkw.js), el manifiesto, el paquete de diminutos y las semillas.
//   window.mkwArranque.informe() → { marcas: {nombre: ms}, red: {archivo: {inicio, fin, bytes, …}}, tramos: [...] }
// «[arranque] …» va al registro una vez, cuando se llega a jugable (o a los 180 s).
// No cambia nada del arranque: ?arranqueMarcas=0 = sin el vigía (las marcas siguen, son una asignación).

/** `leer()` → lo que el vigía mira cada 50 ms (ver mkw.mjs); `nota(texto)` = el registro. */
export function crearArranque({ leer = () => ({}), nota = () => {}, ahora = () => performance.now(), vigia = true } = {}) {
  const marcas = {};
  let anotado = false, reloj = null;
  const marcar = (nombre, t = ahora()) => { if (!(nombre in marcas)) marcas[nombre] = Math.round(t); return marcas[nombre]; };
  const pantallas = [];                // [ms, cuadro, sección, pantalla, lecturas del disco, ms esperando al disco, MB leídos] en cada cambio
  let ultimaPantalla = '';
  const cuadros = {};                  // el contador de imágenes del juego en cada marca del vigía (¿el tramo es de cuadros o de espera?)

  // el vigía: cada marca una sola vez (la primera vez que se cumple)
  const CONDICIONES = [
    ['primerCuadro', e => e.cuadros > 0],
    ['pantalla', e => e.seccion >= 0 && e.pagina >= 0],
    ['titulo', e => e.seccion === 0x3F || e.seccion === 0x41],
    ['inicioVisto', e => e.inicioVisto != null, e => e.inicioVisto],
    ['cortinaFuera', e => e.cortinaFuera != null, e => e.cortinaFuera],
    ['graficosMenus', e => e.graficosListos === true],
    ['pipelinesTodos', e => e.pipesTotal > 0 && e.pipesLlegados >= e.pipesTotal],
    ['elegido', e => e.elegido != null, e => e.elegido],
    ['esperaGraficosFin', e => e.esperaGraficosFin != null, e => e.esperaGraficosFin],
    ['unJugador', e => e.seccion === 0x48 && e.pagina >= 0],
    ['carrera', e => e.etapa === 2],
  ];
  // «jugable» = lo primero que la persona puede tocar: el menú de inicio, o la cortina fuera con el juego en pantalla
  const jugable = () => marcas.inicioVisto ?? (marcas.cortinaFuera != null && marcas.pantalla != null ? Math.max(marcas.cortinaFuera, marcas.pantalla) : null);
  function tic() {
    let e = {};
    try { e = leer() || {}; } catch {}
    const t = ahora();
    // cada cambio de sección o de pantalla del juego, con su hora y su cuadro (para ver qué hace el juego al arrancar)
    const sp = `${e.seccion}/${e.pagina}`;
    if (sp !== ultimaPantalla && pantallas.length < 60) { ultimaPantalla = sp; pantallas.push([Math.round(t), e.cuadros, e.seccion, e.pagina, e.lecturas ?? null, e.esperaDisco ?? null, e.mb ?? null]); }
    for (const [nombre, cumple, cuando] of CONDICIONES) {
      if (nombre in marcas) continue;
      try { if (cumple(e)) { marcar(nombre, cuando ? cuando(e) : t); cuadros[nombre] = e.cuadros; } } catch {}
    }
    const j = jugable();
    if (j != null) marcar('jugable', j);
    // se deja de mirar con todo lo del menú (o con la carrera) o a los 180 s
    const fin = marcas.carrera != null || marcas.unJugador != null || (j != null && marcas.pipelinesTodos != null) || t > 180000;
    if (j != null && !anotado && (marcas.graficosMenus != null || t > 180000)) { anotado = true; nota(`[arranque] ${resumen()}`); }
    if (fin && reloj) { clearInterval(reloj); reloj = null; if (!anotado) { anotado = true; nota(`[arranque] ${resumen()}`); } }
  }
  if (vigia && typeof setInterval === 'function') reloj = setInterval(tic, 50);

  // los tiempos de red del navegador para los archivos que pesan en el arranque
  const ARCHIVOS = [['programa', /\/mkw\.wasm(\?|$)/], ['cargador', /\/mkw\.js(\?|$)/], ['manifiesto', /\/manifiesto\.json(\?|$)/],
    ['diminutos', /\/diminutos\.bin(\?|$)/], ['bloques', /\/bloques[^/]*\.json(\?|$)/], ['pipelines', /\/pipelines[^/]*\.bin(\?|$)/]];
  function red() {
    const r = {};
    let entradas = [];
    try { entradas = performance.getEntriesByType('resource'); } catch {}
    for (const [k, re] of ARCHIVOS) {
      const w = entradas.find(x => re.test(x.name));
      if (w) r[k] = { inicio: Math.round(w.startTime), fin: Math.round(w.responseEnd), ms: Math.round(w.responseEnd - w.startTime),
        bytes: w.transferSize, comprimido: w.encodedBodySize, abierto: w.decodedBodySize };
    }
    // todo lo demás (los módulos de la página, los lotes del disco): cuántos pedidos y cuántos bytes hasta «jugable»
    const j = jugable() ?? Infinity;
    const antes = entradas.filter(x => x.responseEnd <= j);
    r.antesDeJugable = { pedidos: antes.length, mb: +(antes.reduce((s, x) => s + (x.transferSize || 0), 0) / 1048576).toFixed(2),
      modulos: antes.filter(x => /\.mjs(\?|$)/.test(x.name)).length,
      finModulos: Math.round(Math.max(0, ...antes.filter(x => /\.mjs(\?|$)/.test(x.name)).map(x => x.responseEnd))) };
    return r;
  }
  // los tramos en orden (lo que dura cada uno, desde la marca anterior que exista)
  const ORDEN = ['modulo', 'gpu', 'manifiesto', 'disco', 'diminutos', 'chicos', 'cargador', 'compiladoTemprano', 'compilado', 'armado', 'programa', 'primerCuadro', 'arranqueDePrisa',
    'pantalla', 'titulo', 'cortinaFuera', 'inicioVisto', 'jugable', 'graficosMenus', 'elegido', 'esperaGraficosFin', 'unJugador', 'pipelinesTodos', 'carrera'];
  function tramos() {
    const t = []; let antes = 0;
    for (const k of ORDEN) if (marcas[k] != null) { t.push([k, marcas[k], marcas[k] - antes]); antes = Math.max(antes, marcas[k]); }
    return t;
  }
  function resumen() { return tramos().map(([k, ms]) => `${k} ${(ms / 1000).toFixed(2)}`).join(' · '); }
  const informe = () => ({ marcas: { ...marcas }, cuadros: { ...cuadros }, pantallas: pantallas.slice(), red: red(), tramos: tramos(), jugable: jugable() });
  return { marcar, marcas, informe, resumen, tic, parar: () => { if (reloj) clearInterval(reloj); reloj = null; } };
}
