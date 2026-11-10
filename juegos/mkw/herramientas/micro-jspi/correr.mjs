// Compila y corre la prueba chica de JSPI (jspi.c, bitácora §166) y reparte su perfil.
//
// Resumen: compila jspi.c con emcc -sJSPI en build/micro-jspi/, lo corre en Node dos veces (sin esperas y con 4.000
// esperas) bajo --cpu-prof y dice cuánto fue la función «trabajo», cuánto «(program)» y cuánto lo demás, y los µs de
// «(program)» de cada ida y vuelta de JSPI. (Los contadores internos de V8, --runtime-call-stats, no se pueden: Node y
// Chrome vienen compilados sin ellos, «RCS was disabled at compile-time», §166.)
// Uso:  node herramientas/micro-jspi/correr.mjs   → build/micro-jspi/resultado.txt
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(raiz, 'build/micro-jspi');
mkdirSync(dir, { recursive: true });
const emcc = path.join(raiz, 'herramientas/emsdk/upstream/emscripten/emcc.py');
const c = spawnSync('python', [emcc, '-O2', '-sJSPI', path.join(raiz, 'herramientas/micro-jspi/jspi.c'), '-o', path.join(dir, 'jspi.js')], { stdio: 'inherit' });
if (c.status) process.exit(1);

const informe = [];
const programa = {};
const decir = s => { console.log(s); informe.push(s); };
for (const conEsperas of [false, true]) {
  const extra = conEsperas ? ['si'] : [];
  // 1) el perfil de CPU (cada 50 µs, como perfil-impuesto.mjs)
  const prof = path.join(dir, 'perfil-' + (conEsperas ? 'con' : 'sin'));
  rmSync(prof, { recursive: true, force: true });
  const r = spawnSync(process.execPath, ['--experimental-wasm-jspi', '--cpu-prof', '--cpu-prof-interval', '50', '--cpu-prof-dir', prof, path.join(dir, 'jspi.js'), ...extra], { encoding: 'utf8' });
  decir(r.stdout.trim());
  const p = JSON.parse(readFileSync(path.join(prof, readdirSync(prof)[0]), 'utf8'));
  const porNodo = new Map(p.nodes.map(n => [n.id, n.callFrame.functionName || '(anónima)']));
  const cuenta = new Map();
  for (const s of p.samples) { const n = porNodo.get(s); cuenta.set(n, (cuenta.get(n) || 0) + 1); }
  const total = p.samples.length;
  decir('  perfil: ' + [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, k]) => `${n} ${(k / total * 100).toFixed(1)} %`).join(' · '));
  // 2) lo que el perfil carga a «(program)», en ms: con esperas menos sin esperas, dividido por las 4.000 esperas, es lo
  //    que cuesta cada ida y vuelta de JSPI (congelar el wasm, cumplir la promesa, seguir en una microtarea)
  const msPrograma = (cuenta.get('(program)') || 0) * (p.endTime - p.startTime) / 1000 / total;
  programa[conEsperas ? 'con' : 'sin'] = msPrograma;
  decir(`  (program): ${msPrograma.toFixed(1)} ms`);
}
decir(`cada ida y vuelta de JSPI: ${((programa.con - programa.sin) / 4000 * 1000).toFixed(1)} µs de (program)`);
writeFileSync(path.join(dir, 'resultado.txt'), informe.join('\n') + '\n');
