// resumir-perfil-arranque.mjs — qué funciones ocupan el hilo de la página en un tramo del arranque (§276).
// Uso: node herramientas/resumir-perfil-arranque.mjs <archivo.cpuprofile> [desdeSeg] [hastaSeg] [n]
//   (los segundos cuentan desde que empezó el perfil, que medir-arranque --perfil prende justo antes de abrir la página)
// Imprime el tiempo propio de cada función (sin lo que llama) y su total por «grupo» (wasm del juego, aurora, la página…).
import fs from 'node:fs';
const [archivo, desde = '0', hasta = '1e9', n = '25'] = process.argv.slice(2);
const p = JSON.parse(fs.readFileSync(archivo, 'utf8'));
const nodos = new Map(p.nodes.map(x => [x.id, x]));
let t = 0; const propio = new Map(); let total = 0;
for (let i = 0; i < p.samples.length; i++) {
  t += p.timeDeltas[i] || 0;
  const s = t / 1e6; if (s < +desde || s > +hasta) continue;
  const nodo = nodos.get(p.samples[i]); const cf = nodo.callFrame;
  const nombre = `${cf.functionName || '(anónima)'} ${cf.url ? cf.url.split('/').pop().split('?')[0] : ''}`.trim();
  const dt = (p.timeDeltas[i + 1] || 0) / 1000;
  propio.set(nombre, (propio.get(nombre) || 0) + dt); total += dt;
}
const grupo = nombre => /^\((idle|program|garbage collector)\)/.test(nombre) ? nombre.split(' ')[0]
  : /wasm/.test(nombre) || /^func_|^\$?func_/.test(nombre) ? (/^func_8|^rr_/.test(nombre) ? 'juego (traducido)' : 'wasm: runtime/aurora') : 'página (JS)';
const grupos = new Map();
for (const [k, ms] of propio) grupos.set(grupo(k), (grupos.get(grupo(k)) || 0) + ms);
console.log(`tramo ${desde}–${hasta} s: ${total.toFixed(0)} ms muestreados`);
for (const [g, ms] of [...grupos].sort((a, b) => b[1] - a[1])) console.log(`  ${g.padEnd(24)} ${ms.toFixed(0).padStart(6)} ms`);
console.log('funciones (tiempo propio):');
for (const [k, ms] of [...propio].sort((a, b) => b[1] - a[1]).slice(0, +n)) console.log(`  ${ms.toFixed(0).padStart(6)} ms  ${k}`);
