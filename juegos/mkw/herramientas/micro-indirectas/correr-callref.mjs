// W23 (bitácora §226): corre la prueba chica de call_ref contra call_indirect (generar-callref.py) en Node y en Chrome.
//
// Resumen: carga build/micro-callref/callref.wasm y, para cada forma de llamar (directa, call_indirect, call_ref) y
// cada grado de polimorfismo (uno, cuatro, muchos destinos), calienta (para que V8 pase de su compilador rápido,
// Liftoff, al optimizador, TurboFan, que es el que adivina y mete en línea) y mide 5 veces 20 millones de llamadas:
// dice los ns por llamada (el mejor de las 5). Sin nada del juego.
// Uso:  node herramientas/micro-indirectas/correr-callref.mjs [--chrome] [--limites] [--v8 "--flags"]
//   --chrome  = también en Chrome (Playwright, sin ventana); --limites = Chrome con --wasm-enforce-bounds-checks (W5)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const bytes = readFileSync(path.join(raiz, 'build/micro-callref/callref.wasm'));

// lo que corre en los dos lados (Node y la página): devuelve { forma: { poli: ns } }
const medir = async (b) => {
  const { instance } = await WebAssembly.instantiate(b);
  const x = instance.exports, bases = { uno: 4096, cuatro: 12288, muchos: 20480 }, V = 20000000;
  const res = {};
  for (const forma of ['directa', 'indirecta', 'ref']) {
    res[forma] = {};
    for (const [poli, base] of Object.entries(bases)) {
      if (forma === 'directa' && poli !== 'uno') continue;
      for (let k = 0; k < 4; k++) x[forma](2000000, base);       // calentar: V8 sube al optimizador con lo aprendido
      let mejor = Infinity;
      for (let k = 0; k < 5; k++) { const t = performance.now(); x[forma](V, base); mejor = Math.min(mejor, (performance.now() - t) / V * 1e6); }
      res[forma][poli] = Math.round(mejor * 100) / 100;
    }
  }
  return res;
};
const mostrar = (donde, r) => {
  console.log(`\n${donde} (ns por llamada, el mejor de 5 × 20 M):`);
  console.log(`  directa: ${r.directa.uno}`);
  for (const p of ['uno', 'cuatro', 'muchos']) console.log(`  ${p.padEnd(7)} call_indirect ${String(r.indirecta[p]).padStart(6)}   call_ref ${String(r.ref[p]).padStart(6)}   (ref ÷ indirecta = ${(r.ref[p] / r.indirecta[p]).toFixed(2)})`);
};

const salida = { node: process.version };
if (opcion('--v8', null)) {
  // con banderas de V8 en Node: otro proceso
  const out = execFileSync(process.execPath, [...opcion('--v8').split(' '), fileURLToPath(import.meta.url), '--solo-node'], { encoding: 'utf8' });
  console.log(out); process.exit(0);
}
salida.nodeRes = await medir(bytes);
mostrar(`Node ${process.version}`, salida.nodeRes);
if (args.includes('--chrome') && !args.includes('--solo-node')) {
  const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
  for (const limites of args.includes('--limites') ? [false, true] : [false]) {
    const nav = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', ...(limites ? ['--js-flags=--wasm-enforce-bounds-checks'] : [])] });
    const p = await nav.newPage();
    await p.goto('about:blank');
    const r = await p.evaluate(`(${medir.toString()})(new Uint8Array([${[...bytes].join(',')}]))`);
    salida[limites ? 'chromeLimites' : 'chrome'] = r;
    mostrar(`Chrome ${nav.version()}${limites ? ' con --wasm-enforce-bounds-checks' : ''}`, r);
    await nav.close();
  }
}
writeFileSync(path.join(raiz, 'build/micro-callref/resultado.json'), JSON.stringify(salida, null, 1));
