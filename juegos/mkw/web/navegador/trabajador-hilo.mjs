// Paso 8 (N3/P10, bitácora §186): la entrada del Worker del juego (new Worker('trabajador-hilo.mjs', { type: 'module' })).
//
// La página (trabajador.mjs) le manda UN mensaje { t: 'iniciar', … } con:
//   lienzo: el OffscreenCanvas (canvas.transferControlToOffscreen(), transferido), ancho/alto/dpr: su recuadro;
//   parametros: el ?… de la página; origen: el servidor; sonido: { puerto (MessagePort al AudioWorklet), tasa } o null.
// Después, cada tanto: { t: 'pad', a: [puerto, conectado, botones, sx, sy, cx, cy, gl, gr] } (los mandos, como hoy),
// { t: 'tam', ancho, alto, dpr }, { t: 'visible', oculto }, { t: 'sonido', corriendo } y { t: 'estado?' }.
// El Worker contesta { t: 'log', l: [...] } (de a montones), { t: 'vibrar', puerto, cmd } y { t: 'estado', e }.
//
// Lo que el juego le pregunta a la página EN EL MOMENTO (sin esperar) se contesta aquí mismo: la semilla, el plantel,
// el puesto… viven en este hilo. Lo único que cruza es lo que ya era asíncrono o de ida.

import { instalarDom } from './trabajador-dom.mjs';
import { puenteSonido } from './trabajador-sonido.mjs';

let dom = null, padPendiente = [], modulo = null;
const logs = [];
let logProgramado = false;
const log = t => {
  logs.push(t);
  if (!logProgramado) { logProgramado = true; setTimeout(() => { logProgramado = false; postMessage({ t: 'log', l: logs.splice(0) }); }, 50); }
};

let sonido = null;
// (§240) lo que se rompe sin aviso (una promesa rechazada en el juego) sale al registro
addEventListener('unhandledrejection', e => postMessage({ t: 'log', l: ['[err] promesa rechazada: ' + String(e.reason?.stack || e.reason).slice(0, 1500)] }));
onmessage = async e => {
  const m = e.data;
  if (m.t === 'iniciar') {
    dom = instalarDom({ lienzo: m.lienzo, ancho: m.ancho, alto: m.alto, dpr: m.dpr });
    if (m.sonido) { sonido = puenteSonido(m.sonido); sonido.corriendo = !!m.sonido.corriendo; }
    const { correr } = await import('./trabajador-juego.mjs');
    const estado = await correr({ parametros: new URLSearchParams(m.parametros), origen: m.origen, lienzo: m.lienzo,
      canal: { log, sonido, vibrar: (puerto, cmd) => postMessage({ t: 'vibrar', puerto, cmd }), w10puerto: m.w10puerto || null } });
    modulo = globalThis.mkw || null;
    for (const a of padPendiente.splice(0)) modulo?._mkw_web_pad?.(...a);
    // el estado para la página (lo que las pruebas y el medidor miran), cada 250 ms
    setInterval(() => {
      try { postMessage({ t: 'estado', e: { ...estado, log: undefined, disco: undefined, sonido: sonido?.estado } }); }
      catch (err) { postMessage({ t: 'estado', e: { fase: estado.fase, error: 'estado: ' + String(err?.message || err).slice(0, 300) } }); }   // (§240)
    }, 250);
  } else if (m.t === 'pad') {
    if (modulo?._mkw_web_pad) modulo._mkw_web_pad(...m.a); else padPendiente.push(m.a);
  } else if (m.t === 'tam') dom?.tam(m.ancho, m.alto, m.dpr);
  else if (m.t === 'visible') dom?.visible(m.oculto);
  else if (m.t === 'sonido' && sonido) sonido.corriendo = m.corriendo;
  else if (m.t === 'eco') postMessage({ t: 'eco', id: m.id, t0: m.t0 });   // (banco: ida y vuelta página ↔ Worker)
};
