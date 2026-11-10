// Mide la memoria de verdad del juego (C9 del plan de rendimiento, §141): por proceso de Chrome y por dentro de la página.
//
// Resumen: Chrome con ventana en el tercer monitor (MKW_VENTANA="x,y" = otro lugar), sin sonido, perfil nuevo. Abre una
// carrera directa con 11 CPU y a los `--segundos` de carrera anota:
//   - la memoria privada (Win32_Process.PrivatePageCount) de cada chrome.exe de ese perfil, por tipo: la pestaña
//     (renderer), la tarjeta (gpu-process), el navegador y los demás (utility…);
//   - dentro de la página: el heap del programa (lo reservado), lo usado de verdad (sbrk(0), si el programa lo exporta),
//     el heap de JavaScript (performance.memory) y los bloques del disco en memoria.
// Después abre una 2.ª pestaña con otra carrera y vuelve a medir (dos juegos en el mismo Chrome).
//
// Uso:  node herramientas/medir-memoria.mjs [--puerto 8166] [--segundos 30] [--extra "&param=…"] [--una]
import { spawn, execFile } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(arg('puerto', 8166)), SEG = Number(arg('segundos', 30)), EXTRA = arg('extra', ''), UNA = process.argv.includes('--una');
const espera = ms => new Promise(r => setTimeout(r, ms));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const MB = b => Math.round(b / 1048576);

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const dir = mkdtempSync(path.join(os.tmpdir(), 'mkw-memoria-'));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome = spawn(CHROME, [`--user-data-dir=${dir}`, `--remote-debugging-port=${PUERTO + 1000}`, `--window-position=${vx + 40},${vy + 40}`,
  '--window-size=1600,900', '--no-first-run', '--no-default-browser-check', '--enable-unsafe-webgpu', '--mute-audio',
  '--enable-precise-memory-info', 'about:blank'], { stdio: 'ignore' });
let navegador = null;
for (let k = 0; k < 50 && !navegador; k++) { await espera(200); navegador = await chromium.connectOverCDP(`http://127.0.0.1:${PUERTO + 1000}`).catch(() => null); }
const ctx = navegador.contexts()[0];

// memoria privada de los chrome.exe de este perfil, por tipo de proceso (MB)
const procesos = () => new Promise(res => {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${path.basename(dir)}*' } | ` +
    `ForEach-Object { $t = 'navegador'; if ($_.CommandLine -match '--type=([a-z-]+)') { $t = $matches[1] }; ` +
    `if ($_.CommandLine -match 'utility-sub-type=([A-Za-z.]+)') { $t = $t + ':' + $matches[1] }; "{0}|{1}|{2}" -f $t, $_.PrivatePageCount, $_.WorkingSetSize }`;
  execFile('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true }, (e, salida) => {
    // la memoria privada cuenta lo reservado aunque nadie lo haya tocado (H6, §211: el hueco de la ventana fija); la
    // física (el conjunto de trabajo) es la RAM que de verdad ocupa cada pestaña
    const por = {}, pestañas = [], fisica = [];
    for (const l of String(salida || '').split(/\r?\n/)) {
      const [t, n, ws] = l.trim().split('|'); if (!n) continue;
      if (t === 'renderer' && ws) fisica.push(MB(Number(ws)));
      const tipo = t.startsWith('utility') ? 'otros' : t === 'gpu-process' ? 'tarjeta' : t === 'renderer' ? 'pestañas' : t === 'navegador' ? 'navegador' : 'otros';
      por[tipo] = (por[tipo] || 0) + Number(n);
      if (t === 'renderer') pestañas.push(MB(Number(n)));
    }
    const total = Object.values(por).reduce((s, x) => s + x, 0);
    res({ ...Object.fromEntries(Object.entries(por).map(([k, v]) => [k, MB(v)])), total: MB(total), pestañas: pestañas.sort((a, b) => b - a), fisica: fisica.sort((a, b) => b - a) });
  });
});

const dentro = p => p.evaluate(() => {
  const M = window.mkw;
  return { heap: Math.round((M?.HEAPU8?.length || 0) / 1048576), usado: M?._sbrk ? Math.round((M._sbrk(0) >>> 0) / 1048576) : null,
           js: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
           bloques: window.mkwDisco?.estado?.memoriaMB?.() ?? null, cuadros: M?._mkw_web_cuadros?.() ?? -1 };
}).catch(() => null);

async function abrirCarrera() {
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=13.2&cc=c150&cpu=normal&pj=0&kart=1${EXTRA}${/[?&]n8=/.test(EXTRA) ? '' : '&n8=0'}`);
  for (const hasta = Date.now() + 240000; Date.now() < hasta; await espera(500)) {
    const x = await p.evaluate(() => { const e = window.mkwMenus?.estado?.(); return e && e.seccion === 0x20 && window.mkwEstado?.enCarrera; }).catch(() => false);
    if (x) break;
  }
  return p;
}

const filas = [];
const p1 = await abrirCarrera();
await espera(SEG * 1000);
filas.push({ cuando: '1 pestaña en carrera', procesos: await procesos(), pagina: [await dentro(p1)] });
console.log(JSON.stringify(filas.at(-1)));
if (!UNA) {
  const p2 = await abrirCarrera();
  await espera(SEG * 1000);
  filas.push({ cuando: '2 pestañas en carrera', procesos: await procesos(), pagina: [await dentro(p1), await dentro(p2)] });
  console.log(JSON.stringify(filas.at(-1)));
}
const salida = path.join(raiz, 'build/web/datos/memoria');
mkdirSync(salida, { recursive: true });
writeFileSync(path.join(salida, `medida-${Date.now()}.json`), JSON.stringify(filas, null, 1));
await navegador.close().catch(() => {}); chrome.kill(); servidor.kill();
await espera(1000);
try { rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(0);
