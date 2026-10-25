// El sonido como lo oye un jugador en la página real (§88): demora y cortes, camino viejo contra AudioWorklet.
//
// Resumen: levanta el sitio local como GitHub Pages (sitio-local.mjs: SIN COOP/COEP, o sea sin memoria compartida, y
// el Worker de verdad con 50 ms de latencia), abre la página de Juegos con Mario Kart en su marco, la toca (el gesto
// que desbloquea el sonido) y mide en tres momentos:
//   1. el título, 10 s: cortes (huecos = el sonido se cortó; vacíos = la cola se vació aunque fuera en silencio),
//      saltos y la cola;
//   2. la demora con el clic de prueba (sonido.mjs medirDemora: el juego mudo ~3 s, un clic, cuándo suena);
//   3. una carrera (Mario Kart, con Mario: las mismas teclas que medir-sitio.mjs), 20 s acelerando: cortes y cola;
//      y otra vez la demora, ya en la carrera.
// Cada camino se abre con un perfil de Chrome nuevo (primera visita), uno después del otro, y al final una tabla.
//
// Uso:  node herramientas/medir-sonido.mjs [--caminos viejo,worklet] [--cpu 2] [--puerto 8176] [--extra "&audioMs=30"]
//       MKW_BUILD=build/web-audio/navegador node herramientas/medir-sonido.mjs     (otro build)
// Sale en build/web/datos/medir-sonido/<fecha>.json (+ .log con la consola del juego).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const CAMINOS = opcion('--caminos', 'viejo,worklet').split(',');
const CPU = Number(opcion('--cpu', 1));               // el hilo de la página N veces más lento (una PC más débil)
const PUERTO = Number(opcion('--puerto', 8176));      // el sitio; el Worker va en el siguiente
const EXTRA = opcion('--extra', '');
// Del título a la primera carrera de Mario Kart con Mario: [tecla, cuadros que espera] (como medir-sitio.mjs)
const PASOS = [150, 120, 150, 150, 150, 180, 210, 150, 150, 150, 210, 150, 150, 150, 150, 240, 720].map(c => ['KeyK', c]);

const carpeta = path.join(raiz, 'build/web/datos/medir-sonido');
mkdirSync(carpeta, { recursive: true });
const sello = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const log = createWriteStream(path.join(carpeta, sello + '.log'));

// 1) El sitio local (Pages sin COOP/COEP + el Worker de verdad)
const sitio = spawn(process.execPath, [path.join(raiz, 'herramientas/sitio-local.mjs'), '--puerto', String(PUERTO), '--latencia', '50'],
  { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => { let t = ''; sitio.stdout.on('data', d => { t += d; if (t.includes('worker (')) listo(); }); });
const PAGES = `http://127.0.0.1:${PUERTO}`;

const resultados = {};
try {
  for (const camino of CAMINOS) resultados[camino] = await medir(camino);
} finally {
  sitio.kill();
}
writeFileSync(path.join(carpeta, sello + '.json'), JSON.stringify({ cpu: CPU, extra: EXTRA, resultados }, null, 1));

// La tabla
const f = (x, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? '—' : Number(x).toFixed(d));
console.log(`\nSonido en la página real (sin COOP/COEP${CPU > 1 ? `, CPU frenada ${CPU}×` : ''}):`);
console.log('camino   | demora título | demora carrera | huecos título | huecos carrera | vacíos | saltos/tirados | cola carrera (objetivo)');
for (const [c, r] of Object.entries(resultados)) {
  if (r.error) { console.log(`${c.padEnd(8)} | ${r.error}`); continue; }
  console.log(`${c.padEnd(8)} | ${f(r.titulo.demora?.mediana).padStart(9)} ms | ${f(r.carrera.demora?.mediana).padStart(10)} ms | ` +
              `${String(r.titulo.huecos).padStart(13)} | ${String(r.carrera.huecos).padStart(14)} | ${String(r.titulo.vacios + r.carrera.vacios).padStart(6)} | ` +
              `${String(r.titulo.tirados + r.carrera.tirados).padStart(14)} | ${f(r.carrera.colaMs)} ms (${f(r.carrera.objetivoMs)})`);
}
for (const [c, r] of Object.entries(resultados)) if (r.carrera?.esperas?.some(n => n))
  console.log(`${c}: esperas entre entregas en la carrera (< 10 / 20 / 30 / 50 / 80 / 120 / más ms): ${r.carrera.esperas.join(' / ')}`);
console.log(`→ build/web/datos/medir-sonido/${sello}.json`);
process.exit(0);

async function medir(camino) {
  const perfil = path.join(os.tmpdir(), `mkw-sonido-${process.pid}-${camino}`);
  const contexto = await chromium.launchPersistentContext(perfil, {
    channel: 'chrome', headless: !args.includes('--ventana'), viewport: { width: 1280, height: 800 },
    args: ['--mute-audio', '--enable-unsafe-webgpu', '--force_high_performance_gpu'],   // sin sonido (pedido del dueño)
  });
  try {
    const pagina = contexto.pages()[0] || await contexto.newPage();
    if (CPU > 1) await (await contexto.newCDPSession(pagina)).send('Emulation.setCPUThrottlingRate', { rate: CPU });
    pagina.on('console', m => log.write(`[${camino}] ${m.text()}\n`));
    pagina.on('pageerror', e => log.write(`[${camino}] [pageerror] ${e.message}\n`));
    await pagina.goto(`${PAGES}/juegos.html?mkw=${encodeURIComponent(`&auto=1&audio=${camino}&invitados=0${EXTRA}`)}`);
    let juego = null;                                  // el marco del juego
    for (let i = 0; i < 600 && !juego; i++) {
      juego = pagina.frames().find(fr => fr.url().includes('/juegos/mkw/web/navegador/index.html'));
      if (!juego) await pagina.waitForTimeout(100);
    }
    if (!juego) return { error: 'no apareció el marco del juego' };
    const cuadros = () => juego.evaluate(() => (window.mkwCuadros ? window.mkwCuadros() : 0)).catch(() => 0);
    const esperarCuadros = async n => {
      const fin = (await cuadros()) + n; let ult = -1, quieto = 0;
      while (true) {
        const c = await cuadros(); if (c >= fin) return;
        quieto = c === ult ? quieto + 1 : 0; ult = c; if (quieto > 1200) throw new Error('el juego se detuvo');
        await pagina.waitForTimeout(50);
      }
    };
    for (let i = 0; i < 6000 && !(await cuadros()); i++) await pagina.waitForTimeout(50);
    // el gesto que desbloquea el sonido (y le da el foco del teclado)
    await pagina.frameLocator('iframe.jg-bt3-solo').locator('#canvas').click({ force: true });
    await esperarCuadros(Math.max(0, 420 - (await cuadros())));   // el título ya cargado (§52)
    // Lo que dice el medidor de la página: el del worklet o, en el camino viejo, el de SDL3 + los bloques que tiró el runtime
    const foto = () => juego.evaluate(() => {
      const e = window.mkwSonido.estado;
      return { camino: e.camino, huecos: e.huecos, vacios: e.vacios, tirados: e.tirados + (window.mkw?._mkw_web_sonido_tirados?.() || 0),
               colaMs: window.mkw?._mkw_web_sonido_cola_ms?.() ?? 0, objetivoMs: e.camino === 'worklet' ? e.objetivoMs : 60,
               activo: e.activo, chromeMs: (window.mkwSonido.contexto.baseLatency + window.mkwSonido.contexto.outputLatency) * 1000,
               esperas: [...(e.esperas || [])], esperaMaxMs: e.esperaMaxMs || 0 };
    });
    const tramo = async (fn) => {
      const a = await foto(); await fn(); const b = await foto();
      return { huecos: b.huecos - a.huecos, vacios: b.vacios - a.vacios, tirados: b.tirados - a.tirados, colaMs: b.colaMs, objetivoMs: b.objetivoMs, camino: b.camino, chromeMs: b.chromeMs,
               // (camino worklet) cuántas esperas entre entregas del juego cayeron en cada tramo: < 10, 20, 30, 50, 80, 120 ms y más
               esperas: b.esperas.map((n, i) => n - (a.esperas[i] || 0)) };
    };
    const demora = () => juego.evaluate(() => window.mkwMedirDemora()).catch(e => ({ error: String(e) }));
    // 1) y 2) el título
    const titulo = await tramo(() => pagina.waitForTimeout(10000));
    titulo.demora = await demora();
    console.log(`· ${camino}: título — ${JSON.stringify(titulo)}`);
    // 3) la carrera
    for (const [tecla, c] of PASOS) { await pagina.keyboard.down(tecla); await pagina.waitForTimeout(120); await pagina.keyboard.up(tecla); await esperarCuadros(c); }
    await pagina.keyboard.down('KeyK');                // acelerar
    const carrera = await tramo(() => pagina.waitForTimeout(20000));
    carrera.demora = await demora();
    await pagina.keyboard.up('KeyK');
    console.log(`· ${camino}: carrera — ${JSON.stringify(carrera)}`);
    return { titulo, carrera };
  } catch (e) {
    return { error: String(e.message || e) };
  } finally {
    await contexto.close();
    try { rmSync(perfil, { recursive: true, force: true }); } catch {}
  }
}
