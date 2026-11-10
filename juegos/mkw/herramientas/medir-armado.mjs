// Mide cuánto tarda armar el sistema de archivos del juego antes de arrancarlo (C6 del plan de rendimiento, §130).
//
// Resumen: abre la página del juego N veces con el camino nuevo y N con el de antes (?armadoRapido=0), en un Chrome
// minimizado, y lee window.mkwEstado.armado (ms de la tarea, cuántos archivos, MB con contenido). Es una sola tarea
// antes de callMain: si pasa de 50 ms traba la página.
//
// Uso:  node herramientas/medir-armado.mjs [--puerto 8162] [--veces 3]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(arg('puerto', 8162)), VECES = Number(arg('veces', 3));
const espera = ms => new Promise(r => setTimeout(r, ms));
// La ventana de Chrome va al tercer monitor (el dueño: «si vas a abrir algo hazlo en el tercer monitor»): el de la
// de 144 Hz de esta PC (el de la izquierda, \.DISPLAY5), en x=-1880, y=549 (§160). MKW_VENTANA="x,y" = otro lugar
const ventanaEnMonitor = () => { const [x, y] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
  return [`--window-position=${x + 40},${y + 40}`, '--window-size=1600,900']; };

// el servidor del juego (solo esta PC)
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
// Chrome en el tercer monitor, sin sonido
const dir = mkdtempSync(path.join(os.tmpdir(), 'mkw-armado-'));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome = spawn(CHROME, [`--user-data-dir=${dir}`, `--remote-debugging-port=${PUERTO + 1000}`, ...ventanaEnMonitor(),
  '--no-first-run', '--no-default-browser-check', '--enable-unsafe-webgpu', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
let navegador = null;
for (let k = 0; k < 50 && !navegador; k++) { await espera(200); navegador = await chromium.connectOverCDP(`http://127.0.0.1:${PUERTO + 1000}`).catch(() => null); }
const ctx = navegador.contexts()[0];

const filas = { nuevo: [], antes: [] };
for (let v = 0; v < VECES; v++) {
  for (const [nombre, extra] of [['antes', '&armadoRapido=0'], ['nuevo', '']]) {
    const p = await ctx.newPage();
    await p.goto(`http://127.0.0.1:${PUERTO}/?portada=0&inicio=0${extra}${/[?&]n8=/.test(extra) ? '' : '&n8=0'}`);
    let a = null;
    for (const hasta = Date.now() + 120000; !a && Date.now() < hasta; await espera(200)) a = await p.evaluate(() => window.mkwEstado?.armado ?? null).catch(() => null);
    filas[nombre].push(a);
    console.log(nombre, JSON.stringify(a));
    await p.close();
  }
}
const mediana = l => { const x = l.filter(Boolean).map(a => a.ms).sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
console.log(`mediana: antes ${mediana(filas.antes)} ms · nuevo ${mediana(filas.nuevo)} ms (${filas.nuevo[0]?.archivos} archivos, ${filas.nuevo[0]?.mb} MB)`);
await navegador.close().catch(() => {});
chrome.kill(); servidor.kill();
await espera(500);
try { rmSync(dir, { recursive: true, force: true }); } catch {}
