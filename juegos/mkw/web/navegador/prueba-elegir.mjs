// Prueba del banco: la lista para elegir copa/pista y «Arma tu copa», con paquetes de imágenes FALSOS — bitácora §56.
//
// Resumen: abre la página en Chrome (Playwright, sin sonido, SIN arrancar el juego) y le da, interceptando la red,
// paquetes de imágenes inventados con la misma forma que los de verdad (herramientas/empaquetar-imagenes.mjs):
// íconos de colores, "fotos" y "videítos" de un color, planos SVG simples y nombres «Pista falsa c-f». Nada del juego.
// Comprueba:
//   - imagenes.mjs: abre los paquetes (también el de planos en gzip), cuenta cuántas pedidas hace (pocas, y ninguna
//     repetida), y suelta los videítos viejos (guarda los de 12 copas);
//   - Carrera: pasar el mouse muestra foto + plano + ícono; quedarse ~0,7 s cambia la foto por el videíto; clic elige;
//   - con el dedo: el primer toque solo muestra, el segundo elige;
//   - Gran Premio: la vista de la copa muestra sus 4 planos; clic en la copa la elige;
//   - Arma tu lista (§74): un clic agrega y otro quita, con sonido y el número en la grilla; «Al azar» llena hasta 4
//     con semilla nueva; se pueden más de 4; bajar reordena; ✕ quita; guardar con nombre, vaciar y volver a usarla;
//     el borrador sigue al volver a abrir; con 32 no entra otra; Confirmar devuelve las pistas y la semilla; barrer con
//     el mouse muestra solo la última;
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
  await pagina.goto(`http://127.0.0.1:${PUERTO}/?portada=1`);   // con la portada: la página sin arrancar el juego
  await pagina.waitForFunction(() => window.mkwInterfaz, null, { timeout: 20000 });

  // 1) Carrera: lista, vista previa, videíto, elegir
  await abrir('vs');
  await pagina.waitForSelector('#elegirPista .pista');
  ok('la lista trae los nombres del índice', (await pagina.locator('#elegirPista .pista').first().textContent()) === 'Pista falsa 0-0');
  ok('cada copa muestra su ícono', await cargadas('#elegirPista .copa-icono'));
  await pagina.locator('#elegirPista .pista').nth(5).hover();
  ok('al pasar el mouse: foto y plano de esa pista', await cargadas('.vista .vista-foto') && await cargadas('.vista .vista-plano'),
    await pagina.locator('.vista h3').textContent());
  await espera(1300);
  const video = await pagina.evaluate(() => document.querySelector('.vista .vista-foto')?.classList.contains('en-video'));
  ok('quedarse ~0,7 s cambia la foto por el videíto', video);
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

  // 3) Gran Premio / modo copa (§74, revisión crítica): panel con el videíto, el plano de minimapa y las 4 fotos; un clic
  //    MARCA la copa y «Jugar la Copa N» (o Enter, o doble clic) la confirma
  await abrir('gp');
  await pagina.waitForSelector('#elegirPista button.copa-cab');
  const panel = () => pagina.evaluate(() => ({ copa: document.querySelector('.vc-cab h3')?.textContent, num: document.querySelector('.vc-num')?.textContent,
    nombre: document.querySelector('.vc-nombre')?.textContent, jugar: document.getElementById('copaJugar')?.textContent,
    marcada: [...document.querySelectorAll('#elegirPista .copa')].findIndex(t => t.classList.contains('elegida')) }));
  ok('al abrir, el panel ya muestra una copa (nunca vacío)', /^Copa \d+$/.test((await panel()).copa || ''), JSON.stringify(await panel()));
  ok('cada copa de la grilla lleva la tira de sus 4 fotos', await pagina.evaluate(() => document.querySelectorAll('#elegirPista .copa-tira img').length === 4 * document.querySelectorAll('#elegirPista .copa').length));
  await pagina.locator('#elegirPista button.copa-cab').nth(3).hover();
  await espera(300);                                            // (la vista espera ~60 ms con el mouse quieto)
  let pn = await panel();
  ok('pasar por una copa la muestra: la pista 1, las 4 miniaturas y su plano', pn.copa === 'Copa 4' && pn.num === '1/4' && pn.nombre === 'Pista falsa 3-0' &&
     (await pagina.locator('.vc-tira button').count()) === 4 && await cargadas('.vc-plano') && await cargadas('.vc-foto.frente'), JSON.stringify(pn));
  await pagina.locator('#elegirPista .copa').nth(3).locator('.pista').nth(2).hover();
  await espera(150);
  ok('pasar por una pista de la copa muestra esa pista (al toque)', (await panel()).num === '3/4' && (await panel()).nombre === 'Pista falsa 3-2', JSON.stringify(await panel()));
  ok('y aparece su videíto', await pagina.waitForSelector('.vc-clip.lista', { timeout: 4000 }).then(() => true, () => false));
  await pagina.locator('.vc-tira button').nth(3).hover();
  ok('pasar por una miniatura del panel cambia la pista', (await panel()).num === '4/4');
  await pagina.locator('#elegirPista .copa').nth(3).locator('.pista').nth(0).hover();
  await pagina.keyboard.press('ArrowRight');
  ok('la flecha → pasa a la pista siguiente', (await panel()).num === '2/4');
  await pagina.locator('#elegirPista button.copa-cab').nth(3).click();
  pn = await panel();
  ok('un clic MARCA la copa (no la juega)', await pagina.evaluate(() => window._eleccion === 'esperando') && pn.marcada === 3 && pn.jugar === 'Jugar la Copa 4 ▸', JSON.stringify(pn));
  await pagina.locator('#elegirPista button.copa-cab').nth(5).hover();
  await espera(450);
  const otra = (await panel()).copa;
  await pagina.locator('#copaJugar').hover();
  await espera(100);
  ok('pasar por otra copa la muestra, y al salir de la grilla el panel vuelve a la marcada', otra === 'Copa 6' && (await panel()).copa === 'Copa 4', `${otra} → ${(await panel()).copa}`);
  await pagina.click('#copaJugar');
  const r3 = await eleccion();
  ok('«Jugar la Copa 4» la confirma', r3 && r3.copa === 3 && r3.fila === 0, JSON.stringify(r3));
  // avanza sola de pista cada 4 s (con el mouse fuera del panel)
  await abrir('gp');
  await pagina.waitForSelector('#elegirPista button.copa-cab');
  await pagina.locator('#elegirPista button.copa-cab').nth(1).hover();
  await espera(4600);
  ok('sobre una copa, el panel avanza solo a la pista siguiente a los 4 s', (await panel()).num === '2/4', (await panel()).num);
  await pagina.click('#copaAzar');
  pn = await panel();
  ok('«Una al azar» marca una copa al azar y la muestra (no la juega)', pn.marcada >= 0 && pn.copa === `Copa ${pn.marcada + 1}` && await pagina.evaluate(() => window._eleccion === 'esperando'), JSON.stringify(pn));
  await pagina.keyboard.press('Enter');
  const r3b = await eleccion();
  ok('Enter juega la copa marcada', r3b && r3b.copa === pn.marcada, JSON.stringify(r3b));
  await abrir('gp');
  await pagina.waitForSelector('#elegirPista button.copa-cab');
  await pagina.locator('#elegirPista .copa').nth(7).locator('.pista').nth(1).dblclick();
  const r3c = await eleccion();
  ok('doble clic en una copa la juega', r3c && r3c.copa === 7 && r3c.fila === 0, JSON.stringify(r3c));

  // 4) Arma tu lista (§74): un clic agrega y otro quita (con sonido), más de 4, al azar, ordenar, guardar y volver
  await pagina.evaluate(() => { try { localStorage.removeItem('mkw.lista'); localStorage.removeItem('mkw.listas'); } catch {} });
  await abrir('copa');                                            // (el nombre viejo: ahora es el modo lista)
  await pagina.waitForSelector('#listaAzar');
  const lista = () => pagina.evaluate(() => ({ p: window.mkwTuLista.pistas.map(x => 4 * x.copa + x.fila), s: { ...window.mkwSonidosLista.contados },
    pos: [...document.querySelectorAll('#elegirPista .pista.en-lista')].map(b => b.dataset.pos).join(','), filas: document.querySelectorAll('#elegirPista .renglon').length }));
  ok('la lista empieza vacía y no deja confirmar', (await lista()).p.length === 0 && await pagina.locator('#listaConfirmar').isDisabled());
  for (const i of [3, 10, 21]) await pagina.locator('#elegirPista .pista').nth(i).click();
  let l = await lista();
  ok('tres clics: tres pistas, en el orden de los clics, con su renglón', l.p.join() === '3,10,21' && l.filas === 3, l.p.join());
  ok('cada clic que agrega suena', l.s.agregar === 3, JSON.stringify(l.s));
  ok('en la grilla, cada pista de la lista lleva su número', l.pos === '1,2,3', l.pos);
  await pagina.locator('#elegirPista .pista').nth(10).click();
  l = await lista();
  ok('otro clic en una que está la quita (y suena el de quitar)', l.p.join() === '3,21' && l.s.quitar === 1 && l.pos === '1,2', `${l.p.join()} · ${JSON.stringify(l.s)}`);
  const s0 = await pagina.evaluate(() => document.querySelector('#elegirPista .semilla').textContent);
  await pagina.click('#listaAzar');
  l = await lista();
  ok('«Al azar» la llena hasta 4, sin repetir, con otra semilla', l.p.length === 4 && new Set(l.p).size === 4 && l.p[0] === 3 && l.p[1] === 21 &&
     (await pagina.evaluate(() => document.querySelector('#elegirPista .semilla').textContent)) !== s0, l.p.join());
  for (const i of [40, 41, 42]) await pagina.locator('#elegirPista .pista').nth(i).click();
  l = await lista();
  ok('se pueden agregar más de 4 (es una lista, no una copa)', l.p.length === 7 && l.filas === 7, `${l.p.length}`);
  await pagina.locator('#elegirPista .renglon').nth(0).locator('.mini', { hasText: '↓' }).click();
  const l2 = await lista();
  ok('bajar reordena', l2.p[0] === l.p[1] && l2.p[1] === l.p[0]);
  await pagina.locator('#elegirPista .renglon').nth(6).locator('.mini.quitar').click();
  l = await lista();
  ok('✕ en un renglón lo quita', l.p.length === 6 && !l.p.includes(42), l.p.join());
  ok('cada renglón muestra la foto y el ícono de su copa', await cargadas('#elegirPista .renglon .renglon-foto') && await cargadas('#elegirPista .renglon .renglon-icono'));
  // guardar la lista con un nombre, vaciar y volver a usarla
  await pagina.locator('#elegirPista .guardadas summary').click();
  await pagina.fill('#elegirPista .guardadas-form input', 'Mi lista falsa');
  await pagina.click('#listaGuardar');
  const guardada = await pagina.evaluate(() => JSON.parse(localStorage.getItem('mkw.listas') || '[]'));
  ok('«Guardar» deja la lista con su nombre en el navegador', guardada[0]?.nombre === 'Mi lista falsa' && guardada[0].pistas.length === 6, JSON.stringify(guardada[0]?.nombre));
  await pagina.click('#listaVaciar');
  ok('Vaciar deja la lista en 0', (await lista()).p.length === 0);
  await pagina.locator('#elegirPista .guardada', { hasText: 'Mi lista falsa' }).click();
  const l3 = await lista();
  ok('elegir la guardada la vuelve a poner entera', l3.p.join() === l.p.join(), l3.p.join());
  // el borrador: cerrar y volver a abrir deja la lista como estaba
  await pagina.keyboard.press('Escape');
  await espera(150);
  if (await pagina.evaluate(() => !!document.getElementById('elegirPista'))) await pagina.keyboard.press('Escape');   // (el primero cierra «guardadas»)
  await eleccion();
  await abrir('copa');
  await pagina.waitForSelector('#listaAzar');
  ok('al volver a abrir, la lista sigue ahí (borrador del navegador)', (await lista()).p.join() === l.p.join());
  // el tope: 32
  await pagina.evaluate(() => window.mkwTuLista.poner(Array.from({ length: 40 }, (_, n) => ({ copa: Math.floor(n / 4), fila: n % 4 }))));
  const antes = (await lista()).s.llena;
  await pagina.locator('#elegirPista .pista').nth(70).click();
  l = await lista();
  ok('con 32 no entra otra: suena «llena» y avisa', l.p.length === 32 && l.s.llena === antes + 1 &&
     /máximo/.test(await pagina.evaluate(() => document.getElementById('avisoJuego').textContent)), `${l.p.length}`);
  await pagina.evaluate(() => window.mkwTuLista.poner([{ copa: 19, fila: 1 }, { copa: 2, fila: 3 }, { copa: 7, fila: 0 }, { copa: 11, fila: 2 }, { copa: 0, fila: 1 }]));
  await pagina.click('#listaConfirmar');
  const r4 = await eleccion();
  ok('Confirmar devuelve las pistas de la lista (5) y la semilla', r4 && r4.pistas?.length === 5 && r4.pistas[0].copa === 19 && typeof r4.semilla === 'number', JSON.stringify(r4));
  // pasar el mouse rápido por varias pistas no las muestra todas: solo la última
  await abrir('vs');
  await pagina.waitForSelector('#elegirPista .pista');
  for (let i = 20; i < 30; i++) await pagina.locator('#elegirPista .pista').nth(i).hover({ timeout: 2000 });
  await espera(400);
  ok('barrer con el mouse muestra la última pista', (await pagina.locator('.vista h3').textContent()) === 'Pista falsa 7-1');
  await pagina.keyboard.press('Escape');
  await eleccion();

  // 4b) La playlist de la sala (§74): el anfitrión ve las sugerencias (✓ / ✕) y los demás sugieren (pilotos de mentira)
  await pagina.evaluate(() => {
    window._eleccion = 'esperando'; window._aceptadas = []; window._rechazadas = [];
    window.mkwInterfaz.elegirPista({ modo: 'lista', cerrar: false, lista: { clave: '', pistas: [{ copa: 0, fila: 1 }], sugerencias: true,
      alAbrir: c => { window._ctrl = c; }, alAceptar: (id, r) => window._aceptadas.push([id, r]), alRechazar: id => window._rechazadas.push(id) } })
      .then(r => { window._eleccion = r; });
  });
  await pagina.waitForSelector('#listaConfirmar');
  const sonidosAhora = () => pagina.evaluate(() => ({ ...window.mkwSonidosLista.contados }));
  const s0b = await sonidosAhora();
  await pagina.evaluate(() => window._ctrl.sugerencias([{ id: 1, de: 'uidB', nombre: 'Piloto Dos', copa: 5, fila: 2 }, { id: 2, de: 'uidC', nombre: 'Piloto Tres', copa: 9, fila: 0 }]));
  const sug = await pagina.evaluate(() => ({ filas: document.querySelectorAll('#elegirPista .sugerencias:not([hidden]) .sugerencia').length,
    chip: document.querySelector('#elegirPista .sug-chip')?.textContent, quien: document.querySelector('#elegirPista .sugerencia .renglon-copa')?.textContent,
    marcas: [...document.querySelectorAll('#elegirPista .pista.sugerida')].map(b => b.dataset.marca).join('') }));
  ok('el anfitrión ve las sugerencias con quién la sugirió, y un chip «💬 2»', sug.filas === 2 && sug.chip === '💬 2' && /Piloto Dos/.test(sug.quien), JSON.stringify(sug));
  ok('en la grilla, las sugeridas llevan 💬', sug.marcas === '💬💬', sug.marcas);
  await pagina.evaluate(() => window._ctrl.sugerencias([{ id: 1, de: 'uidB', nombre: 'Piloto Dos', copa: 5, fila: 2 }, { id: 2, de: 'uidC', nombre: 'Piloto Tres', copa: 9, fila: 0 },
    { id: 3, de: 'uidB', nombre: 'Piloto Dos', copa: 12, fila: 3 }]));
  const s1b = await sonidosAhora();
  ok('una sugerencia nueva suena («ding») y se resalta; las de antes no', s1b.sugerencia === s0b.sugerencia + 1 &&
     await pagina.evaluate(() => document.querySelectorAll('#elegirPista .sugerencia.nueva').length === 1), JSON.stringify(s1b));
  await pagina.locator('#elegirPista .sugerencia').nth(0).locator('.mini.aceptar').click();
  let lb = await pagina.evaluate(() => ({ p: window.mkwTuLista.pistas.map(x => `${x.copa}.${x.fila}`).join(' '), a: window._aceptadas }));
  ok('✓ la agrega al final de la lista y avisa a la sala', lb.p === '0.1 5.2' && JSON.stringify(lb.a) === '[[1,"agregada"]]', JSON.stringify(lb));
  await pagina.locator('#elegirPista .sugerencia').nth(1).locator('.mini.quitar').click();
  ok('✕ la rechaza (avisa a la sala) y no la agrega', await pagina.evaluate(() => JSON.stringify(window._rechazadas) === '[2]' && window.mkwTuLista.pistas.length === 2));
  await pagina.evaluate(() => window._ctrl.sugerencias([{ id: 3, de: 'uidB', nombre: 'Piloto Dos', copa: 12, fila: 3 }]));
  ok('la sala manda las que quedan: queda una', await pagina.evaluate(() => document.querySelectorAll('#elegirPista .sugerencia').length === 1 && document.querySelector('#elegirPista .sug-chip').textContent === '💬 1'));
  await pagina.click('#listaConfirmar');
  const rb = await eleccion();
  ok('Confirmar devuelve la lista con la sugerida adentro', rb?.pistas?.length === 2 && rb.pistas[1].copa === 5, JSON.stringify(rb?.pistas));
  // los demás: sugerir
  await pagina.evaluate(() => {
    window._eleccion = 'esperando'; window._sug = []; window._resp = 'sugerida';
    window.mkwInterfaz.elegirPista({ modo: 'sugerir', cerrar: false, lista: { pistas: [{ copa: 1, fila: 1 }, { copa: 2, fila: 2 }],
      alSugerir: p => { window._sug.push(p); return window._resp; }, alAbrir: c => { window._ctrl = c; } } }).then(r => { window._eleccion = r; });
  });
  await pagina.waitForSelector('#elegirPista .sugerir-nota');
  const g = await pagina.evaluate(() => ({ renglones: document.querySelectorAll('#elegirPista .renglon').length, botones: document.querySelectorAll('#elegirPista .renglon .mini').length,
    confirmar: !!document.getElementById('listaConfirmar'), azar: !!document.getElementById('listaAzar'), titulo: document.querySelector('#elegirPista .tu-lista-cab b').textContent }));
  ok('quien sugiere ve la lista de la sala, sin botones para cambiarla ni Confirmar', g.renglones === 2 && !g.botones && !g.confirmar && !g.azar && g.titulo === 'Lista de la sala', JSON.stringify(g));
  const s2b = await sonidosAhora();
  await pagina.locator('#elegirPista .pista').nth(0).click();
  ok('un clic en una pista la sugiere (con su sonido y un aviso)', await pagina.evaluate(() => window._sug.length === 1 && window._sug[0].copa === 0 && window._sug[0].fila === 0) &&
     (await sonidosAhora()).agregar === s2b.agregar + 1 && /sugeriste/i.test(await pagina.evaluate(() => document.getElementById('avisoJuego').textContent)));
  await pagina.locator('#elegirPista .pista').nth(5).click();
  ok('una que ya está en la lista no se sugiere (suena «no»)', await pagina.evaluate(() => window._sug.length === 1) && (await sonidosAhora()).llena === s2b.llena + 1);
  await pagina.evaluate(() => { window._resp = 'ya-sugerida'; });
  await pagina.locator('#elegirPista .pista').nth(7).click();
  ok('si ya está sugerida, lo dice', /ya está sugerida/.test(await pagina.evaluate(() => document.getElementById('avisoJuego').textContent)));
  await pagina.evaluate(() => window._ctrl.sugerencias([{ id: 1, copa: 0, fila: 0, estado: 'pendiente' }]));
  ok('«Tus sugerencias»: ⌛ esperando, y ⌛ en la grilla', await pagina.evaluate(() => /Esperando/.test(document.querySelector('#elegirPista .mias:not([hidden]) .estado')?.textContent || '') &&
     document.querySelectorAll('#elegirPista .pista')[0].dataset.marca === '⌛'));
  const s3b = await sonidosAhora();
  await pagina.evaluate(() => { window._ctrl.sugerencias([{ id: 1, copa: 0, fila: 0, estado: 'aceptada' }]); window._ctrl.poner([{ copa: 1, fila: 1 }, { copa: 2, fila: 2 }, { copa: 0, fila: 0 }]); });
  const g2 = await pagina.evaluate(() => ({ estado: document.querySelector('#elegirPista .mias .estado').textContent, pos: document.querySelectorAll('#elegirPista .pista')[0].dataset.pos,
    renglones: document.querySelectorAll('#elegirPista .renglon').length }));
  ok('cuando el anfitrión la acepta: «✓ En la lista», suena, y entra con su número', g2.estado.includes('En la lista') && g2.pos === '3' && g2.renglones === 3 &&
     (await sonidosAhora()).agregar === s3b.agregar + 1, JSON.stringify(g2));
  await pagina.keyboard.press('Escape');
  await espera(150);
  ok('sin «cerrar», Esc no saca a nadie del selector', await pagina.evaluate(() => !!document.getElementById('elegirPista')));
  await pagina.evaluate(() => window._ctrl.cerrar());
  ok('la sala lo cierra cuando el anfitrión confirma', (await eleccion()) === null);

  // 4c) La playlist un rato entre carrera y carrera (§74): las que vienen, «+ Agregar pistas» o «Sugerir pista»
  await pagina.evaluate(() => {
    window._pb = { agregar: 0, sugerir: 0 };
    const ps = Array.from({ length: 9 }, (_, n) => ({ copa: n, fila: n % 4 }));
    window._breve = window.mkwInterfaz.playlistBreve({ pistas: ps, hechas: 2, anfitrion: true, pendientes: 2, alAgregar: () => window._pb.agregar++ });
  });
  await pagina.waitForSelector('#playlistBreve .pb-lista li');
  const pb = () => pagina.evaluate(() => { const c = document.getElementById('playlistBreve'); return c && { sigue: c.querySelector('li.sigue .num')?.textContent,
    nombre: c.querySelector('li.sigue .pb-nombre')?.textContent, filas: c.querySelectorAll('.pb-lista li').length, mas: c.querySelector('.pb-mas')?.textContent || '',
    chip: c.querySelector('.sug-chip')?.textContent || '', cab: c.querySelector('.pb-cab span')?.textContent, agregar: !!c.querySelector('#pbAgregar'), sugerir: !!c.querySelector('#pbSugerir') }; });
  await espera(200);
  let b = await pb();
  ok('entre carreras: la que sigue (la 3, con su nombre), hasta 6 y «y 1 más»', b.sigue === '3' && b.nombre === 'Pista falsa 2-2' && b.filas === 6 && b.mas === 'y 1 más', JSON.stringify(b));
  ok('el anfitrión ve «2 de 9 corridas», las sugerencias que esperan y «+ Agregar pistas»', b.cab === '2 de 9 corridas' && b.chip === '💬 2' && b.agregar && !b.sugerir, JSON.stringify(b));
  await pagina.click('#pbAgregar');
  ok('«+ Agregar pistas» avisa a la sala', await pagina.evaluate(() => window._pb.agregar === 1));
  await pagina.evaluate(() => window._breve.poner({ anfitrion: false, hechas: 9, nota: 'El anfitrión está agregando pistas…', alSugerir: () => window._pb.sugerir++ }));
  b = await pb();
  ok('los demás ven «Sugerir pista» (sin el chip) y el aviso', b.sugerir && !b.agregar && !b.chip && /agregando/.test(await pagina.evaluate(() => document.querySelector('#playlistBreve .pb-nota').textContent)), JSON.stringify(b));
  ok('sin pistas por delante lo dice', b.filas === 0 && /No quedan pistas/.test(b.mas), b.mas);
  await pagina.click('#pbSugerir');
  await pagina.evaluate(() => window._breve.cerrar());
  ok('«Sugerir pista» avisa y la sala lo cierra al arrancar la carrera', await pagina.evaluate(() => window._pb.sugerir === 1 && !document.getElementById('playlistBreve')));

  // 4d) §94: el panel del descanso de las dos salas: la cuenta y los resultados (puesto, puntos y VR de cada humano;
  // pilotos inventados). En la copa, sin botones
  await pagina.evaluate(() => {
    const hasta = Date.now() + 12400;
    window._breve = window.mkwInterfaz.playlistBreve({ pistas: [0, 1, 2, 3].map(f => ({ copa: 4, fila: f })), hechas: 1, anfitrion: true, titulo: 'Copa', botones: false,
      carrera: 1, ultima: false, restan: () => Math.max(0, hasta - Date.now()),
      resultados: [{ nombre: 'Beto', puesto: 5, puntos: 7, vrAntes: 5000, vrDespues: 4987 }, { nombre: 'Ana', puesto: 2, puntos: 12, vrAntes: 6100, vrDespues: 6131, yo: true },
                   { nombre: 'Caro', puesto: 9, puntos: 3 }] });
  });
  await espera(700);
  const d = await pagina.evaluate(() => { const c = document.getElementById('playlistBreve');
    return { cuenta: c.querySelector('#pbCuenta')?.textContent, cab: c.querySelector('.pb-cab b')?.textContent, botones: c.querySelectorAll('button').length,
      filas: [...c.querySelectorAll('.pb-res li')].map(li => [li.querySelector('.num').textContent, li.querySelector('.pb-quien').textContent, li.querySelector('.pb-pts').textContent,
        li.querySelector('.pb-vr').textContent, li.querySelector('.pb-vr').className, li.className].join('|')),
      sigue: c.querySelector('.pb-lista li.sigue .num')?.textContent, n1: (6131).toLocaleString('es'), n2: (4987).toLocaleString('es') }; });
  ok('§94: el descanso de la copa: «Copa», la cuenta en segundos y sin botones', d.cab === 'Copa' && /^La carrera siguiente en 1[12] s$/.test(d.cuenta) && d.botones === 0, JSON.stringify(d));
  ok('§94: los resultados por puesto, con los puntos y el VR (verde si sube, rojo si baja), «(tú)» marcado',
     d.filas[0] === `2.º|Ana (tú)|12 pts|VR ${d.n1} (+31)|pb-vr sube|yo` && d.filas[1] === `5.º|Beto|7 pts|VR ${d.n2} (−13)|pb-vr baja|` && d.filas[2].startsWith('9.º|Caro|3 pts||'),
     d.filas.join(' / '));
  ok('§94: y lo que viene de la copa (sigue la 2)', d.sigue === '2', d.sigue);
  await pagina.evaluate(() => window._breve.poner({ ultima: true, restan: () => 3000 }));
  await espera(600);
  const d2 = await pagina.evaluate(() => { const c = document.getElementById('playlistBreve').querySelector('#pbCuenta'); return { t: c.textContent, pronto: c.classList.contains('pronto') }; });
  ok('§94: en la última, «La copa termina en 3 s», resaltado en los últimos 5', d2.t === 'La copa termina en 3 s' && d2.pronto, JSON.stringify(d2));
  await pagina.evaluate(() => window._breve.cerrar());

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
