// Prueba del banco: las partidas guardadas sobreviven a cerrar y volver a abrir la página (con el juego de verdad).
//
// Resumen: abre el juego en Chrome con Playwright, borra las partidas guardadas de ese navegador, crea una licencia
// apretando teclas (como una persona), espera a que se guarde sola en IndexedDB, RECARGA la página (como cerrarla y
// volver a abrirla) y comprueba:
//   - que la página restauró los archivos antes de arrancar el juego;
//   - que la partida restaurada (rksys.dat) tiene la licencia 1: según el formato documentado en Tockdom, rksys.dat
//     empieza con "RKSD" + versión (8 bytes) y después vienen las licencias de 0x8CC0 bytes, cada una empieza con
//     "RKPD" si existe (en la partida vacía son ceros);
//   - que el juego la muestra: en la pantalla de licencias la primera ya no dice NEW (foto antes/después).
// Fotos en build/web/datos/partidas/.
//
// Uso:  node web/navegador/prueba-partidas.mjs [--ventana]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = 8143;
const carpeta = path.join(raiz, 'build/web/datos/partidas');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const pagina = await navegador.newPage({ viewport: { width: 1000, height: 1100 } });
const espera = ms => new Promise(r => setTimeout(r, ms));
const alTitulo = () => pagina.waitForFunction(() => (window.mkwEstado?.cuadros || 0) >= 360, null, { timeout: 120000, polling: 250 });
const toque = async (code, ms) => { await pagina.keyboard.down(code); await espera(120); await pagina.keyboard.up(code); await espera(ms); };
const foto = nombre => pagina.locator('#canvas').screenshot({ path: path.join(carpeta, nombre + '.png') });
// La licencia 1 de la partida que tiene el juego ahora mismo (lee su sistema de archivos)
const licencia1 = () => pagina.evaluate(() => {
  try { const d = window.mkwFS.readFile('/mkw/sd/riivolution/save/RetroWFC/RMCP/rksys.dat'); return String.fromCharCode(...d.subarray(8, 12)); }
  catch (e) { return 'sin archivo'; }
});

try {
  // 1) Empezar sin partidas guardadas
  await pagina.goto(`http://127.0.0.1:${PUERTO}/`);
  await pagina.evaluate(() => window.mkwGuardado.borrarTodo());
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?auto=1`);
  await alTitulo();
  ok('sin partidas guardadas, la licencia 1 está vacía', (await licencia1()) !== 'RKPD', `empieza con «${await licencia1()}»`);

  // 2) Crear la licencia: A en el título, A en la licencia NEW, OK, elegir el Mii, OK, OK, OK
  await toque('KeyK', 2500); await foto('1-licencias-antes');
  for (const ms of [2000, 2500, 2500, 2500, 3000, 3500]) await toque('KeyK', ms);
  ok('el juego escribió la licencia', (await licencia1()) === 'RKPD');
  await pagina.waitForFunction(() => window.mkwGuardado.estado.guardadosEstaSesion > 0 && !window.mkwGuardado.pendientes, null, { timeout: 10000 });
  const g = await pagina.evaluate(() => ({ ...window.mkwGuardado.estado }));
  ok('se guardó sola en IndexedDB', g.archivos > 0, `${g.archivos} archivos`);

  // 3) Cerrar y volver a abrir la página
  await pagina.reload();
  await alTitulo();
  const r = await pagina.evaluate(() => window.mkwGuardado.estado.restaurados);
  ok('al volver a abrir, se restauraron los archivos antes de arrancar el juego', r === g.archivos, `${r} archivos`);
  ok('la partida restaurada tiene la licencia 1 («RKPD», formato de Tockdom)', (await licencia1()) === 'RKPD');
  await toque('KeyK', 3000); await foto('2-licencias-despues');   // se comparan abajo
} catch (e) {
  ok('la prueba corrió sin errores', false, String(e && e.message || e));
}

// Comparar la casilla de la licencia 1 antes (NEW) y después (Player): deben ser bien distintas
try {
  const casilla = async nombre => {
    const p = await navegador.newPage();
    await p.goto('file:///' + path.join(carpeta, nombre + '.png').replace(/\\/g, '/'));
    return p.evaluate(() => {
      const img = document.querySelector('img'), c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      // la casilla 1 ocupa más o menos x 14–45 %, y 14–50 % de la imagen
      const d = g.getImageData(Math.round(c.width * 0.14), Math.round(c.height * 0.14), Math.round(c.width * 0.31), Math.round(c.height * 0.36)).data;
      return Array.from(d.filter((_, i) => i % 4 !== 3));
    });
  };
  const [a, b] = [await casilla('1-licencias-antes'), await casilla('2-licencias-despues')];
  let distintos = 0;
  for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 90) distintos++;
  const pct = 100 * distintos / (a.length / 3);
  ok('el juego muestra la licencia guardada (la casilla 1 ya no es «NEW»)', pct > 15, `${pct.toFixed(0)} % de la casilla cambió`);
} catch (e) {
  ok('comparar las fotos', false, String(e && e.message || e));
}

// Dejar el navegador de prueba limpio
await pagina.evaluate(() => window.mkwGuardado && window.mkwGuardado.borrarTodo()).catch(() => {});
console.log(`${bien} bien, ${mal} mal`);
await navegador.close();
servidor.kill();
process.exit(mal ? 1 : 0);
