// Tiempos de cada cuadro, sacados de la "traza del ritmo" (?traza=1; guion.mjs --traza la vuelca a consola.log).
//
// Resumen: el runtime marca en la traza tres momentos de cada cuadro (vi.cpp):
//   3 = empieza el cuadro (terminó la espera de la "tele")
//   1 = el juego terminó su cuadro y se lo pasa a aurora (aurora_end_frame)
//   2 = aurora volvió (ya dibujó, mandó todo a la GPU y pasó por su pausa de presentar)
// Con eso, para cada cuadro: juego = 1 − 3 (CPU del juego traducido + lo que aurora graba mientras tanto),
// aurora = 2 − 1 (cerrar el cuadro, codificar y la pausa de presentar), espera = 3 siguiente − 2.
// Si un cuadro pasa de 16,7 ms en total, ese segundo baja de 60 fps. Este programa agrupa de a 60 cuadros y dice
// cuánto fue cada parte (promedio y el peor), para ver si lo que falta es CPU del juego, de aurora, o espera.
//
// Uso:  node herramientas/tiempos-cuadro.mjs [build/web/datos/guion/consola.log] [--desde N] [--hasta N]
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const archivo = args.find((a, i) => !a.startsWith('--') && !['--desde', '--hasta'].includes(args[i - 1])) ||
                'build/web/datos/guion/consola.log';
const desde = opcion('--desde', 0), hasta = opcion('--hasta', Infinity);

const ev = [];                                          // [código, hora en ms, valor]
for (const linea of readFileSync(archivo, 'utf8').split('\n'))
  if (linea.startsWith('[traza] ')) ev.push(...JSON.parse(linea.slice(8)));
if (!ev.length) { console.log('no hay líneas [traza] (¿se corrió guion.mjs --traza --extra "&traza=1"?)'); process.exit(1); }

// Los cuadros. MKW entrega el cuadro (código 1) apenas pasa el retrace y DESPUÉS calcula y graba el siguiente, hasta
// que se pone a esperar el próximo retrace. Así que el trabajo de un cuadro va del 2 (aurora volvió) al 1 siguiente,
// menos las esperas 'e'→'w' que caen en medio (la espera del retrace y las del juego ocioso). Por cuadro:
//   juego  = (1 siguiente − 2) − esperas  → CPU del juego traducido (y lo que aurora graba mientras tanto)
//   aurora = 2 − 1                        → cerrar el cuadro, codificarlo para la GPU y la pausa de presentar
//   ciclo  = 1 siguiente − 1              → cuánto duró el cuadro de verdad (16,7 ms a 60 fps)
const cuadros = [];
let previo = null, esperas = [], abierta = null;
// Si la traza trae los contadores de espera (página nueva: [1|2, hora, valor, esperaRuntime, esperaDisco]) se usan esos,
// que cuentan TODAS las esperas del runtime y del disco; si no, solo las 'e'→'w' de la página.
for (const [c, t, , esp, dis] of ev) {
  if (c === 'e') abierta = t;
  else if (c === 'w' && abierta !== null) { esperas.push([abierta, t]); abierta = null; }
  else if (c === 1) {
    if (previo && previo.t2) {
      const ocioso = esp !== undefined && previo.esp2 !== undefined
        ? (esp - previo.esp2) + (dis - previo.dis2)
        : esperas.reduce((s, [a, z]) => s + Math.max(0, Math.min(z, t) - Math.max(a, previo.t2)), 0);
      cuadros.push({ juego: t - previo.t2 - ocioso, aurora: previo.t2 - previo.t1, ocioso, ciclo: t - previo.t1,
                     disco: dis !== undefined ? dis - previo.dis2 : 0 });
    }
    previo = { t1: t };
    esperas = [];
  } else if (c === 2 && previo && !previo.t2) { previo.t2 = t; previo.esp2 = esp; previo.dis2 = dis; }
}
console.log(`${cuadros.length} cuadros en la traza`);
const prom = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const max = a => Math.max(...a);
const fila = (n, xs) => {
  const j = xs.map(q => q.juego), a = xs.map(q => q.aurora), o = xs.map(q => q.ocioso), c = xs.map(q => q.ciclo);
  const cpu = xs.map(q => q.juego + q.aurora);
  return `${String(n).padStart(6)}  juego ${prom(j).toFixed(1).padStart(5)} (máx ${max(j).toFixed(1).padStart(5)})  ` +
         `aurora ${prom(a).toFixed(1).padStart(4)} (máx ${max(a).toFixed(1).padStart(5)})  ` +
         `ocioso ${prom(o).toFixed(1).padStart(4)} (disco ${prom(xs.map(q => q.disco)).toFixed(1)})  ciclo ${prom(c).toFixed(1).padStart(5)} (máx ${max(c).toFixed(1).padStart(5)})  ` +
         `juego+aurora > 16,7 ms: ${cpu.filter(x => x > 16.7).length}, ciclos > 17,5 ms: ${c.filter(x => x > 17.5).length}`;
};
for (let i = Math.max(0, desde); i < Math.min(cuadros.length, hasta); i += 60) {
  const xs = cuadros.slice(i, Math.min(i + 60, cuadros.length, hasta));
  if (xs.length) console.log(fila(i, xs));
}
