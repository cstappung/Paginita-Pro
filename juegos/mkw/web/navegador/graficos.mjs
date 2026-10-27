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
export const GRAFICOS = { escala: 1, fluidez: 0, salida: 0, verFps: false, verPing: false, verDetalle: false };
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
  };
}
export function leerGraficos(almacen = globalThis.localStorage) {
  try { return normalizar(JSON.parse(almacen.getItem(CLAVE)) || {}); } catch { return { ...GRAFICOS }; }
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
export function queFrena({ fps = null, trabajo = null, gpu = null, hz = null } = {}) {
  if (!Number.isFinite(fps) || fps <= 0) return '';
  if (fps >= 57) return 'nada (va a 60)';
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

// El texto del medidor: «60 fps · 📶 Juan 35 ms · Ana 80 ms» (puro: lo prueba el banco); con el detalle (§114):
// «31 fps · juego 26 ms · video 5 ms · 120 Hz · 1280×720 · frena: el procesador…»
export function textoMedidor({ fps = null, rtt = {}, nombres = {}, yo = null, verFps = true, verPing = true, verDetalle = false, detalle = {} } = {}) {
  const partes = [];
  if ((verFps || verDetalle) && Number.isFinite(fps)) partes.push(`${Math.round(fps)} fps`);
  if (verDetalle) {
    const { trabajo, gpu, hz, lienzo } = detalle || {};
    if (Number.isFinite(trabajo)) partes.push(`juego ${trabajo.toFixed(1)} ms`);
    if (Number.isFinite(gpu)) partes.push(`video ${gpu.toFixed(1)} ms`);
    if (Number.isFinite(hz) && hz > 0) partes.push(`${Math.round(hz)} Hz`);
    if (lienzo) partes.push(lienzo);
    const f = queFrena({ fps, trabajo, gpu, hz });
    if (f) partes.push(`frena: ${f}`);
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
export function montarGraficos(caja, { reiniciar = () => location.reload(), enSala = false, alCambiar = () => {}, alSalida = () => {} } = {}) {
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
  const verFps = el('input', { type: 'checkbox', id: 'graficosFps' });
  const verPing = el('input', { type: 'checkbox', id: 'graficosPing' });
  const verDetalle = el('input', { type: 'checkbox', id: 'graficosDetalle' });
  const aviso = el('p', { className: 'aviso', id: 'graficosAviso', hidden: true });
  const boton = el('button', { type: 'button', className: 'boton', id: 'graficosReiniciar', textContent: 'Reiniciar el juego ahora', hidden: true });
  boton.onclick = () => reiniciar();
  const pinta = () => {
    escala.value = String(g.escala); fluidez.value = String(g.fluidez); salida.value = String(g.salida); verFps.checked = g.verFps; verPing.checked = g.verPing; verDetalle.checked = g.verDetalle;
    const pendiente = g.escala !== alArrancar.escala || g.fluidez !== alArrancar.fluidez;
    aviso.hidden = !pendiente; boton.hidden = !pendiente;
    aviso.textContent = pendiente ? 'Se aplica al reiniciar el juego (el motor lo lee al arrancar).' +
      (enSala ? ' En la sala, mejor entre carreras: al volver sigues en la siguiente.' : '') : '';
  };
  const cambio = () => {
    const antes = g.salida;
    g = guardarGraficos({ escala: escala.value, fluidez: fluidez.value, salida: salida.value, verFps: verFps.checked, verPing: verPing.checked, verDetalle: verDetalle.checked });
    pinta(); alCambiar(g);
    if (g.salida !== antes) alSalida(g.salida);            // (la salida se aplica en el momento, sin reiniciar)
  };
  for (const c of [escala, fluidez, salida, verFps, verPing, verDetalle]) c.addEventListener('change', cambio);
  caja.replaceChildren(
    el('div', { className: 'fila' }, el('label', { htmlFor: 'graficosEscala', textContent: 'Resolución interna' }), escala),
    el('div', { className: 'fila' }, el('label', { htmlFor: 'graficosFluidez', textContent: 'Fluidez (imágenes por segundo)' }), fluidez),
    el('p', { className: 'nota-graficos', textContent: 'El juego siempre calcula 60 cuadros por segundo; la fluidez dibuja imágenes intermedias ' +
      'para monitores rápidos (solo la imagen: en la sala no cambia la carrera). Las dos piden más a la tarjeta de video: ' +
      'si el juego baja de 60, vuelve a lo de siempre' + (enSala ? ' (en la sala, una PC que no alcanza frena a todos).' : '.') }),
    el('div', { className: 'fila' }, el('label', { htmlFor: 'graficosSalida', textContent: 'Resolución de salida' }), salida),
    el('p', { className: 'nota-graficos', textContent: 'El tamaño de la imagen que se manda a tu pantalla. Bajarla ayuda si tu tarjeta de video ' +
      'es justa (sobre todo con un monitor grande); se ve un poco más borrosa. Se aplica en el momento.' }),
    el('div', { className: 'fila' }, el('label', {}, verFps, ' Mostrar los fps'), el('label', {}, verPing, ' Mostrar el ping (en la sala)')),
    el('div', { className: 'fila' }, el('label', {}, verDetalle, ' Mostrar qué frena (cuánto tarda el juego y la tarjeta de video por cuadro, los Hz de la pantalla)')),
    el('p', { className: 'nota-graficos', textContent: 'Los fps y el ping van en un recuadro chico arriba a la izquierda; en una PC justa, ' +
      'tener algo encima del juego cuesta un poco.' }),
    aviso, boton);
  pinta();
  return { get graficos() { return { ...g }; }, alArrancar };
}

// El medidor en la esquina (una vez por segundo; escondido si no hay nada que mostrar)
export function montarMedidor(nodo, { graficos = () => leerGraficos(), fps = () => null, rtt = () => ({}), nombres = () => ({}),
                                     yo = null, jugando = () => true, cada = 1000, detalle = () => ({}) } = {}) {
  if (!nodo) return null;
  const pinta = () => {
    const g = graficos();
    const texto = (g.verFps || g.verPing || g.verDetalle) && jugando()
      ? textoMedidor({ fps: fps(), rtt: g.verPing ? rtt() : {}, nombres: nombres(), yo, verFps: g.verFps, verPing: g.verPing,
                       verDetalle: g.verDetalle, detalle: g.verDetalle ? detalle() : {} }) : '';
    nodo.hidden = !texto;
    if (nodo.textContent !== texto) nodo.textContent = texto;
  };
  const reloj = setInterval(pinta, cada);
  pinta();
  return { pinta, detener: () => clearInterval(reloj) };
}
