// Analiza una traza de Chrome (medir-sitio.mjs --trazaChrome): cuánto tiempo pasó ocupado cada hilo de cada proceso
// y en qué eventos (los de nivel superior, sin contar dos veces lo anidado). Sirve para ver si el cuello está en la
// página (CrRendererMain), en el proceso de la GPU (CrGpuMain), en el compositor (VizCompositorThread), etc.
// Uso: node herramientas/analizar-chrome.mjs <traza.json> [--hilo CrGpuMain]
import { readFileSync } from 'node:fs';
const archivo = process.argv[2];
const filtro = process.argv.includes('--hilo') ? process.argv[process.argv.indexOf('--hilo') + 1] : null;
const { traceEvents: ev } = JSON.parse(readFileSync(archivo, 'utf8'));
const nombres = new Map(), procesos = new Map();
for (const e of ev) {
  if (e.ph === 'M' && e.name === 'thread_name') nombres.set(`${e.pid}:${e.tid}`, e.args.name);
  if (e.ph === 'M' && e.name === 'process_name') procesos.set(e.pid, e.args.name);
}
const completos = ev.filter(e => e.ph === 'X' && e.dur > 0);
let t0 = Infinity, t1 = -Infinity;
for (const e of completos) { if (e.ts < t0) t0 = e.ts; if (e.ts + e.dur > t1) t1 = e.ts + e.dur; }
const seg = (t1 - t0) / 1e6;
// por hilo: unión de intervalos de eventos (lo anidado no cuenta dos veces) y suma por nombre de los de nivel superior
const porHilo = new Map();
for (const e of completos) { const k = `${e.pid}:${e.tid}`; if (!porHilo.has(k)) porHilo.set(k, []); porHilo.get(k).push(e); }
const filas = [];
for (const [k, lista] of porHilo) {
  lista.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  let ocupado = 0, finActual = -1; const top = new Map();
  for (const e of lista) {
    if (e.ts >= finActual) { ocupado += e.dur; finActual = e.ts + e.dur; top.set(e.name, (top.get(e.name) || 0) + e.dur); }
    else if (e.ts + e.dur > finActual) { ocupado += e.ts + e.dur - finActual; finActual = e.ts + e.dur; }
  }
  const pid = +k.split(':')[0];
  filas.push({ hilo: nombres.get(k) || k, proceso: procesos.get(pid) || pid, pct: 100 * ocupado / (t1 - t0), top });
}
filas.sort((a, b) => b.pct - a.pct);
console.log(`traza de ${seg.toFixed(2)} s`);
for (const f of filas.slice(0, 14)) {
  if (filtro && f.hilo !== filtro) continue;
  console.log(`${f.pct.toFixed(1).padStart(5)} %  ${f.proceso} / ${f.hilo}`);
  for (const [n, d] of [...f.top].sort((a, b) => b[1] - a[1]).slice(0, filtro ? 25 : 4)) console.log(`         ${(d / 1000 / seg).toFixed(2).padStart(6)} ms/s  ${n}`);
}
