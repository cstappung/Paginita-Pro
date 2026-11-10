// H11 (etapa 2 del plan v4, bitácora §214): qué código traducido es caliente en la carrera, y la cabecera de lo frío.
// Resumen: lee uno o varios perfiles de V8 del juego en Node (.cpuprofile de perfil-impuesto.mjs o correr-guion.mjs,
// carreras en distintas pistas), suma el tiempo propio de cada función traducida (func_<dirección> del juego, rr_… de
// Retro Rewind), dice en qué archivo de generated/build_shards está cada una y escribe:
//   calientes.txt = los archivos ordenados por tiempo hasta cubrir --cubre % (para mirar: por archivo no alcanza)
//   frio.h        = cada función que no corrió en ningún perfil, redeclarada con minsize y cold;
//                   compilar-web.py --frio <frio.h> la incluye antes de cada archivo traducido
// Uso: node herramientas/h11-caliente.mjs <a.cpuprofile> [<b.cpuprofile> …] [--cubre 99.5] [--wc terceros/Wiicompiled-motor]
//        → build/web/datos/e2/h11/ (nombres de funciones del juego: nunca a git)
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const perfiles = args.filter(a => !a.startsWith('--') && a.endsWith('.cpuprofile'));
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const CUBRE = Number(opcion('--cubre', '99.5'));          // % del tiempo traducido que tiene que quedar «caliente»
const WC = opcion('--wc', 'terceros/Wiicompiled-motor');
if (!perfiles.length) { console.error('falta al menos un .cpuprofile'); process.exit(1); }

// 1) tiempo propio por función (las muestras de V8: cada una cae en un nodo; el nodo dice qué función), sumado en todos
const tiempo = new Map();
for (const archivo of perfiles) {
  const p = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const porNodo = new Map(p.nodes.map(n => [n.id, n.callFrame.functionName]));
  const delta = p.timeDeltas || [];
  p.samples.forEach((id, i) => {
    const f = porNodo.get(id) || '';
    const m = /^(func_[0-9A-Fa-f]{8}(?:_\w+)?|rr_\w+)$/.exec(f);   // solo el código traducido (con su nombre entero)
    if (!m) return;
    tiempo.set(m[1], (tiempo.get(m[1]) || 0) + (delta[i] || 0));
  });
}
const total = [...tiempo.values()].reduce((s, x) => s + x, 0);

// 2) dónde está definida cada función: «<nombre>(» al principio de una línea de definición en cada shard
const raiz = path.join(WC, 'generated/build_shards');
const archivos = fs.readdirSync(raiz, { withFileTypes: true }).filter(d => d.isDirectory())
  .flatMap(d => fs.readdirSync(path.join(raiz, d.name)).filter(f => f.endsWith('.cpp')).map(f => path.join(raiz, d.name, f)));
const dondeEsta = new Map();
const comunes = new Set();   // las definidas con la firma de siempre: void nombre(CpuContext* ctx)
for (const a of archivos) {
  const texto = fs.readFileSync(a, 'utf8');
  for (const m of texto.matchAll(/^[^\n;]*?\b(func_[0-9A-Fa-f]{8}(?:_\w+)?|rr_\w+)\s*\([^;{]*\)\s*\{/gm)) dondeEsta.set(m[1], a);
  for (const m of texto.matchAll(/^extern "C" void (func_[0-9A-Fa-f]{8}|rr_\w+)\(CpuContext\* MKW_RESTRICT ctx\)\s*\r?\n\{/gm)) comunes.add(m[1]);
}

// 3) tiempo por archivo y la lista hasta cubrir CUBRE %
const porArchivo = new Map();
let sinArchivo = 0;
for (const [f, t] of tiempo) {
  const a = dondeEsta.get(f);
  if (!a) { sinArchivo += t; continue; }
  porArchivo.set(a, (porArchivo.get(a) || 0) + t);
}
const orden = [...porArchivo].sort((x, y) => y[1] - x[1]);
let acum = 0; const calientes = [];
for (const [a, t] of orden) { if (100 * acum / total >= CUBRE) break; acum += t; calientes.push(a); }
const salida = 'build/web/datos/e2/h11';
fs.mkdirSync(salida, { recursive: true });
fs.writeFileSync(path.join(salida, 'calientes.txt'), calientes.map(a => path.relative(WC, a).replaceAll('\\', '/')).join('\n') + '\n');
console.log(`funciones traducidas con tiempo: ${tiempo.size}; archivos traducidos: ${archivos.length}; con tiempo: ${porArchivo.size}`);
console.log(`calientes (cubren ${(100 * acum / total).toFixed(2)} % del tiempo traducido): ${calientes.length} archivos`);
console.log(`sin archivo encontrado: ${(100 * sinArchivo / total).toFixed(2)} % del tiempo`);
console.log(`→ ${path.join(salida, 'calientes.txt')}`);

// 4) la cabecera de lo frío: cada función de firma común que NO corrió en el perfil, redeclarada con minsize (compilar
// chico, como -Oz) y cold (quien la llama la trata como camino raro). compilar-web.py --frio la incluye antes de cada
// archivo traducido. Solo cambia CÓMO se compila, nunca qué cuenta (sin fast-math ni contracción: los mismos bits).
const frias = [...comunes].filter(f => !tiempo.has(f)).sort();
fs.writeFileSync(path.join(salida, 'frio.h'),
  '// H11 (bitácora §214), generado por herramientas/h11-caliente.mjs: las funciones traducidas que no corren en la carrera\n' +
  '#pragma once\n#include "guest_abi/guest_abi.h"\n' +
  frias.map(f => `extern "C" void ${f}(CpuContext* MKW_RESTRICT ctx) __attribute__((minsize, cold));`).join('\n') + '\n');
console.log(`frías: ${frias.length} de ${comunes.size} funciones de firma común → ${path.join(salida, 'frio.h')}`);
