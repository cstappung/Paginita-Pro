// Mide la espera de §133 (U1): cuánto espera Single Player en el menú de inicio a que lleguen los pipelines de los
// menús, en la 1.ª visita (perfil nuevo) y en la 2.ª (el mismo perfil, con la caché de shaders de Chrome).
//
// Resumen: Chrome con ventana en el tercer monitor (MKW_VENTANA="x,y" = otro lugar), sin sonido; abre ?inicio=1, espera
// el menú, aprieta Enter (Single Player) y lee window.mkwEstado.esperaGraficos (ms; null = no hizo falta esperar).
// Después, a los 20 s del menú «Un jugador», cuántos pipelines faltaban todavía (lo que antes caía en la 1.ª carrera).
//
// Uso:  node herramientas/medir-espera-graficos.mjs [--puerto 8164] [--visitas 2] [--extra "&esperaGraficos=0"]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = (n, def) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : def; };
const PUERTO = Number(arg('puerto', 8164)), VISITAS = Number(arg('visitas', 2)), EXTRA = arg('extra', '');
const espera = ms => new Promise(r => setTimeout(r, ms));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const dir = mkdtempSync(path.join(os.tmpdir(), 'mkw-espera-graficos-'));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome = spawn(CHROME, [`--user-data-dir=${dir}`, `--remote-debugging-port=${PUERTO + 1000}`, `--window-position=${vx + 40},${vy + 40}`,
  '--window-size=1600,900', '--no-first-run', '--no-default-browser-check', '--enable-unsafe-webgpu', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
let navegador = null;
for (let k = 0; k < 50 && !navegador; k++) { await espera(200); navegador = await chromium.connectOverCDP(`http://127.0.0.1:${PUERTO + 1000}`).catch(() => null); }
const ctx = navegador.contexts()[0];

for (let v = 1; v <= VISITAS; v++) {
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${PUERTO}/?inicio=1${EXTRA}${/[?&]n8=/.test(EXTRA) ? '' : '&n8=0'}`);
  const t0 = Date.now();
  while (Date.now() - t0 < 60000 && !(await p.evaluate(() => window.mkwInicio?.visible).catch(() => false))) await espera(200);
  const tMenu = Date.now() - t0;
  await p.bringToFront(); await p.keyboard.down('Enter'); await espera(110); await p.keyboard.up('Enter');
  const tEnter = Date.now();
  let tUnJugador = null;                                  // del Enter al menú «Un jugador» del juego (sección 0x48)
  for (const hasta = Date.now() + 60000; !tUnJugador && Date.now() < hasta; await espera(100))
    if (await p.evaluate(() => window.mkwMenus?.estado?.().seccion === 0x48).catch(() => false)) tUnJugador = Date.now() - tEnter;
  let e = null;
  for (const hasta = Date.now() + 40000; Date.now() < hasta; await espera(200)) {
    e = await p.evaluate(() => ({ espera: window.mkwEstado.esperaGraficos ?? null, inicio: window.mkwEstado.inicio ?? null })).catch(() => null);
    if (e?.inicio && (!e.espera || e.espera.ms !== null)) break;
  }
  await espera(20000);
  const prep = await p.evaluate(() => window.mkwPreparacion?.estado ?? null).catch(() => null);
  console.log(`visita ${v}: menú a los ${tMenu} ms · del Enter a «Un jugador» ${tUnJugador} ms · espera ${e?.espera ? e.espera.ms + ' ms' : 'ninguna'}` +
    (prep ? ` · a los 20 s: ${prep.pipesLlegados} de ${prep.pipesTotal} llegados (meta ${prep.pipesMeta})` : ''));
  await p.close();
}
await navegador.close().catch(() => {});
chrome.kill(); servidor.kill();
await espera(500);
try { rmSync(dir, { recursive: true, force: true }); } catch {}
