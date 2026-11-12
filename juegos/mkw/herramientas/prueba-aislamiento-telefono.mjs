// H5 de la etapa 1 del plan v4 (bitácora §208): el banco `aislamiento` en Chrome de este PC haciéndose pasar por un
// teléfono (Pixel 7 de Playwright: pantalla, toque, «Android» en el navegador y userAgentData.mobile).
//
// Resumen: abre banco/pruebas/aislamiento con la emulación de teléfono y cuenta qué marcos quedaron aislados y con
// memoria compartida, y si el plan B (cajas transferidas, varios Workers) anda. Ojo: la emulación cambia lo que la página
// VE (el navegador dice «Android», la pantalla es chica), no el motor: sigue siendo Chrome de escritorio, así que esto NO
// prueba que Android 146 traiga Document-Isolation-Policy. Prueba que la página y el informe se portan bien cuando el
// navegador dice ser un teléfono (por ejemplo, que el plan B no dependa de nada del escritorio). La respuesta de
// Android de verdad la trae el informe de rendimiento de un teléfono (campo `hilos`, aislar.mjs estadoHilos).
// Como probar un tablero con un simulador de red: verifica el cableado y las protecciones, no la red de verdad.
// Uso:  node herramientas/prueba-aislamiento-telefono.mjs   (8 puntos; sin el juego; Chrome sin sonido)
import { opcionesNavegador } from './navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(path.join(raiz, 'banco', 'package.json'));
const { chromium, devices } = req('playwright-core');
const PUERTO = 8136;
const servidor = spawn(process.execPath, [path.join(raiz, 'banco', 'servir.cjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(r => { servidor.stdout.on('data', r); setTimeout(r, 1500); });
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: true, args: ['--mute-audio', '--enable-unsafe-webgpu'] });
let bien = 0, mal = 0;
const ok = (t, c, d = '') => { c ? bien++ : mal++; console.log(`${c ? '✓' : '✗'} ${t}${d ? ' — ' + d : ''}`); };
try {
  const ctx = await navegador.newContext({ ...devices['Pixel 7'] });
  const pagina = await ctx.newPage();
  await pagina.goto(`http://127.0.0.1:${PUERTO}/pruebas/aislamiento/index.html`);
  await pagina.waitForFunction(() => window.mkwInformeAislamiento, null, { timeout: 120000 });
  const r = JSON.parse(await pagina.evaluate(() => window.mkwInformeAislamiento));
  const movil = await pagina.evaluate(() => ({ mobile: navigator.userAgentData?.mobile ?? null, ua: navigator.userAgent, toque: matchMedia('(any-pointer: coarse)').matches }));
  ok('el navegador dice ser un teléfono Android con toque', /Android/.test(movil.ua) && movil.toque, JSON.stringify(movil));
  ok('llegaron los cuatro marcos', ['ninguna', 'dip', 'coop', 'sw'].every(m => r.res[m]));
  const N = r.res.ninguna, D = r.res.dip, S = r.res.sw, C = r.res.coop;
  ok('sin cabecera: no aislado (el sitio de hoy)', N && !N.aislado);
  ok('plan B: el búfer de 1 MB va y vuelve sin copia', !!N?.planB?.['1MB']?.sinCopia, `${N?.planB?.['1MB']?.idaVueltaMs} ms`);
  ok('plan B: varios Workers calculan a la vez (≥ ×1,5)', (N?.nucleos?.aceleracion || 0) >= 1.5, JSON.stringify(N?.nucleos));
  ok('COOP/COEP en un marco no alcanza', C && !C.aislado);
  // (motor de escritorio: DIP anda aunque diga «Android»; en un Android de verdad la respuesta la da su informe)
  ok('DIP con el motor de este PC: el marco queda aislado con memoria compartida', D?.aislado && D?.sabTrabajador, `aislado ${D?.aislado}`);
  ok('DIP puesta por un service worker: también', S?.aislado && S?.sabTrabajador, `aislado ${S?.aislado}`);
  const resumen = await pagina.evaluate(() => document.getElementById('resumen').textContent);
  console.log(`(la página del banco en el «teléfono»: ${resumen})`);
} catch (e) {
  ok('la prueba terminó sin errores', false, e?.stack || String(e));
} finally {
  await navegador.close();
  servidor.kill();
}
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
