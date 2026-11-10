// Prueba del panel de récords de Mario Kart Wii en «Clasificaciones» del sitio (bitácora §267), con el sitio de verdad.
//
// Resumen: arranca el ensayo de herramientas/experiencia.mjs (los emuladores de Firebase con las reglas del sitio, las
// cuentas de mentira, el sitio como GitHub Pages y el Worker de verdad) en puertos propios, siembra en la base del
// emulador récords DE MENTIRA (pilotos inventados, tiempos al azar con semilla, en `mkw/records/<pista>-<tabla>/<uid>`,
// la forma que escribe el juego) y recorre el panel como una persona, en el escritorio y en un Pixel 7 emulado:
//   - Piloto Uno entra, va a Clasificaciones → Mario Kart Wii: «Ver: Récords de tiempo | Sala», la Tabla, el podio por
//     récords y la lista con los nombres de las pistas (del Worker, con el token; la segunda vez, de la caché);
//   - el buscador (por pista y por piloto), los filtros (Tú y Consola, las pastillas), abrir una fila (su top 10),
//     «Ver más», Carrera con solo las cilindradas que tienen tiempos, y «Sala» (la tabla de victorias de siempre);
//   - todo con el teclado también (cada fila es un botón: el mando del sitio salta de botón en botón).
// Las fotos llevan los nombres de verdad de las pistas (vienen del Worker): van a build/vistas/ (fuera de git).
//
// Uso:  node herramientas/prueba-panel-records.mjs [--ventana]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium, devices } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const PUERTO = 8162, SITIO = `http://127.0.0.1:${PUERTO}`;   // el sitio en 8162 y su Worker en 8163
const DESPLAZAR = 20000;                                     // emuladores en 29099, 29000… (ni jugar.bat ni prueba-experiencia)
const BASE = `http://127.0.0.1:${9000 + DESPLAZAR}`, NS = 'mi-pagina-pro-default-rtdb';
const carpeta = path.join(raiz, 'build/vistas');
fs.mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const registro = [];
const matar = h => { if (!h || h.exitCode !== null) return; if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(h.pid), '/T', '/F']); else h.kill(); };

// 1) el ensayo, en su propia carpeta y empezando de cero
const ensayo = spawn(process.execPath, [path.join(raiz, 'herramientas/experiencia.mjs'), '--sin-ventanas', '--puerto', String(PUERTO),
  '--carpeta', 'build/emuladores-records', '--limpiar', '--emu-desplazar', String(DESPLAZAR)], { stdio: ['ignore', 'pipe', 'pipe'] });
const salida = [];
await new Promise((listo, fallo) => {
  const reloj = setTimeout(() => fallo(new Error('el ensayo no arrancó en 4 min:\n' + salida.join(''))), 240000);
  const mira = d => { salida.push(String(d)); if (/Listo:/.test(String(d))) { clearTimeout(reloj); listo(); } };
  ensayo.stdout.on('data', mira); ensayo.stderr.on('data', mira);
  ensayo.once('exit', c => { clearTimeout(reloj); fallo(new Error(`el ensayo se cerró (código ${c}):\n${salida.join('')}`)); });
}).catch(e => { console.log('✗ ' + e.message); process.exit(1); });

const [vx, vy] = String(process.env.MKW_VENTANA || '-1880,549').split(',').map(Number);
const navegador = await chromium.launch({ channel: 'chrome', headless: !args.includes('--ventana'),
  args: ['--mute-audio', `--window-position=${vx},${vy}`] });

// Récords de mentira: 10 pilotos inventados («yo» = la cuenta que entra), 34 pistas, tiempos al azar con semilla.
function sembrar(yo) {
  let s = 11; const azar = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const pilotos = [[yo, 'Piloto Uno'], ['f-ana', 'Ana'], ['f-beto', 'Beto'], ['f-carla', 'Carla'], ['f-diego', 'Diego'], ['f-elena', 'Elena'],
    ['f-fito', 'Fito'], ['f-gabi', 'Gabi'], ['f-hugo', 'Hugo'], ['f-ines', 'Inés']];
  const pistas = [];
  for (let c = 0; c < 79 && pistas.length < 34; c += 2) for (let f = 0; f < 4 && pistas.length < 34; f += 1 + (c % 3 === 0)) pistas.push(0x100 + 4 * c + f);
  const raw = {}, t0 = Date.now() - 20 * 864e5;
  const n = { tt150: 34, tt200: 12, vs150: 7, vs200: 3 };
  for (const [cat, cuantas] of Object.entries(n)) for (const id of pistas.slice(0, cuantas)) {
    const base = (cat.startsWith('tt') ? 62000 : 150000) + azar() * 40000 - (cat.endsWith('200') ? 9000 : 0);
    const k = id.toString(16) + '-' + cat; raw[k] = {};
    for (const [u, nombre] of pilotos) if (azar() < (u === yo ? 0.6 : 0.5))
      raw[k][u] = { uid: u, nombre, ms: Math.round(base + azar() * 6000), pista: id.toString(16), cat, version: 1, at: t0 + Math.round(azar() * 19 * 864e5) };
    if (!Object.keys(raw[k]).length) delete raw[k];
  }
  return raw;
}
async function escribirBase(ruta, dato) {
  const r = await fetch(`${BASE}/${ruta}.json?ns=${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify(dato) });
  if (!r.ok) throw new Error(`la base del emulador contestó ${r.status}: ${await r.text()}`);
}

async function pc(nombre, opciones = {}) {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 860 }, ...opciones });
  await ctx.addInitScript(() => {
    try {
      Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
      const f = new Date(); localStorage.setItem('jg.tiendaHw.visto', `${f.getFullYear()}-${f.getMonth() + 1}-${f.getDate()}`);
      if (!localStorage.getItem('jg.rankJuego')) localStorage.setItem('jg.rankJuego', 'mkw');
      localStorage.setItem('jg.bienvenida', '1');            // el cartel de bienvenida del salón en el teléfono
    } catch {}
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => registro.push(`[${nombre}] pageerror ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' || /mkw/.test(m.text())) registro.push(`[${nombre}] ${m.type()} ${m.text().slice(0, 300)}`); });
  p.on('request', q => { if (/127\.0\.0\.1:8163/.test(q.url())) registro.push(`[${nombre}] worker ${q.method()} ${q.url().replace(/^.*8163/, '')}`); });
  await p.goto(SITIO + '/juegos.html');
  return p;
}
async function entrar(p, nombre) {
  await p.locator('#btnEntrar').waitFor({ timeout: 20000 });
  // en el escritorio el sitio abre una ventanita; en el teléfono va a la página del emulador en la MISMA pestaña
  const [ventanita] = await Promise.all([p.waitForEvent('popup', { timeout: 6000 }).catch(() => null), p.locator('#btnEntrar').click()]);
  if (ventanita) {
    await ventanita.waitForLoadState();
    await ventanita.locator(`text=${nombre}`).first().click();
  } else {
    await p.locator(`text=${nombre}`).first().click({ timeout: 20000 });
    await p.waitForURL(u => u.pathname.endsWith('/juegos.html'), { timeout: 30000 });
  }
  await p.waitForFunction(n => document.querySelector('#btnEntrar') === null || document.body.textContent.includes(n), nombre, { timeout: 20000 });
  await espera(2500);
}
const uidDe = p => p.evaluate(() => new Promise(r => {
  const q = indexedDB.open('firebaseLocalStorageDb');
  q.onsuccess = () => { const t = q.result.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').getAll(); t.onsuccess = () => r((t.result.find(x => x.value && x.value.uid) || {}).value?.uid || ''); };
  q.onerror = () => r('');
}));
const filas = p => p.$$eval('#rkMkw .jg-mkr-fila', l => l.map(b => b.querySelector('.jg-mkr-pista b')?.textContent || ''));
const cuenta = p => p.textContent('#mkrCuenta').catch(() => '');
const hastaQue = async (fn, cond, ms, cada = 250) => {
  let v; for (const t0 = Date.now(); Date.now() - t0 < ms; await espera(cada)) { v = await fn().catch(() => null); if (v && cond(v)) return v; }
  return v;
};
const pedidosWorker = nombre => registro.filter(l => l.startsWith(`[${nombre}] worker`));

let codigo = 1;
try {
  // ---------- escritorio ----------
  const uno = await pc('escritorio');
  await entrar(uno, 'Piloto Uno');
  const yo = await uidDe(uno);
  ok('Piloto Uno entra y se sabe su uid', !!yo, yo);
  await escribirBase('mkw/records', sembrar(yo));
  await uno.goto(SITIO + '/juegos.html#ranks');
  const lista = await hastaQue(() => filas(uno), l => l.length >= 10 && !/^Copa \d/.test(l[0]), 30000);
  ok('Clasificaciones → Mario Kart Wii: la lista de récords con 10 pistas y sus nombres (del Worker)', lista?.length === 10 && !/^Copa \d/.test(lista[0] || ''), (lista || []).slice(0, 3).join(' · '));
  const filasCat = await uno.$$eval('#rkSolo .jg-rk-fila', l => l.map(f => f.textContent.replace(/\s+/g, ' ').trim()));
  ok('las filas «Ver» (Récords de tiempo | Sala) y «Tabla» (Contrarreloj 150cc / 200cc / Carrera)', filasCat.length === 2 && /Récords de tiempo/.test(filasCat[0]) && /Contrarreloj 200cc/.test(filasCat[1]), filasCat.join(' / '));
  const podio = await uno.$$eval('#rkEscena .jg-rk-p:not(.libre) .jg-rk-pts', l => l.map(x => x.textContent.trim()));
  ok('el podio cuenta récords', podio.length >= 1 && podio.every(t => /récord/.test(t)), podio.join(' · '));
  ok('la tabla de victorias de la sala no se ve en Récords', await uno.locator('.jg-ranks > .jg-tabla-caja').isHidden());
  const iconos = await uno.$$eval('#rkMkw img.jg-mkr-ico', l => l.filter(i => i.complete && i.naturalWidth > 0).length);
  ok('las miniaturas de las copas (del paquete del Worker)', iconos >= 8, `${iconos} cargadas`);
  const cuentaTxt = await cuenta(uno);
  ok('la cuenta dice cuántas pistas tienen tiempo', /34 pistas con tiempo/.test(cuentaTxt), cuentaTxt);
  const notas = await uno.evaluate(() => [document.querySelector('.jg-ranks > .jg-nota-larga').hidden, document.querySelector('#mkrNota').textContent]);
  ok('la nota de la sala se esconde y se ve la de los récords', notas[0] === true && /mejor tiempo/.test(notas[1]), notas[1].slice(0, 60));
  await espera(2500);                                     // el podio termina de subir
  await uno.screenshot({ path: path.join(carpeta, 'records-1-escritorio.png'), fullPage: true });

  // «Ver más»: 10 más y el foco en la 11
  await uno.click('[data-mkr-mas]');
  const n20 = (await filas(uno)).length;
  const foco11 = await uno.evaluate(() => { const l = [...document.querySelectorAll('#rkMkw .jg-mkr-fila')]; return l.indexOf(document.activeElement); });
  ok('«Ver más» suma 10 y deja el foco en la fila 11', n20 === 20 && foco11 === 10, `${n20} filas, foco en ${foco11 + 1}`);

  // abrir una fila con el teclado (como el mando: es un botón)
  await uno.focus('#rkMkw .jg-mkr-fila >> nth=0');
  await uno.keyboard.press('Enter');
  const det = await uno.$$eval('#rkMkw .jg-mkr-det tr', l => l.length).catch(() => 0);
  const fan = await uno.locator('#rkMkw [data-mkr-fantasma]').count();
  ok('Enter sobre una fila abre su top (y en Contrarreloj, «⬇ Fantasma del 1.º»)', det >= 1 && fan === 1, `${det} filas en el detalle`);
  await uno.screenshot({ path: path.join(carpeta, 'records-2-fila-abierta.png') });
  await uno.keyboard.press('Enter');
  ok('otra vez Enter la cierra', await uno.locator('#rkMkw .jg-mkr-det').count() === 0);

  // el buscador: un piloto
  await uno.fill('#mkrBusca', 'ana');
  const conAna = await hastaQue(() => cuenta(uno), t => / de 34/.test(t), 3000);
  const ladoAna = await uno.$$eval('#rkMkw .jg-mkr-tuyo small', l => l.slice(0, 3).map(x => x.textContent));
  ok('buscar «ana»: las pistas donde corrió Ana, con SU tiempo a la derecha', / de 34/.test(conAna || '') && ladoAna.length > 0 && ladoAna.every(t => /^Ana/.test(t)), `${conAna} · ${ladoAna.join(' | ')}`);
  // una pista por su nombre (la primera palabra del nombre de la primera pista)
  const palabra = (lista[0] || '').split(' ').find(w => w.length >= 5) || 'circuit';
  await uno.fill('#mkrBusca', palabra.toLowerCase());
  await espera(400);
  const porPista = await filas(uno);
  ok(`buscar «${palabra.toLowerCase()}»: aparece esa pista`, porPista.includes(lista[0]), porPista.slice(0, 3).join(' · '));
  await uno.keyboard.press('Escape');
  ok('Escape borra la búsqueda', (await uno.inputValue('#mkrBusca')) === '' && (await filas(uno)).length >= 10);

  // los filtros
  await uno.click('#mkrFiltrar');
  await uno.click('[data-mkr-f="mio"][data-mkr-v="corridas"]');
  const consolas = await uno.$$eval('[data-mkr-f="consola"]', l => l.map(b => b.getAttribute('data-mkr-v')).filter(Boolean));
  if (consolas.length) await uno.click(`[data-mkr-f="consola"][data-mkr-v="${consolas[0]}"]`);
  const cf = await cuenta(uno);
  await uno.screenshot({ path: path.join(carpeta, 'records-3-filtros-escritorio.png') });
  ok('Filtros: «Corridas» y una consola dejan menos pistas', / de 34/.test(cf) && consolas.length >= 2, `${cf}; consolas ${consolas.join(', ')}`);
  await uno.click('#mkrFiltrar');
  const pastillas = await uno.$$eval('#mkrCuenta .jg-mkr-pastilla', l => l.map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  ok('con el panel cerrado quedan las pastillas', pastillas.length === 2, pastillas.join(' · '));
  await uno.screenshot({ path: path.join(carpeta, 'records-4-pastillas-escritorio.png') });
  await uno.click('#mkrCuenta .jg-mkr-pastilla >> nth=0');
  await uno.click('#mkrCuenta .jg-mkr-pastilla >> nth=0');
  ok('tocar las pastillas quita los filtros', /34 pistas con tiempo/.test(await cuenta(uno)), await cuenta(uno));

  // Carrera: solo las cilindradas con tiempos
  await uno.click('[data-mkw-k="tabla"][data-mkw-v="carrera"]');
  const ccs = await uno.$$eval('[data-mkw-k="cc"]', l => l.map(b => b.textContent));
  ok('Carrera: la cilindrada ofrece solo 150cc y 200cc (las que tienen tiempos)', JSON.stringify(ccs) === '["150cc","200cc"]', ccs.join(' · '));
  const fan2 = (await uno.click('#rkMkw .jg-mkr-fila >> nth=0'), await uno.locator('#rkMkw [data-mkr-fantasma]').count());
  ok('en Carrera no se ofrece fantasma', fan2 === 0);
  await uno.click('[data-mkw-k="cc"][data-mkw-v="vs200"]');
  ok('Carrera 200cc: 3 pistas', /3 pistas con tiempo/.test(await cuenta(uno)), await cuenta(uno));

  // Sala: la tabla de victorias de siempre
  await uno.click('[data-mkw-k="ver"][data-mkw-v="sala"]');
  await espera(800);
  ok('«Sala» vuelve a la tabla de victorias (y esconde la lista)', await uno.locator('#rkMkw').isHidden() && await uno.locator('.jg-ranks > .jg-tabla-caja').isVisible());
  await uno.click('[data-mkw-k="ver"][data-mkw-v="records"]');
  ok('y «Récords de tiempo» la trae de vuelta, en la tabla que quedó (Carrera 200cc)', /3 pistas con tiempo/.test(await hastaQue(() => cuenta(uno), t => /pistas/.test(t), 5000) || ''));
  await uno.click('[data-mkw-k="tabla"][data-mkw-v="tt150"]');

  // oscuro
  await uno.evaluate(() => document.documentElement.setAttribute('data-tema', 'oscuro'));
  await espera(3000);                                     // el podio termina de subir (cambiar de tabla lo vuelve a animar)
  const oscuro = await uno.$$eval('#rkEscena .jg-rk-p:not(.libre) .jg-rk-pts', l => l.map(x => getComputedStyle(x).opacity + '/' + x.textContent.trim()));
  ok('tema oscuro: el podio se ve (opaco, con sus récords)', oscuro.length > 0 && oscuro.every(t => t.startsWith('1/')), oscuro.join(' · '));
  await uno.screenshot({ path: path.join(carpeta, 'records-5-oscuro.png'), fullPage: true });
  await uno.evaluate(() => document.documentElement.removeAttribute('data-tema'));

  // recargar: los nombres vienen de la caché (ni el índice ni el paquete otra vez)
  const antes = pedidosWorker('escritorio').filter(l => /imagenes\/paquetes/.test(l)).length;
  await uno.reload();
  await hastaQue(() => filas(uno), l => l.length >= 10 && !/^Copa \d/.test(l[0]), 20000);
  const despues = pedidosWorker('escritorio').filter(l => /imagenes\/paquetes/.test(l)).length;
  ok('al volver, los nombres salen de la caché: 0 llamadas nuevas al Worker', antes >= 2 && despues === antes, `antes ${antes}, después ${despues}`);

  // ---------- Pixel 7 ----------
  const tel = await pc('celular', { ...devices['Pixel 7'] });
  await entrar(tel, 'Piloto Uno');
  await tel.goto(SITIO + '/juegos.html#ranks');
  await hastaQue(() => filas(tel), l => l.length >= 10 && !/^Copa \d/.test(l[0]), 30000);
  const ancho = await tel.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok('celular: sin desborde a lo ancho', ancho[0] <= ancho[1] + 1, ancho.join(' ≤ '));
  const altos = await tel.$$eval('#rkMkw .jg-mkr-fila', l => l.map(b => b.getBoundingClientRect().height));
  ok('celular: cada fila mide al menos 44 px de alto (se toca con el dedo)', altos.length && Math.min(...altos) >= 44, `mínimo ${Math.round(Math.min(...altos))} px`);
  await tel.locator('#rkMkw').scrollIntoViewIfNeeded();
  await tel.screenshot({ path: path.join(carpeta, 'records-6-celular.png') });
  await tel.tap('#rkMkw .jg-mkr-fila >> nth=0');
  await tel.screenshot({ path: path.join(carpeta, 'records-7-celular-abierta.png') });
  await tel.tap('#mkrFiltrar');
  await tel.tap('[data-mkr-f="mio"][data-mkr-v="faltan"]');
  await tel.locator('#mkrFiltros').scrollIntoViewIfNeeded();
  await tel.screenshot({ path: path.join(carpeta, 'records-8-celular-filtros.png') });
  ok('celular: los filtros se tocan', / de 34/.test(await cuenta(tel)), await cuenta(tel));

  const errores = registro.filter(l => /pageerror/.test(l));
  ok('sin errores en la página', errores.length === 0, errores.slice(0, 3).join(' | '));
  codigo = mal ? 1 : 0;
} catch (e) {
  mal++; console.log('✗ se cortó: ' + (e && e.stack || e));
} finally {
  fs.writeFileSync(path.join(carpeta, 'records-registro.txt'), registro.join('\n'));
  console.log(`\n${bien} ✓  ${mal} ✗   (fotos y registro en build/vistas/records-*)`);
  await navegador.close().catch(() => {});
  matar(ensayo);
  process.exit(codigo);
}
