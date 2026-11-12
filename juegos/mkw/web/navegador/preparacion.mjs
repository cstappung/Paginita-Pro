// La preparación de la sala (§99): cuánto falta para que el navegador esté listo para jugar sin trabarse, en %.
//
// Resumen: al abrir la sala, el navegador baja el juego, lo arranca y compila los ~700 «pipelines» (los programas de
// dibujo de la tarjeta de video) de la lista del juego. Medido: si la anfitriona ve la lista de copas mientras eso pasa,
// la página se traba (7 trabas que suman 1,4 s, la peor de 0,54 s, en una primera visita). La sala espera con una
// cortina con barra de progreso hasta que todo eso terminó y el navegador quedó en calma, y recién ahí abre la lista.
// Etapas y su peso en la barra:
//   la página y el programa (manifiesto, archivos chicos, el programa listo) …… 0 → 35 %
//   los pipelines: los que ya llegaron de los que se pidieron (lo dice aurora) … 35 → 85 %
//   el juego en su primera pantalla (la de personajes) ……………………………… 90 %
//   calma: un segundo entero sin una tarea larga (≥ 50 ms) del navegador ……… 100 %
// Tope: a los 45 s de empezar (o 8 s después de lo demás sin calma) se da por lista igual: mejor un poco de traba que
// una sala que no empieza nunca.
// §117 (C1): el precalentado va con tope (aurora pide de a poco, como mucho N compilándose: lo dice su línea «con N
// compilándose como mucho»). Así ya no traba la página, y la sala no espera a que lleguen TODOS: basta la primera
// parte de la lista (PARTE_CON_TOPE; la lista va ordenada por el cuadro en que se usó cada uno: el título y los menús
// primero) y la calma. El resto sigue llegando de a poco mientras se elige la copa y el personaje. Sin tope
// (?precalentarTope=0) se espera todo, como antes.
//
// Uso:  const p = crearPreparacion();
//       p.linea(texto)            (cada línea que escribe el juego: se leen las de «[pipelines]»)
//       p.marcar('manifiesto') · p.marcar('chicos', 0..1) · p.marcar('programa') · p.marcar('pantalla')
//       p.larga(t)               (una tarea larga del navegador terminó en t, ms)
//       p.pct() → 0..100   p.lista() → true/false   p.estado → lo que sabe (para las pruebas)
export const CALMA_MS = 1000, TOPE_MS = 45000, TOPE_CALMA_MS = 8000, PARTE_CON_TOPE = 0.5;

export function crearPreparacion({ ahora = () => performance.now() } = {}) {
  const t0 = ahora();
  const e = { manifiesto: false, chicos: 0, programa: false, pipesTotal: 0, pipesLlegados: 0, pipesPedidos: false,
              pipesEnCamino: -1, pipesTope: 0, sinPipelines: false, pantalla: false, ultimaLarga: t0, desdeResto: null, lista: false, por: '' };
  // cuántos tienen que llegar: todos sin tope; con tope, la primera parte de la lista (§117)
  const pipesMeta = () => e.pipesTope > 0 ? Math.ceil(e.pipesTotal * PARTE_CON_TOPE) : e.pipesTotal;
  const pipesHechos = () => e.sinPipelines || (e.pipesTotal > 0 && e.pipesPedidos && e.pipesEnCamino === 0) ||
    (e.pipesTotal > 0 && e.pipesLlegados >= pipesMeta());
  function linea(texto) {
    if (typeof texto !== 'string' || !texto.startsWith('[pipelines]')) return;
    let m;
    if ((m = /precalentando (\d+)/.exec(texto))) { e.pipesTotal = +m[1]; if (!e.pipesTotal) e.sinPipelines = true; }
    if ((m = /con (\d+) compilándose como mucho/.exec(texto))) e.pipesTope = +m[1];   // §117: el precalentado con tope
    if (/ya están pedidos/.test(texto)) e.pipesPedidos = true;
    if ((m = /(\d+) llegaron/.exec(texto))) e.pipesLlegados += +m[1];
    if ((m = /(\d+) en camino/.exec(texto))) e.pipesEnCamino = +m[1];
  }
  function marcar(k, v = true) {
    if (k === 'chicos') e.chicos = Math.max(e.chicos, Math.min(1, Math.max(0, Number(v) || 0)));
    else if (k === 'sinPipelines') e.sinPipelines = !!v;
    else if (k in e) e[k] = !!v;
  }
  function pct() {
    if (lista()) return 100;
    let p = e.manifiesto ? 5 : 0;
    p += 20 * e.chicos;
    if (e.programa) p = Math.max(p, 35);
    if (e.programa || e.pipesTotal) {
      const frac = pipesHechos() ? 1 : e.pipesTotal ? Math.min(1, e.pipesLlegados / pipesMeta()) : 0;
      p = Math.max(p, 35 + 50 * frac);
    }
    if (e.pantalla && pipesHechos()) p = Math.max(p, 90);
    return Math.min(99, Math.round(p));
  }
  function lista() {
    if (e.lista) return true;
    const t = ahora();
    const resto = e.programa && pipesHechos() && e.pantalla;
    if (resto && e.desdeResto === null) e.desdeResto = t;
    if (resto && t - e.ultimaLarga >= CALMA_MS) e.por = 'calma';
    else if (resto && t - e.desdeResto >= TOPE_CALMA_MS) e.por = 'sin calma';
    else if (t - t0 >= TOPE_MS) e.por = 'tope';
    else return false;
    e.lista = true;
    return true;
  }
  return { linea, marcar, larga: t => { e.ultimaLarga = Math.max(e.ultimaLarga, t); }, pct, lista, get estado() { return { ...e, pipesMeta: pipesMeta(), pipesHechos: pipesHechos() }; } };
}

// §133 (U1, la parte de la página): antes de abrir Single Player o Local desde el menú de inicio, ¿ya llegaron los
// pipelines de los menús? (la primera parte de la lista, la misma meta que la sala). e = estado de crearPreparacion.
// Mientras aurora no dijo «precalentando N» todavía no se sabe (el juego recién arranca): se espera; si a los 30 cuadros
// no lo dijo, mkw.mjs marca «sinPipelines» y ya no hay nada que esperar. → { listo, pct (0..100) }
// §276: `parte` (0..1, opcional) = otra parte de la lista para los menús (sin ella, la misma meta que la sala)
export function graficosListos(e, parte = null) {
  if (!e || e.sinPipelines) return { listo: true, pct: 100 };
  if (parte > 0 && parte < 1 && e.pipesTotal > 0) {
    const meta = Math.ceil(e.pipesTotal * parte);
    if (e.pipesLlegados >= meta || e.pipesHechos) return { listo: true, pct: 100 };
    return { listo: false, pct: Math.min(99, Math.round(100 * e.pipesLlegados / meta)) };
  }
  if (e.pipesHechos) return { listo: true, pct: 100 };
  if (!(e.pipesTotal > 0)) return { listo: false, pct: 0 };
  return { listo: false, pct: Math.min(99, Math.round(100 * e.pipesLlegados / Math.max(1, e.pipesMeta))) };
}
