// medir-arranque.mjs — cuánto tarda el juego en poder jugarse, tramo por tramo, en la 1.ª visita (perfil nuevo) y en la
// 2.ª (el mismo perfil: la caché HTTP, la de código de V8, Cache Storage y la caché de shaders ya llenas), §276.
//
// Resumen: abre un Chrome de verdad (sin Playwright dentro: navigator.webdriver = false, como una persona) con un perfil
// nuevo en el monitor de 144 Hz y sin sonido; carga la página N veces seguidas en el mismo perfil, espera el menú de
// inicio, aprieta Enter (Single Player) y lee window.mkwArranque.informe() (arranque.mjs): las marcas de cada tramo y los
// tiempos de red del navegador. Imprime la tabla y guarda todo en build/web/datos/arranque/<etiqueta>.json.
//   --telefono   el teléfono simulado del plan: pantalla de Pixel 7 con toque, CPU ×4 (Emulation.setCPUThrottlingRate) y la
//                revisión de límites de Android (--js-flags=--wasm-enforce-bounds-checks); con la espera de gráficos del
//                teléfono (&esperaGraficos=1, porque la emulación no cambia «any-pointer»)
//   --red M,L    la red de mentira: M Mbit/s de bajada y L ms de ida (p. ej. 50,40); sin ella, la del PC (127.0.0.1)
//   --visitas N  (2) · --extra "&x=y" (parámetros de la página) · --etiqueta X · --puerto N (8166) · --build carpeta
//   --incognito  las visitas en un contexto de incógnito (el del marco del teléfono) en vez del perfil normal
//   --espera S   segundos que se deja correr cada visita después del menú «Un jugador» (8; así V8 guarda su caché de código)
// Uso (con el candado): node herramientas/medir-arranque.mjs --etiqueta antes-pc
//                       node herramientas/medir-arranque.mjs --telefono --red 50,40 --etiqueta antes-tel
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const arg = (n, def) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : def; };
const tiene = n => args.includes('--' + n);
const PUERTO = Number(arg('puerto', 8166)), VISITAS = Number(arg('visitas', 2)), EXTRA = arg('extra', '');
const TELEFONO = tiene('telefono'), RED = arg('red', null), ETIQUETA = arg('etiqueta', TELEFONO ? 'telefono' : 'pc');
const ESPERA_S = Number(arg('espera', 8));
const espera = ms => new Promise(r => setTimeout(r, ms));
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);

// el servidor del juego (su propio puerto: no estorba a otra sesión con el suyo)
const env = { ...process.env, ...(arg('build') ? { MKW_BUILD: arg('build') } : {}) };
const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'], env });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkw-arranque-'));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const banderas = [`--user-data-dir=${dir}`, `--remote-debugging-port=${PUERTO + 1000}`, `--window-position=${vx + 40},${vy + 40}`,
  TELEFONO ? '--window-size=960,540' : '--window-size=1600,900', '--no-first-run', '--no-default-browser-check', '--enable-unsafe-webgpu', '--mute-audio',
  ...(TELEFONO ? ['--js-flags=--wasm-enforce-bounds-checks'] : []), ...(arg('chrome') ? arg('chrome').split(' ') : []), 'about:blank'];
const chrome = spawn(CHROME, banderas, { stdio: 'ignore' });
let navegador = null;
for (let k = 0; k < 50 && !navegador; k++) { await espera(200); navegador = await chromium.connectOverCDP(`http://127.0.0.1:${PUERTO + 1000}`).catch(() => null); }
// --incognito: un contexto aparte en la memoria (Target.createBrowserContext, como el marco seguro del teléfono): sin
// caché de shaders ni de código en disco; sirve para saber cuánto subestima la 2.ª visita medida en el teléfono
const ctx = tiene('incognito') ? await navegador.newContext({ viewport: null }) : navegador.contexts()[0];

const ruta = `/?inicio=1&bienvenida=0${TELEFONO ? '&esperaGraficos=1' : ''}${EXTRA}${/[?&]n8=/.test(EXTRA) ? '' : '&n8=0'}`;
const visitas = [];
try {
  for (let v = 1; v <= VISITAS; v++) {
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    if (TELEFONO) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 915, height: 412, deviceScaleFactor: 2.625, mobile: true });
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    }
    if (RED) {
      const [mbit, ms] = RED.split(',').map(Number);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: ms || 0, downloadThroughput: mbit * 125000, uploadThroughput: mbit * 125000 / 2 });
    }
    if (tiene('perfil')) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
    const t0 = Date.now();
    await p.goto(`http://127.0.0.1:${PUERTO}${ruta}`);
    while (Date.now() - t0 < 240000 && !(await p.evaluate(() => window.mkwInicio?.visible).catch(() => false))) await espera(100);
    await p.bringToFront(); await p.keyboard.down('Enter'); await espera(110); await p.keyboard.up('Enter');
    // hasta el menú «Un jugador» del juego (o 120 s)
    const t1 = Date.now();
    while (Date.now() - t1 < 120000 && !(await p.evaluate(() => window.mkwArranque?.marcas.unJugador != null).catch(() => false))) await espera(200);
    if (tiene('perfil')) {
      // --perfil: el perfil de CPU del hilo de la página desde que se abrió hasta el menú «Un jugador» (.cpuprofile, para
      // abrirlo en DevTools o resumirlo con herramientas/perfil-impuesto.mjs --solo-perfil); con nombres solo si el programa los trae
      const { profile } = await cdp.send('Profiler.stop');
      const dirP = path.join(raiz, 'build/web/datos/arranque'); fs.mkdirSync(dirP, { recursive: true });
      fs.writeFileSync(path.join(dirP, `${ETIQUETA}-v${v}.cpuprofile`), JSON.stringify(profile));
    }
    await espera(ESPERA_S * 1000);
    const informe = await p.evaluate(() => ({ ...window.mkwArranque.informe(), programa: window.mkwEstado.programa, armado: window.mkwEstado.armado,
      esperaGraficos: window.mkwEstado.esperaGraficos, lecturas: window.mkwEstado.lecturas, mbLeidos: +((window.mkwEstado.bytes || 0) / 1048576).toFixed(1), lotes: window.mkwEstado.lotes ? { pedidos: window.mkwEstado.lotes.pedidos, mb: window.mkwEstado.lotes.mb } : null,
      log: window.mkwEstado.log.filter(l => /^\[arranque\]|^programa:|armar archivos|paquete de diminutos|\[pipelines\] precalentando|menú de inicio \(§133\)|semilla/.test(l)).slice(0, 30) }));
    visitas.push({ visita: v, ...informe });
    const m = informe.marcas;
    console.log(`\nvisita ${v}: jugable ${(informe.jugable / 1000).toFixed(2)} s · Un jugador ${m.unJugador != null ? (m.unJugador / 1000).toFixed(2) : '—'} s · programa ${informe.red.programa ? `${(informe.red.programa.bytes / 1048576).toFixed(1)} MB en ${informe.red.programa.ms} ms` : '—'}`);
    for (const [k, ms, d] of informe.tramos) console.log(`  ${k.padEnd(18)} ${(ms / 1000).toFixed(2).padStart(7)} s  (+${(d / 1000).toFixed(2)})`);
    for (const [k, r] of Object.entries(informe.red)) if (r.inicio != null) console.log(`  red ${k.padEnd(11)} ${(r.inicio / 1000).toFixed(2)} → ${(r.fin / 1000).toFixed(2)} s  ${(r.bytes / 1048576).toFixed(2)} MB`);
    console.log(`  antes de jugable: ${JSON.stringify(informe.red.antesDeJugable)}`);
    console.log(`  pantallas [ms, cuadro, sección, pantalla]: ${JSON.stringify(informe.pantallas)}`);
    console.log(`  cuadros en cada marca: ${JSON.stringify(informe.cuadros)} · lecturas del disco ${informe.lecturas} (${informe.mbLeidos} MB)`);
    await cdp.detach().catch(() => {});
    await p.close();
    await espera(1500);
  }
} finally {
  const carpeta = path.join(raiz, 'build/web/datos/arranque'); fs.mkdirSync(carpeta, { recursive: true });
  const archivo = path.join(carpeta, `${ETIQUETA}.json`);
  fs.writeFileSync(archivo, JSON.stringify({ etiqueta: ETIQUETA, telefono: TELEFONO, red: RED, extra: EXTRA, build: env.MKW_BUILD || 'build/web/navegador', cuando: new Date().toISOString(), visitas }, null, 2));
  console.log(`\n→ ${path.relative(raiz, archivo)}`);
  await navegador?.close().catch(() => {});
  chrome.kill(); servidor.kill();
  await espera(1000);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}
