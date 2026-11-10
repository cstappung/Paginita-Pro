// Paso 8 (N3/P10, bitácora §186): la página de la prueba del Worker (trabajador.html).
//
// ?hilo=trabajador (por omisión): el lienzo se transfiere a un Worker (OffscreenCanvas) y el juego corre allá entero
//   (trabajador-hilo.mjs → trabajador-juego.mjs); aquí quedan los mandos (controles.mjs: teclado, mandos y lo táctil,
//   cada cambio va al Worker como mkw_web_pad), el sonido (el AudioContext y el AudioWorklet de §88; el Worker le
//   entrega directo por un MessagePort) y el aviso de tamaño y visibilidad.
// ?hilo=principal: el mismo arnés en este hilo, como hoy (la referencia para comparar).
// Para las pruebas: window.mkwEstado (lo que manda el Worker cada 250 ms, o el del arnés), window.mkwHilo,
// window.mkwEco(n) = n idas y vueltas página → Worker → página (ms de cada una).

import { crearControles } from './controles.mjs';
import { crearSonido } from './sonido.mjs';
import { hiloDe } from './aislar.mjs';

const P = new URLSearchParams(location.search);
const HILO = hiloDe(P);
const lienzo = document.getElementById('canvas');
const chip = document.getElementById('chip');
window.mkwHilo = HILO;
window.mkwEstado = { donde: HILO, fase: 'página' };
const registro = [];
window.mkwRegistro = registro;
const log = t => { registro.push(t); if (registro.length > 20000) registro.splice(0, 5000); };

// Sonido: lo de siempre (§88), apagable con ?audio=viejo (en el Worker no hay SDL3 que lo abra: sin sonido)
const sonido = crearSonido({ worklet: P.get('audio') !== 'viejo', alCambiar: () => alSonido() });
sonido.instalar();
window.mkwSonido = sonido;
let alSonido = () => {};

// Los mandos: igual que en la página real, solo cambia a dónde van
let enviar = () => {};
const controles = crearControles({ enviar: (...a) => enviar(...a), contenedorTactil: document.getElementById('pantalla') });
window.mkwControles = controles;

const rect = () => { const r = lienzo.getBoundingClientRect(); return { ancho: Math.round(r.width) || innerWidth, alto: Math.round(r.height) || innerHeight, dpr: devicePixelRatio || 1 }; };

if (HILO === 'trabajador') {
  const trabajador = new Worker(new URL('./trabajador-hilo.mjs', import.meta.url), { type: 'module' });
  window.mkwTrabajador = trabajador;
  const ecos = new Map();
  let nEco = 0;
  trabajador.onmessage = e => {
    const m = e.data;
    if (m.t === 'log') m.l.forEach(log);
    else if (m.t === 'estado') window.mkwEstado = { ...m.e, donde: 'trabajador' };
    else if (m.t === 'vibrar') controles.vibrar?.(m.puerto, m.cmd);
    else if (m.t === 'eco') { const f = ecos.get(m.id); ecos.delete(m.id); f?.(performance.now() - m.t0); }
  };
  trabajador.onerror = e => { window.mkwEstado = { ...window.mkwEstado, error: 'Worker: ' + (e.message || e) }; };
  window.mkwEco = async (n = 100) => {
    const ms = [];
    for (let i = 0; i < n; i++) ms.push(await new Promise(r => { const id = ++nEco; ecos.set(id, r); trabajador.postMessage({ t: 'eco', id, t0: performance.now() }); }));
    ms.sort((a, b) => a - b);
    return { n, mediana: ms[n >> 1], p95: ms[Math.floor(n * 0.95)], max: ms[n - 1] };
  };
  enviar = (...a) => trabajador.postMessage({ t: 'pad', a });
  const fuera = lienzo.transferControlToOffscreen();
  const { ancho, alto, dpr } = rect();
  const conSonido = P.get('audio') === 'viejo' ? null : await sonido.puente.puertoAparte().catch(() => null);
  trabajador.postMessage({ t: 'iniciar', lienzo: fuera, ancho, alto, dpr, parametros: location.search, origen: location.origin,
    sonido: conSonido && { ...conSonido, corriendo: sonido.estado.activo } }, [fuera, ...(conSonido ? [conSonido.puerto] : [])]);
  alSonido = () => trabajador.postMessage({ t: 'sonido', corriendo: sonido.estado.activo });
  addEventListener('resize', () => trabajador.postMessage({ t: 'tam', ...rect() }));
  document.addEventListener('visibilitychange', () => trabajador.postMessage({ t: 'visible', oculto: document.hidden }));
} else {
  const { correr } = await import('./trabajador-juego.mjs');
  const e = correr({ parametros: P, origen: location.origin, lienzo, canal: { log, sonido: P.get('audio') === 'viejo' ? null : sonido.puente,
    vibrar: (p, c) => controles.vibrar?.(p, c) } });
  const vigia = setInterval(() => { if (globalThis.mkw?._mkw_web_pad) { enviar = (...a) => globalThis.mkw._mkw_web_pad(...a); controles.reenviar?.(); clearInterval(vigia); } }, 50);
  e.then(() => {});
}

// El chip: dónde corre, la fase, los cuadros por segundo y el tramo
let antes = { c: 0, t: performance.now() };
setInterval(() => {
  const e = window.mkwEstado || {}, t = performance.now();
  const fps = ((e.cuadros || 0) - antes.c) / ((t - antes.t) / 1000);
  antes = { c: e.cuadros || 0, t };
  chip.textContent = `${HILO} · ${e.fase || ''}${e.error ? ' · ERROR' : ''} · ${fps.toFixed(0)} img/s · lógica ${e.logica ?? '–'}` +
    (e.tramo?.resultado ? ` · tramo ${e.tramo.resultado.logicaPorSeg}/s` : '');
  window.mkwEstado.fps = fps;
}, 1000);
