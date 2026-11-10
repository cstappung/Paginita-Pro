// Reparte el «(program)» del perfil de Chrome (N13, bitácora §165): el tiempo del hilo de la página que el perfil de
// CPU no sabe a qué función de JavaScript o de wasm cargarle.
//
// Resumen: medir-sitio --trazaChrome --trazaV8 deja <base>-v1-chrome.json, una traza de 3 s de la carrera con las
// categorías de adentro de V8 (compilación, recolector, wasm, llamadas del motor) y de Blink. Este programa toma el
// hilo principal de la pestaña del juego (CrRendererMain del proceso con más «v8.callFunction»), arma el árbol de
// eventos (cada evento con su comienzo y su duración; los de adentro están anidados) y calcula el TIEMPO PROPIO de cada
// uno: su duración menos la de los eventos que tiene adentro. Así cada milisegundo del hilo se cuenta una sola vez,
// en el evento más de adentro que lo explica. Después junta los nombres en grupos con nombre.
// El tiempo propio de «v8.callFunction» es el wasm y el JavaScript corriendo de verdad (lo que el perfil sí reparte por
// función); lo demás de adentro es lo que el perfil llama «(program)» o «(garbage collector)».
//
// Uso:  node herramientas/reparto-program.mjs build/web/datos/medir-sitio/n13-prog-traza-pc-v1-chrome.json
//       → imprime ms por segundo y % por grupo, y lo guarda en <archivo>-reparto.json
import { readFileSync, writeFileSync } from 'node:fs';

const archivo = process.argv[2];
if (!archivo) { console.error('uso: node herramientas/reparto-program.mjs <traza -chrome.json>'); process.exit(1); }
const { traceEvents: ev } = JSON.parse(readFileSync(archivo, 'utf8'));

// 1) el hilo: el CrRendererMain con más tiempo dentro de v8.callFunction
const nombres = new Map();     // "pid:tid" → nombre del hilo
for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') nombres.set(`${e.pid}:${e.tid}`, e.args?.name);
const enLlamadas = new Map();
for (const e of ev) if (e.name === 'v8.callFunction' && e.ph === 'X') { const k = `${e.pid}:${e.tid}`; enLlamadas.set(k, (enLlamadas.get(k) || 0) + (e.dur || 0)); }
const hilo = [...enLlamadas.entries()].filter(([k]) => nombres.get(k) === 'CrRendererMain').sort((a, b) => b[1] - a[1])[0]?.[0];
if (!hilo) { console.error('no encontré el hilo principal de la página con v8.callFunction'); process.exit(1); }

// 2) los eventos de ese hilo con duración: los «X» y los pares «B»/«E» (en microsegundos)
const delHilo = ev.filter(e => `${e.pid}:${e.tid}` === hilo);
const intervalos = [];
const abiertos = [];
for (const e of delHilo.sort((a, b) => a.ts - b.ts)) {
  if (e.ph === 'X' && e.dur > 0) intervalos.push({ nombre: e.name, cat: e.cat, ini: e.ts, fin: e.ts + e.dur });
  else if (e.ph === 'B') abiertos.push(e);
  else if (e.ph === 'E') { const b = abiertos.pop(); if (b) intervalos.push({ nombre: b.name, cat: b.cat, ini: b.ts, fin: e.ts }); }
}
// 3) tiempo propio: ordenados por comienzo (y el más largo primero), con una pila de los que contienen al actual
intervalos.sort((a, b) => a.ini - b.ini || b.fin - a.fin);
const propio = new Map();      // nombre → µs propios
const dentroDeLlamada = new Map();   // nombre → µs propios que pasan dentro de un v8.callFunction
const pila = [];
const suma = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
for (const x of intervalos) {
  while (pila.length && pila.at(-1).fin <= x.ini) pila.pop();
  x.hijos = 0; x.enLlamada = pila.some(p => p.nombre === 'v8.callFunction') || x.nombre === 'v8.callFunction';
  const padre = pila.at(-1);
  if (padre) padre.hijos += Math.min(x.fin, padre.fin) - x.ini;
  pila.push(x);
}
for (const x of intervalos) {
  const p = Math.max(0, x.fin - x.ini - x.hijos);
  suma(propio, x.nombre, p);
  if (x.enLlamada) suma(dentroDeLlamada, x.nombre, p);
}
// (la ventana sale de los eventos con duración: los de metadatos llevan hora 0)
const t0 = Math.min(...intervalos.map(x => x.ini)), t1 = Math.max(...intervalos.map(x => x.fin));
const segundos = (t1 - t0) / 1e6;

// 4) los grupos (por el nombre del evento; el orden importa: el primero que calza)
const GRUPOS = [
  ['wasm y JavaScript corriendo (lo que el perfil reparte por función)', n => n === 'v8.callFunction' || n === 'FunctionCall' || n === 'v8.run'],
  ['recolector de basura (GC)', n => /GC|Scaveng|Mark|Sweep|Compact|Heap/i.test(n)],
  ['compilar wasm y JavaScript (Liftoff, TurboFan, optimizar)', n => /Compil|Optimiz|Liftoff|TurboFan|Turbofan|Maglev|Sparkplug|Deopt|Tier/i.test(n)],
  ['microtareas y promesas (JSPI: el juego vuelve de una espera)', n => /Microtask|Promise|Suspend|Resume|Stack(Switch|Swap)/i.test(n)],
  ['WebGPU (Blink, Dawn: los llamados del juego a la tarjeta)', n => /GPU|Dawn|WebGPU|Wire/i.test(n)],
  ['V8 por dentro (runtime, IC, entradas y salidas del motor)', n => /^V8\.|^v8\.|Runtime|IC_|Builtin|Wasm/i.test(n)],
  ['Blink y la página (tareas, temporizadores, eventos, pintar)', n => /Timer|Task|Event|Paint|Layout|Style|Animation|Frame|Commit|Script|Parse|Blink|ThreadControllerImpl|Sequence/i.test(n)],
];
const porGrupo = new Map();
const sinGrupo = [];
for (const [n, us] of propio) {
  const g = GRUPOS.find(([, f]) => f(n));
  if (g) suma(porGrupo, g[0], us); else { suma(porGrupo, 'sin grupo', us); sinGrupo.push([n, us]); }
}
const total = [...propio.values()].reduce((a, b) => a + b, 0);
const ms = us => Math.round(us / 1000 / segundos * 10) / 10;
console.log(`hilo ${hilo} (${nombres.get(hilo)}), ${segundos.toFixed(2)} s de traza, ocupado ${ms(total)} ms por segundo`);
const filas = [...porGrupo.entries()].sort((a, b) => b[1] - a[1]);
for (const [g, us] of filas) console.log(`  ${g.padEnd(66)} ${String(ms(us)).padStart(6)} ms/s  ${(us / total * 100).toFixed(1).padStart(5)} %`);
// lo que el perfil llama (program): todo lo que no es «wasm y JavaScript corriendo» y pasa dentro de un v8.callFunction
const fueraDeFunciones = [...dentroDeLlamada.entries()].filter(([n]) => n !== 'v8.callFunction').sort((a, b) => b[1] - a[1]);
const totalProgram = fueraDeFunciones.reduce((a, [, v]) => a + v, 0);
console.log(`dentro de v8.callFunction, sin contar el wasm y el JavaScript mismos: ${ms(totalProgram)} ms/s; los 15 eventos más grandes:`);
for (const [n, us] of fueraDeFunciones.slice(0, 15)) console.log(`  ${n.padEnd(60)} ${String(ms(us)).padStart(6)} ms/s`);
if (sinGrupo.length) console.log('sin grupo (los 10 más grandes): ' + sinGrupo.sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, us]) => `${n} ${ms(us)}`).join(' · '));
writeFileSync(archivo.replace(/\.json$/, '') + '-reparto.json', JSON.stringify({ hilo, segundos, ocupadoMsPorSeg: ms(total),
  grupos: Object.fromEntries(filas.map(([g, us]) => [g, { msPorSeg: ms(us), pct: Math.round(us / total * 1000) / 10 }])),
  dentroDeLlamadas: Object.fromEntries(fueraDeFunciones.slice(0, 40).map(([n, us]) => [n, ms(us)])),
  sinGrupo: Object.fromEntries(sinGrupo.slice(0, 40).map(([n, us]) => [n, ms(us)])) }, null, 1));
