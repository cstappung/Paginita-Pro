// Mide la memoria de la PRECARGA del vestíbulo (?precarga=1, §98) con y sin §119 (C7 del plan de rendimiento).
//
// Resumen: para cada camino (el de antes, ?precargaLiviana=0, y el nuevo) abre un perfil de Chrome nuevo (= un PC que
// nunca jugó), carga la página de la precarga con la red frenada a una casa (por omisión 100 Mbit/s y 50 ms, así dura
// varios segundos y se alcanza a ver el pico), y mientras corre mira cada ~0,3 s la memoria privada de los procesos de
// Chrome de ESE perfil (Windows: Win32_Process.PrivatePageCount, por el --user-data-dir en la línea de comando).
// Dice el pico del proceso de la página (renderer) y de todo el perfil, y cuánto tardó.
//
// Uso:  node herramientas/medir-precarga-memoria.mjs [--mbit 100] [--puerto 8159] [--vueltas 1]
// (solo Windows; necesita el programa comprimido como la prueba-precarga: node herramientas/comprimir-build.mjs)
import { opcionesNavegador } from './navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn, execFile } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(arg('puerto', 8159)), MBIT = Number(arg('mbit', 100)), VUELTAS = Number(arg('vueltas', 1));
const espera = ms => new Promise(r => setTimeout(r, ms));
const mb = b => (b / 1048576).toFixed(0) + ' MB';

// el servidor local con 50 ms por pedido (la red hasta R2) — es nuestro: se apaga al final
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, MKW_LATENCIA: '50' } });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));

// memoria privada de los chrome.exe cuyo comando nombra la carpeta del perfil: { renderer, total } en bytes
const memoria = carpeta => new Promise(res => {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${path.basename(carpeta)}*' } | ` +
    `ForEach-Object { "{0}|{1}" -f ($(if ($_.CommandLine -like '*--type=renderer*') {'r'} else {'o'})), $_.PrivatePageCount }`;
  execFile('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true }, (e, salida) => {
    let renderer = 0, total = 0;
    for (const l of String(salida || '').split(/\r?\n/)) {
      const [t, n] = l.trim().split('|'); if (!n) continue;
      total += Number(n); if (t === 'r') renderer = Math.max(renderer, Number(n));
    }
    res({ renderer, total });
  });
});

async function medir(extra) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mkw-premem-'));
  const ctx = await chromium.launchPersistentContext(dir, { ...opcionesNavegador(), headless: true,
    args: ['--enable-unsafe-webgpu', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0,
    downloadThroughput: MBIT * 1e6 / 8, uploadThroughput: 20e6 / 8 });
  let pico = { renderer: 0, total: 0 }, base = null, sigue = true;
  const vigia = (async () => { while (sigue) { const m = await memoria(dir); if (!base && m.renderer) base = m;
    pico = { renderer: Math.max(pico.renderer, m.renderer), total: Math.max(pico.total, m.total) }; } })();
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${PUERTO}/?precarga=1${extra}`);
  let pre = null;
  for (const hasta = Date.now() + 300000; Date.now() < hasta; await espera(200)) {
    pre = await p.evaluate(() => window.mkwEstado?.precarga || null).catch(() => null);
    if (pre?.listo || pre?.error) break;
  }
  const ms = Date.now() - t0;
  await espera(1500);                                   // (un par de muestras después de terminar)
  const despues = await memoria(dir);
  sigue = false; await vigia;
  const notas = await p.evaluate(() => (window.mkwEstado?.notas || []).filter(n => /precarga/.test(n))).catch(() => []);
  await ctx.close();
  rmSync(dir, { recursive: true, force: true });
  return { extra, ms, listo: !!pre?.listo, error: pre?.error || '', pico, base, despues, notas };
}

const filas = [];
for (let v = 0; v < VUELTAS; v++) for (const [nombre, extra] of [['antes (?precargaLiviana=0)', '&precargaLiviana=0'], ['§119 (liviana)', '']]) {
  const r = await medir(extra);
  filas.push({ nombre, ...r });
  console.log(`${nombre}: ${r.listo ? 'listo' : 'NO terminó ' + r.error} en ${(r.ms / 1000).toFixed(1)} s · pico de la página ${mb(r.pico.renderer)}` +
    ` · pico del perfil ${mb(r.pico.total)} · al terminar: página ${mb(r.despues.renderer)}, perfil ${mb(r.despues.total)}`);
}
const salida = path.join(raiz, 'build/web/datos/precarga-memoria');
mkdirSync(salida, { recursive: true });
writeFileSync(path.join(salida, `medida-${Date.now()}.json`), JSON.stringify({ mbit: MBIT, filas }, null, 1));
servidor.kill();
process.exit(0);
