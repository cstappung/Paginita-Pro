// Mide cuánto procesador gasta el juego con la pestaña OCULTA (C10 del plan de rendimiento, bitácora §120).
//
// Resumen: abre una carrera directa con 11 CPU (un jugador), espera a que corra, y mide 10 s con la pestaña «oculta»
// (simulada dentro de la página: ver abajo). En cada tramo: el procesador
// ocupado del hilo de la página (TaskDuration de Chrome, en % del tiempo), los cuadros de juego que avanzaron y cuántas
// veces se despertó la espera del reloj (mkwEstado.despiertes, §120). Lo hace con el camino nuevo y con el de antes
// (?esperaOculta=0) en el mismo Chrome, uno después del otro.
//
// Uso:  node herramientas/medir-oculta.mjs [--puerto 8160] [--segundos 10] [--extra "&param=…"]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(arg('puerto', 8160)), SEG = Number(arg('segundos', 10)), EXTRA = arg('extra', '');
const espera = ms => new Promise(r => setTimeout(r, ms));
// La ventana de Chrome va al tercer monitor (el dueño: «si vas a abrir algo hazlo en el tercer monitor»): el de la
// de 144 Hz de esta PC (el de la izquierda, \.DISPLAY5), en x=-1880, y=549 (§160). MKW_VENTANA="x,y" = otro lugar
const ventanaEnMonitor = () => { const [x, y] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
  return [`--window-position=${x + 40},${y + 40}`, '--window-size=1600,900']; };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)],
  { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const dir = mkdtempSync(path.join(os.tmpdir(), 'mkw-oculta-'));
// (Chrome con ventana —WebGPU y el juego como en una PC— pero MINIMIZADA desde el arranque, para no molestar en ningún
// monitor; lanzado aquí mismo, sin las banderas de Playwright; CHROME=ruta si no está en el lugar de siempre. Se mide
// solo «oculta»: lo de la pestaña a la vista ya lo miden medir-cpu y medir-sitio)
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PUERTO_CDP = PUERTO + 1000;
const chrome = spawn(CHROME, [`--user-data-dir=${dir}`, `--remote-debugging-port=${PUERTO_CDP}`, '--start-minimized', ...ventanaEnMonitor(),
  '--no-first-run', '--no-default-browser-check', '--enable-unsafe-webgpu', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
let navegador = null;
for (let k = 0; k < 50 && !navegador; k++) { await espera(200); navegador = await chromium.connectOverCDP(`http://127.0.0.1:${PUERTO_CDP}`).catch(() => null); }
const ctx = navegador.contexts()[0];
async function minimizar(p) {
  const c = await ctx.newCDPSession(p);
  const { windowId } = await c.send('Browser.getWindowForTarget');
  await c.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
}

async function tramo(p, cdp) {
  const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const leer = () => p.evaluate(() => ({ c: window.mkw?._mkw_web_cuadros?.() ?? -1, d: window.mkwEstado?.despiertes ?? 0, oculta: document.hidden }));
  const a = await m(), ja = await leer(), t0 = Date.now();
  await espera(SEG * 1000);
  const b = await m(), jb = await leer(), dt = (Date.now() - t0) / 1000;
  return { oculta: jb.oculta, cpu: Math.round(100 * (b.TaskDuration - a.TaskDuration) / dt), fps: Math.round((jb.c - ja.c) / dt),
           despiertesPorSeg: Math.round((jb.d - ja.d) / dt) };
}

const filas = [];
for (const [nombre, extra] of [['antes (?esperaOculta=0)', '&esperaOculta=0&pausaOculta=0'], ['§120', '&pausaOculta=0'], ['§134 (pausa)', '']]) {
  const p = await ctx.newPage();
  await minimizar(p);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Performance.enable');
  await p.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=directa&pista=13.2&cc=c150&cpu=normal&pj=0&kart=1${extra}${EXTRA}${/[?&]n8=/.test(extra + EXTRA) ? '' : '&n8=0'}`);
  for (const hasta = Date.now() + 180000; Date.now() < hasta; await espera(300)) {
    const x = await p.evaluate(() => { const e = window.mkwMenus?.estado?.(); return e && e.seccion === 0x20 && e.pagina >= 0 && window.mkwEstado?.piloto?.llego; }).catch(() => false);
    if (x) break;
  }
  await espera(4000);
  // Ocultarla de verdad no se pudo con Chrome manejado por CDP (minimizado, sin las banderas de Playwright y sin la
  // emulación de foco, document.hidden seguía en false). Se simula lo que una pestaña oculta le hace a NUESTRO código:
  // document.hidden = true y requestAnimationFrame deja de llamar (el reloj del monitor deja de valer a los 100 ms y el
  // runtime pasa a esperaReloj). Lo que Chrome frena en una oculta (los setTimeout de la página) no lo usa ninguno de los
  // dos caminos: el de antes cede por MessageChannel y el nuevo duerme con el temporizador de un Worker.
  await p.evaluate(() => { window.__rafOriginal = window.requestAnimationFrame;
                           Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
                           window.requestAnimationFrame = () => 0; });
  await espera(1000);
  const oculta = await tramo(p, cdp);
  // §134: vuelve a verse (el getter y rAF de siempre + el aviso visibilitychange): ¿retoma a 60 sin ráfaga de cuadros?
  const c0 = await p.evaluate(() => { delete document.hidden; window.requestAnimationFrame = window.__rafOriginal;
    window.requestAnimationFrame(h => window.mkwRelojMonitor?.tic(h)); document.dispatchEvent(new Event('visibilitychange'));
    return window.mkw?._mkw_web_cuadros?.() ?? -1; });
  await espera(1000);
  const c1 = await p.evaluate(() => window.mkw?._mkw_web_cuadros?.() ?? -1);
  await espera(4000);
  const c2 = await p.evaluate(() => window.mkw?._mkw_web_cuadros?.() ?? -1);
  const pausa = await p.evaluate(() => window.mkwEstado.pausaOculta ?? null);
  const vuelta = { primerSegundo: c1 - c0, siguientes4sPorSeg: Math.round((c2 - c1) / 4), pausa };
  await p.close();
  filas.push({ nombre, oculta, vuelta });
  const t = x => `${x.oculta ? 'oculta' : 'a la vista'}: CPU ${x.cpu} %, ${x.fps} cuadros/s, ${x.despiertesPorSeg} despiertes/s`;
  console.log(`${nombre}: ${t(oculta)} · al volver: ${vuelta.primerSegundo} cuadros el 1.er segundo, ${vuelta.siguientes4sPorSeg}/s después · pausa ${JSON.stringify(pausa)}`);
}
const salida = path.join(raiz, 'build/web/datos/oculta');
mkdirSync(salida, { recursive: true });
writeFileSync(path.join(salida, `medida-${Date.now()}.json`), JSON.stringify(filas, null, 1));
await navegador.close().catch(() => {}); chrome.kill(); await espera(1000); rmSync(dir, { recursive: true, force: true });
servidor.kill();
process.exit(0);
