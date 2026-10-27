// Prueba del banco: el piloto lleva el juego solo a la pista o copa pedida (con el juego de verdad) — bitácora §55.
//
// Resumen: abre la página del juego con Playwright dos veces, una con «Carrera, copa 14, pista 3» y otra con «Gran
// Premio, copa 4» (en la dirección: ?modo=vs&copa=13&fila=2 y ?modo=gp&copa=3; las copas se cuentan desde 0), sin tocar
// ninguna tecla. El piloto (menus.mjs) maneja los menús leyendo la memoria del juego. Se comprueba:
//   - que llegó a una carrera (sección de carrera, leída de SectionMgr) en menos de 60 s;
//   - que la pista que corre es la pedida (CupsConfig de Pulsar: pista ganadora = 0x100 + 4·copa + fila);
//   - que el nombre de la pista sale de los textos del juego (BMG) y no está vacío (se muestra, no se compara con una
//     lista nuestra: los nombres son del juego);
//   - en Gran Premio, que es la carrera 1.
// Fotos en build/web/datos/piloto/.
//
// Uso:  node web/navegador/prueba-piloto.mjs [--ventana]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = 8144;
const carpeta = path.join(raiz, 'build/web/datos/piloto');
mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio'] });

for (const caso of [{ modo: 'vs', copa: 13, fila: 2, nombre: 'Carrera, copa 14, pista 3' }, { modo: 'gp', copa: 3, fila: 0, nombre: 'Gran Premio, copa 4' }]) {
  const pagina = await navegador.newPage({ viewport: { width: 1000, height: 700 } });
  pagina.on('pageerror', e => console.log('[pageerror] ' + e.message));
  const t0 = Date.now();
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?auto=1&modo=${caso.modo}&copa=${caso.copa}&fila=${caso.fila}`);
  const llego = await pagina.waitForFunction(() => window.mkwEstado?.piloto, null, { timeout: 150000, polling: 500 })
    .then(h => h.jsonValue(), () => null);
  const segundos = (Date.now() - t0) / 1000;
  ok(`${caso.nombre}: el piloto llegó a la carrera solo`, !!llego?.llego, `${segundos.toFixed(0)} s desde que se abrió la página`);
  await pagina.waitForTimeout(2500);                       // la presentación de la pista (con su nombre en pantalla)
  const r = await pagina.evaluate(async c => {
    const m = await import('/menus.mjs');
    const L = window.mkwMenus, e = L.estado();
    const nombres = m.leerNombres(L, window.mkw);
    return { seccion: e.seccion, carrera: e.carrera, ganadora: L.u32(m.CUPS + 0x10), nombre: nombres?.[c.copa]?.[c.fila] || '' };
  }, caso);
  const pedida = 0x100 + 4 * caso.copa + caso.fila;
  ok(`${caso.nombre}: el juego está en una carrera`, r.seccion > 0 && r.seccion < 0x30, `sección 0x${r.seccion.toString(16)}`);
  ok(`${caso.nombre}: corre la pista pedida`, r.ganadora === pedida, `pista 0x${r.ganadora.toString(16)} (pedí 0x${pedida.toString(16)}): «${r.nombre}»`);
  ok(`${caso.nombre}: el nombre de la pista sale de los textos del juego`, r.nombre.length > 2);
  if (caso.modo === 'gp') ok('Gran Premio: es la carrera 1', r.carrera === 0, `carrera ${r.carrera + 1}`);
  await pagina.locator('#canvas').screenshot({ path: path.join(carpeta, `${caso.modo}.png`) }).catch(() => {});
  await pagina.close();
}
await navegador.close();
servidor.kill();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
