// El reparto del impuesto del navegador en partes con nombre (N13, bitácora §160), de los resúmenes de
// herramientas/perfil-impuesto.mjs: el nativo normal (promedio de --normales), el nativo «revisado» (la memoria por la
// tabla de páginas, como en wasm) y el wasm (promedio de todas las corridas). Todo en ms de CPU por cuadro.
// Uso: node herramientas/reparto-impuesto.mjs [--normales n13-a,n13-b] [--revisado n13-revisado]
//      → build/web/datos/impuesto-perfil/reparto.json
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opcion = (n, def) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : def; };
const dir = path.join(raiz, 'build/web/datos/impuesto-perfil');
const leer = (e) => JSON.parse(readFileSync(path.join(dir, `${e}-resumen.json`), 'utf8'));
const normales = opcion('--normales', 'n13-a,n13-b').split(',').map(leer), revisado = leer(opcion('--revisado', 'n13-revisado'));
const prom = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const g = (r, nombre, lado) => r.grupos[nombre]?.[lado] ?? 0;
const nombresGrupos = [...new Set([...normales, revisado].flatMap((r) => Object.keys(r.grupos)))];
const lado = (rs, l) => Object.fromEntries(nombresGrupos.map((n) => [n, prom(rs.map((r) => g(r, n, l)))]));
const N = lado(normales, 'nativo'), R = lado([revisado], 'nativo'), W = lado([...normales, revisado], 'wasm');
const suma = (o, ns) => ns.reduce((s, n) => s + (o[n] ?? 0), 0);
const tot = (o) => suma(o, nombresGrupos);
// las partes: cada una, los grupos que la forman (la memoria por la tabla de páginas sale de revisado − normal)
const PARTES = [
  ['Código del juego traducido (el que arma V8 contra el que arma clang)', ['juego traducido (func_…)', 'Retro Rewind traducido (rr_…)', 'ayudantes de PowerPC (semántica)', 'memoria de la Wii (runtime)']],
  ['Salir del wasm: el cambio de hilo por JSPI, su vuelta, las promesas y la basura que dejan', ['puentes wasm↔JS', 'recolector de basura de V8', 'V8 por dentro (program)', 'JavaScript (pegamento de emscripten, Node)', 'JSPI: promesas y microtareas']],
  ['Las llamadas: trampolines directos y despacho indirecto', ['llamadas directas del traductor (trampolines)', 'despacho de llamadas (runtime)']],
  ['El sistema operativo de mentira: hilos, alarmas y la hora', ['hilos, relojes y alarmas (HLE)', 'la hora (reloj del sistema)']],
  ['El sonido (HLE del DSP)', ['sonido (HLE)']],
  ['Varios del runtime (FIFO de GX, texturas, red, música; sin una causa común)', ['otro runtime / bibliotecas', 'libc (memcpy, malloc)', 'aurora / GX (sin pantalla)', 'archivos y registro (Node / Windows; en la página es MEMFS)']],
  ['Lo que el nativo hace en el sistema y el wasm no (ntdll, kernel)', ['sistema (DLL: ntdll, kernel, ucrt)']],
];
const totN = tot(N), totR = tot(R), totW = tot(W), dif = totW - totN;
const filas = [{ parte: 'La memoria de la Wii por la tabla de páginas (nativo revisado − nativo)', ms: totR - totN }];
for (const [nombre, gs] of PARTES) filas.push({ parte: nombre, ms: suma(W, gs) - suma(R, gs), nativoRevisado: suma(R, gs), wasm: suma(W, gs) });
const conNombre = filas.filter((f) => !/^Varios/.test(f.parte)).reduce((s, f) => s + f.ms, 0);
const r = { totales: { nativo: totN, nativoRevisado: totR, wasm: totW, razon: totW / totN, razonRevisado: totW / totR, diferencia: dif },
  partes: filas.map((f) => ({ ...f, parteDelTotal: f.ms / dif * 100, parteDelResto: f.parte.startsWith('La memoria') ? null : f.ms / (totW - totR) * 100 })),
  sinCausaComun: (dif - conNombre) / dif * 100,
  corridas: { normales: opcion('--normales', 'n13-a,n13-b'), revisado: opcion('--revisado', 'n13-revisado') } };
writeFileSync(path.join(dir, 'reparto.json'), JSON.stringify(r, null, 1));
console.log(`CPU por cuadro: nativo ${totN.toFixed(3)} · nativo revisado ${totR.toFixed(3)} · wasm ${totW.toFixed(3)} ms → ×${r.totales.razon.toFixed(2)} (contra el revisado ×${r.totales.razonRevisado.toFixed(2)})`);
for (const f of r.partes) console.log(`  ${f.ms.toFixed(3)} ms  ${f.parteDelTotal.toFixed(1).padStart(5)} % del total  ${f.parteDelResto === null ? '      ' : f.parteDelResto.toFixed(1).padStart(5) + ' %'} del resto   ${f.parte}`);
console.log(`sin causa común: ${r.sinCausaComun.toFixed(1)} % → ${path.relative(raiz, path.join(dir, 'reparto.json'))}`);
