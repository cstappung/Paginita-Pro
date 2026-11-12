// §283: qué hace pesados los momentos pesados del teléfono. Lee un perfil de CPU de Chrome (.cpuprofile, el que guarda
// sala-telefono-mixta.mjs con --perfil) y corta la línea de tiempo en TAREAS: tramos seguidos de muestras ocupadas entre
// dos ratos «(idle)». Cada tarea es lo que el juego hace de una vez entre dos esperas (con «30 parejas», dos cuadros de
// lógica y un dibujo). Las tareas largas («pesadas», más de --umbral ms) son las imágenes tarde; las demás, las normales.
// Para cada función cuenta el tiempo propio (self) por tarea en las dos clases y ordena por la diferencia: lo que crece
// en las pesadas es lo que las hace pesadas (como comparar el consumo de cada carga en las horas punta y en las valle).
//
// Uso:  node herramientas/perfil-pesados-283.mjs <archivo.cpuprofile> [--umbral 40] [--top 30] [--hueco 0]
//   --umbral ms   desde cuántos ms una tarea es pesada (por omisión 40: el par de «30 parejas» tiene 33,3)
//   --hueco ms    cuántos ms de «(idle)» seguidos cortan una tarea (por omisión 0: cualquier muestra ociosa; entre dos
//                 imágenes el teléfono queda ocioso menos de 1 ms)
//   --json f      guarda también la tabla en f
// Resumen: muestras → tareas → por clase el tiempo propio de cada función → la tabla de diferencias y el reparto por
// grupo (código traducido del juego func_8…, aurora/dibujo, JavaScript de la página, recolector, el resto).
import fs from 'node:fs';

const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const archivo = args.find(a => !a.startsWith('--') && !/^\d/.test(a));
if (!archivo) { console.error('uso: node herramientas/perfil-pesados-283.mjs <archivo.cpuprofile> [--umbral 40]'); process.exit(1); }
const UMBRAL = Number(opcion('--umbral', 40)), TOP = Number(opcion('--top', 30)), HUECO = Number(opcion('--hueco', 0));

const p = JSON.parse(fs.readFileSync(archivo, 'utf8'));
const nodos = new Map(p.nodes.map(n => [n.id, n]));               // id → nodo (cada nodo = una función en una pila)
const nombre = n => n.callFrame.functionName || `(anónima ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber})`;

// las muestras con su hora (timeDeltas en µs, acumulados) → [hora ms, nodo]
let t = p.startTime; const muestras = [];
for (let i = 0; i < p.samples.length; i++) { t += p.timeDeltas[i]; muestras.push([t / 1000, nodos.get(p.samples[i])]); }

// cortar en tareas: lo ocupado entre ratos de «(idle)» de al menos HUECO ms
const tareas = []; let actual = null, idleDesde = null;
for (let i = 0; i < muestras.length; i++) {
  const [ms, n] = muestras[i]; const dt = i + 1 < muestras.length ? muestras[i + 1][0] - ms : 0;
  const ocioso = nombre(n) === '(idle)';
  if (ocioso) {
    if (idleDesde == null) idleDesde = ms;
    if (actual && ms - idleDesde >= HUECO) { tareas.push(actual); actual = null; }
    continue;
  }
  idleDesde = null;
  if (!actual) actual = { desde: ms, hasta: ms, propio: new Map() };
  actual.hasta = ms + dt;
  const k = nombre(n); actual.propio.set(k, (actual.propio.get(k) || 0) + dt);
}
if (actual) tareas.push(actual);
const dur = x => x.hasta - x.desde;
const grandes = tareas.filter(x => dur(x) >= 5);                     // (las migajas de menos de 5 ms no son del juego)
const pesadas = grandes.filter(x => dur(x) > UMBRAL), normales = grandes.filter(x => dur(x) <= UMBRAL);

// por clase: el tiempo propio medio por tarea de cada función
const media = lista => { const m = new Map(); for (const x of lista) for (const [k, v] of x.propio) m.set(k, (m.get(k) || 0) + v);
  for (const k of m.keys()) m.set(k, m.get(k) / Math.max(1, lista.length)); return m; };
const mP = media(pesadas), mN = media(normales);
const filas = [...new Set([...mP.keys(), ...mN.keys()])].map(k => ({ k, pesada: mP.get(k) || 0, normal: mN.get(k) || 0 }))
  .map(f => ({ ...f, dif: f.pesada - f.normal })).sort((a, b) => b.dif - a.dif);

// los grupos (código traducido del juego, ganchos de RR, aurora y la tarjeta, la página, el recolector, el resto)
const grupo = k => /^func_8|^rr_(overlay|kamek)_/.test(k) ? 'juego traducido' : /^\(garbage collector\)$/.test(k) ? 'recolector'
  : /^\(program\)$/.test(k) ? '(program)' : /wgpu|Dawn|aurora|gx|GX|texture|pipeline|draw|Draw|render/i.test(k) ? 'aurora/dibujo'
  : /^\(anónima|^[a-zA-Zá-úñ$_]+$/.test(k) && !/^func_|^\$/.test(k) ? 'JS u otro' : 'otro wasm';
const porGrupo = (m) => { const g = {}; for (const [k, v] of m) g[grupo(k)] = (g[grupo(k)] || 0) + v; return g; };
const gP = porGrupo(mP), gN = porGrupo(mN);
const r1 = x => Math.round(x * 10) / 10;
const pct = (lista, q) => { const d = lista.map(dur).sort((a, b) => a - b); return d.length ? r1(d[Math.min(d.length - 1, Math.floor(q * d.length))]) : null; };

const out = [];
out.push(`# Tareas pesadas contra normales — ${archivo.split(/[\\/]/).pop()}`);
out.push('');
out.push(`${grandes.length} tareas de ≥ 5 ms en ${r1((muestras.at(-1)[0] - muestras[0][0]) / 1000)} s; pesadas (> ${UMBRAL} ms): ${pesadas.length}, normales: ${normales.length}.`);
out.push(`Duración: mediana ${pct(grandes, 0.5)} ms, p90 ${pct(grandes, 0.9)}, p99 ${pct(grandes, 0.99)}; pesadas mediana ${pct(pesadas, 0.5)} ms, normales mediana ${pct(normales, 0.5)} ms.`);
out.push('');
out.push('## Por grupo (ms propios por tarea)');
out.push('| grupo | normal | pesada | diferencia |'); out.push('|---|---|---|---|');
for (const g of [...new Set([...Object.keys(gP), ...Object.keys(gN)])].sort((a, b) => ((gP[b] || 0) - (gN[b] || 0)) - ((gP[a] || 0) - (gN[a] || 0))))
  out.push(`| ${g} | ${r1(gN[g] || 0)} | ${r1(gP[g] || 0)} | ${r1((gP[g] || 0) - (gN[g] || 0))} |`);
out.push('');
out.push(`## Las ${TOP} funciones que más crecen en las pesadas (ms propios por tarea)`);
out.push('| función | normal | pesada | diferencia |'); out.push('|---|---|---|---|');
for (const f of filas.slice(0, TOP)) out.push(`| ${f.k} | ${r1(f.normal)} | ${r1(f.pesada)} | ${r1(f.dif)} |`);
out.push('');
out.push(`## Las ${Math.min(15, TOP)} más pesadas en las normales (lo que cuesta siempre)`);
out.push('| función | normal | pesada |'); out.push('|---|---|---|');
for (const f of filas.slice().sort((a, b) => b.normal - a.normal).slice(0, Math.min(15, TOP))) out.push(`| ${f.k} | ${r1(f.normal)} | ${r1(f.pesada)} |`);
console.log(out.join('\n'));
const j = opcion('--json', null);
if (j) fs.writeFileSync(j, JSON.stringify({ archivo, umbral: UMBRAL, tareas: grandes.length, pesadas: pesadas.length, grupos: { normal: gN, pesada: gP }, filas: filas.slice(0, 200) }, null, 1));
