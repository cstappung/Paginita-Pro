// Prueba del «▶» del mando en pantalla con el juego de verdad (bitácora §286).
//
// Resumen: abre la página como un Pixel 7 acostado (táctil, el mando en pantalla prendido solo) en una carrera directa
// jugando solo (?modo=directa, con las CPU), espera a que la carrera ande y toca el «▶» con un dedo de
// verdad (eventos táctiles por CDP). Comprueba que:
//   - se abre el cajón en la Ayuda (el menú ⚙ que en el teléfono no se podía abrir desde §269);
//   - el juego NO recibe Start (no sale su menú de pausa) y la carrera queda quieta: los cuadros de lógica
//     (Raceinfo +0x20) no avanzan mientras el cajón está abierto (mkw_congelar), pero la imagen se sigue dibujando;
//   - al cerrar el cajón la carrera sigue desde el mismo cuadro.
// Fotos en build/web/datos/pausa-menu-*.png.
//
// Uso:  MKW_BUILD=build/web-final-v22/navegador node web/navegador/prueba-pausa-menu.mjs [--puerto N]   (con el candado)
import { opcionesNavegador } from '../../herramientas/navegador.mjs';   // §291: --navegador chrome|opera-gx|ruta (o MKW_NAVEGADOR)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium, devices } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const PUERTO = Number(arg('--puerto')) || 8138;
const carpeta = path.join(raiz, 'build/web/datos');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle !== '' ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const servidor = await new Promise(r => {
  const s = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
  s.stdout.on('data', d => { if (String(d).includes('juego en')) r(s); });
});
const [vx, vy] = (process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ ...opcionesNavegador(), headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', `--window-position=${vx},${vy}`] });
let codigo = 1;
try {
  const ctx = await navegador.newContext({ ...devices['Pixel 7 landscape'] });
  const p = await ctx.newPage();
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  await p.goto(`http://127.0.0.1:${PUERTO}/?modo=directa&pista=0.0&cpu=normal&semilla=1234&bienvenida=0`);
  // la lógica de la carrera (Raceinfo +0x20, desde la cuenta) y si el cajón está abierto
  const mirar = () => p.evaluate(() => {
    let logica = -1;
    try { const L = window.mkwMenus, ri = L?.u32(0x809BD730); if (ri) logica = L.u32(ri + 0x20); } catch {}
    return { logica, carrera: !!window.mkwEstado?.enCarrera, cajon: document.body.classList.contains('cajon-abierto'),
             ayuda: !document.getElementById('hojaAyuda')?.hidden, pausa: window.mkwEstado?.pausaMenu || null };
  });
  let m = null;
  for (const t0 = Date.now(); Date.now() - t0 < 240000; await espera(250)) { m = await mirar().catch(() => null); if (m?.carrera && m.logica > 400) break; }
  ok('la carrera directa (solo) largó en el Pixel 7', !!m?.carrera && m.logica > 400, JSON.stringify(m));
  const caja = await p.locator('.mkw-tactil [data-pieza="START"]').boundingBox();
  const cdp = await ctx.newCDPSession(p);
  const toque = async (x, y) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1, radiusX: 8, radiusY: 8 }] });
    await espera(60); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await toque(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await espera(500);
  const a = await mirar(); await espera(1500); const b = await mirar();
  ok('tocar «▶» abre el cajón en la Ayuda', a.cajon && a.ayuda, JSON.stringify(a));
  ok('con el cajón abierto la carrera queda quieta (la lógica no avanza en 1,5 s)', b.cajon && b.logica === a.logica && a.pausa?.congelado === 1,
     `${a.logica} → ${b.logica}, ${JSON.stringify(a.pausa)}`);
  await p.screenshot({ path: path.join(carpeta, 'pausa-menu-abierto.png') });
  await p.evaluate(() => window.mkwInterfaz.cerrarCajon());
  await espera(1500);
  const c = await mirar();
  ok('al cerrar el cajón la carrera sigue', !c.cajon && c.logica > b.logica + 30, `${b.logica} → ${c.logica}`);
  await p.screenshot({ path: path.join(carpeta, 'pausa-menu-sigue.png') });
  ok('sin errores en la página', !errores.length, errores.join(' | '));
  codigo = mal ? 1 : 0;
} catch (e) {
  ok('la prueba terminó sin errores', false, e?.stack || String(e));
} finally {
  await navegador.close().catch(() => {});
  servidor.kill();
}
console.log(`fin: ${bien} bien, ${mal} mal`);
process.exit(codigo);
