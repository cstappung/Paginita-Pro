// Prueba del banco: «Copa a tu gusto» juega 4 pistas elegidas, en orden, con su semilla (con el juego) — bitácora §56.
//
// Resumen: abre el juego con Playwright en «Copa a tu gusto» con 4 pistas y una semilla en la dirección
// (?modo=copa&pistas=…&semilla=…), sin CPU y con el jugador 1 manejado por la CPU (autoconducir), así las carreras
// terminan solas. Cuando se ven los resultados, aprieta A (como haría la persona para «Siguiente carrera»). Comprueba
// por cada carrera:
//   - que corre la pista pedida (CupsConfig de Pulsar: pista ganadora = 0x100 + 4·copa + fila), en el orden pedido;
//   - que es la carrera n de la serie (Racedata: número de carrera de la copia de la carrera, +0xB68+0x24);
//   - que el juego usa las semillas que salen de la semilla de la copa (Racedata, copia de la carrera +0xB68+0x2C);
// y al final, que la página cuenta las 4 (window.mkwEstado.copa). Tarda ~12 min (4 carreras enteras).
//
// Uso:  node web/navegador/prueba-copa.mjs [--ventana]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = 8145;
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
// pistas cortas de las primeras copas (copa.fila) y la semilla
const PISTAS = [[0, 1], [3, 2], [1, 0], [2, 3]], SEMILLA = 0x1234ABCD;
// la misma cuenta que menus.mjs (ajustarJugadores) para la semilla de la carrera n
const semillaDe = n => (SEMILLA ^ Math.imul(0x9E3779B9, n + 1)) >>> 0;

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });
const pagina = await navegador.newPage({ viewport: { width: 960, height: 540 } });
pagina.on('pageerror', e => console.log('[pageerror] ' + e.message));
const espera = ms => new Promise(r => setTimeout(r, ms));
// cada lectura con tope de 5 s (si la página está ocupada, se reintenta en la próxima vuelta en vez de quedarse pegada)
const conTope = (promesa, ms = 5000) => Promise.race([promesa, espera(ms).then(() => null)]);
const leer = () => conTope(pagina.evaluate(() => {
  const L = window.mkwMenus, e = L?.estado?.();
  if (!e) return null;
  const rd = L.u32(0x809BD728);
  return { s: e.seccion, p: e.pagina, ps: e.paginas, pista: L.u32(0x8043319C + 0x10), carrera: rd ? L.u8(rd + 0xB68 + 0x24) : -1,
           semilla: rd ? L.u32(rd + 0xB68 + 0x2C) : 0, copa: window.mkwEstado?.copa || null, aviso: document.getElementById('avisoJuego')?.textContent };
}).catch(() => null));
const apretarA = () => conTope(pagina.evaluate(async () => { window.mkwControles.pilotar(0x0100); await new Promise(r => setTimeout(r, 120)); window.mkwControles.pilotar(0); }).catch(() => {}));

try {
  const t0 = Date.now();
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=copa&pistas=${PISTAS.map(p => p.join('.')).join(',')}&semilla=${SEMILLA}&cpu=ninguna&autoconducir=1`);
  const vistas = [];                         // una entrada por carrera que empezó
  let enCarrera = false, ultimoA = 0;
  let ultimoLog = 0;
  while (Date.now() - t0 < 18 * 60000 && vistas.length < 4) {
    const e = await leer();
    if (Date.now() - ultimoLog > 30000) { ultimoLog = Date.now(); console.log(`  … ${((Date.now() - t0) / 1000).toFixed(0)} s: ${e ? `sección 0x${e.s.toString(16)} páginas [${e.ps.map(x => x.toString(16))}] «${e.aviso || ''}»` : 'sin respuesta'}`); }
    if (e) {
      const carrera = e.s === 0x20 && (e.ps.includes(0xe) || e.ps.includes(0xd));   // la carrera VS, con su pantalla de juego (0x0E)
      if (carrera && !enCarrera) { vistas.push(e); console.log(`  carrera ${vistas.length}: pista 0x${e.pista.toString(16)}, n.º ${e.carrera}, semilla ${e.semilla.toString(16)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`); }
      enCarrera = carrera;
      // resultados (o cualquier pantalla después de terminar): A para seguir, como la persona
      if (e.s === 0x20 && e.ps.length && !carrera && Date.now() - ultimoA > 1500) { ultimoA = Date.now(); await apretarA(); }
    }
    await espera(300);
  }
  ok('se jugaron las 4 carreras', vistas.length === 4, `${vistas.length} en ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  vistas.forEach((v, n) => {
    const pedida = 0x100 + 4 * PISTAS[n][0] + PISTAS[n][1];
    ok(`carrera ${n + 1}: la pista pedida`, v.pista === pedida, `corre 0x${v.pista.toString(16)}, pedí 0x${pedida.toString(16)}`);
    ok(`carrera ${n + 1}: su semilla`, v.semilla === semillaDe(n), `${v.semilla.toString(16)} / ${semillaDe(n).toString(16)}`);
  });
  ok('el número de carrera avanza 1, 2, 3, 4', vistas.map(v => v.carrera).join() === '1,2,3,4' || vistas.map(v => v.carrera).join() === '0,1,2,3', vistas.map(v => v.carrera).join());
  await espera(1500);
  const copa = (await leer())?.copa;
  ok('la página contó las 4 carreras', copa && copa.carrera === 4 && copa.termino === true, JSON.stringify(copa));
} catch (e) {
  ok('la prueba terminó sin errores', false, e.message);
} finally {
  await navegador.close();
  servidor.kill();
}
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
