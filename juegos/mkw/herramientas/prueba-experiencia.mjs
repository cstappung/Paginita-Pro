// Prueba del jugar.bat (bitácora §69): la experiencia entera, de punta a punta, en la página de Juegos de esta PC.
//
// Resumen: arranca el ensayo de herramientas/experiencia.mjs (los emuladores de Firebase con las reglas del sitio, las
// cuentas de mentira, el sitio como GitHub Pages y el Worker de verdad) en puertos y carpeta de prueba, y lo recorre
// como lo haría una persona, con tres "PC" (tres contextos de Chrome, cada uno con su sesión):
//   - invitado: el catálogo no muestra nada (Mario Kart solo lo ven los amigos; lo demás lo esconde el filtro local);
//   - Piloto Uno inicia sesión en la ventanita del emulador («Google» de mentira) y ve SOLO Mario Kart: su «un jugador»
//     y su sala;
//   - «Mario Kart Wii · un jugador» → el juego en el marco y el menú de inicio JloKart con la imagen privada (pedida al
//     Worker con el token del emulador, re-firmado, y el correo en la lista AMIGOS); Single Player → el menú «Un
//     jugador» del juego (0x69); las partidas conectadas con la nube (Storage del emulador);
//   - B hasta el título: vuelve el menú; Multiplayer → Online → Juegos abre la ficha de la sala de Mario Kart;
//   - Piloto Uno abre la sala (CPU normal), Piloto Dos entra con el enlace: los dos en el vestíbulo;
//   - Intruso (no es amigo): sin Mario Kart en el catálogo, «Este juego es privado» y «Esta sala es privada»;
//   - «¡A correr!»: los dos juegos llegan solos a la carrera de la copa con CPU, sincronizados (las huellas coinciden):
//     el buzón de la red pasa por la base del emulador con las reglas del sitio.
// Fotos en build/web/datos/experiencia/. Tarda ~5-8 min (la carrera con dos juegos en el mismo PC).
//
// Uso:  node herramientas/prueba-experiencia.mjs [--ventana] [--rapida] [--ya]
//       --rapida: sin la carrera (~2 min).  --ya: usa un ensayo que ya está corriendo en 8154 (no arranca otro).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(raiz, 'banco/package.json'))('playwright-core');
const args = process.argv.slice(2);
const PUERTO = 8154, SITIO = `http://127.0.0.1:${PUERTO}`;   // el sitio en 8154 y su Worker en 8155
const carpeta = path.join(raiz, 'build/web/datos/experiencia');
fs.mkdirSync(carpeta, { recursive: true });
let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
const foto = (p, nombre) => p.screenshot({ path: path.join(carpeta, nombre) }).catch(() => {});
const registro = [];
const matar = h => { if (!h || h.exitCode !== null) return; if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(h.pid), '/T', '/F']); else h.kill(); };

// 1) el ensayo (lo mismo que abre el jugar.bat, sin ventanas y sin tocar lo jugado: otra carpeta, empezando de cero)
let ensayo = null;
if (!args.includes('--ya')) {
  ensayo = spawn(process.execPath, [path.join(raiz, 'herramientas/experiencia.mjs'), '--sin-ventanas', '--puerto', String(PUERTO),
    '--carpeta', 'build/emuladores-prueba', '--limpiar'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const salida = [];
  await new Promise((listo, fallo) => {
    const reloj = setTimeout(() => fallo(new Error('el ensayo no arrancó en 4 min:\n' + salida.join(''))), 240000);
    const mira = d => { salida.push(String(d)); if (/Listo:/.test(String(d))) { clearTimeout(reloj); listo(); } };
    ensayo.stdout.on('data', mira); ensayo.stderr.on('data', mira);
    ensayo.once('exit', c => { clearTimeout(reloj); fallo(new Error(`el ensayo se cerró (código ${c}):\n${salida.join('')}`)); });
  }).catch(e => { console.log('✗ ' + e.message); process.exit(1); });
}

const navegador = await chromium.launch({ channel: 'chrome', headless: !args.includes('--ventana'),
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--mute-audio', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });

// Un "PC" nuevo (contexto vacío). Playwright se anuncia con navigator.webdriver y la página esconde el menú de inicio
// a las pruebas automáticas (§67): aquí se lo esconde, para ver lo mismo que una persona.
async function pc(nombre) {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); } catch {} });
  const p = await ctx.newPage();
  p.on('pageerror', e => registro.push(`[${nombre}] pageerror ${e.message}`));
  p.on('console', m => registro.push(`[${nombre}] ${m.type()} ${m.text().slice(0, 300)}`));
  await p.goto(SITIO + '/juegos.html');
  return p;
}
// «Iniciar sesión» → la ventanita del emulador → la cuenta
async function entrar(p, nombre) {
  await p.locator('#btnEntrar').waitFor({ timeout: 20000 });
  const [ventanita] = await Promise.all([p.waitForEvent('popup', { timeout: 15000 }), p.locator('#btnEntrar').click()]);
  await ventanita.waitForLoadState();
  await ventanita.locator(`text=${nombre}`).first().click();
  await p.waitForFunction(n => document.querySelector('#btnEntrar') === null || document.body.textContent.includes(n), nombre.split(' (')[0], { timeout: 20000 });
  await espera(2500);                                   // la lista de amigos (/soy) y el catálogo
}
// Las tarjetas del catálogo de Juegos
const tarjetas = p => p.$$eval('.jg-mn', l => l.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
const hastaQue = async (fn, cond, ms, cada = 300) => {
  let v;
  for (const t0 = Date.now(); Date.now() - t0 < ms; await espera(cada)) { v = await fn().catch(() => null); if (v && cond(v)) return v; }
  return v ?? await fn().catch(() => null);
};
// Lo que interesa del juego en un marco: el menú de inicio, la cortina, el piloto, la nube
const mirar = marco => marco.evaluate(() => {
  const I = window.mkwInicio, e = window.mkwMenus ? window.mkwMenus.estado() : {};
  return {
    visible: !!I?.visible, imagen: I?.estado.imagen, opciones: I?.opciones || [], menu: I?.estado.menu,
    textos: [...document.querySelectorAll('#inicioJlo .ij-boton span')].map(t => t.textContent),
    arte: document.querySelector('#inicioJlo .ij-arte')?.naturalWidth || 0,
    cortina: !document.body.classList.contains('sin-cortina'), seccion: e.seccion, pagina: e.pagina,
    piloto: window.mkwEstado?.piloto || null, nubeLista: window.mkwEstado?.nubeLista, nube: window.mkwNube?.estado ?? null,
  };
});
const esJuego = u => /\/juegos\/mkw\/.*index\.html/.test(u);     // el marco del juego (juegos/mkw/web/navegador/index.html)
const marcoDel = (p, cond) => p.frames().find(f => esJuego(f.url()) && cond(f.url()));
const hastaMarco = async (p, cond, ms) => { for (const t0 = Date.now(); Date.now() - t0 < ms; await espera(250)) { const f = marcoDel(p, cond); if (f) return f; } return null; };
const hex = n => '0x' + (n ?? -1).toString(16);

let codigo = 1;
try {
  // ---------- invitado ----------
  const invitado = await pc('invitado');
  await espera(4000);
  const tInv = await tarjetas(invitado);
  ok('invitado: el catálogo no muestra nada (Mario Kart solo para amigos; lo demás, escondido por el filtro local)', tInv.length === 0, tInv.join(' | '));
  await foto(invitado, '1-invitado.png');
  await invitado.context().close();

  // ---------- Piloto Uno ----------
  const uno = await pc('Piloto Uno');
  await entrar(uno, 'Piloto Uno');
  ok('Piloto Uno inicia sesión con la ventanita del emulador («Google» de mentira)', await uno.locator('#btnEntrar').count() === 0 || (await uno.textContent('body')).includes('Piloto Uno'));
  const tUno = await hastaQue(() => tarjetas(uno), t => t.length >= 2, 15000);
  ok('el catálogo muestra SOLO Mario Kart: su «un jugador» y su sala', tUno?.length === 2 && tUno.every(t => /Mario Kart Wii/.test(t)) && tUno.some(t => /un jugador/.test(t)),
     (tUno || []).map(t => t.slice(0, 45)).join(' | '));
  await foto(uno, '2-catalogo-amigo.png');

  // «Mario Kart Wii · un jugador»: la tarjeta → su ficha → ▶ Practicar
  await uno.locator('.jg-mn', { hasText: 'un jugador' }).first().click();
  await uno.locator('.jg-hoja-ya[data-f=juega]').click();
  let marco = await hastaMarco(uno, () => true, 20000);
  let m = marco && await hastaQue(() => mirar(marco), x => x.visible && x.arte > 0, 30000);
  ok('«un jugador»: el juego en su marco y el menú de inicio JloKart con la imagen privada (Worker: token del emulador + lista AMIGOS)',
     !!m?.visible && m.imagen === 200 && m.arte > 0 && JSON.stringify(m.textos) === '["Single Player","Multiplayer","Options"]',
     `ruta ${new URL(uno.url()).hash}, imagen ${m?.imagen}, botones ${m?.textos?.join(' · ')}`);
  await foto(uno, '3-menu-jlokart.png');

  // Single Player (con el mouse, como una persona) → el menú «Un jugador» del juego
  await marco.locator('#inicioJlo .ij-boton').first().click();
  m = await hastaQue(() => mirar(marco), x => x.piloto?.llego && !x.cortina, 240000, 500);
  ok('Single Player: el piloto deja el juego en su menú «Un jugador» (0x69)', !!m?.piloto?.llego && m.pagina === 0x69 && !m.cortina,
     `página ${hex(m?.pagina)}, sección ${hex(m?.seccion)}`);
  await foto(uno, '4-un-jugador.png');
  ok('las partidas quedaron conectadas con la nube de la cuenta (Storage del emulador, con sus reglas)', m?.nubeLista !== undefined && !!m?.nube,
     JSON.stringify(m?.nube)?.slice(0, 120));

  // B hasta el título del juego: vuelve el menú; Multiplayer → Online → Juegos abre la sala de Mario Kart
  for (let i = 0; i < 5 && !(await mirar(marco)).visible; i++) { await uno.keyboard.down('KeyJ'); await espera(110); await uno.keyboard.up('KeyJ'); await espera(2500); }
  m = await hastaQue(() => mirar(marco), x => x.visible, 8000);
  await marco.locator('#inicioJlo .ij-boton').nth(1).click();
  await espera(400);
  const opciones = (await mirar(marco)).opciones;
  await marco.locator('#inicioJlo .ij-boton', { hasText: 'Online' }).click();
  const ficha = await uno.locator('.jg-hoja-ya[data-f=sala]').waitFor({ timeout: 10000 }).then(() => true, () => false);
  ok('B hasta el título → vuelve el menú; Multiplayer → Online: Juegos abre la ficha de la sala de Mario Kart',
     !!m?.visible && JSON.stringify(opciones) === '["local","salas","volver"]' && ficha, `menú ${m?.visible}, ${opciones.join('/')}, ficha ${ficha}`);
  await foto(uno, '5-ficha-sala.png');

  // la sala: Piloto Uno la abre (12 pilotos, CPU normal)
  await uno.locator('.jg-hoja-ya[data-f=sala]').click();
  await uno.waitForFunction(() => /#p\//.test(location.hash) && document.querySelector('.jg-mkw-empieza'), null, { timeout: 20000 }).catch(() => {});
  const enlace = uno.url();
  const vUno = (await uno.textContent('.jg-mkw-vest').catch(() => '')).replace(/\s+/g, ' ');
  ok('Piloto Uno abre la sala de Mario Kart (con CPU): el vestíbulo y «¡A correr!»', /#p\//.test(enlace) && /Piloto Uno/.test(vUno) && /¡A correr!/.test(vUno), vUno.slice(0, 90));

  // Piloto Dos (otro PC) entra con el enlace
  const dos = await pc('Piloto Dos');
  await entrar(dos, 'Piloto Dos');
  await dos.goto(enlace);
  await dos.getByRole('button', { name: /Unirse a la partida/ }).click({ timeout: 20000 });
  const v2 = await hastaQue(async () => [await uno.textContent('.jg-mkw-vest'), await dos.textContent('.jg-mkw-vest')].map(t => t.replace(/\s+/g, ' ')),
    ([a, b]) => /2 de 12/.test(a) && /2 de 12/.test(b) && /Piloto Dos/.test(a), 20000);
  ok('Piloto Dos entra con el enlace: los dos en el vestíbulo («2 de 12»)', !!v2 && /2 de 12/.test(v2[0]) && /2 de 12/.test(v2[1]) && /Piloto Dos/.test(v2[0]),
     v2 && v2[1].slice(0, 90));
  await foto(dos, '6-vestibulo-dos.png');

  // Intruso: ni el catálogo, ni «un jugador», ni la sala (aunque tenga el enlace)
  const intruso = await pc('Intruso');
  await entrar(intruso, 'Intruso');
  const tIn = await tarjetas(intruso);
  await intruso.goto(SITIO + '/juegos.html#solo/mkw');
  const privadoSolo = await intruso.waitForFunction(() => /Este juego es privado/.test(document.body.textContent), null, { timeout: 15000 }).then(() => true, () => false);
  await foto(intruso, '7-intruso.png');
  await intruso.goto(enlace);
  const privadaSala = await intruso.waitForFunction(() => /Esta sala es privada/.test(document.body.textContent), null, { timeout: 15000 }).then(() => true, () => false);
  const marcoIntruso = intruso.frames().some(f => esJuego(f.url()));
  ok('Intruso (no es amigo): sin Mario Kart en el catálogo, «Este juego es privado» y «Esta sala es privada» (sin el juego)',
     tIn.length === 0 && privadoSolo && privadaSala && !marcoIntruso, `tarjetas ${tIn.length}, solo ${privadoSolo}, sala ${privadaSala}, marco ${marcoIntruso}`);
  await intruso.context().close();

  if (!args.includes('--rapida')) {
    // «¡A correr!»: la copa con CPU, los dos juegos sincronizados por el buzón de la base (emulador, reglas del sitio)
    await uno.locator('.jg-mkw-empieza').click();
    const conSala = u => /[?&]sala=/.test(u);
    const [mA, mB] = await Promise.all([hastaMarco(uno, conSala, 30000), hastaMarco(dos, conSala, 30000)]);
    ok('«¡A correr!»: el juego se abre en la sala de los dos', !!mA && !!mB, mA ? new URL(mA.url()).searchParams.get('modo') : '');
    const leer = f => Promise.race([espera(10000).then(() => null), f.evaluate(() => {
      const e = window.mkwMenus?.estado?.(); if (!e) return null;
      return { s: e.seccion, ls: window.mkwSincro?.lockstep?.estado() || null };
    })]).catch(() => null);
    const t0 = Date.now(), llego = {};
    for (const limite = Date.now() + 6 * 60000; Date.now() < limite && !(llego.A && llego.B); await espera(1000)) {
      for (const [n, f] of [['A', mA], ['B', mB]]) { const x = f && await leer(f); if (x?.s === 0x20 && !llego[n]) { llego[n] = Date.now(); console.log(`  ${n}: en la carrera a los ${((Date.now() - t0) / 1000).toFixed(0)} s`); } }
    }
    ok('los dos llegan solos a la carrera de la copa (sección 0x20)', !!(llego.A && llego.B));
    await foto(uno, '8-carrera-uno.png'); await foto(dos, '8-carrera-dos.png');
    const x = await hastaQue(async () => [await leer(mA), await leer(mB)], ([a, b]) => (a?.ls?.huellasIguales || 0) >= 3 && (b?.ls?.cuadro || 0) > 300, 90000, 2000);
    ok('la misma carrera en los dos: las huellas coinciden y ninguno se separó', (x?.[0]?.ls?.huellasIguales || 0) >= 3 && !x?.[0]?.ls?.desincronizado && !x?.[1]?.ls?.desincronizado,
       `huellas iguales ${x?.[0]?.ls?.huellasIguales}, cuadro A ${x?.[0]?.ls?.cuadro}, B ${x?.[1]?.ls?.cuadro}`);
  }
  codigo = mal ? 1 : 0;
} catch (e) {
  console.log('✗ la prueba se cortó — ' + (e && e.stack || e));
} finally {
  console.log(`\n${bien} bien, ${mal} mal  (fotos en build/web/datos/experiencia/)`);
  fs.writeFileSync(path.join(carpeta, 'registro.txt'), registro.join('\n'));
  await navegador.close().catch(() => {});
  matar(ensayo);
  process.exit(codigo);
}
