// Gráficos opcionales y el medidor de fps y ping — bitácora §107 (pedido del dueño: «opciones gráficas tipo opcionales
// de display ping ms, fps, antialiasing, subirle los gráficos», «fps cap? vi que se podía como hasta 180 fps»).
//
// Resumen: el motor del port (WiiCompiled + aurora) ya trae dos perillas de imagen que se leen de su Config.toml al
// arrancar, y la página solo tiene que escribirlas (mkw.mjs arma ese archivo antes de main()):
//   - «Resolución interna» (resolution_multiplier: 1, 1,5, 2, 3, 4): dibuja el juego a esa cantidad de veces la
//     resolución de la Wii y lo achica a la pantalla. Más nítido y con los bordes suaves: es el ANTIALIASING de mejor
//     calidad (supermuestreo: cada pixel de la pantalla sale del promedio de varios). El motor no trae otro.
//     Como medir con un osciloscopio a más muestras por segundo: la curva sale más fina, pero hay que procesar más.
//   - «Fluidez» (frame_interpolation_fps: 120 o 180): el juego SIGUE calculando 60 cuadros por segundo (su física está
//     hecha para 60, no se puede más), y el motor dibuja imágenes intermedias entre uno y otro. En un monitor de 144 o
//     240 Hz se ve más suave. Es solo la imagen: en la sala no cambia nada de la carrera (las consolas siguen iguales).
//   - «Resolución de salida» (§108: 1920×1080, 1600×900, 1280×720, 960×540): el tamaño de la imagen FINAL que se manda a
//     la pantalla, para BAJARLA y ganar fps en una tarjeta de video justa. El juego ya dibuja a lo mínimo que acepta el
//     motor (1× = 640×528, la de la Wii); lo que sí cuesta en un monitor grande es agrandar esa imagen al tamaño de la
//     pantalla (con un 4K y la escala de Windows al 150 %, el lienzo mide 3840×2160). Esto no pasa por el motor: SDL3 le
//     da al lienzo el tamaño de su recuadro en la página × devicePixelRatio (SDL_emscriptenevents.c, `external_size`, con
//     SDL_WINDOW_HIGH_PIXEL_DENSITY de aurora), y lo mide con getBoundingClientRect. `limitarSalida` le contesta a esa
//     pregunta un recuadro más chico (el mismo 16:9), así el lienzo queda de a lo más esa altura, y el navegador lo estira
//     a la pantalla al mostrarlo (eso es gratis: lo hace al componer). Se aplica en el momento (un aviso `resize`). Solo
//     ayuda si lo que frena es la tarjeta de video; si es el procesador, no cambia los fps.
//     Trampa: el ratón del menú interno del motor (ImGui) se mide con ese mismo recuadro; la página no lo usa.
// Las dos primeras cuestan tarjeta de video (y algo de procesador), así que vienen APAGADAS (lo de siempre: 1× y 60). Se guardan
// en este navegador («mkw.graficos») y se aplican al reiniciar el juego (el motor las lee una vez, al arrancar). Con los
// valores de siempre no se escribe nada nuevo en el Config.toml: el juego arranca exactamente igual que antes.
// Además, dos medidores que se prenden aparte: los cuadros por segundo del juego y, en la sala, el ping (ida y vuelta, en
// ms) con cada piloto, del lockstep. Medirlos no cuesta (la página ya lo mide), pero MOSTRARLOS sí un poco: cualquier
// cosa encima del juego obliga al navegador a componer cada cuadro (el lienzo ya no va directo a la pantalla, §98.9).
// Por eso también vienen apagados y el panel lo dice.
//
// Uso:  const g = leerGraficos();  lineasVideo(g) → líneas extra de [video] para el Config.toml
//       montarGraficos(caja, { reiniciar, enSala })        (el panel en Avanzado → Gráficos)
//       montarMedidor(el, { fps: () => n, rtt: () => ({uid: ms}), nombres: () => ({uid: nombre}), yo, jugando: () => bool })

export const ESCALAS = [1, 1.5, 2, 3, 4];            // las que acepta el motor (también 6 y 8: demasiado para un navegador)
export const FLUIDECES = [0, 120, 180];              // 0 = lo de siempre (60); 240 ya no existe en el motor (pasa a 180)
export const SALIDAS = [0, 1080, 900, 720, 540, 360];   // alto máximo del lienzo en pixeles (0 = el de la pantalla, lo de siempre)
// (verDetalle, §114: el medidor dice además cuánto tarda el juego por cuadro, la tarjeta de video, a cuántos Hz va la
// pantalla y el tamaño del lienzo, y QUÉ FRENA; para ver por qué un teléfono no llega a 60)
// (n8, §219: «Dibujar a 30 y mostrar 60»: 0 = no, 'auto' = la vigía de n8.mjs decide, 2 = siempre en la carrera;
// por omisión 'auto' (el dueño, 2026-11-04: «permito que se prenda N8 en automatico»; la vigía lo prende solo en el
// aparato que no llega a 60 por la CPU y lo apaga sola si no mejora); quien eligió «No» a mano (0 guardado) lo mantiene;
// 1 = «30 parejas»: dibuja uno de cada dos sin inventar el del medio (medido en el Oppo del dueño, 2026-11-07: 30 fijos,
// la lógica a 60, el procesador de ~31 a ~23 ms por cuadro, «se ve bien»). La lógica va siempre a 60 en las cuatro)
// §252 (G11): los efectos que se pueden apagar, [bit de quitar, nombre en el panel]
export const EFECTOS = [[1, 'Brillo (bloom)'], [2, 'Desenfoque de lo lejano'], [4, 'Sombras por volumen'], [8, 'Mapa de luz'], [16, 'Partículas']];
// §254 (G13): el ajuste rápido «Liviano» para un teléfono con la tarjeta justa: los cuatro efectos de la escena apagados
// (las partículas se quedan: dicen el color del miniturbo), las texturas a la mitad y la salida en 960×540
export const LIVIANO = { quitar: 15, texturas: 1, salida: 540 };
export const GRAFICOS = { escala: 1, fluidez: 0, salida: 0, verFps: false, verPing: false, verDetalle: false, n8: 'auto', quitar: 0, texturas: 0, verGrafico: false };
// §256 (G16): verGrafico = el medidor muestra el tiempo de cada imagen en un gráfico en vivo y el 1 % bajo (imagenes-vista.mjs)
// §252 (G11): quitar = qué efectos de la escena no se dibujan (bits: 1 brillo, 2 profundidad de campo, 4 sombras por
// volumen, 8 mapa de luz); 0 = todo, como siempre
export const N8_OPCIONES = [0, 'auto', 1, 2];
// La resolución interna en pixeles: la de la Wii (640×528) por la escala
export const pixelesInternos = v => `${Math.round(640 * v)}×${Math.round(528 * v)}`;
const CLAVE = 'mkw.graficos';

// Las opciones guardadas, revisadas (un valor que el motor no acepta vuelve al de siempre)
export function normalizar(g = {}) {
  return {
    escala: ESCALAS.includes(Number(g.escala)) ? Number(g.escala) : 1,
    fluidez: FLUIDECES.includes(Number(g.fluidez)) ? Number(g.fluidez) : 0,
    salida: SALIDAS.includes(Number(g.salida)) ? Number(g.salida) : 0,
    verFps: g.verFps === true,
    verPing: g.verPing === true,
    verDetalle: g.verDetalle === true,
    // (solo un 0 guardado es «No»: sin nada, o con algo que no se entiende, vale Automático)
    n8: g.n8 === 0 || g.n8 === '0' ? 0 : Number(g.n8) === 2 ? 2 : g.n8 === 1 || g.n8 === '1' ? 1 : 'auto',
    quitar: (Number(g.quitar) | 0) & 31,
    texturas: [0, 1, 2].includes(Number(g.texturas)) ? Number(g.texturas) : 0,   // §253 (G12): 0 completas, 1 la mitad, 2 un cuarto
    verGrafico: g.verGrafico === true,                                         // §256 (G16)
  };
}
// (§126: el medidor lo lee cada segundo: si el texto guardado no cambió, se devuelve una copia de lo ya leído, sin
// volver a hacer JSON.parse)
let crudoAntes = null, leidoAntes = null, almacenAntes = null;
export function leerGraficos(almacen = globalThis.localStorage) {
  try {
    const crudo = almacen.getItem(CLAVE);
    if (almacen === almacenAntes && crudo === crudoAntes && leidoAntes) return { ...leidoAntes };
    const g = normalizar(JSON.parse(crudo) || {});
    crudoAntes = crudo; leidoAntes = g; almacenAntes = almacen;
    return { ...g };
  } catch { return { ...GRAFICOS }; }
}
export function guardarGraficos(g, almacen = globalThis.localStorage) {
  const n = normalizar(g);
  try { almacen.setItem(CLAVE, JSON.stringify(n)); } catch {}
  return n;
}

// Las líneas de [video] del Config.toml: solo lo que cambia (con lo de siempre, ninguna)
export function lineasVideo(g) {
  const n = normalizar(g), l = [];
  if (n.escala !== 1) l.push(`resolution_multiplier = ${n.escala.toFixed(1)}`);
  if (n.fluidez) l.push(`frame_interpolation_fps = ${n.fluidez}`);
  return l;
}

// §114: qué frena el juego, con los números del medidor (puro: lo prueba el banco). Un cuadro tiene 16,7 ms (60 por
// segundo); si se pasa aunque sea un poco, la pantalla lo muestra en el refresco siguiente: de ahí los «30 fps justos».
//   trabajo = ms por cuadro que el juego NO espera (su cálculo + lo que la página hace en medio);
//   gpu = ms que tarda la tarjeta de video en terminar lo de un cuadro; hz = refrescos por segundo de la pantalla
// logica (§124) = cuadros de LÓGICA por segundo en la carrera (los que el juego calcula, se dibujen o no; null fuera de
// la carrera): si la lógica va a 60 y se dibujan menos, el juego está salteando dibujos para no atrasarse
export function queFrena({ fps = null, trabajo = null, gpu = null, hz = null, logica = null } = {}) {
  if (!Number.isFinite(fps) || fps <= 0) return '';
  if (fps >= 57) return 'nada (va a 60)';
  if (Number.isFinite(logica) && logica >= 57) return `el dibujo: la carrera se calcula a 60 pero se dibujan ${Math.round(fps)} (el juego saltea dibujos para no atrasarse)`;
  if (Number.isFinite(hz) && hz > 0 && hz < 50) return `la pantalla: refresca a ${Math.round(hz)} Hz (¿ahorro de batería?)`;
  // §115: los dos números se incluyen el uno al otro (el juego espera a la tarjeta dentro de su cuadro y la tarjeta
  // espera al juego); si los dos pasan el cuadro, no se sabe cuál frena. Y bajar la salida no ayuda: aurora dibuja
  // siempre en 640×528 y solo estira la imagen al lienzo.
  const gpuAlto = Number.isFinite(gpu) && gpu > 14, juegoAlto = Number.isFinite(trabajo) && trabajo > 14.5;
  if (gpuAlto && juegoAlto) return 'el dibujo de cada cuadro (el juego y la tarjeta tardan juntos: falta separar cuál)';
  if (gpuAlto) return 'la tarjeta de video';
  if (juegoAlto) return 'el procesador: el juego no alcanza a calcular un cuadro en 16,7 ms';
  return 'el ritmo (ni el procesador ni la tarjeta están al tope)';
}

// §149 (H2): el presupuesto de la gama media, como el de potencia de un diseño: cada pieza con su meta en ms medida en el
// Oppo (el teléfono que hay), elegida para que en un teléfono medio (CPU ×3,5, tarjeta ×5–8) cada una entre en 12 ms.
// Hoy el juego, aurora, el sonido y el disco van en un solo hilo: esas piezas se miden juntas («juntas») hasta que los
// hilos (H4) las separen; las que no se pueden medir todavía van como «sin medir». → [{ pieza, ms, meta, estado, nota }]
export const METAS_PRESUPUESTO = [
  ['juego', 'Hilo del juego: la carrera y el recorrido del dibujo', 3.3],
  ['dibujo', 'Hilo de dibujo: aurora y WebGPU', 3.3],
  ['sonidoDisco', 'Sonido y disco', 1],
  ['ayudantes', 'Ayudantes: partículas, animación y 2D (repartidos)', 2],
  ['pagina', 'La página: interfaz, mandos, red y sala', 1],
  ['tarjeta', 'La tarjeta de video', 2],
];
export function presupuesto({ juegoMs = null, tarjetaMs = null, paginaMs = null } = {}) {
  const r = n => (n < 1 ? Math.round(n * 100) / 100 : Math.round(n * 10) / 10);   // (lo chico, con centésimas)
  return METAS_PRESUPUESTO.map(([id, pieza, meta]) => {
    let ms = null, nota = '';
    if (id === 'juego') { ms = juegoMs; nota = 'hoy incluye el dibujo, el sonido, el disco y la espera a la tarjeta (un solo hilo)'; }
    else if (id === 'dibujo' || id === 'sonidoDisco' || id === 'ayudantes') nota = 'sin medir: hoy va dentro del hilo del juego';
    else if (id === 'pagina') { ms = paginaMs; nota = 'los bucles de cada refresco de la página (relojMonitor)'; }
    else if (id === 'tarjeta') { ms = tarjetaMs; nota = 'hasta que la tarjeta termina el cuadro (con «Mostrar qué frena»)'; }
    const medido = Number.isFinite(ms);
    return { id, pieza, meta, ms: medido ? r(ms) : null, estado: !medido ? 'sin medir' : ms <= meta ? 'bien' : 'mal', nota };
  });
}

// §137 (E6): ¿se ven parejos los 60 cuadros del juego en este monitor? En 60, 120, 180 o 240 Hz cada cuadro dura los
// mismos refrescos; en 75, 144 o 165 Hz unos duran uno más que otros (un temblor leve que ninguna optimización arregla).
// → '' si es parejo (o no se sabe); si no, el aviso corto para el medidor
export function notaHz(hz) {
  if (!Number.isFinite(hz) || hz < 50) return '';
  const k = Math.round(hz / 60);
  if (k >= 1 && Math.abs(hz - 60 * k) / (60 * k) <= 0.015) return '';
  return `${Math.round(hz)} Hz no es múltiplo de 60: el juego no se ve del todo parejo (en 60, 120, 180 o 240 Hz sí)`;
}

// El texto del medidor: «60 fps · 📶 Juan 35 ms · Ana 80 ms» (puro: lo prueba el banco); con el detalle (§114):
// «31 fps · juego 26 ms · video 5 ms · 120 Hz · 1280×720 · frena: el procesador…»
export function textoMedidor({ fps = null, rtt = {}, nombres = {}, yo = null, verFps = true, verPing = true, verDetalle = false, detalle = {},
                               verGrafico = false, imagenes = null } = {}) {
  const partes = [];
  if ((verFps || verDetalle || verGrafico) && Number.isFinite(fps)) partes.push(`${Math.round(fps)} fps`);
  // §256 (G16): de las últimas imágenes a la vista, el 1 % bajo y qué fracción de los fps a la vista es (meta 95 %)
  if ((verGrafico || verDetalle) && imagenes?.imagenes >= 60 && Number.isFinite(imagenes.bajo1))
    partes.push(`1 % bajo ${Math.round(imagenes.bajo1)} (${Math.round(100 * imagenes.razon)} %)`);
  if (verDetalle) {
    const { trabajo, gpu, hz, lienzo, logica } = detalle || {};
    if (Number.isFinite(logica)) partes.push(`lógica ${Math.round(logica)}`);   // (§124: solo en la carrera)
    if (Number.isFinite(trabajo)) partes.push(`juego ${trabajo.toFixed(1)} ms`);
    if (Number.isFinite(gpu)) partes.push(`video ${gpu.toFixed(1)} ms`);
    if (Number.isFinite(hz) && hz > 0) partes.push(`${Math.round(hz)} Hz`);
    if (lienzo) partes.push(lienzo);
    const f = queFrena({ fps, trabajo, gpu, hz, logica });
    if (f) partes.push(`frena: ${f}`);
    const n = notaHz(hz);                       // (§137: el monitor de 75/144/165 Hz)
    if (n) partes.push(n);
  }
  if (verPing) {
    const otros = Object.entries(rtt || {}).filter(([u, ms]) => u !== yo && Number.isFinite(ms));
    if (otros.length) {
      const corto = u => String(nombres?.[u] || 'piloto').split(/\s+/)[0].slice(0, 12);
      partes.push('📶 ' + otros.sort((a, b) => b[1] - a[1]).map(([u, ms]) => `${corto(u)} ${Math.round(ms)} ms`).join(' · '));
    }
  }
  return partes.join(' · ');
}

// El recuadro que se le contesta a SDL3 con un tope de salida: el mismo, achicado para que alto × dpr ≤ tope (puro)
export function medidaLimitada(ancho, alto, tope, dpr = 1) {
  if (!tope || !(alto > 0) || alto * dpr <= tope) return [ancho, alto];
  const k = tope / (alto * dpr);
  return [ancho * k, alto * k];
}

// Instala el tope en el lienzo (getBoundingClientRect propio de ese elemento: nada más de la página cambia).
// fijar(tope) lo cambia en el momento: un aviso `resize` hace que SDL3 vuelva a medir.
export function limitarSalida(lienzo, { tope = 0, dpr = () => globalThis.devicePixelRatio || 1, ventana = globalThis } = {}) {
  if (!lienzo) return null;
  const original = lienzo.getBoundingClientRect.bind(lienzo);
  let actual = Number(tope) || 0;
  lienzo.getBoundingClientRect = () => {
    const r = original();
    if (!actual) return r;
    const [w, h] = medidaLimitada(r.width, r.height, actual, dpr());
    if (w === r.width && h === r.height) return r;
    return { x: r.x, y: r.y, left: r.left, top: r.top, width: w, height: h, right: r.left + w, bottom: r.top + h, toJSON() { return this; } };
  };
  return {
    get tope() { return actual; },
    fijar(t) { t = Number(t) || 0; if (t === actual) return; actual = t; try { ventana.dispatchEvent(new Event('resize')); } catch {} },
  };
}

const el = (etiqueta, props = {}, ...hijos) => { const e = Object.assign(document.createElement(etiqueta), props); e.append(...hijos); return e; };

// El panel: tres selectores (resolución interna, fluidez, resolución de salida), dos casillas (fps, ping) y «Reiniciar el juego» si algo cambió
export function montarGraficos(caja, { reiniciar = () => location.reload(), enSala = false, alCambiar = () => {}, alSalida = () => {}, alQuitar = () => {}, alTexturas = () => {}, alImagen = () => {}, avisosLag = null } = {}) {
  if (!caja) return null;
  const alArrancar = leerGraficos();               // lo que el juego leyó al arrancar (para saber si hay que reiniciar)
  let g = { ...alArrancar };
  const escala = el('select', { id: 'graficosEscala' },
    ...ESCALAS.map(v => el('option', { value: String(v), textContent: v === 1 ? `1× · ${pixelesInternos(1)} (la de la Wii, lo de siempre)`
      : `${String(v).replace('.', ',')}× · ${pixelesInternos(v)} — más nítido y bordes suaves` })));
  const salida = el('select', { id: 'graficosSalida' },
    ...SALIDAS.map(v => el('option', { value: String(v), textContent: v ? `${Math.round(v * 16 / 9)}×${v}` + (v <= 720 ? ' — más fps en una tarjeta justa' : '')
      : 'La de tu pantalla (lo de siempre)' })));
  const fluidez = el('select', { id: 'graficosFluidez' },
    el('option', { value: '0', textContent: '60 (lo de siempre)' }),
    el('option', { value: '120', textContent: '120 — imágenes intermedias (monitor de 120 Hz o más)' }),
    el('option', { value: '180', textContent: '180 — imágenes intermedias (monitor de 180 Hz o más)' }));
  // §255 (G15): «Imagen», cómo se muestra lo que el juego calcula; se aplica en el momento, también en plena carrera
  // (n8_nativo.cpp cambia el modo en el cuadro siguiente que se dibuja). La lógica va siempre a 60 en las cuatro
  const n8 = el('select', { id: 'graficosN8' },
    el('option', { value: 'auto', textContent: 'Automático (recomendado)' }),
    el('option', { value: '1', textContent: '30 parejas (sin tirones)' }),
    el('option', { value: '0', textContent: '60 siempre' }),
    el('option', { value: '2', textContent: '30 con imagen intermedia' }));
  const texturas = el('select', { id: 'graficosTexturas' },
    el('option', { value: '0', textContent: 'Completas (lo de siempre)' }),
    el('option', { value: '1', textContent: 'La mitad — menos memoria y trabajo para la tarjeta' }),
    el('option', { value: '2', textContent: 'Un cuarto — para un teléfono muy justo' }));
  const verFps = el('input', { type: 'checkbox', id: 'graficosFps' });
  const verPing = el('input', { type: 'checkbox', id: 'graficosPing' });
  const verDetalle = el('input', { type: 'checkbox', id: 'graficosDetalle' });
  const verGrafico = el('input', { type: 'checkbox', id: 'graficosGrafico' });   // §256 (G16)
  // §262: «Mostrar avisos de conexión y lag» (avisos-lag.mjs: su propia clave, mkw.avisosLag; se aplica en el momento;
  // con ?avisosLag=0|1 queda fija y gris)
  const verAvisos = el('input', { type: 'checkbox', id: 'graficosAvisosLag', checked: avisosLag ? avisosLag.prendidos() : true,
    disabled: !avisosLag || avisosLag.forzado });
  verAvisos.addEventListener('change', () => avisosLag?.fijar(verAvisos.checked));
  // §252 (G11): una casilla por efecto; marcada = se dibuja (lo de siempre). Cada bit de g.quitar es una casilla sin marcar.
  const efectos = EFECTOS.map(([bit, nombre]) => ({ bit, nombre, c: el('input', { type: 'checkbox', id: `graficosEfecto${bit}` }) }));
  const liviano = el('button', { type: 'button', className: 'boton', id: 'graficosLiviano', textContent: '⚡ Liviano' });
  const completo = el('button', { type: 'button', className: 'boton', id: 'graficosCompleto', textContent: '↺ Todo como venía' });
  const aviso = el('p', { className: 'aviso', id: 'graficosAviso', hidden: true });
  const boton = el('button', { type: 'button', className: 'boton', id: 'graficosReiniciar', textContent: 'Reiniciar el juego ahora', hidden: true });
  boton.onclick = () => reiniciar();
  const pinta = () => {
    escala.value = String(g.escala); fluidez.value = String(g.fluidez); salida.value = String(g.salida); n8.value = String(g.n8); texturas.value = String(g.texturas); verFps.checked = g.verFps; verPing.checked = g.verPing; verDetalle.checked = g.verDetalle; verGrafico.checked = g.verGrafico;
    for (const e of efectos) e.c.checked = !(g.quitar & e.bit);
    const pendiente = g.escala !== alArrancar.escala || g.fluidez !== alArrancar.fluidez;   // (§255: la imagen, «n8», ya no pide reiniciar)
    aviso.hidden = !pendiente; boton.hidden = !pendiente;
    aviso.textContent = pendiente ? 'Se aplica al reiniciar el juego (el motor lo lee al arrancar).' +
      (enSala ? ' En la sala, mejor entre carreras: al volver sigues en la siguiente.' : '') : '';
  };
  const cambio = () => {
    const antes = g.salida, quitarAntes = g.quitar, texturasAntes = g.texturas, imagenAntes = g.n8;
    const quitar = efectos.reduce((m, e) => e.c.checked ? m : m | e.bit, 0);
    g = guardarGraficos({ escala: escala.value, fluidez: fluidez.value, salida: salida.value, n8: n8.value, verFps: verFps.checked, verPing: verPing.checked, verDetalle: verDetalle.checked, quitar, texturas: texturas.value, verGrafico: verGrafico.checked });
    pinta(); alCambiar(g);
    if (g.salida !== antes) alSalida(g.salida);            // (la salida se aplica en el momento, sin reiniciar)
    if (g.quitar !== quitarAntes) alQuitar(g.quitar);         // (los efectos también, en el momento)
    if (g.texturas !== texturasAntes) alTexturas(g.texturas); // (las texturas, desde las que se carguen después)
    if (g.n8 !== imagenAntes) alImagen(g.n8);               // (§255, G15: la imagen, en el cuadro siguiente)
  };
  for (const c of [escala, fluidez, salida, n8, verFps, verPing, verDetalle, verGrafico, texturas, ...efectos.map(e => e.c)]) c.addEventListener('change', cambio);
  // (G13) los dos botones escriben en los controles y pasan por el mismo «cambio»: guardar, aplicar y avisar
  const poner = ({ quitar, texturas: t, salida: sal }) => {
    for (const e of efectos) e.c.checked = !(quitar & e.bit);
    texturas.value = String(t); salida.value = String(sal); cambio();
  };
  liviano.onclick = () => poner({ ...LIVIANO, quitar: LIVIANO.quitar | (g.quitar & 16) });   // (las partículas, como estén)
  completo.onclick = () => poner({ quitar: 0, texturas: 0, salida: 0 });
  caja.replaceChildren(
    el('div', { className: 'fila' }, el('label', { htmlFor: 'graficosEscala', textContent: 'Resolución interna' }), escala),
    el('div', { className: 'fila' }, el('label', { htmlFor: 'graficosFluidez', textContent: 'Fluidez (imágenes por segundo)' }), fluidez),
    el('p', { className: 'nota-graficos', textContent: 'El juego siempre calcula 60 cuadros por segundo; la fluidez dibuja imágenes intermedias ' +
      'para monitores rápidos (solo la imagen: en la sala no cambia la carrera). Las dos piden más a la tarjeta de video: ' +
      'si el juego baja de 60, vuelve a lo de siempre' + (enSala ? ' (en la sala, una PC que no alcanza frena a todos).' : '.') }),
    // §144 (E6): por qué con algunos monitores se ve un temblor leve que ninguna optimización arregla
    el('p', { className: 'nota-graficos', id: 'notaHz', textContent: 'Tu monitor: con 60, 120, 180 o 240 Hz el juego se ve parejo. ' +
      'Con 75, 144 o 165 Hz unos cuadros duran un refresco más que otros (un temblor leve que no es falta de rendimiento): ' +
      'si tu monitor lo permite, ponlo en 120 Hz.' }),
    el('div', { className: 'fila' }, el('label', { htmlFor: 'graficosSalida', textContent: 'Resolución de salida' }), salida),
    el('p', { className: 'nota-graficos', textContent: 'El tamaño de la imagen que se manda a tu pantalla. Bajarla ayuda si tu tarjeta de video ' +
      'es justa (sobre todo con un monitor grande); se ve un poco más borrosa. Se aplica en el momento.' }),
    el('div', { className: 'fila' }, el('label', { htmlFor: 'graficosN8', textContent: 'Imagen' }), n8),
    // §263 (el crítico): los nombres cortos en el selector y una frase; lo largo, plegado en «Más detalles»
    el('div', { className: 'nota-graficos', id: 'notaImagen' },
      el('span', { textContent: 'Si el juego va a tirones, elige «30 parejas». El juego siempre calcula 60 cuadros por segundo (la carrera ' +
        'es justa para todos): esto cambia solo lo que ves, en el momento. ' }),
      el('details', { className: 'mas-detalles' }, el('summary', { textContent: 'Más detalles' }), el('span', { textContent:
      '«60 siempre» dibuja todos. «30 parejas» dibuja uno de cada dos: 30 imágenes fijas, más parejo que 40 o 50 que suben y bajan ' +
      'en un aparato que no llega a 60. «30 con imagen intermedia» dibuja a 30 y el motor inventa la del medio: se ve a 60, ' +
      'a cambio de unos 17 ms más de demora y del marcador a 30; ayuda si tu procesador no alcanza, no si frena la tarjeta ' +
      'de video. «Automático» se queda en 60 y prueba lo que ayude solo si tu aparato no llega (si no mejora, vuelve a 60).' }))),
    el('div', { className: 'fila', id: 'graficosRapido' }, liviano, completo),
    el('p', { className: 'nota-graficos', textContent: '«Liviano» es para un teléfono cuya tarjeta de video no da: apaga los efectos ' +
      'de la escena, usa las texturas a la mitad y manda la imagen en 960×540. La carrera es la misma; cambia cómo se ve. ' +
      '«Todo como venía» vuelve a lo de siempre.' }),
    el('div', { className: 'fila' }, el('label', { htmlFor: 'graficosTexturas', textContent: 'Texturas' }), texturas),
    el('p', { className: 'nota-graficos', textContent: 'Usa las versiones chicas que el juego ya trae para ver de lejos: ' +
      'se ve algo más borroso de cerca. Ayuda a un teléfono con poca memoria o una tarjeta justa. Vale desde la próxima pista.' }),
    el('div', { className: 'fila', id: 'graficosEfectos' }, ...efectos.map(e => el('label', {}, e.c, ' ' + e.nombre))),
    el('p', { className: 'nota-graficos', textContent: 'Los efectos de la escena, todos prendidos por omisión. Apagarlos ayuda solo si ' +
      'frena la tarjeta de video (un teléfono justo): la carrera es la misma, cambia solo cómo se ve. Se aplica en el momento.' }),
    el('div', { className: 'fila' }, el('label', {}, verFps, ' Mostrar los fps'), el('label', {}, verPing, ' Mostrar el ping (en la sala)')),
    el('div', { className: 'fila' }, el('label', {}, verDetalle, ' Mostrar qué frena (cuánto tarda el juego y la tarjeta de video por cuadro, los Hz de la pantalla)')),
    el('div', { className: 'fila' }, el('label', {}, verGrafico, ' Mostrar el tiempo de cada imagen (un gráfico en vivo: plano = suave, cada pico = un tirón; y el «1 % bajo»)')),
    el('p', { className: 'nota-graficos', textContent: 'Los fps y el ping van en un recuadro chico arriba a la izquierda; en una PC justa, ' +
      'tener algo encima del juego cuesta un poco.' }),
    el('div', { className: 'fila' }, el('label', {}, verAvisos, ' Mostrar avisos de conexión y lag (en la sala: 📶 «va lento», 🔴 «llega por otro piloto», «la sala va lenta»)')),
    el('p', { className: 'nota-graficos', id: 'notaAvisosLag', textContent: 'Apagado, esos carteles no salen; la carrera y la red ' +
      'siguen igual. Los avisos graves (se cortó tu conexión, la carrera espera a alguien, te echaron) salen siempre.' +
      (avisosLag?.forzado ? ' (Fijado por la dirección de la página: ?avisosLag.)' : '') }),
    aviso, boton);
  pinta();
  return { get graficos() { return { ...g }; }, alArrancar };
}

// El medidor en la esquina (una vez por segundo; escondido si no hay nada que mostrar). §256 (G16): con verGrafico,
// debajo del texto un gráfico del tiempo de cada imagen (las últimas `puntos`), redibujado cada `cadaGrafico` ms;
// imagenes() = el resumen de imagenes-vista.mjs (1 % bajo), grafico() = los puntos, esperado() = ms de una imagen pareja
export function montarMedidor(nodo, { graficos = () => leerGraficos(), fps = () => null, rtt = () => ({}), nombres = () => ({}),
                                     yo = null, jugando = () => true, cada = 1000, detalle = () => ({}),
                                     imagenes = () => null, grafico = null, esperado = () => 1000 / 60, cadaGrafico = 250,
                                     dibujar = null } = {}) {
  if (!nodo) return null;
  const textoNodo = document.createTextNode('');
  let lienzo = null, relojGrafico = null;
  nodo.replaceChildren(textoNodo);
  const pintaGrafico = () => {
    if (!lienzo || lienzo.hidden || !grafico || !dibujar) return;
    try { dibujar(lienzo.getContext('2d'), grafico(), { esperado: esperado() }); } catch {}
  };
  const pinta = () => {
    const g = graficos();
    const conGrafico = g.verGrafico && !!grafico && !!dibujar;
    const texto = (g.verFps || g.verPing || g.verDetalle || conGrafico) && jugando()
      ? textoMedidor({ fps: fps(), rtt: g.verPing ? rtt() : {}, nombres: nombres(), yo, verFps: g.verFps, verPing: g.verPing,
                       verDetalle: g.verDetalle, detalle: g.verDetalle ? detalle() : {},
                       verGrafico: conGrafico, imagenes: conGrafico || g.verDetalle ? imagenes() : null }) : '';
    nodo.hidden = !texto;
    if (textoNodo.data !== texto) textoNodo.data = texto;
    const verLo = conGrafico && !!texto;
    if (verLo && !lienzo) {
      lienzo = Object.assign(document.createElement('canvas'), { width: 240, height: 40, className: 'grafico-imagenes' });
      lienzo.style.cssText = 'display:block;width:240px;height:40px;margin-top:3px;';
      nodo.append(lienzo);
    }
    if (lienzo) lienzo.hidden = !verLo;
    if (verLo && !relojGrafico) relojGrafico = setInterval(pintaGrafico, cadaGrafico);
    if (!verLo && relojGrafico) { clearInterval(relojGrafico); relojGrafico = null; }
  };
  const reloj = setInterval(pinta, cada);
  pinta();
  return { pinta, pintaGrafico, get lienzo() { return lienzo; }, detener: () => { clearInterval(reloj); clearInterval(relojGrafico); } };
}
