// Mide cuánto se baja DURANTE la carrera en la 1.ª visita (D2 del plan de rendimiento, bitácora §121).
//
// Resumen: un perfil de Chrome nuevo (= un PC que nunca jugó) abre una carrera directa (?modo=directa: la carrera
// empieza a los pocos segundos, con la fila de fondo —semilla de bloques, voces de las CPU, diminutos— todavía bajando),
// con la red frenada a una casa (--mbit, por omisión 20) y 50 ms hasta los archivos. Mientras la carrera corre
// (mkwEstado.enCarrera, la vigía de §118) suma los bytes que llegan por la red (Network.loadingFinished de Chrome) y
// cuenta las lecturas que el juego tuvo que esperar (mkwFaltas). Lo hace con el camino de antes (?pausaCarrera=0) y con
// el nuevo, cada uno en su perfil nuevo.
//
// Uso:  node herramientas/medir-fondo-carrera.mjs [--mbit 20] [--segundos 30] [--puerto 8161]
import { opcionesNavegador } from './navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(arg('puerto', 8161)), MBIT = Number(arg('mbit', 20)), SEG = Number(arg('segundos', 30));
const espera = ms => new Promise(r => setTimeout(r, ms));
const mb = b => (b / 1048576).toFixed(1) + ' MB';

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, MKW_LATENCIA: '50' } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));

async function medir(extra) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mkw-fondo-'));
  const ctx = await chromium.launchPersistentContext(dir, { ...opcionesNavegador(), headless: true, viewport: { width: 960, height: 540 },
    args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: MBIT * 1e6 / 8, uploadThroughput: 10e6 / 8 });
  let enCarrera = false, bytesCarrera = 0, pedidosCarrera = 0, bytesTotal = 0;
  cdp.on('Network.loadingFinished', e => { bytesTotal += e.encodedDataLength; if (enCarrera) { bytesCarrera += e.encodedDataLength; pedidosCarrera++; } });
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=13.2&cc=c150&cpu=normal&pj=0&kart=1${extra}`);
  const t0 = Date.now();
  let tCarrera = 0;
  for (const hasta = Date.now() + 240000; Date.now() < hasta; await espera(100)) {
    const e = await p.evaluate(() => !!window.mkwEstado?.enCarrera).catch(() => false);
    if (e && !enCarrera) { enCarrera = true; tCarrera = Date.now(); }
    if (enCarrera && Date.now() - tCarrera > SEG * 1000) break;
  }
  enCarrera = false;
  const x = await p.evaluate(() => ({ faltas: window.mkwFaltas ? window.mkwFaltas().length : null, cola: window.mkwDisco?.estado.colaBaja?.() ?? null,
    fps: window.mkwEstado?.fps, notas: (window.mkwEstado?.log || []).filter(l => /descargas de fondo/.test(l)).slice(0, 3) })).catch(() => ({}));
  await ctx.close(); rmSync(dir, { recursive: true, force: true });
  return { extra, aLaCarrera: (tCarrera - t0) / 1000, bytesCarrera, pedidosCarrera, bytesTotal, ...x };
}

const filas = [];
for (const [nombre, extra] of [['antes (?pausaCarrera=0)', '&pausaCarrera=0'], ['§121', '']]) {
  const r = await medir(extra);
  filas.push({ nombre, ...r });
  console.log(`${nombre}: carrera a los ${r.aLaCarrera.toFixed(1)} s; en ${SEG} s de carrera llegaron ${mb(r.bytesCarrera)} en ${r.pedidosCarrera} pedidos ` +
    `(en total ${mb(r.bytesTotal)}); lecturas del juego a la red en carrera: ${r.faltas ?? '—'}; en fila al final: ${r.cola}`);
}
const salida = path.join(raiz, 'build/web/datos/fondo-carrera');
mkdirSync(salida, { recursive: true });
writeFileSync(path.join(salida, `medida-${Date.now()}.json`), JSON.stringify({ mbit: MBIT, filas }, null, 1));
servidor.kill();
process.exit(0);
