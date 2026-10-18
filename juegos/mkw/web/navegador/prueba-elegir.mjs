// Prueba del banco: la lista para elegir copa/pista y «Arma tu copa», con paquetes de imágenes FALSOS — bitácora §56.
//
// Resumen: abre la página en Chrome (Playwright, sin sonido, SIN arrancar el juego) y le da, interceptando la red,
// paquetes de imágenes inventados con la misma forma que los de verdad (herramientas/empaquetar-imagenes.mjs):
// íconos de colores, "fotos" y "videítos" de un color, planos SVG simples y nombres «Pista falsa c-f». Nada del juego.
// Comprueba:
//   - imagenes.mjs: abre los paquetes (también el de planos en gzip), cuenta cuántas pedidas hace (pocas, y ninguna
//     repetida), y suelta los videítos viejos (guarda los de 12 copas);
//   - Carrera: pasar el mouse muestra foto + plano + ícono; quedarse ½ s cambia la foto por el videíto; clic elige;
//   - con el dedo: el primer toque solo muestra, el segundo elige;
//   - Gran Premio: la vista de la copa muestra sus 4 planos; clic en la copa la elige;
//   - Arma tu copa: «Todo al azar» llena 4 pistas distintas con semilla nueva; volver a sortear una cambia la semilla;
//     subir/bajar reordena; cada casilla muestra el ícono de su copa; Confirmar devuelve las 4 y la semilla;
//   - récords: tu mejor tiempo en la vista previa y la tabla de la pista (Esc cierra la tabla, no la lista);
//   - Esc cierra sin elegir.
//
// Uso:  node web/navegador/prueba-elegir.mjs [--ventana]
import { spawn } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { png } from '../../herramientas/sacar-imagenes.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const PUERTO = 8144, COPAS = 20;
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };

// ---- paquetes falsos, con el formato de los de verdad ----
const liso = (w, h, [r, g, b]) => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < d.length; i += 4) d.set([r, g, b, 255], i); return png(w, h, d); };
function paquete(archivos) {
  const datos = [], indice = {}; let desde = 0;
  for (const [n, b, tipo] of archivos) { indice[n] = [desde, b.length, tipo]; datos.push(b); desde += b.length; }
  const j = Buffer.from(JSON.stringify(indice)), largo = Buffer.alloc(4); largo.writeUInt32LE(j.length);
  return Buffer.concat([Buffer.from('MKWI'), largo, j, ...datos]);
}
const hex = n => (0x100 + n).toString(16), color = n => [(n * 37) % 255, (n * 91) % 255, (n * 53) % 255];
const plano = n => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect x="40" y="40" width="${200 + n % 100}" height="200" rx="60" fill="none" stroke="#ece9f8" stroke-width="20"/></svg>`);
const archivos = {
  'copas.aaaa0001.pak': paquete(Array.from({ length: COPAS }, (_, c) => [String(c), liso(64, 64, color(c)), 'image/png'])),
  'planos.aaaa0002.pak': gzipSync(paquete(Array.from({ length: COPAS * 4 }, (_, n) => [hex(n), plano(n), 'image/svg+xml']))),
  'fotos-0.aaaa0003.pak': paquete(Array.from({ length: 48 }, (_, n) => [hex(n), liso(48, 27, color(n + 7)), 'image/webp'])),
  'fotos-1.aaaa0004.pak': paquete(Array.from({ length: COPAS * 4 - 48 }, (_, n) => [hex(n + 48), liso(48, 27, color(n + 55)), 'image/webp'])),
};
const indice = { version: 1, copas: 'copas.aaaa0001.pak', planos: 'planos.aaaa0002.pak', fotos: { 0: 'fotos-0.aaaa0003.pak', 1: 'fotos-1.aaaa0004.pak' }, clips: {},
  nombres: Array.from({ length: COPAS }, (_, c) => [0, 1, 2, 3].map(f => `Pista falsa ${c}-${f}`)) };
for (let c = 0; c < COPAS; c++) {
  const n = `clips-${String(c).padStart(3, '0')}.aaaa1${String(c).padStart(3, '0')}.pak`;
  archivos[n] = paquete([0, 1, 2, 3].map(f => [hex(4 * c + f), liso(32, 18, color(200 + 4 * c + f)), 'image/webp']));
  indice.clips[c] = n;
}
archivos['indice.json'] = Buffer.from(JSON.stringify(indice));

const servidor = spawn(process.execPath, [path.join(raiz, 'web/navegador/servidor.mjs'), String(PUERTO)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise(listo => servidor.stdout.on('data', d => { if (String(d).includes('juego en')) listo(); }));
const navegador = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--ventana'), args: ['--mute-audio'] });
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const pagina = await contexto.newPage();
const pedidas = [];
await pagina.route('**/build/imagenes/paquetes/**', ruta => {
  const nombre = decodeURIComponent(new URL(ruta.request().url()).pathname.split('/').pop());
  pedidas.push(nombre);
  const b = archivos[nombre];
  return b ? ruta.fulfill({ status: 200, body: b, contentType: nombre.endsWith('.json') ? 'application/json' : 'application/octet-stream' }) : ruta.fulfill({ status: 404, body: '' });
});
pagina.on('pageerror', e => console.log('[pageerror] ' + e.message));
const espera = ms => new Promise(r => setTimeout(r, ms));
const abrir = modo => pagina.evaluate(m => { try { localStorage.removeItem('mkw.pistas'); } catch {} window._eleccion = 'esperando'; window.mkwInterfaz.elegirPista({ modo: m }).then(r => { window._eleccion = r; }); }, modo);
const eleccion = () => pagina.waitForFunction(() => window._eleccion !== 'esperando', null, { timeout: 5000 }).then(() => pagina.evaluate(() => window._eleccion));
const cargadas = sel => pagina.waitForFunction(s => { const i = document.querySelector(s); return i && i.complete && i.naturalWidth > 0; }, sel, { timeout: 5000 }).then(() => true, () => false);

try {
  await pagina.goto(`http://127.0.0.1:${PUERTO}/`);
  await pagina.waitForFunction(() => window.mkwInterfaz, null, { timeout: 20000 });

  // 1) Carrera: lista, vista previa, videíto, elegir
  await abrir('vs');
  await pagina.waitForSelector('#elegirPista .pista');
  ok('la lista trae los nombres del índice', (await pagina.locator('#elegirPista .pista').first().textContent()) === 'Pista falsa 0-0');
  ok('cada copa muestra su ícono', await cargadas('#elegirPista .copa-icono'));
  await pagina.locator('#elegirPista .pista').nth(5).hover();
  ok('al pasar el mouse: foto y plano de esa pista', await cargadas('.vista .vista-foto') && await cargadas('.vista .vista-plano'),
    await pagina.locator('.vista h3').textContent());
  await espera(900);
  const video = await pagina.evaluate(() => document.querySelector('.vista .vista-foto')?.classList.contains('en-video'));
  ok('quedarse ½ s cambia la foto por el videíto', video);
  await pagina.locator('#elegirPista .pista').nth(5).click();
  const r1 = await eleccion();
  ok('clic elige la pista', r1 && r1.copa === 1 && r1.fila === 1, JSON.stringify(r1));

  // 2) Con el dedo: primer toque muestra, segundo elige
  await abrir('vs');
  await pagina.waitForSelector('#elegirPista .pista');
  const b9 = pagina.locator('#elegirPista .pista').nth(9);
  await b9.tap(); await espera(200);
  const sigue = await pagina.evaluate(() => window._eleccion === 'esperando' && document.querySelector('.vista h3')?.textContent);
  ok('primer toque: solo muestra', sigue === 'Pista falsa 2-1', String(sigue));
  await b9.tap();
  const r2 = await eleccion();
  ok('segundo toque: elige', r2 && r2.copa === 2 && r2.fila === 1, JSON.stringify(r2));

  // 3) Gran Premio
  await abrir('gp');
  await pagina.waitForSelector('#elegirPista button.copa-cab');
  await pagina.locator('#elegirPista button.copa-cab').nth(3).hover();
  ok('la vista de la copa muestra sus 4 planos', (await pagina.locator('.vista-cuatro img').count()) === 4);
  await pagina.locator('#elegirPista button.copa-cab').nth(3).click();
  const r3 = await eleccion();
  ok('clic en la copa la elige', r3 && r3.copa === 3, JSON.stringify(r3));

  // 4) Arma tu copa
  await abrir('copa');
  await pagina.waitForSelector('#copaAzar');
  const s0 = await pagina.evaluate(() => window.mkwTuCopa.semilla);
  await pagina.click('#copaAzar');
  const t1 = await pagina.evaluate(() => ({ s: window.mkwTuCopa.semilla, p: window.mkwTuCopa.pistas.map(x => x && 4 * x.copa + x.fila) }));
  ok('«Todo al azar» llena 4 pistas distintas', t1.p.every(x => x !== null) && new Set(t1.p).size === 4, t1.p.join(','));
  ok('… con una semilla nueva', t1.s !== s0);
  await pagina.locator('.casilla').nth(2).locator('.mini', { hasText: '🎲' }).click();
  const t2 = await pagina.evaluate(() => ({ s: window.mkwTuCopa.semilla, p: window.mkwTuCopa.pistas.map(x => 4 * x.copa + x.fila) }));
  ok('sortear una casilla cambia solo esa y la semilla', t2.s !== t1.s && t2.p[0] === t1.p[0] && t2.p[1] === t1.p[1] && t2.p[3] === t1.p[3] && new Set(t2.p).size === 4);
  await pagina.locator('.casilla').nth(0).locator('.mini', { hasText: '↓' }).click();
  const t3 = await pagina.evaluate(() => window.mkwTuCopa.pistas.map(x => 4 * x.copa + x.fila));
  ok('bajar reordena', t3[0] === t2.p[1] && t3[1] === t2.p[0]);
  ok('cada casilla muestra el ícono de su copa', (await pagina.locator('.casilla .casilla-icono').count()) === 4 && await cargadas('.casilla .casilla-icono'));
  await pagina.locator('.casilla').nth(1).locator('.mini', { hasText: '✕' }).click();
  ok('vaciar una deja «Faltan 1» y no deja confirmar', (await pagina.locator('#copaConfirmar').textContent()) === 'Faltan 1' && await pagina.locator('#copaConfirmar').isDisabled());
  await pagina.locator('#elegirPista .pista').nth(77).click();
  const r4p = await pagina.evaluate(() => window.mkwTuCopa.pistas[1]);
  ok('clic en la lista llena la casilla vacía', r4p && r4p.copa === 19 && r4p.fila === 1, JSON.stringify(r4p));
  await pagina.click('#copaConfirmar');
  const r4 = await eleccion();
  ok('Confirmar devuelve las 4 pistas y la semilla', r4 && r4.pistas?.length === 4 && typeof r4.semilla === 'number', JSON.stringify(r4));

  // 5) Récords: tu mejor tiempo en la vista previa y la tabla (sin sesión: el tuyo de este navegador)
  await pagina.evaluate(() => localStorage.setItem('mkw.records', JSON.stringify({ '105-tt150': { ms: 67873, cuando: 1 } })));
  await abrir('vs');
  await pagina.waitForSelector('#elegirPista .pista');
  await pagina.locator('#elegirPista .pista').nth(5).hover();
  const mejor = await pagina.locator('.vista-records li').first().textContent().catch(() => '');
  ok('la vista previa muestra tu mejor tiempo en esa pista', mejor.includes('1:07.873') && mejor.includes('Contrarreloj 150cc'), mejor);
  await pagina.locator('.vista-tabla').click();
  await pagina.waitForSelector('dialog[open] .tabla-filas li.tuyo', { timeout: 3000 }).catch(() => {});
  const fila = await pagina.locator('dialog[open] .tabla-filas li').first().textContent().catch(() => '');
  ok('«Récords de esta pista» abre la tabla con tu tiempo', fila.includes('1:07.873'), fila);
  await pagina.keyboard.press('Escape');
  await espera(200);
  const tras = await pagina.evaluate(() => ({ dialogo: !!document.querySelector('dialog[open]'), lista: !!document.getElementById('elegirPista') }));
  ok('Esc cierra la tabla pero no la lista', !tras.dialogo && tras.lista, JSON.stringify(tras));
  await pagina.keyboard.press('Escape');
  await eleccion();

  // 6) Esc cierra sin elegir
  await abrir('vs');
  await pagina.waitForSelector('#elegirPista');
  await pagina.keyboard.press('Escape');
  ok('Esc cierra sin elegir', (await eleccion()) === null);

  // 7) Pedidas: pocas y sin repetir; los videítos viejos se sueltan
  const repetidas = pedidas.filter((n, i) => pedidas.indexOf(n) !== i);
  ok('ninguna pedida repetida (cada paquete se baja una vez)', repetidas.length === 0, `${pedidas.length} pedidas: ${repetidas.join(', ')}`);
  const lru = await pagina.evaluate(async () => {
    const { crearImagenes } = await import('/imagenes.mjs');
    const img = crearImagenes('/build/imagenes');
    const primero = await img.clip(0, 0);
    for (let c = 1; c <= 12; c++) await img.clip(c, 0);
    await new Promise(r => setTimeout(r, 50));
    const r = await fetch(primero).then(() => 'vivo', () => 'soltado');
    return r;
  });
  ok('guarda los videítos de 12 copas y suelta el más viejo', lru === 'soltado', lru);
} catch (e) {
  ok('la prueba terminó sin errores', false, e.message);
} finally {
  await navegador.close();
  servidor.kill();
}
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
