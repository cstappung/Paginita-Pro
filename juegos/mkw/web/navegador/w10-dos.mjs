// W10 de la etapa 1 del plan v4 (bitácora §207.4): la prueba de la parte B, el dibujo en otro Worker con dos copias del
// programa. Solo para medir y probar: la página de siempre (index.html) no cambia.
//
// Resumen: esta página arranca DOS Workers con el arnés del paso 8 (trabajador-hilo.mjs → trabajador-juego.mjs), cada uno
// con su propia copia del programa de MKW_W10_COMPILAR=1 y su lienzo:
//   - A, el Worker de la carrera (?w10=9: no dibuja ni presenta; ?verifica=1 → 10: dibuja igual en su lienzo, para
//     comparar). Recibe los mandos. Al final de cada cuadro manda la caja de lo que cambió en la memoria de la Wii;
//   - B, el Worker del dibujo (?w10=8): cuando su bucle iba a calcular, pega la caja y dibuja y presenta lo pegado.
// Los dos se hablan por un MessageChannel (un cable directo entre los dos Workers, sin pasar por esta página).
// Con la carrera andando, A manda primero la memoria entera (152 MiB en cajas de 4 MiB) y después solo lo que cambió.
// Como dos operarios en línea: el primero hace la pieza y la pone en la cinta; el segundo la pinta.
// ?alto=N = A se queda quieto en el cuadro de lógica N y B presenta lo último (para la foto de prueba-w10-dos.mjs).
// window.mkwEstadoA / mkwEstadoB = lo que manda cada Worker cada 250 ms (fase, cuadros, lógica, tramo, w10).
import { crearControles } from './controles.mjs';

const P = new URLSearchParams(location.search);
const VERIFICA = P.get('verifica') === '1';
const SOLO_A = P.get('soloA') === '1';   // (§240: la base de la medida: solo A, el juego de siempre en un Worker, dibuja y presenta él mismo)
const chip = document.getElementById('chip');
const registro = [];
window.mkwRegistro = registro;
window.mkwEstadoA = { fase: 'página' }; window.mkwEstadoB = { fase: 'página' };

const parametrosDe = (quien) => {
  const p = new URLSearchParams(location.search);
  p.delete('verifica'); p.delete('soloA'); p.set('w10', quien === 'A' ? (SOLO_A ? '0' : VERIFICA ? '10' : '9') : '8');
  if (quien === 'B') { p.delete('alto'); p.delete('tramo'); p.delete('huellas'); p.delete('sinTope'); if (VERIFICA && !p.has('w10Deshacer')) p.set('w10Deshacer', '0'); }   // (§240: con A dibujando, B no deshace el dibujo de los efectos)   // (§240: B no corre la lógica: sin el modo sin tope)
  p.set('audio', 'viejo');   // (sin sonido: esta prueba mide la carrera y la imagen)
  return '?' + p.toString();
};

const canal = new MessageChannel();
const arrancar = (quien, lienzo, puerto) => {
  const t = new Worker(new URL('./trabajador-hilo.mjs', import.meta.url), { type: 'module' });
  t.onmessage = e => {
    const m = e.data;
    if (m.t === 'log') m.l.forEach(l => registro.push(`[${quien}] ${l}`));
    else if (m.t === 'estado') window['mkwEstado' + quien] = m.e;
  };
  t.onerror = e => { window['mkwEstado' + quien] = { ...window['mkwEstado' + quien], error: 'Worker: ' + (e.message || e) }; };
  const r = lienzo.getBoundingClientRect();
  const fuera = lienzo.transferControlToOffscreen();
  t.postMessage({ t: 'iniciar', lienzo: fuera, ancho: Math.round(r.width), alto: Math.round(r.height), dpr: 1,
    parametros: parametrosDe(quien), origen: location.origin, sonido: null, w10puerto: puerto }, [fuera, puerto]);
  return t;
};
const A = arrancar('A', document.getElementById('lienzoA'), canal.port1);
const B = SOLO_A ? null : arrancar('B', document.getElementById('lienzoB'), canal.port2);
window.mkwTrabajadores = { A, B };
// los mandos van a A (el que corre la carrera)
crearControles({ enviar: (...a) => A.postMessage({ t: 'pad', a }), contenedorTactil: document.body });

let antes = { a: 0, b: 0, t: performance.now() };
setInterval(() => {
  const a = window.mkwEstadoA, b = window.mkwEstadoB, t = performance.now(), s = (t - antes.t) / 1000;
  const fa = ((a.cuadros || 0) - antes.a) / s, fb = ((b.cuadros || 0) - antes.b) / s;
  antes = { a: a.cuadros || 0, b: b.cuadros || 0, t };
  chip.textContent = `A ${a.fase || ''}${a.error ? ' ERROR' : ''} · lógica ${a.logica ?? '–'}${a.tramo?.resultado ? ' · tramo ' + a.tramo.resultado.logicaPorSeg + '/s' : ''}` +
    ` · cajas ${a.w10?.mandadas ?? 0} (esperó ${Math.round(a.w10?.msEspera ?? 0)} ms)\n` +
    `B ${b.fase || ''}${b.error ? ' ERROR' : ''} · ${fb.toFixed(0)} img/s · lógica ${b.logica ?? '–'} · pegó ${b.w10?.cuadros ?? 0} cuadros, malos ${b.w10?.malos ?? 0}`;
  window.mkwEstadoA.fps = fa; window.mkwEstadoB.fps = fb;
}, 1000);
