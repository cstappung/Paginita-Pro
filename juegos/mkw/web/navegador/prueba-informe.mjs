// Prueba con el juego: el informe de rendimiento separa el juego de la tarjeta sin pedirle nada a quien juega
// (bitácora §173, lo del Oppo del 2026-10-30).
//
// Resumen: con «Mostrar qué frena» prendido (como lo deja «🔬 Perfilar la tarjeta»), el informe de rendimiento debe traer
//   - ultimos10s.cpuPuraMs: la CPU pura del hilo del juego por cuadro (la página mide lo trabajado entre dos esperas,
//     lastre.mjs con K = 1: no frena nada), y
//   - perfilTarjeta.tramoMs: lo que tardó la tarjeta en cada cuadro de verdad (último fin − primer comienzo; mediana), con
//     sumaMs y mosaicos (si las pasadas se pisan, como en una tarjeta de teléfono).
// Corre una carrera directa de 12 CPU en Chrome (perfil nuevo, sin sonido) y mira el informe a los 30 s de carrera; con
// ?cpuPura=0 la CPU pura no debe salir (el camino de antes).
// Uso:  node web/navegador/prueba-informe.mjs [--puerto 8166]   → ✓/✗ y build/web/datos/informe/informe.json
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const i = process.argv.indexOf('--puerto');
const PUERTO = i > 0 ? Number(process.argv[i + 1]) : 8166;
const carpeta = path.join(raiz, 'build/web/datos/informe');
mkdirSync(carpeta, { recursive: true });
const espera = ms => new Promise(r => setTimeout(r, ms));
let bien = 0, mal = 0;
const ok = (txt, si, extra = '') => { si ? bien++ : mal++; console.log(`  ${si ? '✓' : '✗'} ${txt}${extra ? ' — ' + extra : ''}`); };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const salida = {};
try {
  for (const [nombre, extra] of [['con', ''], ['sin', '&cpuPura=0']]) {
    const ctx = await navegador.newContext({ viewport: { width: 960, height: 540 } });
    // «Mostrar qué frena» y «Perfilar la tarjeta» prendidos, como los deja el botón del cajón
    await ctx.addInitScript(() => { try { localStorage.setItem('mkw.graficos', JSON.stringify({ verDetalle: true })); localStorage.setItem('mkw.perfilGpu', '1'); } catch {} });
    const p = await ctx.newPage();
    await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=0.0&cc=c150&cpu=maximo&semilla=11&soloCpu=1${extra}`);
    const t0 = Date.now();
    let enCarrera = 0;
    while (Date.now() - t0 < 240000) {
      await espera(1000);
      const e = await p.evaluate(() => !!window.mkwEstado?.enCarrera).catch(() => false);
      if (e && !enCarrera) enCarrera = Date.now();
      if (enCarrera && Date.now() - enCarrera > 30000) break;
    }
    const inf = await p.evaluate(() => window.mkwInformeRendimiento?.()).catch(e => ({ error: String(e) }));
    salida[nombre] = inf;
    console.log(`${nombre}: ultimos10s ${JSON.stringify(inf?.ultimos10s)} · tarjeta ${JSON.stringify({ tramoMs: inf?.perfilTarjeta?.tramoMs, sumaMs: inf?.perfilTarjeta?.sumaMs, mosaicos: inf?.perfilTarjeta?.mosaicos, msPorCuadro: inf?.perfilTarjeta?.msPorCuadro })}`);
    if (nombre === 'con') {
      ok('llegó a la carrera', !!enCarrera);
      ok('con «Mostrar qué frena», el informe trae la CPU pura del juego (cpuPuraMs > 0)', inf?.ultimos10s?.cpuPuraMs > 0, String(inf?.ultimos10s?.cpuPuraMs));
      ok('…y no frena nada: el lastre de CPU queda en K = 1 y no giró', !inf?.lastre?.cpu || (inf.lastre.cpu.k === 1 && !inf.lastre.cpu.ms), JSON.stringify(inf?.lastre?.cpu));
      const t = inf?.perfilTarjeta;
      ok('el perfil de la tarjeta trae el tramo por cuadro (tramoMs > 0) y la suma de las pasadas', t?.tramoMs > 0 && t?.sumaMs > 0, JSON.stringify({ tramoMs: t?.tramoMs, sumaMs: t?.sumaMs }));
      ok('en este PC las pasadas no se pisan (mosaicos: no)', t?.mosaicos === false);
    } else ok('con ?cpuPura=0, sin la CPU pura (como antes)', inf?.ultimos10s && !('cpuPuraMs' in inf.ultimos10s));
    await ctx.close();
  }
} finally {
  writeFileSync(path.join(carpeta, 'informe.json'), JSON.stringify(salida, null, 1));
  await navegador.close().catch(() => {});
  servidor.kill();
}
console.log(`fin: ${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
