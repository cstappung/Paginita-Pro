// V8 de la etapa 7 (bitácora §249): ¿en qué se van los ~10 ms del lado CPU del dibujo? Reparte un perfil de CPU de la
// carrera (.cpuprofile de `medir-sitio --perfilar`, tiene los nombres de las funciones) en:
//   - la lógica (EGG::SceneManager::calc, func_8023AE60) y el dibujo (EGG::SceneManager::draw, func_8023AEAC, más la
//     copia a la pantalla, XfbManager::copyEFB, func_80244268), por tiempo incluido (todo lo que cuelga de cada una);
//   - dentro del dibujo, el tiempo propio de cada función agrupado: el código de dibujo del juego traducido, el runtime
//     de GX (lo que interpreta las órdenes de la Wii: listas de dibujo, vértices, estados), aurora (convertir el estado
//     de GX, buscar recetas/pipelines, armar constantes, texturas), WebGPU y el pegamento de JavaScript, y V8 por dentro;
//   - las funciones más caras del dibujo (tiempo propio) y algunas preguntas puntuales: las listas de dibujo
//     (GXCallDisplayList y lo que cuelga), la búsqueda de recetas (pipelines) y las texturas.
// Como medir con una pinza amperimétrica cada rama de un tablero: el total ya se sabe (~10 ms), falta saber qué rama
// se lleva la corriente.
// Uso: node herramientas/reparto-dibujo.mjs <archivo.cpuprofile> [--top 40]   → <archivo>-reparto-dibujo.json
import { readFileSync, writeFileSync } from 'node:fs';

const archivo = process.argv[2];
if (!archivo) { console.error('uso: node herramientas/reparto-dibujo.mjs <archivo.cpuprofile> [--top 40]'); process.exit(2); }
const iTop = process.argv.indexOf('--top'), TOP = iTop > 0 ? Number(process.argv[iTop + 1]) : 40;
const perfil = JSON.parse(readFileSync(archivo, 'utf8'));
const nodos = new Map(perfil.nodes.map(n => [n.id, n]));
const padre = new Map();
for (const n of perfil.nodes) for (const h of n.children || []) padre.set(h, n.id);
// tiempo de cada muestra (µs): timeDeltas[i] es el tiempo ANTES de la muestra i; la muestra i dura hasta la siguiente
const dur = perfil.samples.map((_, i) => (perfil.timeDeltas[i + 1] ?? perfil.timeDeltas[i] ?? 0));
const nombre = id => { const cf = nodos.get(id).callFrame; return cf.functionName || (cf.url ? `(${cf.url.split('/').pop()})` : '(nativo)'); };

// a qué raíz pertenece cada nodo: la primera de la pila (de abajo hacia arriba) que sea dibujo o lógica
const RAICES = [['dibujo', /^\$?func_8023AEAC|^\$?func_80244268/], ['logica', /^\$?func_8023AE60/]];
const raizDe = new Map();
const buscarRaiz = id => {
  if (raizDe.has(id)) return raizDe.get(id);
  const camino = []; let r = 'fuera', x = id;
  while (x !== undefined) {
    if (raizDe.has(x)) { r = raizDe.get(x); break; }
    camino.push(x);
    const nm = nombre(x); const hit = RAICES.find(([, re]) => re.test(nm));
    if (hit) { r = hit[0]; break; }
    x = padre.get(x);
  }
  // (lo más cercano gana: si el dibujo está dentro de la lógica, cuenta como dibujo)
  for (const c of camino) raizDe.set(c, r);
  return r;
};

// los grupos del tiempo propio (por el nombre de la función)
const GRUPOS = [
  ['V8 por dentro (programa, recolector, ocioso)', /^\((program|garbage collector|idle|root)\)$/],
  ['WebGPU y pegamento de JavaScript', /^(_?wgpu|emwgpu|Wgpu|GPU|_emwgpu|__emwgpu|webgpu|\(.*\.m?js\))|^[a-z][A-Za-z]*$/],
  ['aurora: buscar recetas (pipelines) y enlaces', /pipeline|Pipeline|bind_group|BindGroup|bindGroup/],
  ['aurora: texturas', /textur|Textur|texture|convert_tex|tex_/],
  ['aurora: convertir el estado de GX, constantes y vértices', /aurora|^\$?gx::|::gx::|shader_info|build_uniform|push_uniform|ShaderConfig|vtx|Vtx/],
  ['runtime GX: listas de dibujo (GXCallDisplayList y su intérprete)', /CallDisplayList|DisplayList|display_list|gx_dl|command_processor|process_command|cp_|Fifo|fifo|FIFO/],
  ['runtime GX: lo demás (estados, vértices, matrices)', /^\$?GX|^\$?gx_|HLE_GX|GX__|__GX/],
  ['juego traducido (código de dibujo de la Wii)', /^\$?(func_|rr_)[0-9A-Fa-f_a-z]+/],
  ['ayudantes del traductor (semántica de PowerPC, llamadas)', /Invoke|Dispatch|ppc_|Ppc|PPC|CpuThunk|Memory|memory/],
  ['libc (memcpy, malloc…)', /^\$?(memcpy|memset|memmove|malloc|free|dlmalloc|dlfree|operator new|operator delete|__)/],
];
const grupoDe = nm => (GRUPOS.find(([, re]) => re.test(nm)) || ['otro'])[0];

const porRaiz = { dibujo: 0, logica: 0, fuera: 0 };
const propioDibujo = new Map(), gruposDibujo = new Map(), gruposTodo = new Map();
let total = 0;
perfil.samples.forEach((id, i) => {
  const d = dur[i]; total += d;
  const r = buscarRaiz(id), nm = nombre(id), g = grupoDe(nm);
  porRaiz[r] += d;
  gruposTodo.set(g, (gruposTodo.get(g) || 0) + d);
  if (r === 'dibujo') {
    propioDibujo.set(nm, (propioDibujo.get(nm) || 0) + d);
    gruposDibujo.set(g, (gruposDibujo.get(g) || 0) + d);
  }
});
// tiempo incluido de algunas funciones dentro del dibujo (todo lo que cuelga de ellas)
const incluido = re => {
  let t = 0;
  perfil.samples.forEach((id, i) => {
    if (buscarRaiz(id) !== 'dibujo') return;
    for (let x = id; x !== undefined; x = padre.get(x)) if (re.test(nombre(x))) { t += dur[i]; break; }
  });
  return t;
};
const pct = x => +(100 * x / total).toFixed(2);
const PREGUNTAS = {
  'listas de dibujo (GXCallDisplayList y todo lo que cuelga)': /CallDisplayList/,
  'buscar o armar recetas (pipeline)': /pipeline|Pipeline/,
  'texturas (cargar, convertir, subir)': /textur|Textur|texture/,
  'presentar y esperar (copyEFB → GXCopyDisp → VI)': /func_80244268|CopyDisp|PresentFrame/,
  'efectos (nw4r::ef, func_8067CF74)': /func_8067CF74/,
};
const r = {
  archivo, totalMs: +(total / 1000).toFixed(1),
  partes: Object.fromEntries(Object.entries(porRaiz).map(([k, v]) => [k, pct(v)])),
  dibujo: Object.fromEntries([...gruposDibujo].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, pct(v)])),
  preguntas: Object.fromEntries(Object.entries(PREGUNTAS).map(([k, re]) => [k, pct(incluido(re))])),
  topDibujo: [...propioDibujo].sort((a, b) => b[1] - a[1]).slice(0, TOP).map(([k, v]) => [k, pct(v)]),
  todo: Object.fromEntries([...gruposTodo].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, pct(v)])),
};
writeFileSync(archivo.replace(/\.cpuprofile$/, '') + '-reparto-dibujo.json', JSON.stringify(r, null, 1));
console.log(`perfil ${r.totalMs} ms de muestras · lógica ${r.partes.logica} % · dibujo ${r.partes.dibujo} % · fuera de las dos ${r.partes.fuera} %`);
console.log('el dibujo por grupos (% del total):'); for (const [k, v] of Object.entries(r.dibujo)) console.log(`  ${String(v).padStart(6)} %  ${k}`);
console.log('preguntas (tiempo incluido dentro del dibujo, % del total):'); for (const [k, v] of Object.entries(r.preguntas)) console.log(`  ${String(v).padStart(6)} %  ${k}`);
console.log(`las ${Math.min(TOP, 25)} funciones más caras del dibujo (tiempo propio):`); for (const [k, v] of r.topDibujo.slice(0, 25)) console.log(`  ${String(v).padStart(6)} %  ${k}`);
