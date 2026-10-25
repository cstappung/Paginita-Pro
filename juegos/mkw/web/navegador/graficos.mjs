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
// Las dos cuestan tarjeta de video (y algo de procesador), así que vienen APAGADAS (lo de siempre: 1× y 60). Se guardan
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
export const GRAFICOS = { escala: 1, fluidez: 0, verFps: false, verPing: false };
const CLAVE = 'mkw.graficos';

// Las opciones guardadas, revisadas (un valor que el motor no acepta vuelve al de siempre)
export function normalizar(g = {}) {
  return {
    escala: ESCALAS.includes(Number(g.escala)) ? Number(g.escala) : 1,
    fluidez: FLUIDECES.includes(Number(g.fluidez)) ? Number(g.fluidez) : 0,
    verFps: g.verFps === true,
    verPing: g.verPing === true,
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

// El texto del medidor: «60 fps · 📶 Juan 35 ms · Ana 80 ms» (puro: lo prueba el banco)
export function textoMedidor({ fps = null, rtt = {}, nombres = {}, yo = null, verFps = true, verPing = true } = {}) {
  const partes = [];
  if (verFps && Number.isFinite(fps)) partes.push(`${Math.round(fps)} fps`);
  if (verPing) {
    const otros = Object.entries(rtt || {}).filter(([u, ms]) => u !== yo && Number.isFinite(ms));
    if (otros.length) {
      const corto = u => String(nombres?.[u] || 'piloto').split(/\s+/)[0].slice(0, 12);
      partes.push('📶 ' + otros.sort((a, b) => b[1] - a[1]).map(([u, ms]) => `${corto(u)} ${Math.round(ms)} ms`).join(' · '));
    }
  }
  return partes.join(' · ');
}

const el = (etiqueta, props = {}, ...hijos) => { const e = Object.assign(document.createElement(etiqueta), props); e.append(...hijos); return e; };

// El panel: dos selectores (resolución, fluidez), dos casillas (fps, ping) y «Reiniciar el juego» si algo cambió
export function montarGraficos(caja, { reiniciar = () => location.reload(), enSala = false, alCambiar = () => {} } = {}) {
  if (!caja) return null;
  const alArrancar = leerGraficos();               // lo que el juego leyó al arrancar (para saber si hay que reiniciar)
  let g = { ...alArrancar };
  const escala = el('select', { id: 'graficosEscala' },
    ...ESCALAS.map(v => el('option', { value: String(v), textContent: v === 1 ? '1× (la de la Wii, lo de siempre)' : `${String(v).replace('.', ',')}× — más nítido y bordes suaves` })));
  const fluidez = el('select', { id: 'graficosFluidez' },
    el('option', { value: '0', textContent: '60 (lo de siempre)' }),
    el('option', { value: '120', textContent: '120 — imágenes intermedias (monitor de 120 Hz o más)' }),
    el('option', { value: '180', textContent: '180 — imágenes intermedias (monitor de 180 Hz o más)' }));
  const verFps = el('input', { type: 'checkbox', id: 'graficosFps' });
  const verPing = el('input', { type: 'checkbox', id: 'graficosPing' });
  const aviso = el('p', { className: 'aviso', id: 'graficosAviso', hidden: true });
  const boton = el('button', { type: 'button', className: 'boton', id: 'graficosReiniciar', textContent: 'Reiniciar el juego ahora', hidden: true });
  boton.onclick = () => reiniciar();
  const pinta = () => {
    escala.value = String(g.escala); fluidez.value = String(g.fluidez); verFps.checked = g.verFps; verPing.checked = g.verPing;
    const pendiente = g.escala !== alArrancar.escala || g.fluidez !== alArrancar.fluidez;
    aviso.hidden = !pendiente; boton.hidden = !pendiente;
    aviso.textContent = pendiente ? 'Se aplica al reiniciar el juego (el motor lo lee al arrancar).' +
      (enSala ? ' En la sala, mejor entre carreras: al volver sigues en la siguiente.' : '') : '';
  };
  const cambio = () => {
    g = guardarGraficos({ escala: escala.value, fluidez: fluidez.value, verFps: verFps.checked, verPing: verPing.checked });
    pinta(); alCambiar(g);
  };
  for (const c of [escala, fluidez, verFps, verPing]) c.addEventListener('change', cambio);
  caja.replaceChildren(
    el('div', { className: 'fila' }, el('label', { htmlFor: 'graficosEscala', textContent: 'Resolución interna' }), escala),
    el('div', { className: 'fila' }, el('label', { htmlFor: 'graficosFluidez', textContent: 'Fluidez (imágenes por segundo)' }), fluidez),
    el('p', { className: 'nota-graficos', textContent: 'El juego siempre calcula 60 cuadros por segundo; la fluidez dibuja imágenes intermedias ' +
      'para monitores rápidos (solo la imagen: en la sala no cambia la carrera). Las dos piden más a la tarjeta de video: ' +
      'si el juego baja de 60, vuelve a lo de siempre' + (enSala ? ' (en la sala, una PC que no alcanza frena a todos).' : '.') }),
    el('div', { className: 'fila' }, el('label', {}, verFps, ' Mostrar los fps'), el('label', {}, verPing, ' Mostrar el ping (en la sala)')),
    el('p', { className: 'nota-graficos', textContent: 'Los fps y el ping van en un recuadro chico arriba a la izquierda; en una PC justa, ' +
      'tener algo encima del juego cuesta un poco.' }),
    aviso, boton);
  pinta();
  return { get graficos() { return { ...g }; }, alArrancar };
}

// El medidor en la esquina (una vez por segundo; escondido si no hay nada que mostrar)
export function montarMedidor(nodo, { graficos = () => leerGraficos(), fps = () => null, rtt = () => ({}), nombres = () => ({}),
                                     yo = null, jugando = () => true, cada = 1000 } = {}) {
  if (!nodo) return null;
  const pinta = () => {
    const g = graficos();
    const texto = (g.verFps || g.verPing) && jugando()
      ? textoMedidor({ fps: fps(), rtt: g.verPing ? rtt() : {}, nombres: nombres(), yo, verFps: g.verFps, verPing: g.verPing }) : '';
    nodo.hidden = !texto;
    if (nodo.textContent !== texto) nodo.textContent = texto;
  };
  const reloj = setInterval(pinta, cada);
  pinta();
  return { pinta, detener: () => clearInterval(reloj) };
}
